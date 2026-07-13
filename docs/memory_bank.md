# DeskLab Memory Bank for Claude

Last updated: 2026-07-14, Asia/Shanghai

## Mission

DeskLab is a connected 3D room desktop layout and cabling tool. The long-term product direction is:

- The user models their current room, furniture, devices, power strips, outlets, and cable connections.
- AI later analyzes the model and proposes options:
  - free layout/cabling improvements,
  - paid purchase recommendations,
  - step-by-step changes after purchase.
- The product does not cover in-wall electrical work or construction.
- Generic realistic device categories are enough. Do not spend excessive time chasing exact branded SKU models.

The current work mode is autonomous engineering:

- Pick one high-value, reproducible vertical slice at a time.
- Prefer test-first when fixing bugs or hardening behavior.
- Make the smallest change that moves the product toward robustness.
- Run the full relevant verification.
- Commit only the files changed for that slice.
- Do not ask the user technical questions unless there is a true product decision or irreversible action.

## Repositories

Frontend:
```
D:\desklab\frontend
```

Backend:
```
D:\desklab\backend
```

GitHub backups (private):
```text
Frontend: https://github.com/hollowell1225/desklab-frontend
Backend:  https://github.com/hollowell1225/desklab-backend
```

Canonical tracked memory-bank copy:
```text
D:\desklab\frontend\docs\memory_bank.md
```

Keep this external handoff copy and the tracked copy synchronized whenever the
memory bank is updated. The tracked copy is committed and pushed with the
frontend repository so it is protected by the GitHub backup.

Expected dev URLs:
```
Frontend: http://localhost:5173/
Backend:  http://localhost:3001/api/projects/default
```

Services may or may not be running. Check and restart them when needed.

Additional handoff docs:
```
D:\desklab\memory-bank\DeskLab-model-assets-plan.md
D:\desklab\memory-bank\DeskLab-AI-handoff-template.md
```

Frontend commands:
```bash
npm test
npm run lint
npm run build
npm run dev
```

Backend commands:
```bash
npm test
npm run check:contracts
npm start
```

## Critical Safety Rules

- Frontend was moved to `D:\desklab\frontend` and rebaselined as a new git repository during the D-drive migration. The old frontend `.git` history could not be recovered after Windows partially moved hidden git files. Current frontend git history starts at `eef96fe`.

- Backend untracked is local editor state. DO NOT touch:
  ```
  ?? .vscode/
  ```

- Do NOT overwrite or delete: `D:\desklab\backend\data\default-project.json`
  Backend tests that touch runtime data should back it up and restore it, or use isolated test storage.

- Never claim browser/visual QA unless actually performed. If browser runtime fails, record the failure instead of pretending.

## Current Git State (2026-07-14 handoff)

### Frontend `D:\desklab\frontend`
- Feature HEAD: `bb3d27b fix: validate auto-network port directions`
- Tests: `npm test` → 217 passed. Lint + build clean; build retains the known non-fatal large chunk warning.
- Untracked: none expected.

Current commits (most recent first, baseline at bottom):
```
bb3d27b fix: validate auto-network port directions
51f12ba fix: validate optional power metadata
cfd9581 fix: prevent clock rollback history grouping
26be343 fix: respect zero project history limit
b2db1ed fix: limit clipboard project imports
59597c1 test: require bounds layouts for generic catalog models
d8b3682 test: cover generic laptop layout bounds
0ac9589 test: cover generic all-in-one layout bounds
67d30cf fix: keep generic power strip within catalog bounds
7adc0db fix: keep generic ups within catalog bounds
257d1df fix: keep generic switch within catalog bounds
4770cb1 fix: keep generic router within catalog bounds
b74e570 fix: keep generic modem within catalog bounds
a6ad8cd fix: keep generic nas within catalog bounds
f6c4b16 fix: keep generic wall outlet within catalog bounds
6706f06 fix: keep generic power adapter within catalog bounds
c15e614 fix: keep generic mini pc within catalog bounds
fd1fa11 fix: preserve desktop pc scale behavior
2731fd0 fix: keep generic desktop pc within catalog bounds
525b695 test: cover generic monitor layout bounds
92d0eb7 test: cover generic gaming desk layout bounds
f2f10f4 test: cover generic office desk layout bounds
961ae2d test: cover generic standing desk layout bounds
60ca14c fix: keep generic l-desk within catalog bounds
f64d4e7 test: cover generic assets for catalog models
13d483d feat: add generic l-desk model asset
18ce68a feat: add generic standing desk model asset
e707b9c docs: record generic gaming desk asset slice
3a2e4d2 feat: add generic gaming desk model asset
412e176 docs: record generic office desk asset slice
9c94b59 feat: add generic office desk model asset
12735b8 docs: record generic all-in-one asset slice
53630cc feat: add generic all-in-one model asset
44eecb2 docs: record generic modem asset slice
23752a0 feat: add generic modem model asset
4b93b25 docs: record generic nas asset slice
dfceab9 feat: add generic two-bay nas model asset
e3189a0 docs: record generic laptop asset slice
2dfed7c feat: add generic laptop model asset
22f7f2e docs: record generic wall outlet asset slice
1aa312e feat: add generic wall outlet model asset
82ec3b8 docs: record generic power adapter asset slice
6451fcc feat: add generic power adapter model asset
6ecc6c0 docs: record generic mini pc asset slice
55b9ddb feat: add generic mini pc model asset
17a5ff0 docs: record generic desktop pc asset slice
4f4bd89 feat: add generic desktop pc model asset
3e3b2d7 docs: sync current DeskLab memory bank
c9fff49 feat: add generic ups model asset
6dcdd2f feat: add generic switch model asset
c979589 feat: add generic router model asset
1977ab1 feat: add generic power strip model asset
8521765 feat: add generic monitor model asset
114ed1b fix: pass inert as a boolean instead of an empty string
5d39e0f test: lock distinct default port anchors per catalog model
82463e4 refactor: route remaining power reads through shared helpers
87ffc32 test: lock buildRecommendations facade against malformed live state
f321ab7 refactor: use classifyPowerLoad in PropertiesEditor load badge
47c987e refactor: centralize power-load classification in a tested domain helper
41c57d1 fix: coerce wattage and maxLoad to numbers in power-load analysis
7c7bded fix: guard recommendation distance loops against missing positions
eef96fe chore: rebaseline frontend after D drive move
```
Power-load reads are fully centralized: an audit of `src/` for raw
`maxLoad ??` / `wattage ??` reads or inlined `> maxLoad * 0.9` thresholds is clean.

