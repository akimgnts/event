import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSignalView } from '../lib/signal-view';

/**
 * Jeu de données minimal mais réaliste : deux éditions, du trafic Shotgun avec
 * ses deux pièges (fraction et heure UTC), une publicité reliée à une
 * publication organique. Aucune base n'est nécessaire : l'adaptateur est pur.
 */
const NOW = new Date('2026-11-18T12:00:00+01:00');

const data = (): Record<string, any> => ({
  events: [
    {
      organizer_id: 'org', event_id: 'E2', name: 'Trap Session #2',
      starts_at: '2026-11-21T19:30:00Z', status: 'published', capacity: 80,
      currency: 'EUR', valid_tickets: 12, paid_tickets: 10, face_value: 42,
      scanned: 0, orders: 8,
    },
    {
      organizer_id: 'org', event_id: 'E1', name: 'Trap Session #1',
      starts_at: '2026-10-17T19:30:00Z', status: 'past', capacity: 80,
      currency: 'EUR', valid_tickets: 16, paid_tickets: 16, face_value: 64,
      scanned: 11, orders: 14,
    },
  ],
  eventDaily: [
    { event_id: 'E2', sale_day: '2026-11-11', valid_tickets: 3 },
    { event_id: 'E2', sale_day: '2026-11-14', valid_tickets: 4 },
    { event_id: 'E2', sale_day: '2026-11-18', valid_tickets: 5 },
    { event_id: 'E1', sale_day: '2026-10-07', valid_tickets: 2 },
    { event_id: 'E1', sale_day: '2026-10-14', valid_tickets: 6 },
    { event_id: 'E1', sale_day: '2026-10-17', valid_tickets: 8 },
  ],
  priceGroups: [
    { event_id: 'E2', face_value: 42, organizer_fees: 5.4 },
    { event_id: 'E1', face_value: 64, organizer_fees: 8.2 },
  ],
  marketing: [{ event_id: 'E2', currency: 'EUR', spend: 12.5, impressions: 4200, clicks: 61 }],
  ads: [
    {
      event_id: 'E2', ad_id: 'A1', ad_name: 'Reel 19/11', instagram_media_id: 'M1',
      currency: 'EUR', spend: 12.5, impressions: 4200, outbound_clicks: 30,
    },
  ],
  adDaily: [
    { event_id: 'E2', ad_id: 'A1', day: '2026-11-16', spend: 5, currency: 'EUR' },
    { event_id: 'E2', ad_id: 'A1', day: '2026-11-17', spend: 7.5, currency: 'EUR' },
  ],
  instagram: [
    {
      media_id: 'M1', media_type: 'VIDEO', published_at: '2026-11-16T18:00:00Z',
      views: 1200, reach: 900, shares: 24, skip_rate: 0.62, avg_watch_ms: 3400,
    },
    {
      media_id: 'M9', media_type: 'IMAGE', published_at: '2026-11-17T10:00:00Z',
      views: 300, reach: 280, shares: 2,
    },
  ],
  contentLinks: [
    {
      media_id: 'M1', event_id: 'E2', classification: 'event',
      objective: 'vendre les early', cta: 'lien en bio', expected_kpi: 'billets',
    },
  ],
  traffic: [
    {
      event_id: 'E2', status: 'available', traffic_last_update: '2026-11-18T10:05:00Z',
      collected_at: '2026-11-18T10:10:00Z', error_code: null,
      payload: {
        traffic: {
          visitsCount: 220, todaysVisits: 18, ordersCount: 8, sharesCount: 3,
          visitsByDay: [
            { day: '2026-11-14T23:00:00Z', sum: 40 },
            { day: '2026-11-17T23:00:00Z', sum: 60 },
          ],
          visitsByUtm: [
            { utmSource: 'meta_pub', type: 'tracking_link', count: 22, percent: 0.1 },
            { utmSource: 'instagram', type: 'other', count: 150, percent: 0.6818 },
          ],
        },
      },
    },
  ],
  automations: [{ event_id: 'E2', flow_id: 'F1', sends: 40, clicks: 12, replies: 5 }],
  limitations: ['Visites : API interne Shotgun.'],
});

/* --- choix de l'événement --- */

test('sans sélection, retient le prochain événement à venir', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.equal(v.selectedId, 'E2');
  assert.equal(v.eventName, 'Trap Session #2');
});

test('une sélection explicite est respectée', () => {
  const v = buildSignalView(data(), { now: NOW, eventId: 'E1' });
  assert.equal(v.selectedId, 'E1');
});

test('sans aucun événement, la vue existe et ne contient aucun zéro inventé', () => {
  const v = buildSignalView({ events: [] }, { now: NOW });
  assert.equal(v.selectedId, null);
  assert.equal(v.today.paidTickets, null);
  assert.equal(v.today.payout.netPayout, null);
  assert.equal(v.timeline.curve, null);
  assert.equal(v.today.visitToTicket, null);
});

/* --- écran Aujourd'hui --- */

test('le versement net est calculé pour le seul événement affiché', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.equal(v.today.payout.faceValue, 42);
  assert.equal(v.today.payout.organizerFees, 5.4);
  assert.equal(v.today.payout.netPayout, 36.6);
});

test('conversion visites → billets, et panier moyen', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.ok(Math.abs((v.today.visitToTicket ?? 0) - 10 / 220) < 1e-9);
  assert.ok(Math.abs((v.today.basket ?? 0) - 10 / 8) < 1e-9);
  assert.ok(Math.abs((v.today.fillRate ?? 0) - 10 / 80) < 1e-9);
});

