import { getGrid, EL, SPC } from './elements.js';

export const DT_ROUTE = 15;

export function cnInfiltration(P_cum, CN) {
  if (CN <= 0 || CN >= 100) return P_cum;
  const S = (1000 / CN - 10);
  const Ia = 0.2 * S;
  if (P_cum <= Ia) return 0;
  return Math.pow(P_cum - Ia, 2) / (P_cum - Ia + S);
}

export function manningOverland(depth, depStorage, width, slope, n) {
  const d_eff = Math.max(depth - depStorage, 0);
  if (d_eff <= 0) return 0;
  return (1.49 / n) * width * Math.pow(d_eff / 12, 5/3) * Math.pow(slope / 100, 0.5);
}

export function manningPipe(depth_ft, diam_ft, slope, n) {
  if (depth_ft <= 0) return 0;
  const y = Math.min(depth_ft / diam_ft, 1.0);
  const theta = 2 * Math.acos(1 - 2 * y);
  const A = (diam_ft * diam_ft / 8) * (theta - Math.sin(theta));
  const P = (diam_ft / 2) * theta;
  if (P <= 0) return 0;
  const R = A / P;
  return (1.49 / n) * A * Math.pow(R, 2/3) * Math.pow(Math.abs(slope), 0.5);
}

export function buildModel(grid, cellProps) {
  const GRID = getGrid();
  const nodes = [], outfalls = [], conduits = [], subcatchments = [];
  const nodeMap = {};

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const el = grid[r][c];
      if (!el) continue;
      const def = EL[el];
      if (def.cat !== "node") continue;
      const id = `${el}_${r}_${c}`;
      const invert = (GRID - r) * 0.5;
      const cp = cellProps || {};
      const nodeOv = cp[`${r},${c}`] || cp[`${r}-${c}`];
      const maxDepth = nodeOv?.maxD !== undefined ? nodeOv.maxD : (def.maxD || 0);
      const nd = { id, r, c, type: el, invert, maxDepth, depth: 0, volume: 0, inflow: 0, outflow: 0, head: invert, isOutfall: el === "outfall", lateralInflow: 0, history: [] };
      if (el === "outfall") outfalls.push(nd);
      else nodes.push(nd);
      nodeMap[`${r},${c}`] = nd;
    }
  }

  const allNodes = [...nodes, ...outfalls];

  const visited = new Set();
  const isLink = (el) => el && EL[el]?.cat === "link";
  function traceChain(sr, sc) {
    const queue = [[sr, sc]];
    const pipes = [];
    const connNodes = [];
    const seen = new Set([`${sr},${sc}`]);
    let linkType = grid[sr][sc];
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      if (isLink(grid[r][c])) { pipes.push({ r, c }); visited.add(`${r},${c}`); }
      for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
        if (seen.has(`${nr},${nc}`)) continue;
        seen.add(`${nr},${nc}`);
        if (isLink(grid[nr][nc])) queue.push([nr, nc]);
        else if (nodeMap[`${nr},${nc}`]) connNodes.push(nodeMap[`${nr},${nc}`]);
      }
    }
    return { pipes, connNodes, linkType };
  }

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!isLink(grid[r][c]) || visited.has(`${r},${c}`)) continue;
      const { pipes, connNodes, linkType } = traceChain(r, c);
      if (connNodes.length >= 2) {
        connNodes.sort((a, b) => b.invert - a.invert);
        const from = connNodes[0], to = connNodes[connNodes.length - 1];
        const length = Math.max(pipes.length * SPC, SPC);
        const slope = Math.max((from.invert - to.invert) / length, 0.001);
        const elDef = EL[linkType] || EL.pipe;
        const cp = cellProps || {};
        let linkDiam = elDef.diam || 1.5;
        let linkN = elDef.mann || 0.013;
        for (const p of pipes) {
          const ov = cp[`${p.r}-${p.c}`];
          if (ov?.diam !== undefined) linkDiam = ov.diam;
          if (ov?.mann !== undefined) linkN = ov.mann;
        }
        conduits.push({
          id: `C_${pipes[0].r}_${pipes[0].c}`, from, to, linkType: linkType || "pipe",
          length, slope, diam: linkDiam, n: linkN,
          depth: 0, flow: 0, velocity: 0, pipes, history: [],
        });
      }
    }
  }

  const surfVisited = new Set();
  let scIdx = 0;
  function floodFill(sr, sc) {
    const cells = [];
    const queue = [[sr, sc]];
    surfVisited.add(`${sr},${sc}`);
    while (queue.length > 0) {
      const [r, c] = queue.shift();
      cells.push({ r, c, type: grid[r][c] });
      for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
        if (surfVisited.has(`${nr},${nc}`)) continue;
        if (grid[nr][nc] && EL[grid[nr][nc]].cat === "surface") {
          surfVisited.add(`${nr},${nc}`);
          queue.push([nr, nc]);
        }
      }
    }
    return cells;
  }

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!grid[r][c] || EL[grid[r][c]].cat !== "surface" || surfVisited.has(`${r},${c}`)) continue;
      const cells = floodFill(r, c);
      scIdx++;
      const centR = cells.reduce((s, c2) => s + c2.r, 0) / cells.length;
      const centC = cells.reduce((s, c2) => s + c2.c, 0) / cells.length;
      let nearest = allNodes[0], minD = Infinity;
      allNodes.forEach(n => {
        const d = Math.abs(n.r - centR) + Math.abs(n.c - centC);
        if (d < minD) { minD = d; nearest = n; }
      });
      let totI = 0, totCN = 0;
      const cp = cellProps || {};
      cells.forEach(cl => {
        const d = EL[cl.type];
        const ov = cp[`${cl.r}-${cl.c}`];
        totI += (ov?.pI !== undefined ? ov.pI : d.pI);
        totCN += (ov?.cn !== undefined ? ov.cn : d.cn);
      });
      const avgI = totI / cells.length;
      const avgCN = totCN / cells.length;
      const sample = EL[cells[0].type];
      const sampleOv = cp[`${cells[0].r}-${cells[0].c}`];
      const area_ft2 = cells.length * SPC * SPC;
      const area_ac = area_ft2 / 43560;
      const width = Math.sqrt(cells.length) * SPC;

      subcatchments.push({
        id: `SC_${scIdx}`, cells, outlet: nearest, area_ac, area_ft2, width,
        slope: sampleOv?.slope !== undefined ? sampleOv.slope : 0.5,
        pctImperv: avgI, cn: avgCN,
        nImperv: sampleOv?.nI !== undefined ? sampleOv.nI : sample.nI,
        nPerv: sampleOv?.nP !== undefined ? sampleOv.nP : sample.nP,
        dsImperv: sampleOv?.sI !== undefined ? sampleOv.sI : sample.sI,
        dsPerv: sampleOv?.sP !== undefined ? sampleOv.sP : sample.sP,
        depth: 0, cumRain: 0, cumInfil: 0, runoff: 0, cumRunoff: 0,
        history: [],
      });
    }
  }

  return { nodes, outfalls, allNodes, conduits, subcatchments };
}

