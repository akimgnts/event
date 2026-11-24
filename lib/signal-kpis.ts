/**
 * Couche KPI additive — Signal.
 *
 * Ce module n'altère rien de `lib/kpis.ts`, qui reste la référence des ratios
 * existants. Il expose les indicateurs et corrélations que le schéma permet
 * déjà de calculer et que l'interface n'exploite pas encore.
 *
 * Règle appliquée partout : une donnée absente renvoie `null`, jamais `0`.
 * `null` signifie « non retourné », conformément à la règle de lecture du produit.
 * Aucune fonction n'affirme de causalité : les rapprochements temporels et les
 * attributions déclarées sont nommés comme tels dans leur type de retour.
 */

import { ratio } from './kpis';

const num = (v: unknown): number | null =>
  v == null || !Number.isFinite(Number(v)) ? null : Number(v);

const sum = (rows: readonly unknown[], pick: (r: any) => unknown): number | null => {
  let total = 0;
  let seen = false;
  for (const row of rows) {
    const v = num(pick(row));
    if (v !== null) { total += v; seen = true; }
  }
  return seen ? total : null;
};

const day = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/* ------------------------------------------------------------------ *
 * 1. Versement net estimé
 *
 * `silver.tickets` stocke `organizer_fee_cents`. Le versement net est donc
 * calculable, alors que l'interface répète « avant frais et versement net »
 * comme si le montant était inconnu. Il reste une estimation : les frais de
 * virement et les éventuelles retenues hors billetterie n'y figurent pas.
 * ------------------------------------------------------------------ */
export type NetPayout = {
  faceValue: number | null;
  organizerFees: number | null;
  netPayout: number | null;
  feeShare: number | null;
  basis: 'organizer_fees_only';
};

export function netPayout(priceGroups: readonly any[]): NetPayout {
  const faceValue = sum(priceGroups, r => r.face_value);
  const organizerFees = sum(priceGroups, r => r.organizer_fees);
  const net = faceValue === null || organizerFees === null ? null : faceValue - organizerFees;
  return {
    faceValue,
    organizerFees,
    netPayout: net,
    feeShare: ratio(organizerFees, faceValue),
    basis: 'organizer_fees_only',
  };
}

/* ------------------------------------------------------------------ *
 * 2. Taille du panier et taux de remplissage
 * ------------------------------------------------------------------ */
export function basketSize(paidTickets: unknown, orders: unknown): number | null {
  return ratio(paidTickets, orders);
}

export function fillRate(paidTickets: unknown, capacity: unknown): number | null {
  return ratio(paidTickets, capacity);
}

/* ------------------------------------------------------------------ *
 * 3. Courbe de vente en J-x
 *
 * `silver.tickets.sale_day` et `silver.events.starts_at` existent : la courbe
 * par jour restant avant l'événement est calculable sans donnée nouvelle.
 * C'est la base de toute comparaison entre éditions.
 * ------------------------------------------------------------------ */
export type CurvePoint = {
  daysBefore: number;
  saleDay: string;
  tickets: number;
  cumulative: number;
};

export function salesCurve(eventDaily: readonly any[], startsAt: unknown): CurvePoint[] | null {
  const start = day(startsAt);
  if (!start) return null;
  const startMs = Date.parse(start);

  const points = eventDaily
    .map(row => {
      const saleDay = day(row.sale_day);
      const tickets = num(row.valid_tickets);
      if (!saleDay || tickets === null) return null;
      const daysBefore = Math.round((startMs - Date.parse(saleDay)) / 86_400_000);
      return { daysBefore, saleDay, tickets };
    })
    .filter((p): p is { daysBefore: number; saleDay: string; tickets: number } => p !== null)
    .sort((a, b) => b.daysBefore - a.daysBefore);

  if (!points.length) return null;

  let cumulative = 0;
  return points.map(p => ({ ...p, cumulative: (cumulative += p.tickets) }));
}

/**
 * Cumul atteint à J-x. Renvoie `null` si la courbe ne couvre pas ce jour,
 * plutôt qu'un zéro qui laisserait croire à une absence de ventes.
 */
export function cumulativeAt(curve: readonly CurvePoint[] | null, daysBefore: number): number | null {
  if (!curve?.length) return null;
  const reached = curve.filter(p => p.daysBefore >= daysBefore);
  if (!reached.length) return null;
  const earliest = curve[0].daysBefore;
  if (daysBefore > earliest) return null;
  return reached[reached.length - 1].cumulative;
}

