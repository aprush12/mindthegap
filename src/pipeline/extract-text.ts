import { extractText, getDocumentProxy } from "unpdf";

export interface Page {
  pageNumber: number; // 1-indexed
  /** Whitespace-normalized text for display and prompting. */
  text: string;
  /** Exactly what the PDF text layer produced; all anchor offsets index into this. */
  raw: string;
}

/** Collapse runs of whitespace (including newlines) to single spaces and trim. */
export const normalizeWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();

export async function extractPages(pdf: Uint8Array): Promise<Page[]> {
  // pdf.js transfers the buffer to its worker, so hand it a copy and keep the caller's bytes intact.
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(doc, { mergePages: false });
  return text.map((raw, i) => ({ pageNumber: i + 1, text: normalizeWhitespace(raw), raw }));
}
