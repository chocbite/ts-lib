import { describe, expect, it } from "vitest";
import state from "@chocbite/ts-lib/state";
import type { CanvasWidget } from "../data";
import { group_bounds, GroupRotation, transform_group } from "../group";
import type { WidgetGeometry } from "../widget";

const g = (
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
): WidgetGeometry => ({ x, y, width, height, rotation });

/**Rounds every number, to compare results of trigonometry*/
const rounded = (geometries: WidgetGeometry[]) =>
  geometries.map((geometry) =>
    Object.fromEntries(
      Object.entries(geometry).map(([key, value]) => [
        key,
        Math.round(value * 1000) / 1000 + 0,
      ]),
    ),
  );

describe("Group of widgets", () => {
  it("is bounded by the outlines of the widgets, rotated ones by their rotated outline", () => {
    expect(group_bounds([g(10, 10, 20, 10), g(40, 0, 10, 50)])).toEqual(
      g(10, 0, 40, 50),
    );
    //A 40 by 10 widget turned upright, centered on 20,5
    expect(rounded([group_bounds([g(0, 0, 40, 10, 90)])])).toEqual(
      rounded([g(15, -15, 10, 40)]),
    );
  });

  it("is bounded in a rotated frame, its x and y are those of the box before turning, like a widget", () => {
    //A 40 by 10 widget turned upright, centered on 20,5, bounded in a frame turned with it
    expect(rounded([group_bounds([g(0, 0, 40, 10, 90)], 90)])).toEqual(
      rounded([g(0, 0, 40, 10, 90)]),
    );
    //Two upright widgets side by side are one wide box when the frame is upright too
    expect(
      rounded([
        group_bounds([g(0, 15, 40, 10, 90), g(10, 15, 40, 10, 90)], 90),
      ]),
    ).toEqual(rounded([g(5, 10, 40, 20, 90)]));
  });

  it("scales along the axes of a rotated frame", () => {
    const widgets = [g(0, 0, 40, 10, 90)];
    const box = group_bounds(widgets, 90);
    //Twice as long along the frame, which is along the widget
    const [scaled] = transform_group(widgets, box, {
      ...box,
      width: box.width * 2,
    });
    expect(Math.round(scaled.width)).toBe(80);
    expect(Math.round(scaled.height)).toBe(10);
    expect(scaled.rotation).toBe(90);
  });

  it("moves every widget by the move of the box", () => {
    const widgets = [g(10, 10, 20, 10, 30), g(40, 0, 10, 50)];
    const box = group_bounds(widgets);
    expect(
      rounded(
        transform_group(widgets, box, { ...box, x: box.x + 5, y: box.y + 20 }),
      ),
    ).toEqual(rounded([g(15, 30, 20, 10, 30), g(45, 20, 10, 50)]));
  });

  it("scales the positions and sizes relative to the box", () => {
    const widgets = [g(0, 0, 10, 10), g(30, 10, 10, 10)];
    const box = group_bounds(widgets);
    //Twice as wide, the left side kept
    expect(
      rounded(transform_group(widgets, box, { ...box, width: 80 })),
    ).toEqual(rounded([g(0, 0, 20, 10), g(60, 10, 20, 10)]));
  });

  it("scales a rotated widget along its own axes", () => {
    //Upright, so stretching the box sideways makes the widget thicker, not longer
    const widgets = [g(0, 15, 40, 10, 90)];
    const box = group_bounds(widgets);
    const [scaled] = transform_group(widgets, box, {
      ...box,
      width: box.width * 2,
    });
    expect(Math.round(scaled.width)).toBe(40);
    expect(Math.round(scaled.height)).toBe(20);
    expect(scaled.rotation).toBe(90);
  });

  it("rotates the widgets around the center of the box, turning each by the same angle", () => {
    const widgets = [g(0, 0, 10, 10), g(30, 0, 10, 10, 90)];
    const box = group_bounds(widgets);
    expect(
      rounded(transform_group(widgets, box, { ...box, rotation: 90 })),
    ).toEqual(rounded([g(15, -15, 10, 10, 90), g(15, 15, 10, 10, 180)]));
  });
});

const widget = (rotation: number): CanvasWidget => ({
  widget: "/widgets/none",
  options: { rotation: state.ok_w(rotation) },
});

describe("Rotation of the box of selected widgets", () => {
  it("starts at the rotation the widgets share, 0 when they differ", () => {
    const rotation = new GroupRotation();
    rotation.select([widget(30), widget(390)]);
    expect(rotation.rotation.ok()).toBe(30);
    rotation.select([widget(30), widget(10)]);
    expect(rotation.rotation.ok()).toBe(0);
  });

  it("is kept while the same widgets are selected, and starts again for others", () => {
    const rotation = new GroupRotation();
    const [a, b] = [widget(0), widget(0)];
    rotation.select([a, b]);
    rotation.set(45);
    rotation.select([b, a]);
    expect(rotation.rotation.ok()).toBe(45);
    rotation.select([a]);
    expect(rotation.rotation.ok()).toBe(0);
  });

  it("is shared by everything given the same selection state", () => {
    const selected = state.ok_w<CanvasWidget[]>([]);
    expect(GroupRotation.of(selected)).toBe(GroupRotation.of(selected));
    expect(GroupRotation.of(selected)).not.toBe(
      GroupRotation.of(state.ok_w<CanvasWidget[]>([])),
    );
  });
});
