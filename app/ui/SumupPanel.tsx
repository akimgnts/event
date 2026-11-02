 'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Row=Record<string,any>;
const money=(v:unknown,c:string)=>v==null?'Inconnu':Number(v).toLocaleString('fr-FR',{style:'currency',currency:c});
export default function SumupPanel({rows,events,eventId,successful}:{rows:Row[];events:Row[];eventId:string;successful?:Row}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const selected=rows.filter(r=>eventId==='all'||r.event_id===eventId||!r.event_id);
 async function link(id:string,event:string){setBusy(true);setError('');try{const r=await fetch('/api/sumup/associations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transactionId:id,eventId:event||null})});if(!r.ok)throw Error();router.refresh()}catch{setError('Association non enregistrée.')}finally{setBusy(false)}}
 return <article className="card"><div className="section-head"><h2>Encaissements SumUp</h2><span className={'badge '+(successful?'':'warn')}>{successful?'Données synchronisées':'Non connecté'}</span></div><p className="helper">Les encaissements restent séparés des billets Shotgun : un paiement peut couvrir plusieurs achats, ou une vente déjà enregistrée ailleurs. Aucun total combiné avant rapprochement.</p>
 {!successful?<div className="empty">Connexion à autoriser : accès API SumUp et code du compte marchand YEVA. Aucun montant inventé.</div>:<p className="source">SumUp API · dernier succès {new Date(successful.finished_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} · {rows.filter(r=>!r.event_id).length} opérations à rattacher</p>}
 {successful&&!selected.length&&<p>Aucune opération dans ce périmètre.</p>}
 {selected.map(r=><div className="row" key={r.transaction_id}><div className="text"><strong>{money(r.amount,r.currency)} · {r.type} · {r.status}</strong><small>{new Date(r.occurred_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} · {r.payment_type||'Mode inconnu'} · {r.transaction_code||r.transaction_id}</small><small>Remboursement déclaré : {money(r.refunded_amount,r.currency)} · Relevé {new Date(r.synced_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}</small></div><select aria-label={'Événement de '+r.transaction_id} value={r.event_id||''} disabled={busy} onChange={e=>link(r.transaction_id,e.target.value)}><option value="">À rattacher</option>{events.map(e=><option key={e.event_id} value={e.event_id}>{e.name}</option>)}</select></div>)}
 {error&&<p role="alert" className="error-message">{error}</p>}<p className="helper">Rattachement manuel et audité dans YEVA. Les versements bancaires, frais et charges restent à rapprocher : cette liste ne constitue pas un résultat net. Le point d’équilibre reste inconnu tant que le budget complet n’est pas renseigné.</p></article>
}
