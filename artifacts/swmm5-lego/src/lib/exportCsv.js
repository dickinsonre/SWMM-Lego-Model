export function exportResultsCsv(simResult, tabKey) {
  let rows = [];
  if (tabKey === "system") {
    rows = [
      ["Time (min)", "Rainfall (in/hr)", "Runoff (CFS)", "Pipe Flow (CFS)", "Outfall Flow (CFS)", "Avg Node Depth (ft)"],
      ...simResult.systemHistory.map(h => [
        h.t.toFixed(2), h.rainfall.toFixed(4), h.totalRunoff.toFixed(4),
        h.totalPipeFlow.toFixed(4), h.outfallFlow.toFixed(4), h.totalNodeDepth.toFixed(4),
      ]),
    ];
  } else if (tabKey === "subcatch") {
    const scs = simResult.subcatchments;
    rows = [
      ["Time (min)", ...scs.map(sc => `${sc.id} Rain(in/hr)`), ...scs.map(sc => `${sc.id} Runoff(CFS)`)],
      ...scs[0].history.map((_, i) => [
        scs[0].history[i].t.toFixed(2),
        ...scs.map(sc => sc.history[i]?.rain?.toFixed(4) || "0"),
        ...scs.map(sc => sc.history[i]?.runoff?.toFixed(4) || "0"),
      ]),
    ];
  } else if (tabKey === "node") {
    const nds = simResult.nodes;
    rows = [
      ["Time (min)", ...nds.map(n => `${n.id} Depth(ft)`), ...nds.map(n => `${n.id} Inflow(CFS)`)],
      ...nds[0].history.map((_, i) => [
        nds[0].history[i].t.toFixed(2),
        ...nds.map(n => n.history[i]?.depth?.toFixed(4) || "0"),
        ...nds.map(n => n.history[i]?.inflow?.toFixed(4) || "0"),
      ]),
    ];
  } else if (tabKey === "pipe") {
    const cds = simResult.conduits;
    rows = [
      ["Time (min)", ...cds.map(c => `${c.id} Flow(CFS)`), ...cds.map(c => `${c.id} Velocity(fps)`)],
      ...cds[0].history.map((_, i) => [
        cds[0].history[i].t.toFixed(2),
        ...cds.map(c => c.history[i]?.flow?.toFixed(4) || "0"),
        ...cds.map(c => c.history[i]?.velocity?.toFixed(4) || "0"),
      ]),
    ];
  }
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `swmm5-lego-${tabKey}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
