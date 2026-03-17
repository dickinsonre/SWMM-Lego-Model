let modulePromise = null;
let ready = false;

export function initSwmmWasm() {
  if (modulePromise) return modulePromise;
  modulePromise = new Promise((resolve, reject) => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    window.Module = {
      noInitialRun: true,
      noExitRuntime: true,
      locateFile: (path) => `${base}/swmm/${path}`,
      onRuntimeInitialized: () => { ready = true; resolve(); },
      print: () => {},
      printErr: () => {},
    };
    const s = document.createElement('script');
    s.src = `${base}/swmm/js.js`;
    s.onerror = () => reject(new Error('Failed to load SWMM5 WASM'));
    document.head.appendChild(s);
  });
  return modulePromise;
}

export function isSwmmReady() { return ready; }

export async function runSwmmWasm(inpContent) {
  await initSwmmWasm();
  const M = window.Module;

  try { M.FS.unlink('/input.inp'); } catch(e) {}
  try { M.FS.unlink('/output.rpt'); } catch(e) {}
  try { M.FS.unlink('/output.out'); } catch(e) {}

  const enc = new TextEncoder();
  const bytes = enc.encode(inpContent);

  try {
    M.FS.createPath('/', '/', true, true);
    M.FS.ignorePermissions = true;
  } catch(e) {}

  M.FS.createDataFile('/', 'input.inp', bytes, true, true);

  let returnCode = -1;
  try {
    const swmm_run = M.cwrap('swmm_run', 'number', ['string', 'string', 'string']);
    returnCode = swmm_run('/input.inp', '/output.rpt', '/output.out');
  } catch(e) {
    return { returnCode: -99, rpt: `WASM execution error: ${e.message}`, error: e.message };
  }

  let rpt = '';
  try { rpt = new TextDecoder().decode(M.FS.readFile('/output.rpt')); } catch(e) {
    rpt = `Could not read RPT: ${e.message}`;
  }

  try { M.FS.unlink('/input.inp'); } catch(e) {}
  try { M.FS.unlink('/output.rpt'); } catch(e) {}
  try { M.FS.unlink('/output.out'); } catch(e) {}

  return { returnCode, rpt };
}
