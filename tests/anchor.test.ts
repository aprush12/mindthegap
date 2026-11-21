import { describe, expect, it } from "vitest";
import { anchorEvidence, anchorQuote, type DocSection } from "../src/pipeline/anchor.js";
import { extractPages, type Page } from "../src/pipeline/extract-text.js";
import { makePdf } from "./fixtures/make-pdf.js";

const mk = (raws: string[]): Page[] => raws.map((raw, i) => ({ pageNumber: i + 1, raw, text: raw.replace(/\s+/g, " ").trim() }));
const sections: DocSection[] = [
  { id: "s-hp", title: "H&P", startPage: 1, endPage: 3 },
  { id: "s-nursing", title: "Nursing notes", startPage: 4, endPage: 6 },
];
const pages = mk([
  "Patient is a 77 year old woman.\nAdmitted 14 Nov.",
  "Cardiac diet ordered.",
  "Weight 71.4 kg on admission.",
  "Stage 2 sacral pressure injury\nmeasuring 2 cm by 3 cm.",
  "Patient's daughter “Maria” is the contact – verified.",
  "Nothing relevant.",
  "Discharge at 18:42.",
]);

describe("anchorQuote", () => {
  it("finds an exact hit on the claimed page and reproduces the quote from raw offsets", () => {
    const a = anchorQuote({ quote: "Weight 71.4 kg", claimedPage: 3 }, pages, sections);
    expect(a).toMatchObject({ verified: true, page: 3, sectionId: "s-hp" });
    if (!a.verified) throw new Error();
    expect(pages[2].raw.slice(a.startOffset, a.endOffset)).toBe("Weight 71.4 kg");
  });

  it("recovers a wrong claimed page from a neighbor and from far away", () => {
    const near = anchorQuote({ quote: "Cardiac diet ordered.", claimedPage: 3 }, pages, sections);
    expect(near).toMatchObject({ verified: true, page: 2 });
    const far = anchorQuote({ quote: "Discharge at 18:42.", claimedPage: 1 }, pages, sections);
    expect(far).toMatchObject({ verified: true, page: 7 });
    expect((far as { sectionId?: string }).sectionId).toBeUndefined();
  });

  it("prefers the claimed page when the quote appears twice", () => {
    const dup = mk(["same line here", "filler", "same line here"]);
    expect(anchorQuote({ quote: "same line here", claimedPage: 3 }, dup)).toMatchObject({ page: 3 });
  });

  it("matches through line wraps and double spaces, mapping back to raw offsets", () => {
    const a = anchorQuote({ quote: "Stage 2 sacral pressure injury measuring 2 cm by 3 cm.", claimedPage: 4 }, pages, sections);
    expect(a).toMatchObject({ verified: true, page: 4, sectionId: "s-nursing" });
    if (!a.verified) throw new Error();
    expect(pages[3].raw.slice(a.startOffset, a.endOffset)).toBe("Stage 2 sacral pressure injury\nmeasuring 2 cm by 3 cm.");
  });

  it("matches curly quotes, dashes and case differences", () => {
    const a = anchorQuote({ quote: "daughter \"maria\" is the contact - VERIFIED", claimedPage: 5 }, pages);
    expect(a.verified).toBe(true);
    if (!a.verified) throw new Error();
    expect(pages[4].raw.slice(a.startOffset, a.endOffset)).toBe("daughter “Maria” is the contact – verified");
  });

  it("returns verified:false, never a guess, when the quote is absent", () => {
    expect(anchorQuote({ quote: "Patient has no allergies", claimedPage: 2 }, pages, sections)).toEqual({ verified: false });
    expect(anchorQuote({ quote: "   ", claimedPage: 2 }, pages)).toEqual({ verified: false });
  });

  it("anchorEvidence fills page/offsets, or marks unverified", () => {
    expect(anchorEvidence({ quote: "Cardiac diet ordered.", claimedPage: 3 }, pages, sections)).toMatchObject({ page: 2, claimedPage: 3, verified: true, sectionId: "s-hp" });
    const miss = anchorEvidence({ quote: "invented", claimedPage: 3 }, pages);
    expect(miss).toEqual({ quote: "invented", claimedPage: 3, verified: false });
  });
});

describe("extractPages", () => {
  it("returns 1-indexed pages with raw and normalized text", async () => {
    const pdf = makePdf([["Weight 71.4 kg", "on admission"], ["Cardiac diet ordered."]]);
    const out = await extractPages(pdf);
    expect(out.map((p) => p.pageNumber)).toEqual([1, 2]);
    expect(out[0].text).toBe("Weight 71.4 kg on admission");
    expect(out[0].raw).toContain("Weight 71.4 kg");
    const a = anchorQuote({ quote: "Cardiac diet ordered.", claimedPage: 1 }, out);
    expect(a).toMatchObject({ verified: true, page: 2 });
  });
});
