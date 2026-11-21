# Facility Acceptance Policies — Nursing Homes A, B, C

> Source of truth for the screening engine. Three **synthetic** receiving facilities, each with 43 machine-checkable acceptance rules across payor, regulatory, acuity, infection control, pharmacy, wounds, therapy, nutrition, monitoring, follow-up and discharge planning. They differ enough that the same patient is a conditional accept at one, a clean clinical fit blocked on paperwork at the second, and a decline at the third.
>
> All facilities, formularies, staffing levels and thresholds are invented. The structure reflects how SNF admissions actually screens referrals; the specific numbers are illustrative. Before use with a real operator, rebuild the rules from that facility's own policy manual, formulary contract and staffing matrix.

## How to read these

Each rule is a **question asked of the patient's record**, not a sentence from a policy manual. The agent iterates the rules, not the document. That bounds the work, makes every answer auditable, and means a 60-page care plan produces a fixed-length scored checklist rather than a summary.

Every rule carries a decision for when it is not met:

| Decision | Meaning |
|---|---|
| **Block** | Admission cannot proceed until this is resolved |
| **Conditional** | Admission may proceed, and the item must be resolved within a stated number of hours |
| **Review** | Flag for the care plan; does not stop the admission |

Every rule returns one of four states, and the third is the one most systems get wrong:

1. **Met.** The record answers the question and the answer satisfies the requirement. Cites the document and section it came from.
2. **Not met.** The record answers and the answer fails the requirement.
3. **Unknown.** The record does not answer. This is not the same as met, and over a long document it is the most common result. A trach that is simply never mentioned and a trach the agent failed to find look identical, and one of them is a patient arriving that the facility cannot staff.
4. **Contradictory.** Two passages disagree, which happens constantly inside a single long chart where the wound appears in the H&P, the nursing notes and a consult at different stages. Report both with their locations. **Do not resolve it.**

Each rule also declares what to do when the answer is **unknown**, separately from what to do when it fails. For screening rules like PASRR and isolation status, unknown blocks, because you cannot place a patient on an assumption. For most others, unknown is conditional with a clock.

---

## Nursing Home A: Bayview Rehabilitation & Nursing

Mid-size urban SNF, 140 beds, short-stay rehab focus with moderate clinical acuity. No vent or trach unit, no secured unit. This is the median facility and the one most hospital discharges actually go to.

| | |
|---|---|
| Units | Short-stay rehab 48, skilled medical 62, long-term care 30 |
| Formulary contract | 01/2026 to 12/2026, conservative, exceptions through P&T |
| Pharmacy | Contracted long-term care pharmacy, off site |
| Cutoff | 18:00, next delivery 10:00 |
| Emergency kit | Limited. No insulin analogs, no DOAC, no ARNI |

**Capacity as of 17 Nov 20:00.** Three rehab beds, one skilled medical bed, no long-term care beds. One isolation room. Overnight coverage is 1 RN and 3 LPN with the physician on call off site. No sitters available. Therapy is at capacity for 48 hours.

**What stops an admission here, 13 blocking rules.** Missing authorization or fewer than five days approved. No qualifying Medicare stay. Incomplete PASRR. Ventilator, tracheostomy, TPN, or a central line started after 18:00. Dialysis without a confirmed chair and transport. Elopement risk, since there is no secured unit. A one-to-one sitter requirement. Weight over 159 kg. An isolation requirement when the single isolation room is taken. Controlled substances without a signed hard copy. A continuous telemetry requirement.

**Characteristic failure: timing, not capability.** Bayview can care for most medically complex patients. What it cannot do is get a non-formulary medication into the building after 18:00, and its emergency kit excludes exactly the agents a modern cardiac discharge is built on.

## Nursing Home B: Harborview Post-Acute & Pulmonary

High-acuity post-acute, 200 beds, with a 24-bed ventilator and tracheostomy unit and four in-house dialysis chairs. Takes the patients A and C cannot. Because it carries that acuity, it is stricter about documentation **before** the patient is in the building, not after.

| | |
|---|---|
| Units | Vent and trach 24, complex medical 76, short-stay rehab 60, long-term care 40 |
| Formulary contract | 01/2026 to 12/2026, broad, includes ARNI, SGLT2 and DOAC |
| Pharmacy | In-house licensed pharmacy |
| Cutoff | 22:00, on-call pharmacist within 90 minutes after |
| Emergency kit | Broad. Insulin analogs, DOAC, IV antibiotics |

