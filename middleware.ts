import {NextRequest,NextResponse} from 'next/server';
import {verifyToken} from './lib/session-token';
import {readSubjectToken} from './lib/subject-token';

// Deux formes de session cohabitent : le jeton partagé historique et le jeton
// nominatif, qui porte l'identifiant du compte. Les deux ouvrent l'accès ; seul
// le second permet de publier, parce que publier demande un auteur.
async function authenticated(cookie:string|undefined){
 if(!cookie)return false;
 if(await verifyToken(cookie,'session'))return true;
 return Boolean(await readSubjectToken(cookie,'session'));
}

export async function middleware(req:NextRequest){
 const path=req.nextUrl.pathname;
 if(path==='/login'||path.startsWith('/api/auth/'))return NextResponse.next();
 const key=process.env.EVENT_SIGNAL_INTERNAL_API_KEY;
 if(key&&req.headers.get('x-event-signal-key')===key)return NextResponse.next();
 if(await authenticated(req.cookies.get('yeva_session')?.value))return NextResponse.next();
 if(path.startsWith('/api/'))return NextResponse.json({error:'Connexion requise'},{status:401,headers:{'Cache-Control':'no-store'}});
 return NextResponse.redirect(new URL('/login',req.url));
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
