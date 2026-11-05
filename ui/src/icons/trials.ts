import * as materialSymbolsRounded from "./material/material-symbols-rounded";

const icons = {
  "Material Symbols Rounded": materialSymbolsRounded,
} as { [key: string]: { [key: string]: () => SVGSVGElement } };

for (const category in icons) {
  document.body.appendChild(document.createElement("h1")).textContent =
    category;
  const button = document.body.appendChild(document.createElement("button"));
  button.textContent = "Generate";
  const icons_div = document.body.appendChild(document.createElement("div"));
  button.addEventListener("click", () => {
    for (const icon in icons[category]) {
      icons_div.appendChild(icons[category][icon]());
    }
  });
}
