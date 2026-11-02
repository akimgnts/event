import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && (!process.env.EVENT_SIGNAL_INTERNAL_API_KEY || request.headers.get("x-event-signal-key") !== process.env.EVENT_SIGNAL_INTERNAL_API_KEY)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const token=process.env.MANYCHAT_API_TOKEN;
  if(!token) return NextResponse.json({status:"not_connected",message:"ManyChat API token not configured; API availability depends on account plan."},{status:503});
  try {
    const response=await fetch("https://api.manychat.com/fb/page/getInfo",{headers:{Authorization:"Bearer "+token,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(15000)});
    const body=await response.json();
    if(!response.ok || body.status!=="success") return NextResponse.json({status:"error",message:"ManyChat API access was not accepted."},{status:502});
    return NextResponse.json({status:"connected",source:"manychat",page:{name:body.data?.name??null,id:body.data?.id??null}},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({status:"error",message:"ManyChat API unavailable."},{status:502});}
}
