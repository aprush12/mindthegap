/**
 * Generates samples/synthetic-elena-packet.pdf: a synthetic hospital-to-SNF referral packet (Elena Mercado,
 * docs/facility-acceptance-spec.md "Reference case") styled as an EHR print-out. All people, payors and
 * identifiers are invented. Deliberate absences (PASRR, MDRO/isolation status, signed orders, discharge summary,
 * the insulin scale, code status document) are load-bearing: the self-check at the bottom enforces them.
 *
 * Run: npm run make-sample
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { extractPages } from "../src/pipeline/extract-text.js";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../samples/synthetic-elena-packet.pdf");

const HOSPITAL = "Riverside General Medical Center";
const PATIENT_LINE = "Patient: Elena Mercado    DOB 03/14/1949    MRN RG-884512    (synthetic test record)";

// ---------------------------------------------------------------- layout engine

const PW = 612, PH = 792, MX = 54, TOP = 716, BOTTOM = 62;
const CW = PW - 2 * MX;
const BODY = 11.2, LEAD = 15.4;

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Writer {
  pdf!: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = TOP;
  sections: { title: string; page: number }[] = [];

  static async create() {
    const w = new Writer();
    w.pdf = await PDFDocument.create();
    w.font = await w.pdf.embedFont(StandardFonts.Helvetica);
    w.bold = await w.pdf.embedFont(StandardFonts.HelveticaBold);
    return w;
  }

  newPage() {
    this.page = this.pdf.addPage([PW, PH]);
    this.pages.push(this.page);
    this.y = TOP;
  }

  section(title: string, sub?: string) {
    this.newPage();
    this.sections.push({ title, page: this.pages.length });
    this.page.drawRectangle({ x: MX, y: this.y - 6, width: CW, height: 24, color: rgb(0.88, 0.9, 0.94) });
    this.page.drawText(clean(title.toUpperCase()), { x: MX + 6, y: this.y, size: 13, font: this.bold });
    this.y -= 26;
    if (sub) {
      this.page.drawText(clean(sub), { x: MX, y: this.y, size: 8.5, font: this.font, color: rgb(0.3, 0.3, 0.3) });
      this.y -= 16;
    }
  }

  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const t = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(t, size) > width && line) {
          out.push(line);
          line = word;
        } else line = t;
      }
      out.push(line);
    }
    return out;
  }

  h(text: string) {
    this.ensure(34);
    this.y -= 8;
    this.page.drawText(clean(text), { x: MX, y: this.y, size: 10.5, font: this.bold });
    this.y -= 4;
    this.page.drawLine({ start: { x: MX, y: this.y }, end: { x: PW - MX, y: this.y }, thickness: 0.4, color: rgb(0.6, 0.6, 0.6) });
    this.y -= 13;
  }

  /** Paragraph; `keep` moves the whole block to the next page rather than splitting it. */
  p(text: string, opts: { size?: number; bold?: boolean; indent?: number; keep?: boolean } = {}) {
    const size = opts.size ?? BODY;
    const lead = size + 3.7;
    const indent = opts.indent ?? 0;
    const lines = this.wrap(text, opts.bold ? this.bold : this.font, size, CW - indent);
    if (opts.keep) this.ensure(lines.length * lead + 4);
    for (const l of lines) {
      this.ensure(lead);
      this.page.drawText(l, { x: MX + indent, y: this.y, size, font: opts.bold ? this.bold : this.font });
      this.y -= lead;
    }
    this.y -= 3;
  }

  bullets(items: string[]) {
    for (const it of items) {
      const lines = this.wrap(it, this.font, BODY, CW - 14);
      this.ensure(lines.length * LEAD);
      this.page.drawText("-", { x: MX + 3, y: this.y, size: BODY, font: this.font });
      for (const l of lines) {
        this.page.drawText(l, { x: MX + 14, y: this.y, size: BODY, font: this.font });
        this.y -= LEAD;
      }
    }
    this.y -= 3;
  }

  kv(rows: [string, string][], labelW = 150) {
    for (const [k, v] of rows) {
      const lines = this.wrap(v, this.font, BODY, CW - labelW);
      this.ensure(lines.length * LEAD + 2);
      this.page.drawText(clean(k), { x: MX, y: this.y, size: BODY, font: this.bold });
      for (const l of lines) {
        this.page.drawText(l, { x: MX + labelW, y: this.y, size: BODY, font: this.font });
        this.y -= LEAD;
      }
      this.y -= 1;
    }
    this.y -= 4;
  }

  table(headers: string[], rows: string[][], widths: number[], size = 9) {
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = CW / total;
    const ws = widths.map((w) => w * scale);
    const lead = size + 2.6;
    const drawRow = (cells: string[], isHead: boolean) => {
      const wrapped = cells.map((c, i) => this.wrap(c, isHead ? this.bold : this.font, size, ws[i] - 6));
      const hgt = Math.max(...wrapped.map((l) => l.length)) * lead + 5;
      if (this.y - hgt < BOTTOM) {
        this.newPage();
        if (!isHead) drawRow(headers, true);
      }
      const top = this.y + 2;
      if (isHead) this.page.drawRectangle({ x: MX, y: top - hgt, width: CW, height: hgt, color: rgb(0.92, 0.92, 0.92) });
      let x = MX;
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) => this.page.drawText(l, { x: x + 3, y: top - 9 - j * lead, size, font: isHead ? this.bold : this.font }));
        x += ws[i];
      });
      this.page.drawLine({ start: { x: MX, y: top - hgt }, end: { x: MX + CW, y: top - hgt }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) });
      this.y = top - hgt - 2;
    };
    this.ensure(40);
    drawRow(headers, true);
    for (const r of rows) drawRow(r, false);
    this.y -= 6;
  }

  gap(n = 6) {
    this.y -= n;
  }
}

/** Helvetica WinAnsi only: refuse anything outside Latin-1 so nothing silently drops from the text layer. */
function clean(s: string): string {
  for (const ch of s) if (ch.charCodeAt(0) > 255) throw new Error(`non-Latin-1 character in packet text: ${JSON.stringify(ch)} in "${s.slice(0, 50)}"`);
  return s;
}

// ---------------------------------------------------------------- shared facts

const DAYS = ["14 Nov 2026", "15 Nov 2026", "16 Nov 2026", "17 Nov 2026"] as const;
const WT = ["73.9", "73.0", "72.1", "71.4"];
const hr = rng(884512);
const rint = (lo: number, hi: number) => Math.round(lo + hr() * (hi - lo));

const MEDS_DC = {
  entresto: "Sacubitril/valsartan (Entresto) 24/26 mg",
  glargine: "Insulin glargine 18 units",
  aspart: "Insulin aspart sliding scale",
  apixaban: "Apixaban 2.5 mg",
};

// ---------------------------------------------------------------- sections

function cover(w: Writer, pageIdx: number) {
  w.page = w.pages[pageIdx];
  w.y = TOP;
  w.page.drawText("REFERRAL PACKET - TRANSMITTAL AND CONTENTS", { x: MX, y: w.y, size: 14, font: w.bold });
  w.y -= 22;
  w.kv([
    ["From", `${HOSPITAL}, Case Management, Medical-Surgical Unit 4 West`],
    ["To", "Receiving skilled nursing facility, Admissions"],
    ["Patient", "Elena Mercado, 77-year-old female, DOB 03/14/1949, MRN RG-884512"],
    ["Admitted", "14 Nov 2026 (inpatient), acute decompensated heart failure"],
    ["Discharged", "17 Nov 2026 at 18:42 to skilled nursing facility"],
    ["Transport", "Wheelchair van arranged; estimated arrival 20:40 on 17 Nov 2026"],
  ]);
  w.p("This packet was compiled by hospital case management for transmission to the receiving facility. Documents are printed from the electronic record as of the discharge date and are listed below with their starting page. Items marked 'to follow' or 'pending' were not available at the time of transmission.");
  w.h("Contents");
  const rows = w.sections.map((s) => [s.title, String(s.page)]);
  w.table(["Document", "Page"], rows, [420, 60], 9);
  w.h("Documents not included in this transmission");
  w.table(
    ["Document", "Status"],
    [
      ["Discharge summary", "to follow"],
      ["Physician order set", "Orders: pending physician signature (see medication list)"],
      ["Prior authorization determination", "Authorization pending with payor"],
    ],
    [260, 220],
    9,
  );
  w.p("Contact case management at the hospital main number for questions about this transmission. This is a synthetic test record; no real patient data.", { size: 8.5 });
}

function faceSheet(w: Writer) {
  w.section("Face Sheet / Patient Demographics", "Registration print-out, encounter 7720914418");
  w.h("Patient");
  w.kv([
    ["Name", "MERCADO, ELENA"],
    ["Date of birth / age / sex", "03/14/1949 / 77 years / Female"],
    ["Medical record number", "RG-884512"],
    ["Encounter number", "7720914418"],
    ["Preferred language", "English; interpreter not required"],
    ["Marital status", "Widowed"],
    ["Religion", "Catholic"],
    ["Race / ethnicity", "Declined to state"],
    ["Height / weight", "163 cm / 71.4 kg (discharge weight, standing scale, 17 Nov 2026)"],
    ["Allergies", "Penicillin (rash, 2004). No known food allergies. No latex allergy."],
  ]);
  w.h("Encounter");
  w.kv([
    ["Admission date", "14 Nov 2026, 14:20 via Emergency Department"],
    ["Admission type", "Inpatient (order time 14 Nov 2026, 16:05)"],
    ["Midnights as inpatient", "3 (nights of 14, 15 and 16 Nov 2026)"],
    ["Discharge date / time", "17 Nov 2026, 18:42"],
    ["Admitting / attending physician", "Priya Raman, MD (Hospital Medicine)"],
    ["Unit", "4 West Medical-Surgical with telemetry"],
    ["Admitting diagnosis", "Acute on chronic heart failure with reduced ejection fraction"],
    ["Disposition", "Skilled nursing facility, post-acute rehabilitation and skilled nursing"],
  ]);
  w.h("Contacts");
  w.kv([
    ["Emergency contact", "None on file"],
    ["Responsible party / guarantor", "Not designated in registration"],
    ["Registration note", "Patient registered herself in the Emergency Department. Next of kin information to be obtained by social work (see Social Work section)."],
  ]);
  w.h("Coverage (as registered)");
  w.kv([
    ["Primary payor", "Northbridge Health Plan Medicare Advantage (synthetic payor)"],
    ["Member ID", "NBH-30-77714-02"],
    ["Verification", "Eligibility active on date of admission. See Insurance and Authorization section for post-acute status."],
  ]);
  w.h("Hospital problem list at discharge");
  w.bullets([
    "Heart failure with reduced ejection fraction, EF 32%, acute on chronic, improved with diuresis",
    "Chronic kidney disease stage 3b",
    "Type 2 diabetes mellitus, insulin requiring",
    "Atrial fibrillation, anticoagulated with reduced-dose apixaban 2.5 mg BID",
    "Stage 2 pressure injury, sacrum",
    "Hypertension; hyperlipidemia; mild normocytic anemia of chronic kidney disease",
  ]);
}

function insurance(w: Writer) {
  w.section("Insurance and Authorization Note", "Case management / utilization review, 17 Nov 2026 14:10");
  w.h("Payor");
  w.kv([
    ["Payor", "Northbridge Health Plan Medicare Advantage (synthetic payor)"],
    ["Plan type", "Medicare Advantage HMO"],
    ["Member ID", "NBH-30-77714-02"],
    ["Payor utilization line", "Skilled nursing facility authorizations, prior authorization unit"],
  ]);
  w.h("Authorization status");
  w.p("Prior authorization for skilled nursing facility admission was submitted to the payor on 16 Nov 2026 at 15:32 with clinical review documents attached. Authorization pending with payor. As of 14:10 on 17 Nov 2026 the plan has acknowledged receipt and assigned a case reference but has not issued a determination. The reviewer indicated that a determination is typically issued within one to two business days.", { keep: true });
  w.table(
    ["Item", "Detail"],
    [
      ["Authorization status", "PENDING - no determination received"],
      ["Submitted", "16 Nov 2026, 15:32 by case management"],
      ["Payor case reference", "NBH-PA-2026-118240"],
      ["Days requested", "Length of stay requested at submission: 7 days, with re-review requested"],
      ["Days approved", "None yet. Approved length of stay not known."],
      ["Peer-to-peer", "Not requested. Offered by payor only if the initial review is adverse."],
    ],
    [140, 340],
  );
  w.h("Inpatient stay qualifying information");
  w.p("Inpatient admission 14 Nov 2026 with three midnights as an inpatient (14, 15 and 16 Nov). The admission order was written at 16:05 on 14 Nov 2026 after observation in the Emergency Department began at 14:20 the same day. Discharge to skilled nursing facility was on 17 Nov 2026.");
  w.h("Case management comments");
  w.p("The patient is alert and states she understands that coverage for the skilled nursing facility stay has not been confirmed. She asked whether she would be billed if the plan declines. She was told that the hospital cannot answer that and that the receiving facility's business office will review benefits with her. Case management will forward the determination to the receiving facility when received. Benefit day count under the plan has not been requested from the payor and is not documented here.");
  w.p("Prior authorization will be followed daily by case management until a determination is issued. The receiving facility should not assume approval based on this transmittal.");
}

