import {fetchShotgunTraffic,ShotgunTrafficError} from './connectors/shotgun-traffic';
import {session} from './db';
export async function syncShotgunTraffic(){
 const {db,release}=await session();let count=0,errors=0;const organizer=process.env.SHOTGUN_ORGANIZER_ID||'';
 try{
  const events=await db.query<{event_id:string;timezone:string|null}>('SELECT event_id,timezone FROM silver.events WHERE organizer_id=$1',[organizer]);
  for(const e of events.rows){
   await db.query('BEGIN');
   try{
    // Transaction-scoped lock also serializes manual syncs across processes.
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`shotgun_traffic:${organizer}:${e.event_id}`]);
    const cached=await db.query<{status:string}>('SELECT status FROM silver.shotgun_traffic WHERE organizer_id=$1 AND event_id=$2 AND attempted_at > now() - interval \'900 seconds\'',[organizer,e.event_id]);
    if(cached.rows.length){if(cached.rows[0].status==='unavailable')errors++;await db.query('COMMIT');continue;}
    let payload:Awaited<ReturnType<typeof fetchShotgunTraffic>>|null=null,code:string|null=null;
    try{if(!e.timezone)throw new ShotgunTrafficError('TRAFFIC_TIMEZONE_MISSING');payload=await fetchShotgunTraffic(Number(e.event_id),e.timezone);}catch(err){code=err instanceof ShotgunTrafficError?err.code:'TRAFFIC_UNAVAILABLE';}
    await db.query(`INSERT INTO silver.shotgun_traffic(organizer_id,event_id,payload,traffic_last_update,collected_at,attempted_at,status,error_code)
     VALUES($1,$2,$3,$4,CASE WHEN $5::text IS NULL THEN now() ELSE NULL END,now(),$6,$5)
     ON CONFLICT(organizer_id,event_id) DO UPDATE SET payload=CASE WHEN excluded.status='available' THEN excluded.payload ELSE silver.shotgun_traffic.payload END,
     traffic_last_update=CASE WHEN excluded.status='available' THEN excluded.traffic_last_update ELSE silver.shotgun_traffic.traffic_last_update END,
     collected_at=CASE WHEN excluded.status='available' THEN excluded.collected_at ELSE silver.shotgun_traffic.collected_at END,
     attempted_at=excluded.attempted_at,status=excluded.status,error_code=excluded.error_code`,[organizer,e.event_id,payload?JSON.stringify(payload):null,payload?.trafficLastUpdate??null,code,code?'unavailable':'available']);
    if(code)errors++;else count++;
    await db.query('COMMIT');
   }catch(err){await db.query('ROLLBACK');throw err;}
  }
  return {provider:'shotgun_traffic',status:errors?'error':'success',count,errors};
 }finally{release();}
}
