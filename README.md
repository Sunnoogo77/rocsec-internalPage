# Roc Séculaire — Espace de gestion

Application React/Vite indépendante. Node 22, npm et `package-lock.json` pour des installations reproductibles.

```sh
npm ci
npm run dev
```

Ouvrir `http://127.0.0.1:5174`. Le proxy local `/api` cible le backend sur `127.0.0.1:8765`. Copier `.env.example` si une configuration différente est nécessaire. Les variables `VITE_*` sont publiques dans le bundle ; aucun secret ne doit y figurer.

```sh
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=low
npx playwright install chromium
npm run test:e2e
python3 security/check-inventory.py
```

La CI exécute ces contrôles et Gitleaks sur l’historique. Les tests navigateur couvrent ordinateur et mobile avec des réponses API simulées ; la sécurité des permissions est testée par le backend sur PostgreSQL.

Les rewrites SPA et les en-têtes de sécurité sont fournis dans `render.yaml`. `VITE_API_BASE_URL` doit être l’URL HTTPS de l’API se terminant par `/api/v1`.

Configurer `VITE_PUBLIC_SITE_URL`. L’API et cette interface doivent utiliser des sous-domaines HTTPS du même domaine pour les sessions SameSite=Lax. Le compte initial est créé par le backend, sans inscription publique. Les actions sensibles demandent une vérification récente dans Réglages.

Les instructions complètes Render, comptes, domaines, sauvegardes et retour arrière sont dans `rocsec-back/docs/DEPLOIEMENT.md` (dépôt privé). Le cycle habituel est une PR vers `develop`, puis une promotion vers `main` après recette. Pour cette mise en ligne, le propriétaire a autorisé la promotion directe de `main` pendant le blocage CI.

Le [guide de l’interface interne](docs/INTERFACE-INTERNE.md) décrit les thèmes, le classement des personnes, la réception des témoignages et le parcours de validation.

## Mise en ligne de rs-tab.org — 12 septembre 2026

Le fichier `render.yaml` crée uniquement le Static Site de production depuis `main`, avec déploiements manuels (`autoDeployTrigger: off`) pendant le blocage GitHub Actions. Build : `node scripts/render-build.mjs` ; publication : `dist` ; aucune Start Command. Définir `SKIP_INSTALL_DEPS=true` : le script installe lui-même les dépendances de build verrouillées.

Les instructions actuelles pour les trois services, les DNS OVH, Neon, R2 et le premier administrateur sont dans le dépôt backend privé : [guide de déploiement](https://github.com/Sunnoogo77/rocsec-back/blob/main/docs/DEPLOIEMENT.md) et [budget](https://github.com/Sunnoogo77/rocsec-back/blob/main/docs/BUDGET-HEBERGEMENT.md).
