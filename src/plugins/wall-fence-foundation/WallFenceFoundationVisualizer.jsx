import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

// ─────────────────────────────────────────────────────────────────────────
// Material & Soil Reference Data
// ─────────────────────────────────────────────────────────────────────────

const GAMMA_W = 62.4; // pcf

const SOIL_TYPES = {
  soft_clay: {
    name: 'Soft Clay', phi: 0, cohesion: 300, gammaSoil: 100, gammaSat: 112, s1: 70,
    badgeColor: '#ef4444', description: 'Saturated low-strength cohesive soil (undrained, φ=0).'
  },
  stiff_clay: {
    name: 'Stiff Clay', phi: 0, cohesion: 1000, gammaSoil: 115, gammaSat: 125, s1: 150,
    badgeColor: '#f97316', description: 'Firm cohesive soil with high undrained shear strength.'
  },
  silt: {
    name: 'Sandy Silt', phi: 26, cohesion: 100, gammaSoil: 110, gammaSat: 122, s1: 100,
    badgeColor: '#eab308', description: 'Fine-grained, moisture-sensitive transitional soil.'
  },
  loose_sand: {
    name: 'Loose Sand', phi: 28, cohesion: 0, gammaSoil: 105, gammaSat: 118, s1: 100,
    badgeColor: '#84cc16', description: 'Loosely packed granular soil, low relative density.'
  },
  medium_sand: {
    name: 'Medium Dense Sand', phi: 32, cohesion: 0, gammaSoil: 115, gammaSat: 125, s1: 150,
    badgeColor: '#22c55e', description: 'Well-compacted granular backfill; common design case.'
  },
  dense_sand: {
    name: 'Dense Sand / Gravel', phi: 38, cohesion: 0, gammaSoil: 125, gammaSat: 135, s1: 200,
    badgeColor: '#0ea5e9', description: 'Highly compacted granular soil or gravel; high frictional strength.'
  }
};

// Solid timber posts, section properties per NDS
const WOOD_POSTS = {
  '4x4': { label: '4×4 (3.5"×3.5")', sx: 7.15, area: 12.25, fbAllowable: 1350 },
  '6x6': { label: '6×6 (5.5"×5.5")', sx: 27.73, area: 30.25, fbAllowable: 1350 },
  '8x8': { label: '8×8 (7.5"×7.5")', sx: 70.31, area: 56.25, fbAllowable: 1350 }
};

// Pultruded FRP square tube posts (computed section properties: I=(a⁴-(a-2t)⁴)/12, Sx=I/(a/2))
const FRP_POSTS = {
  '4x4': { label: '4"×4"×¼" FRP Tube', sx: 4.41, area: 3.75, fbAllowable: 15000 },
  '6x6': { label: '6"×6"×⅜" FRP Tube', sx: 14.90, area: 8.44, fbAllowable: 15000 },
  '8x8': { label: '8"×8"×½" FRP Tube', sx: 35.31, area: 15.0, fbAllowable: 15000 }
};

const FV_WOOD = 175; // psi, allowable shear
const FV_FRP = 4500; // psi, representative pultruded FRP allowable shear
const WOOD_UNIT_WEIGHT = 35; // pcf, treated timber
const FRP_UNIT_WEIGHT = 95; // pcf, pultruded FRP composite

const CONCRETE_FC = 4000; // psi
const CONCRETE_UNIT_WEIGHT = 150; // pcf

const SHAFT_WIDTH_IN = 3.5; // representative helical pile square shaft width, in

const MATERIALS = {
  concrete: { name: 'Concrete', icon: '🧱', color: '#94a3b8' },
  wood: { name: 'Wood', icon: '🪵', color: 'var(--accent-amber)' },
  fiberglass: { name: 'Fiberglass (FRP)', icon: '🧬', color: 'var(--accent-cyan)' }
};

const COLOR_FAIL = '#f43f5e';
const COLOR_WARN = '#f59e0b';
const COLOR_SAFE = '#10b981';
const BG_FAIL = 'rgba(244, 63, 94, 0.16)';
const BG_WARN = 'rgba(245, 158, 11, 0.16)';
const BG_SAFE = 'rgba(16, 185, 129, 0.14)';
const BORDER_FAIL = 'rgba(244, 63, 94, 0.55)';
const BORDER_WARN = 'rgba(245, 158, 11, 0.55)';
const BORDER_SAFE = 'rgba(16, 185, 129, 0.45)';

function fsStatus(fs, target) {
  if (!isFinite(fs) || fs >= target * 1.15) return { color: COLOR_SAFE, bg: BG_SAFE, border: BORDER_SAFE, label: 'OK' };
  if (fs >= target) return { color: COLOR_WARN, bg: BG_WARN, border: BORDER_WARN, label: 'MARGINAL' };
  return { color: COLOR_FAIL, bg: BG_FAIL, border: BORDER_FAIL, label: 'FAIL' };
}

