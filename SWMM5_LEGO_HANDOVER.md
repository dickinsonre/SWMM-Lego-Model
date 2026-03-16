# SWMM5 Lego Builder — Detailed Handover Document

## 1. Project Summary

**SWMM5 Lego Builder** is a browser-based interactive stormwater management model editor and simulator. It allows users to build drainage networks on a grid (like building with LEGO blocks), run hydrologic/hydraulic simulations using a full JavaScript implementation of core SWMM5 algorithms, and visualize results in real time — all without installing EPA SWMM5.

- **Type**: Frontend-only React web application (no backend required)
- **Framework**: React + Vite
- **Charting**: Recharts
- **Location**: `artifacts/swmm5-lego/`
- **Entry Point**: `src/components/SWMM5LegoBuilder.jsx` (2,457 lines, single self-contained component)
- **App Shell**: `src/App.tsx` imports and renders the builder component
- **Styling**: Inline styles with the Fredoka Google Font (no Tailwind used in the main component)

---

## 2. Architecture Overview

```
SWMM5LegoBuilder.jsx (single file)
├── CONFIGURATION (lines 1-41)
│   ├── GRID, CELL, SPC constants
│   ├── EL{} — Element definitions (20 types)
│   └── CATS[] — Category groupings
├── DEMO SCENARIOS (lines 43-428)
│   └── 12 pre-built grid layouts
├── DESIGN STORMS ENGINE (lines 430-535)
│   ├── Storm generation helpers (_F, _CD, _IF, _S)
│   ├── STORM_CATS[] — 6 regional categories
│   └── STORMS[] — 49 global storm patterns
├── HYDRAULIC ENGINE (lines 537-817)
│   ├── cnInfiltration() — SCS Curve Number method
│   ├── manningOverland() — Surface runoff
│   ├── manningPipe() — Pipe flow (circular section)
│   ├── buildModel() — Grid → SWMM model builder
│   └── runSWMM5() — Full simulation loop
├── VALIDATION & AUTO-FIX (lines 819-901)
│   ├── validateModel() — Error/warning checker
│   └── autoFix() — Automatic model repair
├── EXPORT/IMPORT (lines 903-1271)
│   ├── exportINP() — Generate SWMM5 .INP file
│   └── importINP() — Parse .INP file onto grid
├── UI COMPONENTS (lines 1273-1363)
│   ├── GridCell — Individual grid cell renderer
│   └── PalBtn — Palette button component
└── MAIN APP COMPONENT (lines 1364-2457)
    ├── State management (25+ useState hooks)
    ├── Tutorial overlay (5-step onboarding)
    ├── Element palette (left panel)
    ├── Grid editor (center)
    ├── Storm selector (right panel)
    ├── SWMM Inspector panel
    ├── Result charts (tabbed: system/subcatch/pipe/node)
    ├── INP export modal
    └── Toolbar actions
```

---

## 3. Element System

### 3.1 Surfaces (10 types)
Each surface has hydrologic properties used in simulation:

| Element | Key | CN | %Imperv | n-Imperv | n-Perv | Ds-Imperv | Ds-Perv |
|---------|-----|-----|---------|----------|--------|-----------|---------|
| Grass | `grass` | 39 | 0% | 0.015 | 0.24 | 0.06" | 0.3" |
| Roof | `roof` | 98 | 100% | 0.012 | 0.1 | 0.05" | 0.05" |
| Road | `road` | 98 | 95% | 0.015 | 0.1 | 0.06" | 0.05" |
| Driveway | `driveway` | 98 | 90% | 0.014 | 0.1 | 0.05" | 0.05" |
| Sidewalk | `sidewalk` | 98 | 95% | 0.014 | 0.1 | 0.05" | 0.05" |
| LID Pond | `lid_pond` | 65 | 10% | 0.1 | 0.3 | 0.1" | 0.5" |
| Perm Pave | `perm_pave` | 72 | 30% | 0.015 | 0.2 | 0.05" | 0.2" |
| Green Roof | `grn_roof` | 55 | 5% | 0.1 | 0.4 | 0.1" | 0.5" |
| Rain Barrel | `rain_brl` | 85 | 50% | 0.015 | 0.2 | 0.5" | 0.3" |
| Swale | `swale` | 58 | 0% | 0.15 | 0.35 | 0.2" | 0.4" |