Code-native generic model assets now exist for:
- `monitor-24`, `monitor-27`, `ultrawide-monitor`
- `power-strip`
- `router`
- `switch`
- `ups`
- `desktop-pc`
- `mini-pc`
- `power-adapter`
- `wall-outlet`
- `laptop-15`
- `nas-2bay`
- `modem`
- `all-in-one`
- `office-desk`
- `gaming-desk`
- `standing-desk`
- `l-desk`

The generic model-asset backlog for catalog models with `assetUrl: null` is now
covered. All generic furniture, monitors, computers, power adapters, wall
Every catalog generic model is now constrained through the shared normalized
layout module and a catalog-driven regression test prevents future coverage
gaps. The next safe target is a small hardening opportunity found from current
code evidence.

### Runtime QA performed (2026-06-25, real, not faked)
- Booted both servers: backend `node server.js` (3001) + frontend `vite` (5173),
  both HTTP 200. Backend was already running once during the session (a duplicate
  start hit `EADDRINUSE` — harmless).
- Loaded the app via the Claude_Preview MCP. DOM mounts (`title=DeskLab`), and the
  UI header showed `布局检查 (2)`, `布线检查 (5)`, `改进建议 (6)` against the real
  `default-project.json` (7 objects, 2 connections) — i.e. the analysis +
  recommendation engine works end-to-end on real data.
- LIMITATION: `preview_screenshot` times out — the react-three-fiber WebGL canvas
  stays at default 300x150 in the headless preview (no GPU). DOM/console QA works;
  pixel screenshots of the 3D scene do not. Use a real browser for visual model QA.
- Console QA surfaced and fixed a real React 19 warning (`inert=""`); after the fix
  a fresh preview load reports zero console errors.
- Preview launch config lives at `D:\.claude\.claude\launch.json` (name
  `desklab-frontend`, runs `npm --prefix D:\desklab\frontend run dev`, port 5173,
  `autoPort:false`). It is outside both repos, so the "no untracked files"
  invariant for the frontend repo still holds.

### Generic monitor model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly monitor render path for
  `monitor-24`, `monitor-27`, and `ultrawide-monitor`; no external meshes,
  scraped assets, logos, or branded silhouettes were introduced.
- `src/domain/model-assets.js` owns the lightweight generic asset registry.
  `SceneObjects.jsx` keeps GLB `assetUrl` rendering first, uses the generic
  monitor only when no external asset URL is present, and preserves the box
  fallback for unknown models.
- Added `test/model-assets.test.js` to lock the monitor asset mapping and
  unknown-model fallback behavior.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native monitor.
