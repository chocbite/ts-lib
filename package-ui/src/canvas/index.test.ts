import { describe, expect, it } from "vitest";
import { canvas } from ".";
import { Page } from "./page";
import { Viewport } from "./viewport";

describe("Canvas module", () => {
  it("creates a page with the given size", () => {
    const page = canvas.page({ width: 800, height: 600 });
    expect(page).toBeInstanceOf(Page);
    expect(page.localName).toBe("canvas-page");
    expect(page.width).toBe(800);
    expect(page.height).toBe(600);
  });

  it("creates a page and viewport without options", () => {
    expect(canvas.page().width).toBe(1920);
    expect(canvas.viewport().page).toBeUndefined();
    expect(canvas.viewport().edit).toBe(false);
  });

  it("creates a viewport showing the page in edit mode", () => {
    const page = canvas.page();
    const viewport = canvas.viewport({ page, edit: true });
    expect(viewport).toBeInstanceOf(Viewport);
    expect(viewport.localName).toBe("canvas-viewport");
    expect(viewport.page).toBe(page);
    expect(viewport.edit).toBe(true);
  });
});
