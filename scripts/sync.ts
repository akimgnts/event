import {runSync} from '../lib/pipeline';
import {closeDatabase} from '../lib/db';
async function main(){const sources=process.argv.slice(2);let failed=false;for(const source of sources.length?sources:['shotgun','meta','instagram','manychat']){const r=await runSync(source,process.env.SYNC_SINCE,process.env.SYNC_UNTIL);console.log(JSON.stringify(r));if(r.status==='error')failed=true;}await closeDatabase();process.exit(failed?1:0);}
main().catch(()=>{console.error('DATABASE_OR_SYNC_FAILED');process.exit(1)});
