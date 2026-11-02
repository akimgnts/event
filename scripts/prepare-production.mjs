import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const dir='.production';
await mkdir(dir,{recursive:true,mode:0o700});
let existing=false;try{await readFile(`${dir}/runtime.env`);existing=true}catch{}
if(existing)throw new Error('PRODUCTION_SECRETS_ALREADY_EXIST');
const source=await readFile('.env.local','utf8');
if(!/^EVENT_SIGNAL_INTERNAL_API_KEY=.+/m.test(source))throw new Error('PRIVATE_ACCESS_KEY_REQUIRED');
const password=randomBytes(32).toString('hex');
const env=source.split('\n').filter(l=>!l.startsWith('DATABASE_URL=')&&!l.startsWith('NODE_ENV=')).join('\n');
await writeFile(`${dir}/db_password`,password,{mode:0o600,flag:'wx'});
await writeFile(`${dir}/runtime.env`,`${env}\nDATABASE_URL=postgresql://yeva:${password}@postgres:5432/yeva\nNODE_ENV=production\n`,{mode:0o600,flag:'wx'});
await mkdir(`${dir}/backups`,{recursive:true,mode:0o700});
await chmod(dir,0o700);
console.log('PRODUCTION_SECRETS_PREPARED — transfer privately to the chosen server');
