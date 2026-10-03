import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

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

// Radionuclides of Prime Nuclear Engineering & Drinking Water Importance
const RADIONUCLIDES = {
  U235: {
    symbol: '²³⁵U',
    element: 'Uranium-235',
    atomicNumber: 92,
    massNumber: 235,
    halfLife: '7.04 × 10⁸ years',
    halfLifeSec: 2.22e16,
    decayMode: 'Alpha (α) / Spontaneous Fission',
    decayEnergyMev: 4.679,
    decayConstYr: '9.85 × 10⁻¹⁰ yr⁻¹',
    nuclearRole: 'Primary fissile nuclear reactor fuel (0.72% natural abundance). Thermal fission cross section σf = 585 barns.',
    fissionEnergy: '~200 MeV per fission event; 2.43 neutrons emitted per fission.',
    waterHazard: 'Heavy metal nephrotoxicity & radiological risk. EPA Drinking Water MCL = 30 µg/L.',
    family: 'Actinide'
  },
  U238: {
    symbol: '²³⁸U',
    element: 'Uranium-238',
    atomicNumber: 92,
    massNumber: 238,
    halfLife: '4.468 × 10⁹ years',
    halfLifeSec: 1.41e17,
    decayMode: 'Alpha (α)',
    decayEnergyMev: 4.270,
    decayConstYr: '1.55 × 10⁻¹⁰ yr⁻¹',
    nuclearRole: 'Fertile isotope (99.27% of natural U). Breeds into fissile ²³⁹Pu via neutron capture in fast breeders.',
    fissionEnergy: 'Fast fission only (threshold ~1 MeV). Major source of internal Earth geothermal heat.',
    waterHazard: 'EPA Drinking Water MCL = 30 µg/L (combined uranium).',
    family: 'Actinide'
  },
  Pu239: {
    symbol: '²³⁹Pu',
    element: 'Plutonium-239',
    atomicNumber: 94,
    massNumber: 239,
    halfLife: '24,110 years',
    halfLifeSec: 7.61e11,
    decayMode: 'Alpha (α)',
    decayEnergyMev: 5.244,
    decayConstYr: '2.87 × 10⁻⁵ yr⁻¹',
    nuclearRole: 'Key fissile isotope created in reactors: ²³⁸U + n → ²³⁹U → ²³⁹Np → ²³⁹Pu. σf = 747 barns.',
    fissionEnergy: 'Yields 2.89 neutrons per thermal fission event; fundamental in MOX nuclear fuel.',
    waterHazard: 'Severe alpha bone/liver carcinogen if ingested or inhaled.',
    family: 'Actinide'
  },
  Ra226: {
    symbol: '²²⁶Ra',
    element: 'Radium-226',
    atomicNumber: 88,
    massNumber: 226,
    halfLife: '1,600 years',
    halfLifeSec: 5.05e10,
    decayMode: 'Alpha (α)',
    decayEnergyMev: 4.871,
    decayConstYr: '4.33 × 10⁻⁴ yr⁻¹',
    nuclearRole: 'Decay daughter of ²³⁸U chain. Group 2 alkaline earth metal: chemically behaves identical to Ca²⁺ and Mg²⁺!',
    fissionEnergy: 'Decays to radioactive noble gas Radon-222 (²²²Rn).',
    waterHazard: 'EPA Drinking Water MCL = 5.0 pCi/L (combined ²²⁶Ra + ²²⁸Ra). Removed by cation exchange water softening!',
    family: 'Alkaline Earth'
  },
  Rn222: {
    symbol: '²²²Rn',
    element: 'Radon-222',
    atomicNumber: 86,
    massNumber: 222,
    halfLife: '3.823 days',
    halfLifeSec: 3.30e5,
    decayMode: 'Alpha (α)',
    decayEnergyMev: 5.590,
    decayConstYr: '66.1 yr⁻¹',
    nuclearRole: 'Radioactive noble gas; daughter of ²²⁶Ra. Emanates from granite and bedrock groundwater into homes.',
    fissionEnergy: 'Alpha emitter with short-lived daughters (²¹⁸Po, ²¹⁴Po). Primary cause of lung cancer in non-smokers.',
    waterHazard: 'EPA proposed drinking water MCL = 300 to 4,000 pCi/L. Remediated by packed-tower aeration or GAC.',
    family: 'Noble Gas'
  },
  Cs137: {
    symbol: '¹³⁷Cs',
    element: 'Cesium-137',
    atomicNumber: 55,
    massNumber: 137,
    halfLife: '30.17 years',
    halfLifeSec: 9.52e8,
    decayMode: 'Beta (β⁻) / Gamma (γ)',
    decayEnergyMev: 1.176,
    decayConstYr: '0.0230 yr⁻¹',
    nuclearRole: 'Major high-yield fission product (6.09% yield in ²³⁵U fission). Gamma emission at 661.7 keV from ¹³⁷ᵐBa.',
    fissionEnergy: 'Dominant long-term radiation hazard in spent nuclear fuel pools and Chernobyl/Fukushima runoff.',
    waterHazard: 'Group 1 alkali metal: highly soluble in water, behaves like K⁺, distributes uniformly in biological soft tissue.',
    family: 'Alkali Metal'
  },
  Sr90: {
    symbol: '⁹⁰Sr',
    element: 'Strontium-90',
    atomicNumber: 38,
    massNumber: 90,
    halfLife: '28.9 years',
    halfLifeSec: 9.12e8,
    decayMode: 'Beta (β⁻)',
    decayEnergyMev: 0.546,
    decayConstYr: '0.0240 yr⁻¹',
    nuclearRole: 'High-yield fission product (5.8% yield). Group 2 alkaline earth metal: severe "bone seeker" mimicking calcium!',
    fissionEnergy: 'Decays to Yttrium-90 (⁹⁰Y, t1/2 = 64 hr, high energy β⁻ 2.28 MeV).',
    waterHazard: 'EPA Drinking Water MCL = 8.0 pCi/L. Can be removed using lime-soda water softening or zeolite ion exchange.',
    family: 'Alkaline Earth'
  },
  I131: {
    symbol: '¹³¹I',
    element: 'Iodine-131',
    atomicNumber: 53,
    massNumber: 131,
    halfLife: '8.02 days',
    halfLifeSec: 6.93e5,
    decayMode: 'Beta (β⁻) / Gamma (γ)',
    decayEnergyMev: 0.971,
    decayConstYr: '31.5 yr⁻¹',
    nuclearRole: 'Volatile fission product (2.9% yield). Major biological hazard in immediate aftermath of reactor accidents.',
    fissionEnergy: 'Concentrates rapidly in the human thyroid gland. Blocked prophylactically by potassium iodide (KI) tablets.',
    waterHazard: 'EPA Drinking Water MCL = 3.0 pCi/L. Removed by granular activated carbon and reverse osmosis.',
    family: 'Halogen'
  },
  Co60: {
    symbol: '⁶⁰Co',
    element: 'Cobalt-60',
    atomicNumber: 27,
    massNumber: 60,
    halfLife: '5.27 years',
    halfLifeSec: 1.66e8,
    decayMode: 'Beta (β⁻) / Strong Gamma (γ)',
    decayEnergyMev: 2.824,
    decayConstYr: '0.131 yr⁻¹',
    nuclearRole: 'Produced by neutron activation of structural steel: ⁵⁹Co(n,γ)⁶⁰Co. Emits two cascade gammas: 1.17 and 1.33 MeV.',
    fissionEnergy: 'Industrial gamma radiography, medical radiotherapy, and food sterilization source.',
    waterHazard: 'Corrosion product in nuclear power plant cooling loops (BWR/PWR primary coolant filtration).',
    family: 'Transition Metal'
  },
  H3: {
    symbol: '³H (Tritium)',
    element: 'Hydrogen-3',
    atomicNumber: 1,
    massNumber: 3,
    halfLife: '12.32 years',
    halfLifeSec: 3.89e8,
    decayMode: 'Beta (β⁻)',
    decayEnergyMev: 0.0186,
    decayConstYr: '0.0563 yr⁻¹',
    nuclearRole: 'Nuclear fusion fuel (D-T fusion reaction: ²H + ³H → ⁴He + n + 17.6 MeV). Produced in CANDU heavy water reactors.',
    fissionEnergy: 'Extremely soft beta emitter (Emax = 18.6 keV, average 5.7 keV; stopped by 6 mm of air).',
    waterHazard: 'Forms tritiated water (HTO), chemically identical to H₂O, cannot be removed by normal filtration! EPA MCL = 20,000 pCi/L.',
    family: 'Reactive Nonmetal'
  }
};

