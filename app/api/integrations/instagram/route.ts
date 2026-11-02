import {NextResponse} from 'next/server';
import {fetchInstagram} from '@/lib/connectors/meta';
export async function GET(){try{return NextResponse.json({source:'instagram',...await fetchInstagram()},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({status:'not_connected',message:'Instagram media API not validated; credentials required. Insights are not connected.'},{status:503})}}
