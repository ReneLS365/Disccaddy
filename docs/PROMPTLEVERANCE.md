# Promptleverance · Disc Flight Lab 6.1

Mappestruktur og startvejledning står i `README.md`. Den komplette app følger med. Her er de specifikt efterspurgte filer i fuld længde.

## index.html

```html
<!doctype html>

<html lang="da">
  <head>
    <meta charset="utf-8" />
    <meta
      content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
      name="viewport"
    />
    <meta content="#0b1c21" name="theme-color" />
    <title>Disc Flight Lab V6.1 · 6-DOF · åbne aerodata</title>

    <link rel="manifest" href="./manifest.json" />
    <link rel="icon" href="./icons/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./icons/icon-192.png" />
    <script type="module" src="/src/main.js"></script>
  </head>
  <body data-app-version="3.0">
    <header class="app-header">
      <a aria-label="Disc Flight Lab, simulator" class="brand" href="#simulator"
        ><span aria-hidden="true" class="brand-mark">◉</span
        ><span>Disc <b>Flight Lab</b><small>V6.1 · MOBIL</small></span></a
      >
      <span class="save-status" id="saveStatus" role="status"
        >Gemmes lokalt</span
      >
    </header>
    <div id="computation" class="computation" hidden role="status">
      <div>
        <span id="computationText">Beregner…</span
        ><progress id="computationProgress" max="1" value="0"></progress>
      </div>
      <button id="cancelComputation">Stop</button>
    </div>
    <main>
      <section
        aria-label="Kastsimulator"
        class="view simulator"
        data-pane="throw"
        id="simulatorView"
      >
        <div aria-label="Simulatorens visninger" class="sim-tabs" role="group">
          <button
            aria-controls="discPane"
            aria-pressed="false"
            class="panel-tab"
            data-panel="disc"
          >
            Disc</button
          ><button
            aria-controls="throwPane"
            aria-pressed="true"
            class="panel-tab active"
            data-panel="throw"
          >
            Kast</button
          ><button
            aria-controls="windPane"
            aria-pressed="false"
            class="panel-tab"
            data-panel="wind"
          >
            Vind</button
          ><button
            aria-controls="analysisPane"
            aria-pressed="false"
            class="panel-tab"
            data-panel="analysis"
          >
            Analyse</button
          ><button
            aria-controls="flightPanel"
            aria-pressed="false"
            class="panel-tab flight-tab"
            data-panel="flight"
          >
            Bane
          </button>
        </div>
        <div class="sim-layout">
          <aside aria-label="Kastindstillinger" class="setup" id="setup">
            <div class="setup-scroll" id="setupScroll">
              <section class="control-section" hidden="" id="discPane">
                <div class="disc-pager">
                  <button
                    aria-label="Forrige disc"
                    class="icon-button"
                    id="previousDisc"
                  >
                    ‹</button
                  ><button class="selected-disc" id="chooseDisc">
                    <strong id="selectedDiscName">Distance driver</strong
                    ><span id="selectedDiscNumbers">12 / 5 / −1 / 3</span
                    ><small id="discPagerInfo">Vælg fra bag</small></button
                  ><button
                    aria-label="Næste disc"
                    class="icon-button"
                    id="nextDisc"
                  >
                    ›
                  </button>
                </div>
                <div class="section-head">
                  <h2>Disc til kastet</h2>
                  <button class="text-button" id="openBag">Min bag →</button>
                </div>
                <label class="sr-only" for="discSelect" hidden=""
                  >Disc fra din bag eller et eksempel</label
                ><select hidden="" id="discSelect"></select>
                <p class="hint" id="discInfo"></p>
                <div class="numbers">
                  <label
                    >Speed<input
                      id="speed"
                      inputmode="decimal"
                      max="15"
                      min="1"
                      step="0.5"
                      type="number"
                      value="12"
                  /></label>
                  <label
                    >Glide<input
                      id="glide"
                      inputmode="decimal"
                      max="7"
                      min="0"
                      step="0.5"
                      type="number"
                      value="5"
                  /></label>
                  <label
                    >Turn<input
                      id="turn"
                      max="2"
                      min="-5"
                      step="0.5"
                      type="number"
                      value="-1"
                  /></label>
                  <label
                    >Fade<input
                      id="fade"
                      inputmode="decimal"
                      max="6"
                      min="-2"
                      step="0.5"
                      type="number"
                      value="3"
                  /></label>
                </div>
                <button class="text-button small" id="saveCurrentDisc">
                  Gem denne opsætning i bag
                </button>
                <button class="primary wide" id="addFromSimulator">
                  ＋ Find og tilføj en disc
                </button>
              </section>
              <section class="control-section" id="throwPane">
                <button
                  class="release-disc"
                  data-open-panel="disc"
                  id="releaseDisc"
                >
                  <span>VALGT DISC</span
                  ><strong id="releaseDiscName">Distance driver</strong
                  ><small>Skift ›</small>
                </button>
                <div class="section-head">
                  <h2>Dit kast</h2>
                  <span class="micro" id="cruise"></span>
                </div>
                <label class="sr-only" for="style">Kastemetode</label>
                <select id="style">
                  <option value="BH">Baghånd</option>
                  <option value="FH">Forhånd</option>
                </select>
                <p class="hint" id="handHint"></p>
                <div class="slider-head">
                  <label for="powerPct">Kraft</label
                  ><output for="powerPct" id="powerOut"></output>
                </div>
                <input
                  id="powerPct"
                  max="100"
                  min="10"
                  step="any"
                  type="range"
                  value="100"
                />
                <div class="ends">
                  <span>10 %</span><span>100 % af dit maksimum</span>
                </div>
                <div
                  aria-label="Hurtige udgangsvinkler"
                  class="chips"
                  id="anglePresets"
                >
                  <button class="active" data-angle="0">Fladt</button
                  ><button data-angle="25">Hyzer</button
                  ><button data-angle="20">Hyzerflip</button
                  ><button data-angle="-20">Anhyzer</button>
                </div>
                <div class="slider-head">
                  <label for="hyzer">Hyzer / anhyzer</label
                  ><output for="hyzer" id="hyzerOut"></output>
                </div>
                <input
                  id="hyzer"
                  max="80"
                  min="-80"
                  step="1"
                  type="range"
                  value="0"
                />
                <div class="ends">
                  <span>−80° anhyzer</span><span>+80° hyzer</span>
                </div>
                <div class="slider-head">
                  <label for="nose">Nose angle</label
                  ><output for="nose" id="noseOut"></output>
                </div>
                <input
                  id="nose"
                  max="15"
                  min="-15"
                  step="1"
                  type="range"
                  value="0"
                />
                <div class="ends">
                  <span>−15° ned</span><span>+15° op</span>
                </div>
                <details class="physics-settings" open>
                  <summary>Fysik &amp; releasekvalitet</summary>
                  <label
                    >Fysikmodel<select id="physicsModel">
                      <option value="sixdof">
                        V6 · koefficienttabeller · 6-DOF
                      </option>
                      <option value="sixdof-v5">V5 · tidligere 6-DOF</option>
                      <option value="legacy">V4 · tidligere model</option>
                    </select></label
                  >
                  <p id="physicsHint" class="hint"></p>
                  <label
                    >Aerodynamisk grundlag<select id="aeroPreset">
                      <option value="auto">
                        Automatisk · tilgængelige data
                      </option>
                      <option value="ss-cd1">Firebird · CFD-reference</option>
                      <option value="ss-cd5">Roadrunner · CFD-reference</option>
                      <option value="ss-dd2">Wraith · CFD-reference</option>
                      <option value="ss-fd2">TeeBird · delvis CFD</option>
                      <option value="genericPutter">Putter · estimat</option>
                      <option value="genericMid">Midrange · estimat</option>
                      <option value="genericDriver">Driver · estimat</option>
                      <option value="hummel">Hummel · referencefrisbee</option>
                      <option value="customTable">
                        Importeret koefficienttabel
                      </option>
                      <option value="ratings">V5 · flighttal</option>
                      <option value="documentMid">
                        V5 · dokument putter/mid
                      </option>
                      <option value="documentDriver">
                        V5 · dokument driver
                      </option>
                      <option value="custom">
                        Tidligere egne koefficienter
                      </option>
                    </select>
                    <p id="aeroStatus" class="data-status" role="status"></p
                  ></label>
                  <div class="form-grid">
                    <label
                      >Wobble ved release · °<input
                        id="wobble"
                        type="number"
                        min="0"
                        max="12"
                        step="1"
                        value="0" /></label
                    ><label
                      >Diameter · m (0 = auto)<input
                        id="diameter"
                        type="number"
                        min="0"
                        max=".3"
                        step=".001"
                        value="0" /></label
                    ><label
                      >Inertimoment · multiplikator<input
                        id="inertiaScale"
                        type="number"
                        min=".5"
                        max="1.5"
                        step=".05"
                        value="1" /></label
                    ><label
                      >Masse ved kanten · faktor<input
                        id="inertiaFactor"
                        type="number"
                        min=".5"
                        max="1"
                        step=".05"
                        value=".7"
                    /></label>
                  </div>
                  <p class="hint">
                    Inertimoment × 1 bruger profilens værdi. Diameter 0 bruger
                    profilens størrelse. Wobble er vinklen mellem
                    rotationshastigheden og discens normal. Ingen af delene er
                    målt på din konkrete disc.
                  </p>
                </details>
                <p class="hint" id="angleHint">
                  Positiv hyzer hælder mod fade-siden.
                </p>
                <details>
                  <summary>Spin, vægt og release</summary>
                  <div class="form-grid">
                    <label
                      >Spin · rpm<input
                        id="rpm"
                        inputmode="decimal"
                        max="1800"
                        min="100"
                        step="10"
                        type="number"
                        value="600"
                    /></label>
                    <label
                      >Vægt · g<input
                        id="weight"
                        inputmode="numeric"
                        max="200"
                        min="100"
                        step="1"
                        type="number"
                        value="175"
                    /></label>
                    <label
                      >Højde · m<input
                        id="height"
                        inputmode="decimal"
                        max="2.5"
                        min="0.5"
                        step="0.1"
                        type="number"
                        value="1.5"
                    /></label>
                    <label
                      >Udgangsvinkel · °<input
                        id="launch"
                        inputmode="numeric"
                        max="25"
                        min="0"
                        step="1"
                        type="number"
                        value="8"
                    /></label>
                  </div>
                  <p class="hint">
                    Nose angle ændrer discens hældning. Udgangsvinkel ændrer
                    retningen på selve kastet.
                  </p>
                </details>
              </section>
              <section
                class="control-section wind-section"
                hidden=""
                id="windPane"
              >
                <div class="section-head">
                  <h2>Vind &amp; retning</h2>
                  <button class="text-button" id="calm">Vindstille</button>
                </div>
                <div class="slider-head">
                  <label for="windSpeed">Vindstyrke</label
                  ><output for="windSpeed" id="windSpeedOut"></output>
                </div>
                <input
                  id="windSpeed"
                  max="15"
                  min="0"
                  step="0.5"
                  type="range"
                  value="0"
                />
                <div
                  aria-label="Hvad vil du justere?"
                  class="compass-mode"
                  role="group"
                >
                  <button aria-pressed="true" class="active" id="windMode">
                    ● Vind fra</button
                  ><button aria-pressed="false" id="aimMode">↑ Kast mod</button>
                </div>
                <div class="compass-wrap">
                  <svg
                    aria-label="Vind fra, grader med uret fra nord"
                    aria-valuemax="359"
                    aria-valuemin="0"
                    aria-valuenow="0"
                    id="compass"
                    role="slider"
                    tabindex="0"
                    viewbox="0 0 280 280"
                  >
                    <defs>
                      <marker
                        id="windHead"
                        markerheight="8"
                        markerunits="strokeWidth"
                        markerwidth="8"
                        orient="auto"
                        refx="6"
                        refy="3"
                      >
                        <path d="M0,0 L6,3 L0,6 Z" fill="#ffba76"></path>
                      </marker>
                      <marker
                        id="aimHead"
                        markerheight="6"
                        markerunits="strokeWidth"
                        markerwidth="6"
                        orient="auto"
                        refx="5"
                        refy="3"
                      >
                        <path d="M0,0 L5,3 L0,6 Z" fill="#c4f275"></path>
                      </marker>
                    </defs>
                    <circle
                      cx="140"
                      cy="140"
                      fill="#102a30"
                      r="109"
                      stroke="#315057"
                    ></circle>
                    <circle
                      cx="140"
                      cy="140"
                      fill="none"
                      r="73"
                      stroke="#234048"
                      stroke-dasharray="3 7"
                    ></circle>
                    <path
                      d="M140 35V245M35 140H245"
                      stroke="#29464e"
                      stroke-dasharray="2 5"
                    ></path>
                    <g id="compassTicks" stroke="#527078"></g>
                    <g
                      fill="#aec2c5"
                      font-family="system-ui"
                      font-size="13"
                      text-anchor="middle"
                    >
                      <text x="140" y="19">N</text>
                      <text x="266" y="145">Ø</text>
                      <text x="140" y="273">S</text>
                      <text x="14" y="145">V</text>
                    </g>
                    <g id="aimArrow">
                      <path
                        d="M140 179L140 74"
                        marker-end="url(#aimHead)"
                        stroke="#c4f275"
                        stroke-width="3"
                      ></path>
                      <circle cx="140" cy="140" fill="#c4f275" r="5"></circle>
                    </g>
                    <g id="windArrow">
                      <path
                        d="M140 52L140 221"
                        marker-end="url(#windHead)"
                        stroke="#ffba76"
                        stroke-width="5"
                      ></path>
                      <circle
                        cx="140"
                        cy="52"
                        fill="#ffba76"
                        r="9"
                        stroke="#0b1c21"
                        stroke-width="3"
                      ></circle>
                    </g>
                  </svg>
                  <p class="compass-reading" id="windReading"></p>
                </div>
                <div class="form-grid">
                  <label class="amber"
                    >Vind fra · °<input
                      id="windFrom"
                      inputmode="numeric"
                      max="359"
                      min="0"
                      step="1"
                      type="number"
                      value="0" /></label
                  ><label class="lime"
                    >Kast mod · °<input
                      id="aim"
                      inputmode="numeric"
                      max="359"
                      min="0"
                      step="1"
                      type="number"
                      value="0"
                  /></label>
                </div>
                <p class="wind-components" id="windComponents"></p>
                <details>
                  <summary>Luft &amp; højde over havet</summary>
                  <div class="form-grid">
                    <label
                      >Temperatur · °C<input
                        id="temperature"
                        type="number"
                        min="-15"
                        max="45"
                        step="1"
                        value="15" /></label
                    ><label
                      >Højde over havet · m<input
                        id="altitude"
                        type="number"
                        min="0"
                        max="4000"
                        step="10"
                        value="0" /></label
                    ><label
                      >Relativ fugtighed · %<input
                        id="humidity"
                        type="number"
                        min="0"
                        max="100"
                        step="5"
                        value="0"
                    /></label>
                  </div>
                  <p class="hint">
                    Beregnet luftdensitet: <strong id="densityOut"></strong>.
                    Lufttryk følger standardatmosfæren; værdierne indstilles
                    manuelt.
                  </p>
                </details>
                <details class="wind-help">
                  <summary>Sådan læses pilene</summary>
                  <p>
                    Prikken viser, hvor vinden kommer fra. Orange pil viser,
                    hvor den blæser hen. Grøn pil viser dit kast. Du indstiller
                    selv vind og retning; appen læser ikke telefonens kompas.
                  </p>
                </details>
              </section>
              <section
                class="control-section lab-pane"
                hidden
                id="analysisPane"
              >
                <div class="section-head">
                  <h2>Mål &amp; kastanalyse</h2>
                  <span class="micro">V6 · 6-DOF</span>
                </div>
                <p class="hint">
                  Vælg et mål og undersøg kastets følsomhed. Afstande gælder
                  første kontakt med fladt terræn.
                </p>
                <div class="form-grid">
                  <label
                    >Afstand frem · m<input
                      id="targetDistance"
                      type="number"
                      min="5"
                      max="250"
                      step="1"
                      value="80" /></label
                  ><label
                    >Sideværts · m<input
                      id="targetLateral"
                      type="number"
                      min="-100"
                      max="100"
                      step="1"
                      value="0" /></label
                  ><label
                    >Målzone · radius i m<input
                      id="targetRadius"
                      type="number"
                      min="1"
                      max="30"
                      step="1"
                      value="5"
                  /></label>
                </div>
                <p class="hint">
                  Positiv sideafstand er til højre for sigtelinjen. Cirklen er
                  en målzone, ikke en kurv.
                </p>
                <div class="lab-current" id="targetSummary" role="status">
                  Beregn et kast for at se afstanden til målet.
                </div>
                <section class="round-card" aria-labelledby="roundTitle">
                  <div class="section-head">
                    <h2 id="roundTitle">Runde · 8 kast</h2>
                    <span id="roundStreak" class="streak" role="status"
                      >0 i træk</span
                    >
                  </div>
                  <p class="hint">
                    Ram målzonen med otte simulerede kast. Releasevariationerne
                    følger dine analyseindstillinger. Målet og indstillingerne
                    låses for runden.
                  </p>
                  <p id="roundTarget" class="hint"></p>
                  <div
                    id="roundGrid"
                    class="round-grid"
                    aria-label="Rundens otte kast"
                  ></div>
                  <p id="roundScore" class="round-score" role="status">
                    Klar til en runde.
                  </p>
                  <p id="roundBest" class="hint"></p>
                  <div class="button-row">
                    <button id="startRound" class="primary" type="button">
                      Start runde</button
                    ><button id="roundThrow" type="button" disabled>
                      Kast 1 / 8
                    </button>
                  </div>
                  <p id="roundError" class="error" role="alert" hidden></p>
                </section>
                <section
                  id="diagnosticWarnings"
                  class="diagnostic-warnings"
                  aria-label="Modellens forbehold"
                  hidden
                ></section>
                <button id="suggestThrows" class="primary wide">
                  Find kast til målet
                </button>
                <p class="hint">
                  Afprøver op til seks discs, tre kraftniveauer og tre
                  hyzervinkler. De bedste forslag kontrolleres med otte
                  releasevariationer og sorteres efter største afvigelse. Nose,
                  spin og vind tager udgangspunkt i dit valgte kast. Discs med
                  samme basisprofil er ikke aerodynamisk kortlagt hver for sig.
                </p>
                <div id="throwSuggestions"></div>
                <details open>
                  <summary>Variation fra kast til kast</summary>
                  <div class="form-grid">
                    <label
                      >Kraft · ± procentpoint<input
                        id="spreadPower"
                        type="number"
                        min="0"
                        max="15"
                        step="1"
                        value="3"
                    /></label>
                    <label
                      >Hyzer og nose · ± °<input
                        id="spreadAngle"
                        type="number"
                        min="0"
                        max="10"
                        step=".5"
                        value="2"
                    /></label>
                    <label
                      >Spin · ± %<input
                        id="spreadSpin"
                        type="number"
                        min="0"
                        max="30"
                        step="1"
                        value="8"
                    /></label>
                    <label
                      >Vindkomponenter · ± m/s<input
                        id="spreadWind"
                        type="number"
                        min="0"
                        max="5"
                        step=".1"
                        value=".5"
                    /></label>
                    <label
                      >Udgangsvinkel · ± °<input
                        id="spreadLaunch"
                        type="number"
                        min="0"
                        max="5"
                        step=".5"
                        value="1"
                    /></label>
                    <label
                      >Sigteretning · ± °<input
                        id="spreadAim"
                        type="number"
                        min="0"
                        max="10"
                        step=".5"
                        value="1"
                    /></label>
                    <label
                      >Koefficientvariation · % af testinterval<input
                        id="spreadAero"
                        type="number"
                        min="0"
                        max="200"
                        step="10"
                        value="100"
                    /></label>
                  </div>

                  <button id="runSensitivity" class="wide">
                    Test release og koefficienter
                  </button>
                  <p class="hint">
                    32 blå releasepunkter og, med V6, 16 orange
                    koefficientpunkter. Ved 100 % afprøves løft ±15 %, modstand
                    ±20 %, pitch-offset ±0,015, spinmodstand ±30 % og
                    rulle/pitchdæmpning ±50 %. Det er valgte testintervaller; de
                    er ikke målte fejlmarginer. Sæt 0 for at fastholde en
                    størrelse.
                  </p>
                  <svg
                    id="dispersionPlot"
                    hidden
                    viewBox="0 0 420 280"
                    role="img"
                    aria-label="Blå cirkler viser releasevariation; orange firkanter viser koefficientvariation"
                  ></svg>
                  <p id="sensitivitySummary" class="hint" role="status"></p>
                </details>
                <details>
                  <summary>Discens aeroprofil og justeringer</summary>
                  <p id="coefficientSummary" class="hint"></p>
                  <button id="editCoefficients" class="wide">
                    Se koefficienttabeller og kilde
                  </button>
                  <div class="form-grid">
                    <label
                      >Løft · multiplikator<input
                        id="liftScale"
                        type="number"
                        min=".5"
                        max="1.5"
                        step=".05"
                        value="1"
                    /></label>
                    <label
                      >Modstand · multiplikator<input
                        id="dragScale"
                        type="number"
                        min=".5"
                        max="1.8"
                        step=".05"
                        value="1"
                    /></label>
                    <label
                      >Pitchmoment · offset<input
                        id="momentOffset"
                        type="number"
                        min="-.06"
                        max=".06"
                        step=".002"
                        value="0"
                    /></label>
                    <label
                      >Spinmodstand · multiplikator<input
                        id="spinDragScale"
                        type="number"
                        min="0"
                        max="3"
                        step=".1"
                        value="1"
                    /></label>
                    <label
                      >Rulle/pitchdæmpning · multiplikator<input
                        id="rateDampingScale"
                        type="number"
                        min="0"
                        max="3"
                        step=".1"
                        value="1"
                    /></label>
                  </div>
                  <p class="hint">
                    Justér én ting ad gangen efter gentagne erfaringer med
                    discen. Et negativt pitch-offset giver mere
                    nose-down-moment. Højere modstand bremser mere; højere
                    spinmodstand taber spin hurtigere. En sådan justering er
                    stadig et estimat. Gem på discen for at bevare den ved
                    discskift.
                  </p>
                  <div class="button-row">
                    <button id="saveAeroDisc">Gem på discen</button
                    ><button id="resetAero">Nulstil justering</button>
                  </div>
                  <div class="button-row">
                    <button id="importCoefficients">
                      Importér koefficienter</button
                    ><button id="exportCoefficients">
                      Eksportér basisprofil
                    </button>
                  </div>
                  <input
                    id="coefficientFile"
                    type="file"
                    accept=".json,application/json"
                    hidden
                  />
                  <p class="hint">
                    Basiseksport indeholder originaltabellen. Egne
                    multiplikatorer, bag og gemte kast følger med den fulde
                    backup under Profil.
                  </p>
                </details>
                <details>
                  <summary>Se kastets data</summary>
                  <label
                    >Kurve<select id="telemetryMetric">
                      <option value="height">Højde · m</option>
                      <option value="airspeed">Lufthastighed · m/s</option>
                      <option value="spin">Spin · rpm</option>
                      <option value="alpha">Angrebsvinkel · °</option>
                      <option value="advanceRatio">
                        Signeret spin/fart-forhold · ωR/U
                      </option>
                    </select></label
                  ><svg
                    id="telemetryChart"
                    viewBox="0 0 420 200"
                    role="img"
                    aria-label="Kastets beregnede data over tid"
                  ></svg>
                  <p id="modelQuality" class="hint"></p>
                  <div class="button-row">
                    <button id="exportCSV">Eksportér beregnede punkter</button
                    ><button id="exportFlightSVG">Gem banediagram</button>
                  </div>
                </details>
                <details>
                  <summary>Hvad bygger beregningen på?</summary>
                  <p class="hint">
                    V6 beregner position, hastighed, fuld orientering og
                    rotationsmoment med adaptiv RK45. Flighttal bruges som
                    metadata og ved afspilning af tidligere modeller. De
                    omregnes ikke til aerokoefficienter i V6.
                  </p>
                  <p class="hint">
                    Firebird, Roadrunner og Wraith har åbne statiske
                    CFD-tabeller. TeeBird-tabellen har delvist lånte
                    yderpunkter. Automatisk valg bruger en direkte profil ved
                    modelmatch; øvrige discs får en generisk familie ud fra
                    oplyst disctype eller PDGA-mål. Plast, dome,
                    produktionsserie og slid har ingen målte individuelle
                    korrektioner her.
                  </p>
                  <p class="hint">
                    CL, CD og CM interpoleres i angrebsvinkel. Vinkelintervallet
                    −10 til 20° bruges til kontrolflag for de indbyggede
                    profiler; hele tabellen bruges i beregningen. En importeret
                    tabel kan også have en signeret spin/fart-akse samt CRoll og
                    CSpin. Uden disse data bruges roterende disc-referencer til
                    dæmpning og en antaget spinmodstand. Standardværdierne er
                    Cmq = −1,4, Clp = −1,3 og CSpin = −0,00265 × ωR/U. De er
                    ikke målt på din golfdisc.
                  </p>
                  <p class="hint">
                    Modellen antager en stiv, rotationssymmetrisk disc og
                    konstant vind gennem hvert kast. Sidekraft fra
                    Magnus-effekt, turbulens, træer, skips, rul og
                    terrænhældning indgår ikke. Stopkriteriet er discens centrum
                    ved jordniveau. Resultatet er et flyveestimat, ikke en
                    nøjagtig real-world-gengivelse.
                  </p>
                  <p class="hint">
                    Numerisk stabilitet er ikke målt præcision i virkeligheden.
                    V6.1 er ikke kalibreret til dit individuelle kast. Se
                    testbeskrivelsen i projektets README.
                  </p>
                  <div class="source-list">
                    <a
                      href="https://github.com/kegiljarhus/shotshaper"
                      target="_blank"
                      rel="noopener noreferrer"
                      >Shotshaper · åbne tabeller og forsøgsbaner ↗</a
                    >
                    <a
                      href="https://link.springer.com/article/10.1007/s12283-022-00390-5"
                      target="_blank"
                      rel="noopener noreferrer"
                      >Fagfællebedømt CFD-studie · 2022 ↗</a
                    >
                    <a
                      href="https://www.researchgate.net/publication/225330184_Simulation_of_a_spinstabilised_sports_disc"
                      target="_blank"
                      rel="noopener noreferrer"
                      >Crowther &amp; Potts · 2007 · roterende disc-model ↗</a
                    >
                    <a
                      href="https://research.engineering.ucdavis.edu/biosport/sample-page/test-page-1/frisbee-flight-simulation-and-throw-biomechanics/"
                      target="_blank"
                      rel="noopener noreferrer"
                      >Hummel · 2003 · frisbee-reference ↗</a
                    >
                    <a
                      href="https://www.pdga.com/technical-standards/equipment-certification/discs"
                      target="_blank"
                      rel="noopener noreferrer"
                      >PDGA · godkendte discmål ↗</a
                    >
                  </div>
                  <p class="hint">
                    Datapakke hentet 19. september 2026. Originale
                    datarevisioner er gemt som SHA-256 ved hver profil.
                    Shotshaper-tabellerne er omlagt til appens JSON-format;
                    oprindelige CL/CD/CM-værdier er bevaret.
                  </p>
                  <details>
                    <summary>Shotshaper · kilde og GPLv3-licens</summary>
                    <p class="hint">
                      Tabeller: Shotshaper-projektets bidragydere.
                      Forfatterangivelse og ophavsret fremgår af repository og
                      artikel. GPLv3-licensen følger her. Datatilpasning og
                      motor findes i projektets src-mappe.
                    </p>
                    <p>
                      <a
                        href="./licenses/Shotshaper-GPL-3.0.txt"
                        target="_blank"
                        rel="noopener"
                        >Læs GPLv3-licensen</a
                      >
                    </p>
                  </details>
                </details>
              </section>
              <section class="control-section saved-throws">
                <h2>Gemte kast <span id="savedCount">0 / 3</span></h2>
                <p class="hint">
                  Gem disc, metode, profil og alle indstillinger. Ændringer i
                  din bag påvirker ikke gemte kast.
                </p>
                <div class="button-row">
                  <button id="captureThrow">＋ Gem dette kast</button
                  ><button id="showSaved">Vis sammenligning</button>
                </div>
                <label class="check-line"
                  ><input id="commonWind" type="checkbox" checked /> Samme vind
                  fra Vind-fanen</label
                >
                <div id="savedThrows"></div>
              </section>
            </div>
            <div class="throw-dock">
              <button class="primary" id="simulate">
                Simulér kast <span>↗</span></button
              ><button
                id="compare"
                title="Sammenlign hyzer, fladt kast og anhyzer"
              >
                Sammenlign vinkler
              </button>
            </div>
          </aside>
          <section
            aria-label="Kastets flyvebane"
            class="flight-panel"
            id="flightPanel"
          >
            <div class="flight-toolbar">
              <button
                class="text-button"
                data-open-panel="throw"
                id="editThrow"
              >
                ‹ Ret kast</button
              ><span
                class="engine-badge is-loading"
                aria-busy="true"
                role="status"
                id="engineStatus"
                >2D · indlæser 3D…</span
              ><button
                aria-label="Udvid visualiseringen"
                aria-pressed="false"
                class="icon-button"
                id="expand"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  aria-hidden="true"
                >
                  <path
                    d="M4 9V4h5m6 0h5v5M20 15v5h-5M9 20H4v-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg></button
              ><button
                aria-label="Beregn nyt kast"
                class="icon-button"
                id="rerun"
              >
                ↻
              </button>
            </div>
            <div class="hud">
              <div>
                <small>DISTANCE</small>
                <p><output id="distanceOut">0,0</output><span> m</span></p>
              </div>
              <div>
                <small>HØJDE</small>
                <p><output id="heightOut">1,5</output><span> m</span></p>
              </div>
              <div>
                <small>LUFTHASTIGHED</small>
                <p><output id="airOut">27,0</output><span> m/s</span></p>
                <small id="groundSpeed"></small>
              </div>
            </div>
            <div aria-label="Visualisering af kast" class="stage" id="stage">
              <div aria-label="3D-flyvebane" id="world"></div>
              <canvas aria-label="Flyvebane set ovenfra" id="fallback"></canvas>
            </div>
            <div aria-label="Kameravinkel" class="view-modes" role="group">
              <button aria-pressed="true" class="active" data-camera="overview">
                Overblik</button
              ><button aria-pressed="false" data-camera="follow">
                Følg disc</button
              ><button aria-pressed="false" data-camera="top">Ovenfra</button
              ><button aria-pressed="false" data-camera="side">
                Fra siden
              </button>
            </div>
            <div class="stale" hidden="" id="stale" role="status">
              Indstillinger ændret. Tryk ↻ for at beregne igen.
            </div>
            <div class="flight-summary" id="flightSummary"></div>
            <div class="telemetry-strip">
              <div><small>AOA · °</small><strong id="liveAlpha">—</strong></div>
              <div>
                <small>SPIN · RPM</small><strong id="liveSpin">—</strong>
              </div>
              <div><small>LIFT · N</small><strong id="liveLift">—</strong></div>
              <div><small>DRAG · N</small><strong id="liveDrag">—</strong></div>
            </div>
            <div class="comparison" hidden="" id="comparison"></div>
            <div class="flight-legend">
              <span><i class="turn-dot"></i>Turn</span
              ><span><i class="glide-dot"></i>Glide</span
              ><span><i class="fade-dot"></i>Fade</span
              ><span>Modelestimat</span>
            </div>
            <div class="playbar">
              <button aria-label="Start afspilning" id="play">Afspil</button>
              <div>
                <div class="timeline-label">
                  <span id="phase">Klar</span
                  ><output id="time">0,00 / 0,00 s</output>
                </div>
                <input
                  aria-label="Tid i kastet"
                  id="seek"
                  max="1"
                  min="0"
                  step="any"
                  type="range"
                  value="0"
                />
              </div>
            </div>
          </section>
        </div>
      </section>
      <section
        aria-labelledby="bagTitle"
        class="view bag-view"
        hidden=""
        id="bagView"
      >
        <div class="page-heading">
          <div>
            <h1 id="bagTitle">Min bag<span class="lime">.</span></h1>
            <p class="subhead">Tryk på en disc for detaljer.</p>
          </div>
          <button class="primary" id="addDisc">＋ Tilføj</button>
        </div>
        <div class="bag-tools">
          <button id="bagImport" class="bag-import">
            Indlæs discliste / CSV</button
          ><label class="search-label"
            ><span class="sr-only">Søg i min bag</span
            ><input
              id="bagSearch"
              placeholder="Søg disc, mærke eller plast…"
              type="search" /></label
          ><label
            ><span class="sr-only">Disc-type</span
            ><select id="bagFilter">
              <option value="all">Alle discs</option>
              <option value="favorites">★ Favoritter</option>
              <option value="putter">Putter</option>
              <option value="midrange">Midrange</option>
              <option value="fairway">Fairway</option>
              <option value="distance">Distance</option>
            </select></label
          ><label
            ><span class="sr-only">Sortér bag</span
            ><select id="bagSort">
              <option value="speed">Speed · lav til høj</option>
              <option value="name">Navn · A–Å</option>
              <option value="brand">Mærke · A–Å</option>
              <option value="recent">Senest tilføjet</option>
            </select></label
          >
        </div>
        <div class="bag-list-caption">
          <span id="bagResultCount">0 discs</span
          ><button class="text-button" hidden="" id="clearBagFilters">
            Nulstil filtre
          </button>
        </div>
        <div class="bag-scroll" id="bagScroll">
          <div class="bag-grid" id="bagGrid"></div>
          <div class="empty-state" id="bagEmpty">
            <div aria-hidden="true" class="empty-disc">◎</div>
            <h2>Din bag starter her.</h2>
            <p>
              Tilføj din første disc med dens flight numbers.<br />Gem vægt,
              plast og dine egne noter.
            </p>
            <button class="primary" id="addFirstDisc">
              Tilføj min første disc
            </button>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="profileTitle"
        class="view page-view"
        hidden=""
        id="profileView"
      >
        <div class="page-inner profile-inner">
          <div class="page-heading">
            <div>
              <span class="eyebrow">DIT UDGANGSPUNKT</span>
              <h1 id="profileTitle">
                Spillerprofil<span class="lime">.</span>
              </h1>
              <p class="subhead">
                Gem dine typiske releaseværdier til hurtige kast.
              </p>
            </div>
            <span class="local-pill">På denne enhed</span>
          </div>
          <section class="profile-card">
            <h2>Udseende &amp; offline</h2>
            <label
              >Tema<select id="themeSelect">
                <option value="system">Følg enheden</option>
                <option value="light">Lyst · udendørs</option>
                <option value="dark">Mørkt</option>
              </select></label
            >
            <p class="hint" id="offlineStatus" role="status">
              Forbereder offlinebrug…
            </p>
            <button id="installApp" hidden>Installér app</button>
          </section>
          <form class="profile-card" id="profileForm">
            <div class="form-grid">
              <label
                >Navn<input
                  autocomplete="nickname"
                  id="profileName"
                  maxlength="60"
                  required=""
                  type="text" /></label
              ><label
                >Foretrukken hånd<select id="profileHand">
                  <option value="R">Højre</option>
                  <option value="L">Venstre</option>
                </select></label
              >
            </div>
            <label
              >Niveau · justerbare startværdier<select id="profileLevel">
                <option value="custom">Egne værdier</option>
                <option value="beginner">Nybegynder</option>
                <option value="casual">Let øvet</option>
                <option value="advanced">Øvet</option>
                <option value="expert">Erfaren</option>
              </select></label
            ><button type="button" id="applyLevel">
              Brug niveauets startværdier
            </button>
            <p class="hint">
              Et niveau er kun et udgangspunkt. Justér baghånd og forhånd hver
              for sig.
            </p>
            <div class="method-grid">
              <div>
                <h2>Baghånd</h2>
                <label
                  >Maksimum · m/s<input
                    id="bhPower"
                    inputmode="decimal"
                    max="50"
                    min="5"
                    required=""
                    step="0.5"
                    type="number" /></label
                ><label
                  >Typisk spin · rpm<input
                    id="bhRpm"
                    inputmode="decimal"
                    max="1800"
                    min="100"
                    required=""
                    step="10"
                    type="number"
                /></label>
              </div>
              <div>
                <h2>Forhånd</h2>
                <label
                  >Maksimum · m/s<input
                    id="fhPower"
                    inputmode="decimal"
                    max="50"
                    min="5"
                    required=""
                    step="0.5"
                    type="number" /></label
                ><label
                  >Typisk spin · rpm<input
                    id="fhRpm"
                    inputmode="decimal"
                    max="1800"
                    min="100"
                    required=""
                    step="10"
                    type="number"
                /></label>
              </div>
            </div>
            <div class="form-grid three">
              <label
                >Releasehøjde · m<input
                  id="profileHeight"
                  inputmode="decimal"
                  max="2.5"
                  min="0.5"
                  required=""
                  step="0.1"
                  type="number" /></label
              ><label
                >Udgangsvinkel · °<input
                  id="profileLaunch"
                  inputmode="numeric"
                  max="25"
                  min="0"
                  required=""
                  step="1"
                  type="number" /></label
              ><label
                >Nose angle · °<input
                  id="profileNose"
                  max="15"
                  min="-15"
                  required=""
                  step="1"
                  type="number"
              /></label>
            </div>
            <label
              >Mine noter<textarea
                id="profileNotes"
                maxlength="1000"
                placeholder="Fx hvad der fungerer i modvind, eller hvordan dine discs flyver."
                rows="3"
              ></textarea>
            </label>
            <p class="hint">
              Startværdierne er eksempler. Tilpas dem efter dine egne kast.
              Profilen bliver ikke automatisk kalibreret ud fra din kastelængde.
            </p>
            <button class="primary" type="submit">
              Gem profil &amp; brug værdier
            </button>
          </form>
          <section class="profile-card backup-card">
            <h2>Indlæs din discbeholdning</h2>
            <p>
              Dine to vedhæftede Discmate-lister er indbygget. Den tjekkede
              liste er valgt. Gennemse discs før import; eksisterende varianter
              og den tidligere mistede Patrol er fravalgt fra start.
            </p>
            <label>Vedhæftet liste<select id="attachedList"></select></label>
            <div class="button-row">
              <button id="reviewAttached">Gennemse og tilføj</button
              ><button id="csvImport">Importér anden CSV</button>
            </div>
            <input id="csvFile" type="file" accept=".csv,text/csv" hidden />
            <p>
              Billeder via URL kræver internet. Ukendt vægt bruger 175 g som
              modelværdi, indtil du ændrer den.
            </p>
          </section>

          <section class="profile-card backup-card">
            <div>
              <h2>Tag din bag med.</h2>
              <p>
                Eksportér profil, bag, tre gemte kast, runderekorder og
                uploadede billeder i en JSON-backup. Importér den på en anden
                enhed. Ingen konto eller automatisk synkronisering.
              </p>
            </div>
            <div class="button-row">
              <button id="exportData">↓ Eksportér backup</button
              ><button id="importData">↑ Importér backup</button>
            </div>
            <input
              accept=".json,application/json"
              hidden=""
              id="importFile"
              type="file"
            />
          </section>
          <p class="footnote" id="storageNote">
            Gemmes automatisk lokalt. Hvis browserdata slettes, slettes den
            lokale bag også.
          </p>
          <section class="profile-card">
            <h2>Disckatalog</h2>
            <p class="hint" id="catalogStatus"></p>
            <button id="refreshCatalog">↻ Opdatér fra DiscIt</button
            ><button class="wide" id="importCatalog">
              Indlæs katalog (.json)
            </button>
            <p class="hint">
              Kataloget er indbygget og kan bruges offline. Tilføj flere
              modeller fra en JSON-fil. Dine egne discs ændres ikke af et
              katalogimport.
            </p>
          </section>
          <details class="model-note">
            <summary>Om modellen og dens begrænsninger</summary>
            <p>
              6-DOF integrerer translation og fuld orientering med quaternioner,
              impulsmoment og adaptiv Runge–Kutta 5(4). Lift, drag og momenter
              beregnes fra den relative luftstrøm. Turn og fade opstår ved tilt
              og præcession; der tilføjes ingen kunstig sidekraft.
            </p>
            <p>
              Flighttal er relative producentvurderinger. Omsætningen til
              aerodynamiske koefficienter, golfdiscens inertimomenter og
              fortsættelsen ved store angrebsvinkler er estimater.
              Hummel-reference og dokumentets golfsæt kan vælges separat. Skift
              af model kan derfor ændre den beregnede kastelængde markant.
            </p>
            <p>
              Jordkontakt tilnærmes ved, at discens center når jordplanet. Ingen
              skips, rul, træer eller kurvekollisioner. Vind og atmosfære
              indtastes manuelt. En målzone er et geometrisk område;
              følsomhedsanalysen er ikke en personlig træfsandsynlighed.
            </p>
            <p>
              V2- og V4-backups kan importeres. Ældre gemte kast beholder
              V4-motoren; nye kast bruger 6-DOF. Nye backups indeholder
              koefficienter, mål, atmosfære, profil, bag og billeder.
            </p>
            <p>
              Appen og kataloget kan bruges offline. Billed-URL’er og
              katalogopdatering kræver net. De tunge beregninger kører i
              baggrunden, hvor browseren understøtter det.
            </p>
            <p>
              Kilde:
              <a
                href="https://morleyfielddgc.wordpress.com/wp-content/uploads/2009/04/hummelthesis.pdf"
                target="_blank"
                rel="noopener noreferrer"
                >Hummel 2003, Appendix A/B</a
              >. De estimerede golfbaselines er fra dit 6-DOF-dokument.
            </p>
          </details>
          <p class="footnote">
            Version 6.1 · Layout fra 320 px. 3D kræver WebGL2; ellers vises
            samme kast i 2D.
          </p>
        </div>
      </section>
    </main>
    <div class="toast" hidden="" id="toast" role="status">
      <span id="toastText"></span><button hidden="" id="undo">Fortryd</button
      ><button aria-label="Luk besked" class="icon-button" id="dismissToast">
        ×
      </button>
    </div>
    <nav aria-label="Hovedmenu" class="app-nav">
      <button aria-current="page" class="nav active" data-view="simulator">
        ↗ Kast</button
      ><button class="nav" data-view="bag">
        Min bag <span class="count" id="bagCount">0</span></button
      ><button class="nav" data-view="profile">◎ Profil</button>
    </nav>
    <dialog id="coeffDialog" aria-labelledby="coefficientTitle">
      <div class="dialog-head">
        <h2 id="coefficientTitle">Koefficientprofil</h2>
        <button
          class="icon-button"
          data-close="coeffDialog"
          aria-label="Luk koefficientprofil"
        >
          ×
        </button>
      </div>
      <div class="aero-dialog-scroll">
        <div id="aeroSource"></div>
        <p class="hint">
          Tabellen viser basisværdier før dine justeringer. — betyder, at data
          mangler; motoren bruger da den beskrevne antagelse.
        </p>
        <label
          >Signeret spin/fart-forhold · ωR/U<select
            id="coefficientLambda"
          ></select
        ></label>
        <div class="table-scroll">
          <table class="aero-table">
            <thead>
              <tr>
                <th scope="col">α · °</th>
                <th scope="col">CL</th>
                <th scope="col">CD</th>
                <th scope="col">CM</th>
                <th scope="col">CRoll</th>
                <th scope="col">CSpin</th>
              </tr>
            </thead>
            <tbody id="coefficientRows"></tbody>
          </table>
        </div>
        <p class="hint">
          Kraft = ½ρU² × S × C. Alle momenter = ½ρU² × S × diameter × C, om
          massemidtpunktet. Tabelvinkler er i grader; Jax og Jtrans i eksporten
          er I/masse i m². Pitchmoment virker om højreaksen, rullemoment om
          fremadaksen og spinmoment om discens topnormal.
        </p>
      </div>
    </dialog>
    <dialog aria-labelledby="detailTitle" id="detailDialog">
      <div class="dialog-head">
        <h2 id="detailTitle" tabindex="-1">Disc i min bag</h2>
        <button aria-label="Luk" class="icon-button" data-close="detailDialog">
          ×
        </button>
      </div>
      <div class="detail-scroll">
        <div class="detail-pager">
          <button
            aria-label="Forrige disc i listen"
            class="icon-button"
            id="detailPrevious"
          >
            ‹</button
          ><span id="detailPosition"></span
          ><button
            aria-label="Næste disc i listen"
            class="icon-button"
            id="detailNext"
          >
            ›
          </button>
        </div>
        <div id="detailContent"></div>
      </div>
      <div class="detail-actions">
        <button class="primary wide" id="detailUse">Brug til kast ↗</button>
        <div class="button-row">
          <button id="detailEdit">Redigér</button
          ><button class="danger" id="detailDelete">Slet disc</button>
        </div>
      </div>
    </dialog>
    <dialog aria-labelledby="pickerTitle" id="pickerDialog">
      <div class="dialog-head">
        <h2 id="pickerTitle">Vælg disc</h2>
        <button aria-label="Luk" class="icon-button" data-close="pickerDialog">
          ×
        </button>
      </div>
      <div class="picker-tools">
        <label class="sr-only" for="pickerSearch">Søg i bag og eksempler</label
        ><input
          autocomplete="off"
          id="pickerSearch"
          placeholder="Søg i min bag…"
          type="search"
        />
        <p class="hint" id="pickerCount"></p>
      </div>
      <div class="picker-results" id="pickerResults"></div>
      <div class="dialog-footer">
        <button class="primary wide" id="pickerAdd">
          ＋ Tilføj en ny disc
        </button>
      </div>
    </dialog>
    <dialog aria-labelledby="discDialogTitle" id="discDialog">
      <div class="dialog-head">
        <div>
          <span class="eyebrow">MIN BAG</span>
          <h2 id="discDialogTitle" tabindex="-1">Tilføj en disc</h2>
        </div>
        <button
          aria-label="Luk"
          class="icon-button"
          data-close="discDialog"
          type="button"
        >
          ×
        </button>
      </div>
      <section class="catalog-step" id="catalogStep">
        <div class="catalog-tools">
          <label for="discSearch">Søg model eller mærke</label>
          <div class="search-control">
            <input
              aria-controls="discSearchResults"
              autocomplete="off"
              enterkeyhint="search"
              id="discSearch"
              placeholder="Fx Berg, F9 eller Innova"
              type="search"
            /><button
              aria-label="Ryd søgning"
              class="icon-button"
              id="clearDiscSearch"
            >
              ×
            </button>
          </div>
          <div class="catalog-filters">
            <label
              ><span class="sr-only">Mærke</span
              ><select id="catalogBrand">
                <option value="all">Alle mærker</option>
              </select></label
            ><label
              ><span class="sr-only">Disc-type</span
              ><select id="catalogType">
                <option value="all">Alle typer</option>
                <option value="putter">Putter</option>
                <option value="midrange">Midrange</option>
                <option value="fairway">Fairway</option>
                <option value="distance">Distance</option>
              </select></label
            >
          </div>
          <p class="hint" id="catalogCount" role="status"></p>
        </div>
        <div class="catalog-scroll">
          <div class="disc-search-results" id="discSearchResults"></div>
          <button class="wide" hidden="" id="moreDiscs">
            Vis flere modeller
          </button>
        </div>
        <div class="dialog-footer">
          <button class="wide" id="manualDisc">
            ＋ Opret disc med egne tal
          </button>
        </div>
      </section>
      <form hidden="" id="discForm">
        <div class="form-fields">
          <details id="discTemplateLabel">
            <summary>Brug generiske flighttal</summary>
            <label class="sr-only" for="discTemplate">Eksempel</label
            ><select id="discTemplate">
              <option value="custom">Egne flight numbers</option>
              <option value="demo:putter">Putter · 1 / 1 / 0 / 2</option>
              <option value="demo:midrange">Midrange · 4 / 3 / 0 / 3</option>
              <option value="demo:driver">Distance · 12 / 5 / −1 / 3</option>
              <option value="demo:understable">
                Understable · 9 / 6 / −4 / 1
              </option>
            </select>
          </details>
          <p class="catalog-selection" hidden="" id="catalogSelection"></p>
          <label
            >Discens navn<input
              autocomplete="off"
              id="discName"
              maxlength="80"
              placeholder="Discens navn"
              required=""
          /></label>
          <div class="form-grid">
            <label
              >Mærke<input
                id="discBrand"
                maxlength="60"
                placeholder="Producent" /></label
            ><label
              >Plast<input
                id="discPlastic"
                maxlength="60"
                placeholder="Valgfrit"
            /></label>
          </div>
          <div class="chips" hidden="" id="plasticSuggest"></div>
          <div class="numbers">
            <label
              >Speed<input
                id="discSpeed"
                inputmode="decimal"
                max="15"
                min="1"
                required=""
                step="0.5"
                type="number" /></label
            ><label
              >Glide<input
                id="discGlide"
                inputmode="decimal"
                max="7"
                min="0"
                required=""
                step="0.5"
                type="number" /></label
            ><label
              >Turn<input
                id="discTurn"
                max="2"
                min="-5"
                required=""
                step="0.5"
                type="number" /></label
            ><label
              >Fade<input
                id="discFade"
                inputmode="decimal"
                max="6"
                min="-2"
                required=""
                step="0.5"
                type="number"
            /></label>
          </div>
          <div class="form-grid">
            <label
              >Vægt · g<input
                id="discWeight"
                inputmode="numeric"
                max="200"
                min="100"
                placeholder="Ukendt"
                step="1"
                type="number" /></label
            ><label
              >Discens farve<input id="discColor" type="color" value="#c4f275"
            /></label>
          </div>
          <div class="photo-editor">
            <h3>Billede af din disc</h3>
            <img
              id="discPhotoPreview"
              referrerpolicy="no-referrer"
              alt="Discens billede"
              hidden
            />
            <div class="button-row">
              <button type="button" id="photoCamera">Tag foto</button
              ><button type="button" id="photoGallery">Vælg billede</button
              ><button type="button" id="photoRemove">Fjern</button>
            </div>
            <input
              id="photoCameraFile"
              type="file"
              accept="image/*"
              capture="environment"
              hidden
            /><input
              id="photoGalleryFile"
              type="file"
              accept="image/*"
              hidden
            /><label
              >Billed-URL · valgfrit<input
                type="url"
                id="discImageUrl"
                placeholder="https://…"
                maxlength="2000"
            /></label>
            <p class="hint" id="photoStatus">
              Fotos nedskaleres og gemmes lokalt. Uploadede fotos følger med i
              backup. URL-billeder kræver net.
            </p>
          </div>
          <label
            >Noter<textarea
              id="discNotes"
              maxlength="500"
              placeholder="Slid, favoritkast, hvordan den flyver…"
              rows="2"
            ></textarea></label
          ><label class="check-label"
            ><input id="discFavorite" type="checkbox" /> Favorit i min
            bag</label
          >
          <p class="hint">
            Tjek flighttal på din egen variant. Ukendt vægt simuleres som 175 g.
          </p>
        </div>
        <p class="error" hidden="" id="discError" role="alert"></p>
        <div class="dialog-footer">
          <button id="backToCatalog" type="button">‹ Søg igen</button
          ><button class="primary wide" id="saveDiscButton" type="submit">
            Gem i bag
          </button>
        </div>
      </form>
    </dialog>
    <dialog aria-labelledby="importTitle" id="importDialog">
      <div class="dialog-head">
        <h2 id="importTitle">Importér backup</h2>
        <button aria-label="Luk" class="icon-button" data-close="importDialog">
          ×
        </button>
      </div>
      <p id="importSummary"></p>
      <label class="radio-card"
        ><input checked="" name="importMode" type="radio" value="merge" /><span
          ><strong>Tilføj discs til min bag</strong
          ><small>Behold min nuværende profil og mine discs.</small></span
        ></label
      ><label class="radio-card"
        ><input name="importMode" type="radio" value="replace" /><span
          ><strong>Gendan hele backup</strong
          ><small
            >Erstat bag, profil og kastindstillinger. Kan fortrydes lige efter
            import.</small
          ></span
        ></label
      >
      <p class="error" hidden="" id="importError" role="alert"></p>
      <button class="primary wide" id="confirmImport">Importér</button>
    </dialog>
    <noscript
      >JavaScript skal være slået til for at bruge Disc Flight Lab.</noscript
    >
    <input
      accept=".json,application/json"
      hidden=""
      id="catalogFile"
      type="file"
    />
    <dialog id="listDialog" aria-labelledby="listTitle">
      <div class="dialog-head">
        <h2 id="listTitle">Gennemse discs</h2>
        <button
          class="icon-button"
          data-close="listDialog"
          aria-label="Luk discliste"
        >
          ×
        </button>
      </div>
      <p class="hint">
        Kun markerede discs tilføjes. Du kan redigere oplysninger i din bag
        bagefter.
      </p>
      <div id="listRows" class="list-rows"></div>
      <p id="listError" class="error" hidden role="alert"></p>
      <div class="dialog-footer">
        <button id="confirmList" class="primary wide">
          Tilføj markerede discs
        </button>
      </div>
    </dialog>

    <noscript>Disc Flight Lab kræver JavaScript for at beregne kast.</noscript>
  </body>
</html>
```


