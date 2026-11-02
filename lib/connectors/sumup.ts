import {getJSON,pick,Row} from './http';
const fields=['id','transaction_id','transaction_code','amount','currency','timestamp','status','payment_type','type','refunded_amount'] as const;
export function normalizeTransaction(row:Row):Row {
 const r=pick(row,fields),id=r.id||r.transaction_id||r.transaction_code;
 if(typeof id!=='string'||!id||typeof r.amount!=='number'||!Number.isFinite(r.amount)||r.amount<0||typeof r.currency!=='string'||! /^[A-Z]{3}$/.test(r.currency)||typeof r.timestamp!=='string'||!Number.isFinite(Date.parse(r.timestamp))||typeof r.status!=='string'||typeof r.type!=='string')throw new Error('INVALID_SUMUP_TRANSACTION');
 if(r.refunded_amount!=null&&(typeof r.refunded_amount!=='number'||!Number.isFinite(r.refunded_amount)||r.refunded_amount<0||r.refunded_amount>r.amount))throw new Error('INVALID_SUMUP_REFUND');
 return {...r,id};
}
export function historyPage(base:URL,href:string){
 // SumUp returns a query string, never follow provider-supplied origins or paths.
 if(!href||href.includes('://')||href.startsWith('/')||href.includes('#'))throw new Error('INVALID_SUMUP_PAGINATION');
 const u=new URL(base);u.search=href.replace(/^\?/,'');return u;
}
export async function fetchSumup(){
 const token=process.env.SUMUP_ACCESS_TOKEN,merchant=process.env.SUMUP_MERCHANT_CODE;
 if(!token||!merchant)throw new Error('SUMUP_NOT_CONFIGURED');
 if(!/^[A-Za-z0-9]+$/.test(merchant))throw new Error('INVALID_SUMUP_MERCHANT');
 const base=new URL(`https://api.sumup.com/v2.1/merchants/${merchant}/transactions/history`);
 // Full history refresh includes historical refunds and status changes. No date-only assignment.
 let url=new URL(base);url.search=new URLSearchParams({limit:'100',order:'ascending'}).toString();
 const seen=new Set<string>(),rows=new Map<string,Row>();
 for(let page=0;page<1000;page++){
  if(seen.has(url.search))throw new Error('SUMUP_PAGINATION_LOOP');seen.add(url.search);
  const j=await getJSON(url,token);
  if(!Array.isArray(j.items)||!Array.isArray(j.links))throw new Error('INVALID_SUMUP_RESPONSE');
  for(const item of j.items){const r=normalizeTransaction(item);rows.set(String(r.id),r)}
  const next=j.links.find((l:Row)=>l.rel==='next');
  if(!next)return [...rows.values()];
  if(typeof next.href!=='string')throw new Error('INVALID_SUMUP_PAGINATION');
  url=historyPage(base,next.href);
 }
 throw new Error('SUMUP_PAGE_LIMIT');
}
