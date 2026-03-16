import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, CartesianGrid, ReferenceLine } from "recharts";

// ═══════════════════════════════════════════════════
// GRID & ELEMENT CONFIGURATION
// ═══════════════════════════════════════════════════
let GRID = 20;
const CELL = 34;
const SPC = 100; // ft spacing

const EL = {
  // ── SURFACES ──  (LEGO brick colors)
  grass:    { lbl:"Grass",      clr:"#70C442", bdr:"#4B9F4A", e:"🌱", cat:"surface", cn:39,  pI:0,   nI:0.015, nP:0.24, sI:0.06, sP:0.3  },
  roof:     { lbl:"Roof",       clr:"#D01012", bdr:"#A00C0E", e:"🏠", cat:"surface", cn:98,  pI:100, nI:0.012, nP:0.1,  sI:0.05, sP:0.05 },
  road:     { lbl:"Road",       clr:"#6C6E68", bdr:"#4A4C47", e:"🛣️", cat:"surface", cn:98,  pI:95,  nI:0.015, nP:0.1,  sI:0.06, sP:0.05 },
  driveway: { lbl:"Driveway",   clr:"#9BA19D", bdr:"#787D79", e:"🅿️", cat:"surface", cn:98,  pI:90,  nI:0.014, nP:0.1,  sI:0.05, sP:0.05 },
  sidewalk: { lbl:"Sidewalk",   clr:"#E4CD9E", bdr:"#C4AD7E", e:"🚶", cat:"surface", cn:98,  pI:95,  nI:0.014, nP:0.1,  sI:0.05, sP:0.05 },
  lid_pond: { lbl:"LID Pond",   clr:"#5A93DB", bdr:"#3A73BB", e:"🌿", cat:"surface", cn:65,  pI:10,  nI:0.1,   nP:0.3,  sI:0.1,  sP:0.5  },
  perm_pave:{ lbl:"Perm Pave",  clr:"#7FC5AA", bdr:"#5FA58A", e:"🧱", cat:"surface", cn:72,  pI:30,  nI:0.015, nP:0.2,  sI:0.05, sP:0.2  },
  grn_roof: { lbl:"Green Roof", clr:"#4B9F4A", bdr:"#3A8A3A", e:"🍃", cat:"surface", cn:55,  pI:5,   nI:0.1,   nP:0.4,  sI:0.1,  sP:0.5  },
  rain_brl: { lbl:"Rain Barrel", clr:"#003F87", bdr:"#002F67", e:"🛢️", cat:"surface", cn:85,  pI:50,  nI:0.015, nP:0.2,  sI:0.5,  sP:0.3  },
  swale:    { lbl:"Swale",      clr:"#7FC5AA", bdr:"#4B9F4A", e:"〰️", cat:"surface", cn:58,  pI:0,   nI:0.15,  nP:0.35, sI:0.2,  sP:0.4  },
  // ── NODES ──
  manhole:  { lbl:"Manhole",    clr:"#6C6E68", bdr:"#4A4C47", e:"⚙️",  cat:"node", maxD:6 },
  inlet:    { lbl:"Inlet",      clr:"#006DB7", bdr:"#004D87", e:"🔽",  cat:"node", maxD:4 },
  outfall:  { lbl:"Outfall",    clr:"#003F87", bdr:"#002F67", e:"🌊",  cat:"node" },
  storage:  { lbl:"Storage",    clr:"#FE8A18", bdr:"#CE6A08", e:"🏊",  cat:"node", maxD:10 },
  divider:  { lbl:"Divider",    clr:"#F2C717", bdr:"#C2A707", e:"🔀",  cat:"node", maxD:6 },
  // ── LINKS ──
  pipe:     { lbl:"Pipe",       clr:"#5A93DB", bdr:"#3A73BB", e:"🔵", cat:"link", diam:1.5, mann:0.013 },
  channel:  { lbl:"Channel",    clr:"#006DB7", bdr:"#004D87", e:"🟦", cat:"link", diam:3.0, mann:0.025 },
  pump:     { lbl:"Pump",       clr:"#FE8A18", bdr:"#CE6A08", e:"⬆️", cat:"link", diam:2.0, mann:0.013 },
  orifice:  { lbl:"Orifice",    clr:"#5A93DB", bdr:"#3A73BB", e:"🔘", cat:"link", diam:1.0, mann:0.013 },
  weir:     { lbl:"Weir",       clr:"#F2C717", bdr:"#C2A707", e:"🚧", cat:"link", diam:2.0, mann:0.013 },
};

const CATS = [
  { k:"surface", l:"SURFACES", items:["grass","roof","road","driveway","sidewalk","lid_pond","perm_pave","grn_roof","rain_brl","swale"] },
  { k:"node", l:"NODES", items:["manhole","inlet","outfall","storage","divider"] },
  { k:"link", l:"LINKS", items:["pipe","channel","pump","orifice","weir"] },
];

// ═══════════════════════════════════════════════════
// 5 DEMO SCENARIOS
// ═══════════════════════════════════════════════════
function emptyGrid(sz) { const n = sz || GRID; return Array(n).fill(null).map(() => Array(n).fill(null)); }

