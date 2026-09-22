/**
 * 50' x 50' House Slab & Helical Pile Interactive Engineering Problem Calculator
 * SolvedIn6 PE Exam Study Portal
 *
 * Supports variable concrete density, house weight, surcharge, water table / pore water pressure,
 * depth & diameter of helical pile, and dynamic soil spectrum from Organic -> Clay -> Rocky.
 * Computes simultaneous Safety Factors (SF = 1.0, 1.5, 2.0, 3.0) and layout grids.
 */

(function () {
  'use strict';

  // Comprehensive Soil Classification Matrix: Organic -> Clay -> Sand -> Rocky
  const SOIL_PRESETS = {
    // 1. Organic Formations
    organic_peat: {
      name: 'Organic Peat & Muck',
      typeGroup: 'organic',
      phi: 0,
      c: 250,
      dry: 65,
      sat: 75,
      spectrumVal: 10,
      fillColor: '#3e2723',
      hatchType: 'organicHatch',
      label: '🌱 Organic Peat & Muck',
      desc: 'Extremely soft, high moisture, high pore pressure sensitivity, low capacity'
    },
    organic_silt: {
      name: 'Organic Silt / Soft Marsh',
      typeGroup: 'organic',
      phi: 6,
      c: 400,
      dry: 85,
      sat: 98,
      spectrumVal: 20,
      fillColor: '#4e342e',
      hatchType: 'organicHatch',
      label: '🌱 Organic Silt',
      desc: 'Highly compressible, sensitive to hydrostatic pore pressure'
    },

    // 2. Clay Formations
    soft_clay: {
      name: 'Soft Marine Clay',
      typeGroup: 'clay',
      phi: 0,
      c: 500,
      dry: 95,
      sat: 112,
      spectrumVal: 35,
      fillColor: '#5d4037',
      hatchType: 'clayHatch',
      label: '🧱 Soft Marine Clay',
      desc: 'Normally consolidated cohesive alluvium, low shear strength'
    },
    medium_clay: {
      name: 'Medium Stiff Clay',
      typeGroup: 'clay',
      phi: 8,
      c: 900,
      dry: 105,
      sat: 118,
      spectrumVal: 45,
      fillColor: '#6d4c41',
      hatchType: 'clayHatch',
      label: '🧱 Medium Stiff Clay',
      desc: 'Standard cohesive foundation layer with undrained response'
    },
    stiff_clay: {
      name: 'Stiff Overconsolidated Clay',
      typeGroup: 'clay',
      phi: 15,
      c: 1800,
      dry: 115,
      sat: 125,
      spectrumVal: 55,
      fillColor: '#795548',
      hatchType: 'clayHatch',
      label: '🧱 Stiff Clay (Overconsolidated)',
      desc: 'Dense cohesive matrix with significant cohesion and friction'
    },

    // 3. Granular Sands
    medium_sand: {
      name: 'Medium Dense Sand',
      typeGroup: 'sand',
      phi: 32,
      c: 0,
      dry: 115,
      sat: 125,
      spectrumVal: 70,
      fillColor: '#d97706',
      hatchType: 'sandHatch',
      label: '🏖️ Medium Dense Sand',
      desc: 'Cohesionless granular deposit (Problem #54 analog)'
    },
    dense_sand: {
      name: 'Dense Sand & Gravel',
      typeGroup: 'sand',
      phi: 36,
      c: 0,
      dry: 122,
      sat: 132,
      spectrumVal: 80,
      fillColor: '#b45309',
      hatchType: 'sandHatch',
      label: '🏖️ Dense Sand & Gravel',
      desc: 'Well-graded gravelly sand with high internal friction'
    },

    // 4. Rocky & Bedrock Formations
    rocky_till: {
      name: 'Rocky Glacial Till / Cobbles',
      typeGroup: 'rocky',
      phi: 42,
      c: 2500,
      dry: 135,
      sat: 145,
      spectrumVal: 90,
      fillColor: '#475569',
      hatchType: 'rockHatch',
      label: '🪨 Rocky Glacial Till',
      desc: 'Dense cobble-matrix till with high interlocking resistance'
    },
    sound_bedrock: {
      name: 'Sound Solid Bedrock',
      typeGroup: 'rocky',
      phi: 45,
      c: 5000,
      dry: 150,
      sat: 160,
      spectrumVal: 100,
      fillColor: '#334155',
      hatchType: 'rockHatch',
      label: '🪨 Solid Rocky Bedrock',
      desc: 'Solid limestone/sandstone stratum, refusal bearing capacity'
    }
  };

  // State object
  const state = {
    slabLength: 50, // ft (fixed)
    slabWidth: 50,  // ft (fixed)
    slabThickness: 8, // inches
    concreteUnitWeight: 150, // pcf
    houseWeightKips: 150, // kips
    surchargePsf: 50, // psf
    waterTableDepth: 8, // ft
    pileDepth: 25, // ft
    helixDiameterInches: 12, // inches
    helixCount: 2, // 1, 2, or 3
    soilClassKey: 'stiff_clay',
    soilSpectrum: 55, // 0 (Organic) -> 55 (Clay) -> 100 (Rocky)
    soilFrictionAngle: 15, // deg
    soilCohesion: 1800, // psf
    soilDryUnitWeight: 115, // pcf
    soilSatUnitWeight: 125, // pcf
    waterUnitWeight: 62.4, // pcf
    selectedSfTab: 2.0 // Active SF tab for detailed visualization
  };

  // Mathematical engine
  function calculateEngineeringSolution() {
    const area = state.slabLength * state.slabWidth; // 2,500 sq ft
    const slabVolume = area * (state.slabThickness / 12); // cu ft
    const slabWeightLbs = slabVolume * state.concreteUnitWeight;
    const slabWeightKips = slabWeightLbs / 1000;

    const houseWeightLbs = state.houseWeightKips * 1000;
    const surchargeTotalLbs = state.surchargePsf * area;
    const surchargeTotalKips = surchargeTotalLbs / 1000;

    const totalLoadLbs = slabWeightLbs + houseWeightLbs + surchargeTotalLbs;
    const totalLoadKips = totalLoadLbs / 1000;
    const avgBearingPressurePsf = totalLoadLbs / area;

    // Soil & Hydrostatic Pore Water Pressure at Pile Depth D
    const D = state.pileDepth;
    const zw = state.waterTableDepth;
    const gammaW = state.waterUnitWeight;

    let hDry = 0;
    let hSat = 0;
    let porePressureU = 0;
    let totalStressSigmaV = 0;

    if (D <= zw) {
      hDry = D;
      hSat = 0;
      porePressureU = 0;
      totalStressSigmaV = state.surchargePsf + (state.soilDryUnitWeight * hDry);
    } else {
      hDry = zw;
      hSat = D - zw;
      porePressureU = gammaW * hSat;
      totalStressSigmaV = state.surchargePsf + (state.soilDryUnitWeight * hDry) + (state.soilSatUnitWeight * hSat);
    }

    const effectiveStressSigmaVPrime = Math.max(10, totalStressSigmaV - porePressureU);

    // Helical Pile Capacity
    const phiRad = (state.soilFrictionAngle * Math.PI) / 180;
    let Nq = 1;
    let Nc = 5.14;

    if (state.soilFrictionAngle > 0) {
      Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan((Math.PI / 4) + (phiRad / 2)), 2);
      Nc = (Nq - 1) / Math.tan(phiRad);
    }

    const helixDiaFt = state.helixDiameterInches / 12;
    const helixArea = (Math.PI / 4) * Math.pow(helixDiaFt, 2);

    const qUltBearing = (state.soilCohesion * Nc) + (effectiveStressSigmaVPrime * Nq);
    const qUltPerPileLbs = qUltBearing * helixArea * state.helixCount;
    const qUltPerPileKips = qUltPerPileLbs / 1000;

    // Safety Factors Matrix: 1.0, 1.5, 2.0, 3.0
    const safetyFactors = [1.0, 1.5, 2.0, 3.0];
    const sfResults = safetyFactors.map(sf => {
      const qAllowLbs = qUltPerPileLbs / sf;
      const qAllowKips = qUltPerPileKips / sf;
      const nRequired = Math.max(1, Math.ceil(totalLoadLbs / qAllowLbs));
      
      // Determine square/rectangular grid
      const gridSide = Math.ceil(Math.sqrt(nRequired));
      const nGrid = gridSide * gridSide;
      const spacingFt = gridSide > 1 ? (state.slabLength / (gridSide - 1)).toFixed(1) : state.slabLength;
      const actualSf = (nGrid * qUltPerPileLbs) / totalLoadLbs;

      return {
        sf,
        qAllowLbs,
        qAllowKips,
        nRequired,
        gridSide,
        nGrid,
        spacingFt,
        actualSf
      };
    });

    const currentSoil = SOIL_PRESETS[state.soilClassKey] || SOIL_PRESETS.stiff_clay;

    return {
      area,
      slabVolume,
      slabWeightLbs,
      slabWeightKips,
      houseWeightLbs,
      houseWeightKips: state.houseWeightKips,
      surchargeTotalLbs,
      surchargeTotalKips,
      totalLoadLbs,
      totalLoadKips,
      avgBearingPressurePsf,
      D,
      zw,
      hDry,
      hSat,
      porePressureU,
      totalStressSigmaV,
      effectiveStressSigmaVPrime,
      Nq,
      Nc,
      helixDiaFt,
      helixArea,
      qUltBearing,
      qUltPerPileLbs,
      qUltPerPileKips,
      sfResults,
      currentSoil
    };
  }

  // Render SVG Cross-Section & Foundation Diagram
  function renderSvgDiagram(res) {
    const svg = document.getElementById('helicalDiagramSvg');
    if (!svg) return;

    const groundY = 140;
    const maxDepth = 60;
    const depthScale = (420 - groundY) / maxDepth; // px per ft

    const waterY = Math.min(420, groundY + (state.waterTableDepth * depthScale));
    const pileY = Math.min(430, groundY + (state.pileDepth * depthScale));

    // Slab dimensions in SVG
    const slabX1 = 120;
    const slabX2 = 520;
    const slabW = slabX2 - slabX1;
    const slabH = Math.max(12, state.slabThickness * 1.5);
    const slabY = groundY - slabH;

    // Surcharge arrow height
    const arrowLen = Math.min(35, Math.max(15, state.surchargePsf / 8));

    // Pore pressure triangle width (0 at waterY, max at pile tip)
    const uMax = res.porePressureU;
    const uWidth = Math.min(100, (uMax / 2500) * 100);

    // Selected SF result for pile visualization
    const activeSfData = res.sfResults.find(r => r.sf === state.selectedSfTab) || res.sfResults[2];
    const numPilesInRow = Math.max(2, Math.min(8, activeSfData.gridSide));

    // Generate Pile shaft lines & helix plates
    let pilesSvg = '';
    for (let i = 0; i < numPilesInRow; i++) {
      const px = slabX1 + 25 + (i * ((slabW - 50) / (numPilesInRow - 1)));
      pilesSvg += `
        <!-- Pile ${i + 1} -->
        <line x1="${px}" y1="${groundY}" x2="${px}" y2="${pileY}" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
        <!-- Helices -->
        <ellipse cx="${px}" cy="${pileY}" rx="${state.helixDiameterInches * 0.7}" ry="3" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
      `;
      if (state.helixCount >= 2) {
        pilesSvg += `<ellipse cx="${px}" cy="${pileY - 20}" rx="${state.helixDiameterInches * 0.65}" ry="3" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>`;
      }
      if (state.helixCount >= 3) {
        pilesSvg += `<ellipse cx="${px}" cy="${pileY - 40}" rx="${state.helixDiameterInches * 0.6}" ry="3" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>`;
      }
    }

    // Surcharge arrows
    let surchargeArrows = '';
    const arrowCount = 9;
    for (let i = 0; i < arrowCount; i++) {
      const ax = slabX1 + 15 + (i * ((slabW - 30) / (arrowCount - 1)));
      const ay1 = slabY - 22;
      const ay2 = slabY - 2;
      surchargeArrows += `
        <line x1="${ax}" y1="${ay1}" x2="${ax}" y2="${ay2}" stroke="#f59e0b" stroke-width="2"/>
        <polygon points="${ax - 3.5},${ay2 - 6} ${ax + 3.5},${ay2 - 6} ${ax},${ay2}" fill="#f59e0b"/>
      `;
    }

    // Soil colors & textures based on current soil
    const soilColor = res.currentSoil.fillColor || '#795548';
    const soilHatchId = res.currentSoil.hatchType || 'clayHatch';

    svg.innerHTML = `
      <defs>
        <marker id="arrowAmber" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
        </marker>
        <marker id="arrowBlue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
        </marker>
        <marker id="arrowRed" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
        
        <!-- Concrete Hatch -->
        <pattern id="concreteHatch" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 0,8 l 8,-8 M -2,2 l 4,-4 M 6,10 l 4,-4" stroke="#94a3b8" stroke-width="0.8" />
        </pattern>
        
        <!-- Sand Hatch -->
        <pattern id="sandHatch" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" fill="#d97706" opacity="0.5"/>
          <circle cx="8" cy="8" r="0.8" fill="#d97706" opacity="0.5"/>
        </pattern>
        
        <!-- Clay Laminations Hatch -->
        <pattern id="clayHatch" width="16" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="4" x2="16" y2="4" stroke="#a1887f" stroke-width="1" stroke-dasharray="8,4" opacity="0.6"/>
        </pattern>

        <!-- Organic Fibers Hatch -->
        <pattern id="organicHatch" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 2,14 Q 8,2 14,14" fill="none" stroke="#271c19" stroke-width="1" opacity="0.7"/>
          <circle cx="4" cy="6" r="1" fill="#3e2723" opacity="0.8"/>
        </pattern>

        <!-- Rocky Bedrock Hatch -->
        <pattern id="rockHatch" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M 0,0 L 9,9 L 18,0 M 9,9 L 9,18" fill="none" stroke="#94a3b8" stroke-width="1.2" opacity="0.5"/>
        </pattern>
      </defs>

      <!-- Background: Dry / Unsaturated Soil Layer -->
      <rect x="20" y="${groundY}" width="600" height="${waterY - groundY}" fill="${soilColor}" fill-opacity="0.35" />
      <rect x="20" y="${groundY}" width="600" height="${waterY - groundY}" fill="url(#${soilHatchId})" />

      <!-- Saturated Soil Layer (Below GWT) -->
      <rect x="20" y="${waterY}" width="600" height="${440 - waterY}" fill="${soilColor}" fill-opacity="0.55" />
      <rect x="20" y="${waterY}" width="600" height="${440 - waterY}" fill="rgba(3, 105, 161, 0.25)" />
      <rect x="20" y="${waterY}" width="600" height="${440 - waterY}" fill="url(#${soilHatchId})" />

      <!-- Groundwater Table Line -->
      <line x1="20" y1="${waterY}" x2="620" y2="${waterY}" stroke="#0284c7" stroke-width="2" stroke-dasharray="6,4" />
      <text x="35" y="${waterY - 6}" fill="#38bdf8" font-size="11" font-weight="700">▼ GWT: ${state.waterTableDepth} ft (γw = 62.4 pcf)</text>

      <!-- Pore Water Pressure Triangle Diagram (Hydrostatic u) -->
      ${res.hSat > 0 ? `
        <polygon points="530,${waterY} 530,${pileY} ${530 + uWidth},${pileY}" fill="rgba(56, 189, 248, 0.35)" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="535" y="${waterY + 16}" fill="#7dd3fc" font-size="10" font-weight="600">Pore Pressure (u)</text>
        <text x="${535 + uWidth / 2}" y="${pileY + 14}" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">u = ${res.porePressureU.toFixed(1)} psf</text>
      ` : `
        <text x="530" y="${groundY + 30}" fill="#94a3b8" font-size="10">u = 0 (Dry)</text>
      `}

      <!-- Ground Surface Line -->
      <line x1="20" y1="${groundY}" x2="620" y2="${groundY}" stroke="#64748b" stroke-width="2" />
      <text x="25" y="${groundY - 6}" fill="#94a3b8" font-size="11" font-weight="600">Ground Surface (z = 0)</text>

      <!-- Helical Piles -->
      ${pilesSvg}

      <!-- Concrete Slab 50' x 50' -->
      <rect x="${slabX1}" y="${slabY}" width="${slabW}" height="${slabH}" fill="#334155" stroke="#94a3b8" stroke-width="1.5" />
      <rect x="${slabX1}" y="${slabY}" width="${slabW}" height="${slabH}" fill="url(#concreteHatch)" />
      <text x="${slabX1 + slabW / 2}" y="${slabY + slabH / 2 + 4}" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">
        50' × 50' Slab (t = ${state.slabThickness}", γc = ${state.concreteUnitWeight} pcf) • W = ${res.slabWeightKips.toFixed(1)} kips
      </text>

      <!-- House Silhouette -->
      <polygon points="${slabX1 + 40},${slabY} ${slabX1 + 40},${slabY - 45} ${slabX1 + slabW / 2},${slabY - 75} ${slabX2 - 40},${slabY - 45} ${slabX2 - 40},${slabY}" fill="rgba(30, 41, 59, 0.85)" stroke="#64748b" stroke-width="1.5"/>
      <text x="${slabX1 + slabW / 2}" y="${slabY - 35}" fill="#f8fafc" font-size="12" font-weight="700" text-anchor="middle">
        🏠 House Dead Load: ${state.houseWeightKips} kips
      </text>

      <!-- House Main Downward Vector -->
      <line x1="${slabX1 + slabW / 2}" y1="${slabY - 70}" x2="${slabX1 + slabW / 2}" y2="${slabY - 6}" stroke="#ef4444" stroke-width="3"/>
      <polygon points="${slabX1 + slabW / 2 - 6},${slabY - 12} ${slabX1 + slabW / 2 + 6},${slabY - 12} ${slabX1 + slabW / 2},${slabY - 2}" fill="#ef4444"/>

      <!-- Surcharge Arrows -->
      ${surchargeArrows}
      <text x="${slabX1 + slabW / 2}" y="${slabY - arrowLen - 6}" fill="#f59e0b" font-size="10" font-weight="700" text-anchor="middle">
        Surcharge q = ${state.surchargePsf} PSF (${res.surchargeTotalKips.toFixed(1)} kips total)
      </text>

      <!-- Pile Depth Dimension Callout -->
      <line x1="95" y1="${groundY}" x2="95" y2="${pileY}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3,3"/>
      <line x1="88" y1="${groundY}" x2="102" y2="${groundY}" stroke="#38bdf8" stroke-width="1.5"/>
      <line x1="88" y1="${pileY}" x2="102" y2="${pileY}" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="80" y="${groundY + (pileY - groundY) / 2 + 4}" fill="#38bdf8" font-size="11" font-weight="700" text-anchor="end">
        D = ${state.pileDepth} ft
      </text>

      <!-- Effective Stress Callout at Bearing Depth -->
      <rect x="150" y="${pileY + 12}" width="340" height="24" rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="#0284c7" stroke-width="1"/>
      <text x="320" y="${pileY + 28}" fill="#38bdf8" font-size="11" font-weight="700" text-anchor="middle">
        σ'v = ${res.effectiveStressSigmaVPrime.toFixed(1)} psf | Qult = ${res.qUltPerPileKips.toFixed(1)} kips/pile (${res.currentSoil.name})
      </text>
    `;
  }

  // Update Dynamic KaTeX Mathematical Derivations
  function updateMathDerivations(res) {
    const container = document.getElementById('helicalMathContainer');
    if (!container) return;

    const activeSf = res.sfResults.find(r => r.sf === state.selectedSfTab) || res.sfResults[2];

    const mathContent = `
      <div class="helical-step-card">
        <h4>1. Total Downward Gravity Load on 50' × 50' Slab</h4>
        <div class="math-block">\\[
          A = 50\\text{ ft} \\times 50\\text{ ft} = 2,500\\text{ ft}^2
        \\]</div>
        <div class="math-block">\\[
          W_{\\text{slab}} = 2,500 \\times \\left(\\frac{${state.slabThickness}}{12}\\right) \\times ${state.concreteUnitWeight} = ${res.slabWeightLbs.toLocaleString()} \\text{ lbs} = ${res.slabWeightKips.toFixed(2)} \\text{ kips}
        \\]</div>
        <div class="math-block">\\[
          P_{\\text{surcharge}} = q \\cdot A = ${state.surchargePsf} \\times 2,500 = ${res.surchargeTotalLbs.toLocaleString()} \\text{ lbs} = ${res.surchargeTotalKips.toFixed(2)} \\text{ kips}
        \\]</div>
        <div class="math-block">\\[
          P_{\\text{total}} = ${res.slabWeightKips.toFixed(2)} + ${state.houseWeightKips} + ${res.surchargeTotalKips.toFixed(2)} = \\mathbf{${res.totalLoadKips.toFixed(2)} \\text{ kips}} \\; (${res.totalLoadLbs.toLocaleString()} \\text{ lbs})
        \\]</div>
      </div>

      <div class="helical-step-card">
        <h4>2. Total Stress, Hydrostatic Pore Water Pressure & Effective Stress (${res.currentSoil.name})</h4>
        <div class="math-block">\\[
          \\sigma_v = q + \\gamma_{\\text{dry}} h_{\\text{dry}} + \\gamma_{\\text{sat}} h_{\\text{sat}} = ${state.surchargePsf} + (${state.soilDryUnitWeight} \\times ${res.hDry}) + (${state.soilSatUnitWeight} \\times ${res.hSat}) = ${res.totalStressSigmaV.toFixed(1)} \\text{ psf}
        \\]</div>
        <div class="math-block">\\[
          u = \\gamma_w \\cdot h_{\\text{sat}} = 62.4 \\times ${res.hSat} = \\mathbf{${res.porePressureU.toFixed(1)} \\text{ psf}}
        \\]</div>
        <div class="math-block">\\[
          \\sigma'_v = \\sigma_v - u = ${res.totalStressSigmaV.toFixed(1)} - ${res.porePressureU.toFixed(1)} = \\mathbf{${res.effectiveStressSigmaVPrime.toFixed(1)} \\text{ psf}}
        \\]</div>
      </div>

      <div class="helical-step-card">
        <h4>3. Helical Pile Ultimate Bearing Capacity (Individual Bearing Method)</h4>
        <div class="math-block">\\[
          A_h = \\frac{\\pi}{4} D_h^2 = \\frac{\\pi}{4} \\left(\\frac{${state.helixDiameterInches}}{12}\\right)^2 = ${res.helixArea.toFixed(3)} \\text{ ft}^2 \\quad (\\text{per helix plate})
        \\]</div>
        <div class="math-block">\\[
          q_{\\text{ult}} = c' N_c + \\sigma'_v N_q = (${state.soilCohesion} \\times ${res.Nc.toFixed(2)}) + (${res.effectiveStressSigmaVPrime.toFixed(1)} \\times ${res.Nq.toFixed(2)}) = ${res.qUltBearing.toFixed(1)} \\text{ psf}
        \\]</div>
        <div class="math-block">\\[
          Q_{\\text{ult}} = n_{\\text{helix}} \\cdot A_h \\cdot q_{\\text{ult}} = ${state.helixCount} \\times ${res.helixArea.toFixed(3)} \\times ${res.qUltBearing.toFixed(1)} = \\mathbf{${res.qUltPerPileKips.toFixed(2)} \\text{ kips/pile}} \\; (${res.qUltPerPileLbs.toLocaleString('en-US', {maximumFractionDigits:0})} \\text{ lbs})
        \\]</div>
      </div>

      <div class="helical-step-card highlight">
        <h4>4. Safety Factor Analysis (Selected SF = ${activeSf.sf})</h4>
        <div class="math-block">\\[
          Q_{\\text{allow}} = \\frac{Q_{\\text{ult}}}{SF} = \\frac{${res.qUltPerPileKips.toFixed(2)}}{${activeSf.sf}} = \\mathbf{${activeSf.qAllowKips.toFixed(2)} \\text{ kips/pile}}
        \\]</div>
        <div class="math-block">\\[
          N_{\\text{req}} = \\left\\lceil \\frac{P_{\\text{total}}}{Q_{\\text{allow}}} \\right\\rceil = \\left\\lceil \\frac{${res.totalLoadKips.toFixed(2)}}{${activeSf.qAllowKips.toFixed(2)}} \\right\\rceil = \\mathbf{${activeSf.nRequired} \\text{ piles}}
        \\]</div>
        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
          Providing a symmetrical <strong>${activeSf.gridSide} × ${activeSf.gridSide} grid (${activeSf.nGrid} total helical piles)</strong> across the 50' × 50' footprint yields an average spacing of <strong>${activeSf.spacingFt} ft on-center</strong> with an actual operating Safety Factor of <strong>${activeSf.actualSf.toFixed(2)}</strong>.
        </p>
      </div>
    `;

    container.innerHTML = mathContent;

    if (window.renderMathInElement) {
      window.renderMathInElement(container, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  }

  // Update SF Matrix comparison cards (SF = 1, 1.5, 2, 3)
  function updateSfCards(res) {
    const cardsContainer = document.getElementById('helicalSfCards');
    if (!cardsContainer) return;

    const sfMeta = {
      1.0: { label: 'Ultimate Limit State', badgeClass: 'badge-danger', desc: 'Failure threshold (No margin)' },
      1.5: { label: 'Extreme Load / Wind', badgeClass: 'badge-warning', desc: 'Temporary combination' },
      2.0: { label: 'Standard Deep Foundation', badgeClass: 'badge-success', desc: 'Recommended IBC / NCEES' },
      3.0: { label: 'Conservative Heavy Duty', badgeClass: 'badge-primary', desc: 'High consequence / weak soil' }
    };

    cardsContainer.innerHTML = res.sfResults.map(r => {
      const meta = sfMeta[r.sf] || { label: `SF ${r.sf}`, badgeClass: 'badge-info', desc: '' };
      const isActive = r.sf === state.selectedSfTab;

      return `
        <div class="helical-sf-card ${isActive ? 'active' : ''}" data-sf="${r.sf}">
          <div class="sf-card-header">
            <span class="sf-num">SF = ${r.sf.toFixed(1)}</span>
            <span class="badge ${meta.badgeClass}">${meta.label}</span>
          </div>
          <div class="sf-card-body">
            <div class="sf-metric">
              <span class="metric-label">Allowable Pile Capacity:</span>
              <strong class="metric-val">${r.qAllowKips.toFixed(1)} kips</strong>
            </div>
            <div class="sf-metric">
              <span class="metric-label">Required Piles:</span>
              <strong class="metric-val primary">${r.nRequired} Piles</strong>
            </div>
            <div class="sf-metric">
              <span class="metric-label">Recommended Grid:</span>
              <span class="metric-sub">${r.gridSide} × ${r.gridSide} (${r.nGrid} piles)</span>
            </div>
            <div class="sf-metric">
              <span class="metric-label">Grid Spacing:</span>
              <span class="metric-sub">${r.spacingFt} ft o.c.</span>
            </div>
          </div>
          <button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'} sf-select-btn" data-sf="${r.sf}">
            ${isActive ? '✓ Active View' : 'Select Layout'}
          </button>
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    cardsContainer.querySelectorAll('.helical-sf-card, .sf-select-btn').forEach(elem => {
      elem.addEventListener('click', (e) => {
        const sf = parseFloat(elem.dataset.sf || elem.closest('.helical-sf-card').dataset.sf);
        if (sf && state.selectedSfTab !== sf) {
          state.selectedSfTab = sf;
          recalculateAndRender();
        }
      });
    });
  }

  // Update Summary KPI indicators
  function updateSummaryKpis(res) {
    document.getElementById('kpiTotalHouseLoad').textContent = `${res.totalLoadKips.toFixed(1)} kips`;
    document.getElementById('kpiPorePressure').textContent = `${res.porePressureU.toFixed(1)} psf`;
    document.getElementById('kpiEffectiveStress').textContent = `${res.effectiveStressSigmaVPrime.toFixed(1)} psf`;
    document.getElementById('kpiUltPileCapacity').textContent = `${res.qUltPerPileKips.toFixed(1)} kips`;
    
    const soilTag = document.getElementById('diagramSoilTypeTag');
    if (soilTag) {
      soilTag.textContent = res.currentSoil.name;
    }
  }

  // Synchronize Soil Spectrum Slider with Presets
  function setSoilBySpectrum(val) {
    state.soilSpectrum = val;
    let chosenKey = 'stiff_clay';

    if (val < 25) {
      chosenKey = val < 15 ? 'organic_peat' : 'organic_silt';
    } else if (val < 65) {
      if (val < 38) chosenKey = 'soft_clay';
      else if (val < 50) chosenKey = 'medium_clay';
      else chosenKey = 'stiff_clay';
    } else if (val < 85) {
      chosenKey = val < 75 ? 'medium_sand' : 'dense_sand';
    } else {
      chosenKey = val < 95 ? 'rocky_till' : 'sound_bedrock';
    }

    applySoilPreset(chosenKey, false);
  }

  function applySoilPreset(key, updateSpectrumSlider = true) {
    const preset = SOIL_PRESETS[key];
    if (!preset) return;

    state.soilClassKey = key;
    state.soilFrictionAngle = preset.phi;
    state.soilCohesion = preset.c;
    state.soilDryUnitWeight = preset.dry;
    state.soilSatUnitWeight = preset.sat;

    const badge = document.getElementById('soilSpectrumBadge');
    if (badge) {
      badge.textContent = preset.label;
      if (preset.typeGroup === 'organic') {
        badge.style.background = 'rgba(120, 53, 15, 0.2)';
        badge.style.color = '#d97706';
      } else if (preset.typeGroup === 'clay') {
        badge.style.background = 'rgba(180, 83, 9, 0.2)';
        badge.style.color = '#f59e0b';
      } else if (preset.typeGroup === 'sand') {
        badge.style.background = 'rgba(234, 179, 8, 0.2)';
        badge.style.color = '#eab308';
      } else if (preset.typeGroup === 'rocky') {
        badge.style.background = 'rgba(56, 189, 248, 0.2)';
        badge.style.color = '#38bdf8';
      }
    }

    const select = document.getElementById('soilPresetSelect');
    if (select && select.value !== key) {
      select.value = key;
    }

    if (updateSpectrumSlider) {
      const slider = document.getElementById('soilSpectrumSlider');
      if (slider) slider.value = preset.spectrumVal;
      state.soilSpectrum = preset.spectrumVal;
    }

    recalculateAndRender();
  }

  // Synchronize All Inputs & Recalculate
  function recalculateAndRender() {
    const res = calculateEngineeringSolution();
    updateSummaryKpis(res);
    renderSvgDiagram(res);
    updateSfCards(res);
    updateMathDerivations(res);
  }

  // Bind UI Controls
  function initControls() {
    // Concrete Unit Weight
    bindSliderAndInput('concreteUnitWeight', 'concreteUnitWeightVal', (val) => {
      state.concreteUnitWeight = parseFloat(val);
    });

    // Slab Thickness
    bindSliderAndInput('slabThickness', 'slabThicknessVal', (val) => {
      state.slabThickness = parseFloat(val);
    });

    // House Weight
    bindSliderAndInput('houseWeight', 'houseWeightVal', (val) => {
      state.houseWeightKips = parseFloat(val);
    });

    // Surcharge
    bindSliderAndInput('surchargePsf', 'surchargePsfVal', (val) => {
      state.surchargePsf = parseFloat(val);
    });

    // Soil Spectrum Slider (Organic -> Clay -> Rocky)
    const spectrumSlider = document.getElementById('soilSpectrumSlider');
    if (spectrumSlider) {
      spectrumSlider.addEventListener('input', (e) => {
        setSoilBySpectrum(parseFloat(e.target.value));
      });
    }

    // Soil Preset Dropdown
    const soilSelect = document.getElementById('soilPresetSelect');
    if (soilSelect) {
      soilSelect.addEventListener('change', (e) => {
        applySoilPreset(e.target.value, true);
      });
    }

    // Water Table Depth
    bindSliderAndInput('waterTableDepth', 'waterTableDepthVal', (val) => {
      state.waterTableDepth = parseFloat(val);
    });

    // Helical Pile Depth
    bindSliderAndInput('pileDepth', 'pileDepthVal', (val) => {
      state.pileDepth = parseFloat(val);
    });

    // Helix Diameter
    bindSliderAndInput('helixDiameter', 'helixDiameterVal', (val) => {
      state.helixDiameterInches = parseFloat(val);
    });

    // Helix Count
    const helixCountSel = document.getElementById('helixCountSelect');
    if (helixCountSel) {
      helixCountSel.addEventListener('change', (e) => {
        state.helixCount = parseInt(e.target.value, 10);
        recalculateAndRender();
      });
    }

    // Quick Concrete Density Presets
    document.querySelectorAll('.concrete-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.density);
        state.concreteUnitWeight = val;
        syncElementValues('concreteUnitWeight', 'concreteUnitWeightVal', val);
        recalculateAndRender();
      });
    });

    // Modal open/close triggers
    const openBtn = document.getElementById('openHelicalCalcBtn');
    if (openBtn) {
      openBtn.addEventListener('click', openHelicalModal);
    }

    const closeBtn = document.getElementById('closeHelicalModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeHelicalModal);
    }

    const modalBackdrop = document.getElementById('helicalCalcModal');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeHelicalModal();
      });
    }
  }

  function bindSliderAndInput(sliderId, textId, callback) {
    const slider = document.getElementById(sliderId);
    const text = document.getElementById(textId);
    if (!slider) return;

    slider.addEventListener('input', (e) => {
      const val = e.target.value;
      if (text) text.textContent = val;
      callback(val);
      recalculateAndRender();
    });
  }

  function syncElementValues(sliderId, textId, val) {
    const slider = document.getElementById(sliderId);
    const text = document.getElementById(textId);
    if (slider) slider.value = val;
    if (text) text.textContent = val;
  }

  function openHelicalModal() {
    const modal = document.getElementById('helicalCalcModal');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    applySoilPreset(state.soilClassKey, false);
  }

  function closeHelicalModal() {
    const modal = document.getElementById('helicalCalcModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Export public API
  window.HelicalCalculator = {
    open: openHelicalModal,
    close: closeHelicalModal,
    setValues: function (newVals) {
      Object.assign(state, newVals);
      recalculateAndRender();
    },
    setSoilPreset: function (presetKey) {
      applySoilPreset(presetKey, true);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initControls();
    applySoilPreset('stiff_clay', true);
  });
})();
