/**
 * Contract between the stage 4 extraction layer and the engine.
 *
 * `RuleAnswer.value` is a loose record keyed by rule family. The engine reads only the fields
 * listed in `RuleValueShapes`; unknown extra fields are ignored. Flag-style fields are booleans
 * (true = documented/present). `answered: false` means the record does not answer the question
 * (-> state "unknown"), which is never the same as a negative answer (`present: false`).
 */
export interface Evidence {
  quote: string;
  claimedPage: number;
  page?: number;
  startOffset?: number;
  endOffset?: number;
  sectionId?: string;
  verified?: boolean;
}

export interface Contradiction {
  quoteA: string;
  pageA: number;
  quoteB: string;
  pageB: number;
  note: string;
}

export interface RuleAnswer {
  ruleId: string;
  answered: boolean;
  value?: unknown;
  evidence: Evidence[];
  contradictions: Contradiction[];
}

/**
 * Documented value shapes (all fields optional). Presence-style rules use `present`
 * (explicit `present: false` = condition absent = met). Rules RX-01..RX-05 and INF-03 are
 * computed by the engine from medications and capacity; their answers are ignored.
 */
/** Presence-style value: `present` plus rule-specific boolean flags named in rules.json requiresAll. */
export type Presence = { present?: boolean; [flag: string]: unknown };

export interface RuleValueShapes {
  "PAY-01": { status?: "active" | "pending" | "missing"; approvedDays?: number };
  "PAY-02": { qualifyingStay?: boolean };
  "PAY-03": { dayCountKnown?: boolean; financialCounselingArranged?: boolean };
  "PAY-04": { partyIdentified?: boolean };
  "PAY-05": { applicationSubmitted?: boolean; referenceNumber?: string; deposit?: boolean };
  "REG-01": { level1Complete?: boolean; level2Triggered?: boolean; level2Resolved?: boolean };
  "REG-02": { codeStatusDocumented?: boolean; molstSigned?: boolean };
  "REG-03": { capacityDocumented?: boolean; impaired?: boolean; proxyDocumented?: boolean };
  "REG-04": { immunizationsAvailable?: boolean; tbScreened?: boolean };
  "ACU-01": Presence;
  "ACU-02": Presence;
  "ACU-04": Presence;
  "ACU-05": Presence;
  "ACU-07": Presence;
  "ACU-03": { present?: boolean; lineType?: "peripheral" | "midline" | "picc" | "central"; startsAt?: string };
  "ACU-06": { present?: boolean; correctionScaleNeeded?: boolean; scalePresent?: boolean };
  "ACU-08": { present?: boolean };
  "ACU-09": { weightKg?: number };
  "INF-01": { present?: boolean; type?: "contact" | "droplet" | "airborne" };
  "INF-02": { present?: boolean; route?: "oral" | "iv"; indication?: boolean; course?: boolean; stopDate?: boolean; lineOrders?: boolean };
  "RX-06": { allSigned?: boolean };
  "SKN-01": Presence;
  "SKN-02": Presence;
  "SKN-03": { present?: boolean; type?: "low_air_loss" | "vac" };
  "NUT-01": { conflict?: boolean };
  "NUT-02": { type?: "peg" | "pej" | "ng"; formula?: boolean; rate?: boolean; flushes?: boolean };
  "MON-02": { frequency?: boolean; hypoglycemiaParameters?: boolean };
  "MON-03": { present?: boolean; kind?: "continuous_telemetry" | "daily_weights" | "spot_sat" };
  "DCP-01": { destinationDocumented?: boolean; safeHome?: boolean; placementPath?: boolean };
}

export interface Med {
  name: string;
  dose?: string;
  route?: string;
  schedule?: string;
  firstDoseDue?: string; // ISO
  controlled?: boolean;
  hardCopyPresent?: boolean;
  correctionScale?: boolean;
}

export interface Timing {
  dischargeAt?: string; // ISO
  arrivalAt?: string; // ISO
}

/** Fields that `appliesWhen` predicates read. An undefined field never satisfies a predicate. */
export interface Patient {
  weightKg?: number;
  /** Acuity-tier unit: vent_trach | complex_medical | skilled_medical | short_stay_rehab | long_term_care | memory_care */
  targetUnit?: string;
  medicaidPending?: boolean;
  tubeFed?: boolean;
  insulinRequired?: boolean;
  ventDependent?: boolean;
  trach?: boolean;
  dialysis?: boolean;
  elopementRisk?: boolean;
  /** Derived from INF-01 when not supplied. */
  isolationRequired?: boolean;
  [field: string]: unknown;
}

export interface Extraction {
  answers: RuleAnswer[];
  medications: Med[];
  timing: Timing;
  patient: Patient;
}
