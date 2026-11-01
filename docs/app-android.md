# Appli Android « Deep Mine Idle MMO »

Identifiant Google Play : `fr.deepmineidle.app`. **Il est définitif : ne jamais le changer**, ce serait une autre appli.

Pas besoin d'Android Studio : GitHub compile tout (onglet **Actions**, « Appli Android »).

## Comment ça marche

- `mobile/` contient l'appli, avec ses propres dépendances. Le serveur et le VPS ne s'en servent jamais.
- Les fichiers du jeu (`index.html`, `src/`, `textures/`, polices) sont **copiés dans l'appli** à chaque compilation par `mobile/scripts/copy-web.js`. Le site n'est pas modifié : c'est une copie.
- Seuls les appels au serveur passent par le réseau, vers `https://deepmineidle.fr`.
- L'appli tourne sur `https://localhost`, une autre origine que le site. Le cookie de connexion n'y passe pas : le serveur lui donne un **jeton**, rangé dans le stockage de l'appli et envoyé dans l'en-tête `Authorization`. Seules les origines de l'appli reçoivent ce jeton et le CORS (`SERVER.appOrigins`).

> ⚠️ **Le code du jeu est figé dans l'appli.** Une mise en ligne sur `main` change le serveur en 2 minutes, mais pas l'appli des joueurs : elle garde ses fichiers jusqu'à la mise à jour sur Google Play. Un nouvel objet, une nouvelle route ou un équilibrage côté navigateur peuvent donc la casser. Avant de changer ce que le serveur envoie, se demander si l'ancienne appli comprendra encore.

## Tester sur un téléphone (APK)

1. GitHub → **Actions** → **Appli Android** → **Run workflow** → choisir la branche et `apk`.
2. Attendre la fin (croix verte), ouvrir la fabrication, télécharger **deep-mine-idle-apk-test** en bas de la page.
3. Dézipper, envoyer `app-debug.apk` sur le téléphone (câble, Drive, Discord…) et l'ouvrir. Android demande d'autoriser l'installation depuis cette source.

L'APK parle au **vrai serveur** : il ne marche que si le serveur a déjà la partie « jeton et CORS » (donc après la mise en ligne de la branche). Une compilation part aussi toute seule quand `mobile/` change : APK seulement, jamais de clé.

## Envoyer à Google Play (AAB)

1. Monter la version (ci-dessous) et commiter.
2. **Run workflow** → `aab`. Sans les secrets, la compilation s'arrête avec « Secrets manquants ».
3. Télécharger **deep-mine-idle-aab**, dézipper, envoyer `app-release.aab` dans la Play Console.

## Monter la version

Dans `mobile/android/app/build.gradle` :

```
versionCode 1          // +1 à CHAQUE envoi à Google, jamais réutilisé (2, 3, 4…)
versionName "1.0.0"    // ce que voient les joueurs : 1.0.1 pour un correctif, 1.1.0 pour une nouveauté
```

Google refuse un envoi dont le `versionCode` a déjà servi, même après un retrait.

## La clé d'envoi

Avec **Play App Signing**, Google garde la clé de l'appli ; nous n'avons qu'une **clé d'envoi**. Si elle est perdue, Google peut la remplacer sur demande : c'est plus long, pas fatal.

**Le dépôt est public : jamais de clé, de mot de passe ni de fichier `.jks` dans git.** `.gitignore` les bloque ; ranger la clé hors du dépôt quand même.

### Créer la clé (une seule fois)

`keytool` vient avec Java (JDK). Si la commande est inconnue, installer **Temurin 21** (https://adoptium.net), puis rouvrir le terminal. Dans PowerShell :

```
keytool -genkeypair -v -keystore "$env:USERPROFILE\deep-mine-idle-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000 -storetype PKCS12
```

Il demande un mot de passe (au moins 6 caractères, en pratique 20 ou plus), puis un nom : ce que tu saisis n'apparaît pas aux joueurs. Il n'y a qu'un mot de passe : celui du fichier et celui de la clé sont les mêmes.

### Ce qu'il faut sauvegarder

Le fichier `deep-mine-idle-upload.jks` **et** le mot de passe, en **deux copies**, à deux endroits différents, par exemple un gestionnaire de mots de passe et une clé USB rangée. Jamais dans le dépôt, ni dans Discord.

### L'encoder en base64

```
$jks = "$env:USERPROFILE\deep-mine-idle-upload.jks"
[Convert]::ToBase64String([IO.File]::ReadAllBytes($jks)) | Set-Clipboard
```

Le résultat est dans le presse-papiers, à coller dans le premier secret ci-dessous.

### Les secrets GitHub

Dépôt → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** :

| Nom | Contenu |
|---|---|
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | le fichier `.jks` encodé (ci-dessus) |
| `ANDROID_UPLOAD_KEYSTORE_PASSWORD` | le mot de passe |
| `ANDROID_UPLOAD_KEY_ALIAS` | `upload` |
| `ANDROID_UPLOAD_KEY_PASSWORD` | le mot de passe (le même) |

GitHub ne les montre plus jamais une fois enregistrés, et les masque dans les journaux. Sur la Play Console : à la création de l'appli, garder **Play App Signing** activé, et envoyer le premier `.aab` signé avec cette clé.

## Icône et écran de démarrage

Source : `mobile/assets/logo.png` (1024 × 1024, la pioche d'acier du jeu, provisoire tant qu'il n'y a pas de vrai logo). Après l'avoir changée :

```
cd mobile
npm install
npm run assets
```

puis commiter ce qui change dans `mobile/android`.

## Modifier l'appli

- Réglages : `mobile/capacitor.config.json`.
- Code propre au téléphone : `src/app/` (`device.js` : bouton retour, liens, écran « Pas de connexion »).
- Orientation : portrait, `android:screenOrientation` dans `AndroidManifest.xml`. L'interface de l'appli est pensée pour un écran vertical.
- Permissions : `INTERNET` et `POST_NOTIFICATIONS` (notifications de l'appli, `src/app/native.js`, calculées sur le téléphone). Le résumé de chaque compilation les affiche.
- Essai dans un navigateur : `http://localhost:8000/?app` montre l'interface de l'appli, avec le serveur local et le cookie.

## iPhone

Même appli, même serveur, mêmes fichiers du jeu : voir `docs/app-ios.md` (workflow « Appli iPhone », sans Mac). `npm run sync` met à jour Android et iOS ensemble.
