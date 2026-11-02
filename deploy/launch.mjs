import {spawn} from 'node:child_process';
// Read the root-owned secret, then drop privileges before running application code.
process.loadEnvFile('/run/secrets/runtime_env');
if(process.getuid?.()===0){process.setgid(1000);process.setuid(1000);}
const child=spawn(process.execPath,process.argv.slice(2),{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>process.exit(1));
child.on('exit',(code)=>process.exit(code??1));
