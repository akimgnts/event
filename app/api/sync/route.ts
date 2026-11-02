import {NextRequest,NextResponse} from 'next/server';
import {runSync} from '@/lib/pipeline';
import {validKey} from '@/lib/auth';
export const runtime='nodejs';
let queue:Promise<unknown>=Promise.resolve();
export async function POST(req:NextRequest){
 if(!validKey(req.headers.get('x-event-signal-key')))return NextResponse.json({error:'Unauthorized'},{status:401});
 const source=req.nextUrl.searchParams.get('source');if(!source||!['shotgun','meta','instagram','manychat','sumup'].includes(source))return NextResponse.json({error:'Invalid source'},{status:400});
 const job=queue.then(()=>runSync(source,req.nextUrl.searchParams.get('since')||undefined,req.nextUrl.searchParams.get('until')||undefined));queue=job.catch(()=>{});
 try{const result=await job;return NextResponse.json(result,{status:result.status==='success'?200:502,headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Database unavailable'},{status:503})}
}
