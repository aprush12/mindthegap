import { z } from "zod";
import type { Rule } from "../policy/schema.js";
import type { Contradiction, DoseChange, Evidence, Extraction, Med, MonitoringOrders, Patient, RuleAnswer, Timing } from "../types.js";
import type { Llm } from "./anthropic.js";
import { SYSTEM_PROMPT } from "./document-map.js";

/** Rules the engine computes itself from medications and capacity; never asked of the record. */
export const COMPUTED_RULES = new Set(["RX-01", "RX-02", "RX-03", "RX-04", "RX-05", "INF-03"]);
/** The one RX rule that does need extraction (read by the engine as answers.get("RX-06")). */
export const FACTS_RULES = ["RX-06"];
export const CATEGORIES = ["PAY", "REG", "ACU", "INF", "SKN", "THR", "NUT", "MON", "FUP", "DCP"] as const;

// ---- structured output schemas ----
const Scalar = z.union([z.boolean(), z.number(), z.string()]);

const EvidenceSchema = z.object({
  quote: z.string().describe("verbatim text copied from the record"),
  page: z.number().int().describe("1-indexed PDF page the quote is on"),
});

const AnswerSchema = z.object({
  ruleId: z.string(),
  answered: z.boolean().describe("false when the record does not address the question"),
  fields: z.array(z.object({ name: z.string(), value: Scalar })).describe("only the named fields the record supports; omit the rest"),
  evidence: z.array(EvidenceSchema),
  contradictions: z.array(
    z.object({ quoteA: z.string(), pageA: z.number().int(), quoteB: z.string(), pageB: z.number().int(), note: z.string() }),
  ),
});
export const CategoryResultSchema = z.object({ answers: z.array(AnswerSchema) });
type RawAnswer = z.infer<typeof AnswerSchema>;

const nullable = <T extends z.ZodType>(t: T) => t.nullable();
const TriState = z.enum(["yes", "no", "unknown"]);
export const FactsResultSchema = z.object({
  timing: z.object({
    dischargeAt: nullable(z.string()).describe("ISO 8601 local datetime, no timezone suffix, if stated"),
    arrivalAt: nullable(z.string()).describe("ISO 8601 local datetime of expected/actual arrival at the SNF, if stated"),
  }),
  patient: z.object({
    targetUnit: nullable(z.enum(["vent_trach", "complex_medical", "skilled_medical", "short_stay_rehab", "long_term_care", "memory_care"])).describe("the unit tier the patient's needs point to, per the record"),
    medicaidPending: nullable(z.boolean()),
    tubeFed: nullable(z.boolean()),
    insulinRequired: nullable(z.boolean()),
    weightKg: nullable(z.number()),
    ventDependent: nullable(z.boolean()),
    trach: nullable(z.boolean()),
    dialysis: nullable(z.boolean()),
    elopementRisk: nullable(z.boolean()),
    diagnoses: z.object({
      heartFailure: nullable(z.boolean()).describe("true when heart failure (any type, acute or chronic) is a diagnosis in this record"),
    }),
  }),
  monitoringOrders: z.object({
    dailyWeightsOrdered: z.boolean().describe("true ONLY if a daily-weights ORDER exists (order set, standing order, discharge orders). A narrative mention such as 'monitor weights' or an education note is not an order"),
    weightEscalationPlan: z.boolean().describe("true ONLY if weight-gain escalation parameters are ordered or instructed (for example call the physician for a gain of more than 3 lb in a day or 5 lb in a week)"),
    evidence: z.array(EvidenceSchema).describe("verbatim quotes supporting each true flag; for a false flag, the closest narrative mention if there is one"),
  }),
  medications: z.array(
    z.object({
      name: z.string(),
      // Non-nullable on purpose: the API caps union-typed (nullable) params at 16. "" / "unknown" mean not stated.
      dose: z.string().describe("as written; empty string if not stated"),
      route: z.string().describe("as written; empty string if not stated"),
      schedule: z.string().describe("as written; empty string if not stated"),
      firstDoseDue: z.string().describe("ISO 8601 local datetime of the first dose due at the SNF, only if the record gives times; empty string otherwise"),
      controlled: TriState.describe("yes only if the record marks it as a controlled substance; unknown if not stated"),
      hardCopyPresent: TriState.describe("yes only if a signed hard copy prescription is documented; unknown if not stated"),
      correctionScale: TriState.describe("unknown if not stated"),
      quote: z.string().describe("verbatim line from the record listing this medication"),
      page: z.number().int(),
      doseChanges: z
        .array(
          z.object({
            listedDose: z.string().describe("dose/frequency as the discharge list gives it"),
            noteDose: z.string().describe("the different dose/frequency a later note, consult or order gives"),
            noteContext: z.string().describe("which note says it, in plain words without clock times (for example '17 Nov cardiology progress note'); empty string if unclear"),
            quoteList: z.string().describe("verbatim discharge-list text"),
            pageList: z.number().int(),
            quoteNote: z.string().describe("verbatim text from the final-72-hours note/consult/order"),
            pageNote: z.number().int(),
          }),
        )
        .describe("empty when the final-72-hours documents agree with the discharge list"),
    }),
  ),
  rx06: AnswerSchema,
});
type RawFacts = z.infer<typeof FactsResultSchema>;