const DEMOS = [
  {
    name: "🏘️ Residential",
    desc: "Suburban neighborhood with houses, lawns, driveways and a trunk sewer",
    build: () => {
      const g = emptyGrid();
      // Houses with lawns
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if ((r + c) % 5 === 0) g[r][c] = "roof";
        else if ((r + c) % 5 === 1) g[r][c] = "driveway";
        else g[r][c] = "grass";
      }
      // Road corridor down column 10
      for (let r = 0; r < GRID; r++) { g[r][9] = "road"; g[r][10] = "road"; }
      // Sidewalks along road
      for (let r = 0; r < GRID; r++) { g[r][8] = "sidewalk"; g[r][11] = "sidewalk"; }
      // Sewer trunk line under road
      g[1][10] = "inlet";
      for (let r = 2; r <= 5; r++) g[r][10] = "pipe";
      g[6][10] = "manhole";
      for (let r = 7; r <= 10; r++) g[r][10] = "pipe";
      g[11][10] = "manhole";
      for (let r = 12; r <= 15; r++) g[r][10] = "pipe";
      g[16][10] = "manhole";
      for (let r = 17; r <= 18; r++) g[r][10] = "pipe";
      g[19][10] = "outfall";
      // Extra inlets
      g[6][9] = "inlet"; g[11][9] = "inlet"; g[16][9] = "inlet";
      return g;
    },
  },
  {
    name: "🅿️ Parking Lot",
    desc: "Commercial lot with mostly impervious surface and LID treatment",
    build: () => {
      const g = emptyGrid();
      // Mostly driveway/road
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if (r < 2 || r > 17) g[r][c] = "sidewalk";
        else if (c < 2 || c > 17) g[r][c] = "sidewalk";
        else g[r][c] = (r + c) % 6 === 0 ? "road" : "driveway";
      }
      // LID bioswales along edges
      for (let r = 2; r <= 17; r++) { g[r][2] = "lid_pond"; g[r][17] = "lid_pond"; }
      for (let c = 2; c <= 17; c++) { g[2][c] = "lid_pond"; g[17][c] = "lid_pond"; }
      // Collection system
      g[5][10] = "inlet"; g[10][10] = "inlet"; g[15][10] = "inlet";
      g[6][10] = "pipe"; g[7][10] = "pipe"; g[8][10] = "pipe"; g[9][10] = "pipe";
      g[11][10] = "pipe"; g[12][10] = "pipe"; g[13][10] = "pipe"; g[14][10] = "pipe";
      g[10][10] = "manhole";
      g[16][10] = "pipe"; g[17][10] = "pipe"; g[18][10] = "pipe";
      g[19][10] = "outfall";
      return g;
    },
  },
  {
    name: "🌿 Green Infra",
    desc: "Low-impact development with bioretention, grass channels, minimal impervious",
    build: () => {
      const g = emptyGrid();
      // Mostly grass with scattered LID
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if ((r * 3 + c * 7) % 11 < 3) g[r][c] = "lid_pond";
        else if ((r * 5 + c) % 13 < 2) g[r][c] = "roof";
        else g[r][c] = "grass";
      }
      // Grass channels (represented as grass strips) with inlets
      for (let c = 0; c < GRID; c++) g[10][c] = "grass";
      // Small collection at bottom
      g[10][5] = "inlet"; g[10][10] = "manhole"; g[10][15] = "inlet";
      for (let c = 6; c <= 9; c++) g[10][c] = "pipe";
      for (let c = 11; c <= 14; c++) g[10][c] = "pipe";
      // Trunk to outfall
      for (let r = 11; r <= 18; r++) g[r][10] = "pipe";
      g[15][10] = "manhole";
      g[19][10] = "outfall";
      return g;
    },
  },
  {
    name: "🛣️ Highway",
    desc: "Highway corridor with shoulders, median, and roadside drainage",
    build: () => {
      const g = emptyGrid();
      // Grass everywhere first
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = "grass";
      // Highway lanes columns 7-12
      for (let r = 0; r < GRID; r++) {
        g[r][6] = "sidewalk"; // shoulder
        g[r][7] = "road"; g[r][8] = "road"; g[r][9] = "road"; // lanes
        g[r][10] = "driveway"; // median
        g[r][11] = "road"; g[r][12] = "road"; g[r][13] = "road"; // lanes
        g[r][14] = "sidewalk"; // shoulder
      }
      // Drainage system along shoulder
      g[1][6] = "inlet";
      for (let r = 2; r <= 4; r++) g[r][6] = "pipe";
      g[5][6] = "manhole";
      for (let r = 6; r <= 9; r++) g[r][6] = "pipe";
      g[10][6] = "manhole";
      for (let r = 11; r <= 14; r++) g[r][6] = "pipe";
      g[15][6] = "manhole";
      for (let r = 16; r <= 18; r++) g[r][6] = "pipe";
      g[19][6] = "outfall";
      // Cross pipe at manhole 10
      for (let c = 7; c <= 13; c++) g[10][c] = "pipe";
      g[10][14] = "inlet";
      return g;
    },
  },
  {
    name: "🏙️ Mixed-Use",
    desc: "Downtown block with buildings, roads, sidewalks, and a LID plaza",
    build: () => {
      const g = emptyGrid();
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if (r < 2 || r >= 18 || c < 2 || c >= 18) g[r][c] = "road";
        else g[r][c] = "grass";
      }
      for (let r = 2; r < 18; r++) { g[r][2] = "sidewalk"; g[r][17] = "sidewalk"; }
      for (let c = 2; c < 18; c++) { g[2][c] = "sidewalk"; g[17][c] = "sidewalk"; }
      for (let r = 3; r <= 7; r++) for (let c = 3; c <= 8; c++) g[r][c] = "roof";
      for (let r = 3; r <= 7; r++) for (let c = 11; c <= 16; c++) g[r][c] = "roof";
      for (let r = 9; r <= 12; r++) for (let c = 6; c <= 13; c++) g[r][c] = "lid_pond";
      for (let r = 14; r <= 16; r++) for (let c = 3; c <= 16; c++) g[r][c] = "driveway";
      g[1][5] = "inlet"; g[1][10] = "inlet"; g[1][15] = "inlet";
      g[1][6] = "pipe"; g[1][7] = "pipe"; g[1][8] = "pipe"; g[1][9] = "pipe";
      g[1][11] = "pipe"; g[1][12] = "pipe"; g[1][13] = "pipe"; g[1][14] = "pipe";
      g[1][10] = "manhole";
      for (let r = 2; r <= 6; r++) g[r][10] = "pipe";
      g[7][10] = "manhole";
      for (let r = 8; r <= 12; r++) g[r][10] = "pipe";
      g[13][10] = "manhole";
      for (let r = 14; r <= 18; r++) g[r][10] = "pipe";
      g[19][10] = "outfall";
      return g;
    },
  },
  {
    name: "🏫 School Campus",
    desc: "School with athletic fields, parking, buildings, and dual outfalls",
    build: () => {
      const g = emptyGrid();
      // Athletic fields (grass) top-left
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) g[r][c] = "grass";
      // Main building top-right
      for (let r = 0; r < 7; r++) for (let c = 10; c < GRID; c++) g[r][c] = "roof";
      // Gym building
      for (let r = 8; r <= 12; r++) for (let c = 0; c <= 4; c++) g[r][c] = "roof";
      // Parking lot
      for (let r = 8; r <= 14; r++) for (let c = 10; c < GRID; c++) g[r][c] = "driveway";
      // Central courtyard with LID
      for (let r = 8; r <= 12; r++) for (let c = 5; c <= 9; c++) g[r][c] = "lid_pond";
      // Roads & sidewalks around campus
      for (let c = 0; c < GRID; c++) { g[15][c] = "road"; g[16][c] = "sidewalk"; }
      for (let r = 17; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = "grass";
      // Drainage: west trunk
      g[2][9] = "inlet";
      for (let r = 3; r <= 6; r++) g[r][9] = "pipe";
      g[7][9] = "manhole";
      for (let r = 8; r <= 12; r++) g[r][9] = "pipe";
      g[13][9] = "manhole";
      g[14][9] = "pipe";
      g[15][9] = "manhole";
      for (let r = 16; r <= 18; r++) g[r][9] = "pipe";
      g[19][9] = "outfall";
      // East branch
      g[7][15] = "inlet";
      for (let c = 10; c <= 14; c++) g[7][c] = "pipe";
      g[7][9] = "manhole";
      // Second outfall east
      g[15][16] = "inlet";
      for (let r = 16; r <= 18; r++) g[r][16] = "pipe";
      g[19][16] = "outfall";
      return g;
    },
  },
  {
    name: "🏭 Industrial",
    desc: "Warehouse district with large roofs, loading docks, and heavy-duty drainage",
    build: () => {
      const g = emptyGrid();
      // Large warehouse blocks
      for (let r = 0; r <= 6; r++) for (let c = 0; c <= 7; c++) g[r][c] = "roof";
      for (let r = 0; r <= 6; r++) for (let c = 12; c <= 19; c++) g[r][c] = "roof";
      for (let r = 10; r <= 16; r++) for (let c = 0; c <= 7; c++) g[r][c] = "roof";
      for (let r = 10; r <= 16; r++) for (let c = 12; c <= 19; c++) g[r][c] = "roof";
      // Loading docks / roads between buildings
      for (let c = 0; c < GRID; c++) { g[7][c] = "road"; g[8][c] = "road"; g[9][c] = "driveway"; }
      for (let r = 0; r < 17; r++) { g[r][8] = "road"; g[r][9] = "driveway"; g[r][10] = "road"; g[r][11] = "road"; }
      // Perimeter grass
      for (let c = 0; c < GRID; c++) { g[17][c] = "sidewalk"; g[18][c] = "grass"; g[19][c] = "grass"; }
      // Heavy trunk sewer down center
      g[0][10] = "inlet";
      for (let r = 1; r <= 3; r++) g[r][10] = "pipe";
      g[4][10] = "manhole";
      for (let r = 5; r <= 6; r++) g[r][10] = "pipe";
      g[7][10] = "manhole";
      for (let r = 8; r <= 11; r++) g[r][10] = "pipe";
      g[12][10] = "manhole";
      for (let r = 13; r <= 16; r++) g[r][10] = "pipe";
      g[17][10] = "manhole";
      g[18][10] = "pipe";
      g[19][10] = "outfall";
      // Cross pipes from inlets
      g[4][8] = "inlet"; g[4][12] = "inlet";
      g[4][9] = "pipe"; g[4][11] = "pipe";
      g[12][8] = "inlet"; g[12][12] = "inlet";
      g[12][9] = "pipe"; g[12][11] = "pipe";
      return g;
    },
  },
  {
    name: "⛰️ Hillside",
    desc: "Steep terrain with terraced development, cascading manholes, and erosion control",
    build: () => {
      const g = emptyGrid();
      // Terraced grass with steeper sections
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if (r < 4) g[r][c] = "grass"; // hilltop
        else if (r < 8) g[r][c] = (r + c) % 3 === 0 ? "lid_pond" : "grass"; // LID terrace
        else if (r < 12) g[r][c] = (r + c) % 4 === 0 ? "roof" : "grass"; // houses
        else if (r < 16) g[r][c] = (r + c) % 5 < 2 ? "roof" : "grass"; // denser houses
        else g[r][c] = "grass"; // valley floor
      }
      // Cascading sewer down the slope (zigzag)
      g[0][10] = "inlet";
      for (let r = 1; r <= 3; r++) g[r][10] = "pipe";
      g[4][10] = "manhole";
      for (let c = 10; c >= 7; c--) g[4][c] = c === 7 ? "manhole" : "pipe";
      for (let r = 5; r <= 8; r++) g[r][7] = "pipe";
      g[9][7] = "manhole";
      for (let c = 7; c <= 13; c++) g[9][c] = c === 13 ? "manhole" : "pipe";
      for (let r = 10; r <= 13; r++) g[r][13] = "pipe";
      g[14][13] = "manhole";
      for (let c = 13; c >= 10; c--) g[14][c] = c === 10 ? "manhole" : "pipe";
      for (let r = 15; r <= 18; r++) g[r][10] = "pipe";
      g[19][10] = "outfall";
      // Side inlets
      g[4][5] = "inlet"; g[4][6] = "pipe";
      g[9][4] = "inlet"; g[9][5] = "pipe"; g[9][6] = "pipe";
      g[14][15] = "inlet"; g[14][14] = "pipe";
      return g;
    },
  },
  {
    name: "🏥 Hospital",
    desc: "Hospital complex with emergency access, helipads, and redundant drainage",
    build: () => {
      const g = emptyGrid();
      // Main hospital (large roof block)
      for (let r = 2; r <= 10; r++) for (let c = 3; c <= 12; c++) g[r][c] = "roof";
      // Emergency wing
      for (let r = 4; r <= 8; r++) for (let c = 13; c <= 17; c++) g[r][c] = "roof";
      // Parking structure
      for (let r = 12; r <= 15; r++) for (let c = 3; c <= 9; c++) g[r][c] = "driveway";
      // Helipad (sidewalk)
      for (let r = 0; r <= 1; r++) for (let c = 6; c <= 9; c++) g[r][c] = "sidewalk";
      // Landscaping
      for (let r = 12; r <= 15; r++) for (let c = 10; c <= 17; c++) g[r][c] = "lid_pond";
      // Fill remaining with grass
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (!g[r][c]) g[r][c] = "grass";
      // Access roads
      for (let r = 0; r < GRID; r++) { g[r][2] = "road"; g[r][18] = "road"; }
      for (let c = 2; c <= 18; c++) { g[16][c] = "road"; g[11][c] = "sidewalk"; }
      // Dual trunk sewers (redundancy)
      g[1][2] = "inlet";
      for (let r = 2; r <= 5; r++) g[r][2] = "pipe";
      g[6][2] = "manhole";
      for (let r = 7; r <= 10; r++) g[r][2] = "pipe";
      g[11][2] = "manhole";
      for (let r = 12; r <= 15; r++) g[r][2] = "pipe";
      g[16][2] = "manhole";
      for (let r = 17; r <= 18; r++) g[r][2] = "pipe";
      g[19][2] = "outfall";
      // East trunk
      g[1][18] = "inlet";
      for (let r = 2; r <= 8; r++) g[r][18] = "pipe";
      g[9][18] = "manhole";
      for (let r = 10; r <= 15; r++) g[r][18] = "pipe";
      g[16][18] = "manhole";
      for (let r = 17; r <= 18; r++) g[r][18] = "pipe";
      g[19][18] = "outfall";
      // Cross pipes
      for (let c = 3; c <= 17; c++) g[11][c] = "pipe";
      g[11][10] = "manhole";
      return g;
    },
  },
  {
    name: "🔄 Dual Outfall",
    desc: "Split drainage — east and west basins discharging to separate outfalls",
    build: () => {
      const g = emptyGrid();
      // West basin: grass + roof
      for (let r = 0; r < GRID; r++) for (let c = 0; c <= 9; c++)
        g[r][c] = (r + c) % 4 === 0 ? "roof" : "grass";
      // East basin: road + driveway
      for (let r = 0; r < GRID; r++) for (let c = 10; c < GRID; c++)
        g[r][c] = (r + c) % 3 === 0 ? "driveway" : "road";
      // Central divider (sidewalk)
      for (let r = 0; r < GRID; r++) g[r][9] = "sidewalk";
      for (let r = 0; r < GRID; r++) g[r][10] = "sidewalk";
      // West trunk
      g[2][4] = "inlet";
      for (let r = 3; r <= 7; r++) g[r][4] = "pipe";
      g[8][4] = "manhole";
      for (let r = 9; r <= 13; r++) g[r][4] = "pipe";
      g[14][4] = "manhole";
      for (let r = 15; r <= 18; r++) g[r][4] = "pipe";
      g[19][4] = "outfall";
      g[8][2] = "inlet"; g[8][3] = "pipe";
      g[14][2] = "inlet"; g[14][3] = "pipe";
      // East trunk
      g[2][15] = "inlet";
      for (let r = 3; r <= 7; r++) g[r][15] = "pipe";
      g[8][15] = "manhole";
      for (let r = 9; r <= 13; r++) g[r][15] = "pipe";
      g[14][15] = "manhole";
      for (let r = 15; r <= 18; r++) g[r][15] = "pipe";
      g[19][15] = "outfall";
      g[8][17] = "inlet"; g[8][16] = "pipe";
      g[14][17] = "inlet"; g[14][16] = "pipe";
      return g;
    },
  },
  {
    name: "🏟️ Stadium",
    desc: "Large venue with vast roof, surrounding plazas, and high-capacity drainage",
    build: () => {
      const g = emptyGrid();
      // Surrounding grass/park
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = "grass";
      // Plaza ring (sidewalk)
      for (let r = 3; r <= 16; r++) for (let c = 3; c <= 16; c++) g[r][c] = "sidewalk";
      // Stadium roof (inner)
      for (let r = 5; r <= 14; r++) for (let c = 5; c <= 14; c++) g[r][c] = "roof";
      // Field center (grass)
      for (let r = 7; r <= 12; r++) for (let c = 7; c <= 12; c++) g[r][c] = "grass";
      // Access roads
      for (let c = 0; c < GRID; c++) g[0][c] = "road";
      for (let c = 0; c < GRID; c++) g[19][c] = "road";
      for (let r = 0; r < GRID; r++) g[r][0] = "road";
      for (let r = 0; r < GRID; r++) g[r][19] = "road";
      // 4-corner drainage to center
      g[3][3] = "inlet"; g[3][16] = "inlet"; g[16][3] = "inlet"; g[16][16] = "inlet";
      // NW to center
      for (let c = 4; c <= 9; c++) g[3][c] = "pipe";
      g[3][10] = "manhole";
      // NE to center
      for (let c = 11; c <= 15; c++) g[3][c] = "pipe";
      // Trunk south
      for (let r = 4; r <= 9; r++) g[r][10] = "pipe";
      g[10][10] = "manhole";
      for (let r = 11; r <= 15; r++) g[r][10] = "pipe";
      g[16][10] = "manhole";
      // SW and SE feed into trunk
      for (let c = 4; c <= 9; c++) g[16][c] = "pipe";
      for (let c = 11; c <= 15; c++) g[16][c] = "pipe";
      // Trunk to outfall
      for (let r = 17; r <= 18; r++) g[r][10] = "pipe";
      g[19][10] = "outfall";
      return g;
    },
  },
  {
    name: "🧪 Minimal Test",
    desc: "Simplest possible model — 1 surface, 1 inlet, 1 pipe, 1 outfall",
    build: () => {
      const g = emptyGrid();
      // Small catchment
      for (let r = 5; r <= 9; r++) for (let c = 7; c <= 12; c++) g[r][c] = "grass";
      g[10][10] = "inlet";
      g[11][10] = "pipe";
      g[12][10] = "pipe";
      g[13][10] = "pipe";
      g[14][10] = "outfall";
      return g;
    },
  },
];

