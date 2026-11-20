/**
 * Publication vers le site public.
 *
 * Signal prépare et valide, yeva.club affiche. Le flux est à sens unique : le
 * site lit, il n'écrit jamais.
 *
 * Un événement n'apparaît sur le site que sur action explicite, enregistrée
 * avec son auteur. C'est la même discipline que les associations campagne →
 * événement : rien n'est publié parce qu'un statut fournisseur a changé.
 */

import { randomUUID } from 'node:crypto';

type DB = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };

/** Champs envoyés au site. Volontairement pauvre : rien d'interne ne sort. */
export type PublicEvent = {
  eventId: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  publishedAt: string;
};

export async function publish(db: DB, organizerId: string, eventId: string, actorId: string): Promise<void> {
  await db.query(
    `INSERT INTO silver.site_publications(organizer_id,event_id,actor_id)
     VALUES($1,$2,$3)
     ON CONFLICT(organizer_id,event_id) DO UPDATE SET withdrawn_at=NULL,published_at=now(),actor_id=$3`,
    [organizerId, eventId, actorId],
  );
  await db.query(
    'INSERT INTO silver.publication_audit(id,organizer_id,event_id,action,actor_id) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), organizerId, eventId, 'publish', actorId],
  );
}

export async function withdraw(db: DB, organizerId: string, eventId: string, actorId: string): Promise<void> {
  await db.query(
    'UPDATE silver.site_publications SET withdrawn_at=now(),actor_id=$3 WHERE organizer_id=$1 AND event_id=$2',
    [organizerId, eventId, actorId],
  );
  await db.query(
    'INSERT INTO silver.publication_audit(id,organizer_id,event_id,action,actor_id) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), organizerId, eventId, 'withdraw', actorId],
  );
}

/**
 * Ce que le site a le droit de lire : les événements publiés et non retirés.
 * Aucun billet, aucun montant, aucune donnée publicitaire ne traverse.
 */
export async function publishedEvents(db: DB, organizerId: string): Promise<PublicEvent[]> {
  const r = await db.query<Record<string, unknown>>(
    `SELECT e.event_id,e.name,e.starts_at,e.ends_at,e.timezone,p.published_at
     FROM silver.site_publications p
     JOIN silver.events e ON e.organizer_id=p.organizer_id AND e.event_id=p.event_id
     WHERE p.organizer_id=$1 AND p.withdrawn_at IS NULL
     ORDER BY e.starts_at DESC NULLS LAST`,
    [organizerId],
  );
  const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
  return r.rows.map(row => ({
    eventId: String(row.event_id),
    name: String(row.name),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    timezone: row.timezone ? String(row.timezone) : null,
    publishedAt: iso(row.published_at) ?? new Date(0).toISOString(),
  }));
}
