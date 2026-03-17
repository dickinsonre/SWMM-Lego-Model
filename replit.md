# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── swmm5-lego/         # SWMM5 Lego Builder (React + Vite, frontend-only)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Applications

### SWMM5 Lego Builder (`artifacts/swmm5-lego`)

Interactive browser-based stormwater management model builder. Features:
- Grid-based editor for painting surfaces (grass, roof, road, etc.), nodes (manhole, inlet, outfall), and links (pipe, channel, pump)
- Full JavaScript SWMM5 simulation engine with SCS Curve Number infiltration, Manning's overland flow, and Manning's pipe flow
- 49 design storms from 6 continents (US SCS Types, European, Asian, etc.)
- Real-time animated simulation with flow visualization on the grid
- Result charts (system hydrograph, subcatchment, pipe, and node results)
- SWMM Inspector panel for live element data during simulation
- Export to .INP format (compatible with EPA SWMM5)
- Import .INP files from EPA SWMM5
- 13 built-in demo scenarios (Residential, Parking Lot, Green Infra, Highway, Mixed-Use, School Campus, Industrial, Hillside, Hospital, Dual Outfall, Stadium, Stadium Simple, Minimal Test)
- Resizable grid (20x20 to 50x50)
- Model validation with CFL Courant number checks and auto-fix
- Per-cell property editing via right-click context menu (override CN, % imperv, Manning's n, slope, pipe diameter, node depth)
- Time-series CSV export for all result tabs
- Save/Load to localStorage (auto-save + 5 named slots)
- No backend required — entirely frontend

**Visual Theme**: Full LEGO brick aesthetic
- Color palette: Red #D01012, Green #70C442/#4B9F4A, Blue #006DB7/#5A93DB, Yellow #F2C717, Orange #FE8A18, Gray #6C6E68, Navy #1B2A34, Off-white #F4F4F4
- 3D brick shadows on grid cells and palette buttons (inset highlights + drop shadow)
- Green baseplate grid with stud dot radial-gradient pattern
- White "instruction booklet" style side panels with gray borders and drop shadows
- LEGO-colored toolbar buttons, red/yellow tutorial overlay, Fredoka + Nunito fonts
- Inspector, validation, results, and export panels all use light #F4F4F4 backgrounds
- Grid cell borders: red=error, orange=CFL/validation warning, yellow=custom property override

**Dual Simulation Engines**:
1. **JS Engine** (🚀 RUN SWMM5): Animated real-time simulation with SCS CN infiltration, Manning's equations, 15-second routing timestep, flow visualization on grid
2. **EPA SWMM5 WASM** (🔬 EPA SWMM5): Full EPA SWMM5 solver compiled to WebAssembly, runs entirely in-browser with Dynamic Wave routing, produces standard .RPT output with 6-tab results viewer (Summary, Subcatchments, Nodes, Links, Continuity, Raw RPT) including recharts bar charts

**Key dependencies**: React, recharts (charts), Vite (build)

**Architecture** (modularized):
- `src/components/SWMM5LegoBuilder.jsx` — Main React component (~1828 lines, inline styles)
- `src/lib/elements.js` — Element definitions (EL, CATS), grid utilities, mutable GRID via getGrid()/setGrid()
- `src/lib/storms.js` — 49 design storms with storm category definitions
- `src/lib/hydraulics.js` — SWMM5 JS engine (buildModel, runSWMM5, Manning's equations, CN infiltration)
- `src/lib/swmmWasm.js` — EPA SWMM5 WASM wrapper (Emscripten module loader, virtual FS I/O, ccall to swmm_run)
- `src/lib/parseRpt.js` — SWMM5 .RPT output parser (subcatchments, nodes, links, continuity, analysis options)
- `src/lib/validation.js` — Model validation with CFL checks and auto-fix
- `src/lib/exportCsv.js` — Time-series CSV export
- `src/lib/persistence.js` — localStorage save/load (auto-save + named slots)
- `src/lib/exportInp.js` — SWMM5 .INP file export
- `src/lib/importInp.js` — SWMM5 .INP file import with auto grid sizing
- `src/lib/demos.js` — 13 demo model builders
- `src/components/LegoToolbar.css` — 3D LEGO brick toolbar CSS (studs, depth borders, press animations, color variants via data-color)
- `public/swmm/` — EPA SWMM5 v5.2.4 WASM binaries (js.wasm, js.js compiled from OWA SWMM v5.2.4 source with Emscripten 2.0.10)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