// Selected Periodic Elements with Family Data & Periodic Properties
const PERIODIC_ELEMENTS = [
  // Period 1
  { z: 1, symbol: 'H', name: 'Hydrogen', group: 1, period: 1, family: 'nonmetal', mass: 1.008, radius: 53, ie: 1312, en: 2.20, ea: 73 },
  { z: 2, symbol: 'He', name: 'Helium', group: 18, period: 1, family: 'noble', mass: 4.003, radius: 31, ie: 2372, en: 0, ea: 0 },
  // Period 2
  { z: 3, symbol: 'Li', name: 'Lithium', group: 1, period: 2, family: 'alkali', mass: 6.94, radius: 152, ie: 520, en: 0.98, ea: 60 },
  { z: 4, symbol: 'Be', name: 'Beryllium', group: 2, period: 2, family: 'alkaline-earth', mass: 9.012, radius: 112, ie: 899, en: 1.57, ea: 0 },
  { z: 5, symbol: 'B', name: 'Boron', group: 13, period: 2, family: 'metalloid', mass: 10.81, radius: 85, ie: 801, en: 2.04, ea: 27 },
  { z: 6, symbol: 'C', name: 'Carbon', group: 14, period: 2, family: 'nonmetal', mass: 12.011, radius: 77, ie: 1086, en: 2.55, ea: 122 },
  { z: 7, symbol: 'N', name: 'Nitrogen', group: 15, period: 2, family: 'nonmetal', mass: 14.007, radius: 75, ie: 1402, en: 3.04, ea: 7 },
  { z: 8, symbol: 'O', name: 'Oxygen', group: 16, period: 2, family: 'nonmetal', mass: 15.999, radius: 73, ie: 1314, en: 3.44, ea: 141 },
  { z: 9, symbol: 'F', name: 'Fluorine', group: 17, period: 2, family: 'halogen', mass: 18.998, radius: 71, ie: 1681, en: 3.98, ea: 328 },
  { z: 10, symbol: 'Ne', name: 'Neon', group: 18, period: 2, family: 'noble', mass: 20.180, radius: 38, ie: 2081, en: 0, ea: 0 },
  // Period 3
  { z: 11, symbol: 'Na', name: 'Sodium', group: 1, period: 3, family: 'alkali', mass: 22.990, radius: 186, ie: 496, en: 0.93, ea: 53 },
  { z: 12, symbol: 'Mg', name: 'Magnesium', group: 2, period: 3, family: 'alkaline-earth', mass: 24.305, radius: 160, ie: 738, en: 1.31, ea: 0 },
  { z: 13, symbol: 'Al', name: 'Aluminum', group: 13, period: 3, family: 'post-transition', mass: 26.982, radius: 143, ie: 578, en: 1.61, ea: 43 },
  { z: 14, symbol: 'Si', name: 'Silicon', group: 14, period: 3, family: 'metalloid', mass: 28.085, radius: 118, ie: 786, en: 1.90, ea: 134 },
  { z: 15, symbol: 'P', name: 'Phosphorus', group: 15, period: 3, family: 'nonmetal', mass: 30.974, radius: 110, ie: 1012, en: 2.19, ea: 72 },
  { z: 16, symbol: 'S', name: 'Sulfur', group: 16, period: 3, family: 'nonmetal', mass: 32.06, radius: 103, ie: 1000, en: 2.58, ea: 200 },
  { z: 17, symbol: 'Cl', name: 'Chlorine', group: 17, period: 3, family: 'halogen', mass: 35.45, radius: 99, ie: 1251, en: 3.16, ea: 349 },
  { z: 18, symbol: 'Ar', name: 'Argon', group: 18, period: 3, family: 'noble', mass: 39.948, radius: 71, ie: 1521, en: 0, ea: 0 },
  // Period 4 Key Elements
  { z: 19, symbol: 'K', name: 'Potassium', group: 1, period: 4, family: 'alkali', mass: 39.098, radius: 227, ie: 419, en: 0.82, ea: 48 },
  { z: 20, symbol: 'Ca', name: 'Calcium', group: 2, period: 4, family: 'alkaline-earth', mass: 40.078, radius: 197, ie: 590, en: 1.00, ea: 2 },
  { z: 26, symbol: 'Fe', name: 'Iron', group: 8, period: 4, family: 'transition', mass: 55.845, radius: 126, ie: 762, en: 1.83, ea: 16 },
  { z: 27, symbol: 'Co', name: 'Cobalt', group: 9, period: 4, family: 'transition', mass: 58.933, radius: 125, ie: 760, en: 1.88, ea: 64 },
  { z: 29, symbol: 'Cu', name: 'Copper', group: 11, period: 4, family: 'transition', mass: 63.546, radius: 128, ie: 745, en: 1.90, ea: 119 },
  { z: 30, symbol: 'Zn', name: 'Zinc', group: 12, period: 4, family: 'transition', mass: 65.38, radius: 134, ie: 906, en: 1.65, ea: 0 },
  { z: 35, symbol: 'Br', name: 'Bromine', group: 17, period: 4, family: 'halogen', mass: 79.904, radius: 114, ie: 1140, en: 2.96, ea: 325 },
  { z: 36, symbol: 'Kr', name: 'Krypton', group: 18, period: 4, family: 'noble', mass: 83.798, radius: 88, ie: 1351, en: 3.00, ea: 0 },
  // Period 5 Key Elements
  { z: 38, symbol: 'Sr', name: 'Strontium', group: 2, period: 5, family: 'alkaline-earth', mass: 87.62, radius: 215, ie: 549, en: 0.95, ea: 5 },
  { z: 53, symbol: 'I', name: 'Iodine', group: 17, period: 5, family: 'halogen', mass: 126.90, radius: 133, ie: 1008, en: 2.66, ea: 295 },
  { z: 54, symbol: 'Xe', name: 'Xenon', group: 18, period: 5, family: 'noble', mass: 131.29, radius: 108, ie: 1170, en: 2.60, ea: 0 },
  // Period 6 Key Elements
  { z: 55, symbol: 'Cs', name: 'Cesium', group: 1, period: 6, family: 'alkali', mass: 132.91, radius: 265, ie: 376, en: 0.79, ea: 46 },
  { z: 56, symbol: 'Ba', name: 'Barium', group: 2, period: 6, family: 'alkaline-earth', mass: 137.33, radius: 222, ie: 503, en: 0.89, ea: 14 },
  { z: 82, symbol: 'Pb', name: 'Lead', group: 14, period: 6, family: 'post-transition', mass: 207.2, radius: 175, ie: 716, en: 2.33, ea: 35 },
  { z: 86, symbol: 'Rn', name: 'Radon', group: 18, period: 6, family: 'noble', mass: 222.0, radius: 120, ie: 1037, en: 2.20, ea: 0 },
  // Period 7 Key Elements (Actinides & Heavy)
  { z: 88, symbol: 'Ra', name: 'Radium', group: 2, period: 7, family: 'alkaline-earth', mass: 226.0, radius: 220, ie: 509, en: 0.90, ea: 10 },
  { z: 90, symbol: 'Th', name: 'Thorium', group: 3, period: 7, family: 'actinide', mass: 232.04, radius: 180, ie: 587, en: 1.30, ea: 0 },
  { z: 92, symbol: 'U', name: 'Uranium', group: 3, period: 7, family: 'actinide', mass: 238.03, radius: 175, ie: 598, en: 1.38, ea: 0 },
  { z: 94, symbol: 'Pu', name: 'Plutonium', group: 3, period: 7, family: 'actinide', mass: 244.0, radius: 175, ie: 585, en: 1.28, ea: 0 }
];

