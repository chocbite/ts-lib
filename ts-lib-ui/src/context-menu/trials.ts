import { some } from "@chocbite/ts-lib/result";
import ctm from ".";

document.body.style.height = "100vh";
document.body.style.margin = "0";

ctm.attach(document.body, () =>
  some(
    ctm.menu(() => [
      ctm.line("Remove", () => console.warn("Removed!")),
      ctm.line("Add New Row", () => console.warn("Added New Row!")),
      ctm.line("Empty", () => console.warn("Emptied!")),
    ]),
  ),
);
