import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, CartesianGrid, ReferenceLine } from "recharts";

import { getGrid, setGrid as setGridGlobal, CELL, SPC, EL, CATS, emptyGrid } from "../lib/elements.js";
import { STORM_CATS, STORMS } from "../lib/storms.js";
import { runSWMM5 } from "../lib/hydraulics.js";
import { validateModel, autoFix } from "../lib/validation.js";
import { exportResultsCsv } from "../lib/exportCsv.js";
import { saveToLocalStorage, loadFromLocalStorage, getSaveSlots, saveToSlot, deleteSlot } from "../lib/persistence.js";
import { exportINP } from "../lib/exportInp.js";
import { importINP } from "../lib/importInp.js";
import { DEMOS } from "../lib/demos.js";
import { initSwmmWasm, runSwmmWasm, isSwmmReady } from "../lib/swmmWasm.js";
import { parseRpt } from "../lib/parseRpt.js";
import "./LegoToolbar.css";

function GridCell({ element, isHov, hasErr, hasWarn, hasOverride, flowIntensity, depthFrac, row, col }) {
  const el = element ? EL[element] : null;
  const base = el ? el.clr : "transparent";
  const GRID = getGrid();

  let flowGlow = "";
  if (flowIntensity > 0 && el) {
    const alpha = Math.min(flowIntensity, 1);
    flowGlow = `, inset 0 0 ${8 + alpha * 12}px rgba(56,189,248,${alpha * 0.8})`;
  }
  if (depthFrac > 0 && el?.cat === "node") {
    const alpha = Math.min(depthFrac, 1);
    flowGlow = `, inset 0 0 ${10 + alpha * 14}px rgba(251,191,36,${alpha * 0.7})`;
  }

  let tip = `(${row}, ${col})`;
  if (el) {
    tip = `${el.e} ${el.lbl} @ (${row}, ${col})`;
    if (el.cat === "surface") tip += `\nCN: ${el.cn} • %Imperv: ${el.pI}`;
    if (el.cat === "surface") tip += `\nn-Imperv: ${el.nI} • n-Perv: ${el.nP}`;
    if (el.cat === "surface") tip += `\nDs-Imp: ${el.sI}" • Ds-Perv: ${el.sP}"`;
    if (el.cat === "node" && el.maxD) tip += `\nMax Depth: ${el.maxD} ft`;
    if (el.cat === "node") tip += `\nInvert: ${((GRID - row) * 0.5).toFixed(1)} ft`;
    if (el.cat === "link") tip += `\nDia: ${el.diam} ft • n: ${el.mann}`;
    if (el.cat === "surface") tip += `\n→ [SUBCATCHMENTS]`;
    if (element === "manhole" || element === "inlet") tip += `\n→ [JUNCTIONS]`;
    if (element === "outfall") tip += `\n→ [OUTFALLS]`;
    if (element === "pipe") tip += `\n→ [CONDUITS]`;
    if (hasOverride) tip += `\n★ Custom properties (right-click to edit)`;
    if (flowIntensity > 0) tip += `\n🌊 Flow: ${(flowIntensity * 2).toFixed(3)} CFS`;
    if (depthFrac > 0) tip += `\n💧 Depth: ${(depthFrac * (el.maxD || 6)).toFixed(2)} ft`;
  } else {
    tip += "\nEmpty — click to place\nRight-click placed cells to edit properties";
  }

  const extraShadow = flowGlow ? flowGlow : "";
  const borderStyle = hasErr ? "2px solid #D01012" : hasWarn ? "2px solid #FE8A18" : hasOverride ? "2px solid #F2C717" : isHov && !el ? "2px solid rgba(255,255,255,0.25)" : "none";
  const errShadow = hasErr ? `0 0 8px rgba(208,16,18,0.6)${extraShadow}` : hasWarn ? `0 0 8px rgba(254,138,24,0.5)${extraShadow}` : "";

  return (
    <div title={tip} className={`lego-grid-cell${el ? " filled" : ""}`} style={{
      width: CELL, height: CELL,
      background: el ? base : "transparent",
      border: borderStyle,
      fontSize: el ? 13 : 0,
      ...(errShadow ? { boxShadow: errShadow } : {}),
      ...(extraShadow && !hasErr && !hasWarn && el ? { boxShadow: `inset 3px 3px 0 0 rgba(255,255,255,0.25), inset -3px -4px 0 0 rgba(0,0,0,0.30), 2px 3px 0 0 rgba(0,0,0,0.40)${extraShadow}` } : {}),
    }}>
      {el && <div className="stud" />}
      <span style={{ position: "relative", zIndex: 2, textShadow: el ? "1px 1px 0 rgba(0,0,0,0.4)" : "none" }}>{el ? el.e : ""}</span>
      {depthFrac > 0 && el?.cat === "node" && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: `${Math.min(depthFrac * 100, 100)}%`,
          background: "rgba(56,189,248,0.35)",
          borderRadius: "0 0 2px 2px",
          transition: "height 0.3s ease",
        }} />
      )}
    </div>
  );
}

function PalBtn({ type, sel, onClick }) {
  const el = EL[type];
  const on = sel === type;
  return (
    <button onClick={() => onClick(type)} title={`${el.lbl}${el.cn !== undefined ? ` • CN:${el.cn} • %Imp:${el.pI}` : ""}${el.maxD ? ` • MaxD:${el.maxD}ft` : ""}${el.diam ? ` • Dia:${el.diam}ft` : ""}`}
      className={`lego-pal-btn${on ? " selected" : ""}`}
      style={{
        background: on ? el.clr : undefined,
        color: on ? "#fff" : "#A0A19B",
        fontWeight: on ? 700 : 500,
        borderBottomColor: on ? "rgba(0,0,0,0.35)" : undefined,
      }}>
      <span style={{ fontSize: 13, lineHeight: 1, position: "relative", zIndex: 2, textShadow: on ? "1px 1px 0 rgba(0,0,0,0.5)" : "none" }}>{el.e}</span>
      <span style={{ fontSize: 7, lineHeight: 1, position: "relative", zIndex: 2, textShadow: on ? "1px 1px 0 rgba(0,0,0,0.5)" : "none", fontWeight: 800 }}>{el.lbl}</span>
    </button>
  );
}