export function runSWMM5(grid, storm, cellProps) {
  const model = buildModel(grid, cellProps);
  if (model.allNodes.length === 0 && model.subcatchments.length === 0) return null;

  const RAIN = storm.rain;
  const DT_RAIN = storm.dtRain;
  const TOTAL_TIME = RAIN.length * DT_RAIN;
  const nSteps = Math.ceil(TOTAL_TIME / DT_ROUTE);
  const systemHistory = [];

  for (let step = 0; step < nSteps; step++) {
    const t = step * DT_ROUTE;
    const t_min = t / 60;

    const rainIdx = Math.floor(t / DT_RAIN);
    const rainfall = rainIdx < RAIN.length ? RAIN[rainIdx] : 0;
    const rainDepthThisStep = rainfall * (DT_ROUTE / 3600);

    let totalRunoff = 0;
    model.subcatchments.forEach(sc => {
      sc.cumRain += rainDepthThisStep;

      const pctPerv = (100 - sc.pctImperv) / 100;
      const pctImp = sc.pctImperv / 100;

      const excessPerv = pctPerv > 0 ? cnInfiltration(sc.cumRain, sc.cn) : 0;
      const excessImp = Math.max(sc.cumRain - sc.dsImperv, 0);

      const totalExcess = pctImp * excessImp + pctPerv * excessPerv;

      sc.depth = Math.max(totalExcess - sc.cumRunoff, 0);

      const n_eff = pctImp * sc.nImperv + pctPerv * sc.nPerv;
      const ds_eff = pctImp * sc.dsImperv + pctPerv * sc.dsPerv;
      const q = manningOverland(sc.depth, ds_eff, sc.width, sc.slope, n_eff);
      sc.runoff = Math.max(q, 0);

      const vol_out = sc.runoff * DT_ROUTE;
      const depth_out = (vol_out / sc.area_ft2) * 12;
      sc.cumRunoff += depth_out;
      sc.depth = Math.max(sc.depth - depth_out, 0);

      totalRunoff += sc.runoff;

      if (sc.outlet) sc.outlet.lateralInflow += sc.runoff;

      sc.history.push({ t: t_min, rain: rainfall, depth: sc.depth, runoff: sc.runoff, cumRain: sc.cumRain });
    });

    model.allNodes.forEach(n => { n.inflow = n.lateralInflow; n.lateralInflow = 0; });

    model.conduits.forEach(cd => {
      const fromNode = cd.from;
      const toNode = cd.to;

      const h_up = fromNode.invert + fromNode.depth;
      const h_dn = toNode.isOutfall ? toNode.invert : toNode.invert + toNode.depth;
      const dh = h_up - h_dn;
      const slope_eff = Math.max(dh / cd.length, 0.0001);

      const pipeDepth = Math.min(fromNode.depth, cd.diam);
      cd.flow = manningPipe(pipeDepth, cd.diam, slope_eff, cd.n);
      cd.depth = pipeDepth;

      const maxVol = fromNode.depth * 12.566;
      const maxFlow = maxVol / DT_ROUTE;
      cd.flow = Math.min(cd.flow, Math.max(maxFlow, 0));

      const area = Math.PI * cd.diam * cd.diam / 4;
      cd.velocity = area > 0 ? cd.flow / area : 0;

      fromNode.outflow += cd.flow;
      toNode.inflow += cd.flow;

      cd.history.push({ t: t_min, flow: cd.flow, depth: cd.depth, velocity: cd.velocity });
    });

    model.allNodes.forEach(n => {
      if (n.isOutfall) {
        n.depth = 0;
        n.history.push({ t: t_min, depth: 0, inflow: n.inflow, head: n.invert });
        n.inflow = 0; n.outflow = 0;
        return;
      }
      const netFlow = n.inflow - n.outflow;
      const dVol = netFlow * DT_ROUTE;
      const surfArea = 12.566;
      const dDepth = dVol / surfArea;
      n.depth = Math.max(Math.min(n.depth + dDepth, n.maxDepth || 6), 0);
      n.head = n.invert + n.depth;
      n.history.push({ t: t_min, depth: n.depth, inflow: n.inflow, outflow: n.outflow, head: n.head });
      n.inflow = 0; n.outflow = 0;
    });

    const totalNodeDepth = model.nodes.reduce((s, n) => s + n.depth, 0);
    const totalPipeFlow = model.conduits.reduce((s, c) => s + c.flow, 0);
    const outfallFlow = model.outfalls.reduce((s, o) => s + (o.history[o.history.length-1]?.inflow || 0), 0);

    systemHistory.push({
      t: t_min, rainfall, totalRunoff,
      totalPipeFlow, outfallFlow,
      totalNodeDepth: totalNodeDepth / Math.max(model.nodes.length, 1),
    });
  }

  return { ...model, systemHistory, totalTime: TOTAL_TIME };
}
