import React, { useState, useEffect, useRef } from 'react';

const HydraulicRamVisualizer = ({ problem }) => {
  // Input parameters
  const [bridgeLoadKn, setBridgeLoadKn] = useState(1000); // Required lift capacity of bridge
  const [ramCapacityTons, setRamCapacityTons] = useState(120); // Ordered ram capacity
  
  // Animation states
  const [extension, setExtension] = useState(0); // 0 to 120 (100 = touches deck, >100 = lifts deck)
  const [isAutoPumping, setIsAutoPumping] = useState(false);
  const [isLeverPressed, setIsLeverPressed] = useState(false);
  const [hoseFlowing, setHoseFlowing] = useState(false);
  const [sprayParticles, setSprayParticles] = useState([]);
  const [reliefValveTripped, setReliefValveTripped] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Constants for Math
  const knToLbs = 224.808943;
  const lbsInTon = 2000;
  
  // Convert ordered ram capacity to kN
  const ramCapacityKn = (ramCapacityTons * lbsInTon) / knToLbs;
  const bridgeLoadTons = (bridgeLoadKn * knToLbs) / lbsInTon;
  
  // Safety factor & check
  const isUndersized = ramCapacityKn < bridgeLoadKn;
  
  // Physics derivations
  const gapSize = 100; // Screen pixels between cylinder top and deck
  const liftHeight = Math.max(0, extension - gapSize); // Screen pixels the bridge deck is raised
  const isEngaged = extension >= gapSize;
  
  // Hose flow timer ref
  const flowTimeoutRef = useRef(null);

  // Pressure gauge calculation (0 to 100%)
  // Under no load (extending in air), pressure is minimal (e.g. 5-10% of max).
  // Once engaged, pressure represents the bridge load relative to the ram capacity.
  let pressurePercent = 0;
  if (extension > 0) {
    if (!isEngaged) {
      // Extending through air
      pressurePercent = 8 + (extension / gapSize) * 5;
    } else {
      // Under load
      const basePressure = (bridgeLoadKn / ramCapacityKn) * 80;
      pressurePercent = Math.min(100, 15 + basePressure + (liftHeight * 1.5));
    }
  }

  // Auto-pump loops
  useEffect(() => {
    let intervalId;
    if (isAutoPumping) {
      intervalId = setInterval(() => {
        setExtension(prev => {
          const next = prev + 1.5;
          
          // Safety: check if engaged and overloaded
          if (next >= gapSize) {
            setHoseFlowing(true);
            if (isUndersized) {
              setReliefValveTripped(true);
              triggerSpray();
              // Stop extending further to simulate relief valve bypass
              return prev; 
            }
          } else {
            setHoseFlowing(true);
          }
          
          if (next >= 120) {
            setIsAutoPumping(false);
            return 120;
          }
          return next;
        });
      }, 40);
    } else {
      setHoseFlowing(false);
    }
    return () => clearInterval(intervalId);
  }, [isAutoPumping, isUndersized]);

  // Handle spray particles tick
  useEffect(() => {
    if (sprayParticles.length > 0) {
      const frame = requestAnimationFrame(() => {
        setSprayParticles(prev => 
          prev
            .map(p => ({
              ...p,
              x: p.x + p.vx,
              y: p.y + p.vy,
              vy: p.vy + 0.3, // gravity
              life: p.life - 1
            }))
            .filter(p => p.life > 0)
        );
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [sprayParticles]);

  const triggerSpray = () => {
    // Generate spray particles from the relief valve on the pump (approx x=190, y=340)
    const newParticles = Array.from({ length: 4 }).map(() => ({
      id: Math.random(),
      x: 190,
      y: 335,
      vx: -(Math.random() * 4 + 2), // spray leftwards
      vy: -(Math.random() * 3 + 2), // spray upwards
      life: 25 + Math.random() * 15,
      size: Math.random() * 3 + 2
    }));
    setSprayParticles(prev => [...prev, ...newParticles].slice(-40));
  };

  // Manual pumping action
  const handlePump = () => {
    if (isAutoPumping) return;
    
    setIsLeverPressed(true);
    setHoseFlowing(true);
    
    // Animate flow pulses
    if (flowTimeoutRef.current) clearTimeout(flowTimeoutRef.current);
    flowTimeoutRef.current = setTimeout(() => {
      setHoseFlowing(false);
    }, 400);

    setTimeout(() => {
      setIsLeverPressed(false);
    }, 150);

    setExtension(prev => {
      const next = prev + 8;
      
      if (next >= gapSize) {
        if (isUndersized) {
          setReliefValveTripped(true);
          triggerSpray();
          triggerSpray(); // extra spray
          return prev; // Relief valve trips: cannot lift deck
        }
      }
      
      if (next >= 120) return 120;
      return next;
    });
  };

  const handleReset = () => {
    setExtension(0);
    setIsAutoPumping(false);
    setReliefValveTripped(false);
    setSprayParticles([]);
  };

  // Gauge needle rotation (from -120deg to 120deg)
  const needleRotation = -120 + (pressurePercent / 100) * 240;

  return (
    <div className="visualizer-wrapper" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', width: '100%' }}>
      
      {/* LEFT: Controls Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '4px solid var(--accent-indigo)' }}>
        <div>
          <span className="text-muted text-sm" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>PE Exam: Means & Methods</span>
          <h3 className="text-gradient mb-2" style={{ fontSize: '1.5rem' }}>Hydraulic Jacking Simulator</h3>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-muted)' }}>
            A bridge deck requires a jacking lift force of <strong>{bridgeLoadKn.toLocaleString()} kN</strong>. Compare performance with an undersized versus adequately rated hydraulic ram.
          </p>
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          <div>
            <div className="control-header">
              <label style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>Bridge Lift Load: {bridgeLoadKn.toLocaleString()} kN</label>
              <span className="value-display text-sm">{bridgeLoadTons.toFixed(1)} Tons</span>
            </div>
            <input 
              type="range" 
              min="500" 
              max="3000" 
              step="100" 
              value={bridgeLoadKn} 
              onChange={(e) => {
                setBridgeLoadKn(Number(e.target.value));
                setReliefValveTripped(false);
              }} 
              className="w-full" 
            />
          </div>

          <div>
            <div className="control-header">
              <label style={{ color: 'var(--accent-indigo)', fontSize: '0.9rem' }}>Ram Capacity: {ramCapacityTons} Tons</label>
              <span className="value-display text-sm" style={{ color: 'var(--accent-indigo)' }}>{ramCapacityKn.toFixed(0)} kN</span>
            </div>
            <input 
              type="range" 
              min="50" 
              max="250" 
              step="10" 
              value={ramCapacityTons} 
              onChange={(e) => {
                setRamCapacityTons(Number(e.target.value));
                setReliefValveTripped(false);
              }} 
              className="w-full" 
            />
          </div>
        </div>

        {/* Operating Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="solution-btn" 
              style={{ 
                flex: 2, 
                background: reliefValveTripped 
                  ? 'var(--accent-pink)' 
                  : isAutoPumping 
                    ? 'rgba(255,255,255,0.1)' 
                    : 'var(--gradient-primary)',
                opacity: isAutoPumping ? 0.6 : 1
              }}
              onClick={handlePump}
              disabled={isAutoPumping}
            >
              🚀 Click to Pump Lever
            </button>
            
            <button 
              className="solution-btn"
              style={{ 
                flex: 1, 
                background: isAutoPumping ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.05)',
                color: isAutoPumping ? '#000' : '#fff'
              }}
              onClick={() => {
                setIsAutoPumping(!isAutoPumping);
                setReliefValveTripped(false);
              }}
            >
              {isAutoPumping ? '⏸️ Stop' : '▶️ Auto'}
            </button>
          </div>

          <button 
            className="solution-btn"
            style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}
            onClick={handleReset}
          >
            🔄 Reset Jacking
          </button>
        </div>

        {/* Digital Readout Screen */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: '1rem', 
            background: 'rgba(5, 5, 10, 0.6)', 
            border: reliefValveTripped ? '1px solid #ef4444' : isEngaged ? '1px solid #10b981' : '1px solid var(--border-color)',
            borderRadius: '8px',
            textAlign: 'center'
          }}
        >
          {reliefValveTripped ? (
            <div style={{ color: '#ef4444' }}>
              <h5 style={{ fontWeight: 'bold' }}>⚠️ PRESSURE RELIEF ACTIVE</h5>
              <p className="text-sm m-0">Load ({bridgeLoadTons.toFixed(1)}T) exceeds Ram Rated Capacity ({ramCapacityTons}T)! Fluid bypassing cylinder.</p>
            </div>
          ) : isEngaged ? (
            <div style={{ color: '#10b981' }}>
              <h5 style={{ fontWeight: 'bold' }}>✅ DECK ENGAGED & SECURED</h5>
              <p className="text-sm m-0">Ram load: {bridgeLoadTons.toFixed(1)} Tons / Cap: {ramCapacityTons} Tons</p>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>
              <h5>📏 EXTENDING CYLINDER</h5>
              <p className="text-sm m-0">Piston extension: {((extension / gapSize) * 100).toFixed(0)}% (Approaching bridge deck)</p>
            </div>
          )}
        </div>

        <button 
          className="solution-btn" 
          style={{ width: '100%', background: showSolution ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.05)' }}
          onClick={() => setShowSolution(!showSolution)}
        >
          {showSolution ? 'Hide Math Breakdown' : 'View Math Breakdown'}
        </button>
      </div>

      {/* RIGHT: SVG Animation Panel */}
      <div 
        className="glass-panel" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          background: '#090d16', 
          padding: '1rem',
          minHeight: '380px',
          overflow: 'hidden'
        }}
      >
        <svg 
          viewBox="0 0 800 450" 
          width="100%" 
          height="100%"
          className={reliefValveTripped ? 'animate-shake' : ''}
          style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="ramGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
            <linearGradient id="pistonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="50%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id="cylinderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="40%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
            <linearGradient id="bridgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>
          
          <rect width="800" height="450" fill="url(#ramGrid)" />

          {/* Background Label */}
          <text x="780" y="30" fill="rgba(255,255,255,0.05)" fontSize="20" textAnchor="end" fontWeight="bold">HYDRAULIC JACKING SCHEMATIC</text>

          {/* Concrete Bearings (Resting Blocks) */}
          {/* Left Rest */}
          <rect x="120" y="180" width="70" height="200" fill="#334155" stroke="#475569" strokeWidth="2" />
          <line x1="120" y1="180" x2="190" y2="180" stroke="#f43f5e" strokeWidth="3" />
          
          {/* Right Rest */}
          <rect x="610" y="180" width="70" height="200" fill="#334155" stroke="#475569" strokeWidth="2" />
          <line x1="610" y1="180" x2="680" y2="180" stroke="#f43f5e" strokeWidth="3" />

          {/* Ground */}
          <rect x="0" y="380" width="800" height="70" fill="#0f172a" />
          <line x1="0" y1="380" x2="800" y2="380" stroke="#1e293b" strokeWidth="4" />

          {/* Hydraulic Oil Flowing Animation (Hose) */}
          <path 
            d="M 210 365 C 260 395, 330 395, 375 365" 
            fill="none" 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth="8" 
          />
          <path 
            d="M 210 365 C 260 395, 330 395, 375 365" 
            fill="none" 
            stroke={reliefValveTripped ? '#ef4444' : 'var(--accent-blue)'} 
            strokeWidth="4" 
            className={hoseFlowing ? 'animate-fluid-flow' : ''} 
          />

          {/* The Hydraulic Ram Assembly */}
          <g id="ram-assembly" transform="translate(0, 0)">
            {/* Cylinder Oil Fluid Base */}
            <rect 
              x="380" 
              y={280 + (100 - Math.min(100, extension))} 
              width="40" 
              height={Math.min(100, extension)} 
              fill={reliefValveTripped ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)'} 
            />

            {/* Piston shaft */}
            {/* Fully retracted top is y=280. Max extension (120) top is y=160 */}
            <rect 
              x="385" 
              y={280 - extension} 
              width="30" 
              height="100" 
              fill="url(#pistonGrad)" 
              stroke="#64748b" 
              strokeWidth="1"
            />
            {/* Piston Collar */}
            <rect 
              x="380" 
              y={280 - extension} 
              width="40" 
              height="8" 
              fill="#cbd5e1" 
            />

            {/* Cylinder Housing */}
            <rect 
              x="375" 
              y="280" 
              width="50" 
              height="100" 
              fill="url(#cylinderGrad)" 
              stroke="#0284c7" 
              strokeWidth="2" 
              rx="2"
            />
            <rect x="365" y="375" width="70" height="8" fill="#0369a1" />

            {/* Fluid Port */}
            <rect x="370" y="360" width="8" height="10" fill="#0369a1" />
          </g>

          {/* The Bridge Deck (Moves Up by liftHeight pixels) */}
          <g id="bridge-deck" transform={`translate(0, -${liftHeight})`}>
            {/* Steel Plate bottom */}
            <rect x="100" y="165" width="600" height="15" fill="url(#bridgeGrad)" stroke="#475569" strokeWidth="2" />
            {/* Truss lines for bridge style */}
            <path d="M 120 165 L 170 125 L 220 165 L 270 125 L 320 165 L 370 125 L 420 165 L 470 125 L 520 165 L 570 125 L 620 165 L 670 125" fill="none" stroke="#64748b" strokeWidth="3" />
            <line x1="170" y1="125" x2="670" y2="125" stroke="#475569" strokeWidth="4" />
            
            {/* Bridge Deck Text */}
            <text x="400" y="150" fill="white" textAnchor="middle" fontWeight="bold" fontSize="14">
              BRIDGE DECK ({bridgeLoadKn} kN LOAD)
            </text>

            {/* Safety lift displacement text */}
            {liftHeight > 0 && (
              <text x="400" y="105" fill="var(--accent-cyan)" fontSize="18" fontWeight="bold" textAnchor="middle" className="animate-float-subtle">
                LIFT: {(liftHeight * 0.25).toFixed(2)} inches
              </text>
            )}
          </g>

          {/* Hand Pump Unit */}
          <g id="hand-pump">
            {/* Pump Reservoir tank */}
            <rect x="170" y="330" width="45" height="50" fill="#334155" stroke="#475569" strokeWidth="2" rx="4" />
            <text x="192" y="375" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">OIL TANK</text>

            {/* Lever handle pivot */}
            <circle cx="205" cy="335" r="4" fill="#64748b" />

            {/* Pump Arm (Rotates based on isLeverPressed) */}
            <line 
              x1="205" 
              y1="335" 
              x2={isLeverPressed ? 160 : 155} 
              y2={isLeverPressed ? 320 : 295} 
              stroke="#ef4444" 
              strokeWidth="5" 
              strokeLinecap="round"
            />
            {/* Hand Grip */}
            <circle 
              cx={isLeverPressed ? 160 : 155} 
              cy={isLeverPressed ? 320 : 295} 
              r="7" 
              fill="#b91c1c" 
            />

            {/* Small Pressure Gauge on the Pump */}
            <circle cx="192" cy="305" r="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            {/* Gauge markings */}
            <path d="M 180 305 A 12 12 0 1 1 204 305" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />
            
            {/* Red Zone marker */}
            <path d="M 197 295 A 12 12 0 0 1 204 305" fill="none" stroke="#ef4444" strokeWidth="2" />

            {/* Gauge Needle */}
            <line 
              x1="192" 
              y1="305" 
              x2={192 + Math.sin((needleRotation * Math.PI) / 180) * 12}
              y2={305 - Math.cos((needleRotation * Math.PI) / 180) * 12}
              stroke={reliefValveTripped ? '#ef4444' : '#38bdf8'} 
              strokeWidth="2.5" 
              strokeLinecap="round"
            />
            <circle cx="192" cy="305" r="3" fill="white" />
            
            {/* PSI/Bar Label */}
            <text x="192" y="318" fill="rgba(255,255,255,0.4)" fontSize="6" textAnchor="middle" fontWeight="bold">BAR</text>
          </g>

          {/* Spray Particles (Flashes out of relief valve when overloaded) */}
          {sprayParticles.map(p => (
            <circle 
              key={p.id} 
              cx={p.x} 
              cy={p.y} 
              r={p.size} 
              fill="#fbbf24" 
              opacity={p.life / 40} 
            />
          ))}

          {/* Relief valve indicator ring */}
          {reliefValveTripped && (
            <g transform="translate(190, 335)">
              <circle r="12" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.8" className="animate-ping" />
              <text x="-25" y="-15" fill="#ef4444" fontSize="10" fontWeight="bold">RELIEF POP!</text>
            </g>
          )}

          {/* Safety Warning Light */}
          {isEngaged && (
            <g transform="translate(400, 50)">
              <rect x="-130" y="-15" width="260" height="30" fill={reliefValveTripped ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'} stroke={reliefValveTripped ? '#ef4444' : '#10b981'} strokeWidth="1" rx="4" />
              <circle cx="-110" cy="0" r="6" fill={reliefValveTripped ? '#ef4444' : '#10b981'} className="animate-pulse" />
              <text x="-95" y="5" fill={reliefValveTripped ? '#ef4444' : '#10b981'} fontSize="12" fontWeight="bold" textAnchor="start">
                {reliefValveTripped ? 'DANGER: RAM OVERLOAD (100%+)' : 'OPERATIONAL SAFE (CYLINDER OK)'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* BOTTOM Breakdown Card */}
      {showSolution && (
        <div className="animate-float-subtle glass-panel" style={{ gridColumn: '1 / -1', borderLeft: '4px solid var(--accent-purple)', background: 'rgba(129, 140, 248, 0.05)' }}>
          <h4 style={{ color: 'var(--accent-purple)', marginBottom: '1rem', fontSize: '1.25rem' }}>Jacking Mechanics & Math Breakdown</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div>
              <p className="mb-2"><strong>1. Force Conversion (kN to lbs):</strong></p>
              <p className="text-muted text-sm">Convert the required design load of the bridge deck from metric kilonewtons (kN) to imperial pounds (lbs) using the governing conversion factor:</p>
              <code>{bridgeLoadKn.toLocaleString()} kN × 224.81 lbs/kN = <strong>{ (bridgeLoadKn * 224.808943).toLocaleString(undefined, {maximumFractionDigits:0}) } lbs</strong></code>
            </div>
            
            <div>
              <p className="mb-2"><strong>2. Capacity Requirement (lbs to US Tons):</strong></p>
              <p className="text-muted text-sm">Convert total pounds into short tons (1 ton = 2,000 lbs) to determine the contractor rating needed:</p>
              <code>{ (bridgeLoadKn * 224.808943).toLocaleString(undefined, {maximumFractionDigits:0}) } lbs ÷ 2,000 lbs/ton = <strong>{bridgeLoadTons.toFixed(2)} Tons</strong></code>
            </div>

            <div>
              <p className="mb-2"><strong>3. Decision Boundary:</strong></p>
              <p className="text-muted text-sm">For the jacking operation to proceed safely, the ordered ram capacity must exceed the actual load by a safety margin:</p>
              <p style={{ margin: '0.5rem 0', fontWeight: 'bold' }}>
                Required: {bridgeLoadTons.toFixed(1)} Tons vs Available: {ramCapacityTons} Tons
              </p>
              <span 
                style={{ 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '4px', 
                  fontSize: '0.85rem',
                  background: isUndersized ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                  color: isUndersized ? '#ef4444' : '#10b981',
                  display: 'inline-block'
                }}
              >
                {isUndersized ? '❌ INSUFFICIENT CAPACITY (Ram fails/bypasses)' : '✅ ADEQUATE CAPACITY (Safe Operation)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HydraulicRamVisualizer;