const FAMILY_COLORS = {
  'alkali': { bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444', text: '#fca5a5', name: 'Alkali Metals' },
  'alkaline-earth': { bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', text: '#fcd34d', name: 'Alkaline Earth (Ca, Mg, Ra)' },
  'transition': { bg: 'rgba(56, 189, 248, 0.25)', border: '#38bdf8', text: '#7dd3fc', name: 'Transition Metals' },
  'post-transition': { bg: 'rgba(99, 102, 241, 0.25)', border: '#6366f1', text: '#a5b4fc', name: 'Post-Transition' },
  'metalloid': { bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', text: '#6ee7b7', name: 'Metalloids' },
  'nonmetal': { bg: 'rgba(6, 182, 212, 0.25)', border: '#06b6d4', text: '#67e8f9', name: 'Reactive Nonmetals' },
  'halogen': { bg: 'rgba(236, 72, 153, 0.25)', border: '#ec4899', text: '#f472b6', name: 'Halogens' },
  'noble': { bg: 'rgba(168, 85, 247, 0.25)', border: '#a855f7', text: '#d8b4fe', name: 'Noble Gases' },
  'actinide': { bg: 'rgba(225, 29, 72, 0.25)', border: '#e11d48', text: '#fda4af', name: 'Actinides (U, Pu, Th)' }
};

const HardnessVisualizer = ({ problem }) => {
  // Determine initial mode:
  // Problem 86 -> '3d-hardness'
  // Problem 87/88/89 -> 'meq-chemistry'
  // Problem 93 -> 'periodic-nuclear'
  const initialMode = useMemo(() => {
    if (problem?.id === 93) return 'periodic-nuclear';
    if (problem?.id === 87 || problem?.id === 88 || problem?.id === 89) return 'meq-chemistry';
    return '3d-hardness';
  }, [problem?.id]);

  const [activeTab, setActiveTab] = useState(initialMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTheory, setShowTheory] = useState(true);

  // Synchronize active tab whenever a different problem is selected
  useEffect(() => {
    if (problem?.id === 93) {
      setActiveTab('periodic-nuclear');
    } else if (problem?.id === 87 || problem?.id === 88 || problem?.id === 89) {
      setActiveTab('meq-chemistry');
    } else if (problem?.id === 86) {
      setActiveTab('3d-hardness');
    }
  }, [problem?.id]);

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
    let carbonateHardness = 0;
    let nonCarbonateHardness = 0;

    if (alkalinityMgL < totalHardness) {
      carbonateHardness = alkalinityMgL;
      nonCarbonateHardness = totalHardness - alkalinityMgL;
    } else {
      carbonateHardness = totalHardness;
      nonCarbonateHardness = 0;
    }

    // Classification
    let classification = 'Soft';
    let classColor = '#10b981';
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
      const rotY = rotationRef.current.rotY + (rotationRef.current.isDragging ? 0 : 0.003); // gentle auto rotation

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
  }, [activeTab, caMgL, mgMgL, soapActive, heatBoiling, resinSoftened]);

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
    const limeDoseCaCO3 = freeCo2MgL + carbonateHardness + mgHardness + excessLimeDose;
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

  // =========================================================================
  // TAB 3: PERIODIC TABLE & NUCLEAR RADIONUCLIDES STATE
  // =========================================================================
  const [selectedElement, setSelectedElement] = useState(PERIODIC_ELEMENTS.find(e => e.symbol === 'U'));
  const [selectedNuclideKey, setSelectedNuclideKey] = useState('U235');
  const [nuclideFilter, setNuclideFilter] = useState('all'); // 'all' | 'radionuclide' | 'fuel' | 'drinking-water'
  const [trendMetric, setTrendMetric] = useState('radius'); // 'radius' | 'ie' | 'en' | 'ea'

  const activeNuclide = RADIONUCLIDES[selectedNuclideKey] || RADIONUCLIDES['U235'];

  // Trend Metadata
  const TREND_LABELS = {
    radius: { name: 'Atomic Radius (Size)', unit: 'pm', desc: 'Decreases across a period (increasing nuclear charge), increases down a group (extra shell).' },
    ie: { name: 'First Ionization Energy', unit: 'kJ/mol', desc: 'Energy to remove an electron. Peaks at noble gases (He = 2372 kJ/mol), valleys at alkali metals.' },
    en: { name: 'Electronegativity (Pauling)', unit: '', desc: 'Atom pulling power for bonding electrons. Peaks at Fluorine (3.98), valleys at Francium (0.7).' },
    ea: { name: 'Electron Affinity', unit: 'kJ/mol', desc: 'Energy released when adding an electron. Halogens have the highest affinities (Cl = 349 kJ/mol).' }
  };

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
                  : '118-element periodic grid, nuclear decay energies (Q-value), radioactive half-lives, and graphical family periodic trends.')}
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

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>4. Noncarbonate Hardness (Soda Ash):</div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <span>Plant Flow: <strong>{plantFlowMgd} MGD</strong></span>
                  <span>Excess Lime: <strong>{excessLimeDose} mg/L</strong></span>
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

      {/* ===================================================================== */}
      {/* TAB 3: INTERACTIVE PERIODIC TABLE & NUCLEAR RADIONUCLIDES             */}
      {/* ===================================================================== */}
      {activeTab === 'periodic-nuclear' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            {/* Filter Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Filter Table:</span>
              {[
                { id: 'all', label: 'All Elements' },
                { id: 'radionuclide', label: 'Radionuclides & Isotopes' },
                { id: 'fuel', label: 'Reactor Fuels (U, Pu, Th)' },
                { id: 'drinking-water', label: 'Drinking Water MCLs' }
              ].map((f) => (
                <button
                  key={f.id}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    border: nuclideFilter === f.id ? '1px solid var(--accent-purple)' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: nuclideFilter === f.id ? 'rgba(168, 85, 247, 0.25)' : 'rgba(0, 0, 0, 0.2)',
                    color: nuclideFilter === f.id ? 'var(--accent-purple)' : 'var(--text-main)',
                    fontWeight: nuclideFilter === f.id ? 700 : 500,
                    cursor: 'pointer'
                  }}
                  onClick={() => setNuclideFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Periodic Trend Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Family Trend:</span>
              <select
                value={trendMetric}
                onChange={(e) => setTrendMetric(e.target.value)}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  color: 'var(--text-main)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem'
                }}
              >
                <option value="radius">Atomic Radius (Size)</option>
                <option value="ie">First Ionization Energy</option>
                <option value="en">Electronegativity (Pauling)</option>
                <option value="ea">Electron Affinity</option>
              </select>
            </div>
          </div>

          {/* Interactive Periodic Grid */}
          <div style={{
            background: 'radial-gradient(ellipse at center, rgba(12, 25, 45, 0.8) 0%, rgba(7, 12, 22, 0.95) 100%)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--accent-purple)' }}>
                Periodic Table of the Elements & Nuclear Isotopes
              </strong>
              <span className="text-xs text-muted">
                Click any element tile to inspect nuclear decay energies & properties
              </span>
            </div>

            {/* Grid Layout of Elements */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(18, minmax(28px, 1fr))',
              gap: '4px',
              overflowX: 'auto',
              paddingBottom: '0.5rem'
            }}>
              {PERIODIC_ELEMENTS.map((el) => {
                const isSelected = selectedElement?.z === el.z;
                const fam = FAMILY_COLORS[el.family] || FAMILY_COLORS['nonmetal'];
                const isRadioactive = el.z >= 84 || el.z === 43 || el.z === 61;
                const isSpecialNuclide = Object.values(RADIONUCLIDES).some(r => r.atomicNumber === el.z);

                // Trend value
                const trendVal = el[trendMetric] || 0;

                return (
                  <div
                    key={el.z}
                    style={{
                      gridColumn: el.group,
                      gridRow: el.period,
                      minHeight: '44px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--accent-purple)' : fam.bg,
                      border: isSelected ? '2px solid #ffffff' : (isSpecialNuclide ? '2px solid #e11d48' : `1px solid ${fam.border}`),
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      padding: '2px',
                      position: 'relative'
                    }}
                    onClick={() => {
                      setSelectedElement(el);
                      // Check if matches a known radionuclide
                      const matchedKey = Object.keys(RADIONUCLIDES).find(k => RADIONUCLIDES[k].atomicNumber === el.z);
                      if (matchedKey) setSelectedNuclideKey(matchedKey);
                    }}
                    title={`${el.name} (Z = ${el.z}): ${TREND_LABELS[trendMetric].name} = ${trendVal} ${TREND_LABELS[trendMetric].unit}`}
                  >
                    <span style={{ fontSize: '0.6rem', color: isSelected ? '#fff' : 'var(--text-dim)', alignSelf: 'flex-start', lineHeight: 1 }}>
                      {el.z}
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: isSelected ? '#070a12' : '#ffffff', lineHeight: 1 }}>
                      {el.symbol}
                    </strong>
                    <span style={{ fontSize: '0.55rem', color: isSelected ? '#070a12' : fam.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {trendVal}
                    </span>
                    {isSpecialNuclide && (
                      <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#e11d48',
                        boxShadow: '0 0 6px #e11d48'
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Element Family Legend */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap', fontSize: '0.7rem' }}>
              {Object.keys(FAMILY_COLORS).map((k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: FAMILY_COLORS[k].bg, border: `1px solid ${FAMILY_COLORS[k].border}` }} />
                  <span style={{ color: 'var(--text-muted)' }}>{FAMILY_COLORS[k].name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Nuclear Radionuclide Inspector & Graphical Trend Curve */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.15fr) minmax(320px, 1fr)',
            gap: '1.25rem',
            alignItems: 'start'
          }}>
            {/* Selected Radionuclide Engineering Card */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '14px',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              padding: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>
                      {activeNuclide.symbol}
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      {activeNuclide.element} (Z = {activeNuclide.atomicNumber})
                    </strong>
                  </div>
                  <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
                    Family: <strong style={{ color: 'var(--accent-cyan)' }}>{activeNuclide.family}</strong>
                  </span>
                </div>

                {/* Radionuclide Picker */}
                <select
                  value={selectedNuclideKey}
                  onChange={(e) => setSelectedNuclideKey(e.target.value)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    color: 'var(--text-main)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.78rem'
                  }}
                >
                  {Object.keys(RADIONUCLIDES).map((key) => (
                    <option key={key} value={key}>
                      {RADIONUCLIDES[key].symbol} - {RADIONUCLIDES[key].element}
                    </option>
                  ))}
                </select>
              </div>

              {/* KPI Badges */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                margin: '1rem 0'
              }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs text-muted" style={{ display: 'block' }}>Decay Mode:</span>
                  <strong style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>{activeNuclide.decayMode}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs text-muted" style={{ display: 'block' }}>Half-Life (T₁/₂):</span>
                  <strong style={{ color: 'var(--accent-amber)', fontSize: '0.85rem' }}>{activeNuclide.halfLife}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs text-muted" style={{ display: 'block' }}>Decay Energy (Q):</span>
                  <strong style={{ color: 'var(--accent-emerald)', fontSize: '0.85rem' }}>{activeNuclide.decayEnergyMev} MeV</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs text-muted" style={{ display: 'block' }}>Decay Const (λ):</span>
                  <strong style={{ color: 'var(--accent-blue)', fontSize: '0.85rem' }}>{activeNuclide.decayConstYr}</strong>
                </div>
              </div>

              {/* Technical Description */}
              <div style={{ fontSize: '0.78rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '0.6rem', borderRadius: '6px' }}>
                  <strong style={{ color: 'var(--accent-purple)' }}>Nuclear Engineering Role:</strong> {activeNuclide.nuclearRole}
                </div>
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.6rem', borderRadius: '6px' }}>
                  <strong style={{ color: 'var(--accent-blue)' }}>Fission / Reaction Energetics:</strong> {activeNuclide.fissionEnergy}
                </div>
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', padding: '0.6rem', borderRadius: '6px' }}>
                  <strong style={{ color: 'var(--accent-rose)' }}>Drinking Water / Environmental Limit:</strong> {activeNuclide.waterHazard}
                </div>
              </div>
            </div>

            {/* Graphical Periodic Trend Chart */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              padding: '1.25rem'
            }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', display: 'block', marginBottom: '0.25rem' }}>
                Periodic Trend Curve: {TREND_LABELS[trendMetric].name}
              </strong>
              <p className="text-xs text-muted" style={{ margin: '0 0 0.75rem 0' }}>
                {TREND_LABELS[trendMetric].desc}
              </p>

              {/* Trend SVG Chart */}
              <svg viewBox="0 0 460 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* Background Grid & Period Bands */}
                <rect x="40" y="20" width="400" height="160" fill="rgba(0,0,0,0.3)" rx="6" />

                {/* Period demarcation lines */}
                {[
                  { z: 2, label: 'P1' },
                  { z: 10, label: 'P2' },
                  { z: 18, label: 'P3' },
                  { z: 36, label: 'P4' },
                  { z: 54, label: 'P5' },
                  { z: 86, label: 'P6' }
                ].map((p, idx) => {
                  const x = 40 + (p.z / 92) * 390;
                  return (
                    <g key={idx}>
                      <line x1={x} y1="20" x2={x} y2="180" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
                      <text x={x - 4} y="32" fill="var(--text-dim)" fontSize="8">{p.label}</text>
                    </g>
                  );
                })}

                {/* Plot Data Line */}
                {(() => {
                  const maxVal = Math.max(...PERIODIC_ELEMENTS.map(e => e[trendMetric] || 1));
                  const points = PERIODIC_ELEMENTS.map(e => {
                    const x = 40 + (Math.min(92, e.z) / 92) * 390;
                    const val = e[trendMetric] || 0;
                    const y = 170 - (val / maxVal) * 140;
                    return { x, y, el: e };
                  });

                  const pathStr = points.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');

                  return (
                    <>
                      <path d={pathStr} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" />
                      {points.map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r={selectedElement?.z === pt.el.z ? 5 : 2.5}
                          fill={selectedElement?.z === pt.el.z ? 'var(--accent-purple)' : 'var(--accent-blue)'}
                          stroke="#fff"
                          strokeWidth={selectedElement?.z === pt.el.z ? 2 : 0.5}
                          cursor="pointer"
                          onClick={() => setSelectedElement(pt.el)}
                        >
                          <title>{pt.el.name} ({pt.el.symbol}): {pt.el[trendMetric]} {TREND_LABELS[trendMetric].unit}</title>
                        </circle>
                      ))}
                    </>
                  );
                })()}

                {/* X & Y Axis Labels */}
                <text x="240" y="205" textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                  Atomic Number Z (1 to 92)
                </text>
                <text x="18" y="100" textAnchor="middle" fill="var(--text-muted)" fontSize="9" transform="rotate(-90 18 100)">
                  {TREND_LABELS[trendMetric].name} ({TREND_LABELS[trendMetric].unit})
                </text>
              </svg>
            </div>
          </div>
        </div>
      )}

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
