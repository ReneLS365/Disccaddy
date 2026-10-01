# Disc Flight Lab 6.1

Modulær videreførelse af `disc-flight-lab-v6.html`. Projektet indeholder hele appen, inklusive det eksisterende katalog, dine indbyggede Discmate-lister og alle tre fysikmotorer.

## Start

Node.js 22.12 eller nyere:

```bash
npm ci
npm run dev
```

Produktionsbygning og lokal afprøvning:

```bash
npm test
npm run build
npm run preview
```

Åbn den adresse, serveren viser. `index.html` skal åbnes via webserver, ikke direkte som `file://`. En færdig `dist/` følger med ZIP-leverancen; denne mappe kan lægges på en statisk HTTPS-server.

Browserkontrol af mobilvisninger, en hel runde, genindlæsning, offline og 2D-fallback:

```bash
npx playwright install chromium
npm run build
npm run test:browser
```

Browserprøven starter selv en lokal previewserver. `TEST_URL` kan pege på en eksisterende server. `CHROME_EXECUTABLE` kan pege på en allerede installeret Chromium-browser.

## Struktur

```text
disc-flight-lab/
├── index.html                    UI-struktur uden inline-appkode eller CSS
├── package.json / package-lock.json
├── vite.config.js
├── capacitor.config.json
├── public/
│   ├── manifest.json
│   ├── sw.js                     Skabelon; byggekommandoen indsætter alle aktiver
│   ├── icons/                    SVG, 192 px, 512 px og maskable PNG
│   └── licenses/                 Bevarede tredjepartslicenser
├── src/
│   ├── main.js                   Start, tema, CSS og offline
│   ├── styles/                   base.css, layout.css, components.css, themes.css
│   ├── physics/
│   │   ├── engines.js            Lazy imports og valg af gemt fysikmodel
│   │   ├── LegacyFlight.js       Oprindelig motor med +3°-kalibrering
│   │   ├── Physics5.js           Oprindelig V5-motor
│   │   ├── Physics6.js           V6-motor; seks ubrugte felter fjernet
│   │   ├── Aero.js               Opslag, geometri og profilvalidering
│   │   ├── FlightJobs.js         Afbrydelse, beregningscache og fallback
│   │   └── flight.worker.js      Modulbaseret baggrundsberegning
│   ├── data/                     Bag, katalog, release, analyse og JSON-data
│   ├── db/                       LocalDB.js og Photos.js
│   ├── 3d/scene.js               Three.js via npm
│   ├── game/Round.js             Scoring, streak og rekordregler
│   ├── ui/                       Appstyring, runde, tema, Canvas og advarsler
│   └── pwa/register.js           Installation og status for offline
├── scripts/build-sw.mjs         Indholdsbaseret cacheversion og aktivliste
├── tests/
│   ├── physics.test.js
│   ├── round.test.js
│   ├── storage.test.js
│   ├── browser.mjs
│   └── fixtures/v6-regression.json
└── dist/                         Færdig webbygning
```

`src/main.js` er indgangspunktet, `src/ui/app.js` forbinder de eksisterende visninger, og `src/physics/engines.js` indlæser kun efterspurgte motorer. Worker-koden bruger de samme ES-moduler. Three.js indlæses sammen med 3D-scenen; ingen base64-kode eller eksternt CDN kræves.

## Runde

Åbn **Analyse**, vælg målzone, og tryk **Start runde**. Tryk **Kast** otte gange. Indstil release i Kast-fanen før næste runde for at forbedre resultatet. De otte kast genbruger `Lab.variations(p, 8)` fra analysen. Det er reproducerbare Halton-scenarier, ikke målte personlige sandsynligheder eller en ny tilfældig stikprøve ved hvert klik.

Målet er første landing inden for den indstillede radius. Afstand måles fra landingen til målzonens centrum i rundens faste sigteretning. En træffer på grænsen tæller med. Streak nulstilles ved et miss og ved start af en ny runde. En beregningsfejl eller afbrydelse forbruger intet kast.

Rekorder rangeres efter flest træffere og derefter mindst gennemsnitlig afstand til centrum over alle otte kast. Kun afsluttede runder kan skabe en rekord. Rekorder gemmes pr. disc og udfordring; målzone, vind, atmosfære, model og releasevariation skal være ens for direkte sammenligning. Ændring af indstillinger afbryder en igangværende runde. Releasevinkel og kraft kan justeres mellem runder.

