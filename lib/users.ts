/**
 * Comptes nominatifs — Signal.
 *
 * L'accès reposait sur `silver.hub_access`, contrainte à une seule ligne par
 * `CHECK(id=1)` : un mot de passe partagé, aucune identité. On ne pouvait donc
 * pas savoir qui s'était connecté, ni qui avait confirmé une association. Et la
 * limitation des tentatives, elle aussi en `id=1`, était globale : dix échecs
 * bloquaient l'accès de tout le monde, pas celui du fautif.
 *
 * Ce module ajoute de vrais comptes. Il n'altère pas `hub_access`, qui reste
 * en place comme accès de secours tant que la bascule n'est pas terminée.
 */

import { randomUUID, timingSafeEqual } from 'node:crypto';
import { hashPassword, checkPassword } from './password';

type DB = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };

export type Role = 'owner' | 'editor';
export type HubUser = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  last_seen_at: string | null;
  disabled_at: string | null;
};

export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 256;
const MAX_ATTEMPTS = 10;
const WINDOW = '15 minutes';

const USER_FIELDS = 'id,email,display_name,role,last_seen_at,disabled_at';

/** Les adresses sont comparées en minuscules : la casse ne crée pas un second compte. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_PASSWORD && value.length <= MAX_PASSWORD;
}

export async function countUsers(db: DB): Promise<number> {
  const r = await db.query<{ n: string }>('SELECT count(*)::int AS n FROM silver.hub_users');
  return Number(r.rows[0]?.n ?? 0);
}

export async function listUsers(db: DB): Promise<HubUser[]> {
  const r = await db.query<HubUser>(`SELECT ${USER_FIELDS} FROM silver.hub_users ORDER BY created_at`);
  return r.rows;
}

export async function findUser(db: DB, email: string): Promise<HubUser | null> {
  const r = await db.query<HubUser>(`SELECT ${USER_FIELDS} FROM silver.hub_users WHERE email=$1`, [email]);
  return r.rows[0] ?? null;
}

export type CreateResult = { ok: true; user: HubUser } | { ok: false; reason: 'invalid_email' | 'weak_password' | 'duplicate' };

export async function createUser(
  db: DB,
  input: { email: unknown; displayName: unknown; password: unknown; role: Role },
): Promise<CreateResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: 'invalid_email' };
  if (!validPassword(input.password)) return { ok: false, reason: 'weak_password' };

  const displayName = typeof input.displayName === 'string' ? input.displayName.trim().slice(0, 120) : '';
  if (await findUser(db, email)) return { ok: false, reason: 'duplicate' };

  const id = randomUUID();
  await db.query(
    'INSERT INTO silver.hub_users(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',
    [id, email, displayName || email.split('@')[0], hashPassword(input.password), input.role],
  );
  const user = await findUser(db, email);
  return user ? { ok: true, user } : { ok: false, reason: 'duplicate' };
}

export type AuthResult =
  | { ok: true; user: HubUser }
  | { ok: false; reason: 'invalid_email' | 'invalid_password' | 'unknown' | 'disabled' | 'throttled'; retryAfterMinutes?: number };

/**
 * Vérifie un couple adresse / mot de passe.
 *
 * La limitation est **par adresse**, et comptée avant la vérification : une
 * attaque sur un compte ne bloque plus les autres. Un compte inconnu consomme
 * tout de même une tentative et renvoie le même délai qu'un mot de passe faux,
 * pour ne pas révéler quelles adresses existent.
 */
export async function authenticate(db: DB, rawEmail: unknown, password: unknown): Promise<AuthResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, reason: 'invalid_email' };
  if (!validPassword(password)) return { ok: false, reason: 'invalid_password' };

  await db.query(
    `INSERT INTO silver.user_login_throttle(email,attempts) VALUES($1,1)
     ON CONFLICT(email) DO UPDATE SET
       attempts = CASE WHEN user_login_throttle.window_start < now() - interval '${WINDOW}' THEN 1 ELSE user_login_throttle.attempts + 1 END,
       window_start = CASE WHEN user_login_throttle.window_start < now() - interval '${WINDOW}' THEN now() ELSE user_login_throttle.window_start END`,
    [email],
  );
  const attempts = Number(
    (await db.query<{ attempts: string }>('SELECT attempts FROM silver.user_login_throttle WHERE email=$1', [email]))
      .rows[0]?.attempts ?? 0,
  );
  if (attempts > MAX_ATTEMPTS) return { ok: false, reason: 'throttled', retryAfterMinutes: 15 };

  const row = (
    await db.query<{ id: string; password_hash: string; disabled_at: string | null }>(
      'SELECT id,password_hash,disabled_at FROM silver.hub_users WHERE email=$1',
      [email],
    )
  ).rows[0];

  if (!row) return { ok: false, reason: 'unknown' };
  if (row.disabled_at) return { ok: false, reason: 'disabled' };
  if (!checkPassword(password, row.password_hash)) return { ok: false, reason: 'invalid_password' };

  await db.query('DELETE FROM silver.user_login_throttle WHERE email=$1', [email]);
  await db.query('UPDATE silver.hub_users SET last_seen_at=now() WHERE id=$1', [row.id]);

  const user = await findUser(db, email);
  return user ? { ok: true, user } : { ok: false, reason: 'unknown' };
}

/** Compare deux identifiants sans fuite de temps. */
export function sameId(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
