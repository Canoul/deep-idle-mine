# Appli iPhone « Deep Mine Idle MMO »

Identifiant : `fr.deepmineidle.app`, le même que sur Google Play. **Il est définitif : ne jamais le changer**, ce serait une autre appli.

Pas besoin de Mac : GitHub compile tout sur un de ses Mac (onglet **Actions**, « Appli iPhone »). Projet commencé par Jules (`jules/appli-ios`).

## Comment ça marche

- C'est **la même appli qu'Android** (`docs/app-android.md`) : les fichiers du jeu sont copiés dans l'appli, seuls les appels au serveur passent par le réseau, la connexion se fait par un jeton. Sur iPhone, l'appli tourne sur `capacitor://localhost`, que le serveur accepte (`SERVER.appOrigins`).
- **Mises à jour à chaud** (depuis la 1.1.0), comme sur Android (`docs/app-android.md`, « Mises à jour à chaud ») : une mise en ligne sur `main` arrive dans l'appli sans repasser par Apple. Une nouvelle version sur l'App Store reste nécessaire quand la coque change (plugin, permission, icône…) ; **Apple relit chaque version** (souvent 1 à 2 jours). Sur iPhone, les versions téléchargées sont rangées dans `Library/NoCloud/ionic_built_snapshots/` (imposé par Capacitor).
- **iPhone seulement, écran vertical.** Sur iPad, elle s'ouvre en mode iPhone agrandi.
- **Notifications** : locales, programmées par le téléphone (`src/app/native.js`). Aucune configuration Apple : la case Push Notifications cochée sur l'App ID ne gêne pas, l'appli ne s'en sert pas.

## La signature : la clé d'API, et rien d'autre

Pas de certificat, pas de profil, pas d'identifiant Apple, pas de double authentification : `xcodebuild` s'authentifie avec la clé, et Apple signe dans son cloud. **Il faut le rôle Admin** : c'est lui qui donne accès au certificat géré par Apple.

**Le dépôt est public : jamais de clé, de certificat ni de profil dans git.** `.gitignore` les bloque ; range le `.p8` hors du dépôt quand même.

### Créer la clé (une seule fois)

1. https://appstoreconnect.apple.com → **Users and Access** (Utilisateurs et accès) → **Integrations** → **App Store Connect API**.
2. La première fois, cliquer sur **Request Access**.
3. **Team Keys** → **+** → nom `GitHub`, accès **Admin** → **Generate**.
4. Noter l'**Issuer ID** (en haut de la page) et le **Key ID** (sur la ligne de la clé).
5. **Download** : le fichier `AuthKey_….p8` **ne se télécharge qu'une seule fois**. Garde-le en deux copies, à deux endroits, jamais dans le dépôt ni dans Discord.

Clé perdue : pas grave. Révoque-la sur cette même page, recrée-en une et remplace les secrets. L'appli publiée n'est pas touchée.

### L'identifiant d'équipe

https://developer.apple.com/account → **Membership details** → **Team ID** (10 caractères).

### Les secrets GitHub

Dépôt → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :

