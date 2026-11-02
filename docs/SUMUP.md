# SumUp — connexion en lecture seule

Implémenté : historique complet paginé via GET /v2.1/merchants/{merchant_code}/transactions/history, normalisation sans coordonnées ni données de carte, Bronze/Silver/Gold, rattachement manuel audité aux événements, panneau Budget & bilan et statut Sources. Le worker ne lance SumUp que si SUMUP_ACCESS_TOKEN est renseigné. Les mises à jour de statut et remboursements historiques sont reprises à chaque lecture complète. Publication atomique : un échec de page conserve le dernier succès.

## Activation
1. Confirmer que le compte marchand appartient à YEVA (ne pas utiliser le compte Made by Akim).
2. Autoriser l’accès de lecture : OAuth transactions.read ou transactions.history. Si une clé API est utilisée, ses permissions peuvent être plus larges que les seules opérations GET du connecteur ; vérifier avant création.
3. Stocker SUMUP_ACCESS_TOKEN et SUMUP_MERCHANT_CODE côté serveur dans .env.local ignoré (chmod 600), ou dans les variables runtime privées Coolify. Jamais de valeur dans Git, NEXT_PUBLIC_, URL, logs ou navigateur.
4. Exécuter npm run migrate, puis npm run sync -- sumup ; vérifier statut, date et nombre réel d’opérations. Worker : synchronisation au cycle suivant.
5. Associer les opérations aux événements dans Budget & bilan. La date ne constitue pas une preuve.

## Limites explicites
Aucun accès marchand confirmé à la livraison de ce code. Aucun paiement réel récupéré. Aucune création ou modification de paiement, facture ou compte. Aucun accès bancaire Open Banking. Les versements et frais ne sont pas encore ingérés ; ils ne sont pas affichés comme nuls. Pas de total Shotgun + SumUp avant rapprochement des éventuels doublons. Un paiement ne devient jamais un nombre de billets. Les remboursements absents restent NULL ; les lignes REFUND ne sont pas additionnées aux refunded_amount des paiements. La vue Gold conserve brut, remboursements déclarés et nombre de remboursements inconnus séparément. Aucun résultat net ni point d’équilibre prétendument complet.

Docs officielles consultées le 2 novembre 2026 :
- https://developer.sumup.com/api/transactions/list/
- https://developer.sumup.com/api/payouts/list/ (étudié, pas implémenté)

Validation : tests de pagination à origine fixe, collecte complète et erreurs HTTP, minimisation des données, valeurs financières invalides, migration idempotente et rattachement avec unicité/FK. Données de test isolées en mémoire, aucune insertion de démonstration dans le cockpit.