**Capacity as of 17 Nov 20:00.** Two vent beds, six complex medical, four rehab, one long-term care. Three isolation rooms. Overnight coverage is 4 RN, 6 LPN and a respiratory therapist on site, with an NP on site until 23:00. One sitter available. Therapy available.

**What stops an admission here, 8 blocking rules.** Missing authorization, or fewer than seven days approved for complex medical and ten for the vent unit. No qualifying Medicare stay. Incomplete PASRR. No signed MOLST for a vent admission. Elopement risk, since there is no secured unit. Weight over 227 kg. Controlled substances without a hard copy. And the one that catches most referrals: **no signed physician order set before arrival** for any complex medical or vent admission.

**Characteristic failure: paperwork, not capability.** Harborview can almost always care for the patient. It will refuse the admission because the hospital has not signed the orders yet — a different and more fixable problem than anything at A or C. The most capable facility produces the most blocks, and all of them are on the sending side.

## Nursing Home C: Maple Grove Skilled Nursing

Smaller suburban facility, 90 beds, long-term care heavy, with a 20-bed secured memory care unit. Strong on dementia, wandering and behavioral management. Limited medical acuity, narrow formulary, and a pharmacy 40 minutes away with an early cutoff.

| | |
|---|---|
| Units | Secured memory care 20, long-term care 46, short-stay rehab 24 |
| Formulary contract | 01/2026 to 12/2026, narrow, exceptions take 72 to 96 hours |
| Pharmacy | Contracted long-term care pharmacy, off site, 40 minutes away |
| Cutoff | 16:00, next delivery 11:00 the following day |
| Emergency kit | Minimal. Oral analgesics and antiemetics only |

**Capacity as of 17 Nov 20:00.** Two memory care beds, five long-term care, one rehab bed. No isolation rooms available. Overnight coverage is 1 RN until 23:00, then LPN only with an RN on call. No sitters. Therapy limited to PT, with OT and speech by contract on a five-day lead.

**What stops an admission here, 21 blocking rules.** Everything A blocks, plus: any IV therapy after 23:00 and all central lines. Any dialysis. Multi-dose insulin with a correction scale, because RN coverage ends at 23:00. Any isolation requirement, since there are no isolation rooms. Wound vac. Weight over 136 kg. A diet order that conflicts with a swallow evaluation, since there is no speech therapist on site. Glucose monitoring parameters not supplied before admission. Medicaid pending without a reference number or a deposit. No named responsible party at signing. Continuous telemetry or anything beyond spot oxygen saturation. And the first-dose rule: a patient arriving after 16:00 on a medication the facility does not stock will not receive it until 11:00 the next morning.

**Characteristic failure: scope.** Maple Grove is the right facility for a wandering dementia patient and the wrong facility for almost any medically complex one. Most of its blocks are honest statements of what it cannot do — the kind of policy that should prevent a referral rather than produce one that gets declined after three days of back and forth.

---

## The full rule set

Forty-three rules, identical questions at all three facilities, different answers. Decisions: **B** = block, **C** = conditional with resolution window in hours, **R** = review. The per-facility cell is what makes the rule machine-checkable: the requirement, not the policy prose.

