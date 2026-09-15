import { useState } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

// Standard Dressed Timber Dimensions & Section Properties per NDS (National Design Specification for Wood Construction)
const POST_SIZES = {
  '4x4': { name: '4×4', b: 3.5, d: 3.5, sx: 7.15, ix: 12.51, area: 12.25, label: '4×4 (3.5" × 3.5")', fbAllowable: 1350 },
  '6x6': { name: '6×6', b: 5.5, d: 5.5, sx: 27.73, ix: 76.26, area: 30.25, label: '6×6 (5.5" × 5.5")', fbAllowable: 1350 },
  '8x8': { name: '8×8', b: 7.5, d: 7.5, sx: 70.31, ix: 263.67, area: 56.25, label: '8×8 (7.5" × 7.5")', fbAllowable: 1350 },
  '10x10': { name: '10×10', b: 9.5, d: 9.5, sx: 142.91, ix: 678.7, area: 90.25, label: '10×10 (9.5" × 9.5")', fbAllowable: 1400 },
  '12x12': { name: '12×12', b: 11.5, d: 11.5, sx: 253.29, ix: 1456.4, area: 132.25, label: '12×12 (11.5" × 11.5")', fbAllowable: 1450 }
};

// Geotechnical Soil Characteristics
const SOIL_TYPES = {
  sand: {
    id: 'sand',
    name: 'Clean Granular Sand',
    phi: 32,
    cohesion: 0,
    gammaSoil: 115,
    gammaSat: 125,
    s1: 200, // allowable lateral bearing psf/ft (IBC 1806.2)
    description: 'Cohesionless, free-draining granular backfill with high frictional strength.',
    badgeColor: '#eab308'
  },
  clay: {
    id: 'clay',
    name: 'Stiff Cohesive Clay',
    phi: 0,
    cohesion: 600,
    gammaSoil: 110,
    gammaSat: 120,
    s1: 100,
    description: 'Cohesive fine-grained soil; design uses equivalent fluid active pressure (γeq ≈ 40 pcf).',
    badgeColor: '#84cc16'
  },
  silt: {
    id: 'silt',
    name: 'Moisture-Sensitive Silt',
    phi: 26,
    cohesion: 150,
    gammaSoil: 105,
    gammaSat: 122,
    s1: 120,
    description: 'Fine silty soil prone to capillary suction, saturation, and high pore water pressure.',
    badgeColor: '#f97316'
  },
  rock: {
    id: 'rock',
    name: 'Competent Bedrock',
    phi: 42,
    cohesion: 2500,
    gammaSoil: 140,
    gammaSat: 150,
    s1: 800,
    description: 'Sound bedrock stratum providing massive lateral bearing; shallow socket depth required.',
    badgeColor: '#94a3b8'
  }
};

const LAGGING_OPTIONS = {
  2: { nominal: '2-inch', actual: 1.5, label: '2" Nominal (1.5" actual)' },
  3: { nominal: '3-inch', actual: 2.5, label: '3" Nominal (2.5" actual)' },
  4: { nominal: '4-inch', actual: 3.5, label: '4" Nominal (3.5" actual)' }
};

// Color token constants for strict failure/warning/safe rendering
const COLOR_FAIL = '#f43f5e'; // Red
const COLOR_WARN = '#f59e0b'; // Yellow / Amber
const COLOR_SAFE = '#10b981'; // Green

const BG_FAIL = 'rgba(244, 63, 94, 0.16)';
const BG_WARN = 'rgba(245, 158, 11, 0.16)';
const BG_SAFE = 'rgba(16, 185, 129, 0.14)';

const BORDER_FAIL = 'rgba(244, 63, 94, 0.55)';
const BORDER_WARN = 'rgba(245, 158, 11, 0.55)';
const BORDER_SAFE = 'rgba(16, 185, 129, 0.45)';

