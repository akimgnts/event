import {applyConfirmedLinks} from '../lib/confirmed-links';
import {readFile} from 'node:fs/promises';
import {database,closeDatabase} from '../lib/db';
async function main(){const db=await database();for(const file of ['db/001_pipeline.sql','db/002_ui_observations.sql','db/003_instagram.sql','db/004_credentials.sql','db/005_analytics.sql','db/006_sumup.sql']) for(const sql of (await readFile(file,'utf8')).split(';').filter(s=>s.trim())) await db.query(sql);await applyConfirmedLinks(db);console.log('Migration applied');}
main().then(async()=>{await closeDatabase();process.exit(0)}).catch(()=>{console.error('Migration failed');process.exit(1)});
