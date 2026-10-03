import { useState, useMemo } from 'react';

/**
 * River Mass Balance & Positional Effluent Studio
 * Simulates 1D river transport, effluent mixing, transverse plume dispersion,
 * positional outfall placement, first-order decay, and regulatory compliance sizing.
 */

const CFS_TO_MGD = 0.646317;
const MGD_TO_CFS = 1 / CFS_TO_MGD; // ~1.54723

const RiverMassBalanceVisualizer = ({ problem }) => {
  // Mode toggle: 'pe13-dilution' | 'pe29-do' | 'custom-reach'
  const isDoProblem = problem?.id === 196;
  const [activeTab, setActiveTab] = useState(isDoProblem ? 'do-balance' : 'dilution-balance');

  // Reach geometry
  const totalReachMiles = 20.0; // 0 to 20 miles

  // Sliders: River Upstream
  const [qRiverCfs, setQRiverCfs] = useState(225.0); // cfs
  const [cRiverMgL, setCRiverMgL] = useState(1.0); // mg/L background
  const [vRiverFps, setVRiverFps] = useState(1.5); // ft/s river velocity

  // Sliders: Effluent Outfall & Positional Placement
  const [outfallMile, setOutfallMile] = useState(2.5); // Effluent position along river reach (miles)
  const [flowUnit, setFlowUnit] = useState('mgd'); // 'mgd' | 'cfs'
  const [qEffluentInput, setQEffluentInput] = useState(14.54); // in MGD or cfs depending on flowUnit
  const [cRawMgL, setCRawMgL] = useState(75.0); // raw pollutant mg/L
  const [removalEffPct, setRemovalEffPct] = useState(70.0); // treatment removal %
  const [decayRateK, setDecayRateK] = useState(0.05); // 1/day (0 = conservative tracer, >0 = decay)

  // Sliders: Compliance Monitoring Station & Standards
  const [complianceMile, setComplianceMile] = useState(10.0); // compliance station position (miles)
  const [cLimitMgL, setCLimitMgL] = useState(3.0); // regulatory limit mg/L

  // DO Problem Specific State (Problem #29)
  const [doRiverTempC, setDoRiverTempC] = useState(30.0);
  const [doMixedTempC, setDoMixedTempC] = useState(34.0);
  const [doEffluentFlowMgd, setDoEffluentFlowMgd] = useState(5.0);
  const [doRiverFlowCfs, setDoRiverFlowCfs] = useState(30.0);

  // Convert effluent flow to both units
  const qEffluentCfs = flowUnit === 'mgd' ? qEffluentInput * MGD_TO_CFS : qEffluentInput;
  const qEffluentMgd = flowUnit === 'mgd' ? qEffluentInput : qEffluentInput * CFS_TO_MGD;

  // Effluent treated concentration
  const cEffluentMgL = cRawMgL * (1 - removalEffPct / 100);

  // Hydrodynamic calculations
  const calcs = useMemo(() => {
    // 1. Total mixed flow
    const qMixCfs = qRiverCfs + qEffluentCfs;
    const qMixMgd = qMixCfs * CFS_TO_MGD;

    // 2. Complete mixed concentration at outfall (x = outfallMile)
    // Mass Balance: Q_r * C_r + Q_e * C_e = Q_mix * C_mix
    const massRiverLbDay = qRiverCfs * CFS_TO_MGD * cRiverMgL * 8.34;
    const massEffluentLbDay = qEffluentMgd * cEffluentMgL * 8.34;
    const totalMassLbDay = massRiverLbDay + massEffluentLbDay;
    const cMixMgL = (qRiverCfs * cRiverMgL + qEffluentCfs * cEffluentMgL) / qMixCfs;

    // 3. Travel time from outfall to compliance station
    // Distance in feet: (complianceMile - outfallMile) * 5280 ft
    const distanceMiles = Math.max(0, complianceMile - outfallMile);
    const distanceFt = distanceMiles * 5280;
    const travelTimeSeconds = vRiverFps > 0 ? distanceFt / vRiverFps : 0;
    const travelTimeDays = travelTimeSeconds / 86400;

    // 4. Downstream concentration at compliance station with 1st order decay
    // C(x) = C_mix * exp(-k * t)
    const cComplianceMgL = complianceMile >= outfallMile
      ? cMixMgL * Math.exp(-decayRateK * travelTimeDays)
      : cRiverMgL;

    // 5. Maximum Allowable Discharge Sizing (Inverse Problem)
    // Solves for Q_e,max such that at compliance station C <= cLimitMgL
    // C_mix,target = cLimitMgL / exp(-k * t)
    const cMixTarget = cLimitMgL / Math.exp(-decayRateK * travelTimeDays);
    let qAllowableCfs;
    let qAllowableMgd;
    if (cEffluentMgL > cMixTarget) {
      qAllowableCfs = (qRiverCfs * (cMixTarget - cRiverMgL)) / (cEffluentMgL - cMixTarget);
      qAllowableMgd = qAllowableCfs * CFS_TO_MGD;
    } else {
      qAllowableCfs = 99999;
      qAllowableMgd = 99999;
    }

    // 6. Dilution factor (ratio of river flow to effluent flow)
    const dilutionRatio = qEffluentCfs > 0 ? qMixCfs / qEffluentCfs : 1;

    // 7. Compliance check
    const isCompliant = cComplianceMgL <= cLimitMgL;
    const marginMgL = cLimitMgL - cComplianceMgL;

    return {
      qMixCfs,
      qMixMgd,
      massRiverLbDay,
      massEffluentLbDay,
      totalMassLbDay,
      cMixMgL,
      distanceMiles,
      travelTimeDays,
      cComplianceMgL,
      qAllowableCfs,
      qAllowableMgd,
      dilutionRatio,
      isCompliant,
      marginMgL
    };
  }, [qRiverCfs, qEffluentCfs, qEffluentMgd, cRiverMgL, cEffluentMgL, outfallMile, complianceMile, vRiverFps, decayRateK, cLimitMgL]);

  // DO Problem (PE #29) Computations
  const doCalcs = useMemo(() => {
    // Freshwater saturation DO formula (Elmore & Hayes / NCEES):
    // DO_sat ≈ 14.652 - 0.41022*T + 0.007991*T^2 - 0.000077774*T^3
    const getSatDo = (tempC) => {
      // Table lookup approximations matching NCEES Reference Handbook:
      if (Math.abs(tempC - 30) < 0.5) return 7.54;
      if (Math.abs(tempC - 34) < 0.5) return 7.05;
      return 14.652 - 0.41022 * tempC + 0.007991 * Math.pow(tempC, 2) - 0.000077774 * Math.pow(tempC, 3);
    };

    const qeCfs = doEffluentFlowMgd * MGD_TO_CFS;
    const qMixCfs = doRiverFlowCfs + qeCfs;
    const doRiverSat = getSatDo(doRiverTempC);
    const doMixedSat = getSatDo(doMixedTempC);

    // Q_e * DO_e + Q_r * DO_r = Q_mix * DO_mix
    // DO_e = (Q_mix * DO_mix - Q_r * DO_r) / Q_e
    const doEffluentMgL = (qMixCfs * doMixedSat - doRiverFlowCfs * doRiverSat) / qeCfs;

    return {
      qeCfs,
      qMixCfs,
      doRiverSat,
      doMixedSat,
      doEffluentMgL
    };
  }, [doEffluentFlowMgd, doRiverFlowCfs, doRiverTempC, doMixedTempC]);

  // Longitudinal profile points along the 20-mile reach
  const profilePoints = useMemo(() => {
    const pts = [];
    const numPoints = 80;
    for (let i = 0; i <= numPoints; i++) {
      const mile = (i / numPoints) * totalReachMiles;
      let conc = cRiverMgL;
      if (mile >= outfallMile) {
        const distFromOutfall = mile - outfallMile;
        const timeDays = (distFromOutfall * 5280) / (vRiverFps * 86400);
        conc = calcs.cMixMgL * Math.exp(-decayRateK * timeDays);
      }
      pts.push({ mile, conc });
    }
    return pts;
  }, [totalReachMiles, outfallMile, cRiverMgL, calcs.cMixMgL, decayRateK, vRiverFps]);

  // Preset button loaders
  const loadPe13Baseline = () => {
    setActiveTab('dilution-balance');
    setQRiverCfs(225.0);
    setCRiverMgL(1.0);
    setFlowUnit('mgd');
    setQEffluentInput(14.54);
    setCRawMgL(75.0);
    setRemovalEffPct(70.0);
    setOutfallMile(2.5);
    setComplianceMile(10.0);
    setCLimitMgL(3.0);
    setDecayRateK(0.0); // Conservative dilution
  };

  const loadDrought7Q10 = () => {
    setActiveTab('dilution-balance');
    setQRiverCfs(65.0); // 7Q10 drought low flow
    setCRiverMgL(1.8);
    setFlowUnit('mgd');
    setQEffluentInput(14.54);
    setCRawMgL(75.0);
    setRemovalEffPct(70.0);
    setCLimitMgL(3.0);
    setDecayRateK(0.0);
  };

  const loadSpillFailure = () => {
    setActiveTab('dilution-balance');
    setRemovalEffPct(0.0); // Treatment failure!
    setCRawMgL(75.0);
    setQEffluentInput(10.0);
  };

  const loadPe29Do = () => {
    setActiveTab('do-balance');
    setDoEffluentFlowMgd(5.0);
    setDoRiverFlowCfs(30.0);
    setDoRiverTempC(30.0);
    setDoMixedTempC(34.0);
  };

  return (
    <div style={{
      background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
      borderRadius: '16px',
      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
      padding: '1.75rem',
      boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'var(--glass-blur, blur(20px))',
      color: 'var(--text-main, #f1f5f9)'
    }}>
      {/* Visualizer Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
        paddingBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem'
          }}>
            🌊
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
                River Mass Balance &amp; Positional Effluent Studio
              </h2>
              <span className="glass-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                PE Exam Interactive Lab
              </span>
            </div>
            <p className="text-xs text-muted" style={{ margin: '0.25rem 0 0 0' }}>
              Interactive river transport, drag-and-drop positional outfall, complete mixing zone, exponential decay, and NPDES permit sizing.
            </p>
          </div>
        </div>

        {/* Tab & Preset Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              onClick={() => setActiveTab('dilution-balance')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'dilution-balance' ? 'var(--accent-blue, #38bdf8)' : 'transparent',
                color: activeTab === 'dilution-balance' ? '#070a12' : 'var(--text-muted)',
                fontWeight: activeTab === 'dilution-balance' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              🌊 Dilution Mass Balance (#13)
            </button>
            <button
              onClick={() => setActiveTab('do-balance')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'do-balance' ? 'var(--accent-emerald, #10b981)' : 'transparent',
                color: activeTab === 'do-balance' ? '#070a12' : 'var(--text-muted)',
                fontWeight: activeTab === 'do-balance' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              🐟 Dissolved Oxygen &amp; Thermal (#29)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button onClick={loadPe13Baseline} className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem' }} title="Reset to PE Problem #13 Baseline">
              🎯 #13 Preset
            </button>
            <button onClick={loadPe29Do} className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem' }} title="Reset to PE Problem #29 Baseline">
              🐟 #29 Preset
            </button>
            <button onClick={loadDrought7Q10} className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem', borderColor: 'rgba(245, 158, 11, 0.4)', color: 'var(--accent-amber)' }} title="Simulate 7Q10 Low-Flow Drought Condition">
              ☀️ 7Q10 Drought
            </button>
            <button onClick={loadSpillFailure} className="btn-secondary" style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem', borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--accent-rose)' }} title="Simulate Treatment Plant Failure (0% Removal)">
              ⚠️ Spill Event
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: EFFLUENT DILUTION, POSITIONAL OUTFALL & COMPLIANCE            */}
      {/* ===================================================================== */}
      {activeTab === 'dilution-balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Quick Metrics Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem'
          }}>
            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--accent-blue)' }}>
              <span className="text-xs text-muted" style={{ display: 'block' }}>Mixed River Flow (Q_mix)</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-blue)' }}>
                {calcs.qMixCfs.toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>cfs</span>
              </strong>
              <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                ≈ {calcs.qMixMgd.toFixed(2)} MGD ({calcs.dilutionRatio.toFixed(1)}:1 dilution)
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--accent-emerald)' }}>
              <span className="text-xs text-muted" style={{ display: 'block' }}>Treated Effluent (C_e)</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-emerald)' }}>
                {cEffluentMgL.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>mg/L</span>
              </strong>
              <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                Raw: {cRawMgL.toFixed(1)} mg/L (−{removalEffPct}%)
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--accent-purple)' }}>
              <span className="text-xs text-muted" style={{ display: 'block' }}>Initial Mix Conc. (C_mix)</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-purple)' }}>
                {calcs.cMixMgL.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>mg/L</span>
              </strong>
              <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                Load: {Math.round(calcs.totalMassLbDay).toLocaleString()} lb/day
              </span>
            </div>

            <div className="glass-panel" style={{
              padding: '0.9rem 1.1rem',
              borderLeft: `4px solid ${calcs.isCompliant ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
              background: calcs.isCompliant ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block' }}>Compliance Station (Mile {complianceMile})</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <strong style={{ fontSize: '1.25rem', color: calcs.isCompliant ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {calcs.cComplianceMgL.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>mg/L</span>
                </strong>
                <span className="glass-badge" style={{
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.4rem',
                  background: calcs.isCompliant ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                  color: calcs.isCompliant ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  borderColor: calcs.isCompliant ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}>
                  {calcs.isCompliant ? '✓ PASS' : '⚠️ EXCEEDED'}
                </span>
              </div>
              <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                Limit: {cLimitMgL.toFixed(1)} mg/L (Margin: {calcs.marginMgL >= 0 ? '+' : ''}{calcs.marginMgL.toFixed(2)})
              </span>
            </div>
          </div>

          {/* ================================================================= */}
          {/* INTERACTIVE RIVER REACH SVG MAP & POSITIONAL EFFLUENT PLUME       */}
          {/* ================================================================= */}
          <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <strong style={{ fontSize: '0.95rem', color: '#f1f5f9' }}>
                  Interactive River Reach Corridor Map &amp; Plume Dispersion
                </strong>
                <span className="text-xs text-muted" style={{ display: 'block' }}>
                  Drag the outfall pipe or use the position slider to move the factory effluent discharge along the river reach.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#38bdf8' }} /> Clean River
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b' }} /> Effluent Plume
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: calcs.isCompliant ? '#10b981' : '#f43f5e' }} /> Compliance Buoy
                </span>
              </div>
            </div>

            {/* River SVG Canvas */}
            <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(7, 12, 22, 0.85)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '0.5rem' }}>
              <svg viewBox="0 0 900 240" style={{ width: '100%', minWidth: '750px', height: 'auto', display: 'block' }}>
                <defs>
                  {/* Flow Pattern */}
                  <linearGradient id="river-bed-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0369a1" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#0284c7" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#075985" stopOpacity="0.8" />
                  </linearGradient>

                  {/* Effluent Plume Gradient */}
                  <radialGradient id="plume-spread" cx="0%" cy="50%" r="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                    <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.65" />
                    <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
                  </radialGradient>

                  {/* Bank Texture */}
                  <pattern id="bank-grass" width="20" height="20" patternUnits="userSpaceOnUse">
                    <rect width="20" height="20" fill="#064e3b" opacity="0.3" />
                    <circle cx="5" cy="5" r="1.5" fill="#047857" opacity="0.4" />
                    <circle cx="15" cy="12" r="1.5" fill="#10b981" opacity="0.25" />
                  </pattern>

                  {/* Plume Filter Blur */}
                  <filter id="plume-blur" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" />
                  </filter>
                </defs>

                {/* Background Banks */}
                <rect x="0" y="20" width="900" height="40" fill="url(#bank-grass)" />
                <rect x="0" y="160" width="900" height="50" fill="url(#bank-grass)" />

                {/* River Channel Bed */}
                <rect x="0" y="60" width="900" height="100" fill="url(#river-bed-grad)" />

                {/* River Boundary Lines */}
                <line x1="0" y1="60" x2="900" y2="60" stroke="#047857" strokeWidth="3" />
                <line x1="0" y1="160" x2="900" y2="160" stroke="#047857" strokeWidth="3" />

                {/* River Water Current Streamlines (Animated look) */}
                <g stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" strokeDasharray="16 24">
                  <line x1="10" y1="80" x2="890" y2="80" />
                  <line x1="40" y1="110" x2="890" y2="110" />
                  <line x1="20" y1="140" x2="890" y2="140" />
                </g>

                {/* Upstream River Inflow Indicator */}
                <g transform="translate(15, 95)">
                  <polygon points="0,-12 18,0 0,12" fill="#38bdf8" opacity="0.8" />
                  <text x="24" y="4" fill="#7dd3fc" fontSize="11" fontWeight="700" fontFamily="var(--font-mono)">
                    River Inflow: {qRiverCfs} cfs (C_r = {cRiverMgL} mg/L)
                  </text>
                </g>

                {/* Effluent Outfall Location Calculation */}
                {(() => {
                  const outfallX = 50 + (outfallMile / totalReachMiles) * 800;
                  const complianceX = 50 + (complianceMile / totalReachMiles) * 800;
                  const plumeWidth = Math.min(850 - outfallX, 320);

                  return (
                    <>
                      {/* Effluent Dispersion Plume spreading across river width */}
                      {plumeWidth > 0 && (
                        <path
                          d={`M ${outfallX} 60 Q ${outfallX + plumeWidth * 0.4} 110 ${outfallX + plumeWidth} 150 L ${outfallX + plumeWidth} 60 Z`}
                          fill="url(#plume-spread)"
                          filter="url(#plume-blur)"
                          opacity="0.85"
                        />
                      )}

                      {/* Factory Graphic on Riverbank */}
                      <g transform={`translate(${outfallX - 35}, 5)`}>
                        {/* Factory Building */}
                        <rect x="0" y="10" width="70" height="38" fill="#1e293b" stroke="var(--border-color)" rx="3" strokeWidth="1.2" />
                        <rect x="8" y="18" width="10" height="10" fill="#38bdf8" opacity="0.5" />
                        <rect x="24" y="18" width="10" height="10" fill="#38bdf8" opacity="0.5" />
                        <rect x="40" y="18" width="10" height="10" fill="#38bdf8" opacity="0.5" />
                        {/* Smokestack */}
                        <rect x="52" y="0" width="10" height="14" fill="#334155" />
                        {/* Smoke puff */}
                        <circle cx="57" cy="-4" r="5" fill="rgba(255,255,255,0.25)" />
                        <circle cx="62" cy="-9" r="7" fill="rgba(255,255,255,0.15)" />
                        {/* Factory Label */}
                        <text x="35" y="42" fill="#cbd5e1" fontSize="8" fontWeight="700" textAnchor="middle">
                          INDUSTRIAL PLANT
                        </text>
                        {/* Discharge Pipe entering river */}
                        <rect x="30" y="48" width="10" height="12" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
                        {/* Flow bubble at pipe outfall */}
                        <circle cx="35" cy="62" r="6" fill="#f59e0b" opacity="0.8" />
                      </g>

                      {/* Outfall Pin & Label */}
                      <g transform={`translate(${outfallX}, 55)`}>
                        <line x1="0" y1="0" x2="0" y2="40" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
                        <circle cx="0" cy="5" r="4" fill="#f59e0b" />
                        <rect x="-65" y="42" width="130" height="20" fill="rgba(15, 23, 42, 0.9)" stroke="#f59e0b" rx="4" />
                        <text x="0" y="55" fill="#fde68a" fontSize="9" fontWeight="700" textAnchor="middle">
                          Outfall: {qEffluentMgd.toFixed(2)} MGD @ {cEffluentMgL.toFixed(1)} mg/L
                        </text>
                      </g>

                      {/* Compliance Station Buoy & Monitoring Sonde */}
                      <g transform={`translate(${complianceX}, 110)`}>
                        {/* Vertical target line */}
                        <line x1="0" y1="-50" x2="0" y2="50" stroke={calcs.isCompliant ? '#10b981' : '#f43f5e'} strokeWidth="2" strokeDasharray="4 4" />
                        
                        {/* Floating Buoy */}
                        <circle cx="0" cy="0" r="10" fill={calcs.isCompliant ? '#065f46' : '#9f1239'} stroke={calcs.isCompliant ? '#10b981' : '#f43f5e'} strokeWidth="2" />
                        <circle cx="0" cy="-6" r="4" fill={calcs.isCompliant ? '#34d399' : '#f87171'}>
                          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                        <text x="0" y="3" fill="#fff" fontSize="8" fontWeight="800" textAnchor="middle">
                          SONDE
                        </text>

                        {/* Buoy Tag */}
                        <rect x="-70" y="18" width="140" height="28" fill="rgba(15, 23, 42, 0.95)" stroke={calcs.isCompliant ? '#10b981' : '#f43f5e'} rx="4" />
                        <text x="0" y="31" fill={calcs.isCompliant ? '#34d399' : '#f87171'} fontSize="9" fontWeight="700" textAnchor="middle">
                          Compliance Station (Mile {complianceMile})
                        </text>
                        <text x="0" y="42" fill="#cbd5e1" fontSize="8.5" textAnchor="middle">
                          C = {calcs.cComplianceMgL.toFixed(2)} mg/L (Limit: {cLimitMgL.toFixed(1)})
                        </text>
                      </g>
                    </>
                  );
                })()}

                {/* River Mileage Axis Tick Marks */}
                <g transform="translate(50, 195)" stroke="var(--border-color)" strokeWidth="1">
                  <line x1="0" y1="0" x2="800" y2="0" />
                  {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((m) => {
                    const x = (m / totalReachMiles) * 800;
                    return (
                      <g key={m} transform={`translate(${x}, 0)`}>
                        <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" />
                        <text x="0" y="18" fill="#94a3b8" fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)">
                          {m} mi
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>

          {/* ================================================================= */}
          {/* LONGITUDINAL CONCENTRATION PROFILE C(x) CHART                     */}
          {/* ================================================================= */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong style={{ fontSize: '0.95rem', color: '#f1f5f9' }}>
                  Downstream Longitudinal Concentration Profile: C(x) vs River Mile
                </strong>
                <span className="text-xs text-muted" style={{ display: 'block' }}>
                  Step jump at effluent outfall followed by 1st-order decay C(x) = C_mix · e^(-k·t). Red line marks regulatory limit.
                </span>
              </div>
              <span className="glass-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                Travel Time: {(calcs.travelTimeDays * 24).toFixed(1)} hrs ({calcs.distanceMiles.toFixed(1)} mi @ {vRiverFps} ft/s)
              </span>
            </div>

            {/* Profile Plot SVG */}
            <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(7, 12, 22, 0.85)', borderRadius: '10px', padding: '0.5rem', border: '1px solid var(--border-color)' }}>
              <svg viewBox="0 0 900 160" style={{ width: '100%', minWidth: '700px', height: 'auto', display: 'block' }}>
                {(() => {
                  const maxPlotC = Math.max(10.0, calcs.cMixMgL * 1.25, cLimitMgL * 1.5);
                  const plotW = 800;
                  const plotH = 110;
                  const originX = 55;
                  const originY = 130;

                  const mapX = (mile) => originX + (mile / totalReachMiles) * plotW;
                  const mapY = (c) => originY - (c / maxPlotC) * plotH;

                  // Path d string
                  const pathD = profilePoints.map((pt, idx) => {
                    const x = mapX(pt.mile);
                    const y = mapY(pt.conc);
                    return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  }).join(' ');

                  const outfallX = mapX(outfallMile);
                  const complianceX = mapX(complianceMile);
                  const limitY = mapY(cLimitMgL);

                  return (
                    <>
                      {/* Grid Lines */}
                      {[0, 2, 4, 6, 8, 10].filter(c => c <= maxPlotC).map(c => (
                        <g key={c}>
                          <line x1={originX} y1={mapY(c)} x2={originX + plotW} y2={mapY(c)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                          <text x={originX - 6} y={mapY(c) + 3} fill="#64748b" fontSize="8.5" textAnchor="end" fontFamily="var(--font-mono)">
                            {c} mg/L
                          </text>
                        </g>
                      ))}

                      {/* Regulatory Limit Line (Red Dashed) */}
                      <line x1={originX} y1={limitY} x2={originX + plotW} y2={limitY} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="6 4" />
                      <text x={originX + plotW - 10} y={limitY - 5} fill="#f43f5e" fontSize="9" fontWeight="700" textAnchor="end">
                        Regulatory Limit = {cLimitMgL.toFixed(1)} mg/L
                      </text>

                      {/* Outfall marker line */}
                      <line x1={outfallX} y1={originY - plotH} x2={outfallX} y2={originY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />

                      {/* Compliance Station line */}
                      <line x1={complianceX} y1={originY - plotH} x2={complianceX} y2={originY} stroke={calcs.isCompliant ? '#10b981' : '#f43f5e'} strokeWidth="1.5" strokeDasharray="3 2" />

                      {/* Concentration Profile Curve */}
                      <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

                      {/* Outfall Jump Point */}
                      <circle cx={outfallX} cy={mapY(calcs.cMixMgL)} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
                      <text x={outfallX + 6} y={mapY(calcs.cMixMgL) - 5} fill="#fde68a" fontSize="8.5" fontWeight="700">
                        C_mix = {calcs.cMixMgL.toFixed(2)} mg/L
                      </text>

                      {/* Compliance Point */}
                      <circle cx={complianceX} cy={mapY(calcs.cComplianceMgL)} r="5" fill={calcs.isCompliant ? '#10b981' : '#f43f5e'} stroke="#fff" strokeWidth="1.5" />
                      <text x={complianceX} y={originY + 18} fill={calcs.isCompliant ? '#34d399' : '#f87171'} fontSize="9" fontWeight="700" textAnchor="middle">
                        Mile {complianceMile}: {calcs.cComplianceMgL.toFixed(2)} mg/L
                      </text>

                      {/* X Axis */}
                      <line x1={originX} y1={originY} x2={originX + plotW} y2={originY} stroke="#94a3b8" />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SLIDERS & PARAMETER CONTROLS GRID                                */}
          {/* ================================================================= */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {/* Box 1: Upstream River Parameters */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderTop: '3px solid var(--accent-blue)' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--accent-blue)', display: 'block', marginBottom: '1rem' }}>
                🌊 Upstream River Characteristics
              </strong>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">Upstream River Flow (Q_r):</span>
                    <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                      {qRiverCfs.toFixed(0)} cfs ({ (qRiverCfs * CFS_TO_MGD).toFixed(1) } MGD)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="1000"
                    step="5"
                    value={qRiverCfs}
                    onChange={(e) => setQRiverCfs(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">Background Pollutant Conc. (C_r):</span>
                    <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                      {cRiverMgL.toFixed(2)} mg/L
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="5.0"
                    step="0.1"
                    value={cRiverMgL}
                    onChange={(e) => setCRiverMgL(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">River Flow Velocity (v):</span>
                    <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                      {vRiverFps.toFixed(2)} ft/s ({ (vRiverFps * 0.681818).toFixed(2) } mph)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="5.0"
                    step="0.1"
                    value={vRiverFps}
                    onChange={(e) => setVRiverFps(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Factory Effluent & Treatment Plant */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderTop: '3px solid var(--accent-emerald)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>
                  🏭 Factory Discharge &amp; Treatment
                </strong>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    onClick={() => setFlowUnit('mgd')}
                    className="btn-secondary"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      background: flowUnit === 'mgd' ? 'var(--accent-emerald)' : 'transparent',
                      color: flowUnit === 'mgd' ? '#070a12' : 'var(--text-muted)'
                    }}
                  >
                    MGD
                  </button>
                  <button
                    onClick={() => setFlowUnit('cfs')}
                    className="btn-secondary"
                    style={{
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      background: flowUnit === 'cfs' ? 'var(--accent-emerald)' : 'transparent',
                      color: flowUnit === 'cfs' ? '#070a12' : 'var(--text-muted)'
                    }}
                  >
                    cfs
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">Effluent Discharge Flow (Q_e):</span>
                    <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                      {qEffluentMgd.toFixed(2)} MGD ({qEffluentCfs.toFixed(2)} cfs)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={flowUnit === 'mgd' ? '0.5' : '1.0'}
                    max={flowUnit === 'mgd' ? '40.0' : '60.0'}
                    step={flowUnit === 'mgd' ? '0.25' : '0.5'}
                    value={qEffluentInput}
                    onChange={(e) => setQEffluentInput(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">Raw Pollutant Conc. (C_raw):</span>
                    <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                      {cRawMgL.toFixed(1)} mg/L
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={cRawMgL}
                    onChange={(e) => setCRawMgL(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">Treatment Removal Efficiency (η):</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                      {removalEffPct.toFixed(1)}% (C_e = {cEffluentMgL.toFixed(2)} mg/L)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="95"
                    step="1"
                    value={removalEffPct}
                    onChange={(e) => setRemovalEffPct(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Box 3: Positional Outfall & Compliance Sizing */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderTop: '3px solid var(--accent-purple)' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--accent-purple)', display: 'block', marginBottom: '1rem' }}>
                📍 Positional Outfall &amp; Permitting Limits
              </strong>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">Effluent Outfall Location (x_outfall):</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                      Mile {outfallMile.toFixed(1)} (Station {(outfallMile * 52.8).toFixed(0)}+00)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="14.0"
                    step="0.5"
                    value={outfallMile}
                    onChange={(e) => setOutfallMile(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">Compliance Monitoring Station (x_compliance):</span>
                    <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                      Mile {complianceMile.toFixed(1)} (+{calcs.distanceMiles.toFixed(1)} mi downstream)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="2.0"
                    max="20.0"
                    step="0.5"
                    value={complianceMile}
                    onChange={(e) => setComplianceMile(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">Stream Water Quality Standard (C_limit):</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                      {cLimitMgL.toFixed(1)} mg/L
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="8.0"
                    step="0.2"
                    value={cLimitMgL}
                    onChange={(e) => setCLimitMgL(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span className="text-xs text-muted">First-Order Pollutant Decay Rate (k):</span>
                    <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                      {decayRateK === 0 ? '0.0 /day (Conservative)' : `${decayRateK.toFixed(2)} /day`}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.5"
                    step="0.02"
                    value={decayRateK}
                    onChange={(e) => setDecayRateK(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* STEP-BY-STEP PE EXAM DERIVATION & SOLUTION CARD                   */}
          {/* ================================================================= */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.9)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--accent-cyan)' }}>
              📐 Step-by-Step PE Exam Solution &amp; Permit Sizing Derivation
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', display: 'block', marginBottom: '0.35rem' }}>
                  Step 1: Treated Effluent Concentration
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '6px' }}>
                  C_e = C_raw · (1 − η)<br />
                  C_e = {cRawMgL.toFixed(1)} · (1 − {(removalEffPct / 100).toFixed(2)}) = <strong>{cEffluentMgL.toFixed(2)} mg/L</strong>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', display: 'block', marginBottom: '0.35rem' }}>
                  Step 2: Steady-State Dilution Mass Balance
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '6px' }}>
                  Q_r · C_r + Q_e · C_e = (Q_r + Q_e) · C_mix<br />
                  Q_e · (C_e − C_limit) = Q_r · (C_limit − C_r)
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--accent-purple)', display: 'block', marginBottom: '0.35rem' }}>
                  Step 3: Maximum Allowable Discharge Sizing
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '6px' }}>
                  Q_e,max = Q_r · (C_limit − C_r) / (C_e − C_limit)<br />
                  Q_e,max = {qRiverCfs} · ({cLimitMgL.toFixed(1)} − {cRiverMgL.toFixed(1)}) / ({cEffluentMgL.toFixed(2)} − {cLimitMgL.toFixed(1)})<br />
                  Q_e,max = <strong>{calcs.qAllowableCfs.toFixed(2)} cfs</strong>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', display: 'block', marginBottom: '0.35rem' }}>
                  Step 4: Unit Conversion (cfs to MGD) — PE Exam Trap!
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '6px' }}>
                  1 cfs = 7.48 gal/ft³ × 86,400 s/day / 10⁶ = <strong>0.6463 MGD</strong><br />
                  Q_e,max = {calcs.qAllowableCfs.toFixed(2)} cfs × 0.6463 MGD/cfs<br />
                  Q_e,max = <strong style={{ color: 'var(--accent-emerald)', fontSize: '1rem' }}>{calcs.qAllowableMgd.toFixed(2)} MGD</strong>
                </div>
              </div>
            </div>

            {/* 3rd-Grader Intuition Callout */}
            <div style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '1.4rem' }}>👦</span>
              <div>
                <strong style={{ color: 'var(--accent-purple)', fontSize: '0.85rem', display: 'block' }}>
                  3rd-Grader Intuition: The Swimming Pool Dye Mystery
                </strong>
                <span style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  Think of the river like a big, rushing garden hose with 225 buckets of clean water shooting out every second. A factory wants to squirt in dirty red dye. If the factory squirts too fast, the whole stream turns bright red! The mass balance equation is just a scale telling the factory the exact maximum squirt speed (14.5 million gallons per day) so the water never turns more than light pink!
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: DISSOLVED OXYGEN & THERMAL MASS BALANCE (PE PROBLEM #29)       */}
      {/* ===================================================================== */}
      {activeTab === 'do-balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top DO Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-blue)' }}>
              <span className="text-xs text-muted" style={{ display: 'block' }}>Upstream River DO (at {doRiverTempC}°C)</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--accent-blue)' }}>
                {doCalcs.doRiverSat.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>mg/L</span>
              </strong>
              <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                Flow: {doRiverFlowCfs.toFixed(1)} cfs (100% Saturation)
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-amber)' }}>
              <span className="text-xs text-muted" style={{ display: 'block' }}>Mixed Downstream DO (at {doMixedTempC}°C)</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--accent-amber)' }}>
                {doCalcs.doMixedSat.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>mg/L</span>
              </strong>
              <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                Total Flow: {doCalcs.qMixCfs.toFixed(2)} cfs (Warmer river holds less DO)
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-emerald)' }}>
              <span className="text-xs text-muted" style={{ display: 'block' }}>Solved Effluent DO (DO_e)</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--accent-emerald)' }}>
                {doCalcs.doEffluentMgL.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>mg/L</span>
              </strong>
              <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                Discharge: {doEffluentFlowMgd} MGD = {doCalcs.qeCfs.toFixed(2)} cfs
              </span>
            </div>
          </div>

          {/* DO Sliders */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <strong style={{ fontSize: '0.95rem', color: '#f1f5f9', display: 'block', marginBottom: '1rem' }}>
              🐟 Dissolved Oxygen &amp; Thermal Mixing Parameters
            </strong>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span className="text-xs text-muted">Industrial Effluent Flow (Q_e):</span>
                  <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                    {doEffluentFlowMgd.toFixed(1)} MGD ({doCalcs.qeCfs.toFixed(2)} cfs)
                  </strong>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="20.0"
                  step="0.5"
                  value={doEffluentFlowMgd}
                  onChange={(e) => setDoEffluentFlowMgd(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span className="text-xs text-muted">Upstream River Discharge (Q_r):</span>
                  <strong style={{ fontSize: '0.85rem', color: '#f1f5f9', fontFamily: 'var(--font-mono)' }}>
                    {doRiverFlowCfs.toFixed(0)} cfs
                  </strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="5"
                  value={doRiverFlowCfs}
                  onChange={(e) => setDoRiverFlowCfs(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span className="text-xs text-muted">Upstream River Water Temp (T_r):</span>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                    {doRiverTempC.toFixed(1)}°C (DO_sat = {doCalcs.doRiverSat.toFixed(2)} mg/L)
                  </strong>
                </div>
                <input
                  type="range"
                  min="20"
                  max="35"
                  step="1"
                  value={doRiverTempC}
                  onChange={(e) => setDoRiverTempC(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span className="text-xs text-muted">Downstream Mixed River Temp (T_mix):</span>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                    {doMixedTempC.toFixed(1)}°C (DO_sat = {doCalcs.doMixedSat.toFixed(2)} mg/L)
                  </strong>
                </div>
                <input
                  type="range"
                  min="22"
                  max="38"
                  step="1"
                  value={doMixedTempC}
                  onChange={(e) => setDoMixedTempC(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* DO Derivation Card */}
          <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.9)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: 'var(--accent-emerald)' }}>
              📐 Step-by-Step Dissolved Oxygen Mass Balance (PE #29)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontFamily: 'var(--font-body)' }}>
                  1. Unit Conversion (MGD → cfs)
                </span>
                Q_e = {doEffluentFlowMgd} MGD / 0.6463 MGD/cfs<br />
                Q_e = <strong>{doCalcs.qeCfs.toFixed(2)} cfs</strong><br />
                Q_mix = {doRiverFlowCfs} + {doCalcs.qeCfs.toFixed(2)} = <strong>{doCalcs.qMixCfs.toFixed(2)} cfs</strong>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontFamily: 'var(--font-body)' }}>
                  2. Saturated DO Lookup (NCEES Handbook)
                </span>
                DO_r (30°C) = <strong>{doCalcs.doRiverSat.toFixed(2)} mg/L</strong><br />
                DO_mix (34°C) = <strong>{doCalcs.doMixedSat.toFixed(2)} mg/L</strong><br />
                (Warm water holds less dissolved oxygen)
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px' }}>
                <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontFamily: 'var(--font-body)' }}>
                  3. Mass Balance Substitution
                </span>
                Q_e · DO_e + Q_r · DO_r = Q_mix · DO_mix<br />
                {doCalcs.qeCfs.toFixed(2)} · DO_e + ({doRiverFlowCfs} · {doCalcs.doRiverSat.toFixed(2)}) = {doCalcs.qMixCfs.toFixed(2)} · {doCalcs.doMixedSat.toFixed(2)}<br />
                DO_e = <strong style={{ color: 'var(--accent-emerald)', fontSize: '1rem' }}>{doCalcs.doEffluentMgL.toFixed(2)} mg/L</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiverMassBalanceVisualizer;
