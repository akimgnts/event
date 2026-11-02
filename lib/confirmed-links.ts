// Explicit confirmations from Akim on 2026-11-02; never infer links for future content.
export async function applyConfirmedLinks(db:{query:(sql:string,params?:unknown[])=>Promise<unknown>}){
 if(process.env.SHOTGUN_ORGANIZER_ID!=='259009'||process.env.INSTAGRAM_ACCOUNT_ID!=='17841429562986531')return;
 const evidence='Confirmed by Akim in project conversation, 2026-11-02';
 await db.query(`INSERT INTO silver.event_links(organizer_id,event_id,provider,account_id,external_id,evidence) SELECT '259009','606083','meta',account_id,campaign_id,$1 FROM silver.campaign_daily WHERE account_id='2318556808621382' AND campaign_id='120250002434600674' AND EXISTS(SELECT 1 FROM silver.events WHERE organizer_id='259009' AND event_id='606083') GROUP BY account_id,campaign_id ON CONFLICT DO NOTHING`,[evidence]);
 await db.query(`INSERT INTO silver.content_links(account_id,media_id,organizer_id,event_id,classification,evidence) SELECT account_id,media_id,'259009','606083','event',$1 FROM silver.instagram_media WHERE account_id='17841429562986531' AND media_id IN ('18419726749158651','18039507677850047','18015309065752358','18100361336572169') AND EXISTS(SELECT 1 FROM silver.events WHERE organizer_id='259009' AND event_id='606083') ON CONFLICT DO NOTHING`,[evidence]);
}
