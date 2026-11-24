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

/** Une étape de l'entonnoir. Chaque étape nomme son fournisseur : les étapes ne
 *  viennent pas toutes de la même source et ne se déduisent pas l'une de l'autre. */
export type FunnelStep = {
  label: string;
  value: number | null;
  provider: string;
  note: string;
};

export type PriceGroup = {
  title: string;
  priceEur: number | null;
  tickets: number | null;
  faceValue: number | null;
  organizerFees: number | null;
  userFees: number | null;
  feeShare: number | null;
};

export type SumupSummary = {
  connected: boolean;
  transactions: number;
  gross: number | null;
  linked: number;
};

/** Constat chiffré, sans interprétation : chaque ligne est vérifiable. */
export type Finding = { label: string; value: string; detail: string | null };

export type BilanPanel = {
  payout: NetPayout;
  spend: number | null;
  afterAds: number | null;
  averagePrice: number | null;
  scanned: number | null;
  scanRate: number | null;
  priceGroups: PriceGroup[];
  sumup: SumupSummary;
  findings: Finding[];
  currency: string;
};

export type SourceState = {
  provider: string;
  label: string;
  lastSuccess: string | null;
  rowCount: number | null;
  lastStatus: string | null;
  errorCode: string | null;
};

export type SourcesPanel = {
  connections: SourceState[];
  credentials: { credential: string; status: string; expiresAt: string | null; checkedAt: string | null }[];
};

export type SignalView = {
  events: EventOption[];
  selectedId: string | null;
  eventName: string | null;
  startsAt: string | null;
  traffic: TrafficState;
  today: TodayPanel;
  funnel: FunnelStep[];
  timeline: TimelinePanel;
  ads: AdsPanel;
  bilan: BilanPanel;
  sources: SourcesPanel;
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

  /* ---- entonnoir ----
   * Les étapes viennent de deux fournisseurs différents et ne s'emboîtent pas
   * logiquement : une impression n'est pas une personne, une visite n'est pas un
   * clic retrouvé. L'entonnoir range des ordres de grandeur, il ne démontre
   * aucun passage d'une étape à la suivante. */
  const funnel: FunnelStep[] = [
    { label: 'Impressions', value: num(marketing?.impressions), provider: 'Meta',
      note: 'Affichages, pas des personnes.' },
    { label: 'Clics sortants', value: outbound, provider: 'Meta',
      note: 'Sorties vers la billetterie remontées par Meta.' },
    { label: 'Visites billetterie', value: visits, provider: 'Shotgun',
      note: 'Chaque passage compte, toutes origines confondues.' },
    { label: 'Commandes', value: num(event?.orders), provider: 'Shotgun',
      note: 'Une commande peut contenir plusieurs billets.' },
    { label: 'Billets payants', value: paidTickets, provider: 'Shotgun',
      note: 'Invitations et duplicatas exclus.' },
    { label: 'Billets scannés', value: num(event?.scanned), provider: 'Shotgun',
      note: 'Présence à l’entrée, si le scan a été utilisé.' },
  ];

  /* ---- écran Bilan ---- */
  const afterAds =
    payout.netPayout === null || legacy.spend === null ? null : payout.netPayout - legacy.spend;

  const sumupRows = forEvent(data?.sumup);
  const allSumup: Row[] = Array.isArray(data?.sumup) ? data.sumup : [];
  const successful: Row[] = Array.isArray(data?.successful) ? data.successful : [];
  const sumupGross = sumupRows.reduce<number | null>((total, r) => {
    const v = num(r.amount);
    return v === null ? total : (total ?? 0) + v;
  }, null);

  /**
   * Billets vendus dans les trois derniers jours : total de la courbe moins le
   * cumul atteint à J-4. Si la courbe ne remonte pas jusque-là, tout ce qu'elle
   * contient est déjà dans la fenêtre.
   */
  const lastThreeDays = curve?.length
    ? curve[curve.length - 1].cumulative - (cumulativeAt(curve, 4) ?? 0)
    : null;

  const findings: Finding[] = [];
  const fmt = (v: number | null, unit = '') => (v === null ? '—' : `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${unit}`);

  if (payout.feeShare !== null) {
    findings.push({
      label: 'Part des frais dans le prix facial',
      value: fmt(payout.feeShare * 100, ' %'),
      detail: 'Frais quasi fixes par billet : leur poids augmente quand le prix baisse.',
    });
  }
  if (lastThreeDays !== null && paidTickets) {
    findings.push({
      label: 'Billets vendus dans les trois derniers jours',
      value: `${lastThreeDays} sur ${paidTickets}`,
      detail: 'Concentration de la demande près de la date.',
    });
  }
  const nearestComparable = comparisons.filter(c => c.comparable).slice(-1)[0];
  if (nearestComparable) {
    findings.push({
      label: `Écart avec l’édition précédente au ${nearestComparable.daysBefore === 0 ? 'jour J' : `J-${nearestComparable.daysBefore}`}`,
      value: `${nearestComparable.current} contre ${nearestComparable.previous}`,
      detail: previous ? `Comparé à ${str(previous.name) ?? 'l’édition précédente'}.` : null,
    });
  }
  if (afterAds !== null) {
    findings.push({
      label: 'Reste après frais de billetterie et publicité',
      value: fmt(afterAds, ' €'),
      detail: 'Hors encaissements sur place, frais de virement et dépenses du lieu.',
    });
  }

  const bilan: BilanPanel = {
    payout,
    spend: legacy.spend,
    afterAds,
    averagePrice: legacy.averagePrice,
    scanned: num(event?.scanned),
    scanRate: ratio(event?.scanned, event?.valid_tickets),
    priceGroups: priceGroups.map(g => ({
      title: str(g.deal_title) ?? 'Tarif sans nom',
      priceEur: num(g.price_cents) === null ? null : num(g.price_cents)! / 100,
      tickets: num(g.tickets),
      faceValue: num(g.face_value),
      organizerFees: num(g.organizer_fees),
      userFees: num(g.user_fees),
      feeShare: ratio(g.organizer_fees, g.face_value),
    })).sort((a, b) => (a.priceEur ?? 0) - (b.priceEur ?? 0)),
    sumup: {
      connected: successful.some(r => String(r.provider) === 'sumup'),
      transactions: sumupRows.length,
      gross: sumupGross,
      linked: allSumup.filter(r => r.event_id).length,
    },
    findings,
    currency,
  };

  /* ---- sources et fiabilité ---- */
  const runs: Row[] = Array.isArray(data?.runs) ? data.runs : [];
  const LABELS: Record<string, string> = {
    shotgun: 'Shotgun', meta: 'Meta Ads', instagram: 'Instagram',
    manychat: 'ManyChat', sumup: 'SumUp',
  };
  const sources: SourcesPanel = {
    connections: Object.keys(LABELS).map(provider => {
      const ok = successful.find(r => String(r.provider) === provider);
      const attempt = runs.find(r => String(r.provider) === provider);
      return {
        provider,
        label: LABELS[provider],
        lastSuccess: str(ok?.finished_at),
        rowCount: num(ok?.row_count),
        lastStatus: str(attempt?.status),
        errorCode: str(attempt?.error_code),
      };
    }),
    credentials: (Array.isArray(data?.credentials) ? data.credentials : []).map((c: Row) => ({
      credential: String(c.credential ?? ''),
      status: str(c.status) ?? 'inconnu',
      expiresAt: str(c.expires_at),
      checkedAt: str(c.checked_at),
    })),
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
    funnel,
    timeline,
    ads: adsPanel,
    bilan,
    sources,
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
