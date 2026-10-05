import { useState, useMemo } from 'react';

export default function StormwaterVisualizer({ problem }) {
  const [activeTab, setActiveTab] = useState(problem?.id === 206 ? 'detention' : 'rational');

  // Catchment Areas (acres)
  const [roofArea, setRoofArea] = useState(problem?.roofArea || 4.5);
  const [paveArea, setPaveArea] = useState(problem?.paveArea || 5.0);
  const [lawnArea, setLawnArea] = useState(problem?.lawnArea || 2.5);

  // Flow Path & Kirpich tc
  const [flowLength, setFlowLength] = useState(600);
  const [overlandSlope, setOverlandSlope] = useState(1.5); // %
  const [returnPeriod, setReturnPeriod] = useState(25); // years

  // Storm Pipe Parameters
  const [pipeSlope, setPipeSlope] = useState(problem?.pipeSlope || 0.008);
  const [manningN, setManningN] = useState(problem?.manningN || 0.012);

  // Detention Basin Parameters
  const [qAllow, setQAllow] = useState(problem?.qAllow || 12.0);
  const [stormDuration, setStormDuration] = useState(problem?.critDuration || 45.0);
  const [basinDepth, setBasinDepth] = useState(6.0); // ft

  // --- Calculations for Rational Runoff ---
  const runoff = useMemo(() => {
    const totalArea = roofArea + paveArea + lawnArea;
    const cRoof = 0.90;
    const cPave = 0.85;
    const cLawn = 0.20;

    // Weighted composite C
    const compC = totalArea > 0 
      ? (roofArea * cRoof + paveArea * cPave + lawnArea * cLawn) / totalArea 
      : 0.70;

    // Kirpich Time of Concentration: tc = 0.0078 * L^0.77 * S^(-0.385)
    // S in ft/ft (e.g. 1.5% = 0.015)
    const sDec = Math.max(0.001, overlandSlope / 100.0);
    const tcKirpich = Math.max(5.0, 0.0078 * Math.pow(flowLength, 0.77) * Math.pow(sDec, -0.385));

    // Rainfall intensity I = a / (tc + b) based on return period
    const coeffA = returnPeriod === 100 ? 165 : returnPeriod === 50 ? 145 : returnPeriod === 25 ? 125 : 95;
    const coeffB = 15;
    const intensity = coeffA / (tcKirpich + coeffB);

    // Peak discharge Q = C * I * A (cfs)
    const qPeak = compC * intensity * totalArea;

    // Manning's Full Flow Circular Pipe Sizing:
    // Q = (1.486 / n) * A * R^(2/3) * S^(1/2)
    // For full circular pipe: A = pi*D^2 / 4, R = D / 4
    // Q = (1.486 / n) * (pi*D^2/4) * (D/4)^(2/3) * S^(1/2) = (0.4632 / n) * D^(8/3) * S^(1/2)
    // D_ft = [ (Q * n) / (0.4632 * S^(1/2)) ]^(3/8) = [ (2.158 * Q * n) / S^(1/2) ]^(3/8)
    const dReqFt = Math.pow((2.1588 * qPeak * manningN) / Math.sqrt(pipeSlope), 3.0 / 8.0);
    const dReqIn = dReqFt * 12.0;

    // Standard commercial reinforced concrete pipe sizes: 12, 15, 18, 24, 30, 36, 42, 48, 54, 60, 72
    const stdSizes = [12, 15, 18, 21, 24, 27, 30, 36, 42, 48, 54, 60, 72];
    const selectedSizeIn = stdSizes.find(s => s >= dReqIn) || Math.ceil(dReqIn / 6) * 6;
    const selectedSizeFt = selectedSizeIn / 12.0;

    // Full flow capacity of selected size
    const aFull = (Math.PI * selectedSizeFt * selectedSizeFt) / 4.0;
    const rFull = selectedSizeFt / 4.0;
    const qFull = (1.486 / manningN) * aFull * Math.pow(rFull, 2.0 / 3.0) * Math.sqrt(pipeSlope);
    const vFull = aFull > 0 ? qPeak / aFull : 0;
    const velocityOk = vFull >= 2.5 && vFull <= 12.0;

    return {
      totalArea,
      compC,
      tcKirpich,
      intensity,
      qPeak,
      dReqIn,
      selectedSizeIn,
      qFull,
      vFull,
      velocityOk
    };
  }, [roofArea, paveArea, lawnArea, flowLength, overlandSlope, returnPeriod, pipeSlope, manningN]);

  // --- Calculations for Detention Basin ---
  const detention = useMemo(() => {
    // Modified Rational Hydrograph: Inflow intensity for storm duration td
    // Q_in(td) = C * I(td) * A
    const coeffA = returnPeriod === 100 ? 165 : returnPeriod === 50 ? 145 : returnPeriod === 25 ? 125 : 95;
    const iStorm = coeffA / (stormDuration + 15);
    const qIn = runoff.compC * iStorm * runoff.totalArea;

    // Net rate of storage: deltaQ = max(0, qIn - qAllow)
    const deltaQ = Math.max(0, qIn - qAllow);

    // Required storage volume: V = deltaQ * td * 60 (cu ft)
    const vReqCuFt = deltaQ * stormDuration * 60.0;
    const vReqAcreFt = vReqCuFt / 43560.0;
    const vReqCuYards = vReqCuFt / 27.0;

    // Estimated pond bottom surface area assuming trapezoidal 3:1 side slopes and given depth
    const pondAvgAreaSqFt = basinDepth > 0 ? vReqCuFt / basinDepth : 0;
    const pondAvgAreaAcres = pondAvgAreaSqFt / 43560.0;

    // Bottom orifice sizing: Q_allow = Cd * Ao * sqrt(2*g*H_eff)
    // H_eff = 2/3 * depth
    const hEff = (2.0 / 3.0) * basinDepth;
    const cd = 0.60;
    const g = 32.2;
    const reqAo = qAllow / (cd * Math.sqrt(2.0 * g * Math.max(0.5, hEff)));
    const reqDoFt = Math.sqrt((4.0 * reqAo) / Math.PI);
    const reqDoIn = reqDoFt * 12.0;

    // Hydrograph points for SVG
    const hydroPoints = [];
    const tMax = stormDuration * 2.5;
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * tMax;
      let qVal;
      if (t <= stormDuration) {
        qVal = (t / stormDuration) * qIn;
      } else if (t <= stormDuration * 2.0) {
        qVal = qIn * (1.0 - (t - stormDuration) / stormDuration);
      } else {
        qVal = 0;
      }
      hydroPoints.push({ t, q: qVal });
    }

    return {
      qIn,
      deltaQ,
      vReqCuFt,
      vReqAcreFt,
      vReqCuYards,
      pondAvgAreaSqFt,
      pondAvgAreaAcres,
      reqDoIn,
      hydroPoints,
      tMax
    };
  }, [runoff, qAllow, stormDuration, basinDepth, returnPeriod]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', marginTop: '1rem' }}>
      {/* Mode Selector Tabs */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`tab-btn ${activeTab === 'rational' ? 'active' : ''}`}
            onClick={() => setActiveTab('rational')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🌧️</span> Rational Runoff & Pipe Sizing (Q = C·I·A)
          </button>
          <button
            className={`tab-btn ${activeTab === 'detention' ? 'active' : ''}`}
            onClick={() => setActiveTab('detention')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🏊</span> Detention Basin Storage & Modified Rational
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="glass-badge" style={{ color: 'var(--accent-blue)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            Civil PE · Water Resources & Environmental
          </span>
        </div>
      </div>

      {activeTab === 'rational' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.2fr) minmax(360px, 1.8fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Controls Column */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>💧</span>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Drainage Catchment Inputs</h3>
                <span className="text-xs text-muted">Composite Runoff Coefficient & Kirpich tc</span>
              </div>
            </div>

            {/* Land Use Area Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted">Rooftops (C = 0.90):</label>
                  <span className="font-mono text-xs" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{roofArea.toFixed(1)} ac</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={roofArea}
                  onChange={(e) => setRoofArea(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted">Pavement / Parking (C = 0.85):</label>
                  <span className="font-mono text-xs" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{paveArea.toFixed(1)} ac</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={paveArea}
                  onChange={(e) => setPaveArea(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted">Lawn / Open Greenspace (C = 0.20):</label>
                  <span className="font-mono text-xs" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{lawnArea.toFixed(1)} ac</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={lawnArea}
                  onChange={(e) => setLawnArea(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                />
              </div>
            </div>

            {/* Composite C breakdown bar */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                <span className="text-muted">Total Catchment Area: <strong>{runoff.totalArea.toFixed(1)} ac</strong></span>
                <span className="font-mono" style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>C_comp = {runoff.compC.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${runoff.totalArea > 0 ? (roofArea / runoff.totalArea) * 100 : 0}%`, background: '#38bdf8' }} title="Roof" />
                <div style={{ width: `${runoff.totalArea > 0 ? (paveArea / runoff.totalArea) * 100 : 0}%`, background: '#06b6d4' }} title="Pavement" />
                <div style={{ width: `${runoff.totalArea > 0 ? (lawnArea / runoff.totalArea) * 100 : 0}%`, background: '#10b981' }} title="Lawn" />
              </div>
            </div>

            {/* Overland Flow Length & Ground Slope */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Flow Length (ft):</label>
                <input
                  type="number"
                  min="50"
                  max="3000"
                  step="50"
                  value={flowLength}
                  onChange={(e) => setFlowLength(parseFloat(e.target.value) || 50)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.45rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Slope (%):</label>
                <input
                  type="number"
                  min="0.2"
                  max="15"
                  step="0.1"
                  value={overlandSlope}
                  onChange={(e) => setOverlandSlope(parseFloat(e.target.value) || 0.5)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.45rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
            </div>

            {/* Design Return Period */}
            <div>
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Design Storm Frequency:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[10, 25, 50, 100].map((yr) => (
                  <button
                    key={yr}
                    className={`btn-secondary ${returnPeriod === yr ? 'active' : ''}`}
                    onClick={() => setReturnPeriod(yr)}
                    style={{
                      flex: 1,
                      padding: '0.35rem',
                      fontSize: '0.75rem',
                      background: returnPeriod === yr ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                      borderColor: returnPeriod === yr ? 'var(--accent-blue)' : 'var(--border-color)'
                    }}
                  >
                    {yr}-Yr
                  </button>
                ))}
              </div>
            </div>

            {/* Pipe Slope and Manning n */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Pipe Slope (ft/ft):</label>
                <input
                  type="number"
                  min="0.001"
                  max="0.05"
                  step="0.001"
                  value={pipeSlope}
                  onChange={(e) => setPipeSlope(parseFloat(e.target.value) || 0.005)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.45rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Pipe Manning n:</label>
                <select
                  value={manningN}
                  onChange={(e) => setManningN(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.45rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value={0.012}>0.012 (RCP Concrete)</option>
                  <option value={0.010}>0.010 (Smooth PVC)</option>
                  <option value={0.013}>0.013 (HDPE Dual-Wall)</option>
                  <option value={0.024}>0.024 (Corrugated Metal)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results & Visual Graphic Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Live Pipe Sizing & Hydrograph Banner */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Storm Sewer Sizing & Capacity
                </span>
                <span className="glass-badge" style={{ color: runoff.velocityOk ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                  {runoff.velocityOk ? '✓ Self-Cleansing (V ≥ 2.5 fps)' : '⚠ Check Velocity Limits'}
                </span>
              </div>

              {/* Graphic Pipe Cross Section */}
              <div style={{ background: '#080d1a', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1rem' }}>
                <svg viewBox="0 0 160 160" style={{ width: '140px', height: '140px' }}>
                  {/* Outer Pipe Wall */}
                  <circle cx="80" cy="80" r="70" fill="none" stroke="#475569" strokeWidth="12" />
                  {/* Inner Flow Area */}
                  <circle cx="80" cy="80" r="64" fill="#0f172a" />
                  {/* Water fill (proportional to Q / Q_full) */}
                  {(() => {
                    const fillRatio = Math.min(1.0, runoff.qPeak / Math.max(1, runoff.qFull));
                    const waterY = 80 + 64 * (1 - 2 * fillRatio);
                    return (
                      <g>
                        <clipPath id="pipeClip">
                          <circle cx="80" cy="80" r="64" />
                        </clipPath>
                        <rect x="16" y={waterY} width="128" height="128" fill="rgba(56, 189, 248, 0.45)" clipPath="url(#pipeClip)" />
                        <line x1="16" y1={waterY} x2="144" y2={waterY} stroke="#38bdf8" strokeWidth="2" clipPath="url(#pipeClip)" />
                      </g>
                    );
                  })()}
                  <text x="80" y="85" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="var(--font-mono)" textAnchor="middle">
                    {runoff.selectedSizeIn}" RCP
                  </text>
                  <text x="80" y="103" fill="#38bdf8" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="middle">
                    V = {runoff.vFull.toFixed(1)} fps
                  </text>
                </svg>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Peak Inflow (Q):</span>
                    <span className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{runoff.qPeak.toFixed(2)} cfs</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Exact D_required:</span>
                    <span className="font-mono" style={{ color: '#fff' }}>{runoff.dReqIn.toFixed(1)} inches</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Selected Standard:</span>
                    <span className="font-mono" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{runoff.selectedSizeIn} inches</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Full Pipe Capacity:</span>
                    <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{runoff.qFull.toFixed(1)} cfs</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Rainfall Intensity (I):</span>
                    <span className="font-mono" style={{ color: 'var(--accent-amber)' }}>{runoff.intensity.toFixed(2)} in/hr</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Bento Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-blue)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Peak Flow (Q)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {runoff.qPeak.toFixed(2)} cfs
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Q = C · I · A
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-amber)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Time of Conc. (tc)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {runoff.tcKirpich.toFixed(1)} min
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Kirpich Formula
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-emerald)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Storm Pipe Diameter</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {runoff.selectedSizeIn}" RCP
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Manning's Full Flow
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-cyan)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Full Flow Velocity</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {runoff.vFull.toFixed(2)} fps
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  V = Q / Area
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Detention Basin Visualizer */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.2fr) minmax(360px, 1.8fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Detention Controls */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🏊</span>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Basin Storage & Release Rate</h3>
                <span className="text-xs text-muted">Modified Rational Triangular Routing</span>
              </div>
            </div>

            {/* Allowable Release Rate Q_allow */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Allowable Pre-Dev Release (Q_out):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{qAllow.toFixed(1)} cfs</span>
              </div>
              <input
                type="range"
                min="2"
                max="50"
                step="0.5"
                value={qAllow}
                onChange={(e) => setQAllow(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
              />
            </div>

            {/* Storm Duration td */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Storm Duration (t_d):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{stormDuration.toFixed(0)} min</span>
              </div>
              <input
                type="range"
                min="15"
                max="120"
                step="5"
                value={stormDuration}
                onChange={(e) => setStormDuration(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>

            {/* Basin Depth */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Design Pond Depth (ft):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{basinDepth.toFixed(1)} ft</span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                step="0.5"
                value={basinDepth}
                onChange={(e) => setBasinDepth(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
            </div>

            {/* Formula Explanation Callout */}
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ color: 'var(--accent-blue)', fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                📐 Governing Storage Equation
              </div>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.4', margin: 0 }}>
                <code>V_req = (Q_in - Q_allow) · t_d · 60 sec</code><br />
                The peak volume occurs when rainfall duration balances maximum intensity against storage duration deficit.
              </p>
            </div>
          </div>

          {/* Detention Results & SVG Hydrograph */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Inflow vs Outflow Hydrograph Routing
                </span>
                <span className="glass-badge" style={{ color: 'var(--accent-cyan)' }}>
                  Peak Inflow: {detention.qIn.toFixed(1)} cfs
                </span>
              </div>

              <div style={{ background: '#080d1a', borderRadius: '10px', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <svg viewBox="0 0 520 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="storageFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(56, 189, 248, 0.45)" />
                      <stop offset="100%" stopColor="rgba(56, 189, 248, 0.05)" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="50" y1="180" x2="480" y2="180" stroke="rgba(255,255,255,0.08)" />
                  <line x1="50" y1="30" x2="50" y2="180" stroke="rgba(255,255,255,0.08)" />

                  {(() => {
                    const maxQ = Math.max(detention.qIn * 1.25, qAllow * 1.5, 20);
                    const qToY = (q) => 180 - (q / maxQ) * 140;
                    const tToX = (t) => 50 + (t / detention.tMax) * 420;

                    const peakX = tToX(stormDuration);
                    const peakY = qToY(detention.qIn);
                    const endX = tToX(stormDuration * 2.0);
                    const allowY = qToY(qAllow);

                    // Path for inflow hydrograph
                    const hydroPath = `M 50 180 L ${peakX} ${peakY} L ${endX} 180 Z`;

                    return (
                      <g>
                        {/* Shaded required storage polygon (above allowable release line) */}
                        <path
                          d={`M ${tToX(stormDuration * (qAllow / detention.qIn))} ${allowY} L ${peakX} ${peakY} L ${tToX(stormDuration * (2.0 - qAllow / detention.qIn))} ${allowY} Z`}
                          fill="url(#storageFill)"
                          stroke="rgba(56,189,248,0.5)"
                          strokeWidth="1.5"
                        />

                        {/* Inflow Hydrograph Triangle */}
                        <path d={hydroPath} fill="none" stroke="#38bdf8" strokeWidth="3" />

                        {/* Outflow Allowable Release Horizontal Line */}
                        <line x1="50" y1={allowY} x2="480" y2={allowY} stroke="#10b981" strokeWidth="2.5" strokeDasharray="5 3" />
                        <text x="475" y={allowY - 8} fill="#10b981" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="end" fontWeight="bold">
                          Q_allow = {qAllow.toFixed(1)} cfs
                        </text>

                        {/* Peak Inflow label */}
                        <circle cx={peakX} cy={peakY} r="4.5" fill="#38bdf8" />
                        <text x={peakX} y={peakY - 10} fill="#38bdf8" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle" fontWeight="bold">
                          Q_peak = {detention.qIn.toFixed(1)} cfs
                        </text>

                        {/* Storage Volume callout */}
                        <text x={peakX} y={Math.max(peakY + 35, allowY - 12)} fill="#f1f5f9" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="middle" fontWeight="bold">
                          Storage Deficit: {detention.vReqAcreFt.toFixed(2)} Ac-Ft
                        </text>

                        {/* Time labels */}
                        <text x="50" y="196" fill="#64748b" fontSize="10" fontFamily="var(--font-mono)">0</text>
                        <text x={peakX} y="196" fill="#64748b" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle">td = {stormDuration}m</text>
                        <text x={endX} y="196" fill="#64748b" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle">2·td</text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Detention Results Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-cyan)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Required Storage (Ac-Ft)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {detention.vReqAcreFt.toFixed(2)} ac-ft
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  {detention.vReqCuFt.toLocaleString()} cu ft
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-amber)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Earthwork Excavation</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {Math.round(detention.vReqCuYards).toLocaleString()} CY
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Vol / 27 cu ft/yd³
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-emerald)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Outlet Orifice Diameter</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {detention.reqDoIn.toFixed(1)} inches
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Q = 0.60 · A · √(2gH)
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-rose)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Pond Footprint Area</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                  {detention.pondAvgAreaAcres.toFixed(2)} acres
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  @ {basinDepth.toFixed(1)} ft Average Depth
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
