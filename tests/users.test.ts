import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {NextRequest} from 'next/server';
import {signToken,verifyToken} from '../lib/session-token';
import {signSubjectToken,readSubjectToken} from '../lib/subject-token';
import {normalizeEmail,validPassword,createUser,authenticate,countUsers,listUsers} from '../lib/users';
import {publish,withdraw,publishedEvents} from '../lib/publication';
import {database,closeDatabase} from '../lib/db';
import {POST as login} from '../app/api/auth/login/route';
import {POST as createAccount,GET as readAccounts} from '../app/api/auth/users/route';
import {POST as changePublication} from '../app/api/publications/route';
import {GET as publicFeed} from '../app/api/public/events/route';

const MIGRATIONS=['db/001_pipeline.sql','db/002_ui_observations.sql','db/003_instagram.sql','db/004_credentials.sql','db/005_analytics.sql','db/006_sumup.sql','db/007_login.sql','db/008_content_objectives.sql','db/009_shotgun_traffic.sql','db/010_users_and_publication.sql'];

async function freshDatabase(){
 const dir=await mkdtemp(path.join(tmpdir(),'yeva-users-'));
 process.env.EVENT_SIGNAL_DATA_DIR=dir;
 process.env.EVENT_SIGNAL_INTERNAL_API_KEY='test-private-key';
 const db=await database();
 for(const file of MIGRATIONS)
  for(const sql of (await readFile(file,'utf8')).split(';').filter(s=>s.trim()))
   await db.query(sql);
 return {db,dir};
}
async function drop(dir:string){
 await closeDatabase();
 await rm(dir,{recursive:true,force:true});
 delete process.env.EVENT_SIGNAL_DATA_DIR;
}

test('le jeton de session porte un sujet, et les deux formats ne se confondent pas',async()=>{
 process.env.EVENT_SIGNAL_INTERNAL_API_KEY='test-private-key';
 const token=await signSubjectToken('session','user-42',Date.now()+60000);
 assert.equal(await readSubjectToken(token,'session'),'user-42');
 assert.equal(await readSubjectToken(token,'setup'),null,'un jeton de session ne vaut pas pour la première connexion');
 assert.equal(await readSubjectToken(token+'0','session'),null,'signature altérée');
 assert.equal(await readSubjectToken(await signSubjectToken('session','user-42',Date.now()-1),'session'),null,'expiré');
 // Le sujet est signé : on ne peut pas le remplacer en gardant la signature.
 const [purpose,,expires,signature]=token.split('.');
 const forged=[purpose,Buffer.from('autre','utf8').toString('base64url'),expires,signature].join('.');
 assert.equal(await readSubjectToken(forged,'session'),null,'sujet substitué');
 // Un jeton partagé n'a pas de sujet, et un jeton à sujet n'est pas lu par l'ancien vérificateur.
 assert.equal(await readSubjectToken(await signToken('session',Date.now()+60000),'session'),null);
 assert.equal(await verifyToken(token,'session'),false);
});

test('adresses et mots de passe : la casse ne crée pas deux comptes, 11 caractères sont refusés',async()=>{
 assert.equal(normalizeEmail(' Akim@Yeva.CLUB '),'akim@yeva.club');
 assert.equal(normalizeEmail('pas-une-adresse'),null);
 assert.equal(normalizeEmail(42),null);
 assert.equal(validPassword('onze-carac'),false);
 assert.equal(validPassword('douze-caracs'),true);
});

