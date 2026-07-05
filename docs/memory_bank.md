# DeskLab Memory Bank for Claude

Last updated: 2026-07-05, Asia/Shanghai

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

## Current Git State (2026-06-26 handoff)

### Frontend `D:\desklab\frontend`
- Feature HEAD: `9c94b59 feat: add generic office desk model asset`
- Tests: `npm test` → 189 passed. Lint + build clean.
- Untracked: none expected.

Current commits (most recent first, baseline at bottom):
```
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

The next likely model-asset targets are `gaming-desk`, `standing-desk`, and
`l-desk`.

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

Notes on the power-load slices (2026-06-25):
- `analysis.js` now exports `toPowerValue(value)` (coerce wattage/maxLoad to a safe
  non-negative number — drafts/imports can carry them as strings, which
  `isProjectObject` does not validate) and `classifyPowerLoad(currentLoad, maxLoad)`
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
- HEAD: `967bfcf contract: add wattage and maxLoad to Object schema`
- Tests: `npm test` → 30 passed. Contracts check passed.
- Untracked (DO NOT touch): `?? .vscode/`

Last 5 commits:
```
967bfcf contract: add wattage and maxLoad to Object schema
e15b9de fix: preserve wattage and maxLoad through backend validation
cabed03 test: lock multi-value If-Match version preconditions
96aa66c test: lock normalization idempotency for ETag stability
e667c63 test: lock malformed port anchor rejection
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
npm test          # 189 tests
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
Generic model-asset work is now active and safe to continue in small slices.
Remaining work:

1. **Product-design-dependent** (confirm intent with product owner first):
   - Dedicated "改进建议" summary panel/badge
   - Richer paid purchase recommendations (which products, when, quantities)
   - "Step-by-step changes after purchase" flow
   - Browser/visual QA of the new fix buttons

2. **If continuing autonomously without product direction**:
   - Continue generic, legally safe, code-native low-poly model assets.
     Good next targets: `gaming-desk`, `standing-desk`, then `l-desk`.
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