## public/manifest.json

```json
{
  "id": "./",
  "name": "Disc Flight Lab",
  "short_name": "Disc Lab",
  "description": "Discgolfsimulator med lokale discdata, 3D-baner og runder på otte kast.",
  "lang": "da",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0b1c21",
  "theme_color": "#0b1c21",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```


## src/main.js

```javascript
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/themes.css";
import { initTheme } from "./ui/theme.js";
import { startApp } from "./ui/app.js";
import { registerOffline } from "./pwa/register.js";

initTheme();
registerOffline();
startApp().catch((error) => {
  console.error("Disc Flight Lab kunne ikke starte.", error);
  document.querySelector("main").inert = false;
  document.getElementById("toastText").textContent =
    "Appen kunne ikke starte: " + error.message;
  document.getElementById("toast").hidden = false;
  document.getElementById("saveStatus").textContent = "Opstart fejlede";
});
```


## src/physics/Physics6.js

```javascript
import { Aero } from "./Aero.js";
function createPhysics6() {
  "use strict";
  const D = Math.PI / 180,
    G = 9.80665,
    clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const add = (a, b) => a.map((v, i) => v + b[i]),
    mul = (a, s) => a.map((v) => v * s),
    dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0),
    len = (a) => Math.hypot(...a),
    unit = (a) => mul(a, 1 / Math.max(1e-12, len(a))),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const spinSign = (s) => (s === "RHBH" || s === "LHFH" ? 1 : -1);
  function wind(p) {
    const a = (p.windFrom - p.aim) * D;
    return [-p.windSpeed * Math.sin(a), 0, p.windSpeed * Math.cos(a)];
  }
  function density(p) {
    const t = p.temperature ?? 15,
      h = p.altitude ?? 0,
      rh = p.humidity ?? 0,
      pressure = 101325 * Math.pow(1 - (0.0065 * h) / 288.15, 5.25588),
      vap = (rh / 100) * 610.94 * Math.exp((17.625 * t) / (t + 243.04));
    return (
      (pressure - vap) / (287.05 * (t + 273.15)) +
      vap / (461.495 * (t + 273.15))
    );
  }
  const names = Aero.names;
  function coefficients(p) {
    const table = Aero.resolve(p),
      m = p.weight / 1000,
      diameter = p.diameter || table.diameter,
      scale = (diameter / table.diameter) ** 2 * (p.inertiaScale ?? 1);
    const c = {
      table,
      diameter,
      area: (Math.PI * diameter ** 2) / 4,
      mass: m,
      rho: density(p),
      Iax: table.Jax * m * scale,
      Itrans: table.Jtrans * m * scale,
      label: table.name,
      quality: table.quality || table.basis,
    };
    // Crowther & Potts (2007), eqs 22-25: dimensionless rate derivatives with
    // reduced rates omega*D/(2U). Frisbee priors, NOT measured golf-disc derivatives.
    c.pitchDamping = table.pitchDamping ?? -1.4;
    c.rollDamping = table.rollDamping ?? -1.3;
    c.spinDrag = table.spinDrag ?? 0.00265;
    // Udfaset: CL0/CLa/CD0/CDa/CM0/CMa. aero() bruger hele tabellen direkte.
    Object.assign(c, {
      CMq: -0.0144,
      CRp: -0.0125,
      CRr: 0,
      Cspin: -0.0000341,
      alpha0: 0,
    });
    if (
      ![c.mass, c.diameter, c.Iax, c.Itrans, c.rho].every(
        (v) => Number.isFinite(v) && v > 0,
      )
    )
      throw new Error("Ugyldig masse, geometri eller luftdensitet.");
    return c;
  }
  function normal(q) {
    const k =
        1 /
        Math.max(
          1e-20,
          q.reduce((a, v) => a + v * v, 0),
        ),
      [x, y, z, w] = q;
    return [
      2 * (x * y - z * w) * k,
      (w * w - x * x + y * y - z * z) * k,
      2 * (y * z + x * w) * k,
    ];
  }
  function initial(p, c) {
    const launch = p.launch * D,
      nose = p.nose * D,
      bank = -spinSign(p.style) * p.hyzer * D,
      uv = [0, Math.sin(launch), -Math.cos(launch)],
      up = [0, Math.cos(launch), Math.sin(launch)],
      n0 = add(mul(up, Math.cos(nose)), mul(uv, -Math.sin(nose)));
    // Bank around the release velocity, keeping the requested nose angle invariant.
    const n = add(
        add(mul(n0, Math.cos(bank)), mul(cross(uv, n0), Math.sin(bank))),
        mul(uv, dot(uv, n0) * (1 - Math.cos(bank))),
      ),
      q = unit([n[2], 0, -n[0], 1 + n[1]]);
    const v = mul(uv, p.power),
      f = unit(add(v, mul(n, -dot(v, n)))),
      right = unit(cross(f, n));
    const spin = (-spinSign(p.style) * p.rpm * 2 * Math.PI) / 60,
      omega = add(
        mul(n, spin),
        mul(right, Math.abs(spin) * Math.tan((p.wobble || 0) * D)),
      ),
      L = add(mul(omega, c.Itrans), mul(n, (c.Iax - c.Itrans) * spin));
    return [0, p.height, 0, ...v, ...q, ...L];
  }
  function stateInfo(y, c) {
    const n = normal(y.slice(6, 10)),
      L = y.slice(10, 13),
      ln = dot(L, n),
      omega = add(
        mul(L, 1 / c.Itrans),
        mul(n, ln * (1 / c.Iax - 1 / c.Itrans)),
      );
    return { n, omega, spin: ln / c.Iax };
  }
  function aero(y, p, c) {
    const { n, omega, spin } = stateInfo(y, c),
      v = add(y.slice(3, 6), mul(wind(p), -1)),
      speed = len(v),
      uv = speed > 1e-9 ? mul(v, 1 / speed) : [0, 0, -1],
      vn = dot(uv, n),
      alpha = Math.asin(clamp(-vn, -1, 1));
    let f = add(uv, mul(n, -vn));
    if (len(f) < 1e-7) {
      f = cross([1, 0, 0], n);
      if (len(f) < 1e-7) f = cross([0, 0, 1], n);
    }
    f = unit(f);
    const right = unit(cross(f, n)),
      liftDir = unit(cross(right, uv)),
      t = c.table,
      V = Math.max(0.01, speed),
      lambda = (spin * c.diameter) / (2 * V),
      deg = alpha / D,
      pert = p.aeroPerturb || {};
    const CL =
        Aero.lookup(t, "CL", deg, lambda) *
        (p.liftScale ?? 1) *
        (pert.liftScale ?? 1),
      CD = Math.max(
        0,
        Aero.lookup(t, "CD", deg, lambda) *
          (p.dragScale ?? 1) *
          (pert.dragScale ?? 1),
      ),
      CM =
        Aero.lookup(t, "CM", deg, lambda) +
        (p.momentOffset ?? 0) +
        (pert.momentOffset ?? 0);
    const qS = 0.5 * c.rho * speed * speed * c.area,
      pr = dot(omega, right),
      rr = dot(omega, f),
      rate = c.diameter / (2 * V),
      spinScale = (p.spinDragScale ?? 1) * (pert.spinScale ?? 1);
    const rateScale = (p.rateDampingScale ?? 1) * (pert.dampingScale ?? 1),
      CRoll =
        Aero.lookup(t, "CRoll", deg, lambda) +
        c.rollDamping * rr * rate * rateScale;
    const CSpin = t.CSpin
      ? Aero.lookup(t, "CSpin", deg, lambda) * spinScale
      : -c.spinDrag * lambda * spinScale;
    const pitch =
        qS * c.diameter * (CM + c.pitchDamping * pr * rate * rateScale),
      roll = qS * c.diameter * CRoll,
      spinMoment = qS * c.diameter * CSpin;
    const stall =
      deg < t.domain[0] ||
      deg > t.domain[1] ||
      !!(
        t.lambda?.length > 1 &&
        (lambda < t.lambda[0] || lambda > t.lambda.at(-1))
      );
    const F = add(mul(liftDir, qS * CL), mul(uv, -qS * CD)),
      tau = add(add(mul(right, pitch), mul(f, roll)), mul(n, spinMoment));
    return {
      n,
      omega,
      spin,
      alpha,
      CL,
      CD,
      CM,
      CRoll,
      CSpin,
      advanceRatio: lambda,
      F,
      tau,
      lift: qS * CL,
      drag: qS * CD,
      pitch,
      roll,
      spinMoment,
      airspeed: speed,
      phase: CM < -0.001 ? "Turn" : CM > 0.001 ? "Fade" : "Glide",
      stall,
    };
  }
  function derivative(y, p, c, options = {}) {
    const a = aero(y, p, c),
      F = options.aero === false ? [0, 0, 0] : a.F,
      T = options.aero === false ? [0, 0, 0] : a.tau,
      [wx, wy, wz] = a.omega,
      [qx, qy, qz, qw] = y.slice(6, 10);
    return [
      y[3],
      y[4],
      y[5],
      F[0] / c.mass,
      F[1] / c.mass - (options.gravity ?? G),
      F[2] / c.mass,
      0.5 * (wx * qw + wy * qz - wz * qy),
      0.5 * (-wx * qz + wy * qw + wz * qx),
      0.5 * (wx * qy - wy * qx + wz * qw),
      -0.5 * (wx * qx + wy * qy + wz * qz),
      ...T,
    ];
  }
  const A = [
      [],
      [1 / 5],
      [3 / 40, 9 / 40],
      [44 / 45, -56 / 15, 32 / 9],
      [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
      [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
      [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
    ],
    B = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
    E = B.map(
      (b, i) =>
        b -
        [
          5179 / 57600,
          0,
          7571 / 16695,
          393 / 640,
          -92097 / 339200,
          187 / 2100,
          1 / 40,
        ][i],
    );
  function step(y, h, p, c, opt) {
    const k = [derivative(y, p, c, opt)];
    for (let i = 1; i < 7; i++) {
      const z = y.map(
        (v, j) => v + h * A[i].reduce((sum, a, l) => sum + a * k[l][j], 0),
      );
      k.push(derivative(z, p, c, opt));
    }
    const z = y.map(
      (v, j) => v + h * B.reduce((sum, b, i) => sum + b * k[i][j], 0),
    );
    let error = 0;
    for (let j = 0; j < 13; j++) {
      const abs = j < 6 ? 1e-7 : j < 10 ? 1e-9 : 1e-10,
        scale =
          abs +
          (opt.tolerance || 2e-6) * Math.max(Math.abs(y[j]), Math.abs(z[j]));
      error = Math.max(
        error,
        Math.abs(h * E.reduce((sum, e, i) => sum + e * k[i][j], 0)) / scale,
      );
    }
    return { y: z, error };
  }
  function simulate(p, options = {}) {
    const c = coefficients(p),
      start = initial(p, c);
    let y = start,
      t = 0,
      h = 1 / 480,
      lastOutput = -1,
      steps = 0,
      rejected = 0,
      apex = p.height,
      pathLength = 0,
      maxAbsAoA = 0,
      outsideTime = 0;
    const points = [],
      limit = options.maxTime || 35;
    function record() {
      const a = aero(y, p, c);
      points.push({
        t,
        p: y.slice(0, 3),
        v: y.slice(3, 6),
        q: unit(y.slice(6, 10)),
        n: a.n,
        omega: a.omega,
        spin: a.spin,
        phase: a.phase,
        alpha: a.alpha,
        CL: a.CL,
        CD: a.CD,
        CM: a.CM,
        CRoll: a.CRoll,
        CSpin: a.CSpin,
        advanceRatio: a.advanceRatio,
        lift: a.lift,
        drag: a.drag,
        pitchMoment: a.pitch,
        rollMoment: a.roll,
        spinMoment: a.spinMoment,
        airspeed: a.airspeed,
      });
      lastOutput = t;
    }
    record();
    let landed = false;
    while (t < limit) {
      if (steps + rejected > 100000)
        throw new Error(
          "Fysikberegningen kræver for mange skridt. Kontrollér koefficienter og release.",
        );
      h = Math.min(h, options.maxStep || 1 / 60, limit - t);
      const next = step(y, h, p, c, options);
      if (!next.y.every(Number.isFinite) || !Number.isFinite(next.error))
        throw new Error(
          "Ustabilt parameterområde. Vælg et standardkoefficientsæt.",
        );
      if (next.error > 1) {
        h *= Math.max(0.15, 0.9 * Math.pow(next.error, -0.2));
        rejected++;
        if (h < 1e-7) throw new Error("For stive aerodynamiske koefficienter.");
        continue;
      }
      let z = next.y,
        dt = h;
      const q = unit(z.slice(6, 10));
      z.splice(6, 4, ...q);
      if (options.stopAtGround !== false && z[1] <= 0) {
        const u = y[1] / (y[1] - z[1]);
        z = y.map((v, i) => v + (z[i] - v) * u);
        z[1] = 0;
        z.splice(6, 4, ...unit(z.slice(6, 10)));
        dt = h * u;
        landed = true;
      }
      pathLength += Math.hypot(z[0] - y[0], z[1] - y[1], z[2] - y[2]);
      y = z;
      t += dt;
      steps++;
      apex = Math.max(apex, y[1]);
      const a = aero(y, p, c),
        alpha = Math.abs(a.alpha);
      maxAbsAoA = Math.max(maxAbsAoA, alpha);
      if (a.stall) outsideTime += dt;
      if (len(y.slice(3, 6)) > 300 || len(y.slice(0, 3)) > 5000)
        throw new Error("Beregningen forlod det understøttede område.");
      if (t - lastOutput >= 1 / 120 - 1e-9 || landed || t >= limit) record();
      if (landed) break;
      h *=
        next.error === 0
          ? 2
          : clamp(0.9 * Math.pow(next.error, -0.2), 0.3, 2.5);
    }
    if (!landed && options.stopAtGround !== false)
      throw new Error(
        "Ingen landing inden 35 sekunder. Justér vind eller release.",
      );
    const end = points.at(-1),
      warnings = [];
    if (outsideTime > 0.05)
      warnings.push(
        ((100 * outsideTime) / t).toFixed(0) +
          " % af tiden uden for profilens vinkel- eller spin/fart-kontrolinterval.",
      );
    if (!c.table.CSpin) warnings.push("Spinmodstand er en modelantagelse.");
    warnings.push("Rulle- og pitchdæmpning er referenceantagelser.");
    return {
      p: { ...p },
      points,
      duration: t,
      distance: Math.hypot(end.p[0], end.p[2]),
      forward: -end.p[2],
      lateral: end.p[0],
      apex,
      pathLength,
      landed,
      coefficients: c,
      model: "sixdof",
      diagnostics: {
        steps,
        rejected,
        maxAbsAoA,
        outsideTime,
        spinRetention: Math.abs(end.spin / points[0].spin),
        warnings,
      },
    };
  }
  function sample(flight, time) {
    const pts = flight.points;
    let lo = 0,
      hi = pts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (pts[m].t <= time) lo = m;
      else hi = m;
    }
    const a = pts[lo],
      b = pts[hi],
      u = clamp((time - a.t) / Math.max(1e-12, b.t - a.t), 0, 1),
      mix = (x, y) => x.map((v, i) => v + (y[i] - v) * u),
      out = {
        p: mix(a.p, b.p),
        v: mix(a.v, b.v),
        n: unit(mix(a.n, b.n)),
        phase: u < 0.5 ? a.phase : b.phase,
        index: lo,
      };
    if (a.q) {
      const sign = dot(a.q, b.q) < 0 ? -1 : 1;
      out.q = unit(mix(a.q, mul(b.q, sign)));
      out.n = normal(out.q);
      for (const k of [
        "spin",
        "alpha",
        "CL",
        "CD",
        "CM",
        "CRoll",
        "CSpin",
        "advanceRatio",
        "lift",
        "drag",
        "pitchMoment",
        "rollMoment",
        "spinMoment",
        "airspeed",
      ])
        out[k] = a[k] + (b[k] - a[k]) * u;
      out.omega = mix(a.omega, b.omega);
    }
    return out;
  }
  return {
    simulate,
    sample,
    coefficients,
    names,
    wind,
    density,
    spinSign,
    initial,
    stateInfo,
    aero,
    derivative,
    normal,
    D,
    G,
  };
}

export const Physics6 = createPhysics6();
export default Physics6;
```


