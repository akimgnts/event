import {Pool} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';
import {runSync} from '../lib/pipeline';
import {checkCredentials} from '../lib/token-health';
import {closeDatabase} from '../lib/db';
const interval=Number(process.env.SYNC_INTERVAL_SECONDS||900);
if(!process.env.DATABASE_URL||!Number.isFinite(interval)||interval<60)throw new Error('INVALID_WORKER_CONFIG');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
const stop=new AbortController();for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>stop.abort());
async function main(){
 while(!stop.signal.aborted){
  const client=await pool.connect();let locked=false;
  try{
   const result=await client.query('SELECT pg_try_advisory_lock(730012026) AS locked');locked=result.rows[0].locked;
   if(locked){
    console.log(JSON.stringify({credentials:await checkCredentials()}));
    const sources=[['sumup','SUMUP_ACCESS_TOKEN'],['shotgun','SHOTGUN_API_TOKEN'],['meta','META_ACCESS_TOKEN'],['instagram','INSTAGRAM_ACCESS_TOKEN']];
    for(const [source,key] of sources){if(stop.signal.aborted)break;if(!process.env[key])continue;const r=await runSync(source,process.env.SYNC_SINCE,process.env.SYNC_UNTIL);console.log(JSON.stringify(r));}
   }
  }catch{console.error('WORKER_CYCLE_FAILED');}
  finally{if(locked)await client.query('SELECT pg_advisory_unlock(730012026)').catch(()=>{});client.release();}
  if(process.env.WORKER_ONCE==='1')break;
  try{await delay(interval*1000,undefined,{signal:stop.signal})}catch{}
 }
}
main().catch(()=>{console.error('WORKER_FAILED');process.exitCode=1}).finally(async()=>{await pool.end();await closeDatabase()});