## Data og flytning

Databasen beholder navnet `disc-flight-lab-v4`, version 3 og lagrene `state`, `images` og `catalog`. Runderekorder ligger i `state.root.rounds`. Backupformatet er fortsat version 6 med det valgfrie `rounds`-felt. Nye backups bevarer rekorder; gamle versioner af appen kan ignorere dette nye felt. Ved konflikt mellem to disc-id'er i en sammenfletning følger rekorden den importerede disc med dens nye id.

På **samme origin** genbruges de eksisterende browserdata. Flytning fra den gamle HTML-fil til et nyt domæne, GitHub Pages eller en native app kræver **Eksportér backup → Importér backup**. Lokale billeder følger backupfilen. Billedadresser kræver stadig internet. Brugerens temavalg gemmes separat i localStorage.

## Offline og opdateringer

`npm run build` laver `dist/sw.js` med en indholdsbaseret cacheversion og en komplet liste over HTML, CSS, JavaScript, worker-moduler, fysikmotorer, katalogdata, ikoner og licenstekster. Første besøg kræver net. Status **Klar offline** betyder, at installationens filer er hentet. Browseren kan stadig slette sin lokale lagring ved rydning af browserdata eller lagerpres.

Opdateringer aktiveres, når gamle appfaner lukkes. Dermed blandes en åben gammel side ikke med nye lazy imports. Cache navngives pr. scope. Native Capacitor bruger de medfølgende filer i `dist/`, og registrerer ikke en service worker.

## Fysik og kontrol

RK45, quaternion-kinematik, kræfter, momenter, luftdensitet og landingsintegration er flyttet uden ændringer. Kun de seks ubrugte V6-felter `CL0`, `CLa`, `CD0`, `CDa`, `CM0`, `CMa` og deres hjælpeopslag er fjernet fra `coefficients()`. Tabelopslagene i `aero()` er bevaret. Legacy beholder `launch + 3 + nose`.

Regressionsgrundlaget blev beregnet fra den urørte v6-kilde før ændringer. Kildens SHA-256 står i fixturefilen. De 24 scenarier sammenligner varighed, afstand, sideafstand, højde, antal punkter og udvalgte fulde tilstandspunkter, herunder quaternioner og aerodata. Flydende værdier sammenlignes med relativ/absolut tolerance `1e-7`.

Fire særskilte vindtests kontrollerer alle kompasretninger og to sigteretninger mod alle motorer og UI'ets vektor. En neutral testprofil uden løft eller pitchmoment isolerer vindens side- og længdevirkning; det undgår at antage, at modvind altid forkorter enhver virkelig discbane. Vindmatematikken er uændret.

## Capacitor og GitHub

Capacitor-afhængigheder og `webDir: "dist"` er på plads. `dk.discflightlab.app` er en foreløbig app-id, som skal erstattes eller bekræftes før første butikspublicering. Der følger ingen signeret APK, AAB eller IPA med.

```bash
npm run build
npx cap add android
npx cap add ios
npm run native:sync
npx cap open android
# På en Mac med Xcode:
npx cap open ios
```

Android SDK/Android Studio og en Mac med Xcode kræves til de respektive native builds. Signering, udviklerkonti, butiksmateriale, licensafklaring og faktisk test på Android/iPhone udestår før butikspublicering. De eksisterende Shotshaper-tabellers GPLv3-tekst og kildehenvisninger er bevaret; refaktoreringen ændrer ikke datakildernes licenser.

ZIP-mappen kan lægges i et GitHub-repository. Der er ikke angivet en repositoryadresse i opgaven, og denne leverance er derfor en lokal projektpakke.

Officiel dokumentation: [Vite build](https://vite.dev/guide/build), [Vite assets](https://vite.dev/guide/assets), [Capacitor installation](https://capacitorjs.com/docs/getting-started).

## Leverancekontrol

37 automatiske tests og browserprøven består. Se `docs/TESTRESULTATER.md` og billederne i `docs/qa/`. `docs/PROMPTLEVERANCE.md` samler den komplette kode for promptens særligt efterspurgte filer.