- Verification: `node --test test\model-assets.test.js`, `npm test` (176
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: Browser plugin bootstrap failed in this Codex environment
  because the Node browser runtime reported missing sandbox metadata, so QA
  used local Chrome headless via DevTools Protocol against
  `http://127.0.0.1:5173/` with the local backend on `http://localhost:3001`.
  Desktop 1440x900 and mobile 390x844 loaded with no error overlay and no
  console errors; adding "24 英寸显示器" from the asset library selected
  `monitor-24` and showed the monitor in the canvas. Console warnings were
  limited to the existing `THREE.Clock` deprecation from Three/Drei.

### Generic power-strip model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly power strip render path for
  `power-strip`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `power-strip` to
  `generic-power-strip`. `SceneObjects.jsx` renders a long body, top socket
  plate, six generic socket pairs, and an input end block while preserving GLB
  `assetUrl` priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` to lock the power-strip asset mapping.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native power strip.
- Verification: `node --test test\model-assets.test.js`, `npm test` (177
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: Browser plugin bootstrap still failed because the Node
  browser runtime reported missing sandbox metadata, so QA used local Chrome
  headless via DevTools Protocol against `http://127.0.0.1:5173/` with the
  local backend on `http://localhost:3001`. Desktop 1440x900 and mobile 390x844
  loaded with no error overlay and no console errors; adding "插排" from the
  "电源" asset category selected `power-strip` and showed the model in the
  canvas. Console warnings were limited to the existing `THREE.Clock`
  deprecation from Three/Drei.

### Generic router model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly router render path for
  `router`; no external meshes, scraped assets, logos, or branded silhouettes
  were introduced.
- `src/domain/model-assets.js` now maps `router` to `generic-router`.
  `SceneObjects.jsx` renders a compact router body, front network ports,
  two simple antennas, and a status light while preserving GLB `assetUrl`
  priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` to lock the router asset mapping.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native router.
- Verification: `node --test test\model-assets.test.js`, `npm test` (178
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: after the same Browser plugin bootstrap failure already
  observed this session, QA used local Chrome headless via DevTools Protocol
  against `http://127.0.0.1:5173/` with the local backend on
  `http://localhost:3001`. Desktop 1440x900 and mobile 390x844 loaded with no
  error overlay and no console errors; adding "路由器" from the "网络" asset
  category selected `router` and showed the model in the canvas. Console
  warnings were limited to the existing `THREE.Clock` deprecation from
  Three/Drei.

### Generic switch model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly network switch render path for
  `switch`; no external meshes, scraped assets, logos, or branded silhouettes
  were introduced.
- `src/domain/model-assets.js` now maps `switch` to `generic-switch`.
  `SceneObjects.jsx` renders a long switch body, dark front panel, eight
  generic Ethernet ports, and small status LEDs while preserving GLB `assetUrl`
  priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` to lock the switch asset mapping.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native switch.
- Verification: `node --test test\model-assets.test.js`, `npm test` (179
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: using local Chrome headless via DevTools Protocol against
  `http://127.0.0.1:5173/` with the local backend on `http://localhost:3001`,
  desktop 1440x900 and mobile 390x844 loaded with no error overlay and no
  console errors; adding "交换机" from the "网络" asset category selected
  `switch` and showed the model in the canvas. Console warnings were limited
  to the existing `THREE.Clock` deprecation from Three/Drei.

### Generic UPS model asset slice (2026-06-26)
- Added a code-native, in-house, generic low-poly UPS render path for `ups`;
  no external meshes, scraped assets, logos, or branded silhouettes were
  introduced.
- `src/domain/model-assets.js` now maps `ups` to `generic-ups`.
  `SceneObjects.jsx` renders a vertical UPS body, front panel, display area,
  power button, status light, and vent slots while preserving GLB `assetUrl`
  priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` to lock the UPS asset mapping.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native UPS.
- Verification: `node --test test\model-assets.test.js`, `npm test` (180
  passed), `npm run lint`, `npm run build`.
- Browser/visual QA: Browser plugin bootstrap still failed because the Node
  browser runtime reported missing sandbox metadata, so QA used local Chrome
  headless via DevTools Protocol against `http://127.0.0.1:5173/` with the
  local backend on `http://localhost:3001`. Desktop 1440x900 and mobile 390x844
  loaded with no error overlay and no console errors; adding "UPS" from the
  "电源" asset category selected `ups` and showed the model in the canvas.
  Console warnings were limited to the existing `THREE.Clock` deprecation from
  Three/Drei.

### Generic desktop PC model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly tower PC render path for
  `desktop-pc`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `desktop-pc` to
  `generic-desktop-pc`. `SceneObjects.jsx` renders a tower body, inset front
  panel, fan vent, power button/status light, and two front ports while
  preserving GLB `assetUrl` priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` test-first to lock the desktop PC asset
  mapping. The focused test failed on the previous `null` mapping before the
  implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes for
  the code-native desktop PC.
- Verification: `node --test test\model-assets.test.js` (7 passed), `npm test`
  (181 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed. Both localhost services returned HTTP 200,
  but the Browser plugin bootstrap failed because the runtime request lacked
  required sandbox metadata (`sandboxPolicy`). No browser or visual QA is
  claimed.
- Commit: `4f4bd89 feat: add generic desktop pc model asset` (pushed to
  `origin/master`).

### Generic mini PC model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly compact computer render path
  for `mini-pc`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `mini-pc` to `generic-mini-pc`.
  `SceneObjects.jsx` renders a low compact body, top vent, power button/status
  light, and two front ports while preserving GLB `assetUrl` priority and
  unknown-model box fallback.
- Expanded `test/model-assets.test.js` test-first to lock the mini PC mapping.
  The focused test failed on the previous `null` mapping before implementation
  and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: `node --test test\model-assets.test.js` (8 passed), `npm test`
  (182 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed. Both localhost services returned HTTP 200,
  but Browser bootstrap again failed because the runtime request lacked
  required sandbox metadata (`sandboxPolicy`). No browser or visual QA is
  claimed.
- Commit: `55b9ddb feat: add generic mini pc model asset` (pushed to
  `origin/master`).

### Generic power adapter model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly AC-to-DC adapter render path
  for `power-adapter`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `power-adapter` to
  `generic-power-adapter`. `SceneObjects.jsx` renders a compact power brick,
  top label panel, two AC-side contacts, and a DC-side strain relief while
  preserving GLB `assetUrl` priority and unknown-model box fallback.
- Expanded `test/model-assets.test.js` test-first to lock the adapter mapping.
  The focused test failed on the previous `null` mapping before implementation
  and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: `node --test test\model-assets.test.js` (9 passed), `npm test`
  (183 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed. Both localhost services returned HTTP 200,
  but Browser bootstrap remained blocked by missing runtime sandbox metadata
  (`sandboxPolicy`). No browser or visual QA is claimed.
- Commit: `6451fcc feat: add generic power adapter model asset` (pushed to
  `origin/master`).

### Generic wall outlet model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly dual wall outlet render path
  for `wall-outlet`; no external meshes, scraped assets, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` now maps `wall-outlet` to
  `generic-wall-outlet`. `SceneObjects.jsx` renders a thin wall plate, inset
  faceplate, two outlet rows, and a center fastener while preserving existing
  wall-snap rotation, GLB `assetUrl` priority, and unknown-model box fallback.
- Expanded `test/model-assets.test.js` test-first to lock the outlet mapping.
  The focused test failed on the previous `null` mapping before implementation
  and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: `node --test test\model-assets.test.js` (10 passed), `npm test`
  (184 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed because the same Browser runtime
  `sandboxPolicy` metadata blocker remained active. No browser or visual QA is
  claimed.
- Commit: `1aa312e feat: add generic wall outlet model asset` (pushed to
  `origin/master`).

### Generic laptop model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly open laptop render path for
  `laptop-15` when its catalog `assetUrl` is `null`.
- `src/domain/model-assets.js` maps `laptop-15` to `generic-laptop`.
  `SceneObjects.jsx` renders a thin base, keyboard deck, display bezel/screen,
  and hinge while preserving GLB `assetUrl` priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes while
  retaining the historical external-model attribution.
- Verification: `node --test test\model-assets.test.js` (11 passed), `npm test`
  (185 passed), `npm run lint`, `npm run build`. The existing large-chunk build
  warning remains non-fatal.
- Browser/visual QA: not completed because the Browser runtime remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `2dfed7c feat: add generic laptop model asset` (pushed to
  `origin/master`).

### Generic two-bay NAS model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly network storage render path
  for `nas-2bay`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `nas-2bay` to `generic-nas-2bay`.
  `SceneObjects.jsx` renders an enclosure, inset front panel, two drive bays,
  bay handles, and status LEDs while preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 12/12; `npm test` 186/186; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `dfceab9 feat: add generic two-bay nas model asset` (pushed).

### Generic modem model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly modem/network-terminal render
  path for `modem`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `modem` to `generic-modem`.
  `SceneObjects.jsx` renders a low-profile body, status strip, four LEDs,
  network socket, and round power input while preserving GLB priority and box
  fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 13/13; `npm test` 187/187; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `23752a0 feat: add generic modem model asset` (pushed).

### Generic all-in-one model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly integrated computer render
  path for `all-in-one`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `all-in-one` to `generic-all-in-one`.
  `SceneObjects.jsx` renders the display, screen, lower chin, thick rear compute
  enclosure, stand, and base while preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 14/14; `npm test` 188/188; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `53630cc feat: add generic all-in-one model asset` (pushed).

### Generic office desk model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly office desk render path for
  `office-desk`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `office-desk` to `generic-office-desk`.
  `SceneObjects.jsx` renders a full desktop, four metal-style legs, and a rear
  cable tray while retaining the catalog dimensions used by support/collision
  logic and preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 15/15; `npm test` 189/189; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `9c94b59 feat: add generic office desk model asset` (pushed).

### Generic gaming desk model asset slice (2026-07-05)
- Added a code-native, in-house, generic low-poly gaming desk render path for
  `gaming-desk`; no external meshes, logos, or branded silhouettes.
- `src/domain/model-assets.js` maps `gaming-desk` to `generic-gaming-desk`.
  `SceneObjects.jsx` renders a wide desktop, angled legs, rear crossbar, and
  monitor shelf, all kept within the catalog bounding box while preserving GLB
  priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused tests 16/16; `npm test` 190/190; lint and build passed.
  The existing large-chunk warning remains non-fatal.
- Browser/visual QA: not completed because Browser bootstrap remained blocked
  by missing `sandboxPolicy` metadata. No browser or visual QA is claimed.
- Commit: `3a2e4d2 feat: add generic gaming desk model asset` (pushed).


### Generic standing desk model asset slice (2026-07-13)
- Added a code-native, in-house, generic low-poly adjustable standing desk
  render path for `standing-desk`; no external meshes, logos, or branded
  silhouettes were introduced.
- `src/domain/model-assets.js` maps `standing-desk` to
  `generic-standing-desk`. `SceneObjects.jsx` renders a desktop, two lift
  columns, lower sleeves, feet, rear crossbar, and front control panel while
  preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused `node --test test\model-assets.test.js` passed 17/17;
  `npm test` passed 191/191; `npm run lint` passed; `npm run build` passed
  after rerun with permission to write Vite's `node_modules\.vite-temp`, with
  the existing non-fatal large chunk warning.
- Runtime endpoint QA: `curl.exe -sS -I http://127.0.0.1:5173/` returned HTTP
  200, and `curl.exe -sS http://localhost:3001/api/projects/default` returned
  the default project JSON. No backend write/save was performed.
- Browser/visual QA: not completed in this handoff slice because the user
  explicitly disallowed Codex IAB, page screenshots, and Base64 image output;
  no browser or visual QA is claimed for this slice.
- Commit: `18ce68a feat: add generic standing desk model asset` (pushed).

### Generic L desk model asset slice (2026-07-13)
- Added a code-native, in-house, generic low-poly L-shaped desk render path for
  `l-desk`; no external meshes, logos, or branded silhouettes were introduced.
- `src/domain/model-assets.js` maps `l-desk` to `generic-l-desk`.
  `SceneObjects.jsx` renders intersecting desktop slabs, four legs, and rear
  cable trays while preserving GLB priority and box fallback.
- Expanded `test/model-assets.test.js` test-first; the focused test failed on
  the previous `null` mapping before implementation and passed afterward.
- Updated `public/models/ATTRIBUTION.md` with DeskLab-owned source notes.
- Verification: focused `node --test test\model-assets.test.js` passed 18/18;
  `npm test` passed 192/192; `npm run lint` passed; `npm run build` passed
  with the existing non-fatal large chunk warning.
- Runtime endpoint QA: `curl.exe -sS -I http://127.0.0.1:5173/` returned
  HTTP 200, and `curl.exe -sS http://localhost:3001/api/projects/default`
  returned the default project JSON. No backend write/save was performed.
- Browser/visual QA: not completed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output; no browser or visual
  QA is claimed for this slice.
- Commit: `13d483d feat: add generic l-desk model asset` (pushed).

### Generic catalog asset coverage regression test (2026-07-13)
- Added a public-interface regression test in `test/model-assets.test.js` that
  enumerates every `DEVICE_CATALOG` model with `assetUrl: null` and requires a
  matching in-house generic asset with the same category and DeskLab-owned
  metadata.
- This prevents future catalog additions from silently falling back to an
  unstyled box while leaving external GLB-backed models unaffected.
- Verification: `node --test test\model-assets.test.js` passed 19/19;
  `npm test` passed 193/193; `npm run lint` passed; `npm run build` passed
  with the existing non-fatal large chunk warning.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `f64d4e7 test: cover generic assets for catalog models` (pushed).

### Generic L desk geometry-bound regression fix (2026-07-13)
- Fixed a real L-desk rendering defect: the right desktop slab extended to
  normalized depth `0.54`, beyond the catalog footprint limit of `0.5`.
- Added `src/domain/generic-model-layouts.js` as the shared layout seam for the
  L-desk desktop slabs, legs, and cable trays. `SceneObjects.jsx` now renders
  from this layout instead of duplicating placement constants.
- Added `test/generic-model-layouts.test.js`; its public-interface assertion
  failed against the previous right-top position and passed after the slab was
  moved inside the footprint.
- Verification: focused geometry/model-asset tests passed 20/20; `npm test`
  passed 194/194; `npm run lint` passed; `npm run build` passed with the
  existing non-fatal large chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks both returned
  HTTP 200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `60ca14c fix: keep generic l-desk within catalog bounds` (pushed).

### Generic standing desk geometry-bound regression test (2026-07-13)
- Added normalized shared layout data for the standing desk's top, lift columns,
  sleeves, feet, rear crossbar, and control panel in
  `src/domain/generic-model-layouts.js`.
- `SceneObjects.jsx` now renders those horizontal placements and dimensions from
  the shared layout, rather than maintaining a second set of geometry constants.
- Added a test-first public-interface assertion that the standing desk remains
  inside its catalog footprint. It failed before the standing-desk layout was
  registered and passed once the renderer consumed it.
- Verification: focused layout tests passed 2/2; `npm test` passed 195/195;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `961ae2d test: cover generic standing desk layout bounds` (pushed).

### Generic office desk geometry-bound regression test (2026-07-13)
- Added normalized shared layout data for the office desk's desktop, four legs,
  and rear cable tray in `src/domain/generic-model-layouts.js`.
- `SceneObjects.jsx` now renders the office desk's horizontal placement and
  footprint dimensions from that shared layout, avoiding duplicate constants.
- Added a test-first public-interface assertion that the office desk remains
  inside its catalog footprint. It failed before the office-desk layout was
  registered and passed once the renderer consumed it.
- Verification: focused layout tests passed 3/3; `npm test` passed 196/196;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `f2f10f4 test: cover generic office desk layout bounds` (pushed).

### Generic gaming desk geometry-bound regression test (2026-07-13)
- Added normalized shared layout data for the gaming desk's desktop, two angled
  legs, rear crossbar, and monitor shelf in `src/domain/generic-model-layouts.js`.
- `SceneObjects.jsx` now renders the gaming desk's horizontal placement,
  footprint dimensions, and leg rotation from the shared layout rather than
  duplicating constants.
- Added a test-first public-interface assertion that the gaming desk remains
  inside its catalog footprint. It failed before the gaming-desk layout was
  registered and passed once the renderer consumed it.
- Verification: focused layout tests passed 4/4; `npm test` passed 197/197;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `92d0eb7 test: cover generic gaming desk layout bounds` (pushed).

### Generic monitor geometry-bound regression test (2026-07-13)
- Added one normalized shared layout for the monitor panel, screen, rear housing,
  stand, and base, mapped to `monitor-24`, `monitor-27`, and
  `ultrawide-monitor` in `src/domain/generic-model-layouts.js`.
- `GenericMonitorModel` now reads that layout through the object's real
  `modelId`, keeping the three catalog variants on the same render/test seam.
- Added a test-first public-interface assertion for all three monitor model ids.
  It failed before their shared layout was registered and passed once rendering
  consumed it.
- Verification: focused layout tests passed 5/5; `npm test` passed 198/198;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `525b695 test: cover generic monitor layout bounds` (pushed).

### Generic desktop PC geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the tower body, front panel, fan vent,
  power button, status light, and two front ports, mapped to `desktop-pc` in
  `src/domain/generic-model-layouts.js`.
- Added a test-first public-interface assertion for `desktop-pc`. It failed
  before the layout was registered and passed after rendering consumed it.
- Fixed a real catalog-footprint overflow: front details previously extended
  through normalized depth `0.51–0.60`; they now remain at or inside the front
  boundary (`z <= 0.5`). The status light uses independent X/Z scale so that
  its layout descriptor remains correct after non-uniform object resizing.
- Verification: focused layout tests passed 6/6; `npm test` passed 199/199;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commits: `2731fd0 fix: keep generic desktop pc within catalog bounds` and
  `fd1fa11 fix: preserve desktop pc scale behavior` (pushed).

### Generic mini PC geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the compact body, top vent, power
  button, status light, and two front ports, mapped to `mini-pc` in
  `src/domain/generic-model-layouts.js`.
- Added a test-first public-interface assertion for `mini-pc`. It failed before
  the layout was registered and passed after rendering consumed it.
- Fixed a real catalog-footprint overflow: the front button, status light, and
  ports previously extended through normalized depth `0.51–0.55`; their visible
  geometry now remains inside the front boundary (`z <= 0.5`). Independent X/Z
  scale preserves the default silhouette and keeps the layout valid after
  non-uniform object resizing.
- Verification: focused layout tests passed 7/7; `npm test` passed 200/200;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `c15e614 fix: keep generic mini pc within catalog bounds` (pushed).

### Generic power adapter geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the adapter body, top label, two AC
  pins, and DC strain relief, mapped to `power-adapter` in
  `src/domain/generic-model-layouts.js`.
- Added a test-first public-interface assertion for `power-adapter`. It failed
  before the layout was registered and passed after rendering consumed it.
- Fixed real catalog-footprint overflows: AC pins previously extended to
  normalized depth `0.86` and the DC strain relief to `-0.73`; both now remain
  inside the `[-0.5, 0.5]` footprint. The strain-relief cylinder uses independent
  X/Z scale to preserve the default silhouette after non-uniform resizing.
- Verification: focused layout tests passed 8/8; `npm test` passed 201/201;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning.
- Runtime endpoint QA: frontend and local backend `curl` checks returned HTTP
  200. No backend write/save was performed.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `6706f06 fix: keep generic power adapter within catalog bounds`
  (pushed).

### Generic wall outlet geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the outlet body, faceplate, four slots,
  and center fastener, mapped to `wall-outlet` in
  `src/domain/generic-model-layouts.js`.
- Added a test-first public-interface assertion for `wall-outlet`. It failed
  before the layout was registered and passed after rendering consumed it.
- Fixed real catalog-footprint overflows: the faceplate, slots, and fastener
  previously extended through normalized depth `0.56`, `0.60`, and `0.62`;
  all now remain inside the front boundary (`z <= 0.5`).
- Verification: focused layout tests passed 9/9; `npm test` passed 202/202;
  `npm run lint` and `npm run build` passed with the existing non-fatal large
  chunk warning. Local frontend and backend `curl` checks returned HTTP 200.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `f6c4b16 fix: keep generic wall outlet within catalog bounds`
  (pushed).

### Generic NAS geometry-bound regression fix (2026-07-13)
- Added one normalized shared layout for the NAS body, front panel, two drive
  bays, drive handles, and status lights, mapped to `nas-2bay` in
  `src/domain/generic-model-layouts.js`.
- Added a public layout-bound assertion for `nas-2bay` and made rendering consume
  the same layout data.
- Fixed the front components' real normalized-depth overflow (up to `0.615`):
  panel, bays, handles, and lights now remain within `z <= 0.5`.
- Verification: focused layout tests 10/10; `npm test` 203/203; `npm run lint`
  and `npm run build` passed with the existing non-fatal large chunk warning;
  local frontend and backend `curl` checks returned HTTP 200.
- Browser/visual QA: not performed because the user explicitly disallowed
  Codex IAB, page screenshots, and Base64 image output.
- Commit: `a6ad8cd fix: keep generic nas within catalog bounds` (pushed).

### Generic modem geometry-bound regression fix (2026-07-13)
- Added a normalized shared layout for the modem body, top plate, status lights,
  and front ports, mapped to `modem`; front ports now remain at `z <= 0.5`.
- Test-first `modem` bounds assertion failed before registration and passed after.
- Verification: focused tests 11/11; `npm test` 204/204; lint, build, and local
  frontend/backend HTTP checks passed. Browser/visual QA was not performed.
- Commit: `b74e570 fix: keep generic modem within catalog bounds` (pushed).

### Generic router geometry-bound regression fix (2026-07-13)
- Added a normalized shared layout for the router body, four ports, antennas,
  and status light. The port centers moved from `z=0.51` to `z=0.46` so their
  visible geometry remains within the catalog footprint.
- Test-first `router` bounds assertion failed before layout registration and
  passed afterward. Verification: focused 12/12; `npm test` 205/205; lint,
  build, and local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `4770cb1 fix: keep generic router within catalog bounds` (pushed).

### Generic switch geometry-bound regression fix (2026-07-14)
- Added one normalized shared layout for the switch body, front panel, eight
  ports, and status lights. The panel and ports moved to `z=0.46`, keeping
  their visible geometry within the catalog footprint.
- Test-first `switch` bounds assertion failed before layout registration and
  passed afterward. Verification: focused 13/13; `npm test` 206/206; lint,
  build, and local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `257d1df fix: keep generic switch within catalog bounds` (pushed).

### Generic UPS geometry-bound regression fix (2026-07-14)
- Added normalized shared layout data for the UPS body, front panel, display,
  button, status light, and five vents. All front components now stay inside
  the catalog footprint.
- Test-first `ups` assertion failed before layout registration and passed after.
  Verification: focused 14/14; `npm test` 207/207; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `7adc0db fix: keep generic ups within catalog bounds` (pushed).

### Generic power strip geometry-bound regression fix (2026-07-14)
- Added normalized layout data for the strip body, top plate, six socket pairs,
  and input end. The input end moved from `x=-0.47,z=-0.52` to `x=-0.45,z=-0.42`,
  keeping its full visible geometry inside the footprint.
- Test-first `power-strip` assertion failed before registration and passed after.
  Verification: focused 15/15; `npm test` 208/208; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `67d30cf fix: keep generic power strip within catalog bounds` (pushed).

### Generic all-in-one layout coverage (2026-07-14)
- Added one shared normalized layout for the panel, screen, lower bezel, rear
  housing, stand, and base, mapped to `all-in-one`. Existing geometry remained
  within bounds; this slice makes that invariant executable and removes duplicate
  render constants.
- Test-first `all-in-one` bounds assertion failed before layout registration and
  passed after. Verification: focused 16/16; `npm test` 209/209; lint, build,
  and local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `0ac9589 test: cover generic all-in-one layout bounds` (pushed).

### Generic laptop layout coverage (2026-07-14)
- Added one shared normalized layout for the laptop base, keyboard, lid, screen,
  and hinge, mapped to `laptop-15`; the existing in-bounds geometry is unchanged.
- Test-first `laptop-15` assertion failed before registration and passed after.
  Verification: focused 17/17; `npm test` 210/210; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `d8b3682 test: cover generic laptop layout bounds` (pushed).

### Generic catalog layout coverage guard (2026-07-14)
- Added one catalog-driven regression test requiring every `assetUrl: null`
  catalog model to have an in-bounds shared layout. This protects future catalog
  additions against silently bypassing geometry-bound coverage.
- Verification: focused 18/18; `npm test` 211/211; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `59597c1 test: require bounds layouts for generic catalog models`
  (pushed).

### Clipboard import size guard (2026-07-14)
- Added `project-import-limits.js` with the shared 5MB byte limit and UTF-8 text
  byte measurement. File and clipboard imports now use the same guard before
  JSON parsing or validation.
- This fixes the prior clipboard-only gap, where arbitrarily large text could be
  parsed before the backend's request-size protection applied.
- Verification: focused 2/2; `npm test` 213/213; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `b2db1ed fix: limit clipboard project imports` (pushed).

### Zero project-history limit guard (2026-07-14)
- Fixed a history-limit boundary bug: JavaScript `slice(-0)` retained every
  snapshot, so `limit: 0` unintentionally created unbounded undo history.
  Limits are now safely normalized and zero explicitly disables snapshots.
- Test-first regression coverage verifies zero history has neither undo nor redo.
- Verification: focused 6/6; `npm test` 214/214; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `26be343 fix: respect zero project history limit` (pushed).

### Project-history clock-rollback group guard (2026-07-14)
- Fixed a grouping boundary bug: a negative elapsed time from a system-clock
  rollback still satisfied the prior `< groupWindowMs` check, merging an
  independent operation into the previous undo group.
- Grouping now requires a non-decreasing timestamp as well as being within the
  configured time window. Test-first coverage confirms undo returns the second
  operation after a clock rollback.
- Verification: focused 7/7; `npm test` 215/215; lint, build, and local
  frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `cfd9581 fix: prevent clock rollback history grouping` (pushed).

### Optional power-metadata validation guard (2026-07-14)
- Closed a frontend/backend contract gap: the backend rejected invalid optional
  `wattage` and `maxLoad`, but shared frontend envelope validation accepted
  them, allowing bad data to survive load/import/draft recovery until save.
- The shared validator now accepts those fields only when absent, null, or a
  non-negative finite number. Regression coverage rejects string and negative
  values for both fields in a successful-looking project response.
- Verification: project-client 33/33; draft 18/18; `npm test` 216/216; lint,
  build, and local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `51f12ba fix: validate optional power metadata` (pushed).

### Backend null port-anchor normalization guard (2026-07-14)
- Fixed a backend 500 path: `anchor: null` was explicitly accepted as an
  optional port value, but output normalization unconditionally read its
  coordinates and threw a `TypeError`.
- Normalization now preserves an explicit null anchor and still copies valid
  coordinate objects, keeping the output stable for ETag versioning.
- Verification: backend validate 22/22; `npm test` 31/31;
  `npm run check:contracts` passed. No browser or visual QA performed.
- Commit: backend `fd2eb33 fix: preserve null port anchors` (pushed).

### Nullable port-anchor contract alignment (2026-07-14)
- Aligned the JSON Schema and OpenAPI 3.1 Port schemas with the runtime and
  frontend behavior: optional `anchor` now explicitly accepts either a
  normalized vector or `null`.
- Updated the read-only contract checker to require both alternatives while
  retaining the normalized-vector range checks. The checker was red before
  the update and green afterward.
- Verification: `npm run check:contracts`; backend `npm test` 31/31. No
  browser or visual QA performed.
- Commit: backend `ddf4c1e contract: allow null port anchors` (pushed).

### OpenAPI power-metadata contract guard (2026-07-14)
- Added missing `wattage` and `maxLoad` fields (non-negative numbers) to the
  OpenAPI Object schema, matching the persisted JSON Schema and runtime
  validation.
- The read-only contract checker now requires both fields; it failed before
  the OpenAPI update and passed afterward.
- Verification: `npm run check:contracts`; backend `npm test` 31/31. No
  browser or visual QA performed.
- Commit: backend `2aa0943 contract: document power metadata in openapi`
  (pushed).

### Null optional model-metadata normalization guard (2026-07-14)
- Fixed a response-contract mismatch: compatibility validation accepted
  `category`, `modelId`, and `color` as null, then wrote those nulls back even
  though the formal schemas declare them optional strings.
- Normalization now omits null values for those metadata fields while retaining
  meaningful `assetUrl: null` values used by in-house generic models.
- Verification: backend validate 23/23; `npm test` 32/32;
  `npm run check:contracts` passed. No browser or visual QA performed.
- Commit: backend `9ecbcc9 fix: normalize null model metadata` (pushed).

### Auto-network direction guard (2026-07-14)
- Fixed invalid auto-network recommendations for custom/imported ethernet ports:
  the previous matching logic checked only type and occupancy, so an
  output-only device port could be suggested as a connection target.
- The suggestion now requires the device port to receive and the distributor
  port to provide network traffic, with the existing port-semantics guard on
  both ends. Regression coverage fails against the prior suggestion and passes
  after the change.
- Verification: recommendations 36/36; `npm test` 217/217; lint, build, and
  local frontend/backend HTTP checks passed. Browser QA not performed.
- Commit: `bb3d27b fix: validate auto-network port directions` (pushed).

Notes on the power-load slices (2026-06-25):
- `analysis.js` now exports `toPowerValue(value)` (coerce wattage/maxLoad to a safe
  non-negative number as defense in depth for malformed transient live state)
  and `classifyPowerLoad(currentLoad, maxLoad)`
  → `'overload' | 'warning' | 'ok'` (with `POWER_WARNING_RATIO = 0.9`).
- Both helpers are the single source of truth for overload/warning thresholds.
  Consumers: `analyzeProjectWiring`, `recommendations.js`, `SceneObjects.jsx`
  `PowerStatusOverlay`, and `PropertiesEditor.jsx` load badge. Do not re-inline
  `currentLoad > maxLoad * 0.9` style math in new UI — reuse `classifyPowerLoad`.
- `recommendations.js` nearest-device loops now use `calculatePositionDistance`
  (from `connections.js`) so a port-bearing object with no/NaN position no longer
  throws — it is simply skipped.

Pre-migration frontend commits preserved in this memory bank for reference only:
```
0e325f6 perf: reuse power graph in overlay
a3dfe4f perf: share power load graph
3e40649 perf: reuse project analysis results
03fc487 fix: clamp property numeric edits
c14f5d2 feat: auto-connect USB-C displays
2468840 test: add DisplayPort coverage for auto_connect_display
```

### Backend `D:\desklab\backend`
- HEAD: `9ecbcc9 fix: normalize null model metadata`
- Tests: `npm test` → 32 passed. Contracts check passed.
- Untracked (DO NOT touch): `?? .vscode/`

Last 5 commits:
```
9ecbcc9 fix: normalize null model metadata
2aa0943 contract: document power metadata in openapi
ddf4c1e contract: allow null port anchors
fd2eb33 fix: preserve null port anchors
967bfcf contract: add wattage and maxLoad to Object schema
```

Always re-check `git status` and recent commits before making changes.

## Frontend Architecture

### Domain modules (`src/domain/`)

Core modules:
- `recommendations.js` — **free improvements + purchase suggestions engine** (see below)
- `analysis.js` — wiring analysis: port validation, power cycle detection, overload/warning, shared `buildPowerGraph()` for load aggregation
- `layout-analysis.js` — layout analysis: overlap, out-of-bounds, floating, outlet-off-wall
- `connections.js` — port compatibility, cable type inference, distance/length evaluation, ethernet topology
- `catalog.js` — device catalog (17 models across 5 categories), hydration, port anchors
- `geometry.js` — 3D bounds, overlap detection, footprint rotation
- `placement.js` — catalog object placement with room constraints
- `project-validation.js` — `isProjectEnvelope()` shared by draft.js and project-client.js
- `project-client.js` — versioned load/save/validate/recovery HTTP client
- `project-history.js` — undo/redo with grouping and camera awareness
- `project-access.js` — editability gates for canvas interactions
- `draft.js` / `draft-storage.js` — local draft persistence and recovery
- `identifiers.js` — collision-resistant entity IDs
- `status-notifier.js` — stale-timer-safe status messages
- `keyboard-controls.js` — keyboard shortcuts for object manipulation
- `camera-snapshot.js` / `coordinates.js` / `project-export.js`

Test files under `test/` mirror the domain modules.

### Recommendations Module (`recommendations.js`)

**Free improvements** (`buildFreeImprovements(room, objects, connections)`):
| Code | Rank | Description |
|------|------|-------------|
| `move_inside_room` | 0 | Move out-of-bounds object inside room |
| `drop_to_support` | 1 | Drop floating object to support/floor |
| `snap_outlet_to_wall` | 2 | Snap wall outlet to nearest wall |
| `auto_power_device` | 3 | Connect unpowered device to nearest power source |
| `auto_network_device` | 4 | Connect unnetworked device to nearest switch/router |
| `auto_connect_display` | 5 | Connect HDMI/DP/USB-C output to nearest monitor |
| `extend_cable` | 6 | Extend cable to recommended length |

**Purchase suggestions** (`buildPurchaseSuggestions(objects, connections)`):
| Code | Trigger |
|------|---------|
| `buy_power_source` | Daisy-chained power strips → UPS |
| `buy_cable` | Short cable / low slack → longer cable |
| `buy_switch` | Unconnected ethernet devices > free LAN ports |
| `buy_power_strip` | Power strip all AC outputs occupied |
| `buy_ups_overload` | Power hub external load > maxLoad |
| `buy_power_for_unpowered` | Unpowered device with no nearby free port → strip/UPS |

**Patch application**:
- `applyImprovement(project, suggestion)` — apply single patch (layout/cable/newConnection)
- `applyAllImprovements(project, suggestions)` — apply all sequentially
- `buildRecommendations(project, options?)` — facade returning `{ freeImprovements, purchases, total }`; accepts precomputed `wiringIssues` to avoid repeated analysis in UI render paths.

All suggestion types are round-trip tested: applying the suggested patch clears the corresponding analysis issue.

### Key architectural patterns:
- Nested `Map<string, Map<string, *>>` for port occupancy tracking (NOT string-key concatenation)
- `isProjectEnvelope()` shared by draft.js and project-client.js for validation parity
- UI delegates to domain logic; no duplicated math in components
- Cable types inferred via `inferCableType()`, not hardcoded

## Backend Architecture

Source:
```
D:\desklab\backend\src\store.js     — atomic file writes, backup/recovery, ETag versioning
D:\desklab\backend\src\validate.js  — request body validation and normalization
```

Tests: `D:\desklab\backend\test\server.test.js`, `D:\desklab\backend\test\validate.test.js`
Contracts: `D:\desklab\backend\contracts\project.schema.json`, `openapi.yaml`

### Key backend facts:
- `validateProjectBody` normalizes and strips unknown fields. Known optional fields: `category`, `modelId`, `assetUrl`, `color`, `wattage`, `maxLoad`, `ports`, `camera`, `connections`.
- `wattage` and `maxLoad` are validated as non-negative finite numbers when present (fixed in `e15b9de`).
- Port occupancy uses nested Maps (matching frontend pattern).
- 5MB request body limit. Optimistic concurrency with `If-Match` / `ETag`.
- Backup recovery via `/api/projects/default/recover-backup`.

## Tokyo VPS Demo Deployment

Last deployed: 2026-06-26, Asia/Shanghai.

Important development policy:
- The Tokyo VPS is **not** the primary development backend.
- During normal development, run the backend locally from `D:\desklab\backend` on port `3001`.
- Do **not** deploy to, restart, or depend on the VPS backend unless the user explicitly asks for remote deployment/demo.
- Treat the VPS as a temporary demo/preview environment only; it can lag behind local development.

SSH:
```bash
ssh -i "D:\桌面\claude.pem" ubuntu@43.165.178.199
```

DeskLab backend is deployed on the Tokyo VPS at:
```text
/home/ubuntu/desklab-backend
```

Systemd services:
```bash
sudo systemctl status desklab-backend
sudo systemctl status desklab-backend-tunnel
```

Demo runtime:
- DeskLab backend service: `desklab-backend`
- Internal port: `3011`
- Public Quick Tunnel: `https://facing-continuing-locks-boats.trycloudflare.com`
- Health/API check: `https://facing-continuing-locks-boats.trycloudflare.com/api/projects/default`

Important VPS port note:
- Do **not** use port `3001` for DeskLab on this VPS. Existing MCP services already use the 3000/3001 area:
  - `mcd-mcp` on local port 3000
  - `luckin-mcp` on local port 3001
- DeskLab uses `PORT=3011` to avoid disrupting those services.

Quick Tunnel caveat:
- The `trycloudflare.com` URL can change if `desklab-backend-tunnel` restarts. For a stable production URL, replace it later with a Cloudflare named tunnel.

Deploy/update sketch, only when explicitly requested by the user:
```powershell
cd D:\desklab\backend
npm test
npm run check:contracts
tar -czf D:\desklab\deploy\desklab-backend.tgz --exclude .git --exclude .vscode --exclude node_modules --exclude "*.log" -C D:\desklab\backend .
scp -i "D:\桌面\claude.pem" D:\desklab\deploy\desklab-backend.tgz ubuntu@43.165.178.199:/home/ubuntu/desklab-backend.tgz
```

On the VPS, extract into `/home/ubuntu/desklab-backend`, run `npm ci --omit=dev`, and restart:
```bash
sudo systemctl restart desklab-backend
sudo systemctl restart desklab-backend-tunnel
```

## Verification Gates

Frontend:
```bash
cd D:\desklab\frontend
npm test          # 191 tests
npm run lint      # eslint .
npm run build     # vite build (known large chunk warning is OK)
```

Backend:
```bash
cd D:\desklab\backend
npm test              # 30 tests
npm run check:contracts  # schema + openapi checks
```

If rendered UI behavior changes, do browser QA against localhost if browser runtime works.

## High-Value Next Work

The autonomous hardening backlog and recommendation foundation are complete.
Generic model-asset and project-history hardening work is complete through the
currently audited cases and safe to continue in small slices.
Remaining work:

1. **Product-design-dependent** (confirm intent with product owner first):
   - Dedicated "改进建议" summary panel/badge
   - Richer paid purchase recommendations (which products, when, quantities)
   - "Step-by-step changes after purchase" flow
   - Browser/visual QA of the new fix buttons

2. **If continuing autonomously without product direction**:
   - Browser/visual QA for rendered UI behavior.
   - Small focused hardening found from current code evidence.

3. **Always start from current evidence**:
```bash
cd D:\desklab\frontend
git status --short
git log -5 --oneline

cd D:\desklab\backend
git status --short
git log -5 --oneline
```

## Communication Style

The user is the product owner. Keep updates brief: what was found, what was changed, files changed, verification run, commit SHA. Do not ask for "Proceed" on ordinary code work.

## Quick Start for Next Agent

1. Re-check git state and recent commits for both repos.
2. Check or start services as needed (frontend :5173, backend :3001).
3. Pick one high-value, reproducible issue.
4. Write a failing test first where practical.
5. Make the smallest fix.
6. Run full verification.
7. Commit only relevant files.
8. Update this memory bank only at handoff, quota low, or model switch.
