CREATE TABLE IF NOT EXISTS silver.sumup_transactions (
 merchant_code text NOT NULL, transaction_id text NOT NULL, transaction_code text,
 amount numeric NOT NULL CHECK(amount>=0), currency text NOT NULL,
 occurred_at timestamptz NOT NULL, status text NOT NULL, type text NOT NULL,
 payment_type text, refunded_amount numeric CHECK(refunded_amount>=0 AND refunded_amount<=amount),
 synced_at timestamptz NOT NULL, PRIMARY KEY(merchant_code,transaction_id)
);
CREATE TABLE IF NOT EXISTS silver.sumup_event_links (
 merchant_code text NOT NULL, transaction_id text NOT NULL, organizer_id text NOT NULL,
 event_id text NOT NULL, evidence text NOT NULL, confirmed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(merchant_code,transaction_id),
 FOREIGN KEY(merchant_code,transaction_id) REFERENCES silver.sumup_transactions(merchant_code,transaction_id),
 FOREIGN KEY(organizer_id,event_id) REFERENCES silver.events(organizer_id,event_id)
);
CREATE OR REPLACE VIEW gold.event_sumup AS
 SELECT l.organizer_id,l.event_id,t.currency,
 count(*) FILTER(WHERE t.type='PAYMENT' AND t.status IN ('SUCCESSFUL','REFUNDED')) AS payment_count,
 sum(t.amount) FILTER(WHERE t.type='PAYMENT' AND t.status IN ('SUCCESSFUL','REFUNDED')) AS gross_payments,
 sum(t.refunded_amount) FILTER(WHERE t.type='PAYMENT' AND t.status IN ('SUCCESSFUL','REFUNDED')) AS reported_refunds,
 count(*) FILTER(WHERE t.type='PAYMENT' AND t.status IN ('SUCCESSFUL','REFUNDED') AND t.refunded_amount IS NULL) AS unknown_refunds,
 max(t.synced_at) AS synced_at
 FROM silver.sumup_transactions t JOIN silver.sumup_event_links l USING(merchant_code,transaction_id)
 GROUP BY l.organizer_id,l.event_id,t.currency;
