'use client';
import {ratio} from '@/lib/kpis';
import {trafficErrorMessage} from '@/lib/connectors/shotgun-traffic';
type Row=Record<string,any>;
const num=(v:unknown)=>v==null?'—':Number(v).toLocaleString('fr-FR');
const pct=(v:unknown)=>v==null?'—':(Number(v)*100).toLocaleString('fr-FR',{maximumFractionDigits:1})+' %';
const time=(v:unknown)=>v?new Date(String(v)).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'—';
export default function TrafficPanel({rows,eventId,event,mode}:{rows:Row[];eventId:string;event?:Row;mode:'sales'|'utm'}){
 const row=rows.find(r=>r.event_id===eventId),t=row?.status==='available'?row.payload:null;
 const message=eventId==='all'?'Choisissez un événement pour consulter son trafic.':!row?'Trafic Shotgun non encore collecté.':row.status==='stale'?'Relevé de trafic périmé : en attente du prochain cycle.':!t?trafficErrorMessage(row.error_code):null;
 const cards=[['Visites',num(t?.visitsCount)],['Visites du jour',num(t?.todaysVisits)],['Visites → billets',pct(ratio(event?.paid_tickets,t?.visitsCount))],['Visites → commandes',pct(ratio(t?.ordersCount,t?.visitsCount))]];
 return <article className="card"><h2>{mode==='sales'?'Visites de la billetterie':'Visites par source UTM'}</h2>
 {message&&<p className="helper" role="status">{message}</p>}
 {mode==='sales'?<><div className="kpis">{cards.map(([label,value])=><div key={label}><span>{label}</span><div className="value">{value}</div></div>)}</div><p className="helper">Commandes Smartboard : {num(t?.ordersCount)} · Billets payants API publique : {num(event?.paid_tickets)}. Les deux taux ne mesurent pas la même chose.</p></>:
 <div className="table-wrap"><table><thead><tr><th>Source</th><th>Type</th><th>Visites</th><th>Part des visites</th></tr></thead><tbody>{t?.visitsByUtm?.map((u:Row,i:number)=><tr key={i}><td>{u.utmSource==='meta_pub'?<strong>meta_pub · Campagnes Meta</strong>:u.utmSource}</td><td><span className={'badge '+(u.type==='tracking_link'?'purple':'neutral')}>{u.type==='tracking_link'?'Lien paramétré':u.type==='other'?'Autre':u.type}</span></td><td>{num(u.count)}</td><td>{pct(u.percent)}</td></tr>)}</tbody></table>{!t?.visitsByUtm?.length&&<p className="helper">{t?.visitsByUtm==null?'— · Répartition UTM non retournée.':'Aucune source UTM retournée.'}</p>}</div>}
 <p className="helper">Dernière mise à jour du trafic Shotgun : {time(t?.trafficLastUpdate)} · Collecte : {time(row?.collected_at)}.</p>
 <p className="helper">API interne Smartboard Shotgun · Les visites comptent chaque passage, pas chaque personne. — signifie non retourné, pas zéro. Les sources UTM ne prouvent pas une attribution individuelle des achats.</p>
 </article>;
}
