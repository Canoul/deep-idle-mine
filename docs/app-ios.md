# Appli iPhone et iPad « Deep Mine Idle MMO »

Identifiant : `fr.deepmineidle.app`, le même que sur Google Play. **Il est définitif : ne jamais le changer**, ce serait une
autre appli.

Pas besoin de Mac : GitHub compile tout sur un de ses Mac (onglet **Actions**, « Appli iPhone et iPad »).

## Comment ça marche

- C'est **la même appli qu'Android** (`docs/app-android.md`) : les fichiers du jeu sont copiés dans l'appli, seuls les
  appels au serveur passent par le réseau, la connexion se fait par un jeton. Sur iPhone, l'appli tourne sur
  `capacitor://localhost`, que le serveur accepte déjà (`SERVER.appOrigins`).
- ⚠️ **Le code du jeu est figé dans l'appli**, comme sur Android : une mise en ligne sur `main` ne change pas l'appli des
  joueurs. En plus, **Apple relit chaque mise à jour** de l'App Store (souvent 1 à 2 jours).
- **iPhone : écran vertical seulement.** **iPad : toutes les orientations**, parce qu'Apple l'exige maintenant pour l'iPad.
  L'interface de l'appli est pensée pour un téléphone vertical : elle est à vérifier sur un iPad.

## Tester sur un iPhone ou un iPad (TestFlight)

Une fois la signature en place (plus bas) :

1. GitHub → **Actions** → **Appli iPhone et iPad** → **Run workflow** → choisir la branche et `testflight`.
2. Attendre la coche verte. Apple traite ensuite la version (5 à 30 min) avant qu'elle apparaisse dans TestFlight.
3. Sur l'iPhone ou l'iPad : installer l'appli **TestFlight** depuis l'App Store, ouvrir l'invitation reçue par mail, puis
   **Installer**. Les versions suivantes s'installent depuis TestFlight, sans désinstaller. Une version reste 90 jours.

- **Testeurs internes** : les membres de l'équipe App Store Connect (100 au plus). Pas de relecture d'Apple.
- **Amis (testeurs externes)** : un lien public, jusqu'à 10 000 personnes. La première version passe une relecture
  rapide d'Apple (souvent moins d'un jour). Il faut remplir la page « Test Information » de TestFlight : description, mail
  de contact, et un compte de démo.

Une fabrication de **contrôle** part toute seule quand `mobile/` change : elle vérifie que l'appli compile, sans clé.
Son IPA **non signée** (`deep-mine-idle-ipa-non-signee`) peut servir de plan de secours sans compte Apple :
**Sideloadly** l'installe depuis un PC Windows avec un Apple ID gratuit (à réinstaller tous les 7 jours, pas de push).

## Monter la version

- Ce que voient les joueurs : `MARKETING_VERSION` dans `mobile/ios/App/App.xcodeproj/project.pbxproj` (2 lignes, la
  même valeur). Garder la même que le `versionName` d'Android (`1.0.0`, puis `1.0.1`, `1.1.0`…).
- Le numéro de build est **automatique** (numéro de la fabrication GitHub) : rien à faire. Apple refuse deux envois avec
  le même numéro, ça ne peut pas arriver.

## La signature (une seule fois)

Sur **developer.apple.com**, **appstoreconnect.apple.com** et GitHub, environ 20 minutes. À faire par le titulaire du
compte Apple (Geoffrey), ou par un membre qu'il a nommé **Admin**. Les commandes se tapent dans **Git Bash**, à la racine
du dépôt.

**Le dépôt est public : jamais de clé, de certificat, de profil ni de mot de passe dans git.** `.gitignore` les bloque ; le
script range tout hors du dépôt, dans `~/deep-mine-idle-ios`.

### 1. L'identifiant de l'appli

developer.apple.com → **Account** → **Certificates, Identifiers & Profiles** → **Identifiers** → **+** → **App IDs** →
**App** → Description `Deep Mine Idle`, Bundle ID **Explicit** `fr.deepmineidle.app` → aucune case à cocher pour
l'instant (les notifications push viendront plus tard) → **Register**.

### 2. Le certificat de distribution

1. `bash mobile/scripts/ios-signature.sh demande` : écrit la clé privée et `~/deep-mine-idle-ios/demande.certSigningRequest`.
2. **Certificates** → **+** → **Apple Distribution** → **Continue** → envoyer `demande.certSigningRequest` →
   **Download**, et l'enregistrer sous `~/deep-mine-idle-ios/distribution.cer`.
3. `bash mobile/scripts/ios-signature.sh p12` : demande un mot de passe (12 caractères ou plus) et écrit
   `distribution.p12` (certificat + clé, ce que GitHub utilise).

Le certificat dure **1 an**. Apple n'en permet que quelques-uns : n'en refaire un que s'il expire ou s'il est perdu.

### 3. Le profil

