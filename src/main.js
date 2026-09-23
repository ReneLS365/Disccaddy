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
