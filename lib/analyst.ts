import {eventKpis} from './kpis';
const n=(v:unknown)=>v==null?'inconnu':Number(v).toLocaleString('fr-FR',{maximumFractionDigits:2});
export function answerQuestion(question:string,eventId:string|null,d:Record<string,any>){
 const q=question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const events=d.events.filter((e:any)=>!eventId||e.event_id===eventId);
 if(eventId&&!events.length)return {answer:'Cet événement est inconnu.',sources:[],limitations:[]};
 const sources=d.successful.map((s:any)=>({source:s.provider,syncedAt:s.finished_at}));
 const limitations=['Aucune attribution individuelle publicité → achat n’est vérifiée.','Réponses calculées sur les données disponibles, sans génération IA externe.'];
 let answer='';
 if(/acquisition|cac|attribu/.test(q))answer='Le coût d’acquisition attribué est inconnu : les achats générés par les publicités ne sont pas identifiés. La dépense par billet vendu peut être calculée pour les campagnes associées à un événement ; elle ne prouve pas l’acquisition.';
 else if(/retention|visionnage|reel|contenu|partag/.test(q)){
  const ids=new Set(d.contentLinks.filter((l:any)=>!eventId||l.event_id===eventId).map((l:any)=>l.media_id));const media=d.instagram.filter((m:any)=>!eventId||ids.has(m.media_id));
  answer=media.map((m:any)=>`${new Date(m.published_at).toLocaleDateString('fr-FR')} : ${n(m.views)} vues, ${n(m.shares)} partages, ${n(m.saves)} enregistrements, durée moyenne ${m.avg_watch_ms==null?'inconnue':n(Number(m.avg_watch_ms)/1000)+' s'}, taux de passage avant 3 s ${n(m.skip_rate)} %. Source : Instagram.`).join('\n')||'Aucun contenu associé à cet événement.';
 }else if(/publicit|clic|campagne/.test(q)&&!/billet|bilan|rentab/.test(q)){
  const ads=d.ads.filter((a:any)=>(!eventId||a.event_id===eventId)&&a.spend!=null);answer=ads.map((a:any)=>`${a.ad_name} : ${n(a.spend)} ${a.currency}, ${n(a.link_clicks)} clics sur lien, ${n(a.outbound_clicks)} clics sortants remontés. Coût par clic sortant : ${a.outbound_clicks>0?n(Number(a.spend)/Number(a.outbound_clicks))+' '+a.currency:'inconnu'}.`).join('\n')||'Aucune publicité avec diffusion associée à ce périmètre.';
 }else if(/tarif|prix/.test(q))answer=d.priceGroups.filter((r:any)=>!eventId||r.event_id===eventId).map((r:any)=>`${r.deal_title||'Tarif sans nom'} : ${n(Number(r.price_cents)/100)} ${r.currency} hors frais, ${n(r.tickets)} billets valides, ${n(r.face_value)} ${r.currency} de prix facial.`).join('\n')||'Aucun tarif vendu disponible.';
 else if(/vente|billet|scan|bilan|budget|depens|cout|rentab|recette/.test(q))answer=events.map((e:any)=>{const k=eventKpis(e,d.marketing.find((m:any)=>m.event_id===e.event_id&&m.currency===e.currency));return `${e.name} : ${n(e.paid_tickets)} billets payants, ${n(e.orders)} commandes, ${n(e.scanned)} scans ; prix facial ${n(e.face_value)} ${e.currency||''}. Publicité associée : ${n(k.spend)} ${e.currency||''}. Publicité par billet payant : ${n(k.adPerTicket)} ${e.currency||''}. Solde partiel après publicité : ${n(k.partialBalance)} ${e.currency||''}, avant frais et autres dépenses.`}).join('\n');
 else answer='Je peux répondre sur les ventes, tarifs, scans, dépenses, clics et statistiques des contenus du périmètre choisi. Cette première version utilise des analyses prédéfinies : je ne peux pas encore interpréter toute question libre. Essayez « bilan de l’événement », « détail des tarifs » ou « statistiques de visionnage ».';
 return {answer,sources,limitations};
}
