# Why this exists

Small handoff failures between hospital and SNF turn into readmissions. The screening pipeline exists to catch these before the patient arrives:

1. **A diuretic dose changed on the last hospital day, and the SNF gives the old dose.**
2. **The SNF pharmacy can't supply a non-formulary drug (e.g. sacubitril/valsartan, an SGLT2 inhibitor) on day 1, so doses get missed.**
3. **No one orders daily weights, or there's no plan for what to do when weight goes up.**
4. **Equipment (a scale for a patient who can't stand, home O2, CPAP) isn't there when the patient arrives.**
5. **Labs pending at discharge (potassium, creatinine) are never followed up.**
6. **No cardiology follow-up is booked.**

## Coverage map (engine rules → failure modes)

| Failure mode | Covered by | Status |
|---|---|---|
| 2. Day-1 non-formulary supply | RX-01 (formulary), RX-02 (first dose vs cutoff), RX-03 (payor PA), RX-05 (interchange), formulary engine + `firstDoseAtRisk` | Covered — this is the engine's strongest axis |
| 4. Equipment not there on arrival | THR-03 (required equipment identified and available) | Covered |
| 5. Pending labs never followed up | FUP-01 (every pending result with a named recipient), MON-01 (standing order for lab-monitored meds — narrative is not an order) | Covered |
| 6. No cardiology follow-up booked | FUP-02 (PCP of record), FUP-03 (appointments with date, location, transport) | Covered |
| 3. Daily weights / weight-gain plan | MON-03 (monitoring requirements vs facility capability) catches *facility can't do it*; **the absence of a weights order / escalation plan in the packet is only partially surfaced** | Partial |
| 1. Last-day dose change vs old dose | Contradiction machinery exists per rule, **but the medication extraction does not yet explicitly reconcile the discharge med list against late-stay progress notes/orders** | Gap |

## Decided 2026-11-21: both gaps are in scope

- **Medication reconciliation sweep (failure mode 1):** the medications extraction call explicitly compares the discharge med list / MAR against doses in the final days' progress notes and orders, and emits any divergence as an anchored contradiction (both quotes, both pages) attached to the medication — surfaced in "What matters most" as a TONIGHT-class item ("Torsemide listed at 40 mg but last progress note says increased to 60 mg — confirm before first dose").
- **Packet-completeness checks (failure mode 3):** diagnosis-aware expectations evaluated against the packet itself, independent of facility — starting with HF ⇒ daily-weights order + weight-gain escalation plan. Missing expectations surface as `packetGaps` (cautions under the monitoring criterion), never as facility rule verdict changes. Implemented as an extensible registry (`packet-checks`) so more diagnosis→expectation pairs can be added.
- **Follow-up asks (voice-agent groundwork):** every blocking/conditional/gap item carries a `followUpAsk` — the one-sentence question to put to the discharging hospital ("Confirm current torsemide dose: discharge list says 40 mg, 11/16 progress note says 60 mg"). Future direction: a voice AI agent that calls the hospital to work this list; the screening output is its call sheet.
