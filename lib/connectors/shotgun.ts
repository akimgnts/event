import {getJSON,requireArray,pick,Row} from './http';
export const ticketFields=['ticket_id','ticket_updated_at','ticket_status','ticket_canceled_at','ticket_scanned_at','deal_id','deal_title','deal_channel','deal_price','deal_service_fee','deal_user_service_fee','currency','order_id','ordered_at','utm_source','utm_medium','event_id','event_name','event_start_time','event_end_time','event_published_at'] as const;
export function safeTicket(row:Row) {return pick(row,ticketFields);}
export function validateTicket(t:Row) {
  const states=['valid','resold','refunded','canceled','payment_plan_pending','pending_approval','rejected'];
  if(!t.ticket_id || !t.event_id || !t.order_id || !states.includes(String(t.ticket_status)) || !Number.isSafeInteger(t.deal_price) || Number(t.deal_price)<0 || !/^[a-zA-Z]{3}$/.test(String(t.currency)) || !/^\d{4}-\d{2}-\d{2}/.test(String(t.ordered_at))) throw new Error('INVALID_TICKET_SCHEMA');
}
export async function fetchShotgun() {
 const id=process.env.SHOTGUN_ORGANIZER_ID,token=process.env.SHOTGUN_API_TOKEN;
 if(!id || !token || !/^\d+$/.test(id)) throw new Error('SHOTGUN_NOT_CONFIGURED');
 const events:Row[]=[];
 for(const past of [false,true]) {
  let done=false;
  for(let page=0;page<100;page++) {
   const url=new URL(`https://smartboard-api.shotgun.live/api/shotgun/organizers/${id}/events`);
   url.searchParams.set('key',token);if(past){url.searchParams.set('past_events','true');url.searchParams.set('page',String(page));url.searchParams.set('limit','100');}
   const rows=requireArray(await getJSON(url));
   events.push(...rows.map(e=>pick(e,['id','name','startTime','endTime','timezone','publishedAt','cancelledAt','updatedAt'])));
   if(!past || rows.length<100){done=true;break;}
  }
  if(!done) throw new Error('EVENT_PAGINATION_LIMIT');
 }
 const tickets:Row[]=[];const seen=new Set<string>();let after:string|null=null,complete=false;
 for(let page=0;page<10000;page++){
  const url=new URL('https://api.shotgun.live/tickets');url.searchParams.set('organizer_id',id);url.searchParams.set('include_cohosted_events','true');if(after)url.searchParams.set('after',after);
  const j=await getJSON(url,token);const rows=requireArray(j).map(safeTicket);rows.forEach(validateTicket);tickets.push(...rows);
  if(!j.pagination?.next){complete=true;break;}
  const next=new URL(j.pagination.next);if(next.origin!=='https://api.shotgun.live' || next.pathname!=='/tickets')throw new Error('UNSAFE_PAGINATION');
  after=next.searchParams.get('after');if(!after || seen.has(after))throw new Error('PAGINATION_LOOP');seen.add(after);
 }
 if(!complete)throw new Error('TICKET_PAGINATION_LIMIT');
 return {account:id,events:[...new Map(events.map(e=>[String(e.id),e])).values()],tickets};
}
