const LS_KEY = "swmm5-lego-autosave";
const LS_SLOTS_KEY = "swmm5-lego-saves";

export function saveToLocalStorage(grid, gridSize, stormIdx, cellProps) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ grid, gridSize, stormIdx, cellProps, savedAt: new Date().toISOString() }));
  } catch (e) { /* quota exceeded, ignore */ }
}

export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { localStorage.removeItem(LS_KEY); return null; }
}

export function getSaveSlots() {
  try {
    const raw = localStorage.getItem(LS_SLOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export function saveToSlot(name, grid, gridSize, stormIdx, cellProps) {
  const slots = getSaveSlots();
  const entry = { name, grid, gridSize, stormIdx, cellProps, savedAt: new Date().toISOString() };
  const idx = slots.findIndex(s => s.name === name);
  if (idx >= 0) slots[idx] = entry;
  else { if (slots.length >= 5) slots.shift(); slots.push(entry); }
  localStorage.setItem(LS_SLOTS_KEY, JSON.stringify(slots));
}

export function deleteSlot(name) {
  const slots = getSaveSlots().filter(s => s.name !== name);
  localStorage.setItem(LS_SLOTS_KEY, JSON.stringify(slots));
}
