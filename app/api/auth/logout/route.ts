import {NextRequest,NextResponse} from 'next/server';
import {allowedMutation} from '@/lib/mutation';
export async function POST(req:NextRequest){if(!allowedMutation(req))return NextResponse.json({error:'Requête refusée'},{status:403});const r=NextResponse.json({ok:true});r.cookies.delete('yeva_session');return r}
