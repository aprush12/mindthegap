import rulesJson from "./rules.json" with { type: "json" };
import formularyJson from "./formulary.json" with { type: "json" };
import facilitiesJson from "./facilities.json" with { type: "json" };
import snapshotJson from "../capacity/snapshot.json" with { type: "json" };
import {
  CapacitySnapshotSchema, FacilitiesSchema, FormularySchema, RulesSchema,
  type CapacitySnapshot, type Facility, type FormularyAgent, type Rule,
} from "./schema.js";

export interface Policy {
  rules: Rule[];
  formulary: FormularyAgent[];
  facilities: Facility[];
}

export function loadPolicy(): Policy {
  return {
    rules: RulesSchema.parse(rulesJson),
    formulary: FormularySchema.parse(formularyJson),
    facilities: FacilitiesSchema.parse(facilitiesJson),
  };
}

/** Capacity as committed in the repo. The API serves the live file; tests use this. */
export function loadCapacity(): CapacitySnapshot {
  return CapacitySnapshotSchema.parse(snapshotJson);
}
