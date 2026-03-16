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

export const STORM_CATS = [
  { key:"us", label:"🇺🇸 US STANDARDS" }, { key:"us_state", label:"🏛️ US STATE/LOCAL" },
  { key:"europe", label:"🇪🇺 EUROPE" }, { key:"asia", label:"🌏 ASIA-PACIFIC" },
  { key:"other", label:"🌍 OTHER REGIONS" }, { key:"generic", label:"📐 GENERIC" },
];

export const STORMS = [
  _S("⛈️ SCS Type II","Standard US — ~95% of continental US","us",1,1,24,_CD([[0,.5,0,.35,.9],[.5,.6,.35,.80,1],[.6,1,.80,1,1]],1,1,24)),
  _S("🌊 SCS Type III","Gulf Coast & tropical — sharp peak","us",1,1,24,_CD([[0,.5,0,.25,1],[.5,.58,.25,.75,1],[.58,1,.75,1,1]],1,1,24)),
  _S("🌲 SCS Type I","Pacific maritime — wet winters","us",1,1,24,_CD([[0,.4,0,.50,.8],[.4,.6,.50,.85,1],[.6,1,.85,1,1]],1,1,24)),
  _S("🌧️ SCS Type IA","Pacific NW coastal — early peak","us",1,1,24,_CD([[0,.35,0,.55,.75],[.35,.55,.55,.85,1],[.55,1,.85,1,1]],1,1,24)),
  (() => {
    const N=24,P=1,D=1,bl=[];
    for(let i=0;i<N;i++){const d1=(i+1)/N,d0=i/N;bl.push(Math.pow(d1,.6)-Math.pow(d0,.6));}
    bl.sort((a,b)=>b-a); const arr=Array(N).fill(0),m=N/2;
    bl.forEach((b,i)=>{if(i===0)arr[m]=b;else if(i%2===1)arr[m-Math.ceil(i/2)]=b;else arr[m+Math.floor(i/2)]=b;});
    return _S("⚖️ Balanced (Alt Block)","IDF-derived symmetric — Chow/Maidment","us",P,D,N,arr.map(b=>b*P/(D/N)));
  })(),
  _S("📡 NOAA Atlas 14","Measured gage data — modern standard","us",1,1,24,_CD([[0,.10,0,.04,1],[.10,.25,.04,.14,1],[.25,.40,.14,.32,1],[.40,.55,.32,.67,1],[.55,.70,.67,.85,1],[.70,.85,.85,.95,1],[.85,1,.95,1,1]],1,1,24)),
  _S("📊 Huff 1st Quartile","Short convective — 65% in first 25%","us",1,1,24,_CD([[0,.25,0,.65,.7],[.25,.50,.65,.85,1],[.50,.75,.85,.95,1],[.75,1,.95,1,1]],1,1,24)),
  _S("📊 Huff 2nd Quartile","Frontal storms — peak at 25-50%","us",1,1,24,_CD([[0,.25,0,.20,1],[.25,.50,.20,.70,.7],[.50,.75,.70,.90,1],[.75,1,.90,1,1]],1,1,24)),
  _S("📊 Huff 3rd Quartile","Late-developing — peak at 50-75%","us",1,1,24,_CD([[0,.25,0,.15,1],[.25,.50,.15,.35,1],[.50,.75,.35,.80,.7],[.75,1,.80,1,1]],1,1,24)),
  _S("📊 Huff 4th Quartile","Extended buildup — peak at 75-100%","us",1,1,24,_CD([[0,.25,0,.10,1],[.25,.50,.10,.25,1],[.50,.75,.25,.40,1],[.75,1,.40,1,.7]],1,1,24)),
  _S("🏗️ USACE Std Project","Dam safety — severe storm envelope","us",4,6,36,_CD([[0,.20,0,.08,1],[.20,.35,.08,.23,1],[.35,.50,.23,.63,.85],[.50,.65,.63,.85,1],[.65,.80,.85,.95,1],[.80,1,.95,1,1]],4,6,36)),
  _S("☢️ PMP (HMR 51/52)","Probable Maximum — FERC/NRC dam design","us",5,6,36,_CD([[0,.10,0,.04,1],[.10,.20,.04,.12,1],[.20,.30,.12,.25,1],[.30,.40,.25,.55,.80],[.40,.50,.55,.73,1],[.50,.60,.73,.85,1],[.60,.70,.85,.92,1],[.70,.85,.92,.97,1],[.85,1,.97,1,1]],5,6,36)),
  _S("🌴 FDOT Zone 1 NW FL","Panhandle — modified Type II","us_state",1,1,24,_CD([[0,.42,0,.40,.85],[.42,.54,.40,.78,1],[.54,1,.78,1,1]],1,1,24)),
  _S("🌴 FDOT Zone 2 NE FL","NE Florida","us_state",1,1,24,_CD([[0,.45,0,.38,.88],[.45,.55,.38,.78,1],[.55,1,.78,1,1]],1,1,24)),
  _S("🌴 FDOT Zone 3 Central","Central FL — tropical","us_state",1,1,24,_CD([[0,.35,0,.30,.80],[.35,.50,.30,.75,1],[.50,1,.75,1,1]],1,1,24)),
  _S("🌴 FDOT Zone 4 SE FL","SE FL / Miami — most front-loaded","us_state",1,1,24,_CD([[0,.25,0,.35,.75],[.25,.40,.35,.75,1],[.40,1,.75,1,.7]],1,1,24)),
  _S("🌴 FDOT Zone 5 SW FL","SW FL — convective","us_state",1,1,24,_CD([[0,.28,0,.33,.78],[.28,.42,.33,.73,1],[.42,1,.73,1,.7]],1,1,24)),
  _S("🤠 TxDOT Empirical","Texas DOT — broad central peak","us_state",1,1,24,_CD([[0,.30,0,.20,.9],[.30,.45,.20,.65,1],[.45,.65,.65,.85,1],[.65,1,.85,1,1]],1,1,24)),
  _S("🏔️ UDFCD Denver","Rocky Mtn thunderstorm — front-loaded","us_state",1,1,24,_CD([[0,.08,0,.04,1],[.08,.25,.04,.60,.75],[.25,.50,.60,.85,1],[.50,1,.85,1,1]],1,1,24)),
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
  _S("🇿🇦 South African Huff","Modified 2nd quartile — convective","other",1,1,24,_CD([[0,.20,0,.15,1],[.20,.45,.15,.70,.65],[.45,.70,.70,.90,1],[.70,1,.90,1,1]],1,1,24)),
  _S("🇨🇦 Canadian CDA/MTO","Modified Type II — cold climate","other",1,1,24,_CD([[0,.15,0,.05,1],[.15,.35,.05,.20,1],[.35,.50,.20,.62,.82],[.50,.65,.62,.84,1],[.65,.80,.84,.94,1],[.80,1,.94,1,1]],1,1,24)),
  _S("🟦 Block (Uniform)","Constant 1 in/hr — calibration","generic",1,1,24,Array(12).fill(1).concat(Array(12).fill(0))),
  _S("🔀 Double Peak","Multi-cell convective — dual Gaussian","generic",1,1,24,_IF(t=>2.5*Math.exp(-Math.pow((t-.3)/.08,2))+2*Math.exp(-Math.pow((t-.7)/.08,2)),1,1,24)),
  _S("📐 Yen & Chow Tri","r=0.375 SCS-like advance","generic",1,1,24,_IF(t=>t<=.375?t/.375:(1-t)/.625,1,1,24)),
  _S("✏️ Custom (Uniform)","Baseline — modify as needed","generic",1,1,24,Array(24).fill(1)),
];
