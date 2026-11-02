export type Integration = {
  id: string;
  label: string;
  purpose: string;
  status: "not_connected" | "manual_export" | "connected";
  dashboardUrl: string;
  strategy: string;
  requirements: string[];
};
export const integrations: Integration[] = [
  {
    id: "shotgun",
    label: "Shotgun",
    purpose: "Billetterie, commandes, suivi des ventes",
    status: "not_connected",
    dashboardUrl: "https://smartboard.shotgun.live/fr/events/615336",
    strategy: "Priorité aux exports autorisés ou à une API organisateur confirmée. Ne pas simuler de synchronisation.",
    requirements: ["Identifier les exports du Smartboard", "Valider la disponibilité d'une API", "Définir les champs commandes sans données personnelles superflues"]
  },
  {
    id: "meta",
    label: "Meta Ads",
    purpose: "Campagnes, dépenses, audiences et résultats",
    status: "not_connected",
    dashboardUrl: "https://adsmanager.facebook.com/",
    strategy: "Meta Marketing API avec permissions explicites, en lecture seule au départ.",
    requirements: ["Identifiant du compte publicitaire", "Application Meta et permissions accordées", "Jeton conservé côté serveur, jamais dans Git"]
  },
  {
    id: "instagram",
    label: "Instagram",
    purpose: "Portée, interactions et performance des contenus",
    status: "not_connected",
    dashboardUrl: "https://www.instagram.com/",
    strategy: "API Instagram autorisée, sous réserve du type de compte et des permissions.",
    requirements: ["Compte professionnel éligible", "Permissions nécessaires", "Validation des métriques accessibles"]
  },
  {
    id: "manychat",
    label: "ManyChat",
    purpose: "Déclencheurs, interactions et automatisations",
    status: "not_connected",
    dashboardUrl: "https://manychat.com/",
    strategy: "Vérifier les possibilités d'API, de webhook ou d'export du compte.",
    requirements: ["Accès API disponible selon l'offre", "Autorisations de lecture", "Conformité des données de contacts"]
  },
  {
    id: "website",
    label: "Site YEVA",
    purpose: "Sessions, liens UTM et conversions",
    status: "not_connected",
    dashboardUrl: "https://yeva.club/",
    strategy: "Instrumentation propriétaire côté site, consentement et collecte minimale.",
    requirements: ["Accès au code du site", "Schéma d'événements analytics", "Consentement et information des visiteurs"]
  }
];
