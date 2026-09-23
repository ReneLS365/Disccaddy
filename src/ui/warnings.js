export function renderWarnings(container, flight) {
  container.replaceChildren();
  const warnings = [...new Set(flight?.diagnostics?.warnings || [])];
  if (!warnings.length) {
    container.hidden = true;
    return;
  }
  const heading = document.createElement("h3"),
    list = document.createElement("ul");
  heading.textContent = "Modellens forbehold";
  for (const warning of warnings) {
    const li = document.createElement("li");
    li.textContent = warning;
    list.append(li);
  }
  container.append(heading, list);
  container.hidden = false;
}