// ═══════════════════════════════════════════════════
// SWMM5 JAVASCRIPT ENGINE
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// DESIGN STORMS LIBRARY — 49 Global Patterns
// Rain Canvas Studio equations implemented in JS
// ═══════════════════════════════════════════════════

// Helper: evaluate piecewise cumulative distribution
// segs = [[t0,t1,F0,F1,exp], ...] where F(t) = F0 + (F1-F0)*((t-t0)/(t1-t0))^exp
function _F(t, segs) {
  if (t <= 0) return 0; if (t >= 1) return 1;
  for (const [t0,t1,F0,F1,ex] of segs) {
    if (t >= t0 && t <= t1) { const r = t1>t0?(t-t0)/(t1-t0):1; return F0+(F1-F0)*Math.pow(r,ex); }
  }
  return 1;
}
function _CD(segs, P, D, N) {
  const dt = D/N;
  return Array.from({length:N},(_,i) => Math.max((_F((i+1)/N,segs)-_F(i/N,segs))*P/dt, 0));
}
function _IF(fn, P, D, N) {
  const dt = D/N;
  const raw = Array.from({length:N},(_,i) => Math.max(fn((i+.5)/N),0));
  const tot = raw.reduce((s,v) => s+v*dt, 0);
  const sc = tot>0?P/tot:0;
  return raw.map(v => v*sc);
}
function _S(name, desc, cat, P, D, N, rainArr) {
  const dtRain = (D*3600)/N, dt = D/N;
  const peak = Math.max(...rainArr), total = rainArr.reduce((s,v) => s+v*dt, 0);
  return { name, desc, cat, dtRain, rain: rainArr, total: `~${total.toFixed(1)} in`, peak: `${peak.toFixed(1)} in/hr` };
}

const STORM_CATS = [
  { key:"us", label:"🇺🇸 US STANDARDS" }, { key:"us_state", label:"🏛️ US STATE/LOCAL" },
  { key:"europe", label:"🇪🇺 EUROPE" }, { key:"asia", label:"🌏 ASIA-PACIFIC" },
  { key:"other", label:"🌍 OTHER REGIONS" }, { key:"generic", label:"📐 GENERIC" },
];