export type EditionComparison = {
  daysBefore: number;
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaShare: number | null;
  comparable: boolean;
};

/**
 * Comparaison entre deux éditions au même nombre de jours avant la date.
 * Jamais alignée sur le calendrier : deux éditions ne tombent pas le même jour
 * de la semaine, et le jour de la semaine pèse sur les ventes de soirée.
 */
export function compareEditions(
  current: readonly CurvePoint[] | null,
  previous: readonly CurvePoint[] | null,
  daysBefore: number,
): EditionComparison {
  const a = cumulativeAt(current, daysBefore);
  const b = cumulativeAt(previous, daysBefore);
  return {
    daysBefore,
    current: a,
    previous: b,
    delta: a === null || b === null ? null : a - b,
    deltaShare: a === null || b === null ? null : ratio(a - b, b),
    comparable: a !== null && b !== null,
  };
}

/* ------------------------------------------------------------------ *
 * 4. La fuite entre le clic et l'arrivée
 *
 * `silver.ad_daily.outbound_clicks` compte les sorties vers la billetterie ;
 * `shotgun_traffic.visitsByUtm` compte les arrivées marquées `meta_pub`.
 * L'écart mesure ce qui se perd entre les deux : redirections, fermetures
 * avant chargement, navigateurs bloquant les paramètres.
 *
 * Les deux chiffres viennent de fournisseurs différents, avec des fenêtres et
 * des définitions différentes. Le résultat est un indicateur de cohérence,
 * pas une mesure de perte exacte.
 * ------------------------------------------------------------------ */
export type ClickArrivalGap = {
  outboundClicks: number | null;
  trackedVisits: number | null;
  gap: number | null;
  arrivalRate: number | null;
  reliable: boolean;
};

export function clickArrivalGap(outboundClicks: unknown, trackedVisits: unknown): ClickArrivalGap {
  const clicks = num(outboundClicks);
  const visits = num(trackedVisits);
  return {
    outboundClicks: clicks,
    trackedVisits: visits,
    gap: clicks === null || visits === null ? null : clicks - visits,
    arrivalRate: ratio(visits, clicks),
    reliable: clicks !== null && visits !== null,
  };
}

/* ------------------------------------------------------------------ *
 * 5. Organique contre payant, sur la même création
 *
 * `silver.ads.instagram_media_id` relie une publicité à la publication qu'elle
 * diffuse. C'est le seul endroit du schéma où la même création existe sous ses
 * deux formes. Comparer leurs taux d'attention isole l'effet de l'audience, à
 * créa constante.
 * ------------------------------------------------------------------ */
export type CreativePairing = {
  mediaId: string;
  adIds: string[];
  organic: { views: number | null; reach: number | null; shares: number | null; skipRate: number | null };
  paid: { spend: number | null; impressions: number | null; outboundClicks: number | null };
  paidClickRate: number | null;
  costPerOutboundClick: number | null;
  organicShareRate: number | null;
};

export function creativePairings(
  ads: readonly any[],
  instagramMedia: readonly any[],
): CreativePairing[] {
  const mediaById = new Map(instagramMedia.map(m => [String(m.media_id), m]));
  const byMedia = new Map<string, any[]>();

  for (const ad of ads) {
    const mediaId = ad?.instagram_media_id ? String(ad.instagram_media_id) : null;
    if (!mediaId || !mediaById.has(mediaId)) continue;
    byMedia.set(mediaId, [...(byMedia.get(mediaId) ?? []), ad]);
  }

  return [...byMedia.entries()].map(([mediaId, group]) => {
    const media = mediaById.get(mediaId);
    const spend = sum(group, a => a.spend);
    const impressions = sum(group, a => a.impressions);
    const outbound = sum(group, a => a.outbound_clicks);
    const views = num(media.views);
    const shares = num(media.shares);
    return {
      mediaId,
      adIds: group.map(a => String(a.ad_id)),
      organic: {
        views,
        reach: num(media.reach),
        shares,
        skipRate: num(media.skip_rate),
      },
      paid: { spend, impressions, outboundClicks: outbound },
      paidClickRate: ratio(outbound, impressions),
      costPerOutboundClick: ratio(spend, outbound),
      organicShareRate: ratio(shares, views),
    };
  });
}

/* ------------------------------------------------------------------ *
 * 6. Qualité du hook
 *
 * `skip_rate` et `avg_watch_ms` sont collectés par publication. Le premier
 * mesure ce que les trois premières secondes retiennent, le second ce que la
 * vidéo garde ensuite. Les deux répondent à des questions différentes et ne
 * doivent pas être additionnés.
 * ------------------------------------------------------------------ */
