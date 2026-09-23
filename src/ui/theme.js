const KEY = "disc-flight-lab.theme";
const choices = ["system", "light", "dark"];
let choice = "system";
const system = globalThis.matchMedia?.("(prefers-color-scheme: light)");
export function applyTheme(value = choice) {
  choice = choices.includes(value) ? value : "system";
  const mode =
    choice === "system" ? (system?.matches ? "light" : "dark") : choice;
  document.documentElement.dataset.theme = mode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", mode === "light" ? "#f3f7ed" : "#0b1c21");
  document.dispatchEvent(new CustomEvent("dfl-themechange", { detail: mode }));
}
export function initTheme() {
  try {
    choice = localStorage.getItem(KEY) || "system";
  } catch (error) {
    console.warn("Tema kunne ikke læses. Enhedens tema bruges.", error);
  }
  applyTheme();
  system?.addEventListener("change", () => {
    if (choice === "system") applyTheme();
  });
}
export function mountTheme(select, notify) {
  select.value = choice;
  select.onchange = () => {
    applyTheme(select.value);
    try {
      localStorage.setItem(KEY, choice);
    } catch (error) {
      console.warn("Tema kunne ikke gemmes.", error);
      notify("Temaet gælder kun denne session; lokal lagring er blokeret.");
    }
  };
}
export function palette() {
  const light = document.documentElement.dataset.theme === "light";
  return light
    ? {
        bg: "#edf3e7",
        ground: "#d9e5c8",
        grid: "#728c6b",
        text: "#213a30",
        muted: "#41594e",
        lime: "#396a0e",
        cyan: "#006a80",
        amber: "#8e4800",
        trace: "#466c52",
      }
    : {
        bg: "#0b2228",
        ground: "#112e30",
        grid: "#2a464d",
        text: "#edf5ed",
        muted: "#b0c6c8",
        lime: "#c4f275",
        cyan: "#70dfef",
        amber: "#ffba76",
        trace: "#b6d2c2",
      };
}