test('comptes nominatifs : création, rôles, et limitation par adresse',async()=>{
 const {db,dir}=await freshDatabase();
 try{
  assert.equal(await countUsers(db),0);

  const owner=await createUser(db,{email:'Akim@yeva.club',displayName:'Akim',password:'mot-de-passe-long',role:'owner'});
  assert(owner.ok&&owner.user.email==='akim@yeva.club'&&owner.user.role==='owner');

  const again=await createUser(db,{email:'AKIM@YEVA.CLUB',displayName:'Akim bis',password:'autre-mot-de-passe',role:'editor'});
  assert(!again.ok&&again.reason==='duplicate','la casse ne doit pas créer un second compte');
  assert.equal((await createUser(db,{email:'x@yeva.club',displayName:'X',password:'court',role:'editor'}) as {reason:string}).reason,'weak_password');

  const editor=await createUser(db,{email:'co@yeva.club',displayName:'Co',password:'mot-de-passe-long-2',role:'editor'});
  assert(editor.ok);
  assert.equal(await countUsers(db),2);
  assert.equal((await listUsers(db)).length,2);

  const ok=await authenticate(db,'akim@yeva.club','mot-de-passe-long');
  assert(ok.ok&&ok.user.display_name==='Akim');
  assert.equal((await authenticate(db,'akim@yeva.club','mauvais-mot-passe') as {reason:string}).reason,'invalid_password');
  assert.equal((await authenticate(db,'inconnu@yeva.club','mot-de-passe-long') as {reason:string}).reason,'unknown');

  // Dix échecs sur un compte ne doivent pas bloquer l'autre : c'était le défaut
  // de l'accès partagé, dont la limitation était globale.
  for(let i=0;i<11;i++)await authenticate(db,'akim@yeva.club','mauvais-mot-passe');
  assert.equal((await authenticate(db,'akim@yeva.club','mot-de-passe-long') as {reason:string}).reason,'throttled');
  const other=await authenticate(db,'co@yeva.club','mot-de-passe-long-2');
  assert(other.ok,'le second compte reste accessible pendant le blocage du premier');

  // Une connexion réussie remet le compteur à zéro.
  assert((await authenticate(db,'co@yeva.club','mot-de-passe-long-2')).ok);
 }finally{await drop(dir)}
});

test("publication vers le site : explicite, retirable, et tracée avec son auteur",async()=>{
 const {db,dir}=await freshDatabase();
 try{
  await db.query("INSERT INTO silver.events(organizer_id,event_id,name,starts_at,timezone,status,source,synced_at) VALUES('yeva','615336','Trap Session #2','2026-11-21T19:30:00Z','Europe/Paris','published','shotgun',now())");
  await db.query("INSERT INTO silver.events(organizer_id,event_id,name,starts_at,timezone,status,source,synced_at) VALUES('yeva','999','Brouillon interne','2026-12-20T19:30:00Z','Europe/Paris','draft','shotgun',now())");

  assert.deepEqual(await publishedEvents(db,'yeva'),[],'rien ne sort sans geste explicite');

  await publish(db,'yeva','615336','user-akim');
  const visible=await publishedEvents(db,'yeva');
  assert.equal(visible.length,1,'seul l’événement publié sort, pas le brouillon');
  assert.equal(visible[0].name,'Trap Session #2');
  assert.deepEqual(Object.keys(visible[0]).sort(),['endsAt','eventId','name','publishedAt','startsAt','timezone'],'aucun champ interne ne traverse');

  await withdraw(db,'yeva','615336','user-co');
  assert.deepEqual(await publishedEvents(db,'yeva'),[],'un retrait fait disparaître l’événement du site');

  await publish(db,'yeva','615336','user-akim');
  assert.equal((await publishedEvents(db,'yeva')).length,1,'republier annule le retrait');

  const audit=await db.query<{action:string;actor_id:string}>('SELECT action,actor_id FROM silver.publication_audit ORDER BY changed_at,action');
  assert.equal(audit.rows.length,3);
  assert.deepEqual(audit.rows.map(r=>r.actor_id).sort(),['user-akim','user-akim','user-co']);

  await assert.rejects(publish(db,'yeva','inconnu','user-akim'),'on ne publie pas un événement qui n’existe pas');
 }finally{await drop(dir)}
});