function hAndP(w: Writer) {
  w.section("History and Physical", "Hospital Medicine - Priya Raman, MD - dictated 14 Nov 2026 18:20");
  w.h("Chief complaint");
  w.p("Shortness of breath and leg swelling for one week, worse over three days.");
  w.h("History of present illness");
  w.p("Mrs. Mercado is a 77-year-old woman with heart failure with reduced ejection fraction, persistent atrial fibrillation on anticoagulation, chronic kidney disease stage 3b, insulin-requiring type 2 diabetes mellitus, hypertension and hyperlipidemia who presented to the Emergency Department on 14 Nov 2026 with a one-week history of progressive exertional dyspnea, orthopnea requiring three pillows, and bilateral lower extremity swelling. She reports a weight gain of roughly 3 kg over ten days by her bathroom scale. She denies chest pain, palpitations beyond her baseline, syncope, fever or cough productive of sputum. She admits to eating canned soups and restaurant meals over the past two weeks and to missing her evening furosemide on several days because of urinary urgency.");
  w.p("In the Emergency Department she was hypoxemic to 89% on room air, improving to 94% on 2 L nasal cannula. Heart rate was 108 and irregular, blood pressure 148/88. BNP was 1,840 pg/mL. Chest radiograph showed pulmonary vascular congestion and small bilateral effusions. She received furosemide 60 mg intravenously with 1.4 L of urine output over four hours and was admitted to telemetry for acute decompensated heart failure.");
  w.h("Past medical history");
  w.bullets([
    "Heart failure with reduced ejection fraction, nonischemic cardiomyopathy, diagnosed 2022; last known EF 35% (2025)",
    "Persistent atrial fibrillation, diagnosed 2021, CHA2DS2-VASc score 6",
    "Chronic kidney disease stage 3b, baseline creatinine 1.5 to 1.7 mg/dL",
    "Type 2 diabetes mellitus, insulin requiring since 2019; hemoglobin A1c 8.1% this admission",
    "Hypertension; hyperlipidemia",
    "Normocytic anemia, attributed to chronic kidney disease",
    "Osteoarthritis of both knees",
  ]);
  w.h("Past surgical history");
  w.p("Cholecystectomy 1998. Right cataract extraction 2021.");
  w.h("Home medications (patient report and pharmacy fill history)");
  w.table(
    ["Medication", "Dose", "Frequency", "Comment"],
    [
      ["Furosemide", "40 mg PO", "Daily", "Missing evening doses; patient reports taking it once daily"],
      ["Carvedilol", "6.25 mg PO", "BID", ""],
      ["Apixaban", "2.5 mg PO", "BID", "Reduced dose per outpatient cardiology"],
      ["Amiodarone", "200 mg PO", "Daily", ""],
      ["Atorvastatin", "40 mg PO", "Nightly", ""],
      ["Insulin glargine", "18 units SC", "Nightly", ""],
      ["Insulin aspart", "Sliding scale SC", "With meals", "Patient uses a card from her endocrinology clinic"],
      ["Famotidine", "20 mg PO", "Daily", ""],
    ],
    [110, 90, 80, 200],
  );
  w.h("Social history");
  w.p("Widowed. Retired school administrator. Former smoker, quit 1995, about 10 pack-years. No alcohol. No illicit drug use. Independent in basic activities of daily living until about six weeks ago, when exertional dyspnea began limiting her activity.");
  w.h("Family history");
  w.p("Mother with heart failure, died at 81. Father with myocardial infarction at 66. One sister with type 2 diabetes.");
  w.h("Review of systems");
  w.p("Constitutional: fatigue, weight gain; no fever or chills. Respiratory: dyspnea on exertion, orthopnea; no hemoptysis. Cardiovascular: leg swelling; no chest pain, no syncope. Gastrointestinal: early satiety; no nausea, vomiting, melena or hematochezia. Genitourinary: urgency; no dysuria. Neurologic: no focal weakness, no confusion. Skin: no rashes reported. All other systems reviewed and negative.");
  w.h("Physical examination");
  w.kv([
    ["Vitals on arrival", "T 36.8 C, HR 108 irregular, BP 148/88, RR 22, SpO2 89% on room air improving to 94% on 2 L"],
    ["Weight", "73.9 kg on bed scale (admission). Height 163 cm."],
    ["General", "Elderly woman, alert, mildly dyspneic at rest, speaking in full sentences."],
    ["Neck", "Jugular venous pressure elevated to the angle of the jaw at 45 degrees."],
    ["Cardiac", "Irregularly irregular, no murmur appreciated, S3 present."],
    ["Lungs", "Bibasilar crackles to the mid-lung fields, no wheeze."],
    ["Abdomen", "Soft, nontender, mild distension, no organomegaly."],
    ["Extremities", "2+ pitting edema to the knees bilaterally; feet warm."],
    ["Neurologic", "Alert and oriented to person, place, time. Cranial nerves intact. Strength 4+/5 and symmetric."],
    ["Skin", "Examined in the Emergency Department with the patient on a stretcher. Dry, no rash on the trunk or limbs. Sacral area not examined at this time."],
  ]);
  w.h("Data");
  w.p("Creatinine 1.6 mg/dL (baseline 1.5 to 1.7), potassium 4.6 mmol/L, sodium 137 mmol/L, BNP 1,840 pg/mL, high-sensitivity troponin flat at 22 and 24 ng/L, hemoglobin 10.8 g/dL, glucose 214 mg/dL. Electrocardiogram: atrial fibrillation with ventricular rate 104, left axis deviation, nonspecific ST changes. Bedside echocardiogram: see the diagnostic reports section for the formal study.");
  w.h("Assessment and plan");
  w.p("77-year-old woman with HFrEF (EF 32%), CKD 3b, insulin-requiring type 2 diabetes and atrial fibrillation admitted with acute on chronic systolic heart failure, likely precipitated by dietary sodium excess and missed diuretic doses.", { keep: true });
  w.bullets([
    "Acute on chronic HFrEF: IV furosemide 40 mg twice daily, strict intake and output, daily standing weights, 2 g sodium diet, 1.5 L fluid restriction, telemetry. Cardiology consulted for guideline-directed therapy review.",
    "Atrial fibrillation: rate controlled on carvedilol; continue amiodarone. Continue apixaban at the reduced dose of 2.5 mg twice daily pending cardiology input on dosing given CKD 3b and anemia.",
    "CKD stage 3b: creatinine at baseline on arrival. Nephrology consulted for diuresis in the setting of CKD and for planning of any renin-angiotensin-neprilysin therapy.",
    "Type 2 diabetes: continue insulin glargine 18 units nightly and insulin aspart sliding scale with meals; point-of-care glucose before meals and at bedtime. Consistent carbohydrate diet.",
    "Anemia: hemoglobin 10.8, stable; iron studies sent.",
    "Skin: full skin assessment by nursing on the unit.",
    "Prophylaxis: therapeutic anticoagulation with apixaban; no additional pharmacologic prophylaxis. Early mobilization; physical therapy to evaluate.",
    "Disposition: anticipate skilled nursing facility for rehabilitation after diuresis; case management and physical therapy consulted.",
  ]);
  w.p("Priya Raman, MD - Hospital Medicine. Electronically signed 14 Nov 2026 18:41.", { size: 8.5 });
}

function cardiology(w: Writer) {
  w.section("Cardiology Consultation", "Marcus Feldt, MD - Cardiology - 15 Nov 2026 10:05");
  w.p("Reason for consultation: acute on chronic HFrEF; review of guideline-directed medical therapy and anticoagulation dosing in atrial fibrillation.");
  w.h("History");
  w.p("77-year-old woman with nonischemic cardiomyopathy followed in our clinic since 2022. EF has declined from 35% to 32% on the study performed this admission. She has persistent atrial fibrillation managed with rate control (carvedilol) and rhythm suppression with amiodarone 200 mg daily, and anticoagulated with apixaban 2.5 mg twice daily. She was not on a renin-angiotensin-neprilysin inhibitor or an SGLT2 inhibitor before admission because of CKD 3b and prior borderline blood pressure at clinic visits.");
  w.h("Examination");
  w.p("Weight 73.0 kg this morning, down from 73.9 kg on admission. Jugular venous pressure 10 cm. S3 present. Bibasilar crackles improving. Edema 1+ to the mid-shin. Irregularly irregular rhythm at 82 beats per minute on telemetry. Blood pressure 124/72.");
  w.h("Studies reviewed");
  w.p("Echocardiogram 14 Nov 2026: EF 32%, global hypokinesis, left atrial enlargement, moderate functional mitral regurgitation, estimated RVSP 44 mmHg. Telemetry: atrial fibrillation with rates 72 to 98, no pauses, no sustained ventricular arrhythmia. BNP 1,840 pg/mL on admission.");
  w.h("Assessment");
  w.bullets([
    "Acute on chronic HFrEF, EF 32%, responding to IV diuresis, approximately 0.9 kg down in the first 24 hours. Target dry weight is near 71 kg.",
    "Persistent atrial fibrillation, ventricular rate controlled. CHA2DS2-VASc 6; anticoagulation is indicated.",
    "CKD 3b limits options for angiotensin receptor blockade; nephrology input requested before neprilysin inhibition.",
  ]);
  w.h("Recommendations");
  w.bullets([
    "Continue diuresis; transition to oral furosemide 40 mg daily once euvolemic. Daily weights; call the cardiology clinic for a gain of more than 1 kg in a day or 2 kg in a week.",
    "Start sacubitril/valsartan 24/26 mg twice daily once creatinine is stable for 48 hours and nephrology agrees, in place of any ACE inhibitor (none currently prescribed). Recheck potassium and creatinine within one week of starting.",
    "Continue carvedilol 6.25 mg twice daily; hold for heart rate below 55 or systolic blood pressure below 95.",
    "Continue amiodarone 200 mg daily. Thyroid and liver tests were normal in September 2026.",
    "Apixaban: the reduced dose of 2.5 mg twice daily is intentionally continued. Although she meets only one of the three standard dose-reduction criteria (creatinine 1.6 mg/dL), I have chosen the lower dose in view of CKD 3b, anemia with hemoglobin 10.8 and fall risk. This will be reconsidered at outpatient follow-up if renal function and hemoglobin are stable. Do not change the dose without discussion.",
    "Continue atorvastatin 40 mg nightly.",
    "SGLT2 inhibitor deferred this admission given glycemic control, sacral skin issue and the need for a stable renal baseline; revisit as an outpatient.",
    "2 g sodium diet and fluid restriction of 1.5 L per day.",
  ]);
  w.p("Thank you for this consultation. Cardiology will continue to follow while she is inpatient.");
  w.h("Cardiology follow-up note, 16 Nov 2026 09:30");
  w.p("Weight 72.1 kg. Creatinine 1.5 mg/dL. Euvolemic on examination except for trace ankle edema. Telemetry rate 70 to 90. Sacubitril/valsartan 24/26 mg twice daily was started on 15 Nov and tolerated; blood pressure 116/68 after two doses with no orthostatic symptoms. Plan unchanged. Transition to oral furosemide 40 mg daily on 17 Nov. Recheck potassium and creatinine in one week after discharge.");
  w.p("Marcus Feldt, MD - Cardiology. Electronically signed 16 Nov 2026 10:02.", { size: 8.5 });
  cardiologyAddendum(w);
}

function nephrology(w: Writer) {
  w.section("Nephrology Consultation", "Anika Osei, MD - Nephrology - 15 Nov 2026 13:40");
  w.p("Reason for consultation: CKD stage 3b with acute decompensated heart failure; guidance on diuresis and on starting sacubitril/valsartan.");
  w.h("History");
  w.p("77-year-old woman with CKD stage 3b attributed to diabetic and hypertensive nephropathy with a cardiorenal component. Baseline creatinine 1.5 to 1.7 mg/dL (eGFR 32 to 37 mL/min/1.73 m2) over the past two years. No history of renal replacement therapy. Last urine albumin to creatinine ratio 180 mg/g in June 2026. No NSAID use. She was admitted with volume overload and has received intravenous loop diuretic with brisk response.");
  w.h("Examination and data");
  w.p("Weight 73.0 kg. Blood pressure 124/72. Mild bibasilar crackles. 1+ ankle edema. Admission creatinine 1.6 mg/dL, this morning 1.6 mg/dL, eGFR 34. Potassium 4.4 mmol/L, bicarbonate 24 mmol/L, magnesium 2.0 mg/dL. Urinalysis without active sediment.");
  w.table(
    ["Test", "14 Nov", "15 Nov", "Reference"],
    [
      ["Creatinine (mg/dL)", "1.6", "1.6", "0.5 - 1.1"],
      ["eGFR (mL/min/1.73 m2)", "33", "34", "> 60"],
      ["BUN (mg/dL)", "38", "36", "7 - 20"],
      ["Potassium (mmol/L)", "4.6", "4.4", "3.5 - 5.1"],
      ["Bicarbonate (mmol/L)", "23", "24", "22 - 29"],
    ],
    [160, 80, 80, 120],
  );
  w.h("Assessment");
  w.bullets([
    "CKD stage 3b, stable at baseline; no acute kidney injury on arrival. Cardiorenal physiology: renal function expected to improve with decongestion.",
    "Mild normocytic anemia of CKD, hemoglobin 10.8; iron saturation pending.",
    "Hyperkalemia risk on renin-angiotensin-neprilysin therapy, particularly with later addition of a mineralocorticoid antagonist.",
  ]);
  w.h("Recommendations");
  w.bullets([
    "Continue IV furosemide until euvolemic; accept a creatinine rise of up to 0.3 mg/dL during diuresis.",
    "No objection to sacubitril/valsartan 24/26 mg twice daily if creatinine and potassium are stable on 16 Nov. Check a basic metabolic panel 48 hours after starting and again about one week after discharge.",
    "Avoid NSAIDs and contrast where possible. Renally dose new medications.",
    "No mineralocorticoid antagonist at this time because of the combination of CKD 3b and neprilysin inhibitor initiation.",
    "Outpatient nephrology follow-up in clinic after discharge.",
  ]);
  w.h("Nephrology follow-up note, 16 Nov 2026 14:15");
  w.p("Creatinine 1.5 mg/dL, potassium 4.5 mmol/L after the first doses of sacubitril/valsartan. Urine output 2.1 L over 24 hours. Agree with transition to oral furosemide. Repeat basic metabolic panel in about one week after discharge to confirm stability of potassium and creatinine on the new regimen. Renal function otherwise at baseline.");
  w.p("Anika Osei, MD - Nephrology. Electronically signed 16 Nov 2026 14:50.", { size: 8.5 });
}

