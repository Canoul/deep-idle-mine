# Mises à jour à chaud des applis mobiles — conception

*Discussion de Geoffrey avec Claude (claude.ai), 01/11/2026. Rien n'est codé. Les choix marqués « (Claude) » sont des
choix techniques à contester si besoin. Rien ici ne change les règles du jeu.*

## En une phrase

L'appli (iPhone et Android) garde une copie du jeu pour démarrer, mais **à chaque lancement elle récupère la dernière
version du jeu publiée par le serveur** : une mise en ligne sur `main` arrive dans l'appli comme sur le site, sans
repasser par l'App Store ni Google Play.

## Pourquoi

- Depuis le 01/11, les fichiers du jeu sont **copiés dans l'appli** à la fabrication (`mobile/scripts/copy-web.js`,
  `docs/app-android.md`, `docs/app-ios.md`) : l'appli installée garde le code du jour de sa fabrication.
- L'équipe met en ligne **environ 50 commits par jour**. Le serveur et le jeu sont dans le même dépôt et changent
  ensemble : entre deux versions d'appli, le serveur change des dizaines de fois et l'appli installée se casse
  (données qu'elle ne comprend pas, routes changées, objets inconnus).
- Une version d'appli par semaine ou par quinzaine (relecture Apple ≈ 1 jour, Google de quelques heures à quelques jours)
  ne suit pas ce rythme.

## Ce que permettent les stores

- **Apple** : une appli peut télécharger du code interprété (HTML / JavaScript) **s'il tourne dans WebKit** (c'est le
  cas : Capacitor), **sans changer le but principal de l'appli**, sans ajouter de boutique ni contourner la relecture
  pour une nouvelle fonction majeure. Nouveaux objets, modes, équilibrage, corrections : oui.
- **Google Play** : même cadre (code exécuté dans la WebView, pas de code natif téléchargé, pas de changement de nature).
- Une **nouvelle version sur les stores reste obligatoire** quand la partie native change : permissions, plugins
  Capacitor, notifications, version de Capacitor, icône, et tout ce qui touche à l'argent (boutique : achats intégrés
  obligatoires, relus).

## Comment ça marche (proposition)

1. **Le serveur publie un « paquet du jeu »** à chaque mise en ligne : les fichiers que l'appli embarque aujourd'hui
   (ceux de `copyWeb()` : `src/` sans le wiki, `textures/`, polices, `index.html` réécrit par `appIndex()`,
   `app-config.js`), avec un **manifeste** : numéro de version (le commit), liste des fichiers et leur empreinte
   (SHA-256), version minimale de la coque native requise. Fabriqué au démarrage du serveur ou par le déploiement,
   **servi par deepmineidle.fr** (pas de service tiers, pas d'abonnement) (Claude).
2. **Au lancement, l'appli** demande le manifeste. Si la version est plus récente que la sienne et compatible avec sa
   coque native, elle télécharge les fichiers qui ont changé, **vérifie chaque empreinte**, range le paquet complet à
   côté de l'ancien, puis l'utilise (au lancement suivant, ou tout de suite avant l'écran de connexion : à décider).
3. **Retour en arrière automatique** : si le nouveau paquet ne démarre pas (le jeu ne signale pas « prêt » en N
   secondes, erreur au démarrage), l'appli revient au paquet précédent, puis à celui embarqué, et le signale au serveur.
4. **Hors connexion ou serveur injoignable** : l'appli démarre avec le dernier paquet valide, comme aujourd'hui.
5. **Version minimale de la coque** : le serveur connaît la version native minimale ; une appli trop ancienne affiche
   « Mets à jour l'appli sur le Store » (lien vers la fiche) au lieu de se casser.
6. **Le site ne change pas.**

Outil : plugin maison léger, ou plugin open source auto-hébergé (par exemple `@capgo/capacitor-updater` en mode
auto-hébergé), à comparer (Claude). Critères : aucun service payant obligatoire, fonctionne sur iOS et Android,
vérification d'empreinte, retour en arrière, licence compatible avec un dépôt public.

## Sécurité

- Le paquet n'est téléchargé que depuis `https://deepmineidle.fr` (adresse codée dans la coque, jamais lue d'un
  message du serveur).
- Empreintes vérifiées avant usage ; un paquet incomplet ou modifié n'est jamais utilisé.
- Envisager une **signature du manifeste** (clé privée dans les secrets du serveur, clé publique dans la coque) pour
  qu'un serveur compromis ou un intermédiaire ne puisse pas pousser du code (Claude, à trancher selon le coût).
- Rien de secret dans le paquet (le dépôt est public de toute façon).

## Décisions à prendre (équipe)

1. **Chaque mise en ligne part dans l'appli**, ou seulement certaines (un « canal » mis à jour à la main, par exemple
   une fois par jour) ? Recommandation (Claude) : chaque mise en ligne, puisque le serveur change aussi à chaque fois ;
   le retour en arrière limite le risque.
2. **Quand appliquer** une nouvelle version : au lancement suivant (simple, jamais d'interruption) ou tout de suite au
   démarrage avant la connexion (le joueur a toujours la dernière version). Pendant une session : jamais.
3. **Mises à jour des testeurs** (TestFlight, test fermé Google) : même canal que les joueurs, ou un canal à part ?

## Quand

Avant d'ouvrir l'appli aux joueurs (lien TestFlight public, test fermé Google à 12 testeurs pendant 14 jours) :
sinon les testeurs auront une appli qui se casse au fil des commits. Les versions 1.0.0 déjà envoyées n'ont pas ce
système : elles devront être remplacées par une version qui l'embarque.

## Liens

- `docs/superpowers/specs/2026-10-28-appli-mobile-design.md` (conception de l'appli ; son objectif « une mise en ligne
  arrive dans l'appli sans les stores » revient avec ce document).
- `docs/app-android.md`, `docs/app-ios.md` (fabrication, signature, workflows).
- Suivi des stores côté équipe : document `claude/publication-stores.md` du projet claude.ai « Idle DollexMiner ».