const WoodRetainingWallVisualizer = ({ problem }) => {
  // State initialization
  const [postSizeKey, setPostSizeKey] = useState(problem?.postSize || '6x6');
  const [height, setHeight] = useState(problem?.height ?? 6); // ft (exposed retaining height H)
  const [embedment, setEmbedment] = useState(problem?.embedment ?? 6.5); // ft (dug depth D below grade)
  const [spacing, setSpacing] = useState(problem?.spacing ?? 4); // ft (post spacing S)
  const [soilTypeKey, setSoilTypeKey] = useState(problem?.soilType || 'sand');
  const [surcharge, setSurcharge] = useState(problem?.surcharge ?? 100); // psf (q)
  const [waterTable, setWaterTable] = useState(problem?.waterTable ?? 0); // ft from base (hw)
  const [laggingThick, setLaggingThick] = useState(problem?.laggingThickness ?? 3); // nominal inches
  const [hasDrainage, setHasDrainage] = useState(problem?.hasDrainage ?? false); // drainage system toggle
  
  // Shallow Dig Engineering Add-on State:
  // 'direct' = Direct soil burial | 'concrete_pier' = Augered drilled pier | 'concrete_collar' = Ground kick collar | 'tieback' = Deadman anchor
  const [foundationMethod, setFoundationMethod] = useState(problem?.foundationMethod || 'direct');
  const [pierDiameter, setPierDiameter] = useState(problem?.pierDiameter ?? 20); // inches (12 to 30)

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('viewMode')) return params.get('viewMode');
    }
    return problem?.viewMode || 'profile';
  });
  const [showDerivation, setShowDerivation] = useState(false);

  // Sync state if selected problem changes
  const [prevProblem, setPrevProblem] = useState(problem);
  if (problem && problem !== prevProblem) {
    setPrevProblem(problem);
    if (problem.postSize) setPostSizeKey(problem.postSize);
    if (problem.height !== undefined) setHeight(problem.height);
    if (problem.embedment !== undefined) setEmbedment(problem.embedment);
    if (problem.spacing !== undefined) setSpacing(problem.spacing);
    if (problem.soilType) setSoilTypeKey(problem.soilType);
    if (problem.surcharge !== undefined) setSurcharge(problem.surcharge);
    if (problem.waterTable !== undefined) setWaterTable(problem.waterTable);
    if (problem.laggingThickness !== undefined) setLaggingThick(problem.laggingThickness);
    if (problem.hasDrainage !== undefined) setHasDrainage(problem.hasDrainage);
    if (problem.foundationMethod) setFoundationMethod(problem.foundationMethod);
    if (problem.pierDiameter !== undefined) setPierDiameter(problem.pierDiameter);
  }

  // Active configurations
  const post = POST_SIZES[postSizeKey] || POST_SIZES['6x6'];
  const soil = SOIL_TYPES[soilTypeKey] || SOIL_TYPES.sand;
  const lagging = LAGGING_OPTIONS[laggingThick] || LAGGING_OPTIONS[3];

  // Geotechnical Lateral Earth Pressure Calculations
  const phi = soil.phi;
  const phiRad = (phi * Math.PI) / 180;
  
  // Rankine Active Earth Pressure Coefficient Ka
  const ka = phi > 0
    ? (1 - Math.sin(phiRad)) / (1 + Math.sin(phiRad))
    : (40 / soil.gammaSoil);

  // Rankine Passive Earth Pressure Coefficient Kp
  const kp = phi > 0 ? ((1 + Math.sin(phiRad)) / (1 - Math.sin(phiRad))) : 1.0;

  // Water Table Geometry & Buoyant Weight (Drained by perforated pipe if hasDrainage)
  const gammaW = 62.4; // pcf (water)
  const hw = hasDrainage ? 0 : Math.min(Math.max(waterTable, 0), height); // effective water height
  const hDry = height - hw; // upper dry/moist layer
  const gammaPrime = Math.max(soil.gammaSat - gammaW, 10); // buoyant unit weight

  // 1. Lateral Soil Active Thrust (per linear foot of wall):
  // (a) Upper dry zone
  let paDry = 0;
  let armDry = 0;
  let motDry = 0;
  if (hDry > 0) {
    paDry = 0.5 * ka * soil.gammaSoil * Math.pow(hDry, 2);
    armDry = hw + (hDry / 3);
    motDry = paDry * armDry;
  }

  // (b) Overburden surcharge from dry soil on submerged zone
  let paSubRect = 0;
  let armSubRect = 0;
  let motSubRect = 0;
  if (hw > 0 && hDry > 0) {
    const qOverburden = soil.gammaSoil * hDry;
    paSubRect = ka * qOverburden * hw;
    armSubRect = hw / 2;
    motSubRect = paSubRect * armSubRect;
  }

  // (c) Submerged effective soil thrust (buoyant)
  let paSubTri = 0;
  let armSubTri = 0;
  let motSubTri = 0;
  if (hw > 0) {
    paSubTri = 0.5 * ka * gammaPrime * Math.pow(hw, 2);
    armSubTri = hw / 3;
    motSubTri = paSubTri * armSubTri;
  }

  const paSoilTotal = paDry + paSubRect + paSubTri;
  const motSoilTotal = motDry + motSubRect + motSubTri;

  // 2. Surcharge Lateral Thrust (per linear foot of wall):
  const paSurcharge = ka * surcharge * height;
  const armSurcharge = height / 2;
  const motSurcharge = paSurcharge * armSurcharge;

  // 3. Hydrostatic Pore Water Pressure Thrust (per linear foot of wall):
  let pw = 0;
  let armPw = 0;
  let motPw = 0;
  let uBase = 0;
  if (hw > 0) {
    uBase = gammaW * hw; // psf at base
    pw = 0.5 * gammaW * Math.pow(hw, 2); // lb/ft
    armPw = hw / 3;
    motPw = pw * armPw;
  }

  // Total Lateral Load and Moment per linear foot
  const pTotalPerFt = paSoilTotal + paSurcharge + pw;
  const mTotalPerFt = motSoilTotal + motSurcharge + motPw;

  // 4. Tributary Load on an Individual Post (Spacing S):
  const rawPPost = pTotalPerFt * spacing; // lbs base shear (cantilever)
  const rawMGrade = mTotalPerFt * spacing; // ft-lbs base moment (cantilever)
  const hResultant = rawPPost > 0 ? (rawMGrade / rawPPost) : (height / 3); // ft above grade

  // 5. Shallow Dig Engineering Add-on Impact on Loads:
  // If Tieback is active, tie rod at 0.67*H carries ~58% of load, reducing moment by ~75%
  let tAnchor = 0;
  let pPost = rawPPost;
  let mGrade = rawMGrade;
  if (foundationMethod === 'tieback') {
    tAnchor = 0.58 * rawPPost;
    pPost = Math.max(rawPPost - tAnchor, rawPPost * 0.4);
    mGrade = Math.max(rawMGrade * 0.25, 500); // 75% reduction in overturning moment
  }

  // 6. How Deep to Dig: Embedment Depth Calculation (D_req)
  // Evaluates based on selected Foundation Engineering Add-on:
  let dReq = 0;
  let ibcAParam = 0;
  const bPierFt = pierDiameter / 12; // concrete pier diameter in ft
  const bPostFt = Math.max(post.d / 12, 0.46); // bare post width in ft

  if (soilTypeKey === 'rock') {
    // Bedrock socketing
    dReq = Math.max(2.5, 0.42 * height);
  } else if (foundationMethod === 'tieback') {
    // Tieback propped cantilever: anchor carries primary thrust, requiring minimal embedment
    dReq = Math.max(height * 0.35, 2.0);
  } else if (foundationMethod === 'concrete_collar') {
    // Ground-line restraint collar / kick slab (IBC 1807.3.2.2 "Constrained" Condition)
    // d = sqrt(4.25 * M / (S3 * b))
    const s3Eff = soil.s1 * 2.0;
    const bEffCollar = Math.max(bPostFt, 1.25);
    const dConstrained = Math.sqrt((4.25 * mGrade) / (s3Eff * bEffCollar));
    dReq = Math.max(dConstrained, 2.5);
  } else if (foundationMethod === 'concrete_pier') {
    // Augered Drilled Concrete Pier (IBC 1807.3 & Broms method with diameter b = bPierFt)
    // S1 doubled for isolated pole per IBC 1806.3.4
    const s1Eff = soil.s1 * 2.0;
    ibcAParam = (2.34 * pPost) / Math.max(s1Eff * bPierFt, 1);
    const dIbc = (ibcAParam / 2) * (1 + Math.sqrt(1 + (4.36 * hResultant) / Math.max(ibcAParam, 0.01)));
    
    // Broms limit equilibrium in sand/silt/clay:
    const bromsCapCoeff = 0.5 * kp * soil.gammaSoil * bPierFt;
    // solve for D where bromsCapCoeff * D^3 >= pPost * (hResultant + D)
    let dBroms = 3.0;
    for (let testD = 2.0; testD <= 10.0; testD += 0.1) {
      if (bromsCapCoeff * Math.pow(testD, 3) >= pPost * (hResultant + testD)) {
        dBroms = testD;
        break;
      }
    }
    dReq = Math.max(Math.min(dIbc * 0.85, dBroms), 2.5);
  } else {
    // Direct soil burial (bare timber post in dirt hole)
    const s1Eff = soil.s1 * 1.5;
    ibcAParam = (2.34 * pPost) / Math.max(s1Eff * bPostFt, 1);
    const dIbc = (ibcAParam / 2) * (1 + Math.sqrt(1 + (4.36 * hResultant) / Math.max(ibcAParam, 0.01)));
    
    let bromsRatio = 1.15;
    if (soilTypeKey === 'clay') bromsRatio = 1.25;
    if (soilTypeKey === 'silt') bromsRatio = 1.40;
    if (hw > 0) bromsRatio += (hw / height) * 0.25;
    if (surcharge > 150) bromsRatio += 0.10;
    
    const dBroms = height * bromsRatio;
    dReq = Math.max(dBroms * 0.95, Math.min(dIbc, dBroms * 1.25), 3.5);
  }

  // 7. Structural Wood Post Flexural Check:
  const fbActual = (mGrade * 12) / post.sx; // psi
  const fbAllowable = post.fbAllowable; // psi
  const postRatio = fbActual / fbAllowable;
  const isPostFail = postRatio > 1.0;
  const isPostWarn = !isPostFail && postRatio > 0.85;
  const postStatusColor = isPostFail ? COLOR_FAIL : (isPostWarn ? COLOR_WARN : COLOR_SAFE);
  const postStatusBg = isPostFail ? BG_FAIL : (isPostWarn ? BG_WARN : BG_SAFE);
  const postStatusBorder = isPostFail ? BORDER_FAIL : (isPostWarn ? BORDER_WARN : BORDER_SAFE);

  // 8. Geotechnical Embedment Safety Factor:
  const fsEmbed = dReq > 0 ? (embedment / dReq) : 1.0;
  const isEmbedFail = fsEmbed < 1.0;
  const isEmbedWarn = !isEmbedFail && fsEmbed < 1.15;
  const embedStatusColor = isEmbedFail ? COLOR_FAIL : (isEmbedWarn ? COLOR_WARN : COLOR_SAFE);
  const embedStatusBg = isEmbedFail ? BG_FAIL : (isEmbedWarn ? BG_WARN : BG_SAFE);
  const embedStatusBorder = isEmbedFail ? BORDER_FAIL : (isEmbedWarn ? BORDER_WARN : BORDER_SAFE);

  // 9. Timber Lagging Flexure Check across Spacing S (with AASHTO/FHWA soil arching M = p*S^2 / 10):
  const sigmaHMax = (ka * (soil.gammaSoil * hDry + gammaPrime * hw + surcharge)) + uBase; // psf at base
  const mPlank = (sigmaHMax * Math.pow(spacing, 2)) / 10; // ft-lb per ft height
  const sxPlank = (12 * Math.pow(lagging.actual, 2)) / 6; // in^3 per ft height
  const fbPlank = (mPlank * 12) / sxPlank; // psi
  const plankAllowable = 1200; // psi (wet service condition)
  const plankRatio = fbPlank / plankAllowable;
  const isPlankFail = plankRatio > 1.0;
  const isPlankWarn = !isPlankFail && plankRatio > 0.85;
  const plankStatusColor = isPlankFail ? COLOR_FAIL : (isPlankWarn ? COLOR_WARN : COLOR_SAFE);
  const plankStatusBg = isPlankFail ? BG_FAIL : (isPlankWarn ? BG_WARN : BG_SAFE);
  const plankStatusBorder = isPlankFail ? BORDER_FAIL : (isPlankWarn ? BORDER_WARN : BORDER_SAFE);

  // 10. Deflection at top of post
  const woodE = 1400000;
  const deltaTopInches = (pPost * Math.pow(height * 12, 3)) / (3 * woodE * post.ix);
  const deltaAllowableInches = (height * 12) / 150; // L/150 limit
  const deflRatio = deltaTopInches / Math.max(deltaAllowableInches, 0.01);
  const isDeflFail = deflRatio > 1.0;
  const isDeflWarn = !isDeflFail && deflRatio > 0.85;
  const deflStatusColor = isDeflFail ? COLOR_FAIL : (isDeflWarn ? COLOR_WARN : COLOR_SAFE);

  // 11. Comprehensive Overall System Compliance:
  const failList = [];
  if (isPostFail) failList.push(`Post flexure fb (${fbActual.toFixed(0)} > ${fbAllowable} psi)`);
  if (isEmbedFail) failList.push(`Embedment depth D (${embedment.toFixed(1)}' < Req ${dReq.toFixed(1)}')`);
  if (isPlankFail) failList.push(`Lagging planks (${fbPlank.toFixed(0)} > ${plankAllowable} psi)`);
  if (isDeflFail) failList.push(`Deflection (${deltaTopInches.toFixed(2)}" > Allow ${deltaAllowableInches.toFixed(2)}")`);

  const warnList = [];
  if (isPostWarn) warnList.push(`Post flexure at ${(postRatio * 100).toFixed(0)}% capacity`);
  if (isEmbedWarn) warnList.push(`Embedment FS = ${fsEmbed.toFixed(2)} (near minimum)`);
  if (isPlankWarn) warnList.push(`Lagging at ${(plankRatio * 100).toFixed(0)}% capacity`);
  if (isDeflWarn) warnList.push(`Deflection at ${(deflRatio * 100).toFixed(0)}% limit`);

  let overallColor = COLOR_SAFE;
  let overallBg = BG_SAFE;
  let overallBorder = BORDER_SAFE;
  let overallBadge = '✓ ALL SPECIFICATIONS MET (SAFE)';
  let overallSummary = 'All structural & geotechnical safety requirements fully satisfied.';

  if (failList.length > 0) {
    overallColor = COLOR_FAIL;
    overallBg = BG_FAIL;
    overallBorder = BORDER_FAIL;
    overallBadge = `✗ FAILED: ${failList.length} SPECIFICATION${failList.length > 1 ? 'S' : ''} EXCEEDED`;
    overallSummary = `Exceeded: ${failList.join(' • ')}`;
  } else if (warnList.length > 0) {
    overallColor = COLOR_WARN;
    overallBg = BG_WARN;
    overallBorder = BORDER_WARN;
    overallBadge = `⚠ CAUTION: ${warnList.length} MARGINAL SPECIFICATION${warnList.length > 1 ? 'S' : ''}`;
    overallSummary = `Marginal: ${warnList.join(' • ')}`;
  }

  // Helper to auto-set required embedment depth
  const handleAutoDig = () => {
    setEmbedment(parseFloat((dReq * 1.10).toFixed(1)));
  };

  // Total timber post length
  const totalLength = height + embedment;

  // SVG Scalings & Coordinates
  const svgWidth = 620;
  const svgHeight = 420;
  const groundY = 220;
  const wallFaceX = 260; // front face of post / lagging
  const scale = height + embedment > 16 ? 12 : (height + embedment > 12 ? 15 : 18);

  const sHeight = height * scale;
  const sEmbed = embedment * scale;
  const sHw = hw * scale;
  const postWidthPx = Math.max(post.d * 1.4, 8); // visual width of post

  // Rendered pier pixel width for concrete pier
  const pierPx = Math.max(bPierFt * 26, postWidthPx + 16);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Workbench Glass Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(420px, 1.4fr)', gap: '2.5rem', alignItems: 'start' }}>
          
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* Header & Comprehensive System Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🪵</span> Wood Retaining Wall Simulator
                </h3>
                <p className="text-xs text-muted">Cantilever Post-and-Lagging Wall: Embedment Depth & Shallow Dig Engineering</p>
              </div>
              <span 
                className="glass-badge" 
                style={{ 
                  color: overallColor, 
                  borderColor: overallBorder,
                  background: overallBg,
                  fontWeight: 700,
                  boxShadow: failList.length > 0 ? '0 0 12px rgba(244, 63, 94, 0.3)' : 'none'
                }}
              >
                {overallBadge}
              </span>
            </div>

            {/* Quick Warning / Failure Banner if any check fails */}
            {failList.length > 0 && (
              <div 
                style={{ 
                  padding: '0.6rem 0.85rem', 
                  borderRadius: '8px', 
                  background: BG_FAIL, 
                  border: `1px solid ${BORDER_FAIL}`,
                  color: COLOR_FAIL,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🚨</span>
                <div>
                  <strong>STRUCTURAL / GEOTECHNICAL FAILURE:</strong>
                  <div style={{ fontSize: '0.72rem', marginTop: '0.15rem', color: '#fecdd3' }}>
                    {overallSummary}
                  </div>
                </div>
              </div>
            )}

            {failList.length === 0 && warnList.length > 0 && (
              <div 
                style={{ 
                  padding: '0.55rem 0.8rem', 
                  borderRadius: '8px', 
                  background: BG_WARN, 
                  border: `1px solid ${BORDER_WARN}`,
                  color: COLOR_WARN,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                <div>
                  <strong>MARGINAL SAFETY MARGIN:</strong>
                  <div style={{ fontSize: '0.72rem', marginTop: '0.1rem', color: '#fde68a' }}>
                    {overallSummary}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Scenario Preset Buttons (Problems 102 - 107) */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.55rem' }}
                onClick={() => {
                  setPostSizeKey('6x6');
                  setHeight(6);
                  setEmbedment(6.5);
                  setSpacing(4);
                  setSoilTypeKey('sand');
                  setSurcharge(100);
                  setWaterTable(0);
                  setLaggingThick(3);
                  setHasDrainage(false);
                  setFoundationMethod('direct');
                }}
              >
                🏖️ Prob 102: 6ft Sand (6×6)
              </button>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.55rem' }}
                onClick={() => {
                  setPostSizeKey('8x8');
                  setHeight(6);
                  setEmbedment(8.0);
                  setSpacing(5);
                  setSoilTypeKey('silt');
                  setSurcharge(0);
                  setWaterTable(4);
                  setLaggingThick(3);
                  setHasDrainage(false);
                  setFoundationMethod('direct');
                }}
              >
                💧 Prob 103: Wet Silt (8×8)
              </button>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.55rem' }}
                onClick={() => {
                  setPostSizeKey('4x4');
                  setHeight(4);
                  setEmbedment(4.5);
                  setSpacing(3);
                  setSoilTypeKey('clay');
                  setSurcharge(0);
                  setWaterTable(0);
                  setLaggingThick(2);
                  setHasDrainage(false);
                  setFoundationMethod('direct');
                }}
              >
                🧱 Prob 104: 4ft Clay (4×4)
              </button>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.55rem' }}
                onClick={() => {
                  setPostSizeKey('10x10');
                  setHeight(8);
                  setEmbedment(3.5);
                  setSpacing(6);
                  setSoilTypeKey('rock');
                  setSurcharge(250);
                  setWaterTable(0);
                  setLaggingThick(4);
                  setHasDrainage(false);
                  setFoundationMethod('direct');
                }}
              >
                🪨 Prob 105: 8ft Rock Socket (10×10)
              </button>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.55rem' }}
                onClick={() => {
                  setPostSizeKey('10x10');
                  setHeight(8);
                  setEmbedment(8.5);
                  setSpacing(5);
                  setSoilTypeKey('sand');
                  setSurcharge(150);
                  setWaterTable(0);
                  setLaggingThick(3);
                  setHasDrainage(true);
                  setFoundationMethod('direct');
                }}
              >
                🪵 Prob 106: 8ft Lagging (3" Planks)
              </button>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.55rem', background: 'rgba(56, 189, 248, 0.15)', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
                onClick={() => {
                  setPostSizeKey('8x8');
                  setHeight(6);
                  setEmbedment(4.5);
                  setSpacing(4);
                  setSoilTypeKey('sand');
                  setSurcharge(100);
                  setWaterTable(0);
                  setLaggingThick(3);
                  setHasDrainage(true);
                  setFoundationMethod('concrete_pier');
                  setPierDiameter(16);
                }}
              >
                🎯 Prob 107: 4.5ft Shallow Dig (16" Pier)
              </button>
            </div>

            {/* SHALLOW DIG ENGINEERING ADD-ONS SECTION */}
            <div 
              style={{ 
                padding: '0.85rem', 
                borderRadius: '10px', 
                background: 'rgba(15, 23, 42, 0.65)', 
                border: '1px solid var(--accent-blue)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-blue)' }}>
                    Shallow Dig Engineering Add-on
                  </span>
                </div>
                <span className="glass-badge" style={{ fontSize: '0.68rem', color: 'var(--accent-emerald)' }}>
                  Req D: {dReq.toFixed(1)}'
                </span>
              </div>

              {/* Addon Selector Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
                <button
                  className={`btn-secondary ${foundationMethod === 'direct' ? 'active' : ''}`}
                  style={{
                    padding: '0.4rem 0.2rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    background: foundationMethod === 'direct' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
                    borderColor: foundationMethod === 'direct' ? 'var(--accent-amber)' : 'var(--border-color)',
                    color: foundationMethod === 'direct' ? 'var(--accent-amber)' : 'var(--text-dim)'
                  }}
                  onClick={() => setFoundationMethod('direct')}
                >
                  Direct Soil
                </button>
                <button
                  className={`btn-secondary ${foundationMethod === 'concrete_pier' ? 'active' : ''}`}
                  style={{
                    padding: '0.4rem 0.2rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    background: foundationMethod === 'concrete_pier' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)',
                    borderColor: foundationMethod === 'concrete_pier' ? 'var(--accent-blue)' : 'var(--border-color)',
                    color: foundationMethod === 'concrete_pier' ? 'var(--accent-blue)' : 'var(--text-dim)'
                  }}
                  onClick={() => setFoundationMethod('concrete_pier')}
                >
                  Concrete Pier
                </button>
                <button
                  className={`btn-secondary ${foundationMethod === 'concrete_collar' ? 'active' : ''}`}
                  style={{
                    padding: '0.4rem 0.2rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    background: foundationMethod === 'concrete_collar' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.03)',
                    borderColor: foundationMethod === 'concrete_collar' ? 'var(--accent-purple)' : 'var(--border-color)',
                    color: foundationMethod === 'concrete_collar' ? 'var(--accent-purple)' : 'var(--text-dim)'
                  }}
                  onClick={() => setFoundationMethod('concrete_collar')}
                >
                  Grade Collar
                </button>
                <button
                  className={`btn-secondary ${foundationMethod === 'tieback' ? 'active' : ''}`}
                  style={{
                    padding: '0.4rem 0.2rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    background: foundationMethod === 'tieback' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.03)',
                    borderColor: foundationMethod === 'tieback' ? 'var(--accent-emerald)' : 'var(--border-color)',
                    color: foundationMethod === 'tieback' ? 'var(--accent-emerald)' : 'var(--text-dim)'
                  }}
                  onClick={() => setFoundationMethod('tieback')}
                >
                  Deadman Anchor
                </button>
              </div>

              {/* Concrete Pier Diameter Slider (Shown when Concrete Pier is chosen) */}
              {foundationMethod === 'concrete_pier' && (
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                      Augered Pier Diameter (∅ b)
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.88rem', color: 'var(--accent-blue)' }}>
                      {pierDiameter}" ({bPierFt.toFixed(2)} ft)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="30"
                    step="2"
                    value={pierDiameter}
                    onChange={(e) => setPierDiameter(parseInt(e.target.value, 10))}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                    <span>12" (Tight)</span>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      Slashes Dig Depth by {Math.round((1 - dReq / (height * 1.15)) * 100)}%!
                    </span>
                    <span>30" (Massive)</span>
                  </div>
                </div>
              )}

              {/* Description of active addon */}
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                {foundationMethod === 'direct' && '• Direct Soil: Skinny wooden post pushes directly on soil. Requires deepest hole (D ≥ 1.15 H).'}
                {foundationMethod === 'concrete_pier' && `• ${pierDiameter}" Concrete Pier: Cylindrical concrete encasement quadruples passive bearing area b, slashing dig depth down to ${dReq.toFixed(1)} ft.`}
                {foundationMethod === 'concrete_collar' && '• Grade Restraint Collar: Concrete kick collar at surface prevents toe kickout, using IBC 1807.3.2.2 Constrained formula.'}
                {foundationMethod === 'tieback' && `• Deadman Tieback Anchor: Horizontal galvanized rod to concrete deadman carries ${(tAnchor / 1000).toFixed(1)} kips, slashing moment by 75% and depth to ${dReq.toFixed(1)} ft!`}
              </div>
            </div>

            {/* Post Size Selector (4x4 to 12x12) with Real-Time Red/Yellow/Green Badges */}
            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Wood Post Size (4×4 to 12×12)
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: postStatusColor, fontSize: '0.9rem' }}>
                  {post.label} • {isPostFail ? '✗ FAILS FLEXURE' : (isPostWarn ? '⚠ MARGINAL' : '✓ PASSES')}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem' }}>
                {Object.keys(POST_SIZES).map((key) => {
                  const pSize = POST_SIZES[key];
                  const testStress = (mGrade * 12) / pSize.sx;
                  const testRatio = testStress / pSize.fbAllowable;
                  const isKeyFail = testRatio > 1.0;
                  const isKeyWarn = !isKeyFail && testRatio > 0.85;
                  const pillColor = isKeyFail ? COLOR_FAIL : (isKeyWarn ? COLOR_WARN : COLOR_SAFE);
                  const pillText = isKeyFail ? 'FAIL' : (isKeyWarn ? 'WARN' : 'PASS');

                  return (
                    <button
                      key={key}
                      className={`btn-secondary ${postSizeKey === key ? 'active' : ''}`}
                      style={{
                        padding: '0.45rem 0.15rem',
                        fontSize: '0.72rem',
                        fontWeight: postSizeKey === key ? 700 : 500,
                        background: postSizeKey === key ? (isKeyFail ? BG_FAIL : (isKeyWarn ? BG_WARN : 'rgba(245, 158, 11, 0.2)')) : 'rgba(255,255,255,0.04)',
                        borderColor: postSizeKey === key ? (isKeyFail ? BORDER_FAIL : (isKeyWarn ? BORDER_WARN : 'var(--accent-amber)')) : 'var(--border-color)',
                        color: postSizeKey === key ? (isKeyFail ? COLOR_FAIL : (isKeyWarn ? COLOR_WARN : 'var(--accent-amber)')) : 'var(--text-main)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.15rem'
                      }}
                      onClick={() => setPostSizeKey(key)}
                    >
                      <span>{key}</span>
                      <span 
                        style={{ 
                          fontSize: '0.62rem', 
                          fontWeight: 700, 
                          color: pillColor, 
                          background: isKeyFail ? BG_FAIL : (isKeyWarn ? BG_WARN : BG_SAFE),
                          padding: '0.05rem 0.25rem',
                          borderRadius: '4px'
                        }}
                      >
                        {pillText}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                <span>Actual: {post.b}" × {post.d}"</span>
                <span>Sx = {post.sx} in³</span>
                <span>fb = {fbActual.toFixed(0)} psi / {post.fbAllowable} psi</span>
              </div>
            </div>

            {/* Retaining Height H and Embedment Depth D */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Exposed Height H */}
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Wall Height (H)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {height.toFixed(1)} ft
                  </span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="12" 
                  step="0.5" 
                  value={height} 
                  onChange={(e) => {
                    const newH = parseFloat(e.target.value);
                    setHeight(newH);
                    if (waterTable > newH) setWaterTable(newH);
                  }} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  <span>2.0 ft (Low)</span>
                  <span>Lever: {(height / 3).toFixed(1)}'</span>
                  <span>12.0 ft (High)</span>
                </div>
              </div>

              {/* Dig Depth D (Embedment) with Red/Yellow alert */}
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Dig Depth (D)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: embedStatusColor }}>
                    {embedment.toFixed(1)} ft ({isEmbedFail ? '✗ FAIL' : (isEmbedWarn ? '⚠ WARN' : '✓ OK')})
                  </span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="14" 
                  step="0.5" 
                  value={embedment} 
                  onChange={(e) => setEmbedment(parseFloat(e.target.value))} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  <span>Req: {dReq.toFixed(1)} ft</span>
                  <button 
                    style={{ background: 'none', border: 'none', color: 'var(--accent-emerald)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '0.7rem' }}
                    onClick={handleAutoDig}
                  >
                    Auto-Set Safe Depth
                  </button>
                  <span>14.0 ft</span>
                </div>
              </div>
            </div>

            {/* Post Spacing S and Soil Profile */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Center-to-Center Spacing S */}
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Post Spacing (S)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-purple)' }}>
                    {spacing.toFixed(1)} ft O.C.
                  </span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="10" 
                  step="0.5" 
                  value={spacing} 
                  onChange={(e) => setSpacing(parseFloat(e.target.value))} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  <span>2.0 ft</span>
                  <span>Tributary</span>
                  <span>10.0 ft</span>
                </div>
              </div>

              {/* Soil Type Selector */}
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Soil Profile
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: soil.badgeColor, fontSize: '0.85rem' }}>
                    {soil.name.split(' ')[0]}
                  </span>
                </div>
                <select
                  value={soilTypeKey}
                  onChange={(e) => setSoilTypeKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="sand">Sand (φ=32°, c=0, γ=115)</option>
                  <option value="clay">Clay (φ=0°, c=600, γeq=40)</option>
                  <option value="silt">Silt (φ=26°, c=150, γ=105)</option>
                  <option value="rock">Rock (φ=42°, c=2500, Socket)</option>
                </select>
                <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  Ka = {ka.toFixed(3)} • Kp = {kp.toFixed(2)} • S1 = {soil.s1} psf/ft
                </div>
              </div>
            </div>

            {/* Surcharge & Pore Water Pressure */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Surcharge q */}
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Surcharge (q)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: surcharge > 0 ? 'var(--accent-rose)' : 'var(--text-dim)' }}>
                    {surcharge} psf
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="500" 
                  step="25" 
                  value={surcharge} 
                  onChange={(e) => setSurcharge(parseFloat(e.target.value))} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  <span>0 psf (Lawn)</span>
                  <span>250 (Traffic)</span>
                  <span>500</span>
                </div>
              </div>

              {/* Water Table hw */}
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Water Table (hw)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: hasDrainage ? 'var(--accent-emerald)' : '#38bdf8' }}>
                    {hasDrainage ? '0.0 ft (Drained)' : `${hw.toFixed(1)} ft`}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={height} 
                  step="0.5" 
                  value={waterTable} 
                  disabled={hasDrainage}
                  onChange={(e) => setWaterTable(parseFloat(e.target.value))} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  <span>0 ft</span>
                  <span>u_base: {uBase.toFixed(0)} psf</span>
                  <span>{height.toFixed(0)} ft</span>
                </div>
              </div>
            </div>

            {/* Drainage System Toggle */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '0.5rem 0.8rem', 
                background: hasDrainage ? BG_SAFE : (hw > 0 ? BG_FAIL : 'rgba(255,255,255,0.03)'), 
                borderRadius: '8px', 
                border: `1px solid ${hasDrainage ? BORDER_SAFE : (hw > 0 ? BORDER_FAIL : 'var(--border-color)')}` 
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: hasDrainage ? COLOR_SAFE : (hw > 0 ? COLOR_FAIL : 'var(--text-main)') }}>
                  {hasDrainage ? '🛡️ Gravel Blanket & 4" Perforated Drain Active' : (hw > 0 ? '💧 Clogged Drain: Severe Hydrostatic Head' : 'Drainage Blanket: Uninstalled')}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  {hasDrainage ? 'Collector pipe eliminates pore pressure (Pw = 0), reducing moment' : (hw > 0 ? 'Trapped water adds severe overturning torque (install drain to relieve)' : 'Install drain pipe & crushed rock backfill')}
                </span>
              </div>
              <button
                className="btn-secondary"
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  background: hasDrainage ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.06)',
                  color: hasDrainage ? '#0f172a' : 'var(--text-main)',
                  borderColor: hasDrainage ? 'var(--accent-emerald)' : 'var(--border-color)'
                }}
                onClick={() => setHasDrainage(!hasDrainage)}
              >
                {hasDrainage ? '✓ Drained' : '+ Add Drain'}
              </button>
            </div>

            {/* Lagging Board Thickness Selection with Red/Yellow/Green Status */}
            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Wood Lagging Planks
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: plankStatusColor }}>
                  {lagging.label} • {isPlankFail ? '✗ PLANK OVERSTRESSED' : (isPlankWarn ? '⚠ MARGINAL' : '✓ PLANK OK')}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {[2, 3, 4].map((th) => {
                  const lOpt = LAGGING_OPTIONS[th];
                  const testSx = (12 * Math.pow(lOpt.actual, 2)) / 6;
                  const testFb = (mPlank * 12) / testSx;
                  const isThFail = testFb > plankAllowable;
                  const isThWarn = !isThFail && (testFb / plankAllowable) > 0.85;
                  const thColor = isThFail ? COLOR_FAIL : (isThWarn ? COLOR_WARN : COLOR_SAFE);
                  const thText = isThFail ? 'FAIL' : (isThWarn ? 'WARN' : 'PASS');

                  return (
                    <button
                      key={th}
                      className={`btn-secondary ${laggingThick === th ? 'active' : ''}`}
                      style={{
                        padding: '0.4rem 0.2rem',
                        fontSize: '0.74rem',
                        background: laggingThick === th ? (isThFail ? BG_FAIL : (isThWarn ? BG_WARN : 'rgba(56, 189, 248, 0.2)')) : 'rgba(255,255,255,0.04)',
                        borderColor: laggingThick === th ? (isThFail ? BORDER_FAIL : (isThWarn ? BORDER_WARN : 'var(--accent-blue)')) : 'var(--border-color)',
                        color: laggingThick === th ? (isThFail ? COLOR_FAIL : (isThWarn ? COLOR_WARN : 'var(--accent-blue)')) : 'var(--text-main)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.15rem'
                      }}
                      onClick={() => setLaggingThick(th)}
                    >
                      <span>{th}" Nom Planks</span>
                      <span 
                        style={{ 
                          fontSize: '0.62rem', 
                          fontWeight: 700, 
                          color: thColor, 
                          background: isThFail ? BG_FAIL : (isThWarn ? BG_WARN : BG_SAFE),
                          padding: '0.05rem 0.25rem',
                          borderRadius: '4px'
                        }}
                      >
                        {thText} ({testFb.toFixed(0)} psi)
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                <span>Span = {spacing} ft (Arching M = pS²/10)</span>
                <span>fb = {fbPlank.toFixed(0)} psi</span>
                <span>F'b = {plankAllowable} psi</span>
              </div>
            </div>

            {/* Derivation Modal Trigger Button */}
            <button 
              className="btn-secondary" 
              style={{ width: '100%', padding: '0.65rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}
              onClick={() => setShowDerivation(true)}
            >
              <span>📐</span> View Step-by-Step Engineering Derivation
            </button>
          </div>

          {/* Visualization Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* View Mode Switcher Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Interactive Retaining System Graphic</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    background: viewMode === 'profile' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    borderColor: viewMode === 'profile' ? 'var(--accent-blue)' : 'transparent',
                    color: viewMode === 'profile' ? 'var(--accent-blue)' : 'var(--text-dim)'
                  }}
                  onClick={() => setViewMode('profile')}
                >
                  Elevation Profile
                </button>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    background: viewMode === 'facade' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    borderColor: viewMode === 'facade' ? 'var(--accent-amber)' : 'transparent',
                    color: viewMode === 'facade' ? 'var(--accent-amber)' : 'var(--text-dim)'
                  }}
                  onClick={() => setViewMode('facade')}
                >
                  Wall Face (Lagging)
                </button>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    background: viewMode === 'diagrams' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                    borderColor: viewMode === 'diagrams' ? 'var(--accent-purple)' : 'transparent',
                    color: viewMode === 'diagrams' ? 'var(--accent-purple)' : 'var(--text-dim)'
                  }}
                  onClick={() => setViewMode('diagrams')}
                >
                  Shear & Moment
                </button>
              </div>
            </div>

            {/* Dynamic Interactive SVG Canvas */}
            <div style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(2,6,23,0.8) 100%)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '0.75rem', position: 'relative' }}>
              <svg 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
              >
                <defs>
                  {/* Soil Texture Patterns */}
                  <pattern id="sand-pattern" width="16" height="16" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.2" fill="#ca8a04" opacity="0.4" />
                    <circle cx="10" cy="4" r="1" fill="#eab308" opacity="0.35" />
                    <circle cx="14" cy="12" r="1.5" fill="#a16207" opacity="0.3" />
                    <circle cx="8" cy="7" r="1" fill="#eab308" opacity="0.3" />
                    <circle cx="5" cy="11" r="0.8" fill="#a16207" opacity="0.25" />
                  </pattern>

                  <pattern id="clay-pattern" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="16" stroke="#65a30d" strokeWidth="1.5" opacity="0.28" />
                    <line x1="8" y1="0" x2="8" y2="16" stroke="#4d7c0f" strokeWidth="1" strokeDasharray="3,3" opacity="0.25" />
                  </pattern>

                  <pattern id="silt-pattern" width="20" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 0 5 Q 5 0, 10 5 T 20 5" fill="none" stroke="#ea580c" strokeWidth="1.2" opacity="0.3" />
                  </pattern>

                  <pattern id="rock-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                    <rect x="1" y="1" width="10" height="10" fill="none" stroke="#64748b" strokeWidth="1.2" opacity="0.4" />
                    <rect x="13" y="13" width="10" height="10" fill="none" stroke="#475569" strokeWidth="1.2" opacity="0.4" />
                    <line x1="0" y1="12" x2="24" y2="12" stroke="#64748b" strokeWidth="1" opacity="0.35" />
                  </pattern>

                  <pattern id="gravel-drain-pattern" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="3" cy="3" r="2" fill="#94a3b8" opacity="0.6" />
                    <circle cx="9" cy="8" r="2.2" fill="#64748b" opacity="0.7" />
                    <circle cx="8" cy="2" r="1.5" fill="#cbd5e1" opacity="0.5" />
                  </pattern>

                  {/* Concrete Stippling Pattern */}
                  <pattern id="concrete-stipple-pattern" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="3" r="0.8" fill="#cbd5e1" opacity="0.5" />
                    <circle cx="7" cy="8" r="1" fill="#94a3b8" opacity="0.6" />
                    <circle cx="10" cy="2" r="0.7" fill="#64748b" opacity="0.5" />
                  </pattern>

                  {/* Wood Grain Gradient */}
                  <linearGradient id="wood-post-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#92400e" />
                    <stop offset="20%" stopColor="#b45309" />
                    <stop offset="50%" stopColor="#d97706" />
                    <stop offset="80%" stopColor="#b45309" />
                    <stop offset="100%" stopColor="#78350f" />
                  </linearGradient>

                  {/* Underground Foundation Shaft / Concrete Encasement */}
                  <linearGradient id="concrete-shaft-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="50%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>

                  {/* Pore Water Blue Shading */}
                  <linearGradient id="water-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.55" />
                  </linearGradient>

                  {/* Arrow markers */}
                  <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
                  </marker>
                  <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                  <marker id="arrow-amber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                  </marker>
                  <marker id="arrow-emerald" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                  </marker>
                </defs>

                {/* Profile View Mode */}
                {viewMode === 'profile' && (
                  <g>
                    {/* Retained Backfill Soil Zone */}
                    <rect 
                      x={wallFaceX} 
                      y={groundY - sHeight} 
                      width={svgWidth - wallFaceX - 30} 
                      height={sHeight} 
                      fill={`url(#${soilTypeKey}-pattern)`} 
                    />
                    <rect 
                      x={wallFaceX} 
                      y={groundY - sHeight} 
                      width={svgWidth - wallFaceX - 30} 
                      height={sHeight} 
                      fill="rgba(180, 83, 9, 0.08)" 
                    />

                    {/* Foundation Subgrade Soil */}
                    <rect 
                      x="30" 
                      y={groundY} 
                      width={svgWidth - 60} 
                      height={svgHeight - groundY - 20} 
                      fill={`url(#${soilTypeKey}-pattern)`} 
                    />
                    <rect 
                      x="30" 
                      y={groundY} 
                      width={svgWidth - 60} 
                      height={svgHeight - groundY - 20} 
                      fill={soilTypeKey === 'rock' ? 'rgba(71, 85, 105, 0.25)' : 'rgba(120, 53, 15, 0.12)'} 
                    />

                    {/* Free-Draining Gravel Blanket & Weep Pipe (if hasDrainage active) */}
                    {hasDrainage && (
                      <g>
                        {/* Crushed Stone Backfill Prism */}
                        <polygon
                          points={`${wallFaceX},${groundY - sHeight} ${wallFaceX + 45},${groundY - sHeight} ${wallFaceX + 65},${groundY} ${wallFaceX},${groundY}`}
                          fill="url(#gravel-drain-pattern)"
                          stroke="#cbd5e1"
                          strokeWidth="1.5"
                          strokeDasharray="4,2"
                        />
                        {/* Geotextile Filter Fabric Wrap */}
                        <line
                          x1={wallFaceX + 45}
                          y1={groundY - sHeight}
                          x2={wallFaceX + 65}
                          y2={groundY}
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="3,3"
                        />
                        {/* 4-inch Perforated PVC Collector Pipe */}
                        <circle
                          cx={wallFaceX + 18}
                          cy={groundY - 14}
                          r="10"
                          fill="#0f172a"
                          stroke="#38bdf8"
                          strokeWidth="2"
                        />
                        <circle
                          cx={wallFaceX + 18}
                          cy={groundY - 14}
                          r="4"
                          fill="#38bdf8"
                        />
                        {/* Drainage Callout Badge */}
                        <rect x={wallFaceX + 80} y={groundY - 32} width="160" height="24" rx="4" fill="rgba(15,23,42,0.92)" stroke="var(--accent-emerald)" strokeWidth="1" />
                        <text x={wallFaceX + 88} y={groundY - 16} fill="var(--accent-emerald)" fontSize="9" fontWeight="700" fontFamily="var(--font-mono)">
                          🛡️ 4" Weep Pipe & Gravel (Pw=0)
                        </text>
                      </g>
                    )}

                    {/* Submerged Zone Pore Water Behind Wall (if hw > 0 and undrained) */}
                    {!hasDrainage && hw > 0 && (
                      <g>
                        <rect 
                          x={wallFaceX} 
                          y={groundY - sHw} 
                          width={svgWidth - wallFaceX - 30} 
                          height={sHw} 
                          fill="url(#water-grad)" 
                        />
                        {/* Water Table Line */}
                        <line 
                          x1={wallFaceX - 10} 
                          y1={groundY - sHw} 
                          x2={svgWidth - 30} 
                          y2={groundY - sHw} 
                          stroke="#38bdf8" 
                          strokeWidth="2" 
                          strokeDasharray="6,4" 
                        />
                        <rect x={svgWidth - 145} y={groundY - sHw - 18} width="115" height="18" rx="4" fill="rgba(15,23,42,0.9)" stroke="#38bdf8" strokeWidth="1" />
                        <text 
                          x={svgWidth - 88} 
                          y={groundY - sHw - 5} 
                          fill="#38bdf8" 
                          fontSize="9" 
                          fontWeight="700" 
                          textAnchor="middle"
                          fontFamily="var(--font-mono)"
                        >
                          ▼ G.W.T. (hw = {hw.toFixed(1)}')
                        </text>
                      </g>
                    )}

                    {/* TIEBACK SYSTEM GRAPHIC (if foundationMethod === 'tieback') */}
                    {foundationMethod === 'tieback' && (
                      <g>
                        {/* Horizontal Galvanized Steel Tie Rod at 0.67*H */}
                        <line
                          x1={wallFaceX - postWidthPx - 6}
                          y1={groundY - sHeight * 0.67}
                          x2={wallFaceX + 170}
                          y2={groundY - sHeight * 0.67}
                          stroke="#38bdf8"
                          strokeWidth="3.5"
                        />
                        {/* Washer Bearing Plate on Front of Post */}
                        <rect
                          x={wallFaceX - postWidthPx - 10}
                          y={groundY - sHeight * 0.67 - 10}
                          width="6"
                          height="20"
                          fill="#e2e8f0"
                          stroke="#0f172a"
                          strokeWidth="1"
                          rx="1"
                        />
                        {/* Buried Concrete Deadman Anchor Block */}
                        <rect
                          x={wallFaceX + 170}
                          y={groundY - sHeight * 0.67 - 24}
                          width="38"
                          height="48"
                          fill="url(#concrete-shaft-grad)"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          rx="3"
                        />
                        <rect
                          x={wallFaceX + 170}
                          y={groundY - sHeight * 0.67 - 24}
                          width="38"
                          height="48"
                          fill="url(#concrete-stipple-pattern)"
                          opacity="0.6"
                        />
                        {/* Tension Force Arrow T_anchor */}
                        <line
                          x1={wallFaceX + 60}
                          y1={groundY - sHeight * 0.67 - 14}
                          x2={wallFaceX + 130}
                          y2={groundY - sHeight * 0.67 - 14}
                          stroke="#38bdf8"
                          strokeWidth="2"
                          markerEnd="url(#arrow-blue)"
                        />
                        <rect x={wallFaceX + 50} y={groundY - sHeight * 0.67 - 36} width="145" height="18" rx="3" fill="rgba(15,23,42,0.92)" stroke="#38bdf8" strokeWidth="0.8" />
                        <text
                          x={wallFaceX + 122}
                          y={groundY - sHeight * 0.67 - 24}
                          fill="#38bdf8"
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          fontFamily="var(--font-mono)"
                        >
                          ⚓ Tie Rod T = {(tAnchor / 1000).toFixed(1)}k (Propped)
                        </text>
                      </g>
                    )}

                    {/* CONCRETE RESTRAINT COLLAR AT GRADE (if foundationMethod === 'concrete_collar') */}
                    {foundationMethod === 'concrete_collar' && (
                      <g>
                        <rect
                          x={wallFaceX - postWidthPx - 35}
                          y={groundY}
                          width={postWidthPx + 55}
                          height="28"
                          fill="url(#concrete-shaft-grad)"
                          stroke="var(--accent-purple)"
                          strokeWidth="2"
                          rx="2"
                        />
                        <rect
                          x={wallFaceX - postWidthPx - 35}
                          y={groundY}
                          width={postWidthPx + 55}
                          height="28"
                          fill="url(#concrete-stipple-pattern)"
                          opacity="0.7"
                        />
                        <rect x={wallFaceX - 110} y={groundY + 34} width="155" height="18" rx="3" fill="rgba(15,23,42,0.92)" stroke="var(--accent-purple)" strokeWidth="0.8" />
                        <text
                          x={wallFaceX - 32}
                          y={groundY + 46}
                          fill="var(--accent-purple)"
                          fontSize="9"
                          fontWeight="700"
                          textAnchor="middle"
                          fontFamily="var(--font-mono)"
                        >
                          🛡️ Grade Collar (IBC Constrained)
                        </text>
                      </g>
                    )}

                    {/* AUGERED CONCRETE PIER / FOUNDATION SHAFT */}
                    {foundationMethod === 'concrete_pier' ? (
                      <g>
                        {/* Drilled Cylindrical Pier Encasement */}
                        <rect 
                          x={wallFaceX - postWidthPx / 2 - pierPx / 2} 
                          y={groundY} 
                          width={pierPx} 
                          height={sEmbed} 
                          fill="url(#concrete-shaft-grad)" 
                          stroke={isEmbedFail ? COLOR_FAIL : (isEmbedWarn ? COLOR_WARN : 'var(--accent-blue)')} 
                          strokeWidth={isEmbedFail ? "2.5" : "2"} 
                          strokeDasharray={isEmbedFail ? "4,2" : "none"} 
                          rx="4"
                        />
                        <rect 
                          x={wallFaceX - postWidthPx / 2 - pierPx / 2} 
                          y={groundY} 
                          width={pierPx} 
                          height={sEmbed} 
                          fill="url(#concrete-stipple-pattern)" 
                          opacity="0.75" 
                        />
                        {/* Pier Diameter Dimension Line */}
                        <line
                          x1={wallFaceX - postWidthPx / 2 - pierPx / 2}
                          y1={groundY + 12}
                          x2={wallFaceX - postWidthPx / 2 + pierPx / 2}
                          y2={groundY + 12}
                          stroke="var(--accent-blue)"
                          strokeWidth="1.5"
                        />
                        <rect 
                          x={wallFaceX - postWidthPx / 2 - 60} 
                          y={groundY + sEmbed + 6} 
                          width="120" 
                          height="20" 
                          rx="4" 
                          fill="rgba(15,23,42,0.92)" 
                          stroke={embedStatusBorder} 
                          strokeWidth="1" 
                        />
                        <text 
                          x={wallFaceX - postWidthPx / 2} 
                          y={groundY + sEmbed + 20} 
                          fill={embedStatusColor} 
                          fontSize="9" 
                          fontWeight="700" 
                          textAnchor="middle" 
                          fontFamily="var(--font-mono)"
                        >
                          {pierDiameter}" Pier ∅ (b={bPierFt.toFixed(2)}')
                        </text>
                      </g>
                    ) : (
                      /* Standard Direct Soil Burial Shaft */
                      <g>
                        <rect 
                          x={wallFaceX - postWidthPx - 6} 
                          y={groundY} 
                          width={postWidthPx + 12} 
                          height={sEmbed} 
                          fill="url(#concrete-shaft-grad)" 
                          stroke={isEmbedFail ? COLOR_FAIL : (isEmbedWarn ? COLOR_WARN : '#475569')} 
                          strokeWidth={isEmbedFail ? "2.5" : "1.5"} 
                          strokeDasharray={isEmbedFail ? "4,2" : "none"} 
                          rx="3"
                        />
                        <rect 
                          x={wallFaceX - postWidthPx / 2 - 95} 
                          y={groundY + sEmbed + 6} 
                          width="190" 
                          height="20" 
                          rx="4" 
                          fill="rgba(15,23,42,0.92)" 
                          stroke={embedStatusBorder} 
                          strokeWidth="1" 
                        />
                        <text 
                          x={wallFaceX - postWidthPx / 2} 
                          y={groundY + sEmbed + 20} 
                          fill={embedStatusColor} 
                          fontSize="9" 
                          fontWeight="700" 
                          textAnchor="middle" 
                          fontFamily="var(--font-mono)"
                        >
                          {isEmbedFail 
                            ? `✗ EMBEDMENT FAILS (D < Req ${dReq.toFixed(1)}')` 
                            : (soilTypeKey === 'rock' ? 'Rock Socket' : `Embedment OK (FS = ${fsEmbed.toFixed(2)})`)}
                        </text>
                      </g>
                    )}

                    {/* Vertical Wood Timber Post (Total Length L = H + D) */}
                    <rect 
                      x={wallFaceX - postWidthPx} 
                      y={groundY - sHeight} 
                      width={postWidthPx} 
                      height={sHeight + sEmbed} 
                      fill="url(#wood-post-grad)" 
                      stroke={postStatusColor} 
                      strokeWidth={isPostFail ? "3.5" : (isPostWarn ? "2.5" : "1.8")} 
                      rx="2"
                    />

                    {/* Post Chamfer / Cap Detail */}
                    <polygon 
                      points={`${wallFaceX - postWidthPx},${groundY - sHeight} ${wallFaceX - postWidthPx / 2},${groundY - sHeight - 5} ${wallFaceX},${groundY - sHeight}`} 
                      fill="#78350f" 
                    />

                    {/* Overstressed Failure Pill Callout on Post */}
                    {isPostFail && (
                      <g>
                        <rect 
                          x={wallFaceX - postWidthPx - 170} 
                          y={groundY - sHeight * 0.55} 
                          width="160" 
                          height="26" 
                          rx="4" 
                          fill="rgba(244,63,94,0.95)" 
                          stroke="#f43f5e" 
                          strokeWidth="1.5" 
                        />
                        <text 
                          x={wallFaceX - postWidthPx - 90} 
                          y={groundY - sHeight * 0.55 + 17} 
                          fill="#ffffff" 
                          fontSize="9" 
                          fontWeight="800" 
                          textAnchor="middle" 
                          fontFamily="var(--font-mono)"
                        >
                          ✗ POST FAILS (fb &gt; F'b)
                        </text>
                      </g>
                    )}

                    {/* Timber Lagging Planks Indicators */}
                    {Array.from({ length: Math.min(Math.floor(height), 12) }).map((_, i) => {
                      const plankH = sHeight / Math.max(Math.floor(height), 1);
                      const py = groundY - (i + 1) * plankH;
                      return (
                        <line 
                          key={i} 
                          x1={wallFaceX} 
                          y1={py} 
                          x2={wallFaceX + 5} 
                          y2={py} 
                          stroke="#fbbf24" 
                          strokeWidth="1" 
                        />
                      );
                    })}

                    {/* Ground Level Lines */}
                    <line x1={wallFaceX} y1={groundY - sHeight} x2={svgWidth - 30} y2={groundY - sHeight} stroke="#d97706" strokeWidth="3" />
                    <line x1="30" y1={groundY} x2={wallFaceX - postWidthPx} y2={groundY} stroke="#65a30d" strokeWidth="3" />
                    <line x1={wallFaceX} y1={groundY} x2={svgWidth - 30} y2={groundY} stroke="#78350f" strokeWidth="1.5" strokeDasharray="4,4" />
                    
                    <rect x="35" y={groundY - 18} width="125" height="16" rx="3" fill="rgba(15,23,42,0.85)" stroke="#65a30d" strokeWidth="0.8" />
                    <text x="40" y={groundY - 6} fill="#84cc16" fontSize="9" fontWeight="700">
                      Lower Grade / Toe Line
                    </text>

                    {/* Surcharge Load Graphic (q > 0) */}
                    {surcharge > 0 && (
                      <g>
                        <line 
                          x1={wallFaceX + 8} 
                          y1={groundY - sHeight - 16} 
                          x2={svgWidth - 35} 
                          y2={groundY - sHeight - 16} 
                          stroke="#f43f5e" 
                          strokeWidth="2" 
                        />
                        {[0.2, 0.4, 0.6, 0.8].map((frac, idx) => {
                          const ax = wallFaceX + 8 + frac * (svgWidth - wallFaceX - 45);
                          return (
                            <line 
                              key={idx} 
                              x1={ax} 
                              y1={groundY - sHeight - 16} 
                              x2={ax} 
                              y2={groundY - sHeight - 2} 
                              stroke="#f43f5e" 
                              strokeWidth="1.5" 
                              markerEnd="url(#arrow-red)" 
                            />
                          );
                        })}
                        <rect x={wallFaceX + 25} y={groundY - sHeight - 34} width="130" height="18" rx="4" fill="rgba(15,23,42,0.9)" stroke="#f43f5e" strokeWidth="1" />
                        <text 
                          x={wallFaceX + 90} 
                          y={groundY - sHeight - 21} 
                          fill="#f43f5e" 
                          fontSize="9" 
                          fontWeight="700" 
                          textAnchor="middle"
                          fontFamily="var(--font-mono)"
                        >
                          Surcharge q = {surcharge} psf
                        </text>
                      </g>
                    )}

                    {/* Active Lateral Earth Pressure Diagram */}
                    <g>
                      <line 
                        x1={wallFaceX + 85} 
                        y1={groundY - sHeight / 3} 
                        x2={wallFaceX + 8} 
                        y2={groundY - sHeight / 3} 
                        stroke="#f59e0b" 
                        strokeWidth="2.5" 
                        markerEnd="url(#arrow-amber)" 
                      />
                      <rect x={wallFaceX + 90} y={groundY - sHeight / 3 - 10} width="115" height="18" rx="4" fill="rgba(15,23,42,0.92)" stroke="#f59e0b" strokeWidth="1" />
                      <text 
                        x={wallFaceX + 147} 
                        y={groundY - sHeight / 3 + 3} 
                        fill="#f59e0b" 
                        fontSize="9" 
                        fontWeight="700" 
                        textAnchor="middle"
                        fontFamily="var(--font-mono)"
                      >
                        Pa = {pTotalPerFt.toFixed(0)} lb/ft
                      </text>

                      {/* Hydrostatic Pore Water Force Vector (if undrained & hw > 0) */}
                      {!hasDrainage && hw > 0 && (
                        <g>
                          <line 
                            x1={wallFaceX + 70} 
                            y1={groundY - sHw / 3} 
                            x2={wallFaceX + 8} 
                            y2={groundY - sHw / 3} 
                            stroke="#38bdf8" 
                            strokeWidth="2.5" 
                            markerEnd="url(#arrow-blue)" 
                          />
                          <rect x={wallFaceX + 75} y={groundY - sHw / 3 - 10} width="110" height="18" rx="4" fill="rgba(15,23,42,0.92)" stroke="#38bdf8" strokeWidth="1" />
                          <text 
                            x={wallFaceX + 130} 
                            y={groundY - sHw / 3 + 3} 
                            fill="#38bdf8" 
                            fontSize="9" 
                            fontWeight="700" 
                            textAnchor="middle"
                            fontFamily="var(--font-mono)"
                          >
                            Pw = {pw.toFixed(0)} lb/ft
                          </text>
                        </g>
                      )}
                    </g>

                    {/* Passive Soil Resistance Bulb Below Grade */}
                    <g>
                      <line 
                        x1={wallFaceX - (foundationMethod === 'concrete_pier' ? pierPx / 2 + 50 : postWidthPx + 70)} 
                        y1={groundY + sEmbed * 0.4} 
                        x2={wallFaceX - (foundationMethod === 'concrete_pier' ? pierPx / 2 : postWidthPx + 8)} 
                        y2={groundY + sEmbed * 0.4} 
                        stroke="#10b981" 
                        strokeWidth="2.5" 
                        markerEnd="url(#arrow-emerald)" 
                      />
                      <rect x={wallFaceX - (foundationMethod === 'concrete_pier' ? pierPx / 2 + 145 : postWidthPx + 150)} y={groundY + sEmbed * 0.4 - 10} width="140" height="18" rx="4" fill="rgba(15,23,42,0.92)" stroke="#10b981" strokeWidth="1" />
                      <text 
                        x={wallFaceX - (foundationMethod === 'concrete_pier' ? pierPx / 2 + 75 : postWidthPx + 80)} 
                        y={groundY + sEmbed * 0.4 + 3} 
                        fill="#10b981" 
                        fontSize="9" 
                        fontWeight="700" 
                        textAnchor="middle" 
                        fontFamily="var(--font-mono)"
                      >
                        Passive Pp ({soil.s1 * (foundationMethod === 'concrete_pier' ? 2 : 1)} psf/ft)
                      </text>
                    </g>

                    {/* Height H Dimension */}
                    <g>
                      <line x1={wallFaceX - postWidthPx - 28} y1={groundY - sHeight} x2={wallFaceX - postWidthPx - 28} y2={groundY} stroke="var(--accent-blue)" strokeWidth="1.5" />
                      <line x1={wallFaceX - postWidthPx - 34} y1={groundY - sHeight} x2={wallFaceX - postWidthPx - 22} y2={groundY - sHeight} stroke="var(--accent-blue)" strokeWidth="1.5" />
                      <line x1={wallFaceX - postWidthPx - 34} y1={groundY} x2={wallFaceX - postWidthPx - 22} y2={groundY} stroke="var(--accent-blue)" strokeWidth="1.5" />
                      <rect x={wallFaceX - postWidthPx - 95} y={groundY - sHeight / 2 - 9} width="62" height="18" rx="3" fill="rgba(15,23,42,0.9)" stroke="var(--accent-blue)" strokeWidth="0.8" />
                      <text 
                        x={wallFaceX - postWidthPx - 64} 
                        y={groundY - sHeight / 2 + 4} 
                        fill="var(--accent-blue)" 
                        fontSize="10" 
                        fontWeight="700" 
                        textAnchor="middle" 
                        fontFamily="var(--font-mono)"
                      >
                        H = {height.toFixed(1)}'
                      </text>
                    </g>

                    {/* Embedment Depth D Dimension (Red if failing, yellow if warn) */}
                    <g>
                      <line x1={wallFaceX - postWidthPx - 28} y1={groundY} x2={wallFaceX - postWidthPx - 28} y2={groundY + sEmbed} stroke={embedStatusColor} strokeWidth="1.8" />
                      <line x1={wallFaceX - postWidthPx - 34} y1={groundY} x2={wallFaceX - postWidthPx - 22} y2={groundY} stroke={embedStatusColor} strokeWidth="1.8" />
                      <line x1={wallFaceX - postWidthPx - 34} y1={groundY + sEmbed} x2={wallFaceX - postWidthPx - 22} y2={groundY + sEmbed} stroke={embedStatusColor} strokeWidth="1.8" />
                      <rect x={wallFaceX - postWidthPx - 95} y={groundY + sEmbed / 2 - 9} width="62" height="18" rx="3" fill="rgba(15,23,42,0.9)" stroke={embedStatusColor} strokeWidth="1" />
                      <text 
                        x={wallFaceX - postWidthPx - 64} 
                        y={groundY + sEmbed / 2 + 4} 
                        fill={embedStatusColor} 
                        fontSize="10" 
                        fontWeight="700" 
                        textAnchor="middle" 
                        fontFamily="var(--font-mono)"
                      >
                        D = {embedment.toFixed(1)}'
                      </text>
                    </g>

                    {/* Total Post Length Header Banner */}
                    <rect 
                      x="40" 
                      y="18" 
                      width="230" 
                      height="38" 
                      fill="rgba(15,23,42,0.85)" 
                      stroke="var(--border-color)" 
                      rx="6" 
                    />
                    <text x="50" y="34" fill="var(--text-muted)" fontSize="9" fontWeight="600" style={{ textTransform: 'uppercase' }}>
                      Foundation: {foundationMethod.replace('_', ' ').toUpperCase()}
                    </text>
                    <text x="50" y="50" fill="var(--accent-amber)" fontSize="13" fontWeight="800" fontFamily="var(--font-mono)">
                      L = H + D = {totalLength.toFixed(1)}' ({post.name})
                    </text>
                  </g>
                )}

                {/* Facade / Wall Face View Mode */}
                {viewMode === 'facade' && (
                  <g>
                    <rect x="30" y="20" width={svgWidth - 60} height={groundY - 20} fill="rgba(15,23,42,0.4)" />
                    <rect x="30" y={groundY} width={svgWidth - 60} height={svgHeight - groundY - 20} fill="rgba(180, 83, 9, 0.15)" />
                    <line x1="30" y1={groundY} x2={svgWidth - 30} y2={groundY} stroke="#65a30d" strokeWidth="3" />

                    {/* 3 Vertical Posts at Spacing S */}
                    {[120, 310, 500].map((cx, idx) => {
                      const pw = Math.max(post.d * 2.2, 14);
                      return (
                        <g key={idx}>
                          {/* Encasement or Shaft */}
                          <rect 
                            x={cx - (foundationMethod === 'concrete_pier' ? pierPx / 2 : pw / 2)} 
                            y={groundY} 
                            width={foundationMethod === 'concrete_pier' ? pierPx : pw} 
                            height={Math.min(sEmbed * 0.9, 130)} 
                            fill="url(#concrete-shaft-grad)" 
                            stroke={embedStatusColor} 
                            strokeWidth={isEmbedFail ? "2" : "1.2"} 
                            strokeDasharray="3,2" 
                          />
                          <rect 
                            x={cx - pw / 2} 
                            y={groundY - sHeight} 
                            width={pw} 
                            height={sHeight} 
                            fill="url(#wood-post-grad)" 
                            stroke={postStatusColor} 
                            strokeWidth={isPostFail ? "3" : "1.8"} 
                            rx="2" 
                          />
                          <polygon 
                            points={`${cx - pw / 2},${groundY - sHeight} ${cx},${groundY - sHeight - 6} ${cx + pw / 2},${groundY - sHeight}`} 
                            fill="#78350f" 
                          />
                          <text 
                            x={cx} 
                            y={groundY - sHeight - 12} 
                            fill={postStatusColor} 
                            fontSize="10" 
                            textAnchor="middle" 
                            fontFamily="var(--font-mono)" 
                            fontWeight="700"
                          >
                            {post.name} {isPostFail ? '(FAIL)' : (isPostWarn ? '(WARN)' : '(OK)')}
                          </text>
                        </g>
                      );
                    })}

                    {/* Horizontal Timber Lagging Planks Between Posts */}
                    {[ [120, 310], [310, 500] ].map(([x1, x2], bayIdx) => {
                      const numPlanks = Math.max(Math.floor(height * 1.5), 4);
                      const plankH = sHeight / numPlanks;
                      return Array.from({ length: numPlanks }).map((_, pIdx) => {
                        const py = groundY - (pIdx + 1) * plankH;
                        return (
                          <g key={`${bayIdx}-${pIdx}`}>
                            <rect 
                              x={x1 + 8} 
                              y={py + 1} 
                              width={x2 - x1 - 16} 
                              height={plankH - 2} 
                              fill={isPlankFail ? 'rgba(244, 63, 94, 0.45)' : (pIdx % 2 === 0 ? '#b45309' : '#92400e')} 
                              stroke={isPlankFail ? COLOR_FAIL : '#78350f'} 
                              strokeWidth={isPlankFail ? "1.8" : "1"} 
                              opacity="0.9" 
                              rx="1" 
                            />
                            <circle cx={x1 + 14} cy={py + plankH / 2} r="2" fill="#e2e8f0" />
                            <circle cx={x2 - 14} cy={py + plankH / 2} r="2" fill="#e2e8f0" />
                          </g>
                        );
                      });
                    })}

                    {/* Lagging Failure / Warning Pill in Facade */}
                    {isPlankFail && (
                      <g>
                        <rect x="180" y="80" width="260" height="24" rx="4" fill="rgba(244,63,94,0.95)" stroke="#f43f5e" strokeWidth="1.5" />
                        <text x="310" y="96" fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">
                          ✗ LAGGING OVERSTRESSED (USE 3" OR 4" PLANKS)
                        </text>
                      </g>
                    )}

                    {/* Post Spacing S Dimension Line */}
                    <g>
                      <line x1="120" y1={groundY + 30} x2="310" y2={groundY + 30} stroke="var(--accent-purple)" strokeWidth="1.5" />
                      <line x1="120" y1={groundY + 24} x2="120" y2={groundY + 36} stroke="var(--accent-purple)" strokeWidth="1.5" />
                      <line x1="310" y1={groundY + 24} x2="310" y2={groundY + 36} stroke="var(--accent-purple)" strokeWidth="1.5" />
                      <rect x="145" y={groundY + 36} width="140" height="18" rx="3" fill="rgba(15,23,42,0.9)" stroke="var(--accent-purple)" strokeWidth="0.8" />
                      <text x="215" y={groundY + 49} fill="var(--accent-purple)" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                        Spacing S = {spacing.toFixed(1)} ft O.C.
                      </text>
                    </g>
                  </g>
                )}

                {/* Shear & Moment Diagrams View Mode */}
                {viewMode === 'diagrams' && (
                  <g>
                    <rect x="180" y="40" width="12" height={svgHeight - 80} fill="#78350f" rx="2" />
                    <line x1="100" y1={groundY} x2="550" y2={groundY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />
                    <text x="105" y={groundY - 6} fill="#94a3b8" fontSize="10" fontFamily="var(--font-mono)">Ground Line (z = 0)</text>

                    {/* Shear Force Diagram V(z) */}
                    <g transform="translate(240, 0)">
                      <text x="50" y="30" fill="var(--accent-cyan)" fontSize="12" fontWeight="700">
                        Shear Force V(z)
                      </text>
                      <line x1="50" y1="40" x2="50" y2={svgHeight - 40} stroke="#475569" strokeWidth="1" />
                      <path 
                        d={`M 50 40 Q 55 ${groundY - 40}, ${50 + Math.min(pPost * 0.007, 70)} ${groundY} L 50 ${groundY} Z`} 
                        fill="rgba(6, 182, 212, 0.2)" 
                        stroke="var(--accent-cyan)" 
                        strokeWidth="2" 
                      />
                      <rect x={50 + Math.min(pPost * 0.007, 70) + 6} y={groundY - 8} width="110" height="18" rx="3" fill="rgba(15,23,42,0.92)" stroke="var(--accent-cyan)" strokeWidth="0.8" />
                      <text 
                        x={50 + Math.min(pPost * 0.007, 70) + 61} 
                        y={groundY + 4} 
                        fill="var(--accent-cyan)" 
                        fontSize="9" 
                        fontWeight="700" 
                        textAnchor="middle"
                        fontFamily="var(--font-mono)"
                      >
                        V_max = {(pPost / 1000).toFixed(2)} kips
                      </text>
                    </g>

                    {/* Bending Moment Diagram M(z) */}
                    <g transform="translate(420, 0)">
                      <text x="50" y="30" fill={postStatusColor} fontSize="12" fontWeight="700">
                        Bending Moment M(z)
                      </text>
                      <line x1="50" y1="40" x2="50" y2={svgHeight - 40} stroke="#475569" strokeWidth="1" />
                      <path 
                        d={`M 50 40 Q 52 ${groundY - 50}, ${50 + Math.min(mGrade * 0.0025, 80)} ${groundY} L 50 ${groundY} Z`} 
                        fill={postStatusBg} 
                        stroke={postStatusColor} 
                        strokeWidth="2" 
                      />
                      <rect x={50 + Math.min(mGrade * 0.0025, 80) + 6} y={groundY - 8} width="115" height="18" rx="3" fill="rgba(15,23,42,0.92)" stroke={postStatusColor} strokeWidth="0.8" />
                      <text 
                        x={50 + Math.min(mGrade * 0.0025, 80) + 63} 
                        y={groundY + 4} 
                        fill={postStatusColor} 
                        fontSize="9" 
                        fontWeight="700" 
                        textAnchor="middle"
                        fontFamily="var(--font-mono)"
                      >
                        M_max = {(mGrade / 1000).toFixed(2)} k-ft
                      </text>
                      <rect x="50" y={groundY + 12} width="135" height="18" rx="3" fill="rgba(15,23,42,0.92)" stroke={postStatusBorder} strokeWidth="0.8" />
                      <text 
                        x="117" 
                        y={groundY + 24} 
                        fill={postStatusColor} 
                        fontSize="9" 
                        fontFamily="var(--font-mono)" 
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        fb = {fbActual.toFixed(0)} psi ({isPostFail ? '✗ FAIL' : (isPostWarn ? '⚠ WARN' : '✓ OK')})
                      </text>
                    </g>
                  </g>
                )}
              </svg>
            </div>

            {/* Performance Indicators & Checks Grid (Red/Yellow/Green for every card) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
              
              {/* Embedment Depth Check Card */}
              <div 
                className="glass-card" 
                style={{ 
                  padding: '0.85rem', 
                  borderColor: embedStatusBorder,
                  background: embedStatusBg,
                  boxShadow: isEmbedFail ? '0 0 12px rgba(244, 63, 94, 0.25)' : 'none'
                }}
              >
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Dig Depth (D)
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: embedStatusColor, fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                  {embedment.toFixed(1)}' <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ Req {dReq.toFixed(1)}'</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: embedStatusColor, fontWeight: 600 }}>
                  FS = {fsEmbed.toFixed(2)} • {isEmbedFail ? '✗ TOO SHALLOW (FAIL)' : (isEmbedWarn ? '⚠ MARGINAL' : '✓ CODE ADEQUATE')}
                </div>
              </div>

              {/* Timber Post Bending Stress Card */}
              <div 
                className="glass-card" 
                style={{ 
                  padding: '0.85rem', 
                  borderColor: postStatusBorder,
                  background: postStatusBg,
                  boxShadow: isPostFail ? '0 0 12px rgba(244, 63, 94, 0.25)' : 'none'
                }}
              >
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Post Flexure (fb)
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: postStatusColor, fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                  {fbActual.toFixed(0)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ {fbAllowable} psi</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: postStatusColor, fontWeight: 600 }}>
                  Utilization: {(postRatio * 100).toFixed(0)}% • {isPostFail ? '✗ OVERSTRESSED' : (isPostWarn ? '⚠ WARN' : '✓ PASS')}
                </div>
              </div>

              {/* Timber Lagging Plank Flexure Card */}
              <div 
                className="glass-card" 
                style={{ 
                  padding: '0.85rem', 
                  borderColor: plankStatusBorder,
                  background: plankStatusBg,
                  boxShadow: isPlankFail ? '0 0 12px rgba(244, 63, 94, 0.25)' : 'none'
                }}
              >
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Lagging Planks ({lagging.nominal})
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: plankStatusColor, fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                  {fbPlank.toFixed(0)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ {plankAllowable} psi</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: plankStatusColor, fontWeight: 600 }}>
                  Utilization: {(plankRatio * 100).toFixed(0)}% • {isPlankFail ? '✗ PLANK FAILS' : (isPlankWarn ? '⚠ MARGINAL' : '✓ PLANK OK')}
                </div>
              </div>

            </div>

            {/* Base Moment & Deflection Strip */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
              <div>
                <span className="text-muted">Overturning Moment: </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {(mGrade / 1000).toFixed(2)} kip-ft
                </span>
                <span className="text-muted"> • Base Shear: </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {(pPost / 1000).toFixed(2)} kips
                </span>
              </div>
              <div>
                <span className="text-muted">Top Deflection: </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: deflStatusColor }}>
                  {deltaTopInches.toFixed(2)}" / Allow {deltaAllowableInches.toFixed(2)}" ({isDeflFail ? '✗ EXCEEDS L/150' : '✓ OK'})
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Embedded Generic Problem Viewer (for Exam Problems 102 - 107) */}
      {problem && (
        <GenericProblemViewer problem={problem} />
      )}

      {/* Engineering Derivation Modal */}
      {showDerivation && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }}
          onClick={() => setShowDerivation(false)}
        >
          <div 
            className="glass-panel" 
            style={{
              width: '100%',
              maxWidth: '840px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2.5rem',
              position: 'relative',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📐</span> Complete Wood Retaining Wall Engineering Derivation
                </h3>
                <p className="text-xs text-muted">Earth Pressures, Shallow Dig Engineering, IBC 1807.3 Pole Embedment & NDS Specifications</p>
              </div>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                onClick={() => setShowDerivation(false)}
              >
                ✕ Close
              </button>
            </div>

            {/* Derivation Steps Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              {/* Step 1: Active Earth Pressure Coefficient Ka */}
              <div>
                <h4 style={{ color: 'var(--accent-amber)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 1: Rankine Active Earth Pressure Coefficient (Ka) & Passive Coefficient (Kp)
                </h4>
                <p className="text-sm">
                  For backfill with friction angle φ = {phi}°:
                </p>
                <div className="math-block">
                  Ka = tan²(45° - φ/2) = (1 - sin φ) / (1 + sin φ) = {ka.toFixed(4)}
                  <br />
                  Kp = tan²(45° + φ/2) = (1 + sin φ) / (1 - sin φ) = {kp.toFixed(4)}
                </div>
              </div>

              {/* Step 2: Lateral Thrust Components per Linear Foot */}
              <div>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 2: Lateral Active Thrust & Overturning Moment (per ft of wall)
                </h4>
                <p className="text-sm">
                  Decomposing lateral forces over height H = {height} ft:
                </p>
                <div className="math-block">
                  {hDry > 0 && (
                    <>
                      • Dry Soil: Pa,dry = 0.5 · Ka · γ · h_dry² = 0.5 × {ka.toFixed(3)} × {soil.gammaSoil} × {hDry}² = {paDry.toFixed(1)} lb/ft (arm = {armDry.toFixed(2)} ft)
                      <br />
                    </>
                  )}
                  {!hasDrainage && hw > 0 && (
                    <>
                      • Submerged Soil: Pa,sub = 0.5 · Ka · γ' · hw² + Ka · (γ·h_dry) · hw = {(paSubRect + paSubTri).toFixed(1)} lb/ft (arms = {armSubRect.toFixed(2)} ft and {armSubTri.toFixed(2)} ft)
                      <br />
                      • Hydrostatic Water: Pw = 0.5 · γw · hw² = 0.5 × 62.4 × {hw}² = {pw.toFixed(1)} lb/ft (arm = {armPw.toFixed(2)} ft)
                      <br />
                    </>
                  )}
                  {hasDrainage && (
                    <>
                      • <strong>Perforated Collector Drain Active:</strong> Hydrostatic head relieved (hw = 0, Pw = 0 lb/ft).
                      <br />
                    </>
                  )}
                  {surcharge > 0 && (
                    <>
                      • Surcharge: Pq = Ka · q · H = {ka.toFixed(3)} × {surcharge} × {height} = {paSurcharge.toFixed(1)} lb/ft (arm = {armSurcharge.toFixed(2)} ft)
                      <br />
                    </>
                  )}
                  <strong>Total Thrust: P_total = {pTotalPerFt.toFixed(1)} lb/ft</strong>
                  <br />
                  <strong>Base Moment: M_base = {mTotalPerFt.toFixed(1)} ft-lb/ft</strong>
                </div>
              </div>

              {/* Step 3: Tributary Width Load per Post */}
              <div>
                <h4 style={{ color: 'var(--accent-purple)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 3: Individual Post Tributary Load & Overturning Moment (Spacing S = {spacing} ft)
                </h4>
                <div className="math-block">
                  Raw Cantilever Load: P_post = {rawPPost.toFixed(1)} lb ({(rawPPost / 1000).toFixed(2)} kips)
                  <br />
                  Raw Cantilever Moment: M_grade = {rawMGrade.toFixed(1)} ft-lb ({(rawMGrade / 1000).toFixed(2)} kip-ft)
                  {foundationMethod === 'tieback' && (
                    <>
                      <br />
                      • <strong>Tieback Anchor Reduction:</strong> Tie rod carries T_anchor = {tAnchor.toFixed(0)} lb.
                      <br />
                      • Reduced Base Shear: P_post = {pPost.toFixed(0)} lb • Reduced Moment: M_grade = {mGrade.toFixed(0)} ft-lb (75% drop)
                    </>
                  )}
                  <br />
                  Resultant Height: h_o = M_grade / P_post = {hResultant.toFixed(2)} ft above grade
                </div>
              </div>

              {/* Step 4: Shallow Dig Depth Engineering (Method Comparison) */}
              <div>
                <h4 style={{ color: embedStatusColor, marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 4: Shallow Dig Depth Engineering ({foundationMethod.replace('_', ' ').toUpperCase()})
                </h4>
                <p className="text-sm">
                  Geotechnical embedment calculation to resist lateral overturning:
                </p>
                <div className="math-block">
                  {foundationMethod === 'direct' && (
                    <>
                      • <strong>Direct Soil Burial:</strong> Narrow wood post (b = {bPostFt.toFixed(2)} ft) bears on loose soil.
                      <br />
                      Required Dig Depth: D_req = {dReq.toFixed(1)} ft (Deepest excavation required)
                    </>
                  )}
                  {foundationMethod === 'concrete_pier' && (
                    <>
                      • <strong>Augered Concrete Pier (∅ = {pierDiameter}" = {bPierFt.toFixed(2)} ft):</strong>
                      <br />
                      Increasing width b from {bPostFt.toFixed(2)}' to {bPierFt.toFixed(2)}' quadruples passive resistance!
                      <br />
                      IBC Parameter: A = (2.34 · P) / (S1_eff · b) = (2.34 × {pPost.toFixed(0)}) / ({soil.s1 * 2} × {bPierFt.toFixed(2)}) = {ibcAParam.toFixed(2)} ft
                      <br />
                      Required Dig Depth: D_req = {dReq.toFixed(1)} ft (Slashes dig depth by {Math.round((1 - dReq / (height * 1.15)) * 100)}%!)
                    </>
                  )}
                  {foundationMethod === 'concrete_collar' && (
                    <>
                      • <strong>Ground-Line Restraint Collar (IBC 1807.3.2.2 Constrained):</strong>
                      <br />
                      Formula: d = √[ 4.25 · M_grade / (S3 · b) ] = √[ 4.25 × {mGrade.toFixed(0)} / ({soil.s1 * 2} × {Math.max(bPostFt, 1.25).toFixed(2)}) ]
                      <br />
                      Required Dig Depth: D_req = {dReq.toFixed(1)} ft (Prevents toe translation at surface)
                    </>
                  )}
                  {foundationMethod === 'tieback' && (
                    <>
                      • <strong>Deadman Tieback Anchor:</strong>
                      <br />
                      Post converts from cantilever to propped beam. Base moment drops by 75%.
                      <br />
                      Required Dig Depth: D_req = {dReq.toFixed(1)} ft (Ultra-shallow excavation)
                    </>
                  )}
                  <br />
                  Current Excavated Depth: D = {embedment.toFixed(1)} ft
                  <br />
                  Embedment Factor of Safety: FS = D / D_req = {fsEmbed.toFixed(2)} → {isEmbedFail ? '✗ FAILS (TOO SHALLOW / PULLOUT RISK)' : (isEmbedWarn ? '⚠ MARGINAL' : '✓ CODE ADEQUATE')}
                </div>
              </div>

              {/* Step 5: NDS Wood Design Adjustments */}
              <div>
                <h4 style={{ color: 'var(--accent-emerald)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 5: NDS Allowable Bending Design Value Adjustments (F'b)
                </h4>
                <div className="math-block">
                  F'b = Fb · CD · CM · CL · CF · Ci · Cr
                  <br />
                  • Wet Service Factor (CM): CM = 0.85 (ground contact moist backfill)
                  <br />
                  • Load Duration Factor (CD): CD = 0.90 (permanent continuous earth pressure)
                  <br />
                  Adjusted Allowable Bending Stress: F'b = {fbAllowable} psi
                </div>
              </div>

              {/* Step 6: Wood Post Flexural Stress Check */}
              <div>
                <h4 style={{ color: postStatusColor, marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 6: Timber Post Structural Flexural Check ({post.label})
                </h4>
                <div className="math-block">
                  Section Modulus: Sx = (b · d²) / 6 = ({post.b}" × {post.d}"²) / 6 = {post.sx} in³
                  <br />
                  Actual Bending Stress: fb = (M_grade × 12) / Sx = ({mGrade.toFixed(1)} × 12) / {post.sx} = {fbActual.toFixed(0)} psi
                  <br />
                  Allowable Bending Stress: F'b = {fbAllowable} psi
                  <br />
                  Stress Utilization: fb / F'b = {(postRatio * 100).toFixed(1)}% → {isPostFail ? '✗ FAILS IN FLEXURE (OVERSTRESSED)' : (isPostWarn ? '⚠ CAUTION (MARGINAL CAPACITY)' : '✓ PASSES IN FLEXURE')}
                </div>
              </div>

              {/* Step 7: Horizontal Timber Lagging Flexure & Soil Arching */}
              <div>
                <h4 style={{ color: plankStatusColor, marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 7: Horizontal Timber Lagging Thickness & Soil Arching (AASHTO / FHWA)
                </h4>
                <div className="math-block">
                  Max Lateral Pressure at Base: p_max = {sigmaHMax.toFixed(1)} psf
                  <br />
                  Arching Moment: M_plank = (p_max · S²) / 10 = ({sigmaHMax.toFixed(1)} × {spacing}²) / 10 = {mPlank.toFixed(1)} ft-lb/ft ({ (mPlank * 12).toFixed(0) } in-lb/ft)
                  <br />
                  Plank Section Modulus (t = {lagging.actual}" actual): Sx = (12 × {lagging.actual}²) / 6 = {sxPlank.toFixed(2)} in³/ft
                  <br />
                  Actual Plank Bending Stress: fb = {fbPlank.toFixed(0)} psi / Allowable {plankAllowable} psi
                  <br />
                  Lagging Compliance: {(plankRatio * 100).toFixed(0)}% → {isPlankFail ? '✗ FAILS (BOARDS WILL BOW & SNAP)' : (isPlankWarn ? '⚠ MARGINAL' : '✓ LAGGING PASSES')}
                </div>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default WoodRetainingWallVisualizer;
