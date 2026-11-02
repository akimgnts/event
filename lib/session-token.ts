const encoder=new TextEncoder();
export async function signToken(purpose:string,expires:number){
 const secret=process.env.EVENT_SIGNAL_INTERNAL_API_KEY;if(!secret)throw Error('AUTH_NOT_CONFIGURED');
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const payload=`${purpose}.${expires}`;const sig=await crypto.subtle.sign('HMAC',key,encoder.encode(payload));
 return payload+'.'+Array.from(new Uint8Array(sig),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function verifyToken(token:string|undefined,purpose:string){
 if(!token||!process.env.EVENT_SIGNAL_INTERNAL_API_KEY)return false;
 const parts=token.split('.');if(parts.length!==3||parts[0]!==purpose||!/^\d+$/.test(parts[1])||Number(parts[1])<=Date.now())return false;
 const expected=await signToken(purpose,Number(parts[1]));if(expected.length!==token.length)return false;
 let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^expected.charCodeAt(i);return diff===0;
}
