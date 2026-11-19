import { describe, expect, it, vi } from "vitest";
import { DOCUMENT_HANDLER as docs } from "./document";

describe("Document", async () => {
  it("Initial Values", () => {
    expect(docs.main).to.equal(document);
    expect(docs.documents.length).to.equal(1);
    expect(docs.documents[0]).to.equal(document);
  });
  it("Attach event listener then register document", async () => {
    await new Promise<void>((a) => {
      const new_doc: Document =
        document.implementation.createHTMLDocument("test");
      const listener = docs.events.on("added", (doc) => {
        expect(doc.data).toEqual(new_doc);
        docs.events.off("added", listener);
        a();
      });
      docs.register_document(new_doc);
    });
  });
  it("Attach event listener then deregister document", async () => {
    await new Promise<void>((a) => {
      const new_doc = document.implementation.createHTMLDocument("test");
      const listener = docs.events.on("removed", (doc) => {
        expect(doc.data === new_doc).to.equal(true);
        docs.events.off("removed", listener);
        a();
      });
      docs.register_document(new_doc);
      docs.deregister_document(new_doc);
    });
  });
  it("Itterate all existing documents", async () => {
    await new Promise<void>((a) => {
      const new_doc = document.implementation.createHTMLDocument("test");
      docs.register_document(new_doc);
      let prog = 0;
      docs.for_documents(() => {
        prog++;
        if (prog === 3) {
          a();
        }
      });
    });
  });
});

describe("Document styles", () => {
  it("copies style elements and stylesheet links to a registered document", () => {
    const link = document.head.appendChild(document.createElement("link"));
    link.rel = "stylesheet";
    link.href = "data:text/css,body{}";
    const style = document.head.appendChild(document.createElement("style"));
    style.textContent = "p{}";
    const new_doc = document.implementation.createHTMLDocument("test");
    docs.register_document(new_doc, true);
    try {
      const links = [...new_doc.head.querySelectorAll('link[rel="stylesheet"]')];
      expect(
        links.some((l) => l.getAttribute("href") === "data:text/css,body{}"),
      ).toBe(true);
      const styles = [...new_doc.head.querySelectorAll("style")];
      expect(styles.some((s) => s.textContent === "p{}")).toBe(true);
    } finally {
      docs.deregister_document(new_doc);
      link.remove();
      style.remove();
    }
  });

  it("copies no styles without the styles flag, and no links that are not stylesheets", () => {
    const icon = document.head.appendChild(document.createElement("link"));
    icon.rel = "icon";
    icon.href = "data:image/png,";
    const style = document.head.appendChild(document.createElement("style"));
    style.textContent = "a{}";
    const plain = document.implementation.createHTMLDocument("plain");
    const styled = document.implementation.createHTMLDocument("styled");
    docs.register_document(plain);
    docs.register_document(styled, true);
    try {
      expect(plain.head.querySelectorAll("style, link").length).toBe(0);
      expect(styled.head.querySelector('link[rel="icon"]')).toBeNull();
      const copy = [...styled.head.querySelectorAll("style")].find(
        (s) => s.textContent === "a{}",
      );
      expect(copy).toBeDefined();
      //A copy, the style of the main document stays where it is
      expect(copy).not.toBe(style);
      expect(style.parentNode).toBe(document.head);
    } finally {
      docs.deregister_document(plain);
      docs.deregister_document(styled);
      icon.remove();
      style.remove();
    }
  });
});

describe("Document registration edge cases", () => {
  const capture_errors = () => {
    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });
    return { errors, restore: () => spy.mockRestore() };
  };

  it("lists a registered document once and removes it on deregister", () => {
    const doc = document.implementation.createHTMLDocument("list");
    docs.register_document(doc);
    expect(docs.documents.filter((d) => d === doc).length).toBe(1);
    docs.deregister_document(doc);
    expect(docs.documents.includes(doc)).toBe(false);
    expect(docs.documents.includes(document)).toBe(true);
  });

  it("returns a copy of the documents, changing it does not change the handler", () => {
    const list = docs.documents;
    const length = list.length;
    list.push(document.implementation.createHTMLDocument("copy"));
    expect(docs.documents.length).toBe(length);
  });

  it("ignores a document registered twice, without a second added event", () => {
    const doc = document.implementation.createHTMLDocument("twice");
    let added = 0;
    const listener = docs.events.on("added", () => added++);
    const { errors, restore } = capture_errors();
    try {
      docs.register_document(doc);
      docs.register_document(doc);
      expect(added).toBe(1);
      expect(errors.length).toBe(1);
    } finally {
      restore();
      docs.events.off("added", listener);
      docs.deregister_document(doc);
    }
  });

  it("does not remove the main document or unknown documents, and emits no removed event", () => {
    let removed = 0;
    const listener = docs.events.on("removed", () => removed++);
    const { errors, restore } = capture_errors();
    try {
      docs.deregister_document(document);
      docs.deregister_document(
        document.implementation.createHTMLDocument("unknown"),
      );
      expect(removed).toBe(0);
      expect(errors.length).toBe(2);
      expect(docs.main).toBe(document);
      expect(docs.documents.includes(document)).toBe(true);
    } finally {
      restore();
      docs.events.off("removed", listener);
    }
  });

  it("can register a document again after deregistering it", () => {
    const doc = document.implementation.createHTMLDocument("again");
    let added = 0;
    const listener = docs.events.on("added", () => added++);
    try {
      docs.register_document(doc);
      docs.deregister_document(doc);
      docs.register_document(doc);
      expect(added).toBe(2);
      expect(docs.documents.includes(doc)).toBe(true);
    } finally {
      docs.events.off("added", listener);
      docs.deregister_document(doc);
    }
  });
});