| Rule | Question asked of the record | NH-A Bayview | NH-B Harborview | NH-C Maple Grove |
|---|---|---|---|---|
| PAY-01 | Active prior authorization with approved length of stay? | 5+ days, B | 7+ days, 10+ for vent, B | 5+ days, B |
| PAY-02 | Three-midnight qualifying stay documented for traditional Medicare? | Required, B | Required, B | Required, B |
| PAY-03 | Benefit day count known, day 21 co-insurance anticipated? | Notify before day 21, R | Notify before day 21, R | Financial counseling, C 72 |
| PAY-04 | Responsible or financially responsible party identified? | C 24 | C 24 | Required at signing, B |
| PAY-05 | If Medicaid pending, application submitted with a reference? | R | R | Reference or deposit, B |
| REG-01 | PASRR Level I complete, Level II resolved if triggered? | B | B | B, required for memory care |
| REG-02 | Code status documented, directive or MOLST if one exists? | C 24 | Before arrival, MOLST for vent, B | C 24 |
| REG-03 | Capacity documented, proxy or guardian if impaired? | C 24 | C 24 | Before memory care, B |
| REG-04 | Immunization dates and TB screening available? | R | R | TB before secured unit, C 48 |
| ACU-01 | Ventilator dependent? | Not accepted, B | Vent unit with weaning plan, C | Not accepted, B |
| ACU-02 | Tracheostomy present? | Not accepted, B | With size and airway plan, C | Not accepted, B |
| ACU-03 | IV therapy, and what line type? | PICC yes, no starts after 18:00, C | All line types, C | None after 23:00, no central, B |
| ACU-04 | Dialysis, with a chair and transport arranged? | Outpatient only, chair confirmed, B | In-house chair or outpatient, C | Not accepted, B |
| ACU-05 | Total parenteral nutrition? | Not accepted, B | With formula and labs, C | Not accepted, B |
| ACU-06 | Insulin-requiring with a correction scale needing overnight coverage? | Scale in hand before first meal, C 12 | Facility protocol until scale arrives, C 24 | Not accepted, RN ends 23:00, B |
| ACU-07 | Elopement risk, wandering dementia, behavioral need? | No secured unit, B | No secured unit, B | Secured unit with care plan, C |
| ACU-08 | One-to-one observation required? | None available, B | One available, check roster, C | Secured unit in place of sitter, C |
| ACU-09 | Weight within the equipment limit? | 159 kg, B | 227 kg, B | 136 kg, B |
| INF-01 | MDRO, C. difficile or isolation status documented? | Private room for contact, C | Contact and droplet available, C | No isolation rooms, B |
| INF-02 | Antibiotics with indication, course and stop date? | Oral yes, IV needs line orders, C 24 | Oral and IV, C 24 | Oral only, C 24 |
| INF-03 | Isolation room physically available tonight? | 1 available, B | 3 available, R | 0 available, B |
| RX-01 | Every discharge medication on the formulary? | P&T exception, C 72 | Broad formulary, C 24 | Narrow formulary, C 96 |
| RX-02 | Will the first dose land before it is due, given the cutoff? | Cutoff 18:00, limited kit, C | Cutoff 22:00, on-call pharmacist, R | Cutoff 16:00, next day 11:00, B |
| RX-03 | Any medication requiring payor prior authorization? | DOAC and SGLT2, C 48 | DOAC, in house, C 24 | DOAC, SGLT2, ARNI, C 72 |
| RX-04 | Controlled substances with a signed hard copy? | B | B | B |
| RX-05 | Any therapeutic interchange to the stocked agent? | Glargine to detemir, C 12 | Glargine stocked, R | Glargine to NPH, C 24 |
| RX-06 | Signed physician order set for every medication? | C 12 | Before arrival for complex, B | C 24 |
| SKN-01 | Every wound with stage, measurements, site and treatment order? | C 24 | Plus photograph, C 12 | C 24 |
| SKN-02 | Each wound explicitly documented as present on admission? | Stated and confirmed, C 24 | Stated and photographed, C 12 | Stated and confirmed, C 24 |
| SKN-03 | Specialty surface or wound vac needed? | Low air loss and vac, C 48 | Both in house, C 24 | Vac not accepted, B |
| THR-01 | Weight-bearing status documented? | C 24 | C 24 | C 48 |
| THR-02 | Prior level of function with PT, OT and speech recommendations? | R | R | PT only, 5-day lead, C 120 |
| THR-03 | Required equipment identified and available? | CPAP settings needed, C 12 | Oxygen, CPAP, BiPAP with RT, C 12 | Patient-owned device, C 24 |
| NUT-01 | Diet order consistent with the swallow evaluation? | Hold at safer texture, C 12 | Speech on site to re-evaluate, C 12 | No speech on site, conflict not accepted, B |
| NUT-02 | If tube fed, formula, rate, flushes and tube type? | PEG yes, NG no, C 12 | PEG, PEJ, NG, C 12 | PEG yes, NG no, C 24 |
| MON-01 | Standing order for every medication requiring lab monitoring? | Narrative is not an order, C 24 | C 24 | Draws twice weekly, C 72 |
| MON-02 | Glucose frequency and hypoglycemia parameters specified? | Before first meal, C 12 | Facility protocol interim, C 24 | Before admission, B |
| MON-03 | Telemetry, daily weights or saturation monitoring required? | No continuous telemetry, B | All available, C | Daily weights and spot only, B |
| FUP-01 | Every pending result with a named recipient? | C 24 | C 24 | C 48 |
| FUP-02 | Primary care physician of record identified? | Or medical director, C 72 | Or medical director, C 72 | Or medical director, C 72 |
| FUP-03 | Appointments with a date, location and arranged transport? | C 48 | C 48 | Limited vehicles, C 72 |
| DCP-01 | Discharge destination and home environment documented? | R | R | Placement path if no safe home, C 120 |
| DCP-02 | Bed hold policy explained and acknowledged? | R | R | R |

