export type SourceName="shotgun"|"meta"|"instagram"|"manychat"|"website";
export type SourceStatus="not_connected"|"connected"|"error"|"stale";
export interface Organizer { id:string; name:string; timezone:string }
export interface EventRecord { id:string; organizerId:string; name:string; startAt:string|null; endAt:string|null; status:"draft"|"published"|"past"|"unknown"; capacity:number|null; source:"shotgun"|"manual" }
export interface SourceEvidence { source:SourceName; state:SourceStatus; lastSyncAt:string|null; recordCount:number|null; message:string }
export interface MetricValue { value:number|null; unit:"tickets"|"EUR"|"%"|"visits"; provenance:string|null; asOf:string|null; note:string }
export interface EventSnapshot { event:EventRecord; metrics:{tickets:MetricValue;revenue:MetricValue;fillRate:MetricValue;visits:MetricValue}; sources:SourceEvidence[] }
export const knownEvents:EventRecord[]=[];
export function emptyMetric(unit:MetricValue["unit"],note:string):MetricValue{return {value:null,unit,provenance:null,asOf:null,note}}
export function emptySnapshot(event:EventRecord):EventSnapshot{return {event,metrics:{tickets:emptyMetric("tickets","Aucune vente vérifiée via API"),revenue:emptyMetric("EUR","Montants non vérifiés"),fillRate:emptyMetric("%","Capacité et ventes non vérifiées"),visits:emptyMetric("visits","Visites non vérifiées")},sources:(["shotgun","meta","instagram","manychat","website"] as SourceName[]).map(source=>({source,state:"not_connected",lastSyncAt:null,recordCount:null,message:"Aucune synchronisation authentifiée confirmée"}))}}
