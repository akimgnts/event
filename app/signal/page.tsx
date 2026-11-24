import { dashboardData } from '@/lib/dashboard';
import { buildSignalView } from '@/lib/signal-view';
import SignalApp from '../ui/SignalApp';
import '../signal-tokens.css';
import '../signal.css';

export const dynamic = 'force-dynamic';

/**
 * Route de la nouvelle interface Signal.
 *
 * Elle n'altère pas `/`, qui continue de servir le cockpit existant : les deux
 * lisent la même base, par la même fonction de collecte. Comparer les deux est
 * donc possible sans migration et sans perte.
 *
 * Le budget publicitaire total n'existe nulle part dans le schéma. Il est lu
 * dans l'environnement, et son absence est affichée comme telle plutôt que
 * remplacée par une valeur supposée.
 */
function budget(): number | null {
  const raw = process.env.SIGNAL_AD_BUDGET;
  if (!raw) return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default async function SignalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = (await searchParams).event;
  const eventId = Array.isArray(requested) ? requested[0] : requested;

  try {
    const data = JSON.parse(JSON.stringify(await dashboardData()));
    const view = buildSignalView(data, { eventId: eventId ?? null, adBudget: budget() });
    return <SignalApp view={view} />;
  } catch {
    return (
      <div className="signal-app">
        <div className="sg-body">
          <div className="sg-head">
            <h1>Signal</h1>
            <p>
              La base de données ne répond pas. Aucun chiffre n’est affiché plutôt que des
              valeurs estimées. Le cockpit historique reste disponible sur la page d’accueil.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
