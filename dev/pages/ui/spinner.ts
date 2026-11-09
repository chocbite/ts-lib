import { Spinner } from "@chocbite/ts-lib-ui/spinner";
import { box, controls, row, section } from "../../helpers";

//      _____ _____ ____________  _____
//     / ____|_   _|___  /  ____|/ ____|
//    | (___   | |    / /| |__  | (___
//     \___ \  | |   / / |  __|  \___ \
//     ____) |_| |_ / /__| |____ ____) |
//    |_____/|_____/_____|______|_____/
{
  const sec = section(
    "Sizes",
    "The spinner fills its parent. Square boxes from 16 to 256 px, are the dots readable when small and not clumsy when big? Check the dot color in both themes",
  );
  const sizes = row(sec);
  for (const size of [16, 24, 32, 48, 96, 256])
    box(sizes, size + "px", {
      width: size + "px",
      height: size + "px",
      outline: "1px dashed #8886",
    }).appendChild(new Spinner());
}

//                _____ _____  ______ _____ _______
//          /\   / ____|  __ \|  ____/ ____|__   __|
//         /  \ | (___ | |__) | |__ | |       | |
//        / /\ \ \___ \|  ___/|  __|| |       | |
//       / ____ \____) | |    | |___| |____   | |
//      /_/    \_\_____/|_|    |______\_____|  |_|
{
  const sec = section(
    "Aspect ratios",
    "Wide and tall boxes, the spinner should stay round and centered",
  );
  const items = row(sec);
  for (const [width, height] of [
    [200, 48],
    [48, 120],
    [300, 150],
  ])
    box(items, `${width} x ${height}`, {
      width: width + "px",
      height: height + "px",
      outline: "1px dashed #8886",
    }).appendChild(new Spinner());
}

//     _____ _   _ _      _____ _   _ ______
//    |_   _| \ | | |    |_   _| \ | |  ____|
//      | | |  \| | |      | | |  \| | |__
//      | | | . ` | |      | | | . ` |  __|
//     _| |_| |\  | |____ _| |_| |\  | |____
//    |_____|_| \_|______|_____|_| \_|______|
{
  const sec = section(
    "Inline with text and in a button",
    "Placeholders for data that has not arrived, sized with em so they follow the font size",
  );
  const items = row(sec);
  for (const font of ["0.8rem", "1rem", "1.5rem"]) {
    const text = box(items, "text " + font);
    text.style.fontSize = font;
    text.append("Value: ");
    const holder = text.appendChild(document.createElement("span"));
    holder.style.display = "inline-block";
    holder.style.width = "1em";
    holder.style.height = "1em";
    holder.style.verticalAlign = "middle";
    holder.appendChild(new Spinner());
    text.append(" loading");
  }
  const button = box(items, "button").appendChild(
    document.createElement("button"),
  );
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.gap = "0.5em";
  const holder = button.appendChild(document.createElement("span"));
  holder.style.width = "1.2em";
  holder.style.height = "1.2em";
  holder.appendChild(new Spinner());
  button.append("Saving");
}

//     __  __          _   ___     __
//    |  \/  |   /\   | \ | \ \   / /
//    | \  / |  /  \  |  \| |\ \_/ /
//    | |\/| | / /\ \ | . ` | \   /
//    | |  | |/ ____ \| |\  |  | |
//    |_|  |_/_/    \_\_| \_|  |_|
{
  const sec = section(
    "Many",
    "Lots of spinners at once, like a list where every row waits for data. Each animates 12 circles with css, how much does it cost?",
  );
  const grid = document.createElement("div");
  grid.style.display = "flex";
  grid.style.flexWrap = "wrap";
  grid.style.gap = "2px";
  const fill = (amount: number) => {
    const spinners: HTMLElement[] = [];
    for (let i = 0; i < amount; i++) {
      const holder = document.createElement("div");
      holder.style.width = "24px";
      holder.style.height = "24px";
      holder.appendChild(new Spinner());
      spinners.push(holder);
    }
    grid.replaceChildren(...spinners);
  };
  controls(sec, {
    "100 spinners": () => fill(100),
    "1000 spinners": () => fill(1000),
    Clear: () => grid.replaceChildren(),
  });
  sec.appendChild(grid);
}