function progressNotes(w: Writer) {
  w.section("Physician Progress Notes", "Hospital Medicine - Priya Raman, MD");
  const notes: { date: string; hd: string; subj: string; obj: string; labs: string; plan: string[] }[] = [
    {
      date: "15 Nov 2026", hd: "Hospital day 2",
      subj: "Slept sitting up but breathing easier than yesterday. Dyspnea 4 out of 10 at rest, improved. Denies chest pain. Appetite fair. Nursing reports a new area of skin breakdown over the sacrum noted during morning care; see wound care consultation.",
      obj: "T 36.7, HR 88 irregular, BP 126/74, RR 18, SpO2 95% on 1 L. Weight 73.0 kg. Net negative 1.6 L in the last 24 hours. Jugular venous pressure 11 cm. Crackles at the bases. 1+ edema. Sacrum: shallow open area with a pink wound bed, no drainage.",
      labs: "Creatinine 1.6, potassium 4.4, sodium 138, hemoglobin 10.6, glucose pre-meal 168 to 205.",
      plan: [
        "Continue IV furosemide 40 mg twice daily; goal net negative 1 to 1.5 L per day.",
        "Cardiology and nephrology consultations reviewed; plan to start sacubitril/valsartan 24/26 mg twice daily this evening.",
        "Insulin glargine 18 units nightly and insulin aspart sliding scale with meals continued; glucose acceptable.",
        "Wound care consultation requested for sacral pressure injury; reposition every two hours; offload.",
        "Code status discussed with the patient today.",
        "Physical therapy and occupational therapy evaluations ordered.",
      ],
    },
    {
      date: "16 Nov 2026", hd: "Hospital day 3",
      subj: "Feels much better. Walked to the bathroom with assistance. Dyspnea only with exertion. Slept flat with one pillow. No lightheadedness after starting the new heart failure medication.",
      obj: "T 36.6, HR 78 irregular, BP 116/68, RR 16, SpO2 96% on room air. Weight 72.1 kg. Net negative 1.2 L. Jugular venous pressure 8 cm. Lungs clear except for fine bibasilar crackles. Trace ankle edema. Sacrum per wound care consultation.",
      labs: "Creatinine 1.5, potassium 4.5, sodium 139, hemoglobin 10.7, A1c 8.1%.",
      plan: [
        "Supplemental oxygen discontinued; saturation 95 to 97% on room air at rest and with walking in the hallway.",
        "Transition to oral furosemide 40 mg daily tomorrow if weight is stable; hold the evening IV dose today if net negative target met.",
        "Continue sacubitril/valsartan; potassium and creatinine stable at 48 hours after start.",
        "Diet: 2 g sodium cardiac, consistent carbohydrate. Dietitian saw the patient.",
        "Case management submitted skilled nursing facility authorization request this afternoon; social work to meet the patient regarding contacts.",
        "Plan for discharge to skilled nursing facility 17 Nov pending bed acceptance and transport.",
      ],
    },
    {
      date: "17 Nov 2026", hd: "Hospital day 4 - day of discharge",
      subj: "Comfortable. Breathing at baseline with exertion. No chest pain, no dizziness. Eating well. Understands that she is going to a skilled nursing facility for strengthening.",
      obj: "T 36.8, HR 76 irregular, BP 118/70, RR 16, SpO2 96% on room air. Weight 71.4 kg (standing). Net negative 0.9 L overnight. Jugular venous pressure not elevated. Lungs clear. Trace ankle edema. Alert and oriented. Sacral wound unchanged per nursing and wound care.",
      labs: "Creatinine 1.6, potassium 4.7, sodium 138, hemoglobin 10.8, glucose before breakfast 142.",
      plan: [
        "Medically stable for discharge. Discharge weight 71.4 kg is the working dry weight.",
        "Oral furosemide 40 mg daily started this morning. Continue daily weights at the facility; notify the physician for a gain of more than 1 kg in a day.",
        "Medication reconciliation completed with the pharmacist; see the medication list section.",
        "A basic metabolic panel is requested in 7 days; see laboratory section.",
        "Discharge summary dictation in progress; to follow. Physician order set to be signed.",
        "Discharge time 18:42. Transport by wheelchair van is arranged.",
      ],
    },
  ];
  for (const n of notes) {
    w.newPage();
    w.h(`${n.date} - ${n.hd}`);
    w.kv([["Subjective", n.subj], ["Objective", n.obj], ["Data", n.labs]], 80);
    w.p("Assessment and plan", { bold: true, keep: true });
    w.bullets(n.plan);
    w.p("Priya Raman, MD. Electronically signed.", { size: 8.5 });
  }
  w.h("14 Nov 2026 - Admission night event note");
  w.p("Called to the bedside at 23:10 for a heart rate of 128 irregular in the setting of coughing during repositioning. Rate settled to 96 within 20 minutes without intervention. Patient asymptomatic. Telemetry reviewed: atrial fibrillation with rapid ventricular response resolved spontaneously, no pauses. Electrolytes reviewed, potassium 4.6, magnesium 2.0. No change in therapy. Nursing to notify for sustained rates above 120.");
  w.newPage();
  w.h("Interval summary for receiving facility");
  w.p("Four-day hospitalization for acute on chronic systolic heart failure. Diuresed 3.0 kg (admission weight 73.9 kg, discharge weight 71.4 kg standing scale; bed and standing scales differ slightly). Sacubitril/valsartan started during this admission. Apixaban 2.5 mg twice daily continued, dose confirmed intentionally reduced by cardiology. The full discharge summary is to follow.");
}

type Shift = { when: string; nurse: string; narrative: string; assess: [string, string][] };