## src/game/Round.js

```javascript
export const ROUND_SIZE = 8;
const challengeFields = [
  "model",
  "aim",
  "targetDistance",
  "targetLateral",
  "targetRadius",
  "windSpeed",
  "windFrom",
  "temperature",
  "altitude",
  "humidity",
  "spreadPower",
  "spreadAngle",
  "spreadSpin",
  "spreadWind",
  "spreadLaunch",
  "spreadAim",
];

// Release tuning is the player's choice. Targets, wind, model and spread define the challenge.
export function challengeKey(p) {
  return JSON.stringify(challengeFields.map((key) => p[key] ?? null));
}
export function discKey(p) {
  return p.discId && p.discId !== "custom"
    ? p.discId
    : "custom:" +
        JSON.stringify([
          p.discName || "",
          p.discBrand || "",
          p.speed,
          p.glide,
          p.turn,
          p.fade,
        ]);
}
export function createRound(p, variations) {
  if (!Array.isArray(variations) || variations.length !== ROUND_SIZE)
    throw new Error("En runde skal have præcis otte kast.");
  return {
    settings: structuredClone(p),
    variants: structuredClone(variations),
    throws: [],
    hits: 0,
    streak: 0,
    maxStreak: 0,
    totalMiss: 0,
    complete: false,
  };
}
export function scoreThrow(round, flight) {
  if (round.complete)
    throw new Error("Runden er afsluttet. Start en ny runde.");
  const end = flight?.points?.at(-1)?.p;
  if (!end || end.length !== 3 || !end.every(Number.isFinite))
    throw new Error("Kastet har intet gyldigt landingspunkt.");
  const p = round.settings,
    a = (((flight.p.aim ?? p.aim) - p.aim) * Math.PI) / 180;
  const x = end[0] * Math.cos(a) - end[2] * Math.sin(a);
  const z = end[0] * Math.sin(a) + end[2] * Math.cos(a);
  const miss = Math.hypot(x - p.targetLateral, -z - p.targetDistance),
    hit = miss <= p.targetRadius;
  const result = { number: round.throws.length + 1, hit, miss, x, forward: -z };
  round.throws.push(result);
  round.hits += Number(hit);
  round.streak = hit ? round.streak + 1 : 0;
  round.maxStreak = Math.max(round.maxStreak, round.streak);
  round.totalMiss += miss;
  round.complete = round.throws.length === ROUND_SIZE;
  return result;
}
export function roundRecord(round, now = new Date().toISOString()) {
  if (!round.complete)
    throw new Error("Kun færdige runder kan gemmes som rekord.");
  return {
    discId: discKey(round.settings),
    discName: round.settings.discName || "Egen disc",
    challenge: challengeKey(round.settings),
    hits: round.hits,
    averageMiss: round.totalMiss / ROUND_SIZE,
    maxStreak: round.maxStreak,
    playedAt: now,
    total: ROUND_SIZE,
  };
}
export function isBetter(candidate, current) {
  return (
    !current ||
    candidate.hits > current.hits ||
    (candidate.hits === current.hits &&
      candidate.averageMiss < current.averageMiss)
  );
}
export function findBest(records, p) {
  return (records || []).find(
    (r) => r.discId === discKey(p) && r.challenge === challengeKey(p),
  );
}
export function validateRecords(input = []) {
  if (!Array.isArray(input) || input.length > 2000)
    throw new Error("Ugyldig liste over runderekorder.");
  const result = [];
  for (const r of input) {
    if (
      !r ||
      typeof r.discId !== "string" ||
      !r.discId ||
      r.discId.length > 600 ||
      typeof r.challenge !== "string" ||
      r.challenge.length > 4000 ||
      !Number.isInteger(r.hits) ||
      r.hits < 0 ||
      r.hits > ROUND_SIZE ||
      typeof r.averageMiss !== "number" ||
      !Number.isFinite(r.averageMiss) ||
      r.averageMiss < 0 ||
      !Number.isInteger(r.maxStreak) ||
      r.maxStreak < 0 ||
      r.maxStreak > r.hits ||
      r.total !== ROUND_SIZE ||
      typeof r.playedAt !== "string" ||
      !Number.isFinite(Date.parse(r.playedAt))
    )
      throw new Error("Ugyldig runderekord i backup.");
    const record = {
      discId: r.discId,
      discName: String(r.discName || "").slice(0, 80),
      challenge: r.challenge,
      hits: r.hits,
      averageMiss: r.averageMiss,
      maxStreak: r.maxStreak,
      total: ROUND_SIZE,
      playedAt: r.playedAt,
    };
    const i = result.findIndex(
      (x) => x.discId === record.discId && x.challenge === record.challenge,
    );
    if (i < 0) result.push(record);
    else if (isBetter(record, result[i])) result[i] = record;
  }
  return result;
}
export function mergeRecords(current = [], incoming = []) {
  const result = validateRecords(current);
  for (const r of validateRecords(incoming)) {
    const i = result.findIndex(
      (x) => x.discId === r.discId && x.challenge === r.challenge,
    );
    if (i < 0) result.push(r);
    else if (isBetter(r, result[i])) result[i] = r;
  }
  return result
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
    .slice(0, 2000);
}
```


