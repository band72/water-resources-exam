import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';
import PeriodicNuclearStudio from './PeriodicNuclearStudio';

// =========================================================================
// CHEMISTRY & RADIONUCLIDE DATA DICTIONARIES
// =========================================================================

// Common Water Ions & Equivalent Weights (EW = MW / |Valence|)
const WATER_IONS = [
  { id: 'ca', name: 'Calcium', formula: 'Ca²⁺', charge: 2, mw: 40.08, ew: 20.04, type: 'cation', color: '#38bdf8', defaultMgL: 60.0 },
  { id: 'mg', name: 'Magnesium', formula: 'Mg²⁺', charge: 2, mw: 24.31, ew: 12.15, type: 'cation', color: '#06b6d4', defaultMgL: 24.0 },
  { id: 'na', name: 'Sodium', formula: 'Na⁺', charge: 1, mw: 22.99, ew: 22.99, type: 'cation', color: '#10b981', defaultMgL: 15.0 },
  { id: 'k', name: 'Potassium', formula: 'K⁺', charge: 1, mw: 39.10, ew: 39.10, type: 'cation', color: '#34d399', defaultMgL: 4.0 },
  { id: 'hco3', name: 'Bicarbonate', formula: 'HCO₃⁻', charge: -1, mw: 61.01, ew: 61.01, type: 'anion', color: '#f59e0b', defaultMgL: 183.0 },
  { id: 'so4', name: 'Sulfate', formula: 'SO₄²⁻', charge: -2, mw: 96.06, ew: 48.03, type: 'anion', color: '#a855f7', defaultMgL: 96.0 },
  { id: 'cl', name: 'Chloride', formula: 'Cl⁻', charge: -1, mw: 35.45, ew: 35.45, type: 'anion', color: '#f43f5e', defaultMgL: 35.5 },
  { id: 'no3', name: 'Nitrate', formula: 'NO₃⁻', charge: -1, mw: 62.00, ew: 62.00, type: 'anion', color: '#ec4899', defaultMgL: 6.2 }
];

// Studio tab for a given problem id
const modeForProblem = (id) => {
  if (id === 194) return 'periodic-nuclear';
  if (id === 87 || id === 88 || id === 89 || id === 93 || id === 94) return 'meq-chemistry';
  return '3d-hardness';
};

