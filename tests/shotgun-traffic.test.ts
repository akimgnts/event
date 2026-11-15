import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchShotgunTraffic,parseTraffic,ShotgunTrafficError,trafficErrorMessage} from '../lib/connectors/shotgun-traffic';
import {ratio} from '../lib/kpis';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
// Only the supplied control counts are real observations. Dates/UTM below are parser fixtures.
const control=()=>({data:{event:{id:615336,traffic:{visitsCount:107,ordersCount:4}}}});
test('supplied control: 107 visits, 4 orders and 6 public paid tickets',()=>{
 const t=parseTraffic(control(),615336,'Europe/Paris');
 assert.equal((ratio(t.ordersCount,t.visitsCount)!*100).toFixed(1),'3.7');
 assert.equal((ratio(6,t.visitsCount)!*100).toFixed(1),'5.6');
 assert.equal(t.todaysVisits,null);assert.equal(t.trafficLastUpdate,null);
});
test('parser fixture: UTC 23:00 maps to following Paris day; fraction stays a fraction',()=>{
 const raw=control() as any;raw.data.event.traffic.visitsByDay=[{day:'2026-11-08T23:00:00Z',sum:7}];
 raw.data.event.traffic.visitsByUtm=[{utmSource:'meta_pub',type:'tracking_link',count:39,percent:0.3644}];
 const t=parseTraffic(raw,615336,'Europe/Paris');assert.equal(t.visitsByDay?.[0].day,'2026-11-09');assert.equal(t.visitsByUtm?.[0].percent,0.3644);
 assert.equal((t.visitsByUtm![0].percent*100).toFixed(1),'36.4');
 raw.data.event.traffic.visitsByDay=[{day:'2026-07-08T22:00:00Z',sum:7}];assert.equal(parseTraffic(raw,615336,'Europe/Paris').visitsByDay?.[0].day,'2026-07-09');
});
test('real zero preserved; zero denominator and absent values stay unknown',()=>{
 const raw=control();raw.data.event.traffic.visitsCount=0;const t=parseTraffic(raw,615336,'Europe/Paris');assert.equal(t.visitsCount,0);assert.equal(ratio(4,t.visitsCount),null);assert.equal(t.sharesCount,null);
});
test('invalid nested payload still throws the dedicated exception',()=>{
 const raw=control() as any;raw.data.event.traffic.visitsByDay=[null];assert.throws(()=>parseTraffic(raw,615336,'Europe/Paris'),ShotgunTrafficError);
});
test('traffic migration is repeatable and stores failures without zero substitution',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE SCHEMA silver; CREATE TABLE silver.events(organizer_id text,event_id text,PRIMARY KEY(organizer_id,event_id));');
 const sql=await readFile('db/009_shotgun_traffic.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec("INSERT INTO silver.events VALUES('org','615336'); INSERT INTO silver.shotgun_traffic(organizer_id,event_id,attempted_at,status,error_code) VALUES('org','615336',now(),'unavailable','TRAFFIC_HTTP_401');");
 const result=await db.query<any>('SELECT payload,collected_at,error_code FROM silver.shotgun_traffic');assert.equal(result.rows[0].payload,null);assert.equal(result.rows[0].collected_at,null);assert.equal(result.rows[0].error_code,'TRAFFIC_HTTP_401');
 }finally{await db.close();}
});
test('HTTP request includes required headers, operation and event ID',async()=>{
 const request:typeof fetch=async(url,init)=>{assert.equal(url,'https://smartboard-api.shotgun.live/api/graphql');const h=new Headers(init?.headers);assert.equal(h.get('x-shotgun-origin'),'smartboard');assert.equal(h.get('x-shotgun-platform'),'web');assert.equal(h.get('authorization'),'Bearer test-only');assert.equal(h.get('content-type'),'application/json');const b=JSON.parse(String(init?.body));assert.equal(b.operationName,'eventTraffic');assert.equal(b.variables.eventId,615336);return new Response(JSON.stringify(control()));};
 assert.equal((await fetchShotgunTraffic(615336,'Europe/Paris','test-only',request)).visitsCount,107);
});
test('missing token, HTTP errors, timeout, network, absent event and GraphQL errors throw dedicated errors',async()=>{
 await assert.rejects(fetchShotgunTraffic(615336,'Europe/Paris',''),{code:'TRAFFIC_TOKEN_MISSING'});
 for(const status of [401,403,429])await assert.rejects(fetchShotgunTraffic(615336,'Europe/Paris','test-only',async()=>new Response('',{status})),{code:`TRAFFIC_HTTP_${status}`});
 await assert.rejects(fetchShotgunTraffic(615336,'Europe/Paris','test-only',async()=>{throw new DOMException('timeout','TimeoutError')}),{code:'TRAFFIC_TIMEOUT'});
 await assert.rejects(fetchShotgunTraffic(615336,'Europe/Paris','test-only',async()=>{throw new Error('secret must not escape')}),{code:'TRAFFIC_NETWORK_OR_RESPONSE_ERROR'});
 for(const raw of [{data:{event:null}},{errors:[{message:'private'}],...control()}])assert.throws(()=>parseTraffic(raw,615336,'Europe/Paris'),ShotgunTrafficError);
 assert.match(trafficErrorMessage('TRAFFIC_HTTP_401'),/à renouveler/);
});
