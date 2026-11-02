import {NextRequest,NextResponse} from 'next/server';
import {verifyToken} from '@/lib/session-token';
import {database} from '@/lib/db';
export async function GET(req:NextRequest){
 const token=req.nextUrl.searchParams.get('ticket')||'';
 if(!await verifyToken(token,'setup'))return NextResponse.json({error:'Lien invalide ou expiré'},{status:403});
 const db=await database();if((await db.query('SELECT 1 FROM silver.hub_access WHERE id=1')).rows.length)return new NextResponse(null,{status:303,headers:{Location:'/login'}});
 const r=new NextResponse(null,{status:303,headers:{Location:'/login'}});r.headers.set('Cache-Control','no-store');r.headers.set('Referrer-Policy','no-referrer');
 r.cookies.set('yeva_setup',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:3600});return r;
}
