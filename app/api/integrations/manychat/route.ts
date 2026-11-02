import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  const token = process.env.MANYCHAT_API_TOKEN;
  if(!token) return NextResponse.json({status:"not_connected",message:"Configure MANYCHAT_API_TOKEN on the server, if the account has API access."},{status:503});
  try {
    const response=await fetch("https://api.manychat.com/fb/page/getInfo",{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},cache:"no-store"});
    const body=await response.json();
    if(!response.ok || body.status!=="success") return NextResponse.json({status:"error",message:"ManyChat API access was not accepted."},{status:502});
    return NextResponse.json({status:"connected",source:"manychat",page:body.data??{}},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({status:"error",message:"ManyChat API unavailable."},{status:502});}
}