function ratioStatus(ratio) {
  if (ratio > 1.0) return { color: COLOR_FAIL, bg: BG_FAIL, border: BORDER_FAIL, label: 'FAIL' };
  if (ratio > 0.85) return { color: COLOR_WARN, bg: BG_WARN, border: BORDER_WARN, label: 'MARGINAL' };
  return { color: COLOR_SAFE, bg: BG_SAFE, border: BORDER_SAFE, label: 'OK' };
}

// ─────────────────────────────────────────────────────────────────────────
// Pure calculation engine (module-scope so it can also be reused by the
// embedment auto-size search without re-running React state updates)
// ─────────────────────────────────────────────────────────────────────────
function computeWallCalcs({
  material, height, spacing, soil, surcharge, waterHeight,
  postSizeKey, concThickness, helixDiameter, numPiles, pileSpacing, pileEmbedment
}) {
  const phiRad = (soil.phi * Math.PI) / 180;
  // For φ=0 (undrained clay), the literal Rankine formula degenerates to Ka=1,
  // which overstates lateral pressure. Use the standard equivalent-fluid-pressure
  // approximation instead (Ka·γ ≈ 40 pcf), matching the convention already used
  // elsewhere in this app for clay backfill.
  const ka = soil.phi > 0 ? (1 - Math.sin(phiRad)) / (1 + Math.sin(phiRad)) : (40 / soil.gammaSoil);
  const kp = soil.phi > 0 ? (1 + Math.sin(phiRad)) / (1 - Math.sin(phiRad)) : 1.0;

  const hw = Math.min(Math.max(waterHeight, 0), height);
  const hDry = Math.max(0, height - hw);
  const gammaPrime = Math.max(soil.gammaSat - GAMMA_W, 10);

  // ── Lateral earth pressure force components (per ft of wall) ────────────
  let pa1 = 0, armPa1 = 0;
  if (hDry > 0) {
    pa1 = 0.5 * ka * soil.gammaSoil * hDry * hDry;
    armPa1 = hw + hDry / 3;
  }
  let pa2Rect = 0, armPa2Rect = 0;
  if (hw > 0 && hDry > 0) {
    const qDry = soil.gammaSoil * hDry;
    pa2Rect = ka * qDry * hw;
    armPa2Rect = hw / 2;
  }
  let pa2Tri = 0, armPa2Tri = 0;
  if (hw > 0) {
    pa2Tri = 0.5 * ka * gammaPrime * hw * hw;
    armPa2Tri = hw / 3;
  }
  const pSurcharge = ka * surcharge * height;
  const armSurcharge = height / 2;
  const pWater = hw > 0 ? 0.5 * GAMMA_W * hw * hw : 0;
  const armWater = hw / 3;

  const pTotalPerFt = pa1 + pa2Rect + pa2Tri + pSurcharge + pWater;
  const mTotalPerFt =
    pa1 * armPa1 + pa2Rect * armPa2Rect + pa2Tri * armPa2Tri +
    pSurcharge * armSurcharge + pWater * armWater;

  const V = pTotalPerFt * spacing; // lb, shear demand at grade for this support
  const M = mTotalPerFt * spacing; // ft-lb, moment demand at grade for this support
  const resultantHeight = V > 0 ? mTotalPerFt / pTotalPerFt : 0; // ft above grade

  // ── Above-grade material structural check (post/panel flexure & shear) ──
  let sx, area, fbAllow, fvAllow, selfWeight, sectionLabel;
  if (material === 'wood') {
    const post = WOOD_POSTS[postSizeKey] || WOOD_POSTS['6x6'];
    sx = post.sx; area = post.area; fbAllow = post.fbAllowable; fvAllow = FV_WOOD;
    selfWeight = (area / 144) * height * WOOD_UNIT_WEIGHT;
    sectionLabel = post.label;
  } else if (material === 'fiberglass') {
    const post = FRP_POSTS[postSizeKey] || FRP_POSTS['6x6'];
    sx = post.sx; area = post.area; fbAllow = post.fbAllowable; fvAllow = FV_FRP;
    selfWeight = (area / 144) * height * FRP_UNIT_WEIGHT;
    sectionLabel = post.label;
  } else {
    const tFt = concThickness / 12;
    sx = (spacing * 12) * (concThickness * concThickness) / 6; // in^3, per tributary width
    area = spacing * 12 * concThickness; // in^2
    const fr = 7.5 * Math.sqrt(CONCRETE_FC);
    fbAllow = 0.4 * fr; // simplified plain-concrete allowable flexural stress
    fvAllow = 1.1 * Math.sqrt(CONCRETE_FC);
    selfWeight = spacing * height * tFt * CONCRETE_UNIT_WEIGHT;
    sectionLabel = `${concThickness}" Concrete Panel`;
  }
  const fbActual = (M * 12) / sx;
  const fvActual = (1.5 * V) / area;
  const materialRatio = fbActual / fbAllow;

  // ── Helical pile axial capacity (bearing-capacity method) ────────────────
  const belowGradeSaturated = hw > 0;
  const gammaBelow = belowGradeSaturated ? gammaPrime : soil.gammaSoil;
  const sigmaVTip = surcharge + gammaBelow * pileEmbedment;

  const Nq = soil.phi > 0
    ? Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2)
    : 1.0;
  const Nc = soil.phi > 0 ? (Nq - 1) / Math.tan(phiRad) : 5.14;

  const qUlt = soil.cohesion * Nc + sigmaVTip * Nq; // psf
  const aHelix = (Math.PI / 4) * Math.pow(helixDiameter / 12, 2); // ft^2
  const qUltCompression = aHelix * qUlt; // lb
  const qUltUplift = 0.75 * qUltCompression; // lb, simplified uplift reduction

  // Simplified passive-pressure lateral capacity of a single embedded pile shaft
  const bShaftFt = SHAFT_WIDTH_IN / 12;
  const qLatPerPile = 0.5 * kp * gammaBelow * pileEmbedment * pileEmbedment * bShaftFt; // lb

  let fsOverturning, fsPileBearing, pileCompDemand, pileUpliftDemand = 0, arm = 0;

  if (numPiles <= 1) {
    // Single pile: moment resisted by soil passive pressure along the shaft
    // (triangular distribution resultant acts at 2D/3 below grade)
    const mCapacitySingle = qLatPerPile * (2 * pileEmbedment / 3);
    fsOverturning = M > 0 ? mCapacitySingle / M : 999;
    pileCompDemand = selfWeight;
    fsPileBearing = qUltCompression / Math.max(pileCompDemand, 1);
  } else {
    arm = numPiles === 2 ? pileSpacing : 2 * pileSpacing;
    const tMoment = arm > 0 ? M / arm : 0;
    const vShare = selfWeight / numPiles;
    pileCompDemand = vShare + tMoment;
    pileUpliftDemand = Math.max(0, tMoment - vShare);

    const mResistGroup = (qUltCompression + qUltUplift) * arm;
    fsOverturning = M > 0 ? mResistGroup / M : 999;

    const fsComp = qUltCompression / Math.max(pileCompDemand, 1);
    const fsUplift = pileUpliftDemand > 0 ? qUltUplift / pileUpliftDemand : 999;
    fsPileBearing = Math.min(fsComp, fsUplift);
  }

  const fsSliding = V > 0 ? (numPiles * qLatPerPile) / V : 999;

  return {
    ka, kp, hw, hDry, gammaPrime,
    pa1, pa2Rect, pa2Tri, pSurcharge, pWater, pTotalPerFt, mTotalPerFt,
    V, M, resultantHeight,
    sx, area, fbAllow, fvAllow, fbActual, fvActual, materialRatio, sectionLabel, selfWeight,
    belowGradeSaturated, gammaBelow, sigmaVTip, Nq, Nc, qUlt, aHelix, qUltCompression, qUltUplift,
    qLatPerPile, arm, pileCompDemand, pileUpliftDemand,
    fsSliding, fsOverturning, fsPileBearing
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────
const WallFenceFoundationVisualizer = ({ problem }) => {
  const [material, setMaterial] = useState(problem?.material || 'concrete');
  const [height, setHeight] = useState(problem?.height ?? 6); // ft
  const [spacing, setSpacing] = useState(problem?.spacing ?? 6); // ft, tributary width per support
  const [soilTypeKey, setSoilTypeKey] = useState(problem?.soilType || 'medium_sand');
  const [surcharge, setSurcharge] = useState(problem?.surcharge ?? 100); // psf
  const [waterHeight, setWaterHeight] = useState(problem?.waterHeight ?? 0); // ft above base
  const [postSizeKey, setPostSizeKey] = useState(problem?.postSize || '6x6');
  const [concThickness, setConcThickness] = useState(problem?.concThickness ?? 6); // in
  const [helixDiameter, setHelixDiameter] = useState(problem?.helixDiameter ?? 12); // in
  const [numPiles, setNumPiles] = useState(problem?.numPiles ?? 2);
  const [pileSpacing, setPileSpacing] = useState(problem?.pileSpacing ?? 3); // ft
  const [pileEmbedment, setPileEmbedment] = useState(problem?.pileEmbedment ?? 8); // ft
  const [fsMode, setFsMode] = useState(problem?.fsMode || 'fixed'); // 'fixed' | 'uniform'
  const [uniformFsTarget, setUniformFsTarget] = useState(2.0);
  const [showDerivation, setShowDerivation] = useState(false);

  const [prevProblem, setPrevProblem] = useState(problem);
  if (problem && problem !== prevProblem) {
    setPrevProblem(problem);
    if (problem.material !== undefined) setMaterial(problem.material);
    if (problem.height !== undefined) setHeight(problem.height);
    if (problem.spacing !== undefined) setSpacing(problem.spacing);
    if (problem.soilType !== undefined) setSoilTypeKey(problem.soilType);
    if (problem.surcharge !== undefined) setSurcharge(problem.surcharge);
    setWaterHeight(problem.waterHeight ?? 0);
    if (problem.postSize !== undefined) setPostSizeKey(problem.postSize);
    if (problem.concThickness !== undefined) setConcThickness(problem.concThickness);
    if (problem.helixDiameter !== undefined) setHelixDiameter(problem.helixDiameter);
    if (problem.numPiles !== undefined) setNumPiles(problem.numPiles);
    if (problem.pileSpacing !== undefined) setPileSpacing(problem.pileSpacing);
    if (problem.pileEmbedment !== undefined) setPileEmbedment(problem.pileEmbedment);
  }

  const soil = SOIL_TYPES[soilTypeKey] || SOIL_TYPES.medium_sand;

  const calcs = useMemo(() => computeWallCalcs({
    material, height, spacing, soil, surcharge, waterHeight,
    postSizeKey, concThickness, helixDiameter, numPiles, pileSpacing, pileEmbedment
  }), [material, height, spacing, soil, surcharge, waterHeight, postSizeKey, concThickness, helixDiameter, numPiles, pileSpacing, pileEmbedment]);

  const targets = fsMode === 'uniform'
    ? { sliding: uniformFsTarget, overturning: uniformFsTarget, pile: uniformFsTarget }
    : { sliding: 1.5, overturning: 2.0, pile: 3.0 };

  const slidingStatus = fsStatus(calcs.fsSliding, targets.sliding);
  const overturningStatus = fsStatus(calcs.fsOverturning, targets.overturning);
  const pileStatus = fsStatus(calcs.fsPileBearing, targets.pile);
  const materialStatus = ratioStatus(calcs.materialRatio);

  const handleAutoEmbed = () => {
    let d = 3;
    for (; d <= 40; d += 0.25) {
      const c = computeWallCalcs({
        material, height, spacing, soil, surcharge, waterHeight,
        postSizeKey, concThickness, helixDiameter, numPiles, pileSpacing, pileEmbedment: d
      });
      if (c.fsSliding >= targets.sliding && c.fsOverturning >= targets.overturning && c.fsPileBearing >= targets.pile) break;
    }
    setPileEmbedment(Math.min(d, 40));
  };

  // ── SVG geometry ──────────────────────────────────────────────────────
  const svgW = 620, svgH = 460;
  const groundY = 250;
  const wallCenterX = 350;
  const wallHalfW = 15;
  const aboveScale = Math.min(160 / Math.max(height, 3), 26);
  const belowScale = Math.min(150 / Math.max(pileEmbedment, 3), 20);

  const wallTopY = groundY - height * aboveScale;
  const backfillRight = svgW - 30;
  const waterY = groundY - calcs.hw * aboveScale;
  const resultantY = groundY - Math.min(calcs.resultantHeight, height) * aboveScale;
  const embedBottomY = groundY + pileEmbedment * belowScale;

  const materialFill = material === 'concrete' ? 'rgba(148, 163, 184, 0.35)'
    : material === 'wood' ? 'rgba(180, 120, 60, 0.4)'
    : 'rgba(103, 232, 249, 0.25)';
  const materialStroke = material === 'concrete' ? '#94a3b8'
    : material === 'wood' ? '#b4783c'
    : '#67e8f9';

  const pileXs = [];
  if (numPiles <= 1) {
    pileXs.push(wallCenterX);
  } else if (numPiles === 2) {
    const half = (pileSpacing * belowScale) / 2;
    pileXs.push(wallCenterX - half, wallCenterX + half);
  } else {
    const s = pileSpacing * belowScale;
    pileXs.push(wallCenterX - s, wallCenterX, wallCenterX + s);
  }

  const surchargeArrows = surcharge > 0 ? [0.15, 0.35, 0.55, 0.75].map(f => wallCenterX + wallHalfW + 8 + f * (backfillRight - wallCenterX - wallHalfW - 16)) : [];

  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel">

        {/* ── Header & Material Selector ─────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.35rem' }}>Wall / Fence & Helical Pile Foundation Designer</h3>
            <p className="text-xs text-muted">Rankine Lateral Earth Pressure · Pore Pressure · Helical Pile Moment-Couple Foundation</p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {Object.entries(MATERIALS).map(([key, m]) => (
              <button
                key={key}
                className="btn-secondary"
                style={{
                  padding: '0.5rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: material === key ? `${m.color}22` : 'rgba(255,255,255,0.03)',
                  borderColor: material === key ? m.color : 'var(--border-color)',
                  color: material === key ? m.color : 'var(--text-dim)'
                }}
                onClick={() => setMaterial(key)}
              >
                {m.icon} {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI / Safety Factor Cards ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Sliding / Lateral FS', val: calcs.fsSliding, target: targets.sliding, status: slidingStatus, sub: `V = ${calcs.V.toFixed(0)} lb` },
            { label: 'Overturning FS', val: calcs.fsOverturning, target: targets.overturning, status: overturningStatus, sub: `M = ${calcs.M.toFixed(0)} ft-lb` },
            { label: 'Pile Bearing / Pullout FS', val: calcs.fsPileBearing, target: targets.pile, status: pileStatus, sub: `Qult = ${(calcs.qUltCompression / 1000).toFixed(1)}k / pile` }
          ].map((k, i) => (
            <div key={i} style={{ background: k.status.bg, border: `1px solid ${k.status.border}`, borderRadius: '10px', padding: '0.75rem 0.85rem' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>{k.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: k.status.color, fontFamily: 'var(--font-mono)' }}>
                {isFinite(k.val) ? k.val.toFixed(2) : '—'} <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>(req ≥ {k.target.toFixed(1)})</span>
              </div>
              <div style={{ fontSize: '0.65rem', color: k.status.color, marginTop: '0.15rem' }}>{k.status.label} · {k.sub}</div>
            </div>
          ))}
          <div style={{ background: materialStatus.bg, border: `1px solid ${materialStatus.border}`, borderRadius: '10px', padding: '0.75rem 0.85rem' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>{calcs.sectionLabel} Stress Ratio</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: materialStatus.color, fontFamily: 'var(--font-mono)' }}>
              {calcs.materialRatio.toFixed(2)} <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>(fb/Fb ≤ 1.0)</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: materialStatus.color, marginTop: '0.15rem' }}>{materialStatus.label} · fb = {calcs.fbActual.toFixed(0)} psi</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── Controls ─────────────────────────────────────────────── */}
          <div className="visualizer-controls" style={{ minWidth: '280px', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Wall / Fence Height (H)</label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>{height.toFixed(1)} ft</span>
              </div>
              <input type="range" min="3" max="16" step="0.5" value={height} onChange={(e) => setHeight(parseFloat(e.target.value))} />
            </div>

            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Support Spacing (S)</label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>{spacing.toFixed(1)} ft</span>
              </div>
              <input type="range" min="3" max="10" step="0.5" value={spacing} onChange={(e) => setSpacing(parseFloat(e.target.value))} />
            </div>

            {material !== 'concrete' && (
              <div className="control-group">
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                  {material === 'wood' ? 'Timber Post Size' : 'FRP Post Section'}
                </label>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {Object.keys(material === 'wood' ? WOOD_POSTS : FRP_POSTS).map((key) => (
                    <button key={key} className="btn-secondary" style={{
                      flex: 1, padding: '0.4rem 0.2rem', fontSize: '0.68rem', fontWeight: 700,
                      background: postSizeKey === key ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                      borderColor: postSizeKey === key ? 'var(--accent-blue)' : 'var(--border-color)',
                      color: postSizeKey === key ? 'var(--accent-blue)' : 'var(--text-dim)'
                    }} onClick={() => setPostSizeKey(key)}>{key}</button>
                  ))}
                </div>
              </div>
            )}

            {material === 'concrete' && (
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Concrete Thickness</label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#94a3b8' }}>{concThickness} in</span>
                </div>
                <input type="range" min="4" max="10" step="1" value={concThickness} onChange={(e) => setConcThickness(parseFloat(e.target.value))} />
              </div>
            )}

            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Soil Condition</label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: soil.badgeColor, fontSize: '0.75rem' }}>{soil.name}</span>
              </div>
              <select value={soilTypeKey} onChange={(e) => setSoilTypeKey(e.target.value)} style={{
                width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                color: 'var(--text-main)', fontSize: '0.78rem'
              }}>
                {Object.entries(SOIL_TYPES).map(([key, s]) => (
                  <option key={key} value={key}>{s.name} (φ={s.phi}°, c={s.cohesion}psf)</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Surcharge (q)</label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)' }}>{surcharge} psf</span>
              </div>
              <input type="range" min="0" max="500" step="25" value={surcharge} onChange={(e) => setSurcharge(parseFloat(e.target.value))} />
            </div>

            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Water Height (hw, from base)</label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{waterHeight.toFixed(1)} ft</span>
              </div>
              <input type="range" min="0" max={height} step="0.5" value={Math.min(waterHeight, height)} onChange={(e) => setWaterHeight(parseFloat(e.target.value))} />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', marginBottom: '0.6rem' }}>⚙ Helical Pile Foundation</h4>

              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Helix Diameter</label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>{helixDiameter}"</span>
                </div>
                <input type="range" min="8" max="16" step="2" value={helixDiameter} onChange={(e) => setHelixDiameter(parseFloat(e.target.value))} />
              </div>

              <div className="control-group" style={{ marginTop: '0.7rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Number of Piles / Support</label>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} className="btn-secondary" style={{
                      flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 700,
                      background: numPiles === n ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                      borderColor: numPiles === n ? 'var(--accent-emerald)' : 'var(--border-color)',
                      color: numPiles === n ? 'var(--accent-emerald)' : 'var(--text-dim)'
                    }} onClick={() => setNumPiles(n)}>{n} Pile{n > 1 ? 's' : ''}</button>
                  ))}
                </div>
              </div>

              {numPiles >= 2 && (
                <div className="control-group" style={{ marginTop: '0.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Pile Spacing</label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>{pileSpacing.toFixed(1)} ft</span>
                  </div>
                  <input type="range" min="2" max="6" step="0.5" value={pileSpacing} onChange={(e) => setPileSpacing(parseFloat(e.target.value))} />
                </div>
              )}

              <div className="control-group" style={{ marginTop: '0.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>Embedment Depth (D)</label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>{pileEmbedment.toFixed(1)} ft</span>
                </div>
                <input type="range" min="3" max="30" step="0.5" value={pileEmbedment} onChange={(e) => setPileEmbedment(parseFloat(e.target.value))} />
                <button className="btn-secondary" style={{ width: '100%', marginTop: '0.4rem', padding: '0.35rem', fontSize: '0.7rem' }} onClick={handleAutoEmbed}>
                  ⚡ Auto-Size Depth to Meet Targets
                </button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
              <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>Safety Factor Mode</label>
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
                <button className="btn-secondary" style={{
                  flex: 1, padding: '0.4rem', fontSize: '0.7rem', fontWeight: 700,
                  background: fsMode === 'fixed' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                  borderColor: fsMode === 'fixed' ? 'var(--accent-blue)' : 'var(--border-color)',
                  color: fsMode === 'fixed' ? 'var(--accent-blue)' : 'var(--text-dim)'
                }} onClick={() => setFsMode('fixed')}>Fixed (1.5/2.0/3.0)</button>
                <button className="btn-secondary" style={{
                  flex: 1, padding: '0.4rem', fontSize: '0.7rem', fontWeight: 700,
                  background: fsMode === 'uniform' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                  borderColor: fsMode === 'uniform' ? 'var(--accent-blue)' : 'var(--border-color)',
                  color: fsMode === 'uniform' ? 'var(--accent-blue)' : 'var(--text-dim)'
                }} onClick={() => setFsMode('uniform')}>Uniform Target</button>
              </div>
              {fsMode === 'uniform' && (
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[1.5, 2.0, 3.0].map(t => (
                    <button key={t} className="btn-secondary" style={{
                      flex: 1, padding: '0.35rem', fontSize: '0.72rem', fontWeight: 700,
                      background: uniformFsTarget === t ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.03)',
                      borderColor: uniformFsTarget === t ? 'var(--accent-amber)' : 'var(--border-color)',
                      color: uniformFsTarget === t ? 'var(--accent-amber)' : 'var(--text-dim)'
                    }} onClick={() => setUniformFsTarget(t)}>FS {t.toFixed(1)}</button>
                  ))}
                </div>
              )}
            </div>

            <button className="solution-btn" onClick={() => setShowDerivation(true)}>
              📐 Show Step-by-Step Derivation
            </button>
          </div>

          {/* ── SVG Diagram ──────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: '320px', background: 'rgba(6, 11, 22, 0.6)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '0.75rem' }}>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
              <defs>
                <linearGradient id="wf-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(15,23,42,0.2)" />
                  <stop offset="100%" stopColor="rgba(2,8,18,0.6)" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width={svgW} height={groundY} fill="url(#wf-sky)" />

              {/* Below-grade soil */}
              <rect x="0" y={groundY} width={svgW} height={svgH - groundY} fill={calcs.belowGradeSaturated ? 'rgba(30, 64, 105, 0.35)' : 'rgba(120, 53, 15, 0.28)'} />

              {/* Backfill (retained soil), right side, above grade */}
              <rect x={wallCenterX + wallHalfW} y={wallTopY} width={backfillRight - (wallCenterX + wallHalfW)} height={groundY - wallTopY} fill="rgba(120, 53, 15, 0.35)" stroke="rgba(146,64,14,0.5)" />

              {/* Water table */}
              {calcs.hw > 0 && (
                <>
                  <rect x={wallCenterX + wallHalfW} y={waterY} width={backfillRight - (wallCenterX + wallHalfW)} height={groundY - waterY} fill="rgba(56,189,248,0.18)" />
                  <line x1={wallCenterX + wallHalfW} y1={waterY} x2={backfillRight} y2={waterY} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5,3" />
                  <text x={backfillRight - 2} y={waterY - 5} fill="#38bdf8" fontSize="10" textAnchor="end" fontFamily="var(--font-mono)">▽ hw = {calcs.hw.toFixed(1)}'</text>
                </>
              )}

              {/* Surcharge arrows */}
              {surchargeArrows.map((x, i) => (
                <line key={i} x1={x} y1={wallTopY - 22} x2={x} y2={wallTopY - 3} stroke="var(--accent-amber)" strokeWidth="2" markerEnd="url(#wf-arrow-amber)" />
              ))}
              {surcharge > 0 && (
                <text x={(wallCenterX + wallHalfW + backfillRight) / 2} y={wallTopY - 28} fill="var(--accent-amber)" fontSize="10.5" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">q = {surcharge} psf</text>
              )}

              <defs>
                <marker id="wf-arrow-amber" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent-amber)" />
                </marker>
                <marker id="wf-arrow-red" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto">
                  <path d="M0,0 L9,4.5 L0,9 Z" fill="#f43f5e" />
                </marker>
              </defs>

              {/* Wall / Fence element above grade */}
              <rect x={wallCenterX - wallHalfW} y={wallTopY} width={wallHalfW * 2} height={groundY - wallTopY} fill={materialFill} stroke={materialStroke} strokeWidth="2" />
              <text x={wallCenterX} y={wallTopY - 8} fill={materialStroke} fontSize="10.5" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">{calcs.sectionLabel}</text>

              {/* Resultant lateral force arrow */}
              {calcs.V > 0 && (
                <>
                  <line x1={wallCenterX + wallHalfW + 55} y1={resultantY} x2={wallCenterX + wallHalfW + 4} y2={resultantY} stroke="#f43f5e" strokeWidth="2.5" markerEnd="url(#wf-arrow-red)" />
                  <text x={wallCenterX + wallHalfW + 58} y={resultantY + 4} fill="#f43f5e" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)">P={calcs.V.toFixed(0)}#</text>
                </>
              )}

              {/* Grade line */}
              <line x1="0" y1={groundY} x2={svgW} y2={groundY} stroke="#92400e" strokeWidth="2.5" />
              <text x="8" y={groundY - 6} fill="#94a3b8" fontSize="9.5" fontFamily="var(--font-mono)">GRADE</text>

              {/* Helical piles */}
              {pileXs.map((px, i) => (
                <g key={i}>
                  <line x1={px} y1={groundY} x2={px} y2={embedBottomY} stroke="#cbd5e1" strokeWidth="2.5" />
                  <ellipse cx={px} cy={embedBottomY} rx="13" ry="4" fill="none" stroke="var(--accent-emerald)" strokeWidth="2" />
                  <ellipse cx={px} cy={embedBottomY - 6} rx="9" ry="3" fill="none" stroke="var(--accent-emerald)" strokeWidth="1.5" opacity="0.7" />
                </g>
              ))}
              <text x={wallCenterX} y={embedBottomY + 18} fill="var(--accent-emerald)" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                {numPiles}× ⌀{helixDiameter}" Helix @ D={pileEmbedment.toFixed(1)}'
              </text>

              {/* Height dimension */}
              <line x1={wallCenterX - 90} y1={wallTopY} x2={wallCenterX - 90} y2={groundY} stroke="#64748b" strokeWidth="1" strokeDasharray="3,2" />
              <text x={wallCenterX - 95} y={(wallTopY + groundY) / 2} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="var(--font-mono)">H={height.toFixed(1)}'</text>

              {/* Pile spacing dimension */}
              {numPiles >= 2 && (
                <>
                  <line x1={pileXs[0]} y1={embedBottomY + 30} x2={pileXs[pileXs.length - 1]} y2={embedBottomY + 30} stroke="#64748b" strokeWidth="1" strokeDasharray="3,2" />
                  <text x={wallCenterX} y={embedBottomY + 43} fill="#94a3b8" fontSize="9.5" textAnchor="middle" fontFamily="var(--font-mono)">arm = {calcs.arm.toFixed(1)} ft</text>
                </>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* Embedded Generic Guidance Drawer */}
      {problem && (
        <GenericProblemViewer problem={problem} key={problem.id} />
      )}

      {/* Step-by-Step Derivation Modal */}
      {showDerivation && createPortal(
        <div className="modal-overlay" onClick={() => setShowDerivation(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>{MATERIALS[material].icon}</span>
                <div>
                  <h3 style={{ fontSize: '1.4rem' }}>{MATERIALS[material].name} Wall/Fence on Helical Piles — Derivation</h3>
                  <p className="text-xs text-muted">Rankine Active Pressure · Effective Stress · Bearing-Capacity Pile Method</p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowDerivation(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', lineHeight: '1.6' }}>

              <div>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.4rem', fontSize: '1rem' }}>Step 1: Rankine Active Pressure Coefficient</h4>
                <div className="math-block" style={{ whiteSpace: 'pre-line' }}>
                  Ka = (1 - sinφ) / (1 + sinφ) = {calcs.ka.toFixed(3)}  [φ = {soil.phi}°, {soil.name}]
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.4rem', fontSize: '1rem' }}>Step 2: Lateral Force Components per Foot of Wall</h4>
                <div className="math-block" style={{ whiteSpace: 'pre-line' }}>
                  Dry soil (upper {calcs.hDry.toFixed(1)} ft): Pa1 = ½·Ka·γ·hDry² = {calcs.pa1.toFixed(0)} lb/ft{'\n'}
                  Submerged overburden rectangle: Pa2r = Ka·(γ·hDry)·hw = {calcs.pa2Rect.toFixed(0)} lb/ft{'\n'}
                  Submerged buoyant triangle: Pa2t = ½·Ka·γ'·hw² = {calcs.pa2Tri.toFixed(0)} lb/ft{'\n'}
                  Surcharge: Pq = Ka·q·H = {calcs.pSurcharge.toFixed(0)} lb/ft{'\n'}
                  Pore water (hydrostatic): Pw = ½·γw·hw² = {calcs.pWater.toFixed(0)} lb/ft
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-emerald)', marginBottom: '0.4rem', fontSize: '1rem' }}>Step 3: Total Demand at This Support (tributary S = {spacing.toFixed(1)} ft)</h4>
                <div className="math-block" style={{ whiteSpace: 'pre-line' }}>
                  V = ΣP · S = {calcs.pTotalPerFt.toFixed(0)} lb/ft × {spacing.toFixed(1)} ft = {calcs.V.toFixed(0)} lb{'\n'}
                  M = ΣP·arm · S = {calcs.M.toFixed(0)} ft-lb  (resultant acts {calcs.resultantHeight.toFixed(2)} ft above grade)
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-amber)', marginBottom: '0.4rem', fontSize: '1rem' }}>Step 4: {calcs.sectionLabel} Structural Check</h4>
                <div className="math-block" style={{ whiteSpace: 'pre-line' }}>
                  fb = M·12 / Sx = {calcs.M.toFixed(0)}×12 / {calcs.sx.toFixed(2)} = {calcs.fbActual.toFixed(0)} psi{'\n'}
                  Fb,allow = {calcs.fbAllow.toFixed(0)} psi → Ratio = {calcs.materialRatio.toFixed(2)} ({materialStatus.label})
                </div>
              </div>

              <div>
                <h4 style={{ color: '#0ea5e9', marginBottom: '0.4rem', fontSize: '1rem' }}>Step 5: Helical Pile Bearing Capacity (per pile, ⌀{helixDiameter}")</h4>
                <div className="math-block" style={{ whiteSpace: 'pre-line' }}>
                  σ'v at tip = q + γ{calcs.belowGradeSaturated ? "'" : ''}·D = {calcs.sigmaVTip.toFixed(0)} psf{'\n'}
                  Nq = {calcs.Nq.toFixed(2)}, Nc = {calcs.Nc.toFixed(2)}{'\n'}
                  qult = c·Nc + σ'v·Nq = {calcs.qUlt.toFixed(0)} psf{'\n'}
                  Ahelix = π/4·D² = {calcs.aHelix.toFixed(3)} ft²{'\n'}
                  Qult,compression = Ahelix·qult = {calcs.qUltCompression.toFixed(0)} lb ({(calcs.qUltCompression/1000).toFixed(1)} kips){'\n'}
                  Qult,uplift ≈ 0.75×Qult,compression = {calcs.qUltUplift.toFixed(0)} lb
                </div>
              </div>

              <div>
                <h4 style={{ color: getStatusHex(overturningStatus), marginBottom: '0.4rem', fontSize: '1rem' }}>Step 6: Foundation Safety Factors ({numPiles} pile{numPiles > 1 ? 's' : ''})</h4>
                <div className="math-block" style={{ whiteSpace: 'pre-line' }}>
                  {numPiles >= 2 ? (
                    <>
                      Couple arm = {calcs.arm.toFixed(1)} ft{'\n'}
                      Compression-side pile demand = {calcs.pileCompDemand.toFixed(0)} lb{'\n'}
                      Tension-side pile demand = {calcs.pileUpliftDemand.toFixed(0)} lb{'\n'}
                    </>
                  ) : (
                    <>Single pile: moment resisted by shaft passive soil pressure (resultant at 2D/3 = {(2*pileEmbedment/3).toFixed(1)} ft below grade){'\n'}</>
                  )}
                  FS(sliding) = N·Qlat / V = {calcs.fsSliding.toFixed(2)}  (req ≥ {targets.sliding.toFixed(1)}){'\n'}
                  FS(overturning) = Mresist / M = {calcs.fsOverturning.toFixed(2)}  (req ≥ {targets.overturning.toFixed(1)}){'\n'}
                  FS(pile bearing/pullout) = {calcs.fsPileBearing.toFixed(2)}  (req ≥ {targets.pile.toFixed(1)})
                </div>
                <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                  ✦ Convention: Sliding/lateral failure uses FS ≥ 1.5, overturning/rotational failure uses FS ≥ 2.0, and individual pile bearing/pullout (the most uncertain, soil-controlled mode) uses FS ≥ 3.0 — unless the Uniform Target mode overrides all three with a single chosen value.
                </p>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

function getStatusHex(status) {
  return status.color;
}

export default WallFenceFoundationVisualizer;
