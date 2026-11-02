import {database} from './db';
export function tokenStatus(d:{is_valid?:boolean;expires_at?:number;data_access_expires_at?:number},now=Date.now()){
 const expiry=[d.expires_at,d.data_access_expires_at].filter((v):v is number=>typeof v==='number'&&v>0);
 if(!d.is_valid||expiry.some(v=>v*1000<=now))return 'reconnect_required';
 if(!expiry.length)return 'valid_no_fixed_expiry';
 return Math.min(...expiry)*1000-now<=7*86400000?'expires_soon':'valid';
}
export async function checkCredentials(){
 const db=await database();const results=[];
 for(const credential of ['META_ACCESS_TOKEN','INSTAGRAM_ACCESS_TOKEN','META_CORE_ACCESS_TOKEN']){
  const token=process.env[credential];if(!token)continue;
  let status='check_failed',expiresAt:string|null=null,dataExpiresAt:string|null=null,errorCode:string|null=null;
  try{
   const version=process.env.META_GRAPH_VERSION||'v26.0';if(!/^v\d+\.\d+$/.test(version))throw new Error('INVALID_VERSION');
   const u=new URL(`https://graph.facebook.com/${version}/debug_token`);u.searchParams.set('input_token',token);
   const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(20000)});const j=await r.json();
   if(!r.ok||!j.data)throw new Error('TOKEN_CHECK_FAILED');
   const d=j.data;
   if(String(d.app_id)!==process.env.META_APP_ID)throw new Error('TOKEN_APP_MISMATCH');
   status=tokenStatus(d);
   if(typeof d.expires_at==='number'&&d.expires_at>0)expiresAt=new Date(d.expires_at*1000).toISOString();
   if(typeof d.data_access_expires_at==='number'&&d.data_access_expires_at>0)dataExpiresAt=new Date(d.data_access_expires_at*1000).toISOString();
  }catch{errorCode='TOKEN_CHECK_FAILED';}
  const checkedAt=new Date().toISOString();
  await db.query(`INSERT INTO silver.credential_health VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(credential) DO UPDATE SET status=excluded.status,expires_at=excluded.expires_at,data_access_expires_at=excluded.data_access_expires_at,checked_at=excluded.checked_at,error_code=excluded.error_code`,[credential,status,expiresAt,dataExpiresAt,checkedAt,errorCode]);
  results.push({credential,status,expiresAt,dataExpiresAt,checkedAt});
 }
 return results;
}