const STORMS = [
  // ── US Standards ──
  _S("⛈️ SCS Type II","Standard US — ~95% of continental US","us",1,1,24,_CD([[0,.5,0,.35,.9],[.5,.6,.35,.80,1],[.6,1,.80,1,1]],1,1,24)),
  _S("🌊 SCS Type III","Gulf Coast & tropical — sharp peak","us",1,1,24,_CD([[0,.5,0,.25,1],[.5,.58,.25,.75,1],[.58,1,.75,1,1]],1,1,24)),
  _S("🌲 SCS Type I","Pacific maritime — wet winters","us",1,1,24,_CD([[0,.4,0,.50,.8],[.4,.6,.50,.85,1],[.6,1,.85,1,1]],1,1,24)),
  _S("🌧️ SCS Type IA","Pacific NW coastal — early peak","us",1,1,24,_CD([[0,.35,0,.55,.75],[.35,.55,.55,.85,1],[.55,1,.85,1,1]],1,1,24)),
  (() => { // Balanced (Alternating Block)
    const N=24,P=1,D=1,bl=[];
    for(let i=0;i<N;i++){const d1=(i+1)/N,d0=i/N;bl.push(Math.pow(d1,.6)-Math.pow(d0,.6));}
    bl.sort((a,b)=>b-a); const arr=Array(N).fill(0),m=N/2;
    bl.forEach((b,i)=>{if(i===0)arr[m]=b;else if(i%2===1)arr[m-Math.ceil(i/2)]=b;else arr[m+Math.floor(i/2)]=b;});
    return _S("⚖️ Balanced (Alt Block)","IDF-derived symmetric — Chow/Maidment","us",P,D,N,arr.map(b=>b*P/(D/N)));
  })(),
  _S("📡 NOAA Atlas 14","Measured gage data — modern standard","us",1,1,24,_CD([[0,.10,0,.04,1],[.10,.25,.04,.14,1],[.25,.40,.14,.32,1],[.40,.55,.32,.67,1],[.55,.70,.67,.85,1],[.70,.85,.85,.95,1],[.85,1,.95,1,1]],1,1,24)),
  // Huff Quartiles
  _S("📊 Huff 1st Quartile","Short convective — 65% in first 25%","us",1,1,24,_CD([[0,.25,0,.65,.7],[.25,.50,.65,.85,1],[.50,.75,.85,.95,1],[.75,1,.95,1,1]],1,1,24)),
  _S("📊 Huff 2nd Quartile","Frontal storms — peak at 25-50%","us",1,1,24,_CD([[0,.25,0,.20,1],[.25,.50,.20,.70,.7],[.50,.75,.70,.90,1],[.75,1,.90,1,1]],1,1,24)),
  _S("📊 Huff 3rd Quartile","Late-developing — peak at 50-75%","us",1,1,24,_CD([[0,.25,0,.15,1],[.25,.50,.15,.35,1],[.50,.75,.35,.80,.7],[.75,1,.80,1,1]],1,1,24)),
  _S("📊 Huff 4th Quartile","Extended buildup — peak at 75-100%","us",1,1,24,_CD([[0,.25,0,.10,1],[.25,.50,.10,.25,1],[.50,.75,.25,.40,1],[.75,1,.40,1,.7]],1,1,24)),
  // Major federal
  _S("🏗️ USACE Std Project","Dam safety — severe storm envelope","us",4,6,36,_CD([[0,.20,0,.08,1],[.20,.35,.08,.23,1],[.35,.50,.23,.63,.85],[.50,.65,.63,.85,1],[.65,.80,.85,.95,1],[.80,1,.95,1,1]],4,6,36)),
  _S("☢️ PMP (HMR 51/52)","Probable Maximum — FERC/NRC dam design","us",5,6,36,_CD([[0,.10,0,.04,1],[.10,.20,.04,.12,1],[.20,.30,.12,.25,1],[.30,.40,.25,.55,.80],[.40,.50,.55,.73,1],[.50,.60,.73,.85,1],[.60,.70,.85,.92,1],[.70,.85,.92,.97,1],[.85,1,.97,1,1]],5,6,36)),
  // ── US State/Local ──
  _S("🌴 FDOT Zone 1 NW FL","Panhandle — modified Type II","us_state",1,1,24,_CD([[0,.42,0,.40,.85],[.42,.54,.40,.78,1],[.54,1,.78,1,1]],1,1,24)),
  _S("🌴 FDOT Zone 2 NE FL","NE Florida","us_state",1,1,24,_CD([[0,.45,0,.38,.88],[.45,.55,.38,.78,1],[.55,1,.78,1,1]],1,1,24)),
  _S("🌴 FDOT Zone 3 Central","Central FL — tropical","us_state",1,1,24,_CD([[0,.35,0,.30,.80],[.35,.50,.30,.75,1],[.50,1,.75,1,1]],1,1,24)),
  _S("🌴 FDOT Zone 4 SE FL","SE FL / Miami — most front-loaded","us_state",1,1,24,_CD([[0,.25,0,.35,.75],[.25,.40,.35,.75,1],[.40,1,.75,1,.7]],1,1,24)),
  _S("🌴 FDOT Zone 5 SW FL","SW FL — convective","us_state",1,1,24,_CD([[0,.28,0,.33,.78],[.28,.42,.33,.73,1],[.42,1,.73,1,.7]],1,1,24)),
  _S("🤠 TxDOT Empirical","Texas DOT — broad central peak","us_state",1,1,24,_CD([[0,.30,0,.20,.9],[.30,.45,.20,.65,1],[.45,.65,.65,.85,1],[.65,1,.85,1,1]],1,1,24)),
  _S("🏔️ UDFCD Denver","Rocky Mtn thunderstorm — front-loaded","us_state",1,1,24,_CD([[0,.08,0,.04,1],[.08,.25,.04,.60,.75],[.25,.50,.60,.85,1],[.50,1,.85,1,1]],1,1,24)),
  // ── Europe ──
  _S("🔺 Triangular (UK FSR)","Peak at 1/3 duration — UK standard","europe",1,1,24,_IF(t=>t<=.33?t/.33:(1-t)/.67,1,1,24)),
  _S("🔷 Trapezoidal","Sustained peak — conservative design","europe",1,1,24,_IF(t=>t<=.25?t/.25:t<=.6?1:(1-t)/.4,1,1,24)),
  _S("🇬🇧 FSR Profile (75%)","UK Flood Studies Report — summer","europe",1,1,24,_CD([[0,.1,0,.05,1],[.1,.3,.05,.20,1],[.3,.5,.20,.60,1],[.5,.7,.60,.85,1],[.7,1,.85,1,1]],1,1,24)),
  _S("🇬🇧 FEH Temporal","Modern UK — supersedes FSR","europe",1,1,24,_CD([[0,.15,0,.06,1],[.15,.30,.06,.20,1],[.30,.50,.20,.65,.85],[.50,.70,.65,.87,1],[.70,1,.87,1,1]],1,1,24)),
  _S("🏙️ Chicago Storm","IDF-derived Keifer & Chu r=0.4","europe",1,1,24,_IF(t=>{const a=50,b=10,c=.8,r=.4;if(t<=r){const tb=(r-t)*60;return a*((1-c)*tb/r+b)/Math.pow(tb/r+b,1+c);}const ta=(t-r)*60;return a*((1-c)*ta/(1-r)+b)/Math.pow(ta/(1-r)+b,1+c);},1,1,24)),
  _S("🇫🇷 Desbordes","French standard — double triangle","europe",1,1,24,_IF(t=>{const t1=.3,tv=.5,t2=.7,i1=2.5,i2=2,iv=.75;if(t<=t1)return i1*t/t1;if(t<=tv)return i1-(i1-iv)*(t-t1)/(tv-t1);if(t<=t2)return iv+(i2-iv)*(t-tv)/(t2-tv);return i2*(1-t)/(1-t2);},1,1,24)),
  _S("🇫🇷 Desbordes Dbl Tri","Explicit double-triangle + valley","europe",1,1,24,_IF(t=>{const t1=.25,tv=.45,t2=.65,i1=2.5,i2=2,iv=.75;if(t<=t1)return i1*t/t1;if(t<=tv)return i1-(i1-iv)*(t-t1)/(tv-t1);if(t<=t2)return iv+(i2-iv)*(t-tv)/(t2-tv);return i2*(1-t)/(1-t2);},1,1,24)),
  _S("🇩🇪 DWA-A 531","German urban drainage — Euler Type II","europe",1,1,24,_CD([[0,.25,0,.09,1],[.25,.375,.09,.20,1],[.375,.5,.20,.58,1],[.5,.625,.58,.81,1],[.625,.75,.81,.92,1],[.75,1,.92,1,1]],1,1,24)),
  _S("🇩🇪 Euler Type I","Front-loaded — max sewer stress","europe",1,1,24,_CD([[0,1/6,0,.42,.8],[1/6,2/6,.42,.65,1],[2/6,3/6,.65,.80,1],[3/6,4/6,.80,.90,1],[4/6,5/6,.90,.96,1],[5/6,1,.96,1,1]],1,1,24)),
  _S("🇩🇪 Euler Type II","Standard German design storm","europe",1,1,24,_CD([[0,1/6,0,.09,1],[1/6,2/6,.09,.51,.85],[2/6,3/6,.51,.74,1],[3/6,4/6,.74,.87,1],[4/6,5/6,.87,.95,1],[5/6,1,.95,1,1]],1,1,24)),
  _S("🇳🇱 Dutch STOWA","Polder — extended recession","europe",1,1,24,_IF(t=>{const tp=.35;if(t<=tp)return 2.5*Math.pow(t/tp,.8);return 2.5*Math.exp(-1.5*(t-tp)/(1-tp));},1,1,24)),
  _S("🇮🇹 Italian Mediterranean","Sharp Gaussian convective burst","europe",1,1,24,_IF(t=>3.2*Math.exp(-Math.pow((t-.45)/.12,2)),1,1,24)),
  // ── Asia-Pacific ──
  _S("🇯🇵 Japan JMA","Typhoon — power rise, steep decay","asia",1,1,24,_IF(t=>{const tp=.5;if(t<=tp)return 2.4*Math.pow(t/tp,1.2);return 2.4*Math.exp(-2.5*(t-tp)/(1-tp));},1,1,24)),
  _S("🇯🇵 AMeDAS Convective","1300 stations — 55% in 15% duration","asia",1,1,24,_CD([[0,.15,0,.05,1],[.15,.35,.05,.20,1],[.35,.50,.20,.75,.65],[.50,.65,.75,.90,1],[.65,1,.90,1,1]],1,1,24)),
  _S("🇯🇵 Baiu (梅雨) Frontal","June-July plum rain — broad peak","asia",1,1,24,_CD([[0,.15,0,.06,1],[.15,.30,.06,.20,1],[.30,.45,.20,.50,.80],[.45,.60,.50,.75,1],[.60,.80,.75,.90,1],[.80,1,.90,1,1]],1,1,24)),
  _S("🇯🇵 Japan Typhoon","Dual rain band + eyewall peaks","asia",1,1,24,_IF(t=>1.8*Math.exp(-Math.pow((t-.25)/.10,2))+2.8*Math.exp(-Math.pow((t-.65)/.08,2))+.3,1,1,24)),
  _S("🇨🇳 China Design Storm","Pillow shape r=0.4 — national standard","asia",1,1,24,_IF(t=>t<=.4?t/.4:(1-t)/.6,1,1,24)),
  _S("🇨🇳 China GB 50014-2021","National urban drainage code","asia",1,1,24,_CD([[0,.20,0,.12,.85],[.20,.35,.12,.30,1],[.35,.45,.30,.75,.70],[.45,.75,.75,.95,1],[.75,1,.95,1,1]],1,1,24)),
  _S("🇨🇳 Pearl River Delta","Typhoon-influenced GZ/SZ/HK","asia",1,1,24,_CD([[0,.15,0,.25,.70],[.15,.30,.25,.60,.75],[.30,.50,.60,.78,1],[.50,.70,.78,.90,1],[.70,1,.90,1,1]],1,1,24)),
  _S("🇮🇳 India IMD Monsoon","6000+ gages — monsoon center-peak","asia",1,1,24,_CD([[0,.20,0,.08,1],[.20,.40,.08,.30,.85],[.40,.55,.30,.70,.75],[.55,.85,.70,.96,1],[.85,1,.96,1,1]],1,1,24)),
  _S("🇮🇳 India Coastal Cyclonic","Cyclone eyewall — sharp early peak","asia",1,1,24,_CD([[0,.15,0,.10,1],[.15,.30,.10,.60,.65],[.30,.45,.60,.82,1],[.45,.65,.82,.92,1],[.65,1,.92,1,1]],1,1,24)),
  _S("🇰🇷 Korea KMA Standard","Monsoon/convective hybrid","asia",1,1,24,_CD([[0,.15,0,.06,1],[.15,.35,.06,.24,1],[.35,.50,.24,.64,.72],[.50,.80,.64,.94,1],[.80,1,.94,1,1]],1,1,24)),
  _S("🇸🇬 Singapore PUB","Tropical — 72% in first 25%","asia",1,1,24,_CD([[0,.10,0,.30,.65],[.10,.25,.30,.72,.75],[.25,.40,.72,.87,1],[.40,.60,.87,.95,1],[.60,1,.95,1,1]],1,1,24)),
  _S("🇦🇺 Australian ARR","Ensemble median — probabilistic","asia",1,1,24,_CD([[0,.15,0,.08,1],[.15,.35,.08,.25,1],[.35,.55,.25,.65,.80],[.55,.75,.65,.88,1],[.75,1,.88,1,1]],1,1,24)),
  // ── Other Regions ──
  _S("🇿🇦 South African Huff","Modified 2nd quartile — convective","other",1,1,24,_CD([[0,.20,0,.15,1],[.20,.45,.15,.70,.65],[.45,.70,.70,.90,1],[.70,1,.90,1,1]],1,1,24)),
  _S("🇨🇦 Canadian CDA/MTO","Modified Type II — cold climate","other",1,1,24,_CD([[0,.15,0,.05,1],[.15,.35,.05,.20,1],[.35,.50,.20,.62,.82],[.50,.65,.62,.84,1],[.65,.80,.84,.94,1],[.80,1,.94,1,1]],1,1,24)),
  // ── Generic Shapes ──
  _S("🟦 Block (Uniform)","Constant 1 in/hr — calibration","generic",1,1,24,Array(12).fill(1).concat(Array(12).fill(0))),
  _S("🔀 Double Peak","Multi-cell convective — dual Gaussian","generic",1,1,24,_IF(t=>2.5*Math.exp(-Math.pow((t-.3)/.08,2))+2*Math.exp(-Math.pow((t-.7)/.08,2)),1,1,24)),
  _S("📐 Yen & Chow Tri","r=0.375 SCS-like advance","generic",1,1,24,_IF(t=>t<=.375?t/.375:(1-t)/.625,1,1,24)),
  _S("✏️ Custom (Uniform)","Baseline — modify as needed","generic",1,1,24,Array(24).fill(1)),
];

