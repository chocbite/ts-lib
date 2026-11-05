import { THEME, Themes } from "#theme";
import { VIRTUAL_KEYBOARD } from ".";

const style = document.createElement("style");
style.textContent = `
  :root { color: #18212b; background: #e8eef2; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; padding: 2rem; }
  * { box-sizing: border-box; }
  button, input, textarea, [contenteditable] { font: inherit; }
  button { cursor: pointer; }
  .trial { max-width: 70rem; margin: 0 auto; }
  .trial-header { display: flex; justify-content: space-between; gap: 1rem; align-items: start; margin-bottom: 2rem; }
  h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.06em; }
  .trial-header p { max-width: 38rem; margin: .7rem 0 0; color: #52616f; line-height: 1.5; }
  .switch, .theme { display: flex; align-items: center; gap: .65rem; padding: .65rem .85rem; border: 1px solid #c8d4dc; border-radius: 99rem; background: #f9fcfd; white-space: nowrap; }
  .switch input { accent-color: #147d8b; inline-size: 1.1rem; block-size: 1.1rem; }
  .theme select { border: 0; background: transparent; color: inherit; font: inherit; outline: none; }
  .trial-grid { display: grid; grid-template-columns: minmax(0, 1fr) 18rem; gap: 1.25rem; align-items: start; }
  .panel { padding: 1.25rem; border: 1px solid #c8d4dc; border-radius: 1.1rem; background: #f9fcfd; box-shadow: 0 .8rem 2.5rem #37506412; }
  .panel h2 { margin: 0 0 1rem; font-size: 1rem; letter-spacing: .06em; text-transform: uppercase; color: #52616f; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; }
  .field { min-width: 0; }
  .field label { display: flex; justify-content: space-between; gap: .5rem; margin-bottom: .4rem; font-size: .9rem; font-weight: 700; }
  .field code { color: #147d8b; font-size: .75rem; font-weight: 600; }
  .field input, .field textarea, .editable { width: 100%; padding: .2rem .2rem; border: 1px solid #b9c8d1; border-radius: .55rem; background: #fff; color: #18212b; outline: none; }
  .field textarea, .editable { min-height: 5.5rem; resize: vertical; }
  .field input:focus, .field textarea:focus, .editable:focus { border-color: #147d8b; box-shadow: 0 0 0 .2rem #147d8b24; }
  .span-two { grid-column: 1 / -1; }
  .event-log { min-height: 18rem; max-height: 29rem; margin: 0; padding: .8rem; overflow: auto; border-radius: .6rem; background: #17252c; color: #c9e7e7; font: .75rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
  .hint { margin: 1.25rem 0 0; color: #52616f; font-size: .9rem; line-height: 1.5; }
  @media (max-width: 48rem) { body { padding: 1rem; } .trial-header, .trial-grid { display: block; } .switch { margin-top: 1rem; width: fit-content; } .panel + .panel { margin-top: 1rem; } }
`;
document.head.append(style);

const app = document.body.appendChild(document.createElement("main"));
app.className = "trial";
app.innerHTML = `
  <div class="trial-grid">
  <section class="panel">
  <h2>Supported editable fields</h2>
  <div class="fields">
  <div class="field"><label for="text">Text <code>Text</code></label><input id="text" type="text" placeholder="Text input"></div>
        <div class="field"><label for="email">Email <code>Email</code></label><input id="email" type="email" placeholder="name@example.com"></div>
  <div class="field"><label for="password">Password <code>Text</code></label><input id="password" type="password" placeholder="Password"></div>
  <div class="field"><label for="tel">Telephone <code>Phone</code></label><input id="tel" type="tel" placeholder="+1 234 567 890"></div>
  <div class="field"><label for="color">Color <code>Color</code></label><input id="color" type="color" value="#3b82f6" ></div>
  <div class="field"><label for="integer">Integer <code>NumberInteger</code></label><input id="integer" type="number" placeholder="-42"></div>
  <div class="field"><label for="whole">Whole number <code>NumberWhole</code></label><input id="whole" type="number" min="0" step="1" placeholder="42"></div>
  <div class="field"><label for="rational">Rational <code>NumberRational</code></label><input id="rational" type="number" step="0.1" placeholder="-3.14"></div>
        <div class="field"><label for="positive-rational">Positive rational <code>NumberRationalPositive</code></label><input id="positive-rational" type="number" min="0" step="0.1" placeholder="3.14"></div>
        <div class="field"><label for="date">Date <code>Date</code></label><input id="date" type="date"></div>
        <div class="field"><label for="datetime">Date and time <code>DateTimeLocal</code></label><input id="datetime" type="datetime-local"></div>
        <div class="field"><label for="month">Month <code>Month</code></label><input id="month" type="month"></div>
        <div class="field"><label for="time">Time <code>Time</code></label><input id="time" type="time"></div>
        <div class="field"><label for="week">Week <code>Week</code></label><input id="week" type="week"></div>
  <div class="field span-two"><label for="textarea">Textarea <code>Text</code></label><textarea id="textarea" placeholder="Multi-line text input"></textarea></div>
  <div class="field span-two"><label for="editable">Contenteditable <code>Text</code></label><div id="editable" class="editable" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Editable rich text">Editable content</div></div>
  </div>
      <p class="hint">Date and time fields use compact numeric layouts with their required separators. Controls such as range, checkbox, and file inputs deliberately do not open the virtual keyboard.</p>
  </section>
    <aside class="panel">
      <label class="theme">Theme <select aria-label="Theme"><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label class="switch"><input type="checkbox" checked> Virtual keyboard enabled</label>
      <h2>Event stream</h2>
      <pre class="event-log" aria-live="polite">Ready. Focus an editable field.</pre>
    </aside>
  </div>
`;

const enabled = app.querySelector<HTMLInputElement>(".switch input")!;
const theme = app.querySelector<HTMLSelectElement>(".theme select")!;
const event_log = app.querySelector<HTMLPreElement>(".event-log")!;
const fields = app.querySelectorAll<HTMLElement>(
  "input, textarea, [contenteditable='true']",
);

function log(event: Event): void {
  const target = event.currentTarget as HTMLElement;
  const name = target.id || target.tagName.toLowerCase();
  event_log.textContent = `${event.type.padEnd(11)} ${name}\n${event_log.textContent}`;
}

fields.forEach((field) => {
  field.addEventListener("focus", log);
  field.addEventListener("beforeinput", log);
  field.addEventListener("input", log);
  field.addEventListener("change", log);
});

enabled.addEventListener(
  "change",
  () => void VIRTUAL_KEYBOARD.write(enabled.checked),
);
VIRTUAL_KEYBOARD.sub((v) => (enabled.checked = v.value), true);

theme.addEventListener("change", () => {
  void THEME.write(theme.value as Themes);
});

THEME.sub((value) => {
  const theme_name = value.value;
  theme.value = theme_name;
}, true);
