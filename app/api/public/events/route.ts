import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/db';
import { validKey } from '@/lib/auth';
import { publishedEvents } from '@/lib/publication';

/**
 * Le flux de publication vers yeva.club. Lecture seule, par clé.
 *
 * Volontairement pauvre : seuls les événements explicitement publiés sortent,
 * et seuls leurs champs publics. Aucun billet, aucun montant, aucune donnée
 * publicitaire ne traverse. Le site ne peut rien écrire ici.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!validKey(req.headers.get('x-event-signal-key')))
    return NextResponse.json({ error: 'Clé requise' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const organizer = process.env.SHOTGUN_ORGANIZER_ID;
  if (!organizer)
    return NextResponse.json({ error: 'Organisateur non configuré' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  try {
    const events = await publishedEvents(await database(), organizer);
    return NextResponse.json(
      { events, generatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=900' } },
    );
  } catch {
    return NextResponse.json({ error: 'Service indisponible' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
