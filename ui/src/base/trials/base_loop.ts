import state from "@chocbite/ts-lib/state";
import { base_loop } from "../base_loop";

const element2 = document.body.appendChild(
  base_loop((val: number) => {
    const el = document.createElement("div");
    el.textContent = `Value: ${val}`;
    return el;
  }, {}),
);

// element2.array = [1, 2, 3];
const st = state.ok([1, 2, 4, 3, 4, 4]);
element2.attach_state_ROA_to_prop("array", st);

st.array.push(5, 6);
// st.array.unshift(2);
// st.array.change(0, 99, 44);
// st.array.delete(4);
// st.array.splice(2, 1, 99);
await new Promise((a) => setTimeout(a, 2000));
st.array.move(0, 2);
