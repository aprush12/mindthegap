import { z } from "zod";
import type { Llm } from "./anthropic.js";
import type { DocSection } from "./anchor.js";

export const DocumentMapSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().describe("short stable slug, e.g. discharge-summary"),
      title: z.string(),
      startPage: z.number().int(),
      endPage: z.number().int(),
    }),
  ),
});

export const SYSTEM_PROMPT = `You are a clinical documentation analyst supporting a skilled nursing facility admissions screen. You read a hospital-to-SNF referral packet (a PDF) and report only what the record literally says.

Ground rules that always apply:
- Quote the record VERBATIM, character for character, and give the 1-indexed PDF page each quote came from. Never paraphrase inside a quote field.
- Unknown is an answer. If the record does not address a question, say so (answered: false). Never guess, never infer a condition is absent or normal because it is not mentioned, and never fill gaps with clinical plausibility.
- If two passages disagree, report BOTH quotes with their pages as a contradiction. Do not decide which is right.
- Page numbers are the PDF's physical page order starting at 1, not printed page labels.`;

export async function buildDocumentMap(llm: Llm, pdfBase64: string, pageCount: number): Promise<DocSection[]> {
  const out = await llm.parse({
    system: SYSTEM_PROMPT,
    pdfBase64,
    label: "document-map",
    schema: DocumentMapSchema,
    instruction: `Task: build a document map. Split this packet (${pageCount} pages) into its logical sections or documents (for example face sheet, H&P, discharge summary, medication administration record, nursing notes, consult notes, therapy evaluations, labs, orders). Return each with a short slug id, a title, and the first and last page it occupies. Sections must be in page order, must not overlap, and must stay within pages 1-${pageCount}.`,
  });
  return out.sections
    .map((s) => ({ ...s, startPage: Math.max(1, s.startPage), endPage: Math.min(pageCount, Math.max(s.startPage, s.endPage)) }))
    .filter((s) => s.startPage <= pageCount);
}
