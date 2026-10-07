import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

// Preset Soil Types
const SOIL_PRESETS = {
  medium_sand: {
    name: 'Medium Dense Sand',
    phi: 32,
    c: 0,
    gammaDry: 115,
    gammaSat: 125,
    desc: "Standard bearing sand layer (φ' = 32°, c' = 0)"
  },
  dense_sand: {
    name: 'Dense Sand / Gravel',
    phi: 38,
    c: 0,
    gammaDry: 125,
    gammaSat: 135,
    desc: "High-density granular strata (φ' = 38°, c' = 0)"
  },
  loose_sand: {
    name: 'Loose Fine Sand',
    phi: 28,
    c: 0,
    gammaDry: 105,
    gammaSat: 118,
    desc: "Low-density sand, higher settlement susceptibility (φ' = 28°)"
  },
  stiff_clay: {
    name: 'Stiff Overconsolidated Clay',
    phi: 0,
    c: 1500,
    gammaDry: 110,
    gammaSat: 122,
    desc: "Cohesive undrained bearing layer (c' = 1,500 psf, φ = 0°)"
  },
  custom: {
    name: 'Custom Soil Parameters',
    phi: 30,
    c: 200,
    gammaDry: 115,
    gammaSat: 125,
    desc: "User-defined friction angle and cohesion"
  }
};

// Safety Factor Matrix tiers (1.0, 1.5, 2.0, 3.0) - static reference data
const SF_TIERS = [
  {
    sf: 1.0,
    label: 'SF = 1.0',
    badge: 'Ultimate Limit State',
    subtext: 'Theoretical failure threshold',
    color: 'var(--accent-rose)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
    bgGlow: 'rgba(244, 63, 94, 0.1)'
  },
  {
    sf: 1.5,
    label: 'SF = 1.5',
    badge: 'Wind / Transient Load',
    subtext: 'Temporary load combination',
    color: 'var(--accent-amber)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    bgGlow: 'rgba(245, 158, 11, 0.1)'
  },
  {
    sf: 2.0,
    label: 'SF = 2.0',
    badge: 'Standard Geotechnical',
    subtext: 'NCEES / IBC deep foundation limit',
    color: 'var(--accent-cyan)',
    borderColor: 'rgba(6, 182, 212, 0.4)',
    bgGlow: 'rgba(6, 182, 212, 0.12)'
  },
  {
    sf: 3.0,
    label: 'SF = 3.0',
    badge: 'Conservative High-Safety',
    subtext: 'Heavy settlement-sensitive structure',
    color: 'var(--accent-emerald)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    bgGlow: 'rgba(16, 185, 129, 0.12)'
  }
];

// Color interpolation helper for heat map gradient
function interpolateRgb(c1, c2, factor) {
  const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
  return `rgb(${r}, ${g}, ${b})`;
}

// Multi-stop continuous color mapper for slab moments & soil pressure
function getHeatMapColor(t, isTension = false) {
  if (isTension) {
    return 'rgba(168, 85, 247, 0.9)'; // Vivid Purple for tension uplift zone
  }
  const clamped = Math.max(0, Math.min(1, isNaN(t) ? 0 : t));
  const stops = [
    { t: 0.00, color: [2, 132, 199] },   // Sky / Cyan
    { t: 0.25, color: [16, 185, 129] },  // Emerald
    { t: 0.50, color: [234, 179, 8] },   // Amber
    { t: 0.75, color: [249, 115, 22] },  // Orange
    { t: 1.00, color: [244, 63, 94] }    // Crimson Rose
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].t && clamped <= stops[i + 1].t) {
      const localT = (clamped - stops[i].t) / (stops[i + 1].t - stops[i].t);
      return interpolateRgb(stops[i].color, stops[i + 1].color, localT);
    }
  }
  return `rgb(${stops[stops.length - 1].color.join(',')})`;
}

// Engineering calculation helper for bearing capacity factors
function calculateBearingFactors(phiDeg) {
  if (phiDeg <= 0) {
    return { nq: 1.0, nc: 9.0 }; // Skempton deep plate factor
  }
  const phiRad = (phiDeg * Math.PI) / 180;
  const nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const nc = (nq - 1) / Math.tan(phiRad);
  return { nq, nc };
}

