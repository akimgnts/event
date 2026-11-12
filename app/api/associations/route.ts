import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {session} from '@/lib/db';
import {allowedMutation} from '@/lib/mutation';
export async function POST(req:NextRequest){
 if(!allowedMutation(req))return NextResponse.json({error:'Requête refusée'},{status:403});
 let b;try{b=await req.json()}catch{return NextResponse.json({error:'Requête invalide'},{status:400})}
 if(!['content','campaign'].includes(b.kind)||typeof b.externalId!=='string'||!/^\d+$/.test(b.externalId)||!(b.eventId===null||typeof b.eventId==='string'&&/^\d+$/.test(b.eventId)))return NextResponse.json({error:'Association invalide'},{status:400});
 const objectives=['attract','discover','engage','attend','sell','retain','brand'];
 if(b.kind==='content'&&b.objective!=null&&!objectives.includes(b.objective))return NextResponse.json({error:'Objectif invalide'},{status:400});
 const conn=await session(),db=conn.db;let transaction=false;
 try{
  const organizer=process.env.SHOTGUN_ORGANIZER_ID,account=b.kind==='content'?process.env.INSTAGRAM_ACCOUNT_ID:process.env.META_AD_ACCOUNT_ID?.replace(/^act_/,'');
  if(b.eventId&&(await db.query('SELECT 1 FROM silver.events WHERE organizer_id=$1 AND event_id=$2',[organizer,b.eventId])).rows.length!==1)return NextResponse.json({error:'Événement inconnu'},{status:400});
  const known=b.kind==='content'?await db.query('SELECT 1 FROM silver.instagram_media WHERE account_id=$1 AND media_id=$2',[account,b.externalId]):await db.query('SELECT 1 FROM silver.campaign_daily WHERE account_id=$1 AND campaign_id=$2 LIMIT 1',[account,b.externalId]);
  if(!known.rows.length)return NextResponse.json({error:'Contenu ou campagne inconnu'},{status:400});
  await db.query('BEGIN');transaction=true;await db.query('LOCK TABLE silver.content_links, silver.event_links IN SHARE ROW EXCLUSIVE MODE');
  const previous=b.kind==='content'?await db.query('SELECT event_id FROM silver.content_links WHERE account_id=$1 AND media_id=$2',[account,b.externalId]):await db.query("SELECT event_id FROM silver.event_links WHERE provider='meta' AND account_id=$1 AND external_id=$2",[account,b.externalId]);
  const evidence='Confirmed from private organizer dashboard';
  if(b.kind==='content')await db.query(`INSERT INTO silver.content_links(account_id,media_id,organizer_id,event_id,classification,objective,cta,expected_kpi,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(account_id,media_id) DO UPDATE SET event_id=excluded.event_id,classification=excluded.classification,objective=excluded.objective,cta=excluded.cta,expected_kpi=excluded.expected_kpi,evidence=excluded.evidence,confirmed_at=now()`,[account,b.externalId,organizer,b.eventId,b.eventId?'event':'general',b.objective||null,b.cta||null,b.expectedKpi||null,evidence]);
  else if(b.eventId)await db.query(`INSERT INTO silver.event_links(organizer_id,event_id,provider,account_id,external_id,evidence) VALUES($1,$2,'meta',$3,$4,$5) ON CONFLICT(provider,account_id,external_id) DO UPDATE SET event_id=excluded.event_id,evidence=excluded.evidence,confirmed_at=now()`,[organizer,b.eventId,account,b.externalId,evidence]);
  else await db.query("DELETE FROM silver.event_links WHERE provider='meta' AND account_id=$1 AND external_id=$2",[account,b.externalId]);
  await db.query('INSERT INTO silver.association_audit(id,kind,external_id,previous_event_id,new_event_id,classification,evidence) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),b.kind,b.externalId,previous.rows[0]?.event_id??null,b.eventId,b.eventId?'event':'general',evidence]);
  await db.query('COMMIT');transaction=false;return NextResponse.json({status:'saved'},{headers:{'Cache-Control':'no-store'}});
 }catch{if(transaction)await db.query('ROLLBACK');return NextResponse.json({error:'Enregistrement impossible'},{status:503})}finally{conn.release()}
}
