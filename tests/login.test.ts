import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {NextRequest} from 'next/server';
import {hashPassword,checkPassword} from '../lib/password';
import {signToken,verifyToken} from '../lib/session-token';
import {database,closeDatabase} from '../lib/db';
import {POST} from '../app/api/auth/login/route';
test('password hashes are salted and tokens reject expiry, tampering and purpose confusion',async()=>{
 process.env.EVENT_SIGNAL_INTERNAL_API_KEY='test-private-key';
 const a=hashPassword('test-password-long');assert.notEqual(a,hashPassword('test-password-long'));assert(checkPassword('test-password-long',a));assert(!checkPassword('wrong',a));
 const token=await signToken('setup',Date.now()+60000);assert(await verifyToken(token,'setup'));assert(!await verifyToken(token+'0','setup'));assert(!await verifyToken(token,'session'));assert(!await verifyToken(await signToken('setup',Date.now()-1),'setup'));
});
test('first password requires private setup, cannot be overwritten, sessions and rate limits persist',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'yeva-login-'));process.env.EVENT_SIGNAL_DATA_DIR=dir;process.env.EVENT_SIGNAL_INTERNAL_API_KEY='test-private-key';
 try{
 const db=await database();await db.query('CREATE SCHEMA silver');for(const sql of (await readFile('db/007_login.sql','utf8')).split(';').filter(s=>s.trim()))await db.query(sql);
 const request=(password:string,cookie='',origin='https://yeva.test')=>new NextRequest('https://yeva.test/api/auth/login',{method:'POST',headers:{host:'yeva.test',origin,cookie,'content-type':'application/json'},body:JSON.stringify({password,confirmation:password})});
 assert.equal((await POST(request('first-password-long'))).status,403);
 const cookie='yeva_setup='+await signToken('setup',Date.now()+60000);
 assert.equal((await POST(request('first-password-long',cookie,'https://evil.test'))).status,403);
 const first=await POST(request('first-password-long',cookie));assert.equal(first.status,200);assert(first.cookies.get('yeva_session'));
 assert.equal((await POST(request('second-password-long',cookie))).status,401);
 const original=await POST(request('first-password-long'));assert.equal(original.status,200);
 for(let i=0;i<10;i++)assert.equal((await POST(request('incorrect-password'))).status,401);
 assert.equal((await POST(request('first-password-long'))).status,429);
 }finally{await closeDatabase();await rm(dir,{recursive:true,force:true});delete process.env.EVENT_SIGNAL_DATA_DIR;}
});
