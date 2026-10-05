import { useState, useMemo } from 'react';

export default function PumpSystemVisualizer({ problem }) {
  // Static & System Head Parameters
  const [hStat, setHStat] = useState(problem?.hStat || 115.0);
  const [pipeLength, setPipeLength] = useState(problem?.pipeLength || 3200);
  const [pipeDiamIn, setPipeDiamIn] = useState(problem?.pipeDiamIn || 12.0);
  const [hazenC, setHazenC] = useState(problem?.hazenC || 120);

  // Pump Characteristics
  const [hShutoff, setHShutoff] = useState(problem?.hShutoff || 180.0);
  const pumpCoeff = 0.000035;
  const [efficiency, setEfficiency] = useState((problem?.efficiency || 0.78) * 100); // %

  // Cavitation / NPSH Parameters
  const [suctionLift, setSuctionLift] = useState(problem?.suctionLift || 8.0); // ft
  const suctionLoss = 2.5; // ft
  const [npshR, setNpshR] = useState(problem?.npshR || 14.0); // ft
  const waterTempF = 68; // °F

  // --- System Calculations ---
  const calc = useMemo(() => {
    const dFt = pipeDiamIn / 12.0;

    // Hazen-Williams Head Loss:
    // h_f (ft) = 10.44 * L / (C^1.852 * D^4.87) * Q_cfs^1.852
    // With Q in gpm (1 cfs = 448.83 gpm):
    // k_hw = [ 10.44 * L / (C^1.852 * D^4.87) ] * (1 / 448.83^1.852)
    // Approximate as quadratic k_sys * Q_gpm^2 near design point for clean curve intersection:
    const kSys = (10.44 * pipeLength) / (Math.pow(hazenC, 1.852) * Math.pow(dFt, 4.87) * Math.pow(448.83, 1.852)) * 1.08;

    // Intersection: H_shutoff - pumpCoeff * Q^2 = H_stat + kSys * Q^2
    // (pumpCoeff + kSys) * Q^2 = H_shutoff - H_stat
    const deltaH = hShutoff - hStat;
    let qOp = 0;
    let hOp = hStat;

    if (deltaH > 0 && (pumpCoeff + kSys) > 0) {
      qOp = Math.sqrt(deltaH / (pumpCoeff + kSys));
      hOp = hShutoff - pumpCoeff * qOp * qOp;
    }

    // Horsepower
    const effDec = Math.max(0.1, efficiency / 100.0);
    const whp = (qOp * hOp) / 3960.0;
    const bhp = whp / effDec;
    const kw = bhp * 0.7457;
    // Annual electric cost at $0.12/kWh running 4,000 hrs/yr
    const annualEnergyCost = kw * 4000 * 0.12;

    // NPSH Calculations:
    // Standard Atmospheric: P_atm / gamma = 33.9 ft
    // Vapor pressure of water:
    // At 68°F: 0.78 ft | 100°F: 2.15 ft | 140°F: 6.7 ft
    const pVapFt = waterTempF <= 68 ? 0.78 : waterTempF <= 100 ? 2.15 : 6.70;
    const pAtmFt = 33.9;
    // NPSHA = P_atm/gamma - z_suction - h_f_suction - P_vap/gamma
    const npshA = pAtmFt - suctionLift - suctionLoss - pVapFt;
    const npshMargin = npshA - npshR;
    const cavitationSafe = npshA >= npshR * 1.25;

    // Chart curve points
    const qMax = Math.max(1000, Math.ceil((qOp * 1.5) / 100) * 100);
    const chartSteps = 40;
    const pumpCurve = [];
    const sysCurve = [];

    for (let i = 0; i <= chartSteps; i++) {
      const q = (i / chartSteps) * qMax;
      const hP = Math.max(0, hShutoff - pumpCoeff * q * q);
      const hS = hStat + kSys * q * q;
      pumpCurve.push({ q, h: hP });
      sysCurve.push({ q, h: hS });
    }

    return {
      kSys,
      qOp,
      hOp,
      whp,
      bhp,
      kw,
      annualEnergyCost,
      npshA,
      npshMargin,
      cavitationSafe,
      qMax,
      pumpCurve,
      sysCurve
    };
  }, [hStat, pipeLength, pipeDiamIn, hazenC, hShutoff, pumpCoeff, efficiency, suctionLift, suctionLoss, npshR, waterTempF]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', marginTop: '1rem' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.4rem' }}>⚡</span>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Pump Hydraulics & System Operating Duty Point</h3>
            <span className="text-xs text-muted">Total Dynamic Head (TDH), Pump vs System Curve & NPSH Cavitation Check</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="glass-badge" style={{ color: calc.cavitationSafe ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
            {calc.cavitationSafe ? '✓ Safe from Cavitation' : '⚠ Cavitation Risk (NPSHA < 1.25·NPSHR)'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.2fr) minmax(360px, 1.8fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Controls Column */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🚰</span>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Pipeline & System Head Inputs</h3>
              <span className="text-xs text-muted">Static Lift, Friction & Minor Losses</span>
            </div>
          </div>

          {/* Static Head */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Static Head / Elevation Lift (H_stat):</label>
              <span className="font-mono text-xs" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{hStat.toFixed(1)} ft</span>
            </div>
            <input
              type="range"
              min="20"
              max="250"
              step="5"
              value={hStat}
              onChange={(e) => setHStat(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
            />
          </div>

          {/* Pipe Length & Diameter */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Pipe Length (ft):</label>
              <input
                type="number"
                min="100"
                max="20000"
                step="100"
                value={pipeLength}
                onChange={(e) => setPipeLength(parseFloat(e.target.value) || 100)}
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
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Diameter (inches):</label>
              <input
                type="number"
                min="4"
                max="48"
                step="2"
                value={pipeDiamIn}
                onChange={(e) => setPipeDiamIn(parseFloat(e.target.value) || 6)}
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

          {/* Hazen-Williams C & Pump Efficiency */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Hazen-Williams C:</label>
              <input
                type="number"
                min="80"
                max="150"
                step="5"
                value={hazenC}
                onChange={(e) => setHazenC(parseFloat(e.target.value) || 100)}
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
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Efficiency (η %):</label>
              <input
                type="number"
                min="40"
                max="92"
                step="1"
                value={efficiency}
                onChange={(e) => setEfficiency(parseFloat(e.target.value) || 70)}
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

          {/* Pump Shutoff Head */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Pump Shutoff Head (H_0):</label>
              <span className="font-mono text-xs" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{hShutoff.toFixed(1)} ft</span>
            </div>
            <input
              type="range"
              min="100"
              max="350"
              step="5"
              value={hShutoff}
              onChange={(e) => setHShutoff(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          {/* Suction Lift & NPSHR for Cavitation Check */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Cavitation & Suction Conditions
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Suction Lift (ft):</label>
                <input
                  type="number"
                  min="0"
                  max="25"
                  step="0.5"
                  value={suctionLift}
                  onChange={(e) => setSuctionLift(parseFloat(e.target.value) || 0)}
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
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>Mfr NPSH_R (ft):</label>
                <input
                  type="number"
                  min="5"
                  max="30"
                  step="0.5"
                  value={npshR}
                  onChange={(e) => setNpshR(parseFloat(e.target.value) || 10)}
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
        </div>

        {/* Results & Visual Graphic Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Interactive Pump vs System Curve Chart */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Pump Characteristic vs System Head Curve
              </span>
              <span className="glass-badge" style={{ color: 'var(--accent-cyan)' }}>
                Operating Point: ({Math.round(calc.qOp)} gpm, {calc.hOp.toFixed(1)} ft)
              </span>
            </div>

            <div style={{ background: '#080d1a', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <svg viewBox="0 0 520 250" style={{ width: '100%', height: 'auto', display: 'block' }}>
                {(() => {
                  const left = 55;
                  const right = 490;
                  const bottom = 210;
                  const top = 30;

                  const maxH = Math.max(hShutoff * 1.15, calc.hOp * 1.25, 200);
                  const qToX = (q) => left + (q / calc.qMax) * (right - left);
                  const hToY = (h) => bottom - (h / maxH) * (bottom - top);

                  // Paths
                  const pumpPath = calc.pumpCurve
                    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${qToX(pt.q).toFixed(1)} ${hToY(pt.h).toFixed(1)}`)
                    .join(' ');

                  const sysPath = calc.sysCurve
                    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${qToX(pt.q).toFixed(1)} ${hToY(pt.h).toFixed(1)}`)
                    .join(' ');

                  const opX = qToX(calc.qOp);
                  const opY = hToY(calc.hOp);

                  return (
                    <g>
                      {/* Axes */}
                      <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="rgba(255,255,255,0.12)" />
                      <line x1={left} y1={top} x2={left} y2={bottom} stroke="rgba(255,255,255,0.12)" />

                      {/* Static Head Baseline */}
                      <line x1={left} y1={hToY(hStat)} x2={right} y2={hToY(hStat)} stroke="rgba(16, 185, 129, 0.4)" strokeDasharray="4 3" />
                      <text x={right - 10} y={hToY(hStat) - 6} fill="#10b981" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end">
                        Static Lift H_stat = {hStat.toFixed(0)}'
                      </text>

                      {/* Pump Curve (Cyan) */}
                      <path d={pumpPath} fill="none" stroke="#06b6d4" strokeWidth="3" />
                      <text x={left + 15} y={hToY(hShutoff) - 8} fill="#06b6d4" fontSize="10.5" fontFamily="var(--font-mono)" fontWeight="bold">
                        Pump Head H(Q)
                      </text>

                      {/* System Curve (Emerald) */}
                      <path d={sysPath} fill="none" stroke="#10b981" strokeWidth="3" />
                      <text x={right - 20} y={top + 15} fill="#10b981" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="end" fontWeight="bold">
                        System Curve H_sys
                      </text>

                      {/* Operating Point Intersection Crosshairs */}
                      {calc.qOp > 0 && (
                        <g>
                          <line x1={opX} y1={bottom} x2={opX} y2={opY} stroke="rgba(245,158,11,0.5)" strokeDasharray="3 3" />
                          <line x1={left} y1={opY} x2={opX} y2={opY} stroke="rgba(245,158,11,0.5)" strokeDasharray="3 3" />

                          <circle cx={opX} cy={opY} r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                          <rect x={opX + 8} y={opY - 28} width="140" height="24" rx="4" fill="rgba(15,23,42,0.9)" stroke="#f59e0b" />
                          <text x={opX + 14} y={opY - 12} fill="#f59e0b" fontSize="10.5" fontWeight="bold" fontFamily="var(--font-mono)">
                            {Math.round(calc.qOp)} gpm @ {calc.hOp.toFixed(1)}'
                          </text>

                          {/* X and Y labels */}
                          <text x={opX} y={bottom + 16} fill="#f59e0b" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle" fontWeight="bold">
                            {Math.round(calc.qOp)} gpm
                          </text>
                          <text x={left - 8} y={opY + 4} fill="#f59e0b" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end" fontWeight="bold">
                            {calc.hOp.toFixed(0)}'
                          </text>
                        </g>
                      )}

                      {/* Axis Titles */}
                      <text x={(left + right) / 2} y={bottom + 32} fill="#94a3b8" fontSize="11" textAnchor="middle">
                        Discharge Flow Rate Q (gpm)
                      </text>
                      <text x={left - 30} y={(top + bottom) / 2} fill="#94a3b8" fontSize="11" textAnchor="middle" transform={`rotate(-90 ${left - 30} ${(top + bottom) / 2})`}>
                        Total Dynamic Head (ft)
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
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Operating Discharge</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {Math.round(calc.qOp)} gpm
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                {(calc.qOp / 448.83).toFixed(2)} cfs
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-blue)' }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Operating Head (TDH)</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                {calc.hOp.toFixed(1)} ft
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                {(calc.hOp * 0.433).toFixed(1)} psi
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-amber)' }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Brake Horsepower (BHP)</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                {calc.bhp.toFixed(1)} HP
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                WHP / {efficiency}% η = {calc.whp.toFixed(1)} WHP
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: `3px solid ${calc.cavitationSafe ? 'var(--accent-emerald)' : 'var(--accent-rose)'}` }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>NPSHA Available</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: calc.cavitationSafe ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                {calc.npshA.toFixed(1)} ft
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                Req: {npshR.toFixed(1)}' | Margin: +{calc.npshMargin.toFixed(1)}'
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