function nursing(w: Writer) {
  w.section("Nursing Notes", "4 West Medical-Surgical - shift documentation");
  const shifts: Shift[] = [
    {
      when: "14 Nov 2026, day shift 07:00-19:00 (admission 15:10)", nurse: "J. Alvarez, RN",
      narrative: "Patient arrived from the Emergency Department at 15:10 by stretcher, on 2 L nasal cannula, alert and oriented. Telemetry applied. Admission database completed. Patient reports leg swelling and fatigue. Fall risk score 45, bed alarm on. Patient oriented to call light and unit routines. Bed scale weight 73.9 kg. Skin assessment on admission limited because the patient was transferred from the stretcher in a seated position and declined to be turned; sacral area not visualized at this time. Foam mattress in place. Fluid restriction 1.5 L and 2 g sodium diet explained.",
      assess: [["Neuro", "Alert, oriented x3, follows commands"], ["Cardiac", "Irregular rhythm on telemetry, rate 96 to 108"], ["Respiratory", "Crackles at bases, 2 L NC, SpO2 94%"], ["GI/GU", "Abdomen soft; voiding spontaneously, urgency noted"], ["Skin", "Dry; bilateral leg edema; sacrum not visualized"], ["Pain", "0 out of 10"], ["Mobility", "Assist x1 to commode"]],
    },
    {
      when: "14 Nov 2026, night shift 19:00-07:00", nurse: "T. Nguyen, RN",
      narrative: "Slept in short intervals sitting upright. Heart rate transiently 128 at 23:10 with coughing, resolved without intervention; physician notified. Urine output 1,350 mL over the shift after IV furosemide. Bedtime glucose obtained and insulin glargine 18 units given at 21:10. Declined to use the bedpan; used the commode with one assist. Call light in reach.",
      assess: [["Neuro", "Alert, oriented x3"], ["Cardiac", "Atrial fibrillation 84 to 128, resolved"], ["Respiratory", "SpO2 94 to 95% on 2 L"], ["GI/GU", "Voiding, strict I&O"], ["Skin", "Patient repositioned in bed every 2 hours; no changes recorded"], ["Pain", "0 out of 10"], ["Mobility", "Assist x1"]],
    },
    {
      when: "15 Nov 2026, day shift 07:00-19:00", nurse: "J. Alvarez, RN",
      narrative: "During morning care the patient was turned and an open area was noted over the sacrum. Shallow, pink-red wound bed, no slough, no drainage, no odor, surrounding skin intact and blanchable. Wound measured at approximately 2.5 cm by 2.0 cm with depth less than 0.2 cm. Staged as a stage 2 pressure injury by the nurse. Physician notified; wound care consultation requested. Foam dressing applied to the sacrum, patient repositioned every two hours with 30-degree lateral tilt, heels floated. Patient states the area has been 'sore for a while'. Sacubitril/valsartan first dose given at 17:40 after nephrology clearance. Weight 73.0 kg. Physical therapy evaluation attempted; patient fatigued, deferred to tomorrow.",
      assess: [["Neuro", "Alert, oriented x3"], ["Cardiac", "Atrial fibrillation 78 to 92, BP 126/74"], ["Respiratory", "1 L NC, SpO2 95%"], ["GI/GU", "Voiding; net negative 1.6 L"], ["Skin", "Stage 2 pressure injury sacrum 2.5 x 2.0 cm; foam dressing applied"], ["Pain", "2 out of 10 sacrum with turning"], ["Mobility", "Assist x1 to chair"]],
    },
    {
      when: "15 Nov 2026, night shift 19:00-07:00", nurse: "T. Nguyen, RN",
      narrative: "Slept well, on room air from 03:00 with saturation 95%. Dressing to the sacrum intact and dry. Turned every two hours. No complaints of dizziness after the evening doses. Glucose at bedtime 188; insulin glargine 18 units given at 21:05. Voiding adequately.",
      assess: [["Neuro", "Alert, oriented x3"], ["Cardiac", "Rate 74 to 88"], ["Respiratory", "Room air from 03:00, SpO2 95%"], ["GI/GU", "Voiding, strict I&O"], ["Skin", "Sacral dressing intact; no strike-through"], ["Pain", "1 out of 10"], ["Mobility", "Assist x1"]],
    },
    {
      when: "16 Nov 2026, day shift 07:00-19:00", nurse: "J. Alvarez, RN",
      narrative: "Seen by wound care and by dietitian. Dressing changed to the sacrum with the wound care nurse; wound documented by nursing as 2.4 cm by 2.0 cm this morning on a ruler measure, pink wound bed, no drainage. Patient walked 60 feet with physical therapy using a rolling walker. Weight 72.1 kg. Edema trace. Patient mentions her daughter lives out of state and has not returned calls from the unit; social work notified. Authorization request submitted by case management this afternoon. Voiding without difficulty.",
      assess: [["Neuro", "Alert, oriented x3"], ["Cardiac", "Rate 70 to 86"], ["Respiratory", "Room air, SpO2 96%"], ["GI/GU", "Voiding; net negative 1.2 L"], ["Skin", "Sacral stage 2 injury 2.4 x 2.0 cm; dressing changed"], ["Pain", "1 out of 10"], ["Mobility", "Ambulating 60 ft with rolling walker and contact guard"]],
    },
    {
      when: "16 Nov 2026, night shift 19:00-07:00", nurse: "R. Okafor, RN",
      narrative: "Uneventful night. Slept flat with one pillow. Turned every two hours. Insulin glargine 18 units given at 21:00. Patient asked about the plan for tomorrow and was told discharge to a skilled nursing facility is expected. Standing weight obtained at 06:00: 71.4 kg.",
      assess: [["Neuro", "Alert, oriented x3"], ["Cardiac", "Rate 68 to 84"], ["Respiratory", "Room air, clear"], ["GI/GU", "Voiding"], ["Skin", "Sacral dressing intact"], ["Pain", "0 out of 10"], ["Mobility", "Assist x1 to commode"]],
    },
    {
      when: "17 Nov 2026, day shift 07:00-19:00 (discharge 18:42)", nurse: "J. Alvarez, RN",
      narrative: "Oral furosemide given at 09:00. Peripheral IV removed at 17:50, catheter intact, site clean. Sacral stage 2 pressure injury reassessed at 15:00: approximately 2.5 cm by 2.0 cm, pink, no drainage, foam dressing replaced. Daily weight 71.4 kg. Patient dressed and seated in wheelchair. Medication list reviewed with the patient. Report called to the receiving facility nurse at 18:15. Patient left the unit at 18:42 by wheelchair to the transport van; stable, alert and oriented, SpO2 96% on room air. Belongings returned. The patient reports that she could not reach her daughter by phone before leaving.",
      assess: [["Neuro", "Alert, oriented x3"], ["Cardiac", "Rate 76, BP 118/70"], ["Respiratory", "Room air, SpO2 96%"], ["GI/GU", "Voiding"], ["Skin", "Stage 2 pressure injury sacrum approx 2.5 x 2.0 cm; foam dressing"], ["Pain", "1 out of 10"], ["Mobility", "Wheelchair for transport; 100 ft with rolling walker and contact guard"]],
    },
  ];
  for (const s of shifts) {
    if (s.when.includes("day shift") && !s.when.startsWith("14")) w.newPage();
    w.h(`${s.when} - ${s.nurse}`);
    w.p(s.narrative);
    w.table(["System", "Finding"], s.assess, [90, 390], 8.3);
  }
  // Vitals flowsheet
  w.h("Vital signs flowsheet");
  const vit: string[][] = [];
  const t0 = new Date("2026-11-14T15:00:00");
  for (let i = 0; i < 24; i++) {
    const d = new Date(t0.getTime() + i * 3.25 * 3600e3);
    const dt = `${String(d.getDate())} Nov ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const imp = i / 24;
    vit.push([
      dt,
      String(Math.round(104 - 28 * imp + rint(-4, 4))),
      `${Math.round(142 - 24 * imp + rint(-4, 4))}/${Math.round(84 - 14 * imp + rint(-3, 3))}`,
      String(Math.round(21 - 5 * imp + rint(-1, 1))),
      `${Math.round(94 + 2 * imp + rint(0, 1))}%`,
      (36.5 + hr() * 0.5).toFixed(1),
      i < 4 ? "2 L NC" : i < 8 ? "1 L NC" : "RA",
    ]);
  }
  w.table(["Time", "HR", "BP", "RR", "SpO2", "Temp (C)", "O2"], vit, [90, 50, 80, 40, 55, 65, 70], 8.3);
  w.h("Daily weights and intake/output");
  w.table(
    ["Date", "Weight (kg)", "Scale", "Intake (mL)", "Urine output (mL)", "Net (mL)"],
    [
      ["14 Nov (admission)", "73.9", "Bed scale", "780", "1,350", "-570"],
      ["15 Nov", "73.0", "Standing", "1,240", "2,860", "-1,620"],
      ["16 Nov", "72.1", "Standing", "1,310", "2,510", "-1,200"],
      ["17 Nov (discharge)", "71.4", "Standing", "1,150", "2,050", "-900"],
    ],
    [110, 70, 70, 80, 100, 70],
  );
  w.h("Point-of-care glucose log (mg/dL)");
  w.table(
    ["Date", "Before breakfast", "Before lunch", "Before dinner", "Bedtime"],
    [
      ["14 Nov", "-", "-", "196", "212"],
      ["15 Nov", "182", "205", "168", "188"],
      ["16 Nov", "151", "176", "160", "174"],
      ["17 Nov", "142", "158", "149", "-"],
    ],
    [80, 110, 100, 100, 90],
  );
}


function edNote(w: Writer) {
  w.section("Emergency Department Record", "Triage and physician documentation - 14 Nov 2026");
  w.h("Triage - 14 Nov 2026 14:20");
  w.kv([
    ["Arrival", "Walked in, accompanied by no one; registered herself"],
    ["Chief complaint", "Shortness of breath, swelling in legs"],
    ["Acuity (ESI)", "3"],
    ["Triage vitals", "T 36.8 C, HR 108, BP 148/88, RR 22, SpO2 89% on room air"],
    ["Pain", "0 out of 10"],
    ["Allergies", "Penicillin (rash)"],
    ["Triage nurse", "K. Brandt, RN"],
  ], 120);
  w.h("ED physician note - 14 Nov 2026 14:35");
  w.p("77-year-old woman with known heart failure and atrial fibrillation presents with a week of progressive dyspnea, orthopnea and leg swelling. No chest pain. She states she has gained weight and has been missing some diuretic doses. On examination she is mildly tachypneic with elevated jugular venous pressure, bibasilar crackles and pitting edema to the knees. She is speaking in full sentences. Oxygen saturation improved to 94% on 2 L by nasal cannula.");
  w.table(
    ["ED result", "Value", "Comment"],
    [
      ["BNP", "1,840 pg/mL", "Markedly elevated"],
      ["hs-Troponin", "22 then 24 ng/L", "Flat; no acute coronary syndrome"],
      ["Creatinine", "1.6 mg/dL", "At baseline"],
      ["Potassium", "4.6 mmol/L", ""],
      ["Hemoglobin", "10.8 g/dL", "Chronic"],
      ["Glucose", "214 mg/dL", ""],
      ["Chest radiograph", "Congestion, small effusions", "See diagnostic reports"],
      ["ECG", "Atrial fibrillation, rate 104", "No acute ischemia"],
    ],
    [140, 160, 180],
  );
  w.h("ED course");
  w.p("Furosemide 60 mg intravenously at 14:50 with 1.4 L of urine output over four hours. Oxygen weaned to 2 L. Home medications continued. The patient was reassessed at 16:00 and felt less short of breath. Cardiology was telephoned by the ED physician and agreed with admission for diuresis and consultation in the morning. Skin was not examined in detail during the ED visit because the patient remained on the stretcher in a seated position and the priority was cardiopulmonary stabilization.");
  w.h("Disposition");
  w.p("Admitted to Hospital Medicine, 4 West with telemetry, in guarded but stable condition. Report given to the receiving nurse at 15:00. Patient transported to the unit at 15:10.");
  w.p("Electronically signed - ED Physician, 14 Nov 2026 16:20.", { size: 8.5 });
}

function caseMgmt(w: Writer) {
  w.section("Case Management Progress Notes", "Care coordination and utilization review - 14 to 17 Nov 2026");
  const notes: [string, string][] = [
    ["14 Nov 2026 17:30 - Initial assessment", "Reviewed chart on admission. Patient admitted from the ED with acute decompensated heart failure; anticipate a three to four day stay. Patient lives alone and was independent until about six weeks ago. Anticipated needs: physical and occupational therapy, daily weights, medication management. Preliminary plan: skilled nursing facility for short-term rehabilitation if therapy evaluations support it. Payor verified as Northbridge Health Plan Medicare Advantage, eligibility active. Patient informed of the possible need for authorization."],
    ["15 Nov 2026 11:10 - Care coordination", "Physical therapy evaluation not yet completed due to patient fatigue. Discussed discharge options with the patient; she is agreeable to rehabilitation in a skilled nursing facility and prefers one near her city. Patient list of facilities given. Referral packets prepared for three facilities pending therapy recommendation and clinical stability."],
    ["16 Nov 2026 15:35 - Authorization submission", "Therapy recommendation received: skilled nursing facility. Clinical documents (history and physical, progress notes, therapy evaluation, medication list) sent to the payor with a request for seven days. Submission acknowledged by the payor at 15:32 with reference NBH-PA-2026-118240. No determination issued. Referral sent to the receiving facility; bed offer expected by the next morning. Social work asked to locate the patient's family."],
    ["17 Nov 2026 09:20 - Bed acceptance", "Receiving facility confirmed acceptance for the evening of 17 Nov, pending receipt of clinical documents and the discharge medication list. Transport by wheelchair van booked for 18:30 pickup. Authorization status checked with the payor at 09:15: still under review."],
    ["17 Nov 2026 14:10 - Authorization status", "Payor contacted again: authorization pending, no determination. Receiving facility notified of the status by telephone. Case management will follow the determination daily and forward it. Discharge summary requested from the attending; to follow."],
    ["17 Nov 2026 18:45 - Departure", "Patient left 4 West at 18:42 by wheelchair to the van. Estimated arrival at the receiving facility 20:40. Packet transmitted electronically at 18:50. Items not available at transmission: discharge summary, signed physician order set, authorization determination."],
  ];
  for (const [h, b] of notes) {
    w.h(h);
    w.p(b);
  }
  w.p("Hospital case management. Electronically signed.", { size: 8.5 });
}

function marLog(w: Writer) {
  w.section("Medication Administration Detail Log", "Inpatient administrations in time order - generated from the electronic MAR");
  const nurseFor = (date: string, hhmm: string) => {
    const h = Number(hhmm.slice(0, 2));
    if (date.startsWith("14")) return h < 19 ? "J. Alvarez RN" : "T. Nguyen RN";
    if (date.startsWith("15")) return h >= 7 && h < 19 ? "J. Alvarez RN" : "T. Nguyen RN";
    if (date.startsWith("16")) return h >= 7 && h < 19 ? "J. Alvarez RN" : "R. Okafor RN";
    return "J. Alvarez RN";
  };
  const days = ["14 Nov", "15 Nov", "16 Nov", "17 Nov"];
  const log: { d: number; t: string; med: string; freq: string; extra: string }[] = [];
  for (const row of MAR_ROWS) {
    for (let d = 0; d < 4; d++) {
      const cell = row[2 + d];
      if (cell === "-") continue;
      for (const part of cell.split(", ")) {
        const t = part.slice(0, 5);
        const isAspart = row[0].startsWith("Insulin aspart");
        log.push({ d, t, med: row[0], freq: row[1], extra: isAspart ? `Given per attached scale; POC glucose ${rint(140, 212)} mg/dL` : "Given" });
      }
    }
  }
  log.sort((a, b) => a.d - b.d || a.t.localeCompare(b.t));
  w.table(
    ["Date", "Time", "Medication", "Frequency", "Administered by", "Result"],
    log.map((e) => [days[e.d], e.t, e.med, e.freq, nurseFor(days[e.d], e.t), e.extra]),
    [50, 40, 150, 80, 80, 150],
    7.8,
  );
  w.p("End of administration log. No held, refused or omitted doses recorded.", { size: 8.5 });
}

function nursingFlow(w: Writer) {
  w.section("Nursing Assessment Flowsheet", "Every four hours - 4 West Medical-Surgical");
  const t0 = new Date("2026-11-14T15:00:00");
  const rows: string[][] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(t0.getTime() + i * 3.25 * 3600e3);
    const dt = `${d.getDate()} Nov ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const early = d.getTime() < new Date("2026-11-15T08:00:00").getTime();
    rows.push([
      dt,
      i < 8 ? "Crackles at bases" : "Clear to fine crackles",
      i % 5 === 0 ? "AF, rate 80s" : "AF, rate 70s-90s",
      i < 12 ? "Edema 2+ to 1+" : "Edema trace",
      early ? "Dry, no breakdown seen; sacrum not visualized" : "Foam dressing to sacrum intact, turned q2h",
      i < 6 ? "Assist x1" : i < 16 ? "Assist x1 to chair" : "Walker, contact guard",
      i % 3 === 0 ? "JA" : i % 3 === 1 ? "TN" : "RO",
    ]);
  }
  w.table(["Time", "Respiratory", "Cardiac rhythm", "Edema", "Skin", "Mobility", "RN"], rows, [60, 80, 80, 70, 150, 90, 30], 7.8);
  w.h("Braden scale and fall risk scores");
  w.table(
    ["Date", "Braden score", "Fall risk (Morse)", "Comment"],
    [
      ["14 Nov", "Not scored", "45", "Admission; Braden deferred, skin assessment limited"],
      ["15 Nov", "14", "45", "Sacral area noted; moderate risk"],
      ["16 Nov", "15", "40", "Mild risk"],
      ["17 Nov", "15", "40", "Discharge"],
    ],
    [60, 90, 100, 230],
  );
  w.h("Patient education record");
  w.table(
    ["Date", "Topic", "Method", "Learner", "Outcome"],
    [
      ["14 Nov", "Call light, fall prevention", "Verbal and written", "Patient", "Verbalized understanding"],
      ["14 Nov", "Fluid restriction and sodium", "Verbal", "Patient", "Verbalized understanding"],
      ["15 Nov", "Pressure injury prevention, repositioning", "Verbal and demonstration", "Patient", "Teach-back correct"],
      ["15 Nov", "New heart failure medication", "Verbal and written", "Patient", "Verbalized understanding"],
      ["16 Nov", "Daily weights", "Demonstration", "Patient", "Teach-back correct"],
      ["16 Nov", "Heart failure warning signs", "Verbal and written", "Patient", "Verbalized understanding"],
      ["17 Nov", "Medication list and insulin", "Verbal and written", "Patient", "Teach-back correct for insulin glargine; asked to review the sliding scale at the facility"],
      ["17 Nov", "Discharge instructions", "Verbal and written", "Patient", "Verbalized understanding"],
    ],
    [50, 150, 100, 55, 125],
  );
}

function respTherapy(w: Writer) {
  w.h("Oxygen therapy record");
  w.table(
    ["Date / time", "Device", "Flow", "SpO2", "Comment"],
    [
      ["14 Nov 14:20", "Room air", "-", "89%", "ED triage"],
      ["14 Nov 14:40", "Nasal cannula", "2 L/min", "94%", "Started in ED"],
      ["15 Nov 08:00", "Nasal cannula", "1 L/min", "95%", "Weaned"],
      ["16 Nov 03:00", "Room air", "-", "95%", "Weaned overnight"],
      ["16 Nov 14:00", "Room air, ambulating", "-", "93%", "With physical therapy"],
      ["17 Nov 18:15", "Room air", "-", "96%", "Discharge"],
    ],
    [100, 120, 70, 60, 130],
  );
}


