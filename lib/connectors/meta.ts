import {getJSON,requireArray,Row,pick} from './http';
export async function graphPages(path:string,params:Record<string,string>,token:string) {
 const version=process.env.META_GRAPH_VERSION||'v26.0';if(!/^v\d+\.\d+$/.test(version))throw new Error('INVALID_GRAPH_VERSION');
 const out:Row[]=[];const seen=new Set<string>();let after:string|undefined;
 for(let page=0;page<10000;page++){
  const url=new URL(`https://graph.facebook.com/${version}/${path}`);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));if(after)url.searchParams.set('after',after);
  const j=await getJSON(url,token);out.push(...requireArray(j));if(!j.paging?.next)return out;
  const cursor=j.paging?.cursors?.after;if(typeof cursor!=='string'||seen.has(cursor))throw new Error('PAGINATION_LOOP');seen.add(cursor);after=cursor;
 }throw new Error('PAGINATION_LIMIT');
}
export async function fetchMeta(since:string,until:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(since)||!/^\d{4}-\d{2}-\d{2}$/.test(until)||since>until || [since,until].some(s=>!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s))throw new Error('INVALID_DATE_RANGE');
 const token=process.env.META_ACCESS_TOKEN,id=process.env.META_AD_ACCOUNT_ID?.replace(/^act_/,'');
 if(!token||!id||!/^\d+$/.test(id))throw new Error('META_NOT_CONFIGURED');
 const v=process.env.META_GRAPH_VERSION||'v26.0';
 const info=await getJSON(new URL(`https://graph.facebook.com/${v}/act_${id}?fields=id,currency,timezone_name`),token);
 const data=await graphPages(`act_${id}/insights`,{fields:'campaign_id,campaign_name,account_currency,impressions,clicks,spend,date_start,date_stop',level:'campaign',time_increment:'1',time_range:JSON.stringify({since,until}),limit:'100'},token);
 return {account:id,currency:info.currency,timezone:info.timezone_name,data:data.map(r=>pick(r,['campaign_id','campaign_name','account_currency','impressions','clicks','spend','date_start','date_stop']))};
}
export async function fetchInstagram(){
 const id=process.env.INSTAGRAM_ACCOUNT_ID,token=process.env.INSTAGRAM_ACCESS_TOKEN;
 if(!id||!token||!/^\d+$/.test(id))throw new Error('INSTAGRAM_NOT_CONFIGURED');
 const version=process.env.META_GRAPH_VERSION||'v26.0';if(!/^v\d+\.\d+$/.test(version))throw new Error('INVALID_GRAPH_VERSION');
 const profile=await getJSON(new URL(`https://graph.facebook.com/${version}/${id}?fields=id,username,followers_count,media_count`),token);
 if(String(profile.id)!==id)throw new Error('INSTAGRAM_ACCOUNT_MISMATCH');
 const data=await graphPages(`${id}/media`,{fields:'id,media_type,timestamp,like_count,comments_count,permalink',limit:'100'},token);
 const enriched:Row[]=[];
 for(const m of data){
  const url=new URL(`https://graph.facebook.com/${version}/${m.id}/insights`);url.searchParams.set('metric','reach,views,total_interactions');
  const metrics=requireArray(await getJSON(url,token));
  const insights:Record<string,number|null>={reach:null,views:null,total_interactions:null};
  for(const metric of metrics){const name=String(metric.name);if(name in insights){const values=metric.values as {value:unknown}[]|undefined;const v=values?.[0]?.value;if(typeof v==='number'&&Number.isFinite(v)&&v>=0)insights[name]=v;}}
  enriched.push({...m,insights});
 }
 return {account:id,profile:pick(profile,['id','username','followers_count','media_count']),data:enriched};
}