**Profiles** → **+** → **App Store Connect** (Distribution) → App ID `fr.deepmineidle.app` → le certificat de l'étape 2 →
nom **`Deep Mine Idle App Store`** (lettres, chiffres et espaces seulement) → **Generate** → **Download**, dans
`~/deep-mine-idle-ios/`. Il expire avec le certificat : le refaire en même temps.

### 4. La fiche de l'appli

appstoreconnect.apple.com → **Apps** → **+** → **New App** : plateforme **iOS**, nom `Deep Mine Idle MMO` (il doit être
libre sur l'App Store), langue principale **French**, Bundle ID `fr.deepmineidle.app`, SKU `deepmineidle`. Sans cette
fiche, GitHub ne peut rien envoyer.

### 5. La clé d'envoi

App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** (la première fois, le titulaire
clique sur **Request Access**) → **Team Keys** → **+** → nom `GitHub`, accès **App Manager** → **Generate**. Noter
l'**Issuer ID** (en haut de la page) et le **Key ID**, puis **Download** : le fichier `AuthKey_….p8` ne se télécharge
**qu'une fois**.

### 6. Les secrets GitHub

Dépôt → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :

| Nom | Contenu |
|---|---|
| `IOS_DIST_CERT_P12_BASE64` | `bash mobile/scripts/ios-signature.sh base64 ~/deep-mine-idle-ios/distribution.p12`, puis coller |
| `IOS_DIST_CERT_PASSWORD` | le mot de passe choisi à l'étape 2 |
| `IOS_PROFILE_BASE64` | `bash mobile/scripts/ios-signature.sh base64 ~/deep-mine-idle-ios/<le profil>.mobileprovision`, puis coller |
| `ASC_KEY_ID` | le Key ID |
| `ASC_ISSUER_ID` | l'Issuer ID |
| `ASC_KEY_P8` | tout le contenu du fichier `AuthKey_….p8` (l'ouvrir avec le Bloc-notes, lignes BEGIN et END comprises) |

GitHub ne les montre plus jamais et les masque dans les journaux. Pendant la fabrication, ils vont dans un trousseau
jetable, effacé à la fin.

### 7. Les testeurs

App Store Connect → **Users and Access** → **+** : inviter chaque membre de l'équipe (rôle **Developer** suffit). Puis
l'appli → **TestFlight** → **Internal Testing** → **+** → groupe `Équipe` → ajouter les membres, cocher la distribution
automatique : chaque nouvelle version leur arrive toute seule.

### Ce qu'il faut sauvegarder

Le dossier `~/deep-mine-idle-ios` (clé privée, `distribution.p12` et son mot de passe, `AuthKey_….p8`), en deux copies, à
deux endroits différents (gestionnaire de mots de passe, clé USB rangée). Jamais dans le dépôt ni dans Discord.
S'ils sont perdus, ce n'est pas grave chez Apple : on révoque l'ancien certificat, on en refait un (étapes 2, 3 et 6),
et l'appli publiée n'est pas touchée.

## Liste d'essais sur un vrai appareil (à remonter dans `docs/debug.md`)

1. Installation par TestFlight : icône pioche, écran de démarrage sombre.
2. Connexion avec un compte existant ; fermer l'appli (balayer vers le haut) et la rouvrir : toujours connecté.
3. Lancer une session : la mine tourne.
4. L'encoche ou la « Dynamic Island » ne cache pas la barre du haut ; la barre des 5 boutons est au-dessus du trait du
   bas ; l'heure et la batterie sont lisibles.
5. Lien Wiki : il s'ouvre dans Safari.
6. Mode avion : écran « Pas de connexion, nouvelle tentative… » ; réseau revenu, le jeu reprend.
7. iPhone : tourner le téléphone, l'appli reste verticale. **iPad** : tourner dans tous les sens, noter ce qui est
   illisible ou cassé (capture d'écran).

Noter le modèle et la version d'iOS ou d'iPadOS (Réglages → Général → Informations).

## Avant l'App Store

Captures iPhone 6,9 pouces **et iPad 13 pouces** (`docs/fiches-stores.md`), politique de confidentialité et conditions
(pages légales), suppression du compte dans le jeu, compte de démo pour la relecture d'Apple, et la page « App Privacy »
d'App Store Connect.

## Modifier l'appli

- Réglages communs : `mobile/capacitor.config.json`. Propres à iOS : `mobile/ios/App/App/Info.plist` (nom affiché,
  orientations, chiffrement déclaré, interface sombre pour que l'heure et la batterie restent lisibles).
- Nouveau plugin : `cd mobile && npm install && npm run sync`, puis commiter `mobile/ios/App/CapApp-SPM/Package.swift`
  (tests/mobile-config.test.js le vérifie).
- Icône et écran de démarrage : `npm run assets` (Android et iOS, voir `docs/app-android.md`).
- Le projet `mobile/ios` a été créé sous Windows par `npx cap add ios` (Capacitor 8, Swift Package Manager, pas de
  CocoaPods). Fabrication : `.github/workflows/ios.yml` (Mac `macos-26`, Xcode 26).