export type HookQuality = {
  mediaId: string;
  publishedAt: string | null;
  keptPastThreeSeconds: number | null;
  avgWatchSeconds: number | null;
  retention: number | null;
};

export function hookQuality(media: any, durationSeconds?: unknown): HookQuality {
  const skip = num(media?.skip_rate);
  const avgMs = num(media?.avg_watch_ms);
  const duration = num(durationSeconds);
  return {
    mediaId: String(media?.media_id ?? ''),
    publishedAt: day(media?.published_at),
    keptPastThreeSeconds: skip === null ? null : 1 - skip / (skip > 1 ? 100 : 1),
    avgWatchSeconds: avgMs === null ? null : avgMs / 1000,
    retention: avgMs === null || duration === null ? null : ratio(avgMs / 1000, duration),
  };
}

/* ------------------------------------------------------------------ *
 * 7. Les objectifs déclarés ont-ils été tenus
 *
 * `silver.content_links` stocke `objective`, `cta` et `expected_kpi` : le
 * schéma anticipe qu'une publication a une intention. Rien ne la confronte au
 * résultat. Cette fonction se contente de rapprocher, sans conclure.
 * ------------------------------------------------------------------ */
export type ObjectiveReview = {
  mediaId: string;
  objective: string | null;
  cta: string | null;
  expectedKpi: string | null;
  publishedOn: string | null;
  ticketsSameDay: number | null;
  ticketsNextDay: number | null;
  note: 'rapprochement temporel, pas une attribution';
};

export function objectiveReview(
  contentLinks: readonly any[],
  instagramMedia: readonly any[],
  eventDaily: readonly any[],
): ObjectiveReview[] {
  const mediaById = new Map(instagramMedia.map(m => [String(m.media_id), m]));
  const ticketsByDay = new Map<string, number>();
  for (const row of eventDaily) {
    const d = day(row.sale_day);
    const t = num(row.valid_tickets);
    if (d && t !== null) ticketsByDay.set(d, (ticketsByDay.get(d) ?? 0) + t);
  }

  const nextDay = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);

  return contentLinks
    .filter(link => link?.objective || link?.expected_kpi)
    .map(link => {
      const media = mediaById.get(String(link.media_id));
      const published = day(media?.published_at);
      return {
        mediaId: String(link.media_id),
        objective: link.objective ?? null,
        cta: link.cta ?? null,
        expectedKpi: link.expected_kpi ?? null,
        publishedOn: published,
        ticketsSameDay: published ? ticketsByDay.get(published) ?? null : null,
        ticketsNextDay: published ? ticketsByDay.get(nextDay(published)) ?? null : null,
        note: 'rapprochement temporel, pas une attribution' as const,
      };
    });
}

/* ------------------------------------------------------------------ *
 * 8. Rythme de dépense d'un ensemble de publicités
 *
 * Répond à la question que l'organisateur se pose la veille : est-ce que ma
 * campagne tiendra jusqu'à l'ouverture des portes.
 * ------------------------------------------------------------------ */
export type Pacing = {
  spent: number | null;
  budget: number | null;
  remaining: number | null;
  dailyRate: number | null;
  exhaustedOn: string | null;
  endsBeforeEvent: boolean | null;
};

export function pacing(input: {
  adDaily: readonly any[];
  budget: unknown;
  eventStartsAt: unknown;
  now?: Date;
}): Pacing {
  const now = input.now ?? new Date();
  const spent = sum(input.adDaily, r => r.spend);
  const budget = num(input.budget);
  const remaining = spent === null || budget === null ? null : Math.max(budget - spent, 0);

  const days = new Set(input.adDaily.map(r => day(r.day)).filter(Boolean));
  const dailyRate = ratio(spent, days.size);

  let exhaustedOn: string | null = null;
  if (remaining !== null && dailyRate !== null && dailyRate > 0) {
    const daysLeft = remaining / dailyRate;
    exhaustedOn = new Date(now.getTime() + daysLeft * 86_400_000).toISOString().slice(0, 10);
  }

  const start = day(input.eventStartsAt);
  return {
    spent,
    budget,
    remaining,
    dailyRate,
    exhaustedOn,
    endsBeforeEvent: exhaustedOn === null || start === null ? null : exhaustedOn < start,
  };
}