function admissionDb(w: Writer) {
  w.section("Nursing Admission Database", "4 West - completed 14 Nov 2026 by J. Alvarez, RN with patient interview");
  w.h("Admission screening");
  w.table(
    ["Domain", "Finding"],
    [
      ["Arrival", "Stretcher from ED at 15:10; seated; 2 L nasal cannula"],
      ["Orientation", "Oriented to person, place, time; able to state reason for admission"],
      ["Language / interpreter", "English; none needed"],
      ["Hearing / vision", "Reading glasses; hearing adequate"],
      ["Dentition", "Natural teeth, upper partial denture; no chewing difficulty"],
      ["Swallow screen", "Passed - no cough or wet voice with 3 oz water"],
      ["Nutrition risk screen", "Low risk on arrival (MST 1); reports early satiety"],
      ["Elimination", "Last bowel movement 13 Nov; voiding with urgency"],
      ["Sleep", "Uses three pillows at home"],
      ["Falls", "Morse 45; one fall in the past year with no injury"],
      ["Pain", "0 out of 10"],
      ["Tobacco / alcohol / drugs", "Former smoker, quit 1995; none; none"],
      ["Mood screen", "PHQ-2 score 1"],
      ["Skin", "Limited by positioning, sacrum not visualized; see narrative"],
      ["Allergies verified", "Penicillin (rash); armband applied"],
      ["Valuables", "Phone charger, reading glasses, clothing; phone not brought"],
    ],
    [130, 350],
    8.8,
  );
  w.h("Home routine reported by patient");
  w.p("The patient reports that she checks her weight most mornings but has not written the values down for about two weeks. She sets out her pills weekly in a plastic organizer. She states she takes insulin glargine before bed and uses her sliding scale card with meals, checking her glucose before breakfast and dinner. She reports that her appetite had dropped over the past week and that she had been sleeping in a recliner because she could not lie flat.");
  w.h("Admission vital signs and measurements");
  w.kv([
    ["Temperature / pulse / respirations", "36.8 C / 104 irregular / 21"],
    ["Blood pressure", "142/84 right arm sitting"],
    ["SpO2", "94% on 2 L nasal cannula"],
    ["Height / bed scale weight", "163 cm / 73.9 kg"],
    ["Peripheral IV", "20 gauge left forearm placed in ED, flushes easily, site clean"],
  ], 180);
}

function handoffs(w: Writer) {
  w.section("Nursing Shift Hand-off Reports", "Structured report between shifts (illness severity, patient summary, action list, situation awareness, synthesis)");
  const hs: [string, string, string[]][] = [
    ["14 Nov 19:00 day to night", "Stable, watcher", ["Heart failure admission, diuresing, 2 L oxygen, strict I&O", "Glargine due 21:00; aspart per attached scale with glucose checks", "Skin assessment incomplete; sacrum to be examined with next turn", "Watch heart rate, notify for sustained rate above 120"]],
    ["15 Nov 07:00 night to day", "Stable", ["Net negative 570 mL overnight; one brief rapid rate episode, resolved", "Weight today; standing scale if able", "Cardiology and nephrology seeing the patient today", "Turn and complete full skin check this morning"]],
    ["15 Nov 19:00 day to night", "Stable", ["New sacral pressure injury, foam dressing applied, wound care ordered", "Sacubitril/valsartan first dose given 17:40; check blood pressure and dizziness", "Wean oxygen to room air if saturation holds", "Turn every two hours"]],
    ["16 Nov 07:00 night to day", "Stable", ["Room air since 03:00", "Weight and wound care visit today", "PT evaluation scheduled", "Potassium and creatinine drawn this morning"]],
    ["16 Nov 19:00 day to night", "Stable", ["Wound care saw patient; dressing replaced; recommendations in consult note", "Social work attempting to reach family; patient could not give a number", "Authorization submitted by case management", "Daily weight at 06:00 standing"]],
    ["17 Nov 07:00 night to day", "Stable", ["Standing weight 71.4 kg", "Oral furosemide starts today; stop IV dosing", "Possible discharge to skilled nursing facility this evening", "Pharmacist to reconcile medications"]],
    ["17 Nov 18:15 unit to receiving facility", "Stable", ["Report called to receiving facility nurse", "Last doses given: see discharge medication list", "Sacral dressing intact, wound stage 2", "Discharge 18:42; family not reached"]],
  ];
  for (const [t, sev, act] of hs) {
    w.h(t);
    w.p(`Illness severity: ${sev}.`, { keep: true });
    w.bullets(act);
  }
}

function therapyDaily(w: Writer) {
  w.section("Therapy Treatment Notes", "Physical and occupational therapy - daily treatment documentation");
  const rows: [string, string, string][] = [
    ["16 Nov 2026 14:00 PT treatment", "Gait 60 ft with rolling walker and contact guard x2 with seated rest; sit-to-stand x10 with armrests; SpO2 lowest 93% on room air; heart rate peak 96. Patient reported mild fatigue, no dizziness. Educated on pacing.", "Continue"],
    ["16 Nov 2026 15:30 OT treatment", "Seated grooming and lower body dressing practice with long-handled aids; minimum assist for socks and pants over feet; energy conservation handout given. Patient motivated.", "Continue"],
    ["17 Nov 2026 11:00 PT treatment", "Gait 100 ft with rolling walker and contact guard; standing balance activities with supervision; stairs deferred. SpO2 94% on room air at rest after activity, heart rate 92.", "Discharge to skilled nursing facility for ongoing therapy"],
    ["17 Nov 2026 12:15 OT treatment", "Toileting with contact guard; bathing technique review seated. Patient able to teach back three energy conservation strategies.", "Discharge to skilled nursing facility for ongoing therapy"],
  ];
  for (const [h, b, r] of rows) {
    w.h(h);
    w.p(b);
    w.p(`Recommendation: ${r}.`);
  }
  w.h("Therapy goals proposed for skilled nursing facility");
  w.table(
    ["Goal", "Target", "Timeframe"],
    [
      ["Ambulate 300 ft with rolling walker, supervision", "Supervision level", "2 weeks"],
      ["Transfers independent with walker", "Independent", "2 weeks"],
      ["Climb 4 stairs with rail", "Supervision", "3 weeks"],
      ["Lower body dressing", "Independent with adaptive aids", "2 weeks"],
      ["Energy conservation during ADLs", "Independent", "2 weeks"],
    ],
    [250, 130, 100],
    8.8,
  );
}

function hfEducation(w: Writer) {
  w.section("Heart Failure Patient Education Record", "Material reviewed with the patient and given in writing on 16-17 Nov 2026");
  w.h("What heart failure means");
  w.p("Heart failure means the heart muscle does not pump as strongly as it should, so fluid can build up in the lungs and legs. Your ejection fraction, a measure of how much blood the left side of the heart pumps with each beat, was 32% on the study done during this stay. A healthy heart pumps 55% or more. The aim of treatment is to remove extra fluid, protect the heart from further damage and keep you out of the hospital.");
  w.h("Daily self-care");
  w.bullets([
    "Weigh yourself every morning after you use the bathroom and before eating, in similar clothing, on the same scale. Write the number down. Your weight when you left the hospital was 71.4 kg.",
    "Call your care team if you gain more than 1 kg in a day or 2 kg in a week.",
    "Eat no more than 2 grams of sodium daily. Avoid canned soups, deli meats, frozen dinners and restaurant food where possible. Read labels; anything over 400 mg per serving is high.",
    "Limit fluids to 1.5 liters in 24 hours, which is about six 8-ounce cups.",
    "Take your medicines every day even when you feel well.",
    "Raise your legs when sitting. Report swelling that is getting worse.",
  ]);
  w.h("Your heart medications");
  w.p("Furosemide removes extra fluid and makes you urinate more; take it in the morning. Carvedilol slows and steadies the heart rate; stand up slowly. Sacubitril/valsartan is a new medicine that helps the heart pump more efficiently; it can lower your blood pressure and raise your potassium, which is why blood tests are needed within a week. Apixaban thins the blood to prevent clots that can cause stroke from atrial fibrillation; you will bruise more easily, and you should report black stools or blood in the urine. Amiodarone steadies the rhythm of the heart. Atorvastatin lowers cholesterol.");
  w.h("When to ask for help right away");
  w.bullets([
    "Shortness of breath at rest, needing to sleep sitting up, or waking up breathless",
    "Chest pain or pressure, fainting, or a very fast or pounding heartbeat",
    "Sudden weakness on one side, trouble speaking, or confusion",
    "Bleeding that does not stop, black or bloody stools, or vomiting blood",
    "A fall, especially with a hit to the head, because you take a blood thinner",
  ]);
  w.h("Diabetes while recovering");
  w.p("Blood sugar can go up when you are ill and down when you eat less. Insulin glargine is taken once daily at bedtime. Insulin aspart is taken with meals according to your sliding scale. Report shakiness, sweating, or confusion, which can be signs of low blood sugar, to the nurse right away. Do not skip meals after taking mealtime insulin.");
  w.h("Skin care and the sore on your tailbone");
  w.p("The sore on your lower back is called a pressure injury. It is caused by pressure and moisture on the skin. Shift your weight often, avoid sitting in one position for more than an hour, and keep the area clean and dry. Tell your nurse if the area becomes more painful, larger, or starts to drain.");
  w.p("Reviewed by J. Alvarez, RN, 17 Nov 2026 14:20. Patient verbalized understanding and answered teach-back questions correctly.", { size: 8.5 });
}

function hospitalCourse(w: Writer) {
  w.section("Hospital Course by Problem", "Hospital Medicine working summary for the receiving clinician - 17 Nov 2026 16:40");
  w.p("This working summary is provided in advance of the formal discharge summary, which is to follow.", { bold: true });
  w.h("1. Acute on chronic heart failure with reduced ejection fraction (EF 32%)");
  w.p("Admitted with a one-week history of progressive dyspnea, orthopnea and edema, 73.9 kg on admission, BNP 1,840. Treated with intravenous furosemide 40 mg twice daily with net negative balance of 570 mL, 1,620 mL, 1,200 mL and 900 mL on consecutive days. Oxygen was weaned off by early on 16 Nov. Weight at discharge was 71.4 kg, which the team considers the working dry weight. Sacubitril/valsartan 24/26 mg twice daily was started on 15 Nov after cardiology and nephrology review. Carvedilol was continued. Oral furosemide 40 mg daily replaced the intravenous dose on 17 Nov. Echocardiogram showed EF 32% with moderate functional mitral regurgitation. BNP on 16 Nov was 1,120.");
  w.h("2. Atrial fibrillation");
  w.p("Persistent atrial fibrillation with controlled ventricular rate, one transient rapid episode to 128 on the first night that resolved spontaneously. Continued carvedilol and amiodarone 200 mg daily. Apixaban 2.5 mg twice daily continued; cardiology confirmed the lower dose as intentional on 15 Nov in view of CKD 3b, anemia and fall risk.");
  w.h("3. Chronic kidney disease stage 3b");
  w.p("Creatinine stable between 1.5 and 1.6 mg/dL during diuresis and after starting sacubitril/valsartan. Potassium 4.4 to 4.7. Nephrology consulted. A repeat basic metabolic panel is requested in 7 days after discharge.");
  w.h("4. Type 2 diabetes mellitus, insulin requiring");
  w.p("Hemoglobin A1c 8.1%. Continued insulin glargine 18 units nightly and insulin aspart sliding scale with meals per attached scale. Pre-meal glucose 142 to 205 mg/dL. No hypoglycemia recorded during the admission.");
  w.h("5. Sacral pressure injury, stage 2");
  w.p("Noted by nursing on 15 Nov during morning care. Wound care consultation on 16 Nov documented a stage 2 pressure injury of the sacrum. Foam dressing and offloading continued. See nursing and wound care sections for details.");
  w.h("6. Anemia");
  w.p("Mild normocytic anemia, hemoglobin 10.6 to 10.8, stable. Transferrin saturation 19%. Outpatient evaluation suggested.");
  w.h("7. Function and disposition");
  w.p("Physical and occupational therapy recommend skilled nursing facility. The patient ambulates 100 ft with a rolling walker and contact guard assistance. Discharged 17 Nov 2026 at 18:42 by wheelchair van.");
  w.h("8. Items outstanding at transmission");
  w.bullets([
    "Discharge summary: to follow",
    "Signed physician order set: Orders: pending physician signature",
    "Prior authorization: authorization pending with payor",
    "Family contact: daughter unreachable, will follow up",
  ]);
}

