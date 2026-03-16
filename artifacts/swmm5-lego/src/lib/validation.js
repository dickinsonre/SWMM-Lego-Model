import { getGrid, EL } from './elements.js';
import { buildModel } from './hydraulics.js';

export function validateModel(grid) {
  const GRID = getGrid();
  const errors = [], warnings = [];
  let nodes = 0, pipes = 0, surfaces = 0, outfalls = 0;
  const errCells = new Set();
  const warnCells = new Set();

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const el = grid[r][c];
      if (!el) continue;
      const d = EL[el];
      if (d.cat === "node") { nodes++; if (el === "outfall") outfalls++; }
      if (d.cat === "link") pipes++;
      if (d.cat === "surface") surfaces++;
    }
  }

  if (nodes === 0 && pipes === 0 && surfaces === 0) {
    errors.push("Model is empty.");
    return { errors, warnings, errCells, warnCells };
  }
  if (outfalls === 0 && nodes > 0) errors.push("No outfall. SWMM5 requires at least one.");
  if (surfaces === 0 && (nodes > 0 || pipes > 0)) errors.push("No surface elements — model will produce zero runoff.");
  if (surfaces > 0 && nodes === 0) warnings.push("Surfaces exist but no nodes to drain to.");

  const connectedNodes = new Set();
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!grid[r][c] || EL[grid[r][c]]?.cat !== "link") continue;
      const adj = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
      const hasAdj = adj.some(([nr, nc]) =>
        nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && grid[nr][nc] &&
        (EL[grid[nr][nc]].cat === "node" || EL[grid[nr][nc]].cat === "link")
      );
      if (!hasAdj) { errors.push(`${EL[grid[r][c]].lbl} (${r},${c}) disconnected.`); errCells.add(`${r}-${c}`); }
      adj.forEach(([nr, nc]) => {
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && grid[nr][nc] && EL[grid[nr][nc]]?.cat === "node") {
          connectedNodes.add(`${nr}-${nc}`);
        }
      });
    }
  }

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const el = grid[r][c];
      if (!el || EL[el]?.cat !== "node" || el === "outfall") continue;
      if (!connectedNodes.has(`${r}-${c}`)) {
        warnings.push(`${EL[el].lbl} (${r},${c}) has no connected pipes.`);
        warnCells.add(`${r}-${c}`);
      }
    }
  }

  const storageNodes = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (grid[r][c] === "storage") storageNodes.push({ r, c });
  storageNodes.forEach(({ r, c }) => {
    const adj = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
    const hasOutlet = adj.some(([nr, nc]) =>
      nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && grid[nr][nc] && EL[grid[nr][nc]]?.cat === "link"
    );
    if (!hasOutlet) {
      warnings.push(`Storage (${r},${c}) has no outlet pipe — will fill and overflow.`);
      warnCells.add(`${r}-${c}`);
    }
  });

  if (pipes > 0) {
    const model = buildModel(grid);
    if (model.conduits.every(c => Math.abs(c.slope) < 0.0001)) {
      warnings.push("All pipes are nearly flat — flow may stall or oscillate.");
    }
    const DT_ROUTE = 15;
    model.conduits.forEach(cd => {
      const celerity = Math.sqrt(9.81 * 0.3048 * cd.diam);
      const courant = (celerity * DT_ROUTE) / (cd.length || 1);
      if (courant > 1.0) {
        warnings.push(`CFL: ${cd.id} Courant=${courant.toFixed(2)} > 1.0 — may be unstable.`);
        cd.pipes.forEach(p => warnCells.add(`${p.r}-${p.c}`));
      }
    });
  }

  return { errors, warnings, errCells, warnCells };
}

export function autoFix(grid) {
  const GRID = getGrid();
  const next = grid.map(r => [...r]);
  const fixes = [];
  let hasOutfall = false;
  const nodePos = [];

  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      if (next[r][c] === "outfall") hasOutfall = true;
      if (next[r][c] && EL[next[r][c]].cat === "node") nodePos.push({ r, c });
    }

  if (!hasOutfall && nodePos.length > 0) {
    const low = nodePos.reduce((a, b) => a.r > b.r ? a : b);
    for (const [dr, dc] of [[1,0],[0,1],[-1,0],[0,-1],[2,0]]) {
      const nr = low.r + dr, nc = low.c + dc;
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && !next[nr][nc]) {
        next[nr][nc] = "outfall"; fixes.push(`Added outfall at (${nr},${nc})`); break;
      }
    }
  }

  const hasSurf = next.flat().some(e => e && EL[e]?.cat === "surface");
  const hasNode = next.flat().some(e => e && EL[e]?.cat === "node");
  if (hasSurf && !hasNode) {
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++)
        if (!next[r][c]) {
          next[r][c] = "inlet"; fixes.push(`Added inlet at (${r},${c})`);
          for (const [dr2, dc2] of [[1,0],[0,1]]) {
            const nr = r+dr2, nc = c+dc2;
            if (nr < GRID && nc < GRID && !next[nr][nc]) {
              next[nr][nc] = "outfall"; fixes.push(`Added outfall at (${nr},${nc})`);
              return { grid: next, fixes };
            }
          }
          return { grid: next, fixes };
        }
  }
  return { grid: next, fixes };
}
