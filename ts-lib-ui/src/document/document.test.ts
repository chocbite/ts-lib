import { describe, expect, it } from "vitest";
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
      docs.events.on("added", (doc) => {
        expect(doc.data).toEqual(new_doc);
        a();
      });
      docs.register_document(new_doc);
    });
  });
  it("Attach event listener then deregister document", async () => {
    await new Promise<void>((a) => {
      const new_doc = document.implementation.createHTMLDocument("test");
      docs.events.on("removed", (doc) => {
        expect(doc.data === new_doc).to.equal(true);
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
