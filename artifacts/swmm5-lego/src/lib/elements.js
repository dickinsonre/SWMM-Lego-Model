let GRID = 20;
export const CELL = 34;
export const SPC = 100;

export function getGrid() { return GRID; }
export function setGrid(v) { GRID = v; }

export const EL = {
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
  manhole:  { lbl:"Manhole",    clr:"#6C6E68", bdr:"#4A4C47", e:"⚙️",  cat:"node", maxD:6 },
  inlet:    { lbl:"Inlet",      clr:"#006DB7", bdr:"#004D87", e:"🔽",  cat:"node", maxD:4 },
  outfall:  { lbl:"Outfall",    clr:"#003F87", bdr:"#002F67", e:"🌊",  cat:"node" },
  storage:  { lbl:"Storage",    clr:"#FE8A18", bdr:"#CE6A08", e:"🏊",  cat:"node", maxD:10 },
  divider:  { lbl:"Divider",    clr:"#F2C717", bdr:"#C2A707", e:"🔀",  cat:"node", maxD:6 },
  pipe:     { lbl:"Pipe",       clr:"#5A93DB", bdr:"#3A73BB", e:"🔵", cat:"link", diam:1.5, mann:0.013 },
  channel:  { lbl:"Channel",    clr:"#006DB7", bdr:"#004D87", e:"🟦", cat:"link", diam:3.0, mann:0.025 },
  pump:     { lbl:"Pump",       clr:"#FE8A18", bdr:"#CE6A08", e:"⬆️", cat:"link", diam:2.0, mann:0.013 },
  orifice:  { lbl:"Orifice",    clr:"#5A93DB", bdr:"#3A73BB", e:"🔘", cat:"link", diam:1.0, mann:0.013 },
  weir:     { lbl:"Weir",       clr:"#F2C717", bdr:"#C2A707", e:"🚧", cat:"link", diam:2.0, mann:0.013 },
};

export const CATS = [
  { k:"surface", l:"SURFACES", items:["grass","roof","road","driveway","sidewalk","lid_pond","perm_pave","grn_roof","rain_brl","swale"] },
  { k:"node", l:"NODES", items:["manhole","inlet","outfall","storage","divider"] },
  { k:"link", l:"LINKS", items:["pipe","channel","pump","orifice","weir"] },
];

export function emptyGrid(sz) { const n = sz || GRID; return Array(n).fill(null).map(() => Array(n).fill(null)); }
