import {NextRequest,NextResponse} from 'next/server';
import {allowedMutation} from '@/lib/mutation';
import {dashboardData} from '@/lib/dashboard';
import {answerQuestion} from '@/lib/analyst';
export async function POST(req:NextRequest){
 if(!allowedMutation(req))return NextResponse.json({error:'Requête refusée'},{status:403});
 try{const b=await req.json();if(typeof b.question!=='string'||b.question.length>1500||!b.question.trim()||!(b.eventId===null||typeof b.eventId==='string'&&/^\d+$/.test(b.eventId)))return NextResponse.json({error:'Question invalide'},{status:400});return NextResponse.json(answerQuestion(b.question,b.eventId,await dashboardData()),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'Analyse indisponible'},{status:503})}
}
