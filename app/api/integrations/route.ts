import {NextResponse} from 'next/server';
import {dashboardData} from '@/lib/dashboard';
export const dynamic='force-dynamic';
export async function GET(){try{const d=await dashboardData();return NextResponse.json({latestAttempts:d.runs,lastSuccessful:d.successful},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({status:'unavailable'},{status:503})}}
