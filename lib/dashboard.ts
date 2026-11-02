import {database} from './db';
export async function dashboardData(){
 const db=await database();const account=process.env.SHOTGUN_ORGANIZER_ID;
 const events=await db.query('SELECT * FROM gold.event_totals WHERE organizer_id=$1 ORDER BY starts_at DESC NULLS LAST',[account||'']);
 const runs=await db.query(`SELECT DISTINCT ON(provider) provider,status,finished_at,row_count,error_code FROM bronze.runs ORDER BY provider,started_at DESC`);
 const successful=await db.query(`SELECT DISTINCT ON(provider) provider,finished_at,row_count FROM bronze.runs WHERE status='success' ORDER BY provider,started_at DESC`);
 const channels=await db.query(`SELECT event_id,utm_source,channel,count(*) AS tickets FROM silver.tickets WHERE organizer_id=$1 AND status='valid' AND NOT canceled GROUP BY event_id,utm_source,channel`,[account||'']);
 const daily=await db.query('SELECT * FROM gold.organizer_daily WHERE organizer_id=$1 ORDER BY sale_day',[account||'']);
 const spend=await db.query('SELECT currency,sum(spend) AS spend,sum(impressions) AS impressions,sum(clicks) AS clicks,max(synced_at) AS synced_at FROM silver.campaign_daily GROUP BY currency');
 const automations=await db.query('SELECT DISTINCT ON(account_id,flow_id) * FROM silver.automation_observations ORDER BY account_id,flow_id,observed_at DESC');
 const instagram=await db.query('SELECT * FROM silver.instagram_media WHERE account_id=$1 ORDER BY published_at DESC',[process.env.INSTAGRAM_ACCOUNT_ID||'']);
 const instagramAccounts=await db.query('SELECT * FROM silver.instagram_accounts WHERE account_id=$1',[process.env.INSTAGRAM_ACCOUNT_ID||'']);
 return {instagram:instagram.rows,instagramAccounts:instagramAccounts.rows,automations:automations.rows,events:events.rows,runs:runs.rows,successful:successful.rows,channels:channels.rows,daily:daily.rows,spend:spend.rows,limitations:['Inventaire API : événements passés et futurs ; les brouillons peuvent être absents.','Montants : prix facial hors frais ; ce montant ne représente pas le versement net.','Visites, capacité physique et attribution publicitaire non vérifiées.','Dates de vente sans fuseau : regroupées selon la date brute fournisseur.','Instagram : portée estimée par publication, jamais additionnée comme une audience unique. Statistiques lifetime à la date de synchronisation.']};
}
