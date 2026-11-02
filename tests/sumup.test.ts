import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {normalizeTransaction,historyPage,fetchSumup} from '../lib/connectors/sumup';
const transaction={id:'test-payment',amount:20,currency:'EUR',timestamp:'2026-10-23T20:00:00Z',status:'SUCCESSFUL',type:'PAYMENT',refunded_amount:0};
test('SumUp retains reporting fields only and refuses invalid money',()=>{
 const r=normalizeTransaction({...transaction,user:'private@example.test',card:{number:'private'}});
 assert.equal(r.user,undefined);assert.equal(r.card,undefined);
 assert.throws(()=>normalizeTransaction({...transaction,amount:null}));
 assert.throws(()=>normalizeTransaction({...transaction,refunded_amount:21}));
 assert.equal(normalizeTransaction({...transaction,id:undefined,transaction_id:'alternate'}).id,'alternate');
});
test('pagination cannot send bearer credentials to another host',()=>{
 const base=new URL('https://api.sumup.com/v2.1/merchants/TEST/transactions/history');
 assert.equal(historyPage(base,'limit=100&oldest_ref=next').origin,base.origin);
 for(const link of ['https://evil.test/','//evil.test','/other','#fragment'])assert.throws(()=>historyPage(base,link));
});
test('SumUp consumes all pages with GET and sanitizes data; errors fail collection',async()=>{
 const fetchBefore=globalThis.fetch,tokenBefore=process.env.SUMUP_ACCESS_TOKEN,merchantBefore=process.env.SUMUP_MERCHANT_CODE;
 process.env.SUMUP_ACCESS_TOKEN='test-only';process.env.SUMUP_MERCHANT_CODE='TEST';let n=0;
 try{
  globalThis.fetch=async(input,init)=>{assert.equal(new URL(String(input)).hostname,'api.sumup.com');assert.equal(init?.method,undefined);n++;return new Response(JSON.stringify(n===1?{items:[transaction],links:[{rel:'next',href:'limit=100&oldest_ref=next'}]}:{items:[{...transaction,id:'second'}],links:[]}))};
  assert.equal((await fetchSumup()).length,2);assert.equal(n,2);
  globalThis.fetch=async()=>new Response('{}',{status:403});await assert.rejects(fetchSumup(),/PROVIDER_HTTP_403/);
 }finally{globalThis.fetch=fetchBefore;if(tokenBefore===undefined)delete process.env.SUMUP_ACCESS_TOKEN;else process.env.SUMUP_ACCESS_TOKEN=tokenBefore;if(merchantBefore===undefined)delete process.env.SUMUP_MERCHANT_CODE;else process.env.SUMUP_MERCHANT_CODE=merchantBefore;}
});
test('SumUp warehouse keeps unassigned payments out of event totals and prevents duplicate links',async()=>{
 const db=new PGlite();try{
 for(const file of ['001_pipeline.sql','006_sumup.sql'])await db.exec(await readFile('db/'+file,'utf8'));
 await db.exec(await readFile('db/006_sumup.sql','utf8'));
 await db.exec("INSERT INTO silver.events(organizer_id,event_id,name,status,source,synced_at) VALUES('org','1','Test','past','test',now()); INSERT INTO silver.sumup_transactions VALUES('TEST','p','code',20,'EUR',now(),'SUCCESSFUL','PAYMENT','POS',NULL,now());");
 assert.equal((await db.query('SELECT * FROM gold.event_sumup')).rows.length,0);
 await db.exec("INSERT INTO silver.sumup_event_links VALUES('TEST','p','org','1','Test fixture',now())");
 const row=(await db.query<any>('SELECT * FROM gold.event_sumup')).rows[0];assert.equal(Number(row.gross_payments),20);assert.equal(Number(row.unknown_refunds),1);assert.equal(row.reported_refunds,null);
 await assert.rejects(db.exec("INSERT INTO silver.sumup_event_links VALUES('TEST','p','org','1','Duplicate',now())"));
 }finally{await db.close()}
});
