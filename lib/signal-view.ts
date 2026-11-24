/**
 * Adaptateur de lecture — Signal.
 *
 * Rôle unique : transformer ce que renvoie `dashboardData()` en un modèle de vue
 * typé, en appelant `lib/signal-kpis.ts`. Aucune requête, aucun effet de bord,
 * aucune donnée inventée. Fonction pure, donc testable sans base.
 *
 * Il ne modifie ni `lib/dashboard.ts` ni `lib/kpis.ts` ni `Cockpit.tsx`.
 *
 * Règle de lecture conservée de bout en bout : `null` signifie « non retourné ».
 * Jamais zéro par défaut, jamais de moyenne de remplacement.
 */

import { eventKpis, ratio } from './kpis';
import {
  alerts,
  automationYield,
  basketSize,
  clickArrivalGap,
  compareEditions,
  creativePairings,
  cumulativeAt,
  fillRate,
  hookQuality,
  netPayout,
  normalizeTraffic,
  objectiveReview,
  pacing,
  salesCurve,
  type Alert,
  type ClickArrivalGap,
  type CreativePairing,
  type CurvePoint,
  type EditionComparison,
  type HookQuality,
  type NetPayout,
  type NormalizedTraffic,
  type ObjectiveReview,
  type Pacing,
} from './signal-kpis';

type Row = Record<string, any>;

/** Sources UTM considérées comme issues de la publicité payante. */
const PAID_UTM_SOURCES = ['meta_pub', 'meta_ads', 'facebook_ad', 'instagram_ad'];

/** Jalons de comparaison entre éditions, en jours avant la date. */
const CHECKPOINTS = [21, 14, 7, 3, 1, 0];

const num = (v: unknown): number | null =>
  v == null || !Number.isFinite(Number(v)) ? null : Number(v);

const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

export type EventOption = {
  id: string;
  name: string;
  startsAt: string | null;
  status: string;
  paidTickets: number | null;
};

export type TrafficState = {
  status: string;
  errorCode: string | null;
  lastUpdate: string | null;
  collectedAt: string | null;
  data: NormalizedTraffic | null;
};

export type TodayPanel = {
  paidTickets: number | null;
  validTickets: number | null;
  capacity: number | null;
  fillRate: number | null;
  orders: number | null;
  basket: number | null;
  payout: NetPayout;
  visits: number | null;
  visitsToday: number | null;
  visitToTicket: number | null;
  visitToOrder: number | null;
  spend: number | null;
  adPerTicket: number | null;
  currency: string;
  daysBefore: number | null;
};

export type TimelinePanel = {
  curve: CurvePoint[] | null;
  previousCurve: CurvePoint[] | null;
  previousName: string | null;
  comparisons: EditionComparison[];
  visitsByDay: { day: string; visits: number }[];
  ticketsByDay: { day: string; tickets: number }[];
  objectives: ObjectiveReview[];
  hooks: HookQuality[];
  automation: ReturnType<typeof automationYield>;
};

export type AdsPanel = {
  pacing: Pacing;
  gap: ClickArrivalGap;
  pairings: CreativePairing[];
  bySource: NormalizedTraffic['bySource'];
  paidSourceNames: string[];
  currency: string;
};

export type SignalView = {
  events: EventOption[];
  selectedId: string | null;
  eventName: string | null;
  startsAt: string | null;
  traffic: TrafficState;
  today: TodayPanel;
  timeline: TimelinePanel;
  ads: AdsPanel;
  alerts: Alert[];
  limitations: string[];
  budgetConfigured: boolean;
};

export type BuildOptions = {
  /** Événement affiché. Par défaut le plus proche de maintenant. */
  eventId?: string | null;
  /** Budget publicitaire total, en devise du compte. Non stocké en base. */
  adBudget?: number | null;
  /** Injecté par les tests pour figer le temps. */
  now?: Date;
  timeZone?: string;
};

const dayKey = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Événement par défaut : le prochain à venir, sinon le plus récent passé. */
function pickEvent(events: readonly Row[], now: Date): Row | null {
  if (!events.length) return null;
  const dated = events.filter(e => e.starts_at);
  if (!dated.length) return events[0];
  const upcoming = dated
    .filter(e => Date.parse(String(e.starts_at)) >= now.getTime())
    .sort((a, b) => Date.parse(String(a.starts_at)) - Date.parse(String(b.starts_at)));
  if (upcoming.length) return upcoming[0];
  return dated.sort((a, b) => Date.parse(String(b.starts_at)) - Date.parse(String(a.starts_at)))[0];
}

