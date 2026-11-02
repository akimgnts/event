// Import an event observed in the organizer UI, explicitly labelled as browser evidence.
// No business metrics are accepted through this path.
import {readFile} from 'node:fs/promises';
import {database,closeDatabase} from '../lib/db';
async function main(){const p=JSON.parse(await readFile(process.argv[2],'utf8'));if(!p.eventId||!p.name||!p.observedAt||!p.url||new URL(p.url).origin!=='https://smartboard.shotgun.live')throw Error('Invalid evidence');const db=await database();await db.query(`INSERT INTO silver.events(organizer_id,event_id,name,starts_at,ends_at,timezone,status,source,synced_at) VALUES($1,$2,$3,$4,$5,'Europe/Paris',$6,'smartboard_ui',$7) ON CONFLICT(organizer_id,event_id) DO NOTHING`,[process.env.SHOTGUN_ORGANIZER_ID,String(p.eventId),p.name,p.startAt,p.endAt,p.status,p.observedAt]);console.log('Browser event observation imported; no metrics inferred');}
main().then(async()=>{await closeDatabase();process.exit(0)}).catch(()=>{console.error('Observation import failed');process.exit(1)});