**Property definitions:**
- **CN** — SCS Curve Number (higher = more runoff)
- **%Imperv (pI)** — Percent impervious area
- **n-Imperv (nI)** — Manning's roughness for impervious surface
- **n-Perv (nP)** — Manning's roughness for pervious surface
- **Ds-Imperv (sI)** — Depression storage depth for impervious (inches)
- **Ds-Perv (sP)** — Depression storage depth for pervious (inches)

### 3.2 Nodes (5 types)

| Element | Key | Max Depth | Role |
|---------|-----|-----------|------|
| Manhole | `manhole` | 6 ft | Standard junction point |
| Inlet | `inlet` | 4 ft | Surface runoff collection point |
| Outfall | `outfall` | — | Free discharge boundary (required) |
| Storage | `storage` | 10 ft | Detention basin / tank |
| Divider | `divider` | 6 ft | Flow splitter |

- Invert elevations are automatically computed: `(GRID - row) * 0.5` feet
- Nodes serve as connection points between pipe chains and subcatchment outlets
- At least one outfall is required for a valid model

### 3.3 Links (5 types)

| Element | Key | Diameter | Manning's n | Role |
|---------|-----|----------|-------------|------|
| Pipe | `pipe` | 1.5 ft (18") | 0.013 | Standard circular conduit |
| Channel | `channel` | 3.0 ft | 0.025 | Open channel |
| Pump | `pump` | 2.0 ft | 0.013 | Pump station |
| Orifice | `orifice` | 1.0 ft (12") | 0.013 | Flow control structure |
| Weir | `weir` | 2.0 ft | 0.013 | Overflow structure |

- Links are placed as grid cells between nodes
- Multiple consecutive link cells form a single conduit
- Length = number of pipe cells * SPC (100 ft per cell)
- Slope computed from upstream/downstream node invert difference

---

## 4. Simulation Engine

### 4.1 Time Stepping
- **Routing timestep (DT_ROUTE)**: 15 seconds
- **Rain timestep (DT_RAIN)**: Storm-dependent (typically 150 seconds = 2.5 min for 1-hr/24-step storms)
- **Total simulation time**: `rain_steps * DT_RAIN` seconds

### 4.2 Hydrology — Subcatchment Runoff

**Model Building (`buildModel()`):**
1. Extracts all nodes from the grid (junctions, outfalls, storage, dividers)
2. Traces link chains via BFS to build conduits connecting pairs of nodes
3. Flood-fills contiguous surface areas to form subcatchments
4. Each subcatchment is assigned to its nearest node (by Manhattan distance)
5. Weighted-average properties (CN, %Imperv) computed across all cells in subcatchment

**Runoff Computation (each timestep):**
1. **Rainfall**: Current intensity from storm hyetograph (in/hr)
2. **Infiltration**: SCS Curve Number method
   - `S = (1000/CN - 10)` inches (potential maximum retention)
   - `Ia = 0.2 * S` (initial abstraction)
   - `F = (P - Ia)^2 / (P - Ia + S)` (cumulative infiltration)
3. **Runoff excess**: Weighted pervious + impervious contributions
   - Pervious: CN-based infiltration
   - Impervious: Rainfall minus depression storage
4. **Overland flow**: Manning's equation
   - `Q = (1.49/n) * W * (d - ds)^(5/3) * S^(1/2)`
   - Where d = ponded depth, ds = depression storage, W = subcatchment width
5. **Volume transfer**: Runoff volume delivered as lateral inflow to outlet node

### 4.3 Hydraulics — Pipe/Node Routing

**Conduit Flow (each timestep):**
1. Head difference: `dh = (upstream_invert + upstream_depth) - (downstream_invert + downstream_depth)`
2. Effective slope: `max(dh / conduit_length, 0.0001)`
3. Manning's pipe flow for circular section:
   - `theta = 2 * acos(1 - 2y)` where y = depth/diameter ratio
   - `A = (D^2/8) * (theta - sin(theta))`
   - `P = (D/2) * theta`
   - `R = A/P`
   - `Q = (1.49/n) * A * R^(2/3) * S^(1/2)`
4. Flow limited to available node volume

**Node Mass Balance:**
- `net_flow = inflow - outflow` (CFS)
- `volume_change = net_flow * DT_ROUTE` (ft^3)
- `depth_change = volume_change / surface_area` (surface area = 12.566 ft^2, ~4ft diameter)
- Depth clamped between 0 and maxDepth
- Outfalls: depth always = 0 (free discharge)

### 4.4 Results Tracking
Every timestep records:
- **System history**: rainfall, total runoff, total pipe flow, outfall flow, average node depth
- **Subcatchment history**: rain, depth, runoff, cumulative rain
- **Conduit history**: flow, depth, velocity
- **Node history**: depth, inflow, outflow, head (HGL)

---

## 5. Design Storm Library

### 5.1 Storm Generation Methods

**Cumulative Distribution (`_CD`):**
- Piecewise cumulative function defined by segments: `[t0, t1, F0, F1, exponent]`
- `F(t) = F0 + (F1-F0) * ((t-t0)/(t1-t0))^exp`
- Rainfall intensity derived from incremental differences: `rain[i] = (F(i+1) - F(i)) * P / dt`

**Intensity Function (`_IF`):**
- Direct intensity function `f(t)` scaled to match total depth P
- `total = integral(f(t) * dt)`
- `scale = P / total`
- `rain[i] = f(t_midpoint) * scale`

### 5.2 Complete Storm Catalog (49 storms)

**US Standards (12 storms):**
- SCS Type II (continental US standard)
- SCS Type III (Gulf Coast/tropical)
- SCS Type I (Pacific maritime)
- SCS Type IA (Pacific NW coastal)
- Balanced Alternating Block (IDF-derived)
- NOAA Atlas 14 (modern gage data)
- Huff 1st-4th Quartile (Illinois-based temporal distributions)
- USACE Standard Project (dam safety, 4" over 6 hrs)
- PMP HMR 51/52 (Probable Maximum Precipitation, 5" over 6 hrs)

**US State/Local (7 storms):**
- FDOT Zones 1-5 (Florida DOT, 5 climate zones)
- TxDOT Empirical (Texas DOT)
- UDFCD Denver (Urban Drainage, Rocky Mountain)

**Europe (12 storms):**
- Triangular UK FSR, Trapezoidal
- UK FSR Profile 75%, FEH Temporal
- Chicago Storm (Keifer & Chu)
- French Desbordes (standard and double-triangle variants)
- German DWA-A 531, Euler Type I, Euler Type II
- Dutch STOWA, Italian Mediterranean

**Asia-Pacific (12 storms):**
- Japan JMA (typhoon), AMeDAS Convective, Baiu Frontal, Japan Typhoon (dual peak)
- China Design Storm, China GB 50014-2021, Pearl River Delta
- India IMD Monsoon, India Coastal Cyclonic
- Korea KMA Standard
- Singapore PUB (tropical)
- Australian ARR (ensemble median)

**Other Regions (2 storms):**
- South African Huff (modified 2nd quartile)
- Canadian CDA/MTO (cold climate)

**Generic (4 storms):**
- Block Uniform (constant 1 in/hr — calibration baseline)
- Double Peak (dual Gaussian — multi-cell convective)
- Yen & Chow Triangular (r=0.375)
- Custom Uniform (flat baseline — modify as needed)

### 5.3 Storm Categories for UI Filtering
| Key | Label |
|-----|-------|
| `us` | US Standards |
| `us_state` | US State/Local |
| `europe` | Europe |
| `asia` | Asia-Pacific |
| `other` | Other Regions |
| `generic` | Generic |

---

## 6. Demo Scenarios (12 Models)

| # | Name | Description | Key Features |
|---|------|-------------|--------------|
| 1 | Residential | Suburban neighborhood | Houses, lawns, driveways, trunk sewer down road corridor |
| 2 | Parking Lot | Commercial lot | Mostly impervious, LID bioswales on edges |
| 3 | Green Infra | Low-impact development | Bioretention cells, grass channels, minimal impervious |
| 4 | Highway | Highway corridor | Shoulders, median, roadside drainage with cross-pipe |
| 5 | Mixed-Use | Downtown block | Buildings, roads, sidewalks, LID plaza, dual building blocks |
| 6 | School Campus | School complex | Athletic fields, parking, dual outfalls, LID courtyard |
| 7 | Industrial | Warehouse district | Large roofs, loading docks, heavy trunk sewer |
| 8 | Hillside | Steep terrain | Terraced development, cascading zigzag sewer, erosion control |
| 9 | Hospital | Hospital complex | Emergency wing, helipad, redundant dual trunk sewers |
| 10 | Dual Outfall | Split drainage | East/west basins discharging to separate outfalls |
| 11 | Stadium | Large venue | Vast roof, surrounding plazas, 4-corner drainage to center trunk |
| 12 | Minimal Test | Simplest model | 1 surface area, 1 inlet, 3 pipes, 1 outfall |

---

## 7. SWMM5 .INP File Integration

### 7.1 Export (`exportINP()`)
Generates a complete SWMM5 input file containing all standard sections:

| Section | Content |
|---------|---------|
| `[TITLE]` | Build timestamp |
| `[OPTIONS]` | CFS units, CURVE_NUMBER infiltration, DYNWAVE routing |
| `[RAINGAGES]` | Single rain gage (RG1) linked to timeseries |
| `[SUBCATCHMENTS]` | Area, %imperv, width, slope per subcatchment |
| `[SUBAREAS]` | Manning's n values and depression storage |
| `[INFILTRATION]` | Curve numbers per subcatchment |
| `[JUNCTIONS]` | Elevation, max depth, init depth per junction |
| `[OUTFALLS]` | Elevation, FREE boundary condition |
| `[CONDUITS]` | From/to nodes, length, Manning's n |
| `[XSECTIONS]` | CIRCULAR cross-section, diameter |
| `[TIMESERIES]` | Design storm rainfall intensities |
| `[COORDINATES]` | Node X,Y coordinates (grid-based, SPC ft spacing) |
| `[REPORT]` | ALL subcatchments, nodes, links |

**Exported files run directly in EPA SWMM5** without modification.

### 7.2 Import (`importINP()`)

Parses standard SWMM5 .INP files and maps elements onto the grid:

1. **Sections parsed**: OPTIONS, JUNCTIONS, OUTFALLS, STORAGE, DIVIDERS, CONDUITS, PUMPS, ORIFICES, WEIRS, SUBCATCHMENTS, SUBAREAS, INFILTRATION, XSECTIONS, COORDINATES, POLYGONS
2. **Grid auto-sizing**: Estimates grid size from model complexity (nodes + links + subcatchments), clamped to 20-60
3. **Coordinate mapping**: Transforms SWMM X,Y coordinates to grid row,col with margin
4. **Node placement**: Junctions (auto-detect inlet by name), outfalls, storage, dividers
5. **Link tracing**: Manhattan path (horizontal then vertical) between node pairs
6. **Subcatchment surfaces**: Uses polygon coordinates if available, otherwise places around outlet node. Surface type chosen by %imperviousness
7. **Infiltration methods**: Supports CURVE_NUMBER, HORTON, GREEN_AMPT detection
8. **Import log**: Detailed summary of all imported elements, warnings, and subcatchment properties

---

## 8. User Interface Components

### 8.1 Tutorial System
- 5-step guided onboarding overlay
- Step indicators with progress bar
- Covers: welcome, painting, pipe building, validation, simulation, export
- Dismissable, re-accessible via "?" button

### 8.2 Element Palette (Left Panel)
- Grouped by category: SURFACES, NODES, LINKS
- Paint/Erase toggle
- Selected element properties display (CN, Manning's n, capacity calculations)
- SWMM5 equations reference panel

### 8.3 Grid Editor (Center)
- Resizable: 20x20, 25x25, 30x30, 40x40, 50x50
- Cell size: 34px (CELL constant)
- Click to place, drag to paint
- Hover tooltip with element properties and coordinates
- Error cells flash red border
- Flow animation during simulation (blue glow for pipe flow, yellow glow for node depth)
- Water level indicator bars on nodes during sim

### 8.4 Toolbar
| Button | Action |
|--------|--------|
| Undo | Restores previous grid state (30-level history) |
| Clear | Empties entire grid |
| Demos | Opens demo picker panel |
| Validate | Runs model validation |
| Fix | Auto-repairs model errors |
| Run SWMM5 | Starts simulation |
| Stop/Reset | Controls simulation playback |
| Export .inp | Generates downloadable SWMM5 file |
| Import .inp | File picker for .INP files |
| Grid size buttons | Resize grid (20-50) |

### 8.5 Storm Selector (Right Panel)
- Category filter dropdown (All, US, Europe, Asia, etc.)
- Scrollable storm list with name, description, total depth, peak intensity
- Selected storm highlighted with color accent
- Storm hyetograph bar chart preview

### 8.6 SWMM Inspector
- Appears when clicking any grid cell
- 3-column layout:
  - **Properties**: Core SWMM parameters (CN, Manning's n, diameter, etc.)
  - **Computed**: Derived hydraulics (full-pipe capacity, hydraulic radius, Froude number)
  - **Live Simulation**: Real-time values during simulation (flow, depth, velocity, HGL)
- Shows SWMM section mapping ([JUNCTIONS], [CONDUITS], [SUBCATCHMENTS])
- Grid and SWMM coordinates displayed

### 8.7 Simulation Status Bar
- Running/Complete indicator
- Current time (minutes)
- Current rainfall intensity
- Storm name
- Progress bar

### 8.8 Result Charts (Tabbed)

| Tab | Charts | Data |
|-----|--------|------|
| System | Hydrograph (4 lines) | Rainfall, Total Runoff, Pipe Flow, Outfall Flow vs time |
| Subcatchments | Individual subcatchment hydrographs | Runoff, Rainfall, Ponded Depth per subcatchment |
| Pipes | Conduit result plots | Flow, Velocity, Depth per conduit |
| Nodes | Node result plots | Depth, Inflow, Outflow, HGL per node |

### 8.9 Export Modal
- Full .INP text displayed in scrollable pre-formatted view
- Copy to clipboard button
- Download as .inp file button

---

## 9. Validation System

### 9.1 Errors (block simulation)
- Model is empty (no elements placed)
- No outfall present (required by SWMM5)
- Disconnected link cells (pipe/channel with no adjacent node or link)

### 9.2 Warnings (informational)
- Surfaces exist but no nodes to drain to

### 9.3 Auto-Fix (`autoFix()`)
- Adds outfall adjacent to lowest node if none exists
- Adds inlet + outfall if surfaces exist but no nodes

---

## 10. State Management

The main component uses 25+ React useState hooks:

| State | Type | Purpose |
|-------|------|---------|
| `gridSize` | number | Current grid dimension (20-50) |
| `grid` | string[][] | 2D array of element keys (null = empty) |
| `sel` | string | Currently selected palette element |
| `hov` | string | Hovered cell ID ("r-c") |
| `erasing` | boolean | Erase mode toggle |
| `painting` | boolean | Mouse-drag painting active |
| `hist` | string[][][] | Undo history (last 30 states) |
| `validation` | object | Current validation results |
| `fixLog` | string[] | Auto-fix/import log messages |
| `simResult` | object | Full simulation output |
| `stormIdx` | number | Selected storm index |
| `stormCat` | string | Storm category filter |
| `simStep` | number | Current animation frame |
| `isRunning` | boolean | Animation loop active |
| `showInp` | boolean | Export modal visible |
| `inpText` | string | Generated .INP content |
| `tab` | string | Active results tab |
| `inspCell` | {r,c} | Inspected grid cell |
| `showTutorial` | boolean | Tutorial overlay visible |
| `tutStep` | number | Current tutorial step |
| `showDemos` | boolean | Demo picker visible |

---

## 11. Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `GRID` | 20 (default) | Grid dimension (mutable, 20-50) |
| `CELL` | 34 | Cell size in pixels |
| `SPC` | 100 | Spatial spacing in feet per cell |
| `DT_ROUTE` | 15 | Routing timestep in seconds |

---

## 12. File Structure

```
artifacts/swmm5-lego/
├── src/
│   ├── App.tsx                          # App shell (imports SWMM5LegoBuilder)
│   ├── main.tsx                         # React entry point
│   ├── index.css                        # Minimal global styles + Fredoka font
│   └── components/
│       └── SWMM5LegoBuilder.jsx         # Main application (2,457 lines)
├── index.html                           # HTML template
├── vite.config.ts                       # Vite configuration
├── package.json                         # Dependencies (React, Recharts, etc.)
├── tsconfig.json                        # TypeScript config
└── components.json                      # shadcn/ui config (unused by main component)
```

---

## 13. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | (catalog) | UI framework |
| react-dom | (catalog) | DOM rendering |
| recharts | ^2.15.2 | Charts (LineChart, BarChart) |
| vite | (catalog) | Build tool / dev server |
| @vitejs/plugin-react | (catalog) | React Fast Refresh |

Note: The project scaffolding includes many shadcn/ui and Radix UI packages, but the SWMM5 component uses none of them — it's entirely self-contained with inline styles.

---

## 14. Known Limitations & Assumptions

1. **Simplified hydraulics**: Uses kinematic wave approximation, not full dynamic wave (Saint-Venant equations)
2. **Uniform node geometry**: All nodes modeled as ~4 ft diameter manholes (surface area = 12.566 ft^2)
3. **No evaporation or groundwater**: Only infiltration and surface runoff
4. **Circular pipes only**: All links treated as circular cross-section regardless of type
5. **Single rain gage**: Entire model receives uniform rainfall
6. **No snow melt, water quality, or pollutant transport**
7. **Grid-based elevation**: Invert = (GRID - row) * 0.5 ft — always slopes top-to-bottom
8. **Link types (pump, orifice, weir)**: Rendered differently but all use Manning's pipe equation
9. **No backwater effects**: Flow cannot reverse direction
10. **Browser-only**: All computation runs client-side in the browser

---

## 15. Potential Enhancements

1. Custom element properties editing (per-cell CN, diameter, Manning's n)
2. Multiple rain gages for spatial variability
3. Time-series result export (CSV/JSON)
4. Dynamic wave routing (full Saint-Venant)
5. Green infrastructure detailed modeling (LID controls with multiple layers)
6. Pump curves, orifice coefficients, weir equations
7. Custom storm entry (user-defined hyetograph)
8. Multiple subcatchment routing options (PERVIOUS, IMPERVIOUS)
9. Save/load model to browser localStorage or cloud
10. Side-by-side scenario comparison
11. Real IDF curve integration for storm generation
12. Touch support for mobile/tablet use

---

## 16. Running the Application

**Development:**
```bash
pnpm --filter @workspace/swmm5-lego run dev
```

**Production Build:**
```bash
pnpm --filter @workspace/swmm5-lego run build
```

Output: `artifacts/swmm5-lego/dist/public/` (static files, serve with any HTTP server)

---

## 17. Quick Start for New Developers

1. Open `artifacts/swmm5-lego/src/components/SWMM5LegoBuilder.jsx`
2. The file is organized in clearly labeled sections (search for `═══`)
3. To add a new surface type: Add entry to `EL{}` object with `cat: "surface"` and properties
4. To add a new demo: Add object to `DEMOS[]` array with `name`, `desc`, and `build()` function
5. To add a new storm: Use `_S()` helper with `_CD()` (cumulative) or `_IF()` (intensity function)
6. To modify simulation: Edit `runSWMM5()` function — the main simulation loop
7. To change grid appearance: Modify `GridCell` component (line 1273)
8. To add new result charts: Add tab in the results section of `SWMM5LegoBuilder` (around line 2130)

---

*Document generated: March 2026*
*SWMM5 Lego Builder v1.0*