/** Édition précédente : l'événement daté qui commence juste avant celui-ci. */
function previousEdition(events: readonly Row[], current: Row | null): Row | null {
  if (!current?.starts_at) return null;
  const currentMs = Date.parse(String(current.starts_at));
  return (
    events
      .filter(e => e.event_id !== current.event_id && e.starts_at)
      .filter(e => Date.parse(String(e.starts_at)) < currentMs)
      .sort((a, b) => Date.parse(String(b.starts_at)) - Date.parse(String(a.starts_at)))[0] ?? null
  );
}

export function buildSignalView(data: Row, options: BuildOptions = {}): SignalView {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? 'Europe/Paris';

  const events: Row[] = Array.isArray(data?.events) ? data.events : [];
  const requested = options.eventId
    ? events.find(e => String(e.event_id) === String(options.eventId)) ?? null
    : null;
  const event = requested ?? pickEvent(events, now);
  const eventId = event ? String(event.event_id) : null;
  const currency = str(event?.currency) ?? 'EUR';

  const forEvent = (rows: unknown, key = 'event_id'): Row[] =>
    Array.isArray(rows) && eventId ? rows.filter((r: Row) => String(r?.[key]) === eventId) : [];

  /* ---- trafic Shotgun ---- */
  const trafficRow = forEvent(data?.traffic)[0] ?? null;
  const traffic: TrafficState = {
    status: str(trafficRow?.status) ?? 'unavailable',
    errorCode: str(trafficRow?.error_code),
    lastUpdate: str(trafficRow?.traffic_last_update),
    collectedAt: str(trafficRow?.collected_at),
    data: trafficRow?.payload ? normalizeTraffic(trafficRow.payload, timeZone) : null,
  };

  /* ---- écran Aujourd'hui ---- */
  const priceGroups = forEvent(data?.priceGroups);
  const marketing = forEvent(data?.marketing).find(m => !m.currency || m.currency === currency);
  const legacy = eventKpis(event ?? {}, marketing);
  const payout = netPayout(priceGroups);
  const paidTickets = num(event?.paid_tickets);
  const visits = traffic.data?.visits ?? null;

  /**
   * Jours restants comptés en jours entiers, avec la même convention que
   * `salesCurve` : un écart de dates, pas une différence d'horloge. Le 18 au
   * midi pour un événement le 21 donne J-3, et non J-4.
   */
  const startDay = dayKey(event?.starts_at);
  const todayDay = dayKey(now);
  const daysBefore =
    startDay === null || todayDay === null
      ? null
      : Math.round((Date.parse(startDay) - Date.parse(todayDay)) / 86_400_000);

  const today: TodayPanel = {
    paidTickets,
    validTickets: num(event?.valid_tickets),
    capacity: num(event?.capacity),
    fillRate: fillRate(event?.paid_tickets, event?.capacity),
    orders: num(event?.orders),
    basket: basketSize(event?.paid_tickets, event?.orders),
    payout,
    visits,
    visitsToday: traffic.data?.visitsToday ?? null,
    visitToTicket: ratio(paidTickets, visits),
    visitToOrder: ratio(traffic.data?.orders ?? null, visits),
    spend: legacy.spend,
    adPerTicket: legacy.adPerTicket,
    currency,
    daysBefore,
  };

  /* ---- écran Chronologie ---- */
  const eventDaily = forEvent(data?.eventDaily);
  const curve = salesCurve(eventDaily, event?.starts_at);

  const previous = previousEdition(events, event);
  const previousDaily =
    previous && Array.isArray(data?.eventDaily)
      ? data.eventDaily.filter((r: Row) => String(r.event_id) === String(previous.event_id))
      : [];
  const previousCurve = previous ? salesCurve(previousDaily, previous.starts_at) : null;

  const comparisons = CHECKPOINTS.map(d => compareEditions(curve, previousCurve, d)).filter(
    c => c.current !== null || c.previous !== null,
  );

  const media: Row[] = Array.isArray(data?.instagram) ? data.instagram : [];
  const contentLinks: Row[] = Array.isArray(data?.contentLinks) ? data.contentLinks : [];
  const eventLinks = contentLinks.filter(l => eventId && String(l.event_id) === eventId);
  const eventMediaIds = new Set(eventLinks.map(l => String(l.media_id)));
  const eventMedia = media.filter(m => eventMediaIds.has(String(m.media_id)));

  const timeline: TimelinePanel = {
    curve,
    previousCurve,
    previousName: previous ? str(previous.name) : null,
    comparisons,
    visitsByDay: traffic.data?.byDay ?? [],
    ticketsByDay: eventDaily
      .map(r => ({ day: dayKey(r.sale_day), tickets: num(r.valid_tickets) ?? 0 }))
      .filter((r): r is { day: string; tickets: number } => r.day !== null)
      .sort((a, b) => a.day.localeCompare(b.day)),
    objectives: objectiveReview(eventLinks, media, eventDaily),
    hooks: eventMedia
      .filter(m => m.media_type === 'VIDEO')
      .map(m => hookQuality(m))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
    automation: automationYield(forEvent(data?.automations)),
  };

  /* ---- écran Publicités ---- */
  const ads: Row[] = Array.isArray(data?.ads) ? data.ads : [];
  const eventAds = eventId ? ads.filter(a => String(a.event_id) === eventId) : [];
  const adDaily: Row[] = Array.isArray(data?.adDaily) ? data.adDaily : [];
  const eventAdDaily = eventId ? adDaily.filter(r => String(r.event_id) === eventId) : [];

  const bySource = traffic.data?.bySource ?? [];
  const paidSources = bySource.filter(
    s => PAID_UTM_SOURCES.includes(s.source.toLowerCase()) || s.kind === 'tracking_link',
  );
  const paidVisits = paidSources.length
    ? paidSources.reduce((total, s) => total + s.visits, 0)
    : null;
  const outbound = eventAds.reduce<number | null>((total, a) => {
    const v = num(a.outbound_clicks);
    return v === null ? total : (total ?? 0) + v;
  }, null);

  const adsPanel: AdsPanel = {
    pacing: pacing({
      adDaily: eventAdDaily,
      budget: options.adBudget ?? null,
      eventStartsAt: event?.starts_at,
      now,
    }),
    gap: clickArrivalGap(outbound, paidVisits),
    pairings: creativePairings(eventAds, media),
    bySource,
    paidSourceNames: paidSources.map(s => s.source),
    currency,
  };

  /* ---- bloc « À faire maintenant » ---- */
  const recent = media.filter(m => {
    const published = m.published_at ? Date.parse(String(m.published_at)) : NaN;
    if (Number.isNaN(published)) return false;
    const withinTwoWeeks = now.getTime() - published < 14 * 86_400_000;
    return withinTwoWeeks && !contentLinks.some(l => String(l.media_id) === String(m.media_id));
  }).length;

  /** Jalon le plus proche de maintenant, pour la règle de retard de rythme. */
  const nearest =
    daysBefore === null
      ? null
      : comparisons
          .filter(c => c.comparable)
          .sort((a, b) => Math.abs(a.daysBefore - daysBefore) - Math.abs(b.daysBefore - daysBefore))[0] ??
        null;

  return {
    events: events.map(e => ({
      id: String(e.event_id),
      name: str(e.name) ?? String(e.event_id),
      startsAt: str(e.starts_at),
      status: str(e.status) ?? 'unknown',
      paidTickets: num(e.paid_tickets),
    })),
    selectedId: eventId,
    eventName: str(event?.name),
    startsAt: str(event?.starts_at),
    traffic,
    today,
    timeline,
    ads: adsPanel,
    alerts: alerts({
      trafficStatus: traffic.status,
      unlinkedRecentContent: recent,
      pacing: adsPanel.pacing,
      comparison: nearest,
      eventStartsAt: event?.starts_at,
    }),
    limitations: Array.isArray(data?.limitations) ? data.limitations : [],
    budgetConfigured: options.adBudget != null,
  };
}

/** Exposé pour que l'interface puisse nommer les jalons sans les redéclarer. */
export { CHECKPOINTS, PAID_UTM_SOURCES, cumulativeAt };
export type { Alert, CurvePoint, EditionComparison, NetPayout, Pacing };
