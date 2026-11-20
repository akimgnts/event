import {NextRequest,NextResponse} from 'next/server';
import {database} from '@/lib/db';
import {verifyToken} from '@/lib/session-token';
import {readSubjectToken} from '@/lib/subject-token';
import {listUsers} from '@/lib/users';

const noStore={'Cache-Control':'no-store'};

export async function GET(req:NextRequest){try{
 const db=await database();
 const shared=(await db.query('SELECT 1 FROM silver.hub_access WHERE id=1')).rows.length>0;
 // La table des comptes peut manquer tant que la migration 010 n'est pas passée :
 // l'écran de connexion doit rester utilisable dans ce cas.
 let users:Awaited<ReturnType<typeof listUsers>>=[];
 try{users=await listUsers(db)}catch{}
 const actorId=await readSubjectToken(req.cookies.get('yeva_session')?.value,'session');
 const me=actorId?users.find(u=>u.id===actorId):undefined;
 const initialized=shared||users.length>0;
 return NextResponse.json({
  initialized,
  accounts:users.length,
  me:me?{id:me.id,email:me.email,displayName:me.display_name,role:me.role}:null,
  setupAllowed:!initialized&&await verifyToken(req.cookies.get('yeva_setup')?.value,'setup'),
 },{headers:noStore});
}catch{return NextResponse.json({error:'Service indisponible'},{status:503,headers:noStore})}}