| Nom | Contenu |
|---|---|
| `ASC_KEY_ID` | le Key ID |
| `ASC_ISSUER_ID` | l'Issuer ID |
| `ASC_KEY_P8` | tout le contenu du fichier `.p8` (l'ouvrir avec le Bloc-notes, lignes BEGIN et END comprises) |
| `IOS_TEAM_ID` | le Team ID |

GitHub ne les montre plus jamais et les masque dans les journaux. Pendant la fabrication, la clé est dans un fichier temporaire, effacé à la fin.

## Lancer une fabrication

GitHub → **Actions** → **Appli iPhone** → **Run workflow** → choisir la branche et :

| Choix | Ce que ça fait | Clé |
|---|---|---|
| `controle` | compile, vérifie, ouvre l'appli dans un simulateur d'iPhone | non |
| `ipa` | signe et garde l'IPA (artefact `deep-mine-idle-ipa`), sans rien envoyer | oui |
| `testflight` | pareil, puis l'envoie sur App Store Connect | oui |

Le bouton **Run workflow** n'apparaît que si le workflow est sur `main`. Un `controle` part aussi tout seul quand `mobile/` change, sur n'importe quelle branche, sans clé. Sa capture d'écran est dans l'artefact `deep-mine-idle-simulateur`.

## Voir la version dans TestFlight

Après une fabrication `testflight` verte, Apple traite la version en 5 à 30 minutes, et envoie un mail s'il y a un problème.

App Store Connect → **Apps** → **Deep Mine Idle MMO** → onglet **TestFlight** : la version y apparaît avec son numéro de build.

## Ajouter des testeurs

Sur l'iPhone, il faut l'appli **TestFlight** (gratuite, sur l'App Store). Ouvrir l'invitation reçue, puis **Installer**. Les versions suivantes arrivent dans TestFlight, sans désinstaller. Une version reste 90 jours.

- **Testeurs internes** (l'équipe, 100 au plus, pas de relecture d'Apple) : **Users and Access** → **+** : inviter la personne (rôle **Developer** suffit). Puis l'appli → **TestFlight** → **Internal Testing** → **+** → groupe `Équipe`, ajouter les membres, cocher la distribution automatique.
- **Testeurs externes** (amis, joueurs, 10 000 au plus) : **TestFlight** → **External Testing** → **+** → créer un groupe, ajouter la version, puis des adresses mail ou un **lien public**. La première version passe une relecture d'Apple, souvent en moins d'un jour. Il faut remplir **Test Information** : description, mail de contact et un compte de démo.

## Monter la version

- Ce que voient les joueurs : `MARKETING_VERSION` dans `mobile/ios/App/App.xcodeproj/project.pbxproj` (2 lignes, la même valeur). Garder la même que le `versionName` d'Android (`tests/mobile-config.test.js` le vérifie), au moins `APP_UPDATE.minNative`.
- Le numéro de build est **automatique** : numéro de la fabrication × 100 + numéro de l'essai. Il ne sert jamais deux fois, même en relançant.

## Modifier l'appli

- Réglages communs : `mobile/capacitor.config.json`. Propres à iOS : `mobile/ios/App/App/Info.plist`.
- Manifeste de confidentialité : `mobile/ios/App/App/PrivacyInfo.xcprivacy`. À tenir à jour si l'appli collecte autre chose ; il doit dire la même chose que `legal/confidentialite.md` et que la page « App Privacy » d'App Store Connect.
- Nouveau plugin : `cd mobile && npm install && npm run sync`, puis commiter `mobile/ios/App/CapApp-SPM/Package.swift` (`tests/mobile-config.test.js` le vérifie).
- Icône et écran de démarrage : `npm run app:icon` puis `cd mobile && npm run assets` (Android et iOS, depuis `mobile/assets/logo.png` ; voir `docs/app-android.md`).
- Rebond et zoom : `MainViewController` dans `SceneDelegate.swift`. Clavier : `plugins.Keyboard` dans `capacitor.config.json`.

## Liste d'essais sur un vrai iPhone

1. Installation par TestFlight : icône lampe de mine (pioche jusqu'au 02/11), écran de démarrage sombre.
2. Connexion avec un compte existant ; fermer l'appli et la rouvrir : toujours connecté.
3. Lancer une session : la mine tourne.
4. L'encoche ne cache pas la barre du haut ; la barre des 5 boutons est au-dessus du trait du bas ; l'heure et la batterie sont lisibles.
5. Chat : toucher le champ, le clavier ne le cache pas ; pas de zoom.
6. Lien Wiki : il s'ouvre dans Safari.
7. Pas de rebond en haut et en bas de page ; pas de zoom au pincement ; les pages longues défilent.
8. Notifications : accepter la demande, lancer une session, fermer l'appli, attendre la fin.
9. Mode avion : écran « Pas de connexion, nouvelle tentative… » ; réseau revenu, le jeu reprend.

## Avant l'App Store

Captures iPhone 6,9 pouces, page « App Privacy » d'App Store Connect (à remplir d'après `PrivacyInfo.xcprivacy`), compte de démo pour la relecture d'Apple. Une appli qui n'est qu'un site emballé est refusée (règle 4.2) : les notifications et le jeu dans l'appli aident à passer.
