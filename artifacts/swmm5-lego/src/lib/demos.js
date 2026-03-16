import { getGrid, emptyGrid } from './elements.js';

function eg() { return emptyGrid(getGrid()); }

export const DEMOS = [
  {
    name: "🏘️ Residential",
    desc: "Suburban neighborhood with houses, lawns, driveways and a trunk sewer",
    build: () => {
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if ((r + c) % 5 === 0) g[r][c] = "roof";
        else if ((r + c) % 5 === 1) g[r][c] = "driveway";
        else g[r][c] = "grass";
      }
      for (let r = 0; r < GRID; r++) { g[r][9] = "road"; g[r][10] = "road"; }
      for (let r = 0; r < GRID; r++) { g[r][8] = "sidewalk"; g[r][11] = "sidewalk"; }
      g[1][10] = "inlet";
      for (let r = 2; r <= 5; r++) g[r][10] = "pipe";
      g[6][10] = "manhole";
      for (let r = 7; r <= 10; r++) g[r][10] = "pipe";
      g[11][10] = "manhole";
      for (let r = 12; r <= 15; r++) g[r][10] = "pipe";
      g[16][10] = "manhole";
      for (let r = 17; r <= 18; r++) g[r][10] = "pipe";
      g[19][10] = "outfall";
      g[6][9] = "inlet"; g[11][9] = "inlet"; g[16][9] = "inlet";
      return g;
    },
  },
  {
    name: "🅿️ Parking Lot",
    desc: "Commercial lot with mostly impervious surface and LID treatment",
    build: () => {
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if (r < 2 || r > 17) g[r][c] = "sidewalk";
        else if (c < 2 || c > 17) g[r][c] = "sidewalk";
        else g[r][c] = (r + c) % 6 === 0 ? "road" : "driveway";
      }
      for (let r = 2; r <= 17; r++) { g[r][2] = "lid_pond"; g[r][17] = "lid_pond"; }
      for (let c = 2; c <= 17; c++) { g[2][c] = "lid_pond"; g[17][c] = "lid_pond"; }
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
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if ((r * 3 + c * 7) % 11 < 3) g[r][c] = "lid_pond";
        else if ((r * 5 + c) % 13 < 2) g[r][c] = "roof";
        else g[r][c] = "grass";
      }
      for (let c = 0; c < GRID; c++) g[10][c] = "grass";
      g[10][5] = "inlet"; g[10][10] = "manhole"; g[10][15] = "inlet";
      for (let c = 6; c <= 9; c++) g[10][c] = "pipe";
      for (let c = 11; c <= 14; c++) g[10][c] = "pipe";
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
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = "grass";
      for (let r = 0; r < GRID; r++) {
        g[r][6] = "sidewalk";
        g[r][7] = "road"; g[r][8] = "road"; g[r][9] = "road";
        g[r][10] = "driveway";
        g[r][11] = "road"; g[r][12] = "road"; g[r][13] = "road";
        g[r][14] = "sidewalk";
      }
      g[3][6] = "inlet"; g[8][6] = "inlet"; g[13][6] = "inlet";
      for (let r = 4; r <= 7; r++) g[r][6] = "pipe";
      g[8][6] = "manhole";
      for (let r = 9; r <= 12; r++) g[r][6] = "pipe";
      g[13][6] = "manhole";
      for (let r = 14; r <= 18; r++) g[r][6] = "pipe";
      g[19][6] = "outfall";
      g[5][14] = "inlet"; g[10][14] = "inlet"; g[15][14] = "inlet";
      for (let r = 6; r <= 9; r++) g[r][14] = "pipe";
      g[10][14] = "manhole";
      for (let r = 11; r <= 14; r++) g[r][14] = "pipe";
      g[15][14] = "manhole";
      for (let r = 16; r <= 18; r++) g[r][14] = "pipe";
      g[19][14] = "outfall";
      return g;
    },
  },
  {
    name: "🏙️ Mixed-Use",
    desc: "Downtown block with buildings, roads, sidewalks, and a LID plaza",
    build: () => {
      const GRID = getGrid();
      const g = eg();
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
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) g[r][c] = "grass";
      for (let r = 0; r < 7; r++) for (let c = 10; c < GRID; c++) g[r][c] = "roof";
      for (let r = 8; r <= 12; r++) for (let c = 0; c <= 4; c++) g[r][c] = "roof";
      for (let r = 8; r <= 14; r++) for (let c = 10; c < GRID; c++) g[r][c] = "driveway";
      for (let r = 8; r <= 12; r++) for (let c = 5; c <= 9; c++) g[r][c] = "lid_pond";
      for (let c = 0; c < GRID; c++) { g[15][c] = "road"; g[16][c] = "sidewalk"; }
      for (let r = 17; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = "grass";
      g[2][9] = "inlet";
      for (let r = 3; r <= 6; r++) g[r][9] = "pipe";
      g[7][9] = "manhole";
      for (let r = 8; r <= 12; r++) g[r][9] = "pipe";
      g[13][9] = "manhole";
      g[14][9] = "pipe";
      g[15][9] = "manhole";
      for (let r = 16; r <= 18; r++) g[r][9] = "pipe";
      g[19][9] = "outfall";
      g[7][15] = "inlet";
      for (let c = 10; c <= 14; c++) g[7][c] = "pipe";
      g[7][9] = "manhole";
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
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r <= 6; r++) for (let c = 0; c <= 7; c++) g[r][c] = "roof";
      for (let r = 0; r <= 6; r++) for (let c = 12; c <= 19; c++) g[r][c] = "roof";
      for (let r = 10; r <= 16; r++) for (let c = 0; c <= 7; c++) g[r][c] = "roof";
      for (let r = 10; r <= 16; r++) for (let c = 12; c <= 19; c++) g[r][c] = "roof";
      for (let c = 0; c < GRID; c++) { g[7][c] = "road"; g[8][c] = "road"; g[9][c] = "driveway"; }
      for (let r = 0; r < 17; r++) { g[r][8] = "road"; g[r][9] = "driveway"; g[r][10] = "road"; g[r][11] = "road"; }
      for (let c = 0; c < GRID; c++) { g[17][c] = "sidewalk"; g[18][c] = "grass"; g[19][c] = "grass"; }
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
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
        if (r < 4) g[r][c] = "grass";
        else if (r < 8) g[r][c] = (r + c) % 3 === 0 ? "lid_pond" : "grass";
        else if (r < 12) g[r][c] = (r + c) % 4 === 0 ? "roof" : "grass";
        else if (r < 16) g[r][c] = (r + c) % 5 < 2 ? "roof" : "grass";
        else g[r][c] = "grass";
      }
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
      const GRID = getGrid();
      const g = eg();
      for (let r = 2; r <= 10; r++) for (let c = 3; c <= 12; c++) g[r][c] = "roof";
      for (let r = 4; r <= 8; r++) for (let c = 13; c <= 17; c++) g[r][c] = "roof";
      for (let r = 12; r <= 15; r++) for (let c = 3; c <= 9; c++) g[r][c] = "driveway";
      for (let r = 0; r <= 1; r++) for (let c = 6; c <= 9; c++) g[r][c] = "sidewalk";
      for (let r = 12; r <= 15; r++) for (let c = 10; c <= 17; c++) g[r][c] = "lid_pond";
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (!g[r][c]) g[r][c] = "grass";
      for (let r = 0; r < GRID; r++) { g[r][2] = "road"; g[r][18] = "road"; }
      for (let c = 2; c <= 18; c++) { g[16][c] = "road"; g[11][c] = "sidewalk"; }
      g[1][2] = "inlet";
      for (let r = 2; r <= 5; r++) g[r][2] = "pipe";
      g[6][2] = "manhole";
      for (let r = 7; r <= 10; r++) g[r][2] = "pipe";
      g[11][2] = "manhole";
      for (let r = 12; r <= 15; r++) g[r][2] = "pipe";
      g[16][2] = "manhole";
      for (let r = 17; r <= 18; r++) g[r][2] = "pipe";
      g[19][2] = "outfall";
      g[1][18] = "inlet";
      for (let r = 2; r <= 8; r++) g[r][18] = "pipe";
      g[9][18] = "manhole";
      for (let r = 10; r <= 15; r++) g[r][18] = "pipe";
      g[16][18] = "manhole";
      for (let r = 17; r <= 18; r++) g[r][18] = "pipe";
      g[19][18] = "outfall";
      for (let c = 3; c <= 17; c++) g[11][c] = "pipe";
      g[11][10] = "manhole";
      return g;
    },
  },
  {
    name: "🔄 Dual Outfall",
    desc: "Split drainage — east and west basins discharging to separate outfalls",
    build: () => {
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < GRID; r++) for (let c = 0; c <= 9; c++)
        g[r][c] = (r + c) % 4 === 0 ? "roof" : "grass";
      for (let r = 0; r < GRID; r++) for (let c = 10; c < GRID; c++)
        g[r][c] = (r + c) % 3 === 0 ? "driveway" : "road";
      for (let r = 0; r < GRID; r++) g[r][9] = "sidewalk";
      for (let r = 0; r < GRID; r++) g[r][10] = "sidewalk";
      g[2][4] = "inlet";
      for (let r = 3; r <= 7; r++) g[r][4] = "pipe";
      g[8][4] = "manhole";
      for (let r = 9; r <= 13; r++) g[r][4] = "pipe";
      g[14][4] = "manhole";
      for (let r = 15; r <= 18; r++) g[r][4] = "pipe";
      g[19][4] = "outfall";
      g[8][2] = "inlet"; g[8][3] = "pipe";
      g[14][2] = "inlet"; g[14][3] = "pipe";
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
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = "grass";
      for (let r = 3; r <= 16; r++) for (let c = 3; c <= 16; c++) g[r][c] = "sidewalk";
      for (let r = 5; r <= 14; r++) for (let c = 5; c <= 14; c++) g[r][c] = "roof";
      for (let r = 7; r <= 12; r++) for (let c = 7; c <= 12; c++) g[r][c] = "grass";
      for (let c = 0; c < GRID; c++) g[0][c] = "road";
      for (let c = 0; c < GRID; c++) g[19][c] = "road";
      for (let r = 0; r < GRID; r++) g[r][0] = "road";
      for (let r = 0; r < GRID; r++) g[r][19] = "road";
      g[3][3] = "inlet"; g[3][16] = "inlet"; g[16][3] = "inlet"; g[16][16] = "inlet";
      for (let c = 4; c <= 9; c++) g[3][c] = "pipe";
      g[3][10] = "manhole";
      for (let c = 11; c <= 15; c++) g[3][c] = "pipe";
      for (let r = 4; r <= 9; r++) g[r][10] = "pipe";
      g[10][10] = "manhole";
      for (let r = 11; r <= 15; r++) g[r][10] = "pipe";
      g[16][10] = "manhole";
      for (let c = 4; c <= 9; c++) g[16][c] = "pipe";
      for (let c = 11; c <= 15; c++) g[16][c] = "pipe";
      for (let r = 17; r <= 18; r++) g[r][10] = "pipe";
      g[19][10] = "outfall";
      return g;
    },
  },
  {
    name: "🏟️ Stadium (Simple)",
    desc: "Large venue with roof drainage, concourse, and parking collection",
    build: () => {
      const GRID = getGrid();
      const g = eg();
      for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) g[r][c] = "grass";
      for (let r = 3; r <= 16; r++) for (let c = 3; c <= 16; c++) {
        if (r <= 5 || r >= 14 || c <= 5 || c >= 14) g[r][c] = "roof";
        else g[r][c] = "grass";
      }
      for (let r = 0; r < GRID; r++) { if (g[r][2] !== "roof") g[r][2] = "sidewalk"; if (g[r][17] !== "roof") g[r][17] = "sidewalk"; }
      for (let c = 0; c < GRID; c++) { if (g[2][c] !== "roof") g[2][c] = "sidewalk"; if (g[17][c] !== "roof") g[17][c] = "sidewalk"; }
      for (let c = 0; c < GRID; c++) { g[0][c] = "driveway"; g[1][c] = "driveway"; g[18][c] = "driveway"; g[19][c] = "driveway"; }
      g[5][10] = "inlet"; g[10][3] = "inlet"; g[14][10] = "inlet"; g[10][16] = "inlet";
      g[10][10] = "manhole";
      for (let c = 4; c <= 9; c++) g[10][c] = "pipe";
      for (let c = 11; c <= 15; c++) g[10][c] = "pipe";
      for (let r = 6; r <= 9; r++) g[r][10] = "pipe";
      for (let r = 11; r <= 13; r++) g[r][10] = "pipe";
      for (let r = 15; r <= 18; r++) g[r][10] = "pipe";
      g[15][10] = "manhole";
      g[19][10] = "outfall";
      return g;
    },
  },
  {
    name: "🧪 Minimal Test",
    desc: "Simplest possible model — 1 surface, 1 inlet, 1 pipe, 1 outfall",
    build: () => {
      const g = eg();
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
