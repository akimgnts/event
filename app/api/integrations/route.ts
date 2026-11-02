import { NextResponse } from "next/server";
import { integrations } from "@/lib/integrations";
export async function GET() {
  return NextResponse.json({
    integrations: integrations.map(({id,label,purpose,status,strategy,requirements}) => ({id,label,purpose,status,strategy,requirements})),
    note: "Registry only. No provider authorization has been granted to this application."
  }, {headers: {"Cache-Control":"no-store"}});
}
