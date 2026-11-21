import type { FacilityId, FormularyAgent, FormularyStatus } from "../policy/schema.js";
import type { Med } from "../types.js";

export interface MedReport {
  med: string;
  agent?: string;
  status: FormularyStatus | "unmatched";
  actions: string[];
  /** Hours from arrival until the item can be cleared (P&T exception and/or payor PA). 0 = nothing to wait for. */
  leadHours: number;
  resolveBy?: string;
  interchangeTo?: string;
  payorPA: boolean;
  controlled: boolean;
  firstDoseAtRisk?: boolean;
  /** First dose due time (ISO) and, for at-risk meds, the earliest the facility can supply it (null = never). Audit detail only. */
  firstDoseDue?: string;
  supplyAt?: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Case-insensitive, whole-word match on agent name or alias. Longest matching term wins
 *  (so "sacubitril/valsartan" beats "valsartan"). */
export function matchAgent(medName: string, formulary: FormularyAgent[]): FormularyAgent | undefined {
  const hay = ` ${norm(medName)} `;
  let best: FormularyAgent | undefined;
  let bestLen = 0;
  for (const agent of formulary) {
    for (const term of [agent.agent, ...agent.aliases]) {
      const t = norm(term);
      if (t.length > bestLen && hay.includes(` ${t} `)) {
        best = agent;
        bestLen = t.length;
      }
    }
  }
  return best;
}

export function evaluateMed(med: Med, agent: FormularyAgent | undefined, facilityId: FacilityId): MedReport {
  const controlled = Boolean(med.controlled ?? agent?.controlled);
  if (!agent) {
    return { med: med.name, status: "unmatched", actions: ["Agent not in formulary list; verify with pharmacy"], leadHours: 0, payorPA: false, controlled };
  }
  const cell = agent.perFacility[facilityId];
  const actions: string[] = [];
  let leadHours = 0;
  const payorPA = cell.payorPA === true || cell.status === "pa";
  switch (cell.status) {
    case "nf":
      leadHours = cell.leadHours ?? 72;
      actions.push(`Request P&T exception (${leadHours}h)`);
      break;
    case "pa":
      break;
    case "interchange":
      actions.push(`Obtain prescriber order interchanging to ${cell.interchangeTo}`);
      break;
    case "not_stocked":
      actions.push("Cannot be supplied at any lead time; prescriber to choose an alternative");
      break;
    case "not_accepted":
      actions.push("Not accepted at this facility; prescriber to choose an alternative");
      break;
    case "formulary":
      break;
  }
  if (payorPA) {
    const h = cell.paHours ?? 0;
    leadHours = Math.max(leadHours, h);
    actions.push(h ? `Payor prior authorization (${h}h)` : "Payor prior authorization");
  }
  for (const c of cell.conditions ?? []) actions.push(`Condition: ${c}`);
  if (cell.unitRestriction) actions.push(`Unit restriction: ${cell.unitRestriction}`);
  if (controlled && med.hardCopyPresent !== true) actions.push("Signed hard copy required");
  return { med: med.name, agent: agent.agent, status: cell.status, actions, leadHours, interchangeTo: cell.interchangeTo, payorPA, controlled };
}
