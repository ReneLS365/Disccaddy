import { Aero } from "../physics/Aero.js";
import { Flight, loadEngine } from "../physics/engines.js";
import { FlightJobs } from "../physics/FlightJobs.js";
import { Catalog } from "../data/Catalog.js";
import { Lab } from "../data/Lab.js";
import { Release } from "../data/Release.js";
import { BagData } from "../data/BagData.js";
import InputLists from "../data/InputLists.json" with { type: "json" };
import { LocalDB } from "../db/LocalDB.js";
import { Photos } from "../db/Photos.js";
import { drawFallback as renderCanvas } from "./canvas.js";
import { mountRound } from "./round.js";
import { mountTheme, palette } from "./theme.js";
import { renderWarnings } from "./warnings.js";
export async function startApp() {
  "use strict";
  const $ = (id) => document.getElementById(id),
    all = (selector) => [...document.querySelectorAll(selector)];
  const { clamp, wrap, D } = Flight,
    fmt = (n, d = 1) => Number(n).toFixed(d).replace(".", ","),
    signed = (n, d = 0) => (n > 0 ? "+" : "") + fmt(n, d);
  const numericIds = Object.keys(BagData.bounds)
    .filter((k) => k !== "power")
    .concat("powerPct");
  let roundUI = null;
  let data = BagData.empty(),
    storageOK = true,
    preserveBroken = false,
    saveTimer,
    toastTimer,
    undoAction = null;
  let images = new Map(),
    cachedCatalog = null,
    bootError = "";
  document.querySelector("main").inert = true;
  try {
    const local = await LocalDB.open();
    images = local.images;
    cachedCatalog = local.catalog;
    if (local.data) {
      data = BagData.validate(local.data);
      if (local.data.version < 6)
        bootError =
          "V6 er klar. Gemte kast beholder deres tidligere fysik. Tag en backup før du flytter til en anden fil eller browser.";
    } else {
      const raw = localStorage.getItem(BagData.KEY);
      if (raw) {
        data = BagData.validate(JSON.parse(raw));
        await LocalDB.save(data, images);
        bootError =
          "Din V3-profil og bag er opgraderet. Tidligere m/s er bevaret som procent af dit maksimum.";
      }
    }
  } catch (error) {
    storageOK = false;
    preserveBroken = true;
    bootError =
      "Gemte data kunne ikke åbnes: " +
      error.message +
      ". Du kan arbejde videre og eksportere en backup.";
  }
  document.querySelector("main").inert = false;
  let importImages = new Map();
  let settings = { ...Lab.defaults, ...data.settings },
    currentView = "simulator",
    editId = null,
    importCandidate = null,
    compassMode = "wind";
  let providerCatalog = Catalog.validate(Catalog.embedded),
    catalogDate = Catalog.snapshotDate,
    catalogMessage = "Indbygget offlinekatalog",
    discDBLoad = false;
  try {
    if (cachedCatalog) {
      providerCatalog = Catalog.validate(cachedCatalog.entries);
      catalogDate = cachedCatalog.date;
      catalogMessage = "Lokalt opdateret katalog";
    }
  } catch (error) {
    console.warn("Gemte katalogdata kunne ikke læses.", error);
    catalogMessage = "Gemte katalogdata var ugyldige. Offlinekataloget bruges.";
  }
  let discDB = Catalog.merge(providerCatalog, Catalog.seed, data.catalog || []);
  let flights = [],
    active = 0,
    playhead = 0,
    playing = false,
    phaseState = "Klar",
    cameraMode = "overview";
  let viz = null,
    dirty = true,
    frameId = 0,
    previous = performance.now(),
    lastPoint = null;
  const phaseColors = { Turn: "#70dfef", Glide: "#c4f275", Fade: "#ffba76" };
  const compareColors = ["#70dfef", "#c4f275", "#eeb0dc"];
  function el(tag, className, content) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (content !== undefined) n.textContent = content;
    return n;
  }
  function toast(message, undo = null) {
    clearTimeout(toastTimer);
    undoAction = undo;
    $("toastText").textContent = message;
    $("undo").hidden = !undo;
    $("toast").hidden = false;
    if (!undo) toastTimer = setTimeout(() => ($("toast").hidden = true), 5500);
  }
  $("dismissToast").onclick = () => {
    $("toast").hidden = true;
    undoAction = null;
  };
  $("undo").onclick = () => {
    const action = undoAction;
    undoAction = null;
    $("toast").hidden = true;
    if (action) action();
  };
  function showStorage() {
    $("saveStatus").textContent = storageOK ? "Gemt lokalt" : "Kun i session";
    $("saveStatus").classList.toggle("warning", !storageOK);
    $("storageNote").textContent = storageOK
      ? "Gemmes lokalt i denne browser. Tag en backup før du sletter browserdata eller skifter enhed."
      : "Lokal lagring er ikke tilgængelig, eller gemte data kunne ikke læses. Dine ændringer findes kun i denne session. Eksportér en backup, før du lukker siden.";
  }
  let saveRevision = 0;
  async function persist() {
    clearTimeout(saveTimer);
    settings = Release.resolve(settings, data.profile);
    data.settings = { ...settings };
    const revision = ++saveRevision;
    if (preserveBroken) {
      showStorage();
      return false;
    }
    $("saveStatus").textContent = "Gemmer…";
    try {
      await LocalDB.save(data, images);
      storageOK = true;
    } catch (error) {
      storageOK = false;
      console.error("Kunne ikke gemme appdata.", error);
      toast("Kunne ikke gemme: " + error.message);
    }
    if (revision === saveRevision) showStorage();
    return storageOK;
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    $("saveStatus").textContent = preserveBroken
      ? "Kun i session"
      : "Ændringer venter…";
    saveTimer = setTimeout(persist, 250);
  }
  addEventListener("pagehide", persist);
  function findDisc(id = settings.discId) {
    return (
      data.bag.find((d) => d.id === id) ||
      BagData.presets.find((d) => d.id === id)
    );
  }
  function discName(p = settings) {
    return p.discName || findDisc(p.discId)?.name || "Egen opsætning";
  }
  function safeValue(id, previousValue) {
    const input = $(id),
      raw = input.valueAsNumber;
    if (!Number.isFinite(raw)) return previousValue;
    const min = Number(input.min),
      max = Number(input.max);
    return clamp(raw, min, max);
  }
  function readSettings() {
    for (const id of numericIds) {
      settings[id] = safeValue(id, settings[id]);
      $(id).value = settings[id];
    }
    settings.method = $("style").value;
    settings = Release.resolve(settings, data.profile);
    const p = {
      ...currentAeroParams(),
      ...Lab.validate(settings),
      discColor: findDisc()?.color || settings.discColor || "#c4f275",
    };
    if (p.model === "sixdof") p.aeroSnapshot = Aero.resolve(p);
    return p;
  }
  function writeSettings() {
    for (const id of numericIds) $(id).value = settings[id];
    $("style").value = Release.method(settings);
    renderDiscSelect();
    updateLabels();
    fillLab();
  }
  function fingerprint(p) {
    return Lab.signature(p);
  }
  function changed() {
    settings = Release.resolve(settings, data.profile);
    invalidateCalculation();
    updateLabels();
    updateLabLabels();
    renderDiscPager();
    $("stale").hidden =
      !flights.length ||
      fingerprint(settings) === fingerprint(flights[active].p);
    scheduleSave();
    requestFrame();
  }
  function renderDiscSelect() {
    const select = $("discSelect");
    select.replaceChildren();
    if (data.bag.length) {
      const g = el("optgroup");
      g.label = "Min bag";
      for (const d of [...data.bag].sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          a.name.localeCompare(b.name, "da"),
      )) {
        const o = el(
          "option",
          "",
          (d.favorite ? "★ " : "") +
            d.name +
            " · " +
            [d.speed, d.glide, d.turn, d.fade].join(" / "),
        );
        o.value = d.id;
        g.append(o);
      }
      select.append(g);
    }
    const examples = el("optgroup");
    examples.label = "Eksempler";
    for (const d of BagData.presets) {
      const o = el(
        "option",
        "",
        d.name + " · " + [d.speed, d.glide, d.turn, d.fade].join(" / "),
      );
      o.value = d.id;
      examples.append(o);
    }
    select.append(examples);
    const custom = el("option", "", "Egne flight numbers");
    custom.value = "custom";
    select.append(custom);
    if (!findDisc(settings.discId)) settings.discId = "custom";
    select.value = settings.discId;
    renderDiscPager();
    $("bagCount").textContent = data.bag.length;
  }
  function selectDisc(id) {
    const d = findDisc(id);
    settings.discId = d ? id : "custom";
    settings.discName = d?.name || "";
    settings.discColor = d?.color || "#c4f275";
    if (d) {
      for (const k of ["speed", "glide", "turn", "fade"]) settings[k] = d[k];
      settings.weight = d.weight ?? 175;
      Object.assign(settings, discAeroConfig(d), {
        aeroSnapshot: null,
        discBrand: d.brand || "",
      });
      if (settings.model !== "sixdof") settings.aeroPreset = "ratings";
    }
    writeSettings();
    changed();
  }
  $("discSelect").addEventListener("change", () =>
    selectDisc($("discSelect").value),
  );
  function directionLabel(a) {
    return ["N", "NØ", "Ø", "SØ", "S", "SV", "V", "NV"][
      Math.round(wrap(a) / 45) % 8
    ];
  }
  function updateLabels() {
    settings = Release.resolve(settings, data.profile);
    $("powerOut").value =
      fmt(settings.powerPct, 0) + " % · " + fmt(settings.power) + " m/s";
    $("handHint").textContent =
      (data.profile.hand === "L" ? "Venstre" : "Højre") +
      " hånd fra profilen · " +
      settings.style +
      " · maks. " +
      fmt(settings.maxPower) +
      " m/s";
    $("hyzerOut").value = signed(settings.hyzer) + "°";
    $("noseOut").value = signed(settings.nose) + "°";
    $("windSpeedOut").value = settings.windSpeed
      ? fmt(settings.windSpeed) +
        " m/s · " +
        fmt(settings.windSpeed * 3.6, 0) +
        " km/t"
      : "Vindstille";
    $("cruise").textContent =
      settings.model === "legacy" ? "V4-reference" : "6-DOF";
    $("windArrow").setAttribute(
      "transform",
      "rotate(" + settings.windFrom + " 140 140)",
    );
    $("windArrow").setAttribute("opacity", settings.windSpeed ? 1 : 0.35);
    $("aimArrow").setAttribute(
      "transform",
      "rotate(" + settings.aim + " 140 140)",
    );
    const angle = compassMode === "wind" ? settings.windFrom : settings.aim;
    $("compass").setAttribute("aria-valuenow", angle);
    $("compass").setAttribute(
      "aria-valuetext",
      angle + " grader, " + directionLabel(angle),
    );
    $("compass").setAttribute(
      "aria-label",
      (compassMode === "wind" ? "Vind fra" : "Kast mod") +
        ", grader med uret fra nord",
    );
    $("windReading").textContent =
      (settings.windSpeed ? "Fra " : "Retning ved vind: ") +
      directionLabel(settings.windFrom) +
      " " +
      fmt(settings.windFrom, 0) +
      "° → " +
      directionLabel(settings.windFrom + 180);
    const w = Flight.wind(settings),
      parts = [];
    if (Math.abs(w[2]) > 0.05)
      parts.push(
        fmt(Math.abs(w[2])) + " m/s " + (w[2] > 0 ? "modvind" : "medvind"),
      );
    if (Math.abs(w[0]) > 0.05)
      parts.push(
        fmt(Math.abs(w[0])) + " m/s fra " + (w[0] > 0 ? "venstre" : "højre"),
      );
    $("windComponents").textContent =
      (parts.join(" · ") || "Vindstille") +
      " · Kast mod " +
      directionLabel(settings.aim) +
      " " +
      fmt(settings.aim, 0) +
      "°";
    const d = findDisc(),
      matches =
        d &&
        ["speed", "glide", "turn", "fade"].every((k) => settings[k] === d[k]);
    $("discInfo").textContent =
      d && matches
        ? (d.brand ? d.brand + " · " : "") +
          (d.plastic ? d.plastic + " · " : "") +
          (d.weight == null
            ? "Vægt ukendt · model " + fmt(settings.weight, 0) + " g"
            : fmt(settings.weight, 0) + " g")
        : "Egne tal · modelvægt " + fmt(settings.weight, 0) + " g";
    for (const b of all("#anglePresets button")) {
      const selected = Number(b.dataset.angle) === settings.hyzer;
      b.classList.toggle("active", selected);
      b.setAttribute("aria-pressed", String(selected));
    }
    $("angleHint").textContent =
      settings.hyzer === 20
        ? "Hyzerflip starter i hyzer. Om discen retter op, afhænger af disc, hastighed og vind."
        : "Positiv hyzer hælder mod fade-siden. " +
          (Flight.spinSign(settings.style) > 0
            ? "Dette kast turner mod højre og fader mod venstre."
            : "Dette kast turner mod venstre og fader mod højre.");
  }
  for (const id of numericIds) {
    $(id).addEventListener("input", () => {
      if (!Number.isFinite($(id).valueAsNumber)) return;
      settings[id] = safeValue(id, settings[id]);
      if (id === "rpm")
        settings[Release.method(settings) === "BH" ? "bhRpm" : "fhRpm"] =
          settings.rpm;
      if (
        settings.model !== "sixdof" &&
        ["speed", "glide", "turn", "fade"].includes(id)
      ) {
        settings.discId = "custom";
        settings.discName = "Egne flighttal";
        $("discSelect").value = "custom";
      }
      changed();
    });
    $(id).addEventListener("change", () => {
      settings[id] = safeValue(id, settings[id]);
      $(id).value = settings[id];
      changed();
    });
  }
  $("style").addEventListener("change", () => {
    settings[Release.method(settings) === "BH" ? "bhRpm" : "fhRpm"] =
      settings.rpm;
    settings.method = $("style").value;
    settings.rpm = settings[settings.method === "BH" ? "bhRpm" : "fhRpm"];
    settings = Release.resolve(settings, data.profile);
    writeSettings();
    changed();
  });
  for (const b of all("#anglePresets button"))
    b.onclick = () => {
      settings.hyzer = Number(b.dataset.angle);
      $("hyzer").value = settings.hyzer;
      changed();
    };
  $("calm").onclick = () => {
    settings.windSpeed = 0;
    $("windSpeed").value = 0;
    changed();
  };
  for (let i = 0; i < 36; i++) {
    const angle = i * 10 * D,
      r = i % 9 === 0 ? 95 : 102,
      node = document.createElementNS("http://www.w3.org/2000/svg", "line");
    node.setAttribute("x1", 140 + Math.sin(angle) * r);
    node.setAttribute("y1", 140 - Math.cos(angle) * r);
    node.setAttribute("x2", 140 + Math.sin(angle) * 109);
    node.setAttribute("y2", 140 - Math.cos(angle) * 109);
    $("compassTicks").append(node);
  }
  function setCompassMode(mode) {
    compassMode = mode;
    for (const [id, m] of [
      ["windMode", "wind"],
      ["aimMode", "aim"],
    ]) {
      $(id).classList.toggle("active", m === mode);
      $(id).setAttribute("aria-pressed", String(m === mode));
    }
    updateLabels();
  }
  $("windMode").onclick = () => setCompassMode("wind");
  $("aimMode").onclick = () => setCompassMode("aim");
  function compassSet(angle) {
    const id = compassMode === "wind" ? "windFrom" : "aim";
    settings[id] = wrap(Math.round(angle));
    $(id).value = settings[id];
    changed();
  }
  function compassPointer(event) {
    const r = $("compass").getBoundingClientRect(),
      x = event.clientX - r.left - r.width / 2,
      y = event.clientY - r.top - r.height / 2;
    if (Math.hypot(x, y) < 10) return;
    compassSet(Math.atan2(x, -y) / D);
  }
  let dragging = false;
  $("compass").addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    $("compass").setPointerCapture(event.pointerId);
    compassPointer(event);
  });
  $("compass").addEventListener("pointermove", (event) => {
    if (dragging) compassPointer(event);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    $("compass").addEventListener(type, () => (dragging = false));
  $("compass").addEventListener("keydown", (event) => {
    let delta = 0;
    if (event.key === "ArrowRight" || event.key === "ArrowUp")
      delta = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown")
      delta = event.shiftKey ? -10 : -1;
    if (delta || event.key === "Home") {
      event.preventDefault();
      compassSet(
        event.key === "Home"
          ? 0
          : (compassMode === "wind" ? settings.windFrom : settings.aim) + delta,
      );
    }
  });
  function showView(view) {
    if (!["simulator", "bag", "profile"].includes(view)) view = "simulator";
    currentView = view;
    if (view !== "simulator") {
      playing = false;
      document.body.classList.remove("expanded");
      $("expand").setAttribute("aria-pressed", "false");
    }
    for (const key of ["simulator", "bag", "profile"])
      $(key + "View").hidden = key !== view;
    for (const button of all(".nav")) {
      button.classList.toggle("active", button.dataset.view === view);
      if (button.dataset.view === view)
        button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (view === "bag") renderBag();
    if (view === "profile") {
      fillProfile();
      refreshCatalog();
    }
    if (view === "simulator") {
      resize();
      updatePlayback();
      requestFrame();
    }
  }
  for (const b of all(".nav")) b.onclick = () => showView(b.dataset.view);
  document.querySelector(".brand").onclick = (e) => {
    e.preventDefault();
    showView("simulator");
  };
  $("openBag").onclick = () => showView("bag");
  let catalogLimit = 24,
    searchTimer = 0,
    chosenCatalog = null;
  function refreshCatalog() {
    discDB = Catalog.merge(providerCatalog, Catalog.seed, data.catalog || []);
    const selected = $("catalogBrand").value;
    $("catalogBrand").replaceChildren();
    const first = el("option", "", "Alle mærker");
    first.value = "all";
    $("catalogBrand").append(first);
    for (const name of [...new Set(discDB.map((d) => d.brand))].sort((a, b) =>
      a.localeCompare(b, "da"),
    )) {
      const o = el("option", "", name);
      o.value = name;
      $("catalogBrand").append(o);
    }
    $("catalogBrand").value = [...$("catalogBrand").options].some(
      (o) => o.value === selected,
    )
      ? selected
      : "all";
    $("catalogStatus").textContent =
      discDB.length +
      " modeller · DiscIt " +
      providerCatalog.length +
      " · " +
      catalogDate +
      " · " +
      catalogMessage +
      ". Egne importer: " +
      (data.catalog?.length || 0) +
      ". Ingen kilde garanterer alle discs på markedet.";
    if (!$("catalogStep").hidden) renderCatalog();
  }
  function resetCatalog() {
    clearTimeout(searchTimer);
    catalogLimit = 24;
    $("discSearch").value = "";
    $("catalogBrand").value = "all";
    $("catalogType").value = "all";
    renderCatalog();
  }
  function catalogMatches() {
    return Catalog.search(
      discDB,
      $("discSearch").value,
      $("catalogBrand").value,
      $("catalogType").value,
    );
  }
  function renderCatalog(resetScroll = true) {
    const scroller = $("catalogStep").querySelector(".catalog-scroll"),
      previousScroll = scroller.scrollTop;
    const results = catalogMatches();
    $("discSearchResults").replaceChildren();
    $("catalogCount").textContent =
      results.length + " match · " + discDB.length + " modeller i kataloget";
    if (!results.length)
      $("discSearchResults").append(
        el(
          "p",
          "disc-no-results",
          "Ingen match. Prøv et kortere navn, vælg et andet filter, eller opret discen med dine egne tal.",
        ),
      );
    for (const d of results.slice(0, catalogLimit)) {
      const button = el("button", "disc-result-item"),
        copy = el("span"),
        owned = data.bag.filter(
          (x) => Catalog.key(x) === Catalog.key(d),
        ).length;
      button.type = "button";
      copy.append(
        el("strong", "", d.name),
        el("small", "", d.brand + (owned ? " · " + owned + " i din bag" : "")),
        el("span", "result-numbers", flightText(d.flight_numbers)),
      );
      button.append(copy, el("span", "result-arrow", "＋"));
      button.setAttribute("aria-label", "Vælg " + d.brand + " " + d.name);
      button.onclick = () => applyDiscResult(d);
      $("discSearchResults").append(button);
    }
    $("moreDiscs").hidden = results.length <= catalogLimit;
    scroller.scrollTop = resetScroll ? 0 : previousScroll;
  }
  function showCatalogStep() {
    $("catalogStep").hidden = false;
    $("discForm").hidden = true;
    $("discDialogTitle").textContent = "Find din disc";
    $("discError").hidden = true;
    renderCatalog();
    $("discDialogTitle").focus({ preventScroll: true });
  }
  function showDiscFields() {
    $("catalogStep").hidden = true;
    $("discForm").hidden = false;
    $("discDialogTitle").textContent = editId ? "Redigér disc" : "Din variant";
    $("backToCatalog").hidden = !!editId;
    $("discTemplateLabel").hidden = !!chosenCatalog || !!editId;
    $("discForm").querySelector(".form-fields").scrollTop = 0;
    $("discDialogTitle").focus({ preventScroll: true });
  }
  let photoEpoch = 0,
    draftImageId = "",
    draftImageBlob = null,
    photoPreviewURL = "",
    photoBusy = false;
  const imageURLs = new Map();
  function imageSource(d) {
    if (d.imageId && images.has(d.imageId)) {
      if (!imageURLs.has(d.imageId))
        imageURLs.set(d.imageId, URL.createObjectURL(images.get(d.imageId)));
      return imageURLs.get(d.imageId);
    }
    return d.imageUrl || "";
  }
  function decoratePhoto(swatch, d) {
    const src = imageSource(d);
    if (!src) return;
    const img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = src;
    img.onerror = () => {
      img.remove();
      swatch.classList.remove("has-photo");
    };
    swatch.classList.add("has-photo");
    swatch.append(img);
  }
  function updatePhotoPreview() {
    if (photoPreviewURL) URL.revokeObjectURL(photoPreviewURL);
    photoPreviewURL = draftImageBlob ? URL.createObjectURL(draftImageBlob) : "";
    const src =
      photoPreviewURL ||
      imageSource({ imageId: draftImageId, imageUrl: $("discImageUrl").value });
    $("discPhotoPreview").hidden = !src;
    if (src) $("discPhotoPreview").src = src;
    else $("discPhotoPreview").removeAttribute("src");
  }
  $("photoCamera").onclick = () => $("photoCameraFile").click();
  $("photoGallery").onclick = () => $("photoGalleryFile").click();
  for (const id of ["photoCameraFile", "photoGalleryFile"])
    $(id).onchange = async () => {
      const f = $(id).files?.[0];
      if (!f) return;
      const epoch = ++photoEpoch;
      photoBusy = true;
      $("saveDiscButton").disabled = true;
      $("photoStatus").textContent = "Tilpasser billedet…";
      try {
        const resized = await Photos.resize(f);
        if (epoch !== photoEpoch) return;
        draftImageBlob = resized;
        draftImageId = BagData.id();
        $("discImageUrl").value = "";
        updatePhotoPreview();
        $("photoStatus").textContent =
          "Klar · " +
          Math.round(draftImageBlob.size / 1024) +
          " KB · højst 1024 px";
      } catch (e) {
        $("photoStatus").textContent = e.message;
      } finally {
        if (epoch === photoEpoch) {
          photoBusy = false;
          $("saveDiscButton").disabled = false;
          $(id).value = "";
        }
      }
    };
  $("photoRemove").onclick = () => {
    draftImageId = "";
    draftImageBlob = null;
    $("discImageUrl").value = "";
    updatePhotoPreview();
  };
  $("discImageUrl").onchange = () => {
    draftImageId = "";
    draftImageBlob = null;
    updatePhotoPreview();
  };
  function fillDiscFields(d) {
    photoEpoch++;
    photoBusy = false;
    $("saveDiscButton").disabled = false;
    draftImageId = d.imageId || "";
    draftImageBlob = null;
    $("discImageUrl").value = d.imageUrl || "";
    updatePhotoPreview();

    for (const k of [
      "name",
      "brand",
      "plastic",
      "speed",
      "glide",
      "turn",
      "fade",
      "weight",
      "color",
      "notes",
    ])
      $("disc" + k[0].toUpperCase() + k.slice(1)).value = d[k] ?? "";
    $("discFavorite").checked = !!d.favorite;
  }
  function showDiscDialog(d = null, editing = false) {
    editId = editing ? d.id : null;
    chosenCatalog = null;
    $("discError").hidden = true;
    $("catalogSelection").hidden = true;
    $("discTemplate").value = "custom";
    renderPlasticSuggestions([]);
    fillDiscFields(
      d || { ...BagData.presets[2], name: "", brand: "", weight: null },
    );
    resetCatalog();
    if (d) {
      $("catalogStep").hidden = true;
      $("discForm").hidden = false;
    } else {
      $("catalogStep").hidden = false;
      $("discForm").hidden = true;
    }
    $("discDialog").showModal();
    if (d) showDiscFields();
    else showCatalogStep();
  }
  function renderPlasticSuggestions(list) {
    $("plasticSuggest").replaceChildren();
    $("plasticSuggest").hidden = !list.length;
    for (const plastic of list) {
      const b = el("button", "", plastic);
      b.type = "button";
      b.setAttribute(
        "aria-pressed",
        String($("discPlastic").value === plastic),
      );
      b.onclick = () => {
        $("discPlastic").value = plastic;
        renderPlasticSuggestions(list);
      };
      $("plasticSuggest").append(b);
    }
  }
  function applyDiscResult(d) {
    chosenCatalog = d;
    fillDiscFields({
      name: d.name,
      brand: d.brand,
      ...d.flight_numbers,
      plastic: "",
      weight: null,
      color: "#c4f275",
      notes: "",
      favorite: false,
    });
    $("discTemplate").value = "custom";
    renderPlasticSuggestions(d.plastics || []);
    const selection = $("catalogSelection");
    selection.replaceChildren();
    selection.append(
      document.createTextNode(
        d.brand + " " + d.name + " · " + flightText(d.flight_numbers),
      ),
    );
    if (d.source) {
      selection.append(el("br"));
      const source = el("a", "", "Kilde til discdata ↗");
      source.href = d.source;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      selection.append(source);
    }
    selection.hidden = false;
    $("discSearch").blur();
    showDiscFields();
  }
  $("addDisc").onclick =
    $("addFirstDisc").onclick =
    $("addFromSimulator").onclick =
      () => showDiscDialog();
  $("saveCurrentDisc").onclick = () => {
    readSettings();
    const d = findDisc();
    showDiscDialog({
      ...settings,
      name: d?.name || "",
      brand: d?.brand === "Eksempel" ? "" : d?.brand || "",
      plastic: d?.plastic || "",
      weight: d?.weight == null ? null : settings.weight,
      color: d?.color || "#c4f275",
      imageId: d?.imageId || "",
      imageUrl: d?.imageUrl || "",
    });
  };
  for (const b of all("[data-close]"))
    b.onclick = () => $(b.dataset.close).close();
  $("discTemplate").onchange = () => {
    const d = findDisc($("discTemplate").value);
    if (!d) return;
    for (const k of ["speed", "glide", "turn", "fade", "color"])
      $("disc" + k[0].toUpperCase() + k.slice(1)).value = d[k];
  };
  $("manualDisc").onclick = () => {
    chosenCatalog = null;
    fillDiscFields({
      ...BagData.presets[2],
      name: $("discSearch").value.trim(),
      brand: "",
      weight: null,
    });
    $("catalogSelection").hidden = true;
    renderPlasticSuggestions([]);
    showDiscFields();
  };
  $("backToCatalog").onclick = showCatalogStep;
  $("discSearch").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      catalogLimit = 24;
      renderCatalog();
    }, 120);
  };
  $("discSearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      clearTimeout(searchTimer);
      catalogLimit = 24;
      renderCatalog();
      const matches = catalogMatches();
      if (event.key === "Enter" && matches.length === 1)
        applyDiscResult(matches[0]);
      else $("discSearchResults").querySelector("button")?.focus();
    }
  });
  $("clearDiscSearch").onclick = () => {
    clearTimeout(searchTimer);
    $("discSearch").value = "";
    catalogLimit = 24;
    renderCatalog();
    $("discSearch").focus();
  };
  $("catalogBrand").onchange = $("catalogType").onchange = () => {
    catalogLimit = 24;
    renderCatalog();
  };
  $("moreDiscs").onclick = () => {
    catalogLimit += 24;
    renderCatalog(false);
  };
  async function loadDiscDB() {
    if (discDBLoad) return;
    discDBLoad = true;
    $("refreshCatalog").disabled = true;
    catalogMessage = "Henter opdatering…";
    refreshCatalog();
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("https://discit-api.fly.dev/disc", {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-cache",
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      if (Number(response.headers.get("content-length")) > 10 * 1024 * 1024)
        throw new Error("Svaret er for stort.");
      const text = await response.text();
      if (text.length > 10 * 1024 * 1024)
        throw new Error("Svaret er for stort.");
      const entries = Catalog.fromAPI(JSON.parse(text));
      if (entries.length < providerCatalog.length * 0.8)
        throw new Error("Ufuldstændigt katalog; den lokale kopi beholdes.");
      const date = new Date().toISOString().slice(0, 10);
      await LocalDB.cache({ entries, date });
      providerCatalog = entries;
      catalogDate = date;
      catalogMessage = "Opdatering hentet og gemt";
    } catch (error) {
      catalogMessage =
        "Opdatering fejlede (" +
        (error.name === "AbortError"
          ? "timeout efter 12 sek."
          : error.message) +
        "). Offlinekataloget er stadig klar";
    } finally {
      clearTimeout(timeout);
      discDBLoad = false;
      $("refreshCatalog").disabled = false;
      refreshCatalog();
    }
  }
  $("refreshCatalog").onclick = loadDiscDB;
  $("importCatalog").onclick = () => $("catalogFile").click();
  $("catalogFile").addEventListener("change", async () => {
    const file = $("catalogFile").files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Kataloget må højst være 2 MB.");
      const entries = Catalog.validate(JSON.parse(await file.text()));
      if (!entries.length) throw new Error("Kataloget er tomt.");
      const combined = Catalog.merge(data.catalog || [], entries);
      if (combined.length > 20000)
        throw new Error("Maksimum er 20.000 importerede modeller.");
      data.catalog = combined;
      refreshCatalog();
      persist();
      toast(entries.length + " modeller indlæst. Din bag er uændret.");
    } catch (error) {
      toast(error.message);
    } finally {
      $("catalogFile").value = "";
    }
  });

  $("discForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (photoBusy || !$("discForm").reportValidity()) return;
    try {
      if (!editId && data.bag.length >= 200)
        throw new Error("Din bag kan højst indeholde 200 discs.");
      const input = {
        ...(data.bag.find((d) => d.id === editId) || {}),
        id: editId || BagData.id(),
        name: $("discName").value,
        brand: $("discBrand").value,
        plastic: $("discPlastic").value,
        notes: $("discNotes").value,
        color: $("discColor").value,
        favorite: $("discFavorite").checked,
        weight:
          $("discWeight").value === "" ? null : $("discWeight").valueAsNumber,
      };
      for (const k of ["speed", "glide", "turn", "fade"])
        input[k] = $("disc" + k[0].toUpperCase() + k.slice(1)).valueAsNumber;
      input.imageId = draftImageId;
      input.imageUrl = $("discImageUrl").value;
      const d = BagData.disc(input),
        index = data.bag.findIndex((x) => x.id === editId);
      if (draftImageBlob) images.set(d.imageId, draftImageBlob);
      if (index >= 0) data.bag[index] = d;
      else data.bag.push(d);
      $("discDialog").close();
      renderBag();
      selectDisc(d.id);
      refreshCatalog();
      const saved = await persist();
      toast(
        (index >= 0 ? "Opdateret: " : "Tilføjet: ") +
          d.name +
          (saved ? "" : " · Kun i session — eksportér en backup."),
      );
    } catch (error) {
      $("discError").textContent = error.message;
      $("discError").hidden = false;
    }
  });
  let detailId = null,
    detailIds = [];
  function flightText(d) {
    return ["speed", "glide", "turn", "fade"]
      .map((k) =>
        d[k] == null ? "?" : fmt(d[k], Number.isInteger(d[k]) ? 0 : 1),
      )
      .join(" / ");
  }
  function pagerDiscs() {
    return data.bag.length
      ? [...data.bag].sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) ||
            a.speed - b.speed ||
            a.name.localeCompare(b.name, "da"),
        )
      : BagData.presets;
  }
  function renderDiscPager() {
    const list = pagerDiscs(),
      index = list.findIndex((d) => d.id === settings.discId),
      d = findDisc();
    $("selectedDiscName").textContent = d?.name || "Egen opsætning";
    $("selectedDiscNumbers").textContent = flightText(settings);
    $("discPagerInfo").textContent =
      (data.bag.length ? "Min bag" : "Eksempler") +
      " · " +
      (index < 0 ? "Vælg disc" : index + 1 + " / " + list.length) +
      " ›";
    $("releaseDiscName").textContent = d?.name || "Egen opsætning";
    $("previousDisc").disabled = $("nextDisc").disabled = list.length < 2;
  }
  function moveDisc(delta) {
    const list = pagerDiscs(),
      index = list.findIndex((d) => d.id === settings.discId);
    if (!list.length) return;
    selectDisc(
      list[
        ((index < 0 ? (delta > 0 ? -1 : 0) : index) + delta + list.length) %
          list.length
      ].id,
    );
  }
  $("previousDisc").onclick = () => moveDisc(-1);
  $("nextDisc").onclick = () => moveDisc(1);
  function renderPicker() {
    const q = Catalog.fold($("pickerSearch").value),
      matches = (d) =>
        Catalog.fold(d.name + " " + d.brand + " " + (d.plastic || "")).includes(
          q,
        );
    $("pickerResults").replaceChildren();
    let count = 0;
    for (const [title, list] of [
      ["Min bag", pagerDiscs().filter((d) => !d.id.startsWith("demo:"))],
      ["Eksempler", BagData.presets],
    ]) {
      const found = list.filter(matches);
      if (!found.length) continue;
      $("pickerResults").append(el("h3", "", title));
      for (const d of found) {
        const b = el(
          "button",
          "picker-result" + (settings.discId === d.id ? " active" : ""),
        );
        b.type = "button";
        b.setAttribute("aria-pressed", String(settings.discId === d.id));
        b.append(
          el("strong", "", (d.favorite ? "★ " : "") + d.name),
          el(
            "small",
            "",
            [d.brand, d.plastic, flightText(d)].filter(Boolean).join(" · "),
          ),
        );
        b.onclick = () => {
          selectDisc(d.id);
          $("pickerDialog").close();
        };
        $("pickerResults").append(b);
        count++;
      }
    }
    $("pickerCount").textContent = count
      ? count + " valgmuligheder"
      : "Ingen match. Du kan tilføje en ny disc nedenfor.";
  }
  $("chooseDisc").onclick = () => {
    $("pickerSearch").value = "";
    renderPicker();
    $("pickerDialog").showModal();
  };
  $("pickerSearch").oninput = renderPicker;
  $("pickerAdd").onclick = () => {
    $("pickerDialog").close();
    showDiscDialog();
  };
  function filteredBag() {
    const terms = Catalog.fold($("bagSearch").value)
        .split(/\s+/)
        .filter(Boolean),
      filter = $("bagFilter").value,
      sort = $("bagSort").value;
    const list = data.bag.filter(
      (d) =>
        (filter === "all" ||
          (filter === "favorites" && d.favorite) ||
          BagData.category(d) === filter) &&
        terms.every((t) =>
          Catalog.fold(
            [d.name, d.brand, d.plastic, d.notes].join(" "),
          ).includes(t),
        ),
    );
    if (sort === "recent") return list.reverse();
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "da")
        : sort === "brand"
          ? a.brand.localeCompare(b.brand, "da") ||
            a.name.localeCompare(b.name, "da")
          : a.speed - b.speed || a.name.localeCompare(b.name, "da"),
    );
  }
  function renderBag() {
    const discs = filteredBag();
    $("bagGrid").replaceChildren();
    $("bagEmpty").hidden = data.bag.length > 0;
    $("bagResultCount").textContent =
      discs.length + " af " + data.bag.length + " discs";
    $("clearBagFilters").hidden =
      !$("bagSearch").value && $("bagFilter").value === "all";
    if (data.bag.length && !discs.length)
      $("bagGrid").append(
        el(
          "p",
          "hint",
          "Ingen discs matcher. Nulstil filtrene for at se hele din bag.",
        ),
      );
    for (const d of discs) {
      const card = el("article", "disc-card"),
        button = el("button", "disc-row-main"),
        swatch = el("span", "disc-swatch"),
        text = el("span", "disc-card-title");
      swatch.style.background = d.color;
      decoratePhoto(swatch, d);
      swatch.setAttribute("aria-hidden", "true");
      text.append(
        el("h2", "", d.name),
        el(
          "span",
          "brand-line",
          [d.brand, d.plastic].filter(Boolean).join(" · ") || "Egen disc",
        ),
        el("span", "disc-row-numbers", flightText(d)),
      );
      button.append(swatch, text);
      button.setAttribute("aria-label", "Vis " + d.name);
      button.onclick = () =>
        openDetail(
          d.id,
          discs.map((x) => x.id),
        );
      const favorite = el(
        "button",
        "favorite-button" + (d.favorite ? " selected" : ""),
        d.favorite ? "★" : "☆",
      );
      favorite.setAttribute(
        "aria-label",
        (d.favorite ? "Fjern favorit: " : "Markér favorit: ") + d.name,
      );
      favorite.setAttribute("aria-pressed", String(d.favorite));
      favorite.onclick = () => {
        d.favorite = !d.favorite;
        renderBag();
        renderDiscSelect();
        renderDiscPager();
        persist();
      };
      card.append(button, favorite);
      $("bagGrid").append(card);
    }
    $("bagCount").textContent = data.bag.length;
  }
  function refilterBag() {
    renderBag();
    $("bagScroll").scrollTop = 0;
  }
  $("bagSearch").oninput =
    $("bagFilter").onchange =
    $("bagSort").onchange =
      refilterBag;
  $("clearBagFilters").onclick = () => {
    $("bagSearch").value = "";
    $("bagFilter").value = "all";
    refilterBag();
  };
  function openDetail(id, ids = null) {
    detailId = id;
    if (ids) detailIds = ids;
    const d = data.bag.find((x) => x.id === id);
    if (!d) return;
    const container = $("detailContent");
    container.replaceChildren();
    const head = el("div", "detail-disc-head"),
      swatch = el("span", "disc-swatch"),
      copy = el("div");
    swatch.style.background = d.color;
    decoratePhoto(swatch, d);
    swatch.setAttribute("aria-hidden", "true");
    copy.append(
      el("h3", "", d.name),
      el(
        "p",
        "",
        [d.brand, d.plastic].filter(Boolean).join(" · ") || "Egen disc",
      ),
    );
    head.append(swatch, copy);
    container.append(head);
    const chips = el("div", "flight-chips");
    for (const k of ["speed", "glide", "turn", "fade"]) {
      const item = el("div", "", fmt(d[k], Number.isInteger(d[k]) ? 0 : 1));
      item.append(el("small", "", k.toUpperCase()));
      chips.append(item);
    }
    container.append(chips);
    container.append(
      el(
        "p",
        "disc-meta",
        BagData.categoryLabel[BagData.category(d)] +
          " · " +
          (d.weight == null
            ? "Vægt ukendt · model 175 g"
            : fmt(d.weight, 0) + " g") +
          (d.favorite ? " · ★ Favorit" : ""),
      ),
      el(
        "p",
        "disc-notes",
        d.notes || "Ingen noter endnu. Tilføj dine erfaringer under Redigér.",
      ),
    );
    detailIds = detailIds.filter((x) => data.bag.some((d) => d.id === x));
    const index = detailIds.indexOf(id);
    $("detailPosition").textContent =
      index + 1 + " / " + detailIds.length + " i denne liste";
    $("detailPrevious").disabled = $("detailNext").disabled =
      detailIds.length < 2;
    if (!$("detailDialog").open) $("detailDialog").showModal();
    $("detailDialog").querySelector(".detail-scroll").scrollTop = 0;
  }
  function detailMove(delta) {
    if (!detailIds.length) return;
    const at = detailIds.indexOf(detailId);
    openDetail(detailIds[(at + delta + detailIds.length) % detailIds.length]);
  }
  $("detailPrevious").onclick = () => detailMove(-1);
  $("detailNext").onclick = () => detailMove(1);
  $("detailUse").onclick = () => {
    selectDisc(detailId);
    $("detailDialog").close();
    showView("simulator");
    setPanel("throw");
  };
  $("detailEdit").onclick = () => {
    const d = data.bag.find((x) => x.id === detailId);
    $("detailDialog").close();
    if (d) showDiscDialog(d, true);
  };
  $("detailDelete").onclick = () => {
    const index = data.bag.findIndex((x) => x.id === detailId);
    if (index < 0) return;
    const d = data.bag[index],
      before = { ...settings };
    data.bag.splice(index, 1);
    $("detailDialog").close();
    if (settings.discId === d.id) settings.discId = "custom";
    renderBag();
    renderDiscSelect();
    renderDiscPager();
    changed();
    persist();
    toast(d.name + " er fjernet.", () => {
      if (data.bag.length >= 200) {
        toast("Der er ikke plads i baggen.");
        return;
      }
      data.bag.splice(Math.min(index, data.bag.length), 0, d);
      if (settings.discId === "custom" && before.discId === d.id)
        settings = before;
      writeSettings();
      renderBag();
      changed();
      persist();
      toast("Disc gendannet.");
    });
  };

  const profileMap = {
    name: "profileName",
    hand: "profileHand",
    bhPower: "bhPower",
    fhPower: "fhPower",
    bhRpm: "bhRpm",
    fhRpm: "fhRpm",
    height: "profileHeight",
    launch: "profileLaunch",
    nose: "profileNose",
    notes: "profileNotes",
    level: "profileLevel",
  };
  function fillProfile() {
    for (const [key, id] of Object.entries(profileMap))
      $(id).value = data.profile[key];
  }
  $("profileForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!$("profileForm").reportValidity()) return;
    try {
      const p = {};
      for (const [key, id] of Object.entries(profileMap))
        p[key] = ["name", "hand", "notes", "level"].includes(key)
          ? $(id).value
          : $(id).valueAsNumber;
      data.profile = BagData.profile(p);
      const method = settings.style.endsWith("BH") ? "bh" : "fh";
      settings.bhRpm = p.bhRpm;
      settings.fhRpm = p.fhRpm;
      settings.rpm = p[method + "Rpm"];
      settings = Release.resolve(settings, p);
      for (const k of ["height", "launch", "nose"]) settings[k] = p[k];
      writeSettings();
      changed();
      persist();
      toast("Profil gemt. Dine releaseværdier er klar i simulatoren.");
    } catch (error) {
      toast(error.message);
    }
  });
  const levelValues = {
    beginner: { bhPower: 18, fhPower: 15, bhRpm: 400, fhRpm: 300 },
    casual: { bhPower: 23, fhPower: 20, bhRpm: 500, fhRpm: 400 },
    advanced: { bhPower: 27, fhPower: 24, bhRpm: 600, fhRpm: 500 },
    expert: { bhPower: 32, fhPower: 29, bhRpm: 750, fhRpm: 650 },
  };
  $("applyLevel").onclick = () => {
    const v = levelValues[$("profileLevel").value];
    if (!v) {
      toast("Vælg et niveau først, eller indtast egne værdier.");
      return;
    }
    for (const [k, n] of Object.entries(v)) $(k).value = n;
    toast("Startværdier indsat. Justér dem og gem profilen.");
  };
  $("exportData").onclick = async () => {
    try {
      await persist();
      const backup = await Photos.pack(
          { ...data, settings: Release.resolve(settings, data.profile) },
          images,
        ),
        blob = new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        link = el("a");
      link.href = url;
      link.download =
        "disc-flight-lab-backup-" +
        new Date().toISOString().slice(0, 10) +
        ".json";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast("Backup med profil, gemte kast og billeder er klar.");
    } catch (e) {
      toast("Kunne ikke eksportere: " + e.message);
    }
  };
  $("importData").onclick = () => $("importFile").click();
  $("importFile").addEventListener("change", async () => {
    const file = $("importFile").files?.[0];
    if (!file) return;
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error("Backupfilen må højst være 100 MB.");
      const raw = JSON.parse(await file.text());
      importCandidate = BagData.validate(raw);
      importImages = await Photos.unpack(raw, importCandidate);
      $("importSummary").textContent =
        importCandidate.bag.length +
        " discs · " +
        importImages.size +
        " billeder · " +
        importCandidate.comparisons.length +
        " gemte kast · Profil: " +
        importCandidate.profile.name;
      $("importError").hidden = true;
      document.querySelector("input[name=importMode][value=merge]").checked =
        true;
      $("importDialog").showModal();
    } catch (error) {
      toast("Kunne ikke importere: " + error.message);
    } finally {
      $("importFile").value = "";
    }
  });
  $("confirmImport").onclick = async () => {
    if (!importCandidate) return;
    try {
      const before = JSON.parse(JSON.stringify({ ...data, settings }));
      const restore =
        document.querySelector("input[name=importMode]:checked").value ===
        "replace";
      const incoming = structuredClone(importCandidate),
        incomingImages = new Map(),
        remap = new Map();
      for (const [id, blob] of importImages) {
        const fresh = BagData.id();
        remap.set(id, fresh);
        incomingImages.set(fresh, blob);
      }
      for (const d of [
        ...incoming.bag,
        ...incoming.comparisons.map((c) => c.disc),
      ])
        if (d.imageId) d.imageId = remap.get(d.imageId);
      const result = restore
        ? { data: incoming, added: incoming.bag.length }
        : BagData.merge({ ...data, settings: { ...settings } }, incoming);
      const mergedImages = new Map([...images, ...incomingImages]);
      await LocalDB.save(result.data, mergedImages);
      preserveBroken = false;
      storageOK = true;
      images = mergedImages;

      data = result.data;
      settings = { ...data.settings };
      settings.discName = settings.discName || findDisc()?.name || "";
      settings.discBrand = settings.discBrand || findDisc()?.brand || "";
      settings.aeroFamily = settings.aeroFamily || findDisc()?.aeroFamily || "";
      writeSettings();
      fillProfile();
      renderBag();
      refreshCatalog();
      renderSaved();
      changed();
      persist();
      $("importDialog").close();
      importCandidate = null;
      toast(
        restore
          ? "Backup gendannet."
          : result.added + " discs tilføjet til din bag.",
        () => {
          data = before;
          settings = { ...before.settings };
          settings.discName = settings.discName || findDisc()?.name || "";
          settings.discBrand = settings.discBrand || findDisc()?.brand || "";
          settings.aeroFamily =
            settings.aeroFamily || findDisc()?.aeroFamily || "";
          writeSettings();
          fillProfile();
          renderBag();
          refreshCatalog();
          renderSaved();
          changed();
          persist();
          toast("Import fortrudt.");
        },
      );
    } catch (error) {
      $("importError").textContent = error.message;
      $("importError").hidden = false;
    }
  };
  let comparisonMode = "single";
  function renderSaved() {
    $("savedCount").textContent = data.comparisons.length + " / 3";
    $("captureThrow").disabled = data.comparisons.length >= 3;
    $("showSaved").disabled = !data.comparisons.length;
    $("commonWind").checked = data.commonWind;
    $("savedThrows").replaceChildren();
    data.comparisons.forEach((c, i) => {
      const row = el("div", "saved-throw");
      row.append(
        el("strong", "", i + 1 + ". " + c.disc.name),
        el(
          "p",
          "",
          (c.settings.method === "BH" ? "Baghånd" : "Forhånd") +
            " · " +
            c.settings.style +
            " · " +
            fmt(c.settings.powerPct, 0) +
            " % / " +
            fmt(c.settings.power) +
            " m/s",
        ),
        el(
          "p",
          "",
          (c.settings.model === "legacy"
            ? "V4"
            : c.settings.model === "sixdof-v5"
              ? "V5 · 6-DOF"
              : "V6 · 6-DOF") +
            " · Hyzer " +
            signed(c.settings.hyzer) +
            "° · nose " +
            signed(c.settings.nose) +
            "° · " +
            c.settings.rpm +
            " rpm",
        ),
      );
      const buttons = el("div", "button-row"),
        restore = el("button", "", "Hent indstillinger"),
        remove = el("button", "", "Fjern kast");
      restore.onclick = () => {
        data.profile = { ...c.profile };
        settings = {
          ...c.settings,
          discId: findDisc(c.disc.id) ? c.disc.id : "custom",
        };
        writeSettings();
        fillProfile();
        changed();
        setPanel("throw");
        toast("Discens tal, profil og kastindstillinger hentet.");
      };
      remove.onclick = () => {
        invalidateCalculation();
        data.comparisons.splice(i, 1);
        renderSaved();
        persist();
        if (comparisonMode === "saved") {
          if (data.comparisons.length) showSaved();
          else runSimulation(false, false);
        }
      };
      buttons.append(restore, remove);
      row.append(buttons);
      $("savedThrows").append(row);
    });
  }
  async function showSaved() {
    if (!data.comparisons.length) return;
    try {
      const common = readSettings(),
        items = data.comparisons.map((c) => {
          const p = Release.resolve(c.settings),
            wind = data.commonWind
              ? {
                  windSpeed: common.windSpeed,
                  windFrom: common.windFrom,
                  temperature: common.temperature,
                  altitude: common.altitude,
                  humidity: common.humidity,
                }
              : {};
          return {
            ...p,
            ...wind,
            discName: c.disc.name,
            discColor: c.disc.color,
          };
        }),
        result = await calculate(items, "Sammenligner gemte kast…");
      if (result.some((r) => r.error))
        throw new Error(result.find((r) => r.error).error);
      acceptFlights(
        result.map((r, i) => ({
          ...r.flight,
          label: i + 1 + ". " + data.comparisons[i].disc.name,
        })),
        "saved",
        false,
      );
      setPanel("flight");
    } catch (e) {
      if (e.name !== "AbortError") toast(e.message);
    }
  }
  $("captureThrow").onclick = async () => {
    if (data.comparisons.length >= 3) return;
    try {
      const p = readSettings(),
        profile = { ...data.profile },
        original = findDisc(),
        disc = BagData.disc({
          ...original,
          ...p,
          id:
            original?.id && !original.id.startsWith("demo:")
              ? original.id
              : BagData.id(),
          name: discName(),
          color: original?.color || "#c4f275",
        });
      const result = await calculate([p], "Gemmer komplet kast…");
      if (result[0].error) throw new Error(result[0].error);
      data.comparisons.push({
        id: BagData.id(),
        disc,
        profile,
        settings: BagData.settings(p),
        savedAt: new Date().toISOString(),
      });
      renderSaved();
      persist();
      toast("Kast gemt med fysikmodel og alle indstillinger.");
    } catch (e) {
      if (e.name !== "AbortError") toast(e.message);
    }
  };
  $("showSaved").onclick = showSaved;
  $("commonWind").onchange = () => {
    data.commonWind = $("commonWind").checked;
    persist();
    if (comparisonMode === "saved") showSaved();
  };
  function renderComparison() {
    $("comparison").replaceChildren();
    $("comparison").hidden = flights.length < 2;
    document.querySelector(".flight-legend").hidden = flights.length > 1;
    flights.forEach((f, i) => {
      if (flights.length < 2) return;
      const b = el("button", "compare-card" + (i === active ? " active" : ""));
      b.style.borderTop = "2px solid " + compareColors[i];
      b.setAttribute("aria-pressed", String(i === active));
      b.append(
        el("span", "", f.label),
        el("strong", "", fmt(f.distance) + " m"),
        el(
          "small",
          "",
          lateralText(sceneVector(f, f.points.at(-1).p)[0]) +
            " · " +
            fmt(f.duration) +
            " s",
        ),
      );
      b.onclick = () => {
        active = i;
        playhead = 0;
        playing = false;
        phaseState = "Klar";
        $("stale").hidden = true;
        if (viz) viz.setFlights(flights, active);
        renderComparison();
        updatePlayback();
        updateTargetSummary();
        drawTelemetry();
        requestFrame();
      };
      $("comparison").append(b);
    });
  }
  function lateralText(n) {
    return Math.abs(n) < 0.05
      ? "På linjen"
      : fmt(Math.abs(n)) + " m " + (n > 0 ? "højre" : "venstre");
  }
  async function runSimulation(compare = false, autoplay = true) {
    try {
      const p = readSettings(),
        items = compare ? [25, 0, -20].map((hyzer) => ({ ...p, hyzer })) : [p],
        result = await calculate(
          items,
          compare ? "Sammenligner kun hyzervinkler…" : "Beregner kastet…",
        );
      if (result.some((r) => r.error))
        throw new Error(result.find((r) => r.error).error);
      const next = result.map((r, i) => ({
        ...r.flight,
        label: compare
          ? ["Hyzer +25°", "Fladt 0°", "Anhyzer −20°"][i]
          : "Dit kast",
      }));
      acceptFlights(next, compare ? "angles" : "single", autoplay);
    } catch (e) {
      if (e.name !== "AbortError") toast(e.message);
    }
  }
  $("simulate").onclick = () => runSimulation(false);
  $("compare").onclick = () => runSimulation(true);
  function togglePlayback() {
    if (!flights.length) {
      runSimulation();
      return;
    }
    if (playhead >= flights[active].duration) playhead = 0;
    playing = !playing;
    phaseState = playing ? "" : "Pause";
    previous = performance.now();
    updatePlayback();
    requestFrame();
  }
  $("play").onclick = togglePlayback;
  $("seek").addEventListener("input", () => {
    if (!flights.length) return;
    playhead = clamp(Number($("seek").value), 0, flights[active].duration);
    playing = false;
    phaseState = playhead >= flights[active].duration ? "Landet" : "Pause";
    updatePlayback();
    requestFrame();
  });
  function updatePlayback() {
    if (!flights.length) return;
    const f = flights[active],
      point = Flight.sample(f, playhead);
    lastPoint = point;
    updateTelemetry(point);
    const air = Flight.len(
      Flight.add(point.v, Flight.mul(Flight.wind(f.p), -1)),
    );
    $("distanceOut").value = fmt(Math.hypot(point.p[0], point.p[2]));
    $("heightOut").value = fmt(point.p[1]);
    $("airOut").value = fmt(air);
    $("groundSpeed").textContent = "Jord: " + fmt(Flight.len(point.v)) + " m/s";
    $("time").value = fmt(playhead, 2) + " / " + fmt(f.duration, 2) + " s";
    $("seek").max = f.duration;
    $("seek").value = playhead;
    $("phase").textContent = playing ? point.phase : phaseState;
    const themeColors = palette();
    $("phase").style.color = {
      Turn: themeColors.cyan,
      Glide: themeColors.lime,
      Fade: themeColors.amber,
    }[point.phase];
    $("play").textContent = playing
      ? "Pause"
      : playhead >= f.duration
        ? "Gentag"
        : playhead === 0
          ? "Afspil"
          : "Fortsæt";
    $("play").setAttribute(
      "aria-label",
      playing ? "Sæt kastet på pause" : "Afspil kastet",
    );
    const summary = $("flightSummary"),
      summaryKey = f.distance + "|" + f.lateral + "|" + f.duration;
    if (summary.dataset.summaryKey !== summaryKey) {
      summary.dataset.summaryKey = summaryKey;
      summary.replaceChildren();
      summary.append(
        el("strong", "", fmt(f.distance) + " m"),
        document.createTextNode(
          " · " +
            lateralText(sceneVector(f, f.points.at(-1).p)[0]) +
            " · " +
            fmt(f.duration) +
            " s",
        ),
      );
    }
    summary.title =
      discName(f.p) +
      " · " +
      (f.model === "sixdof" ? "6-DOF" : "V4") +
      " · Top " +
      fmt(f.apex) +
      " m · " +
      f.p.style +
      " · " +
      fmt(f.p.power) +
      " m/s";
    if (viz) viz.setDisc(f, point, playhead);
    dirty = true;
  }
  for (const b of all("[data-camera]"))
    b.onclick = () => {
      cameraMode = b.dataset.camera;
      for (const x of all("[data-camera]")) {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      }
      if (viz) viz.setCamera(cameraMode);
      requestFrame();
    };
  $("expand").onclick = () => {
    const expanded = document.body.classList.toggle("expanded");
    if (expanded) setPanel("flight");
    $("expand").setAttribute("aria-pressed", String(expanded));
    $("expand").setAttribute(
      "aria-label",
      expanded ? "Luk udvidet visning" : "Udvid visualiseringen",
    );
    resize();
  };
  addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      document.body.classList.contains("expanded")
    ) {
      $("expand").click();
      return;
    }
    if (
      event.code !== "Space" ||
      event.repeat ||
      currentView !== "simulator" ||
      document.querySelector("dialog[open]") ||
      /INPUT|SELECT|BUTTON|TEXTAREA|SUMMARY|SVG|A/i.test(
        document.activeElement.tagName,
      ) ||
      document.activeElement.isContentEditable
    )
      return;
    event.preventDefault();
    if (!$("stale").hidden || phaseState === "Klar") runSimulation();
    else togglePlayback();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playing) {
      playing = false;
      phaseState = "Pause";
      updatePlayback();
    }
    previous = performance.now();
    if (!document.hidden) requestFrame();
    persist();
  });
  function requestFrame() {
    dirty = true;
    if (
      !frameId &&
      !document.hidden &&
      currentView === "simulator" &&
      $("stage").getBoundingClientRect().width > 0
    )
      frameId = requestAnimationFrame(frame);
  }
  function frame(now) {
    frameId = 0;
    const dt = Math.max(0, (now - previous) / 1000);
    previous = now;
    if (
      document.hidden ||
      currentView !== "simulator" ||
      $("stage").getBoundingClientRect().width < 1
    )
      return;
    if (playing && flights.length) {
      const f = flights[active];
      playhead = Math.min(f.duration, playhead + dt);
      if (playhead >= f.duration) {
        playing = false;
        phaseState = "Landet";
      }
      updatePlayback();
    }
    let moving = false;
    if (viz) {
      moving = viz.updateCamera(dt);
      if (dirty || moving) viz.render();
    } else if (dirty) drawFallback();
    dirty = false;
    if (playing || moving) frameId = requestAnimationFrame(frame);
  }
  function resize() {
    const r = $("stage").getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (viz) viz.resize(r.width, r.height);
    requestFrame();
  }
  addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(resize).observe($("stage"));
  function drawFallback() {
    renderCanvas({
      $,
      flights,
      settings,
      active,
      lastPoint,
      playhead,
      sceneVector,
      compareColors,
      phaseColors,
    });
  }
  async function create3D() {
    const { createScene } = await import("../3d/scene.js");
    return createScene({
      $,
      getSettings: () => settings,
      getPlotAim: () => plotAim,
      sceneVector,
      compareColors,
      onContextLost: (event) => {
        event.preventDefault();
        playing = false;
        phaseState = "Pause";
        viz = null;
        $("world").hidden = true;
        $("fallback").hidden = false;
        $("engineStatus").textContent = "2D · 3D-forbindelse mistet";
        for (const b of all("[data-camera]")) {
          b.disabled = b.dataset.camera !== "top";
          b.classList.toggle("active", b.dataset.camera === "top");
          b.setAttribute("aria-pressed", String(b.dataset.camera === "top"));
        }
        updatePlayback();
        requestFrame();
      },
    });
  }

  // All lab controls share the same validated settings snapshot as simulation and backup.
  let plotAim = settings.aim,
    calculationEpoch = 0,
    labBusy = false,
    labStamp = "",
    suggestionResults = [],
    lastTelemetryKey = "";
  const labNumeric = Object.keys(Lab.bounds);
  function sceneVector(f, v, reference = plotAim) {
    const a = (f.p.aim - reference) * D,
      c = Math.cos(a),
      s = Math.sin(a);
    return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c];
  }
  function fillLab() {
    for (const k of labNumeric) $(k).value = settings[k];
    $("physicsModel").value = settings.model;
    $("aeroPreset").value = settings.aeroPreset;
    updateLabLabels();
  }
  function updateLabLabels() {
    refreshLabLabels().catch((error) => {
      console.error(error);
      toast(error.message);
    });
  }
  async function refreshLabLabels() {
    const stamp = Lab.signature(settings),
      modern = settings.model === "sixdof",
      p = currentAeroParams(),
      engine = await loadEngine(modern ? "sixdof" : "sixdof-v5");
    if (stamp !== Lab.signature(settings)) return;
    const c = engine.coefficients({
      ...p,
      aeroPreset: modern
        ? p.aeroPreset
        : engine.names[p.aeroPreset]
          ? p.aeroPreset
          : "ratings",
    });
    $("densityOut").textContent = fmt(c.rho, 3) + " kg/m³";
    const adjusted =
      [
        "liftScale",
        "dragScale",
        "spinDragScale",
        "rateDampingScale",
        "inertiaScale",
      ].some((k) => settings[k] !== 1) ||
      settings.momentOffset !== 0 ||
      settings.diameter !== 0;
    $("physicsHint").textContent = modern
      ? "6-DOF · løft, modstand og moment fra valgt profil. " +
        (adjusted
          ? "Egne justeringer er aktive."
          : "Flighttal bruges kun som beskrivelse.")
      : "Tidligere fysikmodel. Vælg V6 for koefficienttabeller og ny analyse.";
    $("coefficientSummary").textContent =
      c.label +
      " · " +
      (c.quality || "V5-estimat") +
      " · Ø " +
      fmt(c.diameter * 100, 1) +
      " cm · " +
      fmt(c.mass * 1000, 0) +
      " g · Iax " +
      c.Iax.toExponential(3) +
      " kg·m²";
    $("cruise").textContent = modern
      ? (c.quality || "Estimat") + (adjusted ? " · justeret" : "")
      : "Tidligere " + (settings.model === "legacy" ? "V4" : "V5") + "-model";
    $("aeroStatus").textContent = modern
      ? c.label +
        " · " +
        (c.quality || "Estimat") +
        (adjusted ? " · egne justeringer" : "")
      : "Gemte kast kan afspilles med den oprindelige model.";
    $("inertiaFactor").closest("label").hidden = modern;
    $("inertiaScale").closest("label").hidden = !modern;
    for (const k of [
      "liftScale",
      "dragScale",
      "momentOffset",
      "spinDragScale",
      "rateDampingScale",
      "inertiaScale",
    ])
      $(k).disabled = !modern;
    $("saveAeroDisc").disabled =
      !modern || !data.bag.some((d) => d.id === settings.discId);
    $("editCoefficients").disabled = !modern;
    $("exportCoefficients").disabled = !modern;
  }
  for (const k of labNumeric)
    $(k).addEventListener("change", () => {
      const v = $(k).valueAsNumber,
        [a, b] = Lab.bounds[k];
      if (
        !Number.isFinite(v) ||
        v < a ||
        v > b ||
        (k === "diameter" && v > 0 && v < 0.15)
      ) {
        toast("Kontrollér værdien for " + k);
        $(k).value = settings[k];
        return;
      }
      settings[k] = v;
      changed();
      if (k.startsWith("target") && viz && flights.length)
        viz.setFlights(flights, active);
      updateLabLabels();
      updateTargetSummary();
    });
  $("physicsModel").onchange = () => {
    settings.model = $("physicsModel").value;
    settings.aeroPreset = settings.model === "sixdof" ? "auto" : "ratings";
    settings.aeroSnapshot = null;
    fillLab();
    changed();
  };
  $("aeroPreset").onchange = () => {
    const key = $("aeroPreset").value;
    if (key === "customTable" && !settings.customTable) {
      $("aeroPreset").value = settings.aeroPreset;
      $("coefficientFile").click();
      return;
    }
    if (key === "custom" && !settings.customAero) {
      toast("Vælg en reference eller importér en tabel.");
      $("aeroPreset").value = settings.aeroPreset;
      return;
    }
    settings.aeroPreset = key;
    settings.aeroSnapshot = null;
    settings.model = [
      "ratings",
      "documentMid",
      "documentDriver",
      "custom",
    ].includes(key)
      ? "sixdof-v5"
      : "sixdof";
    fillLab();
    changed();
  };
  function setBusy(busy, label = "Beregner…") {
    labBusy = busy;
    $("computation").hidden = !busy;
    $("computationText").textContent = label;
    $("computationProgress").value = 0;
    for (const id of [
      "simulate",
      "compare",
      "suggestThrows",
      "runSensitivity",
      "showSaved",
      "startRound",
      "roundThrow",
    ])
      $(id).disabled = busy || (id === "showSaved" && !data.comparisons.length);
    $("captureThrow").disabled = busy || data.comparisons.length >= 3;
    roundUI?.setBusy(busy);
  }
  function invalidateCalculation() {
    roundUI?.invalidate();
    calculationEpoch++;
    FlightJobs.cancel();
    if (labBusy) setBusy(false);
    if (labStamp && labStamp !== Lab.signature(settings)) {
      $("sensitivitySummary").textContent =
        "Indstillinger ændret. Kør analysen igen.";
      $("throwSuggestions").replaceChildren();
      $("dispersionPlot").hidden = true;
    }
    lastTelemetryKey = "";
  }
  $("cancelComputation").onclick = () => {
    calculationEpoch++;
    FlightJobs.cancel();
    setBusy(false);
    toast("Beregning afbrudt.");
  };
  async function calculate(items, label) {
    const epoch = ++calculationEpoch,
      stamp = Lab.signature(settings);
    setBusy(true, label);
    try {
      const r = await FlightJobs.batch(items, (p) => {
        $("computationProgress").value = p;
      });
      if (epoch !== calculationEpoch || stamp !== Lab.signature(settings))
        throw Object.assign(new Error("Indstillinger ændret."), {
          name: "AbortError",
        });
      return r;
    } finally {
      if (epoch === calculationEpoch) setBusy(false);
    }
  }
  function acceptFlights(list, mode, autoplay = true) {
    plotAim = settings.aim;
    flights = list;
    comparisonMode = mode;
    active = mode === "angles" ? 1 : 0;
    playhead = 0;
    playing = autoplay;
    phaseState = autoplay ? "" : "Klar";
    previous = performance.now();
    $("stale").hidden = false;
    if (mode === "single")
      $("stale").hidden =
        Lab.signature(settings) === Lab.signature(flights[active].p);
    else $("stale").hidden = true;
    if (autoplay) setPanel("flight");
    if (viz) viz.setFlights(flights, active);
    renderComparison();
    updatePlayback();
    updateTargetSummary();
    drawTelemetry();
    persist();
    requestFrame();
  }
  function updateTargetSummary() {
    if (!flights.length) return;
    const f = flights[active],
      end = sceneVector(f, f.points.at(-1).p),
      miss = Math.hypot(
        end[0] - settings.targetLateral,
        -end[2] - settings.targetDistance,
      );
    $("targetSummary").textContent =
      (miss <= settings.targetRadius
        ? "Inden for målzonen"
        : "Uden for målzonen") +
      " · " +
      fmt(miss) +
      " m fra centrum · " +
      fmt(-end[2]) +
      " m frem, " +
      lateralText(end[0]);
  }
  function svgNode(tag, attrs = {}, text) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function landingSVG(results, nominal, mode = "spread", reference = plotAim) {
    const colors = palette();
    const svg = svgNode("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 420 280",
        role: "img",
        "aria-label": "Kastets landingspunkter og målzone",
      }),
      allPoints = results.map((f) =>
        sceneVector(f, f.points.at(-1).p, reference),
      ),
      tx = settings.targetLateral,
      tz = -settings.targetDistance,
      r = settings.targetRadius;
    const xs = [0, tx - r, tx + r, ...allPoints.map((p) => p[0])],
      zs = [0, tz - r, tz + r, ...allPoints.map((p) => p[2])];
    if (mode === "path" && nominal)
      for (const p of nominal.points) {
        const q = sceneVector(nominal, p.p);
        xs.push(q[0]);
        zs.push(q[2]);
      }
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minZ = Math.min(...zs),
      maxZ = Math.max(...zs),
      scale = Math.min(
        340 / Math.max(10, maxX - minX),
        220 / Math.max(10, maxZ - minZ),
      ),
      cx = (minX + maxX) / 2,
      cz = (minZ + maxZ) / 2,
      project = (p) => [210 + (p[0] - cx) * scale, 135 + (p[2] - cz) * scale];
    svg.append(
      svgNode("rect", { width: 420, height: 280, fill: colors.bg, rx: 12 }),
    );
    for (let d = 0; d <= Math.max(20, -minZ); d += 20) {
      const a = project([minX, 0, -d]),
        b = project([maxX, 0, -d]);
      svg.append(
        svgNode("line", {
          x1: 28,
          x2: 392,
          y1: a[1],
          y2: b[1],
          stroke: colors.grid,
        }),
        svgNode(
          "text",
          { x: 8, y: a[1] + 4, fill: colors.muted, "font-size": 10 },
          d + " m",
        ),
      );
    }
    const target = project([tx, 0, tz]);
    svg.append(
      svgNode("circle", {
        cx: target[0],
        cy: target[1],
        r: r * scale,
        fill: colors.lime + "18",
        stroke: colors.lime,
        "stroke-width": 1.5,
      }),
      svgNode(
        "text",
        {
          x: target[0] + 7,
          y: target[1] - 7,
          fill: colors.lime,
          "font-size": 11,
        },
        "Mål",
      ),
    );
    if (mode === "path" && nominal) {
      const pts = nominal.points
        .filter((_, i) => i % 3 === 0)
        .concat(nominal.points.at(-1))
        .map((p) => project(sceneVector(nominal, p.p)).join(","))
        .join(" ");
      svg.append(
        svgNode("polyline", {
          points: pts,
          fill: "none",
          stroke: colors.cyan,
          "stroke-width": 2,
        }),
      );
    }
    allPoints.forEach((p, i) => {
      const xy = project(p),
        model = results[i].p.scenarioKind === "model";
      svg.append(
        svgNode(
          model ? "rect" : "circle",
          model
            ? {
                x: xy[0] - 3,
                y: xy[1] - 3,
                width: 6,
                height: 6,
                fill: colors.amber,
                opacity: 0.8,
              }
            : {
                cx: xy[0],
                cy: xy[1],
                r: 3.3,
                fill: colors.cyan,
                opacity: 0.85,
              },
        ),
      );
    });
    const tee = project([0, 0, 0]);
    svg.append(
      svgNode("circle", { cx: tee[0], cy: tee[1], r: 3, fill: colors.text }),
      svgNode(
        "text",
        { x: tee[0] + 7, y: tee[1] + 4, fill: colors.text, "font-size": 11 },
        "Tee",
      ),
    );
    svg.append(
      svgNode(
        "text",
        { x: 14, y: 269, fill: colors.muted, "font-size": 10 },
        mode === "path"
          ? "Modelestimat · beregnet landing"
          : "Blå cirkler: release · orange firkanter: koefficienter",
      ),
    );
    return svg;
  }

  function missDistance(f, p) {
    const end = sceneVector(f, f.points.at(-1).p, p.aim);
    return Math.hypot(end[0] - p.targetLateral, -end[2] - p.targetDistance);
  }
  $("runSensitivity").onclick = async () => {
    try {
      const p = readSettings(),
        variants = [...Lab.variations(p), ...Lab.modelVariations(p)],
        result = await calculate(
          variants,
          "Tester " + variants.length + " variationsscenarier…",
        ),
        good = result.filter((r) => r.flight).map((r) => r.flight);
      if (!good.length) throw new Error(result[0].error);
      const plot = landingSVG(good, null, "spread", p.aim);
      $("dispersionPlot").replaceChildren(...plot.childNodes);
      $("dispersionPlot").hidden = false;
      labStamp = Lab.signature(settings);
      const describe = (kind, label) => {
        const fs = good.filter((f) => f.p.scenarioKind === kind),
          errors = fs.map((f) => missDistance(f, p));
        return fs.length
          ? label +
              ": " +
              errors.filter((d) => d <= p.targetRadius).length +
              " / " +
              fs.length +
              " i zonen; " +
              fmt(Math.min(...errors)) +
              "–" +
              fmt(Math.max(...errors)) +
              " m fra centrum."
          : "";
      };
      $("sensitivitySummary").textContent = [
        describe("release", "Release"),
        describe("model", "Koefficienter"),
        "Scenarierne er følsomhedstests, ikke din træfsandsynlighed.",
        good.length < variants.length
          ? variants.length - good.length + " scenarier kunne ikke afsluttes."
          : "",
      ].join(" ");
    } catch (e) {
      if (e.name !== "AbortError") toast(e.message);
    }
  };
  $("suggestThrows").onclick = async () => {
    try {
      const p = readSettings(),
        stamp = Lab.signature(settings),
        current = findDisc() || { id: "custom", name: discName(), ...p },
        seen = new Set(),
        pool = [current, ...pagerDiscs()]
          .filter((d) => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
          })
          .slice(0, 6),
        candidates = [];
      for (const d of pool)
        for (const powerPct of [50, 75, 100])
          for (const offset of [-15, 0, 15]) {
            const config =
                d.id === p.discId ? Lab.config(p) : discAeroConfig(d),
              q = {
                ...p,
                ...config,
                ...Object.fromEntries(
                  ["speed", "glide", "turn", "fade"].map((k) => [k, d[k]]),
                ),
                aeroSnapshot: d.id === p.discId ? p.aeroSnapshot : null,
                discId: d.id,
                discName: d.name,
                discBrand: d.brand || "",
                discColor: d.color || "#c4f275",
                weight: d.weight ?? p.weight,
                powerPct,
                power: Release.speed(powerPct, p.maxPower),
                hyzer: clamp(p.hyzer + offset, -80, 80),
              };
            if (p.model !== "sixdof") {
              q.aeroPreset = p.aeroPreset;
              q.customAero = p.customAero;
            } else q.aeroSnapshot = Aero.resolve(q);
            candidates.push(q);
          }
      const results = await calculate(
          candidates,
          "Afprøver " + candidates.length + " kast…",
        ),
        short = results
          .filter((r) => r.flight)
          .map((r) => ({ flight: r.flight, miss: missDistance(r.flight, p) }))
          .sort((a, b) => a.miss - b.miss)
          .slice(0, 4);
      if (!short.length) throw new Error("Ingen forslag kunne beregnes.");
      const tests = short.flatMap((x) => Lab.variations(x.flight.p, 8)),
        tested = await calculate(
          tests,
          "Kontrollerer releasevariation for de bedste forslag…",
        );
      if (stamp !== Lab.signature(settings)) return;
      suggestionResults = short
        .map((x, i) => {
          const fs = tested
              .slice(i * 8, i * 8 + 8)
              .filter((r) => r.flight)
              .map((r) => r.flight),
            errors = fs.map((f) => missDistance(f, p)).sort((a, b) => a - b),
            worst = errors.at(-1) ?? Infinity;
          return {
            ...x,
            worst,
            successful: fs.length,
            inside: errors.filter((e) => e <= p.targetRadius).length,
            score: fs.length === 8 ? worst : Infinity,
          };
        })
        .sort((a, b) => a.score - b.score || a.miss - b.miss)
        .slice(0, 3);
      $("throwSuggestions").replaceChildren();
      labStamp = Lab.signature(settings);
      for (const {
        flight: f,
        miss,
        worst,
        successful,
        inside,
      } of suggestionResults) {
        const row = el("article", "suggestion");
        row.append(
          el("strong", "", f.p.discName + " · " + fmt(miss) + " m fra målet"),
          el(
            "p",
            "hint",
            fmt(f.p.powerPct, 0) +
              " % · hyzer " +
              signed(f.p.hyzer) +
              "° · " +
              fmt(f.distance) +
              " m rækkevidde",
          ),
          el(
            "p",
            "hint",
            "Releasevariation: " +
              inside +
              " / 8 i zonen · største afvigelse " +
              (Number.isFinite(worst) ? fmt(worst) + " m" : "ukendt") +
              (successful < 8
                ? " · " + (8 - successful) + " beregninger fejlede"
                : "") +
              ". " +
              (f.coefficients?.quality || "Tidligere model") +
              ".",
          ),
        );
        const b = el("button", "wide", "Brug dette kast");
        b.onclick = () => {
          settings = BagData.settings(f.p);
          writeSettings();
          changed();
          acceptFlights([f], "single", false);
          setPanel("flight");
        };
        row.append(b);
        $("throwSuggestions").append(row);
      }
    } catch (e) {
      if (e.name !== "AbortError") toast(e.message);
    }
  };
  function telemetryValue(p, key) {
    if (key === "advanceRatio") return p.advanceRatio ?? 0;
    if (key === "height") return p.p[1];
    if (key === "spin") return (Math.abs(p.spin || 0) * 60) / (2 * Math.PI);
    if (key === "alpha") return (p.alpha || 0) / D;
    return p.airspeed ?? Flight.len(p.v);
  }
  function drawTelemetry() {
    const colors = palette();
    const svg = $("telemetryChart");
    if (!flights.length) return;
    const f = flights[active],
      key = $("telemetryMetric").value,
      values = f.points.map((p) => telemetryValue(p, key)),
      min = Math.min(0, ...values),
      max = Math.max(1, ...values),
      range = max - min;
    svg.replaceChildren(
      svgNode("rect", { width: 420, height: 200, fill: colors.bg, rx: 12 }),
    );
    for (let i = 0; i < 4; i++) {
      const y = 18 + i * 48;
      svg.append(
        svgNode("line", { x1: 42, x2: 405, y1: y, y2: y, stroke: colors.grid }),
        svgNode(
          "text",
          { x: 4, y: y + 4, fill: colors.muted, "font-size": 10 },
          fmt(max - (range * i) / 3, 1),
        ),
      );
    }
    const coords = f.points
      .filter(
        (_, i) => i % Math.max(1, Math.floor(f.points.length / 180)) === 0,
      )
      .map((p) =>
        [
          42 + (p.t / f.duration) * 363,
          18 + ((max - telemetryValue(p, key)) / range) * 144,
        ].join(","),
      );
    svg.append(
      svgNode("polyline", {
        points: coords.join(" "),
        fill: "none",
        stroke: colors.cyan,
        "stroke-width": 2,
      }),
      svgNode("line", {
        id: "telemetryCursor",
        x1: 42,
        x2: 42,
        y1: 12,
        y2: 170,
        stroke: colors.lime,
      }),
      svgNode(
        "text",
        { x: 42, y: 188, fill: colors.muted, "font-size": 11 },
        "0 s",
      ),
      svgNode(
        "text",
        { x: 357, y: 188, fill: colors.muted, "font-size": 11 },
        fmt(f.duration) + " s",
      ),
    );
    renderWarnings($("diagnosticWarnings"), f);
    const diag = f.diagnostics;
    $("modelQuality").textContent =
      f.model !== "legacy"
        ? f.coefficients.label +
          " · spin bevaret " +
          fmt(100 * diag.spinRetention, 0) +
          " % · højeste angrebsvinkel " +
          fmt(diag.maxAbsAoA / D, 1) +
          "°. " +
          (diag.warnings.join(" ") ||
            "Beregnede koefficienter er ikke en validering af denne disc.")
        : "V4-model. Spin- og vinkelkurver kræver et nyt kast med 6-DOF.";
    lastTelemetryKey = f.duration + "|" + f.distance + "|" + key;
  }
  $("telemetryMetric").onchange = drawTelemetry;
  function updateTelemetry(point) {
    const six = !!point.q;
    $("liveAlpha").textContent = six ? fmt(point.alpha / D, 1) + "°" : "—";
    $("liveSpin").textContent = six
      ? fmt((Math.abs(point.spin) * 60) / (2 * Math.PI), 0)
      : "—";
    $("liveLift").textContent = six ? fmt(point.lift, 2) : "—";
    $("liveDrag").textContent = six ? fmt(point.drag, 2) : "—";
    const cursor = $("telemetryCursor");
    if (cursor && flights.length) {
      const x = 42 + (playhead / flights[active].duration) * 363;
      cursor.setAttribute("x1", x);
      cursor.setAttribute("x2", x);
    }
  }
  function downloadFile(blob, name) {
    const u = URL.createObjectURL(blob),
      a = el("a");
    a.href = u;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 10000);
  }
  $("exportCSV").onclick = () => {
    if (!flights.length) return;
    const f = flights[active],
      header = [
        "time_s",
        "right_m",
        "height_m",
        "forward_m",
        "vx_ms",
        "vy_ms",
        "vz_ms",
        "airspeed_ms",
        "spin_rpm",
        "alpha_deg",
        "lift_N",
        "drag_N",
        "pitch_Nm",
        "roll_Nm",
        "spin_Nm",
        "CL",
        "CD",
        "CM",
        "lambda_omegaR_U",
      ],
      rows = f.points.map((p) =>
        [
          p.t,
          p.p[0],
          p.p[1],
          -p.p[2],
          ...p.v,
          p.airspeed ?? Flight.len(p.v),
          p.spin === undefined ? "" : (Math.abs(p.spin) * 60) / (2 * Math.PI),
          p.alpha === undefined ? "" : p.alpha / D,
          p.lift ?? "",
          p.drag ?? "",
          p.pitchMoment ?? "",
          p.rollMoment ?? "",
          p.spinMoment ?? "",
          p.CL ?? "",
          p.CD ?? "",
          p.CM ?? "",
          p.advanceRatio ?? "",
        ]
          .map((v) => (typeof v === "number" ? v.toFixed(6) : v))
          .join(","),
      );
    downloadFile(
      new Blob([header.join(",") + "\n" + rows.join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
      "disc-flight-beregnede-punkter.csv",
    );
  };
  $("exportFlightSVG").onclick = () => {
    if (!flights.length) return;
    const svg = landingSVG(flights, flights[active], "path");
    downloadFile(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      }),
      "disc-flight-bane.svg",
    );
  };

  function currentAeroParams(d = findDisc()) {
    return {
      ...settings,
      discName: discName(),
      discBrand: d?.brand || settings.discBrand || "",
      aeroFamily: settings.aeroFamily || d?.aeroFamily || "",
    };
  }
  function discAeroConfig(d) {
    return Lab.config({
      ...Lab.defaults,
      aeroFamily: d?.aeroFamily || "",
      ...(d?.aeroConfig || {}),
    });
  }
  function sourceLink(url, label) {
    const a = el("a", "", label);
    try {
      const u = new URL(url);
      if (!["https:", "http:"].includes(u.protocol)) throw new Error();
      a.href = u.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } catch (error) {
      console.warn("Ugyldig kildelink.", error);
      a.removeAttribute("href");
    }
    return a;
  }
  function showCoefficientTable() {
    const p = currentAeroParams(),
      t = Aero.resolve(p);
    $("coefficientTitle").textContent = t.name;
    $("aeroSource").replaceChildren();
    $("aeroSource").append(
      el(
        "p",
        "hint",
        (t.quality || t.basis) +
          " · " +
          t.alpha.length +
          " angrebsvinkler · " +
          (t.lambda
            ? t.lambda.length + " spin/fart-niveauer"
            : "statiske CL / CD / CM"),
      ),
    );
    if (t.source)
      $("aeroSource").append(sourceLink(t.source, "Åbn profilens kilde ↗"));
    if (t.geometry)
      $("aeroSource").append(
        el(
          "p",
          "hint",
          "Geometri: " +
            t.geometry.model +
            " · Ø " +
            fmt(t.geometry.diameter * 100, 1) +
            " cm · kant " +
            fmt(t.geometry.rim * 1000, 1) +
            " mm",
        ),
        sourceLink(t.geometry.source, "PDGA-mål ↗"),
      );
    $("aeroSource").append(
      el("p", "hint", t.note || "Ingen uafhængig validering angivet."),
      el(
        "p",
        "hint",
        "Profilens kontrolinterval: " +
          t.domain.join(" til ") +
          "°. Intervallet bruges til appens kontrolflag; hele tabellen bruges i beregningen.",
      ),
      el("p", "hint", "Revision: " + t.revision),
    );
    const sel = $("coefficientLambda");
    sel.replaceChildren();
    for (const v of t.lambda || [0]) {
      const o = el("option", "", fmt(v, 3));
      o.value = v;
      sel.append(o);
    }
    sel.disabled = !t.lambda;
    const render = () => {
      const lambda = Number(sel.value),
        body = $("coefficientRows");
      body.replaceChildren();
      for (const a of t.alpha) {
        const row = el("tr");
        for (const v of [
          a,
          ...["CL", "CD", "CM", "CRoll", "CSpin"].map((k) =>
            t[k] ? Aero.lookup(t, k, a, lambda) : null,
          ),
        ])
          row.append(el("td", "", v === null ? "—" : fmt(v, 3)));
        body.append(row);
      }
    };
    sel.onchange = render;
    render();
    $("coeffDialog").showModal();
  }
  $("editCoefficients").onclick = showCoefficientTable;
  $("exportCoefficients").onclick = () =>
    downloadFile(
      new Blob([JSON.stringify(Aero.exported(currentAeroParams()), null, 2)], {
        type: "application/json",
      }),
      "disc-aero-profil.json",
    );
  $("importCoefficients").onclick = () => $("coefficientFile").click();
  $("coefficientFile").onchange = async () => {
    const f = $("coefficientFile").files?.[0];
    if (!f) return;
    try {
      if (f.size > 1024 * 1024)
        throw new Error("Profilen må højst fylde 1 MB.");
      const t = Aero.table(JSON.parse(await f.text()));
      Object.assign(settings, {
        customTable: t,
        aeroPreset: "customTable",
        aeroSnapshot: null,
        customAero: null,
        model: "sixdof",
        diameter: 0,
        inertiaScale: 1,
        liftScale: 1,
        dragScale: 1,
        momentOffset: 0,
        spinDragScale: 1,
        rateDampingScale: 1,
      });
      fillLab();
      changed();
      if ($("coeffDialog").open) showCoefficientTable();
      toast(
        "Koefficientprofil indlæst. Gem den på discen, hvis den skal følge discvalget.",
      );
    } catch (e) {
      toast(e.message);
    } finally {
      $("coefficientFile").value = "";
    }
  };
  $("saveAeroDisc").onclick = () => {
    const d = data.bag.find((x) => x.id === settings.discId);
    if (!d) {
      toast("Tilføj discen til din bag først.");
      return;
    }
    d.aeroConfig = Lab.config(settings);
    d.aeroFamily = settings.aeroFamily;
    persist();
    toast("Aeroprofil og justeringer gemt på " + d.name + ".");
  };
  $("resetAero").onclick = () => {
    Object.assign(
      settings,
      Lab.config({ aeroFamily: findDisc()?.aeroFamily || "" }),
      { aeroSnapshot: null },
    );
    fillLab();
    changed();
    toast("Automatisk profil og standardjusteringer valgt.");
  };
  let listCandidate = [];
  function showList(list, name) {
    listCandidate = list.map(BagData.disc);
    $("listTitle").textContent = name;
    $("listRows").replaceChildren();
    for (const [i, d] of listCandidate.entries()) {
      const duplicate = data.bag.some(
          (x) =>
            Aero.fold(x.name) === Aero.fold(d.name) &&
            Aero.fold(x.plastic) === Aero.fold(d.plastic) &&
            x.weight === d.weight,
        ),
        lost =
          /^patrol(?:2018)?$/.test(Aero.fold(d.name)) ||
          /mistet|\blost\b/i.test(d.notes),
        label = el("label", "list-choice"),
        check = el("input"),
        span = el("span");
      check.type = "checkbox";
      check.value = i;
      check.checked = !duplicate && !lost;
      span.append(
        el("strong", "", d.name),
        el(
          "small",
          "",
          [
            d.brand,
            d.plastic,
            d.weight ? d.weight + " g" : "vægt ukendt",
            duplicate ? "findes allerede i baggen" : "",
            lost ? "tidligere mistet · fravalgt" : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      label.append(check, span);
      $("listRows").append(label);
    }
    $("listError").hidden = true;
    $("listDialog").showModal();
  }
  for (const [i, list] of InputLists.entries()) {
    const o = el("option", "", list.name + " · " + list.bag.length + " discs");
    o.value = i;
    if (i === 1) o.selected = true;
    $("attachedList").append(o);
  }
  $("reviewAttached").onclick = () => {
    const list = InputLists[Number($("attachedList").value)];
    showList(list.bag, list.name);
  };
  $("csvImport").onclick = () => $("csvFile").click();
  function parseDiscmate(text) {
    const rows = [];
    let row = [],
      cell = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
        row.push(cell);
        cell = "";
        if (c !== ",") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          if (row.some((v) => v.trim())) rows.push(row);
          row = [];
        }
      } else cell += c;
    }
    if (quoted) throw new Error("CSV-filen har et uafsluttet tekstfelt.");
    row.push(cell);
    if (row.some((v) => v.trim())) rows.push(row);
    const head = rows.shift()?.map((s) =>
      s
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
    );
    if (
      !head ||
      !["name", "speed", "glide", "turn", "fade"].every((k) => head.includes(k))
    )
      throw new Error("Brug en Discmate CSV med navn og de fire flighttal.");
    if (!rows.length || rows.length > 200)
      throw new Error("Vælg en liste med 1–200 discs.");
    return rows.map((r, i) => {
      const x = Object.fromEntries(head.map((k, j) => [k, r[j] || ""])),
        num = (k) => Number((x[k] || "").trim().replace(",", ".")),
        type = (x.type || "").toLowerCase();
      if (["speed", "glide", "turn", "fade"].some((k) => !x[k].trim()))
        throw new Error("Flighttal mangler i række " + (i + 2));
      return BagData.disc({
        id: BagData.id(),
        name: x.name,
        brand: x.manufacturer || x.brand,
        plastic: x.plastic,
        notes: x.notes,
        imageUrl: x.img || "",
        weight: num("weight") || null,
        ...Object.fromEntries(
          ["speed", "glide", "turn", "fade"].map((k) => [k, num(k)]),
        ),
        aeroFamily:
          type === "putter"
            ? "genericPutter"
            : type === "midrange"
              ? "genericMid"
              : "genericDriver",
      });
    });
  }
  $("csvFile").onchange = async () => {
    const f = $("csvFile").files?.[0];
    if (!f) return;
    try {
      if (f.size > 1024 * 1024) throw new Error("CSV må højst være 1 MB.");
      showList(parseDiscmate(await f.text()), f.name);
    } catch (e) {
      toast(e.message);
    } finally {
      $("csvFile").value = "";
    }
  };
  $("confirmList").onclick = async () => {
    try {
      const selected = [...$("listRows").querySelectorAll("input:checked")].map(
        (i) => listCandidate[Number(i.value)],
      );
      if (!selected.length) throw new Error("Vælg mindst én disc.");
      const before = structuredClone(data.bag),
        result = BagData.merge(data, { ...BagData.empty(), bag: selected });
      data = result.data;
      renderBag();
      renderDiscSelect();
      await persist();
      $("listDialog").close();
      toast(result.added + " discs tilføjet.", () => {
        data.bag = before;
        renderBag();
        renderDiscSelect();
        changed();
        persist();
        toast("Import fortrudt.");
      });
    } catch (e) {
      $("listError").textContent = e.message;
      $("listError").hidden = false;
    }
  };

  $("bagImport").onclick = () => {
    showView("profile");
    $("attachedList").focus();
    $("attachedList").scrollIntoView?.({ block: "center", behavior: "smooth" });
  };

  let activePanel = "throw",
    lastSetupPanel = "throw";
  function setPanel(panel) {
    if (!["disc", "throw", "wind", "analysis", "flight"].includes(panel))
      return;
    if (panel !== "flight") {
      lastSetupPanel = panel;
      if (playing) {
        playing = false;
        phaseState = "Pause";
        updatePlayback();
      }
    }
    if (panel === "analysis") {
      updateTargetSummary();
      drawTelemetry();
    }
    activePanel = panel;
    $("simulatorView").dataset.pane = panel;
    for (const id of ["disc", "throw", "wind", "analysis"])
      $(id + "Pane").hidden = id !== lastSetupPanel;
    for (const button of all(".panel-tab")) {
      const isActive = button.dataset.panel === panel;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
    $("setupScroll").scrollTop = 0;
    resize();
    requestFrame();
  }
  for (const button of all("[data-panel]"))
    button.onclick = () => setPanel(button.dataset.panel);
  for (const button of all("[data-open-panel]"))
    button.onclick = () => {
      if (document.body.classList.contains("expanded")) {
        $("expand").click();
      }
      setPanel(button.dataset.openPanel);
    };
  $("rerun").onclick = () =>
    comparisonMode === "saved"
      ? showSaved()
      : runSimulation(comparisonMode === "angles");
  document.querySelector(".sim-tabs").addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft"].includes(event.key)) return;
    const buttons = all(".panel-tab").filter((b) => b.offsetWidth > 0),
      current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next =
      buttons[
        (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
          buttons.length
      ];
    next.focus();
    next.click();
  });
  let tallestViewport = innerHeight,
    viewportWidth = innerWidth;
  function viewportChanged() {
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    if (Math.abs(innerWidth - viewportWidth) > 80) {
      tallestViewport = height;
      viewportWidth = innerWidth;
    } else tallestViewport = Math.max(tallestViewport, height);
    const focused = document.activeElement,
      typing =
        focused &&
        focused.matches(
          "input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]),textarea",
        );
    document.body.classList.toggle(
      "keyboard-open",
      !!typing && tallestViewport - height > 110,
    );
    if (!viewport || Math.abs(viewport.scale - 1) < 0.02) {
      document.documentElement.style.setProperty(
        "--app-height",
        Math.round(height) + "px",
      );
      document.documentElement.style.setProperty(
        "--viewport-top",
        Math.round(viewport?.offsetTop || 0) + "px",
      );
    }
    resize();
  }
  if (window.visualViewport)
    window.visualViewport.addEventListener("resize", viewportChanged);
  if (window.visualViewport)
    window.visualViewport.addEventListener("scroll", viewportChanged);
  document.addEventListener("focusin", viewportChanged);
  document.addEventListener("focusout", () => setTimeout(viewportChanged, 0));
  addEventListener("resize", viewportChanged);
  viewportChanged();

  roundUI = mountRound({
    readSettings,
    calculate,
    getRecords: () => data.rounds || [],
    saveRecords: async (records) => {
      data.rounds = records;
      return persist();
    },
    showFlight: (f) => {
      acceptFlights([f], "single", false);
    },
    toast,
  });
  mountTheme($("themeSelect"), (message) => toast(message));
  document.addEventListener("dfl-themechange", () => {
    viz?.setTheme?.();
    if (flights.length) {
      viz?.setFlights(flights, active);
      updatePlayback();
    }
    drawTelemetry();
    requestFrame();
  });
  refreshCatalog();
  showStorage();
  settings.discName = settings.discName || findDisc()?.name || "";
  settings.discBrand = settings.discBrand || findDisc()?.brand || "";
  settings.aeroFamily = settings.aeroFamily || findDisc()?.aeroFamily || "";
  writeSettings();
  fillProfile();
  renderBag();
  renderSaved();
  setPanel("throw");
  runSimulation(false, false);
  if (bootError) toast(bootError);
  create3D()
    .then((engine) => {
      viz = engine;
      $("fallback").hidden = true;
      $("engineStatus").classList.remove("is-loading");
      $("engineStatus").setAttribute("aria-busy", "false");
      $("engineStatus").textContent = "3D · estimeret bane";
      viz.setFlights(flights, active);
      viz.setCamera(cameraMode);
      resize();
      updatePlayback();
      requestFrame();
    })
    .catch((error) => {
      console.error("3D-opstart fejlede.", error);
      $("engineStatus").classList.remove("is-loading");
      $("engineStatus").setAttribute("aria-busy", "false");
      $("engineStatus").textContent = "2D · 3D kunne ikke indlæses";
      $("engineStatus").title = "3D kræver WebGL. " + error.message;
      $("world").replaceChildren();
      for (const b of all("[data-camera]")) {
        b.disabled = b.dataset.camera !== "top";
        b.classList.toggle("active", b.dataset.camera === "top");
        b.setAttribute("aria-pressed", String(b.dataset.camera === "top"));
      }
      requestFrame();
    });
}
