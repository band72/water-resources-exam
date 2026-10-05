import { useState, useMemo } from 'react';

export default function SoilPhaseEarthworkVisualizer({ problem }) {
  const [activeTab, setActiveTab] = useState(problem?.id === 208 ? 'earthwork' : 'phase');

  // --- 3-Phase Soil Parameters ---
  const [totalVol, setTotalVol] = useState(problem?.totalVolume || 0.050); // ft³
  const [wetWeight, setWetWeight] = useState(problem?.totalWeight || 6.10); // lb
  const [dryWeight, setDryWeight] = useState(problem?.dryWeight || 5.25); // lb
  const [gs, setGs] = useState(problem?.gs || 2.70);

  // --- Earthwork Parameters ---
  const [ccyReq, setCcyReq] = useState(problem?.ccyReq || 24000); // CCY
  const [gammaBank, setGammaBank] = useState(problem?.gammaBank || 115.0); // pcf
  const [gammaCompact, setGammaCompact] = useState(problem?.gammaCompact || 125.0); // pcf
  const [swellPct, setSwellPct] = useState(25.0); // %
  const [truckCap, setTruckCap] = useState(problem?.truckCap || 16.0); // LCY
  const [wBorrow, setWBorrow] = useState(problem?.wBorrow || 8.0); // %
  const [wOpt, setWOpt] = useState(problem?.wOpt || 13.0); // %

  const gammaWater = 62.4; // pcf

  // --- 3-Phase Calculations ---
  const phase = useMemo(() => {
    const W_w = Math.max(0, wetWeight - dryWeight);
    const W_s = dryWeight;
    const w = W_s > 0 ? (W_w / W_s) * 100.0 : 0; // %

    // Volumes (ft³)
    const V_s = (gs * gammaWater) > 0 ? W_s / (gs * gammaWater) : 0;
    const V_w = W_w / gammaWater;
    const V_v = Math.max(0, totalVol - V_s);
    const V_a = Math.max(0, V_v - V_w);

    // Phase Ratios
    const e = V_s > 0 ? V_v / V_s : 0;
    const n = totalVol > 0 ? (V_v / totalVol) * 100.0 : 0; // %
    const S = V_v > 0 ? Math.min(100.0, (V_w / V_v) * 100.0) : 0; // %

    // Unit weights (pcf)
    const gammaTotal = totalVol > 0 ? wetWeight / totalVol : 0;
    const gammaDry = totalVol > 0 ? dryWeight / totalVol : 0;
    const gammaSat = (1.0 + e) > 0 ? ((gs + e) / (1.0 + e)) * gammaWater : 0;
    const gammaSub = Math.max(0, gammaSat - gammaWater);

    return {
      W_w,
      W_s,
      w,
      V_s,
      V_w,
      V_v,
      V_a,
      e,
      n,
      S,
      gammaTotal,
      gammaDry,
      gammaSat,
      gammaSub
    };
  }, [totalVol, wetWeight, dryWeight, gs]);

  // --- Earthwork Calculations ---
  const earth = useMemo(() => {
    // Conservation of solids: BCY * gammaBank = CCY * gammaCompact
    const bcyReq = gammaBank > 0 ? ccyReq * (gammaCompact / gammaBank) : 0;
    // Loose volume: LCY = BCY * (1 + swell / 100)
    const lcyReq = bcyReq * (1.0 + swellPct / 100.0);
    // Truck trips
    const truckTrips = truckCap > 0 ? Math.ceil(lcyReq / truckCap) : 0;

    // Moisture addition:
    // deltaW = (wOpt - wBorrow) / 100
    const deltaW = Math.max(0, (wOpt - wBorrow) / 100.0);
    // Total dry weight: W_s = CCY * 27 * gammaCompact
    const totalDryWeight = ccyReq * 27.0 * gammaCompact;
    const waterWeightReq = totalDryWeight * deltaW;
    const waterGallons = waterWeightReq / 8.34; // 8.34 lb/gal

    return {
      bcyReq,
      lcyReq,
      truckTrips,
      waterGallons,
      totalDryWeight
    };
  }, [ccyReq, gammaBank, gammaCompact, swellPct, truckCap, wBorrow, wOpt]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', marginTop: '1rem' }}>
      {/* Mode Selector Tabs */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`tab-btn ${activeTab === 'phase' ? 'active' : ''}`}
            onClick={() => setActiveTab('phase')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🪨</span> 3-Phase Soil Diagram & Relationships
          </button>
          <button
            className={`tab-btn ${activeTab === 'earthwork' ? 'active' : ''}`}
            onClick={() => setActiveTab('earthwork')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🚜</span> Earthwork Cut/Fill, Swell & Haul Cycles
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="glass-badge" style={{ color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            Civil PE · Soil Mechanics & Foundations
          </span>
        </div>
      </div>

      {activeTab === 'phase' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.2fr) minmax(360px, 1.8fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Controls Column */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔬</span>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Laboratory Soil Sample Data</h3>
                <span className="text-xs text-muted">Field Weights, Dry Weights & Specific Gravity</span>
              </div>
            </div>

            {/* Total Wet Weight W */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Total Wet Weight (W):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{wetWeight.toFixed(2)} lb</span>
              </div>
              <input
                type="number"
                min="0.5"
                max="50"
                step="0.05"
                value={wetWeight}
                onChange={(e) => setWetWeight(parseFloat(e.target.value) || 0.1)}
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

            {/* Dry Solids Weight Ws */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Oven-Dry Solids Weight (W_s):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{dryWeight.toFixed(2)} lb</span>
              </div>
              <input
                type="number"
                min="0.1"
                max={wetWeight}
                step="0.05"
                value={dryWeight}
                onChange={(e) => setDryWeight(parseFloat(e.target.value) || 0.1)}
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

            {/* Total Volume V */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Total Mold Volume (V):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{totalVol.toFixed(4)} ft³</span>
              </div>
              <input
                type="number"
                min="0.005"
                max="1.0"
                step="0.005"
                value={totalVol}
                onChange={(e) => setTotalVol(parseFloat(e.target.value) || 0.01)}
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
              <span className="text-xs text-muted" style={{ fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>
                Standard Proctor Mold = 1/30 ft³ (0.0333 ft³) | Modified = 0.075 ft³
              </span>
            </div>

            {/* Specific Gravity Gs */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Specific Gravity of Solids (G_s):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{gs.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="2.50"
                max="2.85"
                step="0.01"
                value={gs}
                onChange={(e) => setGs(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                <span>2.55 (Organic/Sand)</span>
                <span>2.65 (Quartz)</span>
                <span>2.75 (Clay/Silt)</span>
              </div>
            </div>
          </div>

          {/* Results & Visual Graphic Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Proportional 3-Phase Soil Block Diagram */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Proportional 3-Phase Soil Diagram
                </span>
                <span className="glass-badge" style={{ color: 'var(--accent-cyan)' }}>
                  S = {phase.S.toFixed(1)}% Saturation
                </span>
              </div>

              <div style={{ background: '#080d1a', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <svg viewBox="0 0 500 240" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {(() => {
                    const blockX = 140;
                    const blockW = 220;
                    const topY = 30;
                    const totalH = 180;

                    // Proportions based on volume
                    const vTot = Math.max(0.001, totalVol);
                    const hAir = Math.max(8, (phase.V_a / vTot) * totalH);
                    const hWater = Math.max(8, (phase.V_w / vTot) * totalH);
                    const hSolids = Math.max(20, totalH - hAir - hWater);

                    const yAir = topY;
                    const yWater = yAir + hAir;
                    const ySolids = yWater + hWater;

                    return (
                      <g>
                        {/* AIR Layer */}
                        <rect x={blockX} y={yAir} width={blockW} height={hAir} fill="rgba(148, 163, 184, 0.15)" stroke="#64748b" strokeWidth="1.5" />
                        <text x={blockX + blockW / 2} y={yAir + hAir / 2 + 4} fill="#cbd5e1" fontSize="12" fontWeight="bold" textAnchor="middle">
                          AIR (V_a = {phase.V_a.toFixed(4)} ft³)
                        </text>
                        {/* Left Volume / Right Weight for Air */}
                        <text x={blockX - 10} y={yAir + hAir / 2 + 4} fill="#94a3b8" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="end">
                          V_a: {(phase.V_a * 100 / vTot).toFixed(1)}%
                        </text>
                        <text x={blockX + blockW + 10} y={yAir + hAir / 2 + 4} fill="#94a3b8" fontSize="10.5" fontFamily="var(--font-mono)">
                          W_a = 0.00 lb
                        </text>

                        {/* WATER Layer */}
                        <rect x={blockX} y={yWater} width={blockW} height={hWater} fill="rgba(56, 189, 248, 0.35)" stroke="#38bdf8" strokeWidth="1.5" />
                        <text x={blockX + blockW / 2} y={yWater + hWater / 2 + 4} fill="#38bdf8" fontSize="12" fontWeight="bold" textAnchor="middle">
                          WATER (V_w = {phase.V_w.toFixed(4)} ft³)
                        </text>
                        {/* Left Volume / Right Weight for Water */}
                        <text x={blockX - 10} y={yWater + hWater / 2 + 4} fill="#38bdf8" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="end">
                          V_w: {(phase.V_w * 100 / vTot).toFixed(1)}%
                        </text>
                        <text x={blockX + blockW + 10} y={yWater + hWater / 2 + 4} fill="#38bdf8" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="bold">
                          W_w = {phase.W_w.toFixed(2)} lb
                        </text>

                        {/* SOLIDS Layer */}
                        <rect x={blockX} y={ySolids} width={blockW} height={hSolids} fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" strokeWidth="1.5" />
                        <text x={blockX + blockW / 2} y={ySolids + hSolids / 2 + 4} fill="#f59e0b" fontSize="12" fontWeight="bold" textAnchor="middle">
                          SOLIDS (V_s = {phase.V_s.toFixed(4)} ft³)
                        </text>
                        {/* Left Volume / Right Weight for Solids */}
                        <text x={blockX - 10} y={ySolids + hSolids / 2 + 4} fill="#f59e0b" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="end">
                          V_s: {(phase.V_s * 100 / vTot).toFixed(1)}%
                        </text>
                        <text x={blockX + blockW + 10} y={ySolids + hSolids / 2 + 4} fill="#f59e0b" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="bold">
                          W_s = {phase.W_s.toFixed(2)} lb
                        </text>

                        {/* Top Total Indicators */}
                        <text x={blockX - 10} y="20" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="end">
                          VOLUMES (V = {totalVol.toFixed(3)} ft³)
                        </text>
                        <text x={blockX + blockW + 10} y="20" fill="#94a3b8" fontSize="11" fontWeight="bold">
                          WEIGHTS (W = {wetWeight.toFixed(2)} lb)
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Results Bento Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-cyan)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Void Ratio (e)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {phase.e.toFixed(3)}
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  e = V_v / V_s
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-blue)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Porosity (n)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {phase.n.toFixed(1)}%
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  n = e / (1 + e)
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-emerald)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Dry Unit Weight (γ_d)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {phase.gammaDry.toFixed(1)} pcf
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  γ_d = W_s / V
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-amber)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Moisture Content (w)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {phase.w.toFixed(1)}%
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  w = W_w / W_s
                </span>
              </div>
            </div>

            {/* Secondary Phase Densities Table */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#fff' }}>Associated Soil Densities</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">Total / Moist Density (γ):</span>
                  <span className="font-mono" style={{ color: '#fff' }}>{phase.gammaTotal.toFixed(1)} pcf</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">Saturated Density (γ_sat):</span>
                  <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{phase.gammaSat.toFixed(1)} pcf</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">Submerged / Buoyant Density (γ'):</span>
                  <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{phase.gammaSub.toFixed(1)} pcf</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">Air Voids Volume (V_a):</span>
                  <span className="font-mono" style={{ color: '#cbd5e1' }}>{phase.V_a.toFixed(4)} ft³</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Earthwork Cut/Fill & Haul Simulator */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.2fr) minmax(360px, 1.8fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Earthwork Controls */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🚜</span>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Embankment & Borrow Pit Specifications</h3>
                <span className="text-xs text-muted">Density Ratios, Swell Factor & Haul Truck Sizing</span>
              </div>
            </div>

            {/* Required Compacted Embankment Volume */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Required Fill Embankment (CCY):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{ccyReq.toLocaleString()} CCY</span>
              </div>
              <input
                type="number"
                min="500"
                max="500000"
                step="500"
                value={ccyReq}
                onChange={(e) => setCcyReq(parseFloat(e.target.value) || 0)}
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

            {/* Densities: Bank vs Compacted */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Bank Dry Density (pcf):</label>
                <input
                  type="number"
                  min="80"
                  max="140"
                  step="1"
                  value={gammaBank}
                  onChange={(e) => setGammaBank(parseFloat(e.target.value) || 100)}
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
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Compacted Spec (pcf):</label>
                <input
                  type="number"
                  min="80"
                  max="145"
                  step="1"
                  value={gammaCompact}
                  onChange={(e) => setGammaCompact(parseFloat(e.target.value) || 110)}
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

            {/* Swell Percentage */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Borrow Soil Swell Factor (S_w %):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>+{swellPct.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={swellPct}
                onChange={(e) => setSwellPct(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                <span>10% (Sand/Gravel)</span>
                <span>25% (Common Earth)</span>
                <span>40% (Dense Clay/Rock)</span>
              </div>
            </div>

            {/* Haul Truck Capacity */}
            <div>
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Dump Truck Hauler Struck Capacity:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[12, 14, 16, 20].map((cap) => (
                  <button
                    key={cap}
                    className={`btn-secondary ${truckCap === cap ? 'active' : ''}`}
                    onClick={() => setTruckCap(cap)}
                    style={{
                      flex: 1,
                      padding: '0.35rem',
                      fontSize: '0.8rem',
                      background: truckCap === cap ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.04)',
                      borderColor: truckCap === cap ? 'var(--accent-amber)' : 'var(--border-color)'
                    }}
                  >
                    {cap} LCY
                  </button>
                ))}
              </div>
            </div>

            {/* Moisture Conditioning: Borrow vs OMC */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Borrow Pit Moisture (%):</label>
                <input
                  type="number"
                  min="2"
                  max="25"
                  step="0.5"
                  value={wBorrow}
                  onChange={(e) => setWBorrow(parseFloat(e.target.value) || 0)}
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
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Optimum OMC (%):</label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  step="0.5"
                  value={wOpt}
                  onChange={(e) => setWOpt(parseFloat(e.target.value) || 0)}
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
          </div>

          {/* Earthwork Results & Flow Graphic */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Volume Transformation & Bulkage Balance
                </span>
                <span className="glass-badge" style={{ color: 'var(--accent-amber)' }}>
                  Density Ratio: {(gammaCompact / gammaBank).toFixed(3)}
                </span>
              </div>

              {/* Graphic Flow of Volumes */}
              <div style={{ background: '#080d1a', borderRadius: '10px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
                  {/* Step 1: Bank (BCY) */}
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>⛏️</span>
                    <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>Borrow Excavation</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', display: 'block', margin: '0.3rem 0' }}>
                      {Math.round(earth.bcyReq).toLocaleString()} BCY
                    </strong>
                    <span className="text-xs text-dim">@ {gammaBank} pcf</span>
                  </div>

                  <span style={{ fontSize: '1.25rem', color: '#64748b' }}>➔</span>

                  {/* Step 2: Loose (LCY) */}
                  <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🚛</span>
                    <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>Truck Haulage</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', display: 'block', margin: '0.3rem 0' }}>
                      {Math.round(earth.lcyReq).toLocaleString()} LCY
                    </strong>
                    <span className="text-xs text-dim">+{swellPct}% Swell</span>
                  </div>

                  <span style={{ fontSize: '1.25rem', color: '#64748b' }}>➔</span>

                  {/* Step 3: Compacted (CCY) */}
                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🏗️</span>
                    <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>Compacted Embankment</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', display: 'block', margin: '0.3rem 0' }}>
                      {ccyReq.toLocaleString()} CCY
                    </strong>
                    <span className="text-xs text-dim">@ {gammaCompact} pcf</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Earthwork Results Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-amber)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Excavation (BCY)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {Math.round(earth.bcyReq).toLocaleString()} BCY
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  CCY · (γ_compact / γ_bank)
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-blue)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Dump Truck Trips</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {earth.truckTrips.toLocaleString()} Loads
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  @ {truckCap} LCY Struck Capacity
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-cyan)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Compaction Water Req.</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {Math.round(earth.waterGallons).toLocaleString()} gal
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Δw = {(wOpt - wBorrow).toFixed(1)}% to reach OMC
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-emerald)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Water Trucks Needed</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {Math.ceil(earth.waterGallons / 4000)} Trucks
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  @ 4,000 Gallon Water Truck Tank
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
