import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  netPayout, basketSize, fillRate, salesCurve, cumulativeAt, compareEditions,
  clickArrivalGap, creativePairings, objectiveReview, pacing, normalizeTraffic,
  automationYield, alerts,
} from '../lib/signal-kpis';

/* --- versement net --- */

test('netPayout retire les frais organisateur du prix facial', () => {
  const r = netPayout([
    { face_value: 22, organizer_fees: 5.94 },
    { face_value: 10, organizer_fees: 2.0 },
  ]);
  assert.equal(r.faceValue, 32);
  assert.equal(r.organizerFees, 7.94);
  assert.equal(r.netPayout, 24.06);
  assert.ok(r.feeShare !== null && Math.abs(r.feeShare - 7.94 / 32) < 1e-9);
});

test('netPayout renvoie null, jamais zero, sans donnee', () => {
  const r = netPayout([]);
  assert.equal(r.faceValue, null);
  assert.equal(r.netPayout, null);
  assert.equal(r.feeShare, null);
});

test('netPayout ignore les frais absents sans les compter comme zero', () => {
  const r = netPayout([{ face_value: 22, organizer_fees: null }]);
  assert.equal(r.faceValue, 22);
  assert.equal(r.organizerFees, null);
  assert.equal(r.netPayout, null);
});

/* --- panier et remplissage --- */

test('basketSize et fillRate', () => {
  assert.equal(basketSize(11, 8), 11 / 8);
  assert.equal(basketSize(11, 0), null);
  assert.equal(fillRate(11, 140), 11 / 140);
  assert.equal(fillRate(11, null), null);
});

/* --- courbe J-x --- */

const daily = [
  { sale_day: '2026-11-08', valid_tickets: 1 },
  { sale_day: '2026-11-10', valid_tickets: 3 },
  { sale_day: '2026-11-18', valid_tickets: 3 },
  { sale_day: '2026-11-20', valid_tickets: 1 },
];

test('salesCurve calcule les jours restants et le cumul', () => {
  const curve = salesCurve(daily, '2026-11-21T20:30:00Z');
  assert.ok(curve);
  assert.equal(curve![0].daysBefore, 13);
  assert.equal(curve![0].cumulative, 1);
  assert.equal(curve![curve!.length - 1].daysBefore, 1);
  assert.equal(curve![curve!.length - 1].cumulative, 8);
});

test('salesCurve renvoie null sans date de debut', () => {
  assert.equal(salesCurve(daily, null), null);
});

test('cumulativeAt refuse d extrapoler avant le premier point', () => {
  const curve = salesCurve(daily, '2026-11-21T20:30:00Z');
  assert.equal(cumulativeAt(curve, 11), 4);
  assert.equal(cumulativeAt(curve, 20), null, 'hors couverture : null, pas zero');
  assert.equal(cumulativeAt(null, 3), null);
});

test('compareEditions aligne sur J-x et non sur le calendrier', () => {
  const current = salesCurve(daily, '2026-11-21T20:30:00Z');
  const previous = salesCurve(
    [{ sale_day: '2026-10-12', valid_tickets: 2 }, { sale_day: '2026-10-20', valid_tickets: 4 }],
    '2026-10-23T20:30:00Z',
  );
  const c = compareEditions(current, previous, 3);
  assert.equal(c.comparable, true);
  assert.equal(c.current, 7);
  assert.equal(c.previous, 6);
  assert.equal(c.delta, 1);
});

test('compareEditions signale l incomparable plutot que d inventer', () => {
  const c = compareEditions(salesCurve(daily, '2026-11-21T20:30:00Z'), null, 3);
  assert.equal(c.comparable, false);
  assert.equal(c.previous, null);
  assert.equal(c.delta, null);
});

/* --- fuite clic / arrivee --- */

test('clickArrivalGap mesure l ecart entre sorties et arrivees', () => {
  const g = clickArrivalGap(164, 248);
  assert.equal(g.gap, -84);
  assert.equal(g.reliable, true);
  const unknown = clickArrivalGap(null, 248);
  assert.equal(unknown.gap, null);
  assert.equal(unknown.reliable, false);
});

/* --- organique vs payant --- */

test('creativePairings joint une pub a sa publication organique', () => {
  const pairs = creativePairings(
    [
      { ad_id: 'a1', instagram_media_id: 'm1', spend: 7.83, impressions: 788, outbound_clicks: 127 },
      { ad_id: 'a2', instagram_media_id: 'm1', spend: 2.0, impressions: 200, outbound_clicks: 20 },
      { ad_id: 'a3', instagram_media_id: 'absent', spend: 1, impressions: 10, outbound_clicks: 1 },
    ],
    [{ media_id: 'm1', views: 5441, reach: 3370, shares: 42, skip_rate: 0.561 }],
  );
  assert.equal(pairs.length, 1, 'une pub sans publication connue est ecartee');
  assert.deepEqual(pairs[0].adIds, ['a1', 'a2']);
  assert.equal(pairs[0].paid.spend, 9.83);
  assert.equal(pairs[0].paid.outboundClicks, 147);
  assert.equal(pairs[0].organic.views, 5441);
  assert.ok(Math.abs(pairs[0].paidClickRate! - 147 / 988) < 1e-9);
});

