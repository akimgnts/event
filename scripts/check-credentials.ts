import {checkCredentials} from '../lib/token-health';
import {closeDatabase} from '../lib/db';
checkCredentials().then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('CREDENTIAL_CHECK_FAILED');process.exitCode=1}).finally(closeDatabase);