// ---- prompts ----
/** Fields the engine reads per rule, beyond what rules.json lists in requiresAll/requiresAny. */
const EXTRA_FIELDS: Record<string, string[]> = {
  "PAY-01": ["status (\"active\"|\"pending\"|\"missing\")", "approvedDays (number)"],
  "REG-01": ["level2Triggered", "level2Resolved"],
  "REG-03": ["impaired", "proxyDocumented"],
  "ACU-03": ["present", "lineType (\"peripheral\"|\"midline\"|\"picc\"|\"central\")", "startsAt (ISO local datetime)"],
  "ACU-06": ["present", "correctionScaleNeeded", "scalePresent"],
  "ACU-09": ["weightKg (number)"],
  "INF-01": ["present", "type (\"contact\"|\"droplet\"|\"airborne\")"],
  "INF-02": ["present", "route (\"oral\"|\"iv\")"],
  "SKN-03": ["present", "type (\"low_air_loss\"|\"vac\")"],
  "NUT-01": ["conflict (true if the diet order conflicts with the swallow evaluation)"],
  "NUT-02": ["present"],
  "MON-03": ["present", "kind (\"continuous_telemetry\"|\"daily_weights\"|\"spot_sat\")"],
  "DCP-01": ["safeHome", "placementPath"],
};
const PRESENCE = ["ACU-01", "ACU-02", "ACU-04", "ACU-05", "ACU-07", "ACU-08", "SKN-01", "SKN-02", "THR-03", "MON-01"];

export function fieldHints(rule: Rule): string[] {
  const keys = new Set<string>();
  for (const f of ["A", "B", "C"] as const) {
    for (const [k, v] of Object.entries(rule.perFacility[f].requirement)) {
      if ((k === "requiresAll" || k === "requiresAny" || k === "ivRequiresAll" || k === "ventRequiresAll") && Array.isArray(v)) v.forEach((x) => keys.add(String(x)));
    }
  }
  const out = [...(PRESENCE.includes(rule.id) ? ["present"] : []), ...(EXTRA_FIELDS[rule.id] ?? []), ...keys];
  return [...new Set(out)];
}

const ruleBlock = (r: Rule) => `- ${r.id}: ${r.question}\n  fields: ${fieldHints(r).join(", ") || "(none; answered true/false only)"}`;

const ANSWER_FORMAT = `For every rule listed, return exactly one answer object:
- ruleId: the id.
- answered: true only if the record actually addresses the question. If it does not, answered: false, fields: [], evidence: [].
- fields: name/value pairs for the listed fields. Booleans mean "the record documents this" (true) or "the record explicitly says this is not so / is absent" (false). Omit any field the record does not support; do not guess false for silence. For "present" fields, present:false is allowed ONLY when the record explicitly states the condition is absent (e.g. "no tracheostomy"); a condition that is never mentioned is answered:false.
- evidence: one or more VERBATIM quotes (short, exact text copied from the PDF, not paraphrased) with the 1-indexed PDF page of each.
- contradictions: if two passages disagree, include both quotes with pages and a one-line note, and do not resolve it.`;

