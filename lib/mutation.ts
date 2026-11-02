import {NextRequest} from 'next/server';
import {validKey} from './auth';
// Middleware enforces authentication. Browser mutations also require a same-origin request.
export function allowedMutation(req:NextRequest){
 if(validKey(req.headers.get('x-event-signal-key')))return true;
 const origin=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')||req.headers.get('host');
 try{return Boolean(origin&&host&&new URL(origin).host===host)}catch{return false}
}