test('les jours restants comptent vers la date, pas depuis', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.equal(v.today.daysBefore, 3);
});

/* --- chronologie et comparaison d'éditions --- */

test('la courbe est en J-x et cumulative', () => {
  const v = buildSignalView(data(), { now: NOW });
  const curve = v.timeline.curve ?? [];
  assert.deepEqual(curve.map(p => p.daysBefore), [10, 7, 3]);
  assert.deepEqual(curve.map(p => p.cumulative), [3, 7, 12]);
});

test('la comparaison aligne les éditions sur J-x, jamais sur le calendrier', () => {
  const v = buildSignalView(data(), { now: NOW });
  const at7 = v.timeline.comparisons.find(c => c.daysBefore === 7);
  assert.ok(at7, 'le jalon J-7 doit être présent');
  assert.equal(at7.current, 7, 'édition en cours : 3 + 4 billets à J-7');
  assert.equal(at7.previous, 2, 'édition précédente : 2 billets à J-7');
  assert.equal(at7.comparable, true);
  assert.equal(v.timeline.previousName, 'Trap Session #1');
});

test('un jalon hors couverture reste null et n’est pas déclaré comparable', () => {
  const v = buildSignalView(data(), { now: NOW });
  const at21 = v.timeline.comparisons.find(c => c.daysBefore === 21);
  assert.equal(at21, undefined, 'aucune des deux courbes ne couvre J-21');
});

test('les visites par jour sont ramenées au jour de Paris', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.deepEqual(v.timeline.visitsByDay, [
    { day: '2026-11-15', visits: 40 },
    { day: '2026-11-18', visits: 60 },
  ]);
});

test('seuls les contenus rattachés à l’événement alimentent objectifs et hooks', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.equal(v.timeline.objectives.length, 1);
  assert.equal(v.timeline.objectives[0].objective, 'vendre les early');
  assert.equal(v.timeline.hooks.length, 1, 'M9 est une image et n’est pas rattachée');
  assert.ok(Math.abs((v.timeline.hooks[0].avgWatchSeconds ?? 0) - 3.4) < 1e-9);
});

/* --- publicités --- */

test('l’écart clic → arrivée confronte les clics sortants aux visites marquées', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.equal(v.ads.gap.outboundClicks, 30);
  assert.equal(v.ads.gap.trackedVisits, 22);
  assert.equal(v.ads.gap.gap, 8);
  assert.equal(v.ads.gap.reliable, true);
  assert.deepEqual(v.ads.paidSourceNames, ['meta_pub']);
});

test('la part d’une source reste une fraction, jamais multipliée deux fois', () => {
  const v = buildSignalView(data(), { now: NOW });
  const instagram = v.ads.bySource.find(s => s.source === 'instagram');
  assert.ok(instagram && Math.abs(instagram.share! - 0.6818) < 1e-9);
});

test('la créa payante est appariée à sa publication organique', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.equal(v.ads.pairings.length, 1);
  const p = v.ads.pairings[0];
  assert.equal(p.mediaId, 'M1');
  assert.equal(p.organic.views, 1200);
  assert.equal(p.paid.spend, 12.5);
  assert.ok(Math.abs((p.costPerOutboundClick ?? 0) - 12.5 / 30) < 1e-9);
});

test('sans budget renseigné, le rythme existe mais le reste à dépenser est inconnu', () => {
  const v = buildSignalView(data(), { now: NOW });
  assert.equal(v.budgetConfigured, false);
  assert.equal(v.ads.pacing.spent, 12.5);
  assert.ok(Math.abs((v.ads.pacing.dailyRate ?? 0) - 6.25) < 1e-9);
  assert.equal(v.ads.pacing.budget, null);
  assert.equal(v.ads.pacing.remaining, null);
});

test('avec un budget, l’épuisement est daté et comparé à la date de l’événement', () => {
  const v = buildSignalView(data(), { now: NOW, adBudget: 20 });
  assert.equal(v.budgetConfigured, true);
  assert.equal(v.ads.pacing.remaining, 7.5);
  assert.equal(v.ads.pacing.exhaustedOn, '2026-11-19');
  assert.equal(v.ads.pacing.endsBeforeEvent, true);
});

/* --- bloc « À faire maintenant » --- */

test('une publication récente non rattachée est signalée', () => {
  const v = buildSignalView(data(), { now: NOW });
  const codes = v.alerts.map(a => a.code);
  assert.ok(codes.includes('content_unlinked'), 'M9 est récente et non rattachée');
  assert.ok(!codes.includes('source_missing'), 'le trafic est disponible');
});

test('une source de trafic en échec devient une alerte critique', () => {
  const broken = data();
  broken.traffic[0] = {
    ...broken.traffic[0], status: 'unavailable', payload: null, error_code: 'token_expired',
  };
  const v = buildSignalView(broken, { now: NOW });
  const alert = v.alerts.find(a => a.code === 'source_missing');
  assert.ok(alert);
  assert.equal(alert.severity, 'critical');
  assert.equal(v.today.visits, null, 'aucune visite inventée quand la source est muette');
});

test('un budget qui s’épuise avant la date est signalé', () => {
  const v = buildSignalView(data(), { now: NOW, adBudget: 20 });
  assert.ok(v.alerts.some(a => a.code === 'budget_short'));
});
