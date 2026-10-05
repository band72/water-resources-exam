import { useState, useMemo } from 'react';

export default function TraverseCogoVisualizer({ problem }) {
  // Initial default 4-sided traverse courses
  const initialCourses = [
    { from: 'A', to: 'B', azimuthDeg: 30.0, length: 285.50 },
    { from: 'B', to: 'C', azimuthDeg: 100.0, length: 610.40 },
    { from: 'C', to: 'D', azimuthDeg: 225.0, length: 720.00 },
    { from: 'D', to: 'A', azimuthDeg: 325.0, length: 449.20 }
  ];

  const [courses, setCourses] = useState(initialCourses);
  const [startN, setStartN] = useState(problem?.startingN || 5000.0);
  const [startE, setStartE] = useState(problem?.startingE || 5000.0);

  // Update a course field
  const handleCourseChange = (idx, field, val) => {
    setCourses(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: parseFloat(val) || 0 };
      return copy;
    });
  };

  // Reset to default
  const handleReset = () => {
    setCourses(initialCourses);
  };

  // Convert azimuth to quadrant bearing string
  const formatBearing = (az) => {
    let a = ((az % 360) + 360) % 360;
    if (a >= 0 && a <= 90) {
      return `N ${a.toFixed(1)}° E`;
    } else if (a > 90 && a <= 180) {
      return `S ${(180 - a).toFixed(1)}° E`;
    } else if (a > 180 && a <= 270) {
      return `S ${(a - 180).toFixed(1)}° W`;
    } else {
      return `N ${(360 - a).toFixed(1)}° W`;
    }
  };

  // --- Traverse Calculations ---
  const traverse = useMemo(() => {
    let sumLength = 0;
    let sumLat = 0;
    let sumDep = 0;
    const rawRows = [];

    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      const rad = (c.azimuthDeg * Math.PI) / 180.0;
      const lat = c.length * Math.cos(rad);
      const dep = c.length * Math.sin(rad);
      sumLength += c.length;
      sumLat += lat;
      sumDep += dep;
      rawRows.push({
        ...c,
        rad,
        lat,
        dep
      });
    }

    const linearMisclosure = Math.sqrt(sumLat * sumLat + sumDep * sumDep);
    const precisionRatio = linearMisclosure > 0 ? Math.round(sumLength / linearMisclosure) : 999999;
    const meetsSpec = precisionRatio >= 10000;

    // Bowditch (Compass Rule) Adjustment:
    // C_lat = -sumLat * (L / sumLength)
    // C_dep = -sumDep * (L / sumLength)
    let runningN = startN;
    let runningE = startE;
    const stations = [{ name: courses[0]?.from || 'A', n: runningN, e: runningE }];
    const adjustedRows = [];

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const prop = sumLength > 0 ? r.length / sumLength : 0;
      const cLat = -sumLat * prop;
      const cDep = -sumDep * prop;
      const adjLat = r.lat + cLat;
      const adjDep = r.dep + cDep;

      runningN += adjLat;
      runningE += adjDep;
      stations.push({ name: r.to, n: runningN, e: runningE });

      adjustedRows.push({
        ...r,
        cLat,
        cDep,
        adjLat,
        adjDep,
        endN: runningN,
        endE: runningE
      });
    }

    // Area by Coordinate Method (Shoelace Formula)
    // Area = 0.5 * | sum(E_i * N_{i+1} - E_{i+1} * N_i) |
    let doubleArea = 0;
    for (let i = 0; i < stations.length - 1; i++) {
      const s1 = stations[i];
      const s2 = stations[i + 1];
      doubleArea += (s1.e * s2.n - s2.e * s1.n);
    }
    const areaSqFt = Math.abs(doubleArea) / 2.0;
    const areaAcres = areaSqFt / 43560.0;

    return {
      rawRows,
      adjustedRows,
      sumLength,
      sumLat,
      sumDep,
      linearMisclosure,
      precisionRatio,
      meetsSpec,
      stations,
      areaSqFt,
      areaAcres
    };
  }, [courses, startN, startE]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', marginTop: '1rem' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.4rem' }}>📐</span>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Closed Traverse Balancing & Bowditch Compass Rule</h3>
            <span className="text-xs text-muted">Coordinate Geometry (COGO), Linear Misclosure & Exact Parcel Area</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="glass-badge" style={{ color: traverse.meetsSpec ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
            {traverse.meetsSpec ? '✓ Precision ≥ 1:10,000 (Passes)' : '⚠ Check Misclosure Tolerances'}
          </span>
          <button
            className="btn-secondary"
            onClick={handleReset}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
          >
            Reset Default
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.3fr) minmax(360px, 1.7fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Controls & Course Table Column */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📋</span>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Traverse Courses Data Entry</h3>
              <span className="text-xs text-muted">Line Bearings, Azimuths and Distances</span>
            </div>
          </div>

          {/* Courses Input List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {courses.map((c, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                  <strong style={{ color: 'var(--accent-blue)' }}>Course {c.from}-{c.to}</strong>
                  <span className="font-mono text-muted">{formatBearing(c.azimuthDeg)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label className="text-xs text-muted" style={{ display: 'block', fontSize: '0.7rem' }}>Azimuth (°):</label>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      step="0.5"
                      value={c.azimuthDeg}
                      onChange={(e) => handleCourseChange(idx, 'azimuthDeg', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '0.35rem 0.5rem',
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted" style={{ display: 'block', fontSize: '0.7rem' }}>Length (ft):</label>
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      step="0.1"
                      value={c.length}
                      onChange={(e) => handleCourseChange(idx, 'length', e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '0.35rem 0.5rem',
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Starting Coordinates */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Base Benchmark Coordinates (Station A)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label className="text-xs text-muted" style={{ fontSize: '0.7rem' }}>Northing (N):</label>
                <input
                  type="number"
                  value={startN}
                  onChange={(e) => setStartN(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '0.35rem',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted" style={{ fontSize: '0.7rem' }}>Easting (E):</label>
                <input
                  type="number"
                  value={startE}
                  onChange={(e) => setStartE(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '0.35rem',
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
          {/* Boundary Parcel Polygon SVG */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Balanced Boundary Parcel & Vertex Coordinates
              </span>
              <span className="glass-badge" style={{ color: 'var(--accent-emerald)' }}>
                {traverse.areaAcres.toFixed(2)} Acres
              </span>
            </div>

            <div style={{ background: '#080d1a', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <svg viewBox="0 0 520 250" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs>
                  <linearGradient id="parcelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(56, 189, 248, 0.25)" />
                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0.2)" />
                  </linearGradient>
                </defs>

                {(() => {
                  const pts = traverse.stations.slice(0, -1);
                  if (pts.length < 3) return null;

                  const minE = Math.min(...pts.map(p => p.e));
                  const maxE = Math.max(...pts.map(p => p.e));
                  const minN = Math.min(...pts.map(p => p.n));
                  const maxN = Math.max(...pts.map(p => p.n));

                  const spanE = Math.max(1, maxE - minE);
                  const spanN = Math.max(1, maxN - minN);

                  // Scale into viewBox (left 50..470, top 30..220)
                  const pad = 40;
                  const eToSvg = (e) => pad + ((e - minE) / spanE) * (520 - 2 * pad);
                  // Invert Y since northing goes up
                  const nToSvg = (n) => (250 - pad) - ((n - minN) / spanN) * (250 - 2 * pad);

                  const polygonPoints = pts.map(p => `${eToSvg(p.e).toFixed(1)},${nToSvg(p.n).toFixed(1)}`).join(' ');

                  // Centroid for area label
                  const avgE = pts.reduce((a, b) => a + b.e, 0) / pts.length;
                  const avgN = pts.reduce((a, b) => a + b.n, 0) / pts.length;
                  const centerSvgX = eToSvg(avgE);
                  const centerSvgY = nToSvg(avgN);

                  return (
                    <g>
                      {/* Parcel Polygon */}
                      <polygon points={polygonPoints} fill="url(#parcelGrad)" stroke="#38bdf8" strokeWidth="2.5" />

                      {/* Vertices & Station Labels */}
                      {pts.map((p, i) => {
                        const sx = eToSvg(p.e);
                        const sy = nToSvg(p.n);
                        return (
                          <g key={i}>
                            <circle cx={sx} cy={sy} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                            <text
                              x={sx}
                              y={sy - 10}
                              fill="#f59e0b"
                              fontSize="11"
                              fontFamily="var(--font-mono)"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              Sta {p.name}
                            </text>
                          </g>
                        );
                      })}

                      {/* Area Callout in Center */}
                      <rect
                        x={centerSvgX - 70}
                        y={centerSvgY - 18}
                        width="140"
                        height="36"
                        rx="6"
                        fill="rgba(15,23,42,0.9)"
                        stroke="rgba(56,189,248,0.5)"
                      />
                      <text
                        x={centerSvgX}
                        y={centerSvgY - 2}
                        fill="#38bdf8"
                        fontSize="11"
                        fontWeight="bold"
                        fontFamily="var(--font-mono)"
                        textAnchor="middle"
                      >
                        {traverse.areaAcres.toFixed(3)} ACRES
                      </text>
                      <text
                        x={centerSvgX}
                        y={centerSvgY + 12}
                        fill="#94a3b8"
                        fontSize="9"
                        fontFamily="var(--font-mono)"
                        textAnchor="middle"
                      >
                        {Math.round(traverse.areaSqFt).toLocaleString()} sq ft
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* Results Bento Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-emerald)' }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Balanced Parcel Area</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                {traverse.areaAcres.toFixed(2)} ac
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                {Math.round(traverse.areaSqFt).toLocaleString()} ft²
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-blue)' }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Total Perimeter</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                {traverse.sumLength.toFixed(1)} ft
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                Σ Course Lengths
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: '3px solid var(--accent-amber)' }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Linear Misclosure</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                {traverse.linearMisclosure.toFixed(3)} ft
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                √(ΔLat² + ΔDep²)
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem', borderTop: `3px solid ${traverse.meetsSpec ? 'var(--accent-cyan)' : 'var(--accent-rose)'}` }}>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.2rem' }}>Precision Ratio</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: traverse.meetsSpec ? 'var(--accent-cyan)' : 'var(--accent-rose)' }}>
                1 : {traverse.precisionRatio.toLocaleString()}
              </span>
              <span className="text-xs text-dim" style={{ display: 'block', marginTop: '0.2rem' }}>
                {traverse.meetsSpec ? '✓ Passes Boundary Spec' : '⚠ Exceeds 1:10,000'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