function extraLabs(w: Writer) {
  w.h("Urinalysis and additional chemistry");
  w.table(
    ["Test", "Result", "Date", "Reference"],
    [
      ["Urinalysis - color / clarity", "Yellow / clear", "14 Nov", "-"],
      ["Urinalysis - protein", "1+", "14 Nov", "Negative"],
      ["Urinalysis - glucose", "Trace", "14 Nov", "Negative"],
      ["Urinalysis - blood / leukocytes / nitrite", "Negative / negative / negative", "14 Nov", "Negative"],
      ["Urine albumin / creatinine (mg/g)", "180", "15 Nov", "< 30"],
      ["Total cholesterol (mg/dL)", "168", "15 Nov", "< 200"],
      ["LDL (mg/dL)", "84", "15 Nov", "< 100"],
      ["HDL (mg/dL)", "44", "15 Nov", "> 40"],
      ["Triglycerides (mg/dL)", "178", "15 Nov", "< 150"],
      ["INR", "1.1", "14 Nov", "0.9 - 1.2"],
      ["Phosphorus (mg/dL)", "3.6", "15 Nov", "2.5 - 4.5"],
      ["Uric acid (mg/dL)", "7.1", "15 Nov", "2.5 - 6.2"],
    ],
    [200, 130, 70, 80],
    8.8,
  );
}