export function categoryInstruction(category: string, rules: Rule[]): string {
  return `Task: answer these ${category} questions about the patient from the record.\n\n${ANSWER_FORMAT}\n\nRules:\n${rules.map(ruleBlock).join("\n")}`;
}

export function factsInstruction(rx06: Rule): string {
  return `Task: extract patient facts, timing, the discharge medication list, and the signed-orders status.

Timing: dischargeAt and arrivalAt as ISO 8601 local datetimes (no timezone), only if the record states them; otherwise null.

Patient facts: set each field only when the record states it; otherwise null (null means "not stated", never "no"). targetUnit is the SNF unit tier the documented needs point to (vent_trach for ventilator/tracheostomy care, complex_medical for high-acuity medical needs, skilled_medical, short_stay_rehab, long_term_care, memory_care) - null if the record does not support a choice. weightKg is the most recent documented weight in kilograms.

Medications: list every discharge medication exactly as the record names it, with a verbatim quote and page for each. dose/route/schedule only as written (empty string if not stated). firstDoseDue only when the record gives administration times; empty string otherwise. controlled, hardCopyPresent and correctionScale are yes/no only when the record says so; otherwise unknown.

Medication reconciliation sweep: after listing the discharge medications, reconcile EACH one against the doses and frequencies stated in the FINAL 72 HOURS of progress notes, consults and orders (the three days before discharge). For every medication where a final-72-hours document gives a different dose or frequency than the discharge list (for example a note saying "increased torsemide to 60 mg daily" while the list says 40 mg), add a doseChanges entry with both verbatim quotes and both pages. Report every divergence. Do NOT decide which one is right and do not adjust the medication's own dose field; the discharge list stays as written. A medication with no divergence gets an empty doseChanges list.

Diagnoses: diagnoses.heartFailure is true when heart failure is a diagnosis anywhere in the record, false if the record rules it out, null if not stated.

Monitoring orders: monitoringOrders.dailyWeightsOrdered is true only when an ORDER exists for daily weights (physician order set, standing or discharge orders); a narrative sentence ("daily weights continue", an education note, a nursing plan of care) is not an order. monitoringOrders.weightEscalationPlan is true only when weight-gain escalation parameters (when to call the physician for a gain over a day or a week) are written as an order or discharge instruction. Give verbatim evidence quotes with pages.

Signed orders (rule RX-06):
${ruleBlock(rx06)}
${ANSWER_FORMAT.split("\n").slice(1).join("\n")}
Return that answer in the rx06 field.`;
}

// ---- conversion ----
const nn = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

function toAnswer(raw: RawAnswer): RuleAnswer {
  const value: Record<string, unknown> = {};
  for (const f of raw.fields) value[f.name] = f.value;
  const evidence: Evidence[] = raw.evidence.map((e) => ({ quote: e.quote, claimedPage: e.page }));
  const contradictions: Contradiction[] = raw.contradictions.map((c) => ({ ...c }));
  const answer: RuleAnswer = { ruleId: raw.ruleId, answered: raw.answered, evidence, contradictions };
  if (raw.answered) answer.value = value;
  return answer;
}

