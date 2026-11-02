import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && (!process.env.EVENT_SIGNAL_INTERNAL_API_KEY || request.headers.get("x-event-signal-key") !== process.env.EVENT_SIGNAL_INTERNAL_API_KEY)) {
    return NextResponse.json({error:"Unauthorized"}, {status:401});
  }
  const token=process.env.META_ACCESS_TOKEN;
  const id=process.env.META_AD_ACCOUNT_ID;
  if(!token || !id) return NextResponse.json({status:"not_connected",message:"Configure META_ACCESS_TOKEN and META_AD_ACCOUNT_ID."},{status:503});
  const since=request.nextUrl.searchParams.get("since");
  const until=request.nextUrl.searchParams.get("until");
  if(!since || !until || !/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || since>until) return NextResponse.json({error:"Invalid date range"},{status:400});
  const version=process.env.META_GRAPH_VERSION || "v26.0";
  if(!/^v\d+\.\d+$/.test(version)) return NextResponse.json({error:"Invalid API version"},{status:500});
  const url=new URL("https://graph.facebook.com/"+version+"/act_"+id.replace(/^act_/,"")+"/insights");
  url.searchParams.set("fields","campaign_id,campaign_name,impressions,reach,clicks,spend,ctr,cpc,cpm,date_start,date_stop");
  url.searchParams.set("level","campaign");
  url.searchParams.set("time_range",JSON.stringify({since,until}));
  url.searchParams.set("limit","100");
  try {
    const res=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(15000)});
    if(!res.ok) return NextResponse.json({status:"error",message:"Meta API request failed",httpStatus:res.status},{status:502});
    const json=await res.json();
    return NextResponse.json({status:"connected",source:"meta_ads",data:json.data||[],hasMore:Boolean(json.paging?.next)},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({status:"error",message:"Meta API unavailable"},{status:502});}
}
