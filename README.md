# Digital Identity In QR System — Demo App

A minimal, working 3-function version of the project, built with React Native (Expo).
No Android Studio required — everything below works from VS Code + a terminal.

## What it does

1. **Create Digital Identity** — enter Name, Registration No., Course → generates a unique ID
2. **Generate QR Code** — instantly shows a QR code encoding that identity
3. **Scan & Verify** — opens the camera, scans a QR code, decodes it, and displays the verified identity

## Prerequisites (one-time setup)

1. Install **Node.js** (LTS version): https://nodejs.org — this also installs `npm`.
2. Install the **Expo Go** app on your Android phone from the Play Store (free). This lets you run the app live on your phone in seconds, without building an APK, while you're developing/rehearsing.
3. Make sure your phone and laptop are on the **same Wi-Fi network**.

## Step 1 — Open the project in VS Code

1. Unzip the project folder you received.
2. Open the folder in VS Code (`File > Open Folder`).
3. Open a terminal inside VS Code (`` Ctrl + ` ``).

## Step 2 — Install dependencies

```bash
npm install
```

This only needs to be done once (or after any dependency changes).

## Step 3 — Run it live on your phone (fastest way to test/demo)

```bash
npx expo start
```

- A QR code will appear in the terminal (and in a browser tab).
- Open the **Expo Go** app on your phone and scan that QR code.
- The app loads live on your phone — no APK needed for this step.
- Every time you save a code change, the app on your phone updates automatically.

This is the best way to **rehearse your presentation** — instant reload, no build wait.

## Step 4 — Build an actual installable APK (no Android Studio needed)

This uses Expo's free cloud build service (EAS), so the APK is built on Expo's servers, not your laptop.

```bash
npm install -g eas-cli
eas login          # create a free account at expo.dev if you don't have one
eas build -p android --profile preview
```

- This takes roughly 10–15 minutes (cloud build).
- When it finishes, the terminal gives you a **download link** for the `.apk` file.
- Download it, transfer it to your phone (or scan the QR code EAS also gives you), and install it directly.
- You may need to enable **"Install unknown apps"** for your file manager/browser in your phone's settings the first time.

Once installed, it runs fully offline/locally on your phone — perfect for a presentation where you don't want to depend on Wi-Fi or a live dev server.

## Demo tips

- To demo the full loop with **one phone**: create an identity and show the QR on screen, then use a **second phone** (or laptop screen) to scan it in the Scan tab.
- To demo with **two phones**: install the APK on both — one shows the QR, the other scans it. This looks the most impressive live.
- The generated identity is saved locally (`AsyncStorage`), so it survives an app restart — you don't have to re-type the form every time you reopen the app.

## Tests

```bash
npm test
```

Runs the identity-payload validation tests with Node's built-in test runner (Node 18+). No extra packages are needed.

## Security notes and limitations

The Scan tab runs **format validation only** (`validateIdentity.js`): valid JSON, exactly the expected fields, an ID matching `DID-<code>-<4 digits>`, and a real, non-future ISO date. A QR that passes is *well-formed*, not *authentic*.

Known limitations of this demo:

- **No issuer authentication.** Anyone can generate a QR that passes the format check. Real verification needs a trusted issuer: signed payloads checked against the issuer's public key, or a backend that confirms the ID is registered, active and not revoked.
- **Personal data is embedded in the QR.** Name, registration number and course are readable by any QR scanner and can be copied or photographed. A safer design puts only an opaque ID or token in the QR and looks the details up server-side after authorization.
- **No replay protection or revocation.** A copied QR works indefinitely.
- **Data is stored unencrypted on the device** (AsyncStorage).

## Project structure

```
DigitalIdentityQR/
├── App.js          # All 3 functions live here (single file, easy to read/present)
├── validateIdentity.js  # Pure QR payload validation (format checks only)
├── identity.test.js     # Tests for the validator (npm test)
├── app.json        # Expo app config (name, icon, camera permission)
├── eas.json        # Cloud APK build config
├── package.json    # Dependencies
└── babel.config.js
```

## If something goes wrong

- **"Command not found: npx"** → Node.js isn't installed correctly; reinstall from nodejs.org and restart your terminal.
- **QR scan doesn't trigger anything** → make sure you granted camera permission when prompted.
- **Expo Go shows a blank/error screen** → stop the server (`Ctrl+C`) and run `npx expo start -c` to clear the cache.
