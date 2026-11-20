import {NextRequest,NextResponse} from 'next/server';
import {database,session} from '@/lib/db';
import {allowedMutation} from '@/lib/mutation';
import {hashPassword,checkPassword} from '@/lib/password';
import {signToken,verifyToken} from '@/lib/session-token';
import {signSubjectToken} from '@/lib/subject-token';
import {authenticate} from '@/lib/users';

const WEEK=7*86400000;
function setSession(response:NextResponse,token:string){
 response.headers.set('Cache-Control','no-store');
 response.cookies.set('yeva_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:7*86400});
 response.cookies.delete('yeva_setup');
 return response;
}

export async function POST(req:NextRequest){
 if(!allowedMutation(req))return NextResponse.json({error:'Requête refusée'},{status:403});
 let body;try{body=await req.json()}catch{return NextResponse.json({error:'Requête invalide'},{status:400})}

 // Connexion nominative. Elle sait qui se connecte : le jeton porte l'identifiant
 // du compte, donc une publication ou une association confirmée a un auteur.
 if(typeof body.email==='string'){
  let result;
  try{result=await authenticate(await database(),body.email,body.password)}
  catch{return NextResponse.json({error:'Connexion indisponible'},{status:503})}
  if(result.ok)return setSession(NextResponse.json({ok:true,user:result.user}),await signSubjectToken('session',result.user.id,Date.now()+WEEK));
  // Un compte inconnu renvoie le même message qu'un mot de passe faux : on ne
  // révèle pas quelles adresses existent.
  if(result.reason==='throttled')return NextResponse.json({error:'Trop de tentatives. Réessaie dans 15 minutes.'},{status:429,headers:{'Cache-Control':'no-store'}});
  if(result.reason==='disabled')return NextResponse.json({error:'Ce compte est désactivé.'},{status:403,headers:{'Cache-Control':'no-store'}});
  return NextResponse.json({error:'Identifiants incorrects.'},{status:401,headers:{'Cache-Control':'no-store'}});
 }

 // Accès partagé historique (`silver.hub_access`) : conservé tant que la bascule
 // vers les comptes nominatifs n'est pas terminée.
 const password=body.password;if(typeof password!=='string'||password.length<12||password.length>256)return NextResponse.json({error:'Utilise entre 12 et 256 caractères.'},{status:400});
 const conn=await session(),db=conn.db;let active=false;
 try{
  await db.query('BEGIN');active=true;await db.query('LOCK TABLE silver.hub_access, silver.login_throttle IN SHARE ROW EXCLUSIVE MODE');
  const stored=(await db.query<{password_hash:string}>('SELECT password_hash FROM silver.hub_access WHERE id=1')).rows[0];
  if(!stored){
   if(!await verifyToken(req.cookies.get('yeva_setup')?.value,'setup')){await db.query('ROLLBACK');active=false;return NextResponse.json({error:'Ouvre ton lien privé de première connexion.'},{status:403})}
   if(body.confirmation!==password){await db.query('ROLLBACK');active=false;return NextResponse.json({error:'Les mots de passe sont différents.'},{status:400})}
   await db.query('INSERT INTO silver.hub_access(id,password_hash) VALUES(1,$1)',[hashPassword(password)]);
  }else{
   await db.query(`INSERT INTO silver.login_throttle(id,attempts) VALUES(1,1) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN login_throttle.window_start<now()-interval '15 minutes' THEN 1 ELSE login_throttle.attempts+1 END,window_start=CASE WHEN login_throttle.window_start<now()-interval '15 minutes' THEN now() ELSE login_throttle.window_start END`);
   const attempts=Number((await db.query('SELECT attempts FROM silver.login_throttle WHERE id=1')).rows[0].attempts);
   if(attempts>10||!checkPassword(password,stored.password_hash)){await db.query('COMMIT');active=false;return NextResponse.json({error:attempts>10?'Trop de tentatives. Réessaie dans 15 minutes.':'Mot de passe incorrect.'},{status:attempts>10?429:401})}
   await db.query('DELETE FROM silver.login_throttle WHERE id=1');
  }
  await db.query('COMMIT');active=false;
  return setSession(NextResponse.json({ok:true}),await signToken('session',Date.now()+WEEK));
 }catch{if(active)await db.query('ROLLBACK');return NextResponse.json({error:'Connexion indisponible'},{status:503})}finally{conn.release()}
}
