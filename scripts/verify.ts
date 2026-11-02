import assert from 'node:assert/strict';
import {database} from '../lib/db';
async function main(){const db=await database();const t=await db.query<any>('SELECT * FROM gold.event_totals WHERE organizer_id=$1 AND event_id=$2',[process.env.SHOTGUN_ORGANIZER_ID,'606083']);assert.equal(t.rows.length,1);assert.equal(Number(t.rows[0].valid_tickets),16);assert.equal(Number(t.rows[0].face_value),54);assert.equal(Number(t.rows[0].scanned),13);assert.equal(Number(t.rows[0].orders),13);
const duplicates=await db.query('SELECT ticket_id FROM silver.tickets GROUP BY organizer_id,ticket_id HAVING count(*)>1');assert.equal(duplicates.rows.length,0);
const pii=await db.query("SELECT 1 FROM bronze.records WHERE payload ?| array['contact_email','contact_first_name','ticket_scan_code','user_id','auth','token']");assert.equal(pii.rows.length,0);
const sum=await db.query<any>('SELECT sum(valid_tickets) AS tickets,sum(face_value) AS revenue FROM gold.organizer_daily WHERE organizer_id=$1',[process.env.SHOTGUN_ORGANIZER_ID]);assert.equal(Number(sum.rows[0].tickets),16);assert.equal(Number(sum.rows[0].revenue),54);
const draft=await db.query<any>("SELECT * FROM gold.event_totals WHERE event_id='615336'");assert.equal(draft.rows[0].valid_tickets,null);assert.equal(draft.rows[0].source,'smartboard_ui');console.log('Real-data reconciliation passed: 16 tickets, 13 orders, 13 scans, EUR 54; no duplication or PII. Draft has no inferred metrics.');}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
