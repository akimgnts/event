export type Row = Record<string, unknown>;
export async function getJSON(url:URL, token?:string):Promise<Record<string, any>> {
  for(let attempt=0;attempt<3;attempt++) {
    const res=await fetch(url,{headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
    if((res.status===429 || res.status>=500) && attempt<2) {
      const delay=Math.min(10000,Math.max(1000,Number(res.headers.get('retry-after')||0)*1000,1000*2**attempt));
      await new Promise(resolve=>setTimeout(resolve,delay));continue;
    }
    if(!res.ok) throw new Error(`PROVIDER_HTTP_${res.status}`);
    const j=await res.json();if(!j || typeof j!=='object' || Array.isArray(j)) throw new Error('INVALID_RESPONSE');return j;
  }
  throw new Error('RETRY_EXHAUSTED');
}
export function requireArray(j:Record<string,any>):Row[] { if(!Array.isArray(j.data)) throw new Error('INVALID_DATA_ARRAY');return j.data; }
export function pick(row:Row, fields:readonly string[]):Row {return Object.fromEntries(fields.filter(k=>k in row).map(k=>[k,row[k]]));}