## src/ui/round.js

```javascript
import { Lab } from "../data/Lab.js";
import {
  createRound,
  scoreThrow,
  roundRecord,
  mergeRecords,
  findBest,
  isBetter,
  ROUND_SIZE,
} from "../game/Round.js";

export function mountRound({
  readSettings,
  calculate,
  getRecords,
  saveRecords,
  showFlight,
  toast,
}) {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toFixed(1).replace(".", ",");
  let round = null,
    busy = false,
    running = false,
    generation = 0;
  const error = (message) => {
    $("roundError").textContent = message;
    $("roundError").hidden = !message;
  };
  function render() {
    $("roundGrid").replaceChildren();
    for (let i = 0; i < ROUND_SIZE; i++) {
      const t = round?.throws[i],
        cell = document.createElement("div");
      cell.className =
        "round-cell " + (t ? (t.hit ? "hit" : "miss") : "pending");
      const title = document.createElement("strong"),
        value = document.createElement("span");
      title.textContent = t
        ? `${i + 1} · ${t.hit ? "Ramt" : "Forbi"}`
        : `Kast ${i + 1}`;
      value.textContent = t ? `${fmt(t.miss)} m` : "—";
      cell.append(title, value);
      $("roundGrid").append(cell);
    }
    const count = round?.throws.length || 0;
    $("roundStreak").textContent = `${round?.streak || 0} i træk`;
    $("roundScore").textContent = round
      ? `${round.hits} / ${count} ramt${count ? " · gennemsnit " + fmt(round.totalMiss / count) + " m fra centrum" : ""}${round.complete ? " · Runde slut" : ""}`
      : "Klar til en runde.";
    $("roundThrow").textContent = round?.complete
      ? "Runde afsluttet"
      : `Kast ${count + 1} / 8`;
    $("roundThrow").disabled = busy || running || !round || round.complete;
    $("startRound").disabled = busy || running || (!!round && !round.complete);
    $("startRound").textContent = round?.complete ? "Ny runde" : "Start runde";
  }
  function best(p) {
    const r = findBest(getRecords(), p);
    $("roundBest").textContent = r
      ? `Bedst med denne disc og målopsætning: ${r.hits} / 8 · ${fmt(r.averageMiss)} m fra centrum.`
      : "Ingen rekord med denne disc og målopsætning endnu.";
  }
  $("startRound").onclick = () => {
    try {
      const p = readSettings();
      round = createRound(p, Lab.variations(p, ROUND_SIZE));
      generation++;
      error("");
      best(p);
      $("roundTarget").textContent =
        `${p.discName || "Egen disc"} · mål ${fmt(p.targetDistance)} m frem / ${fmt(p.targetLateral)} m til højre · radius ${fmt(p.targetRadius)} m.`;
      render();
      $("roundThrow").focus();
    } catch (e) {
      error(e.message);
    }
  };
  $("roundThrow").onclick = async () => {
    if (busy || running || !round || round.complete) return;
    const token = generation,
      current = round;
    running = true;
    error("");
    render();
    try {
      const result = await calculate(
        [current.variants[current.throws.length]],
        `Runde · kast ${current.throws.length + 1} / 8…`,
      );
      if (token !== generation) return;
      if (result[0].error) throw new Error(result[0].error);
      scoreThrow(current, result[0].flight);
      showFlight(result[0].flight);
      render();
      if (current.complete) {
        const record = roundRecord(current),
          previous = findBest(getRecords(), current.settings);
        if (isBetter(record, previous)) {
          const saved = await saveRecords(mergeRecords(getRecords(), [record]));
          if (token !== generation) return;
          if (saved)
            toast(
              `Ny rekord: ${record.hits} / 8 ramt · ${fmt(record.averageMiss)} m fra centrum.`,
            );
          else
            error(
              "Rekorden findes kun i denne session. Eksportér en backup før du lukker appen.",
            );
        }
        if (token === generation) best(current.settings);
      }
    } catch (e) {
      if (token === generation)
        error(
          e.name === "AbortError"
            ? "Kast afbrudt. Prøv kastet igen."
            : e.message,
        );
    } finally {
      running = false;
      render();
    }
  };
  render();
  return {
    setBusy(value) {
      busy = value;
      render();
    },
    invalidate() {
      generation++;
      if (round && !round.complete)
        error("Indstillinger ændret. Start en ny runde.");
      round = null;
      $("roundTarget").textContent = "";
      $("roundBest").textContent = "";
      render();
    },
  };
}
```
