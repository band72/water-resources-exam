import { useState, useMemo } from 'react';

export default function CurvePlatVisualizer({ problem }) {
  const [activeTab, setActiveTab] = useState(problem?.curveType === 'vertical' ? 'vertical' : 'horizontal');

  // Horizontal / Subdivision Plat State
  const [radius, setRadius] = useState(problem?.radius || 25.0);
  const [deltaDeg, setDeltaDeg] = useState(problem?.delta || 102.5);
  const [statedDist, setStatedDist] = useState(problem?.statedDistance || 165.0);
  const [piStation, setPiStation] = useState(problem?.piStation || 1240.0);

  // Vertical Curve State
  const [g1, setG1] = useState(problem?.g1 || 3.5);
  const [g2, setG2] = useState(problem?.g2 || -2.5);
  const [vLength, setVLength] = useState(problem?.L || 920.0);
  const [bvcSta, setBvcSta] = useState(problem?.bvcStation || 2400.0);
  const [bvcElev, setBvcElev] = useState(problem?.bvcElevation || 450.0);
  const [designSpeed, setDesignSpeed] = useState(60);

  // --- Horizontal Calculations ---
  const horiz = useMemo(() => {
    const deltaRad = (deltaDeg * Math.PI) / 180.0;
    const halfDelta = deltaRad / 2.0;
    // Tangent distance: T = R * tan(Delta / 2)
    const T = radius * Math.tan(halfDelta);
    // Arc length: L = R * Delta_rad
    const L = radius * deltaRad;
    // Long chord: C = 2 * R * sin(Delta / 2)
    const C = 2 * radius * Math.sin(halfDelta);
    // External distance: E = R * (sec(Delta/2) - 1)
    const E = radius * (1.0 / Math.cos(halfDelta) - 1.0);
    // Middle ordinate: M = R * (1 - cos(Delta/2))
    const M = radius * (1.0 - Math.cos(halfDelta));
    // Degree of curvature (arc definition): D = 5729.57795 / R
    const D = radius > 0 ? 5729.57795 / radius : 0;

    // Rule 2 Subdivision Plat Derivation:
    // Stated distance extends to P.I. (indicated by angle bar tick glyph)
    const lineToPC = statedDist - T;
    // Fillet Area = R * T - 0.5 * R^2 * Delta_rad
    const filletArea = (radius * T) - 0.5 * (radius * radius) * deltaRad;
    const filletAcres = filletArea / 43560.0;

    // Stationing
    const pcStation = piStation - T;
    const ptStation = pcStation + L;

    return {
      deltaRad,
      T,
      L,
      C,
      E,
      M,
      D,
      lineToPC,
      filletArea,
      filletAcres,
      pcStation,
      ptStation
    };
  }, [radius, deltaDeg, statedDist, piStation]);

  // Format stationing: e.g. 1240.0 -> 12+40.00
  const formatStation = (num) => {
    const sta = Math.floor(num / 100);
    const plus = (num % 100).toFixed(2).padStart(5, '0');
    return `${sta}+${plus}`;
  };

  // --- Vertical Calculations ---
  const vert = useMemo(() => {
    const A = Math.abs(g2 - g1);
    const K = A > 0 ? vLength / A : 0;
    const isCrest = g1 > g2;

    // AASHTO Stopping Sight Distance minimum K requirement (60 mph -> SSD = 570 ft)
    // Crest: K_req = SSD^2 / 2158. Sag: K_req = SSD^2 / (400 + 3.5 * SSD)
    const ssdReq = designSpeed === 70 ? 730 : designSpeed === 60 ? 570 : designSpeed === 50 ? 425 : 300;
    const kReq = isCrest 
      ? (ssdReq * ssdReq) / 2158.0 
      : (ssdReq * ssdReq) / (400.0 + 3.5 * ssdReq);
    const ssdPasses = K >= kReq;

    // Turning point (High point for crest, Low point for sag):
    // x = -g1 / (2a) = (g1 * L) / (g1 - g2)
    let hasTurningPoint = false;
    let xTurn = 0;
    let turnSta = 0;
    let turnElev = 0;

    if ((g1 > 0 && g2 < 0) || (g1 < 0 && g2 > 0)) {
      hasTurningPoint = true;
      xTurn = (Math.abs(g1) / A) * vLength;
      turnSta = bvcSta + xTurn;
      // Parabolic equation: y(x) = y_BVC + (g1/100)*x + ((g2 - g1)/(200 * L)) * x^2
      turnElev = bvcElev + (g1 / 100.0) * xTurn + ((g2 - g1) / (200.0 * vLength)) * (xTurn * xTurn);
    }

    const evcSta = bvcSta + vLength;
    const evcElev = bvcElev + (g1 / 100.0) * vLength + ((g2 - g1) / (200.0 * vLength)) * (vLength * vLength);
    const pviSta = bvcSta + vLength / 2.0;
    const pviElev = bvcElev + (g1 / 100.0) * (vLength / 2.0);

    // Profile curve points for SVG
    const profilePoints = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * vLength;
      const y = bvcElev + (g1 / 100.0) * x + ((g2 - g1) / (200.0 * vLength)) * (x * x);
      profilePoints.push({ x, y, sta: bvcSta + x });
    }

    return {
      A,
      K,
      kReq,
      ssdReq,
      ssdPasses,
      isCrest,
      hasTurningPoint,
      xTurn,
      turnSta,
      turnElev,
      evcSta,
      evcElev,
      pviSta,
      pviElev,
      profilePoints
    };
  }, [g1, g2, vLength, bvcSta, bvcElev, designSpeed]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', marginTop: '1rem' }}>
      {/* Mode Selector Tabs */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`tab-btn ${activeTab === 'horizontal' ? 'active' : ''}`}
            onClick={() => setActiveTab('horizontal')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>📐</span> Horizontal & Plat Corner Return (Rule 2)
          </button>
          <button
            className={`tab-btn ${activeTab === 'vertical' ? 'active' : ''}`}
            onClick={() => setActiveTab('vertical')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <span>🎢</span> Highway Vertical Crest / Sag Curve
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="glass-badge" style={{ color: 'var(--accent-blue)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            Civil PE · Transportation & Geometrics
          </span>
        </div>
      </div>

      {activeTab === 'horizontal' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.2fr) minmax(360px, 1.8fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Controls Column */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📐</span>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Plat & Curve Parameters</h3>
                <span className="text-xs text-muted">Rule 2 Dynamic Tangent & P.I. Angle Bar Derivation</span>
              </div>
            </div>

            {/* Radius Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Curve Radius (R):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{radius.toFixed(2)} ft</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                <span>10 ft (Curb Return)</span>
                <span>100 ft</span>
                <span>500 ft (Roadway)</span>
              </div>
            </div>

            {/* Central Deflection Angle Delta */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Central Turn Deflection (Δ):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{deltaDeg.toFixed(2)}° ({Math.floor(deltaDeg)}°{Math.round((deltaDeg % 1) * 60)}')</span>
              </div>
              <input
                type="range"
                min="15"
                max="165"
                step="0.5"
                value={deltaDeg}
                onChange={(e) => setDeltaDeg(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                <span>Acute (30°)</span>
                <span>90° Right Angle</span>
                <span>Obtuse (150°)</span>
              </div>
            </div>

            {/* Stated Plat Distance to P.I. */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Stated Plat Dimension to P.I. (┌):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{statedDist.toFixed(2)} ft</span>
              </div>
              <input
                type="number"
                min="10"
                max="1000"
                step="1"
                value={statedDist}
                onChange={(e) => setStatedDist(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.45rem 0.75rem',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem'
                }}
              />
              <span className="text-xs text-muted" style={{ fontSize: '0.7rem', marginTop: '0.2rem', display: 'block' }}>
                *Indicated by L-shaped corner angle bar glyph (┌) extending to P.I.
              </span>
            </div>

            {/* P.I. Station */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>P.I. Station (ft):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{formatStation(piStation)}</span>
              </div>
              <input
                type="number"
                min="0"
                max="100000"
                step="10"
                value={piStation}
                onChange={(e) => setPiStation(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.45rem 0.75rem',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Rule 2 Compliance Callout */}
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-blue)', fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span>📌</span> Rule 2: Subdivision Plat Corner Return
              </div>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.4', margin: 0 }}>
                Never assume <code>T = R</code> unless <code>Δ = 90°00'00"</code>. Stated boundary distance cut back by exact <code>T = R·tan(Δ/2)</code> to reach the P.C. Fillet area is subtracted from gross parcel area.
              </p>
            </div>
          </div>

          {/* Results & Visual Graphic Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Live SVG Vector Diagram */}
            <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Horizontal Curve & Plat Corner Return Geometry
                </span>
                <span className="glass-badge" style={{ fontSize: '0.65rem', color: horiz.deltaRad > Math.PI / 2 ? 'var(--accent-amber)' : 'var(--accent-cyan)' }}>
                  {deltaDeg.toFixed(1)}° Deflection
                </span>
              </div>

              <div style={{ background: '#080d1a', borderRadius: '10px', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <svg viewBox="0 0 520 280" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                    <pattern id="filletHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(244,63,94,0.4)" strokeWidth="2" />
                    </pattern>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="40" y1="240" x2="480" y2="240" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <line x1="40" y1="40" x2="40" y2="240" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                  {/* Tangent 1 (Street Course 1): Horizontal line to P.I. */}
                  {/* P.I. located at (360, 180) */}
                  <line x1="60" y1="180" x2="360" y2="180" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="4 2" />
                  {/* Tangent 2 (Street Course 2): Deflected line from P.I. */}
                  {/* Angle: 180 - delta */}
                  {(() => {
                    const piX = 360;
                    const piY = 180;
                    const rad = (deltaDeg * Math.PI) / 180;
                    const t2Len = 170;
                    const t2EndX = piX - t2Len * Math.cos(rad);
                    const t2EndY = piY - t2Len * Math.sin(rad);

                    // PC and PT positions scaled
                    const scaleT = Math.min(100, Math.max(30, (horiz.T / (radius * 1.5)) * 60));
                    const pcX = piX - scaleT;
                    const pcY = piY;
                    const ptX = piX - scaleT * Math.cos(rad);
                    const ptY = piY - scaleT * Math.sin(rad);

                    // Center of circular arc (offset perpendicular to tangents)
                    // Midpoint chord and arc curve
                    const chordMidX = (pcX + ptX) / 2;
                    const chordMidY = (pcY + ptY) / 2;
                    const arcCtrlX = piX;
                    const arcCtrlY = piY;

                    return (
                      <g>
                        {/* Tangent 2 Line */}
                        <line x1={piX} y1={piY} x2={t2EndX} y2={t2EndY} stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="4 2" />

                        {/* Stated Boundary line along Tangent 1 before cut-back (solid bright) */}
                        <line x1="60" y1="180" x2={pcX} y2="180" stroke="#34d399" strokeWidth="3.5" />
                        <text x={(60 + pcX) / 2} y="202" fill="#34d399" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle" fontWeight="bold">
                          Cut-Back Course: {horiz.lineToPC.toFixed(2)}'
                        </text>

                        {/* Tangent Cutback T segment */}
                        <line x1={pcX} y1="175" x2={piX} y2="175" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                        <text x={(pcX + piX) / 2} y="168" fill="#f59e0b" fontSize="10.5" fontFamily="var(--font-mono)" textAnchor="middle">
                          T = {horiz.T.toFixed(2)}'
                        </text>

                        {/* Fillet Area polygon fill */}
                        <path
                          d={`M ${pcX} ${pcY} Q ${arcCtrlX} ${arcCtrlY} ${ptX} ${ptY} L ${piX} ${piY} Z`}
                          fill="url(#filletHatch)"
                          stroke="rgba(244,63,94,0.6)"
                          strokeWidth="1"
                        />

                        {/* Circular Arc Fillet Curve */}
                        <path
                          d={`M ${pcX} ${pcY} Q ${arcCtrlX} ${arcCtrlY} ${ptX} ${ptY}`}
                          fill="none"
                          stroke="url(#curveGrad)"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />

                        {/* P.I. Angle Bar Glyph Tick (┌) at corner */}
                        <path
                          d={`M ${piX - 14} ${piY - 14} L ${piX} ${piY - 14} L ${piX} ${piY}`}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2.5"
                        />
                        <text x={piX + 8} y={piY - 18} fill="#ef4444" fontSize="11" fontWeight="bold">
                          P.I. Tick (┌)
                        </text>

                        {/* P.I. Vertex Point */}
                        <circle cx={piX} cy={piY} r="4" fill="#ef4444" />
                        <text x={piX + 8} y={piY + 12} fill="#ef4444" fontSize="10" fontFamily="var(--font-mono)">
                          P.I. {formatStation(piStation)}
                        </text>

                        {/* P.C. Point */}
                        <circle cx={pcX} cy={pcY} r="4.5" fill="#38bdf8" />
                        <text x={pcX} y={pcY + 18} fill="#38bdf8" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle">
                          P.C. {formatStation(horiz.pcStation)}
                        </text>

                        {/* P.T. Point */}
                        <circle cx={ptX} cy={ptY} r="4.5" fill="#a855f7" />
                        <text x={ptX - 12} y={ptY - 8} fill="#a855f7" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end">
                          P.T. {formatStation(horiz.ptStation)}
                        </text>

                        {/* Long Chord C dashed line */}
                        <line x1={pcX} y1={pcY} x2={ptX} y2={ptY} stroke="rgba(255,255,255,0.3)" strokeDasharray="2 2" />

                        {/* Fillet area label */}
                        <rect x={chordMidX + 10} y={chordMidY + 10} width="145" height="24" rx="4" fill="rgba(15,23,42,0.85)" stroke="rgba(244,63,94,0.4)" />
                        <text x={chordMidX + 16} y={chordMidY + 26} fill="#f87171" fontSize="10" fontFamily="var(--font-mono)">
                          Fillet: {horiz.filletArea.toFixed(1)} sq ft
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Calculations & Results Bento Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-amber)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Surveyor Tangent (T)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                  {horiz.T.toFixed(2)} ft
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  T = R · tan(Δ/2)
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-emerald)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Boundary to P.C.</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  {horiz.lineToPC.toFixed(2)} ft
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  {statedDist.toFixed(2)} - {horiz.T.toFixed(2)}
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-cyan)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Arc Length (L)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {horiz.L.toFixed(2)} ft
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  L = R · Δ_rad
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-rose)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Fillet Deduction</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                  {horiz.filletArea.toFixed(1)} ft²
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  {horiz.filletAcres.toFixed(4)} acres
                </span>
              </div>
            </div>

            {/* Complete Horizontal Curve Table */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#fff' }}>Detailed Curve Elements (NCEES Handbook)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">Degree of Curve (D):</span>
                  <span className="font-mono" style={{ color: '#fff' }}>{horiz.D.toFixed(3)}°</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">Long Chord (C):</span>
                  <span className="font-mono" style={{ color: '#fff' }}>{horiz.C.toFixed(2)} ft</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">External Secant (E):</span>
                  <span className="font-mono" style={{ color: '#fff' }}>{horiz.E.toFixed(2)} ft</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">Middle Ordinate (M):</span>
                  <span className="font-mono" style={{ color: '#fff' }}>{horiz.M.toFixed(2)} ft</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">P.C. Station:</span>
                  <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{formatStation(horiz.pcStation)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                  <span className="text-muted">P.T. Station:</span>
                  <span className="font-mono" style={{ color: 'var(--accent-purple)' }}>{formatStation(horiz.ptStation)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Vertical Curve Visualizer */
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.2fr) minmax(360px, 1.8fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Vertical Controls */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🎢</span>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Vertical Profile Parameters</h3>
                <span className="text-xs text-muted">AASHTO Stopping Sight Distance & Parabolic Geometry</span>
              </div>
            </div>

            {/* Grades g1 and g2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Entering Grade (g₁ %):</label>
                <input
                  type="number"
                  step="0.1"
                  value={g1}
                  onChange={(e) => setG1(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.75rem',
                    color: g1 >= 0 ? '#34d399' : '#f87171',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Exiting Grade (g₂ %):</label>
                <input
                  type="number"
                  step="0.1"
                  value={g2}
                  onChange={(e) => setG2(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.75rem',
                    color: g2 >= 0 ? '#34d399' : '#f87171',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700
                  }}
                />
              </div>
            </div>

            {/* Curve Length L */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600 }}>Curve Length (L):</label>
                <span className="font-mono text-xs" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{vLength.toFixed(0)} ft</span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                step="20"
                value={vLength}
                onChange={(e) => setVLength(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>

            {/* BVC Station & Elevation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>BVC Station:</label>
                <input
                  type="number"
                  step="50"
                  value={bvcSta}
                  onChange={(e) => setBvcSta(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.75rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>BVC Elevation (ft):</label>
                <input
                  type="number"
                  step="1"
                  value={bvcElev}
                  onChange={(e) => setBvcElev(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.75rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            {/* Design Speed */}
            <div>
              <label className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Design Speed (AASHTO SSD Check):
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[45, 50, 60, 70].map((spd) => (
                  <button
                    key={spd}
                    className={`btn-secondary ${designSpeed === spd ? 'active' : ''}`}
                    onClick={() => setDesignSpeed(spd)}
                    style={{
                      flex: 1,
                      padding: '0.4rem',
                      fontSize: '0.8rem',
                      background: designSpeed === spd ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                      borderColor: designSpeed === spd ? 'var(--accent-blue)' : 'var(--border-color)'
                    }}
                  >
                    {spd} mph
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vertical Profile Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* SVG Profile Diagram */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Vertical Parabolic Profile (A = {vert.A.toFixed(2)}%)
                </span>
                <span className="glass-badge" style={{ color: vert.isCrest ? 'var(--accent-cyan)' : 'var(--accent-purple)' }}>
                  {vert.isCrest ? '⛰️ Crest Curve' : '🥣 Sag Curve'}
                </span>
              </div>

              <div style={{ background: '#080d1a', borderRadius: '10px', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <svg viewBox="0 0 520 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {/* Grid Lines */}
                  <line x1="40" y1="180" x2="480" y2="180" stroke="rgba(255,255,255,0.06)" />
                  <line x1="40" y1="40" x2="40" y2="180" stroke="rgba(255,255,255,0.06)" />

                  {/* Draw Tangent Grades */}
                  {/* PVI at center */}
                  {(() => {
                    const minElev = Math.min(...vert.profilePoints.map(p => p.y), vert.pviElev);
                    const maxElev = Math.max(...vert.profilePoints.map(p => p.y), vert.pviElev);
                    const pad = Math.max(2.0, (maxElev - minElev) * 0.15);
                    const elevToY = (elev) => 170 - ((elev - (minElev - pad)) / (maxElev - minElev + 2 * pad)) * 130;
                    const staToX = (sta) => 60 + ((sta - bvcSta) / vLength) * 400;

                    const bvcX = staToX(bvcSta);
                    const bvcY = elevToY(bvcElev);
                    const evcX = staToX(vert.evcSta);
                    const evcY = elevToY(vert.evcElev);
                    const pviX = staToX(vert.pviSta);
                    const pviY = elevToY(vert.pviElev);

                    // Parabolic path
                    const pathData = vert.profilePoints
                      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${staToX(pt.sta).toFixed(1)} ${elevToY(pt.y).toFixed(1)}`)
                      .join(' ');

                    return (
                      <g>
                        {/* Tangent grade lines meeting at PVI */}
                        <line x1={bvcX} y1={bvcY} x2={pviX} y2={pviY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
                        <line x1={pviX} y1={pviY} x2={evcX} y2={evcY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />

                        {/* Parabolic Road Surface */}
                        <path d={pathData} fill="none" stroke="#38bdf8" strokeWidth="3.5" />

                        {/* BVC & EVC points */}
                        <circle cx={bvcX} cy={bvcY} r="4" fill="#34d399" />
                        <text x={bvcX} y={bvcY + 16} fill="#34d399" fontSize="10" fontFamily="var(--font-mono)">
                          BVC {bvcElev.toFixed(1)}'
                        </text>

                        <circle cx={evcX} cy={evcY} r="4" fill="#a855f7" />
                        <text x={evcX} y={evcY + 16} fill="#a855f7" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end">
                          EVC {vert.evcElev.toFixed(1)}'
                        </text>

                        {/* PVI marker */}
                        <circle cx={pviX} cy={pviY} r="3.5" fill="#f59e0b" />
                        <text x={pviX} y={pviY - 8} fill="#f59e0b" fontSize="9.5" fontFamily="var(--font-mono)" textAnchor="middle">
                          PVI ({vert.pviElev.toFixed(1)}')
                        </text>

                        {/* High / Low turning point marker */}
                        {vert.hasTurningPoint && (
                          <g>
                            <line
                              x1={staToX(vert.turnSta)}
                              y1="30"
                              x2={staToX(vert.turnSta)}
                              y2="175"
                              stroke="rgba(244,63,94,0.4)"
                              strokeDasharray="2 2"
                            />
                            <circle cx={staToX(vert.turnSta)} cy={elevToY(vert.turnElev)} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                            <rect
                              x={staToX(vert.turnSta) - 55}
                              y={elevToY(vert.turnElev) - 26}
                              width="110"
                              height="20"
                              rx="3"
                              fill="rgba(15,23,42,0.9)"
                              stroke="#ef4444"
                            />
                            <text
                              x={staToX(vert.turnSta)}
                              y={elevToY(vert.turnElev) - 13}
                              fill="#f87171"
                              fontSize="9.5"
                              fontWeight="bold"
                              fontFamily="var(--font-mono)"
                              textAnchor="middle"
                            >
                              High Pt: {vert.turnElev.toFixed(2)}'
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Vertical Results Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-indigo)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Rate of Grade (K)</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                  {vert.K.toFixed(1)} ft/%
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  K = L / A = {vLength} / {vert.A.toFixed(1)}
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: `3px solid ${vert.ssdPasses ? 'var(--accent-emerald)' : 'var(--accent-rose)'}` }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>AASHTO SSD Check</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: vert.ssdPasses ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {vert.ssdPasses ? '✓ PASSES' : '⚠ FAILS'}
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Req K ≥ {vert.kReq.toFixed(1)} @ {designSpeed} mph
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-rose)' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Turning High/Low Point</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                  {vert.hasTurningPoint ? formatStation(vert.turnSta) : 'Outside Curve'}
                </span>
                <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                  {vert.hasTurningPoint ? `Elev = ${vert.turnElev.toFixed(2)} ft` : 'Monotonic Grade'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
