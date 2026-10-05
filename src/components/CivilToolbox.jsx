import { useState, lazy, Suspense } from 'react';
import MathText from './MathText';

const CurvePlatVisualizer = lazy(() => import('../plugins/curve-plat-geometry/CurvePlatVisualizer'));
const StormwaterVisualizer = lazy(() => import('../plugins/stormwater-rational/StormwaterVisualizer'));
const SoilPhaseEarthworkVisualizer = lazy(() => import('../plugins/soil-phase-earthwork/SoilPhaseEarthworkVisualizer'));
const PumpSystemVisualizer = lazy(() => import('../plugins/pump-system-hydraulics/PumpSystemVisualizer'));
const BeamShearMomentVisualizer = lazy(() => import('../plugins/beam-shear-moment/BeamShearMomentVisualizer'));
const TraverseCogoVisualizer = lazy(() => import('../plugins/traverse-cogo/TraverseCogoVisualizer'));

export default function CivilToolbox({ onSelectProblem }) {
  const [activeToolId, setActiveToolId] = useState('curve-plat');

  const tools = [
    {
      id: 'curve-plat',
      title: 'Roadway & Plat Curves (Rule 2)',
      badge: 'Plats & Geometrics',
      icon: '📐',
      color: 'var(--accent-amber)',
      tint: '245, 158, 11',
      formula: 'T = R·tan(Δ/2)  |  L = Stated - T  |  A_fillet = R·T - ½R²Δ',
      description: 'Subdivision plat corner returns with P.I. angle bar glyphs (┌), dynamic tangent derivation, boundary line cut-backs, and highway vertical curves with stopping sight distance (SSD).',
      linkedProblemId: 203,
      component: CurvePlatVisualizer,
      problemMock: { id: 203, curveType: 'horizontal-plat', radius: 25.0, delta: 102.5, statedDistance: 165.0, piStation: 1240.0 }
    },
    {
      id: 'stormwater',
      title: 'Rational Runoff & Detention',
      badge: 'Stormwater & Drainage',
      icon: '🌧️',
      color: 'var(--accent-blue)',
      tint: '56, 189, 248',
      formula: 'Q = C·I·A  |  tc Kirpich  |  D = [(2.16·Q·n)/S^(½)]^(⅜)',
      description: 'Multi-surface composite runoff coefficient C weighting, Kirpich overland flow time of concentration, Manning gravity storm pipe diameter sizing, and Modified Rational detention storage routing.',
      linkedProblemId: 205,
      component: StormwaterVisualizer,
      problemMock: { id: 205, totalArea: 12.0, roofArea: 4.5, paveArea: 5.0, lawnArea: 2.5, tc: 15.0, intensity: 4.17, pipeSlope: 0.008, manningN: 0.012 }
    },
    {
      id: 'soil-phase',
      title: 'Soil Phase & Earthwork',
      badge: 'Geotechnical & Earthwork',
      icon: '🪨',
      color: 'var(--accent-emerald)',
      tint: '16, 185, 129',
      formula: 'e = Vv / Vs  |  S = (w·Gs)/e  |  BCY = CCY·(γ_c / γ_b)',
      description: 'Proportional 3-phase soil diagram with live void ratio, porosity, saturation, and unit weight conversions, plus earthwork volume bulkage between Bank (BCY), Loose (LCY), and Compacted (CCY).',
      linkedProblemId: 207,
      component: SoilPhaseEarthworkVisualizer,
      problemMock: { id: 207, totalVolume: 0.050, totalWeight: 6.10, dryWeight: 5.25, gs: 2.70 }
    },
    {
      id: 'pump-system',
      title: 'Pump Hydraulics & TDH',
      badge: 'Water Distribution',
      icon: '⚡',
      color: 'var(--accent-cyan)',
      tint: '6, 182, 212',
      formula: 'H_pump = H_sys  |  BHP = (Q·H)/(3960·η)  |  NPSHA > NPSHR',
      description: 'System head curve solver (static lift + Hazen-Williams pipe friction + minor losses), pump characteristic curve intersection, operating duty point, motor brake horsepower, and NPSH cavitation check.',
      linkedProblemId: 209,
      component: PumpSystemVisualizer,
      problemMock: { id: 209, hStat: 115.0, hShutoff: 180.0, pipeLength: 3200, pipeDiamIn: 12, hazenC: 120, efficiency: 0.78, suctionLift: 8.0, npshR: 14.0 }
    },
    {
      id: 'beam-shear',
      title: 'Beam Shear & Moment',
      badge: 'Structural Mechanics',
      icon: '🏗️',
      color: 'var(--accent-indigo)',
      tint: '99, 102, 241',
      formula: 'V(x) = R1 - wx - ΣP  |  M(x) = ∫V dx  |  S_req = M_max / F_b',
      description: 'Everyday beam solver for simply supported and cantilever beams: point and uniform loads, live interactive Shear Force (SFD) and Bending Moment (BMD) canvas, section modulus S_req, and AISC W-beam selection.',
      linkedProblemId: 210,
      component: BeamShearMomentVisualizer,
      problemMock: { id: 210, spanLength: 24.0, wLoad: 1.20, pLoad: 16.0, pPos: 8.0, fySteel: 50.0 }
    },
    {
      id: 'traverse-cogo',
      title: 'Traverse COGO & Area',
      badge: 'Surveying & Land Records',
      icon: '📐',
      color: 'var(--accent-rose)',
      tint: '244, 63, 94',
      formula: 'C_lat = -ΣLat·(L/P)  |  E_L = √(ΔLat² + ΔDep²)  |  Area Shoelace',
      description: 'Closed boundary traverse balancing via Bowditch Compass Rule, linear misclosure vector, precision ratio specification verification, balanced coordinates, and Shoelace parcel acreage.',
      linkedProblemId: 211,
      component: TraverseCogoVisualizer,
      problemMock: { id: 211, perimeter: 2065.10, startingN: 5000.0, startingE: 5000.0 }
    }
  ];

  const currentTool = tools.find((t) => t.id === activeToolId) || tools[0];
  const ActiveComponent = currentTool.component;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
      {/* Toolbox Hero Header */}
      <section className="glass-panel" style={{ padding: '2.5rem 2rem', position: 'relative', overflow: 'hidden', borderLeft: '4px solid var(--accent-amber)' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-30px', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '850px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', borderRadius: '9999px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '1rem' }}>
            <span>🧰</span>
            <span className="text-xs" style={{ color: 'var(--accent-amber)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Everyday Civil Engineer's Design Workbench
            </span>
          </div>

          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.75rem' }}>
            Professional Everyday <span className="text-gradient-amber">Engineering Toolbox</span>
          </h2>

          <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#94a3b8', margin: 0 }}>
            Instant, interactive parametric calculators for daily civil engineering practice: subdivision plat curves (Rule 2 P.I. angle bar glyphs), Rational Method runoff and detention basins, 3-phase soil relationships and earthwork bulkage, pump TDH and system curves, beam shear and moment diagrams, and traverse COGO balancing.
          </p>
        </div>
      </section>

      {/* Tool Selector Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {tools.map((t) => {
          const isActive = t.id === activeToolId;
          return (
            <button
              key={t.id}
              onClick={() => setActiveToolId(t.id)}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '1rem',
                cursor: 'pointer',
                textAlign: 'left',
                border: isActive ? `2px solid ${t.color}` : '1px solid var(--border-color)',
                background: isActive ? `rgba(${t.tint}, 0.15)` : 'rgba(255, 255, 255, 0.03)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{t.icon}</span>
                <span className="glass-badge" style={{ fontSize: '0.65rem', color: t.color }}>
                  {t.badge}
                </span>
              </div>
              <strong style={{ fontSize: '0.925rem', color: isActive ? '#ffffff' : '#e2e8f0', marginBottom: '0.2rem' }}>
                {t.title}
              </strong>
              <span className="text-xs text-muted" style={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                <MathText text={t.formula} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tool Workbench Header & Actions */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>{currentTool.icon}</span>
          <div>
            <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#fff' }}>{currentTool.title}</h3>
            <span className="text-xs text-muted">{currentTool.description}</span>
          </div>
        </div>

        <button
          className="btn-secondary"
          onClick={() => onSelectProblem(currentTool.linkedProblemId)}
          style={{
            background: `rgba(${currentTool.tint}, 0.2)`,
            borderColor: currentTool.color,
            color: currentTool.color,
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span>📘</span> Open PE Exam Problem #{currentTool.linkedProblemId} →
        </button>
      </div>

      {/* Active Tool Dynamic Component */}
      <Suspense fallback={<div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>⏳ Loading {currentTool.title}…</div>}>
        <ActiveComponent problem={currentTool.problemMock} {...currentTool.problemMock} />
      </Suspense>
    </div>
  );
}
