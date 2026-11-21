# Handoff client (Expo · iPhone + web)

One Expo Router codebase for the Handoff web portal and iPhone app, built from the
"Handoff — design system & web portal (pass 1)" design canvas. **Synthetic demo data only**
(Maria Lopez, Alex Chen, Sam Patel are fictional). No API keys live in this app.

## Run it

Requires Node 20+. From the repo root:

```bash
cd client
npm install
```

**Web** (portal + iPhone screens in a device frame):

```bash
npx expo start --web        # opens http://localhost:8081
```

The index page links to every screen. Demo starting points:
- Aftercare handoff view: http://localhost:8081/aftercare/h-ml
- iPhone quick capture: http://localhost:8081/m/capture

**iPhone simulator** (needs Xcode with an iOS simulator installed):

```bash
npx expo start --ios        # boots the simulator, installs Expo Go, opens the app
```

Or run `npx expo start` and press `i`. The iPhone app opens on the Inbox; Capture is the
second tab. Deep link straight into a screen with
`xcrun simctl openurl booted "exp://127.0.0.1:8081/--/m/capture"`.

Checks: `npm run typecheck`.

## Layout

```
src/app/            routes (Expo Router)
  index.tsx         demo index (web) / redirect to /m/inbox (iPhone)
  design-system.tsx tokens + component gallery
  aftercare/        facility web portal: inbox, [id] brief+packet, [id]/thread, [id]/activity
  hospital/         hospital web portal: board, new, review/[id], readmissions, metrics, admin
  m/                iPhone app: (tabs)/inbox|capture|threads|settings, record, brief/[id],
                    pdf/[id], thread/[id], locked, notifications-preview
src/components/     Icon, ui/ (primitives), handoff/ (domain components), layout/, phone/, ...
src/theme/tokens.ts design tokens (colors, type scale, radii, priority/status styles)
src/lib/api/        the data layer — every screen reads and writes through here
```

## Data layer

`src/lib/api/index.ts` exposes async functions (`listHandoffs`, `getBrief`,
`setCriticalReviewed`, `acknowledgeHandoff`, `sendMessage`, `transcribeVoiceNote`,
`sendVoiceNote`, `getActivity`, …) over an in-memory store seeded from `mock-data.ts`.
Screens use `useQuery(() => fn(...))`, which re-runs on any store change.

To go live, replace the function bodies with Supabase queries and calls to **your own
server** that holds the Claude API key (brief generation, transcription/extraction). Never
call Claude from the app directly. The `*-extra.ts` files hold screen-specific mock data.

## Safety rules (enforced in UI and in the data layer)

- Patient name + DOB banner pinned on every patient screen (MRN too on web).
- Every AI item is labeled and links to its source page ("View source p.X").
- Acknowledge stays disabled until every Critical item is checked;
  `acknowledgeHandoff` also refuses otherwise.
- Voice notes never auto-send: stopping a recording makes a draft; Send is disabled until the
  user confirms the patient; `sendVoiceNote` refuses an unconfirmed draft.
- Push/lock-screen text comes only from `buildPushNotification(kind)` — fixed PHI-free
  templates checked by `assertPushIsPhiFree`.
