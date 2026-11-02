import {NextRequest,NextResponse} from 'next/server';
import {database} from '@/lib/db';
import {verifyToken} from '@/lib/session-token';
export async function GET(req:NextRequest){try{
 const db=await database();const initialized=(await db.query('SELECT 1 FROM silver.hub_access WHERE id=1')).rows.length>0;
 return NextResponse.json({initialized,setupAllowed:!initialized&&await verifyToken(req.cookies.get('yeva_setup')?.value,'setup')},{headers:{'Cache-Control':'no-store'}});
}catch{return NextResponse.json({error:'Service indisponible'},{status:503})}}
