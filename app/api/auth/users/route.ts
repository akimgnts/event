import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/db';
import { allowedMutation } from '@/lib/mutation';
import { verifyToken } from '@/lib/session-token';
import { readSubjectToken } from '@/lib/subject-token';
import { createUser, countUsers, listUsers } from '@/lib/users';

const noStore = { 'Cache-Control': 'no-store' };

/** Liste les comptes. Jamais de hash de mot de passe dans la réponse. */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ users: await listUsers(await database()) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503, headers: noStore });
  }
}

/**
 * Crée un compte.
 *
 * Le premier compte passe par le lien privé de première connexion — le même
 * `yeva_setup` que l'accès partagé — et reçoit le rôle `owner`. Les suivants
 * exigent un `owner` déjà connecté, pour qu'un éditeur ne puisse pas se
 * fabriquer un second accès.
 */
export async function POST(req: NextRequest) {
  if (!allowedMutation(req)) return NextResponse.json({ error: 'Requête refusée' }, { status: 403, headers: noStore });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400, headers: noStore });
  }

  const db = await database();
  const first = (await countUsers(db)) === 0;
  let role: 'owner' | 'editor' = 'owner';

  if (first) {
    if (!(await verifyToken(req.cookies.get('yeva_setup')?.value, 'setup')))
      return NextResponse.json({ error: 'Ouvre ton lien privé de première connexion.' }, { status: 403, headers: noStore });
  } else {
    const actorId = await readSubjectToken(req.cookies.get('yeva_session')?.value, 'session');
    const actor = actorId ? (await listUsers(db)).find(u => u.id === actorId) : undefined;
    if (!actor) return NextResponse.json({ error: 'Connexion requise' }, { status: 401, headers: noStore });
    if (actor.role !== 'owner')
      return NextResponse.json({ error: 'Réservé au compte propriétaire.' }, { status: 403, headers: noStore });
    role = body.role === 'owner' ? 'owner' : 'editor';
  }

  const result = await createUser(db, { email: body.email, displayName: body.displayName, password: body.password, role });
  if (!result.ok) {
    const message = {
      invalid_email: 'Adresse e-mail invalide.',
      weak_password: 'Utilise entre 12 et 256 caractères.',
      duplicate: 'Ce compte existe déjà.',
    }[result.reason];
    return NextResponse.json({ error: message }, { status: result.reason === 'duplicate' ? 409 : 400, headers: noStore });
  }

  const response = NextResponse.json({ user: result.user }, { status: 201, headers: noStore });
  if (first) response.cookies.delete('yeva_setup');
  return response;
}
