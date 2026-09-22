import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

// Preset Soil Types
const SOIL_PRESETS = {
  medium_sand: {
    name: 'Medium Dense Sand',
    phi: 32,
    c: 0,
    gammaDry: 115,
    gammaSat: 125,
    desc: "Standard bearing sand layer (φ' = 32°, c' = 0)"
  },
  dense_sand: {
    name: 'Dense Sand / Gravel',
    phi: 38,
    c: 0,
    gammaDry: 125,
    gammaSat: 135,
    desc: "High-density granular strata (φ' = 38°, c' = 0)"
  },
  loose_sand: {
    name: 'Loose Fine Sand',
    phi: 28,
    c: 0,
    gammaDry: 105,
    gammaSat: 118,
    desc: "Low-density sand, higher settlement susceptibility (φ' = 28°)"
  },
  stiff_clay: {
    name: 'Stiff Overconsolidated Clay',
    phi: 0,
    c: 1500,
    gammaDry: 110,
    gammaSat: 122,
    desc: "Cohesive undrained bearing layer (c' = 1,500 psf, φ = 0°)"
  },
  custom: {
    name: 'Custom Soil Parameters',
    phi: 30,
    c: 200,
    gammaDry: 115,
    gammaSat: 125,
    desc: "User-defined friction angle and cohesion"
  }
};

// Safety Factor Matrix tiers (1.0, 1.5, 2.0, 3.0) - static reference data
const SF_TIERS = [
  {
    sf: 1.0,
    label: 'SF = 1.0',
    badge: 'Ultimate Limit State',
    subtext: 'Theoretical failure threshold',
    color: 'var(--accent-rose)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
    bgGlow: 'rgba(244, 63, 94, 0.1)'
  },
  {
    sf: 1.5,
    label: 'SF = 1.5',
    badge: 'Wind / Transient Load',
    subtext: 'Temporary load combination',
    color: 'var(--accent-amber)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    bgGlow: 'rgba(245, 158, 11, 0.1)'
  },
  {
    sf: 2.0,
    label: 'SF = 2.0',
    badge: 'Standard Geotechnical',
    subtext: 'NCEES / IBC deep foundation limit',
    color: 'var(--accent-cyan)',
    borderColor: 'rgba(6, 182, 212, 0.4)',
    bgGlow: 'rgba(6, 182, 212, 0.12)'
  },
  {
    sf: 3.0,
    label: 'SF = 3.0',
    badge: 'Conservative High-Safety',
    subtext: 'Heavy settlement-sensitive structure',
    color: 'var(--accent-emerald)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    bgGlow: 'rgba(16, 185, 129, 0.12)'
  }
];

// Engineering calculation helper for bearing capacity factors
function calculateBearingFactors(phiDeg) {
  if (phiDeg <= 0) {
    return { nq: 1.0, nc: 9.0 }; // Skempton deep plate factor
  }
  const phiRad = (phiDeg * Math.PI) / 180;
  const nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const nc = (nq - 1) / Math.tan(phiRad);
  return { nq, nc };
}

