import { useState, useMemo } from 'react';

export default function BeamShearMomentVisualizer({ problem }) {
  const [supportType, setSupportType] = useState('simple'); // 'simple' | 'cantilever'
  const [spanL, setSpanL] = useState(problem?.spanLength || 24.0);
  const [wLoad, setWLoad] = useState(problem?.wLoad || 1.20); // kips/ft
  const [pLoad, setPLoad] = useState(problem?.pLoad || 16.0); // kips
  const [pPos, setPPos] = useState(problem?.pPos || 8.0); // ft from left
  const [material, setMaterial] = useState('a992'); // 'a992' | 'a36' | 'timber'

  // Material properties
  const matProps = {
    a992: { name: 'A992 Steel (50 ksi)', fb: 33.0, E: 29000, color: 'var(--accent-cyan)' },
    a36: { name: 'A36 Steel (36 ksi)', fb: 24.0, E: 29000, color: 'var(--accent-blue)' },
    timber: { name: 'Douglas Fir No. 2 (Timber)', fb: 0.90, E: 1600, color: 'var(--accent-amber)' }
  };

  const currentMat = matProps[material] || matProps.a992;

  // --- Analytical Calculations ---
  const beam = useMemo(() => {
    const a = Math.min(spanL, Math.max(0, pPos));
    const b = spanL - a;

    let R1;
    let R2;
    let Mmax = 0;
    let xMmax = 0;
    let Vmax;

    const numPoints = 80;
    const sfd = [];
    const bmd = [];

    if (supportType === 'simple') {
      // Reactions:
      R1 = (wLoad * spanL) / 2.0 + (pLoad * b) / spanL;
      R2 = (wLoad * spanL) / 2.0 + (pLoad * a) / spanL;
      Vmax = Math.max(Math.abs(R1), Math.abs(R2));

      // Calculate V(x) and M(x) along beam
      for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * spanL;
        let v = R1 - wLoad * x;
        if (x > a) {
          v -= pLoad;
        }

        let m = R1 * x - 0.5 * wLoad * x * x;
        if (x > a) {
          m -= pLoad * (x - a);
        }

        sfd.push({ x, v });
        bmd.push({ x, m });

        if (m > Mmax) {
          Mmax = m;
          xMmax = x;
        }
      }
    } else {
      // Cantilever (Fixed at left x=0, free at x=L)
      R1 = wLoad * spanL + pLoad;
      R2 = 0;
      // Fixed moment at wall
      const Mwall = 0.5 * wLoad * spanL * spanL + pLoad * a;
      Mmax = Mwall;
      xMmax = 0;
      Vmax = R1;

      for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * spanL;
        // From free end right:
        const xFromEnd = spanL - x;
        let v = wLoad * xFromEnd;
        if (x <= a) {
          v += pLoad;
        }

        let m = -0.5 * wLoad * xFromEnd * xFromEnd;
        if (x <= a) {
          m -= pLoad * (a - x);
        }

        sfd.push({ x, v });
        bmd.push({ x, m: Math.abs(m) });
      }
    }

    // Required Section Modulus: S_req = M_max (kip-in) / F_b (ksi)
    const mMaxKipIn = Mmax * 12.0;
    const sReqIn3 = currentMat.fb > 0 ? mMaxKipIn / currentMat.fb : 0;

    // Approximate deflection (midspan under uniform load + point load):
    // Delta_unif = 5*w*L^4 / (384*E*I)
    // For estimation, use an I corresponding to standard S (e.g. d ~ 16", I ~ S * d/2 ~ S * 8)
    const approxI = sReqIn3 * 8.0;
    const deltaMaxIn = approxI > 0 
      ? ((5.0 * (wLoad / 12.0) * Math.pow(spanL * 12.0, 4)) / (384.0 * currentMat.E * approxI) +
         (pLoad * Math.pow(spanL * 12.0, 3)) / (48.0 * currentMat.E * approxI))
      : 0;

    const spanInches = spanL * 12.0;
    const deflRatio = deltaMaxIn > 0 ? spanInches / deltaMaxIn : 999;
    const deflPasses = deflRatio >= 240;

    // Suggested AISC W-Shapes based on S_req
    const wShapes = [
      { name: 'W10×30', s: 32.4, wt: 30 },
      { name: 'W12×35', s: 45.6, wt: 35 },
      { name: 'W14×38', s: 54.6, wt: 38 },
      { name: 'W16×40', s: 64.7, wt: 40 },
      { name: 'W18×50', s: 88.9, wt: 50 },
      { name: 'W21×62', s: 127.0, wt: 62 },
      { name: 'W24×76', s: 176.0, wt: 76 }
    ];
    const suggestedShape = wShapes.find(w => w.s >= sReqIn3) || { name: 'Heavy Plate Girder / Built-Up', s: sReqIn3, wt: 100 };

    return {
      R1,
      R2,
      Vmax,
      Mmax,
      xMmax,
      mMaxKipIn,
      sReqIn3,
      deltaMaxIn,
      deflRatio,
      deflPasses,
      suggestedShape,
      sfd,
      bmd
    };
  }, [supportType, spanL, wLoad, pLoad, pPos, currentMat]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', marginTop: '1rem' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🏗️</span>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Everyday Beam Shear, Moment & Deflection Analyzer</h3>
            <span className="text-xs text-muted">AISC / NDS Allowable Stress Design (ASD) & Interactive SFD / BMD Canvas</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`tab-btn ${supportType === 'simple' ? 'active' : ''}`}
            onClick={() => setSupportType('simple')}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
          >
            Simply Supported
          </button>
          <button
            className={`tab-btn ${supportType === 'cantilever' ? 'active' : ''}`}
            onClick={() => setSupportType('cantilever')}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
          >
            Cantilever (Fixed Wall)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.2fr) minmax(360px, 1.8fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Controls Column */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📐</span>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Loading & Span Parameters</h3>
              <span className="text-xs text-muted">Point Load, Uniform Load & Beam Span</span>
            </div>
          </div>

          {/* Span Length L */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Beam Span Length (L):</label>
              <span className="font-mono text-xs" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{spanL.toFixed(1)} ft</span>
            </div>
            <input
              type="range"
              min="8"
              max="60"
              step="1"
              value={spanL}
              onChange={(e) => setSpanL(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
            />
          </div>

          {/* Uniform Load w */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Uniform Load (w):</label>
              <span className="font-mono text-xs" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{wLoad.toFixed(2)} kips/ft ({Math.round(wLoad * 1000)} plf)</span>
            </div>
            <input
              type="range"
              min="0"
              max="5.0"
              step="0.1"
              value={wLoad}
              onChange={(e) => setWLoad(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          {/* Concentrated Point Load P */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Point Load P (kips):</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={pLoad}
                onChange={(e) => setPLoad(parseFloat(e.target.value) || 0)}
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
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Position a (ft from left):</label>
              <input
                type="number"
                min="0"
                max={spanL}
                step="0.5"
                value={pPos}
                onChange={(e) => setPPos(parseFloat(e.target.value) || 0)}
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

          {/* Material Selection */}
          <div>
            <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Material & Allowable Bending Stress (F_b):
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {Object.keys(matProps).map((key) => (
                <button
                  key={key}
                  className={`btn-secondary ${material === key ? 'active' : ''}`}
                  onClick={() => setMaterial(key)}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.4rem',
                    fontSize: '0.75rem',
                    background: material === key ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                    borderColor: material === key ? 'var(--accent-blue)' : 'var(--border-color)',
                    color: material === key ? 'var(--accent-blue)' : 'var(--text-main)'
                  }}
                >
                  {matProps[key].name}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted" style={{ fontSize: '0.7rem', marginTop: '0.3rem', display: 'block' }}>
              Allowable Bending Stress: <strong>{currentMat.fb} ksi</strong> | Elastic Modulus E: <strong>{currentMat.E.toLocaleString()} ksi</strong>
            </span>
          </div>

          {/* Free-Body Diagram Mini-View */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Support Reactions
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span>Left Support (R₁): <strong style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{beam.R1.toFixed(2)} kips</strong></span>
              {supportType === 'simple' && (
                <span>Right Support (R₂): <strong style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{beam.R2.toFixed(2)} kips</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* Results & Visual Graphic Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Live SVG Shear and Moment Canvas */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Shear Force Diagram (SFD) & Bending Moment Diagram (BMD)
              </span>
              <span className="glass-badge" style={{ color: 'var(--accent-amber)' }}>
                M_max = {beam.Mmax.toFixed(1)} kip-ft @ x = {beam.xMmax.toFixed(1)}'
              </span>
            </div>

            <div style={{ background: '#080d1a', borderRadius: '10px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <svg viewBox="0 0 520 280" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs>
                  <linearGradient id="posShearGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.45)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
                  </linearGradient>
                  <linearGradient id="negShearGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(244, 63, 94, 0.05)" />
                    <stop offset="100%" stopColor="rgba(244, 63, 94, 0.45)" />
                  </linearGradient>
                  <linearGradient id="momentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(56, 189, 248, 0.45)" />
                    <stop offset="100%" stopColor="rgba(56, 189, 248, 0.05)" />
                  </linearGradient>
                </defs>

                {(() => {
                  const left = 50;
                  const right = 480;
                  const beamY = 40;
                  const sfdZeroY = 120;
                  const bmdZeroY = 220;

                  const xToCanvas = (x) => left + (x / spanL) * (right - left);
                  const maxV = Math.max(1, beam.Vmax * 1.25);
                  const maxM = Math.max(1, beam.Mmax * 1.25);

                  // SFD Path
                  let sfdPath = `M ${left} ${sfdZeroY}`;
                  beam.sfd.forEach(pt => {
                    const cx = xToCanvas(pt.x);
                    const cy = sfdZeroY - (pt.v / maxV) * 35;
                    sfdPath += ` L ${cx} ${cy}`;
                  });
                  sfdPath += ` L ${right} ${sfdZeroY} Z`;

                  // BMD Path
                  let bmdPath = `M ${left} ${bmdZeroY}`;
                  beam.bmd.forEach(pt => {
                    const cx = xToCanvas(pt.x);
                    const cy = bmdZeroY - (pt.m / maxM) * 45;
                    bmdPath += ` L ${cx} ${cy}`;
                  });
                  bmdPath += ` L ${right} ${bmdZeroY} Z`;

                  return (
                    <g>
                      {/* --- BEAM LOADING SCHEMATIC --- */}
                      <rect x={left} y={beamY - 4} width={right - left} height="8" rx="2" fill="#64748b" />
                      {/* Distributed Load arrows */}
                      {wLoad > 0 && (
                        <g>
                          <line x1={left} y1={beamY - 20} x2={right} y2={beamY - 20} stroke="#38bdf8" strokeWidth="1.5" />
                          {[0.1, 0.3, 0.5, 0.7, 0.9].map((ratio) => {
                            const ax = left + ratio * (right - left);
                            return (
                              <line key={ratio} x1={ax} y1={beamY - 20} x2={ax} y2={beamY - 6} stroke="#38bdf8" strokeWidth="1" markerEnd="url(#arrow)" />
                            );
                          })}
                          <text x={(left + right) / 2} y={beamY - 24} fill="#38bdf8" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle">
                            w = {wLoad.toFixed(2)} klf
                          </text>
                        </g>
                      )}

                      {/* Point Load arrow */}
                      {pLoad > 0 && (
                        <g>
                          <line x1={xToCanvas(pPos)} y1={beamY - 32} x2={xToCanvas(pPos)} y2={beamY - 6} stroke="#f59e0b" strokeWidth="2.5" />
                          <polygon points={`${xToCanvas(pPos) - 4},${beamY - 8} ${xToCanvas(pPos) + 4},${beamY - 8} ${xToCanvas(pPos)},${beamY - 2}`} fill="#f59e0b" />
                          <text x={xToCanvas(pPos)} y={beamY - 35} fill="#f59e0b" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="middle" fontWeight="bold">
                            P = {pLoad} kips
                          </text>
                        </g>
                      )}

                      {/* Supports */}
                      {supportType === 'simple' ? (
                        <g>
                          {/* Left Pin */}
                          <polygon points={`${left - 6},${beamY + 14} ${left + 6},${beamY + 14} ${left},${beamY + 4}`} fill="#10b981" />
                          {/* Right Roller */}
                          <circle cx={right} cy={beamY + 10} r="5" fill="none" stroke="#10b981" strokeWidth="2" />
                        </g>
                      ) : (
                        <g>
                          {/* Fixed Wall Support */}
                          <rect x={left - 8} y={beamY - 14} width="8" height="28" fill="#475569" stroke="#94a3b8" />
                        </g>
                      )}

                      {/* --- SHEAR FORCE DIAGRAM (SFD) --- */}
                      <line x1={left} y1={sfdZeroY} x2={right} y2={sfdZeroY} stroke="rgba(255,255,255,0.2)" />
                      <path d={sfdPath} fill="url(#posShearGrad)" stroke="#10b981" strokeWidth="2" />
                      <text x={left - 10} y={sfdZeroY + 4} fill="#94a3b8" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end">V(x)</text>
                      <text x={left + 8} y={sfdZeroY - 15} fill="#10b981" fontSize="10" fontFamily="var(--font-mono)" fontWeight="bold">
                        +{beam.R1.toFixed(1)}k
                      </text>
                      {supportType === 'simple' && (
                        <text x={right - 8} y={sfdZeroY + 20} fill="#f87171" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end" fontWeight="bold">
                          -{beam.R2.toFixed(1)}k
                        </text>
                      )}

                      {/* --- BENDING MOMENT DIAGRAM (BMD) --- */}
                      <line x1={left} y1={bmdZeroY} x2={right} y2={bmdZeroY} stroke="rgba(255,255,255,0.2)" />
                      <path d={bmdPath} fill="url(#momentGrad)" stroke="#38bdf8" strokeWidth="2.5" />
                      <text x={left - 10} y={bmdZeroY + 4} fill="#94a3b8" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end">M(x)</text>

                      {/* Peak Moment marker */}
                      <circle cx={xToCanvas(beam.xMmax)} cy={bmdZeroY - (beam.Mmax / maxM) * 45} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                      <text x={xToCanvas(beam.xMmax)} y={bmdZeroY - (beam.Mmax / maxM) * 45 - 8} fill="#f59e0b" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="middle" fontWeight="bold">
                        M_max = {beam.Mmax.toFixed(1)} k-ft
                      </text>

                      {/* X Distance labels */}
                      <text x={left} y={260} fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">0'</text>
                      <text x={xToCanvas(pPos)} y={260} fill="#f59e0b" fontSize="9.5" fontFamily="var(--font-mono)" textAnchor="middle">a = {pPos}'</text>
                      <text x={right} y={260} fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)" textAnchor="end">L = {spanL}'</text>
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* Results Bento Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-amber)' }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Max Bending Moment</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                {beam.Mmax.toFixed(1)} kip-ft
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                {Math.round(beam.mMaxKipIn).toLocaleString()} kip-in
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-emerald)' }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Section Modulus S_req</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                {beam.sReqIn3.toFixed(1)} in³
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                S = M / {currentMat.fb} ksi
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-cyan)' }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Suggested W-Beam</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {beam.suggestedShape.name}
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                Provides S_x = {beam.suggestedShape.s} in³
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: `3px solid ${beam.deflPasses ? 'var(--accent-blue)' : 'var(--accent-rose)'}` }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Deflection Check</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: beam.deflPasses ? 'var(--accent-blue)' : 'var(--accent-rose)' }}>
                {beam.deltaMaxIn.toFixed(2)}" (L/{Math.round(beam.deflRatio)})
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                {beam.deflPasses ? '✓ Stiffer than L/240' : '⚠ Exceeds L/240 limit'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