const HelicalHouseVisualizer = ({ problem }) => {
  // Slab & House Load Parameters
  const [slabThicknessInches, setSlabThicknessInches] = useState(8); // inches
  const [concreteDensityPcf, setConcreteDensityPcf] = useState(150); // pcf
  const [houseWeightKips, setHouseWeightKips] = useState(150); // kips
  const [surchargePsf, setSurchargePsf] = useState(50); // psf

  // Geotechnical & Soil Parameters
  const [pileDepthFt, setPileDepthFt] = useState(25); // ft
  const [waterTableDepthFt, setWaterTableDepthFt] = useState(8); // ft
  const [soilKey, setSoilKey] = useState('medium_sand');
  const [customPhi, setCustomPhi] = useState(30);
  const [customC, setCustomC] = useState(0);

  // Soil Boring Report vs Theoretical Bearing Capacity Mode
  const [bearingCapacitySource, setBearingCapacitySource] = useState('theoretical'); // 'theoretical' | 'boring_report'
  const [boringReportQUltKsf, setBoringReportQUltKsf] = useState(45); // ksf from geotechnical boring report

  // Helical Pile Parameters
  const [helixDiameterInches, setHelixDiameterInches] = useState(12); // inches
  const [helixCount, setHelixCount] = useState(1); // 1, 2, or 3 helices per pile

  // Eccentricity & Aerial Heat Map States
  const [eccentricityX, setEccentricityX] = useState(0); // ft (-15 to +15)
  const [eccentricityY, setEccentricityY] = useState(0); // ft (-15 to +15)
  const [heatMapMetric, setHeatMapMetric] = useState('moment'); // 'moment' | 'pressure' | 'pileReaction' | 'quadrant'
  const [subdivisionMode, setSubdivisionMode] = useState('quadrants'); // 'quadrants' | 'sections' | 'mesh'
  const [selectedSectionId, setSelectedSectionId] = useState(null); // 'NW', 'A1', etc.
  const [sectionCardTab, setSectionCardTab] = useState('quadrants'); // 'quadrants' | 'sections'
  const [showPilesOnHeatMap, setShowPilesOnHeatMap] = useState(true);
  const [showKernBoundary, setShowKernBoundary] = useState(true);
  const [showQuadrantDividers, setShowQuadrantDividers] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);

  // UI States
  const [activeTab, setActiveTab] = useState('elevation'); // 'elevation' | 'plan' | 'heatmap' | 'stress'
  const [activeSfFocus, setActiveSfFocus] = useState(2.0); // 1.0, 1.5, 2.0, 3.0
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDerivation, setShowDerivation] = useState(true);

  // Active soil parameters
  const activeSoil = SOIL_PRESETS[soilKey] || SOIL_PRESETS.medium_sand;
  const phi = soilKey === 'custom' ? customPhi : activeSoil.phi;
  const c = soilKey === 'custom' ? customC : activeSoil.c;
  const gammaDry = activeSoil.gammaDry;
  const gammaSat = activeSoil.gammaSat;
  const gammaWater = 62.4; // pcf

  // 1. Slab & Downward Gravity Loads
  const slabSideFt = 50;
  const slabAreaSqFt = slabSideFt * slabSideFt; // 2,500 sq ft
  const slabThicknessFt = slabThicknessInches / 12;
  const slabVolumeCuFt = slabAreaSqFt * slabThicknessFt;
  const slabWeightLbs = slabVolumeCuFt * concreteDensityPcf;
  const slabWeightKips = slabWeightLbs / 1000;
  const surchargeTotalKips = (surchargePsf * slabAreaSqFt) / 1000;
  const totalDownwardLoadKips = slabWeightKips + houseWeightKips + surchargeTotalKips;
  const grossSoilPressurePsf = (totalDownwardLoadKips * 1000) / slabAreaSqFt;

  // 2. Overburden Stresses & Pore Water Pressure at Bearing Depth D
  const depthAboveGwt = Math.min(pileDepthFt, waterTableDepthFt);
  const depthBelowGwt = Math.max(0, pileDepthFt - waterTableDepthFt);

  // Total vertical stress at depth D
  const sigmaV_soil = (gammaDry * depthAboveGwt) + (gammaSat * depthBelowGwt);
  const sigmaV = surchargePsf + sigmaV_soil;

  // Hydrostatic pore water pressure at depth D
  const porePressureU = depthBelowGwt * gammaWater;

  // Effective vertical stress at depth D
  const sigmaPrimeV = sigmaV - porePressureU;

  // 3. Helical Pile Bearing Capacity
  const { nq, nc } = useMemo(() => calculateBearingFactors(phi), [phi]);
  const helixDiameterFt = helixDiameterInches / 12;
  const helixAreaSqFt = (Math.PI / 4) * Math.pow(helixDiameterFt, 2);

  // Theoretical unit bearing capacity q_ult
  const qUltTheoreticalPsf = (c * nc) + (sigmaPrimeV * nq);
  const qUltTheoreticalKsf = qUltTheoreticalPsf / 1000;

  // Active unit bearing capacity q_ult based on source
  const isBoringReport = bearingCapacitySource === 'boring_report';
  const qUltPsf = isBoringReport ? (boringReportQUltKsf * 1000) : qUltTheoreticalPsf;
  const qUltKsf = qUltPsf / 1000;

  // Ultimate pile compressive capacity Q_ult (kips)
  const singleHelixUltKips = (helixAreaSqFt * qUltPsf) / 1000;
  const pileUltCapacityKips = singleHelixUltKips * helixCount;

  // Impact comparison between Boring Report and Theoretical model
  const capacityDiffPercent = qUltTheoreticalKsf > 0 
    ? (((qUltKsf - qUltTheoreticalKsf) / qUltTheoreticalKsf) * 100)
    : 0;

  // 4. Safety Factor Matrix (1.0, 1.5, 2.0, 3.0)
  const sfMatrixResults = useMemo(() => {
    return SF_TIERS.map(tier => {
      const qAllow = pileUltCapacityKips / tier.sf;
      const nReq = Math.ceil(totalDownwardLoadKips / Math.max(qAllow, 0.001));
      // Grid sizing: k x k square grid where k >= ceil(sqrt(nReq))
      const k = Math.max(2, Math.ceil(Math.sqrt(nReq)));
      const nInstalled = k * k;
      const spacingFt = (slabSideFt / (k - 1)).toFixed(1);
      const operatingSf = (nInstalled * pileUltCapacityKips) / Math.max(totalDownwardLoadKips, 0.001);

      return {
        ...tier,
        qAllow: qAllow.toFixed(1),
        nReq,
        gridK: k,
        nInstalled,
        spacingFt,
        operatingSf: operatingSf.toFixed(2)
      };
    });
  }, [pileUltCapacityKips, totalDownwardLoadKips]);

  // Selected SF grid configuration for visualization
  const activeGrid = useMemo(() => {
    const found = sfMatrixResults.find(r => r.sf === activeSfFocus);
    return found || sfMatrixResults[2]; // Default to SF = 2.0
  }, [sfMatrixResults, activeSfFocus]);

  // 5. Eccentricity, Biaxial Overturning Moments & Geotechnical Contact Pressures
  const eccentricityResults = useMemo(() => {
    const ex = eccentricityX;
    const ey = eccentricityY;
    const eMag = Math.hypot(ex, ey);
    const P = totalDownwardLoadKips;

    // Overturning Moments on 50' foundation (kip-ft)
    const Mx = P * ey; // Moment about X-axis causing N-S inclination
    const My = P * ex; // Moment about Y-axis causing E-W inclination
    const Mres = Math.hypot(Mx, My);

    // Kern Boundary limit for 50' x 50' square slab (Middle-Third Rule)
    // Diamond boundary: |ex|/(B/6) + |ey|/(L/6) <= 1
    const kernLimit = slabSideFt / 6; // 8.333 ft
    const kernRatio = (Math.abs(ex) + Math.abs(ey)) / kernLimit;
    const isUplift = kernRatio > 1.0001;

    // Contact Bearing Pressure (psf) at (x, y) relative to slab center (-25 to +25 ft)
    // q(x, y) = (P * 1000 / 2500) * (1 + 12*ex*x/2500 + 12*ey*y/2500)
    const qAvgPsf = (P * 1000) / slabAreaSqFt;
    const calcQ = (x, y) => {
      return qAvgPsf * (1 + (12 * ex * x) / (slabSideFt * slabSideFt) + (12 * ey * y) / (slabSideFt * slabSideFt));
    };

    // Four corner pressures (psf)
    const qNE = calcQ(25, 25);
    const qNW = calcQ(-25, 25);
    const qSW = calcQ(-25, -25);
    const qSE = calcQ(25, -25);

    const qMax = Math.max(qNE, qNW, qSW, qSE);
    const qMin = Math.min(qNE, qNW, qSW, qSE);

    // Helical Pile Group Reactions for activeGrid (k x k)
    const k = activeGrid.gridK;
    const spacing = Number(activeGrid.spacingFt);
    const qAllow = Number(activeGrid.qAllow);

    // Coordinate positions for helical piles in 50' slab (2.5' edge setback)
    const edgeMargin = 2.5;
    const pileSpan = slabSideFt - 2 * edgeMargin;
    const pileStep = k > 1 ? pileSpan / (k - 1) : 0;

    let sumX2 = 0;
    let sumY2 = 0;
    const rawPiles = [];

    for (let r = 0; r < k; r++) {
      for (let c = 0; c < k; c++) {
        const pxFt = -25 + edgeMargin + c * pileStep;
        const pyFt = 25 - edgeMargin - r * pileStep;
        sumX2 += pxFt * pxFt;
        sumY2 += pyFt * pyFt;
        rawPiles.push({ r, c, pxFt, pyFt });
      }
    }

    const nPiles = rawPiles.length;
    let maxPileR = -Infinity;
    let minPileR = Infinity;
    let overloadedCount = 0;
    let tensionPileCount = 0;

    const evaluatedPiles = rawPiles.map(p => {
      // Elastic pile reaction from rigid slab theory
      const rVal = (P / nPiles) + (My * p.pxFt) / Math.max(1, sumX2) + (Mx * p.pyFt) / Math.max(1, sumY2);
      if (rVal > maxPileR) maxPileR = rVal;
      if (rVal < minPileR) minPileR = rVal;
      if (rVal > qAllow) overloadedCount++;
      if (rVal < 0) tensionPileCount++;
      return {
        ...p,
        reactionKips: rVal,
        isOverloaded: rVal > qAllow,
        isTension: rVal < 0
      };
    });

    // Concrete Slab Flexural Bending Moments (ACI 318 strip analysis)
    // Cracking Moment Mcr = 0.07906 * t^2 (kip-ft/ft) for f'c = 4000 psi
    const mCracking = 0.07906 * Math.pow(slabThicknessInches, 2);
    const phiMn = 1.4 * Math.max(1, slabThicknessInches - 2.75); // approx design capacity w/ #5 @ 12"

    const calcM = (x, y) => {
      const qLocal = calcQ(x, y);
      const mSpan = (Math.abs(qLocal) / 1000) * (Math.pow(spacing, 2) / 10);
      const mOverturn = (0.12 * Mres / slabSideFt) * (0.6 + 0.4 * (Math.abs(x * ex + y * ey) / Math.max(1, 25 * Math.max(1, eMag))));
      return mSpan + mOverturn;
    };

    const maxSlabMoment = Math.max(calcM(25, 25), calcM(-25, 25), calcM(-25, -25), calcM(25, -25));
    const isCracking = maxSlabMoment > mCracking;
    const isFlexuralOverload = maxSlabMoment > phiMn;

    // 4 Quadrants Analysis (NW: Q2, NE: Q1, SW: Q3, SE: Q4)
    const quadConfigs = [
      { id: 'NW', name: 'North-West (Q2)', cx: -12.5, cy: 12.5, color: '#38bdf8' },
      { id: 'NE', name: 'North-East (Q1)', cx: 12.5, cy: 12.5, color: '#10b981' },
      { id: 'SW', name: 'South-West (Q3)', cx: -12.5, cy: -12.5, color: '#f59e0b' },
      { id: 'SE', name: 'South-East (Q4)', cx: 12.5, cy: -12.5, color: '#a855f7' }
    ];

    const quadrants = quadConfigs.map(q => {
      const qAvg = calcQ(q.cx, q.cy);
      const quadLoadKips = (qAvg * 625) / 1000;
      const loadPct = P > 0 ? (quadLoadKips / P) * 100 : 25;
      const cornerM = calcM(q.cx > 0 ? 25 : -25, q.cy > 0 ? 25 : -25);

      const quadPiles = evaluatedPiles.filter(p => {
        const matchX = q.cx > 0 ? p.pxFt >= 0 : p.pxFt < 0;
        const matchY = q.cy > 0 ? p.pyFt >= 0 : p.pyFt < 0;
        return matchX && matchY;
      });

      const maxQuadPileR = quadPiles.length > 0 ? Math.max(...quadPiles.map(p => p.reactionKips)) : 0;
      const hasUplift = calcQ(q.cx > 0 ? 25 : -25, q.cy > 0 ? 25 : -25) < 0;
      const hasPileOverload = maxQuadPileR > qAllow;

      let status = 'safe';
      if (hasUplift || hasPileOverload) status = 'critical';
      else if (cornerM > mCracking || loadPct > 36) status = 'warning';

      return {
        ...q,
        qAvgPsf: qAvg,
        loadKips: quadLoadKips,
        loadPct,
        peakMoment: cornerM,
        maxPileReaction: maxQuadPileR,
        pileCount: quadPiles.length,
        status,
        hasUplift,
        hasPileOverload
      };
    });

    // 16 Structural Bays / Sections Analysis (4 x 4 grid: A1 to D4)
    // Columns A: [-25, -12.5], B: [-12.5, 0], C: [0, 12.5], D: [12.5, 25]
    // Rows 1 (North): [12.5, 25], 2: [0, 12.5], 3: [-12.5, 0], 4 (South): [-25, -12.5]
    const colNames = ['A', 'B', 'C', 'D'];
    const rowNames = ['1', '2', '3', '4'];
    const baySideFt = 12.5;
    const bayAreaSqFt = baySideFt * baySideFt; // 156.25 sq ft

    const sections16 = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const id = `${colNames[c]}${rowNames[r]}`;
        const xMin = -25 + c * baySideFt;
        const xMax = xMin + baySideFt;
        const yMax = 25 - r * baySideFt;
        const yMin = yMax - baySideFt;
        const cx = (xMin + xMax) / 2;
        const cy = (yMin + yMax) / 2;

        let quadId = 'NE';
        if (cx < 0 && cy >= 0) quadId = 'NW';
        else if (cx < 0 && cy < 0) quadId = 'SW';
        else if (cx >= 0 && cy < 0) quadId = 'SE';

        const qAvg = calcQ(cx, cy);
        const bayLoadKips = (qAvg * bayAreaSqFt) / 1000;
        const loadPct = P > 0 ? (bayLoadKips / P) * 100 : (100 / 16);
        const peakMoment = Math.max(calcM(xMin, yMin), calcM(xMax, yMin), calcM(xMin, yMax), calcM(xMax, yMax));
        const centerMoment = calcM(cx, cy);

        // Helical piles situated in this bay
        const bayPiles = evaluatedPiles.filter(p => (
          p.pxFt >= xMin - 0.05 && p.pxFt <= xMax + 0.05 &&
          p.pyFt >= yMin - 0.05 && p.pyFt <= yMax + 0.05
        ));

        const maxPileR = bayPiles.length > 0 ? Math.max(...bayPiles.map(p => p.reactionKips)) : 0;
        const minPileR = bayPiles.length > 0 ? Math.min(...bayPiles.map(p => p.reactionKips)) : 0;
        const hasUplift = qAvg < 0 || minPileR < 0;
        const hasPileOverload = maxPileR > qAllow;
        const isCrackingBay = peakMoment > mCracking;

        let status = 'safe';
        if (hasUplift || hasPileOverload) status = 'critical';
        else if (isCrackingBay || loadPct > 10.5) status = 'warning';

        sections16.push({
          id,
          colIdx: c,
          rowIdx: r,
          colLetter: colNames[c],
          rowNumber: rowNames[r],
          name: `Bay ${id}`,
          quadId,
          cx,
          cy,
          xMin,
          xMax,
          yMin,
          yMax,
          tributaryArea: '156.25 sq ft (12.5′ × 12.5′)',
          qAvgPsf: qAvg,
          loadKips: bayLoadKips,
          loadPct,
          peakMoment,
          centerMoment,
          pileCount: bayPiles.length,
          bayPiles,
          maxPileReaction: maxPileR,
          minPileReaction: minPileR,
          hasUplift,
          hasPileOverload,
          isCracking: isCrackingBay,
          status
        });
      }
    }

    // Engineering Issue Diagnosis
    const issues = [];
    if (isUplift) {
      issues.push({
        id: 'uplift',
        level: 'critical',
        badge: 'Tension Uplift',
        color: 'var(--accent-rose)',
        title: 'Middle-Third Kern Exceeded: Foundation Uplift Separation',
        desc: `Resultant eccentricity e = ${eMag.toFixed(1)}′ (ex = ${ex}′, ey = ${ey}′) exceeds the Middle-Third Kern boundary (${(slabSideFt / 6).toFixed(2)}′). Negative soil contact pressure (qmin = ${qMin.toFixed(0)} psf) causes edge liftoff in the opposite quadrant. Standard compression helical piles cannot resist tension without engineered tie-down anchors!`
      });
    }
    if (overloadedCount > 0) {
      issues.push({
        id: 'pile_overload',
        level: 'critical',
        badge: 'Bearing Overload',
        color: 'var(--accent-rose)',
        title: `${overloadedCount} Helical Pile(s) Exceed Allowable Capacity`,
        desc: `Peak reaction Rmax = ${maxPileR.toFixed(1)} kips exceeds Qallow = ${qAllow.toFixed(1)} kips by ${((maxPileR / qAllow - 1) * 100).toFixed(0)}%. Highly stressed corner/edge piles will suffer settlement punch-in under sustained load.`
      });
    }
    if (isCracking) {
      issues.push({
        id: 'cracking',
        level: 'warning',
        badge: 'Cracking Threshold',
        color: 'var(--accent-amber)',
        title: 'Slab Bending Moments Exceed Plain Concrete Cracking Limit',
        desc: `Peak flexural moment Mmax = ${maxSlabMoment.toFixed(2)} kip-ft/ft exceeds the plain concrete cracking moment Mcr = ${mCracking.toFixed(2)} kip-ft/ft for a ${slabThicknessInches}″ slab. Top/bottom Grade 60 rebar spacing must be designed to arrest diagonal tension cracks.`
      });
    }

    const maxQuad = quadrants.reduce((prev, curr) => (curr.loadPct > prev.loadPct ? curr : prev), quadrants[0]);
    if (maxQuad.loadPct > 38) {
      issues.push({
        id: 'disparity',
        level: 'warning',
        badge: 'Load Disparity',
        color: 'var(--accent-amber)',
        title: `Severe Quadrant Load Concentration in ${maxQuad.id}`,
        desc: `${maxQuad.name} carries ${maxQuad.loadPct.toFixed(1)}% of total foundation gravity load (${maxQuad.loadKips.toFixed(1)} kips vs ${(P / 4).toFixed(1)} kips balanced), inducing angular tilt across the 50 ft span.`
      });
    }

    return {
      ex,
      ey,
      eMag,
      Mx,
      My,
      Mres,
      kernLimit,
      kernRatio,
      isUplift,
      calcQ,
      qMax,
      qMin,
      qAvgPsf,
      mCracking,
      phiMn,
      calcM,
      maxSlabMoment,
      isCracking,
      isFlexuralOverload,
      evaluatedPiles,
      maxPileR,
      minPileR,
      overloadedCount,
      tensionPileCount,
      quadrants,
      sections16,
      issues
    };
  }, [
    eccentricityX,
    eccentricityY,
    totalDownwardLoadKips,
    slabSideFt,
    slabAreaSqFt,
    activeGrid,
    slabThicknessInches
  ]);

  // 6. High-Resolution Heat Map Mesh Cells & Colorized Sections/Quadrants
  const heatMapCells = useMemo(() => {
    const N = 16;
    const stepFt = slabSideFt / N; // 3.125 ft
    const cells = [];
    const { calcQ, calcM, qMin, qMax, maxSlabMoment, mCracking, evaluatedPiles } = eccentricityResults;

    const minMoment = 0;
    const maxMoment = Math.max(mCracking * 1.4, maxSlabMoment * 1.05, 0.1);
    const minQ = Math.min(0, qMin);
    const maxQ = Math.max(Number(activeGrid.qAllow) * 12, qMax * 1.05, 100);
    const qAllow = Number(activeGrid.qAllow);

    const getMetricColor = ({ momentVal, qVal, rVal, pctVal, isTension }) => {
      if (heatMapMetric === 'moment') {
        const t = (momentVal - minMoment) / (maxMoment - minMoment);
        return getHeatMapColor(t, false);
      } else if (heatMapMetric === 'pressure') {
        if (isTension || qVal < 0) return 'rgba(168, 85, 247, 0.85)';
        const t = qVal / Math.max(1, maxQ);
        return getHeatMapColor(t, false);
      } else if (heatMapMetric === 'pileReaction') {
        if (rVal < 0) return 'rgba(168, 85, 247, 0.85)';
        const t = rVal / Math.max(1, qAllow * 1.25);
        return getHeatMapColor(t, false);
      } else if (heatMapMetric === 'quadrant') {
        const base = pctVal > 15 ? 25 : 6.25;
        const scale = pctVal > 15 ? 20 : 7;
        const t = Math.max(0, Math.min(1, 0.5 + (pctVal - base) / scale));
        return getHeatMapColor(t, false);
      }
      return '#0284c7';
    };

    // Colorize 4 Quadrants
    const coloredQuadrants = eccentricityResults.quadrants.map(q => ({
      ...q,
      color: getMetricColor({
        momentVal: q.peakMoment,
        qVal: q.qAvgPsf,
        rVal: q.maxPileReaction,
        pctVal: q.loadPct,
        isTension: q.hasUplift
      })
    }));

    // Colorize 16 Structural Bays / Sections
    const coloredSections16 = eccentricityResults.sections16.map(s => ({
      ...s,
      color: getMetricColor({
        momentVal: s.peakMoment,
        qVal: s.qAvgPsf,
        rVal: s.maxPileReaction,
        pctVal: s.loadPct,
        isTension: s.hasUplift
      })
    }));

    // 256 Mesh Cells
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const xFt = -25 + (c + 0.5) * stepFt;
        const yFt = 25 - (r + 0.5) * stepFt;
        const qVal = calcQ(xFt, yFt);
        const mVal = calcM(xFt, yFt);

        let quadId = 'NE';
        if (xFt < 0 && yFt >= 0) quadId = 'NW';
        else if (xFt < 0 && yFt < 0) quadId = 'SW';
        else if (xFt >= 0 && yFt < 0) quadId = 'SE';

        // Find nearest pile for reaction HUD
        let nearestPile = evaluatedPiles[0];
        let minDist = Infinity;
        for (let i = 0; i < evaluatedPiles.length; i++) {
          const d = Math.hypot(evaluatedPiles[i].pxFt - xFt, evaluatedPiles[i].pyFt - yFt);
          if (d < minDist) {
            minDist = d;
            nearestPile = evaluatedPiles[i];
          }
        }

        const isTension = qVal < 0;
        const cellColor = getMetricColor({
          momentVal: mVal,
          qVal,
          rVal: nearestPile ? nearestPile.reactionKips : 0,
          pctVal: 25,
          isTension
        });

        cells.push({
          r,
          c,
          xFt,
          yFt,
          qVal,
          mVal,
          quadId,
          color: cellColor,
          isTension,
          nearestPileReaction: nearestPile ? nearestPile.reactionKips : 0
        });
      }
    }
    return {
      cells,
      coloredQuadrants,
      coloredSections16,
      minMoment,
      maxMoment,
      minQ,
      maxQ
    };
  }, [slabSideFt, eccentricityResults, heatMapMetric, activeGrid]);

  // Selected Section Object (Quadrant or 16-Bay Section)
  const selectedSection = useMemo(() => {
    if (!selectedSectionId) return null;
    return (
      heatMapCells.coloredSections16.find(s => s.id === selectedSectionId) ||
      heatMapCells.coloredQuadrants.find(q => q.id === selectedSectionId) ||
      null
    );
  }, [selectedSectionId, heatMapCells]);

  // Preset Scenario Handlers
  const applyPreset = (presetKey) => {
    if (presetKey === 'standard') {
      setSlabThicknessInches(8);
      setConcreteDensityPcf(150);
      setHouseWeightKips(150);
      setSurchargePsf(50);
      setPileDepthFt(25);
      setWaterTableDepthFt(8);
      setHelixDiameterInches(12);
      setHelixCount(1);
      setSoilKey('medium_sand');
      setBearingCapacitySource('theoretical');
      setEccentricityX(0);
      setEccentricityY(0);
    } else if (presetKey === 'boring_dense') {
      // Direct soil boring report: Dense bearing sand q_ult = 60 ksf
      setSlabThicknessInches(8);
      setConcreteDensityPcf(150);
      setHouseWeightKips(150);
      setSurchargePsf(50);
      setPileDepthFt(25);
      setWaterTableDepthFt(8);
      setHelixDiameterInches(12);
      setHelixCount(1);
      setBearingCapacitySource('boring_report');
      setBoringReportQUltKsf(60);
      setEccentricityX(0);
      setEccentricityY(0);
    } else if (presetKey === 'prob54') {
      // Problem 54 profile: House surcharge = 300 psf, Water table at 8 ft, Clay layer at 10-20 ft
      setSlabThicknessInches(6);
      setConcreteDensityPcf(150);
      setHouseWeightKips(100);
      setSurchargePsf(300); // 300 psf house footprint load
      setPileDepthFt(20);
      setWaterTableDepthFt(8);
      setHelixDiameterInches(14);
      setHelixCount(1);
      setSoilKey('stiff_clay');
      setBearingCapacitySource('theoretical');
      setEccentricityX(0);
      setEccentricityY(0);
    } else if (presetKey === 'high_water') {
      setSlabThicknessInches(10);
      setConcreteDensityPcf(150);
      setHouseWeightKips(180);
      setSurchargePsf(50);
      setPileDepthFt(30);
      setWaterTableDepthFt(2);
      setHelixDiameterInches(14);
      setHelixCount(2);
      setSoilKey('loose_sand');
      setBearingCapacitySource('theoretical');
      setEccentricityX(0);
      setEccentricityY(0);
    } else if (presetKey === 'heavy_residence') {
      setSlabThicknessInches(12);
      setConcreteDensityPcf(150);
      setHouseWeightKips(350);
      setSurchargePsf(80);
      setPileDepthFt(35);
      setWaterTableDepthFt(12);
      setHelixDiameterInches(16);
      setHelixCount(2);
      setSoilKey('dense_sand');
      setBearingCapacitySource('theoretical');
      setEccentricityX(5);
      setEccentricityY(4);
    } else if (presetKey === 'uplift_hazard') {
      setSlabThicknessInches(8);
      setConcreteDensityPcf(150);
      setHouseWeightKips(200);
      setSurchargePsf(60);
      setPileDepthFt(25);
      setWaterTableDepthFt(8);
      setHelixDiameterInches(12);
      setHelixCount(1);
      setSoilKey('medium_sand');
      setBearingCapacitySource('theoretical');
      setEccentricityX(11);
      setEccentricityY(10);
      setActiveTab('heatmap');
    }
  };

  // Main UI Content Body
  const visualizerContent = (
    <div className="helical-visualizer" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Header Bar with Presets & Fullscreen */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem 1.25rem',
        background: 'var(--bg-card)',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        backdropFilter: 'var(--glass-blur)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            fontSize: '1.5rem',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px'
          }}>
            🏗️
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              50′ × 50′ House Slab & Helical Pile Calculator
            </h3>
            <span className="text-xs text-muted">
              Deep Foundation Geotechnical Sizing, Soil Boring Reports & Hydrostatic Stress Engine
            </span>
          </div>
        </div>

        {/* Quick Presets & Fullscreen Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Presets:</span>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('standard')}
          >
            Baseline PE Standard
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderColor: 'rgba(16, 185, 129, 0.4)', color: 'var(--accent-emerald)' }}
            onClick={() => applyPreset('boring_dense')}
          >
            📑 Boring Report (60 ksf)
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('prob54')}
          >
            Problem #54 Profile
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('high_water')}
          >
            High Water Table (2′)
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => applyPreset('heavy_residence')}
          >
            Heavy 2-Story (350k)
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--accent-rose)' }}
            onClick={() => applyPreset('uplift_hazard')}
          >
            🚨 Tension Uplift (11′, 10′)
          </button>

          <button
            className="btn-secondary"
            style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', marginLeft: '0.5rem', color: isFullscreen ? 'var(--accent-rose)' : 'var(--text-main)' }}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? "✕ Close" : "⛶ Fullscreen"}
          </button>
        </div>
      </div>

      {/* 4-Tier Safety Factor Matrix Comparison Cards (SF = 1.0, 1.5, 2.0, 3.0) */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📊</span> Foundation Sizing & Safety Factor Matrix
            {isBoringReport && (
              <span className="glass-badge" style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                📑 Driven by Soil Boring Log (qult = {boringReportQUltKsf} ksf)
              </span>
            )}
          </h4>
          <span className="text-xs text-muted">Click any card to inspect its {activeGrid.gridK}×{activeGrid.gridK} plan layout below</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {sfMatrixResults.map((item) => {
            const isSelected = activeSfFocus === item.sf;
            return (
              <div
                key={item.sf}
                onClick={() => setActiveSfFocus(item.sf)}
                style={{
                  cursor: 'pointer',
                  padding: '1.25rem 1rem',
                  borderRadius: '12px',
                  background: isSelected ? item.bgGlow : 'var(--bg-card)',
                  border: `2px solid ${isSelected ? item.color : item.borderColor}`,
                  boxShadow: isSelected ? `0 0 20px ${item.bgGlow}` : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.05rem',
                    color: item.color
                  }}>
                    {item.label}
                  </span>
                  <span className="glass-badge" style={{ fontSize: '0.65rem', borderColor: item.borderColor, color: item.color }}>
                    {item.badge}
                  </span>
                </div>

                <div className="text-xs text-muted" style={{ lineHeight: 1.3 }}>
                  {item.subtext}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Allowable Cap (Qallow):</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>{item.qAllow} kips</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Min Piles Req (Nreq):</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: item.color }}>{item.nReq} piles</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Foundation Grid:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{item.gridK} × {item.gridK} ({item.nInstalled})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">On-Center Spacing:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>{item.spacingFt} ft O.C.</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span className="text-muted">Actual Operating SF:</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: Number(item.operatingSf) >= item.sf ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {item.operatingSf}
                    </strong>
                  </div>
                </div>

                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '12px',
                    background: item.color,
                    color: '#000',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    letterSpacing: '0.04em'
                  }}>
                    ACTIVE VIEW
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Dual-Column Interactive Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1.15fr) minmax(380px, 1.85fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column: Real-Time Input Controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '1.5rem',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          backdropFilter: 'var(--glass-blur)'
        }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-cyan)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🎛️</span> Parametric Controls
          </h4>

          {/* Section A: Superstructure & Concrete Slab */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-blue)' }}>
              1. House Superstructure & Slab Loads
            </span>

            {/* Slab Thickness Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Slab Thickness (tslab):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{slabThicknessInches} inches ({(slabThicknessFt).toFixed(2)} ft)</strong>
              </div>
              <input
                type="range"
                min="4"
                max="24"
                step="1"
                value={slabThicknessInches}
                onChange={(e) => setSlabThicknessInches(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>

            {/* Concrete Unit Weight */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Concrete Density (γc):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{concreteDensityPcf} pcf</strong>
              </div>
              <input
                type="range"
                min="110"
                max="165"
                step="5"
                value={concreteDensityPcf}
                onChange={(e) => setConcreteDensityPcf(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                  onClick={() => setConcreteDensityPcf(115)}
                >
                  Lightweight (115)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                  onClick={() => setConcreteDensityPcf(150)}
                >
                  Normal (150)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                  onClick={() => setConcreteDensityPcf(160)}
                >
                  Heavy (160)
                </button>
              </div>
            </div>

            {/* House Superstructure Weight */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">House Superstructure Load (Whouse):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>{houseWeightKips} kips</strong>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={houseWeightKips}
                onChange={(e) => setHouseWeightKips(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
              />
            </div>

            {/* Surface Surcharge / Live Load */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Surface Live Surcharge (qsurcharge):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{surchargePsf} psf ({(surchargeTotalKips).toFixed(1)} kips)</strong>
              </div>
              <input
                type="range"
                min="0"
                max="300"
                step="10"
                value={surchargePsf}
                onChange={(e) => setSurchargePsf(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
              />
            </div>

            {/* Total Load Summary Callout */}
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '10px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Slab Dead Weight:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{slabWeightKips.toFixed(1)} kips</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Total Downward Ptotal:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontSize: '0.95rem' }}>
                  {totalDownwardLoadKips.toFixed(1)} kips
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>Gross Contact Pressure:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{grossSoilPressurePsf.toFixed(0)} psf</span>
              </div>
            </div>
          </div>

          {/* Section B: Geotechnical Strata & Water Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              2. Soil Strata & Groundwater
            </span>

            {/* Soil Preset Selector */}
            <div>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.35rem' }}>Soil Stratum Classification:</span>
              <select
                value={soilKey}
                onChange={(e) => setSoilKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem'
                }}
              >
                {Object.entries(SOIL_PRESETS).map(([key, item]) => (
                  <option key={key} value={key} style={{ background: '#0b1120', color: '#fff' }}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Soil Controls if selected */}
            {soilKey === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span className="text-xs text-muted">Friction φ′: {customPhi}°</span>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="1"
                    value={customPhi}
                    onChange={(e) => setCustomPhi(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
                <div>
                  <span className="text-xs text-muted">Cohesion c′: {customC} psf</span>
                  <input
                    type="range"
                    min="0"
                    max="3000"
                    step="100"
                    value={customC}
                    onChange={(e) => setCustomC(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
              </div>
            )}

            {/* Groundwater Table Depth */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Water Table Depth (zgw):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{waterTableDepthFt} ft</strong>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={waterTableDepthFt}
                onChange={(e) => setWaterTableDepthFt(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#38bdf8' }}
              />
            </div>

            {/* Helical Pile Embedment Depth D */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Helical Embedment Depth (D):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>{pileDepthFt} ft</strong>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="1"
                value={pileDepthFt}
                onChange={(e) => setPileDepthFt(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
              />
            </div>

            {/* Stress State Callout */}
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: '10px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Total Vertical Stress (σv):</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{sigmaV.toFixed(1)} psf</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Pore Water Pressure (u):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{porePressureU.toFixed(1)} psf</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Effective Stress (σv′):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                  {sigmaPrimeV.toFixed(1)} psf
                </strong>
              </div>
            </div>
          </div>

          {/* Section C: Bearing Capacity Determination Source & Soil Boring Report Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-purple)' }}>
              3. Soil Bearing Capacity Source (Boring Report vs Theoretical)
            </span>

            {/* Mode Selection Buttons */}
            <div>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.45rem' }}>
                Select Bearing Capacity Method:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    background: bearingCapacitySource === 'theoretical' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.04)',
                    borderColor: bearingCapacitySource === 'theoretical' ? 'var(--accent-cyan)' : 'var(--border-color)',
                    color: bearingCapacitySource === 'theoretical' ? 'var(--accent-cyan)' : 'var(--text-main)',
                    fontWeight: bearingCapacitySource === 'theoretical' ? 700 : 500
                  }}
                  onClick={() => setBearingCapacitySource('theoretical')}
                >
                  📐 Theoretical (φ′, c′, σv′)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    background: bearingCapacitySource === 'boring_report' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                    borderColor: bearingCapacitySource === 'boring_report' ? 'var(--accent-emerald)' : 'var(--border-color)',
                    color: bearingCapacitySource === 'boring_report' ? 'var(--accent-emerald)' : 'var(--text-main)',
                    fontWeight: bearingCapacitySource === 'boring_report' ? 700 : 500
                  }}
                  onClick={() => setBearingCapacitySource('boring_report')}
                >
                  📑 Soil Boring Report (qult)
                </button>
              </div>
            </div>

            {/* Boring Report Interactive Controls */}
            {isBoringReport ? (
              <div style={{
                padding: '0.85rem 1rem',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span className="text-muted">Reported Ultimate Bearing (qult):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontSize: '1rem' }}>
                    {boringReportQUltKsf} ksf ({(boringReportQUltKsf * 1000).toLocaleString()} psf)
                  </strong>
                </div>

                <input
                  type="range"
                  min="5"
                  max="150"
                  step="1"
                  value={boringReportQUltKsf}
                  onChange={(e) => setBoringReportQUltKsf(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
                />

                {/* Quick Presets from Typical Geotechnical Boring Logs */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => setBoringReportQUltKsf(20)}
                  >
                    Soft Silt (20 ksf)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => setBoringReportQUltKsf(35)}
                  >
                    Med Sand (35 ksf)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => setBoringReportQUltKsf(60)}
                  >
                    Dense Sand (60 ksf)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => setBoringReportQUltKsf(90)}
                  >
                    Glacial Till (90 ksf)
                  </button>
                </div>

                {/* Engineering Impact Explanation Callout */}
                <div style={{
                  fontSize: '0.78rem',
                  lineHeight: 1.4,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderLeft: `3px solid ${capacityDiffPercent >= 0 ? 'var(--accent-emerald)' : 'var(--accent-amber)'}`
                }}>
                  <div style={{ fontWeight: 600, color: capacityDiffPercent >= 0 ? '#34d399' : '#fbbf24', marginBottom: '0.2rem' }}>
                    {capacityDiffPercent >= 0 ? '📈 Higher Bearing Capacity' : '⚠️ Lower Bearing Capacity'}
                  </div>
                  <div>
                    Theoretical formula predicts <code style={{ color: '#38bdf8' }}>{qUltTheoreticalKsf.toFixed(1)} ksf</code>.
                    Boring report is <strong>{Math.abs(capacityDiffPercent).toFixed(0)}% {capacityDiffPercent >= 0 ? 'higher' : 'lower'}</strong>.
                    {capacityDiffPercent >= 0 
                      ? ' Allowable capacity per pile increases, reducing total pile count and foundation cost.' 
                      : ' Pile count increases and spacing tightens to prevent foundation punching and settlement.'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: '0.78rem',
                color: '#94a3b8',
                padding: '0.5rem 0.75rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px'
              }}>
                Calculated dynamically from Terzaghi-Meyerhof equation: <code>qult = c′Nc + σv′Nq = {qUltTheoreticalKsf.toFixed(2)} ksf</code>.
                Switch to <em>Soil Boring Report</em> to input verified lab / field SPT test values.
              </div>
            )}
          </div>

          {/* Section D: Helical Pile Geometry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              4. Helical Pile Plate Specifications
            </span>

            {/* Helix Diameter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">Helix Plate Diameter (Dh):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{helixDiameterInches} inches ({helixDiameterFt.toFixed(2)} ft)</strong>
              </div>
              <input
                type="range"
                min="8"
                max="20"
                step="1"
                value={helixDiameterInches}
                onChange={(e) => setHelixDiameterInches(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                <span>Projected Bearing Area Ah:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{helixAreaSqFt.toFixed(3)} sq ft</span>
              </div>
            </div>

            {/* Number of Helices */}
            <div>
              <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '0.35rem' }}>Helix Plates Per Pile:</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className="btn-secondary"
                    style={{
                      padding: '0.45rem',
                      fontSize: '0.8rem',
                      background: helixCount === count ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                      borderColor: helixCount === count ? 'var(--accent-emerald)' : 'var(--border-color)',
                      color: helixCount === count ? 'var(--accent-emerald)' : 'var(--text-main)',
                      fontWeight: helixCount === count ? 700 : 500
                    }}
                    onClick={() => setHelixCount(count)}
                  >
                    {count === 1 ? 'Single Helix' : count === 2 ? 'Double Helix' : 'Triple Helix'}
                  </button>
                ))}
              </div>
            </div>

            {/* Single Pile Capacity Callout */}
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Unit Bearing Cap (qult):</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{qUltKsf.toFixed(2)} ksf</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Ultimate Pile Cap (Qult):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontSize: '1rem' }}>
                  {pileUltCapacityKips.toFixed(1)} kips
                </strong>
              </div>
            </div>
          </div>

          {/* Section E: Load Eccentricity & Aerial Moments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--accent-rose, #f43f5e)' }}>
                5. Load Eccentricity & Aerial Moments
              </span>
              {eccentricityResults.isUplift && (
                <span className="glass-badge" style={{ fontSize: '0.65rem', borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--accent-rose)' }}>
                  🚨 Uplift Active
                </span>
              )}
            </div>

            {/* East-West Offset (ex) Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">East-West Eccentricity (ex):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: eccentricityX !== 0 ? 'var(--accent-rose)' : 'var(--text-main)' }}>
                  {eccentricityX > 0 ? `+${eccentricityX} ft (East)` : eccentricityX < 0 ? `${eccentricityX} ft (West)` : '0.0 ft (Centered)'}
                </strong>
              </div>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={eccentricityX}
                onChange={(e) => setEccentricityX(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-rose, #f43f5e)' }}
              />
            </div>

            {/* North-South Offset (ey) Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span className="text-muted">North-South Eccentricity (ey):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: eccentricityY !== 0 ? 'var(--accent-rose)' : 'var(--text-main)' }}>
                  {eccentricityY > 0 ? `+${eccentricityY} ft (North)` : eccentricityY < 0 ? `${eccentricityY} ft (South)` : '0.0 ft (Centered)'}
                </strong>
              </div>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={eccentricityY}
                onChange={(e) => setEccentricityY(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-rose, #f43f5e)' }}
              />
            </div>

            {/* Quick Eccentricity Presets */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                onClick={() => { setEccentricityX(0); setEccentricityY(0); }}
              >
                🎯 Centered (0, 0)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                onClick={() => { setEccentricityX(6); setEccentricityY(3); }}
              >
                🚗 East Garage (+6, +3)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                onClick={() => { setEccentricityX(-8); setEccentricityY(7); }}
              >
                🏡 NW 2-Story (-8, +7)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem', borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--accent-rose)' }}
                onClick={() => { setEccentricityX(11); setEccentricityY(10); setActiveTab('heatmap'); }}
              >
                🚨 Kern Uplift (+11, +10)
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem' }}
                onClick={() => { setEccentricityX(0); setEccentricityY(-10); }}
              >
                🌪️ Wind Overturn (0, -10)
              </button>
            </div>

            {/* Dynamic Eccentricity Readout Callout */}
            <div style={{
              padding: '0.75rem 1rem',
              background: eccentricityResults.isUplift ? 'rgba(244, 63, 94, 0.1)' : 'rgba(244, 63, 94, 0.05)',
              border: `1px solid ${eccentricityResults.isUplift ? 'rgba(244, 63, 94, 0.4)' : 'rgba(244, 63, 94, 0.2)'}`,
              borderRadius: '10px',
              fontSize: '0.82rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Resultant Eccentricity (e):</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: eccentricityResults.isUplift ? 'var(--accent-rose)' : '#f8fafc' }}>
                  {eccentricityResults.eMag.toFixed(2)} ft ({eccentricityResults.isUplift ? '⚠️ Out of Kern' : '✅ Inside Kern'})
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="text-muted">Overturning Moments:</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-rose)' }}>
                  Mx: {eccentricityResults.Mx.toFixed(0)}k-ft • My: {eccentricityResults.My.toFixed(0)}k-ft
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span className="text-muted">Extreme Contact Pressures:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: eccentricityResults.qMin < 0 ? 'var(--accent-rose)' : '#38bdf8' }}>
                  qmax: {eccentricityResults.qMax.toFixed(0)} psf • qmin: {eccentricityResults.qMin.toFixed(0)} psf
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic SVG Schematics, Heat Map & Math Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Global Status & Quick Issue Header Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.85rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Foundation Health:</span>
              {eccentricityResults.issues.length === 0 ? (
                <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                  ✅ Compliant (All Checks Safe)
                </span>
              ) : (
                <span style={{ color: 'var(--accent-rose)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>⚠️</span> {eccentricityResults.issues.length} Structural / Geotechnical Alert{eccentricityResults.issues.length > 1 ? 's' : ''} Active
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Peak Moment: <strong style={{ color: eccentricityResults.isCracking ? 'var(--accent-amber)' : '#f8fafc' }}>{eccentricityResults.maxSlabMoment.toFixed(1)} k-ft/ft</strong> (Mcr = {eccentricityResults.mCracking.toFixed(1)})
              </span>
              <span style={{ color: 'var(--border-color)' }}>•</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Max Pile: <strong style={{ color: eccentricityResults.overloadedCount > 0 ? 'var(--accent-rose)' : '#38bdf8' }}>{eccentricityResults.maxPileR.toFixed(1)}k</strong> / {activeGrid.qAllow}k
              </span>
            </div>
          </div>

          {/* View Tab Selector */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.35rem',
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              className={`btn-secondary ${activeTab === 'elevation' ? 'active' : ''}`}
              style={{
                flex: 1,
                fontSize: '0.82rem',
                padding: '0.5rem',
                background: activeTab === 'elevation' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                borderColor: activeTab === 'elevation' ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === 'elevation' ? 'var(--accent-blue)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab('elevation')}
            >
              📐 Elevation Cross-Section
            </button>
            <button
              className={`btn-secondary ${activeTab === 'plan' ? 'active' : ''}`}
              style={{
                flex: 1,
                fontSize: '0.82rem',
                padding: '0.5rem',
                background: activeTab === 'plan' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                borderColor: activeTab === 'plan' ? 'var(--accent-emerald)' : 'transparent',
                color: activeTab === 'plan' ? 'var(--accent-emerald)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab('plan')}
            >
              🗺️ 50′ × 50′ Foundation Plan ({activeGrid.gridK}×{activeGrid.gridK})
            </button>
            <button
              className={`btn-secondary ${activeTab === 'heatmap' ? 'active' : ''}`}
              style={{
                flex: 1.15,
                fontSize: '0.82rem',
                padding: '0.5rem',
                background: activeTab === 'heatmap' ? 'rgba(244, 63, 94, 0.18)' : 'transparent',
                borderColor: activeTab === 'heatmap' ? 'var(--accent-rose, #f43f5e)' : 'transparent',
                color: activeTab === 'heatmap' ? 'var(--accent-rose, #f43f5e)' : 'var(--text-muted)',
                fontWeight: activeTab === 'heatmap' ? 700 : 500
              }}
              onClick={() => setActiveTab('heatmap')}
            >
              🔥 Aerial Slab Heat Map (Moments & Eccentricity)
            </button>
            <button
              className={`btn-secondary ${activeTab === 'stress' ? 'active' : ''}`}
              style={{
                flex: 1,
                fontSize: '0.82rem',
                padding: '0.5rem',
                background: activeTab === 'stress' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                borderColor: activeTab === 'stress' ? 'var(--accent-cyan)' : 'transparent',
                color: activeTab === 'stress' ? 'var(--accent-cyan)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab('stress')}
            >
              📈 Stress Depth Profile
            </button>
          </div>

          {/* SVG Canvas Container */}
          <div style={{
            background: 'linear-gradient(180deg, #090e1a 0%, #050811 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
            position: 'relative',
            minHeight: '440px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* TAB 1: Elevation Cross-Section */}
            {activeTab === 'elevation' && (
              <svg
                viewBox="0 0 760 520"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                <defs>
                  {/* Concrete Hatch Pattern */}
                  <pattern id="concreteHatch" width="16" height="16" patternUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="1" fill="#94a3b8" opacity="0.6" />
                    <circle cx="12" cy="12" r="1.5" fill="#cbd5e1" opacity="0.8" />
                    <line x1="2" y1="14" x2="8" y2="8" stroke="#64748b" strokeWidth="0.7" opacity="0.5" />
                  </pattern>

                  {/* Sand Pattern */}
                  <pattern id="sandHatch" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="5" cy="5" r="0.8" fill="#d97706" opacity="0.4" />
                    <circle cx="15" cy="15" r="0.8" fill="#d97706" opacity="0.4" />
                    <circle cx="12" cy="4" r="0.6" fill="#f59e0b" opacity="0.5" />
                    <circle cx="4" cy="14" r="0.6" fill="#f59e0b" opacity="0.5" />
                  </pattern>

                  {/* Soil Stress Bulb Gradient */}
                  <radialGradient id="stressBulb" cx="50%" cy="0%" r="90%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                    <stop offset="60%" stopColor="#10b981" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </radialGradient>

                  {/* Pore Pressure Linear Triangle Gradient */}
                  <linearGradient id="porePressureGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
                  </linearGradient>

                  {/* Arrow marker */}
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                </defs>

                {/* Sky & Surface Ambient */}
                <rect x="0" y="0" width="760" height="150" fill="#0f172a" opacity="0.4" />

                {/* Ground Surface Line (Z = 0 ft) */}
                <line x1="40" y1="150" x2="720" y2="150" stroke="#78716c" strokeWidth="2.5" />
                <text x="50" y="142" fill="#a8a29e" fontSize="11" fontWeight="600">GL (z = 0′)</text>

                {/* Dynamic Scaling: Ground is y=150. Scale spans whichever is deeper: 50 ft or the actual pile depth. */}
                {(() => {
                  const maxDepthElevation = Math.max(50, pileDepthFt);
                  const scalePxPerFt = 320 / maxDepthElevation;
                  const gwtY = 150 + waterTableDepthFt * scalePxPerFt;
                  const pileTipY = 150 + pileDepthFt * scalePxPerFt;

                  return (
                    <g>
                      {/* Stratum 1: Dry / Moist Soil Above GWT */}
                      <rect
                        x="50"
                        y="150"
                        width="540"
                        height={Math.max(0, gwtY - 150)}
                        fill="#292524"
                        stroke="none"
                      />
                      <rect
                        x="50"
                        y="150"
                        width="540"
                        height={Math.max(0, gwtY - 150)}
                        fill="url(#sandHatch)"
                      />
                      <text x="60" y={Math.min(gwtY - 10, 175)} fill="#fbbf24" fontSize="12" fontWeight="700">
                        Dry Zone (γdry = {gammaDry} pcf)
                      </text>

                      {/* Stratum 2: Submerged Saturated Soil Below GWT */}
                      <rect
                        x="50"
                        y={gwtY}
                        width="540"
                        height={Math.max(0, 480 - gwtY)}
                        fill="#0c2538"
                        stroke="none"
                      />
                      <line x1="45" y1={gwtY} x2="595" y2={gwtY} stroke="#38bdf8" strokeWidth="2" strokeDasharray="6,4" />

                      {/* Water Table Triangle Symbol (∇) */}
                      <polygon points={`70,${gwtY} 78,${gwtY - 12} 62,${gwtY - 12}`} fill="#38bdf8" />
                      <line x1="58" y1={gwtY - 15} x2="82" y2={gwtY - 15} stroke="#38bdf8" strokeWidth="1.5" />
                      <line x1="63" y1={gwtY - 18} x2="77" y2={gwtY - 18} stroke="#38bdf8" strokeWidth="1.5" />
                      <text x="88" y={gwtY - 4} fill="#38bdf8" fontSize="12" fontWeight="700">
                        GWT zgw = {waterTableDepthFt}′ (γsat = {gammaSat} pcf)
                      </text>

                      {/* House Superstructure Drawing */}
                      {/* House Body */}
                      <rect x="140" y="55" width="360" height="75" fill="#1e293b" stroke="#475569" strokeWidth="1.5" rx="4" />
                      {/* Pitched Roof */}
                      <polygon points="120,55 320,10 520,55" fill="#334155" stroke="#64748b" strokeWidth="2" />
                      {/* Windows & Door */}
                      <rect x="180" y="70" width="35" height="40" fill="#0284c7" opacity="0.8" rx="2" />
                      <line x1="197.5" y1="70" x2="197.5" y2="110" stroke="#bae6fd" strokeWidth="1" />
                      <rect x="425" y="70" width="35" height="40" fill="#0284c7" opacity="0.8" rx="2" />
                      <line x1="442.5" y1="70" x2="442.5" y2="110" stroke="#bae6fd" strokeWidth="1" />
                      <rect x="302" y="75" width="36" height="55" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" rx="2" />
                      <circle cx="330" cy="103" r="2" fill="#fbbf24" />

                      {/* House Load Indicator Arrows */}
                      <line x1="200" y1="25" x2="200" y2="50" stroke="#f43f5e" strokeWidth="3" markerEnd="url(#arrow)" />
                      <line x1="320" y1="5" x2="320" y2="25" stroke="#f43f5e" strokeWidth="3" markerEnd="url(#arrow)" />
                      <line x1="440" y1="25" x2="440" y2="50" stroke="#f43f5e" strokeWidth="3" markerEnd="url(#arrow)" />
                      <text x="320" y="45" fill="#fda4af" fontSize="12" fontWeight="800" textAnchor="middle">
                        Whouse = {houseWeightKips} kips + Surcharge ({surchargePsf} psf)
                      </text>

                      {/* 50' Concrete Slab Drawing */}
                      <rect x="130" y="130" width="380" height="20" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
                      <rect x="130" y="130" width="380" height="20" fill="url(#concreteHatch)" />
                      <text x="320" y="145" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">
                        50′ × 50′ REINFORCED SLAB (t = {slabThicknessInches}″, Wslab = {slabWeightKips.toFixed(1)}k)
                      </text>

                      {/* Helical Piles Penetrating into Soil */}
                      {[170, 270, 370, 470].map((pileX, pIdx) => {
                        const plateRadius = Math.max(12, helixDiameterInches * 1.3);
                        return (
                          <g key={pIdx}>
                            {/* Steel Central Shaft */}
                            <line
                              x1={pileX}
                              y1="150"
                              x2={pileX}
                              y2={pileTipY}
                              stroke="#94a3b8"
                              strokeWidth="5"
                            />
                            {/* Helical Plate(s) */}
                            {Array.from({ length: helixCount }).map((_, hIdx) => {
                              const helixY = pileTipY - (hIdx * 24); // 24px vertical plate spacing
                              return (
                                <g key={hIdx}>
                                  {/* Soil Bearing Stress Bulb under the lowest plate */}
                                  {hIdx === 0 && (
                                    <path
                                      d={`M ${pileX - plateRadius * 1.6} ${helixY} Q ${pileX} ${helixY + plateRadius * 2.2} ${pileX + plateRadius * 1.6} ${helixY} Z`}
                                      fill="url(#stressBulb)"
                                    />
                                  )}
                                  {/* Helical Flange / Pitch Blade */}
                                  <ellipse
                                    cx={pileX}
                                    cy={helixY}
                                    rx={plateRadius}
                                    ry="5.5"
                                    fill="#10b981"
                                    stroke="#ecfdf5"
                                    strokeWidth="1.5"
                                  />
                                  {/* Helix Pitch Twist Line */}
                                  <path
                                    d={`M ${pileX - plateRadius + 2} ${helixY - 1} Q ${pileX} ${helixY + 5} ${pileX + plateRadius - 2} ${helixY + 1}`}
                                    fill="none"
                                    stroke="#047857"
                                    strokeWidth="1.5"
                                  />
                                </g>
                              );
                            })}
                            {/* Pile Point Tip */}
                            <polygon
                              points={`${pileX - 3.5},${pileTipY} ${pileX + 3.5},${pileTipY} ${pileX},${pileTipY + 8}`}
                              fill="#64748b"
                            />
                          </g>
                        );
                      })}

                      {/* Depth Dimension Line (Left Side) */}
                      <line x1="110" y1="150" x2="110" y2={pileTipY} stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="102" y1="150" x2="118" y2="150" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="102" y1={pileTipY} x2="118" y2={pileTipY} stroke="#94a3b8" strokeWidth="1.5" />
                      <text
                        x="100"
                        y={(150 + pileTipY) / 2}
                        fill="#cbd5e1"
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="end"
                        dominantBaseline="middle"
                      >
                        D = {pileDepthFt}′
                      </text>

                      {/* Helical Capacity Callout Box */}
                      <rect x="210" y={pileTipY + 14} width="220" height="30" fill="rgba(15, 23, 42, 0.95)" stroke={isBoringReport ? 'var(--accent-purple)' : '#10b981'} strokeWidth="1.5" rx="6" />
                      <text x="320" y={pileTipY + 33} fill={isBoringReport ? '#c084fc' : '#34d399'} fontSize="11" fontWeight="700" textAnchor="middle">
                        Qult = {pileUltCapacityKips.toFixed(1)} kips ({isBoringReport ? 'Boring Log' : 'Theoretical'})
                      </text>

                      {/* Hydrostatic Pore Pressure Distribution Triangle (Right Side, X: 610 - 740) */}
                      <g>
                        <text x="660" y="142" fill="#38bdf8" fontSize="11" fontWeight="700" textAnchor="middle">
                          Pore Pressure (u)
                        </text>
                        {/* Vertical Baseline */}
                        <line x1="620" y1="150" x2="620" y2="470" stroke="#475569" strokeWidth="1.5" />
                        {/* Above GWT: u = 0 */}
                        <line x1="620" y1="150" x2="620" y2={gwtY} stroke="#38bdf8" strokeWidth="3" />
                        {/* Below GWT: Triangular increase u = gamma_w * z_w */}
                        {depthBelowGwt > 0 && (
                          <>
                            <polygon
                              points={`620,${gwtY} 620,${pileTipY} ${620 + Math.min(100, (porePressureU / 25))},${pileTipY}`}
                              fill="url(#porePressureGrad)"
                              stroke="#38bdf8"
                              strokeWidth="1.5"
                            />
                            <text
                              x={625 + Math.min(95, (porePressureU / 25))}
                              y={pileTipY + 4}
                              fill="#7dd3fc"
                              fontSize="11"
                              fontWeight="700"
                            >
                              u = {porePressureU.toFixed(0)} psf
                            </text>
                          </>
                        )}
                        <text x="620" y={pileTipY + 25} fill="#94a3b8" fontSize="10">
                          σv′ = {sigmaPrimeV.toFixed(0)} psf
                        </text>
                      </g>
                    </g>
                  );
                })()}
              </svg>
            )}

            {/* TAB 2: Foundation Plan & Pile Grid (50' x 50') */}
            {activeTab === 'plan' && (
              <svg
                viewBox="0 0 600 480"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                {/* Background Grid */}
                <defs>
                  <pattern id="planSubGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="600" height="480" fill="url(#planSubGrid)" />

                {/* 50' x 50' Slab Outline (Center 340 x 340 px) */}
                <rect
                  x="130"
                  y="60"
                  width="340"
                  height="340"
                  fill="rgba(30, 41, 59, 0.7)"
                  stroke={activeGrid.color}
                  strokeWidth="3"
                  rx="6"
                />

                {/* Dimension Lines (50 ft width & length) */}
                {/* Horizontal Top */}
                <line x1="130" y1="40" x2="470" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="130" y1="35" x2="130" y2="45" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="470" y1="35" x2="470" y2="45" stroke="#94a3b8" strokeWidth="1.5" />
                <text x="300" y="32" fill="#f8fafc" fontSize="12" fontWeight="700" textAnchor="middle">
                  50.0 ft Slab Width
                </text>

                {/* Vertical Left */}
                <line x1="110" y1="60" x2="110" y2="400" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="105" y1="60" x2="115" y2="60" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="105" y1="400" x2="115" y2="400" stroke="#94a3b8" strokeWidth="1.5" />
                <text x="100" y="230" fill="#f8fafc" fontSize="12" fontWeight="700" textAnchor="end" dominantBaseline="middle">
                  50.0 ft
                </text>

                {/* Draw the k x k Helical Piles Grid */}
                {(() => {
                  const k = activeGrid.gridK;
                  const padding = 20; // edge set-back from slab corners
                  const innerWidth = 340 - (padding * 2);
                  const step = k > 1 ? innerWidth / (k - 1) : 0;

                  const pileElements = [];
                  for (let row = 0; row < k; row++) {
                    for (let col = 0; col < k; col++) {
                      const px = 130 + padding + col * step;
                      const py = 60 + padding + row * step;

                      pileElements.push(
                        <g key={`${row}-${col}`}>
                          {/* Radial Glow */}
                          <circle cx={px} cy={py} r="12" fill={activeGrid.bgGlow} />
                          {/* Outer Helical Plate Ring */}
                          <circle
                            cx={px}
                            cy={py}
                            r="9"
                            fill="#0b1120"
                            stroke={activeGrid.color}
                            strokeWidth="2"
                          />
                          {/* Central Shaft Core */}
                          <circle cx={px} cy={py} r="3.5" fill="#f8fafc" />
                          {/* Crosshair */}
                          <line x1={px - 6} y1={py} x2={px + 6} y2={py} stroke="#64748b" strokeWidth="0.8" />
                          <line x1={px} y1={py - 6} x2={px} y2={py + 6} stroke="#64748b" strokeWidth="0.8" />
                        </g>
                      );
                    }
                  }
                  return pileElements;
                })()}

                {/* Plan Metrics Banner */}
                <rect x="130" y="420" width="340" height="42" fill="rgba(15, 23, 42, 0.9)" stroke="var(--border-color)" strokeWidth="1" rx="8" />
                <text x="300" y="438" fill={activeGrid.color} fontSize="12" fontWeight="700" textAnchor="middle">
                  {activeGrid.label} ({activeGrid.badge}) : {activeGrid.gridK} × {activeGrid.gridK} Layout = {activeGrid.nInstalled} Piles
                </text>
                <text x="300" y="453" fill="#cbd5e1" fontSize="11" textAnchor="middle">
                  Pile Spacing: {activeGrid.spacingFt} ft On-Center • Qallow: {activeGrid.qAllow} kips
                </text>
              </svg>
            )}

            {/* TAB 3: Aerial Slab Heat Map (Moments & Eccentricity) */}
            {activeTab === 'heatmap' && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0.75rem' }}>
                {/* Metric Selector & Subdivision Controls Sub-Bar */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  padding: '0.6rem 0.85rem',
                  background: 'rgba(15, 23, 42, 0.85)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '0.75rem'
                }}>
                  {/* Row 1: Slab Subdivision Mode */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="text-xs text-muted" style={{ fontWeight: 700, color: 'var(--accent-purple)' }}>
                        Slab Subdivision:
                      </span>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.6rem',
                          background: subdivisionMode === 'quadrants' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                          borderColor: subdivisionMode === 'quadrants' ? 'var(--accent-purple, #a855f7)' : 'var(--border-color)',
                          color: subdivisionMode === 'quadrants' ? 'var(--accent-purple, #a855f7)' : 'var(--text-muted)',
                          fontWeight: subdivisionMode === 'quadrants' ? 700 : 500
                        }}
                        onClick={() => { setSubdivisionMode('quadrants'); setSectionCardTab('quadrants'); }}
                      >
                        🧩 4 Quadrants (25′ × 25′)
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.6rem',
                          background: subdivisionMode === 'sections' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                          borderColor: subdivisionMode === 'sections' ? 'var(--accent-blue, #38bdf8)' : 'var(--border-color)',
                          color: subdivisionMode === 'sections' ? 'var(--accent-blue, #38bdf8)' : 'var(--text-muted)',
                          fontWeight: subdivisionMode === 'sections' ? 700 : 500
                        }}
                        onClick={() => { setSubdivisionMode('sections'); setSectionCardTab('sections'); }}
                      >
                        📐 16 Structural Bays (12.5′ × 12.5′)
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.6rem',
                          background: subdivisionMode === 'mesh' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                          borderColor: subdivisionMode === 'mesh' ? 'var(--accent-emerald, #10b981)' : 'var(--border-color)',
                          color: subdivisionMode === 'mesh' ? 'var(--accent-emerald, #10b981)' : 'var(--text-muted)',
                          fontWeight: subdivisionMode === 'mesh' ? 700 : 500
                        }}
                        onClick={() => setSubdivisionMode('mesh')}
                      >
                        🔥 256 Continuous Elements
                      </button>
                    </div>

                    {selectedSectionId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="glass-badge" style={{ fontSize: '0.7rem', color: '#38bdf8', borderColor: '#38bdf8' }}>
                          Focused: {selectedSectionId}
                        </span>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}
                          onClick={() => setSelectedSectionId(null)}
                        >
                          ✕ Clear Focus
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Metric Buttons & Layer Checkboxes */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Metric:</span>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.55rem',
                          background: heatMapMetric === 'moment' ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                          borderColor: heatMapMetric === 'moment' ? 'var(--accent-rose, #f43f5e)' : 'var(--border-color)',
                          color: heatMapMetric === 'moment' ? 'var(--accent-rose, #f43f5e)' : 'var(--text-muted)',
                          fontWeight: heatMapMetric === 'moment' ? 700 : 500
                        }}
                        onClick={() => setHeatMapMetric('moment')}
                      >
                        ⚡ Bending Moment M
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.55rem',
                          background: heatMapMetric === 'pressure' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                          borderColor: heatMapMetric === 'pressure' ? 'var(--accent-blue, #38bdf8)' : 'var(--border-color)',
                          color: heatMapMetric === 'pressure' ? 'var(--accent-blue, #38bdf8)' : 'var(--text-muted)',
                          fontWeight: heatMapMetric === 'pressure' ? 700 : 500
                        }}
                        onClick={() => setHeatMapMetric('pressure')}
                      >
                        🧭 Soil Bearing q
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.55rem',
                          background: heatMapMetric === 'pileReaction' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                          borderColor: heatMapMetric === 'pileReaction' ? 'var(--accent-emerald, #10b981)' : 'var(--border-color)',
                          color: heatMapMetric === 'pileReaction' ? 'var(--accent-emerald, #10b981)' : 'var(--text-muted)',
                          fontWeight: heatMapMetric === 'pileReaction' ? 700 : 500
                        }}
                        onClick={() => setHeatMapMetric('pileReaction')}
                      >
                        🔩 Pile Reactions R
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.25rem 0.55rem',
                          background: heatMapMetric === 'quadrant' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                          borderColor: heatMapMetric === 'quadrant' ? 'var(--accent-purple, #a855f7)' : 'var(--border-color)',
                          color: heatMapMetric === 'quadrant' ? 'var(--accent-purple, #a855f7)' : 'var(--text-muted)',
                          fontWeight: heatMapMetric === 'quadrant' ? 700 : 500
                        }}
                        onClick={() => setHeatMapMetric('quadrant')}
                      >
                        📊 Load Share (%)
                      </button>
                    </div>

                    {/* Layer Checkboxes */}
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', fontSize: '0.75rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: '#cbd5e1' }}>
                        <input
                          type="checkbox"
                          checked={showPilesOnHeatMap}
                          onChange={(e) => setShowPilesOnHeatMap(e.target.checked)}
                          style={{ accentColor: 'var(--accent-emerald)' }}
                        />
                        Piles ({activeGrid.nInstalled})
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: '#cbd5e1' }}>
                        <input
                          type="checkbox"
                          checked={showKernBoundary}
                          onChange={(e) => setShowKernBoundary(e.target.checked)}
                          style={{ accentColor: 'var(--accent-amber)' }}
                        />
                        Kern Diamond
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: '#cbd5e1' }}>
                        <input
                          type="checkbox"
                          checked={showQuadrantDividers}
                          onChange={(e) => setShowQuadrantDividers(e.target.checked)}
                          style={{ accentColor: 'var(--accent-cyan)' }}
                        />
                        Dividers
                      </label>
                    </div>
                  </div>
                </div>

                {/* SVG Top-Down Heat Map */}
                <svg
                  viewBox="0 0 720 540"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  <defs>
                    {/* Tension / Uplift Striped Hatch Pattern */}
                    <pattern id="tensionHatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="8" stroke="#c084fc" strokeWidth="2.5" opacity="0.9" />
                    </pattern>

                    {/* Overloaded Pile Glow Filter */}
                    <filter id="overloadPulse" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f43f5e" />
                    </filter>

                    {/* Selected Section Focus Glow Filter */}
                    <filter id="selectedGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#38bdf8" floodOpacity="0.85" />
                    </filter>

                    {/* Colormap Legend Gradient */}
                    <linearGradient id="heatLegendGrad" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="25%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#eab308" />
                      <stop offset="75%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>

                    {/* Canvas Sub-grid */}
                    <pattern id="heatSubGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
                    </pattern>
                  </defs>

                  <rect x="0" y="0" width="720" height="540" fill="url(#heatSubGrid)" />

                  {/* Compass Indicator */}
                  <g transform="translate(40, 40)">
                    <circle cx="16" cy="16" r="15" fill="rgba(15,23,42,0.8)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <line x1="16" y1="5" x2="16" y2="27" stroke="#64748b" strokeWidth="1" />
                    <line x1="5" y1="16" x2="27" y2="16" stroke="#64748b" strokeWidth="1" />
                    <polygon points="16,5 13,13 19,13" fill="#f43f5e" />
                    <polygon points="16,27 13,19 19,19" fill="#94a3b8" />
                    <text x="16" y="2" fill="#f43f5e" fontSize="8" fontWeight="800" textAnchor="middle">N</text>
                  </g>

                  {/* Dimension Annotations */}
                  {/* Top Width Dimension (50.0 ft) */}
                  <line x1="100" y1="32" x2="460" y2="32" stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1="100" y1="27" x2="100" y2="37" stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1="460" y1="27" x2="460" y2="37" stroke="#94a3b8" strokeWidth="1.5" />
                  <text x="280" y="26" fill="#f8fafc" fontSize="11" fontWeight="700" textAnchor="middle">
                    50.0 ft Slab Width (East-West)
                  </text>

                  {/* Left Length Dimension (50.0 ft) */}
                  <line x1="82" y1="50" x2="82" y2="410" stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1="77" y1="50" x2="87" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1="77" y1="410" x2="87" y2="410" stroke="#94a3b8" strokeWidth="1.5" />
                  <text x="74" y="230" fill="#f8fafc" fontSize="11" fontWeight="700" textAnchor="end" dominantBaseline="middle">
                    50.0 ft Length
                  </text>

                  {/* SUBDIVISION RENDERER: Tri-Modal (Mesh / 4 Quadrants / 16 Bays) */}

                  {/* Mode 1: 16 x 16 Continuous Elements Mesh (256 Cells) */}
                  {subdivisionMode === 'mesh' && (
                    <g>
                      {heatMapCells.cells.map((cell) => {
                        const cellX = 100 + cell.c * 22.5;
                        const cellY = 50 + cell.r * 22.5;
                        const isHovered = hoveredCell && hoveredCell.r === cell.r && hoveredCell.c === cell.c;
                        return (
                          <g key={`${cell.r}-${cell.c}`}>
                            <rect
                              x={cellX}
                              y={cellY}
                              width={22.5}
                              height={22.5}
                              fill={cell.color}
                              stroke={isHovered ? '#ffffff' : 'rgba(0,0,0,0.1)'}
                              strokeWidth={isHovered ? 2 : 0.4}
                              style={{ cursor: 'crosshair' }}
                              onMouseEnter={() => setHoveredCell(cell)}
                              onMouseLeave={() => setHoveredCell(null)}
                            />
                            {cell.isTension && (heatMapMetric === 'pressure' || heatMapMetric === 'moment') && (
                              <rect
                                x={cellX}
                                y={cellY}
                                width={22.5}
                                height={22.5}
                                fill="url(#tensionHatch)"
                                opacity="0.65"
                                pointerEvents="none"
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Mode 2: 4 Quadrants (25′ × 25′ each) */}
                  {subdivisionMode === 'quadrants' && (
                    <g>
                      {heatMapCells.coloredQuadrants.map((quad) => {
                        const qx = quad.cx < 0 ? 100 : 280;
                        const qy = quad.cy > 0 ? 50 : 230;
                        const isSelected = selectedSectionId === quad.id;
                        const isHovered = hoveredCell && hoveredCell.id === quad.id;
                        return (
                          <g
                            key={quad.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedSectionId(selectedSectionId === quad.id ? null : quad.id)}
                            onMouseEnter={() => setHoveredCell(quad)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            <rect
                              x={qx}
                              y={qy}
                              width={180}
                              height={180}
                              fill={quad.color}
                              fillOpacity={selectedSectionId && !isSelected ? 0.35 : 0.88}
                              stroke={isSelected ? '#38bdf8' : isHovered ? '#ffffff' : 'rgba(255,255,255,0.35)'}
                              strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 1.2}
                              filter={isSelected ? 'url(#selectedGlow)' : undefined}
                            />
                            {quad.hasUplift && (heatMapMetric === 'pressure' || heatMapMetric === 'moment') && (
                              <rect
                                x={qx}
                                y={qy}
                                width={180}
                                height={180}
                                fill="url(#tensionHatch)"
                                opacity="0.45"
                                pointerEvents="none"
                              />
                            )}

                            {/* Quadrant Central Card & Readout */}
                            <g pointerEvents="none" transform={`translate(${qx + 90}, ${qy + 90})`}>
                              <rect
                                x="-75"
                                y="-55"
                                width="150"
                                height="110"
                                rx="8"
                                fill="rgba(15, 23, 42, 0.88)"
                                stroke={isSelected ? '#38bdf8' : 'rgba(255,255,255,0.18)'}
                                strokeWidth="1.2"
                              />
                              <text x="0" y="-35" fill={quad.color} fontSize="11" fontWeight="800" textAnchor="middle">
                                {quad.name}
                              </text>
                              <text x="0" y="-14" fill="#f8fafc" fontSize="13" fontWeight="800" textAnchor="middle">
                                {heatMapMetric === 'moment' && `M = ${quad.peakMoment.toFixed(2)} k-ft`}
                                {heatMapMetric === 'pressure' && `q = ${quad.qAvgPsf.toFixed(0)} psf`}
                                {heatMapMetric === 'pileReaction' && `Rmax = ${quad.maxPileReaction.toFixed(1)}k`}
                                {heatMapMetric === 'quadrant' && `${quad.loadPct.toFixed(1)}% Share`}
                              </text>
                              <text x="0" y="3" fill="#cbd5e1" fontSize="9.5" textAnchor="middle">
                                Load: {quad.loadKips.toFixed(1)}k ({quad.loadPct.toFixed(0)}%)
                              </text>
                              <text x="0" y="18" fill="#94a3b8" fontSize="9" textAnchor="middle">
                                {quad.pileCount} Piles • Rmax: {quad.maxPileReaction.toFixed(1)}k
                              </text>
                              <rect
                                x="-45"
                                y="27"
                                width="90"
                                height="16"
                                rx="4"
                                fill={quad.status === 'critical' ? 'rgba(244,63,94,0.3)' : quad.status === 'warning' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}
                                stroke={quad.status === 'critical' ? '#f43f5e' : quad.status === 'warning' ? '#f59e0b' : '#10b981'}
                                strokeWidth="1"
                              />
                              <text
                                x="0"
                                y="39"
                                fill={quad.status === 'critical' ? '#f43f5e' : quad.status === 'warning' ? '#f59e0b' : '#10b981'}
                                fontSize="8.5"
                                fontWeight="800"
                                textAnchor="middle"
                              >
                                {quad.status === 'critical' ? (quad.hasUplift ? '⚠️ LIFTOFF' : '⚠️ OVERLOAD') : quad.status === 'warning' ? '⚠️ ELEVATED' : '✅ BALANCED'}
                              </text>
                            </g>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Mode 3: 16 Structural Bays / Sections (12.5′ × 12.5′ each) */}
                  {subdivisionMode === 'sections' && (
                    <g>
                      {heatMapCells.coloredSections16.map((sec) => {
                        const bx = 100 + sec.colIdx * 90;
                        const by = 50 + sec.rowIdx * 90;
                        const isSelected = selectedSectionId === sec.id;
                        const isHovered = hoveredCell && hoveredCell.id === sec.id;
                        return (
                          <g
                            key={sec.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedSectionId(selectedSectionId === sec.id ? null : sec.id)}
                            onMouseEnter={() => setHoveredCell(sec)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            <rect
                              x={bx}
                              y={by}
                              width={90}
                              height={90}
                              fill={sec.color}
                              fillOpacity={selectedSectionId && !isSelected ? 0.35 : 0.85}
                              stroke={isSelected ? '#38bdf8' : isHovered ? '#ffffff' : 'rgba(255,255,255,0.22)'}
                              strokeWidth={isSelected ? 3.5 : isHovered ? 2.2 : 0.8}
                              filter={isSelected ? 'url(#selectedGlow)' : undefined}
                            />
                            {sec.hasUplift && (heatMapMetric === 'pressure' || heatMapMetric === 'moment') && (
                              <rect
                                x={bx}
                                y={by}
                                width={90}
                                height={90}
                                fill="url(#tensionHatch)"
                                opacity="0.45"
                                pointerEvents="none"
                              />
                            )}

                            {/* Bay Central Tag & Readout */}
                            <g pointerEvents="none">
                              <rect x={bx + 4} y={by + 4} width="22" height="15" rx="3" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
                              <text x={bx + 15} y={by + 15} fill="#f8fafc" fontSize="8.5" fontWeight="800" textAnchor="middle">
                                {sec.id}
                              </text>

                              <text x={bx + 45} y={by + 42} fill="#ffffff" fontSize="10.5" fontWeight="800" textAnchor="middle">
                                {heatMapMetric === 'moment' && `${sec.peakMoment.toFixed(2)}k-ft`}
                                {heatMapMetric === 'pressure' && `${sec.qAvgPsf.toFixed(0)} psf`}
                                {heatMapMetric === 'pileReaction' && `${sec.maxPileReaction.toFixed(1)}k`}
                                {heatMapMetric === 'quadrant' && `${sec.loadPct.toFixed(1)}%`}
                              </text>

                              <text x={bx + 45} y={by + 58} fill="#e2e8f0" fontSize="8.5" textAnchor="middle">
                                {sec.loadKips.toFixed(1)}k ({sec.loadPct.toFixed(1)}%)
                              </text>

                              <circle
                                cx={bx + 80}
                                cy={by + 11}
                                r="4.5"
                                fill={sec.status === 'critical' ? '#f43f5e' : sec.status === 'warning' ? '#f59e0b' : '#10b981'}
                              />
                            </g>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Outer Slab Boundary Frame */}
                  <rect
                    x="100"
                    y="50"
                    width="360"
                    height="360"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="2.5"
                    rx="4"
                    pointerEvents="none"
                  />

                  {/* Quadrant & Bay Partition Grid Lines & Tags */}
                  {showQuadrantDividers && (
                    <g pointerEvents="none">
                      {/* Sub-bay dividers if in sections mode — 3 interior cols + 3 interior rows */}
                      {subdivisionMode === 'sections' && (
                        <>
                          {/* Interior column lines at 12.5′, 25′ (center), 37.5′ */}
                          <line x1="190" y1="50" x2="190" y2="410" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" strokeDasharray="3,3" />
                          <line x1="280" y1="50" x2="280" y2="410" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" strokeDasharray="3,3" />
                          <line x1="370" y1="50" x2="370" y2="410" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" strokeDasharray="3,3" />
                          {/* Interior row lines at 12.5′, 25′ (center), 37.5′ */}
                          <line x1="100" y1="140" x2="460" y2="140" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" strokeDasharray="3,3" />
                          <line x1="100" y1="230" x2="460" y2="230" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" strokeDasharray="3,3" />
                          <line x1="100" y1="320" x2="460" y2="320" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" strokeDasharray="3,3" />
                          {/* Column labels A–D */}
                          {['A','B','C','D'].map((l,i) => (
                            <text key={l} x={145 + i*90} y={46} fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="700" textAnchor="middle">{l}</text>
                          ))}
                          {/* Row labels 1–4 */}
                          {['1','2','3','4'].map((l,i) => (
                            <text key={l} x={96} y={97 + i*90} fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="700" textAnchor="end">{l}</text>
                          ))}
                        </>
                      )}

                      {/* Major Quadrant Axis Dividers (x = 0, y = 0) */}
                      <line x1="280" y1="50" x2="280" y2="410" stroke="#ffffff" strokeWidth="1.8" strokeDasharray="6,4" opacity="0.75" />
                      <line x1="100" y1="230" x2="460" y2="230" stroke="#ffffff" strokeWidth="1.8" strokeDasharray="6,4" opacity="0.75" />

                      {/* Quadrant Overlay Corner Tags (Shown in Mesh & Sections modes) */}
                      {subdivisionMode !== 'quadrants' && (
                        <>
                          {/* Q2: NW */}
                          <rect x="105" y="55" width="108" height="34" rx="6" fill="rgba(15,23,42,0.85)" stroke="#38bdf8" strokeWidth="1" />
                          <text x="112" y="69" fill="#38bdf8" fontSize="9.5" fontWeight="700">Q2 (North-West)</text>
                          <text x="112" y="82" fill="#cbd5e1" fontSize="8.5">
                            {eccentricityResults.quadrants[0].loadKips.toFixed(1)}k ({eccentricityResults.quadrants[0].loadPct.toFixed(0)}%) • M:{eccentricityResults.quadrants[0].peakMoment.toFixed(1)}
                          </text>

                          {/* Q1: NE */}
                          <rect x="347" y="55" width="108" height="34" rx="6" fill="rgba(15,23,42,0.85)" stroke="#10b981" strokeWidth="1" />
                          <text x="354" y="69" fill="#10b981" fontSize="9.5" fontWeight="700">Q1 (North-East)</text>
                          <text x="354" y="82" fill="#cbd5e1" fontSize="8.5">
                            {eccentricityResults.quadrants[1].loadKips.toFixed(1)}k ({eccentricityResults.quadrants[1].loadPct.toFixed(0)}%) • M:{eccentricityResults.quadrants[1].peakMoment.toFixed(1)}
                          </text>

                          {/* Q3: SW */}
                          <rect x="105" y="371" width="108" height="34" rx="6" fill="rgba(15,23,42,0.85)" stroke="#f59e0b" strokeWidth="1" />
                          <text x="112" y="385" fill="#f59e0b" fontSize="9.5" fontWeight="700">Q3 (South-West)</text>
                          <text x="112" y="398" fill="#cbd5e1" fontSize="8.5">
                            {eccentricityResults.quadrants[2].loadKips.toFixed(1)}k ({eccentricityResults.quadrants[2].loadPct.toFixed(0)}%) • M:{eccentricityResults.quadrants[2].peakMoment.toFixed(1)}
                          </text>

                          {/* Q4: SE */}
                          <rect x="347" y="371" width="108" height="34" rx="6" fill="rgba(15,23,42,0.85)" stroke="#a855f7" strokeWidth="1" />
                          <text x="354" y="385" fill="#a855f7" fontSize="9.5" fontWeight="700">Q4 (South-East)</text>
                          <text x="354" y="398" fill="#cbd5e1" fontSize="8.5">
                            {eccentricityResults.quadrants[3].loadKips.toFixed(1)}k ({eccentricityResults.quadrants[3].loadPct.toFixed(0)}%) • M:{eccentricityResults.quadrants[3].peakMoment.toFixed(1)}
                          </text>
                        </>
                      )}
                    </g>
                  )}

                  {/* Middle-Third Kern Diamond Overlay (B/6 = 8.33 ft = 60 px radius) */}
                  {showKernBoundary && (
                    <g pointerEvents="none">
                      <polygon
                        points="280,170 340,230 280,290 220,230"
                        fill={eccentricityResults.isUplift ? 'rgba(244, 63, 94, 0.08)' : 'rgba(234, 179, 8, 0.04)'}
                        stroke={eccentricityResults.isUplift ? '#f43f5e' : '#eab308'}
                        strokeWidth={eccentricityResults.isUplift ? 2.5 : 1.8}
                        strokeDasharray={eccentricityResults.isUplift ? '6,3' : '4,4'}
                      />
                      <text
                        x="280"
                        y={eccentricityResults.isUplift ? 224 : 227}
                        fill={eccentricityResults.isUplift ? '#f43f5e' : '#fef08a'}
                        fontSize="9.5"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {eccentricityResults.isUplift ? 'KERN EXCEEDED (e > 8.3′)' : 'Kern Limit (e ≤ 8.3′)'}
                      </text>
                      <text
                        x="280"
                        y={eccentricityResults.isUplift ? 237 : 239}
                        fill={eccentricityResults.isUplift ? '#fda4af' : '#cbd5e1'}
                        fontSize="8.5"
                        textAnchor="middle"
                      >
                        {eccentricityResults.isUplift ? '⚠️ Tension Uplift Hazard' : 'Full Base Compression'}
                      </text>
                    </g>
                  )}

                  {/* Resultant Load Centroid Target Bullseye */}
                  {(() => {
                    const cxCent = Math.max(105, Math.min(455, 280 + eccentricityX * 7.2));
                    const cyCent = Math.max(55, Math.min(405, 230 - eccentricityY * 7.2));
                    return (
                      <g pointerEvents="none">
                        {/* Connecting Eccentricity Vector from Center */}
                        {(eccentricityX !== 0 || eccentricityY !== 0) && (
                          <line
                            x1="280"
                            y1="230"
                            x2={cxCent}
                            y2={cyCent}
                            stroke="#f43f5e"
                            strokeWidth="2.5"
                            strokeDasharray="4,3"
                          />
                        )}
                        {/* Center Origin Mark */}
                        <circle cx="280" cy="230" r="3" fill="#cbd5e1" opacity="0.7" />

                        {/* Outer Pulsing Bullseye Ring */}
                        <circle
                          cx={cxCent}
                          cy={cyCent}
                          r="14"
                          fill="rgba(244, 63, 94, 0.15)"
                          stroke="#f43f5e"
                          strokeWidth="2"
                        />
                        <circle cx={cxCent} cy={cyCent} r="5" fill="#f43f5e" />
                        <line x1={cxCent - 18} y1={cyCent} x2={cxCent + 18} y2={cyCent} stroke="#ffffff" strokeWidth="1.2" />
                        <line x1={cxCent} y1={cyCent - 18} x2={cxCent} y2={cyCent + 18} stroke="#ffffff" strokeWidth="1.2" />

                        {/* Centroid Coordinates Badge */}
                        <g transform={`translate(${cxCent > 340 ? cxCent - 145 : cxCent + 16}, ${cyCent > 340 ? cyCent - 30 : cyCent - 8})`}>
                          <rect x="0" y="0" width="135" height="32" rx="6" fill="rgba(15, 23, 42, 0.92)" stroke="rgba(244, 63, 94, 0.6)" strokeWidth="1" />
                          <text x="8" y="14" fill="#ffffff" fontSize="9.5" fontWeight="700">
                            P = {totalDownwardLoadKips.toFixed(0)}k Load Center
                          </text>
                          <text x="8" y="25" fill="#fda4af" fontSize="8.5">
                            ex = {eccentricityX > 0 ? '+' : ''}{eccentricityX}′, ey = {eccentricityY > 0 ? '+' : ''}{eccentricityY}′ (e = {eccentricityResults.eMag.toFixed(1)}′)
                          </text>
                        </g>
                      </g>
                    );
                  })()}

                  {/* Helical Piles Grid Overlay */}
                  {showPilesOnHeatMap && (
                    <g pointerEvents="none">
                      {eccentricityResults.evaluatedPiles.map((p, idx) => {
                        const k = activeGrid.gridK;
                        const edgePaddingPx = 18;
                        const innerWidthPx = 360 - edgePaddingPx * 2;
                        const stepPx = k > 1 ? innerWidthPx / (k - 1) : 0;
                        const px = 100 + edgePaddingPx + p.c * stepPx;
                        const py = 50 + edgePaddingPx + p.r * stepPx;

                        const qAllow = Number(activeGrid.qAllow);
                        let ringColor = '#10b981';
                        if (p.isTension) ringColor = '#c084fc';
                        else if (p.isOverloaded) ringColor = '#f43f5e';
                        else if (p.reactionKips > 0.8 * qAllow) ringColor = '#f59e0b';

                        return (
                          <g key={idx}>
                            {/* Halo / Glow */}
                            <circle
                              cx={px}
                              cy={py}
                              r={p.isOverloaded ? 14 : 11}
                              fill="rgba(11, 17, 32, 0.85)"
                              stroke={ringColor}
                              strokeWidth={p.isOverloaded ? 2.5 : 1.8}
                              filter={p.isOverloaded ? 'url(#overloadPulse)' : undefined}
                            />
                            {/* Central Shaft Core */}
                            <circle cx={px} cy={py} r="3" fill="#ffffff" />
                            {/* Pile Reaction Value Tag */}
                            <text
                              x={px}
                              y={py - 13}
                              fill={ringColor}
                              fontSize="8"
                              fontWeight="800"
                              textAnchor="middle"
                            >
                              {p.reactionKips.toFixed(1)}k
                            </text>
                            {p.isOverloaded && (
                              <text x={px} y={py + 21} fill="#f43f5e" fontSize="8" fontWeight="800" textAnchor="middle">
                                ⚠️ OVER
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Right Side: Scientific Colormap Legend */}
                  <g transform="translate(485, 50)">
                    {/* Legend Title */}
                    <text x="0" y="14" fill="#cbd5e1" fontSize="10.5" fontWeight="700">
                      {heatMapMetric === 'moment' && 'Slab Moment M (k-ft/ft)'}
                      {heatMapMetric === 'pressure' && 'Contact Stress q (psf)'}
                      {heatMapMetric === 'pileReaction' && 'Pile Reaction R (kips)'}
                      {heatMapMetric === 'quadrant' && 'Quadrant Load Share (%)'}
                    </text>

                    {/* Gradient Color Bar */}
                    <rect
                      x="10"
                      y="26"
                      width="18"
                      height="260"
                      fill="url(#heatLegendGrad)"
                      rx="4"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="1"
                    />

                    {/* Numerical Scale Ticks */}
                    {(() => {
                      let topLabel = '10';
                      let midLabel = '5';
                      let botLabel = '0';
                      let mCrY = null;
                      let qZeroY = null;

                      if (heatMapMetric === 'moment') {
                        const maxM = heatMapCells.maxMoment;
                        topLabel = `${maxM.toFixed(1)}`;
                        midLabel = `${(maxM * 0.5).toFixed(1)}`;
                        botLabel = '0.0';
                        if (eccentricityResults.mCracking <= maxM) {
                          mCrY = 286 - (eccentricityResults.mCracking / maxM) * 260;
                        }
                      } else if (heatMapMetric === 'pressure') {
                        const maxQ = heatMapCells.maxQ;
                        topLabel = `${maxQ.toFixed(0)}`;
                        midLabel = `${(maxQ * 0.5).toFixed(0)}`;
                        botLabel = '0';
                        if (eccentricityResults.qMin < 0) {
                          qZeroY = 286;
                        }
                      } else if (heatMapMetric === 'pileReaction') {
                        const qAllow = Number(activeGrid.qAllow);
                        const topR = qAllow * 1.25;
                        topLabel = `${topR.toFixed(1)}k`;
                        midLabel = `${(topR * 0.5).toFixed(1)}k`;
                        botLabel = '0.0k';
                      } else if (heatMapMetric === 'quadrant') {
                        topLabel = '45%';
                        midLabel = '25%';
                        botLabel = '15%';
                      }

                      return (
                        <g>
                          {/* Top tick */}
                          <line x1="8" y1="26" x2="30" y2="26" stroke="#ffffff" strokeWidth="1" />
                          <text x="34" y="30" fill="#f8fafc" fontSize="9.5" fontWeight="700">{topLabel}</text>

                          {/* 75% tick */}
                          <line x1="8" y1="91" x2="30" y2="91" stroke="#94a3b8" strokeWidth="1" />

                          {/* 50% tick */}
                          <line x1="8" y1="156" x2="30" y2="156" stroke="#ffffff" strokeWidth="1" />
                          <text x="34" y="160" fill="#cbd5e1" fontSize="9.5">{midLabel}</text>

                          {/* 25% tick */}
                          <line x1="8" y1="221" x2="30" y2="221" stroke="#94a3b8" strokeWidth="1" />

                          {/* Bottom tick */}
                          <line x1="8" y1="286" x2="30" y2="286" stroke="#ffffff" strokeWidth="1" />
                          <text x="34" y="290" fill="#94a3b8" fontSize="9.5">{botLabel}</text>

                          {/* Cracking Moment Marker (Mcr) */}
                          {mCrY !== null && (
                            <g>
                              <line x1="4" y1={mCrY} x2="36" y2={mCrY} stroke="#f59e0b" strokeWidth="2.5" />
                              <text x="40" y={mCrY + 3} fill="#f59e0b" fontSize="9" fontWeight="800">
                                Mcr = {eccentricityResults.mCracking.toFixed(1)} (Cracking Limit)
                              </text>
                            </g>
                          )}

                          {/* Tension Zone Callout if Negative Pressure */}
                          {qZeroY !== null && (
                            <g transform="translate(0, 305)">
                              <rect x="10" y="0" width="18" height="18" fill="url(#tensionHatch)" stroke="#c084fc" rx="2" />
                              <text x="34" y="13" fill="#c084fc" fontSize="9" fontWeight="700">
                                &lt; 0 psf (Tension Uplift)
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })()}
                  </g>

                  {/* Bottom Interactive HUD Readout Bar */}
                  <g transform="translate(100, 435)">
                    <rect
                      x="0"
                      y="0"
                      width="520"
                      height="80"
                      rx="10"
                      fill="rgba(15, 23, 42, 0.95)"
                      stroke="var(--border-color)"
                      strokeWidth="1.2"
                    />

                    {hoveredCell ? (() => {
                      // Normalize across all three hover object shapes
                      const isMeshCell = hoveredCell.mVal !== undefined;
                      const label = isMeshCell
                        ? `(X = ${hoveredCell.xFt?.toFixed(1)}′, Y = ${hoveredCell.yFt?.toFixed(1)}′) • ${hoveredCell.quadId} Quadrant`
                        : hoveredCell.name || hoveredCell.id || '';
                      const momentVal  = isMeshCell ? hoveredCell.mVal        : (hoveredCell.peakMoment   ?? 0);
                      const qVal       = isMeshCell ? hoveredCell.qVal        : (hoveredCell.qAvgPsf      ?? 0);
                      const rVal       = isMeshCell ? hoveredCell.nearestPileReaction : (hoveredCell.maxPileReaction ?? 0);
                      const isTension  = isMeshCell ? hoveredCell.isTension   : (hoveredCell.hasUplift    ?? false);
                      const loadPct    = isMeshCell ? null : hoveredCell.loadPct;
                      const loadKips   = isMeshCell ? null : hoveredCell.loadKips;
                      const mCr = eccentricityResults.mCracking;
                      const qAllow = Number(activeGrid.qAllow);
                      return (
                        <g>
                          <text x="16" y="20" fill="#38bdf8" fontSize="11" fontWeight="700">
                            📍 {label}
                          </text>
                          <text x="16" y="40" fill="#f8fafc" fontSize="10.5">
                            {`Moment M = `}
                            <tspan fill={momentVal > mCr ? '#f59e0b' : '#10b981'} fontWeight="800">
                              {momentVal.toFixed(2)} k-ft/ft
                            </tspan>
                            {momentVal > mCr ? '  ⚠️ > Mcr' : '  ✅ Uncracked'}
                          </text>
                          <text x="16" y="58" fill="#f8fafc" fontSize="10.5">
                            {`Contact q = `}
                            <tspan fill={isTension ? '#f43f5e' : '#38bdf8'} fontWeight="800">
                              {qVal.toFixed(0)} psf
                            </tspan>
                            {isTension ? '  ⚠️ Tension Uplift' : '  ✅ Compression'}
                          </text>
                          <text x="300" y="40" fill="#f8fafc" fontSize="10.5">
                            {`Pile R = `}
                            <tspan fill={rVal > qAllow ? '#f43f5e' : rVal < 0 ? '#c084fc' : '#10b981'} fontWeight="800">
                              {rVal.toFixed(1)}k
                            </tspan>
                            {` / ${activeGrid.qAllow}k`}
                          </text>
                          {loadPct !== null && (
                            <text x="300" y="58" fill="#cbd5e1" fontSize="10.5">
                              {`Load = ${loadKips?.toFixed(1)}k (${loadPct?.toFixed(1)}% of P)`}
                            </text>
                          )}
                        </g>
                      );
                    })() : (
                      <g>
                        <text x="16" y="24" fill="var(--text-main)" fontSize="11.5" fontWeight="700">
                          🗺️ 50′ × 50′ Foundation Aerial Overview (Hover over any section above to inspect)
                        </text>
                        <text x="16" y="46" fill="#cbd5e1" fontSize="11">
                          Foundation Load: <tspan fill="#f8fafc" fontWeight="700">P = {totalDownwardLoadKips.toFixed(1)} kips</tspan>{'  '}•{'  '}Eccentricity: <tspan fill={eccentricityResults.isUplift ? '#f43f5e' : '#38bdf8'} fontWeight="700">e = {eccentricityResults.eMag.toFixed(2)}′</tspan>{'  '}(Mx = {eccentricityResults.Mx.toFixed(0)}k-ft, My = {eccentricityResults.My.toFixed(0)}k-ft)
                        </text>
                        <text x="16" y="66" fill="#cbd5e1" fontSize="11">
                          Middle-Third Kern: <tspan fill={eccentricityResults.isUplift ? '#f43f5e' : '#10b981'} fontWeight="700">{eccentricityResults.isUplift ? '❌ OUTSIDE KERN (UPLIFT)' : '✅ WITHIN KERN'}</tspan>{'  '}•{'  '}Max Pile: <tspan fill={eccentricityResults.overloadedCount > 0 ? '#f43f5e' : '#10b981'} fontWeight="700">{eccentricityResults.maxPileR.toFixed(1)}k</tspan> / {activeGrid.qAllow}k
                        </text>
                      </g>
                    )}
                  </g>
                </svg>

                {/* Selected Section / Quadrant Deep-Dive Panel */}
                {selectedSection && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '1rem 1.1rem',
                    background: 'rgba(15,23,42,0.92)',
                    border: `1.5px solid ${selectedSection.status === 'critical' ? 'rgba(244,63,94,0.55)' : selectedSection.status === 'warning' ? 'rgba(245,158,11,0.5)' : 'rgba(16,185,129,0.4)'}`,
                    borderRadius: '12px',
                    backdropFilter: 'blur(8px)'
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                          🔍 {selectedSection.name || selectedSection.id}
                        </span>
                        {selectedSection.tributaryArea && (
                          <span className="glass-badge" style={{ fontSize: '0.68rem', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.15)' }}>
                            {selectedSection.tributaryArea}
                          </span>
                        )}
                        <span
                          className="glass-badge"
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: selectedSection.status === 'critical' ? '#f43f5e' : selectedSection.status === 'warning' ? '#f59e0b' : '#10b981',
                            borderColor: selectedSection.status === 'critical' ? 'rgba(244,63,94,0.4)' : selectedSection.status === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'
                          }}
                        >
                          {selectedSection.status === 'critical' ? '⚠️ CRITICAL' : selectedSection.status === 'warning' ? '⚠️ WARNING' : '✅ OK'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}
                        onClick={() => setSelectedSectionId(null)}
                      >
                        ✕ Dismiss
                      </button>
                    </div>

                    {/* Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                      {/* Load Share */}
                      <div style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
                        <div className="text-xs text-muted" style={{ fontWeight: 600 }}>Load Share</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                          {selectedSection.loadKips?.toFixed(1)}k
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{selectedSection.loadPct?.toFixed(2)}% of P</div>
                      </div>

                      {/* Bending Moment */}
                      <div style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', background: selectedSection.isCracking ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)', border: `1px solid ${selectedSection.isCracking ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.2)'}` }}>
                        <div className="text-xs text-muted" style={{ fontWeight: 600 }}>Peak Moment M</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: selectedSection.isCracking ? '#f59e0b' : '#10b981', marginTop: '0.2rem' }}>
                          {(selectedSection.peakMoment ?? selectedSection.peakMoment ?? 0).toFixed(2)} k-ft/ft
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Mcr = {eccentricityResults.mCracking.toFixed(2)} k-ft/ft</div>
                      </div>

                      {/* Contact Pressure */}
                      <div style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', background: selectedSection.hasUplift ? 'rgba(168,85,247,0.1)' : 'rgba(56,189,248,0.08)', border: `1px solid ${selectedSection.hasUplift ? 'rgba(168,85,247,0.4)' : 'rgba(56,189,248,0.2)'}` }}>
                        <div className="text-xs text-muted" style={{ fontWeight: 600 }}>Avg Contact Stress q</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: selectedSection.hasUplift ? '#c084fc' : '#38bdf8', marginTop: '0.2rem' }}>
                          {(selectedSection.qAvgPsf ?? 0).toFixed(0)} psf
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{selectedSection.hasUplift ? '⚠️ Tension / Uplift' : 'Full Compression Contact'}</div>
                      </div>

                      {/* Pile Reactions */}
                      <div style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', background: selectedSection.hasPileOverload ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.08)', border: `1px solid ${selectedSection.hasPileOverload ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.2)'}` }}>
                        <div className="text-xs text-muted" style={{ fontWeight: 600 }}>Piles in Section</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: selectedSection.hasPileOverload ? '#f43f5e' : '#10b981', marginTop: '0.2rem' }}>
                          {selectedSection.pileCount} pile{selectedSection.pileCount !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Rmax = {(selectedSection.maxPileReaction ?? 0).toFixed(2)}k / {activeGrid.qAllow}k Qallow</div>
                      </div>

                      {/* Position */}
                      <div style={{ padding: '0.55rem 0.7rem', borderRadius: '8px', background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)' }}>
                        <div className="text-xs text-muted" style={{ fontWeight: 600 }}>Centroid (ft)</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
                          ({selectedSection.cx >= 0 ? '+' : ''}{selectedSection.cx?.toFixed(1)}′, {selectedSection.cy >= 0 ? '+' : ''}{selectedSection.cy?.toFixed(1)}′)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {selectedSection.quadId} Quadrant{selectedSection.colLetter ? ` • Col ${selectedSection.colLetter}, Row ${selectedSection.rowNumber}` : ''}
                        </div>
                      </div>

                      {/* Individual Bay Pile Table (sections16 only) */}
                      {selectedSection.bayPiles && selectedSection.bayPiles.length > 0 && (
                        <div style={{ gridColumn: '1 / -1', padding: '0.55rem 0.7rem', borderRadius: '8px', background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.18)' }}>
                          <div className="text-xs text-muted" style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Helical Piles in Bay {selectedSection.id}:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {selectedSection.bayPiles.map((p, idx) => (
                              <span
                                key={idx}
                                className="glass-badge"
                                style={{
                                  fontSize: '0.68rem',
                                  color: p.isOverloaded ? '#f43f5e' : p.isTension ? '#c084fc' : '#10b981',
                                  borderColor: p.isOverloaded ? 'rgba(244,63,94,0.4)' : p.isTension ? 'rgba(192,132,252,0.4)' : 'rgba(16,185,129,0.3)'
                                }}
                              >
                                Pile@({p.pxFt?.toFixed(1)}′, {p.pyFt?.toFixed(1)}′) R={p.reactionKips?.toFixed(1)}k
                                {p.isOverloaded ? ' ⚠️' : p.isTension ? ' ↑' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Stress Depth Profile */}
            {activeTab === 'stress' && (
              <svg
                viewBox="0 0 600 440"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                {/* Axes */}
                <line x1="80" y1="40" x2="80" y2="380" stroke="#64748b" strokeWidth="2" />
                <line x1="80" y1="380" x2="540" y2="380" stroke="#64748b" strokeWidth="2" />
                <text x="540" y="375" fill="#cbd5e1" fontSize="11" fontWeight="700">Stress (psf)</text>
                <text x="75" y="30" fill="#cbd5e1" fontSize="11" fontWeight="700" textAnchor="end">Depth z (ft)</text>

                {/* Depth Ticks */}
                {(() => {
                  const maxDepthAxis = Math.max(40, Math.ceil(pileDepthFt / 10) * 10);
                  const ticks = [];
                  for (let d = 0; d <= maxDepthAxis; d += maxDepthAxis / 4) ticks.push(Math.round(d));
                  return ticks.map((d) => {
                    const y = 40 + (d / maxDepthAxis) * 340;
                    return (
                      <g key={d}>
                        <line x1="75" y1={y} x2="85" y2={y} stroke="#64748b" strokeWidth="1.5" />
                        <text x="70" y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end">{d}′</text>
                      </g>
                    );
                  });
                })()}

                {/* Stresses Plot at GL, GWT, and Pile Tip */}
                {(() => {
                  const maxDepthAxis = Math.max(40, Math.ceil(pileDepthFt / 10) * 10);
                  const maxStress = Math.max(4000, sigmaV * 1.15);
                  const xForStress = (s) => 80 + (s / maxStress) * 440;
                  const yForDepth = (d) => 40 + (d / maxDepthAxis) * 340;

                  const yGL = yForDepth(0);
                  const yGWT = yForDepth(Math.min(maxDepthAxis, waterTableDepthFt));
                  const yPile = yForDepth(pileDepthFt);

                  // Stress at GL
                  const sigV_0 = surchargePsf;
                  const u_0 = 0;
                  const sigEff_0 = sigV_0;

                  // Stress at GWT
                  const sigV_GWT = surchargePsf + gammaDry * Math.min(pileDepthFt, waterTableDepthFt);
                  const u_GWT = 0;
                  const sigEff_GWT = sigV_GWT;

                  // Stress at Pile Tip
                  const sigV_Tip = sigmaV;
                  const u_Tip = porePressureU;
                  const sigEff_Tip = sigmaPrimeV;

                  return (
                    <g>
                      {/* Water Table Indicator Line */}
                      <line x1="80" y1={yGWT} x2="540" y2={yGWT} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5,4" />
                      <text x="535" y={yGWT - 6} fill="#38bdf8" fontSize="10" textAnchor="end">GWT = {waterTableDepthFt}′</text>

                      {/* Total Vertical Stress Path (Red) */}
                      <polyline
                        points={`
                          ${xForStress(sigV_0)},${yGL}
                          ${xForStress(sigV_GWT)},${yGWT}
                          ${xForStress(sigV_Tip)},${yPile}
                        `}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="3"
                      />

                      {/* Pore Pressure Path (Cyan) */}
                      <polyline
                        points={`
                          ${xForStress(u_0)},${yGL}
                          ${xForStress(u_GWT)},${yGWT}
                          ${xForStress(u_Tip)},${yPile}
                        `}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                      />

                      {/* Effective Stress Path (Emerald Green) */}
                      <polyline
                        points={`
                          ${xForStress(sigEff_0)},${yGL}
                          ${xForStress(sigEff_GWT)},${yGWT}
                          ${xForStress(sigEff_Tip)},${yPile}
                        `}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3.5"
                      />

                      {/* Point Markers at Bearing Depth */}
                      <circle cx={xForStress(sigV_Tip)} cy={yPile} r="5" fill="#f43f5e" />
                      <circle cx={xForStress(u_Tip)} cy={yPile} r="5" fill="#38bdf8" />
                      <circle cx={xForStress(sigEff_Tip)} cy={yPile} r="6" fill="#10b981" />

                      {/* Labels at Bearing Depth */}
                      <text x={xForStress(sigV_Tip) + 8} y={yPile - 4} fill="#f43f5e" fontSize="11" fontWeight="700">
                        σv = {sigV_Tip.toFixed(0)} psf
                      </text>
                      <text x={xForStress(sigEff_Tip) + 8} y={yPile + 14} fill="#10b981" fontSize="11" fontWeight="700">
                        σv′ = {sigEff_Tip.toFixed(0)} psf
                      </text>
                      <text x={xForStress(u_Tip) + 8} y={yPile + 4} fill="#38bdf8" fontSize="11" fontWeight="700">
                        u = {u_Tip.toFixed(0)} psf
                      </text>
                    </g>
                  );
                })()}

                {/* Legend */}
                <g transform="translate(180, 20)">
                  <line x1="0" y1="0" x2="25" y2="0" stroke="#f43f5e" strokeWidth="3" />
                  <text x="30" y="4" fill="#f43f5e" fontSize="11" fontWeight="600">Total Stress σv</text>

                  <line x1="140" y1="0" x2="165" y2="0" stroke="#38bdf8" strokeWidth="2.5" />
                  <text x="170" y="4" fill="#38bdf8" fontSize="11" fontWeight="600">Pore Pressure u</text>

                  <line x1="280" y1="0" x2="305" y2="0" stroke="#10b981" strokeWidth="3.5" />
                  <text x="310" y="4" fill="#10b981" fontSize="11" fontWeight="600">Effective Stress σv′</text>
                </g>
              </svg>
            )}
          </div>

          {/* Interactive Issue Diagnosis Console */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            padding: '1.25rem',
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            backdropFilter: 'var(--glass-blur)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🚨</span> Real-Time Foundation Health & Issue Diagnosis
              </h4>
              <span className="text-xs text-muted">
                Updates dynamically with any slider adjustment
              </span>
            </div>

            {/* 4 Health Status Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
              {/* 1. Kern Uplift */}
              <div style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '10px',
                background: eccentricityResults.isUplift ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${eccentricityResults.isUplift ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem'
              }}>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Middle-Third Kern</span>
                <strong style={{ fontSize: '0.85rem', color: eccentricityResults.isUplift ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                  {eccentricityResults.isUplift ? '❌ UPLIFT ACTIVE' : '✅ COMPLIANT'}
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  e = {eccentricityResults.eMag.toFixed(1)}′ / 8.3′
                </span>
              </div>

              {/* 2. Pile Compressive Capacity */}
              <div style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '10px',
                background: eccentricityResults.overloadedCount > 0 ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${eccentricityResults.overloadedCount > 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem'
              }}>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Helical Pile Limit</span>
                <strong style={{ fontSize: '0.85rem', color: eccentricityResults.overloadedCount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                  {eccentricityResults.overloadedCount > 0 ? `❌ ${eccentricityResults.overloadedCount} OVERLOADED` : '✅ ALL PILES OK'}
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Max: {eccentricityResults.maxPileR.toFixed(1)}k / {activeGrid.qAllow}k
                </span>
              </div>

              {/* 3. Slab Flexural Cracking */}
              <div style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '10px',
                background: eccentricityResults.isCracking ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${eccentricityResults.isCracking ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem'
              }}>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Concrete Cracking</span>
                <strong style={{ fontSize: '0.85rem', color: eccentricityResults.isCracking ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                  {eccentricityResults.isCracking ? '⚠️ CRACKING RISK' : '✅ UNCRACKED'}
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  M = {eccentricityResults.maxSlabMoment.toFixed(1)} / {eccentricityResults.mCracking.toFixed(1)} k-ft/ft
                </span>
              </div>

              {/* 4. Quadrant Symmetry */}
              <div style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '10px',
                background: eccentricityResults.issues.some(i => i.id === 'disparity') ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${eccentricityResults.issues.some(i => i.id === 'disparity') ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem'
              }}>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Quadrant Balance</span>
                <strong style={{ fontSize: '0.85rem', color: eccentricityResults.issues.some(i => i.id === 'disparity') ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                  {eccentricityResults.issues.some(i => i.id === 'disparity') ? '⚠️ ASYMMETRIC' : '✅ BALANCED'}
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Max Q: {Math.max(...eccentricityResults.quadrants.map(q => q.loadPct)).toFixed(0)}% share
                </span>
              </div>
            </div>

            {/* Active Issue Cards */}
            {eccentricityResults.issues.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.25rem' }}>
                {eccentricityResults.issues.map((issue) => (
                  <div
                    key={issue.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: issue.level === 'critical' ? 'rgba(244, 63, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      border: `1px solid ${issue.level === 'critical' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      borderLeft: `4px solid ${issue.color}`,
                      fontSize: '0.85rem',
                      lineHeight: 1.45
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong style={{ color: issue.color, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{issue.level === 'critical' ? '🚨' : '⚠️'}</span> {issue.title}
                      </strong>
                      <span className="glass-badge" style={{ fontSize: '0.65rem', color: issue.color, borderColor: issue.color }}>
                        {issue.badge}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.82rem' }}>
                      {issue.desc}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                fontSize: '0.82rem',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>✅</span>
                <span>
                  <strong>Optimal Foundation Performance:</strong> Load centroid is within the Middle-Third Kern boundary (e ≤ 8.33′). Full base compression is maintained, and all helical pile reactions are safely beneath the allowable capacity (Qallow = {activeGrid.qAllow} kips).
                </span>
              </div>
            )}
          </div>

          {/* 4 Quadrants Detailed Inspection Cards */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🧩</span> 50′ × 50′ Slab Quadrant & Section Performance
              </h4>
              <span className="text-xs text-muted">25′ × 25′ Quadrant Tributaries (625 sq ft each)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {eccentricityResults.quadrants.map((quad) => (
                <div
                  key={quad.id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: `1.5px solid ${quad.status === 'critical' ? 'var(--accent-rose)' : quad.status === 'warning' ? 'var(--accent-amber)' : 'var(--border-color)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: quad.color, fontSize: '0.9rem' }}>
                      {quad.name}
                    </span>
                    <span className="glass-badge" style={{
                      fontSize: '0.65rem',
                      color: quad.status === 'critical' ? 'var(--accent-rose)' : quad.status === 'warning' ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                      borderColor: quad.status === 'critical' ? 'rgba(244,63,94,0.4)' : quad.status === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.3)'
                    }}>
                      {quad.status === 'critical' ? 'CRITICAL' : quad.status === 'warning' ? 'ELEVATED' : 'SAFE'}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Tributary Load:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
                        {quad.loadKips.toFixed(1)}k ({quad.loadPct.toFixed(1)}%)
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Avg Soil Bearing:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: quad.qAvgPsf < 0 ? 'var(--accent-rose)' : '#38bdf8' }}>
                        {quad.qAvgPsf.toFixed(0)} psf
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Peak Slab Moment:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: quad.peakMoment > eccentricityResults.mCracking ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                        {quad.peakMoment.toFixed(2)} k-ft/ft
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Max Pile Reaction:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: quad.maxPileReaction > Number(activeGrid.qAllow) ? 'var(--accent-rose)' : '#f8fafc' }}>
                        {quad.maxPileReaction.toFixed(1)} kips
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mathematical Step-by-Step Derivation Breakdown */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            <div
              onClick={() => setShowDerivation(!showDerivation)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: showDerivation ? '1px solid var(--border-color)' : 'none'
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🧮</span> Step-by-Step Geotechnical Derivation & Numerical Substitution
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {showDerivation ? '▲ Collapse' : '▼ Expand'}
              </span>
            </div>

            {showDerivation && (
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                {/* Step 1 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '0.35rem' }}>
                    Step 1: Superstructure & Concrete Slab Dead Load
                  </div>
                  <div>
                    Slab Area: <code>50′ × 50′ = 2,500 sq ft</code><br />
                    Slab Self-Weight: <code>Wslab = 2,500 × ({slabThicknessInches} / 12) × {concreteDensityPcf} = {slabWeightLbs.toLocaleString()} lbs = {slabWeightKips.toFixed(1)} kips</code><br />
                    Surface Surcharge: <code>Qsurcharge = {surchargePsf} psf × 2,500 sq ft = {(surchargePsf * 2500).toLocaleString()} lbs = {surchargeTotalKips.toFixed(1)} kips</code><br />
                    <strong>Total Foundation Load: <code>Ptotal = {slabWeightKips.toFixed(1)} + {houseWeightKips} + {surchargeTotalKips.toFixed(1)} = {totalDownwardLoadKips.toFixed(1)} kips</code></strong>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.35rem' }}>
                    Step 2: Total Overburden Stress & Hydrostatic Pore Water Pressure
                  </div>
                  <div>
                    Depth in dry zone above GWT: <code>hdry = min({pileDepthFt}, {waterTableDepthFt}) = {depthAboveGwt} ft</code><br />
                    Depth in saturated zone below GWT: <code>hsat = max(0, {pileDepthFt} - {waterTableDepthFt}) = {depthBelowGwt} ft</code><br />
                    Total Vertical Stress: <code>σv = {surchargePsf} + ({gammaDry} × {depthAboveGwt}) + ({gammaSat} × {depthBelowGwt}) = {sigmaV.toFixed(1)} psf</code><br />
                    Hydrostatic Pore Water Pressure: <code>u = {depthBelowGwt} ft × 62.4 pcf = {porePressureU.toFixed(1)} psf</code><br />
                    <strong>Effective Vertical Stress: <code>σv′ = σv - u = {sigmaV.toFixed(1)} - {porePressureU.toFixed(1)} = {sigmaPrimeV.toFixed(1)} psf ({((sigmaPrimeV) / 1000).toFixed(3)} ksf)</code></strong>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.35rem' }}>
                    Step 3: Helical Pile Individual Bearing Capacity ({isBoringReport ? 'Geotechnical Soil Boring Log' : 'Terzaghi / Meyerhof Model'})
                  </div>
                  <div>
                    {isBoringReport ? (
                      <>
                        Direct Soil Boring Report Capacity: <code>qult = {boringReportQUltKsf} ksf = {(boringReportQUltKsf * 1000).toLocaleString()} psf</code><br />
                        Helix Projected Area: <code>Ah = (π/4) × ({helixDiameterInches} / 12)² = {helixAreaSqFt.toFixed(3)} sq ft</code><br />
                        Single Helix Capacity: <code>Qult,1 = {helixAreaSqFt.toFixed(3)} sq ft × {(boringReportQUltKsf * 1000).toLocaleString()} psf = {singleHelixUltKips.toFixed(1)} kips</code><br />
                        <strong>Total Ultimate Pile Capacity ({helixCount} {helixCount === 1 ? 'helix' : 'helices'}): <code>Qult = {pileUltCapacityKips.toFixed(1)} kips / pile</code></strong>
                      </>
                    ) : (
                      <>
                        Bearing capacity factors for φ′ = {phi}°: <code>Nq = {nq.toFixed(2)}, Nc = {nc.toFixed(2)}</code><br />
                        Helix Projected Area: <code>Ah = (π/4) × ({helixDiameterInches} / 12)² = {helixAreaSqFt.toFixed(3)} sq ft</code><br />
                        Unit Ultimate Bearing Capacity: <code>qult = ({c} × {nc.toFixed(2)}) + ({sigmaPrimeV.toFixed(1)} × {nq.toFixed(2)}) = {qUltPsf.toFixed(0)} psf ({qUltKsf.toFixed(2)} ksf)</code><br />
                        <strong>Ultimate Pile Capacity ({helixCount} {helixCount === 1 ? 'helix' : 'helices'}): <code>Qult = {helixCount} × {helixAreaSqFt.toFixed(3)} sq ft × {qUltPsf.toFixed(0)} psf = {pileUltCapacityKips.toFixed(1)} kips</code></strong>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '0.35rem' }}>
                    Step 4: Safety Factor Matrix Sizing ({activeGrid.label})
                  </div>
                  <div>
                    Allowable Pile Capacity: <code>Qallow = {pileUltCapacityKips.toFixed(1)} kips / {activeGrid.sf} = {activeGrid.qAllow} kips</code><br />
                    Minimum Piles Required: <code>Nreq = ⌈{totalDownwardLoadKips.toFixed(1)} / {activeGrid.qAllow}⌉ = {activeGrid.nReq} piles</code><br />
                    Square Foundation Grid: <code>k = ⌈√{activeGrid.nReq}⌉ = {activeGrid.gridK} ➔ {activeGrid.gridK} × {activeGrid.gridK} = {activeGrid.nInstalled} piles installed</code><br />
                    <strong>On-Center Pile Spacing: <code>S = 50 ft / ({activeGrid.gridK} - 1) = {activeGrid.spacingFt} ft O.C.</code></strong> (Operating SF = {activeGrid.operatingSf})
                  </div>
                </div>

                {/* Step 5 */}
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-rose, #f43f5e)', marginBottom: '0.35rem' }}>
                    Step 5: Slab Eccentricity, Overturning Moments & Middle-Third Kern Limit
                  </div>
                  <div>
                    Biaxial Eccentricity: <code>ex = {eccentricityX} ft, ey = {eccentricityY} ft ➔ e = √({eccentricityX}² + {eccentricityY}²) = {eccentricityResults.eMag.toFixed(2)} ft</code><br />
                    Overturning Moments: <code>Mx = Ptotal × ey = {totalDownwardLoadKips.toFixed(1)} × {eccentricityY} = {eccentricityResults.Mx.toFixed(1)} kip-ft</code>, <code>My = Ptotal × ex = {totalDownwardLoadKips.toFixed(1)} × {eccentricityX} = {eccentricityResults.My.toFixed(1)} kip-ft</code> (Mres = {eccentricityResults.Mres.toFixed(1)} kip-ft)<br />
                    Middle-Third Kern Boundary: <code>|ex|/(B/6) + |ey|/(L/6) = {((Math.abs(eccentricityX) + Math.abs(eccentricityY)) / (50 / 6)).toFixed(2)} {eccentricityResults.isUplift ? '> 1.0 (⚠️ TENSION UPLIFT EXCEEDED)' : '≤ 1.0 (✅ Full Slab Base Compression)'}</code><br />
                    Extreme Contact Stresses: <code>qmax = {eccentricityResults.qMax.toFixed(0)} psf, qmin = {eccentricityResults.qMin.toFixed(0)} psf</code> ({eccentricityResults.qMin < 0 ? 'Negative stress indicates edge tension liftoff!' : 'Compressive across entire 2,500 sq ft footprint'})<br />
                    Critical Helical Pile Reaction: <code>Rmax = {eccentricityResults.maxPileR.toFixed(1)} kips {eccentricityResults.maxPileR > Number(activeGrid.qAllow) ? `(⚠️ Exceeds Qallow = ${activeGrid.qAllow} kips)` : `(✅ Safe ≤ Qallow = ${activeGrid.qAllow} kips)`}</code><br />
                    Plain Concrete Cracking Moment: <code>Mcr = 0.07906 × t² = {eccentricityResults.mCracking.toFixed(2)} kip-ft/ft</code> vs Peak Flexural Moment <code>Mmax = {eccentricityResults.maxSlabMoment.toFixed(2)} kip-ft/ft</code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // If fullscreen is active, render via Portal
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

      {/* Render practice problem viewer if problem is passed */}
      {problem && <GenericProblemViewer problem={problem} key={problem.id} />}
    </>
  );
};

export default HelicalHouseVisualizer;
