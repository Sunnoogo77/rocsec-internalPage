# Utiliser l’espace interne

Le menu rassemble les contenus, la préparation hebdomadaire, le répertoire et les réglages du compte. Sur téléphone, le bouton de navigation ouvre le même menu. L’en-tête permet de choisir un thème clair, sombre ou adapté au système ; ce choix est conservé uniquement sur l’appareil.

## Personnes et intervenants

Recherchez par nom ou prénom, puis filtrez par rôle et par activité. « Sans rôle attribué » permet de retrouver les fiches à classer. Plusieurs rôles peuvent être affectés à une même personne par un validateur, après vérification de son identité.

Le prédicateur d’un culte doit être une personne active portant le rôle `pasteur` ou `predicateur`. Les rôles structurés de la fiche font référence ; l’ancien rôle principal n’est utilisé que si l’API ne fournit pas ces rôles. La civilité et le prénom ne déterminent jamais l’éligibilité. Les fiches existantes ne sont pas reclassées automatiquement.

La voix principale d’un cantique est choisie parmi ses interprètes individuels. Si la sélection des interprètes change, corrigez également la voix principale. Les sélections utilisent toutes les pages du répertoire et affichent les rôles pour éviter les confusions.

## Témoignages

La boîte de réception sépare les messages reçus, en relecture, publiés et non retenus. Le tri propose les plus anciens d’abord pour traiter les messages en attente. La recherche porte sur les titres et noms éditoriaux enregistrés, comme l’API ; elle ne recherche pas dans les coordonnées privées ni dans le message original.

1. Ouvrir une fiche et lire le message original et ses pièces jointes.
2. Préparer le nom affiché, le texte et la visibilité des images, puis enregistrer. Le message original reste conservé. Le changement de visibilité des images attend l’enregistrement ; l’ajout d’un fichier est une action distincte.
3. Passer le témoignage en relecture. Un autre validateur, distinct de l’auteur et du dernier éditeur, prend la décision.
4. Confirmer la publication, ou renseigner un motif pour ne pas retenir le témoignage en relecture.

La vérification d’identité peut se faire dans une fenêtre sans quitter la fiche. Une fiche publiée est présentée en lecture seule. Les exports sont disponibles aux validateurs ayant une vérification récente ; leur autorisation reste contrôlée par le serveur.

## Enregistrer et valider

Les longs formulaires proposent un bouton d’enregistrement en bas de page. Un message distingue les modifications locales de celles déjà enregistrées. La validation est désactivée pendant des modifications non enregistrées. Les onglets des fiches publiées sont présentés successivement pour permettre de lire toutes les langues.

Une alerte protège les brouillons des éditeurs de contenus lors d’un rechargement ou du suivi d’un lien interne. Elle ne remplace pas l’enregistrement : il n’y a pas de sauvegarde automatique locale et le bouton Précédent du navigateur ne bloque pas toutes les navigations internes.

Les erreurs de chargement proposent une nouvelle tentative. Les erreurs d’enregistrement et de décision restent visibles. Un affichage vide n’est pas utilisé à la place d’une erreur sur les listes principales.

## Vérifications de la refonte

Les tests Playwright utilisent des données fictives et les contrats de l’API existante. Ils couvrent les thèmes, le menu mobile, les fenêtres au clavier, les filtres et la pagination, un répertoire de plus de 100 personnes, les restrictions de sélection, la publication et les erreurs réseau, ainsi que l’ouverture des pages principales. Ils s’exécutent sur Chromium ordinateur et sur une émulation mobile ; une recette sur les appareils réels et avec le backend déployé reste à faire avant la production.

Les permissions et les transitions sont toujours imposées par le backend. Les restrictions de l’interface accompagnent l’utilisateur et ne constituent pas une frontière de sécurité. La refonte ne change ni les contrats API, ni les données, ni les dépendances applicatives.
