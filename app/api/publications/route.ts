import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/db';
import { allowedMutation } from '@/lib/mutation';
import { readSubjectToken } from '@/lib/subject-token';
import { publish, withdraw, publishedEvents } from '@/lib/publication';

const noStore = { 'Cache-Control': 'no-store' };

/** Ce qui est actuellement visible sur le site public. */
export async function GET() {
  const organizer = process.env.SHOTGUN_ORGANIZER_ID;
  if (!organizer) return NextResponse.json({ error: 'Organisateur non configuré' }, { status: 503, headers: noStore });
  try {
    return NextResponse.json({ events: await publishedEvents(await database(), organizer) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503, headers: noStore });
  }
}

/**
 * Publie ou retire un événement. Action explicite, jamais automatique : rien
 * n'arrive sur yeva.club parce qu'un statut Shotgun a changé. Chaque geste est
 * horodaté avec son auteur dans `silver.publication_audit`.
 */
export async function POST(req: NextRequest) {
  if (!allowedMutation(req)) return NextResponse.json({ error: 'Requête refusée' }, { status: 403, headers: noStore });

  const actorId = await readSubjectToken(req.cookies.get('yeva_session')?.value, 'session');
  if (!actorId)
    return NextResponse.json({ error: 'Publier demande un compte nominatif.' }, { status: 401, headers: noStore });

  const organizer = process.env.SHOTGUN_ORGANIZER_ID;
  if (!organizer) return NextResponse.json({ error: 'Organisateur non configuré' }, { status: 503, headers: noStore });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400, headers: noStore });
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId : '';
  const action = body.action === 'withdraw' ? 'withdraw' : body.action === 'publish' ? 'publish' : null;
  if (!eventId || !action) return NextResponse.json({ error: 'Requête invalide' }, { status: 400, headers: noStore });

  try {
    const db = await database();
    if (action === 'publish') await publish(db, organizer, eventId, actorId);
    else await withdraw(db, organizer, eventId, actorId);
    return NextResponse.json({ ok: true, events: await publishedEvents(db, organizer) }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: 'Événement inconnu ou base indisponible' }, { status: 409, headers: noStore });
  }
}