const HelicalHouseVisualizer = ({ problem }) => {
  // Slab & House Load Parameters
  const [slabThicknessInches, setSlabThicknessInches] = useState(8); // inches
  const [concreteDensityPcf, setConcreteDensityPcf] = useState(150); // pcf
  const [houseWeightKips, setHouseWeightKips] = useState(150); // kips
  const [surchargePsf, setSurchargePsf] = useState(50); // psf

  // Geotechnical & Soil Parameters
  const [pileDepthFt, setPileDepthFt] = useState(25); // ft
  const [waterTableDepthFt, setWaterTableDepthFt] = useState(8); // ft
  const [soilKey, setSoilKey] = useState('medium_sand');
  const [customPhi, setCustomPhi] = useState(30);
  const [customC, setCustomC] = useState(0);

  // Soil Boring Report vs Theoretical Bearing Capacity Mode
  const [bearingCapacitySource, setBearingCapacitySource] = useState('theoretical'); // 'theoretical' | 'boring_report'
  const [boringReportQUltKsf, setBoringReportQUltKsf] = useState(45); // ksf from geotechnical boring report

  // Helical Pile Parameters
  const [helixDiameterInches, setHelixDiameterInches] = useState(12); // inches
  const [helixCount, setHelixCount] = useState(1); // 1, 2, or 3 helices per pile

  // UI States
  const [activeTab, setActiveTab] = useState('elevation'); // 'elevation' | 'plan' | 'stress'
  const [activeSfFocus, setActiveSfFocus] = useState(2.0); // 1.0, 1.5, 2.0, 3.0
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDerivation, setShowDerivation] = useState(true);

  // Active soil parameters
  const activeSoil = SOIL_PRESETS[soilKey] || SOIL_PRESETS.medium_sand;
  const phi = soilKey === 'custom' ? customPhi : activeSoil.phi;
  const c = soilKey === 'custom' ? customC : activeSoil.c;
  const gammaDry = activeSoil.gammaDry;
  const gammaSat = activeSoil.gammaSat;
  const gammaWater = 62.4; // pcf

  // 1. Slab & Downward Gravity Loads
  const slabSideFt = 50;
  const slabAreaSqFt = slabSideFt * slabSideFt; // 2,500 sq ft
  const slabThicknessFt = slabThicknessInches / 12;
  const slabVolumeCuFt = slabAreaSqFt * slabThicknessFt;
  const slabWeightLbs = slabVolumeCuFt * concreteDensityPcf;
  const slabWeightKips = slabWeightLbs / 1000;
  const surchargeTotalKips = (surchargePsf * slabAreaSqFt) / 1000;
  const totalDownwardLoadKips = slabWeightKips + houseWeightKips + surchargeTotalKips;
  const grossSoilPressurePsf = (totalDownwardLoadKips * 1000) / slabAreaSqFt;

  // 2. Overburden Stresses & Pore Water Pressure at Bearing Depth D
  const depthAboveGwt = Math.min(pileDepthFt, waterTableDepthFt);
  const depthBelowGwt = Math.max(0, pileDepthFt - waterTableDepthFt);

  // Total vertical stress at depth D
  const sigmaV_soil = (gammaDry * depthAboveGwt) + (gammaSat * depthBelowGwt);
  const sigmaV = surchargePsf + sigmaV_soil;

  // Hydrostatic pore water pressure at depth D
  const porePressureU = depthBelowGwt * gammaWater;

  // Effective vertical stress at depth D
  const sigmaPrimeV = sigmaV - porePressureU;

  // 3. Helical Pile Bearing Capacity
  const { nq, nc } = useMemo(() => calculateBearingFactors(phi), [phi]);
  const helixDiameterFt = helixDiameterInches / 12;
  const helixAreaSqFt = (Math.PI / 4) * Math.pow(helixDiameterFt, 2);

  // Theoretical unit bearing capacity q_ult
  const qUltTheoreticalPsf = (c * nc) + (sigmaPrimeV * nq);
  const qUltTheoreticalKsf = qUltTheoreticalPsf / 1000;

  // Active unit bearing capacity q_ult based on source
  const isBoringReport = bearingCapacitySource === 'boring_report';
  const qUltPsf = isBoringReport ? (boringReportQUltKsf * 1000) : qUltTheoreticalPsf;
  const qUltKsf = qUltPsf / 1000;

  // Ultimate pile compressive capacity Q_ult (kips)
  const singleHelixUltKips = (helixAreaSqFt * qUltPsf) / 1000;
  const pileUltCapacityKips = singleHelixUltKips * helixCount;

  // Impact comparison between Boring Report and Theoretical model
  const capacityDiffPercent = qUltTheoreticalKsf > 0 
    ? (((qUltKsf - qUltTheoreticalKsf) / qUltTheoreticalKsf) * 100)
    : 0;

  // 4. Safety Factor Matrix (1.0, 1.5, 2.0, 3.0)
  const sfMatrixResults = useMemo(() => {
    return SF_TIERS.map(tier => {
      const qAllow = pileUltCapacityKips / tier.sf;
      const nReq = Math.ceil(totalDownwardLoadKips / Math.max(qAllow, 0.001));
      // Grid sizing: k x k square grid where k >= ceil(sqrt(nReq))
      const k = Math.max(2, Math.ceil(Math.sqrt(nReq)));
      const nInstalled = k * k;
      const spacingFt = (slabSideFt / (k - 1)).toFixed(1);
      const operatingSf = (nInstalled * pileUltCapacityKips) / Math.max(totalDownwardLoadKips, 0.001);

      return {
        ...tier,
        qAllow: qAllow.toFixed(1),
        nReq,
        gridK: k,
        nInstalled,
        spacingFt,
        operatingSf: operatingSf.toFixed(2)
      };
    });
  }, [pileUltCapacityKips, totalDownwardLoadKips]);

  // Selected SF grid configuration for visualization
  const activeGrid = useMemo(() => {
    const found = sfMatrixResults.find(r => r.sf === activeSfFocus);
    return found || sfMatrixResults[2]; // Default to SF = 2.0
  }, [sfMatrixResults, activeSfFocus]);

  // Preset Scenario Handlers
  const applyPreset = (presetKey) => {
    if (presetKey === 'standard') {
      setSlabThicknessInches(8);
      setConcreteDensityPcf(150);
      setHouseWeightKips(150);
      setSurchargePsf(50);
      setPileDepthFt(25);
      setWaterTableDepthFt(8);
      setHelixDiameterInches(12);
      setHelixCount(1);
      setSoilKey('medium_sand');
      setBearingCapacitySource('theoretical');
    } else if (presetKey === 'boring_dense') {
      // Direct soil boring report: Dense bearing sand q_ult = 60 ksf
      setSlabThicknessInches(8);
      setConcreteDensityPcf(150);
      setHouseWeightKips(150);
      setSurchargePsf(50);
      setPileDepthFt(25);
      setWaterTableDepthFt(8);
      setHelixDiameterInches(12);
      setHelixCount(1);
      setBearingCapacitySource('boring_report');
      setBoringReportQUltKsf(60);
    } else if (presetKey === 'prob54') {
      // Problem 54 profile: House surcharge = 300 psf, Water table at 8 ft, Clay layer at 10-20 ft
      setSlabThicknessInches(6);
      setConcreteDensityPcf(150);
      setHouseWeightKips(100);
      setSurchargePsf(300); // 300 psf house footprint load
      setPileDepthFt(20);
      setWaterTableDepthFt(8);
      setHelixDiameterInches(14);
      setHelixCount(1);
      setSoilKey('stiff_clay');
      setBearingCapacitySource('theoretical');
    } else if (presetKey === 'high_water') {
      setSlabThicknessInches(10);
      setConcreteDensityPcf(150);
      setHouseWeightKips(180);
      setSurchargePsf(50);
      setPileDepthFt(30);
      setWaterTableDepthFt(2);
      setHelixDiameterInches(14);
      setHelixCount(2);
      setSoilKey('loose_sand');
      setBearingCapacitySource('theoretical');
    } else if (presetKey === 'heavy_residence') {
      setSlabThicknessInches(12);
      setConcreteDensityPcf(150);
      setHouseWeightKips(350);
      setSurchargePsf(80);
      setPileDepthFt(35);
      setWaterTableDepthFt(12);
      setHelixDiameterInches(16);
      setHelixCount(2);
      setSoilKey('dense_sand');
      setBearingCapacitySource('theoretical');
    }
  };

  // Main UI Content Body
  const visualizerContent = (
    <div className="helical-visualizer" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Header Bar with Presets & Fullscreen */}
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
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px'
          }}>
            🏗️
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              50′ × 50′ House Slab & Helical Pile Calculator
            </h3>
            <span className="text-xs text-muted">
              Deep Foundation Geotechnical Sizing, Soil Boring Reports & Hydrostatic Stress Engine
            </span>
          </div>
        </div>

        {/* Quick Presets & Fullscreen Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Presets:</span>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('standard')}
          >
            Baseline PE Standard
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderColor: 'rgba(16, 185, 129, 0.4)', color: 'var(--accent-emerald)' }}
            onClick={() => applyPreset('boring_dense')}
          >
            📑 Boring Report (60 ksf)
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('prob54')}
          >
            Problem #54 Profile
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('high_water')}
          >
            High Water Table (2′)
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('heavy_residence')}
          >
            Heavy 2-Story (350k)
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

      {/* 4-Tier Safety Factor Matrix Comparison Cards (SF = 1.0, 1.5, 2.0, 3.0) */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📊</span> Foundation Sizing & Safety Factor Matrix
            {isBoringReport && (
              <span className="glass-badge" style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                📑 Driven by Soil Boring Log (qult = {boringReportQUltKsf} ksf)
              </span>
            )}
          </h4>
          <span className="text-xs text-muted">Click any card to inspect its {activeGrid.gridK}×{activeGrid.gridK} plan layout below</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {sfMatrixResults.map((item) => {
            const isSelected = activeSfFocus === item.sf;
            return (
              <div
                key={item.sf}
                onClick={() => setActiveSfFocus(item.sf)}
                style={{
                  cursor: 'pointer',
                  padding: '1.25rem 1rem',
                  borderRadius: '12px',
                  background: isSelected ? item.bgGlow : 'var(--bg-card)',
                  border: `2px solid ${isSelected ? item.color : item.borderColor}`,
                  boxShadow: isSelected ? `0 0 20px ${item.bgGlow}` : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.05rem',
                    color: item.color
                  }}>
                    {item.label}
                  </span>
                  <span className="glass-badge" style={{ fontSize: '0.65rem', borderColor: item.borderColor, color: item.color }}>
                    {item.badge}
                  </span>
                </div>

                <div className="text-xs text-muted" style={{ lineHeight: 1.3 }}>
                  {item.subtext}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Allowable Cap (Qallow):</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>{item.qAllow} kips</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Min Piles Req (Nreq):</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: item.color }}>{item.nReq} piles</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Foundation Grid:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{item.gridK} × {item.gridK} ({item.nInstalled})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">On-Center Spacing:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>{item.spacingFt} ft O.C.</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Actual Operating SF:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: Number(item.operatingSf) >= item.sf ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {item.operatingSf}
                    </strong>
                  </div>
                </div>

                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '12px',
                    background: item.color,
                    color: '#000',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    letterSpacing: '0.04em'
                  }}>
                    ACTIVE VIEW
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Dual-Column Interactive Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.15fr) minmax(380px, 1.85fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column: Real-Time Input Controls */}
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
            <span>🎛️</span> Parametric Controls
          </h4>

          {/* Section A: Superstructure & Concrete Slab */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-blue)' }}>
              1. House Superstructure & Slab Loads
            </span>

            {/* Slab Thickness Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Slab Thickness (tslab):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{slabThicknessInches} inches ({(slabThicknessFt).toFixed(2)} ft)</strong>
              </div>
              <input
                type="range"
                min="4"
                max="24"
                step="1"
                value={slabThicknessInches}
                onChange={(e) => setSlabThicknessInches(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>

            {/* Concrete Unit Weight */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Concrete Density (γc):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{concreteDensityPcf} pcf</strong>
              </div>
              <input
                type="range"
                min="110"
                max="165"
                step="5"
                value={concreteDensityPcf}
                onChange={(e) => setConcreteDensityPcf(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                  onClick={() => setConcreteDensityPcf(115)}
                >
                  Lightweight (115)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                  onClick={() => setConcreteDensityPcf(150)}
                >
                  Normal (150)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                  onClick={() => setConcreteDensityPcf(160)}
                >
                  Heavy (160)
                </button>
              </div>
            </div>

            {/* House Superstructure Weight */}
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

            {/* Surface Surcharge / Live Load */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Surface Live Surcharge (qsurcharge):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{surchargePsf} psf ({(surchargeTotalKips).toFixed(1)} kips)</strong>
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

            {/* Total Load Summary Callout */}
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '10px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Slab Dead Weight:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{slabWeightKips.toFixed(1)} kips</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Total Downward Ptotal:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontSize: '0.95rem' }}>
                  {totalDownwardLoadKips.toFixed(1)} kips
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>Gross Contact Pressure:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{grossSoilPressurePsf.toFixed(0)} psf</span>
              </div>
            </div>
          </div>

          {/* Section B: Geotechnical Strata & Water Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              2. Soil Strata & Groundwater
            </span>

            {/* Soil Preset Selector */}
            <div>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.35rem' }}>Soil Stratum Classification:</span>
              <select
                value={soilKey}
                onChange={(e) => setSoilKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem'
                }}
              >
                {Object.entries(SOIL_PRESETS).map(([key, item]) => (
                  <option key={key} value={key} style={{ background: '#0b1120', color: '#fff' }}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Soil Controls if selected */}
            {soilKey === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span className="text-xs text-muted">Friction φ′: {customPhi}°</span>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="1"
                    value={customPhi}
                    onChange={(e) => setCustomPhi(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
                <div>
                  <span className="text-xs text-muted">Cohesion c′: {customC} psf</span>
                  <input
                    type="range"
                    min="0"
                    max="3000"
                    step="100"
                    value={customC}
                    onChange={(e) => setCustomC(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
              </div>
            )}

            {/* Groundwater Table Depth */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Water Table Depth (zgw):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{waterTableDepthFt} ft</strong>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={waterTableDepthFt}
                onChange={(e) => setWaterTableDepthFt(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#38bdf8' }}
              />
            </div>

            {/* Helical Pile Embedment Depth D */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Helical Embedment Depth (D):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>{pileDepthFt} ft</strong>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="1"
                value={pileDepthFt}
                onChange={(e) => setPileDepthFt(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
              />
            </div>

            {/* Stress State Callout */}
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: '10px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Total Vertical Stress (σv):</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{sigmaV.toFixed(1)} psf</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Pore Water Pressure (u):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{porePressureU.toFixed(1)} psf</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Effective Stress (σv′):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                  {sigmaPrimeV.toFixed(1)} psf
                </strong>
              </div>
            </div>
          </div>

          {/* Section C: Bearing Capacity Determination Source & Soil Boring Report Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-purple)' }}>
              3. Soil Bearing Capacity Source (Boring Report vs Theoretical)
            </span>

            {/* Mode Selection Buttons */}
            <div>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.45rem' }}>
                Select Bearing Capacity Method:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    background: bearingCapacitySource === 'theoretical' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.04)',
                    borderColor: bearingCapacitySource === 'theoretical' ? 'var(--accent-cyan)' : 'var(--border-color)',
                    color: bearingCapacitySource === 'theoretical' ? 'var(--accent-cyan)' : 'var(--text-main)',
                    fontWeight: bearingCapacitySource === 'theoretical' ? 700 : 500
                  }}
                  onClick={() => setBearingCapacitySource('theoretical')}
                >
                  📐 Theoretical (φ′, c′, σv′)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    background: bearingCapacitySource === 'boring_report' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                    borderColor: bearingCapacitySource === 'boring_report' ? 'var(--accent-emerald)' : 'var(--border-color)',
                    color: bearingCapacitySource === 'boring_report' ? 'var(--accent-emerald)' : 'var(--text-main)',
                    fontWeight: bearingCapacitySource === 'boring_report' ? 700 : 500
                  }}
                  onClick={() => setBearingCapacitySource('boring_report')}
                >
                  📑 Soil Boring Report (qult)
                </button>
              </div>
            </div>

            {/* Boring Report Interactive Controls */}
            {isBoringReport ? (
              <div style={{
                padding: '0.85rem 1rem',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span className="text-muted">Reported Ultimate Bearing (qult):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontSize: '1rem' }}>
                    {boringReportQUltKsf} ksf ({(boringReportQUltKsf * 1000).toLocaleString()} psf)
                  </strong>
                </div>

                <input
                  type="range"
                  min="5"
                  max="150"
                  step="1"
                  value={boringReportQUltKsf}
                  onChange={(e) => setBoringReportQUltKsf(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                />

                {/* Quick Presets from Typical Geotechnical Boring Logs */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => setBoringReportQUltKsf(20)}
                  >
                    Soft Silt (20 ksf)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => setBoringReportQUltKsf(35)}
                  >
                    Med Sand (35 ksf)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => setBoringReportQUltKsf(60)}
                  >
                    Dense Sand (60 ksf)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => setBoringReportQUltKsf(90)}
                  >
                    Glacial Till (90 ksf)
                  </button>
                </div>

                {/* Engineering Impact Explanation Callout */}
                <div style={{
                  fontSize: '0.78rem',
                  lineHeight: 1.4,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderLeft: `3px solid ${capacityDiffPercent >= 0 ? 'var(--accent-emerald)' : 'var(--accent-amber)'}`
                }}>
                  <div style={{ fontWeight: 600, color: capacityDiffPercent >= 0 ? '#34d399' : '#fbbf24', marginBottom: '0.2rem' }}>
                    {capacityDiffPercent >= 0 ? '📈 Higher Bearing Capacity' : '⚠️ Lower Bearing Capacity'}
                  </div>
                  <div>
                    Theoretical formula predicts <code style={{ color: '#38bdf8' }}>{qUltTheoreticalKsf.toFixed(1)} ksf</code>.
                    Boring report is <strong>{Math.abs(capacityDiffPercent).toFixed(0)}% {capacityDiffPercent >= 0 ? 'higher' : 'lower'}</strong>.
                    {capacityDiffPercent >= 0 
                      ? ' Allowable capacity per pile increases, reducing total pile count and foundation cost.' 
                      : ' Pile count increases and spacing tightens to prevent foundation punching and settlement.'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: '0.78rem',
                color: '#94a3b8',
                padding: '0.5rem 0.75rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px'
              }}>
                Calculated dynamically from Terzaghi-Meyerhof equation: <code>qult = c′Nc + σv′Nq = {qUltTheoreticalKsf.toFixed(2)} ksf</code>.
                Switch to <em>Soil Boring Report</em> to input verified lab / field SPT test values.
              </div>
            )}
          </div>

          {/* Section D: Helical Pile Geometry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              4. Helical Pile Plate Specifications
            </span>

            {/* Helix Diameter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Helix Plate Diameter (Dh):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{helixDiameterInches} inches ({helixDiameterFt.toFixed(2)} ft)</strong>
              </div>
              <input
                type="range"
                min="8"
                max="20"
                step="1"
                value={helixDiameterInches}
                onChange={(e) => setHelixDiameterInches(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                <span>Projected Bearing Area Ah:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{helixAreaSqFt.toFixed(3)} sq ft</span>
              </div>
            </div>

            {/* Number of Helices */}
            <div>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.35rem' }}>Helix Plates Per Pile:</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: '0.45rem',
                      fontSize: '0.8rem',
                      background: helixCount === count ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                      borderColor: helixCount === count ? 'var(--accent-emerald)' : 'var(--border-color)',
                      color: helixCount === count ? 'var(--accent-emerald)' : 'var(--text-main)',
                      fontWeight: helixCount === count ? 700 : 500
                    }}
                    onClick={() => setHelixCount(count)}
                  >
                    {count === 1 ? 'Single Helix' : count === 2 ? 'Double Helix' : 'Triple Helix'}
                  </button>
                ))}
              </div>
            </div>

            {/* Single Pile Capacity Callout */}
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Unit Bearing Cap (qult):</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{qUltKsf.toFixed(2)} ksf</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Ultimate Pile Cap (Qult):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontSize: '1rem' }}>
                  {pileUltCapacityKips.toFixed(1)} kips
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic SVG Schematics & Math Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* View Tab Selector */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.35rem',
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              className={`btn-secondary ${activeTab === 'elevation' ? 'active' : ''}`}
              style={{
                flex: 1,
                fontSize: '0.85rem',
                padding: '0.5rem',
                background: activeTab === 'elevation' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                borderColor: activeTab === 'elevation' ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === 'elevation' ? 'var(--accent-blue)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab('elevation')}
            >
              📐 Elevation Cross-Section
            </button>
            <button
              className={`btn-secondary ${activeTab === 'plan' ? 'active' : ''}`}
              style={{
                flex: 1,
                fontSize: '0.85rem',
                padding: '0.5rem',
                background: activeTab === 'plan' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                borderColor: activeTab === 'plan' ? 'var(--accent-emerald)' : 'transparent',
                color: activeTab === 'plan' ? 'var(--accent-emerald)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab('plan')}
            >
              🗺️ 50′ × 50′ Foundation Plan ({activeGrid.gridK}×{activeGrid.gridK})
            </button>
            <button
              className={`btn-secondary ${activeTab === 'stress' ? 'active' : ''}`}
              style={{
                flex: 1,
                fontSize: '0.85rem',
                padding: '0.5rem',
                background: activeTab === 'stress' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                borderColor: activeTab === 'stress' ? 'var(--accent-cyan)' : 'transparent',
                color: activeTab === 'stress' ? 'var(--accent-cyan)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab('stress')}
            >
              📈 Stress Depth Profile
            </button>
          </div>

          {/* SVG Canvas Container */}
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
            {/* TAB 1: Elevation Cross-Section */}
            {activeTab === 'elevation' && (
              <svg
                viewBox="0 0 760 520"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                <defs>
                  {/* Concrete Hatch Pattern */}
                  <pattern id="concreteHatch" width="16" height="16" patternUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="1" fill="#94a3b8" opacity="0.6" />
                    <circle cx="12" cy="12" r="1.5" fill="#cbd5e1" opacity="0.8" />
                    <line x1="2" y1="14" x2="8" y2="8" stroke="#64748b" strokeWidth="0.7" opacity="0.5" />
                  </pattern>

                  {/* Sand Pattern */}
                  <pattern id="sandHatch" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="5" cy="5" r="0.8" fill="#d97706" opacity="0.4" />
                    <circle cx="15" cy="15" r="0.8" fill="#d97706" opacity="0.4" />
                    <circle cx="12" cy="4" r="0.6" fill="#f59e0b" opacity="0.5" />
                    <circle cx="4" cy="14" r="0.6" fill="#f59e0b" opacity="0.5" />
                  </pattern>

                  {/* Soil Stress Bulb Gradient */}
                  <radialGradient id="stressBulb" cx="50%" cy="0%" r="90%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                    <stop offset="60%" stopColor="#10b981" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </radialGradient>

                  {/* Pore Pressure Linear Triangle Gradient */}
                  <linearGradient id="porePressureGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
                  </linearGradient>

                  {/* Arrow marker */}
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                </defs>

                {/* Sky & Surface Ambient */}
                <rect x="0" y="0" width="760" height="150" fill="#0f172a" opacity="0.4" />

                {/* Ground Surface Line (Z = 0 ft) */}
                <line x1="40" y1="150" x2="720" y2="150" stroke="#78716c" strokeWidth="2.5" />
                <text x="50" y="142" fill="#a8a29e" fontSize="11" fontWeight="600">GL (z = 0′)</text>

                {/* Dynamic Scaling: Ground is y=150. Scale spans whichever is deeper: 50 ft or the actual pile depth. */}
                {(() => {
                  const maxDepthElevation = Math.max(50, pileDepthFt);
                  const scalePxPerFt = 320 / maxDepthElevation;
                  const gwtY = 150 + waterTableDepthFt * scalePxPerFt;
                  const pileTipY = 150 + pileDepthFt * scalePxPerFt;

                  return (
                    <g>
                      {/* Stratum 1: Dry / Moist Soil Above GWT */}
                      <rect
                        x="50"
                        y="150"
                        width="540"
                        height={Math.max(0, gwtY - 150)}
                        fill="#292524"
                        stroke="none"
                      />
                      <rect
                        x="50"
                        y="150"
                        width="540"
                        height={Math.max(0, gwtY - 150)}
                        fill="url(#sandHatch)"
                      />
                      <text x="60" y={Math.min(gwtY - 10, 175)} fill="#fbbf24" fontSize="12" fontWeight="700">
                        Dry Zone (γdry = {gammaDry} pcf)
                      </text>

                      {/* Stratum 2: Submerged Saturated Soil Below GWT */}
                      <rect
                        x="50"
                        y={gwtY}
                        width="540"
                        height={Math.max(0, 480 - gwtY)}
                        fill="#0c2538"
                        stroke="none"
                      />
                      <line x1="45" y1={gwtY} x2="595" y2={gwtY} stroke="#38bdf8" strokeWidth="2" strokeDasharray="6,4" />

                      {/* Water Table Triangle Symbol (∇) */}
                      <polygon points={`70,${gwtY} 78,${gwtY - 12} 62,${gwtY - 12}`} fill="#38bdf8" />
                      <line x1="58" y1={gwtY - 15} x2="82" y2={gwtY - 15} stroke="#38bdf8" strokeWidth="1.5" />
                      <line x1="63" y1={gwtY - 18} x2="77" y2={gwtY - 18} stroke="#38bdf8" strokeWidth="1.5" />
                      <text x="88" y={gwtY - 4} fill="#38bdf8" fontSize="12" fontWeight="700">
                        GWT zgw = {waterTableDepthFt}′ (γsat = {gammaSat} pcf)
                      </text>

                      {/* House Superstructure Drawing */}
                      {/* House Body */}
                      <rect x="140" y="55" width="360" height="75" fill="#1e293b" stroke="#475569" strokeWidth="1.5" rx="4" />
                      {/* Pitched Roof */}
                      <polygon points="120,55 320,10 520,55" fill="#334155" stroke="#64748b" strokeWidth="2" />
                      {/* Windows & Door */}
                      <rect x="180" y="70" width="35" height="40" fill="#0284c7" opacity="0.8" rx="2" />
                      <line x1="197.5" y1="70" x2="197.5" y2="110" stroke="#bae6fd" strokeWidth="1" />
                      <rect x="425" y="70" width="35" height="40" fill="#0284c7" opacity="0.8" rx="2" />
                      <line x1="442.5" y1="70" x2="442.5" y2="110" stroke="#bae6fd" strokeWidth="1" />
                      <rect x="302" y="75" width="36" height="55" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" rx="2" />
                      <circle cx="330" cy="103" r="2" fill="#fbbf24" />

                      {/* House Load Indicator Arrows */}
                      <line x1="200" y1="25" x2="200" y2="50" stroke="#f43f5e" strokeWidth="3" markerEnd="url(#arrow)" />
                      <line x1="320" y1="5" x2="320" y2="25" stroke="#f43f5e" strokeWidth="3" markerEnd="url(#arrow)" />
                      <line x1="440" y1="25" x2="440" y2="50" stroke="#f43f5e" strokeWidth="3" markerEnd="url(#arrow)" />
                      <text x="320" y="45" fill="#fda4af" fontSize="12" fontWeight="800" textAnchor="middle">
                        Whouse = {houseWeightKips} kips + Surcharge ({surchargePsf} psf)
                      </text>

                      {/* 50' Concrete Slab Drawing */}
                      <rect x="130" y="130" width="380" height="20" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
                      <rect x="130" y="130" width="380" height="20" fill="url(#concreteHatch)" />
                      <text x="320" y="145" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">
                        50′ × 50′ REINFORCED SLAB (t = {slabThicknessInches}″, Wslab = {slabWeightKips.toFixed(1)}k)
                      </text>

                      {/* Helical Piles Penetrating into Soil */}
                      {[170, 270, 370, 470].map((pileX, pIdx) => {
                        const plateRadius = Math.max(12, helixDiameterInches * 1.3);
                        return (
                          <g key={pIdx}>
                            {/* Steel Central Shaft */}
                            <line
                              x1={pileX}
                              y1="150"
                              x2={pileX}
                              y2={pileTipY}
                              stroke="#94a3b8"
                              strokeWidth="5"
                            />
                            {/* Helical Plate(s) */}
                            {Array.from({ length: helixCount }).map((_, hIdx) => {
                              const helixY = pileTipY - (hIdx * 24); // 24px vertical plate spacing
                              return (
                                <g key={hIdx}>
                                  {/* Soil Bearing Stress Bulb under the lowest plate */}
                                  {hIdx === 0 && (
                                    <path
                                      d={`M ${pileX - plateRadius * 1.6} ${helixY} Q ${pileX} ${helixY + plateRadius * 2.2} ${pileX + plateRadius * 1.6} ${helixY} Z`}
                                      fill="url(#stressBulb)"
                                    />
                                  )}
                                  {/* Helical Flange / Pitch Blade */}
                                  <ellipse
                                    cx={pileX}
                                    cy={helixY}
                                    rx={plateRadius}
                                    ry="5.5"
                                    fill="#10b981"
                                    stroke="#ecfdf5"
                                    strokeWidth="1.5"
                                  />
                                  {/* Helix Pitch Twist Line */}
                                  <path
                                    d={`M ${pileX - plateRadius + 2} ${helixY - 1} Q ${pileX} ${helixY + 5} ${pileX + plateRadius - 2} ${helixY + 1}`}
                                    fill="none"
                                    stroke="#047857"
                                    strokeWidth="1.5"
                                  />
                                </g>
                              );
                            })}
                            {/* Pile Point Tip */}
                            <polygon
                              points={`${pileX - 3.5},${pileTipY} ${pileX + 3.5},${pileTipY} ${pileX},${pileTipY + 8}`}
                              fill="#64748b"
                            />
                          </g>
                        );
                      })}

                      {/* Depth Dimension Line (Left Side) */}
                      <line x1="110" y1="150" x2="110" y2={pileTipY} stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="102" y1="150" x2="118" y2="150" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="102" y1={pileTipY} x2="118" y2={pileTipY} stroke="#94a3b8" strokeWidth="1.5" />
                      <text
                        x="100"
                        y={(150 + pileTipY) / 2}
                        fill="#cbd5e1"
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="end"
                        dominantBaseline="middle"
                      >
                        D = {pileDepthFt}′
                      </text>

                      {/* Helical Capacity Callout Box */}
                      <rect x="210" y={pileTipY + 14} width="220" height="30" fill="rgba(15, 23, 42, 0.95)" stroke={isBoringReport ? 'var(--accent-purple)' : '#10b981'} strokeWidth="1.5" rx="6" />
                      <text x="320" y={pileTipY + 33} fill={isBoringReport ? '#c084fc' : '#34d399'} fontSize="11" fontWeight="700" textAnchor="middle">
                        Qult = {pileUltCapacityKips.toFixed(1)} kips ({isBoringReport ? 'Boring Log' : 'Theoretical'})
                      </text>

                      {/* Hydrostatic Pore Pressure Distribution Triangle (Right Side, X: 610 - 740) */}
                      <g>
                        <text x="660" y="142" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">
                          Pore Pressure (u)
                        </text>
                        {/* Vertical Baseline */}
                        <line x1="620" y1="150" x2="620" y2="470" stroke="#475569" strokeWidth="1.5" />
                        {/* Above GWT: u = 0 */}
                        <line x1="620" y1="150" x2="620" y2={gwtY} stroke="#38bdf8" strokeWidth="3" />
                        {/* Below GWT: Triangular increase u = gamma_w * z_w */}
                        {depthBelowGwt > 0 && (
                          <>
                            <polygon
                              points={`620,${gwtY} 620,${pileTipY} ${620 + Math.min(100, (porePressureU / 25))},${pileTipY}`}
                              fill="url(#porePressureGrad)"
                              stroke="#38bdf8"
                              strokeWidth="1.5"
                            />
                            <text
                              x={625 + Math.min(95, (porePressureU / 25))}
                              y={pileTipY + 4}
                              fill="#7dd3fc"
                              fontSize="11"
                              fontWeight="700"
                            >
                              u = {porePressureU.toFixed(0)} psf
                            </text>
                          </>
                        )}
                        <text x="620" y={pileTipY + 25} fill="#94a3b8" fontSize="10">
                          σv′ = {sigmaPrimeV.toFixed(0)} psf
                        </text>
                      </g>
                    </g>
                  );
                })()}
              </svg>
            )}

            {/* TAB 2: Foundation Plan & Pile Grid (50' x 50') */}
            {activeTab === 'plan' && (
              <svg
                viewBox="0 0 600 480"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                {/* Background Grid */}
                <defs>
                  <pattern id="planSubGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="600" height="480" fill="url(#planSubGrid)" />

                {/* 50' x 50' Slab Outline (Center 340 x 340 px) */}
                <rect
                  x="130"
                  y="60"
                  width="340"
                  height="340"
                  fill="rgba(30, 41, 59, 0.7)"
                  stroke={activeGrid.color}
                  strokeWidth="3"
                  rx="6"
                />

                {/* Dimension Lines (50 ft width & length) */}
                {/* Horizontal Top */}
                <line x1="130" y1="40" x2="470" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="130" y1="35" x2="130" y2="45" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="470" y1="35" x2="470" y2="45" stroke="#94a3b8" strokeWidth="1.5" />
                <text x="300" y="32" fill="#f8fafc" fontSize="12" fontWeight="700" textAnchor="middle">
                  50.0 ft Slab Width
                </text>

                {/* Vertical Left */}
                <line x1="110" y1="60" x2="110" y2="400" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="105" y1="60" x2="115" y2="60" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="105" y1="400" x2="115" y2="400" stroke="#94a3b8" strokeWidth="1.5" />
                <text x="100" y="230" fill="#f8fafc" fontSize="12" fontWeight="700" textAnchor="end" dominantBaseline="middle">
                  50.0 ft
                </text>

                {/* Draw the k x k Helical Piles Grid */}
                {(() => {
                  const k = activeGrid.gridK;
                  const padding = 20; // edge set-back from slab corners
                  const innerWidth = 340 - (padding * 2);
                  const step = k > 1 ? innerWidth / (k - 1) : 0;

                  const pileElements = [];
                  for (let row = 0; row < k; row++) {
                    for (let col = 0; col < k; col++) {
                      const px = 130 + padding + col * step;
                      const py = 60 + padding + row * step;

                      pileElements.push(
                        <g key={`${row}-${col}`}>
                          {/* Radial Glow */}
                          <circle cx={px} cy={py} r="12" fill={activeGrid.bgGlow} />
                          {/* Outer Helical Plate Ring */}
                          <circle
                            cx={px}
                            cy={py}
                            r="9"
                            fill="#0b1120"
                            stroke={activeGrid.color}
                            strokeWidth="2"
                          />
                          {/* Central Shaft Core */}
                          <circle cx={px} cy={py} r="3.5" fill="#f8fafc" />
                          {/* Crosshair */}
                          <line x1={px - 6} y1={py} x2={px + 6} y2={py} stroke="#64748b" strokeWidth="0.8" />
                          <line x1={px} y1={py - 6} x2={px} y2={py + 6} stroke="#64748b" strokeWidth="0.8" />
                        </g>
                      );
                    }
                  }
                  return pileElements;
                })()}

                {/* Plan Metrics Banner */}
                <rect x="130" y="420" width="340" height="42" fill="rgba(15, 23, 42, 0.9)" stroke="var(--border-color)" strokeWidth="1" rx="8" />
                <text x="300" y="438" fill={activeGrid.color} fontSize="12" fontWeight="700" textAnchor="middle">
                  {activeGrid.label} ({activeGrid.badge}) : {activeGrid.gridK} × {activeGrid.gridK} Layout = {activeGrid.nInstalled} Piles
                </text>
                <text x="300" y="453" fill="#cbd5e1" fontSize="11" textAnchor="middle">
                  Pile Spacing: {activeGrid.spacingFt} ft On-Center • Qallow: {activeGrid.qAllow} kips
                </text>
              </svg>
            )}

            {/* TAB 3: Stress Depth Profile */}
            {activeTab === 'stress' && (
              <svg
                viewBox="0 0 600 440"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                {/* Axes */}
                <line x1="80" y1="40" x2="80" y2="380" stroke="#64748b" strokeWidth="2" />
                <line x1="80" y1="380" x2="540" y2="380" stroke="#64748b" strokeWidth="2" />
                <text x="540" y="375" fill="#cbd5e1" fontSize="11" fontWeight="700">Stress (psf)</text>
                <text x="75" y="30" fill="#cbd5e1" fontSize="11" fontWeight="700" textAnchor="end">Depth z (ft)</text>

                {/* Depth Ticks */}
                {(() => {
                  const maxDepthAxis = Math.max(40, Math.ceil(pileDepthFt / 10) * 10);
                  const ticks = [];
                  for (let d = 0; d <= maxDepthAxis; d += maxDepthAxis / 4) ticks.push(Math.round(d));
                  return ticks.map((d) => {
                    const y = 40 + (d / maxDepthAxis) * 340;
                    return (
                      <g key={d}>
                        <line x1="75" y1={y} x2="85" y2={y} stroke="#64748b" strokeWidth="1.5" />
                        <text x="70" y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end">{d}′</text>
                      </g>
                    );
                  });
                })()}

                {/* Stresses Plot at GL, GWT, and Pile Tip */}
                {(() => {
                  const maxDepthAxis = Math.max(40, Math.ceil(pileDepthFt / 10) * 10);
                  const maxStress = Math.max(4000, sigmaV * 1.15);
                  const xForStress = (s) => 80 + (s / maxStress) * 440;
                  const yForDepth = (d) => 40 + (d / maxDepthAxis) * 340;

                  const yGL = yForDepth(0);
                  const yGWT = yForDepth(Math.min(maxDepthAxis, waterTableDepthFt));
                  const yPile = yForDepth(pileDepthFt);

                  // Stress at GL
                  const sigV_0 = surchargePsf;
                  const u_0 = 0;
                  const sigEff_0 = sigV_0;

                  // Stress at GWT
                  const sigV_GWT = surchargePsf + gammaDry * Math.min(pileDepthFt, waterTableDepthFt);
                  const u_GWT = 0;
                  const sigEff_GWT = sigV_GWT;

                  // Stress at Pile Tip
                  const sigV_Tip = sigmaV;
                  const u_Tip = porePressureU;
                  const sigEff_Tip = sigmaPrimeV;

                  return (
                    <g>
                      {/* Water Table Indicator Line */}
                      <line x1="80" y1={yGWT} x2="540" y2={yGWT} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5,4" />
                      <text x="535" y={yGWT - 6} fill="#38bdf8" fontSize="10" textAnchor="end">GWT = {waterTableDepthFt}′</text>

                      {/* Total Vertical Stress Path (Red) */}
                      <polyline
                        points={`
                          ${xForStress(sigV_0)},${yGL}
                          ${xForStress(sigV_GWT)},${yGWT}
                          ${xForStress(sigV_Tip)},${yPile}
                        `}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="3"
                      />

                      {/* Pore Pressure Path (Cyan) */}
                      <polyline
                        points={`
                          ${xForStress(u_0)},${yGL}
                          ${xForStress(u_GWT)},${yGWT}
                          ${xForStress(u_Tip)},${yPile}
                        `}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                      />

                      {/* Effective Stress Path (Emerald Green) */}
                      <polyline
                        points={`
                          ${xForStress(sigEff_0)},${yGL}
                          ${xForStress(sigEff_GWT)},${yGWT}
                          ${xForStress(sigEff_Tip)},${yPile}
                        `}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.5"
                      />

                      {/* Point Markers at Bearing Depth */}
                      <circle cx={xForStress(sigV_Tip)} cy={yPile} r="5" fill="#f43f5e" />
                      <circle cx={xForStress(u_Tip)} cy={yPile} r="5" fill="#38bdf8" />
                      <circle cx={xForStress(sigEff_Tip)} cy={yPile} r="6" fill="#10b981" />

                      {/* Labels at Bearing Depth */}
                      <text x={xForStress(sigV_Tip) + 8} y={yPile - 4} fill="#f43f5e" fontSize="11" fontWeight="700">
                        σv = {sigV_Tip.toFixed(0)} psf
                      </text>
                      <text x={xForStress(sigEff_Tip) + 8} y={yPile + 14} fill="#10b981" fontSize="11" fontWeight="700">
                        σv′ = {sigEff_Tip.toFixed(0)} psf
                      </text>
                      <text x={xForStress(u_Tip) + 8} y={yPile + 4} fill="#38bdf8" fontSize="11" fontWeight="700">
                        u = {u_Tip.toFixed(0)} psf
                      </text>
                    </g>
                  );
                })()}

                {/* Legend */}
                <g transform="translate(180, 20)">
                  <line x1="0" y1="0" x2="25" y2="0" stroke="#f43f5e" strokeWidth="3" />
                  <text x="30" y="4" fill="#f43f5e" fontSize="11" fontWeight="600">Total Stress σv</text>

                  <line x1="140" y1="0" x2="165" y2="0" stroke="#38bdf8" strokeWidth="2.5" />
                  <text x="170" y="4" fill="#38bdf8" fontSize="11" fontWeight="600">Pore Pressure u</text>

                  <line x1="280" y1="0" x2="305" y2="0" stroke="#10b981" strokeWidth="3.5" />
                  <text x="310" y="4" fill="#10b981" fontSize="11" fontWeight="600">Effective Stress σv′</text>
                </g>
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
                <span>🧮</span> Step-by-Step Geotechnical Derivation & Numerical Substitution
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {showDerivation ? '▲ Collapse' : '▼ Expand'}
              </span>
            </div>

            {showDerivation && (
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                {/* Step 1 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '0.35rem' }}>
                    Step 1: Superstructure & Concrete Slab Dead Load
                  </div>
                  <div>
                    Slab Area: <code>50′ × 50′ = 2,500 sq ft</code><br />
                    Slab Self-Weight: <code>Wslab = 2,500 × ({slabThicknessInches} / 12) × {concreteDensityPcf} = {slabWeightLbs.toLocaleString()} lbs = {slabWeightKips.toFixed(1)} kips</code><br />
                    Surface Surcharge: <code>Qsurcharge = {surchargePsf} psf × 2,500 sq ft = {(surchargePsf * 2500).toLocaleString()} lbs = {surchargeTotalKips.toFixed(1)} kips</code><br />
                    <strong>Total Foundation Load: <code>Ptotal = {slabWeightKips.toFixed(1)} + {houseWeightKips} + {surchargeTotalKips.toFixed(1)} = {totalDownwardLoadKips.toFixed(1)} kips</code></strong>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.35rem' }}>
                    Step 2: Total Overburden Stress & Hydrostatic Pore Water Pressure
                  </div>
                  <div>
                    Depth in dry zone above GWT: <code>hdry = min({pileDepthFt}, {waterTableDepthFt}) = {depthAboveGwt} ft</code><br />
                    Depth in saturated zone below GWT: <code>hsat = max(0, {pileDepthFt} - {waterTableDepthFt}) = {depthBelowGwt} ft</code><br />
                    Total Vertical Stress: <code>σv = {surchargePsf} + ({gammaDry} × {depthAboveGwt}) + ({gammaSat} × {depthBelowGwt}) = {sigmaV.toFixed(1)} psf</code><br />
                    Hydrostatic Pore Water Pressure: <code>u = {depthBelowGwt} ft × 62.4 pcf = {porePressureU.toFixed(1)} psf</code><br />
                    <strong>Effective Vertical Stress: <code>σv′ = σv - u = {sigmaV.toFixed(1)} - {porePressureU.toFixed(1)} = {sigmaPrimeV.toFixed(1)} psf ({((sigmaPrimeV) / 1000).toFixed(3)} ksf)</code></strong>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.35rem' }}>
                    Step 3: Helical Pile Individual Bearing Capacity ({isBoringReport ? 'Geotechnical Soil Boring Log' : 'Terzaghi / Meyerhof Model'})
                  </div>
                  <div>
                    {isBoringReport ? (
                      <>
                        Direct Soil Boring Report Capacity: <code>qult = {boringReportQUltKsf} ksf = {(boringReportQUltKsf * 1000).toLocaleString()} psf</code><br />
                        Helix Projected Area: <code>Ah = (π/4) × ({helixDiameterInches} / 12)² = {helixAreaSqFt.toFixed(3)} sq ft</code><br />
                        Single Helix Capacity: <code>Qult,1 = {helixAreaSqFt.toFixed(3)} sq ft × {(boringReportQUltKsf * 1000).toLocaleString()} psf = {singleHelixUltKips.toFixed(1)} kips</code><br />
                        <strong>Total Ultimate Pile Capacity ({helixCount} {helixCount === 1 ? 'helix' : 'helices'}): <code>Qult = {pileUltCapacityKips.toFixed(1)} kips / pile</code></strong>
                      </>
                    ) : (
                      <>
                        Bearing capacity factors for φ′ = {phi}°: <code>Nq = {nq.toFixed(2)}, Nc = {nc.toFixed(2)}</code><br />
                        Helix Projected Area: <code>Ah = (π/4) × ({helixDiameterInches} / 12)² = {helixAreaSqFt.toFixed(3)} sq ft</code><br />
                        Unit Ultimate Bearing Capacity: <code>qult = ({c} × {nc.toFixed(2)}) + ({sigmaPrimeV.toFixed(1)} × {nq.toFixed(2)}) = {qUltPsf.toFixed(0)} psf ({qUltKsf.toFixed(2)} ksf)</code><br />
                        <strong>Ultimate Pile Capacity ({helixCount} {helixCount === 1 ? 'helix' : 'helices'}): <code>Qult = {helixCount} × {helixAreaSqFt.toFixed(3)} sq ft × {qUltPsf.toFixed(0)} psf = {pileUltCapacityKips.toFixed(1)} kips</code></strong>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '0.35rem' }}>
                    Step 4: Safety Factor Matrix Sizing ({activeGrid.label})
                  </div>
                  <div>
                    Allowable Pile Capacity: <code>Qallow = {pileUltCapacityKips.toFixed(1)} kips / {activeGrid.sf} = {activeGrid.qAllow} kips</code><br />
                    Minimum Piles Required: <code>Nreq = ⌈{totalDownwardLoadKips.toFixed(1)} / {activeGrid.qAllow}⌉ = {activeGrid.nReq} piles</code><br />
                    Square Foundation Grid: <code>k = ⌈√{activeGrid.nReq}⌉ = {activeGrid.gridK} ➔ {activeGrid.gridK} × {activeGrid.gridK} = {activeGrid.nInstalled} piles installed</code><br />
                    <strong>On-Center Pile Spacing: <code>S = 50 ft / ({activeGrid.gridK} - 1) = {activeGrid.spacingFt} ft O.C.</code></strong> (Operating SF = {activeGrid.operatingSf})
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // If fullscreen is active, render via Portal
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

      {/* Render practice problem viewer if problem is passed */}
      {problem && <GenericProblemViewer problem={problem} key={problem.id} />}
    </>
  );
};

export default HelicalHouseVisualizer;
