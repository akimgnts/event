'use client';

/**
 * Signal — interface.
 *
 * Trois écrans, pas dix : ce qui demande une décision aujourd'hui, ce qui s'est
 * passé dans le temps, et où va le budget. Chaque chiffre vient de
 * `buildSignalView`, qui n'invente rien : « — » signifie non retourné.
 *
 * Aucune conclusion causale n'est écrite ici. Les rapprochements temporels sont
 * nommés comme tels, à l'endroit où ils sont affichés.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CurvePoint, SignalView } from '@/lib/signal-view';

type Screen = 'today' | 'timeline' | 'ads' | 'bilan';

const SCREENS: [Screen, string, string][] = [
  ['today', 'Aujourd’hui', 'Ce qui demande une décision maintenant.'],
  ['timeline', 'Chronologie', 'Comment les ventes sont arrivées, et à quoi les comparer.'],
  ['ads', 'Publicités', 'Où va le budget, et ce qui en revient.'],
  ['bilan', 'Bilan', 'Ce que l’événement a rapporté, et ce qu’il en reste.'],
];

const DASH = <span className="sg-dash">—</span>;

const n = (v: number | null | undefined, dp = 0) =>
  v == null ? DASH : <span className="signal-num">{v.toLocaleString('fr-FR', { maximumFractionDigits: dp })}</span>;

const eur = (v: number | null | undefined, currency = 'EUR', dp = 2) =>
  v == null ? DASH : (
    <span className="signal-num">
      {v.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: dp })}
    </span>
  );

const pct = (v: number | null | undefined, dp = 1) =>
  v == null ? DASH : <span className="signal-num">{(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: dp })} %</span>;

const shortDay = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Mois en toutes lettres : évite le point d'abréviation suivi d'un point de phrase. */
const longDay = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })
    : 'aucun relevé';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'signal-card ' + className}>{children}</div>;
}

function Tile({
  label, value, note,
}: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <Card className="sg-tile">
      <span className="sg-tile-label">{label}</span>
      <span className="sg-tile-value">{value}</span>
      {note ? <span className="sg-tile-note">{note}</span> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Graphes : SVG fluide, aucune dépendance.
 * ------------------------------------------------------------------ */

const W = 640, H = 210, PAD = { t: 14, r: 14, b: 26, l: 38 };
const innerW = W - PAD.l - PAD.r;
const innerH = H - PAD.t - PAD.b;

function CumulativeChart({
  current, previous, previousName,
}: { current: CurvePoint[] | null; previous: CurvePoint[] | null; previousName: string | null }) {
  const series = [current, previous].filter((s): s is CurvePoint[] => !!s?.length);
  if (!series.length) {
    return <div className="sg-empty">Aucune vente datée pour cet événement : la courbe n’est pas calculable.</div>;
  }

  const maxDays = Math.max(...series.flatMap(s => s.map(p => p.daysBefore)), 1);
  const maxTickets = Math.max(...series.flatMap(s => s.map(p => p.cumulative)), 1);
  const x = (d: number) => PAD.l + ((maxDays - d) / maxDays) * innerW;
  const y = (v: number) => PAD.t + innerH - (v / maxTickets) * innerH;
  const path = (points: CurvePoint[]) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.daysBefore).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join(' ');

  const ticks = [0, Math.round(maxTickets / 2), maxTickets];
  const dayTicks = [maxDays, Math.round(maxDays / 2), 0];

  return (
    <>
      <svg className="sg-chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Billets cumulés selon le nombre de jours avant la date">
        {ticks.map(t => (
          <g key={t}>
            <line className="sg-grid-line" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text x={PAD.l - 8} y={y(t) + 3} textAnchor="end">{t}</text>
          </g>
        ))}
        {dayTicks.map(d => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle">{d === 0 ? 'Jour J' : `J-${d}`}</text>
        ))}
        {previous?.length ? (
          <path d={path(previous)} fill="none" stroke="var(--signal-serie-muted)" strokeWidth="2"
            strokeDasharray="4 3" strokeLinecap="round" />
        ) : null}
        {current?.length ? (
          <>
            <path d={path(current)} fill="none" stroke="var(--signal-serie-1)" strokeWidth="2.5" strokeLinecap="round" />
            {current.map(p => (
              <circle key={p.saleDay} cx={x(p.daysBefore)} cy={y(p.cumulative)} r="3" fill="var(--signal-serie-1)" />
            ))}
          </>
        ) : null}
      </svg>
      <div className="sg-legend">
        <span><i style={{ background: 'var(--signal-serie-1)' }} />Édition en cours</span>
        {previous?.length ? (
          <span><i style={{ background: 'var(--signal-serie-muted)' }} />{previousName ?? 'Édition précédente'}</span>
        ) : null}
      </div>
    </>
  );
}