Blocking rule counts: Bayview 13, Harborview 8, Maple Grove 21. The spread is the point.

---

## The formularies

The RX rules are the process; this is the data they check against: 79 agents per facility, covering what actually appears on a post-acute discharge list. Each facility's formulary is locked to its annual contract, which is why it can be precomputed before the patient leaves the hospital.

**Status values:** `Formulary` = stocked, no action. `PA` = stocked but the payor needs prior authorization before it bills. `NF` = non-formulary, needs a P&T exception, lead time stated. `Interchange` = automatic substitution to the stocked agent (still needs a prescriber order). `Not stocked` = cannot be supplied at any lead time.

### Where the three facilities diverge (34 agents)

| Agent | NH-A Bayview | NH-B Harborview | NH-C Maple Grove |
|---|---|---|---|
| Sacubitril/valsartan (Entresto) | NF 72h | Formulary | Not stocked |
| Valsartan | Formulary | Formulary | Interchange to losartan |
| Metoprolol succinate | Formulary | Formulary | Interchange to tartrate |
| Torsemide | Formulary | Formulary | NF 96h |
| Bumetanide | NF 72h | Formulary | Not stocked |
| Spironolactone | Formulary, needs K+ and Cr order | Formulary, monitoring order | Formulary, draws twice weekly |
| Eplerenone | NF 72h | Formulary | Not stocked |
| Empagliflozin (Jardiance) | NF 72h plus payor PA | Formulary, PA 24h | Not stocked |
| Dapagliflozin (Farxiga) | NF 72h plus payor PA | Formulary, PA 24h | Not stocked |
| Apixaban (Eliquis) | Tier 2, PA 48h, renal dose must match | Formulary, PA 24h | NF 72h plus PA |
| Rivaroxaban (Xarelto) | Tier 2, PA 48h | Formulary, PA 24h | NF 72h plus PA |
| Enoxaparin | Formulary | Formulary | Formulary, prefilled only |
| Heparin infusion | Not accepted | Complex medical unit only | Not accepted |
| Ticagrelor (Brilinta) | NF 72h, interchange to clopidogrel | Formulary | Not stocked |
| Insulin glargine | NF, interchange to detemir, order within 12h | Formulary, stocked | NF, interchange to NPH, 24h |
| Insulin detemir | Formulary, the stocked agent | Formulary | NF 96h |
| NPH insulin | Formulary | Formulary | Formulary, the stocked agent |
| Insulin aspart | Formulary, written scale required | Formulary, protocol scale available | Correction scale not accepted |
| Insulin lispro | Formulary, written scale required | Formulary | Correction scale not accepted |
| Regular insulin | Formulary | Formulary | Formulary, fixed dose only |
| Sitagliptin | NF 72h | Formulary | NF 96h |
| Semaglutide | NF 72h plus payor PA | Formulary, PA 24h | Not stocked |
| Dulaglutide | NF 72h plus payor PA | Formulary, PA 24h | Not stocked |
| Rosuvastatin | Formulary | Formulary | Interchange to atorvastatin |
| Ezetimibe | Formulary | Formulary | NF 96h |
| Potassium chloride ER | Formulary, needs K+ order | Formulary, monitoring order | Formulary, draws twice weekly |
| Hydromorphone | Formulary, hard copy | Formulary, hard copy | Not stocked |
| Ceftriaxone IV | Formulary, line orders required | Formulary | Not accepted |
| Vancomycin IV | NF, level monitoring unavailable | Formulary, levels in house | Not accepted |
| Ertapenem IV | NF 72h | Formulary | Not accepted |
| Linezolid | NF 72h plus PA | Formulary, PA 24h | Not stocked |
| Tiotropium | NF 72h | Formulary | NF 96h |
| Donepezil | Formulary | Formulary | Formulary, stocked for memory care |
| Memantine | Formulary | Formulary | Formulary, stocked for memory care |

### Formulary at all three with no action (34 agents)

