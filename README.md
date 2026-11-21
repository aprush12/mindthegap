# mindthegap

Mind the Gap screens a roughly 60-page hospital-to-SNF referral packet (PDF) against the acceptance policies of three synthetic skilled nursing facilities: Bayview (A), Harborview (B) and Maple Grove (C). The output is a fixed-length, auditable checklist of 43 rules per facility, a verdict (accept, conditional accept, blocked, decline), and a worklist of items on a clock with computed resolve-by timestamps.

The design splits the work in two. An LLM extraction layer (stage 4) answers 43 facility-agnostic questions about the record once, citing the page and quote for each answer. A deterministic, pure-TypeScript engine then evaluates those answers against each facility's policy and tonight's capacity. The LLM never decides admissibility; the engine does. The source of truth for the rules is [docs/facility-acceptance-spec.md](docs/facility-acceptance-spec.md).

> **PHI WARNING. Never commit patient packets.** `samples/` and `data/` are gitignored; keep every packet and parse result inside them. Using this with real patient data requires a HIPAA Business Associate Agreement (BAA) with Anthropic. The facilities, formularies and thresholds in this repo are synthetic.

## Setup

```bash
npm install
cp .env.example .env     # ANTHROPIC_API_KEY, PORT, ANTHROPIC_MODEL (not used until stage 4)
npm run dev              # http://localhost:3000
npm test                 # engine + golden test (no network)
npm run build            # tsc -> dist/
npm run parse            # stub until stage 4
```

Node 20+. Stack: Hono, Zod, TypeScript (strict, ESM), Vitest.

## API contract

All bodies are JSON unless noted. Stage 1 ships the facility endpoints; the parse endpoints return `501 {"error":"pipeline lands in a later stage"}` until stage 4 but their shape is fixed here so the UI can build against it.

| Method and path | Purpose |
|---|---|
| `GET /health` | `200 {"ok":true}` |
| `GET /api/facilities` | Array of facility profiles (see Policy and capacity data) |
| `GET /api/facilities/:id` | One profile (`A`, `B`, `C`) plus its current `capacity` snapshot |
| `PUT /api/facilities/:id/capacity` | Replace that facility's capacity snapshot. Body validated against the capacity schema (`src/policy/schema.ts`); `400` with `issues` on failure. Persists to `src/capacity/snapshot.json` |
| `POST /api/parses` | (future) `multipart/form-data`, field `packet` = PDF. `202 {"id": "...", "status": "processing"}` |
| `GET /api/parses/:id` | (future) Full result, shape below. While `status` is `processing`, only `id`, `status`, `progress` are present |
| `GET /api/parses/:id/summary` | (future) Compact row per facility for the list view |
| `GET /api/parses/:id/document/:page` | (future) `{ "page": 12, "text": "..." }` for citation highlighting (1-based page) |

### Result shape (`GET /api/parses/:id`)

```jsonc
{
  "id": "string",
  "status": "processing | complete | failed",
  "createdAt": "ISO timestamp",
  "document": { "filename": "string", "pages": 60 },
  "extraction": {                      // what the LLM layer answered, input to the engine
    "answers": [{
      "ruleId": "PAY-01", "answered": true, "value": { "status": "pending" },
      "evidence": [{ "quote": "...", "claimedPage": 12, "page": 12, "startOffset": 0, "endOffset": 40, "sectionId": "...", "verified": true }],
      "contradictions": [{ "quoteA": "...", "pageA": 3, "quoteB": "...", "pageB": 41, "note": "..." }]
    }],
    "medications": [{ "name": "...", "dose": "...", "route": "...", "schedule": "...", "firstDoseDue": "ISO", "controlled": false, "hardCopyPresent": false, "correctionScale": false }],
    "timing": { "dischargeAt": "ISO", "arrivalAt": "ISO" },
    "patient": { "weightKg": 71.4, "targetUnit": "complex_medical", "medicaidPending": false, "tubeFed": false, "insulinRequired": true }
  },
  "facilities": {
    "A": {                              // same shape for "B" and "C"
      "facilityId": "A",
      "verdict": "accept | conditional_accept | blocked | decline",
      "blocking":    [Item], "conditional": [Item], "review": [Item],
      "firstDoseAtRisk": true,
      "checklist": [Item],              // always exactly 43, rule order, includes met and not_applicable
      "formularyReport": [{ "med": "...", "agent": "...", "status": "formulary | pa | nf | interchange | not_stocked | not_accepted | unmatched", "actions": ["..."], "leadHours": 72, "resolveBy": "ISO", "firstDoseAtRisk": true }],
      "beds": { "unit": "skilled_medical", "available": 1 }
    }
  },
  "criteriaView": {                     // 8 criteria, each with a per-facility rollup
    "regulatory_screens": { "A": { "worstState": "not_met", "items": [Item] }, "B": {}, "C": {} }
  }
}
```

An `Item` is one rule evaluated for one facility:

```jsonc
{
  "ruleId": "RX-06", "category": "RX", "criterion": "pharmacy_operations", "question": "...",
  "state": "met | not_met | unknown | contradictory | not_applicable",
  "decision": "block | conditional | review | null",   // null when met or not_applicable
  "windowHours": 12,                                   // conditional only
  "resolveBy": "ISO",                                  // conditional only: arrival + window (RX-02: earliest at-risk first dose)
  "resolvable": "sender | capability",                 // capability = facility cannot do it at any paperwork level
  "preArrival": false,
  "requirement": { },                                  // machine-readable params from rules.json
  "evidence": [], "contradictions": [],                // both passages surfaced for contradictory; never auto-resolved
  "detail": "string",                                  // engine explanation, optional
  "notes": "original policy cell text"
}
```

Verdict rollup: `decline` if any blocking item is `resolvable: capability`; `blocked` if any blocking item is `preArrival` (the sender must fix it before the patient travels); `conditional_accept` if blocking items remain that are cleared during the admission process, or any conditional items exist; `accept` otherwise. A rule that is `unknown` or `contradictory` is never treated as met.

## Policy and capacity data

Policy changes about once a year; capacity changes every shift. They are separate files and the engine joins them at evaluation time.

| File | Contents |
|---|---|
| `src/policy/schema.ts` | Zod schemas and inferred types for everything below |
| `src/policy/facilities.json` | Facility profiles: units, formulary contract, pharmacy cutoff and delivery, emergency kit, weight limit, secured/vent units, dialysis chairs |
| `src/policy/rules.json` | The 43 rules. Per facility: `requirement`, `notMetDecision` and `windowHours`, `unknownDecision` and `unknownWindowHours`, `resolvable`, original cell text in `notes` |
| `src/policy/formulary.json` | 79 agents x 3 facilities with status, lead hours, payor PA, interchange target, conditions |
| `src/capacity/snapshot.json` | "Capacity as of 17 Nov 20:00": beds per unit, isolation rooms, staffing, sitters, therapy |
| `src/types.ts` | `Extraction` and `RuleAnswer`, the contract the stage 4 extraction layer must produce |

Edit capacity through `PUT /api/facilities/:id/capacity` or by hand. Policy edits are code changes (rebuild from the facility's own manual before any real use).