function telemetryLog(w: Writer) {
  w.h("Telemetry event log");
  const ev: string[][] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(new Date("2026-11-14T15:30:00").getTime() + i * 4.2 * 3600e3);
    ev.push([`${d.getDate()} Nov ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, i === 7 ? "AF with RVR 128, 40 seconds" : "AF, rate " + rint(68, 98), i === 7 ? "Self-resolved; physician notified" : "Reviewed, no action"]);
  }
  w.table(["Time", "Rhythm", "Action"], ev, [100, 180, 200], 8.8);
}

function ioHourly(w: Writer) {
  w.h("Intake and output by shift");
  w.table(
    ["Date / shift", "Oral (mL)", "IV flush / meds (mL)", "Urine (mL)", "Stool", "Net (mL)"],
    [
      ["14 Nov day", "420", "360", "1,350", "None", "-570"],
      ["14 Nov night", "360", "0", "1,100", "None", "-740"],
      ["15 Nov day", "620", "60", "1,420", "Type 4 x1", "-740"],
      ["15 Nov night", "480", "0", "1,000", "None", "-520"],
      ["16 Nov day", "700", "60", "1,300", "None", "-540"],
      ["16 Nov night", "510", "0", "1,000", "Type 4 x1", "-490"],
      ["17 Nov day", "640", "0", "1,050", "None", "-410"],
    ],
    [90, 60, 100, 70, 70, 60],
    8.8,
  );
}


function pharmacy(w: Writer) {
  w.section("Clinical Pharmacy Notes", "Inpatient pharmacy - Kavita Shah, PharmD");
  w.h("Admission medication history - 14 Nov 2026 19:30");
  w.p("Sources: patient interview, outpatient pharmacy fill history for the past twelve months, and the cardiology clinic medication list. Adherence: reports missing about one furosemide dose per week. All fills current within 30 days. Over-the-counter use: acetaminophen occasionally; denies NSAIDs, herbal supplements and aspirin.");
  w.h("Anticoagulation review - 15 Nov 2026 11:45");
  w.p("Apixaban 2.5 mg twice daily. Age 77, weight 71.4 to 73.9 kg, serum creatinine 1.6 mg/dL. Of the three labeling criteria for dose reduction (age 80 or older, weight 60 kg or less, creatinine 1.5 mg/dL or higher), the patient meets one. The prescriber has documented the reduced dose as a deliberate choice in view of CKD 3b, anemia and fall risk. No interacting medications requiring adjustment identified; amiodarone has a modest interaction that does not require a dose change. Hemoglobin stable at 10.6 to 10.8. Recommend that the receiving prescriber not change the dose without cardiology input.");
  w.h("Renal dosing review - 15 Nov 2026 12:10");
  w.p("Estimated creatinine clearance by Cockcroft-Gault approximately 35 mL/min using actual weight. Famotidine 20 mg once daily is appropriate for this level of renal function. Sacubitril/valsartan 24/26 mg twice daily is the appropriate low starting dose for eGFR in the 30s in a patient with no prior ACE inhibitor or ARB. No other renal dose adjustments needed. Avoid NSAIDs.");
  w.h("Insulin review - 16 Nov 2026 09:50");
  w.p("Insulin glargine 18 units nightly, unchanged from home. Insulin aspart sliding scale with meals, hospital protocol; the written scale is attached to the inpatient order. Glucose pre-meal values 142 to 212 mg/dL with no values below 70. A1c 8.1%. No adjustment recommended at this time. Patient demonstrates correct pen technique.");
  w.h("Discharge medication counseling - 17 Nov 2026 13:30");
  w.p("Reviewed each discharge medication with the patient: purpose, timing, common adverse effects. Provided a written list. New medication this admission: sacubitril/valsartan 24/26 mg twice daily, with counseling on dizziness, potassium and the need for a basic metabolic panel in about one week. The patient verbalized understanding. Pharmacy did not provide a signed prescription set; prescriptions and orders are the responsibility of the discharging physician.");
  w.p("Kavita Shah, PharmD. Electronically signed.", { size: 8.5 });
}

function dietFollow(w: Writer) {
  w.section("Dietitian Follow-up and Meal Intake Record", "Maya Ortiz, RD, LDN - 17 Nov 2026 10:20 and nursing meal records");
  w.h("Follow-up note");
  w.p("Patient eating 75% of meals on 17 Nov and accepting the oral nutrition supplement once daily. Weight 71.4 kg. Diet order unchanged: 2 g sodium cardiac, consistent carbohydrate, regular texture, thin liquids, fluid restriction 1.5 L per day. Swallow screen passed on admission with no concerns since. Educated again on sodium sources. Recommend the receiving facility continue the diet order and supplement and monitor weekly weights for nutritional adequacy in addition to daily fluid-related weights.");
  w.h("Meal intake record (percent consumed)");
  w.table(
    ["Date", "Breakfast", "Lunch", "Dinner", "Supplement", "Fluids (mL)"],
    [
      ["14 Nov", "-", "-", "50%", "-", "780"],
      ["15 Nov", "50%", "60%", "50%", "Declined", "1,240"],
      ["16 Nov", "60%", "75%", "70%", "Taken", "1,310"],
      ["17 Nov", "75%", "75%", "Not applicable", "Taken", "1,150"],
    ],
    [70, 80, 70, 100, 80, 80],
    9,
  );
  w.h("Nutrition diagnosis and goals");
  w.bullets([
    "Increased nutrient needs related to wound healing, evidenced by a stage 2 pressure injury",
    "Goal: consume at least 75% of meals and the supplement daily",
    "Goal: protein intake of 70 to 85 grams per day",
    "Goal: weight stable within 1 kg of the 71.4 kg dry weight without fluid reaccumulation",
  ]);
}

function cardiologyAddendum(w: Writer) {
  w.h("Cardiology day-of-discharge note, 17 Nov 2026 09:40");
  w.p("Weight 71.4 kg. Blood pressure 118/70, heart rate 76 in atrial fibrillation. Lungs clear. Trace ankle edema. Creatinine 1.6 and potassium 4.7 this morning. Medically ready for discharge from a cardiac standpoint. Continue sacubitril/valsartan 24/26 mg twice daily, carvedilol 6.25 mg twice daily, furosemide 40 mg daily, amiodarone 200 mg daily, apixaban 2.5 mg twice daily and atorvastatin 40 mg nightly. Daily weights. Repeat basic metabolic panel in about one week. Outpatient cardiology follow-up will be arranged by the clinic.");
}

function woundCare(w: Writer) {
  w.section("Wound Care Consultation", "Linda Park, RN, CWOCN - Wound/Ostomy/Continence Nurse - 16 Nov 2026 10:40");
  w.p("Reason for consultation: new sacral skin breakdown noted by nursing on 15 Nov 2026.");
  w.h("Findings");
  w.kv([
    ["Stage", "Stage 2 pressure injury (partial-thickness skin loss with exposed dermis)"],
    ["Site", "Sacrum, midline, slightly toward the left of the gluteal cleft"],
    ["Measurements", "3.0 cm length x 2.2 cm width x 0.1 cm depth"],
    ["Wound bed", "Pink-red, moist, no slough or eschar, no granulation tissue visible"],
    ["Exudate", "Scant serous"],
    ["Periwound", "Intact, blanchable erythema extending about 1 cm, no induration, no warmth"],
    ["Undermining / tunneling", "None"],
    ["Pain", "1 out of 10 with dressing removal"],
    ["Braden score", "15 (mild risk), moisture and mobility subscores limiting"],
  ]);
  w.h("Assessment");
  w.p("Stage 2 pressure injury of the sacrum, clean and without signs of local deterioration, in a patient with heart failure, peripheral edema, anemia and recent bed rest. The wound is expected to progress to healing with pressure redistribution and moisture control.");
  w.h("Recommendations and plan of care");
  w.p("The wound should be protected with a silicone-bordered foam dressing, replaced every three days and as needed if it becomes soiled or loose. The skin should be cleansed gently with saline at each dressing change and the periwound skin inspected. She should be repositioned at least every two hours when in bed using a 30-degree lateral tilt and should limit sitting in a chair to one hour at a time with a pressure-redistribution cushion. The head of bed should be kept at or below 30 degrees except for meals. Heels should be floated. Nutrition consult for protein intake was already placed. The wound should be reassessed weekly with measurements recorded, and the facility wound nurse should be notified for any increase in size, new drainage, odor, or exposed deeper tissue.", { keep: true });
  w.p("A standard foam mattress with a turning schedule is considered adequate; no specialty support surface or negative pressure device is needed at this time.");
  w.h("Measurement discussion");
  w.p("Today's measurements were taken with a disposable paper ruler with the patient in left lateral position, measuring the greatest length head to toe and greatest width perpendicular to it. The wound care nurse notes that bedside nursing recorded smaller values on 15 and 16 Nov; measurements were not repeated side by side.");
  w.p("Linda Park, RN, CWOCN. Electronically signed 16 Nov 2026 11:25.", { size: 8.5 });
}

const MAR_ROWS: string[][] = [
  ["Furosemide 40 mg IV", "BID", "-", "08:55 JA, 17:10 JA", "08:48 JA, 17:05 JA", "-"],
  ["Furosemide 40 mg PO", "Daily", "-", "-", "-", "09:00 JA"],
  ["Carvedilol 6.25 mg PO", "BID", "17:45 JA", "08:50 JA, 17:40 JA", "08:42 JA, 17:35 JA", "08:55 JA, 17:30 JA"],
  ["Apixaban 2.5 mg PO", "BID", "21:00 TN", "08:50 JA, 20:55 TN", "08:42 JA, 20:50 RO", "08:55 JA, 17:30 JA"],
  ["Amiodarone 200 mg PO", "Daily", "-", "08:50 JA", "08:42 JA", "08:55 JA"],
  ["Atorvastatin 40 mg PO", "Nightly", "21:00 TN", "21:00 TN", "21:00 RO", "-"],
  ["Famotidine 20 mg PO", "Daily", "-", "08:50 JA", "08:42 JA", "08:55 JA"],
  ["Sacubitril/valsartan 24/26 mg PO", "BID", "-", "17:40 JA", "08:42 JA, 20:50 RO", "08:55 JA, 17:30 JA"],
  ["Senna 8.6 mg PO", "Nightly", "21:00 TN", "21:00 TN", "21:00 RO", "-"],
  ["Docusate 100 mg PO", "BID", "21:00 TN", "08:50 JA, 21:00 TN", "08:42 JA, 21:00 RO", "08:55 JA, 17:30 JA"],
  ["Insulin glargine 18 units SC", "Nightly", "21:10 TN", "21:05 TN", "21:00 RO", "-"],
  ["Insulin aspart sliding scale SC", "AC and HS, per attached scale", "18:00 JA, 21:10 TN", "07:30, 11:45, 17:15, 21:05", "07:30, 11:40, 17:10, 21:00", "07:35, 11:50, 17:10"],
  ["Acetaminophen 500 mg PO", "PRN", "-", "-", "14:20 JA", "-"],
];

function mar(w: Writer) {
  w.section("Medication Administration Record - Inpatient", "14 Nov 2026 to 17 Nov 2026 - times shown are administration times; initials of administering nurse");
  w.p("This MAR is the inpatient administration record. The discharge medication list follows on the next page. Sliding-scale insulin was administered according to the hospital protocol attached to the inpatient order; the attached scale is not reproduced in this section.", { size: 8.8 });
  w.table(["Medication", "Frequency", "14 Nov", "15 Nov", "16 Nov", "17 Nov"], MAR_ROWS, [150, 70, 60, 85, 85, 80], 7.6);
  w.p("Legend: JA = J. Alvarez RN, TN = T. Nguyen RN, RO = R. Okafor RN. Held doses: none. Refused doses: none. Allergies reviewed at each administration: penicillin.", { size: 8.5 });
  w.h("Pharmacist reconciliation comment, 17 Nov 2026 13:30");
  w.p("Admission medication history confirmed with the patient and outpatient pharmacy fill history. New this admission: sacubitril/valsartan 24/26 mg twice daily. Changed: none. Stopped: none. Apixaban 2.5 mg twice daily confirmed as the intended dose by cardiology on 15 Nov. Insulin glargine 18 units nightly unchanged from home dose.");
}

function dischargeMeds(w: Writer) {
  w.section("Discharge Medication List", "Medication reconciliation for transfer to skilled nursing facility - 17 Nov 2026");
  w.kv([
    ["Patient weight", "71.4 kg"],
    ["Allergies", "Penicillin (rash)"],
    ["Orders", "Orders: pending physician signature"],
  ], 110);
  w.p("Orders: pending physician signature. The list below is the reconciled discharge medication list and does not constitute a signed order set. A signed physician order set was not available at the time of transmission.", { keep: true });
  w.table(
    ["Medication", "Dose / route", "Frequency", "Indication", "Last given", "Next due"],
    [
      [MEDS_DC.entresto, "24/26 mg PO", "BID", "Heart failure", "17 Nov 17:30", "18 Nov 08:00"],
      ["Furosemide 40 mg", "40 mg PO", "Daily", "Heart failure, volume", "17 Nov 09:00", "18 Nov 08:00"],
      ["Carvedilol 6.25 mg", "6.25 mg PO", "BID", "Heart failure, rate control", "17 Nov 17:30", "18 Nov 08:00"],
      [MEDS_DC.apixaban, "2.5 mg PO", "BID", "Atrial fibrillation, stroke prevention", "17 Nov 17:30", "18 Nov 08:00"],
      ["Amiodarone 200 mg", "200 mg PO", "Daily", "Atrial fibrillation", "17 Nov 08:55", "18 Nov 08:00"],
      ["Atorvastatin 40 mg", "40 mg PO", "Nightly", "Hyperlipidemia", "16 Nov 21:00", "17 Nov 21:00"],
      [MEDS_DC.glargine, "18 units SC", "Nightly at bedtime", "Type 2 diabetes", "16 Nov 21:00", "17 Nov 21:00"],
      ["Insulin aspart sliding scale", "SC, per attached scale", "With meals and at bedtime", "Type 2 diabetes", "17 Nov 17:10", "With next meal"],
      ["Famotidine 20 mg", "20 mg PO", "Daily", "Gastric protection", "17 Nov 08:55", "18 Nov 08:00"],
      ["Senna 8.6 mg", "8.6 mg PO", "Nightly", "Constipation prevention", "16 Nov 21:00", "17 Nov 21:00"],
      ["Docusate 100 mg", "100 mg PO", "BID", "Constipation prevention", "17 Nov 17:30", "18 Nov 08:00"],
    ],
    [130, 85, 75, 110, 70, 70],
    8,
  );
  w.h("Notes on specific medications");
  w.bullets([
    "Sacubitril/valsartan is new this admission. Do not combine with an ACE inhibitor. Potassium and creatinine to be rechecked within one week.",
    "Insulin aspart is to be given as a sliding scale per attached scale, with meals and at bedtime. Glucose is checked before meals and at bedtime.",
    "Apixaban 2.5 mg twice daily is the intended dose, set by cardiology. Do not change the dose without cardiology input.",
    "Carvedilol: hold for heart rate below 55 or systolic blood pressure below 95 per cardiology recommendation.",
    "Daily weights every morning; discharge weight 71.4 kg.",
  ]);
  w.h("Discontinued / not continued");
  w.p("Intravenous furosemide discontinued on 17 Nov 2026 (replaced by oral furosemide). Acetaminophen 500 mg as needed was used inpatient once and is not on the discharge list.");
}

function ptot(w: Writer) {
  w.section("Physical and Occupational Therapy Evaluation", "Daniel Cho, PT, DPT and Rhea Dalton, OTR/L - 16 Nov 2026");
  w.h("Physical therapy initial evaluation");
  w.kv([
    ["Referral", "Evaluate and treat, post-acute disposition recommendation"],
    ["Precautions", "Fall risk; monitor heart rate and SpO2 with activity; sacral wound, avoid prolonged sitting"],
    ["Weight-bearing status", "Full weight bearing on both lower extremities, no restrictions"],
    ["Prior level of function", "Independent with ambulation without an assistive device and independent with basic activities of daily living until about six weeks before admission. Over the last six weeks, she reduced her walking distance because of dyspnea and began using furniture for support. Independent with bathing and dressing, drove short distances, and managed her own medications."],
    ["Cognition", "Alert and oriented; follows multi-step commands; good safety awareness"],
    ["Strength", "Lower extremities 4/5 bilaterally, trunk strength fair"],
    ["Balance", "Berg Balance Scale 38 of 56; moderate fall risk"],
  ], 130);
  w.table(
    ["Mobility task", "Level of assistance", "Comment"],
    [
      ["Bed mobility", "Supervision", "Increased time, uses rail"],
      ["Sit to stand", "Contact guard", "Rises with push-off, mild unsteadiness"],
      ["Transfer bed to chair", "Contact guard", "Rolling walker"],
      ["Gait", "Contact guard, 60 ft with rolling walker", "SpO2 93% at end of walk, heart rate 92"],
      ["Stairs", "Not tested", "Deferred due to fatigue"],
    ],
    [130, 170, 180],
  );
  w.h("Physical therapy assessment and recommendation");
  w.p("Deconditioning related to acute heart failure with decreased endurance, balance and gait tolerance. Good rehabilitation potential given a high prior level of function. She will benefit from skilled physical therapy five days a week at a skilled nursing facility focused on endurance, gait training with a rolling walker, balance and stair training. Anticipated length of rehabilitation 14 to 21 days. No specialty equipment needs identified; a standard rolling walker is sufficient.");
  w.h("Occupational therapy initial evaluation");
  w.kv([
    ["Basic ADLs", "Grooming: setup. Upper body dressing: setup. Lower body dressing: minimum assist. Toileting: contact guard. Bathing: minimum assist, seated."],
    ["Vision / hearing", "Glasses for reading; hearing adequate"],
    ["Upper extremity function", "Within functional limits; grip strength reduced bilaterally"],
    ["Cognition", "No deficits noted on a brief screen; manages a pill organizer"],
  ], 130);
  w.p("Assessment: decline in self-care related to fatigue and dyspnea with exertion. Recommend skilled occupational therapy for energy conservation, lower body dressing and bathing techniques, with a goal of independence with basic ADLs. Speech-language pathology evaluation was not requested; the patient passed the nursing swallow screen and has no communication concerns.");
  w.h("PT follow-up, 17 Nov 2026 11:20");
  w.p("Ambulated 100 ft with rolling walker and contact guard, SpO2 94% on room air at the end of the walk. Transfers with contact guard. Tolerated education on energy conservation and pacing. Recommendation unchanged.");
  w.p("Daniel Cho, PT, DPT; Rhea Dalton, OTR/L. Electronically signed 16 Nov 2026 15:10; follow-up signed 17 Nov 2026 11:35.", { size: 8.5 });
}

function dietitian(w: Writer) {
  w.section("Dietitian / Nutrition Note", "Maya Ortiz, RD, LDN - 16 Nov 2026 13:15");
  w.h("Nutrition assessment");
  w.kv([
    ["Height / weight", "163 cm / 72.1 kg on 16 Nov (71.4 kg on 17 Nov)"],
    ["BMI", "26.9 kg/m2 at admission weight 73.9 kg (fluid overloaded); approximately 26.9 at 71.4 kg"],
    ["Appetite", "Fair to good; eats 50 to 75% of meals"],
    ["Weight history", "Reports usual weight of about 70 kg before this illness"],
    ["Labs", "Albumin 3.3 g/dL, A1c 8.1%, potassium 4.5, creatinine 1.5"],
    ["Skin", "Stage 2 pressure injury of the sacrum noted"],
  ], 110);
  w.h("Diet order and swallow screen");
  w.p("Current diet order: 2 g sodium cardiac diet, consistent carbohydrate, with fluid restriction 1.5 L per day. Regular texture, thin liquids. The bedside swallow screen performed by nursing on 14 Nov 2026 was passed: no coughing, wet voice or pocketing with 3 oz of water and a graham cracker. No dysphagia symptoms reported and none observed during meals. A formal speech-language swallow evaluation was not indicated.", { keep: true });
  w.h("Assessment");
  w.p("Increased protein needs related to a stage 2 pressure injury and CKD 3b with moderate protein targets. Estimated needs: energy 1,800 kcal per day, protein 70 to 85 grams per day (about 1.0 to 1.2 g/kg), fluid 1.5 L per day. Sodium and carbohydrate restrictions conflict somewhat with patient preferences; she reports enjoying soups and sweets.");
  w.h("Interventions and recommendations");
  w.bullets([
    "Continue 2 g sodium cardiac, consistent carbohydrate diet with regular texture and thin liquids, and fluid restriction of 1.5 L per day.",
    "Oral nutrition supplement, a diabetes-appropriate formula, once daily between meals to support wound healing.",
    "Weigh daily at the same time with the same scale; chart weight and report gains.",
    "Education given on sodium sources in canned and restaurant foods. Patient demonstrated understanding using teach-back.",
    "Multivitamin with minerals not added; reviewed with the pharmacist, deferred in the context of CKD.",
  ]);
  w.p("Maya Ortiz, RD, LDN. Electronically signed 16 Nov 2026 13:50.", { size: 8.5 });
}

function labs(w: Writer) {
  w.section("Laboratory Results", "Core laboratory - 14 Nov 2026 to 17 Nov 2026");
  w.h("Basic metabolic panel");
  w.table(
    ["Test (units)", "14 Nov 14:40", "15 Nov 05:30", "16 Nov 05:25", "17 Nov 05:40", "Reference"],
    [
      ["Sodium (mmol/L)", "137", "138", "139", "138", "135 - 145"],
      ["Potassium (mmol/L)", "4.6", "4.4", "4.5", "4.7", "3.5 - 5.1"],
      ["Chloride (mmol/L)", "101", "99", "100", "100", "98 - 107"],
      ["Bicarbonate (mmol/L)", "23", "24", "26", "26", "22 - 29"],
      ["BUN (mg/dL)", "38", "36", "34", "35", "7 - 20"],
      ["Creatinine (mg/dL)", "1.6", "1.6", "1.5", "1.6", "0.5 - 1.1"],
      ["eGFR (mL/min/1.73 m2)", "33", "34", "36", "34", "> 60"],
      ["Glucose (mg/dL)", "214", "182", "151", "142", "70 - 99"],
      ["Calcium (mg/dL)", "8.9", "8.8", "9.0", "9.1", "8.6 - 10.2"],
      ["Magnesium (mg/dL)", "2.0", "2.0", "2.1", "2.1", "1.7 - 2.2"],
    ],
    [120, 70, 70, 70, 70, 80],
  );
  w.h("Complete blood count");
  w.table(
    ["Test (units)", "14 Nov", "15 Nov", "16 Nov", "17 Nov", "Reference"],
    [
      ["WBC (10^3/uL)", "7.4", "7.0", "6.8", "6.9", "4.0 - 11.0"],
      ["Hemoglobin (g/dL)", "10.8", "10.6", "10.7", "10.8", "12.0 - 15.5"],
      ["Hematocrit (%)", "33.1", "32.6", "32.9", "33.2", "36 - 46"],
      ["MCV (fL)", "89", "89", "90", "89", "80 - 100"],
      ["Platelets (10^3/uL)", "214", "208", "211", "216", "150 - 400"],
    ],
    [120, 70, 70, 70, 70, 80],
  );
  w.h("Cardiac and other chemistry");
  w.table(
    ["Test (units)", "Result", "Date", "Reference"],
    [
      ["BNP (pg/mL)", "1,840", "14 Nov", "< 100"],
      ["BNP (pg/mL)", "1,120", "16 Nov", "< 100"],
      ["hs-Troponin (ng/L)", "22, 24", "14 Nov", "< 14"],
      ["Hemoglobin A1c (%)", "8.1", "16 Nov", "< 7.0"],
      ["Albumin (g/dL)", "3.3", "16 Nov", "3.5 - 5.0"],
      ["TSH (mIU/L)", "2.4", "14 Nov", "0.4 - 4.0"],
      ["Ferritin (ng/mL)", "142", "15 Nov", "15 - 150"],
      ["Transferrin saturation (%)", "19", "15 Nov", "20 - 50"],
      ["AST / ALT (U/L)", "24 / 22", "14 Nov", "< 40"],
    ],
    [160, 90, 90, 100],
  );
  w.h("Laboratory narrative and requested follow-up");
  w.p("Creatinine remained at baseline throughout admission (1.5 to 1.6 mg/dL) with potassium 4.4 to 4.7 mmol/L after initiation of sacubitril/valsartan on 15 Nov. A BMP is requested in 7 days to recheck potassium and creatinine on the new regimen and oral furosemide, per the discharge plan.", { keep: true });
  w.p("Iron studies show mildly reduced transferrin saturation consistent with anemia of chronic disease; outpatient evaluation suggested. No cultures were obtained during this admission.");
  extraLabs(w);
  w.p("Core laboratory. Results verified electronically.", { size: 8.5 });
}

function diagnostics(w: Writer) {
  w.section("Diagnostic Reports", "Echocardiogram, electrocardiogram, chest radiograph");
  w.h("Transthoracic echocardiogram - 14 Nov 2026 16:50");
  w.p("Indication: acute heart failure. Technically adequate. Left ventricle mildly dilated with global hypokinesis. Estimated ejection fraction 32% by biplane method. Mild concentric hypertrophy. Left atrium moderately dilated. Moderate functional mitral regurgitation. Mild tricuspid regurgitation, estimated right ventricular systolic pressure 44 mmHg. Right ventricular size normal with mildly reduced function. Small circular pericardial effusion without tamponade physiology. Inferior vena cava dilated with reduced collapse.");
  w.p("Impression: Reduced left ventricular systolic function, EF 32%, similar to or slightly worse than prior study (35%, 2025). Moderate functional mitral regurgitation.");
  w.h("Electrocardiogram - 14 Nov 2026 14:32");
  w.p("Atrial fibrillation, ventricular rate 104. Left axis deviation. QRS duration 104 ms, QTc 452 ms. Nonspecific ST-T wave abnormalities, no acute ischemic changes. Unchanged compared with 2025 tracing.");
  w.h("Chest radiograph, portable AP - 14 Nov 2026 14:55");
  w.p("Cardiomegaly. Pulmonary vascular congestion with interstitial edema. Small bilateral pleural effusions, right greater than left. No focal consolidation. No pneumothorax.");
  w.p("Follow-up chest radiograph - 16 Nov 2026 08:10: improved aeration, decreased interstitial edema, small residual effusions.");
  telemetryLog(w);
  w.h("Telemetry summary - 14 to 17 Nov 2026");
  w.p("Atrial fibrillation throughout with ventricular rate 68 to 128. One episode of transient rapid ventricular response to 128 on 14 Nov at 23:10, self-resolved. No pauses greater than 2.0 seconds. No sustained ventricular tachycardia. Telemetry discontinued at discharge.");
}

function socialWork(w: Writer) {
  w.section("Social Work Assessment", "Tomas Reyes, LCSW - 16 Nov 2026 15:45");
  w.h("Reason for assessment");
  w.p("Psychosocial assessment and discharge planning support for a 77-year-old widowed patient being discharged to a skilled nursing facility.");
  w.h("Social situation");
  w.p("Patient is a retired school administrator who has lived independently since the death of her husband in 2019. She reports that she has a daughter who lives out of state and a sister in a neighboring city with whom she speaks occasionally. She was unable to give a current telephone number for either person and said the numbers are in her phone, which was not brought to the hospital. She has not designated anyone to act for her in medical or financial matters.");
  w.h("Contact attempts");
  w.table(
    ["Date / time", "Attempt", "Result"],
    [
      ["16 Nov 16:20", "Telephone call to the number registered in a prior encounter for the daughter", "No answer; voicemail box full"],
      ["16 Nov 17:05", "Second call to the same number", "No answer"],
      ["17 Nov 10:30", "Third call to the same number", "No answer; no voicemail"],
    ],
    [90, 260, 130],
  );
  w.p("Daughter unreachable, will follow up. Social work will continue to attempt contact and will notify the receiving facility's social services department if a contact is reached. No responsible party has been identified at this time. The patient states that she makes her own decisions.", { keep: true });
  w.h("Functional and emotional status");
  w.p("Mood euthymic, affect appropriate. PHQ-2 score 1. Patient is worried about the cost of the skilled nursing facility stay and about whether she will be able to return to her prior independence. She has no history of psychiatric treatment. No substance use. No safety concerns identified. She expresses willingness to go to a skilled nursing facility for rehabilitation.");
  w.h("Plan");
  w.bullets([
    "Continue attempts to reach the patient's family.",
    "Provide the receiving facility with any contact information obtained.",
    "Review benefits and financial responsibility with the receiving facility's business office.",
    "Patient provided with information about the Long-Term Care Ombudsman.",
  ]);
  w.p("Tomas Reyes, LCSW. Electronically signed 16 Nov 2026 16:30; addendum 17 Nov 2026 10:40.", { size: 8.5 });
}

function dcPlanning(w: Writer) {
  w.section("Discharge Planning Checklist", "Case management - 17 Nov 2026");
  w.table(
    ["Item", "Status", "Comment"],
    [
      ["Discharge order written", "[X] Complete", "Discharge date 17 Nov 2026, time 18:42"],
      ["Medical stability confirmed by attending", "[X] Complete", "Dr. Raman, 17 Nov 2026"],
      ["Receiving facility bed accepted", "[X] Complete", "Admission accepted for the evening of 17 Nov"],
      ["Transport arranged", "[X] Complete", "Wheelchair van, pickup at the 4 West entrance, patient departs 18:42"],
      ["Estimated arrival at facility", "[X] Complete", "Estimated arrival 20:40 on 17 Nov 2026"],
      ["Nurse-to-nurse report", "[X] Complete", "Called 18:15"],
      ["Medication reconciliation", "[X] Complete", "Pharmacist, 17 Nov 13:30"],
      ["Discharge medication list printed", "[X] Complete", "Orders: pending physician signature"],
      ["Physician order set signed", "[ ] Not complete", "Pending physician signature"],
      ["Discharge summary", "[ ] Not complete", "To follow"],
      ["Prior authorization", "[ ] Not complete", "Authorization pending with payor"],
      ["Family or responsible party notified", "[ ] Not complete", "Daughter unreachable, will follow up (social work)"],
      ["Patient belongings returned", "[X] Complete", "Glasses, phone charger, clothing"],
      ["Patient and family education", "[X] Complete", "Heart failure self-care, daily weights, diet, wound care, insulin, fall prevention"],
      ["Equipment needs", "[X] Complete", "None identified"],
    ],
    [190, 90, 200],
  );
  w.h("Discharge instructions given to patient (summary)");
  w.bullets([
    "Weigh every morning after voiding and before breakfast. Report a gain of more than 1 kg in one day.",
    "Follow a 2 g sodium diet and a 1.5 L daily fluid limit.",
    "Take all medications as listed. Do not stop sacubitril/valsartan, apixaban or insulin without talking to the physician.",
    "Change position often; keep weight off the tailbone when seated.",
    "Report new shortness of breath, chest pain, bleeding, black stools or dizziness right away.",
  ]);
  w.h("Transfer summary");
  w.kv([
    ["Discharge date / time", "17 Nov 2026, 18:42"],
    ["Mode of transport", "Wheelchair van with one attendant"],
    ["Estimated arrival", "20:40, 17 Nov 2026"],
    ["Condition at discharge", "Stable. Vitals 17 Nov 18:15: BP 118/70, HR 76, RR 16, SpO2 96% on room air, T 36.8 C"],
    ["Weight", "71.4 kg"],
    ["Diet", "2 g sodium cardiac, consistent carbohydrate, thin liquids, 1.5 L fluid restriction"],
    ["Activity", "As tolerated with rolling walker and contact guard assistance"],
  ], 140);
}

function immunizations(w: Writer) {
  w.section("Immunization Record", "State immunization registry query and patient report - 15 Nov 2026");
  w.table(
    ["Vaccine", "Date given", "Source", "Comment"],
    [
      ["Influenza, high-dose, 2026-2027", "10/08/2026", "Registry", "Seasonal"],
      ["COVID-19 mRNA, 2025-2026 formula", "10/15/2025", "Registry", ""],
      ["Pneumococcal conjugate PCV20", "06/03/2023", "Registry", "Single dose complete"],
      ["Tetanus, diphtheria, pertussis (Tdap)", "05/21/2019", "Registry", "Td booster due 2029"],
      ["Zoster recombinant (Shingrix) dose 1", "04/12/2022", "Registry", ""],
      ["Zoster recombinant (Shingrix) dose 2", "07/19/2022", "Registry", "Series complete"],
      ["RSV vaccine", "09/22/2025", "Registry", "Single dose"],
    ],
    [190, 80, 70, 140],
  );
  w.p("Immunization history reconciled with the state registry and the patient's report. No vaccines were administered during this hospitalization.");
}

// ---------------------------------------------------------------- build

async function build(): Promise<Uint8Array> {
  const w = await Writer.create();
  w.newPage(); // page 1: cover, filled in last once section start pages are known
  faceSheet(w);
  insurance(w);
  caseMgmt(w);
  edNote(w);
  hAndP(w);
  cardiology(w);
  nephrology(w);
  progressNotes(w);
  hospitalCourse(w);
  nursing(w);
  nursingFlow(w);
  admissionDb(w);
  handoffs(w);
  respTherapy(w);
  ioHourly(w);
  woundCare(w);
  mar(w);
  marLog(w);
  dischargeMeds(w);
  pharmacy(w);
  ptot(w);
  therapyDaily(w);
  dietitian(w);
  dietFollow(w);
  labs(w);
  diagnostics(w);
  socialWork(w);
  dcPlanning(w);
  hfEducation(w);
  immunizations(w);
  cover(w, 0);

  const n = w.pages.length;
  w.pages.forEach((pg, i) => {
    pg.drawText(HOSPITAL, { x: MX, y: PH - 38, size: 11, font: w.bold });
    pg.drawText("Electronic Health Record - Print", { x: PW - MX - w.font.widthOfTextAtSize("Electronic Health Record - Print", 8.5), y: PH - 37, size: 8.5, font: w.font });
    pg.drawText(PATIENT_LINE, { x: MX, y: PH - 52, size: 8.5, font: w.font });
    pg.drawLine({ start: { x: MX, y: PH - 58 }, end: { x: PW - MX, y: PH - 58 }, thickness: 0.8, color: rgb(0.2, 0.2, 0.2) });
    pg.drawLine({ start: { x: MX, y: 48 }, end: { x: PW - MX, y: 48 }, thickness: 0.4, color: rgb(0.5, 0.5, 0.5) });
    pg.drawText(`Page ${i + 1} of ${n}`, { x: PW - MX - 60, y: 36, size: 8.5, font: w.font });
    pg.drawText("CONFIDENTIAL - synthetic test data, not a real patient record", { x: MX, y: 36, size: 8, font: w.font });
  });
  return w.pdf.save();
}

// ---------------------------------------------------------------- self-check

const FORBIDDEN: [string, RegExp][] = [
  ["PASRR", /PASRR|pre-?admission screening|level (i|ii)\b/i],
  ["MOLST/POLST/directive/DNR", /MOLST|POLST|advance directive|\bDNR\b|full code|do not resuscitate/i],
  ["isolation / MDRO status", /isolation|MDRO|MRSA|\bVRE\b|C\. ?diff|contact precautions|multidrug/i],
  ["insulin correction scale", /correction scale|correction factor|glucose range|BG range|scale (table|below)/i],
  ["scale dose table markers", /\d{2,3}\s*(-|to)\s*\d{2,3}\s*(mg\/dL)?\s*[:=|]?\s*\d+\s*units/i],
  ["trach/vent/dialysis/elopement", /trach|ventilator|dialysis|elopement|wander/i],
  ["PCP / appointments", /primary care|\bPCP\b|appointment/i],
];
const REQUIRED: [string, RegExp][] = [
  ["authorization pending", /authorization pending/i],
  ["payor name", /Northbridge Health Plan/],
  ["71.4", /71\.4 kg/],
  ["apixaban 2.5", /apixaban 2\.5 mg/i],
  ["sliding scale reference", /per attached scale/i],
  ["glargine 18 units", /glargine 18 units/i],
  ["Entresto", /sacubitril\/valsartan \(Entresto\) 24\/26/i],
  ["orders pending", /Orders: pending physician signature/],
  ["discharge summary to follow", /Discharge summary\s+to follow/i],
  ["BMP in 7 days narrative", /BMP is requested in 7 days/],
  ["arrival 20:40", /20:40 on 17 Nov 2026/],
  ["discharge 18:42", /18:42/],
  ["daughter unreachable", /daughter unreachable, will follow up/i],
  ["EF 32%", /EF 32%/],
  ["stage 2 sacral", /stage 2 pressure injury/i],
  ["swallow screen", /swallow screen/i],
  ["weight bearing", /weight bearing/i],
  ["prior level of function", /prior level of function/i],
];

async function selfCheck(bytes: Uint8Array): Promise<boolean> {
  const pages = await extractPages(bytes);
  const all = pages.map((p) => p.text).join("\n");
  const failures: string[] = [];
  const ok = (name: string, pass: boolean, detail = "") => {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
    if (!pass) failures.push(name);
  };
  ok("page count 50-65", pages.length >= 50 && pages.length <= 65, `(${pages.length} pages)`);
  ok("header on every page", pages.every((p) => p.text.includes(HOSPITAL) && p.text.includes("MRN RG-884512") && p.text.includes("DOB 03/14/1949")));
  ok("page numbers on every page", pages.every((p, i) => p.text.includes(`Page ${i + 1} of ${pages.length}`)));
  for (const [name, re] of FORBIDDEN) {
    const m = all.match(re);
    ok(`absent: ${name}`, !m, m ? `found "${m[0]}"` : "");
  }
  ok("code status mentioned once, no result", (all.match(/code status/gi) ?? []).length === 1);
  for (const [name, re] of REQUIRED) ok(`present: ${name}`, re.test(all));
  const empty = pages.filter((p) => p.text.length < 220).map((p) => p.pageNumber);
  ok("no near-empty pages", empty.length === 0, empty.length ? `pages ${empty.join(",")}` : "");
  console.log(failures.length ? `\nSELF-CHECK FAILED (${failures.length}): ${failures.join("; ")}` : `\nSELF-CHECK PASSED (${pages.length} pages)`);
  return failures.length === 0;
}

const bytes = await build();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, bytes);
console.log(`wrote ${OUT} (${(bytes.length / 1024).toFixed(0)} KB)`);
process.exit((await selfCheck(bytes)) ? 0 : 1);