lisinopril, enalapril, losartan, carvedilol, metoprolol tartrate, furosemide, amiodarone, diltiazem, hydralazine, isosorbide mononitrate, aspirin, clopidogrel, glipizide, glimepiride, atorvastatin, famotidine, levothyroxine, amoxicillin/clavulanate, cephalexin, levofloxacin, metronidazole, albuterol nebulizer, ipratropium/albuterol, fluticasone/salmeterol, prednisone, sertraline, mirtazapine, trazodone, docusate, senna, polyethylene glycol, ondansetron, tamsulosin, allopurinol.

### Formulary at all three but carrying a condition (11 agents)

- **warfarin** — needs an INR goal
- **pantoprazole** — needs a documented indication
- **acetaminophen** — needs a stated maximum daily dose
- **oxycodone** — needs a signed hard copy
- **quetiapine, risperidone, haloperidol** — need documented consent; Bayview also requires a documented indication
- **metformin, gabapentin, nitrofurantoin** — renal thresholds that Bayview states explicitly and the other two leave to the prescriber
- **digoxin** — needs level monitoring

Two things to notice. Maple Grove does not stock a single modern heart failure or diabetes agent, and stocks both dementia drugs — a coherent facility rather than a bad one. And Bayview's pattern is the common one: almost everything is available, but fourteen agents need a 72-hour exception, which only matters because a patient arrives at 20:40 and the first dose is due at 08:00.

---

## Reference case: same patient, three answers

**Elena Mercado**, 77, discharged from Riverside General at 18:42 on 17 Nov, arriving at 20:40. Heart failure with an ejection fraction of 32%, chronic kidney disease stage 3b, insulin-requiring diabetes, atrial fibrillation on a reduced-dose DOAC, and a stage 2 sacral pressure injury. No trach, no vent, no dialysis, no behavioral risk, 71.4 kg. Authorization pending. The sliding scale insulin orders, the signed physician orders and the discharge summary itself were never received.

| | NH-A Bayview | NH-B Harborview | NH-C Maple Grove |
|---|---|---|---|
| Verdict | Conditional accept | Clinically the best fit, blocked | Decline |
| Blocking items | 3 | 4 | 7 |
| Items on a clock | 17 | 12 | 14 |
| First dose at risk tonight | Yes | No | Yes, until 11:00 tomorrow |

**Bayview blocks on:** authorization pending; PASRR never mentioned anywhere in the record (returns **unknown**, not met); MDRO/isolation status undocumented. Then seventeen conditional items, of which three bite tonight: the insulin correction scale is referenced and absent, the glargine needs an interchange order to detemir, and arrival at 20:40 is past the 18:00 pharmacy cutoff with an emergency kit that stocks neither insulin analogs nor the ARNI. The basic metabolic panel the discharge summary asks for in seven days exists only as narrative text, so no standing order will ever generate it.

**Harborview blocks on:** authorization (needs seven days approved rather than five); PASRR unknown; isolation status unknown; no signed physician order set before arrival (required for any complex medical admission). Clinically it is the right building — every medication on formulary, pharmacy open until 22:00 with an on-call pharmacist after, telemetry available, NP on site. All four blocks are the sending hospital's to clear.

**Maple Grove declines on:** multi-dose insulin with a correction scale (RN coverage ends 23:00); arrival past a 16:00 pharmacy cutoff with next delivery at 11:00; glucose parameters required before admission and not supplied; no responsible party named at signing; plus authorization, PASRR and isolation status. Four of its blocks are capability statements that should have prevented the referral.

---

## Design notes (adopted as v1 schema decisions)

1. **Unknown handling is per facility, not per rule.** A single global unknown-behavior per rule is wrong: Harborview treats a missing code status as conditional even though its stated policy requires it before arrival. The unknown decision lives in the facility column alongside the requirement. Unknown is the most common state over a long document.
2. **Scope conditions (`appliesWhen`).** Maple Grove blocks on a capacity assessment only required for memory care placement; without a scope clause the rule fires for every patient and trains the admissions nurse to ignore the checklist. Each rule carries an applies-when clause evaluated before the requirement.
3. **Policy and capacity are two different objects.** Policy changes once a year with the PBM and staffing contracts; the capacity snapshot changes every shift. Policy is versioned annually; capacity is polled/updated per shift. The interesting product is the join: our policy says yes, tonight says no.
4. **Lead time is computed, not stored.** Resolution windows are stated in hours, but the admissions nurse needs a timestamp: resolve by 06:00 or the 08:00 dose is missed. Arrival time, first-dose-due time and the pharmacy cutoff are all in the data; deriving `resolveBy` turns a checklist into a worklist.