/* --- objectifs declares --- */

test('objectiveReview rapproche sans conclure', () => {
  const r = objectiveReview(
    [{ media_id: 'm1', objective: 'vendre', cta: 'lien en bio', expected_kpi: 'billets' }],
    [{ media_id: 'm1', published_at: '2026-11-18T18:00:00Z' }],
    [{ sale_day: '2026-11-18', valid_tickets: 3 }, { sale_day: '2026-11-19', valid_tickets: 0 }],
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].ticketsSameDay, 3);
  assert.equal(r[0].ticketsNextDay, 0);
  assert.equal(r[0].note, 'rapprochement temporel, pas une attribution');
});

test('objectiveReview ignore les contenus sans intention declaree', () => {
  assert.equal(objectiveReview([{ media_id: 'm1' }], [], []).length, 0);
});

/* --- rythme de depense --- */

test('pacing detecte un budget epuise avant la date', () => {
  const p = pacing({
    adDaily: [
      { day: '2026-11-18', spend: 2 },
      { day: '2026-11-19', spend: 2 },
    ],
    budget: 14,
    eventStartsAt: '2026-11-21T20:30:00Z',
    now: new Date('2026-11-20T12:00:00Z'),
  });
  assert.equal(p.spent, 4);
  assert.equal(p.remaining, 10);
  assert.equal(p.dailyRate, 2);
  assert.equal(p.endsBeforeEvent, false, '5 jours de marge : tient jusqu a la date');
});

test('pacing signale l epuisement anticipe', () => {
  const p = pacing({
    adDaily: [{ day: '2026-11-19', spend: 12 }],
    budget: 14,
    eventStartsAt: '2026-11-21T20:30:00Z',
    now: new Date('2026-11-20T12:00:00Z'),
  });
  assert.equal(p.remaining, 2);
  assert.equal(p.endsBeforeEvent, true);
});

/* --- trafic Shotgun --- */

const payload = {
  traffic: {
    visitsCount: 423,
    todaysVisits: 10,
    ordersCount: 8,
    sharesCount: 8,
    visitsByDay: [{ day: '2026-11-14T23:00:00.000Z', sum: 15 }],
    visitsByUtm: [{ utmSource: 'meta_pub', type: 'other', count: 248, percent: 0.587 }],
  },
};

test('normalizeTraffic ramene le jour UTC 23h au jour local', () => {
  const t = normalizeTraffic(payload)!;
  assert.equal(t.visits, 423);
  assert.equal(t.byDay[0].day, '2026-11-15', '23h UTC = le 15 a Paris, pas le 14');
});

test('normalizeTraffic conserve percent en fraction', () => {
  const t = normalizeTraffic(payload)!;
  assert.equal(t.bySource[0].share, 0.587, 'ne jamais multiplier par 100 deux fois');
  assert.equal(t.bySource[0].visits, 248);
});

test('normalizeTraffic renvoie null sur une charge vide', () => {
  assert.equal(normalizeTraffic(null), null);
  assert.equal(normalizeTraffic({}), null);
});

/* --- automatisations --- */

test('automationYield agrege les flux ManyChat', () => {
  const a = automationYield([
    { sends: 100, clicks: 20, replies: 5 },
    { sends: 50, clicks: 5, replies: null },
  ]);
  assert.equal(a.sends, 150);
  assert.equal(a.clicks, 25);
  assert.equal(a.clickRate, 25 / 150);
});

/* --- alertes --- */

test('alerts enonce des faits verifiables', () => {
  const list = alerts({
    trafficStatus: 'unavailable',
    unlinkedRecentContent: 1,
    pacing: { spent: 12, budget: 14, remaining: 2, dailyRate: 4, exhaustedOn: '2026-11-20', endsBeforeEvent: true },
    comparison: { daysBefore: 1, current: 8, previous: 14, delta: -6, deltaShare: -0.43, comparable: true },
  });
  const codes = list.map(a => a.code);
  assert.deepEqual(codes, ['source_missing', 'budget_short', 'content_unlinked', 'pace_behind']);
  assert.equal(list[0].severity, 'critical');
});

test('alerts reste silencieux quand tout va bien', () => {
  assert.deepEqual(alerts({ trafficStatus: 'available', unlinkedRecentContent: 0 }), []);
});
