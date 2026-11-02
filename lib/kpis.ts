export function ratio(n:unknown,d:unknown){if(n==null||d==null||!Number.isFinite(Number(n))||!Number.isFinite(Number(d))||Number(d)<=0)return null;return Number(n)/Number(d)}
export function eventKpis(event:Record<string,any>,marketing?:Record<string,any>){
 const compatible=marketing&&event.currency&&event.currency===marketing.currency;
 const spend=compatible?Number(marketing.spend):null;
 return {spend,averagePrice:ratio(event.face_value,event.paid_tickets),adPerTicket:ratio(spend,event.paid_tickets),adPerOrder:ratio(spend,event.orders),adPerScan:ratio(spend,event.scanned),adShare:ratio(spend,event.face_value),scanRate:ratio(event.scanned,event.valid_tickets),partialBalance:spend===null||event.face_value==null?null:Number(event.face_value)-spend};
}
