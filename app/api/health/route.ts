import {NextResponse} from 'next/server';
import {database} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){try{const db=await database();await db.query('SELECT count(*) FROM silver.events');return NextResponse.json({status:'ok',checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({status:'unavailable'},{status:503})}}