const DT_ROUTE = 15; // routing timestep in seconds

// SCS Curve Number infiltration: cumulative infiltration
function cnInfiltration(P_cum, CN) {
  if (CN <= 0 || CN >= 100) return P_cum;
  const S = (1000 / CN - 10); // inches
  const Ia = 0.2 * S;
  if (P_cum <= Ia) return 0;
  return Math.pow(P_cum - Ia, 2) / (P_cum - Ia + S);
}

// Manning's overland flow: Q = (1.49/n) * W * (d - ds)^(5/3) * S^(1/2)
function manningOverland(depth, depStorage, width, slope, n) {
  const d_eff = Math.max(depth - depStorage, 0);
  if (d_eff <= 0) return 0;
  return (1.49 / n) * width * Math.pow(d_eff / 12, 5/3) * Math.pow(slope / 100, 0.5);
  // depth in inches, convert to ft for flow calc
}

// Pipe flow: Manning's for circular pipe
function manningPipe(depth_ft, diam_ft, slope, n) {
  if (depth_ft <= 0) return 0;
  const y = Math.min(depth_ft / diam_ft, 1.0); // fraction full
  // Approximate circular section
  const theta = 2 * Math.acos(1 - 2 * y);
  const A = (diam_ft * diam_ft / 8) * (theta - Math.sin(theta));
  const P = (diam_ft / 2) * theta;
  if (P <= 0) return 0;
  const R = A / P;
  return (1.49 / n) * A * Math.pow(R, 2/3) * Math.pow(Math.abs(slope), 0.5);
}

function buildModel(grid) {
  const nodes = [], outfalls = [], conduits = [], subcatchments = [];
  const nodeMap = {};

  // Extract nodes
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const el = grid[r][c];
      if (!el) continue;
      const def = EL[el];
      if (def.cat !== "node") continue;
      const id = `${el}_${r}_${c}`;
      const invert = (GRID - r) * 0.5; // feet, sloping down
      const nd = { id, r, c, type: el, invert, maxDepth: def.maxD || 0, depth: 0, volume: 0, inflow: 0, outflow: 0, head: invert, isOutfall: el === "outfall", lateralInflow: 0, history: [] };
      if (el === "outfall") outfalls.push(nd);
      else nodes.push(nd);
      nodeMap[`${r},${c}`] = nd;
    }
  }

  const allNodes = [...nodes, ...outfalls];

  // Trace link chains to build conduits (pipes, channels, pumps, orifices, weirs)
  const visited = new Set();
  const isLink = (el) => el && EL[el]?.cat === "link";
  function traceChain(sr, sc) {
    const queue = [[sr, sc]];
    const pipes = [];
    const connNodes = [];
    const seen = new Set([`${sr},${sc}`]);
    let linkType = grid[sr][sc]; // remember the link type
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
        conduits.push({
          id: `C_${pipes[0].r}_${pipes[0].c}`, from, to, linkType: linkType || "pipe",
          length, slope, diam: elDef.diam || 1.5, n: elDef.mann || 0.013,
          depth: 0, flow: 0, velocity: 0, pipes, history: [],
        });
      }
    }
  }

  // Build subcatchments via flood fill
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
      // Find nearest node
      const centR = cells.reduce((s, c2) => s + c2.r, 0) / cells.length;
      const centC = cells.reduce((s, c2) => s + c2.c, 0) / cells.length;
      let nearest = allNodes[0], minD = Infinity;
      allNodes.forEach(n => {
        const d = Math.abs(n.r - centR) + Math.abs(n.c - centC);
        if (d < minD) { minD = d; nearest = n; }
      });
      // Weighted properties
      let totI = 0, totCN = 0;
      cells.forEach(cl => { const d = EL[cl.type]; totI += d.pI; totCN += d.cn; });
      const avgI = totI / cells.length;
      const avgCN = totCN / cells.length;
      const sample = EL[cells[0].type];
      const area_ft2 = cells.length * SPC * SPC;
      const area_ac = area_ft2 / 43560;
      const width = Math.sqrt(cells.length) * SPC;

      subcatchments.push({
        id: `SC_${scIdx}`, cells, outlet: nearest, area_ac, area_ft2, width,
        slope: 0.5, pctImperv: avgI, cn: avgCN,
        nImperv: sample.nI, nPerv: sample.nP,
        dsImperv: sample.sI, dsPerv: sample.sP,
        depth: 0, cumRain: 0, cumInfil: 0, runoff: 0, cumRunoff: 0,
        history: [],
      });
    }
  }

  return { nodes, outfalls, allNodes, conduits, subcatchments };
}

function runSWMM5(grid, storm) {
  const model = buildModel(grid);
  if (model.allNodes.length === 0 && model.subcatchments.length === 0) return null;

  const RAIN = storm.rain;
  const DT_RAIN = storm.dtRain;
  const TOTAL_TIME = RAIN.length * DT_RAIN;
  const nSteps = Math.ceil(TOTAL_TIME / DT_ROUTE);
  const systemHistory = [];

  for (let step = 0; step < nSteps; step++) {
    const t = step * DT_ROUTE; // seconds
    const t_min = t / 60;

    // Current rainfall intensity (in/hr)
    const rainIdx = Math.floor(t / DT_RAIN);
    const rainfall = rainIdx < RAIN.length ? RAIN[rainIdx] : 0;
    const rainDepthThisStep = rainfall * (DT_ROUTE / 3600); // inches this step

    // ─── RUNOFF: Subcatchment nonlinear reservoir ───
    let totalRunoff = 0;
    model.subcatchments.forEach(sc => {
      sc.cumRain += rainDepthThisStep;

      // Infiltration via Curve Number (on pervious portion)
      const pctPerv = (100 - sc.pctImperv) / 100;
      const pctImp = sc.pctImperv / 100;

      // Pervious runoff excess
      const excessPerv = pctPerv > 0 ? cnInfiltration(sc.cumRain, sc.cn) : 0;
      // Impervious: all rain minus depression storage
      const excessImp = Math.max(sc.cumRain - sc.dsImperv, 0);

      const totalExcess = pctImp * excessImp + pctPerv * excessPerv;

      // Depth on subcatchment (inches)
      sc.depth = Math.max(totalExcess - sc.cumRunoff, 0);

      // Manning's overland flow (CFS)
      const n_eff = pctImp * sc.nImperv + pctPerv * sc.nPerv;
      const ds_eff = pctImp * sc.dsImperv + pctPerv * sc.dsPerv;
      const q = manningOverland(sc.depth, ds_eff, sc.width, sc.slope, n_eff);
      sc.runoff = Math.max(q, 0);

      // Volume leaving subcatchment this step
      const vol_out = sc.runoff * DT_ROUTE; // ft³
      const depth_out = (vol_out / sc.area_ft2) * 12; // inches
      sc.cumRunoff += depth_out;
      sc.depth = Math.max(sc.depth - depth_out, 0);

      totalRunoff += sc.runoff;

      // Add lateral inflow to outlet node
      if (sc.outlet) sc.outlet.lateralInflow += sc.runoff;

      sc.history.push({ t: t_min, rain: rainfall, depth: sc.depth, runoff: sc.runoff, cumRain: sc.cumRain });
    });

    // ─── ROUTING: Node + Conduit ───
    // Reset node inflows
    model.allNodes.forEach(n => { n.inflow = n.lateralInflow; n.lateralInflow = 0; });

    // Route through conduits (simplified kinematic wave)
    model.conduits.forEach(cd => {
      const fromNode = cd.from;
      const toNode = cd.to;

      // Head difference drives flow
      const h_up = fromNode.invert + fromNode.depth;
      const h_dn = toNode.isOutfall ? toNode.invert : toNode.invert + toNode.depth;
      const dh = h_up - h_dn;
      const slope_eff = Math.max(dh / cd.length, 0.0001);

      // Manning's pipe flow
      const pipeDepth = Math.min(fromNode.depth, cd.diam);
      cd.flow = manningPipe(pipeDepth, cd.diam, slope_eff, cd.n);
      cd.depth = pipeDepth;

      // Limit flow to available volume
      const maxVol = fromNode.depth * 12.566; // approximate surface area ft²
      const maxFlow = maxVol / DT_ROUTE;
      cd.flow = Math.min(cd.flow, Math.max(maxFlow, 0));

      // Velocity
      const area = Math.PI * cd.diam * cd.diam / 4;
      cd.velocity = area > 0 ? cd.flow / area : 0;

      // Transfer flow
      fromNode.outflow += cd.flow;
      toNode.inflow += cd.flow;

      cd.history.push({ t: t_min, flow: cd.flow, depth: cd.depth, velocity: cd.velocity });
    });

    // Update node depths
    model.allNodes.forEach(n => {
      if (n.isOutfall) {
        n.depth = 0; // free outfall
        n.history.push({ t: t_min, depth: 0, inflow: n.inflow, head: n.invert });
        n.inflow = 0; n.outflow = 0;
        return;
      }
      const netFlow = n.inflow - n.outflow; // CFS
      const dVol = netFlow * DT_ROUTE; // ft³
      const surfArea = 12.566; // ~4ft diameter manhole
      const dDepth = dVol / surfArea; // ft
      n.depth = Math.max(Math.min(n.depth + dDepth, n.maxDepth || 6), 0);
      n.head = n.invert + n.depth;
      n.history.push({ t: t_min, depth: n.depth, inflow: n.inflow, outflow: n.outflow, head: n.head });
      n.inflow = 0; n.outflow = 0;
    });

    // System totals
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

// ═══════════════════════════════════════════════════
// VALIDATION & AUTO-FIX
// ═══════════════════════════════════════════════════
function validateModel(grid) {
  const errors = [], warnings = [];
  let nodes = 0, pipes = 0, surfaces = 0, outfalls = 0;
  const errCells = new Set();

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
    return { errors, warnings, errCells };
  }
  if (outfalls === 0 && nodes > 0) errors.push("No outfall. SWMM5 requires at least one.");
  if (surfaces > 0 && nodes === 0) warnings.push("Surfaces exist but no nodes to drain to.");

  // Check links for adjacent nodes/links
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!grid[r][c] || EL[grid[r][c]]?.cat !== "link") continue;
      const adj = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
      const hasAdj = adj.some(([nr, nc]) =>
        nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && grid[nr][nc] &&
        (EL[grid[nr][nc]].cat === "node" || EL[grid[nr][nc]].cat === "link")
      );
      if (!hasAdj) { errors.push(`${EL[grid[r][c]].lbl} (${r},${c}) disconnected.`); errCells.add(`${r}-${c}`); }
    }
  }

  return { errors, warnings, errCells };
}