/* ------------------------------------------------------------------ *
 * 9. Normalisation du trafic Shotgun
 *
 * `percent` arrive en fraction (0,3644 pour 36,4 %) et `day` en UTC à 23:00,
 * soit minuit à Paris en heure d'hiver. Deux pièges qui faussent un affichage
 * naïf. Cette fonction les neutralise une fois pour toutes.
 * ------------------------------------------------------------------ */
export type TrafficSource = { source: string; kind: string; visits: number; share: number | null };
export type NormalizedTraffic = {
  visits: number | null;
  visitsToday: number | null;
  orders: number | null;
  shares: number | null;
  byDay: { day: string; visits: number }[];
  bySource: TrafficSource[];
};

export function normalizeTraffic(payload: any, timeZone = 'Europe/Paris'): NormalizedTraffic | null {
  const traffic = payload?.traffic ?? payload?.data?.event?.traffic;
  if (!traffic) return null;

  const localDay = (iso: unknown): string | null => {
    const raw = iso ? new Date(String(iso)) : null;
    if (!raw || Number.isNaN(raw.getTime())) return null;
    try {
      return new Intl.DateTimeFormat('fr-CA', { timeZone }).format(raw);
    } catch {
      return raw.toISOString().slice(0, 10);
    }
  };

  return {
    visits: num(traffic.visitsCount),
    visitsToday: num(traffic.todaysVisits),
    orders: num(traffic.ordersCount),
    shares: num(traffic.sharesCount),
    byDay: (traffic.visitsByDay ?? [])
      .map((d: any) => ({ day: localDay(d?.day), visits: num(d?.sum) ?? 0 }))
      .filter((d: any) => d.day !== null),
    bySource: (traffic.visitsByUtm ?? []).map((s: any) => ({
      source: String(s?.utmSource ?? 'inconnu'),
      kind: String(s?.type ?? 'other'),
      visits: num(s?.count) ?? 0,
      // `percent` est une fraction, jamais un pourcentage : ne pas multiplier deux fois.
      share: num(s?.percent),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * 10. Rendement des automatisations ManyChat
 * ------------------------------------------------------------------ */
export function automationYield(observations: readonly any[]) {
  const sends = sum(observations, o => o.sends);
  const clicks = sum(observations, o => o.clicks);
  const replies = sum(observations, o => o.replies);
  return { sends, clicks, replies, clickRate: ratio(clicks, sends), replyRate: ratio(replies, sends) };
}

/* ------------------------------------------------------------------ *
 * 11. Les règles du bloc « À faire maintenant »
 *
 * Chaque règle énonce un fait vérifiable et ne formule aucune interprétation.
 * ------------------------------------------------------------------ */
export type Alert = {
  code: 'source_missing' | 'content_unlinked' | 'budget_short' | 'pace_behind';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detail: string | null;
};

export function alerts(input: {
  trafficStatus?: string | null;
  unlinkedRecentContent?: number;
  pacing?: Pacing | null;
  comparison?: EditionComparison | null;
  eventStartsAt?: unknown;
}): Alert[] {
  const out: Alert[] = [];

  if (input.trafficStatus && input.trafficStatus !== 'available') {
    out.push({
      code: 'source_missing',
      severity: 'critical',
      message: 'La source de trafic Shotgun ne répond pas : les visites restent inconnues.',
      detail: `Statut : ${input.trafficStatus}.`,
    });
  }

  if (input.pacing?.endsBeforeEvent === true) {
    out.push({
      code: 'budget_short',
      severity: 'warning',
      message: 'Le budget publicitaire sera épuisé avant la date de l’événement.',
      detail: input.pacing.exhaustedOn ? `Épuisement estimé le ${input.pacing.exhaustedOn}.` : null,
    });
  }

  if (input.unlinkedRecentContent && input.unlinkedRecentContent > 0) {
    const count = input.unlinkedRecentContent;
    out.push({
      code: 'content_unlinked',
      severity: 'info',
      message:
        count > 1
          ? `${count} publications récentes ne sont rattachées à aucun événement.`
          : 'Une publication récente n’est rattachée à aucun événement.',
      detail: null,
    });
  }

  const c = input.comparison;
  if (c?.comparable && c.deltaShare !== null && c.deltaShare < -0.2) {
    out.push({
      code: 'pace_behind',
      severity: 'warning',
      message: `À J-${c.daysBefore}, ${c.current} billets contre ${c.previous} pour l’édition précédente.`,
      detail: null,
    });
  }

  return out;
}