const HardnessVisualizer = ({ problem }) => {
  const [activeTab, setActiveTab] = useState(() => modeForProblem(problem?.id));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTheory, setShowTheory] = useState(true);

  // Reset the tab when navigating to a different problem (React "adjust state on prop change" pattern;
  // avoids a setState-inside-useEffect cascade render)
  const [prevProblemId, setPrevProblemId] = useState(problem?.id);
  if (problem?.id !== prevProblemId) {
    setPrevProblemId(problem?.id);
    setActiveTab(modeForProblem(problem?.id));
  }

  // =========================================================================
  // TAB 1: 3D WATER HARDNESS STATE & 3RD-GRADER LAB
  // =========================================================================
  const [caMgL, setCaMgL] = useState(60.0); // Calcium raw mg/L
  const [mgMgL, setMgMgL] = useState(24.0); // Magnesium raw mg/L
  const [alkalinityMgL, setAlkalinityMgL] = useState(180.0); // Alkalinity as CaCO3
  const [soapActive, setSoapActive] = useState(false);
  const [heatBoiling, setHeatBoiling] = useState(false);
  const [resinSoftened, setResinSoftened] = useState(false);

  // 3D Canvas Reference
  const canvasRef = useRef(null);
  const rotationRef = useRef({ rotX: 0.35, rotY: 0.55, isDragging: false, lastX: 0, lastY: 0 });

  // Compute Water Hardness Metrics
  const hardnessMetrics = useMemo(() => {
    // Equivalent weights
    const EW_Ca = 20.04;
    const EW_Mg = 12.15;
    const EW_CaCO3 = 50.04;

    // meq/L
    const meqCa = caMgL / EW_Ca;
    const meqMg = mgMgL / EW_Mg;
    const meqTotal = meqCa + meqMg;

    // mg/L as CaCO3
    const caHardnessCaCO3 = meqCa * EW_CaCO3;
    const mgHardnessCaCO3 = meqMg * EW_CaCO3;
    const totalHardness = caHardnessCaCO3 + mgHardnessCaCO3;

    // Carbonate vs Non-Carbonate Hardness Partition
    let carbonateHardness;
    let nonCarbonateHardness;

    if (alkalinityMgL < totalHardness) {
      carbonateHardness = alkalinityMgL;
      nonCarbonateHardness = totalHardness - alkalinityMgL;
    } else {
      carbonateHardness = totalHardness;
      nonCarbonateHardness = 0;
    }

    // Classification
    let classification;
    let classColor;
    if (totalHardness > 180) {
      classification = 'Very Hard (> 180 mg/L)';
      classColor = '#ef4444';
    } else if (totalHardness > 120) {
      classification = 'Hard (121 - 180 mg/L)';
      classColor = '#f59e0b';
    } else if (totalHardness > 60) {
      classification = 'Moderately Hard (61 - 120 mg/L)';
      classColor = '#38bdf8';
    } else {
      classification = 'Soft (0 - 60 mg/L)';
      classColor = '#10b981';
    }

    return {
      meqCa,
      meqMg,
      meqTotal,
      caHardnessCaCO3,
      mgHardnessCaCO3,
      totalHardness,
      carbonateHardness,
      nonCarbonateHardness,
      classification,
      classColor
    };
  }, [caMgL, mgMgL, alkalinityMgL]);

  // 3D Canvas Animation Loop (Rendering 3D Beaker, Floating Ions, Soap Scum & Foam)
  useEffect(() => {
    if (activeTab !== '3d-hardness') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;
    let time = 0;

    // Generate random 3D particle positions for ions
    const particleCount = 28;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 140,
        y: (Math.random() - 0.5) * 150,
        z: (Math.random() - 0.5) * 140,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
        type: i % 3 === 0 ? 'ca' : (i % 3 === 1 ? 'mg' : 'hco3')
      });
    }

    const render = () => {
      time += 0.02;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const focalLength = 320;

      const rotX = rotationRef.current.rotX;
      if (!rotationRef.current.isDragging) rotationRef.current.rotY += 0.003; // gentle auto rotation
      const rotY = rotationRef.current.rotY;

      // 3D projection function
      const project = (x, y, z) => {
        // Rotate around Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // Rotate around X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const distance = focalLength + z2 + 250;
        const scale = distance > 10 ? focalLength / distance : 0;
        const projX = centerX + x1 * scale;
        const projY = centerY + y2 * scale;
        return { projX, projY, scale, z: z2 };
      };

      // 1. Draw 3D Cylindrical Glass Beaker Wireframe
      const beakerRadius = 90;
      const beakerHeight = 180;
      const rimSegments = 24;

      // Draw bottom ellipse
      ctx.beginPath();
      for (let i = 0; i <= rimSegments; i++) {
        const angle = (i / rimSegments) * Math.PI * 2;
        const p = project(Math.cos(angle) * beakerRadius, beakerHeight / 2, Math.sin(angle) * beakerRadius);
        if (i === 0) ctx.moveTo(p.projX, p.projY);
        else ctx.lineTo(p.projX, p.projY);
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw top rim ellipse
      ctx.beginPath();
      for (let i = 0; i <= rimSegments; i++) {
        const angle = (i / rimSegments) * Math.PI * 2;
        const p = project(Math.cos(angle) * beakerRadius, -beakerHeight / 2, Math.sin(angle) * beakerRadius);
        if (i === 0) ctx.moveTo(p.projX, p.projY);
        else ctx.lineTo(p.projX, p.projY);
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw vertical beaker glass struts
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const top = project(Math.cos(angle) * beakerRadius, -beakerHeight / 2, Math.sin(angle) * beakerRadius);
        const bot = project(Math.cos(angle) * beakerRadius, beakerHeight / 2, Math.sin(angle) * beakerRadius);
        ctx.beginPath();
        ctx.moveTo(top.projX, top.projY);
        ctx.lineTo(bot.projX, bot.projY);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw Translucent Water Level
      const waterTopY = -beakerHeight / 2 + 35;
      ctx.beginPath();
      for (let i = 0; i <= rimSegments; i++) {
        const angle = (i / rimSegments) * Math.PI * 2;
        const p = project(Math.cos(angle) * (beakerRadius - 2), waterTopY, Math.sin(angle) * (beakerRadius - 2));
        if (i === 0) ctx.moveTo(p.projX, p.projY);
        else ctx.lineTo(p.projX, p.projY);
      }
      ctx.fillStyle = resinSoftened ? 'rgba(16, 185, 129, 0.12)' : (soapActive && !resinSoftened ? 'rgba(148, 163, 184, 0.2)' : 'rgba(6, 182, 212, 0.15)');
      ctx.fill();
      ctx.strokeStyle = resinSoftened ? 'rgba(16, 185, 129, 0.6)' : 'rgba(6, 182, 212, 0.5)';
      ctx.stroke();

      // 2. Animate and Draw Floating Ions & Precipitates
      particles.forEach((part) => {
        // Brownian motion
        part.x += part.vx + Math.sin(time + part.y) * 0.1;
        part.y += part.vy + Math.cos(time + part.x) * 0.1;
        part.z += part.vz;

        // Container boundary bounce
        if (Math.abs(part.x) > beakerRadius - 10) part.vx *= -1;
        if (part.y > beakerHeight / 2 - 10) part.vy *= -1;
        if (part.y < waterTopY + 10) part.vy *= -1;
        if (Math.abs(part.z) > beakerRadius - 10) part.vz *= -1;

        // If Heat/Boiling is active: Calcium carbonate precipitates to the bottom!
        if (heatBoiling && part.type === 'ca') {
          part.y = Math.min(beakerHeight / 2 - 6, part.y + 1.2); // settle to bottom
        }

        // Project particle
        const p = project(part.x, part.y, part.z);

        // Ion Color & Symbol
        let color = '#38bdf8';
        let label = 'Ca²⁺';
        let baseRadius = 8;

        if (resinSoftened) {
          // Softened: Calcium replaced with Sodium Na+
          color = '#10b981';
          label = 'Na⁺';
          baseRadius = 6;
        } else if (soapActive) {
          // Hard water + soap = Sticky Soap Scum Curd!
          color = '#94a3b8';
          label = 'Curd ⚠️';
          baseRadius = 10;
        } else if (part.type === 'mg') {
          color = '#06b6d4';
          label = 'Mg²⁺';
          baseRadius = 7;
        } else if (part.type === 'hco3') {
          color = '#f59e0b';
          label = 'HCO₃⁻';
          baseRadius = 6.5;
        }

        const r = Math.max(2, baseRadius * p.scale);

        // Draw glowing 3D spherical particle
        const grad = ctx.createRadialGradient(p.projX - r * 0.3, p.projY - r * 0.3, r * 0.1, p.projX, p.projY, r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, 'rgba(0,0,0,0.8)');

        ctx.beginPath();
        ctx.arc(p.projX, p.projY, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Ion text label
        if (p.scale > 0.6) {
          ctx.font = `${Math.round(8 * p.scale)}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(label, p.projX, p.projY - r - 2);
        }
      });

      // 3. Soap Scum vs Foam Layer Simulation at Water Surface
      if (soapActive) {
        if (resinSoftened) {
          // Soft water: Rich fluffy soap bubbles at top!
          for (let b = 0; b < 16; b++) {
            const bx = Math.sin(b * 1.3) * 60;
            const bz = Math.cos(b * 1.3) * 60;
            const by = waterTopY - 8 - Math.sin(time * 2 + b) * 3;
            const bp = project(bx, by, bz);
            ctx.beginPath();
            ctx.arc(bp.projX, bp.projY, 9 * bp.scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
            ctx.stroke();
          }
        } else {
          // Hard water: Sticky greasy soap scum crust!
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#f43f5e';
          ctx.textAlign = 'center';
          const badgePos = project(0, waterTopY - 14, 0);
          ctx.fillText('⚠️ SOAP SCUM CURD (NO LATHER)', badgePos.projX, badgePos.projY);
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [activeTab, soapActive, heatBoiling, resinSoftened]);

  // Mouse handlers for 3D orbital dragging
  const handleMouseDown = (e) => {
    rotationRef.current.isDragging = true;
    rotationRef.current.lastX = e.clientX;
    rotationRef.current.lastY = e.clientY;
  };

  const handleMouseMove = (e) => {
    if (!rotationRef.current.isDragging) return;
    const deltaX = e.clientX - rotationRef.current.lastX;
    const deltaY = e.clientY - rotationRef.current.lastY;
    rotationRef.current.rotY += deltaX * 0.008;
    rotationRef.current.rotX += deltaY * 0.008;
    rotationRef.current.lastX = e.clientX;
    rotationRef.current.lastY = e.clientY;
  };

  const handleMouseUp = () => {
    rotationRef.current.isDragging = false;
  };

  // =========================================================================
  // TAB 2: MEQ CONVERTER & EQUATION BALANCER STATE
  // =========================================================================
  const [ionConcentrations, setIonConcentrations] = useState(() => {
    const initial = {};
    WATER_IONS.forEach((ion) => {
      initial[ion.id] = ion.defaultMgL;
    });
    return initial;
  });

  // Softening Plant Design Parameters
  const [plantFlowMgd, setPlantFlowMgd] = useState(5.0); // MGD
  const [freeCo2MgL, setFreeCo2MgL] = useState(15.0); // mg/L as CaCO3
  const [excessLimeDose, setExcessLimeDose] = useState(35.0); // mg/L as CaCO3

  // Cation-Anion Balance Calculations
  const balanceData = useMemo(() => {
    let totalCationsMeq = 0;
    let totalAnionsMeq = 0;
    const ionDetails = [];

    WATER_IONS.forEach((ion) => {
      const mgL = ionConcentrations[ion.id] || 0;
      const meqL = mgL / ion.ew;
      const mgLAsCaCO3 = meqL * 50.04;

      if (ion.type === 'cation') totalCationsMeq += meqL;
      else totalAnionsMeq += meqL;

      ionDetails.push({ ...ion, mgL, meqL, mgLAsCaCO3 });
    });

    const sumMeq = totalCationsMeq + totalAnionsMeq;
    const diffMeq = Math.abs(totalCationsMeq - totalAnionsMeq);
    const errorPct = sumMeq > 0 ? (diffMeq / sumMeq) * 100 : 0;
    const isBalanced = errorPct <= 5.0;

    // Lime-Soda Ash Stoichiometric Sizing
    // Lime reacts with: CO2 + Ca(HCO3)2 + 2*Mg(HCO3)2 + MgSO4 + excess
    const caMeq = (ionConcentrations['ca'] || 0) / 20.04;
    const mgMeq = (ionConcentrations['mg'] || 0) / 12.15;
    const hco3Meq = (ionConcentrations['hco3'] || 0) / 61.01;

    const caHardness = caMeq * 50.04;
    const mgHardness = mgMeq * 50.04;
    const totalHardness = caHardness + mgHardness;
    const alkalinity = hco3Meq * 50.04;

    const carbonateHardness = Math.min(totalHardness, alkalinity);
    const nonCarbonateHardness = Math.max(0, totalHardness - carbonateHardness);

    // Lime required (as CaCO3)
    // Lime = CO2 + HCO3- alkalinity (lime reacts with ALL bicarbonate) + Mg2+ + excess  (all as CaCO3)
    const limeDoseCaCO3 = freeCo2MgL + alkalinity + mgHardness + excessLimeDose;
    // Pure Hydrated Lime Ca(OH)2 MW = 74.1, CaCO3 MW = 100.1 => 74.1/100.1 = 0.741
    const limeDoseCaOH2 = limeDoseCaCO3 * 0.741;
    const limeLbsPerDay = plantFlowMgd * 8.34 * limeDoseCaOH2;

    // Soda Ash required (as CaCO3) = Noncarbonate Hardness
    const sodaAshDoseCaCO3 = nonCarbonateHardness;
    // Pure Soda Ash Na2CO3 MW = 106.0, CaCO3 MW = 100.1 => 106.0/100.1 = 1.059
    const sodaAshDoseNa2CO3 = sodaAshDoseCaCO3 * 1.059;
    const sodaAshLbsPerDay = plantFlowMgd * 8.34 * sodaAshDoseNa2CO3;

    return {
      ionDetails,
      totalCationsMeq,
      totalAnionsMeq,
      errorPct,
      isBalanced,
      totalHardness,
      carbonateHardness,
      nonCarbonateHardness,
      limeDoseCaCO3,
      limeDoseCaOH2,
      limeLbsPerDay,
      sodaAshDoseCaCO3,
      sodaAshDoseNa2CO3,
      sodaAshLbsPerDay
    };
  }, [ionConcentrations, plantFlowMgd, freeCo2MgL, excessLimeDose]);


  // Main UI Render Content
  const visualizerContent = (
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
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: activeTab === '3d-hardness' ? 'rgba(56, 189, 248, 0.15)' : (activeTab === 'meq-chemistry' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(168, 85, 247, 0.15)'),
            border: activeTab === '3d-hardness' ? '1px solid rgba(56, 189, 248, 0.4)' : (activeTab === 'meq-chemistry' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(168, 85, 247, 0.4)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem'
          }}>
            {activeTab === '3d-hardness' ? '🧊' : (activeTab === 'meq-chemistry' ? '⚗️' : '⚛️')}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
                {activeTab === '3d-hardness'
                  ? '3D Water Hardness & 3rd-Grader Softening Studio'
                  : (activeTab === 'meq-chemistry'
                    ? 'Meq Chemistry, Electroneutrality & Equation Balancer'
                    : 'Interactive Periodic Table & Nuclear Radionuclide Studio')}
              </h2>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-blue, #38bdf8)',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                PE Exam Interactive Lab
              </span>
            </div>
            <p className="text-xs text-muted" style={{ margin: '0.25rem 0 0 0' }}>
              {activeTab === '3d-hardness'
                ? 'Orbital 3D beaker with Ca²⁺/Mg²⁺ mineral magnets, soap scum curd formation, boiling kettle scale, and 3rd-grader intuition.'
                : (activeTab === 'meq-chemistry'
                  ? 'Milliequivalent conversions (meq/L = mg/L / EW), cation-anion electroneutrality check, and lime-soda ash balancing equations.'
                  : 'All 118 elements: click any tile for isotopes, decay modes, Q-values, half-lives, decay chains, neutron resonance energies and periodic trends.')}
            </p>
          </div>
        </div>

        {/* Studio Action Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === '3d-hardness' ? 'var(--accent-blue, #38bdf8)' : 'transparent',
                color: activeTab === '3d-hardness' ? '#070a12' : 'var(--text-muted)',
                fontWeight: activeTab === '3d-hardness' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              onClick={() => setActiveTab('3d-hardness')}
            >
              <span>🧊</span> 3D Hardness & 3rd-Grader
            </button>
            <button
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'meq-chemistry' ? 'var(--accent-emerald, #10b981)' : 'transparent',
                color: activeTab === 'meq-chemistry' ? '#070a12' : 'var(--text-muted)',
                fontWeight: activeTab === 'meq-chemistry' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              onClick={() => setActiveTab('meq-chemistry')}
            >
              <span>⚗️</span> Meq & Equation Balancer
            </button>
            <button
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'periodic-nuclear' ? 'var(--accent-purple, #a855f7)' : 'transparent',
                color: activeTab === 'periodic-nuclear' ? '#070a12' : 'var(--text-muted)',
                fontWeight: activeTab === 'periodic-nuclear' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              onClick={() => setActiveTab('periodic-nuclear')}
            >
              <span>⚛️</span> Periodic Table & Nuclear
            </button>
          </div>

          {/* Theory Toggle */}
          <button
            className="btn-secondary"
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
            onClick={() => setShowTheory(!showTheory)}
          >
            <span>📐</span> {showTheory ? 'Hide Theory' : 'Show Theory'}
          </button>

          {/* Fullscreen Button */}
          <button
            className="btn-secondary"
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem' }}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <span>{isFullscreen ? '✕' : '⛶'}</span> {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: 3D WATER HARDNESS & 3RD-GRADER LAB                            */}
      {/* ===================================================================== */}
      {activeTab === '3d-hardness' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: `1px solid ${hardnessMetrics.classColor}40`
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                TOTAL HARDNESS (TH)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: hardnessMetrics.classColor,
                fontFamily: 'var(--font-mono)'
              }}>
                {hardnessMetrics.totalHardness.toFixed(1)} <span style={{ fontSize: '0.85rem' }}>mg/L as CaCO₃</span>
              </div>
              <span className="text-xs" style={{ color: hardnessMetrics.classColor, fontWeight: 700 }}>
                {hardnessMetrics.classification}
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(56, 189, 248, 0.25)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                CALCIUM VS MAGNESIUM HARDNESS
              </span>
              <div style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                fontFamily: 'var(--font-mono)'
              }}>
                <span style={{ color: 'var(--accent-blue)' }}>Ca: {hardnessMetrics.caHardnessCaCO3.toFixed(1)}</span> |{' '}
                <span style={{ color: 'var(--accent-cyan)' }}>Mg: {hardnessMetrics.mgHardnessCaCO3.toFixed(1)}</span>
              </div>
              <span className="text-xs text-muted">
                {hardnessMetrics.meqTotal.toFixed(2)} meq/L total multivalent cations
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                CARBONATE HARDNESS (CH)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-emerald)',
                fontFamily: 'var(--font-mono)'
              }}>
                {hardnessMetrics.carbonateHardness.toFixed(1)} <span style={{ fontSize: '0.85rem' }}>mg/L as CaCO₃</span>
              </div>
              <span className="text-xs text-muted">
                Temporary (precipitated with lime / heat)
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(168, 85, 247, 0.25)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                NONCARBONATE HARDNESS (NCH)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-purple)',
                fontFamily: 'var(--font-mono)'
              }}>
                {hardnessMetrics.nonCarbonateHardness.toFixed(1)} <span style={{ fontSize: '0.85rem' }}>mg/L as CaCO₃</span>
              </div>
              <span className="text-xs text-muted">
                Permanent (requires soda ash Na₂CO₃)
              </span>
            </div>
          </div>

          {/* 3D Beaker & Interactive Sandbox */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.25fr) minmax(300px, 0.95fr)',
            gap: '1.5rem',
            alignItems: 'start'
          }}>
            {/* 3D Canvas Box */}
            <div style={{
              background: 'radial-gradient(ellipse at center, rgba(12, 25, 45, 0.8) 0%, rgba(7, 12, 22, 0.95) 100%)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              padding: '1rem',
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                paddingBottom: '0.5rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                  Interactive 3D Beaker (Drag with mouse to rotate in 3D)
                </span>
                <span className="text-xs text-muted">
                  3D Canvas with Real-time Floating Ions
                </span>
              </div>

              {/* HTML5 3D Canvas */}
              <canvas
                ref={canvasRef}
                width={560}
                height={380}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  cursor: 'grab',
                  borderRadius: '8px'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />

              {/* 3D Sandbox Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.75rem',
                flexWrap: 'wrap'
              }}>
                <button
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: soapActive ? '1px solid var(--accent-rose)' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: soapActive ? 'rgba(244, 63, 94, 0.2)' : 'rgba(0, 0, 0, 0.3)',
                    color: soapActive ? 'var(--accent-rose)' : 'var(--text-main)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSoapActive(!soapActive)}
                >
                  🧼 {soapActive ? 'Remove Soap' : 'Add Liquid Soap'}
                </button>

                <button
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: heatBoiling ? '1px solid var(--accent-amber)' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: heatBoiling ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 0, 0, 0.3)',
                    color: heatBoiling ? 'var(--accent-amber)' : 'var(--text-main)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setHeatBoiling(!heatBoiling)}
                >
                  🔥 {heatBoiling ? 'Cool Water' : 'Boil Water (Heat)'}
                </button>

                <button
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: resinSoftened ? '1px solid var(--accent-emerald)' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: resinSoftened ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 0, 0, 0.3)',
                    color: resinSoftened ? 'var(--accent-emerald)' : 'var(--text-main)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setResinSoftened(!resinSoftened)}
                >
                  🔄 {resinSoftened ? 'Back to Hard Water' : 'Ion-Exchange Soften (Resin)'}
                </button>
              </div>
            </div>

            {/* 3rd-Grader Storybook & Intuition Guide */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🎒</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--accent-amber)' }}>
                  Explain Water Hardness Like I'm in 3rd Grade
                </strong>
              </div>

              {/* Storybook Cards */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.78rem',
                lineHeight: 1.5
              }}>
                <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '0.2rem' }}>
                  1. The Sticky Rock Magnets (Ca²⁺ & Mg²⁺)
                </strong>
                Water naturally dissolves rocks underground. The dissolved calcium and magnesium act like tiny invisible sticky magnets! When you try to wash your hands, these magnets attack the soap molecules, steal their bubbles, and turn them into gray, sticky bathtub ring slime (soap scum)!
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.78rem',
                lineHeight: 1.5
              }}>
                <strong style={{ color: 'var(--accent-emerald)', display: 'block', marginBottom: '0.2rem' }}>
                  2. Carbonate Hardness = Temporary Tea Kettle Flakes
                </strong>
                When sticky calcium magnets hold hands with bicarbonate shields (HCO₃⁻), they are only "temporary." If you boil water in a kettle, the heat breaks their grip! The calcium falls to the bottom as crunchy white flakes (kettle scale).
              </div>

              <div style={{
                background: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.78rem',
                lineHeight: 1.5
              }}>
                <strong style={{ color: 'var(--accent-purple)', display: 'block', marginBottom: '0.2rem' }}>
                  3. Non-Carbonate Hardness = Stubborn Permanent Friends
                </strong>
                When calcium or magnesium holds hands with sulfate (SO₄²⁻), boiling does nothing! They refuse to leave. We call this "Permanent Hardness." To kick them out, we must add a special chemical powder called Soda Ash (washing soda, Na₂CO₃).
              </div>

              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.78rem',
                lineHeight: 1.5
              }}>
                <strong style={{ color: 'var(--accent-amber)', display: 'block', marginBottom: '0.2rem' }}>
                  4. The Water Softener Resin Magic Trick
                </strong>
                A home water softener is a tank filled with tiny golden plastic beads covered in friendly Sodium (Na⁺) ions. When grabby Calcium (Ca²⁺) floats by, the bead captures the calcium and lets 2 sodiums swim free! Sodium doesn't fight soap, so you get giant bubbly suds!
              </div>
            </div>
          </div>

          {/* Real-Time Hardness Sliders */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '1.25rem'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-cyan)' }}>
              PE Exam Hardness Calculator Sliders
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.25rem'
            }}>
              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Calcium Concentration (Ca²⁺):</span>
                  <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {caMgL.toFixed(1)} mg/L ({hardnessMetrics.caHardnessCaCO3.toFixed(1)} as CaCO₃)
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="2"
                  value={caMgL}
                  onChange={(e) => setCaMgL(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                />
              </div>

              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Magnesium Concentration (Mg²⁺):</span>
                  <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {mgMgL.toFixed(1)} mg/L ({hardnessMetrics.mgHardnessCaCO3.toFixed(1)} as CaCO₃)
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={mgMgL}
                  onChange={(e) => setMgMgL(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
              </div>

              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Total Alkalinity:</span>
                  <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {alkalinityMgL.toFixed(1)} mg/L as CaCO₃
                  </span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="300"
                  step="5"
                  value={alkalinityMgL}
                  onChange={(e) => setAlkalinityMgL(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MEQ CHEMISTRY, CONVERSIONS & EQUATION BALANCER                 */}
      {/* ===================================================================== */}
      {activeTab === 'meq-chemistry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Electroneutrality Top Bar */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            padding: '1.25rem',
            border: balanceData.isBalanced ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <div>
                <span className="text-xs text-muted" style={{ fontWeight: 600, display: 'block' }}>
                  ELECTRONEUTRALITY CATION-ANION BALANCE (Σ Cations = Σ Anions)
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--accent-blue)' }}>Σ Cations: {balanceData.totalCationsMeq.toFixed(2)} meq/L</span> vs{' '}
                  <span style={{ color: 'var(--accent-emerald)' }}>Σ Anions: {balanceData.totalAnionsMeq.toFixed(2)} meq/L</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '0.3rem 0.75rem',
                  borderRadius: '999px',
                  background: balanceData.isBalanced ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                  color: balanceData.isBalanced ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  border: balanceData.isBalanced ? '1px solid var(--accent-emerald)' : '1px solid var(--accent-rose)'
                }}>
                  {balanceData.isBalanced ? `✓ Balanced (Error: ${balanceData.errorPct.toFixed(1)}% ≤ 5%)` : `⚠️ Unbalanced (Error: ${balanceData.errorPct.toFixed(1)}% > 5%)`}
                </span>
              </div>
            </div>

            {/* Dual Horizontal Stacked Milliequivalent Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.75rem' }}>
              {/* Cation Bar */}
              <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.5)' }}>
                {balanceData.ionDetails.filter(i => i.type === 'cation').map((i) => {
                  const pct = balanceData.totalCationsMeq > 0 ? (i.meqL / balanceData.totalCationsMeq) * 100 : 0;
                  return (
                    <div
                      key={i.id}
                      style={{
                        width: `${pct}%`,
                        background: i.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#070a12',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                      }}
                      title={`${i.name} (${i.formula}): ${i.meqL.toFixed(2)} meq/L`}
                    >
                      {pct > 12 && `${i.formula}: ${i.meqL.toFixed(2)}`}
                    </div>
                  );
                })}
              </div>

              {/* Anion Bar */}
              <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.5)' }}>
                {balanceData.ionDetails.filter(i => i.type === 'anion').map((i) => {
                  const pct = balanceData.totalAnionsMeq > 0 ? (i.meqL / balanceData.totalAnionsMeq) * 100 : 0;
                  return (
                    <div
                      key={i.id}
                      style={{
                        width: `${pct}%`,
                        background: i.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#070a12',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                      }}
                      title={`${i.name} (${i.formula}): ${i.meqL.toFixed(2)} meq/L`}
                    >
                      {pct > 12 && `${i.formula}: ${i.meqL.toFixed(2)}`}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Milliequivalent Table & Formula Card */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.3fr) minmax(280px, 1fr)',
            gap: '1.25rem'
          }}>
            {/* Interactive Ion Table */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              overflowX: 'auto'
            }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--accent-blue)', display: 'block', marginBottom: '0.75rem' }}>
                Water Ion Concentrations & Equivalent Weights
              </strong>

              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)'
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '0.35rem 0.2rem' }}>Ion</th>
                    <th style={{ textAlign: 'center', padding: '0.35rem 0.2rem' }}>Charge</th>
                    <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>MW</th>
                    <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>EW</th>
                    <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>mg/L</th>
                    <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>meq/L</th>
                    <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>as CaCO₃</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceData.ionDetails.map((ion) => (
                    <tr key={ion.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '0.4rem 0.2rem', color: ion.color, fontWeight: 700 }}>
                        {ion.formula} ({ion.name})
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.4rem 0.2rem' }}>{ion.charge > 0 ? `+${ion.charge}` : ion.charge}</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem', color: 'var(--text-dim)' }}>{ion.mw.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem', fontWeight: 600 }}>{ion.ew.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem' }}>
                        <input
                          type="number"
                          value={ionConcentrations[ion.id] || 0}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setIonConcentrations(prev => ({ ...prev, [ion.id]: val }));
                          }}
                          style={{
                            width: '54px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            color: '#fff',
                            textAlign: 'right',
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.3rem'
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem', fontWeight: 700, color: ion.color }}>
                        {ion.meqL.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem', color: 'var(--text-main)' }}>
                        {ion.mgLAsCaCO3.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lime & Soda Ash Softening Reaction Balancer */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>
                Lime-Soda Ash Softening Balancing Equations
              </strong>

              <div style={{ fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.4rem' }}>
                  <div style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>1. CO₂ Neutralization (Lime):</div>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O</div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.4rem' }}>
                  <div style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>2. Calcium Carbonate Hardness:</div>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>Ca(HCO₃)₂ + Ca(OH)₂ → 2CaCO₃↓ + 2H₂O</div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.4rem' }}>
                  <div style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>3. Magnesium Carbonate Hardness (2x Lime!):</div>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>Mg(HCO₃)₂ + 2Ca(OH)₂ → 2CaCO₃↓ + Mg(OH)₂↓ + 2H₂O</div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.4rem' }}>
                  <div style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>4. Magnesium Noncarbonate Hardness (Lime + Soda Ash):</div>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>MgSO₄ + Ca(OH)₂ → Mg(OH)₂↓ + CaSO₄</div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>5. Calcium Noncarbonate Hardness (Soda Ash):</div>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>CaSO₄ + Na₂CO₃ → CaCO₃↓ + Na₂SO₄</div>
                </div>
              </div>

              {/* Plant Chemical Requirement Summary */}
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.78rem'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {[
                    { label: 'Plant Flow (MGD)', value: plantFlowMgd, set: setPlantFlowMgd, step: 0.5 },
                    { label: 'Free CO₂ (as CaCO₃)', value: freeCo2MgL, set: setFreeCo2MgL, step: 1 },
                    { label: 'Excess Lime (as CaCO₃)', value: excessLimeDose, set: setExcessLimeDose, step: 5 }
                  ].map((f) => (
                    <label key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.7rem' }}>
                      <span className="text-muted">{f.label}</span>
                      <input
                        type="number"
                        min="0"
                        step={f.step}
                        value={f.value}
                        onChange={(e) => f.set(Math.max(0, parseFloat(e.target.value) || 0))}
                        style={{
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.35rem'
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                  Lime Ca(OH)₂ Required: {balanceData.limeLbsPerDay.toFixed(0)} lbs/day ({balanceData.limeDoseCaOH2.toFixed(1)} mg/L)
                </div>
                <div style={{ color: 'var(--accent-purple)', fontWeight: 700, marginTop: '0.2rem' }}>
                  Soda Ash Na₂CO₃ Required: {balanceData.sodaAshLbsPerDay.toFixed(0)} lbs/day ({balanceData.sodaAshDoseNa2CO3.toFixed(1)} mg/L)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 118-ELEMENT PERIODIC TABLE, DECAY DATA & NEUTRON RESONANCES */}
      {activeTab === 'periodic-nuclear' && <PeriodicNuclearStudio />}

      {/* ===================================================================== */}
      {/* COLLAPSIBLE THEORY & NCEES HANDBOOK FORMULAS                           */}
      {/* ===================================================================== */}
      {showTheory && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          fontSize: '0.82rem'
        }}>
          <h4 style={{ color: 'var(--accent-blue)', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <span>📖</span> NCEES Reference Handbook Formulas & Environmental Chemistry Rules
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', lineHeight: 1.6 }}>
            <div>
              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                1. Equivalent Weight & Milliequivalents:
              </strong>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                EW = MW / |Valence|; meq/L = (mg/L) / EW
              </div>
              <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                Concentration as CaCO₃ (mg/L) = meq/L × 50.04 mg/meq. For Ca²⁺: EW = 20.04; for Mg²⁺: EW = 12.15.
              </p>
            </div>

            <div>
              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                2. Carbonate vs Noncarbonate Hardness:
              </strong>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                If Alk &lt; TH: CH = Alk, NCH = TH - Alk
              </div>
              <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                If Alkalinity ≥ Total Hardness: Carbonate Hardness = TH, and Noncarbonate Hardness = 0.
              </p>
            </div>

            <div>
              <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                3. Radioactive First-Order Decay Kinetics:
              </strong>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                N(t) = N₀ · e^(-λt); λ = ln(2) / T₁/₂
              </div>
              <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                Radium-226 decays via alpha emission to Radon-222. Group 2 radionuclides (²²⁶Ra, ⁹⁰Sr) co-precipitate with Ca/Mg in water softening!
              </p>
            </div>
          </div>
        </div>
      )}
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

      {/* Render the full interactive PE exam question and answer choices */}
      {problem && <GenericProblemViewer problem={problem} key={problem.id} />}
    </>
  );
};

export default HardnessVisualizer;
