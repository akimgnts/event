import { NextRequest, NextResponse } from 'next/server';
export function middleware(req: NextRequest) {
  const key = process.env.EVENT_SIGNAL_INTERNAL_API_KEY;
  const header = req.headers.get('authorization');
  let password = '';
  try { if(header?.startsWith('Basic ')) password = atob(header.slice(6)).split(':').slice(1).join(':'); } catch {}
  if (key && (password === key || req.headers.get('x-event-signal-key') === key)) return NextResponse.next();
  return new NextResponse('Accès privé Event Signal', {status:401,headers:{'WWW-Authenticate':'Basic realm="Event Signal"','Cache-Control':'no-store'}});
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
