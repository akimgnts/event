import {NextResponse} from "next/server";
import {knownEvents,emptySnapshot} from "@/lib/event-model";
export async function GET(){return NextResponse.json({organizer:{id:"yeva",name:"YEVA",timezone:"Europe/Paris"},events:knownEvents.map(emptySnapshot),discovery:{complete:false,message:"Inventaire partiel: seul un événement a été observé dans Shotgun. L'API organisateur n'est pas encore authentifiée."}},{headers:{"Cache-Control":"no-store"}})}
