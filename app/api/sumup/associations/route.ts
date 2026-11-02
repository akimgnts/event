import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {session} from '@/lib/db';
import {allowedMutation} from '@/lib/mutation';
export async function POST(req:NextRequest){
 if(!allowedMutation(req))return NextResponse.json({error:'Requête refusée'},{status:403});
 let b;try{b=await req.json()}catch{return NextResponse.json({error:'Requête invalide'},{status:400})}
 if(typeof b.transactionId!=='string'||!b.transactionId||b.transactionId.length>200||!(b.eventId===null||typeof b.eventId==='string'&&/^\d+$/.test(b.eventId)))return NextResponse.json({error:'Association invalide'},{status:400});
 const conn=await session(),db=conn.db;let active=false;
 try{
  const merchant=process.env.SUMUP_MERCHANT_CODE||'',organizer=process.env.SHOTGUN_ORGANIZER_ID||'';
  await db.query('BEGIN');active=true;await db.query('LOCK TABLE silver.sumup_event_links IN SHARE ROW EXCLUSIVE MODE');
  if(!(await db.query('SELECT 1 FROM silver.sumup_transactions WHERE merchant_code=$1 AND transaction_id=$2',[merchant,b.transactionId])).rows.length)throw Error('UNKNOWN');
  if(b.eventId&&!(await db.query('SELECT 1 FROM silver.events WHERE organizer_id=$1 AND event_id=$2',[organizer,b.eventId])).rows.length)throw Error('UNKNOWN');
  const previous=await db.query('SELECT event_id FROM silver.sumup_event_links WHERE merchant_code=$1 AND transaction_id=$2',[merchant,b.transactionId]);
  if(b.eventId)await db.query(`INSERT INTO silver.sumup_event_links(merchant_code,transaction_id,organizer_id,event_id,evidence) VALUES($1,$2,$3,$4,'Association confirmée dans le cockpit') ON CONFLICT(merchant_code,transaction_id) DO UPDATE SET event_id=excluded.event_id,evidence=excluded.evidence,confirmed_at=now()`,[merchant,b.transactionId,organizer,b.eventId]);
  else await db.query('DELETE FROM silver.sumup_event_links WHERE merchant_code=$1 AND transaction_id=$2',[merchant,b.transactionId]);
  await db.query('INSERT INTO silver.association_audit(id,kind,external_id,previous_event_id,new_event_id,classification,evidence) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),'sumup',merchant+':'+b.transactionId,previous.rows[0]?.event_id??null,b.eventId,b.eventId?'event':'unassigned','Association confirmée dans le cockpit']);
  await db.query('COMMIT');active=false;return NextResponse.json({status:'saved'});
 }catch(e){if(active)await db.query('ROLLBACK');return NextResponse.json({error:'Association impossible'},{status:e instanceof Error&&e.message==='UNKNOWN'?400:503})}finally{conn.release()}
}