function autoFix(grid) {
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

// ═══════════════════════════════════════════════════
// EXPORT .INP
// ═══════════════════════════════════════════════════
function exportINP(grid, storm) {
  const model = buildModel(grid);
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

// ═══════════════════════════════════════════════════
// IMPORT .INP — parse SWMM5 input file onto grid
// ═══════════════════════════════════════════════════
function importINP(text, requestedSize) {
  const sections = {};
  let curSec = null;
  text.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) { curSec = trimmed; sections[curSec] = []; return; }
    if (curSec && trimmed && !trimmed.startsWith(";;")) sections[curSec]?.push(trimmed);
  });

  // Parse coordinates
  const coords = {};
  (sections["[COORDINATES]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) coords[parts[0]] = { x: parseFloat(parts[1]), y: parseFloat(parts[2]) };
  });

  // Auto-detect grid size from model complexity
  const nNodes = (sections["[JUNCTIONS]"] || []).length + (sections["[OUTFALLS]"] || []).length
    + (sections["[STORAGE]"] || []).length + (sections["[DIVIDERS]"] || []).length;
  const nLinks = (sections["[CONDUITS]"] || []).length + (sections["[PUMPS]"] || []).length
    + (sections["[ORIFICES]"] || []).length + (sections["[WEIRS]"] || []).length;
  const nSubcatchEst = (sections["[SUBCATCHMENTS]"] || []).length;
  const estCells = nNodes * 2 + nLinks * 3 + nSubcatchEst * 8;
  const autoSize = Math.max(20, Math.min(60, Math.ceil(Math.sqrt(estCells) * 1.4)));
  const useSize = requestedSize || autoSize;
  GRID = useSize;
  const grid = emptyGrid(useSize);

  const allCoords = Object.values(coords);
  if (allCoords.length === 0) return { grid, gridSize: useSize, warnings: ["No [COORDINATES] — cannot place nodes."], subcatchInfo: [], counts: { nJunctions: 0, nOutfalls: 0, nConduits: 0, nSubcatch: 0 } };
  
  const minX = Math.min(...allCoords.map(c => c.x)), maxX = Math.max(...allCoords.map(c => c.x));
  const minY = Math.min(...allCoords.map(c => c.y)), maxY = Math.max(...allCoords.map(c => c.y));
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
  const margin = 2;
  const usable = GRID - 2 * margin;

  // Map SWMM coord → grid cell
  function toGrid(id) {
    const co = coords[id];
    if (!co) return null;
    const gc = margin + Math.round(((co.x - minX) / rangeX) * (usable - 1));
    const gr = margin + Math.round(((maxY - co.y) / rangeY) * (usable - 1)); // Y inverted
    return { r: Math.max(0, Math.min(GRID-1, gr)), c: Math.max(0, Math.min(GRID-1, gc)) };
  }

  const warnings = [];
  const nodePositions = {}; // id -> {r, c}
  const nodeTypes = {}; // id -> type string

  // Place junctions
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

  // Place outfalls
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

  // Place storage nodes
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

  // Place dividers
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

  // Helper: trace Manhattan path between two node positions
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

  // Trace conduits as pipes
  (sections["[CONDUITS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return;
    const fromPos = nodePositions[parts[1]], toPos = nodePositions[parts[2]];
    if (!fromPos || !toPos) { warnings.push(`Conduit ${parts[0]}: missing node position`); return; }
    // Detect channel vs pipe from [XSECTIONS]
    tracePath(fromPos, toPos, "pipe");
  });

  // Parse XSECTIONS to upgrade pipes to channels where appropriate
  const xsections = {};
  (sections["[XSECTIONS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) xsections[parts[0]] = parts[1].toUpperCase();
  });

  // Trace pumps
  (sections["[PUMPS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return;
    const fromPos = nodePositions[parts[1]], toPos = nodePositions[parts[2]];
    if (!fromPos || !toPos) { warnings.push(`Pump ${parts[0]}: missing node position`); return; }
    tracePath(fromPos, toPos, "pump");
  });

  // Trace orifices
  (sections["[ORIFICES]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return;
    const fromPos = nodePositions[parts[1]], toPos = nodePositions[parts[2]];
    if (!fromPos || !toPos) { warnings.push(`Orifice ${parts[0]}: missing node position`); return; }
    tracePath(fromPos, toPos, "orifice");
  });

  // Trace weirs
  (sections["[WEIRS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) return;
    const fromPos = nodePositions[parts[1]], toPos = nodePositions[parts[2]];
    if (!fromPos || !toPos) { warnings.push(`Weir ${parts[0]}: missing node position`); return; }
    tracePath(fromPos, toPos, "weir");
  });

  // ── Parse subcatchment data from all 3 sections ──
  const scData = {}; // id -> { area, pctImperv, width, slope, outlet, gage, cn, nI, nP, sI, sP, routing }

  // [SUBCATCHMENTS]: Name RainGage Outlet Area %Imperv Width %Slope [SnowPack] [CurbLen]
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

  // [SUBAREAS]: Subcatchment N-Imperv N-Perv S-Imperv S-Perv %Zero RouteTo [%Routed]
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

  // [INFILTRATION]: Subcatchment Param1 Param2 Param3 [Param4] [Method]
  // For CURVE_NUMBER: Param1=CN, Param2=0(conductivity), Param3=dryTime
  // For HORTON: Param1=maxRate, Param2=minRate, Param3=decay, Param4=dryTime, Param5=maxVol
  // For GREEN_AMPT: Param1=suction, Param2=conductivity, Param3=initDeficit
  (sections["[INFILTRATION]"] || []).forEach(line => {
    const p = line.trim().split(/\s+/);
    if (p.length < 2) return;
    const sc = scData[p[0]];
    if (!sc) return;
    const val1 = parseFloat(p[1]) || 0;
    // Detect method: CN values are typically 30-100, Horton maxRate >> 100 in/hr is rare
    // Check [OPTIONS] for infiltration method
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
      sc.cn = val1; // default assume CN
      sc.infiltMethod = "CURVE_NUMBER";
    }
  });

  // Place subcatchment surfaces on grid
  const polygons = {};
  (sections["[Polygons]"] || sections["[POLYGONS]"] || []).forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      const id = parts[0];
      if (!polygons[id]) polygons[id] = [];
      polygons[id].push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]) });
    }
  });

  const subcatchInfo = []; // Summary for display

  Object.values(scData).forEach(sc => {
    // Choose surface type by imperviousness
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

  // Parse [OPTIONS] for summary
  const options = {};
  (sections["[OPTIONS]"] || []).forEach(line => {
    const p = line.trim().split(/\s+/);
    if (p.length >= 2) options[p[0].toUpperCase()] = p.slice(1).join(" ");
  });

  // Count elements
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

function GridCell({ element, isHov, hasErr, flowIntensity, depthFrac, row, col }) {
  const el = element ? EL[element] : null;
  const base = el ? el.clr : "transparent";

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
    if (flowIntensity > 0) tip += `\n🌊 Flow: ${(flowIntensity * 2).toFixed(3)} CFS`;
    if (depthFrac > 0) tip += `\n💧 Depth: ${(depthFrac * (el.maxD || 6)).toFixed(2)} ft`;
  } else {
    tip += "\nEmpty — click to place";
  }

  const brickShadow = el
    ? `inset 3px 3px 0 0 rgba(255,255,255,0.20), inset -3px -4px 0 0 rgba(0,0,0,0.30), 2px 3px 0 0 rgba(0,0,0,0.40)${flowGlow}`
    : "none";
  const errShadow = hasErr ? `0 0 8px rgba(239,68,68,0.6)${flowGlow}` : brickShadow;

  return (
    <div title={tip} style={{
      width: CELL, height: CELL,
      background: el ? base : "transparent",
      border: hasErr ? "2px solid #ef4444" : isHov && !el ? "2px solid rgba(255,255,255,0.25)" : el ? "none" : "none",
      borderRadius: 3, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: el ? 13 : 0, position: "relative",
      boxShadow: errShadow,
      transition: "box-shadow 0.15s ease, transform 0.1s ease",
      userSelect: "none",
      margin: el ? 0 : 0,
    }}>
      {el && <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: "inherit",
        filter: "brightness(1.15)",
        position: "absolute", top: 3, left: 3,
        boxShadow: "0 0 0 1.5px rgba(0,0,0,0.30), inset 0 -2px 0px rgba(0,0,0,0.20), inset 0 1px 0px rgba(255,255,255,0.35)",
        zIndex: 1,
      }} />}
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
    <button onClick={() => onClick(type)} title={`${el.lbl}${el.cn !== undefined ? ` • CN:${el.cn} • %Imp:${el.pI}` : ""}${el.maxD ? ` • MaxD:${el.maxD}ft` : ""}${el.diam ? ` • Dia:${el.diam}ft` : ""}`} style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
      gap: 1, padding: "14px 2px 4px",
      background: on ? el.clr : "rgba(255,255,255,0.06)",
      border: "none", borderRadius: 4,
      color: on ? "#fff" : "#A0A19B", cursor: "pointer",
      fontFamily: "'Fredoka', sans-serif", fontWeight: on ? 700 : 500,
      width: "100%", transition: "all 0.12s", position: "relative",
      boxShadow: on
        ? `inset 3px 3px 0 rgba(0,0,0,0.15), inset -1px -1px 0 rgba(255,255,255,0.10), 0px 1px 0 rgba(0,0,0,0.40)`
        : `inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -3px 0 rgba(0,0,0,0.20), 2px 3px 0 rgba(0,0,0,0.35)`,
      outline: on ? `3px solid #F2C717` : "none",
      outlineOffset: on ? 2 : 0,
      transform: on ? "translateY(2px)" : "none",
    }}>
      <span style={{ fontSize: 13, lineHeight: 1, position: "relative", zIndex: 2, textShadow: on ? "1px 1px 0 rgba(0,0,0,0.5)" : "none" }}>{el.e}</span>
      <span style={{ fontSize: 7, lineHeight: 1, position: "relative", zIndex: 2, textShadow: on ? "1px 1px 0 rgba(0,0,0,0.5)" : "none", fontWeight: 800 }}>{el.lbl}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
