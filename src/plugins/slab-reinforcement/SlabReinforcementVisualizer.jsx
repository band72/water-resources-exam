import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

// ASTM Standard US Rebar Sizes (Imperial)
const REBAR_SIZES = {
  3: { size: '#3', db: 0.375, area: 0.11, weight: 0.376, desc: '3/8" diameter rebar' },
  4: { size: '#4', db: 0.500, area: 0.20, weight: 0.668, desc: '1/2" diameter rebar' },
  5: { size: '#5', db: 0.625, area: 0.31, weight: 1.043, desc: '5/8" diameter rebar' },
  6: { size: '#6', db: 0.750, area: 0.44, weight: 1.502, desc: '3/4" diameter rebar' },
  7: { size: '#7', db: 0.875, area: 0.60, weight: 2.044, desc: '7/8" diameter rebar' },
  8: { size: '#8', db: 1.000, area: 0.79, weight: 2.670, desc: '1" diameter rebar' },
  9: { size: '#9', db: 1.128, area: 1.00, weight: 3.400, desc: '1-1/8" diameter rebar' },
  10: { size: '#10', db: 1.270, area: 1.27, weight: 4.303, desc: '1-1/4" diameter rebar' }
};

const SlabReinforcementVisualizer = ({ problem }) => {
  // Determine initial mode from problem ID: 190 -> 'oneway', 191 -> 'punching'
  const initialMode = problem?.id === 191 ? 'punching' : 'oneway';
  const [activeMode, setActiveMode] = useState(initialMode);

  // Common Slab Geometry & Materials
  const [slabThicknessInches, setSlabThicknessInches] = useState(8); // inches
  const [clearCoverInches, setClearCoverInches] = useState(1.5); // inches (standard ACI earth contact)
  const [fcPsi, setFcPsi] = useState(4000); // concrete compressive strength psi
  const [fyPsi] = useState(60000); // Grade 60 rebar psi
  const [rebarBarNumber, setRebarBarNumber] = useState(5); // #5 rebar default
  const [rebarSpacingInches, setRebarSpacingInches] = useState(10); // inches on-center

  // Loading Parameters
  const [houseWeightKips, setHouseWeightKips] = useState(150); // kips
  const [surchargePsf, setSurchargePsf] = useState(50); // psf
  const slabSideFt = 50;
  const slabAreaSqFt = slabSideFt * slabSideFt; // 2,500 sq ft

  // Mode 1: One-Way Shear Parameters
  const [spanLengthFt, setSpanLengthFt] = useState(10); // clear span between pile rows / supports (ft)
  const [hasShearStirrups, setHasShearStirrups] = useState(false);
  const [stirrupBarNumber, setStirrupBarNumber] = useState(4); // #4 stirrups
  const [stirrupSpacingInches, setStirrupSpacingInches] = useState(8); // inches O.C.

  // Mode 2: Two-Way Punching Shear Parameters
  const [pileCapSizeInches, setPileCapSizeInches] = useState(12); // c = 12" square pile cap
  const [pileGridCount, setPileGridCount] = useState(36); // 6x6 grid = 36 piles default
  const [hasShearStuds, setHasShearStuds] = useState(false);
  const [studsPerRail, setStudsPerRail] = useState(3); // 3 studs per rail

  // Fullscreen & Derivation UI states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDerivation, setShowDerivation] = useState(true);

  // Rebar properties
  const activeRebar = REBAR_SIZES[rebarBarNumber] || REBAR_SIZES[5];
  const db = activeRebar.db;
  const Ab = activeRebar.area;

  // Effective depth d
  const effectiveDepthInches = Math.max(1, slabThicknessInches - clearCoverInches - (db / 2));
  const effectiveDepthFt = effectiveDepthInches / 12;

  // Unit weights and loads
  const gammaConcrete = 150; // pcf
  const slabSelfWeightPsf = (slabThicknessInches / 12) * gammaConcrete;
  const slabDeadWeightKips = (slabSelfWeightPsf * slabAreaSqFt) / 1000;
  const houseWeightPsf = (houseWeightKips * 1000) / slabAreaSqFt;
  const surchargeTotalKips = (surchargePsf * slabAreaSqFt) / 1000;

  // Total downward pressure (Service Load)
  const qTotalPsf = slabSelfWeightPsf + houseWeightPsf + surchargePsf;
  const totalDownwardKips = slabDeadWeightKips + houseWeightKips + surchargeTotalKips;

  // Factored LRFD uniform load (1.2D + 1.6L)
  const quPsf = (1.2 * (slabSelfWeightPsf + houseWeightPsf)) + (1.6 * surchargePsf);

  // ==========================================
  // MODE 1: ONE-WAY (BEAM ACTION) SHEAR MECHANICS
  // ==========================================
  // Critical section is located at distance d from the support face
  const shearSpanFt = Math.max(0.5, (spanLengthFt / 2) - effectiveDepthFt);
  // Vu per 1-foot (12 inches) slab strip
  const vuOneWayLbsPerFt = quPsf * shearSpanFt;
  const vuOneWayServiceLbsPerFt = qTotalPsf * shearSpanFt;

  // Concrete One-Way Shear Strength Vc (ACI 318-19 per foot strip, b = 12")
  // Size effect modification factor lambda_s for one-way shear
  const lambdaS = Math.min(1.0, Math.sqrt(2 / (1 + effectiveDepthInches / 10)));
  const lambda = 1.0; // normal weight concrete
  const vcStressPsi = 2 * lambda * lambdaS * Math.sqrt(fcPsi);
  const vcOneWayLbsPerFt = vcStressPsi * 12 * effectiveDepthInches;

  // Steel shear reinforcement (if stirrups provided)
  const stirrupRebar = REBAR_SIZES[stirrupBarNumber] || REBAR_SIZES[4];
  const AvOneWay = 2 * stirrupRebar.area; // 2 legs per stirrup
  const vsOneWayLbsPerFt = hasShearStirrups
    ? (AvOneWay * fyPsi * effectiveDepthInches) / stirrupSpacingInches
    : 0;

  const vnOneWayLbsPerFt = vcOneWayLbsPerFt + vsOneWayLbsPerFt;
  const phiVnOneWayLbsPerFt = 0.75 * vnOneWayLbsPerFt; // phi = 0.75 for shear
  const oneWaySfLrfd = phiVnOneWayLbsPerFt / Math.max(vuOneWayLbsPerFt, 1);
  const oneWaySfAsd = vnOneWayLbsPerFt / Math.max(vuOneWayServiceLbsPerFt, 1);
  const isOneWaySafe = oneWaySfLrfd >= 1.0;

  // Flexural reinforcement ratio & area provided
  const rebarAreaPerFtProvided = (12 / rebarSpacingInches) * Ab;
  const minTempShrinkageArea = 0.0018 * 12 * slabThicknessInches; // ACI minimum for Grade 60

  // ==========================================
  // MODE 2: TWO-WAY PUNCHING SHEAR MECHANICS
  // ==========================================
  // Upward concentrated pile reaction
  const singlePileReactionKips = totalDownwardKips / Math.max(pileGridCount, 1);
  const singlePileReactionFactoredKips = ((1.2 * (slabDeadWeightKips + houseWeightKips)) + (1.6 * surchargeTotalKips)) / Math.max(pileGridCount, 1);

  // Critical punching shear perimeter b0 at d/2 from pile cap face
  const critSideInches = pileCapSizeInches + effectiveDepthInches;
  const b0Inches = 4 * critSideInches; // interior pile cap
  const critAreaSqFt = Math.pow(critSideInches / 12, 2);

  // Net tributary punching force: Pile reaction minus downward load within critical perimeter
  const vuPunchingFactoredKips = Math.max(1, singlePileReactionFactoredKips - (quPsf * critAreaSqFt) / 1000);
  const vuPunchingServiceKips = Math.max(1, singlePileReactionKips - (qTotalPsf * critAreaSqFt) / 1000);
  const vuPunchingLbs = vuPunchingFactoredKips * 1000;

  // Concrete Two-Way Punching Shear Stress Capacity vc (ACI 318)
  // For square interior column (beta = 1.0, alpha_s = 40): vc = 4 * lambda * sqrt(f'c)
  const vcPunchingPsi = 4 * lambda * Math.sqrt(fcPsi);
  const vcPunchingNominalLbs = vcPunchingPsi * b0Inches * effectiveDepthInches;
  const vcPunchingNominalKips = vcPunchingNominalLbs / 1000;

  // Shear studs / crosshair reinforcement contribution
  const AvPunching = hasShearStuds ? (4 * 2 * (REBAR_SIZES[4].area)) : 0; // 4 rails, 2 legs of #4 studs
  const vsPunchingLbs = hasShearStuds
    ? (AvPunching * fyPsi * effectiveDepthInches) / Math.max(effectiveDepthInches * 0.75, 4)
    : 0;
  const vsPunchingNominalKips = vsPunchingLbs / 1000;

  const vnPunchingNominalKips = vcPunchingNominalKips + vsPunchingNominalKips;
  const phiVnPunchingKips = 0.75 * vnPunchingNominalKips;
  const punchingSfLrfd = phiVnPunchingKips / Math.max(vuPunchingFactoredKips, 0.1);
  const punchingSfAsd = vnPunchingNominalKips / Math.max(vuPunchingServiceKips, 0.1);
  const isPunchingSafe = punchingSfLrfd >= 1.0;

  // Presets
  const applyPreset = (presetKey) => {
    if (presetKey === 'residential_standard') {
      setSlabThicknessInches(8);
      setClearCoverInches(1.5);
      setFcPsi(4000);
      setRebarBarNumber(5);
      setRebarSpacingInches(10);
      setHouseWeightKips(150);
      setSurchargePsf(50);
      setSpanLengthFt(10);
      setPileCapSizeInches(12);
      setHasShearStirrups(false);
      setHasShearStuds(false);
    } else if (presetKey === 'heavy_house') {
      setSlabThicknessInches(12);
      setClearCoverInches(1.5);
      setFcPsi(5000);
      setRebarBarNumber(6);
      setRebarSpacingInches(8);
      setHouseWeightKips(350);
      setSurchargePsf(100);
      setSpanLengthFt(12);
      setPileCapSizeInches(14);
      setHasShearStirrups(true);
      setHasShearStuds(true);
    } else if (presetKey === 'thin_slab_failure') {
      setSlabThicknessInches(6);
      setClearCoverInches(1.5);
      setFcPsi(3000);
      setRebarBarNumber(4);
      setRebarSpacingInches(16);
      setHouseWeightKips(250);
      setSurchargePsf(80);
      setSpanLengthFt(14);
      setPileCapSizeInches(8);
      setHasShearStirrups(false);
      setHasShearStuds(false);
    }
  };

  const visualizerContent = (
    <div className="slab-reinforcement-visualizer" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Header & Problem Selector */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem 1.25rem',
        background: 'var(--bg-card)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        backdropFilter: 'var(--glass-blur)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            fontSize: '1.5rem',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px'
          }}>
            🧱
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Concrete Slab Shear & Punching Reinforcement Lab
            </h3>
            <span className="text-xs text-muted">
              Interactive ACI 318 Iron Rebar Sizing, Diagonal Shear Cracking & Helical Pile Punching Analysis
            </span>
          </div>
        </div>

        {/* Quick Presets & Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Presets:</span>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('residential_standard')}
          >
            Standard 8″ Slab
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('heavy_house')}
          >
            Heavy 350k (12″ Slab)
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--accent-rose)' }}
            onClick={() => applyPreset('thin_slab_failure')}
          >
            ⚠️ Cracking Hazard (6″ Thin)
          </button>

          <button
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', marginLeft: '0.5rem', color: isFullscreen ? 'var(--accent-rose)' : 'var(--text-main)' }}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? "✕ Close" : "⛶ Fullscreen"}
          </button>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
        padding: '0.4rem',
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <button
          className={`btn-secondary ${activeMode === 'oneway' ? 'active' : ''}`}
          style={{
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            background: activeMode === 'oneway' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
            borderColor: activeMode === 'oneway' ? 'var(--accent-blue)' : 'transparent',
            color: activeMode === 'oneway' ? 'var(--accent-blue)' : 'var(--text-muted)'
          }}
          onClick={() => setActiveMode('oneway')}
        >
          <span>📏</span> Problem #190: One-Way (Beam) Shear Cracking & Rebar Sizing
        </button>

        <button
          className={`btn-secondary ${activeMode === 'punching' ? 'active' : ''}`}
          style={{
            padding: '0.75rem 1rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            background: activeMode === 'punching' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
            borderColor: activeMode === 'punching' ? 'var(--accent-emerald)' : 'transparent',
            color: activeMode === 'punching' ? 'var(--accent-emerald)' : 'var(--text-muted)'
          }}
          onClick={() => setActiveMode('punching')}
        >
          <span>🎯</span> Problem #191: Two-Way Punching Shear & Pile Cap Reinforcement
        </button>
      </div>

      {/* Real-Time Safety Factor Status Hero Banner */}
      <section style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '14px',
        background: (activeMode === 'oneway' ? isOneWaySafe : isPunchingSafe) 
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(244, 63, 94, 0.18) 0%, rgba(245, 158, 11, 0.1) 100%)',
        border: `2px solid ${(activeMode === 'oneway' ? isOneWaySafe : isPunchingSafe) ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            fontSize: '2rem',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: (activeMode === 'oneway' ? isOneWaySafe : isPunchingSafe) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            color: (activeMode === 'oneway' ? isOneWaySafe : isPunchingSafe) ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}>
            {(activeMode === 'oneway' ? isOneWaySafe : isPunchingSafe) ? '✓' : '⚠️'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h4 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: (activeMode === 'oneway' ? isOneWaySafe : isPunchingSafe) ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                margin: 0
              }}>
                {activeMode === 'oneway'
                  ? (isOneWaySafe ? 'SHEAR CRACKING SAFE (SF ≥ 1.0)' : 'DIAGONAL SHEAR CRACKING HAZARD!')
                  : (isPunchingSafe ? 'PUNCHING SHEAR SAFE (SF ≥ 1.0)' : 'PUNCHING BREAKOUT CONE FAILURE HAZARD!')}
              </h4>
              <span className="glass-badge" style={{
                borderColor: (activeMode === 'oneway' ? isOneWaySafe : isPunchingSafe) ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                color: (activeMode === 'oneway' ? isOneWaySafe : isPunchingSafe) ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                fontWeight: 700
              }}>
                LRFD SF = {(activeMode === 'oneway' ? oneWaySfLrfd : punchingSfLrfd).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted" style={{ margin: '0.2rem 0 0 0' }}>
              {activeMode === 'oneway'
                ? (isOneWaySafe 
                    ? `Concrete slab depth d = ${effectiveDepthInches.toFixed(2)}″ provides ample shear resistance against ${vuOneWayLbsPerFt.toFixed(0)} lbs/ft factored demand.`
                    : `Slab depth d is too shallow or load is excessive! Increase thickness t_slab, add shear stirrups, or decrease support span.`)
                : (isPunchingSafe
                    ? `Pile cap perimeter b0 = ${b0Inches.toFixed(1)}″ distributes the ${vuPunchingFactoredKips.toFixed(1)}-kip pile reaction safely without punching breakout.`
                    : `Helical pile head punches through the slab! Increase slab thickness, enlarge steel pile cap c, or install shear stud rails.`)}
            </p>
          </div>
        </div>

        {/* Quick Stat Capsules */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <span className="text-xs text-muted">Factored Demand (Vu):</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {activeMode === 'oneway' ? `${vuOneWayLbsPerFt.toFixed(0)} lbs/ft` : `${vuPunchingFactoredKips.toFixed(1)} kips`}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted">Design Capacity (φVn):</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              {activeMode === 'oneway' ? `${phiVnOneWayLbsPerFt.toFixed(0)} lbs/ft` : `${phiVnPunchingKips.toFixed(1)} kips`}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted">Working Stress SF (ASD):</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>
              {(activeMode === 'oneway' ? oneWaySfAsd : punchingSfAsd).toFixed(2)}
            </div>
          </div>
        </div>
      </section>

      {/* Main Dual-Column Interactive Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.15fr) minmax(380px, 1.85fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column: Interactive Parametric Sliders */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '1.5rem',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          backdropFilter: 'var(--glass-blur)'
        }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-cyan)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎛️</span> Slab & Iron Rebar Sizing Controls
          </h4>

          {/* Section A: Slab Geometry & Concrete Strength */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-blue)' }}>
              1. Concrete Slab Geometry & Materials
            </span>

            {/* Slab Thickness Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Slab Thickness (tslab):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  {slabThicknessInches} inches ({(slabThicknessInches / 12).toFixed(2)} ft)
                </strong>
              </div>
              <input
                type="range"
                min="6"
                max="24"
                step="1"
                value={slabThicknessInches}
                onChange={(e) => setSlabThicknessInches(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                {[6, 8, 10, 12, 16].map((th) => (
                  <button
                    key={th}
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', background: slabThicknessInches === th ? 'rgba(56, 189, 248, 0.2)' : 'transparent' }}
                    onClick={() => setSlabThicknessInches(th)}
                  >
                    {th}″
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Concrete Cover */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Clear Concrete Cover (ccov):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{clearCoverInches.toFixed(2)} inches</strong>
              </div>
              <input
                type="range"
                min="0.75"
                max="2.5"
                step="0.25"
                value={clearCoverInches}
                onChange={(e) => setClearCoverInches(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#38bdf8' }}
              />
              <span className="text-xs text-muted" style={{ fontSize: '0.7rem' }}>
                ACI 318 Section 20.6.1.3: 1.5″ for ground-cast slabs; 0.75″ for interior suspended slabs.
              </span>
            </div>

            {/* Concrete Compressive Strength f'c */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Concrete Compressive Strength (f′c):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>{fcPsi.toLocaleString()} psi</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {[3000, 4000, 5000, 6000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: '0.35rem',
                      fontSize: '0.75rem',
                      background: fcPsi === val ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.04)',
                      borderColor: fcPsi === val ? 'var(--accent-emerald)' : 'var(--border-color)',
                      color: fcPsi === val ? 'var(--accent-emerald)' : 'var(--text-main)',
                      fontWeight: fcPsi === val ? 700 : 500
                    }}
                    onClick={() => setFcPsi(val)}
                  >
                    {val / 1000}k psi
                  </button>
                ))}
              </div>
            </div>

            {/* Effective Depth Callout */}
            <div style={{
              padding: '0.65rem 0.85rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Effective Shear Depth (d = t - cover - db/2):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{effectiveDepthInches.toFixed(2)} inches</strong>
              </div>
            </div>
          </div>

          {/* Section B: Iron Rebar Size & On-Center Spacing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              2. Iron Rebar Specification & Spacing
            </span>

            {/* ASTM Rebar Size Selection Grid */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Longitudinal Iron Rebar Size:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                  {activeRebar.size} (db = {db}″, Ab = {Ab} in²)
                </strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {Object.entries(REBAR_SIZES).map(([num, item]) => (
                  <button
                    key={num}
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: '0.4rem',
                      fontSize: '0.75rem',
                      background: rebarBarNumber === Number(num) ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.04)',
                      borderColor: rebarBarNumber === Number(num) ? 'var(--accent-emerald)' : 'var(--border-color)',
                      color: rebarBarNumber === Number(num) ? 'var(--accent-emerald)' : 'var(--text-main)',
                      fontWeight: rebarBarNumber === Number(num) ? 700 : 500
                    }}
                    onClick={() => setRebarBarNumber(Number(num))}
                  >
                    {item.size} ({item.db}″)
                  </button>
                ))}
              </div>
            </div>

            {/* Rebar On-Center Spacing */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Rebar Spacing (s):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{rebarSpacingInches} inches On-Center</strong>
              </div>
              <input
                type="range"
                min="4"
                max="18"
                step="1"
                value={rebarSpacingInches}
                onChange={(e) => setRebarSpacingInches(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                <span>Reinforcement Area: <strong style={{ color: '#fff' }}>{rebarAreaPerFtProvided.toFixed(2)} in²/ft</strong></span>
                <span>ACI Min (Temp): <strong style={{ color: '#94a3b8' }}>{minTempShrinkageArea.toFixed(2)} in²/ft</strong></span>
              </div>
            </div>
          </div>

          {/* Section C: Loading (Superstructure + Surcharge) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-amber)' }}>
              3. Superstructure & Live Surcharge Loads
            </span>

            {/* House Superstructure Load */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">House Superstructure Load (Whouse):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>{houseWeightKips} kips</strong>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={houseWeightKips}
                onChange={(e) => setHouseWeightKips(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
              />
            </div>

            {/* Surcharge Load */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Surface Live Surcharge (qsurcharge):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{surchargePsf} psf</strong>
              </div>
              <input
                type="range"
                min="0"
                max="300"
                step="10"
                value={surchargePsf}
                onChange={(e) => setSurchargePsf(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>

            {/* Load Total Summary */}
            <div style={{
              padding: '0.65rem 0.85rem',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span className="text-muted">Total Slab Downward Pressure (qtotal):</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>{qTotalPsf.toFixed(0)} psf</strong>
            </div>
          </div>

          {/* Section D: Mode-Specific Shear Configuration */}
          {activeMode === 'oneway' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-purple)' }}>
                4. One-Way Shear Span & Stirrup Cage
              </span>

              {/* Support Span Length */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span className="text-muted">Clear Span Between Supports (Lspan):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{spanLengthFt} ft</strong>
                </div>
                <input
                  type="range"
                  min="6"
                  max="20"
                  step="1"
                  value={spanLengthFt}
                  onChange={(e) => setSpanLengthFt(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
                />
              </div>

              {/* Shear Stirrups Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Install Vertical Shear Stirrups (Vs):</span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    background: hasShearStirrups ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.04)',
                    borderColor: hasShearStirrups ? 'var(--accent-purple)' : 'var(--border-color)',
                    color: hasShearStirrups ? 'var(--accent-purple)' : 'var(--text-muted)',
                    fontWeight: 700
                  }}
                  onClick={() => setHasShearStirrups(!hasShearStirrups)}
                >
                  {hasShearStirrups ? '✓ Stirrups Active' : '+ Add Stirrups'}
                </button>
              </div>

              {hasShearStirrups && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span className="text-xs text-muted">Stirrup Size:</span>
                    <select
                      value={stirrupBarNumber}
                      onChange={(e) => setStirrupBarNumber(Number(e.target.value))}
                      style={{ width: '100%', padding: '0.35rem', background: '#0b1120', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                    >
                      <option value={3}>#3 Stirrup (0.22 in²)</option>
                      <option value={4}>#4 Stirrup (0.40 in²)</option>
                      <option value={5}>#5 Stirrup (0.62 in²)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-xs text-muted">Stirrup Spacing: {stirrupSpacingInches}″</span>
                    <input
                      type="range"
                      min="4"
                      max="14"
                      step="1"
                      value={stirrupSpacingInches}
                      onChange={(e) => setStirrupSpacingInches(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                4. Helical Pile Head Cap & Punching Studs
              </span>

              {/* Pile Cap Size */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span className="text-muted">Steel Bearing Cap Size (c):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>{pileCapSizeInches}″ × {pileCapSizeInches}″ square</strong>
                </div>
                <input
                  type="range"
                  min="8"
                  max="20"
                  step="1"
                  value={pileCapSizeInches}
                  onChange={(e) => setPileCapSizeInches(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                />
              </div>

              {/* Number of Piles in Grid */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span className="text-muted">Total Helical Piles (Grid):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{pileGridCount} piles ({singlePileReactionKips.toFixed(1)}k / pile)</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                  {[16, 25, 36, 49].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      className="btn-secondary"
                      style={{
                        padding: '0.35rem',
                        fontSize: '0.75rem',
                        background: pileGridCount === cnt ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
                        borderColor: pileGridCount === cnt ? 'var(--accent-blue)' : 'var(--border-color)',
                        color: pileGridCount === cnt ? 'var(--accent-blue)' : 'var(--text-main)',
                        fontWeight: pileGridCount === cnt ? 700 : 500
                      }}
                      onClick={() => setPileGridCount(cnt)}
                    >
                      {cnt} ({Math.sqrt(cnt)}×{Math.sqrt(cnt)})
                    </button>
                  ))}
                </div>
              </div>

              {/* Shear Studs Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Install Punching Shear Studs:</span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    background: hasShearStuds ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.04)',
                    borderColor: hasShearStuds ? 'var(--accent-emerald)' : 'var(--border-color)',
                    color: hasShearStuds ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    fontWeight: 700
                  }}
                  onClick={() => setHasShearStuds(!hasShearStuds)}
                >
                  {hasShearStuds ? '✓ Stud Rails Active' : '+ Add Shear Studs'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Engineering SVGs & Calculation Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Dynamic SVG Container */}
          <div style={{
            background: 'linear-gradient(180deg, #090e1a 0%, #050811 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
            position: 'relative',
            minHeight: '440px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* SVG 1: One-Way Beam Shear Cracking Elevation View */}
            {activeMode === 'oneway' && (
              <svg viewBox="0 0 760 480" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs>
                  {/* Concrete Hatch */}
                  <pattern id="slabConcreteHatch" width="16" height="16" patternUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="1" fill="#94a3b8" opacity="0.6" />
                    <circle cx="12" cy="12" r="1.5" fill="#cbd5e1" opacity="0.8" />
                    <line x1="2" y1="14" x2="8" y2="8" stroke="#64748b" strokeWidth="0.7" opacity="0.5" />
                  </pattern>

                  {/* Load Arrow */}
                  <marker id="shearLoadArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                  <marker id="supportArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 10 L 5 0 L 10 10 z" fill="#38bdf8" />
                  </marker>
                </defs>

                {/* Ambient Top Glow */}
                <rect x="0" y="0" width="760" height="120" fill="#0f172a" opacity="0.3" />

                {/* Surcharge & House Downward Distributed Load Arrows */}
                {Array.from({ length: 9 }).map((_, idx) => {
                  const arrowX = 80 + idx * 75;
                  return (
                    <g key={idx}>
                      <line x1={arrowX} y1="30" x2={arrowX} y2="85" stroke="#f43f5e" strokeWidth="2.5" markerEnd="url(#shearLoadArrow)" />
                    </g>
                  );
                })}
                <text x="380" y="24" fill="#fda4af" fontSize="12" fontWeight="700" textAnchor="middle">
                  qu = {quPsf.toFixed(0)} psf (Factored) • House ({houseWeightKips}k) + Surcharge ({surchargePsf} psf)
                </text>

                {/* Concrete Slab Body */}
                {/* Dynamically scaled thickness: t_slab 6" to 24" -> 60px to 160px */}
                {(() => {
                  const slabHeightPx = Math.min(180, Math.max(65, slabThicknessInches * 7.5));
                  const slabTopY = 95;
                  const slabBotY = slabTopY + slabHeightPx;
                  const leftSupX = 130;
                  const rightSupX = 630;
                  const spanWidthPx = rightSupX - leftSupX;

                  // Distance d in px
                  const dPx = (effectiveDepthInches / slabThicknessInches) * slabHeightPx;
                  const critSectionX = leftSupX + dPx;

                  return (
                    <g>
                      {/* Slab Solid Box */}
                      <rect x="40" y={slabTopY} width="680" height={slabHeightPx} fill="#334155" stroke="#64748b" strokeWidth="2" rx="4" />
                      <rect x="40" y={slabTopY} width="680" height={slabHeightPx} fill="url(#slabConcreteHatch)" rx="4" />

                      {/* Support Pillar Reactions (Helical Piles or Footings) */}
                      {/* Left Support */}
                      <rect x="105" y={slabBotY} width="50" height="90" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                      <line x1="130" y1={slabBotY + 110} x2="130" y2={slabBotY + 10} stroke="#38bdf8" strokeWidth="3" markerEnd="url(#supportArrow)" />
                      <text x="130" y={slabBotY + 130} fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">
                        Pile Line 1
                      </text>

                      {/* Right Support */}
                      <rect x="605" y={slabBotY} width="50" height="90" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                      <line x1="630" y1={slabBotY + 110} x2="630" y2={slabBotY + 10} stroke="#38bdf8" strokeWidth="3" markerEnd="url(#supportArrow)" />
                      <text x="630" y={slabBotY + 130} fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">
                        Pile Line 2 (L = {spanLengthFt}′)
                      </text>

                      {/* Span Dimension */}
                      <line x1={leftSupX} y1={slabBotY + 45} x2={rightSupX} y2={slabBotY + 45} stroke="#94a3b8" strokeWidth="1.5" />
                      <text x={(leftSupX + rightSupX) / 2} y={slabBotY + 40} fill="#cbd5e1" fontSize="11" fontWeight="600" textAnchor="middle">
                        Clear Span Lspan = {spanLengthFt} ft
                      </text>

                      {/* Tension Rebar Layer (Bottom Rebar Mat) */}
                      {(() => {
                        const coverPx = (clearCoverInches / slabThicknessInches) * slabHeightPx;
                        const rebarY = slabBotY - coverPx - 4;
                        const barElements = [];
                        const barStep = 32; // graphical spacing

                        for (let bx = 60; bx <= 700; bx += barStep) {
                          barElements.push(
                            <g key={bx}>
                              <circle cx={bx} cy={rebarY} r={Math.max(3.5, db * 6)} fill="#10b981" stroke="#ecfdf5" strokeWidth="1.2" />
                            </g>
                          );
                        }
                        return (
                          <g>
                            {/* Horizontal Rebar Bar Run */}
                            <line x1="50" y1={rebarY} x2="710" y2={rebarY} stroke="#059669" strokeWidth="2" />
                            {barElements}
                            <text x="680" y={rebarY - 8} fill="#34d399" fontSize="10" fontWeight="700">
                              {activeRebar.size} @ {rebarSpacingInches}″ O.C.
                            </text>
                          </g>
                        );
                      })()}

                      {/* Vertical Shear Stirrup Ties if active */}
                      {hasShearStirrups && (() => {
                        const stirrupElements = [];
                        const stirrupStepPx = 45;
                        for (let sx = leftSupX + 25; sx <= leftSupX + 220; sx += stirrupStepPx) {
                          stirrupElements.push(
                            <rect
                              key={sx}
                              x={sx - 5}
                              y={slabTopY + 8}
                              width="10"
                              height={slabHeightPx - 16}
                              fill="none"
                              stroke="#c084fc"
                              strokeWidth="2.5"
                              strokeDasharray="4,2"
                              rx="3"
                            />
                          );
                        }
                        return <g>{stirrupElements}</g>;
                      })()}

                      {/* Critical Section Line at Distance d from support face */}
                      <line
                        x1={critSectionX}
                        y1={slabTopY - 10}
                        x2={critSectionX}
                        y2={slabBotY + 10}
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="5,4"
                      />
                      <text x={critSectionX + 5} y={slabTopY - 4} fill="#38bdf8" fontSize="10" fontWeight="700">
                        Critical Section (d = {effectiveDepthInches.toFixed(1)}″)
                      </text>

                      {/* Diagonal Tension Shear Crack at 45 degrees */}
                      {isOneWaySafe ? (
                        // Safe: Subdued hairline crack with green "ARRESTED" indicator
                        <g>
                          <path
                            d={`M ${leftSupX + 15} ${slabBotY} L ${critSectionX + 35} ${slabTopY}`}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2"
                            strokeDasharray="3,3"
                            opacity="0.8"
                          />
                          <rect x={critSectionX - 45} y={(slabTopY + slabBotY) / 2 - 14} width="150" height="24" fill="rgba(15, 23, 42, 0.9)" stroke="#10b981" strokeWidth="1.5" rx="5" />
                          <text x={critSectionX + 30} y={(slabTopY + slabBotY) / 2 + 2} fill="#34d399" fontSize="10" fontWeight="700" textAnchor="middle">
                            ✓ SHEAR RESISTED (SF = {oneWaySfLrfd.toFixed(2)})
                          </text>
                        </g>
                      ) : (
                        // Failure: Flashing Wide Red Diagonal Tension Crack
                        <g>
                          <path
                            d={`M ${leftSupX + 10} ${slabBotY} Q ${leftSupX + 30} ${(slabTopY + slabBotY) / 2 + 10} ${critSectionX + 45} ${slabTopY}`}
                            fill="none"
                            stroke="#f43f5e"
                            strokeWidth="4.5"
                          />
                          {/* Secondary branch crack */}
                          <path
                            d={`M ${leftSupX + 35} ${(slabTopY + slabBotY) / 2 + 5} L ${leftSupX + 85} ${slabTopY}`}
                            fill="none"
                            stroke="#fb7185"
                            strokeWidth="2.5"
                          />
                          <rect x={critSectionX - 55} y={(slabTopY + slabBotY) / 2 - 16} width="180" height="28" fill="rgba(244, 63, 94, 0.95)" stroke="#fff" strokeWidth="1.5" rx="6" />
                          <text x={critSectionX + 35} y={(slabTopY + slabBotY) / 2 + 3} fill="#fff" fontSize="11" fontWeight="800" textAnchor="middle">
                            ⚡ DIAGONAL SHEAR FAILURE! (SF = {oneWaySfLrfd.toFixed(2)})
                          </text>
                        </g>
                      )}

                      {/* Slab Thickness Dimension (Right Side) */}
                      <line x1="685" y1={slabTopY} x2="685" y2={slabBotY} stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="680" y1={slabTopY} x2="690" y2={slabTopY} stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="680" y1={slabBotY} x2="690" y2={slabBotY} stroke="#cbd5e1" strokeWidth="1.5" />
                      <text x="695" y={(slabTopY + slabBotY) / 2 + 4} fill="#f8fafc" fontSize="11" fontWeight="700">
                        t = {slabThicknessInches}″
                      </text>
                    </g>
                  );
                })()}
              </svg>
            )}

            {/* SVG 2: Two-Way Punching Shear Cone & Critical Perimeter View */}
            {activeMode === 'punching' && (
              <svg viewBox="0 0 760 480" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs>
                  {/* Punching Cone Gradient */}
                  <linearGradient id="punchConeGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Ambient Background */}
                <rect x="0" y="0" width="760" height="480" fill="none" />

                {/* Left Side: Punching Shear Elevation Cross-Section */}
                {(() => {
                  const slabHeightPx = Math.min(160, Math.max(65, slabThicknessInches * 7.5));
                  const slabTopY = 120;
                  const slabBotY = slabTopY + slabHeightPx;
                  const pileCenterX = 240;
                  const capHalfWidthPx = Math.min(65, pileCapSizeInches * 3.5);
                  const dPx = (effectiveDepthInches / slabThicknessInches) * slabHeightPx;
                  const breakoutHalfWidth = capHalfWidthPx + dPx;

                  return (
                    <g>
                      <text x="240" y="50" fill="#38bdf8" fontSize="13" fontWeight="800" textAnchor="middle">
                        Elevational Cross-Section: 45° Punching Cone
                      </text>

                      {/* Continuous Slab */}
                      <rect x="40" y={slabTopY} width="400" height={slabHeightPx} fill="#334155" stroke="#64748b" strokeWidth="2" rx="4" />

                      {/* Truncated 45° Punching Shear Breakout Failure Cone */}
                      <polygon
                        points={`
                          ${pileCenterX - capHalfWidthPx},${slabBotY}
                          ${pileCenterX - breakoutHalfWidth},${slabTopY}
                          ${pileCenterX + breakoutHalfWidth},${slabTopY}
                          ${pileCenterX + capHalfWidthPx},${slabBotY}
                        `}
                        fill={isPunchingSafe ? 'rgba(16, 185, 129, 0.12)' : 'url(#punchConeGrad)'}
                        stroke={isPunchingSafe ? 'var(--accent-emerald)' : 'var(--accent-rose)'}
                        strokeWidth={isPunchingSafe ? '2' : '3.5'}
                        strokeDasharray={isPunchingSafe ? '4,3' : 'none'}
                      />

                      {/* Steel Helical Pile Cap Plate (c x c) */}
                      <rect
                        x={pileCenterX - capHalfWidthPx}
                        y={slabBotY}
                        width={capHalfWidthPx * 2}
                        height="18"
                        fill="#0284c7"
                        stroke="#7dd3fc"
                        strokeWidth="2"
                        rx="2"
                      />
                      <text x={pileCenterX} y={slabBotY + 13} fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle">
                        Cap: {pileCapSizeInches}″ × {pileCapSizeInches}″
                      </text>

                      {/* Helical Steel Shaft & Reaction Arrow */}
                      <line x1={pileCenterX} y1={slabBotY + 18} x2={pileCenterX} y2={slabBotY + 100} stroke="#94a3b8" strokeWidth="8" />
                      <line x1={pileCenterX} y1={slabBotY + 95} x2={pileCenterX} y2={slabBotY + 25} stroke="#38bdf8" strokeWidth="4" markerEnd="url(#supportArrow)" />
                      <text x={pileCenterX} y={slabBotY + 115} fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">
                        Ppile = {singlePileReactionKips.toFixed(1)} kips
                      </text>

                      {/* Shear Stud Rails if active */}
                      {hasShearStuds && (
                        <g>
                          {[-capHalfWidthPx - dPx * 0.4, capHalfWidthPx + dPx * 0.4].map((studX, sIdx) => (
                            <g key={sIdx}>
                              <line x1={pileCenterX + studX} y1={slabTopY + 10} x2={pileCenterX + studX} y2={slabBotY - 10} stroke="#10b981" strokeWidth="4" />
                              <circle cx={pileCenterX + studX} cy={slabTopY + 10} r="5" fill="#10b981" />
                              <circle cx={pileCenterX + studX} cy={slabBotY - 10} r="5" fill="#10b981" />
                            </g>
                          ))}
                        </g>
                      )}

                      {/* Status Callout Badge */}
                      <rect x="140" y={slabTopY + slabHeightPx / 2 - 14} width="200" height="28" fill="rgba(15, 23, 42, 0.95)" stroke={isPunchingSafe ? 'var(--accent-emerald)' : 'var(--accent-rose)'} strokeWidth="1.5" rx="6" />
                      <text x="240" y={slabTopY + slabHeightPx / 2 + 4} fill={isPunchingSafe ? '#34d399' : '#f43f5e'} fontSize="11" fontWeight="800" textAnchor="middle">
                        {isPunchingSafe ? `✓ PUNCHING SAFE (SF = ${punchingSfLrfd.toFixed(2)})` : `⚡ PUNCHING BREAKOUT! (SF = ${punchingSfLrfd.toFixed(2)})`}
                      </text>
                    </g>
                  );
                })()}

                {/* Right Side: Plan View showing Critical Perimeter b0 at d/2 */}
                {(() => {
                  const planCenterX = 580;
                  const planCenterY = 240;
                  const capSizePx = Math.min(80, pileCapSizeInches * 4);
                  const dPx = (effectiveDepthInches / 8) * 35;
                  const b0SizePx = capSizePx + dPx * 2;

                  return (
                    <g>
                      <text x="580" y="50" fill="#10b981" fontSize="13" fontWeight="800" textAnchor="middle">
                        Plan View: Critical Perimeter b₀ (at d/2)
                      </text>

                      {/* Background Slab Region */}
                      <rect x="470" y="80" width="220" height="320" fill="rgba(30, 41, 59, 0.6)" stroke="#475569" strokeWidth="1.5" rx="8" />

                      {/* Critical Perimeter Box (b0 at d/2) */}
                      <rect
                        x={planCenterX - b0SizePx / 2}
                        y={planCenterY - b0SizePx / 2}
                        width={b0SizePx}
                        height={b0SizePx}
                        fill="rgba(56, 189, 248, 0.1)"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeDasharray="6,4"
                        rx="4"
                      />

                      {/* Pile Cap (c x c) */}
                      <rect
                        x={planCenterX - capSizePx / 2}
                        y={planCenterY - capSizePx / 2}
                        width={capSizePx}
                        height={capSizePx}
                        fill="#0284c7"
                        stroke="#bae6fd"
                        strokeWidth="2"
                        rx="3"
                      />
                      <text x={planCenterX} y={planCenterY + 4} fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle">
                        {pileCapSizeInches}″ × {pileCapSizeInches}″
                      </text>

                      {/* Shear Stud Rails Plan Icons if active */}
                      {hasShearStuds && (
                        <g>
                          {[0, 90, 180, 270].map((angle, rIdx) => {
                            const rad = (angle * Math.PI) / 180;
                            const sx1 = planCenterX + Math.cos(rad) * (capSizePx / 2 + 5);
                            const sy1 = planCenterY + Math.sin(rad) * (capSizePx / 2 + 5);
                            const sx2 = planCenterX + Math.cos(rad) * (b0SizePx / 2 + 15);
                            const sy2 = planCenterY + Math.sin(rad) * (b0SizePx / 2 + 15);
                            return (
                              <g key={rIdx}>
                                <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="#10b981" strokeWidth="3" />
                                <circle cx={(sx1 + sx2) / 2} cy={(sy1 + sy2) / 2} r="4" fill="#34d399" />
                              </g>
                            );
                          })}
                        </g>
                      )}

                      {/* b0 Dimension Label */}
                      <text x={planCenterX} y={planCenterY + b0SizePx / 2 + 18} fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">
                        b₀ = 4·(c + d) = {b0Inches.toFixed(1)}″
                      </text>

                      {/* Capacity Label */}
                      <text x={planCenterX} y="425" fill="#f8fafc" fontSize="11" fontWeight="600" textAnchor="middle">
                        φVn = {phiVnPunchingKips.toFixed(1)} kips vs Vu = {vuPunchingFactoredKips.toFixed(1)} kips
                      </text>
                    </g>
                  );
                })()}
              </svg>
            )}
          </div>

          {/* Mathematical Step-by-Step Derivation Breakdown */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            <div
              onClick={() => setShowDerivation(!showDerivation)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: showDerivation ? '1px solid var(--border-color)' : 'none'
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🧮</span> Step-by-Step ACI 318 Engineering Derivation & Substitutions
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {showDerivation ? '▲ Collapse' : '▼ Expand'}
              </span>
            </div>

            {showDerivation && (
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                {activeMode === 'oneway' ? (
                  <>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '0.35rem' }}>
                        Step 1: Effective Depth & Uniform Factored Load
                      </div>
                      <div>
                        Slab Thickness: <code>tslab = {slabThicknessInches} in</code>, Clear Cover: <code>ccov = {clearCoverInches} in</code>, Rebar Size: <code>{activeRebar.size} (db = {db} in)</code><br />
                        Effective Depth: <code>d = {slabThicknessInches} - {clearCoverInches} - ({db} / 2) = {effectiveDepthInches.toFixed(2)} in ({effectiveDepthFt.toFixed(3)} ft)</code><br />
                        Slab Self-Weight: <code>wslab = ({slabThicknessInches} / 12) × 150 = {slabSelfWeightPsf.toFixed(1)} psf</code><br />
                        House Superstructure Load: <code>whouse = ({houseWeightKips} × 1000) / 2500 = {houseWeightPsf.toFixed(1)} psf</code><br />
                        Factored Load (1.2D + 1.6L): <code>qu = 1.2 × ({slabSelfWeightPsf.toFixed(1)} + {houseWeightPsf.toFixed(1)}) + 1.6 × {surchargePsf} = {quPsf.toFixed(1)} psf</code>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.35rem' }}>
                        Step 2: Factored Shear Demand Vu at Critical Section d from Support
                      </div>
                      <div>
                        Clear Shear Span: <code>Lspan/2 - d = ({spanLengthFt} / 2) - {effectiveDepthFt.toFixed(3)} = {shearSpanFt.toFixed(2)} ft</code><br />
                        Factored Critical Shear Force per 12″ strip: <code>Vu = {quPsf.toFixed(1)} psf × {shearSpanFt.toFixed(2)} ft = {vuOneWayLbsPerFt.toFixed(1)} lbs/ft</code><br />
                        Service Critical Shear Force: <code>Vservice = {qTotalPsf.toFixed(1)} psf × {shearSpanFt.toFixed(2)} ft = {vuOneWayServiceLbsPerFt.toFixed(1)} lbs/ft</code>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.35rem' }}>
                        Step 3: Concrete Shear Resistance Vc & Stirrup Contribution Vs
                      </div>
                      <div>
                        Size effect modifier: <code>λs = sqrt(2 / (1 + {effectiveDepthInches.toFixed(2)} / 10)) = {lambdaS.toFixed(2)}</code><br />
                        Concrete Nominal Shear Strength: <code>Vc = 2 × 1.0 × {lambdaS.toFixed(2)} × sqrt({fcPsi}) × 12 × {effectiveDepthInches.toFixed(2)} = {vcOneWayLbsPerFt.toFixed(1)} lbs/ft</code><br />
                        Shear Stirrup Contribution: <code>Vs = {hasShearStirrups ? `${vsOneWayLbsPerFt.toFixed(1)} lbs/ft` : '0 lbs/ft (Unreinforced in shear)'}</code><br />
                        <strong>Design Shear Capacity: <code>φVn = 0.75 × ({vcOneWayLbsPerFt.toFixed(1)} + {vsOneWayLbsPerFt.toFixed(1)}) = {phiVnOneWayLbsPerFt.toFixed(1)} lbs/ft</code></strong>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '0.35rem' }}>
                        Step 4: Safety Factor & Crack Resistance Conclusion
                      </div>
                      <div>
                        <strong>LRFD Safety Factor: <code>SF = φVn / Vu = {phiVnOneWayLbsPerFt.toFixed(1)} / {vuOneWayLbsPerFt.toFixed(1)} = {oneWaySfLrfd.toFixed(2)}</code></strong> ({isOneWaySafe ? 'Adequate Shear Capacity ✓' : 'Diagonal Cracking Hazard ⚠️'})<br />
                        ASD Safety Factor: <code>SF_ASD = Vn / Vservice = {vnOneWayLbsPerFt.toFixed(1)} / {vuOneWayServiceLbsPerFt.toFixed(1)} = {oneWaySfAsd.toFixed(2)}</code><br />
                        Flexural/Temperature Reinforcement: <code>{activeRebar.size} @ {rebarSpacingInches}″ O.C. provides As = {rebarAreaPerFtProvided.toFixed(2)} in²/ft ≥ As,min = {minTempShrinkageArea.toFixed(2)} in²/ft</code>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '0.35rem' }}>
                        Step 1: Pile Head Reaction & Critical Perimeter b0
                      </div>
                      <div>
                        Total Foundation Load: <code>Ptotal = {totalDownwardKips.toFixed(1)} kips</code> across {pileGridCount} piles<br />
                        Individual Pile Reaction: <code>Ppile = {totalDownwardKips.toFixed(1)} / {pileGridCount} = {singlePileReactionKips.toFixed(1)} kips (Factored: {singlePileReactionFactoredKips.toFixed(1)} kips)</code><br />
                        Helical Pile Bearing Cap: <code>c = {pileCapSizeInches}″ square</code><br />
                        <strong>Critical Punching Perimeter: <code>b0 = 4 × (c + d) = 4 × ({pileCapSizeInches} + {effectiveDepthInches.toFixed(2)}) = {b0Inches.toFixed(1)} inches</code></strong>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.35rem' }}>
                        Step 2: Factored Punching Shear Demand Vu
                      </div>
                      <div>
                        Critical Area inside b0: <code>Acrit = (({pileCapSizeInches} + {effectiveDepthInches.toFixed(2)}) / 12)² = {critAreaSqFt.toFixed(2)} sq ft</code><br />
                        Downward load inside b0: <code>({quPsf.toFixed(0)} psf × {critAreaSqFt.toFixed(2)} sq ft) / 1000 = {((quPsf * critAreaSqFt) / 1000).toFixed(2)} kips</code><br />
                        <strong>Net Factored Punching Force: <code>Vu = {singlePileReactionFactoredKips.toFixed(1)} - {((quPsf * critAreaSqFt) / 1000).toFixed(2)} = {vuPunchingFactoredKips.toFixed(1)} kips</code></strong>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.35rem' }}>
                        Step 3: Concrete Two-Way Punching Shear Capacity vc & φVn
                      </div>
                      <div>
                        Nominal Concrete Punching Stress: <code>vc = 4 × sqrt({fcPsi}) = {vcPunchingPsi.toFixed(1)} psi</code><br />
                        Concrete Nominal Capacity: <code>Vc = ({vcPunchingPsi.toFixed(1)} psi × {b0Inches.toFixed(1)} in × {effectiveDepthInches.toFixed(2)} in) / 1000 = {vcPunchingNominalKips.toFixed(1)} kips</code><br />
                        Shear Stud Contribution: <code>Vs = {hasShearStuds ? `${vsPunchingNominalKips.toFixed(1)} kips` : '0 kips (No shear studs installed)'}</code><br />
                        <strong>Design Punching Capacity: <code>φVn = 0.75 × ({vcPunchingNominalKips.toFixed(1)} + {vsPunchingNominalKips.toFixed(1)}) = {phiVnPunchingKips.toFixed(1)} kips</code></strong>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '0.35rem' }}>
                        Step 4: Punching Shear Safety Factor Conclusion
                      </div>
                      <div>
                        <strong>Punching Safety Factor (LRFD): <code>SF = φVn / Vu = {phiVnPunchingKips.toFixed(1)} / {vuPunchingFactoredKips.toFixed(1)} = {punchingSfLrfd.toFixed(2)}</code></strong> ({isPunchingSafe ? 'Safe against Punching Breakout ✓' : 'Punching Failure Cone Detected ⚠️'})<br />
                        Punching Safety Factor (ASD): <code>SF_ASD = Vn / Vservice = {vnPunchingNominalKips.toFixed(1)} / {vuPunchingServiceKips.toFixed(1)} = {punchingSfAsd.toFixed(2)}</code><br />
                        Design Recommendation: {isPunchingSafe ? 'Current slab thickness and pile cap dimensions prevent punching shear failure.' : 'Increase slab thickness tslab to ≥ 10″, increase pile cap c to ≥ 14″, or add shear stud rails.'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isFullscreen ? (
        createPortal(
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 10, 18, 0.96)',
            zIndex: 9999,
            overflowY: 'auto',
            padding: '2rem',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
              {visualizerContent}
            </div>
          </div>,
          document.body
        )
      ) : (
        <div style={{ marginTop: '1.5rem' }}>
          {visualizerContent}
        </div>
      )}

      {problem && <GenericProblemViewer problem={problem} key={problem.id} />}
    </>
  );
};

export default SlabReinforcementVisualizer;
