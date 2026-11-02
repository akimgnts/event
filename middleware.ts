import {NextRequest,NextResponse} from 'next/server';
import {verifyToken} from './lib/session-token';
export async function middleware(req:NextRequest){
 const path=req.nextUrl.pathname;
 if(path==='/login'||path.startsWith('/api/auth/'))return NextResponse.next();
 const key=process.env.EVENT_SIGNAL_INTERNAL_API_KEY;
 if(key&&req.headers.get('x-event-signal-key')===key)return NextResponse.next();
 if(await verifyToken(req.cookies.get('yeva_session')?.value,'session'))return NextResponse.next();
 if(path.startsWith('/api/'))return NextResponse.json({error:'Connexion requise'},{status:401,headers:{'Cache-Control':'no-store'}});
 return NextResponse.redirect(new URL('/login',req.url));
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