export default function SWMM5LegoBuilder() {
  const [gridSize, setGridSize] = useState(20);
  const [grid, setGrid] = useState(() => { setGridGlobal(20); return emptyGrid(20); });
  const [sel, setSel] = useState("grass");
  const [hov, setHov] = useState(null);
  const [erasing, setErasing] = useState(false);
  const [painting, setPainting] = useState(false);
  const [hist, setHist] = useState([]);
  const [validation, setValidation] = useState(null);
  const [fixLog, setFixLog] = useState([]);
  const [simResult, setSimResult] = useState(null);
  const [stormIdx, setStormIdx] = useState(0);
  const [stormCat, setStormCat] = useState("all");
  const [simStep, setSimStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showInp, setShowInp] = useState(false);
  const [inpText, setInpText] = useState("");
  const [tab, setTab] = useState("system");
  const [inspCell, setInspCell] = useState(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [tutStep, setTutStep] = useState(0);
  const [cellProps, setCellProps] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [saveSlots, setSaveSlots] = useState(() => getSaveSlots());
  const [saveName, setSaveName] = useState("");

  const [wasmLoading, setWasmLoading] = useState(false);
  const [wasmRpt, setWasmRpt] = useState(null);
  const [wasmParsed, setWasmParsed] = useState(null);
  const [showRpt, setShowRpt] = useState(false);
  const [rptTab, setRptTab] = useState("summary");
  const animRef = useRef(null);
  const fileRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const gridRef = useRef(null);

  const save = useCallback(() => setHist(h => [...h.slice(-30), { grid: grid.map(r => [...r]), gridSize }]), [grid, gridSize]);
  const place = useCallback((r, c) => setGrid(p => { const n = p.map(x => [...x]); n[r][c] = erasing ? null : sel; return n; }), [sel, erasing]);

  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved && saved.grid && saved.grid.length > 0) {
      setGridGlobal(saved.gridSize || saved.grid.length);
      setGridSize(getGrid());
      setGrid(saved.grid);
      if (saved.stormIdx !== undefined) setStormIdx(saved.stormIdx);
      if (saved.cellProps) setCellProps(saved.cellProps);
    }
  }, []);

  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveToLocalStorage(grid, gridSize, stormIdx, cellProps);
    }, 1000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [grid, gridSize, stormIdx, cellProps]);

  const SURFACE_KEYS = ["grass","roof","road","driveway","sidewalk","lid_pond","perm_pave","grn_roof","rain_brl","swale"];
  const NODE_KEYS = ["manhole","inlet","outfall","storage","divider"];
  const LINK_KEYS = ["pipe","channel","pump","orifice","weir"];

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A" || e.target.isContentEditable || e.target.getAttribute("role") === "button") return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (hist.length) { const entry = hist[hist.length-1]; setGridGlobal(entry.gridSize); setGridSize(entry.gridSize); setGrid(entry.grid); setHist(h => h.slice(0,-1)); }
          return;
        }
      }
      if (e.key === "Escape") {
        setShowInp(false); setShowRpt(false); setShowSavePanel(false); setShowDemos(false); setCtxMenu(null); setInspCell(null);
        return;
      }
      if (e.key === " ") { e.preventDefault(); setErasing(v => !v); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setErasing(true); return; }
      if (e.key === "r" || e.key === "R") { if (!e.ctrlKey && !e.metaKey && !isRunning) { doRun(); } return; }
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        if (e.shiftKey) {
          if (num <= NODE_KEYS.length) { setSel(NODE_KEYS[num-1]); setErasing(false); }
        } else {
          if (num <= SURFACE_KEYS.length) { setSel(SURFACE_KEYS[num-1]); setErasing(false); }
        }
        return;
      }
      if (e.key === "q" || e.key === "Q") { setSel(LINK_KEYS[0]); setErasing(false); }
      if (e.key === "w" || e.key === "W") { if (!e.ctrlKey) { setSel(LINK_KEYS[1]); setErasing(false); } }
      if (e.key === "e" || e.key === "E") { if (!e.ctrlKey) { setSel(LINK_KEYS[2]); setErasing(false); } }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const touchToCell = useCallback((touch) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left + gridRef.current.scrollLeft;
    const y = touch.clientY - rect.top + gridRef.current.scrollTop;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) return { r, c };
    return null;
  }, [gridSize]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const cell = touchToCell(e.touches[0]);
    if (cell) { save(); place(cell.r, cell.c); setInspCell(cell); setPainting(true); }
  }, [touchToCell, save, place]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (!painting || e.touches.length !== 1) return;
    const cell = touchToCell(e.touches[0]);
    if (cell) place(cell.r, cell.c);
  }, [painting, touchToCell, place]);

  const handleTouchEnd = useCallback(() => { setPainting(false); }, []);

  const resizeGrid = (newSize) => {
    save();
    setGridGlobal(newSize);
    setGridSize(newSize);
    const newGrid = emptyGrid(newSize);
    const copyR = Math.min(grid.length, newSize);
    const copyC = Math.min(grid[0]?.length || 0, newSize);
    for (let r = 0; r < copyR; r++)
      for (let c = 0; c < copyC; c++)
        newGrid[r][c] = grid[r][c];
    setGrid(newGrid);
    doReset();
  };

  const doImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      save();
      const result = importINP(text);
      if (result.gridSize && result.gridSize !== gridSize) {
        setGridGlobal(result.gridSize);
        setGridSize(result.gridSize);
      }
      setGrid(result.grid);
      doReset(); setValidation(null);
      const log = [];
      log.push(`📂 Imported: ${file.name}`);
      if (result.gridSize) log.push(`📐 Grid auto-sized to ${result.gridSize}×${result.gridSize} (${result.gridSize * result.gridSize} cells)`);
      if (result.counts) {
        const c = result.counts;
        const parts = [];
        if (c.nJunctions) parts.push(`${c.nJunctions} junctions`);
        if (c.nOutfalls) parts.push(`${c.nOutfalls} outfalls`);
        if (c.nStorage) parts.push(`${c.nStorage} storage`);
        if (c.nDividers) parts.push(`${c.nDividers} dividers`);
        if (c.nConduits) parts.push(`${c.nConduits} conduits`);
        if (c.nPumps) parts.push(`${c.nPumps} pumps`);
        if (c.nOrifices) parts.push(`${c.nOrifices} orifices`);
        if (c.nWeirs) parts.push(`${c.nWeirs} weirs`);
        if (c.nSubcatch) parts.push(`${c.nSubcatch} subcatchments`);
        log.push(`📊 ${parts.join(", ")}`);
      }
      if (result.options) {
        const o = result.options;
        if (o.FLOW_UNITS) log.push(`⚙️ Units: ${o.FLOW_UNITS}`);
        if (o.INFILTRATION) log.push(`⚙️ Infiltration: ${o.INFILTRATION}`);
        if (o.FLOW_ROUTING) log.push(`⚙️ Routing: ${o.FLOW_ROUTING}`);
      }
      if (result.subcatchInfo && result.subcatchInfo.length > 0) {
        log.push(`─── SUBCATCHMENTS ───`);
        result.subcatchInfo.forEach(sc => {
          log.push(`🟢 ${sc.id}: ${sc.area} ac, ${sc.pctImperv}% imp, CN=${sc.cn}, → ${sc.outlet}`);
          log.push(`   n-Imp=${sc.nI} n-Perv=${sc.nP} Ds-Imp=${sc.sI}" Ds-Perv=${sc.sP}" ${sc.routing}`);
          if (sc.infiltMethod === "HORTON") {
            log.push(`   HORTON: f₀=${sc.hortonMax} fₘᵢₙ=${sc.hortonMin} decay=${sc.hortonDecay}`);
          } else if (sc.infiltMethod === "GREEN_AMPT") {
            log.push(`   GREEN-AMPT: ψ=${sc.gaSuction}" K=${sc.gaConduct} θᵢ=${sc.gaDeficit}`);
          }
          log.push(`   Grid: ${sc.cellsPlaced} cells as ${sc.surfType}`);
        });
      }
      if (result.warnings.length > 0) {
        log.push(`─── WARNINGS ───`);
        result.warnings.forEach(w => log.push(`⚠️ ${w}`));
      }
      setFixLog(log);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => { const up = () => setPainting(false); window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);

  useEffect(() => {
    if (!isRunning || !simResult) return;
    const maxStep = simResult.systemHistory.length - 1;
    animRef.current = setInterval(() => {
      setSimStep(s => {
        if (s >= maxStep) { setIsRunning(false); clearInterval(animRef.current); return maxStep; }
        return s + 1;
      });
    }, 50);
    return () => clearInterval(animRef.current);
  }, [isRunning, simResult]);

  const flowState = useMemo(() => {
    if (!simResult || simStep === 0) return {};
    const state = {};
    simResult.conduits.forEach(cd => {
      const h = cd.history[simStep];
      if (h) cd.pipes.forEach(p => { state[`${p.r}-${p.c}`] = { flow: Math.min(h.flow / 2, 1) }; });
    });
    simResult.allNodes.forEach(n => {
      const h = n.history[simStep];
      if (h) state[`${n.r}-${n.c}`] = { depth: h.depth / (n.maxDepth || 6) };
    });
    return state;
  }, [simResult, simStep]);

  const errCells = useMemo(() => validation?.errCells || new Set(), [validation]);

  const doRun = () => {
    const v = validateModel(grid);
    setValidation(v);
    if (v.errors.length > 0) return;
    const result = runSWMM5(grid, STORMS[stormIdx], cellProps);
    if (!result) return;
    setSimResult(result);
    setSimStep(0);
    setIsRunning(true);
  };

  const doStop = () => { setIsRunning(false); clearInterval(animRef.current); };
  const doReset = () => { doStop(); setSimResult(null); setSimStep(0); };

  const doExport = () => {
    const v = validateModel(grid);
    setValidation(v);
    if (v.errors.length > 0) return;
    setInpText(exportINP(grid, STORMS[stormIdx], cellProps));
    setShowInp(true);
  };

  const doRunWasm = async () => {
    const v = validateModel(grid);
    setValidation(v);
    if (v.errors.length > 0) return;
    setWasmLoading(true);
    setWasmRpt(null); setWasmParsed(null);
    try {
      const inp = exportINP(grid, STORMS[stormIdx], cellProps);
      const { returnCode, rpt } = await runSwmmWasm(inp);
      setWasmRpt(rpt);
      const parsed = parseRpt(rpt);
      if (returnCode !== 0 && parsed.errors.length === 0) {
        parsed.errors.push(`SWMM5 returned code ${returnCode}`);
      }
      setWasmParsed(parsed);
      setShowRpt(true);
      setRptTab("summary");
    } catch (e) {
      setWasmRpt(`Error: ${e.message}`);
      setWasmParsed({ errors: [e.message], warnings: [], subcatchRunoff: [], nodeDepth: [], nodeInflow: [], nodeFlooding: [], outfallLoading: [], linkFlow: [], analysisOptions: {}, runoffQuantity: {}, routingSummary: {}, raw: '' });
      setShowRpt(true);
    }
    setWasmLoading(false);
  };

  const doFix = () => { save(); const f = autoFix(grid); setGrid(f.grid); setFixLog(f.fixes); setValidation(validateModel(f.grid)); };

  const warnCells = useMemo(() => validation?.warnCells || new Set(), [validation]);
  const [showDemos, setShowDemos] = useState(false);

  const loadDemo = (idx) => {
    save();
    setGrid(DEMOS[idx].build());
    doReset(); setValidation(null); setFixLog([]);
    setShowDemos(false);
  };

  const curTime = simResult && simStep < simResult.systemHistory.length ? simResult.systemHistory[simStep].t : 0;

  const chartData = useMemo(() => {
    if (!simResult) return [];
    return simResult.systemHistory.slice(0, simStep + 1);
  }, [simResult, simStep]);

  const GRID = getGrid();

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(145deg, #1B2A34, #2A3A44 50%, #1B2A34)",
      color: "#F4F4F4", fontFamily: "'Fredoka', 'Nunito', system-ui, sans-serif", padding: 12,
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700;800&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet" />

      {showTutorial && (() => {
        const steps = [
          { title: "🧱 Welcome to SWMM5 Lego Builder!", sub: "Build stormwater networks like LEGO — drag, drop, simulate!", icon: "🌧️",
            body: "This is a browser-based SWMM5 model editor with a full JavaScript hydraulic engine. You can paint surfaces, place pipes and nodes, then run real-time simulations — all without installing EPA SWMM5.",
            visual: [
              { e: "🌱", l: "Grass", c: "#70C442" }, { e: "🏠", l: "Roof", c: "#FE8A18" }, { e: "🛣️", l: "Road", c: "#6C6E68" },
              { e: "🔵", l: "Manhole", c: "#F2C717" }, { e: "🟫", l: "Pipe", c: "#5A93DB" }, { e: "🔴", l: "Outfall", c: "#D01012" },
            ]},
          { title: "🎨 Step 1: Paint Your Catchment", sub: "Select elements from the palette and paint on the grid", icon: "🖌️",
            body: "LEFT PANEL: Click any element to select it. GRID: Click or drag to paint. Each surface type has real SWMM5 properties — Curve Number, Manning's n, depression storage. Grass (CN=39) absorbs rain; roads (CN=98) shed it immediately.",
            tips: ["🌱 Grass: CN=39, lots of infiltration", "🏠 Roof: CN=98, 85% impervious", "🛣️ Road: CN=98, 95% impervious", "🌿 LID Pond: CN=65, bioretention", "🔲 Right-click or 🧹 Eraser to remove cells"] },
          { title: "🔧 Step 2: Build the Pipe Network", sub: "Connect nodes with pipes to route collected water", icon: "🔗",
            body: "Place manholes and inlets to collect surface runoff. Connect them with pipe cells. Water flows downhill — invert elevations are automatically computed from grid row (0.5 ft per row). The outfall is the discharge point where water exits the system.",
            tips: ["⬇️ Inlet: Collects surface runoff (4 ft deep)", "🔵 Manhole: Junction point (6 ft deep)", "🔴 Outfall: Discharge boundary (FREE)", "🟫 Pipe: 18\" diameter, Manning's n=0.013", "⬇️ Water flows from top to bottom (higher inverts → lower)"] },
          { title: "✅ Step 3: Validate & Fix", sub: "Check your model for errors before running", icon: "🛡️",
            body: "Click ✅ Validate to check model integrity. Common errors: no outfall, disconnected pipes. Click 🔧 Fix to auto-repair — it will add missing outfalls and connect orphaned elements. Error cells flash red on the grid.",
            tips: ["✅ Validates: outfall exists, pipes connected, surfaces drain", "🔧 Auto-fix: adds outfalls, connects pipes", "❌ Red border = error cell", "⚠️ Warnings don't block simulation"] },
          { title: "🚀 Step 4: Run a Simulation!", sub: "Watch your network handle a design storm in real-time", icon: "⚡",
            body: "Click 🚀 Quick Sim for an animated preview — it uses simplified SCS Curve Number infiltration and Manning's equations (not full SWMM). For real EPA SWMM5 results, use 🔬 EPA SWMM5 which runs the actual solver via WebAssembly.",
            tips: ["🌧️ 49 design storms from 6 continents", "📊 Real-time hydrograph charts", "🔍 Click any cell for SWMM Inspector panel", "⏸️ Pause/resume animation anytime", "📈 System, subcatchment, pipe & node result tabs"] },
          { title: "📦 Step 5: Export & Import", sub: "Take your model into EPA SWMM5 or bring one in", icon: "💾",
            body: "📦 Export .inp generates a complete SWMM5 input file — runs directly in EPA SWMM5. 📂 Import .inp reads any standard SWMM5 file and maps it onto the grid. Load demos like Residential, Highway, Stadium, or School Campus to explore pre-built networks.",
            tips: ["📦 Export: All SWMM5 sections ([JUNCTIONS], [CONDUITS], etc.)", "📂 Import: Reads coordinates, maps to 20×20 grid", `🎲 ${DEMOS.length} demo models ready to explore`, "🌧️ Selected storm exports with the model"] },
        ];
        const step = steps[tutStep];
        const isLast = tutStep === steps.length - 1;
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} onClick={e => e.target === e.currentTarget && setShowTutorial(false)}>
            <div style={{
              width: "min(680px, 90vw)", background: "#F4F4F4",
              borderRadius: 4, border: "4px solid #F2C717", padding: 0, overflow: "hidden",
              boxShadow: "6px 6px 0 rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,255,255,0.8)",
              color: "#1B2A34",
            }}>
              <div style={{ height: 6, background: "#E4CD9E" }}>
                <div style={{
                  height: "100%", borderRadius: 0, transition: "width 0.4s ease",
                  width: `${((tutStep + 1) / steps.length) * 100}%`,
                  background: "#D01012",
                }} />
              </div>

              <div style={{ padding: "28px 32px 24px" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                  {steps.map((_, i) => (
                    <div key={i} onClick={() => setTutStep(i)} style={{
                      width: i === tutStep ? 32 : 12, height: 12, borderRadius: 3, cursor: "pointer",
                      background: i === tutStep ? "#D01012" : i < tutStep ? "#4B9F4A" : "#E4CD9E",
                      transition: "all 0.3s ease",
                      boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.3), 1px 1px 0 rgba(0,0,0,0.2)",
                    }} />
                  ))}
                </div>

                <div style={{ fontSize: 48, marginBottom: 8 }}>{step.icon}</div>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 4px", color: "#D01012", fontFamily: "'Fredoka'", textShadow: "2px 2px 0 rgba(0,0,0,0.1)" }}>{step.title}</h2>
                <p style={{ fontSize: 14, color: "#6C6E68", margin: "0 0 16px", fontStyle: "italic", fontWeight: 600 }}>{step.sub}</p>

                <p style={{ fontSize: 13, color: "#1B2A34", lineHeight: 1.7, margin: "0 0 16px" }}>{step.body}</p>

                {step.visual && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {step.visual.map((v, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                        background: "#fff", borderRadius: 4,
                        border: "2px solid #E4CD9E",
                        boxShadow: "2px 2px 0 rgba(0,0,0,0.15)",
                      }}>
                        <span style={{ fontSize: 20 }}>{v.e}</span>
                        <span style={{ fontSize: 11, color: "#1B2A34", fontWeight: 800 }}>{v.l}</span>
                      </div>
                    ))}
                  </div>
                )}

                {step.tips && (
                  <div style={{ background: "#fff", borderRadius: 4, padding: 12, marginBottom: 16, border: "2px solid #E4CD9E" }}>
                    {step.tips.map((tip, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#1B2A34", padding: "4px 0", lineHeight: 1.5, fontWeight: 600 }}>{tip}</div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <button onClick={() => setShowTutorial(false)} style={{
                    padding: "8px 16px", borderRadius: 4, border: "none",
                    background: "#6C6E68", color: "#F4F4F4", cursor: "pointer",
                    fontSize: 12, fontFamily: "'Fredoka'", fontWeight: 800,
                    boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -3px 0 rgba(0,0,0,0.20), 0 3px 0 rgba(0,0,0,0.35)",
                  }}>Skip Tutorial</button>
                  <div style={{ display: "flex", gap: 8 }}>
                    {tutStep > 0 && (
                      <button onClick={() => setTutStep(s => s - 1)} style={{
                        padding: "8px 20px", borderRadius: 4, border: "none",
                        background: "#9BA19D", color: "#F4F4F4", cursor: "pointer",
                        fontSize: 12, fontFamily: "'Fredoka'", fontWeight: 800,
                        boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -3px 0 rgba(0,0,0,0.20), 0 3px 0 rgba(0,0,0,0.35)",
                      }}>← Back</button>
                    )}
                    <button onClick={() => {
                      if (isLast) { setShowTutorial(false); }
                      else setTutStep(s => s + 1);
                    }} style={{
                      padding: "8px 24px", borderRadius: 4, border: "none",
                      background: isLast ? "#4B9F4A" : "#D01012",
                      color: "#F4F4F4", cursor: "pointer",
                      fontSize: 13, fontFamily: "'Fredoka'", fontWeight: 900,
                      boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.25), inset -2px -3px 0 rgba(0,0,0,0.20), 0 4px 0 rgba(0,0,0,0.35)",
                    }}>{isLast ? "🚀 Start Building!" : `Next → (${tutStep + 1}/${steps.length})`}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ textAlign: "center", marginBottom: 8, position: "relative" }}>
        <h1 style={{
          fontSize: 28, fontWeight: 900, margin: 0,
          color: "#F2C717",
          textShadow: "3px 3px 0 rgba(0,0,0,0.5), -1px -1px 0 rgba(0,0,0,0.3)",
          letterSpacing: 1,
          fontFamily: "'Fredoka', 'Nunito', sans-serif",
        }}>🧱 SWMM5 LEGO BUILDER</h1>
        <p style={{ fontSize: 11, color: "#9BA19D", margin: "2px 0 0", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
          Build • Validate • Simulate • Export
        </p>
        <button onClick={() => { setShowTutorial(true); setTutStep(0); }} title="Show tutorial" style={{
          position: "absolute", top: 2, right: 0, width: 30, height: 30, borderRadius: 4,
          border: "none", background: "#F2C717", color: "#1B2A34",
          fontSize: 14, fontWeight: 900, cursor: "pointer",
          fontFamily: "'Fredoka'", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.30), inset -2px -3px 0 rgba(0,0,0,0.20), 0 3px 0 rgba(0,0,0,0.35)",
        }}>?</button>
      </div>

      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 1300, flexWrap: "wrap", justifyContent: "center" }}>

        <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setErasing(false)}
              className={`lego-paint-btn ${!erasing ? "paint-mode paint-active" : "inactive"}`}
            >🖌️ Paint</button>
            <button onClick={() => setErasing(true)}
              className={`lego-paint-btn ${erasing ? "erase-mode erase-active" : "inactive"}`}
            >🧹 Erase</button>
          </div>

          {CATS.map(cat => (
            <div key={cat.k}>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#9BA19D", letterSpacing: 2, marginBottom: 4, textTransform: "uppercase", fontFamily: "'Fredoka', sans-serif" }}>{cat.l}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 3 }}>
                {cat.items.map(t => <PalBtn key={t} type={t} sel={erasing ? null : sel} onClick={t2 => { setSel(t2); setErasing(false); }} />)}
              </div>
            </div>
          ))}

          {!erasing && (() => {
            const el = EL[sel];
            const Row = ({label, value, color}) => (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dotted #ccc", fontFamily: "'Fredoka', sans-serif", fontSize: 11 }}>
                <span style={{ color: "#1B2A34" }}>{label}</span>
                <span style={{ color: color || "#D01012", fontWeight: 700 }}>{value}</span>
              </div>
            );
            return (
              <div style={{
                background: "#F4F4F4", borderRadius: 4, padding: 12, transition: "all 0.2s",
                border: "3px solid #6C6E68",
                boxShadow: "4px 4px 0 rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.8)",
                color: "#1B2A34",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 24 }}>{el.e}</span>
                  <div>
                    <div style={{
                      background: "#F2C717", color: "#1B2A34", fontWeight: 900,
                      padding: "4px 8px", borderRadius: 2, fontSize: 13, display: "inline-block",
                    }}>{el.lbl}</div>
                    <div style={{ fontSize: 9, color: "#6C6E68", fontWeight: 600, marginTop: 2 }}>
                      {el.cat === "surface" ? "[SUBCATCHMENTS]" :
                       sel === "outfall" ? "[OUTFALLS]" :
                       sel === "storage" ? "[STORAGE]" :
                       sel === "divider" ? "[DIVIDERS]" :
                       el.cat === "node" ? "[JUNCTIONS]" :
                       sel === "pump" ? "[PUMPS]" :
                       sel === "orifice" ? "[ORIFICES]" :
                       sel === "weir" ? "[WEIRS]" : "[CONDUITS]"}
                    </div>
                  </div>
                </div>
                {el.cat === "surface" && <>
                  <Row label="Curve Number" value={el.cn} color="#F2C717" />
                  <Row label="% Impervious" value={`${el.pI}%`} color="#006DB7" />
                  <Row label="n-Imperv" value={el.nI.toFixed(3)} color="#5A93DB" />
                  <Row label="n-Perv" value={el.nP.toFixed(3)} color="#5A93DB" />
                  <Row label="Ds-Imperv" value={`${el.sI}"`} color="#FE8A18" />
                  <Row label="Ds-Perv" value={`${el.sP}"`} color="#FE8A18" />
                  <Row label="S (retention)" value={`${(1000/el.cn - 10).toFixed(2)}"`} color="#006DB7" />
                  <Row label="Ia (init abs)" value={`${(0.2*(1000/el.cn - 10)).toFixed(2)}"`} color="#F2C717" />
                  <Row label="Runoff Coeff" value={(el.pI/100 * 0.95 + (1-el.pI/100) * el.cn/100).toFixed(3)} color="#70C442" />
                </>}
                {el.cat === "node" && <>
                  <Row label="Type" value={
                    sel === "outfall" ? "FREE Discharge" :
                    sel === "storage" ? "Detention/Tank" :
                    sel === "divider" ? "Flow Splitter" :
                    sel === "inlet" ? "Drop Inlet" : "Standard Junction"
                  } color="#5A93DB" />
                  {el.maxD && <Row label="Max Depth" value={`${el.maxD} ft`} color="#006DB7" />}
                  <Row label="Init Depth" value="0 ft" color="#6C6E68" />
                  <Row label="Surcharge" value={el.maxD ? `${el.maxD} ft` : "N/A"} color="#D01012" />
                  <Row label="Ponded Area" value={sel === "storage" ? "Variable" : "12.6 ft²"} color="#006DB7" />
                  <Row label="Invert" value="Auto (0.5 ft/row)" color="#F2C717" />
                </>}
                {el.cat === "link" && <>
                  <Row label="Type" value={
                    sel === "pump" ? "PUMP Station" :
                    sel === "orifice" ? "ORIFICE Control" :
                    sel === "weir" ? "WEIR Overflow" :
                    sel === "channel" ? "Open Channel" : "Circular Pipe"
                  } color="#5A93DB" />
                  <Row label="Diameter/Size" value={`${el.diam} ft (${(el.diam * 12).toFixed(0)}")`} color="#006DB7" />
                  <Row label="Manning's n" value={el.mann.toFixed(4)} color="#F2C717" />
                  <Row label="Shape" value={sel === "channel" ? "TRAPEZOIDAL" : "CIRCULAR"} color="#006DB7" />
                  <Row label="A (full)" value={`${(Math.PI * el.diam * el.diam / 4).toFixed(3)} ft²`} color="#70C442" />
                  <Row label="Q (full@1%)" value={`${((1.49/el.mann)*(Math.PI*el.diam*el.diam/4)*Math.pow(el.diam/4,2/3)*Math.pow(.01,.5)).toFixed(2)} CFS`} color="#FE8A18" />
                  <Row label="V (full@1%)" value={`${((1.49/el.mann)*Math.pow(el.diam/4,2/3)*Math.pow(.01,.5)).toFixed(2)} ft/s`} color="#D01012" />
                </>}
              </div>
            );
          })()}

          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 8,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#D01012", marginBottom: 4, fontFamily: "'Fredoka'" }}>📐 DUAL ENGINES</div>
            <div style={{ fontSize: 8, color: "#4A4C47", lineHeight: 1.7, fontWeight: 600 }}>
              <div style={{ fontWeight: 800, color: "#006DB7", marginBottom: 2 }}>🚀 Quick Sim (animated):</div>
              <div>Simplified JS hydrology</div>
              <div>SCS-CN + Manning's eqns</div>
              <div>Δt=15s routing + animation</div>
              <div style={{ fontWeight: 800, color: "#D01012", marginTop: 4, marginBottom: 2 }}>🔬 EPA SWMM5 v5.2 (WASM):</div>
              <div>Full SWMM5 solver in-browser</div>
              <div>DynWave routing + RPT output</div>
            </div>
          </div>

          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 8,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#006DB7", marginBottom: 4, fontFamily: "'Fredoka'" }}>⌨️ SHORTCUTS</div>
            <div style={{ fontSize: 8, color: "#4A4C47", lineHeight: 1.8, fontWeight: 600, fontFamily: "'Fredoka'" }}>
              {[
                ["Ctrl+Z", "Undo"],
                ["Space", "Toggle Paint/Erase"],
                ["Del", "Erase mode"],
                ["R", "Run simulation"],
                ["Esc", "Close panels"],
                ["1-9", "Select surface"],
                ["Shift+1-5", "Select node"],
                ["Q/W/E", "Pipe/Channel/Pump"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ background: "#E0E0E0", borderRadius: 2, padding: "0 4px", fontWeight: 800, fontSize: 7, color: "#1B2A34", border: "1px solid #bbb", boxShadow: "0 1px 0 #999" }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1, maxWidth: 780 }}>
          <div className="lego-toolbar">
            <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", alignItems: "center", width: "100%" }}>
              {[
                { l: "↩ UNDO", fn: () => { if (hist.length) { const entry = hist[hist.length-1]; setGridGlobal(entry.gridSize); setGridSize(entry.gridSize); setGrid(entry.grid); setHist(h => h.slice(0,-1)); } }, color: "yellow", tip: "Undo last grid change [Ctrl+Z]" },
                { l: "🗑️ CLEAR", fn: () => { save(); setGrid(emptyGrid(gridSize)); doReset(); }, color: "red", tip: "Clear entire grid and reset simulation" },
                { l: "🎲 DEMOS", fn: () => setShowDemos(s => !s), color: "orange", tip: "Load a pre-built demo model" },
                { sep: true },
                { l: "✅ VALIDATE", fn: () => setValidation(validateModel(grid)), color: "green", tip: "Check model for errors" },
                { l: "🔧 FIX", fn: doFix, color: "yellow", tip: "Auto-fix validation errors" },
                { sep: true },
                { l: "🚀 QUICK SIM", fn: doRun, color: "blue", tip: "Run animated JS hydrology sim (SCS-CN + Manning's) [R]" },
                ...(isRunning ? [{ l: "⏸ STOP", fn: doStop, color: "red", tip: "Stop the running simulation" }] : []),
                ...(simResult && !isRunning ? [{ l: "🔄 RESET", fn: doReset, color: "gray", tip: "Clear simulation results and reset the grid display" }] : []),
                { l: "💾 SAVE/LOAD", fn: () => { setSaveSlots(getSaveSlots()); setShowSavePanel(true); }, color: "green", tip: "Save/load models to browser storage (auto-save + 5 named slots)" },
                { sep: true },
                { l: wasmLoading ? "⏳ RUNNING..." : "🔬 EPA SWMM5", fn: doRunWasm, color: "red", tip: "Run full EPA SWMM5 solver (WASM) with Dynamic Wave routing and detailed RPT output" },
                { l: "📦 EXPORT", fn: doExport, color: "orange", tip: "Export model as EPA SWMM5 .INP file (compatible with desktop SWMM5)" },
                { l: "📂 IMPORT", fn: () => fileRef.current?.click(), color: "blue", tip: "Import an EPA SWMM5 .INP file from your computer" },
              ].map((b, i) => b.sep
                ? <span key={i} className="separator" />
                : <button key={i} className="lego-btn" data-color={b.color} onClick={b.fn} title={b.tip}>{b.l}</button>
              )}
              <span className="separator" />
              <span className="lego-label">Grid:</span>
              {[20, 25, 30, 40, 50].map(sz => (
                <button key={sz} className={`lego-btn sm${gridSize === sz ? " active" : ""}`}
                  data-color={gridSize === sz ? "yellow" : "white"}
                  onClick={() => resizeGrid(sz)} title={`Resize grid to ${sz}×${sz} cells`}
                >{sz}×{sz}</button>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".inp,.txt" onChange={doImport} style={{ display: "none" }} />

            {showDemos && (
              <div style={{
                display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap", justifyContent: "center",
                padding: 8, borderRadius: 4, background: "#F4F4F4",
                border: "3px solid #6C6E68", boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
              }}>
                {DEMOS.map((d, i) => (
                  <button key={i} className="lego-btn" data-color="orange" onClick={() => loadDemo(i)} title={d.desc}
                    style={{ flexDirection: "column", alignItems: "center", textAlign: "center" }}
                  >
                    <div>{d.name}</div>
                    <div style={{ fontSize: 8, color: "#1B2A34", fontWeight: 600 }}>{d.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {simResult && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, justifyContent: "center",
                marginBottom: 6, padding: "5px 12px", borderRadius: 4,
                background: isRunning ? "#006DB7" : "#4B9F4A",
                boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.20), inset -2px -3px 0 rgba(0,0,0,0.20), 0 3px 0 rgba(0,0,0,0.35)",
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#F4F4F4", textShadow: "1px 1px 0 rgba(0,0,0,0.3)" }}>
                  {isRunning ? "⏱️ SIMULATING" : "✅ COMPLETE"}
                </span>
                <span style={{ fontSize: 10, color: "#F4F4F4", fontWeight: 600 }}>
                  t = {curTime.toFixed(1)} min
                </span>
                <span style={{ fontSize: 10, color: "#F4F4F4", fontWeight: 600 }}>
                  Rain: {(simResult.systemHistory[simStep]?.rainfall || 0).toFixed(2)} in/hr
                </span>
                <span style={{ fontSize: 9, color: "#F2C717", fontWeight: 800 }}>
                  {STORMS[stormIdx].name}
                </span>
                <div style={{ width: 100, height: 6, borderRadius: 3, background: "rgba(0,0,0,0.3)" }}>
                  <div style={{
                    width: `${(simStep / Math.max(simResult.systemHistory.length - 1, 1)) * 100}%`,
                    height: "100%", borderRadius: 3,
                    background: "#F2C717",
                    transition: "width 0.05s linear",
                  }} />
                </div>
              </div>
            )}

            <div ref={gridRef} style={{
              overflowX: "auto",
              backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.18) 3px, transparent 3px)",
              backgroundSize: `${CELL}px ${CELL}px`,
              backgroundPosition: `${CELL/2}px ${CELL/2}px`,
              borderRadius: 2,
              touchAction: "none",
            }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {grid.map((row, r) => (
                <div key={r} style={{ display: "flex" }}>
                  {row.map((cell, c) => (
                    <div key={c}
                      onMouseDown={e => { e.preventDefault(); setPainting(true); save(); place(r, c); setInspCell({r, c}); }}
                      onMouseEnter={() => { setHov(`${r}-${c}`); if (painting) place(r, c); }}
                      onMouseLeave={() => setHov(null)}
                      onContextMenu={e => {
                        e.preventDefault();
                        if (cell && EL[cell]) {
                          setCtxMenu({ r, c, x: e.clientX, y: e.clientY });
                        }
                      }}
                    >
                      <GridCell
                        element={cell} isHov={hov === `${r}-${c}`}
                        hasErr={errCells.has(`${r}-${c}`)}
                        hasWarn={warnCells.has(`${r}-${c}`)}
                        hasOverride={!!cellProps[`${r}-${c}`]}
                        flowIntensity={flowState[`${r}-${c}`]?.flow || 0}
                        depthFrac={flowState[`${r}-${c}`]?.depth || 0}
                        row={r} col={c}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {inspCell && (() => {
            const { r, c } = inspCell;
            const elKey = grid[r]?.[c];
            const el = elKey ? EL[elKey] : null;
            const invert = ((GRID - r) * 0.5).toFixed(2);
            let simData = null;
            if (simResult) {
              const nd = simResult.allNodes.find(n => n.r === r && n.c === c);
              if (nd && nd.history[simStep]) simData = { type: "node", ...nd.history[simStep], id: nd.id, maxD: nd.maxDepth };
              const cd = simResult.conduits.find(cn => cn.pipes.some(p => p.r === r && p.c === c));
              if (cd && cd.history[simStep]) simData = { type: "pipe", ...cd.history[simStep], id: cd.id };
              const sc = simResult.subcatchments.find(s => s.cells.some(cl => cl.r === r && cl.c === c));
              if (sc && sc.history[simStep]) simData = { type: "subcatch", ...sc.history[simStep], id: sc.id, area: sc.area_ac, cn: sc.cn, pctI: sc.pctImperv };
            }
            const Row = ({label, value, color}) => (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dotted #ccc" }}>
                <span style={{ color: "#1B2A34", fontSize: 9 }}>{label}</span>
                <span style={{ color: color || "#D01012", fontWeight: 700, fontSize: 9 }}>{value}</span>
              </div>
            );
            return (
              <div style={{
                background: "#F4F4F4", borderRadius: 4, padding: 10,
                border: "3px solid #6C6E68",
                boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
                width: GRID * CELL, boxSizing: "border-box", color: "#1B2A34",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {el && <span style={{ fontSize: 22 }}>{el.e}</span>}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: el ? el.clr : "#6C6E68" }}>
                        {el ? `${el.lbl} — ${
                          el.cat === "surface" ? "[SUBCATCHMENTS]" :
                          elKey === "outfall" ? "[OUTFALLS]" :
                          elKey === "storage" ? "[STORAGE]" :
                          elKey === "divider" ? "[DIVIDERS]" :
                          el.cat === "node" ? "[JUNCTIONS]" :
                          elKey === "pump" ? "[PUMPS]" :
                          elKey === "orifice" ? "[ORIFICES]" :
                          elKey === "weir" ? "[WEIRS]" :
                          "[CONDUITS]"
                        }` : "Empty Cell"}
                      </div>
                      <div style={{ fontSize: 9, color: "#6C6E68", fontWeight: 600 }}>
                        Grid ({r}, {c}) • SWMM Coord ({(c * SPC).toFixed(0)}, {((GRID-1-r) * SPC).toFixed(0)}) ft • Invert: {invert} ft
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setInspCell(null)} style={{
                    padding: "3px 10px", borderRadius: 4, border: "none",
                    background: "#6C6E68", color: "#F4F4F4", cursor: "pointer",
                    fontSize: 11, fontFamily: "'Fredoka', sans-serif", fontWeight: 800,
                    boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.15), 0 2px 0 rgba(0,0,0,0.3)",
                  }}>✕</button>
                </div>
                {el && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div style={{ background: "#fff", borderRadius: 4, padding: 8, border: "2px solid #E4CD9E" }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: "#D01012", marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase" }}>
                        Properties
                      </div>
                      {el.cat === "surface" && <>
                        <Row label="Curve Number" value={el.cn} color="#F2C717" />
                        <Row label="% Impervious" value={`${el.pI}%`} color="#006DB7" />
                        <Row label="n-Imperv" value={el.nI.toFixed(3)} color="#5A93DB" />
                        <Row label="n-Perv" value={el.nP.toFixed(3)} color="#5A93DB" />
                        <Row label="Ds-Imperv" value={`${el.sI}"`} color="#FE8A18" />
                        <Row label="Ds-Perv" value={`${el.sP}"`} color="#FE8A18" />
                      </>}
                      {el.cat === "node" && <>
                        <Row label="Invert Elev" value={`${invert} ft`} color="#F2C717" />
                        {el.maxD && <Row label="Max Depth" value={`${el.maxD} ft`} color="#006DB7" />}
                        <Row label="Type" value={elKey === "outfall" ? "FREE" : elKey === "inlet" ? "Drop Inlet" : "Standard"} color="#5A93DB" />
                        <Row label="Init Depth" value="0 ft" color="#6C6E68" />
                        <Row label="Ponded Area" value="0 ft²" color="#6C6E68" />
                        <Row label="Surcharge" value={el.maxD ? `${el.maxD} ft` : "N/A"} color="#D01012" />
                      </>}
                      {el.cat === "link" && <>
                        <Row label="Shape" value="CIRCULAR" color="#F2C717" />
                        <Row label="Diameter" value={`${el.diam} ft (${(el.diam * 12).toFixed(0)}")`} color="#006DB7" />
                        <Row label="Manning's n" value={el.mann.toFixed(4)} color="#5A93DB" />
                        <Row label="Offset" value="DEPTH" color="#6C6E68" />
                        <Row label="Init Flow" value="0 CFS" color="#6C6E68" />
                        <Row label="Max Flow" value="∞" color="#6C6E68" />
                      </>}
                    </div>
                    <div style={{ background: "#fff", borderRadius: 4, padding: 8, border: "2px solid #E4CD9E" }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: "#006DB7", marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase" }}>
                        {el.cat === "surface" ? "Infiltration" : "Hydraulics"}
                      </div>
                      {el.cat === "surface" && <>
                        <Row label="Method" value="CURVE_NUMBER" color="#006DB7" />
                        <Row label="S (storage)" value={`${(1000/el.cn - 10).toFixed(2)}"`} color="#F2C717" />
                        <Row label="Ia (init abs)" value={`${(0.2*(1000/el.cn - 10)).toFixed(2)}"`} color="#FE8A18" />
                        <Row label="Runoff Coeff" value={(el.pI/100 * 0.95 + (1-el.pI/100) * el.cn/100).toFixed(3)} color="#70C442" />
                        <Row label="Routing" value="→ OUTLET" color="#6C6E68" />
                        <Row label="% Zero Imperv" value="25%" color="#6C6E68" />
                      </>}
                      {el.cat === "node" && <>
                        <Row label="Head (dry)" value={`${invert} ft`} color="#006DB7" />
                        <Row label="Crown" value={`${(parseFloat(invert) + (el.maxD || 6)).toFixed(2)} ft`} color="#F2C717" />
                        <Row label="Storage Vol" value={`${(12.566 * (el.maxD || 6)).toFixed(1)} ft³`} color="#006DB7" />
                        <Row label="Surf Area" value="12.6 ft²" color="#5A93DB" />
                        <Row label="Flooding" value={el.maxD ? "PONDED" : "FREE"} color="#D01012" />
                        <Row label="Allow Ponding" value="YES" color="#6C6E68" />
                      </>}
                      {el.cat === "link" && <>
                        <Row label="A (full)" value={`${(Math.PI * el.diam * el.diam / 4).toFixed(3)} ft²`} color="#006DB7" />
                        <Row label="Wetted P" value={`${(Math.PI * el.diam).toFixed(3)} ft`} color="#5A93DB" />
                        <Row label="Hyd Radius" value={`${(el.diam / 4).toFixed(3)} ft`} color="#F2C717" />
                        <Row label="Q (full@1%)" value={`${((1.49/el.mann)*(Math.PI*el.diam*el.diam/4)*Math.pow(el.diam/4,2/3)*Math.pow(.01,.5)).toFixed(2)} CFS`} color="#70C442" />
                        <Row label="V (full@1%)" value={`${((1.49/el.mann)*Math.pow(el.diam/4,2/3)*Math.pow(.01,.5)).toFixed(2)} ft/s`} color="#006DB7" />
                        <Row label="Froude (full)" value={`${((1.49/el.mann)*Math.pow(el.diam/4,2/3)*Math.pow(.01,.5)/Math.sqrt(32.2*el.diam/2)).toFixed(2)}`} color="#D01012" />
                      </>}
                    </div>
                    <div style={{ background: simData ? "#fff" : "#fff", borderRadius: 4, padding: 8, border: simData ? "2px solid #006DB7" : "2px solid #E4CD9E" }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: simData ? "#006DB7" : "#6C6E68", marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase" }}>
                        {simData ? `Live @ ${(simResult.systemHistory[simStep]?.t || 0).toFixed(1)} min` : "Simulation"}
                      </div>
                      {simData ? (<>
                        {simData.type === "subcatch" && <>
                          <Row label="Runoff" value={`${simData.runoff.toFixed(4)} CFS`} color="#70C442" />
                          <Row label="Rainfall" value={`${simData.rain.toFixed(2)} in/hr`} color="#5A93DB" />
                          <Row label="Ponded Depth" value={`${simData.depth.toFixed(3)}"`} color="#006DB7" />
                          <Row label="Cum Rainfall" value={`${simData.cumRain.toFixed(3)}"`} color="#F2C717" />
                          <Row label="Subcatch Area" value={`${simData.area.toFixed(2)} ac`} color="#6C6E68" />
                          <Row label="Weighted CN" value={simData.cn.toFixed(0)} color="#FE8A18" />
                        </>}
                        {simData.type === "node" && <>
                          <Row label="Water Depth" value={`${simData.depth.toFixed(3)} ft`} color="#F2C717" />
                          <Row label="HGL" value={`${simData.head.toFixed(2)} ft`} color="#006DB7" />
                          <Row label="Inflow" value={`${simData.inflow.toFixed(4)} CFS`} color="#70C442" />
                          {simData.outflow !== undefined && <Row label="Outflow" value={`${simData.outflow.toFixed(4)} CFS`} color="#D01012" />}
                          <Row label="% Full" value={`${((simData.depth/(simData.maxD||6))*100).toFixed(1)}%`} color="#5A93DB" />
                          <Row label="Freeboard" value={`${((simData.maxD||6)-simData.depth).toFixed(2)} ft`} color="#FE8A18" />
                        </>}
                        {simData.type === "pipe" && <>
                          <Row label="Flow" value={`${simData.flow.toFixed(4)} CFS`} color="#006DB7" />
                          <Row label="Velocity" value={`${simData.velocity.toFixed(2)} ft/s`} color="#70C442" />
                          <Row label="Water Depth" value={`${simData.depth.toFixed(3)} ft`} color="#F2C717" />
                          <Row label="% Full" value={`${((simData.depth/1.5)*100).toFixed(1)}%`} color="#5A93DB" />
                          <Row label="d/D Ratio" value={(simData.depth/1.5).toFixed(3)} color="#006DB7" />
                          <Row label="Capacity Used" value={`${(simData.flow/Math.max(((1.49/0.013)*(Math.PI*1.5*1.5/4)*Math.pow(1.5/4,2/3)*Math.pow(.01,.5)),0.001)*100).toFixed(1)}%`} color="#D01012" />
                        </>}
                      </>) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6 }}>
                          <div style={{ fontSize: 22, opacity: 0.3 }}>🚀</div>
                          <div style={{ fontSize: 8, color: "#6C6E68", textAlign: "center", lineHeight: 1.5 }}>
                            Run SWMM5 to see<br/>live simulation data<br/>for this element
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!el && (
                  <div style={{ fontSize: 10, color: "#6C6E68", padding: 8, textAlign: "center" }}>
                    Empty cell — select a palette element and paint here
                  </div>
                )}
              </div>
            );
          })()}

          {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div style={{
              background: "#F4F4F4", borderRadius: 4, padding: 10, boxShadow: "4px 4px 0 rgba(0,0,0,0.4)", color: "#1B2A34",
              border: `2px solid ${validation.errors.length > 0 ? "#ef444466" : "#fbbf2444"}`,
            }}>
              {validation.errors.map((e, i) => (
                <div key={`e${i}`} style={{ fontSize: 10, color: "#fca5a5", padding: "3px 0" }}>🚫 {e}</div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={`w${i}`} style={{ fontSize: 10, color: "#F2C717", padding: "3px 0" }}>⚠️ {w}</div>
              ))}
              {validation.errors.length > 0 && (
                <button onClick={doFix} style={{
                  marginTop: 6, padding: "6px 16px", borderRadius: 8, border: "2px solid #fbbf24",
                  background: "rgba(251,191,36,0.1)", color: "#F2C717", cursor: "pointer",
                  fontSize: 11, fontWeight: 800, fontFamily: "'Fredoka', sans-serif", width: "100%",
                }}>🔧 Auto-Fix Model</button>
              )}
              {fixLog.map((f, i) => <div key={i} style={{ fontSize: 9, color: "#70C442", marginTop: 3 }}>✓ {f}</div>)}
            </div>
          )}

          {!validation && fixLog.length > 0 && (
            <div style={{
              background: "#F4F4F4", borderRadius: 4, padding: 12,
              border: "3px solid #6C6E68", boxShadow: "4px 4px 0 rgba(0,0,0,0.4)", color: "#1B2A34", maxHeight: 400, overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#4B9F4A" }}>📂 Import Summary</div>
                <button onClick={() => setFixLog([])} style={{
                  padding: "2px 8px", borderRadius: 5, border: "1px solid #475569",
                  background: "#6C6E68", color: "#F4F4F4", cursor: "pointer",
                  fontSize: 10, fontFamily: "'Fredoka', sans-serif",
                }}>✕</button>
              </div>
              {fixLog.map((f, i) => {
                const isSep = f.startsWith("───");
                const isWarn = f.startsWith("⚠️");
                const isSub = f.startsWith("   ");
                const isHeader = f.startsWith("📂") || f.startsWith("📊") || f.startsWith("⚙️");
                return (
                  <div key={i} style={{
                    fontSize: isSep ? 10 : isSub ? 9 : 10,
                    color: isSep ? "#FE8A18" : isWarn ? "#D01012" : isHeader ? "#006DB7" : isSub ? "#6C6E68" : "#4B9F4A",
                    padding: isSep ? "6px 0 2px" : "1px 0",
                    fontWeight: isSep || isHeader ? 700 : 400,
                    fontFamily: isSub ? "'Consolas', monospace" : "inherit",
                    borderBottom: isSep ? "1px solid rgba(251,191,36,0.15)" : "none",
                  }}>{f}</div>
                );
              })}
            </div>
          )}

          {simResult && chartData.length > 1 && (
            <div style={{
              background: "#F4F4F4", borderRadius: 4, padding: 12,
              border: "3px solid #6C6E68", boxShadow: "4px 4px 0 rgba(0,0,0,0.4)", color: "#1B2A34",
            }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                {[
                  { k: "system", l: "📊 System" },
                  { k: "subcatch", l: "🌧️ Subcatchments" },
                  { k: "node", l: "⚙️ Nodes" },
                  { k: "pipe", l: "🔵 Pipes" },
                ].map(t => (
                  <button key={t.k} onClick={() => setTab(t.k)} style={{
                    padding: "4px 12px", borderRadius: 6,
                    background: tab === t.k ? "#006DB7" : "#E4CD9E",
                    border: "none",
                    color: tab === t.k ? "#F4F4F4" : "#1B2A34",
                    cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "'Fredoka', sans-serif",
                  }}>{t.l}</button>
                ))}
              </div>

              {tab === "system" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#006DB7" }}>
                      System Hydrograph — Rainfall vs Runoff vs Outfall
                    </span>
                    {!isRunning && <button onClick={() => exportResultsCsv(simResult, "system")} style={{
                      padding: "2px 8px", borderRadius: 3, border: "none", cursor: "pointer",
                      background: "#4B9F4A", color: "#fff", fontSize: 8, fontWeight: 800,
                      boxShadow: "0 2px 0 rgba(0,0,0,0.3)", fontFamily: "'Fredoka', sans-serif",
                    }}>CSV</button>}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4CD9E" />
                      <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#1B2A34" }} label={{ value: "Time (min)", position: "insideBottom", offset: -3, fontSize: 9, fill: "#1B2A34" }} />
                      <YAxis tick={{ fontSize: 9, fill: "#1B2A34" }} label={{ value: "Flow (CFS)", angle: -90, position: "insideLeft", fontSize: 9, fill: "#1B2A34" }} />
                      <Tooltip contentStyle={{ background: "#fff", border: "2px solid #6C6E68", borderRadius: 4, fontSize: 10, color: "#1B2A34" }}
                        formatter={(v, n) => [v.toFixed(3), n]} labelFormatter={v => `${v.toFixed(1)} min`} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      <Line type="monotone" dataKey="totalRunoff" stroke="#70C442" strokeWidth={2} dot={false} name="Runoff" />
                      <Line type="monotone" dataKey="totalPipeFlow" stroke="#5A93DB" strokeWidth={2} dot={false} name="Pipe Flow" />
                      <Line type="monotone" dataKey="outfallFlow" stroke="#D01012" strokeWidth={2} dot={false} name="Outfall" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#006DB7", marginTop: 8, marginBottom: 4 }}>
                    Rainfall Hyetograph (in/hr)
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={chartData.filter((_, i) => i % 20 === 0)} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4CD9E" />
                      <XAxis dataKey="t" tick={{ fontSize: 8, fill: "#1B2A34" }} />
                      <YAxis tick={{ fontSize: 8, fill: "#1B2A34" }} />
                      <Bar dataKey="rainfall" fill="#5A93DB" radius={[2, 2, 0, 0]} />
                      {simStep < simResult.systemHistory.length && (
                        <ReferenceLine x={curTime} stroke="#F2C717" strokeDasharray="3 3" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {tab === "subcatch" && simResult.subcatchments.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#4B9F4A" }}>
                      Subcatchment Runoff ({simResult.subcatchments.length} subcatchments)
                    </span>
                    {!isRunning && <button onClick={() => exportResultsCsv(simResult, "subcatch")} style={{
                      padding: "2px 8px", borderRadius: 3, border: "none", cursor: "pointer",
                      background: "#4B9F4A", color: "#fff", fontSize: 8, fontWeight: 800,
                      boxShadow: "0 2px 0 rgba(0,0,0,0.3)", fontFamily: "'Fredoka', sans-serif",
                    }}>CSV</button>}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={simResult.subcatchments[0].history.slice(0, simStep + 1)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4CD9E" />
                      <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#1B2A34" }} />
                      <YAxis tick={{ fontSize: 9, fill: "#1B2A34" }} label={{ value: "CFS", angle: -90, position: "insideLeft", fontSize: 9, fill: "#1B2A34" }} />
                      <Tooltip contentStyle={{ background: "#fff", border: "2px solid #6C6E68", borderRadius: 4, fontSize: 10, color: "#1B2A34" }}
                        formatter={(v) => [v.toFixed(4)]} labelFormatter={v => `${v.toFixed(1)} min`} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      <Line type="monotone" dataKey="runoff" stroke="#70C442" strokeWidth={2} dot={false} name="Runoff (CFS)" />
                      <Line type="monotone" dataKey="rain" stroke="#5A93DB" strokeWidth={1.5} dot={false} name="Rain (in/hr)" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginTop: 6 }}>
                    {simResult.subcatchments.slice(0, 6).map((sc, i) => (
                      <div key={i} style={{ background: "#fff", borderRadius: 4, padding: 6, textAlign: "center", border: "2px solid #E4CD9E" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#70C442" }}>{sc.id}</div>
                        <div style={{ fontSize: 8, color: "#6C6E68" }}>{sc.area_ac.toFixed(2)} ac • CN={sc.cn.toFixed(0)}</div>
                        <div style={{ fontSize: 8, color: "#6C6E68" }}>{sc.pctImperv.toFixed(0)}% imperv</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "node" && simResult.nodes.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#FE8A18" }}>
                      Node Depths ({simResult.nodes.length} junctions)
                    </span>
                    {!isRunning && <button onClick={() => exportResultsCsv(simResult, "node")} style={{
                      padding: "2px 8px", borderRadius: 3, border: "none", cursor: "pointer",
                      background: "#4B9F4A", color: "#fff", fontSize: 8, fontWeight: 800,
                      boxShadow: "0 2px 0 rgba(0,0,0,0.3)", fontFamily: "'Fredoka', sans-serif",
                    }}>CSV</button>}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4CD9E" />
                      <XAxis dataKey="t" type="number" tick={{ fontSize: 9, fill: "#1B2A34" }}
                        domain={[0, simResult.totalTime / 60]} />
                      <YAxis tick={{ fontSize: 9, fill: "#1B2A34" }} label={{ value: "Depth (ft)", angle: -90, position: "insideLeft", fontSize: 9, fill: "#1B2A34" }} />
                      <Tooltip contentStyle={{ background: "#fff", border: "2px solid #6C6E68", borderRadius: 4, fontSize: 10, color: "#1B2A34" }}
                        formatter={(v) => [v.toFixed(3)]} labelFormatter={v => `${Number(v).toFixed(1)} min`} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      {simResult.nodes.slice(0, 5).map((n, i) => {
                        const colors = ["#F2C717", "#006DB7", "#D01012", "#70C442", "#006DB7"];
                        return <Line key={i} data={n.history.slice(0, simStep + 1)} type="monotone" dataKey="depth"
                          stroke={colors[i % 5]} strokeWidth={1.5} dot={false} name={n.id} />;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {tab === "pipe" && simResult.conduits.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#006DB7" }}>
                      Conduit Flows ({simResult.conduits.length} pipes)
                    </span>
                    {!isRunning && <button onClick={() => exportResultsCsv(simResult, "pipe")} style={{
                      padding: "2px 8px", borderRadius: 3, border: "none", cursor: "pointer",
                      background: "#4B9F4A", color: "#fff", fontSize: 8, fontWeight: 800,
                      boxShadow: "0 2px 0 rgba(0,0,0,0.3)", fontFamily: "'Fredoka', sans-serif",
                    }}>CSV</button>}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4CD9E" />
                      <XAxis dataKey="t" type="number" tick={{ fontSize: 9, fill: "#1B2A34" }}
                        domain={[0, simResult.totalTime / 60]} />
                      <YAxis tick={{ fontSize: 9, fill: "#1B2A34" }} label={{ value: "Flow (CFS)", angle: -90, position: "insideLeft", fontSize: 9, fill: "#1B2A34" }} />
                      <Tooltip contentStyle={{ background: "#fff", border: "2px solid #6C6E68", borderRadius: 4, fontSize: 10, color: "#1B2A34" }}
                        formatter={(v) => [v.toFixed(4)]} labelFormatter={v => `${Number(v).toFixed(1)} min`} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      {simResult.conduits.slice(0, 5).map((cd, i) => {
                        const colors = ["#5A93DB", "#006DB7", "#818cf8", "#5A93DB", "#006DB7"];
                        return <Line key={i} data={cd.history.slice(0, simStep + 1)} type="monotone" dataKey="flow"
                          stroke={colors[i % 5]} strokeWidth={1.5} dot={false} name={cd.id} />;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {!isRunning && simResult && (
                <div style={{
                  marginTop: 8, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
                }}>
                  {[
                    { l: "Peak Runoff", v: Math.max(...simResult.systemHistory.map(s => s.totalRunoff)).toFixed(3), u: "CFS", c: "#70C442" },
                    { l: "Peak Pipe", v: Math.max(...simResult.systemHistory.map(s => s.totalPipeFlow)).toFixed(3), u: "CFS", c: "#5A93DB" },
                    { l: "Peak Outfall", v: Math.max(...simResult.systemHistory.map(s => s.outfallFlow)).toFixed(3), u: "CFS", c: "#D01012" },
                    { l: "Max Node Depth", v: Math.max(...simResult.nodes.flatMap(n => n.history.map(h => h.depth))).toFixed(2), u: "ft", c: "#F2C717" },
                  ].map((s, i) => (
                    <div key={i} style={{ background: "#fff", borderRadius: 4, padding: 8, textAlign: "center", border: "2px solid #E4CD9E", boxShadow: "2px 2px 0 rgba(0,0,0,0.15)" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: "'Fredoka', sans-serif" }}>{s.v}</div>
                      <div style={{ fontSize: 8, color: "#6C6E68" }}>{s.l} ({s.u})</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showInp && (
            <div style={{ background: "#F4F4F4", borderRadius: 4, padding: 10, border: "3px solid #6C6E68", boxShadow: "4px 4px 0 rgba(0,0,0,0.4)", color: "#1B2A34" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#D01012" }}>📦 SWMM5 .inp</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => {
                    const b = new Blob([inpText], { type: "text/plain" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(b);
                    a.download = "swmm5_lego.inp"; a.click();
                  }} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #4ade80", background: "rgba(74,222,128,0.1)", color: "#70C442", cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "'Fredoka', sans-serif" }}>💾 Download</button>
                  <button onClick={() => navigator.clipboard.writeText(inpText)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #a78bfa", background: "rgba(167,139,250,0.1)", color: "#5A93DB", cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "'Fredoka', sans-serif" }}>📋 Copy</button>
                  <button onClick={() => setShowInp(false)} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "#6C6E68", color: "#F4F4F4", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>✕</button>
                </div>
              </div>
              <pre style={{
                background: "#1B2A34", color: "#F4F4F4", padding: 10, borderRadius: 6,
                fontSize: 8, lineHeight: 1.3, maxHeight: 200, overflow: "auto",
                fontFamily: "'Courier New', monospace", whiteSpace: "pre",
              }}>{inpText}</pre>
            </div>
          )}

          {showRpt && wasmParsed && (() => {
            const p = wasmParsed;
            const TH = ({children}) => <th style={{ padding: "4px 8px", fontSize: 9, fontWeight: 800, color: "#F4F4F4", background: "#006DB7", textAlign: "left", borderBottom: "2px solid #003F87", whiteSpace: "nowrap" }}>{children}</th>;
            const TD = ({children, c, r: right}) => <td style={{ padding: "3px 8px", fontSize: 9, color: c || "#1B2A34", fontWeight: 600, textAlign: right ? "right" : "left", borderBottom: "1px solid #E4CD9E", whiteSpace: "nowrap" }}>{children}</td>;
            const SectionTitle = ({children, color}) => <div style={{ fontSize: 13, fontWeight: 900, color: color || "#D01012", marginBottom: 6, marginTop: 10 }}>{children}</div>;
            const hasErrors = p.errors.length > 0;
            const maxFlowLink = p.linkFlow.reduce((a, b) => (+b.maxFlow > +(a?.maxFlow||0) ? b : a), null);
            const maxDepthNode = p.nodeDepth.reduce((a, b) => (+b.maxDepth > +(a?.maxDepth||0) ? b : a), null);
            return (
              <div style={{
                background: "#F4F4F4", borderRadius: 4, padding: 12,
                border: "3px solid #D01012", boxShadow: "4px 4px 0 rgba(0,0,0,0.4)", color: "#1B2A34",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: "#D01012" }}>🔬 EPA SWMM5 Results</span>
                    {p.version && <span style={{ fontSize: 8, color: "#6C6E68", fontWeight: 600 }}>{p.version.split(' - ')[1] || ''}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {wasmRpt && <button onClick={() => {
                      const b = new Blob([wasmRpt], { type: "text/plain" });
                      const a = document.createElement("a"); a.href = URL.createObjectURL(b);
                      a.download = "swmm5_lego.rpt"; a.click();
                    }} style={{ padding: "3px 10px", borderRadius: 3, border: "none", cursor: "pointer",
                      background: "#4B9F4A", color: "#fff", fontSize: 9, fontWeight: 800,
                      boxShadow: "0 2px 0 rgba(0,0,0,0.3)", fontFamily: "'Fredoka', sans-serif",
                    }}>💾 .RPT</button>}
                    <button onClick={() => setShowRpt(false)} style={{ padding: "3px 8px", borderRadius: 3, border: "none", background: "#6C6E68", color: "#F4F4F4", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>✕</button>
                  </div>
                </div>

                {hasErrors && (
                  <div style={{ background: "#FEE2E2", border: "2px solid #D01012", borderRadius: 4, padding: 8, marginBottom: 8 }}>
                    {p.errors.map((e, i) => <div key={i} style={{ fontSize: 10, color: "#D01012", fontWeight: 700 }}>🚫 {e}</div>)}
                  </div>
                )}
                {p.warnings.length > 0 && (
                  <div style={{ background: "#FEF3C7", border: "2px solid #F2C717", borderRadius: 4, padding: 6, marginBottom: 8 }}>
                    {p.warnings.slice(0, 5).map((w, i) => <div key={i} style={{ fontSize: 9, color: "#92400E", fontWeight: 600 }}>⚠️ {w}</div>)}
                    {p.warnings.length > 5 && <div style={{ fontSize: 9, color: "#92400E" }}>...and {p.warnings.length - 5} more</div>}
                  </div>
                )}

                <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                  {[
                    { k: "summary", l: "📊 Summary" },
                    { k: "subcatch", l: "🌧️ Subcatchments" },
                    { k: "nodes", l: "⚙️ Nodes" },
                    { k: "links", l: "🔵 Links" },
                    { k: "continuity", l: "💧 Continuity" },
                    { k: "raw", l: "📄 Raw RPT" },
                  ].map(t => (
                    <button key={t.k} onClick={() => setRptTab(t.k)} style={{
                      padding: "4px 12px", borderRadius: 4,
                      background: rptTab === t.k ? "#D01012" : "#E4CD9E",
                      border: "none",
                      color: rptTab === t.k ? "#F4F4F4" : "#1B2A34",
                      cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "'Fredoka', sans-serif",
                      boxShadow: rptTab === t.k ? "inset 1px 1px 0 rgba(0,0,0,0.15), 0 1px 0 rgba(0,0,0,0.3)" : "1px 2px 0 rgba(0,0,0,0.15)",
                    }}>{t.l}</button>
                  ))}
                </div>

                {rptTab === "summary" && (
                  <div>
                    {Object.keys(p.analysisOptions).length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
                        {[
                          { l: "Flow Units", v: p.analysisOptions["Flow Units"] || "—", c: "#006DB7" },
                          { l: "Infiltration", v: p.analysisOptions["Infiltration Method"] || p.analysisOptions["Infiltration"] || "—", c: "#4B9F4A" },
                          { l: "Routing", v: p.analysisOptions["Flow Routing Method"] || p.analysisOptions["Routing Method"] || "—", c: "#FE8A18" },
                          { l: "Start", v: p.analysisOptions["Starting Date"] || "—", c: "#6C6E68" },
                        ].map((s, i) => (
                          <div key={i} style={{ background: "#fff", borderRadius: 4, padding: 8, textAlign: "center", border: "2px solid #E4CD9E" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: s.c, fontFamily: "'Fredoka'" }}>{s.v}</div>
                            <div style={{ fontSize: 8, color: "#6C6E68", fontWeight: 700 }}>{s.l}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
                      {[
                        { l: "Subcatchments", v: p.subcatchRunoff.length, c: "#70C442" },
                        { l: "Nodes", v: p.nodeDepth.length, c: "#FE8A18" },
                        { l: "Links", v: p.linkFlow.length, c: "#5A93DB" },
                        { l: "Outfalls", v: p.outfallLoading.length, c: "#D01012" },
                      ].map((s, i) => (
                        <div key={i} style={{ background: "#fff", borderRadius: 4, padding: 8, textAlign: "center", border: "2px solid #E4CD9E", boxShadow: "2px 2px 0 rgba(0,0,0,0.1)" }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: s.c, fontFamily: "'Fredoka'" }}>{s.v}</div>
                          <div style={{ fontSize: 9, color: "#6C6E68", fontWeight: 700 }}>{s.l}</div>
                        </div>
                      ))}
                    </div>

                    {(maxFlowLink || maxDepthNode || p.outfallLoading.length > 0) && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                        {maxFlowLink && (
                          <div style={{ background: "#fff", borderRadius: 4, padding: 8, textAlign: "center", border: "2px solid #006DB7" }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#006DB7", fontFamily: "'Fredoka'" }}>{(+maxFlowLink.maxFlow).toFixed(2)}</div>
                            <div style={{ fontSize: 8, color: "#6C6E68" }}>Peak Link Flow (CFS)</div>
                            <div style={{ fontSize: 8, color: "#5A93DB", fontWeight: 700 }}>{maxFlowLink.name}</div>
                          </div>
                        )}
                        {maxDepthNode && (
                          <div style={{ background: "#fff", borderRadius: 4, padding: 8, textAlign: "center", border: "2px solid #F2C717" }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#F2C717", fontFamily: "'Fredoka'" }}>{(+maxDepthNode.maxDepth).toFixed(2)}</div>
                            <div style={{ fontSize: 8, color: "#6C6E68" }}>Max Node Depth (ft)</div>
                            <div style={{ fontSize: 8, color: "#FE8A18", fontWeight: 700 }}>{maxDepthNode.name}</div>
                          </div>
                        )}
                        {p.outfallLoading.length > 0 && (
                          <div style={{ background: "#fff", borderRadius: 4, padding: 8, textAlign: "center", border: "2px solid #D01012" }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#D01012", fontFamily: "'Fredoka'" }}>
                              {Math.max(...p.outfallLoading.map(o => +o.maxFlow || 0)).toFixed(2)}
                            </div>
                            <div style={{ fontSize: 8, color: "#6C6E68" }}>Peak Outfall (CFS)</div>
                            <div style={{ fontSize: 8, color: "#D01012", fontWeight: 700 }}>{p.outfallLoading[0]?.name || ''}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {p.nodeFlooding.length > 0 && <>
                      <SectionTitle color="#D01012">🚨 Node Flooding ({p.nodeFlooding.length})</SectionTitle>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead><tr><TH>Node</TH><TH>Hours</TH><TH>Max Rate</TH><TH>Total Vol</TH></tr></thead>
                          <tbody>
                            {p.nodeFlooding.map((n, i) => (
                              <tr key={i} style={{ background: i % 2 ? "#F8F8F8" : "#fff" }}>
                                <TD c="#D01012">{n.name}</TD><TD r>{n.hours}</TD><TD r>{n.maxRate}</TD><TD r>{n.totalFloodVol}</TD>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>}

                    {p.linkFlow.length > 0 && (() => {
                      const barData = p.linkFlow.map(l => ({ name: l.name, maxFlow: +l.maxFlow, maxVeloc: +l.maxVeloc, depthFrac: +(l.maxDepthFrac || 0) }));
                      return <>
                        <SectionTitle color="#006DB7">📊 Link Peak Flows</SectionTitle>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E4CD9E" />
                            <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#1B2A34" }} />
                            <YAxis tick={{ fontSize: 8, fill: "#1B2A34" }} label={{ value: "CFS", angle: -90, position: "insideLeft", fontSize: 8 }} />
                            <Tooltip contentStyle={{ background: "#fff", border: "2px solid #6C6E68", borderRadius: 4, fontSize: 10 }}
                              formatter={(v, n) => [Number(v).toFixed(3), n]} />
                            <Bar dataKey="maxFlow" fill="#5A93DB" radius={[3, 3, 0, 0]} name="Peak Flow" />
                          </BarChart>
                        </ResponsiveContainer>
                      </>;
                    })()}

                    {p.nodeDepth.length > 0 && (() => {
                      const barData = p.nodeDepth.map(n => ({ name: n.name, maxDepth: +n.maxDepth, avgDepth: +n.avgDepth }));
                      return <>
                        <SectionTitle color="#F2C717">📊 Node Peak Depths</SectionTitle>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E4CD9E" />
                            <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#1B2A34" }} />
                            <YAxis tick={{ fontSize: 8, fill: "#1B2A34" }} label={{ value: "ft", angle: -90, position: "insideLeft", fontSize: 8 }} />
                            <Tooltip contentStyle={{ background: "#fff", border: "2px solid #6C6E68", borderRadius: 4, fontSize: 10 }}
                              formatter={(v, n) => [Number(v).toFixed(3), n]} />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Bar dataKey="maxDepth" fill="#F2C717" radius={[3, 3, 0, 0]} name="Max Depth" />
                            <Bar dataKey="avgDepth" fill="#FE8A18" radius={[3, 3, 0, 0]} name="Avg Depth" />
                          </BarChart>
                        </ResponsiveContainer>
                      </>;
                    })()}
                  </div>
                )}

                {rptTab === "subcatch" && (
                  <div style={{ overflowX: "auto" }}>
                    <SectionTitle color="#70C442">🌧️ Subcatchment Runoff Summary</SectionTitle>
                    {p.subcatchRunoff.length === 0 ? <div style={{ fontSize: 10, color: "#6C6E68" }}>No subcatchment data in RPT</div> : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><TH>Name</TH><TH>Precip (in)</TH><TH>Runon (in)</TH><TH>Evap (in)</TH><TH>Infil (in)</TH><TH>Runoff (in)</TH><TH>Peak (CFS)</TH><TH>Coeff</TH></tr></thead>
                        <tbody>
                          {p.subcatchRunoff.map((sc, i) => (
                            <tr key={i} style={{ background: i % 2 ? "#F8F8F8" : "#fff" }}>
                              <TD c="#70C442">{sc.name}</TD><TD r>{sc.precip}</TD><TD r>{sc.runon}</TD>
                              <TD r>{sc.evap}</TD><TD r>{sc.infil}</TD><TD r c="#006DB7">{sc.runoff_in}</TD>
                              <TD r c="#D01012">{sc.peakRunoff}</TD><TD r>{sc.runoffCoeff}</TD>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {p.subcatchRunoff.length > 0 && (() => {
                      const barData = p.subcatchRunoff.map(sc => ({
                        name: sc.name, precip: sc.precip, runoff: sc.runoff_in, infil: sc.infil,
                      }));
                      return <>
                        <SectionTitle color="#4B9F4A">📊 Subcatchment Water Balance</SectionTitle>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E4CD9E" />
                            <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#1B2A34" }} />
                            <YAxis tick={{ fontSize: 8, fill: "#1B2A34" }} label={{ value: "inches", angle: -90, position: "insideLeft", fontSize: 8 }} />
                            <Tooltip contentStyle={{ background: "#fff", border: "2px solid #6C6E68", borderRadius: 4, fontSize: 10 }}
                              formatter={(v) => [Number(v).toFixed(3)]} />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            <Bar dataKey="precip" fill="#5A93DB" name="Precip" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="runoff" fill="#70C442" name="Runoff" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="infil" fill="#F2C717" name="Infil" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </>;
                    })()}
                  </div>
                )}

                {rptTab === "nodes" && (
                  <div style={{ overflowX: "auto" }}>
                    <SectionTitle color="#FE8A18">⚙️ Node Depth Summary</SectionTitle>
                    {p.nodeDepth.length === 0 ? <div style={{ fontSize: 10, color: "#6C6E68" }}>No node data in RPT</div> : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><TH>Name</TH><TH>Type</TH><TH>Avg Depth (ft)</TH><TH>Max Depth (ft)</TH><TH>Max HGL (ft)</TH></tr></thead>
                        <tbody>
                          {p.nodeDepth.map((n, i) => (
                            <tr key={i} style={{ background: i % 2 ? "#F8F8F8" : "#fff" }}>
                              <TD c="#FE8A18">{n.name}</TD><TD>{n.type}</TD>
                              <TD r>{n.avgDepth}</TD><TD r c="#D01012">{n.maxDepth}</TD><TD r>{n.maxHGL}</TD>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <SectionTitle color="#006DB7">📥 Node Inflow Summary</SectionTitle>
                    {p.nodeInflow.length === 0 ? <div style={{ fontSize: 10, color: "#6C6E68" }}>No inflow data in RPT</div> : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><TH>Name</TH><TH>Type</TH><TH>Max Lateral (CFS)</TH><TH>Max Total (CFS)</TH><TH>Total Vol (gal)</TH></tr></thead>
                        <tbody>
                          {p.nodeInflow.map((n, i) => (
                            <tr key={i} style={{ background: i % 2 ? "#F8F8F8" : "#fff" }}>
                              <TD c="#006DB7">{n.name}</TD><TD>{n.type}</TD>
                              <TD r>{n.maxLatInflow}</TD><TD r c="#D01012">{n.maxTotalInflow}</TD><TD r>{n.totalInflowVol}</TD>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <SectionTitle color="#D01012">🏗️ Outfall Loading</SectionTitle>
                    {p.outfallLoading.length === 0 ? <div style={{ fontSize: 10, color: "#6C6E68" }}>No outfall data</div> : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><TH>Name</TH><TH>Flow Freq (%)</TH><TH>Avg Flow (CFS)</TH><TH>Max Flow (CFS)</TH><TH>Total Vol (gal)</TH></tr></thead>
                        <tbody>
                          {p.outfallLoading.map((o, i) => (
                            <tr key={i} style={{ background: i % 2 ? "#F8F8F8" : "#fff" }}>
                              <TD c="#D01012">{o.name}</TD><TD r>{o.flowFreq}</TD>
                              <TD r>{o.avgFlow}</TD><TD r c="#D01012">{o.maxFlow}</TD><TD r>{o.totalVol}</TD>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {rptTab === "links" && (
                  <div style={{ overflowX: "auto" }}>
                    <SectionTitle color="#5A93DB">🔵 Link Flow Summary</SectionTitle>
                    {p.linkFlow.length === 0 ? <div style={{ fontSize: 10, color: "#6C6E68" }}>No link data in RPT</div> : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><TH>Name</TH><TH>Type</TH><TH>Max Flow (CFS)</TH><TH>Max Veloc (ft/s)</TH><TH>Max d/D</TH></tr></thead>
                        <tbody>
                          {p.linkFlow.map((l, i) => (
                            <tr key={i} style={{ background: i % 2 ? "#F8F8F8" : "#fff" }}>
                              <TD c="#5A93DB">{l.name}</TD><TD>{l.type}</TD>
                              <TD r c="#006DB7">{l.maxFlow}</TD><TD r>{l.maxVeloc}</TD>
                              <TD r c={+l.maxDepthFrac >= 1 ? "#D01012" : "#4B9F4A"}>{l.maxDepthFrac}</TD>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {rptTab === "continuity" && (
                  <div>
                    {Object.keys(p.runoffQuantity).length > 0 && <>
                      <SectionTitle color="#70C442">💧 Runoff Quantity Continuity</SectionTitle>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><TH>Component</TH><TH>Depth (in)</TH><TH>Volume (gal)</TH></tr></thead>
                        <tbody>
                          {Object.entries(p.runoffQuantity).map(([k, v], i) => (
                            <tr key={i} style={{ background: i % 2 ? "#F8F8F8" : "#fff" }}>
                              <TD c="#4B9F4A">{k}</TD><TD r>{v.in}</TD><TD r>{v.gal}</TD>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>}
                    {Object.keys(p.routingSummary).length > 0 && <>
                      <SectionTitle color="#006DB7">🔄 Flow Routing Continuity</SectionTitle>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><TH>Component</TH><TH>Depth (in)</TH><TH>Volume (gal)</TH></tr></thead>
                        <tbody>
                          {Object.entries(p.routingSummary).map(([k, v], i) => (
                            <tr key={i} style={{ background: i % 2 ? "#F8F8F8" : "#fff" }}>
                              <TD c="#006DB7">{k}</TD><TD r>{v.in}</TD><TD r>{v.gal}</TD>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>}
                  </div>
                )}

                {rptTab === "raw" && (
                  <pre style={{
                    background: "#1B2A34", color: "#F4F4F4", padding: 10, borderRadius: 6,
                    fontSize: 8, lineHeight: 1.3, maxHeight: 400, overflow: "auto",
                    fontFamily: "'Courier New', monospace", whiteSpace: "pre",
                  }}>{wasmRpt}</pre>
                )}
              </div>
            );
          })()}
        </div>

        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 8,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{
              background: "#F2C717", color: "#1B2A34", fontWeight: 900,
              padding: "2px 8px", borderRadius: 2, fontSize: 12, display: "inline-block", marginBottom: 6,
            }}>📊 NETWORK</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {(() => {
                const counts = {};
                grid.flat().filter(Boolean).forEach(e => { counts[e] = (counts[e] || 0) + 1; });
                const total = Object.values(counts).reduce((s, v) => s + v, 0);
                const nds = Object.entries(counts).filter(([k]) => EL[k].cat === "node").reduce((s, [, v]) => s + v, 0);
                const surfs = Object.entries(counts).filter(([k]) => EL[k].cn !== undefined).reduce((s, [, v]) => s + v, 0);
                const impCells = Object.entries(counts).filter(([k]) => EL[k].cn >= 90).reduce((s, [, v]) => s + v, 0);
                const wcn = surfs > 0 ? Object.entries(counts).filter(([k]) => EL[k].cn !== undefined).reduce((s, [k, v]) => s + EL[k].cn * v, 0) / surfs : 0;
                return [
                  { l: "Blocks", v: total, c: "#006DB7" },
                  { l: "Nodes", v: nds, c: "#FE8A18" },
                  { l: "Pipes", v: counts.pipe || 0, c: "#5A93DB" },
                  { l: "%Imperv", v: surfs > 0 ? `${((impCells / surfs) * 100).toFixed(0)}%` : "0%", c: "#D01012" },
                  { l: "Wtd CN", v: wcn.toFixed(0), c: "#4B9F4A" },
                  { l: "Surfaces", v: surfs, c: "#70C442" },
                  { l: "Area (ac)", v: surfs > 0 ? (surfs * 100 * 100 / 43560).toFixed(1) : "0", c: "#FE8A18" },
                  { l: "Outfalls", v: counts.outfall || 0, c: "#003F87" },
                  { l: "S (in)", v: wcn > 0 ? (1000/wcn - 10).toFixed(1) : "—", c: "#6C6E68" },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: "#fff", borderRadius: 3, padding: "4px 4px", textAlign: "center",
                    border: "2px solid #E4CD9E",
                    boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.8), 2px 2px 0 rgba(0,0,0,0.15)",
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: s.c, fontFamily: "'Fredoka'" }}>{s.v}</div>
                    <div style={{ fontSize: 8, color: "#6C6E68", fontWeight: 700 }}>{s.l}</div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 8,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{
              background: "#006DB7", color: "#F4F4F4", fontWeight: 900,
              padding: "2px 8px", borderRadius: 2, fontSize: 11, display: "inline-block", marginBottom: 4,
            }}>💡 SWMM5 MAP</div>
            <div style={{ fontSize: 10, color: "#1B2A34", lineHeight: 1.5, fontWeight: 600 }}>
              <div><span style={{ color: "#70C442", fontSize: 12 }}>■</span> Surfaces → [SUBCATCHMENTS]</div>
              <div><span style={{ color: "#6C6E68", fontSize: 12 }}>■</span> Manholes → [JUNCTIONS]</div>
              <div><span style={{ color: "#006DB7", fontSize: 12 }}>■</span> Inlets → [JUNCTIONS]</div>
              <div><span style={{ color: "#003F87", fontSize: 12 }}>■</span> Outfalls → [OUTFALLS]</div>
              <div><span style={{ color: "#FE8A18", fontSize: 12 }}>■</span> Storage → [STORAGE]</div>
              <div><span style={{ color: "#F2C717", fontSize: 12 }}>■</span> Dividers → [DIVIDERS]</div>
              <div><span style={{ color: "#5A93DB", fontSize: 12 }}>■</span> Pipes → [CONDUITS]</div>
              <div><span style={{ color: "#006DB7", fontSize: 12 }}>■</span> Channels → [CONDUITS]</div>
              <div><span style={{ color: "#FE8A18", fontSize: 12 }}>■</span> Pumps → [PUMPS]</div>
              <div><span style={{ color: "#5A93DB", fontSize: 12 }}>■</span> Orifices → [ORIFICES]</div>
              <div><span style={{ color: "#F2C717", fontSize: 12 }}>■</span> Weirs → [WEIRS]</div>
              <div><span style={{ color: "#70C442", fontSize: 12 }}>■</span> LID → BioRetention</div>
            </div>
          </div>

          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 8,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{
              background: "#4B9F4A", color: "#F4F4F4", fontWeight: 900,
              padding: "2px 8px", borderRadius: 2, fontSize: 11, display: "inline-block", marginBottom: 4,
            }}>🎮 WORKFLOW</div>
            <div style={{ fontSize: 10, color: "#1B2A34", lineHeight: 1.6, fontWeight: 600 }}>
              <div>1️⃣ Paint surfaces & nodes</div>
              <div>2️⃣ Connect with pipes</div>
              <div>3️⃣ Right-click to edit properties</div>
              <div>4️⃣ <strong style={{ color: "#4B9F4A" }}>Validate</strong> the model</div>
              <div>5️⃣ <strong style={{ color: "#FE8A18" }}>Fix</strong> if errors found</div>
              <div>6️⃣ <strong style={{ color: "#006DB7" }}>🚀 Quick Sim</strong> or <strong style={{ color: "#D01012" }}>🔬 EPA SWMM5</strong></div>
              <div>7️⃣ View results + export CSV</div>
              <div>8️⃣ <strong style={{ color: "#4B9F4A" }}>Save</strong> / <strong style={{ color: "#FE8A18" }}>Export</strong> .inp</div>
            </div>
          </div>

          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 8,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
            flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
          }}>
            <div style={{
              background: "#D01012", color: "#F4F4F4", fontWeight: 900,
              padding: "2px 8px", borderRadius: 2, fontSize: 11, display: "inline-block", marginBottom: 4,
            }}>🌧️ DESIGN STORMS ({STORMS.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
              <button onClick={() => setStormCat("all")} style={{
                padding: "3px 8px", borderRadius: 3, fontSize: 10, fontWeight: 800, cursor: "pointer",
                background: stormCat === "all" ? "#D01012" : "#E4CD9E",
                border: "none",
                color: stormCat === "all" ? "#F4F4F4" : "#1B2A34", fontFamily: "'Fredoka', sans-serif",
                boxShadow: stormCat === "all"
                  ? "inset 1px 1px 0 rgba(0,0,0,0.15), 0 1px 0 rgba(0,0,0,0.3)"
                  : "inset 1px 1px 0 rgba(255,255,255,0.4), 1px 2px 0 rgba(0,0,0,0.2)",
              }}>ALL</button>
              {STORM_CATS.map(c => (
                <button key={c.key} onClick={() => setStormCat(c.key)} style={{
                  padding: "3px 8px", borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: stormCat === c.key ? "#D01012" : "#E4CD9E",
                  border: "none",
                  color: stormCat === c.key ? "#F4F4F4" : "#1B2A34", fontFamily: "'Fredoka', sans-serif",
                  boxShadow: stormCat === c.key
                    ? "inset 1px 1px 0 rgba(0,0,0,0.15), 0 1px 0 rgba(0,0,0,0.3)"
                    : "inset 1px 1px 0 rgba(255,255,255,0.4), 1px 2px 0 rgba(0,0,0,0.2)",
                }}>{c.label.split(" ")[0]}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 3, overflowY: "auto", maxHeight: 320, paddingRight: 2 }}>
              {STORMS.map((st, i) => {
                if (stormCat !== "all" && st.cat !== stormCat) return null;
                return (
                  <button key={i} onClick={() => { setStormIdx(i); doReset(); }} title={`${st.desc}\nTotal: ${st.total} • Peak: ${st.peak}`} style={{
                    padding: "5px 8px", borderRadius: 3, textAlign: "left", flexShrink: 0,
                    background: stormIdx === i ? "#D01012" : "#fff",
                    border: stormIdx === i ? "2px solid #A00C0E" : "2px solid #E4CD9E",
                    color: stormIdx === i ? "#F4F4F4" : "#1B2A34",
                    cursor: "pointer", fontFamily: "'Fredoka', sans-serif", transition: "all 0.12s",
                    boxShadow: stormIdx === i ? "inset 1px 1px 0 rgba(255,255,255,0.2), 0 2px 0 rgba(0,0,0,0.3)" : "none",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: stormIdx === i ? 800 : 600, lineHeight: 1.3 }}>{st.name}</div>
                    {stormIdx === i && (
                      <div style={{ fontSize: 9, color: "#F2C717", marginTop: 2, fontWeight: 700 }}>
                        {st.desc} — Peak: {st.peak} • {st.total}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {ctxMenu && (() => {
        const { r, c, x, y } = ctxMenu;
        const elKey = grid[r]?.[c];
        const el = elKey ? EL[elKey] : null;
        if (!el) return null;
        const key = `${r}-${c}`;
        const ov = cellProps[key] || {};
        const fields = [];
        if (el.cat === "surface") {
          fields.push({ k: "cn", label: "Curve Number", min: 30, max: 100, step: 1, def: el.cn });
          fields.push({ k: "pI", label: "% Impervious", min: 0, max: 100, step: 1, def: el.pI });
          fields.push({ k: "nI", label: "n-Imperv", min: 0.001, max: 0.5, step: 0.001, def: el.nI });
          fields.push({ k: "nP", label: "n-Perv", min: 0.01, max: 1.0, step: 0.01, def: el.nP });
          fields.push({ k: "sI", label: "Dep.Stor Imperv (in)", min: 0, max: 1, step: 0.01, def: el.sI });
          fields.push({ k: "sP", label: "Dep.Stor Perv (in)", min: 0, max: 2, step: 0.01, def: el.sP });
          fields.push({ k: "slope", label: "Slope (%)", min: 0.01, max: 20, step: 0.01, def: 0.5 });
        }
        if (el.cat === "link") {
          fields.push({ k: "diam", label: "Diameter (ft)", min: 0.25, max: 20, step: 0.25, def: el.diam });
          fields.push({ k: "mann", label: "Manning's n", min: 0.001, max: 0.1, step: 0.001, def: el.mann });
        }
        if (el.cat === "node" && el.maxD) {
          fields.push({ k: "maxD", label: "Max Depth (ft)", min: 1, max: 30, step: 0.5, def: el.maxD });
        }
        if (fields.length === 0) { setCtxMenu(null); return null; }
        return (
          <div onClick={e => e.stopPropagation()} style={{
            position: "fixed", left: Math.min(x, window.innerWidth - 260), top: Math.min(y, window.innerHeight - 400),
            background: "#F4F4F4", border: "3px solid #F2C717", borderRadius: 4, padding: 12, zIndex: 10000,
            boxShadow: "6px 6px 0 rgba(0,0,0,0.4)", minWidth: 220, fontFamily: "'Fredoka', sans-serif",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#D01012" }}>{el.e} {el.lbl} ({r},{c})</span>
              <button onClick={() => setCtxMenu(null)} style={{
                background: "#6C6E68", color: "#F4F4F4", border: "none", borderRadius: 3,
                padding: "2px 8px", cursor: "pointer", fontSize: 10, fontWeight: 800,
              }}>x</button>
            </div>
            {fields.map(f => (
              <div key={f.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px dotted #ccc" }}>
                <span style={{ fontSize: 10, color: "#1B2A34", fontWeight: 600 }}>{f.label}</span>
                <input type="number" min={f.min} max={f.max} step={f.step}
                  value={ov[f.k] !== undefined ? ov[f.k] : f.def}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val)) return;
                    setCellProps(prev => ({ ...prev, [key]: { ...prev[key], [f.k]: val } }));
                  }}
                  style={{
                    width: 70, textAlign: "right", padding: "2px 4px", borderRadius: 3,
                    border: "2px solid #E4CD9E", fontSize: 10, fontWeight: 700, fontFamily: "'Fredoka', sans-serif",
                    background: ov[f.k] !== undefined ? "#FFF8DC" : "#fff",
                  }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              <button onClick={() => {
                setCellProps(prev => { const n = { ...prev }; delete n[key]; return n; });
                setCtxMenu(null);
              }} style={{
                flex: 1, padding: "4px 0", borderRadius: 3, border: "none", cursor: "pointer",
                background: "#FE8A18", color: "#fff", fontSize: 10, fontWeight: 800,
                boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.3), 0 2px 0 rgba(0,0,0,0.3)",
              }}>Reset to Defaults</button>
              <button onClick={() => setCtxMenu(null)} style={{
                flex: 1, padding: "4px 0", borderRadius: 3, border: "none", cursor: "pointer",
                background: "#4B9F4A", color: "#fff", fontSize: 10, fontWeight: 800,
                boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.3), 0 2px 0 rgba(0,0,0,0.3)",
              }}>Done</button>
            </div>
          </div>
        );
      })()}

      {showSavePanel && (
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          background: "#F4F4F4", border: "4px solid #F2C717", borderRadius: 6, padding: 16, zIndex: 10000,
          boxShadow: "8px 8px 0 rgba(0,0,0,0.4)", minWidth: 340, fontFamily: "'Fredoka', sans-serif",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#D01012" }}>Save / Load</span>
            <button onClick={() => setShowSavePanel(false)} style={{
              background: "#6C6E68", color: "#F4F4F4", border: "none", borderRadius: 3,
              padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 800,
            }}>x</button>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Slot name..."
              style={{
                flex: 1, padding: "5px 8px", borderRadius: 3, border: "2px solid #E4CD9E",
                fontSize: 11, fontFamily: "'Fredoka', sans-serif",
              }}
            />
            <button onClick={() => {
              if (!saveName.trim()) return;
              saveToSlot(saveName.trim(), grid, gridSize, stormIdx, cellProps);
              setSaveSlots(getSaveSlots());
              setSaveName("");
            }} style={{
              padding: "5px 12px", borderRadius: 3, border: "none", cursor: "pointer",
              background: "#4B9F4A", color: "#fff", fontSize: 11, fontWeight: 800,
              boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.3), 0 2px 0 rgba(0,0,0,0.3)",
            }}>Save</button>
          </div>
          <div style={{ fontSize: 9, color: "#6C6E68", marginBottom: 6, fontWeight: 700 }}>
            SAVED SLOTS ({saveSlots.length}/5) — auto-save is always active
          </div>
          {saveSlots.length === 0 && (
            <div style={{ fontSize: 11, color: "#6C6E68", padding: 10, textAlign: "center" }}>No saved slots yet</div>
          )}
          {saveSlots.map((slot, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 8px", background: "#fff", border: "2px solid #E4CD9E", borderRadius: 3, marginBottom: 4,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1B2A34" }}>{slot.name}</div>
                <div style={{ fontSize: 8, color: "#6C6E68" }}>
                  {slot.gridSize}x{slot.gridSize} — {new Date(slot.savedAt).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                <button onClick={() => {
                  save();
                  setGridGlobal(slot.gridSize || 20);
                  setGridSize(getGrid());
                  setGrid(slot.grid);
                  if (slot.stormIdx !== undefined) setStormIdx(slot.stormIdx);
                  if (slot.cellProps) setCellProps(slot.cellProps); else setCellProps({});
                  doReset();
                  setShowSavePanel(false);
                }} style={{
                  padding: "3px 10px", borderRadius: 3, border: "none", cursor: "pointer",
                  background: "#006DB7", color: "#fff", fontSize: 9, fontWeight: 800,
                }}>Load</button>
                <button onClick={() => {
                  deleteSlot(slot.name);
                  setSaveSlots(getSaveSlots());
                }} style={{
                  padding: "3px 8px", borderRadius: 3, border: "none", cursor: "pointer",
                  background: "#D01012", color: "#fff", fontSize: 9, fontWeight: 800,
                }}>x</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 8, fontSize: 9, color: "#9BA19D", textAlign: "center",
        fontWeight: 700, letterSpacing: 0.5,
        textShadow: "1px 1px 0 rgba(0,0,0,0.3)",
      }}>
        SWMM5.org • SWMM5 LEGO Builder • EPA SWMM5 WASM + Quick Sim • The Dickinson Canon • {new Date().getFullYear()}
      </div>
    </div>
  );
}
