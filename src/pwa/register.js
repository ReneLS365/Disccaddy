import { Capacitor } from "@capacitor/core";

export async function registerOffline() {
  const status = document.getElementById("offlineStatus");
  let installPrompt = null;
  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    document.getElementById("installApp").hidden = false;
  });
  document.getElementById("installApp").onclick = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (error) {
      console.warn("Installation kunne ikke startes.", error);
      status.textContent = "Brug browserens menu: Føj til startskærm.";
    } finally {
      installPrompt = null;
      document.getElementById("installApp").hidden = true;
    }
  };
  if (Capacitor.isNativePlatform()) {
    status.textContent = "Appens indbyggede filer er klar offline.";
    return;
  }
  if (!import.meta.env.PROD) {
    status.textContent =
      "Udviklingsvisning. Offline aktiveres i produktionsbygningen.";
    return;
  }
  if (!("serviceWorker" in navigator)) {
    status.textContent = "Denne browser understøtter ikke offlineinstallation.";
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register(
      new URL("./sw.js", document.baseURI),
      { scope: "./" },
    );
    await navigator.serviceWorker.ready;
    status.textContent =
      "Klar offline · app, fysik og katalog. Billedlinks kræver internet.";
    const update = (worker) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          status.textContent =
            "Opdatering klar. Luk alle appfaner og åbn igen for at bruge den.";
        if (worker.state === "redundant")
          status.textContent =
            "Offlineopdatering fejlede. Prøv igen med internet.";
      });
    };
    update(registration.installing);
    registration.addEventListener("updatefound", () =>
      update(registration.installing),
    );
  } catch (error) {
    console.error("Offlinefiler kunne ikke gemmes.", error);
    status.textContent = "Offline er ikke klar: " + error.message;
  }
}