function BarChart({
  rows, color, label,
}: { rows: { day: string; value: number }[]; color: string; label: string }) {
  if (!rows.length) return <div className="sg-empty">Aucun relevé par jour sur cette source.</div>;

  const max = Math.max(...rows.map(r => r.value), 1);
  const slot = innerW / rows.length;
  const width = Math.max(Math.min(slot - 6, 38), 3);
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
  const step = Math.ceil(rows.length / 7);

  return (
    <>
      <svg className="sg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line className="sg-grid-line" x1={PAD.l} x2={W - PAD.r} y1={PAD.t + innerH} y2={PAD.t + innerH} />
        <text x={PAD.l - 8} y={y(max) + 3} textAnchor="end">{max.toLocaleString('fr-FR')}</text>
        {rows.map((r, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          return (
            <g key={r.day}>
              <rect x={cx - width / 2} y={y(r.value)} width={width}
                height={Math.max(PAD.t + innerH - y(r.value), 1)} rx="3" fill={color} />
              {i % step === 0 ? <text x={cx} y={H - 8} textAnchor="middle">{shortDay(r.day)}</text> : null}
            </g>
          );
        })}
      </svg>
      <div className="sg-legend"><span><i style={{ background: color }} />{label}</span></div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Écrans
 * ------------------------------------------------------------------ */

function TodayScreen({ view }: { view: SignalView }) {
  const t = view.today;
  const payout = t.payout;

  return (
    <>
      <Card>
        <div className="sg-card-head">
          <h2>À faire maintenant</h2>
          <span className="signal-chip">{view.alerts.length} point{view.alerts.length > 1 ? 's' : ''}</span>
        </div>
        <div className="sg-alerts">
          {view.alerts.length ? view.alerts.map((a, i) => (
            <div className={'sg-alert sg-alert--' + a.severity} key={a.code + i}>
              {a.message}
              {a.detail ? <small>{a.detail}</small> : null}
            </div>
          )) : (
            <div className="sg-alert sg-alert--none">
              Aucune règle déclenchée. Les sources répondent et le rythme ne décroche pas.
            </div>
          )}
        </div>
      </Card>

      <div className="sg-grid sg-grid--4 sg-stack">
        <Tile label="Billets payants" value={n(t.paidTickets)}
          note={<>Remplissage {pct(t.fillRate)} {t.capacity == null ? '· capacité inconnue' : `· capacité ${t.capacity}`}</>} />
        <Tile label="Versement net estimé" value={eur(payout.netPayout, t.currency)}
          note={<>Prix facial {eur(payout.faceValue, t.currency)} − frais organisateur {eur(payout.organizerFees, t.currency)}. Hors frais de virement.</>} />
        <Tile label="Visites → billets" value={pct(t.visitToTicket, 2)}
          note={<>{n(t.visits)} visites comptées, {n(t.visitsToday)} aujourd’hui. Chaque passage compte, pas chaque personne.</>} />
        <Tile label="Publicité par billet" value={eur(t.adPerTicket, t.currency)}
          note={<>Dépense {eur(t.spend, t.currency)}. Ratio de pilotage, pas un coût d’acquisition attribué.</>} />
      </div>

      <div className="sg-grid sg-grid--2 sg-stack">
        <Card>
          <div className="sg-card-head"><h2>Composition du versement</h2></div>
          <p className="sg-sub">
            Le schéma stocke les frais organisateur par billet. Ce montant est donc calculable,
            à l’exception des frais de virement et des retenues hors billetterie.
          </p>
          <div className="sg-kv">
            <div><span>Prix facial encaissé</span><strong>{eur(payout.faceValue, t.currency)}</strong></div>
            <div><span>Frais organisateur</span><strong>{eur(payout.organizerFees, t.currency)}</strong></div>
            <div><span>Part des frais</span><strong>{pct(payout.feeShare)}</strong></div>
            <div><span>Versement net estimé</span><strong>{eur(payout.netPayout, t.currency)}</strong></div>
          </div>
        </Card>
        <Card>
          <div className="sg-card-head"><h2>Comportement d’achat</h2></div>
          <p className="sg-sub">
            Une commande peut contenir plusieurs billets : le panier distingue le nombre
            d’acheteurs du nombre de places.
          </p>
          <div className="sg-kv">
            <div><span>Commandes</span><strong>{n(t.orders)}</strong></div>
            <div><span>Billets par commande</span><strong>{n(t.basket, 2)}</strong></div>
            <div><span>Visites → commandes</span><strong>{pct(t.visitToOrder, 2)}</strong></div>
            <div><span>Billets valides, invitations comprises</span><strong>{n(t.validTickets)}</strong></div>
          </div>
        </Card>
      </div>
    </>
  );
}

/**
 * L'entonnoir sans barres.
 *
 * Les valeurs s'étalent sur trois ordres de grandeur : des impressions aux
 * billets scannés, une barre à échelle commune écrase tout sauf la première, et
 * une échelle logarithmique ferait croire à une proportion qui n'existe pas.
 *
 * Ce qui a du sens est le taux de passage, et seulement entre deux étapes du
 * même fournisseur. Au passage de Meta à Shotgun, aucun taux n'est affiché :
 * c'est précisément l'écart que l'écran Publicités mesure séparément.
 */
function Funnel({ steps }: { steps: SignalView['funnel'] }) {
  return (
    <div className="sg-funnel">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1] : null;
        const sameProvider = prev?.provider === s.provider;
        const rate =
          sameProvider && prev && prev.value != null && s.value != null && prev.value > 0
            ? s.value / prev.value
            : null;
        return (
          <div className="sg-funnel-row" key={s.label}>
            <span className="sg-funnel-step">
              {prev ? (
                rate !== null
                  ? <em className="sg-funnel-rate">
                      {/* Au-delà de 1, ce n'est plus un taux de passage mais un
                          multiplicateur : une commande porte plusieurs billets. */}
                      {rate > 1 ? <>×{n(rate, 2)}</> : pct(rate)}
                    </em>
                  : <em className="sg-funnel-rate sg-dash">
                      {sameProvider ? 'non calculable' : 'changement de source'}
                    </em>
              ) : null}
            </span>
            <span className="sg-funnel-label">{s.label}<small>{s.provider} · {s.note}</small></span>
            <strong className="sg-right">{n(s.value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function TimelineScreen({ view }: { view: SignalView }) {
  const tl = view.timeline;
  const auto = tl.automation;

  return (
    <>
      <Card>
        <div className="sg-card-head"><h2>Entonnoir observé</h2></div>
        <p className="sg-sub">
          Deux fournisseurs, des définitions différentes. Un taux n’est affiché que
          lorsque les deux étapes viennent de la même source : au passage de Meta à
          Shotgun, rien ne garantit qu’un clic et une visite comptent la même chose.
          C’est l’écart que mesure l’écran Publicités.
        </p>
        <Funnel steps={view.funnel} />
      </Card>

      <Card className="sg-stack">
        <div className="sg-card-head">
          <h2>Billets cumulés, alignés en J-x</h2>
          <span className="signal-chip">{tl.previousCurve ? 'Deux éditions' : 'Une seule édition'}</span>
        </div>
        <p className="sg-sub">
          L’alignement se fait sur les jours avant la date, jamais sur le calendrier :
          deux éditions ne tombent pas le même jour de la semaine, et le jour de la semaine
          pèse sur les ventes de soirée.
        </p>
        <CumulativeChart current={tl.curve} previous={tl.previousCurve} previousName={tl.previousName} />
      </Card>

      <Card className="sg-stack">
        <div className="sg-card-head"><h2>Comparaison aux mêmes jalons</h2></div>
        {tl.comparisons.length ? (
          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Jalon</th>
                  <th className="sg-right">Édition en cours</th>
                  <th className="sg-right">{tl.previousName ?? 'Édition précédente'}</th>
                  <th className="sg-right">Écart</th>
                  <th className="sg-right">Lecture</th>
                </tr>
              </thead>
              <tbody>
                {tl.comparisons.map(c => (
                  <tr key={c.daysBefore}>
                    <td>{c.daysBefore === 0 ? 'Jour J' : `J-${c.daysBefore}`}</td>
                    <td className="sg-right">{n(c.current)}</td>
                    <td className="sg-right">{n(c.previous)}</td>
                    <td className="sg-right">{c.delta == null ? DASH : <>{c.delta > 0 ? '+' : ''}{n(c.delta)}</>}</td>
                    <td className="sg-right">
                      {c.comparable ? pct(c.deltaShare) : <span className="sg-dash">hors couverture</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sg-empty">Aucun jalon couvert par les deux éditions.</div>
        )}
      </Card>

      <div className="sg-grid sg-grid--2 sg-stack">
        <Card>
          <div className="sg-card-head"><h2>Visites par jour</h2></div>
          <p className="sg-sub">Source Shotgun, ramenée au jour de Paris. Relevé du {clock(view.traffic.lastUpdate)}.</p>
          <BarChart rows={tl.visitsByDay.map(d => ({ day: d.day, value: d.visits }))}
            color="var(--signal-serie-3)" label="Visites de la billetterie" />
        </Card>
        <Card>
          <div className="sg-card-head"><h2>Billets par jour</h2></div>
          <p className="sg-sub">Billets valides, regroupés selon la date de vente fournisseur.</p>
          <BarChart rows={tl.ticketsByDay.map(d => ({ day: d.day, value: d.tickets }))}
            color="var(--signal-serie-1)" label="Billets vendus" />
        </Card>
      </div>

      <Card className="sg-stack">
        <div className="sg-card-head"><h2>Objectifs déclarés et ce qui a suivi</h2></div>
        <p className="sg-sub">
          Rapprochement temporel entre la publication et les ventes du jour, pas une attribution.
          Rien ici ne dit que la publication a causé la vente.
        </p>
        {tl.objectives.length ? (
          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Publication</th><th>Objectif déclaré</th><th>Appel à l’action</th>
                  <th className="sg-right">Billets le jour</th><th className="sg-right">Le lendemain</th>
                </tr>
              </thead>
              <tbody>
                {tl.objectives.map(o => (
                  <tr key={o.mediaId}>
                    <td>{o.publishedOn ? shortDay(o.publishedOn) : DASH}</td>
                    <td>{o.objective ?? DASH}</td>
                    <td>{o.cta ?? DASH}</td>
                    <td className="sg-right">{n(o.ticketsSameDay)}</td>
                    <td className="sg-right">{n(o.ticketsNextDay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sg-empty">
            Aucune publication rattachée à cet événement ne porte d’objectif déclaré.
          </div>
        )}
      </Card>

      <div className="sg-grid sg-grid--2 sg-stack">
        <Card>
          <div className="sg-card-head"><h2>Qualité des accroches</h2></div>
          <p className="sg-sub">
            Le passage avant trois secondes et la durée moyenne répondent à deux questions
            différentes et ne s’additionnent pas.
          </p>
          {tl.hooks.length ? (
            <div className="sg-table-wrap">
              <table className="sg-table">
                <thead>
                  <tr>
                    <th>Publiée</th><th className="sg-right">Gardé après 3 s</th>
                    <th className="sg-right">Durée moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {tl.hooks.map(h => (
                    <tr key={h.mediaId}>
                      <td>{h.publishedAt ? shortDay(h.publishedAt) : DASH}</td>
                      <td className="sg-right">{pct(h.keptPastThreeSeconds)}</td>
                      <td className="sg-right">{h.avgWatchSeconds == null ? DASH : <>{n(h.avgWatchSeconds, 2)} s</>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sg-empty">Aucune vidéo rattachée à cet événement.</div>
          )}
        </Card>
        <Card>
          <div className="sg-card-head"><h2>Automatisations ManyChat</h2></div>
          <p className="sg-sub">Relevés saisis depuis l’interface, sans synchronisation API.</p>
          <div className="sg-kv">
            <div><span>Envois</span><strong>{n(auto.sends)}</strong></div>
            <div><span>Clics</span><strong>{n(auto.clicks)}</strong></div>
            <div><span>Taux de clic</span><strong>{pct(auto.clickRate)}</strong></div>
            <div><span>Réponses</span><strong>{n(auto.replies)}</strong></div>
          </div>
        </Card>
      </div>
    </>
  );
}

function AdsScreen({ view }: { view: SignalView }) {
  const a = view.ads;

  return (
    <>
      <div className="sg-grid sg-grid--4">
        <Tile label="Dépensé" value={eur(a.pacing.spent, a.currency)}
          note={<>Uniquement les campagnes associées à cet événement.</>} />
        <Tile label="Rythme quotidien" value={eur(a.pacing.dailyRate, a.currency)}
          note={<>Moyenne sur les jours où une diffusion a été relevée.</>} />
        <Tile label="Budget restant"
          value={view.budgetConfigured ? eur(a.pacing.remaining, a.currency) : DASH}
          note={view.budgetConfigured
            ? <>{a.pacing.exhaustedOn ? <>Épuisement estimé le {longDay(a.pacing.exhaustedOn)}.</> :<>Aucune diffusion relevée : l’épuisement n’est pas projetable.</>}</>
            : <>Le budget total n’est pas stocké. Renseigne <code>SIGNAL_AD_BUDGET</code> pour activer cette projection.</>} />
        <Tile label="Clic → arrivée" value={pct(a.gap.arrivalRate)}
          note={<>{n(a.gap.outboundClicks)} clics sortants, {n(a.gap.trackedVisits)} visites marquées. Deux fournisseurs, deux définitions.</>} />
      </div>

      <Card className="sg-stack">
        <div className="sg-card-head"><h2>La fuite entre le clic et l’arrivée</h2></div>
        <p className="sg-sub">
          Les clics sortants sont comptés par Meta, les visites marquées par Shotgun.
          L’écart mesure une cohérence entre deux sources, pas une perte exacte :
          redirections, fermetures avant chargement, navigateurs qui suppriment les paramètres.
        </p>
        <div className="sg-kv">
          <div><span>Clics sortants remontés</span><strong>{n(a.gap.outboundClicks)}</strong></div>
          <div><span>Visites marquées publicité</span><strong>{n(a.gap.trackedVisits)}</strong></div>
          <div><span>Écart</span><strong>{n(a.gap.gap)}</strong></div>
          <div>
            <span>Sources considérées comme payantes</span>
            <strong>{a.paidSourceNames.length ? a.paidSourceNames.join(', ') : DASH}</strong>
          </div>
        </div>
        {!a.gap.reliable ? (
          <p className="sg-sub" style={{ marginTop: 'var(--signal-space-3)' }}>
            L’un des deux chiffres n’est pas retourné : l’écart n’est pas calculé plutôt que
            d’être présenté comme nul.
          </p>
        ) : a.gap.arrivalRate !== null && a.gap.arrivalRate > 1 ? (
          <p className="sg-sub" style={{ marginTop: 'var(--signal-space-3)' }}>
            Plus d’arrivées marquées que de clics comptés. Des visites portent le paramètre
            publicitaire sans qu’un clic ait été attribué : lien repartagé, retour sur la page,
            ou fenêtres de comptage différentes entre les deux fournisseurs.
          </p>
        ) : null}
      </Card>

      <Card className="sg-stack">
        <div className="sg-card-head"><h2>Même création, payante et organique</h2></div>
        <p className="sg-sub">
          Une publicité et une publication partagent ici le même identifiant de média :
          la création est constante, seule l’audience change.
        </p>
        {a.pairings.length ? (
          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Création</th><th className="sg-right">Vues organiques</th>
                  <th className="sg-right">Partages</th><th className="sg-right">Dépense</th>
                  <th className="sg-right">Impressions payantes</th>
                  <th className="sg-right">Clics sortants</th><th className="sg-right">Coût / clic</th>
                </tr>
              </thead>
              <tbody>
                {a.pairings.map(p => (
                  <tr key={p.mediaId}>
                    <td>{p.adIds.length} publicité{p.adIds.length > 1 ? 's' : ''}<br />
                      <span className="sg-sub">média {p.mediaId}</span></td>
                    <td className="sg-right">{n(p.organic.views)}</td>
                    <td className="sg-right">{n(p.organic.shares)}</td>
                    <td className="sg-right">{eur(p.paid.spend, a.currency)}</td>
                    <td className="sg-right">{n(p.paid.impressions)}</td>
                    <td className="sg-right">{n(p.paid.outboundClicks)}</td>
                    <td className="sg-right">{eur(p.costPerOutboundClick, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sg-empty">
            Aucune publicité de cet événement ne diffuse une publication présente dans les données Instagram.
          </div>
        )}
      </Card>

      <Card className="sg-stack">
        <div className="sg-card-head"><h2>D’où viennent les visites</h2></div>
        <p className="sg-sub">
          Part de chaque source dans les visites de la billetterie. La part est une fraction
          fournie par Shotgun, affichée sans seconde multiplication.
        </p>
        {a.bySource.length ? (
          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead>
                <tr><th>Source</th><th>Type</th><th className="sg-right">Visites</th><th className="sg-right">Part</th></tr>
              </thead>
              <tbody>
                {a.bySource.map(s => (
                  <tr key={s.source + s.kind}>
                    <td>{s.source}</td>
                    <td>{s.kind === 'tracking_link' ? 'lien paramétré' : s.kind}</td>
                    <td className="sg-right">{n(s.visits)}</td>
                    <td className="sg-right">{pct(s.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sg-empty">
            La source de trafic ne répond pas : les visites par origine restent inconnues.
          </div>
        )}
      </Card>
    </>
  );
}

function BilanScreen({ view }: { view: SignalView }) {
  const b = view.bilan;
  const c = b.currency;

  /** Cascade : chaque ligne retire quelque chose de la précédente. */
  const waterfall: [string, number | null, string][] = [
    ['Prix facial encaissé', b.payout.faceValue, 'base'],
    ['Frais organisateur', b.payout.organizerFees === null ? null : -b.payout.organizerFees, 'retrait'],
    ['Versement net estimé', b.payout.netPayout, 'etape'],
    ['Publicité', b.spend === null ? null : -b.spend, 'retrait'],
    ['Reste', b.afterAds, 'solde'],
  ];
  const scale = Math.max(b.payout.faceValue ?? 1, 1);

  return (
    <>
      <div className="sg-grid sg-grid--4">
        <Tile label="Prix facial" value={eur(b.payout.faceValue, c)}
          note={<>Billets valides, hors frais. Prix moyen {eur(b.averagePrice, c)}.</>} />
        <Tile label="Versement net estimé" value={eur(b.payout.netPayout, c)}
          note={<>Après {eur(b.payout.organizerFees, c)} de frais organisateur, soit {pct(b.payout.feeShare)} du facial.</>} />
        <Tile label="Publicité" value={eur(b.spend, c)}
          note={<>Uniquement les campagnes associées à cet événement.</>} />
        <Tile label="Reste" value={eur(b.afterAds, c)}
          note={<>Hors encaissements sur place, frais de virement et dépenses du lieu.</>} />
      </div>

      <Card className="sg-stack">
        <div className="sg-card-head"><h2>Ce qui reste, ligne par ligne</h2></div>
        <p className="sg-sub">
          Deux retraits seulement sont connus de Signal : les frais de billetterie et la
          publicité. Le cachet, le lieu, le matériel et les frais de virement n’y sont pas.
          Ce n’est donc pas un résultat net.
        </p>
        <div className="sg-waterfall">
          {waterfall.map(([label, value, kind]) => (
            <div className={'sg-wf-row sg-wf--' + kind} key={label}>
              <span>{label}</span>
              <span className="sg-wf-track">
                <i style={{ width: value == null ? 0 : `${Math.min(Math.abs(value) / scale * 100, 100)}%` }} />
              </span>
              <strong className="sg-right">{eur(value, c)}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card className="sg-stack">
        <div className="sg-card-head"><h2>Par tarif</h2></div>
        <p className="sg-sub">
          Les frais de billetterie sont presque fixes par billet : leur part grandit à
          mesure que le prix baisse. C’est le coût direct d’une grille basse.
        </p>
        {b.priceGroups.length ? (
          <div className="sg-table-wrap">
            <table className="sg-table">
              <thead>
                <tr>
                  <th>Tarif</th><th className="sg-right">Prix</th><th className="sg-right">Billets</th>
                  <th className="sg-right">Prix facial</th><th className="sg-right">Frais organisateur</th>
                  <th className="sg-right">Part des frais</th>
                </tr>
              </thead>
              <tbody>
                {b.priceGroups.map(g => (
                  <tr key={g.title + g.priceEur}>
                    <td>{g.title}</td>
                    <td className="sg-right">{eur(g.priceEur, c)}</td>
                    <td className="sg-right">{n(g.tickets)}</td>
                    <td className="sg-right">{eur(g.faceValue, c)}</td>
                    <td className="sg-right">{eur(g.organizerFees, c)}</td>
                    <td className="sg-right">{pct(g.feeShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sg-empty">Aucun billet payant synchronisé pour cet événement.</div>
        )}
      </Card>

      <div className="sg-grid sg-grid--2 sg-stack">
        <Card>
          <div className="sg-card-head">
            <h2>Encaissements sur place</h2>
            <span className={'signal-chip ' + (b.sumup.connected ? 'signal-chip--good' : '')}>
              {b.sumup.connected ? 'SumUp connecté' : 'SumUp non connecté'}
            </span>
          </div>
          <p className="sg-sub">
            Les encaissements restent séparés des billets Shotgun : un paiement peut couvrir
            plusieurs entrées, ou une vente déjà enregistrée ailleurs. Aucun total combiné
            avant rapprochement.
          </p>
          <div className="sg-kv">
            <div><span>Transactions rattachées</span><strong>{n(b.sumup.transactions)}</strong></div>
            <div><span>Montant brut rattaché</span><strong>{eur(b.sumup.gross, c)}</strong></div>
            <div><span>Transactions rattachées, tous événements</span><strong>{n(b.sumup.linked)}</strong></div>
          </div>
        </Card>
        <Card>
          <div className="sg-card-head"><h2>Présence à l’entrée</h2></div>
          <p className="sg-sub">
            Le scan n’est fiable que s’il a été utilisé toute la soirée. Un taux bas peut
            signifier des absents comme un contrôle abandonné à la porte.
          </p>
          <div className="sg-kv">
            <div><span>Billets scannés</span><strong>{n(b.scanned)}</strong></div>
            <div><span>Part des billets valides</span><strong>{pct(b.scanRate)}</strong></div>
          </div>
        </Card>
      </div>

      <Card className="sg-stack">
        <div className="sg-card-head"><h2>Ce que les chiffres disent</h2></div>
        <p className="sg-sub">
          Constats calculés sur cet événement, pas des leçons écrites d’avance.
          Aucun n’affirme de cause.
        </p>
        {b.findings.length ? (
          <div className="sg-kv">
            {b.findings.map(f => (
              <div key={f.label}>
                <span>{f.label}{f.detail ? <small className="sg-sub"> {f.detail}</small> : null}</span>
                <strong>{f.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="sg-empty">Pas assez de données pour un constat vérifiable.</div>
        )}
      </Card>
    </>
  );
}

function SourcesFooter({ sources }: { sources: SignalView['sources'] }) {
  const broken = sources.connections.filter(c => c.lastStatus === 'error').length;
  return (
    <details className="sg-sources">
      <summary>
        Sources et fiabilité
        {broken ? <span className="signal-chip signal-chip--warning">{broken} en erreur</span> : null}
      </summary>
      <div className="sg-grid sg-grid--2 sg-stack">
        <div>
          <h3 className="sg-sources-head">Connexions</h3>
          {sources.connections.map(c => (
            <div className="sg-kv" key={c.provider}>
              <div>
                <span>{c.label}<small className="sg-sub"> dernier succès : {clock(c.lastSuccess)}
                  {c.lastStatus === 'error' ? ` · dernière tentative en erreur (${c.errorCode ?? 'sans code'})` : ''}</small></span>
                <strong>{c.rowCount == null ? DASH : <>{n(c.rowCount)} lignes</>}</strong>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h3 className="sg-sources-head">Validité des accès</h3>
          {sources.credentials.length ? sources.credentials.map(c => (
            <div className="sg-kv" key={c.credential}>
              <div>
                <span>{c.credential}<small className="sg-sub"> contrôle : {clock(c.checkedAt)}
                  {c.expiresAt ? ` · expiration : ${clock(c.expiresAt)}` : ''}</small></span>
                <strong>{c.status}</strong>
              </div>
            </div>
          )) : <p className="sg-sub">Aucun contrôle d’accès enregistré.</p>}
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ *
 * Coque
 * ------------------------------------------------------------------ */

export default function SignalApp({ view }: { view: SignalView }) {
  const [screen, setScreen] = useState<Screen>('today');
  const router = useRouter();
  const current = SCREENS.find(s => s[0] === screen)!;

  const trafficTone =
    view.traffic.status === 'available' ? 'signal-chip--good'
      : view.traffic.status === 'stale' ? 'signal-chip--warning'
        : 'signal-chip--critical';

  return (
    <div className="signal-app">
      <div className="sg-rail">
       <div className="sg-rail-inner">
        <div className="sg-brand">
          <i />
          <span>Signal<small>YEVA · ESPACE ORGANISATEUR</small></span>
        </div>
        <div className="sg-nav">
          {SCREENS.map(([id, label]) => (
            <button key={id} aria-current={screen === id ? 'page' : undefined} onClick={() => setScreen(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="sg-rail-foot">
          Accès privé · API en lecture
          <br />
          « — » signifie non retourné, pas zéro.
        </div>
       </div>
      </div>

      <div>
        <div className="sg-top">
          <div className="sg-top-left">
            <select className="sg-select" value={view.selectedId ?? ''}
              onChange={e => router.push('/signal?event=' + encodeURIComponent(e.target.value))}>
              {view.events.length ? view.events.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name}{e.startsAt ? ' · ' + new Date(e.startsAt).toLocaleDateString('fr-FR') : ''}
                </option>
              )) : <option value="">Aucun événement synchronisé</option>}
            </select>
            <span className={'signal-chip ' + trafficTone}>Trafic : {view.traffic.status}</span>
          </div>
          <div className="sg-top-right">
            <span>Relevé Shotgun : {clock(view.traffic.lastUpdate)}</span>
            <button className="signal-btn signal-btn--secondary" onClick={() => router.refresh()}>Actualiser</button>
            <button className="signal-btn signal-btn--primary" onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.assign('/login');
            }}>Quitter</button>
          </div>
        </div>

        <div className="sg-body">
          <div className="sg-head">
            <h1>{current[1]}</h1>
            <p>
              {current[2]}
              {view.eventName ? ' · ' + view.eventName : ''}
              {view.today.daysBefore == null ? '' : view.today.daysBefore > 0
                ? ` · J-${view.today.daysBefore}`
                : view.today.daysBefore === 0 ? ' · jour J' : ` · passé depuis ${-view.today.daysBefore} j`}
            </p>
          </div>

          {screen === 'today' ? <TodayScreen view={view} /> : null}
          {screen === 'timeline' ? <TimelineScreen view={view} /> : null}
          {screen === 'ads' ? <AdsScreen view={view} /> : null}
          {screen === 'bilan' ? <BilanScreen view={view} /> : null}

          <div className="sg-foot">
            <SourcesFooter sources={view.sources} />
            Limites connues, affichées avec les chiffres plutôt qu’à côté :
            <ul>{view.limitations.map(l => <li key={l}>{l}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
