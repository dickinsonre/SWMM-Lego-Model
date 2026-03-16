import { getGrid, SPC } from './elements.js';
import { buildModel } from './hydraulics.js';

export function exportINP(grid, storm, cellProps) {
  const GRID = getGrid();
  const model = buildModel(grid, cellProps);
  const totalMin = (storm.rain.length * storm.dtRain) / 60;
  const endHr = Math.ceil(totalMin / 60);
  let inp = "";
  const ln = (s="") => { inp += s + "\n"; };

  ln("[TITLE]"); ln(";;SWMM5 Lego Builder Export"); ln(`;;${new Date().toISOString()}`); ln();
  ln("[OPTIONS]");
  ln("FLOW_UNITS           CFS"); ln("INFILTRATION         CURVE_NUMBER"); ln("FLOW_ROUTING         DYNWAVE");
  ln("LINK_OFFSETS          DEPTH"); ln("ALLOW_PONDING        YES");
  ln("START_DATE           01/01/2025"); ln("START_TIME           00:00:00");
  ln(`END_DATE             01/01/2025`); ln(`END_TIME             ${String(endHr).padStart(2,'0')}:00:00`);
  ln("REPORT_STEP          00:05:00"); ln("WET_STEP             00:01:00"); ln("DRY_STEP             01:00:00");
  ln("ROUTING_STEP         0:00:15"); ln("VARIABLE_STEP        0.75"); ln(); 

  const rainIntv = Math.round(storm.dtRain / 60);
  ln("[RAINGAGES]"); ln(`RG1              INTENSITY 0:${String(rainIntv).padStart(2,'0')}     1.0      TIMESERIES TS_Rain`); ln();

  ln("[SUBCATCHMENTS]");
  ln(";;Name           Rain Gage        Outlet           Area     %Imperv  Width    %Slope");
  model.subcatchments.forEach(sc => {
    ln(`${sc.id.padEnd(17)}RG1              ${sc.outlet.id.padEnd(17)}${sc.area_ac.toFixed(2).padStart(8)} ${sc.pctImperv.toFixed(0).padStart(8)} ${sc.width.toFixed(0).padStart(8)} ${sc.slope.toFixed(1).padStart(8)}`);
  }); ln();

  ln("[SUBAREAS]");
  ln(";;Subcatchment   N-Imperv   N-Perv     S-Imperv   S-Perv     PctZero    RouteTo");
  model.subcatchments.forEach(sc => {
    ln(`${sc.id.padEnd(17)}${sc.nImperv.toFixed(3).padStart(10)} ${sc.nPerv.toFixed(3).padStart(10)} ${sc.dsImperv.toFixed(2).padStart(10)} ${sc.dsPerv.toFixed(2).padStart(10)} ${("25").padStart(10)} OUTLET`);
  }); ln();

  ln("[INFILTRATION]");
  model.subcatchments.forEach(sc => { ln(`${sc.id.padEnd(17)}${sc.cn.toFixed(0).padStart(10)} ${"0.5".padStart(10)} ${"7".padStart(10)}`); }); ln();

  ln("[JUNCTIONS]");
  ln(";;Name           Elevation  MaxDepth   InitDepth  SurDepth   Aponded");
  model.nodes.forEach(n => { ln(`${n.id.padEnd(17)}${n.invert.toFixed(2).padStart(10)} ${(n.maxDepth||6).toString().padStart(10)} ${"0".padStart(10)} ${"0".padStart(10)} ${"0".padStart(10)}`); }); ln();

  ln("[OUTFALLS]");
  model.outfalls.forEach(o => { ln(`${o.id.padEnd(17)}${o.invert.toFixed(2).padStart(10)} FREE                                  NO`); }); ln();

  ln("[CONDUITS]");
  model.conduits.forEach(cd => {
    ln(`${cd.id.padEnd(17)}${cd.from.id.padEnd(17)}${cd.to.id.padEnd(17)}${cd.length.toFixed(0).padStart(10)} ${cd.n.toFixed(4).padStart(10)} ${"0".padStart(10)} ${"0".padStart(10)} ${"0".padStart(10)} ${"0".padStart(10)}`);
  }); ln();

  ln("[XSECTIONS]");
  model.conduits.forEach(cd => { ln(`${cd.id.padEnd(17)}CIRCULAR     ${cd.diam.toFixed(1).padStart(16)} ${"0".padStart(10)} ${"0".padStart(10)} ${"0".padStart(10)} ${"1".padStart(10)}`); }); ln();

  ln("[TIMESERIES]"); ln(";;Name           Time       Value");
  storm.rain.forEach((v, i) => { ln(`TS_Rain          ${(i * rainIntv)}          ${v.toFixed(2)}`); }); ln();

  ln("[COORDINATES]");
  model.allNodes.forEach(n => { ln(`${n.id.padEnd(17)}${(n.c*SPC).toFixed(3).padStart(18)} ${((GRID-1-n.r)*SPC).toFixed(3).padStart(18)}`); }); ln();

  ln("[REPORT]"); ln("SUBCATCHMENTS ALL"); ln("NODES ALL"); ln("LINKS ALL"); ln();
  return inp;
}
