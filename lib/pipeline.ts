import {randomUUID,createHash} from 'node:crypto';
import {session} from './db';
import {fetchShotgun,validateTicket} from './connectors/shotgun';
import {fetchMeta,fetchInstagram} from './connectors/meta';
import {getJSON,Row,pick} from './connectors/http';
export async function runSync(provider:string,since='2026-10-01',until=new Date().toISOString().slice(0,10)) {
 const connection=await session();try{return await syncWithSession(connection.db,provider,since,until)}finally{connection.release()}
}
async function syncWithSession(db:Awaited<ReturnType<typeof session>>['db'],provider:string,since:string,until:string) {
 const run=randomUUID();
 const account=provider==='shotgun'?process.env.SHOTGUN_ORGANIZER_ID:provider==='meta'?process.env.META_AD_ACCOUNT_ID:provider==='instagram'?process.env.INSTAGRAM_ACCOUNT_ID:process.env.MANYCHAT_ACCOUNT_ID;
 await db.query('INSERT INTO bronze.runs(id,provider,account_id,status) VALUES($1,$2,$3,$4)',[run,provider,account||'unconfigured','running']);
 let now=new Date().toISOString();let count=0;
 // Collect every page before opening a transaction: an incomplete fetch cannot advance published data.
 try {
  let rows:{kind:string;id:string;payload:Row}[]=[];
  if(provider==='shotgun'){
   const result=await fetchShotgun();
   rows=[...result.events.map(e=>({kind:'event',id:String(e.id),payload:e})),...result.tickets.map(t=>({kind:'ticket',id:String(t.ticket_id),payload:t}))];
  }else if(provider==='meta'){
   const result=await fetchMeta(since,until);
   rows=result.data.map(r=>({kind:'campaign_daily',id:`${r.campaign_id}:${r.date_start}`,payload:{...r,currency:result.currency}}));
  }else if(provider==='instagram'){
   const result=await fetchInstagram();rows=result.data.map(r=>({kind:'media',id:String(r.id),payload:r}));
  }else if(provider==='manychat'){
   const token=process.env.MANYCHAT_API_TOKEN;if(!token)throw new Error('MANYCHAT_NOT_CONFIGURED');
   const j=await getJSON(new URL('https://api.manychat.com/fb/page/getInfo'),token);
   if(j.status!=='success'||!j.data?.id)throw new Error('INVALID_MANYCHAT_RESPONSE');
   rows=[{kind:'account',id:String(j.data.id),payload:pick(j.data,['id','name'])}];
  }else throw new Error('UNSUPPORTED_SOURCE');
  now=new Date().toISOString();
  await db.query('BEGIN');
  try{
   // Serialize warehouse publications, including concurrent requests for different sources.
   await db.query('LOCK TABLE bronze.records IN SHARE ROW EXCLUSIVE MODE');
   for(const r of rows){
    const json=JSON.stringify(r.payload);await db.query('INSERT INTO bronze.records(run_id,kind,external_id,payload,checksum,observed_at) VALUES($1,$2,$3,$4,$5,$6)',[run,r.kind,r.id,json,createHash('sha256').update(json).digest('hex'),now]);count++;
    const p=r.payload;
    if(r.kind==='event'){
     if(!p.id||typeof p.name!=='string')throw new Error('INVALID_EVENT_SCHEMA');
     const status=p.cancelledAt?'canceled':!p.publishedAt?'draft':String(p.endTime)<now?'past':'published';
     await db.query(`INSERT INTO silver.events(organizer_id,event_id,name,starts_at,ends_at,timezone,status,capacity,source,synced_at) VALUES($1,$2,$3,$4,$5,$6,$7,NULL,'shotgun_api',$8) ON CONFLICT(organizer_id,event_id) DO UPDATE SET name=excluded.name,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,status=excluded.status,source=excluded.source,synced_at=excluded.synced_at`,[account,r.id,p.name,p.startTime||null,p.endTime||null,p.timezone||null,status,now]);
    }
    if(r.kind==='ticket'){
     validateTicket(p);
     await db.query(`INSERT INTO silver.events(organizer_id,event_id,name,status,source,synced_at) VALUES($1,$2,$3,'unknown','shotgun_tickets_api',$4) ON CONFLICT DO NOTHING`,[account,String(p.event_id),String(p.event_name||p.event_id),now]);
     await db.query(`INSERT INTO silver.tickets(organizer_id,ticket_id,event_id,status,channel,price_cents,organizer_fee_cents,user_fee_cents,currency,order_id,ordered_at_raw,sale_day,scanned,canceled,utm_source,utm_medium,synced_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(organizer_id,ticket_id) DO UPDATE SET status=excluded.status,channel=excluded.channel,price_cents=excluded.price_cents,organizer_fee_cents=excluded.organizer_fee_cents,user_fee_cents=excluded.user_fee_cents,currency=excluded.currency,order_id=excluded.order_id,ordered_at_raw=excluded.ordered_at_raw,sale_day=excluded.sale_day,scanned=excluded.scanned,canceled=excluded.canceled,utm_source=excluded.utm_source,utm_medium=excluded.utm_medium,synced_at=excluded.synced_at`,[account,r.id,String(p.event_id),p.ticket_status,p.deal_channel,p.deal_price,p.deal_service_fee??null,p.deal_user_service_fee??null,String(p.currency).toUpperCase(),String(p.order_id),p.ordered_at,String(p.ordered_at).slice(0,10),Boolean(p.ticket_scanned_at),Boolean(p.ticket_canceled_at),p.utm_source??null,p.utm_medium??null,now]);
    }
    if(r.kind==='campaign_daily'){
     if(!p.campaign_id||!p.currency||!Number.isFinite(Number(p.spend))||!Number.isFinite(Number(p.impressions))||!Number.isFinite(Number(p.clicks)))throw new Error('INVALID_META_SCHEMA');
     await db.query(`INSERT INTO silver.campaign_daily VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(account_id,campaign_id,day) DO UPDATE SET currency=excluded.currency,campaign_name=excluded.campaign_name,spend=excluded.spend,impressions=excluded.impressions,clicks=excluded.clicks,synced_at=excluded.synced_at`,[account,p.campaign_id,p.date_start,p.currency,p.campaign_name,p.spend,p.impressions,p.clicks,now]);
    }
   }
   await db.query("UPDATE bronze.runs SET status='success',finished_at=$2,row_count=$3 WHERE id=$1",[run,now,count]);await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}
  return {provider,status:'success',count,run,asOf:now};
 }catch(e){const code=e instanceof Error && /^[A-Z_0-9]+$/.test(e.message)?e.message:'SYNC_FAILED';await db.query("UPDATE bronze.runs SET status='error',finished_at=now(),error_code=$2 WHERE id=$1",[run,code]);return {provider,status:'error',code,run};}
}
