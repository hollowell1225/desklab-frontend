# DeskLab

DeskLab is a connected 3D room desktop layout and cabling tool.

## Local development

Run `npm ci`, then `npm run dev` from this repository. The frontend normally
uses port 5173 and proxies `/api` to the local backend on port 3001.

## Verification

- `npm test`: domain behavior tests.
- `npm run lint` and `npm run build`: source and production-build checks.
- `npm run test:ui`: real headless Google Chrome interaction tests at desktop
  (1440 × 900) and mobile-sized (390 × 844) viewports. Google Chrome must be
  installed on the machine.

The UI suite starts and stops its own Vite process on `127.0.0.1:5174`; that
port must be free. It intercepts every `/api` request with isolated fixtures,
so it needs no backend and never reads or writes the real default project.
Each test uses a fresh browser context. Screenshots, video, and traces are
disabled; assertions check rendered controls, problem reports, undo/redo,
and runtime errors. Test output stays in ignored `test-results/`.

For one scenario, use `npm run test:ui -- --project=desktop --grep "no automatic"`.

Current handoff documentation lives at:

```text
D:\desklab\memory-bank\DeskLab-Claude-memory.md
D:\desklab\memory-bank\DeskLab-model-assets-plan.md
D:\desklab\memory-bank\DeskLab-AI-handoff-template.md
```
