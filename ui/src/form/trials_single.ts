import state from "@chocbite/ts-lib/state";
import form from ".";

const form_cont = document.createElement("div");
document.body.appendChild(form_cont);
form_cont.style.display = "flex";
form_cont.style.flexDirection = "column";
form_cont.style.flexGrow = "1";
form_cont.style.overflow = "auto";
form_cont.style.backgroundColor = "var(--form-colors-background-normal)";

//       _____ _      _____ _____  ______ _____
//      / ____| |    |_   _|  __ \|  ____|  __ \
//     | (___ | |      | | | |  | | |__  | |__) |
//      \___ \| |      | | | |  | |  __| |  _  /
//      ____) | |____ _| |_| |__| | |____| | \ \
//     |_____/|______|_____|_____/|______|_|  \_\
const slider_num = state.ok_w(0);
slider_num.sub((value) => console.warn("2", value.value));

form_cont.appendChild(
  form
    .slider({
      unit: "mA",
      min: -50,
      max: 50,
      step: 0.5,
      start: 0.1,
      decimals: 1,
      live: true,
    })
    .bind({ value: slider_num }),
);
