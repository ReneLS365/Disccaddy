# Verifikation · 22. september 2026

- `npm test`: **37 bestået, 0 fejlet**.
- 24 regressioner mod original v6, fire separate kompasretninger, udfasede felter og legacy-kalibrering.
- Rundescoring, streak, rekordsortering, importkonflikter og eksisterende IndexedDB-data.
- `npm run build`: bestået. 18 aktiver i offlinecachen, inklusive endnu ikke anvendte lazy motorer.
- Browser: Chromium, mobile skærmstørrelser og software-WebGL. Ingen JavaScript-sidefejl.
- Ingen test på fysisk Android/iPhone eller signeret native build i denne leverance.

- Opstart, 3D, systemtema og synlige diagnostikadvarsler.
- 8/8 ramt, 8 i træk og rekord gemt.
- Tema og rekord bevaret efter genindlæsning; ændringer afbryder runden.
- Offline genindlæsning og første skift til Legacy/V5 med cached worker-moduler.
- Ingen vandret overflow ved 320, 390, 768 og 1280 px.
- 2D-fallback fungerer uden WebGL.
- GPL-licensteksten åbner som tekst fra offlinecachen.

Vite rapporterer to JavaScript-bundter over 500 kB før gzip: katalog/UI og Three.js. Three.js indlæses asynkront. Browserloggen indeholder kun softwaregrafikkens ReadPixels-ydelsesbeskeder i den normale 3D-session. WebGL-fejlen i den særskilte fallbackprøve er tilsigtet.

Billeder i `qa/` viser lyst tema, mørkt tema, 3D og 2D.
