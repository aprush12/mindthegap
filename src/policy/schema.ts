import { z } from "zod";

export const FacilityIdSchema = z.enum(["A", "B", "C"]);
export type FacilityId = z.infer<typeof FacilityIdSchema>;
export const FACILITY_IDS: FacilityId[] = ["A", "B", "C"];

export const CategorySchema = z.enum(["PAY", "REG", "ACU", "INF", "RX", "SKN", "THR", "NUT", "MON", "FUP", "DCP"]);
export type Category = z.infer<typeof CategorySchema>;

export const CRITERIA = [
  "regulatory_screens",
  "acuity_vs_staffing",
  "infection_control",
  "pharmacy_operations",
  "skin_wounds",
  "therapy",
  "nutrition_swallowing",
  "monitoring_transitions",
] as const;
export const CriterionSchema = z.enum(CRITERIA);
export type Criterion = z.infer<typeof CriterionSchema>;

export const DecisionSchema = z.enum(["block", "conditional", "review"]);
export type Decision = z.infer<typeof DecisionSchema>;

export const ResolvableSchema = z.enum(["sender", "capability"]);
export type Resolvable = z.infer<typeof ResolvableSchema>;

/** Scope predicate over extraction.patient fields. A field that is undefined never satisfies the predicate. */
export type Predicate = { field: string; equals?: unknown; in?: unknown[] } | { all: Predicate[] };
export const PredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z.object({ field: z.string(), equals: z.unknown().optional(), in: z.array(z.unknown()).optional() }),
    z.object({ all: z.array(PredicateSchema) }),
  ]),
);

// ---- rules ----
export const FacilityRuleCellSchema = z.object({
  requirement: z.record(z.string(), z.unknown()),
  notMetDecision: DecisionSchema,
  windowHours: z.number().optional(),
  unknownDecision: DecisionSchema,
  unknownWindowHours: z.number().optional(),
  resolvable: ResolvableSchema,
  /** Block must be cleared before the patient travels (drives "blocked" vs "conditional_accept"). */
  preArrival: z.boolean().optional(),
  /** Facility-specific scope, ANDed with the rule-level appliesWhen. */
  appliesWhen: PredicateSchema.optional(),
  notes: z.string(),
});
export type FacilityRuleCell = z.infer<typeof FacilityRuleCellSchema>;

export const RuleSchema = z.object({
  id: z.string().regex(/^[A-Z]{2,3}-\d{2}$/),
  category: CategorySchema,
  criterion: CriterionSchema,
  question: z.string(),
  appliesWhen: PredicateSchema.optional(),
  perFacility: z.object({ A: FacilityRuleCellSchema, B: FacilityRuleCellSchema, C: FacilityRuleCellSchema }),
});
export type Rule = z.infer<typeof RuleSchema>;
export const RulesSchema = z.array(RuleSchema).length(43);

// ---- formulary ----
export const FormularyStatusSchema = z.enum(["formulary", "pa", "nf", "interchange", "not_stocked", "not_accepted"]);
export type FormularyStatus = z.infer<typeof FormularyStatusSchema>;

export const FormularyCellSchema = z.object({
  status: FormularyStatusSchema,
  leadHours: z.number().optional(),
  payorPA: z.boolean().optional(),
  paHours: z.number().optional(),
  interchangeTo: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  unitRestriction: z.string().optional(),
});
export type FormularyCell = z.infer<typeof FormularyCellSchema>;

export const FormularyAgentSchema = z.object({
  agent: z.string(),
  aliases: z.array(z.string()),
  /** Emergency-kit class, when the agent belongs to one (insulin_analog, doac, arni, iv_antibiotic, oral_analgesic, antiemetic). */
  kitClass: z.string().optional(),
  controlled: z.boolean().optional(),
  perFacility: z.object({ A: FormularyCellSchema, B: FormularyCellSchema, C: FormularyCellSchema }),
});
export type FormularyAgent = z.infer<typeof FormularyAgentSchema>;
export const FormularySchema = z.array(FormularyAgentSchema).length(79);

// ---- facilities ----
export const FacilitySchema = z.object({
  id: FacilityIdSchema,
  name: z.string(),
  description: z.string(),
  units: z.array(z.object({ name: z.string(), label: z.string().optional(), beds: z.number() })),
  formularyContract: z.string(),
  pharmacy: z.object({
    type: z.enum(["contracted_offsite", "in_house"]),
    cutoff: z.string().regex(/^\d{2}:\d{2}$/),
    nextDelivery: z.string().optional(),
    onCallAfterCutoffMinutes: z.number().optional(),
    transitMinutes: z.number().optional(),
  }),
  emergencyKit: z.object({ description: z.string(), excludes: z.array(z.string()), includes: z.array(z.string()) }),
  maxWeightKg: z.number(),
  hasSecuredUnit: z.boolean(),
  hasVentUnit: z.boolean(),
  dialysisChairs: z.number(),
  isolationRoomsTotal: z.number(),
});
export type Facility = z.infer<typeof FacilitySchema>;
export const FacilitiesSchema = z.array(FacilitySchema).length(3);

// ---- capacity ----
export const CapacitySchema = z.object({
  asOf: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "asOf must be an ISO timestamp"),
  bedsAvailable: z.record(z.string(), z.number().int().min(0)),
  isolationRoomsAvailable: z.number().int().min(0),
  staffing: z.object({
    overnightRN: z.number().int().min(0).optional(),
    overnightLPN: z.number().int().min(0).optional(),
    rnUntil: z.string().optional(),
    npUntil: z.string().optional(),
    respiratoryTherapist: z.boolean().optional(),
    physicianCoverage: z.string(),
  }),
  sittersAvailable: z.number().int().min(0),
  therapy: z.object({
    status: z.enum(["available", "limited", "at_capacity"]),
    notes: z.string(),
    speechOnSite: z.boolean().optional(),
    otSpeechLeadDays: z.number().optional(),
  }),
});
export type Capacity = z.infer<typeof CapacitySchema>;
export const CapacitySnapshotSchema = z.object({ A: CapacitySchema, B: CapacitySchema, C: CapacitySchema });
export type CapacitySnapshot = z.infer<typeof CapacitySnapshotSchema>;