function toFacts(raw: RawFacts): { timing: Timing; patient: Patient; medications: Med[]; monitoringOrders?: MonitoringOrders } {
  const timing: Timing = {};
  if (raw.timing.dischargeAt) timing.dischargeAt = raw.timing.dischargeAt;
  if (raw.timing.arrivalAt) timing.arrivalAt = raw.timing.arrivalAt;
  const patient: Patient = {};
  for (const [k, v] of Object.entries(raw.patient)) if (v != null && k !== "diagnoses") patient[k] = v;
  const dx = raw.patient.diagnoses;
  if (dx) {
    const flags: NonNullable<Patient["diagnoses"]> = {};
    for (const [k, v] of Object.entries(dx)) if (v != null) flags[k] = v;
    if (Object.keys(flags).length) patient.diagnoses = flags;
  }
  const medications: Med[] = raw.medications.map((m) => {
    const med: Med = { name: m.name };
    for (const k of ["dose", "route", "schedule", "firstDoseDue"] as const) if (m[k]) med[k] = m[k];
    for (const k of ["controlled", "hardCopyPresent", "correctionScale"] as const) if (m[k] !== "unknown") med[k] = m[k] === "yes";
    const changes: DoseChange[] = (m.doseChanges ?? []).map((d) => ({
      listedDose: d.listedDose, noteDose: d.noteDose, ...(d.noteContext ? { noteContext: d.noteContext } : {}),
      quoteList: d.quoteList, pageList: d.pageList, quoteNote: d.quoteNote, pageNote: d.pageNote,
    }));
    if (changes.length) med.doseChanges = changes;
    return med;
  });
  const mo = raw.monitoringOrders;
  const monitoringOrders: MonitoringOrders | undefined = mo
    ? { dailyWeightsOrdered: mo.dailyWeightsOrdered, weightEscalationPlan: mo.weightEscalationPlan, evidence: mo.evidence.map((e) => ({ quote: e.quote, claimedPage: e.page })) }
    : undefined;
  return { timing, patient, medications, ...(monitoringOrders ? { monitoringOrders } : {}) };
}

/** Bounded-concurrency map; results keep input order and the first error rejects. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface ExtractionOutput {
  extraction: Extraction;
  /** Medication lines with their quotes, for evidence anchoring and display. */
  medicationEvidence: Evidence[];
}

/**
 * One facts call first (warms the prompt cache for the packet), then the ten category calls
 * at bounded concurrency. Every call shares SYSTEM_PROMPT + the cached document block.
 */
export async function runExtraction(llm: Llm, pdfBase64: string, rules: Rule[], concurrency = 4): Promise<ExtractionOutput> {
  const rx06 = rules.find((r) => r.id === "RX-06");
  if (!rx06) throw new Error("rules missing RX-06");
  const base = { system: SYSTEM_PROMPT, pdfBase64 };

  const factsRaw = await llm.parse({ ...base, label: "facts", schema: FactsResultSchema, instruction: factsInstruction(rx06) });
  const facts = toFacts(factsRaw);

  const jobs = CATEGORIES.map((cat) => ({ cat, rules: rules.filter((r) => r.category === cat && !COMPUTED_RULES.has(r.id)) })).filter((j) => j.rules.length > 0);
  const results = await pool(jobs, concurrency, async (job) => {
    const res = await llm.parse({ ...base, label: `category-${job.cat}`, schema: CategoryResultSchema, instruction: categoryInstruction(job.cat, job.rules) });
    return { job, res };
  });

  const byId = new Map<string, RuleAnswer>();
  const rx = toAnswer({ ...factsRaw.rx06, ruleId: "RX-06" });
  byId.set("RX-06", rx);
  for (const { job, res } of results) {
    const allowed = new Set(job.rules.map((r) => r.id));
    for (const a of res.answers) if (allowed.has(a.ruleId) && !byId.has(a.ruleId)) byId.set(a.ruleId, toAnswer(a));
  }
  // anything the model skipped is an explicit unanswered, never a silent pass
  const answers: RuleAnswer[] = [];
  for (const r of rules) {
    if (COMPUTED_RULES.has(r.id)) continue;
    answers.push(byId.get(r.id) ?? { ruleId: r.id, answered: false, evidence: [], contradictions: [] });
  }

  return {
    extraction: { answers, medications: facts.medications, timing: facts.timing, patient: facts.patient, ...(facts.monitoringOrders ? { monitoringOrders: facts.monitoringOrders } : {}) },
    medicationEvidence: factsRaw.medications.map((m) => ({ quote: m.quote, claimedPage: m.page })),
  };
}
