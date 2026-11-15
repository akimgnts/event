export class ShotgunTrafficError extends Error {
 constructor(public code:string){super(code);this.name='ShotgunTrafficError';}
}
export const trafficQuery=`query eventTraffic($eventId: Int!) {
 event(id: $eventId) { id name totalInterested trafficLastUpdate
 traffic { id visitsCount todaysVisits visitsByDay { day sum }
 visitsByUtm { utmSource type count percent } sharesCount ordersCount } }
}`;
const fail=()=>{throw new ShotgunTrafficError('TRAFFIC_INVALID_RESPONSE')};
function count(v:unknown):number|null {if(v==null)return null;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)return fail();return v;}
function instant(v:unknown):string|null {if(v==null)return null;if(typeof v!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))return fail();return v;}
export function parseTraffic(raw:any,eventId:number,timezone:string) {
 try{return parseTrafficPayload(raw,eventId,timezone);}catch(e){if(e instanceof ShotgunTrafficError)throw e;throw new ShotgunTrafficError('TRAFFIC_INVALID_RESPONSE');}
}
function parseTrafficPayload(raw:any,eventId:number,timezone:string) {
 if(raw?.errors?.length||!raw?.data?.event||String(raw.data.event.id)!==String(eventId))return fail();
 const e=raw.data.event,t=e.traffic;if(!t||typeof t!=='object')return fail();
 let formatter:Intl.DateTimeFormat;try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});}catch{return fail();}
 const days=t.visitsByDay==null?null:Array.isArray(t.visitsByDay)?t.visitsByDay.map((d:any)=>{
  const at=instant(d.day);if(!at)return fail();const parts=formatter.formatToParts(new Date(at));const get=(k:string)=>parts.find(p=>p.type===k)?.value;
  return {day:`${get('year')}-${get('month')}-${get('day')}`,sum:count(d.sum)};
 }):fail();
 const utm=t.visitsByUtm==null?null:Array.isArray(t.visitsByUtm)?t.visitsByUtm.map((u:any)=>{
  if(typeof u.utmSource!=='string'||typeof u.type!=='string')return fail();
  if(u.percent!=null&&(typeof u.percent!=='number'||!Number.isFinite(u.percent)||u.percent<0||u.percent>1))return fail();
  return {utmSource:u.utmSource,type:u.type,count:count(u.count),percent:u.percent??null};
 }):fail();
 return {eventId:String(e.id),visitsCount:count(t.visitsCount),todaysVisits:count(t.todaysVisits),ordersCount:count(t.ordersCount),sharesCount:count(t.sharesCount),totalInterested:count(e.totalInterested),trafficLastUpdate:instant(e.trafficLastUpdate),visitsByDay:days,visitsByUtm:utm};
}
export async function fetchShotgunTraffic(eventId:number,timezone:string,token=process.env.SHOTGUN_SMARTBOARD_TOKEN,request:typeof fetch=fetch){
 if(!token)throw new ShotgunTrafficError('TRAFFIC_TOKEN_MISSING');
 if(!Number.isSafeInteger(eventId)||eventId<=0||eventId>2147483647)throw new ShotgunTrafficError('TRAFFIC_INVALID_EVENT');
 try{
  const r=await request('https://smartboard-api.shotgun.live/api/graphql',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,'x-shotgun-origin':'smartboard','x-shotgun-platform':'web'},body:JSON.stringify({operationName:'eventTraffic',variables:{eventId},query:trafficQuery}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new ShotgunTrafficError(`TRAFFIC_HTTP_${r.status}`);
  return parseTraffic(await r.json(),eventId,timezone);
 }catch(e){if(e instanceof ShotgunTrafficError)throw e;throw new ShotgunTrafficError(e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?'TRAFFIC_TIMEOUT':'TRAFFIC_NETWORK_OR_RESPONSE_ERROR');}
}
export function trafficErrorMessage(code:string){
 if(code==='TRAFFIC_HTTP_401')return 'Jeton Shotgun expiré ou invalide, à renouveler.';
 if(code==='TRAFFIC_TOKEN_MISSING')return 'Jeton Smartboard Shotgun non configuré.';
 if(code==='TRAFFIC_HTTP_403')return 'Accès au trafic Shotgun refusé.';
 if(code==='TRAFFIC_HTTP_429')return 'Limite de requêtes Shotgun atteinte.';
 if(code==='TRAFFIC_TIMEZONE_MISSING')return 'Fuseau de l’événement non retourné : trafic indisponible.';
 return 'Trafic Shotgun indisponible. Réessayez au prochain cycle.';
}
