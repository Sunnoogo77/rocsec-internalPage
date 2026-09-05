# Espace de gestion — principes visuels

Navigation sombre et persistante, surface de travail claire, typographie lisible et espacement régulier. Le bleu signale les actions principales ; les états de validation utilisent les couleurs sémantiques existantes. Les styles partagés sont dans `src/styles/tokens.css`, les composants dans `src/components/ui`.

Sur mobile, la navigation devient une bande horizontale défilante ; les formulaires de sécurité passent sur une colonne. Les contrôles gardent leurs libellés, focus et états désactivés. Respecter `prefers-reduced-motion`.

La page de connexion et les réglages sont vérifiés dans Playwright sur ordinateur et mobile. Les captures de recette sont produites dans `test-results/`, ignoré par Git. Toute évolution doit préserver les parcours d’édition, la lisibilité des erreurs API et les restrictions serveur.
