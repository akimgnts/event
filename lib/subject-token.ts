/**
 * Jeton de session portant un sujet.
 *
 * `lib/session-token.ts` signe `purpose.expires` : il prouve qu'une session est
 * valide, jamais à qui elle appartient. Ce module ajoute le sujet — l'identifiant
 * de l'utilisateur — sans toucher à l'existant, qui reste en service pour le
 * lien de première connexion.
 *
 * Format : `purpose.subject.expires.signature`, signature HMAC-SHA256 du triplet.
 * Le sujet est encodé en base64url, donc sans point : le découpage reste sûr.
 */

const encoder = new TextEncoder();

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const unb64url = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

async function sign(payload: string): Promise<string> {
  const secret = process.env.EVENT_SIGNAL_INTERNAL_API_KEY;
  if (!secret) throw Error('AUTH_NOT_CONFIGURED');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig), v => v.toString(16).padStart(2, '0')).join('');
}

export async function signSubjectToken(purpose: string, subject: string, expires: number): Promise<string> {
  const payload = `${purpose}.${b64url(subject)}.${expires}`;
  return payload + '.' + (await sign(payload));
}

/** Renvoie le sujet si le jeton est valide, sinon `null`. Jamais `true` sans identité. */
export async function readSubjectToken(token: string | undefined, purpose: string): Promise<string | null> {
  if (!token || !process.env.EVENT_SIGNAL_INTERNAL_API_KEY) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [got, subject, expires, signature] = parts;
  if (got !== purpose || !/^\d+$/.test(expires) || Number(expires) <= Date.now()) return null;

  const expected = await sign(`${got}.${subject}.${expires}`);
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const value = unb64url(subject);
    return value.length ? value : null;
  } catch {
    return null;
  }
}
