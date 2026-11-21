/**
 * Harold Jennings packet content: the inverse failure mode of Elena. The paperwork is COMPLETE (active authorization,
 * PASRR, isolation status, signed orders, discharge summary, code status, responsible party, follow-up), and the one
 * hard problem is clinical: continuous cardiac telemetry is ordered, which Bayview and Maple Grove cannot provide.
 * The self-check enforces both the load-bearing presences and the deliberate absences (no diabetes/anticoagulant/
 * wound/airway/behavioral content). Three honest conditional gaps remain: weight-bearing status only in the PT
 * narrative, a pending potassium result with no named recipient, and no bed-hold acknowledgment.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rng, type PacketSpec, type Writer } from "./layout.js";
import { coverPage, signed, timeSeriesRows } from "./sections.js";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../samples/synthetic-harold-packet.pdf");
const HOSPITAL = "Riverside General Medical Center";
const PATIENT_LINE = "Patient: Harold Jennings    DOB 06/02/1958    MRN RG-901377    (synthetic test record)";

const DAYS = ["10 Nov", "11 Nov", "12 Nov", "13 Nov", "14 Nov", "15 Nov", "16 Nov", "17 Nov"];
const WT = ["103.4", "101.8", "100.1", "98.7", "97.6", "96.5", "95.7", "95.0"]; // 18 Nov discharge: 95.0
const R = rng(901377);
const rint = (lo: number, hi: number) => Math.round(lo + R() * (hi - lo));

const WIFE = "Denise Jennings";
const WIFE_PHONE = "(555) 555-0143";
const PCP = "Naomi Whitfield, MD";
const CARDS = "Marcus Feldt, MD";

// ---------------------------------------------------------------- sections

function faceSheet(w: Writer) {
  w.section("Face Sheet / Patient Demographics", "Registration print-out, encounter 7720955102");
  w.h("Patient");
  w.kv([
    ["Name", "JENNINGS, HAROLD"],
    ["Date of birth / age / sex", "06/02/1958 / 68 years / Male"],
    ["Medical record number", "RG-901377"],
    ["Encounter number", "7720955102"],
    ["Preferred language", "English; interpreter not required"],
    ["Marital status", "Married"],
    ["Height / weight", "178 cm / 95.0 kg (discharge weight, standing scale, 18 Nov 2026)"],
    ["Allergies", "Sulfa antibiotics (rash, 2011). No known food or latex allergy."],
  ]);
  w.h("Encounter");
  w.kv([
    ["Admission date", "10 Nov 2026, 09:40 via Emergency Department"],
    ["Admission type", "Inpatient (order time 10 Nov 2026, 12:15)"],
    ["Midnights as inpatient", "8 (nights of 10 through 17 Nov 2026)"],
    ["Discharge date / time", "18 Nov 2026, 11:30"],
    ["Attending physician", "Priya Raman, MD (Hospital Medicine)"],
    ["Unit", "4 West Medical-Surgical with telemetry"],
    ["Admitting diagnosis", "Acute decompensated heart failure with reduced ejection fraction, atrial fibrillation with rapid ventricular response"],
    ["Disposition", "Skilled nursing facility, skilled medical unit, with continuous cardiac telemetry"],
  ]);
  w.h("Contacts");
  w.kv([
    ["Emergency contact / responsible party", `${WIFE} (wife), ${WIFE_PHONE}, lives with the patient`],
    ["Healthcare agent", `${WIFE}, named in the signed advance directive dated 03 Mar 2024`],
    ["Primary care physician", `${PCP}, Eastgate Family Medicine`],
  ]);
  w.h("Coverage (as registered)");
  w.kv([
    ["Primary payor", "Northbridge Health Plan Medicare Advantage (synthetic payor)"],
    ["Member ID", "NBH-30-61208-01"],
    ["Verification", "Eligibility active on date of admission. Post-acute authorization approved; see Insurance and Authorization section."],
  ]);
  w.h("Hospital problem list at discharge");
  w.bullets([
    "Heart failure with reduced ejection fraction, EF 25%, ischemic cardiomyopathy, acute on chronic, improved with diuresis",
    "Atrial fibrillation with rapid ventricular response on admission, rate controlled on amiodarone; continuous telemetry ordered after rate-control titration",
    "Chronic kidney disease stage 2, baseline creatinine 1.1 to 1.3 mg/dL",
    "Obstructive sleep apnea on home CPAP",
    "Chronic hypoxemia on 2 L oxygen by nasal cannula",
    "Hypertension; hyperlipidemia; remote duodenal ulcer with GI bleed 2024",
  ]);
}

function insurance(w: Writer) {
  w.section("Insurance and Authorization Note", "Case management / utilization review, 17 Nov 2026 11:20");
  w.h("Payor");
  w.kv([
    ["Payor", "Northbridge Health Plan Medicare Advantage (synthetic payor)"],
    ["Plan type", "Medicare Advantage HMO"],
    ["Member ID", "NBH-30-61208-01"],
    ["Payor utilization line", "Skilled nursing facility authorizations, prior authorization unit"],
  ]);
  w.h("Authorization status");
  w.p("Prior authorization for skilled nursing facility admission was submitted on 15 Nov 2026 and approved on 17 Nov 2026 at 11:05. Authorization is ACTIVE. The plan approved 8 days approved for the initial skilled stay, 18 Nov 2026 through 25 Nov 2026, with concurrent review due on 24 Nov 2026.", { keep: true });
  w.table(
    ["Item", "Detail"],
    [
      ["Authorization status", "ACTIVE - determination received 17 Nov 2026 11:05"],
      ["Payor authorization number", "NBH-PA-2026-122907"],
      ["Days approved", "8 days approved (18 Nov through 25 Nov 2026)"],
      ["Level of care approved", "Skilled nursing, complex medical"],
      ["Concurrent review", "Due 24 Nov 2026; facility clinical liaison to submit"],
      ["Benefit day count", "0 of 100 skilled nursing days used in this benefit period; day 21 co-insurance begins 08 Dec 2026 if the stay continues"],
      ["Financial counseling", "Completed with the patient and his wife by hospital financial counseling on 17 Nov 2026"],
    ],
    [140, 340],
  );
  w.h("Inpatient stay qualifying information");
  w.p("Inpatient admission 10 Nov 2026 with eight midnights as an inpatient (10 through 17 Nov). The admission order was written at 12:15 on 10 Nov 2026. Three-midnight qualifying stay is met.");
  w.h("Case management comments");
  w.p("The authorization letter is attached to this transmission and was reviewed with Mr. Jennings and his wife. The receiving facility business office has been given the authorization number. No peer-to-peer review was needed.");
}

function caseMgmt(w: Writer) {
  w.section("Case Management Progress Notes", "Care coordination and utilization review - 10 to 18 Nov 2026");
  const notes: [string, string][] = [
    ["10 Nov 2026 15:10", "Admission screen completed. Patient lives with his wife in a two-story home with the bedroom upstairs. Independent before this illness except for exertional limitation. Insurance verified. Anticipate skilled nursing facility after diuresis because of oxygen need, telemetry need after rate-control titration, and inability to manage stairs."],
    ["11 Nov 2026 14:30", "Spoke with wife by telephone and in person. She agrees with skilled nursing facility placement and will sign admission paperwork on the day of transfer. Choice list provided: three facilities within 25 miles."],
    ["13 Nov 2026 11:00", "Clinical packet shared with two candidate facilities for pre-screening. One facility noted it does not offer continuous cardiac telemetry; discussed with attending. Telemetry need to be stated explicitly in orders and discharge plan."],
    ["15 Nov 2026 09:45", "Prior authorization submitted with cardiology and physical therapy documentation. Pre-admission screening Level I completed by social work; see PASRR section."],
    ["16 Nov 2026 13:20", "Cardiology confirms the amiodarone load is complete and that continuous cardiac telemetry is to continue after discharge for the first seven days. Physician order set drafted."],
    ["17 Nov 2026 11:25", "Authorization approved, 8 days approved. Physician order set signed at 15:40 by Dr. Raman; discharge summary signed at 16:10. Transport booked for the morning."],
    ["18 Nov 2026 08:50", "Wife at bedside, has signed the facility admission paperwork and the advance directive copy was sent with the packet. Nurse-to-nurse report scheduled 11:00."],
  ];
  w.table(["Date / time", "Note"], notes.map(([a, b]) => [a, b]), [110, 370], 9);
  w.h("Transport");
  w.p("Wheelchair van with one attendant and portable oxygen at 2 L. Pickup at the 4 West entrance after discharge at 11:30. Estimated arrival at the receiving facility 14:30 on 18 Nov 2026, which is before the facility's afternoon pharmacy order window closes. The receiving unit has been told that continuous telemetry is required on arrival.");
  signed(w, "Case Management, Medical-Surgical Unit 4 West", "18 Nov 2026 08:55");
}

function edNote(w: Writer) {
  w.section("Emergency Department Record", "Triage and physician documentation - 10 Nov 2026");
  w.h("Triage");
  w.kv([
    ["Arrival", "10 Nov 2026 09:40, private vehicle, wife present"],
    ["Chief complaint", "Shortness of breath, palpitations, leg swelling for five days"],
    ["Triage vitals", "T 36.9 C, HR 138 irregular, BP 134/86, RR 26, SpO2 88% on room air"],
    ["Weight", "103.4 kg (bed scale)"],
    ["Acuity", "ESI level 2"],
  ]);
  w.h("Physician note");
  w.p("68-year-old man with ischemic cardiomyopathy and persistent atrial fibrillation who presents with five days of worsening dyspnea, orthopnea, palpitations and weight gain of about 8 kg over two weeks. He ran out of his sodium-restricted diet during a family visit. Examination showed jugular venous distension, bibasilar crackles to the mid-lung fields, an irregularly irregular tachycardia at 138 and 3+ pitting edema to the thighs. Electrocardiogram: atrial fibrillation with rapid ventricular response at 142, no acute ischemic changes. BNP 2,460 pg/mL. High-sensitivity troponin 31 then 33 ng/L, flat. Chest radiograph: cardiomegaly, pulmonary edema, small bilateral effusions.");
  w.p("Treatment: oxygen 4 L by nasal cannula with SpO2 improving to 94%, furosemide 80 mg intravenously with 1.9 L urine output in four hours, diltiazem was avoided given reduced ejection fraction, and amiodarone intravenous load was started after cardiology discussion. Admitted to telemetry under Hospital Medicine.");
  w.h("Skin and general");
  w.p("Skin intact on full examination including sacrum and heels. No pressure injury. No rash.");
  signed(w, "Emergency Medicine physician", "10 Nov 2026 12:02");
}

function hAndP(w: Writer) {
  w.section("History and Physical", "Hospital Medicine - Priya Raman, MD - dictated 10 Nov 2026 16:20");
  w.h("History of present illness");
  w.p("Mr. Jennings is a 68-year-old man with ischemic cardiomyopathy and heart failure with reduced ejection fraction (last EF 28% in 2025), persistent atrial fibrillation, chronic kidney disease stage 2, obstructive sleep apnea on CPAP and hypertension. He presented on 10 Nov 2026 with five days of progressive dyspnea, orthopnea, palpitations and leg swelling, with a weight gain of about 8 kg. He reports excess dietary sodium and no missed medications. He denies chest pain, syncope, fever or cough.");
  w.p("On arrival he was hypoxemic and in atrial fibrillation with rapid ventricular response. He was diuresed and an amiodarone load was begun for rate and rhythm control, since beta-blocker up-titration alone was limited by decompensation.");
  w.h("Past medical history");
  w.bullets([
    "Ischemic cardiomyopathy with HFrEF, diagnosed 2021; echo this admission EF 25%",
    "Persistent atrial fibrillation since 2022; CHA2DS2-VASc 4",
    "Duodenal ulcer with upper GI bleed in 2024, treated endoscopically; cardiology elected aspirin rather than an oral anticoagulant because of the bleed history",
    "Chronic kidney disease stage 2, eGFR 68",
    "Obstructive sleep apnea, on CPAP since 2019 with his own device",
    "Hypertension; hyperlipidemia",
    "Osteoarthritis of the right hip",
  ]);
  w.h("Home medications (patient report and pharmacy fill history)");
  w.table(
    ["Medication", "Dose", "Frequency", "Comment"],
    [
      ["Furosemide", "80 mg PO", "Twice daily", "Replaced by torsemide this admission"],
      ["Carvedilol", "6.25 mg PO", "BID", "Dose increased this admission"],
      ["Lisinopril", "5 mg PO", "Daily", "Stopped; renal and potassium review, see cardiology"],
      ["Atorvastatin", "40 mg PO", "Nightly", ""],
      ["Aspirin", "81 mg PO", "Daily", ""],
      ["Amiodarone", "200 mg PO", "Daily", "Started this admission"],
    ],
    [110, 90, 80, 200],
  );
  w.h("Social history");
  w.p("Married, lives with his wife Denise. Retired electrician. Former smoker, quit 2008, about 20 pack-years. Two to three beers a week, none since admission. No drug use. Independent in activities of daily living before this illness.");
  w.h("Physical examination");
  w.kv([
    ["Vitals on admission", "T 36.9 C, HR 138 irregular, BP 134/86, RR 26, SpO2 88% on room air improving to 94% on 4 L"],
    ["Weight", "103.4 kg on bed scale. Height 178 cm."],
    ["General", "Middle-aged man, alert, dyspneic at rest, speaking in short sentences."],
    ["Neck", "Jugular venous pressure elevated to the angle of the jaw."],
    ["Cardiac", "Irregularly irregular, tachycardic, S3 present, 2/6 apical systolic murmur."],
    ["Lungs", "Bibasilar crackles to the mid-lung fields."],
    ["Extremities", "3+ pitting edema to the thighs bilaterally; feet warm."],
    ["Neurologic", "Alert and oriented, no focal deficit."],
    ["Skin", "Intact. Sacrum and heels examined, no pressure injury."],
  ]);
  w.h("Assessment and plan");
  w.bullets([
    "Acute on chronic HFrEF (EF 25%): intravenous loop diuretic, strict intake and output, daily standing weights, 2 g sodium diet, 1.5 L fluid restriction, telemetry. Cardiology consulted.",
    "Atrial fibrillation with rapid ventricular response: amiodarone load, carvedilol titration. Continuous cardiac telemetry through the rate-control titration and after discharge.",
    "CKD stage 2: stable creatinine; monitor potassium and creatinine with diuretic and mineralocorticoid antagonist.",
    "Obstructive sleep apnea: continue patient-owned CPAP nightly.",
    "Disposition: skilled nursing facility after stabilization; case management and physical therapy consulted.",
  ]);
  signed(w, "Priya Raman, MD - Hospital Medicine", "10 Nov 2026 16:48");
}

function cardiology(w: Writer) {
  w.section("Cardiology Consultation", `${CARDS} - Cardiology - 11 Nov 2026 09:30`);
  w.p("Reason for consultation: acute on chronic HFrEF with atrial fibrillation and rapid ventricular response; guideline-directed medical therapy and rate-control strategy.");
  w.h("Assessment");
  w.p("Ischemic cardiomyopathy with EF 25% and persistent atrial fibrillation, decompensated after dietary sodium excess. Ventricular rate was not controlled on carvedilol alone because of congestion. Amiodarone loading is appropriate for rate control in this setting. Calcium channel blockers are contraindicated with this ejection fraction.");
  w.h("Recommendations");
  w.bullets([
    "Convert to torsemide 40 mg daily for improved oral bioavailability once euvolemia is near.",
    "Start empagliflozin 10 mg daily for heart failure with reduced ejection fraction. Renal function permits.",
    "Start spironolactone 25 mg daily with potassium and creatinine checked twice weekly for the first two weeks, then weekly. Hold for potassium above 5.3 mmol/L or creatinine rise above 30 percent.",
    "Continue and up-titrate carvedilol to 12.5 mg twice daily as tolerated; hold for heart rate below 55 or systolic pressure below 95.",
    "Continue amiodarone 200 mg daily after the load; thyroid and liver studies at baseline are normal; repeat in three months.",
    "Aspirin 81 mg daily. No oral anticoagulant because of the 2024 duodenal ulcer bleed; revisit at the clinic visit.",
    "Continuous cardiac telemetry ordered after discharge for the first seven days following rate-control titration, to detect pauses, bradycardia or recurrent rapid ventricular response on the new amiodarone and carvedilol doses. Alarm limits: heart rate above 120 or below 50, pause longer than 3 seconds.",
    "Follow-up in cardiology clinic on 25 Nov 2026.",
  ]);
  w.h("Echocardiogram review");
  w.p("Echocardiogram of 10 Nov 2026 shows dilated left ventricle with global hypokinesis and EF 25%. Moderate functional mitral regurgitation. See the diagnostic reports section.");
  signed(w, `${CARDS}, Cardiology`, "11 Nov 2026 10:20");
}

function progressNotes(w: Writer) {
  w.section("Physician Progress Notes", "Hospital Medicine - Priya Raman, MD");
  const days: [string, string, string][] = [
    ["11 Nov 2026", "Hospital day 2. Net negative 1.6 L overnight. SpO2 94% on 3 L. Rate 112 to 130 on carvedilol and amiodarone load. Cardiology consulted. Creatinine 1.2, potassium 4.1. Continue intravenous furosemide 80 mg twice daily.", "Weight 101.8 kg."],
    ["12 Nov 2026", "Hospital day 3. Net negative 1.9 L. Dyspnea improving. Rate 96 to 118. Oxygen weaned to 2 L. CPAP used overnight without difficulty. Continue diuresis and amiodarone load.", "Weight 100.1 kg."],
    ["13 Nov 2026", "Hospital day 4. Net negative 1.5 L. Edema to the knees. Rate 88 to 108. Plan to begin empagliflozin and spironolactone once creatinine confirmed stable.", "Weight 98.7 kg."],
    ["14 Nov 2026", "Hospital day 5. Empagliflozin 10 mg started. Rate 78 to 98. Furosemide changed to torsemide 40 mg daily. Creatinine 1.2.", "Weight 97.6 kg."],
    ["15 Nov 2026", "Hospital day 6. Spironolactone 25 mg started. Potassium 4.3. Rate 72 to 92 with brief rate of 104 on exertion. Physical therapy evaluation completed. Edema trace.", "Weight 96.5 kg."],
    ["16 Nov 2026", "Hospital day 7. Amiodarone load complete. Rate 66 to 88. No pauses. Cardiology agrees with discharge to skilled nursing facility with continuous cardiac telemetry for seven days. Potassium 4.5, creatinine 1.2.", "Weight 95.7 kg."],
    ["17 Nov 2026", "Hospital day 8. Euvolemic on oral torsemide. SpO2 94% on 2 L. Rate 64 to 84. Discharge planned for 18 Nov. Orders and discharge summary signed.", "Weight 95.0 kg."],
  ];
  for (const [d, note, wt] of days) {
    w.h(d);
    w.p(`${note} ${wt}`);
  }
  signed(w, "Priya Raman, MD - Hospital Medicine", "17 Nov 2026 17:30");
}

function hospitalCourse(w: Writer) {
  w.section("Hospital Course by Problem", "Hospital Medicine working summary for the receiving clinician - 17 Nov 2026 16:40");
  w.h("Heart failure with reduced ejection fraction (EF 25%)");
  w.p("Admitted volume overloaded at 103.4 kg. Diuresed with intravenous furosemide for five days, transitioned to oral torsemide 40 mg daily on 14 Nov. Discharge weight 95.0 kg, which is close to the estimated dry weight of 94 kg. Empagliflozin and spironolactone were added; lisinopril was stopped. Daily weights and strict intake and output continue after discharge.");
  w.h("Atrial fibrillation with rapid ventricular response");
  w.p("Ventricular rate 138 to 142 on arrival. Rate control achieved with an amiodarone load and carvedilol up-titration. The rate-control titration was completed on 16 Nov, and cardiology ordered continuous cardiac telemetry for the first seven days afterward. Aspirin only; no oral anticoagulant because of the 2024 duodenal ulcer bleed.");
  w.h("Chronic kidney disease stage 2");
  w.p("Creatinine 1.1 to 1.3 throughout. Potassium 4.1 to 4.5. Standing laboratory orders for potassium and creatinine twice weekly for two weeks, then weekly, are written in the physician order set.");
  w.h("Respiratory: obstructive sleep apnea and chronic hypoxemia");
  w.p("Oxygen requirement 2 L by nasal cannula at rest, SpO2 94%. Patient uses his own CPAP nightly; settings are documented in the respiratory therapy note.");
  w.h("Skin and mobility");
  w.p("Skin intact throughout the stay. Ambulates 150 feet with a rolling walker and standby assistance.");
  w.h("Condition at discharge");
  w.p("Stable. Vitals 18 Nov 10:30: BP 112/68, HR 72, RR 16, SpO2 94% on 2 L, T 36.7 C. Weight 95.0 kg.");
}

function nursing(w: Writer) {
  w.section("Nursing Notes", "4 West Medical-Surgical - shift documentation");
  const rows: [string, string][] = [
    ["10 Nov 19:30", "Admitted from the Emergency Department. Alert and oriented. Telemetry applied, atrial fibrillation 120s. Oxygen 4 L by nasal cannula. Skin intact on admission skin check, sacrum and heels clear. Fall risk moderate. Wife at bedside."],
    ["11 Nov 07:15", "Night shift: voided 1.4 L. Slept upright. Telemetry rate 110 to 130. Denied chest pain."],
    ["12 Nov 19:20", "Oxygen 2 L. Own CPAP brought from home, checked by respiratory therapy, used overnight. Up to the chair twice."],
    ["13 Nov 08:00", "Standing weight 98.7 kg. Intake and output recorded hourly. Edema improving."],
    ["14 Nov 19:10", "Started empagliflozin first dose without event. Instructed on genital hygiene. Telemetry rate 80s to 90s."],
    ["15 Nov 14:00", "Physical therapy walked patient 100 feet with rolling walker. SpO2 91% on exertion on 2 L, recovered to 94% within two minutes."],
    ["16 Nov 20:00", "Telemetry reviewed with cardiology: no pauses, rate 64 to 88. Patient reports feeling stronger. Wife educated on daily weights and sodium limits."],
    ["17 Nov 20:30", "Discharge teaching completed with patient and wife using teach-back. Skin intact. Belongings packed."],
    ["18 Nov 10:30", "Final vitals taken. Telemetry box discontinued for transport; the receiving unit to resume continuous cardiac telemetry on arrival. Report called to the receiving nurse at 11:00."],
  ];
  w.table(["Date / time", "Note"], rows.map(([a, b]) => [a, b]), [90, 390], 9);
  w.h("Admission skin check");
  w.p("Skin intact on admission and at every shift check. No pressure injury, no breakdown, no rash. Braden score 19.");
  w.h("Infection screening");
  w.p("Admission MRSA nares PCR negative on 10 Nov 2026. No history of multidrug-resistant organisms. No diarrhea; C. difficile testing not indicated. See the Infection Control Screening section.");
}

function flowsheet(w: Writer) {
  w.section("Nursing Assessment Flowsheet", "Every four hours - 4 West Medical-Surgical");
  w.p("Vital signs as charted by the unit. SpO2 on prescribed oxygen. Rhythm column from the bedside telemetry display at the time of charting.", { size: 9 });
  const times = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
  const rows = timeSeriesRows(DAYS, times, (_d, _t, di, ti) => {
    const hrBase = [128, 112, 100, 92, 86, 80, 74, 72][di];
    const hr = Math.max(60, hrBase + rint(-8, 8) - (ti > 2 ? 2 : 0));
    const sys = rint(108, 130);
    const o2 = di < 2 ? "4 L" : di < 4 ? "3 L" : "2 L";
    return [String(hr), `${sys}/${rint(64, 80)}`, String(rint(16, 22) - (di > 3 ? 3 : 0)), `${rint(92, 95)}%`, o2, di < 4 && hr > 105 ? "AF, rapid" : "AF"];
  });
  w.table(["Day", "Time", "HR", "BP", "RR", "SpO2", "O2", "Rhythm"], rows, [60, 50, 40, 70, 40, 50, 50, 90], 8.5);
}

function weightsIO(w: Writer) {
  w.section("Daily Weights and Strict Intake and Output", "Standing scale each morning after voiding; hourly output chart totals");
  w.table(
    ["Date", "Weight (kg)", "Change", "Intake (mL)", "Output (mL)", "Net (mL)", "Diuretic"],
    DAYS.map((d, i) => {
      const intake = rint(1050, 1450);
      const out = i === 0 ? 3100 : rint(2300, 3000) - i * 120;
      return [d + " 2026", WT[i], i === 0 ? "-" : (Number(WT[i]) - Number(WT[i - 1])).toFixed(1), String(intake), String(out), String(intake - out), i < 4 ? "Furosemide IV" : "Torsemide PO"];
    }),
    [70, 70, 55, 70, 70, 65, 90],
    9,
  );
  w.p("Discharge weight 95.0 kg on 18 Nov 2026 (standing scale 07:40). Estimated dry weight 94 kg. Total net negative about 11.9 L over the admission by the intake and output record. Strict intake and output and daily standing weights are ordered to continue at the receiving facility; the nurse is to call the physician for a gain of more than 1 kg in a day or 2 kg in a week.");
  w.h("Hourly output record, 17 Nov 2026");
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
  w.table(
    ["Hour", "Output (mL)", "Hour", "Output (mL)"],
    Array.from({ length: 12 }, (_, i) => [hours[i], String(rint(60, 170)), hours[i + 12], String(rint(60, 170))]),
    [60, 90, 60, 90],
    9,
  );
}

function telemetry(w: Writer) {
  w.section("Telemetry Review and Rhythm Log", "Cardiac monitor technician summaries - 10 to 18 Nov 2026");
  w.p("Continuous cardiac telemetry was maintained from admission to discharge. Daily summaries below. The cardiology recommendation is that continuous cardiac telemetry continue for seven days after discharge.");
  w.table(
    ["Date", "Rhythm", "Rate range", "Events"],
    [
      ["10 Nov", "AF with rapid ventricular response", "112 to 146", "Sustained rapid rate during the first 12 hours; amiodarone load started"],
      ["11 Nov", "AF, rapid", "104 to 134", "No pauses"],
      ["12 Nov", "AF", "92 to 122", "Transient rate 126 at 02:10 while supine, self-resolved"],
      ["13 Nov", "AF", "84 to 110", "No pauses"],
      ["14 Nov", "AF", "76 to 100", "Isolated PVCs, 4 per hour"],
      ["15 Nov", "AF", "70 to 98", "Rate 104 with exertion during therapy"],
      ["16 Nov", "AF, controlled", "62 to 88", "No pauses, rate-control titration complete"],
      ["17 Nov", "AF, controlled", "60 to 84", "No pauses greater than 2.0 seconds; no ventricular tachycardia"],
    ],
    [50, 150, 70, 210],
    9,
  );
  w.h("Alarm parameters carried to the receiving facility");
  w.p("Heart rate above 120 or below 50 sustained for one minute, any pause longer than 3 seconds, or any run of ventricular tachycardia: notify the physician at once. Continuous cardiac telemetry duration: seven days from arrival, then reassessment by the facility physician with cardiology.");
  w.h("Rhythm strips, selected");
  w.table(
    ["Date / time", "Strip description", "Interpretation"],
    [
      ["10 Nov 10:12", "6-second strip, lead II", "AF, ventricular rate 142"],
      ["12 Nov 02:10", "6-second strip, lead II", "AF, rate 126, resolved without treatment"],
      ["14 Nov 21:44", "6-second strip, lead II", "AF, rate 82, isolated PVC"],
      ["16 Nov 19:40", "6-second strip, lead II", "AF, rate 68, regular response"],
      ["17 Nov 23:55", "6-second strip, lead II", "AF, rate 64, no pause"],
    ],
    [90, 190, 200],
    9,
  );
}

function respiratory(w: Writer) {
  w.section("Respiratory Therapy Note", "Respiratory therapy - 12 Nov 2026 and 17 Nov 2026");
  w.h("Oxygen");
  w.p("Prescribed oxygen 2 L per minute by nasal cannula, titrate to SpO2 of 92% or higher. Resting SpO2 94% on 2 L. On room air at rest SpO2 89%. Qualifying oxygen saturation documented. Portable concentrator will travel with the patient.");
  w.h("CPAP (patient-owned device)");
  w.kv([
    ["Device", "Patient's own ResMed-type auto-CPAP, brought from home and inspected by respiratory therapy"],
    ["Mode / pressure", "Fixed CPAP 10 cm H2O with ramp 20 minutes starting at 5 cm H2O"],
    ["Interface", "Nasal pillows, size medium; heated humidifier on setting 3"],
    ["Oxygen bleed-in", "2 L per minute into the circuit during sleep"],
    ["Use", "Nightly and with naps; patient applies it independently"],
    ["Settings documented", "Yes; settings card copied into the discharge summary and the order set"],
  ], 120);
  w.p("Patient-owned device and settings are documented. Wife will bring the power cable and the spare mask to the facility on the day of transfer. Biomedical safety check of the device was completed 12 Nov 2026.");
  signed(w, "Respiratory Therapy, Riverside General", "17 Nov 2026 14:20");
}

function mar(w: Writer) {
  w.section("Medication Administration Detail Log", "Inpatient administrations - generated from the electronic MAR");
  const meds = [
    ["Torsemide 40 mg PO", "08:30"],
    ["Empagliflozin 10 mg PO", "08:30"],
    ["Spironolactone 25 mg PO", "08:30"],
    ["Carvedilol 12.5 mg PO", "08:30"],
    ["Amiodarone 200 mg PO", "08:30"],
    ["Aspirin 81 mg PO", "08:30"],
    ["Carvedilol 12.5 mg PO", "17:00"],
    ["Atorvastatin 40 mg PO", "21:00"],
    ["Senna 8.6 mg PO", "21:00"],
  ];
  const rows: string[][] = [];
  for (let di = 3; di < 8; di++) {
    for (const [m, t] of meds) {
      if (di < 4 && m.startsWith("Torsemide")) continue;
      rows.push([`${DAYS[di]} ${t}`, m, "Given", ["JA", "KM", "TR", "LP"][rint(0, 3)]]);
    }
  }
  w.table(["Date / time", "Medication", "Status", "Initials"], rows, [90, 240, 70, 60], 8.5);
  w.p("18 Nov 2026 doses given before discharge: torsemide, empagliflozin, spironolactone, carvedilol, amiodarone and aspirin at 08:30.", { size: 9 });
}

function dischargeMeds(w: Writer) {
  w.section("Discharge Medication List", "Medication reconciliation for transfer to skilled nursing facility - 18 Nov 2026");
  w.kv([
    ["Patient weight", "95.0 kg"],
    ["Allergies", "Sulfa antibiotics (rash)"],
    ["Orders", "Signed physician order set attached; all medications below are on the signed set"],
  ], 110);
  w.table(
    ["Medication", "Dose / route", "Frequency", "Indication", "Last given", "Next due"],
    [
      ["Torsemide 40 mg", "40 mg PO", "Daily", "Heart failure, volume", "18 Nov 08:30", "19 Nov 08:00"],
      ["Empagliflozin (Jardiance) 10 mg", "10 mg PO", "Daily", "Heart failure with reduced EF", "18 Nov 08:30", "19 Nov 08:00"],
      ["Spironolactone 25 mg", "25 mg PO", "Daily", "Heart failure", "18 Nov 08:30", "19 Nov 08:00"],
      ["Carvedilol 12.5 mg", "12.5 mg PO", "BID", "Heart failure, rate control", "18 Nov 08:30", "18 Nov 17:00"],
      ["Amiodarone 200 mg", "200 mg PO", "Daily", "Atrial fibrillation", "18 Nov 08:30", "19 Nov 08:00"],
      ["Aspirin 81 mg", "81 mg PO", "Daily", "Cardiovascular prevention", "18 Nov 08:30", "19 Nov 08:00"],
      ["Atorvastatin 40 mg", "40 mg PO", "Nightly", "Hyperlipidemia", "17 Nov 21:00", "18 Nov 21:00"],
      ["Senna 8.6 mg", "8.6 mg PO", "Nightly", "Constipation prevention", "17 Nov 21:00", "18 Nov 21:00"],
    ],
    [130, 70, 60, 110, 75, 75],
    8,
  );
  w.h("Notes on specific medications");
  w.bullets([
    "Torsemide replaced furosemide on 14 Nov. Do not give both.",
    "Empagliflozin and spironolactone are new this admission. Spironolactone requires the potassium and creatinine standing laboratory orders in the signed order set; hold for potassium above 5.3 mmol/L.",
    "Carvedilol: hold for heart rate below 55 or systolic blood pressure below 95.",
    "Amiodarone: baseline thyroid and liver studies normal; repeat in three months.",
    "All discharge medications are oral. No intravenous therapy and no central or peripheral line at discharge.",
    "Daily weights every morning; discharge weight 95.0 kg.",
  ]);
  w.h("Discontinued / not continued");
  w.p("Intravenous furosemide discontinued 14 Nov 2026. Furosemide oral and lisinopril stopped at admission and not to be resumed.");
}

function orderSet(w: Writer) {
  w.section("Physician Order Set - Transfer to Skilled Nursing Facility", "Signed by Priya Raman, MD - 17 Nov 2026 15:40");
  w.p("SIGNED PHYSICIAN ORDER SET. This order set is signed and is included in this transmission. It covers every medication on the discharge medication list and the monitoring orders below.", { bold: true, keep: true });
  w.h("Monitoring orders");
  w.bullets([
    "CONTINUOUS CARDIAC TELEMETRY: continuous telemetry monitoring is ordered for 7 days from arrival after the rate-control titration of amiodarone and carvedilol. Alarm limits heart rate above 120 or below 50, pause longer than 3 seconds. Notify the physician of any alarm that persists. Reassess after seven days with cardiology.",
    "Daily standing weight every morning after voiding, before breakfast, same scale. Notify the physician for a gain above 1 kg in 24 hours or 2 kg in a week.",
    "Strict intake and output every shift with 24-hour totals. Fluid restriction 1.5 L per day. 2 g sodium cardiac diet.",
    "Vital signs every shift. Spot oxygen saturation every shift and with exertion; oxygen 2 L per minute by nasal cannula, titrate to SpO2 of 92% or higher.",
    "CPAP nightly and with naps, patient-owned device: CPAP 10 cm H2O, ramp 20 minutes, nasal pillows size medium, humidifier setting 3, oxygen bleed-in 2 L per minute.",
  ]);
  w.h("Standing laboratory orders");
  w.table(
    ["Test", "Frequency", "Start", "Report to"],
    [
      ["Basic metabolic panel (potassium and creatinine)", "Twice weekly for 2 weeks (Monday and Thursday), then weekly", "21 Nov 2026", "Facility attending physician"],
      ["Magnesium", "With each basic metabolic panel for 2 weeks", "21 Nov 2026", "Facility attending physician"],
    ],
    [190, 150, 60, 80],
    9,
  );
  w.p("Hold spironolactone and call the physician for potassium above 5.3 mmol/L or creatinine above 1.6 mg/dL. These are standing orders and do not depend on any narrative in the discharge summary.");
  w.h("Medication orders");
  w.table(
    ["Medication", "Order"],
    [
      ["Torsemide", "40 mg PO daily"],
      ["Empagliflozin (Jardiance)", "10 mg PO daily"],
      ["Spironolactone", "25 mg PO daily; see standing laboratory orders and hold parameters"],
      ["Carvedilol", "12.5 mg PO twice daily with food; hold for HR below 55 or SBP below 95"],
      ["Amiodarone", "200 mg PO daily"],
      ["Aspirin", "81 mg PO daily"],
      ["Atorvastatin", "40 mg PO nightly"],
      ["Senna", "8.6 mg PO nightly"],
    ],
    [160, 320],
    9,
  );
  w.h("Other orders");
  w.bullets([
    "Code status: Full Code. Signed advance directive on file.",
    "Activity as tolerated with rolling walker and standby assistance; physical and occupational therapy to evaluate and treat.",
    "Fall precautions. Skin checks every shift.",
    "No isolation precautions required.",
  ]);
  signed(w, "Priya Raman, MD - Hospital Medicine", "17 Nov 2026 15:40");
}

function dischargeSummary(w: Writer) {
  w.section("Discharge Summary", "Hospital Medicine - Priya Raman, MD - signed 17 Nov 2026 16:10");
  w.kv([
    ["Admission / discharge", "10 Nov 2026 to 18 Nov 2026, 11:30"],
    ["Principal diagnosis", "Acute on chronic heart failure with reduced ejection fraction (EF 25%)"],
    ["Secondary diagnoses", "Atrial fibrillation with rapid ventricular response, CKD stage 2, obstructive sleep apnea, chronic hypoxemia, hypertension, hyperlipidemia"],
    ["Disposition", "Skilled nursing facility, skilled medical unit"],
    ["Condition", "Stable"],
  ]);
  w.h("Hospital course");
  w.p("Admitted with decompensated heart failure and atrial fibrillation with rapid ventricular response. Treated with diuresis (about 11.9 L net negative), an amiodarone load and carvedilol up-titration. Empagliflozin and spironolactone were started for heart failure with reduced ejection fraction. Rate controlled by 16 Nov.");
  w.h("Monitoring needs at the receiving facility");
  w.p("Continuous cardiac telemetry is required for the first seven days after discharge because the rate-control regimen was only recently titrated. This is a firm requirement and is also written in the signed physician order set. In addition: daily standing weights, strict intake and output, potassium and creatinine twice weekly for two weeks then weekly (standing orders), oxygen 2 L by nasal cannula, and nightly CPAP with the patient's own device.", { keep: true });
  w.h("Pending results at discharge");
  w.p("Repeat potassium drawn 18 Nov 2026 at 10:20 is pending at the time of transfer. Result expected this afternoon.");
  w.h("Follow-up");
  w.bullets([
    `Cardiology: ${CARDS}, Riverside Heart Clinic, 2nd floor, 25 Nov 2026 at 09:40. Transport arranged: wheelchair van booked through the facility transport coordinator.`,
    `Primary care: ${PCP}, Eastgate Family Medicine, within 14 days of leaving the facility.`,
  ]);
  w.h("Functional status and equipment");
  w.p("Ambulates 150 feet with rolling walker and standby assistance. Equipment: oxygen concentrator and portable tank, patient-owned CPAP, rolling walker.");
  w.h("Code status and responsible party");
  w.p(`Full Code; signed advance directive. Responsible party and healthcare agent: ${WIFE}, wife, ${WIFE_PHONE}.`);
  w.h("Infection control and screening");
  w.p("No isolation precautions required. MRSA screen negative. Pre-admission screening Level I complete; Level II not triggered. Tuberculosis screening negative 11 Nov 2026.");
  signed(w, "Priya Raman, MD - Hospital Medicine", "17 Nov 2026 16:10");
}

function pharmacy(w: Writer) {
  w.section("Clinical Pharmacy Notes", "Inpatient pharmacy - Kavita Shah, PharmD");
  w.h("Medication reconciliation 18 Nov 2026");
  w.p("Reconciled the pre-admission list with the discharge list. Changes: furosemide replaced by torsemide; lisinopril stopped; carvedilol dose increased to 12.5 mg twice daily; amiodarone, empagliflozin and spironolactone started. Drug interactions reviewed: amiodarone with carvedilol (additive bradycardia, addressed by telemetry and hold parameters); spironolactone with potassium (monitoring order in place); atorvastatin 40 mg with amiodarone acceptable.");
  w.h("Coverage notes for the receiving facility");
  w.bullets([
    "Empagliflozin is a brand medication that commonly requires payor prior authorization or a facility exception. Please confirm status with the facility pharmacy on arrival; the first dose is due the morning of 19 Nov.",
    "Torsemide may not be on every facility's formulary; furosemide is not an equivalent dose substitution and should not be assumed without a prescriber order.",
    "No controlled substances on the discharge list.",
  ]);
  w.h("Laboratory monitoring");
  w.p("Spironolactone: potassium and creatinine standing orders are written in the signed order set. Amiodarone: thyroid and liver studies normal at baseline, repeat in three months.");
  signed(w, "Kavita Shah, PharmD", "18 Nov 2026 09:10");
}

function ptot(w: Writer) {
  w.section("Physical and Occupational Therapy Evaluation", "Daniel Cho, PT, DPT and Rhea Dalton, OTR/L - 15 Nov 2026");
  w.h("Prior level of function");
  w.p("Prior level of function: independent in all activities of daily living and household mobility until six weeks before admission, when exertional dyspnea began limiting stair use. Drove, retired, active with grandchildren. Lives in a two-story home with the bedroom upstairs, 14 steps with one rail.");
  w.h("Evaluation findings");
  w.kv([
    ["Bed mobility", "Independent"],
    ["Transfers", "Standby assistance with rolling walker"],
    ["Gait", "150 feet with rolling walker and standby assistance; SpO2 91% with exertion on 2 L"],
    ["Balance", "Fair; Berg balance score 41 of 56"],
    ["Strength", "Lower extremities 4/5, symmetric; right hip osteoarthritis limits end-range"],
    ["Cognition", "Intact"],
    ["Upper body dressing / lower body dressing", "Independent / minimal assistance"],
  ], 180);
  w.h("Recommendations");
  w.p("Physical therapy five times a week focused on endurance, gait and stair training; occupational therapy three times a week for energy conservation and lower-body dressing. Patient tolerates standing and gait training as tolerated with a rolling walker; no restrictions were placed on the right hip by the surgeon or the physician team. Speech-language pathology not indicated, swallow screen passed on 10 Nov 2026.");
  w.h("Short-term goals");
  w.bullets([
    "Ambulate 300 feet with rolling walker, modified independent, SpO2 at least 90%.",
    "Climb 14 steps with rail and standby assistance.",
    "Independent with energy conservation and pacing.",
  ]);
  signed(w, "Daniel Cho, PT, DPT; Rhea Dalton, OTR/L", "15 Nov 2026 15:50");
}

function therapyDaily(w: Writer) {
  w.section("Therapy Treatment Notes", "Physical and occupational therapy - daily treatment documentation");
  const rows: string[][] = [
    ["15 Nov", "PT", "Gait training 100 feet with rolling walker, standby assistance. SpO2 91% on 2 L, recovered in two minutes."],
    ["15 Nov", "OT", "Energy conservation education; wife present. Seated lower-body dressing with minimal assistance."],
    ["16 Nov", "PT", "Gait 120 feet; seated balance and sit-to-stand x10. Rate 92 on telemetry, no symptoms."],
    ["16 Nov", "OT", "Dressing practice with reacher. Independent with upper-body dressing."],
    ["17 Nov", "PT", "Gait 150 feet with rolling walker, standby assistance. Practiced four steps with rail."],
    ["17 Nov", "OT", "Home setup discussion; shower chair recommended for later. Patient verbalized pacing strategies."],
  ];
  w.table(["Date", "Discipline", "Note"], rows, [50, 70, 360], 9);
  w.p("Patient tolerates therapy well. Heart rate stayed below 105 throughout treatment sessions with the telemetry monitor in place.");
}

function dietitian(w: Writer) {
  w.section("Dietitian / Nutrition Note", "Maya Ortiz, RD, LDN - 12 Nov 2026 13:15");
  w.kv([
    ["Diet order", "2 g sodium cardiac diet, regular texture, thin liquids, 1.5 L fluid restriction"],
    ["Swallow", "Bedside swallow screen passed 10 Nov 2026; no dysphagia; no speech-language evaluation needed"],
    ["Height / weight / BMI", "178 cm / 95.0 kg / 30.0"],
    ["Intake", "75 to 100 percent of meals; appetite good"],
    ["Labs", "Albumin 3.7 g/dL"],
  ], 140);
  w.p("No nutrition risk beyond sodium and fluid adherence. Education provided to patient and wife on reading labels, restaurant choices and a one-day sample menu. No supplements ordered. The diet order is consistent with the swallow screen result.");
}

function labs(w: Writer) {
  w.section("Laboratory Results", "Core laboratory - 10 Nov 2026 to 18 Nov 2026");
  w.table(
    ["Date", "Na", "K", "BUN", "Creat", "Mg", "BNP", "Hgb"],
    [
      ["10 Nov", "136", "4.0", "26", "1.3", "1.9", "2,460", "13.4"],
      ["11 Nov", "137", "4.1", "28", "1.2", "1.9", "", ""],
      ["12 Nov", "138", "3.9", "27", "1.2", "1.8", "", ""],
      ["13 Nov", "138", "3.8", "27", "1.2", "1.9", "", "13.1"],
      ["14 Nov", "139", "4.0", "25", "1.2", "2.0", "1,420", ""],
      ["15 Nov", "139", "4.3", "24", "1.2", "2.0", "", ""],
      ["16 Nov", "139", "4.5", "24", "1.2", "2.0", "", "13.0"],
      ["17 Nov", "140", "4.4", "23", "1.1", "2.0", "820", ""],
    ],
    [60, 45, 45, 50, 50, 45, 60, 50],
    9,
  );
  w.p("Units: sodium, potassium and magnesium in mmol/L or mg/dL as usual; BUN and creatinine mg/dL; BNP pg/mL; hemoglobin g/dL. All values verified electronically.", { size: 8.5 });
  w.h("Other results");
  w.bullets([
    "Thyroid stimulating hormone 2.1 mIU/L and liver enzymes normal at amiodarone baseline.",
    "Hemoglobin A1c 5.6%.",
    "Lipid panel: LDL 82 mg/dL on atorvastatin.",
    "High-sensitivity troponin 31 and 33 ng/L on 10 Nov, flat.",
    "MRSA nares PCR 10 Nov: negative.",
    "Repeat potassium, collected 18 Nov 2026 10:20: pending at time of transfer.",
  ]);
  w.h("Daily laboratory narrative");
  w.p("Creatinine stable at 1.1 to 1.3 throughout. Potassium 3.8 to 4.5 after starting spironolactone. The standing laboratory orders for potassium and creatinine are in the signed order set.");
}

function diagnostics(w: Writer) {
  w.section("Diagnostic Reports", "Echocardiogram, electrocardiogram, chest radiograph");
  w.h("Transthoracic echocardiogram - 10 Nov 2026 14:15");
  w.p("Indication: acute heart failure. Dilated left ventricle with global hypokinesis and a thin, scarred inferior wall. Estimated ejection fraction 25% by biplane method. Left atrium severely dilated. Moderate functional mitral regurgitation. Mild tricuspid regurgitation, estimated right ventricular systolic pressure 48 mmHg. Inferior vena cava dilated with reduced collapse. No pericardial effusion.");
  w.p("Impression: Severely reduced left ventricular systolic function, EF 25%, slightly worse than the prior study (28%, 2025).");
  w.h("Electrocardiogram - 10 Nov 2026 09:55");
  w.p("Atrial fibrillation, ventricular rate 142. Old inferior Q waves. QRS duration 110 ms, QTc 458 ms. Follow-up tracing 16 Nov 2026: atrial fibrillation, ventricular rate 68, QTc 466 ms on amiodarone.");
  w.h("Chest radiograph, portable AP - 10 Nov 2026 10:30");
  w.p("Cardiomegaly. Pulmonary vascular congestion with interstitial edema. Small bilateral pleural effusions. No consolidation.");
  w.p("Follow-up chest radiograph - 16 Nov 2026 07:50: markedly improved aeration, small residual right effusion.");
}

function socialWork(w: Writer) {
  w.section("Social Work Assessment", "Tomas Reyes, LCSW - 11 Nov 2026 14:00");
  w.p("Psychosocial assessment and discharge planning support for a 68-year-old married retired electrician being discharged to a skilled nursing facility.");
  w.h("Social situation");
  w.p(`Lives with his wife, ${WIFE}, who is his healthcare agent and the responsible party for admission paperwork. Two adult children live within an hour and visit weekly. Supportive family. The patient makes his own decisions and has decision-making capacity; capacity was documented by the attending on 11 Nov 2026. Wife reachable by telephone at ${WIFE_PHONE}.`);
  w.h("Functional and emotional status");
  w.p("Mood euthymic. PHQ-2 score 0. No history of psychiatric treatment. No substance use disorder. No safety concerns, no behavioral concerns, no history of wandering or confusion. He expresses willingness to go to a skilled nursing facility and intends to return home with his wife afterward.");
  w.h("Plan");
  w.bullets([
    "Wife to sign admission paperwork at the facility on 18 Nov.",
    "Home assessment after the stay: stairs and bedroom upstairs; consider first-floor setup.",
    "Long-Term Care Ombudsman information provided.",
  ]);
  signed(w, "Tomas Reyes, LCSW", "11 Nov 2026 14:40");
}

function pasrr(w: Writer) {
  w.section("Pre-Admission Screening (PASRR)", "Preadmission Screening and Resident Review - Level I - 15 Nov 2026");
  w.kv([
    ["Screening level", "Level I"],
    ["Completed by", "Tomas Reyes, LCSW, 15 Nov 2026 10:15"],
    ["Result", "Level I screen complete and negative for serious mental illness, intellectual disability or related condition"],
    ["Level II", "Level II not triggered"],
    ["Notification", "Level I determination form attached to this transmission and signed by the screener and the attending"],
  ], 120);
  w.p("Section summary: no diagnosis of serious mental illness, no intellectual disability, no developmental disability. No psychotropic medications. The screen was submitted to the state PASRR contractor and the determination was returned the same day.");
  signed(w, "Tomas Reyes, LCSW", "15 Nov 2026 10:30");
}

function infection(w: Writer) {
  w.section("Infection Control Screening", "Infection prevention - 17 Nov 2026");
  w.table(
    ["Screen", "Result", "Date"],
    [
      ["MRSA nares PCR", "Negative", "10 Nov 2026"],
      ["VRE / CRE screen", "Not indicated; no risk factors", "-"],
      ["C. difficile", "No diarrhea; testing not indicated", "-"],
      ["Respiratory pathogen panel", "Not indicated; afebrile with no cough", "-"],
      ["Tuberculosis screen (symptom review and interferon-gamma assay)", "Negative", "11 Nov 2026"],
      ["History of multidrug-resistant organism", "None", "-"],
    ],
    [200, 190, 90],
    9,
  );
  w.p("MDRO and isolation status documented: negative. No isolation precautions required. Standard precautions only. The patient has not been in a private room for isolation at any point in this admission.");
  signed(w, "Infection Prevention, Riverside General", "17 Nov 2026 12:00");
}

function codeStatus(w: Writer) {
  w.section("Code Status and Advance Directive", "Documentation of patient wishes - 11 Nov 2026");
  w.kv([
    ["Code status", "FULL CODE (attempt resuscitation)"],
    ["Directive", "Advance directive signed 03 Mar 2024, copy attached and re-reviewed with the patient on 11 Nov 2026"],
    ["Healthcare agent", `${WIFE}, wife, ${WIFE_PHONE}`],
    ["Capacity", "Patient has decision-making capacity; documented by Dr. Raman 11 Nov 2026"],
    ["Signed by", "Patient and attending physician; witnessed by two staff"],
  ], 120);
  w.p("Code status was discussed with the patient and his wife. He wishes full treatment including resuscitation. The advance directive is signed and a copy accompanies this packet. No limitation of treatment orders exist.");
  signed(w, "Priya Raman, MD", "11 Nov 2026 16:00");
}

function immunizations(w: Writer) {
  w.section("Immunization Record", "State immunization registry query and patient report - 13 Nov 2026");
  w.table(
    ["Vaccine", "Date given", "Source", "Comment"],
    [
      ["Influenza, high-dose, 2026-2027", "10/02/2026", "Registry", "Seasonal"],
      ["COVID-19 mRNA, 2025-2026 formula", "10/20/2025", "Registry", ""],
      ["Pneumococcal conjugate PCV20", "08/14/2023", "Registry", "Single dose complete"],
      ["Tetanus, diphtheria, pertussis (Tdap)", "03/11/2020", "Registry", "Td booster due 2030"],
      ["Zoster recombinant (Shingrix) dose 1", "05/02/2023", "Registry", ""],
      ["Zoster recombinant (Shingrix) dose 2", "08/09/2023", "Registry", "Series complete"],
      ["RSV vaccine", "09/30/2025", "Registry", "Single dose"],
    ],
    [190, 80, 70, 140],
    9,
  );
  w.p("Immunization history reconciled with the state registry. Tuberculosis screening negative 11 Nov 2026. No vaccines were administered during this hospitalization.");
}

function followup(w: Writer) {
  w.section("Follow-up Appointments and Transport", "Case management - 17 Nov 2026");
  w.table(
    ["Appointment", "Date / time", "Location", "Transport"],
    [
      [`Cardiology, ${CARDS}`, "25 Nov 2026, 09:40", "Riverside Heart Clinic, 2nd floor, 300 Mercer Avenue", "Wheelchair van booked through the facility transport coordinator; patient to bring oxygen"],
      [`Primary care, ${PCP}`, "Within 14 days of leaving the facility", "Eastgate Family Medicine", "Wife to drive"],
    ],
    [110, 90, 150, 130],
    9,
  );
  w.p(`Primary care physician of record: ${PCP}, Eastgate Family Medicine. The cardiology visit falls inside the authorized stay and the first day of the concurrent review.`);
}

function dcPlanning(w: Writer) {
  w.section("Discharge Planning Checklist", "Case management - 18 Nov 2026");
  w.table(
    ["Item", "Status", "Comment"],
    [
      ["Discharge order written", "[X] Complete", "Discharge date 18 Nov 2026, time 11:30"],
      ["Medical stability confirmed by attending", "[X] Complete", "Dr. Raman, 17 Nov 2026"],
      ["Receiving facility bed accepted", "[X] Complete", "Skilled medical unit, arrival 18 Nov afternoon"],
      ["Transport arranged", "[X] Complete", "Wheelchair van with portable oxygen, pickup 4 West entrance 11:30"],
      ["Estimated arrival at facility", "[X] Complete", "Estimated arrival 14:30 on 18 Nov 2026"],
      ["Nurse-to-nurse report", "[X] Complete", "Called 11:00"],
      ["Medication reconciliation", "[X] Complete", "Pharmacist, 18 Nov 09:10"],
      ["Physician order set signed", "[X] Complete", "Signed 17 Nov 15:40; included in this packet"],
      ["Discharge summary", "[X] Complete", "Signed 17 Nov 16:10; included in this packet"],
      ["Prior authorization", "[X] Complete", "Active, 8 days approved"],
      ["Pre-admission screening (PASRR)", "[X] Complete", "Level I complete; Level II not triggered"],
      ["Isolation / MDRO status", "[X] Complete", "No isolation precautions required"],
      ["Family or responsible party notified", "[X] Complete", `${WIFE}, wife, at bedside`],
      ["Equipment needs", "[X] Complete", "Oxygen concentrator, patient-owned CPAP, rolling walker"],
      ["Patient and family education", "[X] Complete", "Heart failure self-care, daily weights, sodium and fluid limits, CPAP"],
    ],
    [190, 90, 200],
  );
  w.h("Discharge plan for the receiving facility");
  w.bullets([
    "Continuous cardiac telemetry is required for seven days from arrival. This is the pivotal clinical requirement of this transfer; the receiving unit should confirm it can provide it before the patient travels.",
    "Daily standing weights and strict intake and output.",
    "Oxygen 2 L by nasal cannula; patient-owned CPAP nightly.",
    "Potassium and creatinine standing orders twice weekly for two weeks, then weekly.",
    "Cardiology clinic visit on 25 Nov 2026 at 09:40.",
  ]);
  w.h("Transfer summary");
  w.kv([
    ["Discharge date / time", "18 Nov 2026, 11:30"],
    ["Mode of transport", "Wheelchair van with one attendant and portable oxygen"],
    ["Estimated arrival", "14:30, 18 Nov 2026"],
    ["Condition at discharge", "Stable. Vitals 18 Nov 10:30: BP 112/68, HR 72, RR 16, SpO2 94% on 2 L, T 36.7 C"],
    ["Weight", "95.0 kg"],
    ["Diet", "2 g sodium cardiac, thin liquids, 1.5 L fluid restriction"],
    ["Activity", "As tolerated with rolling walker and standby assistance"],
  ], 140);
}

function hfEducation(w: Writer) {
  w.section("Heart Failure Patient Education Record", "Material reviewed with the patient and wife on 16-18 Nov 2026");
  w.table(
    ["Topic", "Method", "Date", "Understanding shown"],
    [
      ["Daily weights and when to call", "Teach-back", "16 Nov", "Yes"],
      ["2 g sodium diet and label reading", "Dietitian session", "12 Nov", "Yes"],
      ["Fluid restriction 1.5 L", "Teach-back", "16 Nov", "Yes"],
      ["Medication changes, new medications", "Pharmacist and nurse", "17 Nov", "Yes"],
      ["Empagliflozin: hygiene and hydration", "Nurse", "14 Nov", "Yes"],
      ["CPAP use and oxygen safety", "Respiratory therapy", "17 Nov", "Yes"],
      ["Symptoms of worsening heart failure and arrhythmia", "Teach-back", "17 Nov", "Yes"],
    ],
    [190, 120, 60, 110],
    9,
  );
  w.p("Written materials provided in English. Patient and wife both participated. Wife keeps a weight log at home and will continue it after the stay.");
}

// ---------------------------------------------------------------- spec

const FORBIDDEN: [string, RegExp][] = [
  ["insulin", /insulin/i],
  ["apixaban / DOAC brand", /apixaban|eliquis|rivaroxaban|xarelto/i],
  ["sliding scale / correction scale", /sliding scale|correction scale/i],
  ["trach", /\btrach/i],
  ["vent (ventilator / ventilation)", /\bvent\b|ventilator|ventilat/i],
  ["PASRR absent-markers", /PASRR[^.]{0,60}(not documented|not (been )?(completed|received|done)|never|pending|unknown|absent|missing|to follow)/i],
  ["unsigned / pending orders", /pending physician signature|orders: pending|authorization pending|to follow\b/i],
  ["dialysis / wound vac / TPN", /dialysis|wound vac|\bTPN\b|parenteral/i],
];

const REQUIRED: [string, RegExp][] = [
  ["continuous telemetry", /continuous (cardiac )?telemetry/i],
  ["EF 25", /EF 25%?/],
  ["8 days approved", /8 days approved/i],
  ["Level II not triggered", /Level II not triggered/i],
  ["no isolation precautions required", /no isolation precautions required/i],
  ["wife's name", new RegExp(WIFE)],
  ["authorization active", /Authorization is ACTIVE/],
  ["payor name", /Northbridge Health Plan/],
  ["95.0 kg", /95\.0 kg/],
  ["torsemide", /torsemide 40 mg/i],
  ["empagliflozin (Jardiance)", /empagliflozin \(Jardiance\) 10 mg/i],
  ["spironolactone 25", /spironolactone 25 mg/i],
  ["K+/Cr standing laboratory order", /standing laboratory orders/i],
  ["signed order set", /SIGNED PHYSICIAN ORDER SET/],
  ["discharge summary", /Discharge Summary/],
  ["Full Code", /Full Code/i],
  ["CPAP settings", /CPAP 10 cm H2O/],
  ["oxygen 2 L", /oxygen 2 L/i],
  ["daily weights", /daily standing weight/i],
  ["strict intake and output", /strict intake and output/i],
  ["pending potassium", /potassium[^.]{0,40}pending/i],
  ["cardiology follow-up date", /25 Nov 2026 at 09:40/],
  ["arrival 14:30", /14:30 on 18 Nov 2026/],
  ["discharge 11:30", /11:30/],
  ["PCP named", /Naomi Whitfield/],
  ["tuberculosis screen", /Tuberculosis screen/i],
];

export const haroldPacket: PacketSpec = {
  out: OUT,
  hospital: HOSPITAL,
  patientLine: PATIENT_LINE,
  headerTokens: ["MRN RG-901377", "DOB 06/02/1958"],
  pages: [35, 50],
  build(w) {
    faceSheet(w);
    insurance(w);
    caseMgmt(w);
    edNote(w);
    hAndP(w);
    cardiology(w);
    progressNotes(w);
    hospitalCourse(w);
    nursing(w);
    flowsheet(w);
    weightsIO(w);
    telemetry(w);
    respiratory(w);
    mar(w);
    dischargeMeds(w);
    orderSet(w);
    dischargeSummary(w);
    pharmacy(w);
    ptot(w);
    therapyDaily(w);
    dietitian(w);
    labs(w);
    diagnostics(w);
    socialWork(w);
    pasrr(w);
    infection(w);
    codeStatus(w);
    immunizations(w);
    followup(w);
    dcPlanning(w);
    hfEducation(w);
    coverPage(w, 0, {
      hospitalLine: HOSPITAL,
      facts: [
        ["From", `${HOSPITAL}, Case Management, Medical-Surgical Unit 4 West`],
        ["To", "Receiving skilled nursing facility, Admissions"],
        ["Patient", "Harold Jennings, 68-year-old male, DOB 06/02/1958, MRN RG-901377"],
        ["Admitted", "10 Nov 2026 (inpatient), acute decompensated heart failure with atrial fibrillation"],
        ["Discharged", "18 Nov 2026 at 11:30 to skilled nursing facility"],
        ["Transport", "Wheelchair van with portable oxygen arranged; estimated arrival 14:30 on 18 Nov 2026"],
        ["Key requirement", "Continuous cardiac telemetry for 7 days from arrival (see physician orders and discharge plan)"],
      ],
      intro: "This packet was compiled by hospital case management for transmission to the receiving facility. Documents are printed from the electronic record as of the discharge date and are listed below with their starting page.",
      completeNote: "All required transfer documents are included: signed physician order set, discharge summary, active authorization, pre-admission screening, infection control screening, code status with signed directive, immunization and tuberculosis record, and follow-up appointments. Contact case management at the hospital main number with questions. This is a synthetic test record; no real patient data.",
      footer: "Synthetic test record. All names, identifiers and payors are invented.",
    });
  },
  forbidden: FORBIDDEN,
  required: REQUIRED,
  extraChecks(all, ok) {
    ok("no 'bed hold' content (deliberate gap)", !/bed.hold/i.test(all));
  },
};
