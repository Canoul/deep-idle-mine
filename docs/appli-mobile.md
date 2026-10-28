# Appli mobile — récupérer et tester l'APK Android

Guide de l'équipe pour l'appli de test (étape 1 de l'appli, spec
`docs/superpowers/specs/2026-10-28-appli-mobile-design.md`). L'appli ouvre le vrai jeu (deepmineidle.fr) avec les vrais
comptes : c'est le même jeu que le site, dans une appli.

## Récupérer l'APK

1. Sur GitHub, dépôt `Canoul/deep-idle-mine`, onglet **Actions**, workflow **« Appli Android (APK de test) »**.
2. Ouvrir la dernière fabrication **réussie** (coche verte). Elle se lance toute seule quand le dossier `mobile/` change ;
   bouton **« Run workflow »** pour en lancer une à la main.
3. En bas de la page, **Artifacts** → `deep-mine-idle-apk` : un zip qui contient `app-debug.apk`. Il faut être connecté
   à GitHub pour le télécharger ; il reste disponible 30 jours.

## L'installer sur un téléphone Android

1. Envoyer `app-debug.apk` sur le téléphone (câble, Drive, Discord…).
2. L'ouvrir : Android demande d'autoriser l'installation depuis cette source (« sources inconnues »), accepter.
3. **Mettre à jour** : désinstaller l'ancienne appli **avant** d'installer la nouvelle. Chaque fabrication signe
   l'appli avec une clé de test différente, donc Android refuse la mise à jour par-dessus (« Application non
   installée »). Rien n'est perdu : tout est sur le serveur, il faut juste se reconnecter.

Android 7 ou plus récent. Pas d'iPhone pour l'instant (il faut le compte Apple).

## Ce qu'on doit voir

- L'icône : la pioche en acier sur fond sombre.
- En haut à droite du jeu, un petit badge **provisoire** :
  - **APPLI ✓** (vert) : l'appli est branchée au téléphone. Tout va bien.
  - **APPLI ⚠ pont bloqué** (orange) : l'appli s'ouvre mais ne peut pas parler au téléphone (notifications impossibles).
    Le prévenir tout de suite : c'est une décision d'équipe (sécurité du site), on n'y touche pas seul.
  - pas de badge : ce n'est pas l'appli (ou elle n'a pas reconnu le téléphone) ; le signaler aussi.
- Sans réseau : une page « Pas de connexion au serveur du jeu » avec **Réessayer**. Même page quelques secondes après
  une mise en ligne (le serveur redémarre).

## Liste d'essais (à remonter dans `docs/debug.md`)

1. L'APK s'installe, l'icône pioche apparaît.
2. Le badge dit **APPLI ✓**.
3. Connexion, lancement d'une session, la mine tourne.
4. Fermer l'appli, la rouvrir : toujours connecté.
5. Mode avion puis ouvrir l'appli : page « Pas de connexion » ; réseau revenu, « Réessayer » ramène au jeu.
6. Bouton retour d'Android et lien Wiki : noter ce qui se passe.
7. La barre du haut du jeu n'est pas cachée sous la barre d'état du téléphone (heure, batterie).

Noter aussi le modèle du téléphone et sa version d'Android.

## Pas encore là

L'interface pensée pour le téléphone (5 familles d'onglets, Accueil, session), les notifications, la version iPhone,
les stores. Sur le site, rien ne change : la nouvelle interface sera dans l'appli seulement.

## Pour les développeurs

- Coque : `mobile/` (Capacitor 8, `capacitor.config.json` : `server.url` = deepmineidle.fr, `server.errorPath` =
  `www/offline.html`). Dépendances seulement dans `mobile/package.json` ; le serveur ne sert jamais `mobile/`.
- Après un changement de `capacitor.config.json` ou des plugins : `cd mobile && npm install && npm run sync`.
- Icône : `npm run app:icon` (Python + Pillow, `scripts/gen_app_icon.py`).
- Couche appli dans le jeu : `src/app/` (détection : pont natif ou `?app` dans l'adresse ; sur le site, rien).
  Aperçu dans un navigateur : `http://localhost:8000/?app`.
- Pas besoin d'Android Studio : GitHub fabrique l'APK (`.github/workflows/android-apk.yml`, Java 21, Node 22).
