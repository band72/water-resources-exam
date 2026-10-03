import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

// Standard Nominal Pipe Sizes in US Customary Units (inches to feet)
const STANDARD_PIPE_SIZES = [6, 8, 10, 12, 14, 16, 18, 20, 24, 30, 36];

// Standard Pipe Roughness (ε in feet)
const PIPE_MATERIALS = {
  cast_iron_aged: { name: 'Aged Cast Iron', eps: 0.00085, C: 100, defaultF: 0.0210 },
  ductile_iron_new: { name: 'Ductile Iron (Cement Lined)', eps: 0.00015, C: 120, defaultF: 0.0160 },
  pvc_smooth: { name: 'PVC / HDPE (Smooth Plastic)', eps: 0.000005, C: 140, defaultF: 0.0125 },
  welded_steel: { name: 'Commercial Steel', eps: 0.00015, C: 130, defaultF: 0.0150 },
  concrete_culvert: { name: 'Concrete Pipe', eps: 0.0010, C: 110, defaultF: 0.0220 }
};

const PipeNetworkVisualizer = ({ problem }) => {
  // Determine initial mode from problem ID: 193 -> 'parallel-pipes', otherwise 'hardy-cross'
  const initialMode = problem?.id === 193 ? 'parallel-pipes' : 'hardy-cross';
  const [activeMode, setActiveMode] = useState(initialMode);

  // Fullscreen & Derivation view states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDerivation, setShowDerivation] = useState(true);

  // =========================================================================
  // MODE 1: HARDY CROSS LOOPED NETWORK STATE (Problem 192)
  // =========================================================================
  const [qinCfs, setQinCfs] = useState(6.0); // Total Inflow at Node A
  const [demandB, setDemandB] = useState(2.0); // Outflow at B
  const [demandC, setDemandC] = useState(3.0); // Outflow at C
  const [demandD, setDemandD] = useState(1.0); // Outflow at D

  // Pipe AB
  const [l1Ft, setL1Ft] = useState(1200);
  const [d1In, setD1In] = useState(12);
  const [c1, setC1] = useState(120);

  // Pipe BC
  const [l2Ft, setL2Ft] = useState(1000);
  const [d2In, setD2In] = useState(10);
  const [c2, setC2] = useState(120);

  // Pipe CD
  const [l3Ft, setL3Ft] = useState(1200);
  const [d3In, setD3In] = useState(8);
  const [c3, setC3] = useState(100);

  // Pipe DA
  const [l4Ft, setL4Ft] = useState(1000);
  const [d4In, setD4In] = useState(10);
  const [c4, setC4] = useState(120);

  // Initial Assumed Flow in Pipe AB
  const [initialQab, setInitialQab] = useState(3.50);

  // Active Iteration Step view (0 = initial assumed, 1, 2, 3, or 'converged')
  const [activeIterationStep, setActiveIterationStep] = useState(1);

  // =========================================================================
  // MODE 2: PARALLEL PIPES & FRICTION FACTOR SIZING STATE (Problem 193)
  // =========================================================================
  const [qTotalParallelCfs, setQTotalParallelCfs] = useState(10.0);
  const [junctionPressurePsi, setJunctionPressurePsi] = useState(65.0); // Upstream pressure at A

  // Branch 1 (Existing Line)
  const [parL1Ft, setParL1Ft] = useState(3000);
  const [parD1In, setParD1In] = useState(14);
  const [parMat1, setParMat1] = useState('cast_iron_aged');
  const [parManualF1, setParManualF1] = useState(0.0210);
  const [useManualF1, setUseManualF1] = useState(true);

  // Branch 2 (New Relief Line)
  const [parL2Ft, setParL2Ft] = useState(2000);
  const [parD2In, setParD2In] = useState(12);
  const [parMat2, setParMat2] = useState('ductile_iron_new');
  const [parManualF2, setParManualF2] = useState(0.0160);
  const [useManualF2, setUseManualF2] = useState(true);

  // Equivalent Pipe Parameters
  const [eqLft, setEqLft] = useState(3000);
  const [eqF, setEqF] = useState(0.020);

  // Target Head Loss constraint for auto-sizing solver (ft)
  const [targetHeadLossFt, setTargetHeadLossFt] = useState(12.0);

  // =========================================================================
  // CALCULATIONS: MODE 1 - HARDY CROSS (HAZEN-WILLIAMS)
  // =========================================================================
  // Hazen-Williams resistance factor k in hf = k * Q^1.852 (US units, Q in cfs, L, D in ft)
  const calcHazenWilliamsK = (L, D_in, C) => {
    const D_ft = D_in / 12;
    // hf = 4.727 * L * Q^1.852 / (C^1.852 * D^4.870)
    const k = (4.727 * L) / (Math.pow(C, 1.852) * Math.pow(D_ft, 4.870));
    return k;
  };

  const hardyCrossData = useMemo(() => {
    const k1 = calcHazenWilliamsK(l1Ft, d1In, c1);
    const k2 = calcHazenWilliamsK(l2Ft, d2In, c2);
    const k3 = calcHazenWilliamsK(l3Ft, d3In, c3);
    const k4 = calcHazenWilliamsK(l4Ft, d4In, c4);

    // Iterative Hardy Cross simulation (up to 5 iterations)
    const iterations = [];
    let currentQab = initialQab;

    for (let iter = 0; iter <= 4; iter++) {
      // By nodal continuity:
      // Node A: Qin = Q_AB + Q_AD  => Q_AD = Qin - Q_AB
      // Node B: Q_AB = Q_BC + demandB => Q_BC = Q_AB - demandB
      // Node D: Q_AD = Q_DC + demandD => Q_DC = Q_AD - demandD
      // Node C: Q_BC + Q_DC = demandC (satisfies continuity)
      const qAB = currentQab;
      const qBC = qAB - demandB;
      const qAD = qinCfs - qAB;
      const qDC = qAD - demandD;

      // Clockwise convention around loop ABCD:
      // Branch 1 (A -> B): Clockwise (+) => Q1 = qAB
      // Branch 2 (B -> C): Clockwise (+) => Q2 = qBC
      // Branch 3 (C -> D): Actual flow is D -> C, so clockwise flow is -qDC (-)
      // Branch 4 (D -> A): Actual flow is A -> D, so clockwise flow is -qAD (-)
      const Q1 = qAB;
      const Q2 = qBC;
      const Q3 = -qDC;
      const Q4 = -qAD;

      const calcHfAndDeriv = (Q_val, k_val) => {
        const sign = Q_val >= 0 ? 1 : -1;
        const absQ = Math.abs(Q_val);
        const hf = sign * k_val * Math.pow(absQ, 1.852);
        const deriv = absQ > 0 ? k_val * Math.pow(absQ, 0.852) : 0; // |hf/Q|
        return { hf, deriv, absQ, sign };
      };

      const b1 = calcHfAndDeriv(Q1, k1);
      const b2 = calcHfAndDeriv(Q2, k2);
      const b3 = calcHfAndDeriv(Q3, k3);
      const b4 = calcHfAndDeriv(Q4, k4);

      const sumHf = b1.hf + b2.hf + b3.hf + b4.hf;
      const sumDeriv = b1.deriv + b2.deriv + b3.deriv + b4.deriv;
      const nExponent = 1.852;
      const deltaQ = sumDeriv > 0 ? -sumHf / (nExponent * sumDeriv) : 0;

      iterations.push({
        iterationIndex: iter,
        qAB,
        qBC,
        qDC,
        qAD,
        branches: [
          { name: 'Pipe AB (A→B)', L: l1Ft, D: d1In, C: c1, k: k1, Q: Q1, hf: b1.hf, deriv: b1.deriv, isClockwise: Q1 >= 0 },
          { name: 'Pipe BC (B→C)', L: l2Ft, D: d2In, C: c2, k: k2, Q: Q2, hf: b2.hf, deriv: b2.deriv, isClockwise: Q2 >= 0 },
          { name: 'Pipe CD (C→D)', L: l3Ft, D: d3In, C: c3, k: k3, Q: Q3, hf: b3.hf, deriv: b3.deriv, isClockwise: Q3 >= 0 },
          { name: 'Pipe DA (D→A)', L: l4Ft, D: d4In, C: c4, k: k4, Q: Q4, hf: b4.hf, deriv: b4.deriv, isClockwise: Q4 >= 0 }
        ],
        sumHf,
        sumDeriv,
        deltaQ,
        nextQab: qAB + deltaQ
      });

      // Update flow for next iteration
      currentQab += deltaQ;
    }

    return { k1, k2, k3, k4, iterations };
  }, [qinCfs, demandB, demandD, l1Ft, d1In, c1, l2Ft, d2In, c2, l3Ft, d3In, c3, l4Ft, d4In, c4, initialQab]);

  // Selected iteration data for display
  const activeIterData = useMemo(() => {
    if (activeIterationStep === 'converged') {
      return hardyCrossData.iterations[hardyCrossData.iterations.length - 1];
    }
    const idx = Math.min(Math.max(0, activeIterationStep), hardyCrossData.iterations.length - 1);
    return hardyCrossData.iterations[idx];
  }, [hardyCrossData, activeIterationStep]);

  // =========================================================================
  // CALCULATIONS: MODE 2 - PARALLEL PIPES & FRICTION FACTOR SIZING (DARCY-WEISBACH)
  // =========================================================================
  const parallelData = useMemo(() => {
    // Water properties at waterTempF (approx kinematic viscosity in ft^2/s)
    // At 68F (20C), nu ~ 1.08e-5 ft^2/s
    const nu = 1.08e-5;
    const gamma = 62.3; // lb/ft^3
    const g = 32.2; // ft/s^2
    const DW_CONST = (8 / (Math.PI * Math.PI * g)); // ~0.02517 ft*s^2/ft^6

    const d1_ft = parD1In / 12;
    const d2_ft = parD2In / 12;

    const eps1 = PIPE_MATERIALS[parMat1]?.eps || 0.00085;
    const eps2 = PIPE_MATERIALS[parMat2]?.eps || 0.00015;

    // Friction factors (manual or Colebrook-White / Swamee-Jain)
    let f1 = useManualF1 ? parManualF1 : (PIPE_MATERIALS[parMat1]?.defaultF || 0.0210);
    let f2 = useManualF2 ? parManualF2 : (PIPE_MATERIALS[parMat2]?.defaultF || 0.0160);

    // Resistance coefficients r where hf = r * Q^2
    // r = (8 * f * L) / (pi^2 * g * D^5) = 0.02517 * f * L / D^5
    const r1 = (DW_CONST * f1 * parL1Ft) / Math.pow(d1_ft, 5);
    const r2 = (DW_CONST * f2 * parL2Ft) / Math.pow(d2_ft, 5);

    // For equal head loss: r1 * Q1^2 = r2 * Q2^2 => Q1/Q2 = sqrt(r2 / r1)
    const ratioQ1Q2 = Math.sqrt(r2 / r1);

    // By continuity: Q1 + Q2 = Q_total => Q2 = Q_total / (1 + ratioQ1Q2)
    const Q2 = qTotalParallelCfs / (1 + ratioQ1Q2);
    const Q1 = qTotalParallelCfs - Q2;

    const pctQ1 = (Q1 / qTotalParallelCfs) * 100;
    const pctQ2 = (Q2 / qTotalParallelCfs) * 100;

    // Head loss in both pipes
    const hf1 = r1 * Math.pow(Q1, 2);
    const hf2 = r2 * Math.pow(Q2, 2);
    const commonHf = (hf1 + hf2) / 2;

    // Pressure drop (psi) = gamma * hf / 144
    const deltaPsi = (gamma * commonHf) / 144;
    const downstreamPressurePsi = Math.max(0, junctionPressurePsi - deltaPsi);

    // Fluid Velocities
    const area1 = (Math.PI / 4) * Math.pow(d1_ft, 2);
    const area2 = (Math.PI / 4) * Math.pow(d2_ft, 2);
    const v1 = Q1 / area1;
    const v2 = Q2 / area2;

    // Reynolds Numbers
    const re1 = (v1 * d1_ft) / nu;
    const re2 = (v2 * d2_ft) / nu;

    // Swamee-Jain calculated friction factors
    const calcSwameeJain = (eps, D, Re) => {
      if (Re < 2300) return 64 / Math.max(1, Re);
      const term1 = eps / (3.7 * D);
      const term2 = 5.74 / Math.pow(Re, 0.9);
      const logTerm = Math.log10(term1 + term2);
      return 0.25 / Math.pow(logTerm, 2);
    };

    const sj_f1 = calcSwameeJain(eps1, d1_ft, re1);
    const sj_f2 = calcSwameeJain(eps2, d2_ft, re2);

    // Equivalent Pipe Calculation:
    // Single pipe of length eqLft and friction factor eqF carrying Q_total with same hf
    // hf = 0.02517 * eqF * eqLft * Q_total^2 / Deq^5
    // Deq^5 = (0.02517 * eqF * eqLft * Q_total^2) / hf
    const Deq_5 = (DW_CONST * eqF * eqLft * Math.pow(qTotalParallelCfs, 2)) / Math.max(0.001, commonHf);
    const Deq_ft = Math.pow(Deq_5, 0.2);
    const Deq_in = Deq_ft * 12;

    // Required Branch 2 Sizing for Target Head Loss:
    // What D2 is required so that when Branch 1 carries Q1' (with hf1 <= targetHeadLoss) and Branch 2 carries Q2', total is Q_total?
    // Max Q1 under targetHeadLoss: Q1_max = sqrt(targetHeadLoss / r1)
    const Q1_target = Math.min(qTotalParallelCfs, Math.sqrt(Math.max(0.1, targetHeadLossFt) / r1));
    const Q2_target = Math.max(0, qTotalParallelCfs - Q1_target);
    // r2_req = targetHeadLoss / (Q2_target^2)
    // (DW_CONST * f2 * L2) / D2_req^5 = targetHeadLoss / Q2_target^2
    // D2_req^5 = (DW_CONST * f2 * L2 * Q2_target^2) / targetHeadLoss
    const D2_req_5 = (DW_CONST * f2 * parL2Ft * Math.pow(Q2_target, 2)) / Math.max(0.1, targetHeadLossFt);
    const D2_req_ft = Math.pow(D2_req_5, 0.2);
    const D2_req_in = D2_req_ft * 12;

    return {
      d1_ft,
      d2_ft,
      f1,
      f2,
      r1,
      r2,
      ratioQ1Q2,
      Q1,
      Q2,
      pctQ1,
      pctQ2,
      hf1,
      hf2,
      commonHf,
      deltaPsi,
      downstreamPressurePsi,
      v1,
      v2,
      re1,
      re2,
      sj_f1,
      sj_f2,
      Deq_ft,
      Deq_in,
      Q1_target,
      Q2_target,
      D2_req_in
    };
  }, [
    qTotalParallelCfs,
    junctionPressurePsi,
    parL1Ft,
    parD1In,
    parMat1,
    parManualF1,
    useManualF1,
    parL2Ft,
    parD2In,
    parMat2,
    parManualF2,
    useManualF2,
    eqLft,
    eqF,
    targetHeadLossFt
  ]);

  // Quick Preset Handlers
  const handleLoadHardyCrossExamPreset = () => {
    setQinCfs(6.0);
    setDemandB(2.0);
    setDemandC(3.0);
    setDemandD(1.0);
    setL1Ft(1200);
    setD1In(12);
    setC1(120);
    setL2Ft(1000);
    setD2In(10);
    setC2(120);
    setL3Ft(1200);
    setD3In(8);
    setC3(100);
    setL4Ft(1000);
    setD4In(10);
    setC4(120);
    setInitialQab(3.50);
    setActiveIterationStep(1);
  };

  const handleLoadParallelExamPreset = () => {
    setQTotalParallelCfs(10.0);
    setJunctionPressurePsi(65.0);
    setParL1Ft(3000);
    setParD1In(14);
    setParMat1('cast_iron_aged');
    setParManualF1(0.0210);
    setUseManualF1(true);
    setParL2Ft(2000);
    setParD2In(12);
    setParMat2('ductile_iron_new');
    setParManualF2(0.0160);
    setUseManualF2(true);
    setEqLft(3000);
    setEqF(0.020);
    setTargetHeadLossFt(12.0);
  };

  // Main UI Content
  const visualizerContent = (
    <div style={{
      background: 'var(--bg-card, rgba(15, 23, 42, 0.7))',
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
            background: activeMode === 'hardy-cross' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(6, 182, 212, 0.15)',
            border: activeMode === 'hardy-cross' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(6, 182, 212, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            boxShadow: activeMode === 'hardy-cross' ? '0 0 20px rgba(56, 189, 248, 0.2)' : '0 0 20px rgba(6, 182, 212, 0.2)'
          }}>
            {activeMode === 'hardy-cross' ? '🔄' : '⚡'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
                {activeMode === 'hardy-cross'
                  ? 'Hardy Cross Looped Network Studio (Hazen-Williams)'
                  : 'Parallel Pipes Flow Distribution & Sizing Studio (Darcy-Weisbach)'}
              </h2>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: activeMode === 'hardy-cross' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                color: activeMode === 'hardy-cross' ? 'var(--accent-blue, #38bdf8)' : 'var(--accent-cyan, #06b6d4)',
                border: activeMode === 'hardy-cross' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)'
              }}>
                {activeMode === 'hardy-cross' ? 'PE Problem #192' : 'PE Problem #193'}
              </span>
            </div>
            <p className="text-xs text-muted" style={{ margin: '0.25rem 0 0 0' }}>
              {activeMode === 'hardy-cross'
                ? 'Interactive loop correction ΔQ = -Σ hf / (n Σ |hf/Q|) with Hazen-Williams resistance factors and real-time stepper.'
                : 'Equal head loss hf,1 = hf,2 flow split, Darcy-Weisbach friction factor Swamee-Jain solver, and equivalent diameter Deq.'}
            </p>
          </div>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Mode Tabs */}
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
                background: activeMode === 'hardy-cross' ? 'var(--accent-blue, #38bdf8)' : 'transparent',
                color: activeMode === 'hardy-cross' ? '#070a12' : 'var(--text-muted)',
                fontWeight: activeMode === 'hardy-cross' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              onClick={() => setActiveMode('hardy-cross')}
            >
              <span>🔄</span> Hardy Cross (#192)
            </button>
            <button
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: activeMode === 'parallel-pipes' ? 'var(--accent-cyan, #06b6d4)' : 'transparent',
                color: activeMode === 'parallel-pipes' ? '#070a12' : 'var(--text-muted)',
                fontWeight: activeMode === 'parallel-pipes' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              onClick={() => setActiveMode('parallel-pipes')}
            >
              <span>⚡</span> Parallel Pipes (#193)
            </button>
          </div>

          {/* Quick Preset Button */}
          <button
            className="btn-secondary"
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
            onClick={activeMode === 'hardy-cross' ? handleLoadHardyCrossExamPreset : handleLoadParallelExamPreset}
            title="Reset parameters to NCEES Civil PE Exam standard specification"
          >
            <span>🎯</span> NCEES Reset
          </button>

          {/* Derivation Toggle */}
          <button
            className="btn-secondary"
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: showDerivation ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              borderColor: showDerivation ? 'var(--accent-blue)' : 'var(--border-color)',
              color: showDerivation ? 'var(--accent-blue)' : 'var(--text-main)'
            }}
            onClick={() => setShowDerivation(!showDerivation)}
          >
            <span>📐</span> {showDerivation ? 'Hide Theory' : 'Show Theory'}
          </button>

          {/* Fullscreen Toggle */}
          <button
            className="btn-secondary"
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Studio'}
          >
            <span>{isFullscreen ? '✕' : '⛶'}</span> {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: HARDY CROSS LOOPED NETWORK VIEW                               */}
      {/* ===================================================================== */}
      {activeMode === 'hardy-cross' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(56, 189, 248, 0.2)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                LOOP RESIDUAL HEAD LOSS (Σ hf)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: Math.abs(activeIterData.sumHf) < 0.2 ? 'var(--accent-emerald, #10b981)' : 'var(--accent-rose, #f43f5e)',
                fontFamily: 'var(--font-mono)'
              }}>
                {activeIterData.sumHf >= 0 ? '+' : ''}{activeIterData.sumHf.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>ft</span>
              </div>
              <span className="text-xs" style={{ color: Math.abs(activeIterData.sumHf) < 0.2 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                {Math.abs(activeIterData.sumHf) < 0.2 ? '✓ Loop Balanced (Converged)' : 'Unbalanced (Clockwise flow deficit)'}
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(245, 158, 11, 0.2)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                HARDY CROSS CORRECTION (ΔQ)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-amber, #f59e0b)',
                fontFamily: 'var(--font-mono)'
              }}>
                {activeIterData.deltaQ >= 0 ? '+' : ''}{activeIterData.deltaQ.toFixed(3)} <span style={{ fontSize: '0.9rem' }}>cfs</span>
              </div>
              <span className="text-xs text-muted">
                {activeIterData.deltaQ >= 0 ? 'Push flow clockwise' : 'Push flow counter-clockwise'}
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                CORRECTED FLOW IN PIPE AB (Q<sub>AB</sub>)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-blue, #38bdf8)',
                fontFamily: 'var(--font-mono)'
              }}>
                {activeIterData.nextQab.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>cfs</span>
              </div>
              <span className="text-xs text-muted">
                {(activeIterData.nextQab * 448.83).toFixed(0)} gpm (Trial {activeIterData.iterationIndex} → {activeIterData.iterationIndex + 1})
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(168, 85, 247, 0.2)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                RESISTANCE DERIVATIVE (Σ |hf/Q|)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-purple, #a855f7)',
                fontFamily: 'var(--font-mono)'
              }}>
                {activeIterData.sumDeriv.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>ft/cfs</span>
              </div>
              <span className="text-xs text-muted">
                n · Σ |hf/Q| = {(1.852 * activeIterData.sumDeriv).toFixed(2)} (Denominator)
              </span>
            </div>
          </div>

          {/* Interactive Network SVG & Visualizer Canvas */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.25fr) minmax(300px, 0.95fr)',
            gap: '1.5rem',
            alignItems: 'start'
          }}>
            {/* SVG Diagram Container */}
            <div style={{
              background: 'radial-gradient(ellipse at center, rgba(12, 25, 45, 0.8) 0%, rgba(7, 12, 22, 0.95) 100%)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              padding: '1rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Stepper Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                paddingBottom: '0.5rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Hardy Cross Iteration:
                  </span>
                  {[0, 1, 2, 'converged'].map((step) => {
                    const isActive = activeIterationStep === step;
                    return (
                      <button
                        key={String(step)}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          border: isActive ? '1px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.1)',
                          background: isActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0, 0, 0, 0.3)',
                          color: isActive ? 'var(--accent-blue)' : 'var(--text-main)',
                          fontSize: '0.75rem',
                          fontWeight: isActive ? 700 : 500,
                          cursor: 'pointer'
                        }}
                        onClick={() => setActiveIterationStep(step)}
                      >
                        {step === 'converged' ? 'Converged (Final)' : `Iter ${step}`}
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Clockwise = <span style={{ color: 'var(--accent-cyan)' }}>+ (Positive)</span> | CCW = <span style={{ color: 'var(--accent-rose)' }}>- (Negative)</span>
                </div>
              </div>

              {/* Dynamic Looped Network SVG */}
              <svg viewBox="0 0 600 440" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <defs>
                  {/* Flow Arrow Markers */}
                  <marker id="arrow-cw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                  </marker>
                  <marker id="arrow-ccw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
                  </marker>
                  <marker id="arrow-in" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                  </marker>
                  <marker id="arrow-out" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
                  </marker>

                  {/* Flowing Water Gradient */}
                  <linearGradient id="pipe-ab-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="pipe-cd-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity="0.8" />
                  </linearGradient>
                </defs>

                {/* Grid guidelines */}
                <rect x="20" y="20" width="560" height="400" rx="12" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="4 4" />

                {/* Node Coordinates:
                    Node A: (140, 100)
                    Node B: (460, 100)
                    Node C: (460, 340)
                    Node D: (140, 340)
                */}

                {/* Center Loop Status Circle */}
                <circle cx="300" cy="220" r="62" fill="rgba(15, 23, 42, 0.85)" stroke={Math.abs(activeIterData.sumHf) < 0.2 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(56, 189, 248, 0.4)'} strokeWidth="2" strokeDasharray="3 3" />
                <text x="300" y="195" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="600">LOOP ABCD</text>
                <text x="300" y="215" textAnchor="middle" fill={Math.abs(activeIterData.sumHf) < 0.2 ? '#10b981' : '#f59e0b'} fontSize="13" fontWeight="800" fontFamily="var(--font-mono)">
                  Σ hf = {activeIterData.sumHf >= 0 ? '+' : ''}{activeIterData.sumHf.toFixed(2)}′
                </text>
                <text x="300" y="235" textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="700" fontFamily="var(--font-mono)">
                  ΔQ = {activeIterData.deltaQ >= 0 ? '+' : ''}{activeIterData.deltaQ.toFixed(2)} cfs
                </text>
                <text x="300" y="252" textAnchor="middle" fill="var(--text-dim)" fontSize="9">
                  {Math.abs(activeIterData.sumHf) < 0.2 ? 'Balanced Loop' : 'Iter Correction'}
                </text>

                {/* Circular Loop Arrow Indicator */}
                <path
                  d="M 265 170 A 50 50 0 1 1 335 170"
                  fill="none"
                  stroke={activeIterData.deltaQ >= 0 ? 'var(--accent-blue)' : 'var(--accent-rose)'}
                  strokeWidth="2.5"
                  markerEnd="url(#arrow-cw)"
                  strokeDasharray="6 3"
                />

                {/* ========================================================= */}
                {/* PIPES (CONDUITS)                                         */}
                {/* ========================================================= */}

                {/* Pipe 1: AB (Top) - A(140, 100) to B(460, 100) */}
                <line x1="140" y1="100" x2="460" y2="100" stroke="rgba(56, 189, 248, 0.3)" strokeWidth={Math.max(6, d1In)} strokeLinecap="round" />
                <line x1="140" y1="100" x2="460" y2="100" stroke="var(--accent-blue)" strokeWidth="3" markerEnd="url(#arrow-cw)" />
                {/* Label AB */}
                <rect x="250" y="55" width="100" height="34" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(56, 189, 248, 0.4)" />
                <text x="300" y="70" textAnchor="middle" fill="var(--accent-blue)" fontSize="11" fontWeight="700">
                  Pipe AB ({d1In}″ DI, C={c1})
                </text>
                <text x="300" y="84" textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="800" fontFamily="var(--font-mono)">
                  Q = {activeIterData.qAB.toFixed(2)} cfs ({activeIterData.branches[0].hf >= 0 ? '+' : ''}{activeIterData.branches[0].hf.toFixed(2)}′)
                </text>

                {/* Pipe 2: BC (Right) - B(460, 100) to C(460, 340) */}
                <line x1="460" y1="100" x2="460" y2="340" stroke="rgba(56, 189, 248, 0.3)" strokeWidth={Math.max(6, d2In)} strokeLinecap="round" />
                <line x1="460" y1="100" x2="460" y2="340" stroke="var(--accent-cyan)" strokeWidth="3" markerEnd="url(#arrow-cw)" />
                {/* Label BC */}
                <rect x="475" y="195" width="115" height="48" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(6, 182, 212, 0.4)" />
                <text x="532" y="212" textAnchor="middle" fill="var(--accent-cyan)" fontSize="10" fontWeight="700">
                  Pipe BC ({d2In}″ DI, C={c2})
                </text>
                <text x="532" y="226" textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="800" fontFamily="var(--font-mono)">
                  Q = {activeIterData.qBC.toFixed(2)} cfs
                </text>
                <text x="532" y="238" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
                  hf = {activeIterData.branches[1].hf >= 0 ? '+' : ''}{activeIterData.branches[1].hf.toFixed(2)} ft
                </text>

                {/* Pipe 3: CD (Bottom) - D(140, 340) to C(460, 340) - Flow is D to C (Counter-Clockwise) */}
                <line x1="140" y1="340" x2="460" y2="340" stroke="rgba(244, 63, 94, 0.3)" strokeWidth={Math.max(5, d3In)} strokeLinecap="round" />
                {/* Arrow pointing right towards C, which is counter-clockwise relative to loop */}
                <line x1="140" y1="340" x2="460" y2="340" stroke="var(--accent-rose)" strokeWidth="3" markerEnd="url(#arrow-ccw)" />
                {/* Label CD */}
                <rect x="245" y="355" width="110" height="46" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(244, 63, 94, 0.4)" />
                <text x="300" y="372" textAnchor="middle" fill="var(--accent-rose)" fontSize="10" fontWeight="700">
                  Pipe CD ({d3In}″ CI, C={c3}) ⚠️
                </text>
                <text x="300" y="386" textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="800" fontFamily="var(--font-mono)">
                  Q = {activeIterData.qDC.toFixed(2)} cfs (D→C)
                </text>
                <text x="300" y="397" textAnchor="middle" fill="var(--accent-rose)" fontSize="9" fontWeight="600" fontFamily="var(--font-mono)">
                  Loop hf = {activeIterData.branches[2].hf.toFixed(2)} ft (CCW)
                </text>

                {/* Pipe 4: DA (Left) - A(140, 100) to D(140, 340) - Flow is A to D (Counter-Clockwise) */}
                <line x1="140" y1="100" x2="140" y2="340" stroke="rgba(244, 63, 94, 0.3)" strokeWidth={Math.max(6, d4In)} strokeLinecap="round" />
                {/* Arrow pointing down towards D, which is counter-clockwise relative to loop */}
                <line x1="140" y1="100" x2="140" y2="340" stroke="var(--accent-rose)" strokeWidth="3" markerEnd="url(#arrow-ccw)" />
                {/* Label DA */}
                <rect x="10" y="195" width="115" height="48" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(244, 63, 94, 0.4)" />
                <text x="67" y="212" textAnchor="middle" fill="var(--accent-rose)" fontSize="10" fontWeight="700">
                  Pipe DA ({d4In}″ DI, C={c4})
                </text>
                <text x="67" y="226" textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="800" fontFamily="var(--font-mono)">
                  Q = {activeIterData.qAD.toFixed(2)} cfs (A→D)
                </text>
                <text x="67" y="238" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
                  Loop hf = {activeIterData.branches[3].hf.toFixed(2)} ft (CCW)
                </text>

                {/* ========================================================= */}
                {/* NODES & INFLOW / OUTFLOW DEMANDS                          */}
                {/* ========================================================= */}

                {/* Node A (Inflow) */}
                <line x1="70" y1="100" x2="125" y2="100" stroke="#10b981" strokeWidth="4" markerEnd="url(#arrow-in)" />
                <text x="75" y="88" fill="#10b981" fontSize="11" fontWeight="700">Qin = {qinCfs.toFixed(1)} cfs</text>
                <circle cx="140" cy="100" r="16" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
                <text x="140" y="105" textAnchor="middle" fill="#f1f5f9" fontSize="12" fontWeight="800">A</text>

                {/* Node B (Demand 2.0 cfs) */}
                <line x1="460" y1="100" x2="530" y2="60" stroke="#f59e0b" strokeWidth="3" markerEnd="url(#arrow-out)" />
                <text x="535" y="60" fill="#f59e0b" fontSize="11" fontWeight="700">QB = {demandB.toFixed(1)} cfs</text>
                <circle cx="460" cy="100" r="16" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
                <text x="460" y="105" textAnchor="middle" fill="#f1f5f9" fontSize="12" fontWeight="800">B</text>

                {/* Node C (Demand 3.0 cfs) */}
                <line x1="460" y1="340" x2="535" y2="380" stroke="#f59e0b" strokeWidth="3" markerEnd="url(#arrow-out)" />
                <text x="535" y="395" fill="#f59e0b" fontSize="11" fontWeight="700">QC = {demandC.toFixed(1)} cfs</text>
                <circle cx="460" cy="340" r="16" fill="#1e293b" stroke="#06b6d4" strokeWidth="3" />
                <text x="460" y="345" textAnchor="middle" fill="#f1f5f9" fontSize="12" fontWeight="800">C</text>

                {/* Node D (Demand 1.0 cfs) */}
                <line x1="140" y1="340" x2="70" y2="380" stroke="#f59e0b" strokeWidth="3" markerEnd="url(#arrow-out)" />
                <text x="40" y="395" fill="#f59e0b" fontSize="11" fontWeight="700">QD = {demandD.toFixed(1)} cfs</text>
                <circle cx="140" cy="340" r="16" fill="#1e293b" stroke="#f43f5e" strokeWidth="3" />
                <text x="140" y="345" textAnchor="middle" fill="#f1f5f9" fontSize="12" fontWeight="800">D</text>
              </svg>
            </div>

            {/* Hardy Cross Step-by-Step Table */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--accent-blue)' }}>
                  Hardy Cross Loop Computation (Iteration {activeIterData.iterationIndex})
                </strong>
                <span className="text-xs text-muted">
                  Hazen-Williams: n = 1.852
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                      <th style={{ textAlign: 'left', padding: '0.35rem 0.2rem' }}>Pipe</th>
                      <th style={{ textAlign: 'center', padding: '0.35rem 0.2rem' }}>D (in)</th>
                      <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>k factor</th>
                      <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>Q (cfs)</th>
                      <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>hf (ft)</th>
                      <th style={{ textAlign: 'right', padding: '0.35rem 0.2rem' }}>|hf/Q|</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeIterData.branches.map((b, idx) => (
                      <tr key={idx} style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent'
                      }}>
                        <td style={{ padding: '0.4rem 0.2rem', color: b.isClockwise ? 'var(--accent-cyan)' : 'var(--accent-rose)', fontWeight: 600 }}>
                          {b.name.split(' ')[0]} {b.name.split(' ')[1]}
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.4rem 0.2rem' }}>{b.D}″</td>
                        <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem', color: 'var(--text-dim)' }}>{b.k.toFixed(3)}</td>
                        <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem', fontWeight: 700, color: b.Q >= 0 ? 'var(--accent-blue)' : 'var(--accent-rose)' }}>
                          {b.Q >= 0 ? '+' : ''}{b.Q.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem', fontWeight: 700, color: b.hf >= 0 ? 'var(--accent-blue)' : 'var(--accent-rose)' }}>
                          {b.hf >= 0 ? '+' : ''}{b.hf.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.4rem 0.2rem', color: 'var(--accent-purple)' }}>
                          {b.deriv.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {/* Sum Row */}
                    <tr style={{
                      borderTop: '2px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(56, 189, 248, 0.08)',
                      fontWeight: 700
                    }}>
                      <td colSpan="4" style={{ padding: '0.5rem 0.2rem', color: 'var(--text-main)' }}>
                        Loop Sums (Σ)
                      </td>
                      <td style={{
                        textAlign: 'right',
                        padding: '0.5rem 0.2rem',
                        color: Math.abs(activeIterData.sumHf) < 0.2 ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                      }}>
                        {activeIterData.sumHf >= 0 ? '+' : ''}{activeIterData.sumHf.toFixed(2)}′
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.2rem', color: 'var(--accent-purple)' }}>
                        {activeIterData.sumDeriv.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Hardy Cross Math Derivation Card */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px',
                padding: '0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '0.78rem'
              }}>
                <div style={{ color: 'var(--accent-amber)', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Hardy Cross Correction Formula:
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                  <div>ΔQ = - [Σ hf] / [1.852 · Σ (|hf| / |Q|)]</div>
                  <div>ΔQ = - [{activeIterData.sumHf >= 0 ? '+' : ''}{activeIterData.sumHf.toFixed(2)}] / [1.852 × {activeIterData.sumDeriv.toFixed(2)}]</div>
                  <div style={{ color: 'var(--accent-amber)', fontWeight: 800 }}>
                    ΔQ = {activeIterData.deltaQ >= 0 ? '+' : ''}{activeIterData.deltaQ.toFixed(3)} cfs
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--accent-blue)', fontWeight: 700 }}>
                    Q<sub>AB</sub><sup>(next)</sup> = {activeIterData.qAB.toFixed(2)} + ({activeIterData.deltaQ.toFixed(2)}) = {activeIterData.nextQab.toFixed(2)} cfs
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Sliders & Parameters Section */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '1.25rem'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--accent-cyan)' }}>
              Interactive Network Knobs & Flow Sliders
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.25rem'
            }}>
              {/* Inflow & Demands */}
              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Total Inflow at Node A (Qin):</span>
                  <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{qinCfs.toFixed(1)} cfs</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="0.5"
                  value={qinCfs}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setQinCfs(val);
                    // auto scale customer demands proportionally
                    const ratio = val / 6.0;
                    setDemandB(Math.round(2.0 * ratio * 10) / 10);
                    setDemandC(Math.round(3.0 * ratio * 10) / 10);
                    setDemandD(Math.round(1.0 * ratio * 10) / 10);
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                />
              </div>

              {/* Initial Assumed Flow in AB */}
              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Assumed Initial Trial Flow in AB (Q<sub>AB,0</sub>):</span>
                  <span style={{ color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{initialQab.toFixed(2)} cfs</span>
                </label>
                <input
                  type="range"
                  min="1.0"
                  max={Math.max(1.5, qinCfs - 0.5)}
                  step="0.1"
                  value={initialQab}
                  onChange={(e) => setInitialQab(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                />
                <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                  Notice: Any initial guess converges to the same physical flow!
                </span>
              </div>

              {/* Pipe CD Diameter (Bottleneck) */}
              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Pipe CD Diameter (Bottleneck):</span>
                  <span style={{ color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{d3In} inches</span>
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {[6, 8, 10, 12, 14].map((size) => (
                    <button
                      key={size}
                      style={{
                        flex: 1,
                        padding: '0.3rem 0',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: d3In === size ? '1px solid var(--accent-rose)' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: d3In === size ? 'rgba(244, 63, 94, 0.25)' : 'rgba(0, 0, 0, 0.2)',
                        color: d3In === size ? 'var(--accent-rose)' : 'var(--text-main)',
                        fontWeight: d3In === size ? 700 : 500,
                        cursor: 'pointer'
                      }}
                      onClick={() => setD3In(size)}
                    >
                      {size}″
                    </button>
                  ))}
                </div>
              </div>

              {/* Pipe CD Hazen-Williams C */}
              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600 }}>Pipe CD Roughness C (Aged Cast Iron):</span>
                  <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>C = {c3}</span>
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {[80, 100, 120, 140].map((cVal) => (
                    <button
                      key={cVal}
                      style={{
                        flex: 1,
                        padding: '0.3rem 0',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: c3 === cVal ? '1px solid var(--accent-amber)' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: c3 === cVal ? 'rgba(245, 158, 11, 0.25)' : 'rgba(0, 0, 0, 0.2)',
                        color: c3 === cVal ? 'var(--accent-amber)' : 'var(--text-main)',
                        fontWeight: c3 === cVal ? 700 : 500,
                        cursor: 'pointer'
                      }}
                      onClick={() => setC3(cVal)}
                    >
                      C={cVal}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: PARALLEL PIPES & FRICTION FACTOR SIZING VIEW                  */}
      {/* ===================================================================== */}
      {activeMode === 'parallel-pipes' && (
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
              border: '1px solid rgba(6, 182, 212, 0.25)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                COMMON HEAD LOSS (h<sub>f,AB</sub>)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-cyan, #06b6d4)',
                fontFamily: 'var(--font-mono)'
              }}>
                {parallelData.commonHf.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>ft</span>
              </div>
              <span className="text-xs text-muted">
                Pressure Drop: <strong style={{ color: 'var(--accent-amber)' }}>{parallelData.deltaPsi.toFixed(2)} psi</strong>
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(56, 189, 248, 0.25)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                BRANCH 1 FLOW (14″ LINE)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-blue, #38bdf8)',
                fontFamily: 'var(--font-mono)'
              }}>
                {parallelData.Q1.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>cfs</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--accent-blue)' }}>
                {parallelData.pctQ1.toFixed(1)}% of total | V1 = {parallelData.v1.toFixed(2)} ft/s
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                BRANCH 2 FLOW (12″ LINE)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-emerald, #10b981)',
                fontFamily: 'var(--font-mono)'
              }}>
                {parallelData.Q2.toFixed(2)} <span style={{ fontSize: '0.9rem' }}>cfs</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--accent-emerald)' }}>
                {parallelData.pctQ2.toFixed(1)}% of total | V2 = {parallelData.v2.toFixed(2)} ft/s
              </span>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(168, 85, 247, 0.25)'
            }}>
              <span className="text-xs text-muted" style={{ display: 'block', fontWeight: 600 }}>
                EQUIVALENT PIPE DIAMETER (Deq)
              </span>
              <div style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: 'var(--accent-purple, #a855f7)',
                fontFamily: 'var(--font-mono)'
              }}>
                {parallelData.Deq_in.toFixed(1)} <span style={{ fontSize: '0.9rem' }}>in</span>
              </div>
              <span className="text-xs text-muted">
                {parallelData.Deq_ft.toFixed(2)} ft (for Leq = {eqLft} ft, feq = {eqF})
              </span>
            </div>
          </div>

          {/* Interactive Parallel Conduit SVG Canvas */}
          <div style={{
            background: 'radial-gradient(ellipse at center, rgba(12, 25, 45, 0.8) 0%, rgba(7, 12, 22, 0.95) 100%)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>
                Dual-Conduit Parallel Hydraulic Profile (Junction A → Junction B)
              </strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Condition: <strong style={{ color: 'var(--accent-emerald)' }}>hf,1 ({parallelData.hf1.toFixed(2)}′) = hf,2 ({parallelData.hf2.toFixed(2)}′)</strong>
              </div>
            </div>

            <svg viewBox="0 0 760 300" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <marker id="par-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                </marker>
                <marker id="par-arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                </marker>
              </defs>

              {/* Upstream Main entering Junction A (x: 40 to 140, y: 150) */}
              <line x1="40" y1="150" x2="140" y2="150" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="16" strokeLinecap="round" />
              <line x1="40" y1="150" x2="140" y2="150" stroke="var(--accent-blue)" strokeWidth="4" markerEnd="url(#par-arrow)" />
              <text x="80" y="130" textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="700">
                Qin = {qTotalParallelCfs.toFixed(1)} cfs
              </text>

              {/* Junction A (x: 140, y: 150) */}
              <circle cx="140" cy="150" r="20" fill="#1e293b" stroke="var(--accent-blue)" strokeWidth="3" />
              <text x="140" y="155" textAnchor="middle" fill="#f1f5f9" fontSize="13" fontWeight="800">A</text>
              {/* Pressure gauge A */}
              <rect x="95" y="180" width="90" height="32" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(56, 189, 248, 0.4)" />
              <text x="140" y="195" textAnchor="middle" fill="var(--accent-blue)" fontSize="9" fontWeight="700">PA = {junctionPressurePsi.toFixed(1)} psi</text>
              <text x="140" y="206" textAnchor="middle" fill="var(--text-dim)" fontSize="8">Upstream Node</text>

              {/* Branch 1 (Upper Path): From (140, 150) -> curve to (220, 70) -> (540, 70) -> curve to (620, 150) */}
              <path
                d="M 140 150 Q 180 70 240 70 L 520 70 Q 580 70 620 150"
                fill="none"
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth={Math.max(6, parD1In * 0.9)}
                strokeLinecap="round"
              />
              <path
                d="M 140 150 Q 180 70 240 70 L 520 70 Q 580 70 620 150"
                fill="none"
                stroke="var(--accent-blue)"
                strokeWidth="3.5"
                strokeDasharray="10 5"
              />
              {/* Branch 1 Info Badge */}
              <rect x="300" y="25" width="160" height="52" rx="8" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(56, 189, 248, 0.5)" />
              <text x="380" y="42" textAnchor="middle" fill="var(--accent-blue)" fontSize="11" fontWeight="700">
                Branch 1: {parD1In}″ Line ({parL1Ft} ft)
              </text>
              <text x="380" y="56" textAnchor="middle" fill="var(--text-main)" fontSize="12" fontWeight="800" fontFamily="var(--font-mono)">
                Q1 = {parallelData.Q1.toFixed(2)} cfs ({parallelData.pctQ1.toFixed(1)}%)
              </text>
              <text x="380" y="70" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                hf1 = {parallelData.hf1.toFixed(2)} ft | f1 = {parallelData.f1.toFixed(4)}
              </text>

              {/* Branch 2 (Lower Path): From (140, 150) -> curve to (220, 230) -> (540, 230) -> curve to (620, 150) */}
              <path
                d="M 140 150 Q 180 230 240 230 L 520 230 Q 580 230 620 150"
                fill="none"
                stroke="rgba(16, 185, 129, 0.25)"
                strokeWidth={Math.max(6, parD2In * 0.9)}
                strokeLinecap="round"
              />
              <path
                d="M 140 150 Q 180 230 240 230 L 520 230 Q 580 230 620 150"
                fill="none"
                stroke="var(--accent-emerald)"
                strokeWidth="3.5"
                strokeDasharray="10 5"
              />
              {/* Branch 2 Info Badge */}
              <rect x="300" y="215" width="160" height="52" rx="8" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(16, 185, 129, 0.5)" />
              <text x="380" y="232" textAnchor="middle" fill="var(--accent-emerald)" fontSize="11" fontWeight="700">
                Branch 2: {parD2In}″ Relief ({parL2Ft} ft)
              </text>
              <text x="380" y="246" textAnchor="middle" fill="var(--text-main)" fontSize="12" fontWeight="800" fontFamily="var(--font-mono)">
                Q2 = {parallelData.Q2.toFixed(2)} cfs ({parallelData.pctQ2.toFixed(1)}%)
              </text>
              <text x="380" y="260" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                hf2 = {parallelData.hf2.toFixed(2)} ft | f2 = {parallelData.f2.toFixed(4)}
              </text>

              {/* Junction B (x: 620, y: 150) */}
              <circle cx="620" cy="150" r="20" fill="#1e293b" stroke="var(--accent-cyan)" strokeWidth="3" />
              <text x="620" y="155" textAnchor="middle" fill="#f1f5f9" fontSize="13" fontWeight="800">B</text>
              {/* Pressure gauge B */}
              <rect x="575" y="180" width="90" height="32" rx="6" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(6, 182, 212, 0.4)" />
              <text x="620" y="195" textAnchor="middle" fill="var(--accent-cyan)" fontSize="9" fontWeight="700">PB = {parallelData.downstreamPressurePsi.toFixed(1)} psi</text>
              <text x="620" y="206" textAnchor="middle" fill="var(--text-dim)" fontSize="8">ΔP = -{parallelData.deltaPsi.toFixed(1)} psi</text>

              {/* Downstream Combined Main exiting Junction B (x: 620 to 720, y: 150) */}
              <line x1="620" y1="150" x2="720" y2="150" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="16" strokeLinecap="round" />
              <line x1="620" y1="150" x2="720" y2="150" stroke="var(--accent-cyan)" strokeWidth="4" markerEnd="url(#par-arrow)" />
              <text x="670" y="130" textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="700">
                Qtotal = {qTotalParallelCfs.toFixed(1)} cfs
              </text>
            </svg>

            {/* Live Flow Split Progress Meter */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                  Branch 1 (14″ Line): {parallelData.Q1.toFixed(2)} cfs ({parallelData.pctQ1.toFixed(1)}%)
                </span>
                <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                  Branch 2 (12″ Line): {parallelData.Q2.toFixed(2)} cfs ({parallelData.pctQ2.toFixed(1)}%)
                </span>
              </div>
              <div style={{
                height: '10px',
                borderRadius: '999px',
                background: 'rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                display: 'flex',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ width: `${parallelData.pctQ1}%`, background: 'var(--gradient-cyan)', transition: 'width 0.2s ease' }} />
                <div style={{ width: `${parallelData.pctQ2}%`, background: 'var(--gradient-emerald)', transition: 'width 0.2s ease' }} />
              </div>
            </div>
          </div>

          {/* Sizing & Analysis Dashboard Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {/* Pipe 1 Controls */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--accent-blue)' }}>
                  Branch 1: Existing Line Configuration
                </strong>
                <span className="text-xs text-muted">L1 = {parL1Ft} ft</span>
              </div>

              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Diameter D1:</span>
                  <span style={{ color: 'var(--accent-blue)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{parD1In} inches</span>
                </label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {[10, 12, 14, 16, 18, 20].map((d) => (
                    <button
                      key={d}
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: parD1In === d ? '1px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: parD1In === d ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0, 0, 0, 0.2)',
                        color: parD1In === d ? 'var(--accent-blue)' : 'var(--text-main)',
                        fontWeight: parD1In === d ? 700 : 500,
                        cursor: 'pointer'
                      }}
                      onClick={() => setParD1In(d)}
                    >
                      {d}″
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Friction Factor f1 (Darcy-Weisbach):</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    f1 = {parManualF1.toFixed(4)}
                  </span>
                </label>
                <input
                  type="range"
                  min="0.012"
                  max="0.035"
                  step="0.0005"
                  value={parManualF1}
                  onChange={(e) => {
                    setParManualF1(parseFloat(e.target.value));
                    setUseManualF1(true);
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  <span>Smooth (0.012)</span>
                  <span>Swamee-Jain Re: {parallelData.re1 > 0 ? (parallelData.re1 / 1e5).toFixed(1) + '×10⁵' : '—'}</span>
                  <span>Rough (0.035)</span>
                </div>
              </div>

              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Pipe Length L1:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{parL1Ft} ft</span>
                </label>
                <input
                  type="range"
                  min="1000"
                  max="6000"
                  step="250"
                  value={parL1Ft}
                  onChange={(e) => setParL1Ft(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                />
              </div>
            </div>

            {/* Pipe 2 Controls */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)' }}>
                  Branch 2: New Relief Line Configuration
                </strong>
                <span className="text-xs text-muted">L2 = {parL2Ft} ft</span>
              </div>

              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Diameter D2:</span>
                  <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{parD2In} inches</span>
                </label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {[8, 10, 12, 14, 16, 18].map((d) => (
                    <button
                      key={d}
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: parD2In === d ? '1px solid var(--accent-emerald)' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: parD2In === d ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 0, 0, 0.2)',
                        color: parD2In === d ? 'var(--accent-emerald)' : 'var(--text-main)',
                        fontWeight: parD2In === d ? 700 : 500,
                        cursor: 'pointer'
                      }}
                      onClick={() => setParD2In(d)}
                    >
                      {d}″
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Friction Factor f2 (Darcy-Weisbach):</span>
                  <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    f2 = {parManualF2.toFixed(4)}
                  </span>
                </label>
                <input
                  type="range"
                  min="0.012"
                  max="0.035"
                  step="0.0005"
                  value={parManualF2}
                  onChange={(e) => {
                    setParManualF2(parseFloat(e.target.value));
                    setUseManualF2(true);
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                  <span>Smooth (0.012)</span>
                  <span>Swamee-Jain Re: {parallelData.re2 > 0 ? (parallelData.re2 / 1e5).toFixed(1) + '×10⁵' : '—'}</span>
                  <span>Rough (0.035)</span>
                </div>
              </div>

              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Pipe Length L2:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{parL2Ft} ft</span>
                </label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="250"
                  value={parL2Ft}
                  onChange={(e) => setParL2Ft(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                />
              </div>
            </div>

            {/* Sizing & Optimizer Lab */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--accent-purple)' }}>
                  Parallel Pipe Sizing Optimizer & Equivalent Main
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 700 }}>
                  Target Solver
                </span>
              </div>

              {/* Total Flow Slider */}
              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Total System Inflow (Qtotal):</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {qTotalParallelCfs.toFixed(1)} cfs ({(qTotalParallelCfs * 448.83).toFixed(0)} gpm)
                  </span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="0.5"
                  value={qTotalParallelCfs}
                  onChange={(e) => setQTotalParallelCfs(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
              </div>

              {/* Target Head Loss Constraint */}
              <div>
                <label className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span>Target Maximum Head Loss (hf,max):</span>
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {targetHeadLossFt.toFixed(1)} ft
                  </span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="0.5"
                  value={targetHeadLossFt}
                  onChange={(e) => setTargetHeadLossFt(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
                />
                <div style={{
                  marginTop: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '0.75rem'
                }}>
                  Required D2 to achieve ≤ {targetHeadLossFt.toFixed(1)}′ loss:{' '}
                  <strong style={{ color: 'var(--accent-amber)' }}>
                    {parallelData.D2_req_in.toFixed(1)}″ (Recommend {STANDARD_PIPE_SIZES.find(s => s >= parallelData.D2_req_in) || 16}″ pipe)
                  </strong>
                </div>
              </div>

              {/* Equivalent Single Pipe Summary */}
              <div style={{
                marginTop: '0.2rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                fontSize: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ display: 'block', color: 'var(--accent-purple)', fontWeight: 700 }}>
                    Equivalent Single Transmission Pipe:
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    Leq = {eqLft} ft, feq = {eqF}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: 'var(--accent-purple)' }}>
                  Deq = {parallelData.Deq_in.toFixed(1)}″
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* COLLAPSIBLE ENGINEERING DERIVATION & NCEES HANDBOOK FORMULAS           */}
      {/* ===================================================================== */}
      {showDerivation && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          fontSize: '0.82rem'
        }}>
          <h4 style={{ color: 'var(--accent-blue)', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <span>📖</span> NCEES Civil PE Exam Specifications & Governing Hydraulics Formulas
          </h4>

          {activeMode === 'hardy-cross' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                  1. Hazen-Williams Head Loss Equation (US Customary):
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                  h<sub>f</sub> = (4.727 · L · Q<sup>1.852</sup>) / (C<sup>1.852</sup> · D<sup>4.870</sup>)
                </div>
                <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  where L and D are in feet, Q in cfs, and C is the Hazen-Williams roughness coefficient (120 for new ductile iron, 100 for aged cast iron).
                </p>
              </div>

              <div>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                  2. Hardy Cross Loop Flow Correction Formula:
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                  ΔQ = - [ Σ hf ] / [ n · Σ |hf / Q| ]
                </div>
                <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  For Hazen-Williams, n = 1.852. Clockwise flows and head losses are positive (+), counter-clockwise are negative (-). Correction ΔQ is added algebraically to clockwise flows.
                </p>
              </div>

              <div>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                  3. Sign Convention & Convergence Rule:
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                  Q<sub>corrected</sub> = Q<sub>assumed</sub> + ΔQ
                </div>
                <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  Iterations continue until residual loop head loss |Σ hf| &lt; 0.1 ft. Notice that nodal continuity (Σ Qin = Σ Qout) is preserved at every node throughout the iteration process.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', lineHeight: 1.6 }}>
              <div>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                  1. Parallel Condition & Darcy-Weisbach Equation:
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                  hf,1 = hf,2 = 0.02517 · (f · L · Q²) / D⁵
                </div>
                <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  Head loss across all parallel branches between junction A and B is identical. Equating branch head losses gives the flow split ratio.
                </p>
              </div>

              <div>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                  2. Flow Split Ratio & Continuity:
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                  Q1 / Q2 = √[(f2 · L2 · D1⁵) / (f1 · L1 · D2⁵)]
                </div>
                <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  Combined with continuity Q1 + Q2 = Q_total, this determines the exact flow in each parallel pipe without needing trial-and-error.
                </p>
              </div>

              <div>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>
                  3. Equivalent Pipe Diameter (Deq):
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '4px' }}>
                  D<sub>eq</sub> = [ (0.02517 · f<sub>eq</sub> · L<sub>eq</sub> · Q<sub>total</sub>²) / h<sub>f</sub> ]<sup>1/5</sup>
                </div>
                <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.75rem' }}>
                  A single equivalent pipe having diameter Deq and length Leq will carry the entire system flow with the exact same hydraulic grade line loss.
                </p>
              </div>
            </div>
          )}
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

export default PipeNetworkVisualizer;
