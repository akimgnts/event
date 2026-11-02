import {readFile} from 'node:fs/promises';
import {database,closeDatabase} from '../lib/db';
async function main(){const db=await database();for(const sql of (await readFile('db/001_pipeline.sql','utf8')).split(';').filter(s=>s.trim())) await db.query(sql);console.log('Migration applied');}
main().then(async()=>{await closeDatabase();process.exit(0)}).catch(()=>{console.error('Migration failed');process.exit(1)});
