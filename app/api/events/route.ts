import {NextResponse} from 'next/server';
import {dashboardData} from '@/lib/dashboard';
export const dynamic='force-dynamic';
export async function GET(){try{return NextResponse.json(await dashboardData(),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({status:'unavailable',message:'Base indisponible ou migration requise'},{status:503})}}