export default function SWMM5LegoBuilder() {
  const [gridSize, setGridSize] = useState(20);
  const [grid, setGrid] = useState(() => { GRID = 20; return emptyGrid(20); });
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
  const [inspCell, setInspCell] = useState(null); // {r, c} of clicked cell
  const [showTutorial, setShowTutorial] = useState(true); // onboarding
  const [tutStep, setTutStep] = useState(0);
  const animRef = useRef(null);
  const fileRef = useRef(null);

  const save = useCallback(() => setHist(h => [...h.slice(-30), grid.map(r => [...r])]), [grid]);
  const place = useCallback((r, c) => setGrid(p => { const n = p.map(x => [...x]); n[r][c] = erasing ? null : sel; return n; }), [sel, erasing]);

  const resizeGrid = (newSize) => {
    save();
    GRID = newSize;
    setGridSize(newSize);
    const newGrid = emptyGrid(newSize);
    // Copy existing cells into new grid
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
      // Update grid size
      if (result.gridSize && result.gridSize !== gridSize) {
        GRID = result.gridSize;
        setGridSize(result.gridSize);
      }
      setGrid(result.grid);
      doReset(); setValidation(null);
      // Build detailed import log
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

  // Animation loop
  useEffect(() => {
    if (!isRunning || !simResult) return;
    const maxStep = simResult.systemHistory.length - 1;
    animRef.current = setInterval(() => {
      setSimStep(s => {
        if (s >= maxStep) { setIsRunning(false); clearInterval(animRef.current); return maxStep; }
        return s + 1;
      });
    }, 50); // ~20fps
    return () => clearInterval(animRef.current);
  }, [isRunning, simResult]);

  // Current flow state for grid animation
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
    const result = runSWMM5(grid, STORMS[stormIdx]);
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
    setInpText(exportINP(grid, STORMS[stormIdx]));
    setShowInp(true);
  };

  const doFix = () => { save(); const f = autoFix(grid); setGrid(f.grid); setFixLog(f.fixes); setValidation(validateModel(f.grid)); };
  const [showDemos, setShowDemos] = useState(false);

  const loadDemo = (idx) => {
    save();
    setGrid(DEMOS[idx].build());
    doReset(); setValidation(null); setFixLog([]);
    setShowDemos(false);
  };

  // Current sim time
  const curTime = simResult && simStep < simResult.systemHistory.length ? simResult.systemHistory[simStep].t : 0;

  // Chart data (up to current step for animation)
  const chartData = useMemo(() => {
    if (!simResult) return [];
    return simResult.systemHistory.slice(0, simStep + 1);
  }, [simResult, simStep]);

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(145deg, #1B2A34, #2A3A44 50%, #1B2A34)",
      color: "#F4F4F4", fontFamily: "'Fredoka', 'Nunito', system-ui, sans-serif", padding: 12,
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700;800&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet" />

      {/* ═══ ONBOARDING TUTORIAL ═══ */}
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
          { title: "🚀 Step 4: Run SWMM5!", sub: "Watch your network handle a design storm in real-time", icon: "⚡",
            body: "Click 🚀 Run SWMM5 to simulate. The JavaScript engine computes SCS Curve Number infiltration, Manning's overland flow, and Manning's pipe flow at 15-second timesteps. Watch animated flow through pipes, rising water in manholes, and live hydrographs.",
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
              {/* Progress bar */}
              <div style={{ height: 6, background: "#E4CD9E" }}>
                <div style={{
                  height: "100%", borderRadius: 0, transition: "width 0.4s ease",
                  width: `${((tutStep + 1) / steps.length) * 100}%`,
                  background: "#D01012",
                }} />
              </div>

              <div style={{ padding: "28px 32px 24px" }}>
                {/* Step indicator */}
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

                {/* Icon & Title */}
                <div style={{ fontSize: 48, marginBottom: 8 }}>{step.icon}</div>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 4px", color: "#D01012", fontFamily: "'Fredoka'", textShadow: "2px 2px 0 rgba(0,0,0,0.1)" }}>{step.title}</h2>
                <p style={{ fontSize: 14, color: "#6C6E68", margin: "0 0 16px", fontStyle: "italic", fontWeight: 600 }}>{step.sub}</p>

                {/* Body */}
                <p style={{ fontSize: 13, color: "#1B2A34", lineHeight: 1.7, margin: "0 0 16px" }}>{step.body}</p>

                {/* Visual elements (step 0) */}
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

                {/* Tips list */}
                {step.tips && (
                  <div style={{ background: "#fff", borderRadius: 4, padding: 12, marginBottom: 16, border: "2px solid #E4CD9E" }}>
                    {step.tips.map((tip, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#1B2A34", padding: "4px 0", lineHeight: 1.5, fontWeight: 600 }}>{tip}</div>
                    ))}
                  </div>
                )}

                {/* Navigation */}
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

      {/* Header */}
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

        {/* LEFT — Palette */}
        <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setErasing(false)} style={{
              flex: 1, padding: "7px 0", borderRadius: 4, border: "none",
              background: !erasing ? "#4B9F4A" : "#6C6E68",
              color: "#F4F4F4", cursor: "pointer", fontSize: 11, fontWeight: 800,
              fontFamily: "'Fredoka', sans-serif", textTransform: "uppercase", letterSpacing: 0.5,
              boxShadow: !erasing
                ? "inset 2px 2px 0 rgba(0,0,0,0.15), 0px 1px 0 rgba(0,0,0,0.40)"
                : "inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -3px 0 rgba(0,0,0,0.20), 0 3px 0 rgba(0,0,0,0.35)",
              transform: !erasing ? "translateY(2px)" : "none",
            }}>🖌️ Paint</button>
            <button onClick={() => setErasing(true)} style={{
              flex: 1, padding: "7px 0", borderRadius: 4, border: "none",
              background: erasing ? "#D01012" : "#6C6E68",
              color: "#F4F4F4", cursor: "pointer", fontSize: 11, fontWeight: 800,
              fontFamily: "'Fredoka', sans-serif", textTransform: "uppercase", letterSpacing: 0.5,
              boxShadow: erasing
                ? "inset 2px 2px 0 rgba(0,0,0,0.15), 0px 1px 0 rgba(0,0,0,0.40)"
                : "inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -3px 0 rgba(0,0,0,0.20), 0 3px 0 rgba(0,0,0,0.35)",
              transform: erasing ? "translateY(2px)" : "none",
            }}>🧹 Erase</button>
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

          {/* SWMM5 Equations */}
          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 8,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#D01012", marginBottom: 4, fontFamily: "'Fredoka'" }}>📐 JS ENGINE</div>
            <div style={{ fontSize: 8, color: "#4A4C47", lineHeight: 1.7, fontWeight: 600 }}>
              <div>🌧️ SCS Type II storm</div>
              <div>📊 CN infiltration</div>
              <div>⚡ Manning's overland</div>
              <div>🔵 Manning's pipe flow</div>
              <div>⏱️ Δt = 15 sec routing</div>
              <div>🌊 Node mass balance</div>
            </div>
          </div>
        </div>

        {/* CENTER — Grid + Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1, maxWidth: 780 }}>
          {/* Grid */}
          <div style={{
            background: "#4B9F4A", borderRadius: 4, padding: 10,
            border: "4px solid #3A8A3A",
            borderBottom: "6px solid #2A6A2A",
            borderRight: "6px solid #2A6A2A",
            boxShadow: "4px 4px 0 0 rgba(0,0,0,0.4)",
          }}>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 5, marginBottom: 6, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { l: "↩ UNDO", fn: () => { if (hist.length) { setGrid(hist[hist.length-1]); setHist(h => h.slice(0,-1)); } }, bg: "#F2C717", fg: "#1B2A34" },
                { l: "🗑️ CLEAR", fn: () => { save(); setGrid(emptyGrid(gridSize)); doReset(); }, bg: "#D01012", fg: "#fff" },
                { l: "🎲 DEMOS", fn: () => setShowDemos(s => !s), bg: "#FE8A18", fg: "#fff" },
                { l: "✅ VALIDATE", fn: () => setValidation(validateModel(grid)), bg: "#4B9F4A", fg: "#fff" },
                { l: "🔧 FIX", fn: doFix, bg: "#F2C717", fg: "#1B2A34" },
                { l: "🚀 RUN SWMM5", fn: doRun, bg: "#006DB7", fg: "#fff" },
                ...(isRunning ? [{ l: "⏸ STOP", fn: doStop, bg: "#D01012", fg: "#fff" }] : []),
                ...(simResult && !isRunning ? [{ l: "🔄 RESET", fn: doReset, bg: "#6C6E68", fg: "#fff" }] : []),
                { l: "📦 EXPORT", fn: doExport, bg: "#FE8A18", fg: "#fff" },
                { l: "📂 IMPORT", fn: () => fileRef.current?.click(), bg: "#006DB7", fg: "#fff" },
              ].map((b, i) => (
                <button key={i} onClick={b.fn} style={{
                  padding: "5px 12px", borderRadius: 4, border: "none",
                  background: b.bg, color: b.fg, cursor: "pointer",
                  fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                  fontFamily: "'Fredoka', sans-serif", textTransform: "uppercase",
                  boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.30), inset -2px -3px 0 rgba(0,0,0,0.20), 0 4px 0 rgba(0,0,0,0.35), 2px 0 0 rgba(0,0,0,0.15)",
                }}>{b.l}</button>
              ))}
              {/* Grid size selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 9, color: "#F4F4F4", fontWeight: 800, textShadow: "1px 1px 0 rgba(0,0,0,0.3)" }}>Grid:</span>
                {[20, 25, 30, 40, 50].map(sz => (
                  <button key={sz} onClick={() => resizeGrid(sz)} style={{
                    width: 36, height: 28, borderRadius: 3, fontSize: 8, fontWeight: 800, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: gridSize === sz ? "#F2C717" : "#6C6E68",
                    border: "none",
                    color: gridSize === sz ? "#1B2A34" : "#F4F4F4", fontFamily: "'Fredoka', sans-serif",
                    boxShadow: gridSize === sz
                      ? "inset 2px 2px 0 rgba(0,0,0,0.15), 0px 1px 0 rgba(0,0,0,0.40)"
                      : "inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -3px 0 rgba(0,0,0,0.30), 2px 3px 0 rgba(0,0,0,0.40)",
                    outline: gridSize === sz ? "2px solid white" : "none",
                  }}>{sz}×{sz}</button>
                ))}
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".inp,.txt" onChange={doImport} style={{ display: "none" }} />

            {/* Demo Picker */}
            {showDemos && (
              <div style={{
                display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap", justifyContent: "center",
                padding: 8, borderRadius: 4, background: "#F4F4F4",
                border: "3px solid #6C6E68", boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
              }}>
                {DEMOS.map((d, i) => (
                  <button key={i} onClick={() => loadDemo(i)} title={d.desc} style={{
                    padding: "5px 10px", borderRadius: 4,
                    border: "none",
                    background: "#FE8A18",
                    color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 800,
                    fontFamily: "'Fredoka', sans-serif",
                    transition: "all 0.12s",
                    boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.25), inset -2px -3px 0 rgba(0,0,0,0.20), 0 3px 0 rgba(0,0,0,0.35)",
                  }}
                  onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.target.style.transform = "none"; }}
                  >
                    <div>{d.name}</div>
                    <div style={{ fontSize: 8, color: "#1B2A34", fontWeight: 600 }}>{d.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Sim status bar */}
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
                {/* Progress bar */}
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

            {/* Grid — baseplate with stud pattern */}
            <div style={{
              overflowX: "auto",
              backgroundImage: "radial-gradient(circle at center, rgba(255,255,255,0.18) 3px, transparent 3px)",
              backgroundSize: `${CELL}px ${CELL}px`,
              backgroundPosition: `${CELL/2}px ${CELL/2}px`,
              borderRadius: 2,
            }}>
              {grid.map((row, r) => (
                <div key={r} style={{ display: "flex" }}>
                  {row.map((cell, c) => (
                    <div key={c}
                      onMouseDown={e => { e.preventDefault(); setPainting(true); save(); place(r, c); setInspCell({r, c}); }}
                      onMouseEnter={() => { setHov(`${r}-${c}`); if (painting) place(r, c); }}
                      onMouseLeave={() => setHov(null)}
                    >
                      <GridCell
                        element={cell} isHov={hov === `${r}-${c}`}
                        hasErr={errCells.has(`${r}-${c}`)}
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

          {/* SWMM INSPECTOR — click any cell to see properties */}
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
            const secTitle = el?.clr || "#6C6E68";
            return (
              <div style={{
                background: "#F4F4F4", borderRadius: 4, padding: 10,
                border: "3px solid #6C6E68",
                boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
                width: GRID * CELL, boxSizing: "border-box", color: "#1B2A34",
              }}>
                {/* Header row */}
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
                    {/* Col 1: Core SWMM Properties */}
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
                    {/* Col 2: Computed / Derived */}
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
                    {/* Col 3: Live Simulation */}
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

          {/* Validation */}
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

          {/* Import / Fix Log (shown when no validation but log exists) */}
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

          {/* RESULTS — Hydrographs */}
          {simResult && chartData.length > 1 && (
            <div style={{
              background: "#F4F4F4", borderRadius: 4, padding: 12,
              border: "3px solid #6C6E68", boxShadow: "4px 4px 0 rgba(0,0,0,0.4)", color: "#1B2A34",
            }}>
              {/* Tabs */}
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
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#006DB7", marginBottom: 6 }}>
                    System Hydrograph — Rainfall vs Runoff vs Outfall
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
                  {/* Rainfall bars */}
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
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#4B9F4A", marginBottom: 6 }}>
                    Subcatchment Runoff ({simResult.subcatchments.length} subcatchments)
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
                  {/* Stats table */}
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
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#FE8A18", marginBottom: 6 }}>
                    Node Depths ({simResult.nodes.length} junctions)
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
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#006DB7", marginBottom: 6 }}>
                    Conduit Flows ({simResult.conduits.length} pipes)
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

              {/* Peak summary */}
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

          {/* Export modal */}
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
        </div>

        {/* RIGHT — Stats */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Quick stats */}
          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 14,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{
              background: "#F2C717", color: "#1B2A34", fontWeight: 900,
              padding: "4px 8px", borderRadius: 2, fontSize: 14, display: "inline-block", marginBottom: 10,
            }}>📊 NETWORK</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
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
                    background: "#fff", borderRadius: 4, padding: "8px 6px", textAlign: "center",
                    border: "2px solid #E4CD9E",
                    boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.8), 2px 2px 0 rgba(0,0,0,0.15)",
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: s.c, fontFamily: "'Fredoka'" }}>{s.v}</div>
                    <div style={{ fontSize: 10, color: "#6C6E68", fontWeight: 700 }}>{s.l}</div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 14,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{
              background: "#006DB7", color: "#F4F4F4", fontWeight: 900,
              padding: "4px 8px", borderRadius: 2, fontSize: 13, display: "inline-block", marginBottom: 8,
            }}>💡 SWMM5 MAP</div>
            <div style={{ fontSize: 11, color: "#1B2A34", lineHeight: 1.9, fontWeight: 600 }}>
              <div><span style={{ color: "#70C442", fontSize: 14 }}>■</span> Surfaces → [SUBCATCHMENTS]</div>
              <div><span style={{ color: "#6C6E68", fontSize: 14 }}>■</span> Manholes → [JUNCTIONS]</div>
              <div><span style={{ color: "#006DB7", fontSize: 14 }}>■</span> Inlets → [JUNCTIONS]</div>
              <div><span style={{ color: "#003F87", fontSize: 14 }}>■</span> Outfalls → [OUTFALLS]</div>
              <div><span style={{ color: "#FE8A18", fontSize: 14 }}>■</span> Storage → [STORAGE]</div>
              <div><span style={{ color: "#F2C717", fontSize: 14 }}>■</span> Dividers → [DIVIDERS]</div>
              <div><span style={{ color: "#5A93DB", fontSize: 14 }}>■</span> Pipes → [CONDUITS]</div>
              <div><span style={{ color: "#006DB7", fontSize: 14 }}>■</span> Channels → [CONDUITS]</div>
              <div><span style={{ color: "#FE8A18", fontSize: 14 }}>■</span> Pumps → [PUMPS]</div>
              <div><span style={{ color: "#5A93DB", fontSize: 14 }}>■</span> Orifices → [ORIFICES]</div>
              <div><span style={{ color: "#F2C717", fontSize: 14 }}>■</span> Weirs → [WEIRS]</div>
              <div><span style={{ color: "#70C442", fontSize: 14 }}>■</span> LID → BioRetention</div>
            </div>
          </div>

          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 14,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{
              background: "#4B9F4A", color: "#F4F4F4", fontWeight: 900,
              padding: "4px 8px", borderRadius: 2, fontSize: 13, display: "inline-block", marginBottom: 8,
            }}>🎮 WORKFLOW</div>
            <div style={{ fontSize: 12, color: "#1B2A34", lineHeight: 2.0, fontWeight: 600 }}>
              <div>1️⃣ Paint surfaces & nodes</div>
              <div>2️⃣ Connect with pipes</div>
              <div>3️⃣ <strong style={{ color: "#4B9F4A" }}>Validate</strong> the model</div>
              <div>4️⃣ <strong style={{ color: "#FE8A18" }}>Fix</strong> if errors found</div>
              <div>5️⃣ <strong style={{ color: "#006DB7" }}>🚀 Run SWMM5</strong></div>
              <div>6️⃣ View animated results</div>
              <div>7️⃣ <strong style={{ color: "#FE8A18" }}>Export</strong> .inp file</div>
              <div>8️⃣ <strong style={{ color: "#006DB7" }}>Import</strong> .inp file</div>
            </div>
          </div>

          <div style={{
            background: "#F4F4F4", borderRadius: 4, padding: 12,
            border: "3px solid #6C6E68", color: "#1B2A34",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
            flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
          }}>
            <div style={{
              background: "#D01012", color: "#F4F4F4", fontWeight: 900,
              padding: "4px 8px", borderRadius: 2, fontSize: 13, display: "inline-block", marginBottom: 6,
            }}>🌧️ DESIGN STORMS ({STORMS.length})</div>
            {/* Category filter */}
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
            {/* Storm list */}
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

      <div style={{
        marginTop: 8, fontSize: 9, color: "#9BA19D", textAlign: "center",
        fontWeight: 700, letterSpacing: 0.5,
        textShadow: "1px 1px 0 rgba(0,0,0,0.3)",
      }}>
        SWMM5.org • SWMM5 LEGO Builder with JS Engine • The Dickinson Canon • {new Date().getFullYear()}
      </div>
    </div>
  );
}
