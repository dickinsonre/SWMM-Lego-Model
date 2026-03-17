export function parseRpt(rptText) {
  const lines = rptText.split('\n');
  const result = {
    version: '',
    errors: [],
    warnings: [],
    analysisOptions: {},
    subcatchRunoff: [],
    nodeDepth: [],
    nodeInflow: [],
    nodeFlooding: [],
    outfallLoading: [],
    linkFlow: [],
    linkSurcharge: [],
    conduitSurcharge: [],
    pumpingSummary: [],
    nodeSurcharge: [],
    flowRouting: [],
    qualityRouting: [],
    runoffQuantity: {},
    routingSummary: {},
    crossSectionWarnings: [],
    raw: rptText,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('EPA STORM WATER MANAGEMENT MODEL')) {
      result.version = line.trim();
    }
    if (/ERROR \d+/i.test(line)) {
      result.errors.push(line.trim());
      let j = i + 1;
      while (j < lines.length && lines[j].trim() && !lines[j].startsWith('  ****')) {
        result.errors.push(lines[j].trim());
        j++;
      }
    }
    if (/WARNING \d+/i.test(line)) {
      result.warnings.push(line.trim());
    }
  }

  const findSection = (marker) => {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(marker)) return i;
    }
    return -1;
  };

  const SWMM_TYPES = new Set(['CONDUIT','PUMP','ORIFICE','WEIR','JUNCTION','OUTFALL','STORAGE','DIVIDER','SUBCATCHMENT']);

  const parseTable = (startIdx) => {
    if (startIdx < 0) return [];
    let i = startIdx + 1;
    while (i < lines.length && !lines[i].includes('---')) i++;
    if (i >= lines.length) return [];
    while (i + 1 < lines.length && lines[i + 1].trim().startsWith('---')) i++;
    const headerLine = lines[i - 1];
    i++;
    const rows = [];
    while (i < lines.length && lines[i].trim() && !lines[i].includes('****') && !lines[i].includes('===')) {
      const parts = lines[i].trim().split(/\s{2,}|\s+/);
      if (parts.length >= 2 && parts[0] !== '') {
        const hasNumericData = parts.slice(1).some(p => /^-?[\d.]+$/.test(p));
        const hasSwmmType = SWMM_TYPES.has(parts[1]?.toUpperCase());
        if (hasNumericData || hasSwmmType) {
          rows.push(parts);
        }
      }
      i++;
    }
    return { header: headerLine, rows };
  };

  let idx;

  idx = findSection('Analysis Options');
  if (idx >= 0) {
    for (let i = idx + 2; i < lines.length && i < idx + 30; i++) {
      const m = lines[i].match(/^\s+(.+?)\s{3,}(.+)$/);
      if (m) result.analysisOptions[m[1].trim().replace(/\.+$/, '').trim()] = m[2].trim();
      if (lines[i].includes('****')) break;
    }
  }

  idx = findSection('Subcatchment Runoff Summary');
  if (idx >= 0) {
    const t = parseTable(idx);
    if (t.rows) {
      t.rows.forEach(r => {
        if (r.length >= 6) {
          result.subcatchRunoff.push({
            name: r[0], precip: +r[1], runon: +r[2],
            evap: +r[3], infil: +r[4], runoff_in: +r[5],
            runoff_mgal: r[6] ? +r[6] : 0, peakRunoff: r[7] ? +r[7] : 0,
            runoffCoeff: r[8] ? +r[8] : 0,
          });
        }
      });
    }
  }

  idx = findSection('Node Depth Summary');
  if (idx >= 0) {
    const t = parseTable(idx);
    if (t.rows) {
      t.rows.forEach(r => {
        if (r.length >= 5) {
          result.nodeDepth.push({
            name: r[0], type: r[1], avgDepth: +r[2],
            maxDepth: +r[3], maxHGL: +r[4],
            timeMaxDay: r[5] || '', timeMaxHr: r[6] || '',
          });
        }
      });
    }
  }

  idx = findSection('Node Inflow Summary');
  if (idx >= 0) {
    const t = parseTable(idx);
    if (t.rows) {
      t.rows.forEach(r => {
        if (r.length >= 5) {
          result.nodeInflow.push({
            name: r[0], type: r[1],
            maxLatInflow: +r[2], maxTotalInflow: +r[3],
            timeMaxDay: r[4] || '', timeMaxHr: r[5] || '',
            latInflowVol: r[6] ? +r[6] : 0, totalInflowVol: r[7] ? +r[7] : 0,
          });
        }
      });
    }
  }

  idx = findSection('Node Flooding Summary');
  if (idx >= 0) {
    if (lines[idx + 2] && lines[idx + 2].includes('No nodes were flooded')) {
      result.nodeFlooding = [];
    } else {
      const t = parseTable(idx);
      if (t.rows) {
        t.rows.forEach(r => {
          if (r.length >= 4) {
            result.nodeFlooding.push({
              name: r[0], hours: +r[1],
              maxRate: +r[2], timeMaxDay: r[3] || '',
              timeMaxHr: r[4] || '', totalFloodVol: r[5] ? +r[5] : 0,
              maxPondedDepth: r[6] ? +r[6] : 0,
            });
          }
        });
      }
    }
  }

  idx = findSection('Outfall Loading Summary');
  if (idx >= 0) {
    const t = parseTable(idx);
    if (t.rows) {
      t.rows.forEach(r => {
        if (r.length >= 3 && r[0] !== 'System') {
          result.outfallLoading.push({
            name: r[0], flowFreq: +r[1],
            avgFlow: +r[2], maxFlow: +r[3] || 0,
            totalVol: r[4] ? +r[4] : 0,
          });
        }
      });
    }
  }

  idx = findSection('Link Flow Summary');
  if (idx >= 0) {
    const t = parseTable(idx);
    if (t.rows) {
      t.rows.forEach(r => {
        if (r.length >= 5) {
          result.linkFlow.push({
            name: r[0], type: r[1],
            maxFlow: +r[2], timeMaxDay: r[3] || '', timeMaxHr: r[4] || '',
            maxVeloc: r[5] ? +r[5] : 0, maxDepthFrac: r[6] ? +r[6] : 0,
          });
        }
      });
    }
  }

  idx = findSection('Conduit Surcharge Summary');
  if (idx >= 0) {
    const noSurcharge = lines.slice(idx, idx + 5).some(l => l.includes('No conduits were surcharged'));
    if (!noSurcharge) {
      const t = parseTable(idx);
      if (t.rows) {
        t.rows.forEach(r => {
          if (r.length >= 4) {
            result.conduitSurcharge.push({
              name: r[0], hoursUpFull: +r[1] || 0, hoursDnFull: +r[2] || 0,
              hoursAboveNorm: +r[3] || 0, hoursCapLimited: r[4] ? +r[4] : 0,
            });
          }
        });
      }
    }
  }

  idx = findSection('Pumping Summary');
  if (idx >= 0) {
    const t = parseTable(idx);
    if (t.rows) {
      t.rows.forEach(r => {
        if (r.length >= 4) {
          result.pumpingSummary.push({
            name: r[0], percentUtilized: +r[1] || 0, numStartups: +r[2] || 0,
            minFlow: +r[3] || 0, avgFlow: r[4] ? +r[4] : 0, maxFlow: r[5] ? +r[5] : 0,
            totalVol: r[6] ? +r[6] : 0, powerUsage: r[7] ? +r[7] : 0,
            percentTimeOff: r[8] ? +r[8] : 0,
          });
        }
      });
    }
  }

  idx = findSection('Node Surcharge Summary');
  if (idx >= 0) {
    const noSurcharge = lines.slice(idx, idx + 5).some(l => l.includes('No nodes were surcharged'));
    if (!noSurcharge) {
      const t = parseTable(idx);
      if (t.rows) {
        t.rows.forEach(r => {
          if (r.length >= 3) {
            result.nodeSurcharge.push({
              name: r[0], type: r[1] || '', hoursSurcharged: +r[2] || 0,
              maxHeightAboveCrown: r[3] ? +r[3] : 0, minDepthBelowRim: r[4] ? +r[4] : 0,
            });
          }
        });
      }
    }
  }

  idx = findSection('Runoff Quantity Continuity');
  if (idx >= 0) {
    for (let i = idx + 2; i < lines.length && i < idx + 20; i++) {
      const m = lines[i].match(/^\s+(.+?)\s{3,}([\d.]+)\s+([\d.]+)/);
      if (m) result.runoffQuantity[m[1].trim().replace(/\.+$/, '').trim()] = { in: +m[2], gal: +m[3] };
      if (lines[i].includes('****') || lines[i].trim() === '') {
        if (Object.keys(result.runoffQuantity).length > 0) break;
      }
    }
  }

  idx = findSection('Flow Routing Continuity');
  if (idx >= 0) {
    for (let i = idx + 2; i < lines.length && i < idx + 20; i++) {
      const m = lines[i].match(/^\s+(.+?)\s{3,}([\d.]+)\s+([\d.]+)/);
      if (m) result.routingSummary[m[1].trim().replace(/\.+$/, '').trim()] = { in: +m[2], gal: +m[3] };
      if (lines[i].includes('****') || lines[i].trim() === '') {
        if (Object.keys(result.routingSummary).length > 0) break;
      }
    }
  }

  return result;
}
