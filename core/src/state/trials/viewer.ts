import st from "..";

const a = st.ok_w(1);
const root = st.ok_w<any>(a.state);

const v = st.v.viewer(root, () => {});
console.warn(a.amount(), "1");

const b = st.ok_w(2);
root.set_ok({ x: b.state });

console.warn(a.amount(), "0");
console.warn(b.amount(), "1");

v.unsub();

// const r_1 = st.ok("Alice1");

// const root = st.ok<any>(r_1);
// const box = document.body.appendChild(document.createElement("div"));
// box.textContent = await root.to_json();
// const obs = st.v.viewer(root, async () => {
//   console.warn("Yo");
//   box.textContent = await root.to_json();
// });

// await sleep(1000);
// r_1.set_ok("Bob2");
// await sleep(1000);
// const r_2 = st.ok<any>("Alice3");
// root.set_ok(r_2);
// await sleep(1000);
// const r_2_1 = st.ok<any>("Bob4");
// r_2.set_ok(r_2_1);
// await sleep(1000);
// const r_2_1_1 = st.ok("Charlie5");
// r_2_1.set_ok(r_2_1_1);
// await sleep(1000);
// r_2_1_1.set_ok("David6");
// await sleep(1000);
// root.set_ok([true, 2, "3"]);
// await sleep(1000);
// const r_3 = st.ok<any>("Alice7");
// root.set_ok([true, r_3, "3"]);
// await sleep(1000);
// r_3.set_ok("Bob8");
// await sleep(1000);
// root.set_ok({ a: true, b: 2, c: "3" });
// await sleep(1000);
// const r_4 = st.ok<any>("Alice9");
// root.set_ok({ a: true, b: r_4, c: "3" });
// await sleep(1000);
// r_4.set_ok("Bob10");