test('bout en bout : premier compte, connexion, publication, flux lu par le site',async()=>{
 const {db,dir}=await freshDatabase();
 process.env.SHOTGUN_ORGANIZER_ID='yeva';
 try{
  await db.query("INSERT INTO silver.events(organizer_id,event_id,name,starts_at,ends_at,timezone,status,source,synced_at) VALUES('yeva','615336','Trap Session #2','2026-11-21T19:30:00Z','2026-11-21T22:00:00Z','Europe/Paris','published','shotgun',now())");

  const post=(url:string,body:unknown,cookie='')=>new NextRequest(url,{method:'POST',headers:{host:'yeva.test',origin:'https://yeva.test',cookie,'content-type':'application/json'},body:JSON.stringify(body)});
  const get=(url:string,headers:Record<string,string>={})=>new NextRequest(url,{headers:{host:'yeva.test',...headers}});

  // Le premier compte exige le lien privé de première connexion.
  const account={email:'akim@yeva.club',displayName:'Akim',password:'mot-de-passe-long'};
  assert.equal((await createAccount(post('https://yeva.test/api/auth/users',account))).status,403);
  const setup='yeva_setup='+await signToken('setup',Date.now()+60000);
  const created=await createAccount(post('https://yeva.test/api/auth/users',account,setup));
  assert.equal(created.status,201);
  assert.equal((await created.json()).user.role,'owner');

  // Une origine étrangère est refusée même avec le bon mot de passe.
  const foreign=new NextRequest('https://yeva.test/api/auth/login',{method:'POST',headers:{host:'yeva.test',origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify(account)});
  assert.equal((await login(foreign)).status,403);

  assert.equal((await login(post('https://yeva.test/api/auth/login',{email:account.email,password:'mauvais-mot-passe'}))).status,401);
  const signedIn=await login(post('https://yeva.test/api/auth/login',account));
  assert.equal(signedIn.status,200);
  const sessionCookie=signedIn.cookies.get('yeva_session');
  assert(sessionCookie,'la connexion pose un cookie de session');
  const subject=await readSubjectToken(sessionCookie!.value,'session');
  assert.equal(subject,(await listUsers(db))[0].id,'le cookie porte l’identifiant du compte');

  // Un éditeur ne peut pas se fabriquer un accès : seul un `owner` crée un compte.
  const editor=await createAccount(post('https://yeva.test/api/auth/users',{email:'co@yeva.club',displayName:'Co',password:'mot-de-passe-long-2'},'yeva_session='+sessionCookie!.value));
  assert.equal(editor.status,201);
  assert.equal((await editor.json()).user.role,'editor');
  const asEditor=await login(post('https://yeva.test/api/auth/login',{email:'co@yeva.club',password:'mot-de-passe-long-2'}));
  const editorCookie='yeva_session='+asEditor.cookies.get('yeva_session')!.value;
  assert.equal((await createAccount(post('https://yeva.test/api/auth/users',{email:'tiers@yeva.club',displayName:'T',password:'mot-de-passe-long-3'},editorCookie))).status,403);

  // Publier demande un compte nominatif : le jeton partagé ne suffit pas.
  const shared='yeva_session='+await signToken('session',Date.now()+60000);
  assert.equal((await changePublication(post('https://yeva.test/api/publications',{eventId:'615336',action:'publish'},shared))).status,401);

  // Le site ne voit rien avant la publication, même avec la clé.
  const key={'x-event-signal-key':'test-private-key'};
  assert.equal((await publicFeed(get('https://yeva.test/api/public/events'))).status,401,'sans clé, rien ne sort');
  assert.deepEqual((await (await publicFeed(get('https://yeva.test/api/public/events',key))).json()).events,[]);

  const published=await changePublication(post('https://yeva.test/api/publications',{eventId:'615336',action:'publish'},'yeva_session='+sessionCookie!.value));
  assert.equal(published.status,200);

  const feed=await (await publicFeed(get('https://yeva.test/api/public/events',key))).json();
  assert.equal(feed.events.length,1);
  assert.equal(feed.events[0].eventId,'615336');
  assert.equal(feed.events[0].startsAt,'2026-11-21T19:30:00.000Z');

  assert.equal((await readAccounts(get('https://yeva.test/api/auth/users'))).status,200);
  const accounts=await (await readAccounts(get('https://yeva.test/api/auth/users'))).json();
  assert(!JSON.stringify(accounts).includes('password'),'la liste des comptes ne contient aucun hash');
 }finally{delete process.env.SHOTGUN_ORGANIZER_ID;await drop(dir)}
});
