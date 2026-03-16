import { setGrid, EL, emptyGrid } from './elements.js';

export function importINP(text, requestedSize) {
  const sections = {};
  let curSec = null;
  text.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) { curSec = trimmed; sections[curSec] = []; return; }
    if (curSec && trimmed && !trimmed.startsWith(";;")) sections[curSec]?.push(trimmed);
  });

  const coords = {};
  (sections["[COORDINATES]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) coords[parts[0]] = { x: parseFloat(parts[1]), y: parseFloat(parts[2]) };
  });

  const nNodes = (sections["[JUNCTIONS]"] || []).length + (sections["[OUTFALLS]"] || []).length
    + (sections["[STORAGE]"] || []).length + (sections["[DIVIDERS]"] || []).length;
  const nLinks = (sections["[CONDUITS]"] || []).length + (sections["[PUMPS]"] || []).length
    + (sections["[ORIFICES]"] || []).length + (sections["[WEIRS]"] || []).length;
  const nSubcatchEst = (sections["[SUBCATCHMENTS]"] || []).length;
  const estCells = nNodes * 2 + nLinks * 3 + nSubcatchEst * 8;
  const autoSize = Math.max(20, Math.min(60, Math.ceil(Math.sqrt(estCells) * 1.4)));
  const useSize = requestedSize || autoSize;
  setGrid(useSize);
  const GRID = useSize;
  const grid = emptyGrid(useSize);

  const allCoords = Object.values(coords);
  if (allCoords.length === 0) return { grid, gridSize: useSize, warnings: ["No [COORDINATES] — cannot place nodes."], subcatchInfo: [], counts: { nJunctions: 0, nOutfalls: 0, nConduits: 0, nSubcatch: 0 } };
  
  const minX = Math.min(...allCoords.map(c => c.x)), maxX = Math.max(...allCoords.map(c => c.x));
  const minY = Math.min(...allCoords.map(c => c.y)), maxY = Math.max(...allCoords.map(c => c.y));
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
  const margin = 2;
  const usable = GRID - 2 * margin;

  function toGrid(id) {
    const co = coords[id];
    if (!co) return null;
    const gc = margin + Math.round(((co.x - minX) / rangeX) * (usable - 1));
    const gr = margin + Math.round(((maxY - co.y) / rangeY) * (usable - 1));
    return { r: Math.max(0, Math.min(GRID-1, gr)), c: Math.max(0, Math.min(GRID-1, gc)) };
  }

  const warnings = [];
  const nodePositions = {};
  const nodeTypes = {};

  (sections["[JUNCTIONS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return;
    const id = parts[0];
    const pos = toGrid(id);
    if (!pos) { warnings.push(`Junction ${id}: no coordinates`); return; }
    const isInlet = id.toLowerCase().includes("inlet") || id.toLowerCase().includes("inl");
    grid[pos.r][pos.c] = isInlet ? "inlet" : "manhole";
    nodePositions[id] = pos;
    nodeTypes[id] = isInlet ? "inlet" : "manhole";
  });

  (sections["[OUTFALLS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return;
    const id = parts[0];
    const pos = toGrid(id);
    if (!pos) { warnings.push(`Outfall ${id}: no coordinates`); return; }
    grid[pos.r][pos.c] = "outfall";
    nodePositions[id] = pos;
    nodeTypes[id] = "outfall";
  });

  (sections["[STORAGE]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return;
    const id = parts[0];
    const pos = toGrid(id);
    if (!pos) { warnings.push(`Storage ${id}: no coordinates`); return; }
    grid[pos.r][pos.c] = "storage";
    nodePositions[id] = pos;
    nodeTypes[id] = "storage";
  });

  (sections["[DIVIDERS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return;
    const id = parts[0];
    const pos = toGrid(id);
    if (!pos) { warnings.push(`Divider ${id}: no coordinates`); return; }
    grid[pos.r][pos.c] = "divider";
    nodePositions[id] = pos;
    nodeTypes[id] = "divider";
  });

  function tracePath(fromPos, toPos, linkType) {
    let { r: r1, c: c1 } = fromPos, { r: r2, c: c2 } = toPos;
    const dr = r2 > r1 ? 1 : r2 < r1 ? -1 : 0;
    const dc = c2 > c1 ? 1 : c2 < c1 ? -1 : 0;
    let cr = r1, cc = c1;
    while (cc !== c2) {
      cc += dc;
      if (cc === c2 && cr === r2) break;
      if (!grid[cr][cc]) grid[cr][cc] = linkType;
    }
    while (cr !== r2) {
      cr += dr;
      if (cr === r2 && cc === c2) break;
      if (!grid[cr][cc]) grid[cr][cc] = linkType;
    }
  }

  (sections["[CONDUITS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return;
    const fromPos = nodePositions[parts[1]], toPos = nodePositions[parts[2]];
    if (!fromPos || !toPos) { warnings.push(`Conduit ${parts[0]}: missing node position`); return; }
    tracePath(fromPos, toPos, "pipe");
  });

  const xsections = {};
  (sections["[XSECTIONS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) xsections[parts[0]] = parts[1].toUpperCase();
  });

  (sections["[PUMPS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return;
    const fromPos = nodePositions[parts[1]], toPos = nodePositions[parts[2]];
    if (!fromPos || !toPos) { warnings.push(`Pump ${parts[0]}: missing node position`); return; }
    tracePath(fromPos, toPos, "pump");
  });

  (sections["[ORIFICES]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return;
    const fromPos = nodePositions[parts[1]], toPos = nodePositions[parts[2]];
    if (!fromPos || !toPos) { warnings.push(`Orifice ${parts[0]}: missing node position`); return; }
    tracePath(fromPos, toPos, "orifice");
  });

  (sections["[WEIRS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return;
    const fromPos = nodePositions[parts[1]], toPos = nodePositions[parts[2]];
    if (!fromPos || !toPos) { warnings.push(`Weir ${parts[0]}: missing node position`); return; }
    tracePath(fromPos, toPos, "weir");
  });

  const scData = {};

  (sections["[SUBCATCHMENTS]"] || []).forEach(line => {
    const p = line.trim().split(/\s+/);
    if (p.length < 6) return;
    scData[p[0]] = {
      id: p[0], gage: p[1], outlet: p[2],
      area: parseFloat(p[3]) || 0, pctImperv: parseFloat(p[4]) || 0,
      width: parseFloat(p[5]) || 0, slope: parseFloat(p[6]) || 0.5,
      cn: 75, nI: 0.015, nP: 0.24, sI: 0.06, sP: 0.3, routing: "OUTLET",
    };
  });

  (sections["[SUBAREAS]"] || []).forEach(line => {
    const p = line.trim().split(/\s+/);
    if (p.length < 5) return;
    const sc = scData[p[0]];
    if (!sc) return;
    sc.nI = parseFloat(p[1]) || 0.015;
    sc.nP = parseFloat(p[2]) || 0.24;
    sc.sI = parseFloat(p[3]) || 0.06;
    sc.sP = parseFloat(p[4]) || 0.3;
    if (p[6]) sc.routing = p[6];
  });

  (sections["[INFILTRATION]"] || []).forEach(line => {
    const p = line.trim().split(/\s+/);
    if (p.length < 2) return;
    const sc = scData[p[0]];
    if (!sc) return;
    const val1 = parseFloat(p[1]) || 0;
    const opts = sections["[OPTIONS]"] || [];
    let method = "CURVE_NUMBER";
    opts.forEach(ol => {
      const op = ol.trim().split(/\s+/);
      if (op[0]?.toUpperCase() === "INFILTRATION") method = (op[1] || "").toUpperCase();
    });
    if (method.includes("CURVE") || method.includes("CN") || (val1 >= 20 && val1 <= 100)) {
      sc.cn = val1;
      sc.infiltMethod = "CURVE_NUMBER";
    } else if (method.includes("HORTON")) {
      sc.hortonMax = val1;
      sc.hortonMin = parseFloat(p[2]) || 0;
      sc.hortonDecay = parseFloat(p[3]) || 0;
      sc.infiltMethod = "HORTON";
    } else if (method.includes("GREEN")) {
      sc.gaSuction = val1;
      sc.gaConduct = parseFloat(p[2]) || 0;
      sc.gaDeficit = parseFloat(p[3]) || 0;
      sc.infiltMethod = "GREEN_AMPT";
    } else {
      sc.cn = val1;
      sc.infiltMethod = "CURVE_NUMBER";
    }
  });

  const polygons = {};
  (sections["[Polygons]"] || sections["[POLYGONS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      const id = parts[0];
      if (!polygons[id]) polygons[id] = [];
      polygons[id].push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]) });
    }
  });

  const subcatchInfo = [];

  Object.values(scData).forEach(sc => {
    let surfType = "grass";
    if (sc.pctImperv >= 90) surfType = "road";
    else if (sc.pctImperv >= 70) surfType = "driveway";
    else if (sc.pctImperv >= 40) surfType = "sidewalk";
    else if (sc.pctImperv >= 15) surfType = "roof";
    else if (sc.pctImperv >= 5) surfType = "lid_pond";

    let cellsPlaced = 0;
    const poly = polygons[sc.id];
    if (poly && poly.length >= 3) {
      const gridPts = poly.map(p => ({
        r: margin + Math.round(((maxY - p.y) / rangeY) * (usable - 1)),
        c: margin + Math.round(((p.x - minX) / rangeX) * (usable - 1)),
      }));
      const minR = Math.max(0, Math.min(...gridPts.map(p => p.r)));
      const maxR = Math.min(GRID-1, Math.max(...gridPts.map(p => p.r)));
      const minC = Math.max(0, Math.min(...gridPts.map(p => p.c)));
      const maxC = Math.min(GRID-1, Math.max(...gridPts.map(p => p.c)));
      for (let r = minR; r <= maxR; r++)
        for (let c = minC; c <= maxC; c++)
          if (!grid[r][c]) { grid[r][c] = surfType; cellsPlaced++; }
    } else {
      const pos = nodePositions[sc.outlet];
      if (pos) {
        for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
          const nr = pos.r + dr, nc = pos.c + dc;
          if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && !grid[nr][nc]) { grid[nr][nc] = surfType; cellsPlaced++; }
        }
      }
    }

    subcatchInfo.push({
      id: sc.id, area: sc.area, pctImperv: sc.pctImperv, width: sc.width, slope: sc.slope,
      outlet: sc.outlet, cn: sc.cn, nI: sc.nI, nP: sc.nP, sI: sc.sI, sP: sc.sP,
      routing: sc.routing, infiltMethod: sc.infiltMethod || "CURVE_NUMBER",
      hortonMax: sc.hortonMax, hortonMin: sc.hortonMin, hortonDecay: sc.hortonDecay,
      gaSuction: sc.gaSuction, gaConduct: sc.gaConduct, gaDeficit: sc.gaDeficit,
      surfType, cellsPlaced,
    });
  });

  const options = {};
  (sections["[OPTIONS]"] || []).forEach(line => {
    const p = line.trim().split(/\s+/);
    if (p.length >= 2) options[p[0].toUpperCase()] = p.slice(1).join(" ");
  });

  const nJunctions = (sections["[JUNCTIONS]"] || []).length;
  const nOutfalls = (sections["[OUTFALLS]"] || []).length;
  const nStorage = (sections["[STORAGE]"] || []).length;
  const nDividers = (sections["[DIVIDERS]"] || []).length;
  const nConduits = (sections["[CONDUITS]"] || []).length;
  const nPumps = (sections["[PUMPS]"] || []).length;
  const nOrifices = (sections["[ORIFICES]"] || []).length;
  const nWeirs = (sections["[WEIRS]"] || []).length;
  const nSubcatch = Object.keys(scData).length;

  return { grid, gridSize: useSize, warnings, subcatchInfo, options, counts: {
    nJunctions, nOutfalls, nStorage, nDividers, nConduits, nPumps, nOrifices, nWeirs, nSubcatch,
  }};
}
