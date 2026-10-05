import { useState, useMemo, useEffect } from 'react';
import ELEMENTS from './data/elements.json';

/*
 * Data sources
 *  - data/elements.json : 118 elements. Positions, family, mass, electronegativity, electron affinity,
 *    1st ionization energy from Bowserinator/Periodic-Table-JSON; empirical atomic radius from the
 *    `mendeleev` package database.
 *  - data/nuclides.json : 3,206 ground-state nuclides from the IAEA LiveChart API (ENSDF, 2023 extraction).
 *    Tuple: [A, halfLifeText, halfLifeSec|null, [[mode, %]], abundance%|null, Qalpha keV, Qbeta- keV, Qec keV]
 *    Loaded lazily (~210 kB) so it is code-split from the main bundle.
 */

const N_A = 6.02214076e23;
const SEC_PER_YEAR = 3.15576e7;

const FAMILY_COLORS = {
  'alkali': { bg: 'rgba(239, 68, 68, 0.22)', border: '#ef4444', text: '#fca5a5', name: 'Alkali Metals' },
  'alkaline-earth': { bg: 'rgba(245, 158, 11, 0.22)', border: '#f59e0b', text: '#fcd34d', name: 'Alkaline Earth' },
  'transition': { bg: 'rgba(56, 189, 248, 0.18)', border: '#38bdf8', text: '#7dd3fc', name: 'Transition Metals' },
  'post-transition': { bg: 'rgba(99, 102, 241, 0.22)', border: '#6366f1', text: '#a5b4fc', name: 'Post-Transition' },
  'metalloid': { bg: 'rgba(16, 185, 129, 0.22)', border: '#10b981', text: '#6ee7b7', name: 'Metalloids' },
  'nonmetal': { bg: 'rgba(6, 182, 212, 0.22)', border: '#06b6d4', text: '#67e8f9', name: 'Reactive Nonmetals' },
  'halogen': { bg: 'rgba(236, 72, 153, 0.22)', border: '#ec4899', text: '#f472b6', name: 'Halogens' },
  'noble': { bg: 'rgba(168, 85, 247, 0.22)', border: '#a855f7', text: '#d8b4fe', name: 'Noble Gases' },
  'lanthanide': { bg: 'rgba(132, 204, 22, 0.18)', border: '#84cc16', text: '#bef264', name: 'Lanthanides' },
  'actinide': { bg: 'rgba(225, 29, 72, 0.22)', border: '#e11d48', text: '#fda4af', name: 'Actinides' },
  'unknown': { bg: 'rgba(148, 163, 184, 0.15)', border: '#64748b', text: '#cbd5e1', name: 'Unknown Properties' }
};

// Third-grade-level summaries shown when hovering a legend chip
const FAMILY_KID_INFO = {
  'alkali': { emoji: '💥', summary: 'Wild, super-reactive metals that LOVE to give away one electron. They are soft enough to cut with a butter knife and can fizz or even pop when they touch water!', examples: 'Sodium (in table salt), Potassium (in bananas)', water: 'Sodium and potassium dissolve easily in water but do NOT make it “hard.”' },
  'alkaline-earth': { emoji: '🪨', summary: 'Metals that give away two electrons. They are a little calmer than alkali metals and help build rocks, shells, and your bones.', examples: 'Calcium (bones, milk), Magnesium (leafy greens)', water: 'Calcium and magnesium are what make water “hard” and leave white crust on faucets!' },
  'transition': { emoji: '🔧', summary: 'The big middle block of strong, shiny metals. They are great for building things, conduct electricity, and many make bright colors.', examples: 'Iron (steel bridges), Copper (wires, pennies), Gold', water: 'Iron and manganese in water can cause rusty-orange or black stains.' },
  'post-transition': { emoji: '🥫', summary: 'Softer metals that sit just after the transition metals. They melt more easily and are often mixed with other metals.', examples: 'Aluminum (soda cans), Tin, Lead', water: 'Lead from old pipes is dangerous to drink — that is why it is closely tested.' },
  'metalloid': { emoji: '🌓', summary: 'Half-and-half elements! They act a little like metals and a little like non-metals. They are the heroes inside computer chips.', examples: 'Silicon (computer chips, sand), Boron, Arsenic', water: 'Arsenic is a metalloid that must be removed from drinking water.' },
  'nonmetal': { emoji: '🌬️', summary: 'Not shiny and not metal. Many are gases, and they are the building blocks of living things — including you!', examples: 'Oxygen (we breathe it), Carbon (in all living things), Nitrogen', water: 'Water itself is made of hydrogen and oxygen — H₂O!' },
  'halogen': { emoji: '🧪', summary: 'Very grabby elements that want to TAKE one electron. They team up with metals to make salts.', examples: 'Chlorine (pool cleaner), Fluorine (toothpaste), Iodine', water: 'Chlorine is added to kill germs, and fluoride helps protect teeth.' },
  'noble': { emoji: '👑', summary: 'The “royal” gases. Their electron shells are already full, so they are happy alone and almost never react with anything.', examples: 'Helium (floaty balloons), Neon (glowing signs), Radon', water: 'Radon is a radioactive noble gas that can sneak into well water and basements.' },
  'lanthanide': { emoji: '🧲', summary: 'The “rare earth” metals, placed in their own row at the bottom. They make super-strong magnets and bright screen colors.', examples: 'Neodymium (strong magnets), Europium (screen colors)', water: 'Gadolinium is so good at soaking up neutrons it is used in nuclear reactor safety.' },
  'actinide': { emoji: '☢️', summary: 'Heavy elements on the bottom row. ALL of them are radioactive, meaning their centers slowly break apart and give off energy.', examples: 'Uranium & Plutonium (nuclear power), Thorium', water: 'Uranium in drinking water is limited by the EPA to 30 µg/L.' },
  'unknown': { emoji: '❓', summary: 'Super-heavy elements made in labs for just a tiny moment. They fall apart so fast that scientists are still learning how they behave.', examples: 'Oganesson, Tennessine, Meitnerium', water: 'They do not exist in nature, so they never show up in water.' }
};

// Typical ionic charges / oxidation states for periodic table columns (Groups 1-18)
const COLUMN_CHARGES = [
  { col: 1, group: '1 (IA)', charge: '+1', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.45)', desc: 'Group 1 (IA): +1 charge (Alkali metal cations: H⁺, Li⁺, Na⁺, K⁺)' },
  { col: 2, group: '2 (IIA)', charge: '+2', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.45)', desc: 'Group 2 (IIA): +2 charge (Alkaline earth hardness cations: Mg²⁺, Ca²⁺, Sr²⁺, Ba²⁺, Ra²⁺)' },
  { col: 3, group: '3 (IIIB)', charge: '+3', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 3 (IIIB): +3 charge (Sc³⁺, Y³⁺, Lanthanides)' },
  { col: 4, group: '4 (IVB)', charge: '+4', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 4 (IVB): +4 charge (Ti⁴⁺, Zr⁴⁺)' },
  { col: 5, group: '5 (VB)', charge: '+5', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 5 (VB): +5 charge (V⁵⁺, Nb⁵⁺; also +2, +3, +4)' },
  { col: 6, group: '6 (VIB)', charge: '+6', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 6 (VIB): +6, +3 charge (Cr⁶⁺ chromate, Cr³⁺, Mo, W)' },
  { col: 7, group: '7 (VIIB)', charge: '+7', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 7 (VIIB): +7, +4, +2 charge (Mn²⁺, MnO₂ +4, MnO₄⁻ +7)' },
  { col: 8, group: '8 (VIII)', charge: '+2,+3', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 8 (VIII): +2, +3 charge (Ferrous Fe²⁺, Ferric Fe³⁺)' },
  { col: 9, group: '9 (VIII)', charge: '+2,+3', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 9 (VIII): +2, +3 charge (Cobalt Co²⁺, Co³⁺)' },
  { col: 10, group: '10 (VIII)', charge: '+2', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 10 (VIII): +2 charge (Nickel Ni²⁺, Pd²⁺, Pt²⁺)' },
  { col: 11, group: '11 (IB)', charge: '+1,+2', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 11 (IB): +1, +2 charge (Cu⁺, Cu²⁺, Ag⁺, Au³⁺)' },
  { col: 12, group: '12 (IIB)', charge: '+2', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.35)', desc: 'Group 12 (IIB): +2 charge (Zn²⁺, Cd²⁺, Hg²⁺)' },
  { col: 13, group: '13 (IIIA)', charge: '+3', color: '#34d399', bg: 'rgba(52, 211, 153, 0.18)', border: 'rgba(52, 211, 153, 0.45)', desc: 'Group 13 (IIIA): +3 charge (Al³⁺ water coagulant cation, Ga³⁺)' },
  { col: 14, group: '14 (IVA)', charge: '±4', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.18)', border: 'rgba(251, 191, 36, 0.45)', desc: 'Group 14 (IVA): ±4 oxidation states (C⁴⁺/C⁴⁻, Si⁴⁺, Sn²⁺/⁴⁺, Pb²⁺/⁴⁺)' },
  { col: 15, group: '15 (VA)', charge: '-3', color: '#f87171', bg: 'rgba(248, 113, 113, 0.18)', border: 'rgba(248, 113, 113, 0.45)', desc: 'Group 15 (VA): -3 common ionic charge (N³⁻, P³⁻; +5 in NO₃⁻ and PO₄³⁻)' },
  { col: 16, group: '16 (VIA)', charge: '-2', color: '#f87171', bg: 'rgba(248, 113, 113, 0.18)', border: 'rgba(248, 113, 113, 0.45)', desc: 'Group 16 (VIA): -2 charge (Oxide O²⁻, Sulfide S²⁻, Sulfate SO₄²⁻)' },
  { col: 17, group: '17 (VIIA)', charge: '-1', color: '#f87171', bg: 'rgba(248, 113, 113, 0.18)', border: 'rgba(248, 113, 113, 0.45)', desc: 'Group 17 (VIIA): -1 charge (Halide anions: F⁻, Cl⁻, Br⁻, I⁻)' },
  { col: 18, group: '18 (VIIIA)', charge: '0', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.14)', border: 'rgba(192, 132, 252, 0.4)', desc: 'Group 18 (VIIIA): 0 charge (Inert noble gases: He, Ne, Ar, Kr, Xe, Rn)' }
];

// Decay mode → label, daughter shift [ΔZ, ΔA] (null = fission), and which Q-value applies
const MODE_INFO = {
  'A': { label: 'Alpha (α)', d: [-2, -4], q: 5 },
  'B-': { label: 'Beta minus (β⁻)', d: [1, 0], q: 6 },
  '2B-': { label: 'Double beta (2β⁻)', d: [2, 0], q: null },
  'EC': { label: 'Electron capture (EC)', d: [-1, 0], q: 7 },
  'B+': { label: 'Positron (β⁺)', d: [-1, 0], q: 7 },
  'EC+B+': { label: 'EC / Positron (β⁺)', d: [-1, 0], q: 7 },
  '2EC': { label: 'Double electron capture', d: [-2, 0], q: null },
  '2B+': { label: 'Double positron', d: [-2, 0], q: null },
  'IT': { label: 'Isomeric transition (γ)', d: [0, 0], q: null },
  'SF': { label: 'Spontaneous fission', d: null, q: null },
  'ECSF': { label: 'EC-delayed fission', d: null, q: null },
  'P': { label: 'Proton emission', d: [-1, -1], q: null },
  '2P': { label: 'Two-proton emission', d: [-2, -2], q: null },
  'N': { label: 'Neutron emission', d: [0, -1], q: null },
  '2N': { label: 'Two-neutron emission', d: [0, -2], q: null },
  'B-N': { label: 'β⁻-delayed neutron', d: [1, -1], q: 6 },
  'B-2N': { label: 'β⁻-delayed 2 neutrons', d: [1, -2], q: 6 },
  'B-A': { label: 'β⁻-delayed alpha', d: [-1, -4], q: null },
  'ECP': { label: 'EC-delayed proton', d: [-2, -1], q: null },
  'B+P': { label: 'β⁺-delayed proton', d: [-2, -1], q: null },
  '14C': { label: 'Cluster decay (¹⁴C)', d: [-6, -14], q: null }
};

// Curated engineering / regulatory notes for nuclides of special interest (keyed "Z-A")
const NUCLIDE_NOTES = {
  '92-235': { role: 'Primary fissile reactor fuel (0.72% of natural U). Thermal fission σf ≈ 585 b; ~200 MeV and ~2.43 neutrons per fission.', water: 'EPA MCL for uranium = 30 µg/L (chemical kidney toxicity + radiological).' },
  '92-238': { role: 'Fertile isotope (99.27% of natural U). Breeds fissile Pu-239 via n-capture: ²³⁸U(n,γ)²³⁹U → ²³⁹Np → ²³⁹Pu. Head of the uranium (4n+2) decay series.', water: 'EPA MCL for uranium = 30 µg/L.' },
  '94-239': { role: 'Fissile isotope bred in reactors; σf ≈ 748 b, ~2.88 neutrons per thermal fission. Used in MOX fuel.', water: 'Strong alpha emitter; severe internal (bone/liver) hazard.' },
  '88-226': { role: 'Uranium-series daughter. Group 2 alkaline earth — chemically mimics Ca²⁺/Mg²⁺.', water: 'EPA MCL = 5 pCi/L combined Ra-226 + Ra-228. Removed by cation-exchange softening and lime softening.' },
  '86-222': { role: 'Radioactive noble gas; daughter of Ra-226. Leading cause of lung cancer in non-smokers.', water: 'Proposed EPA MCL 300 pCi/L (4,000 pCi/L with indoor-air program). Removed by aeration or GAC.' },
  '55-137': { role: 'High-yield fission product (~6.1%). The 661.7 keV gamma comes from its daughter Ba-137m.', water: 'Alkali metal, very soluble, behaves like K⁺. Covered by the EPA beta/photon emitter MCL (4 mrem/yr).' },
  '38-90': { role: 'High-yield fission product (~5.8%). Bone seeker that mimics calcium.', water: 'EPA MCL = 8 pCi/L. Removed by lime softening and ion exchange.' },
  '53-131': { role: 'Volatile fission product (~2.9%). Concentrates in the thyroid; blocked with potassium iodide (KI).', water: 'EPA MCL = 3 pCi/L. Removed by GAC and reverse osmosis.' },
  '27-60': { role: 'Neutron-activation product of steel: ⁵⁹Co(n,γ)⁶⁰Co. Emits 1.173 + 1.332 MeV gammas. Used for radiotherapy and sterilization.', water: 'Corrosion product in reactor coolant loops; a major worker-dose contributor.' },
  '1-3': { role: 'Tritium. Fusion fuel (D + T → ⁴He + n + 17.6 MeV); made in heavy-water reactors.', water: 'Forms tritiated water (HTO) that conventional treatment cannot remove. EPA MCL = 20,000 pCi/L.' }
};

// Resonance energies of common interest (rounded, approximate).
// Neutron resonance values: lowest strong resolved resonance (ENDF/B-VIII.0, Mughabghab Atlas of Neutron Resonances).
// σth = 2200 m/s (0.0253 eV) cross section for the listed reaction. Verify against NNDC Sigma before design use.
const RESONANCES = [
  { z: 64, A: 157, E: 0.0314, sigma: 254000, rx: '(n,γ)', cat: 'burnable', note: 'Largest thermal capture cross section of any stable nuclide. Gd₂O₃ is mixed into fuel pellets as a burnable poison.' },
  { z: 64, A: 155, E: 0.0268, sigma: 60900, rx: '(n,γ)', cat: 'burnable', note: 'Second gadolinium burnable-poison isotope.' },
  { z: 54, A: 135, E: 0.084, sigma: 2650000, rx: '(n,γ)', cat: 'poison', note: 'Fission-product poison (σ ≈ 2.65 million b). Causes xenon transients and the post-shutdown "iodine pit".' },
  { z: 62, A: 149, E: 0.0973, sigma: 40100, rx: '(n,γ)', cat: 'poison', note: 'Stable fission-product poison; samarium builds up to an equilibrium after startup.' },
  { z: 48, A: 113, E: 0.178, sigma: 20600, rx: '(n,γ)', cat: 'control', note: 'Gives the ~0.5 eV "cadmium cutoff" used to separate thermal from epithermal neutrons. Part of Ag-In-Cd control rods.' },
  { z: 94, A: 241, E: 0.264, sigma: 1012, rx: '(n,f)', cat: 'fuel', note: 'Fissile plutonium isotope built up at high burnup.' },
  { z: 92, A: 235, E: 0.274, sigma: 585, rx: '(n,f)', cat: 'fuel', note: 'First resolved U-235 resonance. Fission is mostly 1/v at thermal energies.' },
  { z: 94, A: 239, E: 0.296, sigma: 748, rx: '(n,f)', cat: 'fuel', note: 'Large fission resonance just above thermal. Hardens the spectrum response and affects MOX temperature coefficients.' },
  { z: 94, A: 240, E: 1.056, sigma: 289, rx: '(n,γ)', cat: 'fuel', note: 'Huge capture resonance; strong self-shielding. Pu-240 content sets weapons-grade vs reactor-grade Pu.' },
  { z: 72, A: 177, E: 1.10, sigma: 373, rx: '(n,γ)', cat: 'control', note: 'Hafnium control rods (naval reactors). Several stacked resonances absorb across the epithermal range.' },
  { z: 49, A: 115, E: 1.457, sigma: 202, rx: '(n,γ)', cat: 'flux', note: 'Indium foils measure epithermal neutron flux by activation (In-116m). Also part of Ag-In-Cd rods.' },
  { z: 79, A: 197, E: 4.906, sigma: 98.7, rx: '(n,γ)', cat: 'flux', note: 'Gold foil activation (Au-198, t½ 2.7 d) is the standard neutron-flux monitor. Bare vs Cd-covered gives the cadmium ratio.' },
  { z: 47, A: 109, E: 5.19, sigma: 91, rx: '(n,γ)', cat: 'control', note: 'Silver: the main absorber (80%) in PWR Ag-In-Cd control rods.' },
  { z: 92, A: 238, E: 6.67, sigma: 2.68, rx: '(n,γ)', cat: 'doppler', note: 'Most important capture resonance in thermal reactors. Doppler broadening gives the prompt negative fuel temperature coefficient. Sets the resonance escape probability p.' },
  { z: 92, A: 238, E: 20.9, sigma: 2.68, rx: '(n,γ)', cat: 'doppler', note: 'Second large U-238 capture resonance.' },
  { z: 92, A: 238, E: 36.7, sigma: 2.68, rx: '(n,γ)', cat: 'doppler', note: 'Third large U-238 capture resonance.' },
  { z: 90, A: 232, E: 21.8, sigma: 7.35, rx: '(n,γ)', cat: 'doppler', note: 'Fertile thorium fuel cycle: ²³²Th(n,γ) → ²³³Pa → fissile ²³³U.' },
  { z: 27, A: 59, E: 132, sigma: 37.2, rx: '(n,γ)', cat: 'activation', note: 'Makes Co-60 in steels and Stellite valve hard-facing, a dominant source of plant radiation fields.' },
  { z: 25, A: 55, E: 337, sigma: 13.3, rx: '(n,γ)', cat: 'activation', note: 'Manganese activation (Mn-56) in steels and in Mn-bath neutron source calibration.' },
  { z: 26, A: 56, E: 1150, sigma: 2.59, rx: '(n,γ)', cat: 'activation', note: 'Structural iron. Deep cross-section minima between resonances (the ~24 keV "iron window") let neutrons stream through steel shields.' },
  { z: 11, A: 23, E: 2850, sigma: 0.53, rx: '(n,γ)', cat: 'activation', note: 'Sodium coolant resonance in fast reactors. Activates to Na-24 (t½ 15 h, 2.75 MeV γ).' },
  { z: 26, A: 57, E: 14413, sigma: null, rx: 'γ (Mössbauer)', cat: 'mossbauer', note: '14.41 keV recoil-free gamma resonance. Mössbauer spectroscopy identifies iron oxides (magnetite, goethite) in pipe scale and corrosion products.' },
  { z: 50, A: 119, E: 23870, sigma: null, rx: 'γ (Mössbauer)', cat: 'mossbauer', note: '23.87 keV Mössbauer line used to study tin chemistry, coatings and solders.' }
];

const RES_CATS = {
  control: { name: 'Control Rods', color: '#38bdf8' },
  burnable: { name: 'Burnable Poisons', color: '#84cc16' },
  poison: { name: 'Fission-Product Poisons', color: '#f43f5e' },
  fuel: { name: 'Fissile / Fertile Fuel', color: '#f59e0b' },
  doppler: { name: 'Doppler & Resonance Escape', color: '#fb923c' },
  flux: { name: 'Flux Measurement (Foils)', color: '#a855f7' },
  activation: { name: 'Structural, Coolant & Activation', color: '#06b6d4' },
  mossbauer: { name: 'Mössbauer (γ Resonance)', color: '#ec4899' }
};

const APPLICATIONS = [
  { cat: 'control', title: 'Reactor Control Rods', body: 'Absorbers with resonances at different energies, stacked so together they soak up neutrons from ~0.1 eV to ~10 eV. Examples: Ag-In-Cd (80/15/5) in PWRs, hafnium in naval cores, and B₄C (B-10 is a smooth 1/v absorber with no low resonances).' },
  { cat: 'burnable', title: 'Burnable Poisons', body: 'Gd₂O₃ mixed into fuel holds down excess reactivity in a fresh core. Its huge thermal cross section "burns out" over the first cycle, offsetting fuel depletion.' },
  { cat: 'poison', title: 'Xenon & Samarium Poisoning', body: 'Xe-135 (σ ≈ 2.65×10⁶ b) builds up from I-135 decay after a power drop, which can stop a restart (the "iodine pit"). Sm-149 is stable, so it settles at an equilibrium.' },
  { cat: 'doppler', title: 'Doppler Feedback & Resonance Escape', body: 'Hotter fuel makes U-238 nuclei vibrate faster, which broadens the 6.67 eV resonance so it captures more neutrons. That is the prompt negative fuel temperature coefficient. Four-factor formula: p = exp[−N₂₈·I_eff / (ξΣ_s)].' },
  { cat: 'flux', title: 'Neutron Flux Measurement', body: 'Activation foils (Au, In, Mn, Co) are irradiated and then gamma-counted. Comparing bare and cadmium-covered foils (R_Cd = A_bare / A_Cd) separates the thermal and epithermal flux.' },
  { cat: 'activation', title: 'Fast Reactors, Shielding & Activation', body: 'Resonances in Na-23, Fe-56, Co-59 and Mn-55 control coolant activation, shielding performance (cross-section windows) and plant dose (Co-60).' },
  { cat: 'mossbauer', title: 'Mössbauer Spectroscopy', body: 'Recoil-free nuclear gamma resonance (Fe-57 at 14.41 keV) fingerprints iron oxidation states. Water utilities use it to identify corrosion scales such as magnetite and goethite inside distribution mains.' }
];

const FILTERS = [
  { id: 'all', label: 'All 118 Elements' },
  { id: 'radioactive', label: 'No Stable Isotopes ☢' },
  { id: 'alpha', label: 'Alpha (α) Emitters' },
  { id: 'beta', label: 'Beta (β⁻ / β⁺) Emitters' },
  { id: 'fuel', label: 'Reactor Fuels & Fission Products' },
  { id: 'drinking-water', label: 'Drinking-Water Radionuclides' },
  { id: 'resonance', label: 'Resonance Data' }
];
const FUEL_SET = new Set([90, 92, 94, 95, 36, 38, 43, 53, 54, 55, 62]);
const WATER_SET = new Set([1, 38, 53, 55, 86, 88, 92]);
const RES_SET = new Set(RESONANCES.map(r => r.z));

const TREND_LABELS = {
  decay_q: { name: 'Primary Decay Energy Q', unit: 'MeV', desc: 'Total nuclear mass energy released during radioactive decay (Q = Δm · c²). High Q-values drive higher particle kinetic energies and ionizing radiation power.' },
  max_decay_q: { name: 'Max Decay Energy Q', unit: 'MeV', desc: 'Highest ground-state decay energy Q across all isotopes of this element, peaking far from the valley of beta stability.' },
  isotopes: { name: 'Total Known Isotopes', unit: 'iso', desc: 'Number of ground-state nuclides identified for this element in ENSDF / IAEA LiveChart (~3,200+ total).' },
  stable_iso: { name: 'Stable Isotopes Count', unit: 'stable', desc: 'Count of non-radioactive stable nuclides. Demonstrates nuclear magic proton numbers (Z=20 Ca has 6, Z=28 Ni has 5, Z=50 Sn has 10, Z=82 Pb has 4).' },
  radius: { name: 'Atomic Radius (empirical)', unit: 'pm', desc: 'Shrinks across a period (more nuclear charge pulls electrons in) and grows down a group (an extra electron shell).' },
  ie: { name: 'First Ionization Energy', unit: 'kJ/mol', desc: 'Energy needed to remove the outermost electron. Peaks at the noble gases, lowest at the alkali metals.' },
  en: { name: 'Electronegativity (Pauling)', unit: '', desc: 'How strongly an atom pulls bonding electrons. Highest at fluorine (3.98), lowest at cesium and francium.' },
  ea: { name: 'Electron Affinity', unit: 'kJ/mol', desc: 'Energy released when an atom gains an electron. Largest for the halogens (Cl ≈ 349 kJ/mol).' }
};

const BY_Z = Object.fromEntries(ELEMENTS.map(e => [e.z, e]));
const FALLBACK_RADIOACTIVE = (z) => z === 43 || z === 61 || z >= 84;

// ---------- helpers ----------
const fmtSig = (v, d = 3) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(d - 1);
  return Number(v.toPrecision(d)).toLocaleString();
};

const fmtTime = (sec) => {
  if (sec === null || sec === undefined) return '—';
  if (sec < 1e-6) return `${fmtSig(sec * 1e9)} ns`;
  if (sec < 1e-3) return `${fmtSig(sec * 1e6)} µs`;
  if (sec < 1) return `${fmtSig(sec * 1e3)} ms`;
  if (sec < 60) return `${fmtSig(sec)} s`;
  if (sec < 3600) return `${fmtSig(sec / 60)} min`;
  if (sec < 86400) return `${fmtSig(sec / 3600)} h`;
  if (sec < SEC_PER_YEAR) return `${fmtSig(sec / 86400)} d`;
  return `${fmtSig(sec / SEC_PER_YEAR)} yr`;
};

const fmtEnergy = (eV) => {
  if (eV >= 1e6) return `${fmtSig(eV / 1e6)} MeV`;
  if (eV >= 1e3) return `${fmtSig(eV / 1e3)} keV`;
  return `${fmtSig(eV)} eV`;
};

const primaryMode = (modes) => {
  if (!modes || modes.length === 0) return null;
  let best = modes[0];
  modes.forEach(m => { if ((m[1] ?? -1) > (best[1] ?? -1)) best = m; });
  return best;
};

// Return the primary decay Q in keV
const getNuclidePrimaryQ = (n) => {
  if (!n || n[1] === 'Stable') return null;
  const pm = primaryMode(n[3]);
  const mode = pm?.[0];
  if (mode === 'A' || mode === 'B-A') return n[5] ?? n[6] ?? n[7];
  if (mode === 'B-' || mode === 'B-N' || mode === 'B-2N' || mode === '2B-') return n[6] ?? n[7] ?? n[5];
  if (mode && (mode.includes('EC') || mode.includes('B+'))) return n[7] ?? n[6] ?? n[5];
  return n[5] ?? n[6] ?? n[7];
};

const fmtQMeV = (qKeV, d = 3) => {
  if (qKeV == null || Number.isNaN(qKeV)) return '—';
  return `${(qKeV / 1000).toFixed(d)} MeV`;
};

// Detailed nuclear kinematics breakdown
const getKinematics = (n) => {
  if (!n || n[1] === 'Stable') return null;
  const A = n[0];
  const pm = primaryMode(n[3]);
  const mode = pm?.[0] || '';
  const qKeV = getNuclidePrimaryQ(n);
  const qMeV = qKeV != null ? qKeV / 1000 : null;
  const qJoules = qMeV != null ? qMeV * 1.602176634e-13 : null;
  const deltaMassU = qMeV != null ? qMeV / 931.494095 : null;
  const deltaMassKg = deltaMassU != null ? deltaMassU * 1.6605390666e-27 : null;

  let alphaKineticMeV = null;
  let recoilKineticMeV = null;
  const isAlpha = (mode === 'A' || mode.includes('A')) && qMeV != null && A > 4;
  if (isAlpha) {
    alphaKineticMeV = qMeV * ((A - 4) / A);
    recoilKineticMeV = qMeV * (4 / A);
  }

  let betaMaxMeV = null;
  let betaAvgMeV = null;
  let neutrinoAvgMeV = null;
  const isBetaMinus = mode.includes('B-') && qMeV != null;
  if (isBetaMinus) {
    betaMaxMeV = qMeV;
    betaAvgMeV = qMeV / 3;
    neutrinoAvgMeV = (qMeV * 2) / 3;
  }

  let positronMaxMeV = null;
  const isBetaPlus = (mode.includes('B+') || mode.includes('EC')) && qMeV != null;
  if (isBetaPlus) {
    if (qMeV > 1.022) {
      positronMaxMeV = qMeV - 1.022;
    }
  }

  return {
    mode,
    pm,
    qKeV,
    qMeV,
    qJoules,
    deltaM_u: deltaMassU,
    deltaM_kg: deltaMassKg,
    deltaMassU,
    deltaMassKg,
    isAlpha,
    alphaKinematics: isAlpha ? {
      eAlphaMeV: alphaKineticMeV,
      alphaPct: ((A - 4) / A) * 100,
      eRecoilKeV: recoilKineticMeV * 1000,
      recoilPct: (4 / A) * 100
    } : null,
    isBetaMinus,
    betaMinusKinematics: isBetaMinus ? {
      eEndpointMeV: betaMaxMeV,
      eAvgBetaMeV: betaAvgMeV,
      eAvgNuMeV: neutrinoAvgMeV
    } : null,
    isBetaPlus,
    betaPlusKinematics: isBetaPlus ? {
      eBetaPlusMaxMeV: positronMaxMeV
    } : null,
    allQ: { qAlpha: n[5], qBeta: n[6], qEc: n[7] }
  };
};

const sym = (z, A) => `${A ?? ''}${BY_Z[z]?.symbol ?? `Z${z}`}`;

// ---------- component ----------
const PeriodicNuclearStudio = () => {
  const [nuclides, setNuclides] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [viewMode, setViewMode] = useState('nuclear'); // 'nuclear' | 'chemical'
  const [selZ, setSelZ] = useState(92);
  const [selA, setSelA] = useState(238);
  const [filter, setFilter] = useState('all');
  const [trendMetric, setTrendMetric] = useState('decay_q');
  const [showAllIsotopes, setShowAllIsotopes] = useState(false);
  const [isoSearch, setIsoSearch] = useState('');
  const [isoFilter, setIsoFilter] = useState('all'); // 'all' | 'stable' | 'radioactive' | 'alpha' | 'beta'
  const [isoSort, setIsoSort] = useState('default'); // 'default' | 'A' | 'halfLife' | 'q' | 'abund'
  const [elapsedHalfLives, setElapsedHalfLives] = useState(1);
  const [resCat, setResCat] = useState('all');
  const [selRes, setSelRes] = useState(null);
  const [hoverFam, setHoverFam] = useState(null);

  // Lazy-load nuclide data (code-split chunk)
  useEffect(() => {
    let alive = true;
    import('./data/nuclides.json')
      .then(m => { if (alive) setNuclides(m.default); })
      .catch(err => { if (alive) setLoadError(String(err)); });
    return () => { alive = false; };
  }, []);

  const nucMap = useMemo(() => {
    const map = new Map();
    if (!nuclides) return map;
    Object.entries(nuclides).forEach(([z, list]) => list.forEach(n => map.set(`${z}-${n[0]}`, n)));
    return map;
  }, [nuclides]);

  // Per-element nuclear statistics computed once nuclides is loaded
  const elementNuclearStats = useMemo(() => {
    const stats = new Map();
    if (!nuclides) return stats;
    ELEMENTS.forEach(e => {
      const list = nuclides[e.z] || [];
      const total = list.length;
      const stable = list.filter(n => n[1] === 'Stable');
      const radio = list.filter(n => n[1] !== 'Stable');
      const stableCount = stable.length;
      const isRadioactive = stableCount === 0;

      let primaryRadio = null;
      if (radio.length > 0) {
        primaryRadio = radio.slice().sort((a, b) => (b[2] ?? 0) - (a[2] ?? 0))[0];
      }
      const primaryQKeV = primaryRadio ? getNuclidePrimaryQ(primaryRadio) : null;
      const primaryQMeV = primaryQKeV != null ? +(primaryQKeV / 1000).toFixed(3) : null;

      let maxQKeV = 0;
      list.forEach(n => {
        [n[5], n[6], n[7]].forEach(q => {
          if (q != null && q > maxQKeV) maxQKeV = q;
        });
      });
      const maxQMeV = maxQKeV > 0 ? +(maxQKeV / 1000).toFixed(3) : null;

      const hasAlpha = list.some(n => {
        const pm = primaryMode(n[3]);
        return pm && (pm[0] === 'A' || pm[0] === 'B-A');
      });
      const hasBeta = list.some(n => {
        const pm = primaryMode(n[3]);
        return pm && (pm[0].includes('B-') || pm[0].includes('B+') || pm[0].includes('EC'));
      });

      stats.set(e.z, {
        total,
        stableCount,
        isRadioactive,
        primaryRadio,
        primaryQKeV,
        primaryQMeV,
        maxQKeV,
        maxQMeV,
        hasAlpha,
        hasBeta
      });
    });
    return stats;
  }, [nuclides]);

  const isRadioactiveEl = (z) => {
    if (!nuclides) return FALLBACK_RADIOACTIVE(z);
    return !(nuclides[z] || []).some(n => n[1] === 'Stable');
  };

  const matchesFilter = (z) => {
    const nStats = elementNuclearStats.get(z);
    switch (filter) {
      case 'radioactive': return isRadioactiveEl(z);
      case 'alpha': return nStats ? nStats.hasAlpha : z >= 84;
      case 'beta': return nStats ? nStats.hasBeta : true;
      case 'fuel': return FUEL_SET.has(z);
      case 'drinking-water': return WATER_SET.has(z);
      case 'resonance': return RES_SET.has(z);
      default: return true;
    }
  };
  const shownCount = ELEMENTS.filter(e => matchesFilter(e.z)).length;

  const getElementTrendValue = (e, metric) => {
    if (metric in e && e[metric] != null) return e[metric];
    const nStats = elementNuclearStats.get(e.z);
    if (!nStats) return null;
    if (metric === 'isotopes') return nStats.total || null;
    if (metric === 'stable_iso') return nStats.stableCount;
    if (metric === 'decay_q') return nStats.primaryQMeV;
    if (metric === 'max_decay_q') return nStats.maxQMeV;
    return null;
  };

  // Isotopes for selected element: stable (by A), then radioactive by half-life descending
  const isotopes = useMemo(() => {
    const list = (nuclides?.[selZ] || []).slice();
    list.sort((a, b) => {
      const sa = a[1] === 'Stable', sb = b[1] === 'Stable';
      if (sa !== sb) return sa ? -1 : 1;
      if (sa) return a[0] - b[0];
      return (b[2] ?? 0) - (a[2] ?? 0);
    });
    return list;
  }, [nuclides, selZ]);

  // Isotopes sorted by mass number A for the isotope spectrum
  const isotopesByA = useMemo(() => {
    return (nuclides?.[selZ] || []).slice().sort((a, b) => a[0] - b[0]);
  }, [nuclides, selZ]);

  // Max Q value for the selected element's isotopes spectrum
  const maxQForElement = useMemo(() => {
    let max = 1;
    (nuclides?.[selZ] || []).forEach(n => {
      const q = getNuclidePrimaryQ(n);
      if (q && q > max) max = q;
    });
    return max;
  }, [nuclides, selZ]);

  // Default isotope = most abundant stable, else longest-lived
  const defaultA = useMemo(() => {
    if (!isotopes.length) return null;
    const stable = isotopes.filter(n => n[1] === 'Stable');
    if (stable.length) return stable.reduce((b, n) => ((n[4] ?? 0) > (b[4] ?? 0) ? n : b))[0];
    return isotopes[0][0];
  }, [isotopes]);

  const effA = selA ?? defaultA;
  const nuc = nucMap.get(`${selZ}-${effA}`) || null;
  const el = BY_Z[selZ];
  const fam = FAMILY_COLORS[el?.family] || FAMILY_COLORS.unknown;
  const currStats = elementNuclearStats.get(selZ);

  const decay = useMemo(() => {
    if (!nuc) return null;
    const stable = nuc[1] === 'Stable';
    const pm = primaryMode(nuc[3]);
    const info = pm ? MODE_INFO[pm[0]] : null;
    const hls = nuc[2];
    const lambdaS = hls ? Math.LN2 / hls : null;
    const qKeV = getNuclidePrimaryQ(nuc);
    const specAct = lambdaS ? (lambdaS * N_A) / nuc[0] : null; // Bq/g
    const daughter = info?.d ? { z: selZ + info.d[0], A: nuc[0] + info.d[1] } : null;
    return { stable, pm, info, hls, lambdaS, qKeV, specAct, daughter };
  }, [nuc, selZ]);

  const kinematics = useMemo(() => {
    if (!nuc) return null;
    return getKinematics(nuc);
  }, [nuc]);

  // Follow primary decay mode to build a chain
  const chain = useMemo(() => {
    if (!nuc) return [];
    const steps = [];
    let z = selZ, A = nuc[0];
    for (let i = 0; i < 24; i++) {
      const n = nucMap.get(`${z}-${A}`);
      if (!n) { steps.push({ z, A, hl: 'no data', end: 'unknown' }); break; }
      if (n[1] === 'Stable') { steps.push({ z, A, hl: 'Stable', end: 'stable' }); break; }
      const pm = primaryMode(n[3]);
      const info = pm ? MODE_INFO[pm[0]] : null;
      steps.push({ z, A, hl: fmtTime(n[2]), mode: pm?.[0] });
      if (!info?.d) { steps.push({ z: null, A: null, hl: '', end: 'fission' }); break; }
      z += info.d[0]; A += info.d[1];
      if (z < 1) break;
    }
    return steps;
  }, [nuc, nucMap, selZ]);

  const selectElement = (z) => {
    setSelZ(z);
    setSelA(null);
    setShowAllIsotopes(false);
  };

  const selectNuclide = (z, A) => {
    setSelZ(z);
    setSelA(A);
  };

  const notes = nuc ? NUCLIDE_NOTES[`${selZ}-${nuc[0]}`] : null;
  const isoResonances = nuc ? RESONANCES.filter(r => r.z === selZ && r.A === nuc[0]) : [];

  // Filtered & sorted isotopes for the inspector table
  const filteredIsotopes = useMemo(() => {
    let list = isotopes.slice();
    if (isoSearch.trim()) {
      const q = isoSearch.trim().toLowerCase();
      list = list.filter(n => {
        const text = `${el?.symbol}-${n[0]} ${n[0]} ${n[1]} ${(n[3] || []).map(m => m[0]).join(' ')}`.toLowerCase();
        return text.includes(q);
      });
    }
    if (isoFilter === 'stable') {
      list = list.filter(n => n[1] === 'Stable');
    } else if (isoFilter === 'radioactive') {
      list = list.filter(n => n[1] !== 'Stable');
    } else if (isoFilter === 'alpha') {
      list = list.filter(n => {
        const pm = primaryMode(n[3]);
        return pm && (pm[0] === 'A' || pm[0] === 'B-A');
      });
    } else if (isoFilter === 'beta') {
      list = list.filter(n => {
        const pm = primaryMode(n[3]);
        return pm && (pm[0].includes('B-') || pm[0].includes('B+') || pm[0].includes('EC'));
      });
    }
    if (isoSort === 'A') {
      list.sort((a, b) => a[0] - b[0]);
    } else if (isoSort === 'halfLife') {
      list.sort((a, b) => {
        const sa = a[1] === 'Stable', sb = b[1] === 'Stable';
        if (sa !== sb) return sa ? -1 : 1;
        return (b[2] ?? 0) - (a[2] ?? 0);
      });
    } else if (isoSort === 'q') {
      list.sort((a, b) => {
        const qa = getNuclidePrimaryQ(a) ?? -1;
        const qb = getNuclidePrimaryQ(b) ?? -1;
        return qb - qa;
      });
    } else if (isoSort === 'abund') {
      list.sort((a, b) => (b[4] ?? 0) - (a[4] ?? 0));
    }
    return list;
  }, [isotopes, isoSearch, isoFilter, isoSort, el?.symbol]);

  const visibleIsotopes = showAllIsotopes ? filteredIsotopes : filteredIsotopes.slice(0, 12);

  // ---------------- styles ----------------
  const card = { background: 'rgba(0, 0, 0, 0.3)', borderRadius: '14px', border: '1px solid var(--border-color)', padding: '1.25rem' };
  const chip = (active, color) => ({
    padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer',
    border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
    background: active ? `${color}33` : 'rgba(0,0,0,0.2)',
    color: active ? color : 'var(--text-main)', fontWeight: active ? 700 : 500,
    transition: 'all 0.15s ease'
  });
  const kpi = { background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' };

  // ---------------- decay curve geometry ----------------
  const curve = (() => {
    const W = 420, H = 170, x0 = 40, y0 = 15, w = W - x0 - 12, h = H - y0 - 28, maxN = 6;
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const n = (i / 120) * maxN;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x0 + (n / maxN) * w} ${y0 + h - Math.pow(2, -n) * h}`);
    }
    const nSel = Math.min(elapsedHalfLives, maxN);
    return { W, H, x0, y0, w, h, maxN, path: pts.join(' '), mx: x0 + (nSel / maxN) * w, my: y0 + h - Math.pow(2, -nSel) * h };
  })();

  // ---------------- resonance chart geometry ----------------
  const resFiltered = RESONANCES.filter(r => resCat === 'all' || r.cat === resCat);
  const logMin = -2, logMax = 5; // 0.01 eV .. 100 keV
  const ex = (E) => 50 + ((Math.log10(E) - logMin) / (logMax - logMin)) * 680;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Controls Bar */}
      <div style={{ ...card, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              id="pt-mode-nuclear"
              onClick={() => {
                setViewMode('nuclear');
                if (!['isotopes', 'stable_iso', 'decay_q', 'max_decay_q'].includes(trendMetric)) setTrendMetric('decay_q');
              }}
              style={{
                ...chip(viewMode === 'nuclear', 'var(--accent-cyan)'),
                borderRadius: '6px', border: 'none', padding: '0.3rem 0.7rem'
              }}
            >
              ⚛️ Nuclear &amp; Decay Q View
            </button>
            <button
              id="pt-mode-chemical"
              onClick={() => {
                setViewMode('chemical');
                if (['isotopes', 'stable_iso', 'decay_q', 'max_decay_q'].includes(trendMetric)) setTrendMetric('radius');
              }}
              style={{
                ...chip(viewMode === 'chemical', '#38bdf8'),
                borderRadius: '6px', border: 'none', padding: '0.3rem 0.7rem'
              }}
            >
              🧪 Chemical Trends View
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Filter:</span>
            {FILTERS.map(f => (
              <button key={f.id} id={`pt-filter-${f.id}`} style={chip(filter === f.id, '#a855f7')} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
            <span className="text-xs text-muted" style={{ marginLeft: '0.35rem' }}>
              Showing <strong style={{ color: 'var(--accent-purple)' }}>{shownCount}</strong> of 118
            </span>
          </div>
        </div>

        {/* Tile Value / Trend Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Tile metric / graph:</span>
          <select
            id="pt-trend-select"
            value={trendMetric}
            onChange={(e) => setTrendMetric(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            <optgroup label="Nuclear &amp; Decay Energetics">
              <option value="decay_q">Primary Decay Energy Q (MeV)</option>
              <option value="max_decay_q">Max Decay Energy Q (MeV)</option>
              <option value="isotopes">Total Known Isotopes (count)</option>
              <option value="stable_iso">Stable Isotopes (count)</option>
            </optgroup>
            <optgroup label="Chemical &amp; Periodic Trends">
              <option value="radius">Atomic Radius (empirical, pm)</option>
              <option value="ie">First Ionization Energy (kJ/mol)</option>
              <option value="en">Electronegativity (Pauling)</option>
              <option value="ea">Electron Affinity (kJ/mol)</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Periodic grid */}
      <div style={{ ...card, background: 'radial-gradient(ellipse at center, rgba(12,25,45,0.8) 0%, rgba(7,12,22,0.95) 100%)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <strong style={{ fontSize: '0.9rem', color: 'var(--accent-purple)' }}>
              Periodic Table of the Elements &amp; Nuclear Isotopes
            </strong>
            <span className="glass-badge" style={{ fontSize: '0.65rem', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
              Top Row: Oxidation Numbers / Ionic Charges
            </span>
            <span className="glass-badge" style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              {viewMode === 'nuclear' ? 'Mode: Nuclear Isotopes & Decay Q' : 'Mode: Chemical Trends'}
            </span>
          </div>
          <span className="text-xs text-muted">
            Click any element to inspect all its isotopes, decay energies Q, decay chains, and neutron resonances. {nuclides ? '3,200+ IAEA ground-state nuclides loaded.' : 'Loading nuclide data…'}
            {loadError && <span style={{ color: 'var(--accent-rose)' }}> Failed to load nuclide data: {loadError}</span>}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(18, minmax(40px, 1fr))',
          gridTemplateRows: '34px repeat(7, 52px) 14px repeat(2, 52px)',
          gap: '3px',
          minWidth: '780px'
        }}>
          {/* Column Charges Header (Row 1) */}
          {COLUMN_CHARGES.map((c) => (
            <div
              key={c.col}
              id={`col-charge-${c.col}`}
              title={c.desc}
              style={{
                gridColumn: c.col,
                gridRow: 1,
                borderRadius: '6px',
                padding: '2px 1px',
                background: c.bg,
                border: `1px solid ${c.border}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'help',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                userSelect: 'none'
              }}
              onMouseEnter={(ev) => { ev.currentTarget.style.transform = 'scale(1.12)'; ev.currentTarget.style.zIndex = 4; ev.currentTarget.style.boxShadow = `0 0 10px ${c.border}`; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.transform = 'scale(1)'; ev.currentTarget.style.zIndex = 0; ev.currentTarget.style.boxShadow = 'none'; }}
            >
              <span style={{ fontSize: '0.52rem', color: 'var(--text-dim, #94a3b8)', lineHeight: 1 }}>{c.col}</span>
              <strong style={{ fontSize: '0.78rem', color: c.color, fontWeight: 800, lineHeight: 1.1 }}>{c.charge}</strong>
            </div>
          ))}

          {/* f-block placeholders in main table */}
          {[{ row: 6, label: '* 57–71', f: 'lanthanide', title: 'Lanthanides Series (Elements 57–71)' }, { row: 7, label: '** 89–103', f: 'actinide', title: 'Actinides Series (Elements 89–103)' }].map(p => (
            <div key={p.row} title={p.title} style={{
              gridColumn: 3, gridRow: p.row + 1, borderRadius: '6px', border: `1px dashed ${FAMILY_COLORS[p.f].border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 700, color: FAMILY_COLORS[p.f].text,
              background: FAMILY_COLORS[p.f].bg, userSelect: 'none'
            }}>{p.label}</div>
          ))}

          {/* f-block series row labels on the left (Columns 1-2) */}
          <div style={{
            gridColumn: '1 / span 2', gridRow: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: '6px', fontSize: '0.66rem', fontWeight: 700,
            color: FAMILY_COLORS.lanthanide.text, userSelect: 'none', letterSpacing: '0.02em'
          }}>
            * Lanthanides
          </div>
          <div style={{
            gridColumn: '1 / span 2', gridRow: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: '6px', fontSize: '0.66rem', fontWeight: 700,
            color: FAMILY_COLORS.actinide.text, userSelect: 'none', letterSpacing: '0.02em'
          }}>
            ** Actinides
          </div>

          {ELEMENTS.map(e => {
            const f = FAMILY_COLORS[e.family] || FAMILY_COLORS.unknown;
            const isSel = e.z === selZ;
            const on = matchesFilter(e.z);
            const val = getElementTrendValue(e, trendMetric);
            const radioactive = isRadioactiveEl(e.z);
            const nStats = elementNuclearStats.get(e.z);

            // Construct rich descriptive title for hover tooltip
            const titleTip = nuclides && nStats
              ? `${e.name} (${e.symbol}) — Z=${e.z}, Mass=${e.mass} u\n` +
                `• Known Ground States: ${nStats.total} isotopes\n` +
                `• Stable Isotopes: ${nStats.stableCount} (${nStats.isRadioactive ? 'Completely radioactive' : 'Has stable isotope(s)'})\n` +
                (nStats.primaryRadio ? `• Primary Radioisotope: ${e.symbol}-${nStats.primaryRadio[0]} (t½ = ${nStats.primaryRadio[1]})\n` : '') +
                (nStats.primaryQMeV != null ? `• Primary Decay Q: ${nStats.primaryQMeV} MeV (${fmtSig(nStats.primaryQKeV)} keV)\n` : '') +
                (nStats.maxQMeV != null ? `• Max Decay Q: ${nStats.maxQMeV} MeV\n` : '') +
                `• ${TREND_LABELS[trendMetric]?.name}: ${val ?? 'n/a'} ${TREND_LABELS[trendMetric]?.unit ?? ''}`
              : `${e.name} (Z=${e.z}) — ${TREND_LABELS[trendMetric]?.name}: ${val ?? 'n/a'} ${TREND_LABELS[trendMetric]?.unit ?? ''}`;

            return (
              <button
                key={e.z}
                id={`pt-el-${e.symbol}`}
                onClick={() => selectElement(e.z)}
                title={titleTip}
                style={{
                  gridColumn: e.x, gridRow: e.y + 1,
                  borderRadius: '6px', padding: '2px 2px', cursor: 'pointer', position: 'relative',
                  minWidth: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden',
                  background: isSel ? 'var(--accent-purple)' : f.bg,
                  border: isSel ? '2px solid #fff' : `1px solid ${f.border}`,
                  opacity: hoverFam ? (e.family === hoverFam || (hoverFam === 'unknown' && !FAMILY_COLORS[e.family]) ? 1 : 0.12) : (on ? 1 : 0.15),
                  boxShadow: hoverFam && e.family === hoverFam ? `0 0 10px ${f.border}` : (isSel ? '0 0 12px rgba(168,85,247,0.7)' : 'none'),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                  color: '#fff', transition: 'transform 0.12s ease, opacity 0.15s ease, box-shadow 0.15s ease', lineHeight: 1.05
                }}
                onMouseEnter={(ev) => { ev.currentTarget.style.transform = 'scale(1.15)'; ev.currentTarget.style.zIndex = 3; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.transform = 'scale(1)'; ev.currentTarget.style.zIndex = 0; }}
              >
                {/* Top: Z & Radioactive / Stability status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', padding: '0 1px' }}>
                  <span style={{ fontSize: '0.55rem', color: isSel ? '#070a12' : 'var(--text-dim)', fontWeight: 600 }}>{e.z}</span>
                  {radioactive ? (
                    <span style={{ fontSize: '0.55rem', color: isSel ? '#070a12' : '#fde047', fontWeight: 700 }} title="All isotopes are radioactive">☢</span>
                  ) : (
                    <span style={{ fontSize: '0.48rem', color: isSel ? '#070a12' : '#34d399', fontWeight: 700 }} title={`${nStats?.stableCount ?? ''} stable isotopes`}>
                      ✓{nStats?.stableCount ?? ''}
                    </span>
                  )}
                </div>

                {/* Center: Symbol */}
                <strong style={{ fontSize: '0.86rem', color: isSel ? '#070a12' : '#fff', fontWeight: 800 }}>{e.symbol}</strong>

                {/* Bottom: Nuclear or Chemical Value */}
                {viewMode === 'nuclear' ? (
                  ['isotopes', 'stable_iso', 'decay_q', 'max_decay_q'].includes(trendMetric) ? (
                    <span style={{ fontSize: '0.48rem', color: isSel ? '#070a12' : f.text, whiteSpace: 'nowrap' }}>
                      {val != null ? `${val}${trendMetric === 'decay_q' || trendMetric === 'max_decay_q' ? 'M' : ''}` : '—'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.45rem', color: isSel ? '#070a12' : (radioactive ? '#fde047' : 'var(--accent-cyan)'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {nStats ? `${nStats.total}i` : ''}·{radioactive ? (nStats?.primaryQMeV != null ? `${nStats.primaryQMeV}M` : '☢') : (nStats?.primaryQMeV != null ? `${nStats.primaryQMeV}M` : 'St')}
                    </span>
                  )
                ) : (
                  <span style={{ fontSize: '0.5rem', color: isSel ? '#070a12' : f.text, whiteSpace: 'nowrap' }}>
                    {val ?? '—'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', fontSize: '0.7rem' }}>
          {Object.entries(FAMILY_COLORS).map(([k, f], idx, arr) => {
            const info = FAMILY_KID_INFO[k];
            const open = hoverFam === k;
            const count = ELEMENTS.filter(e => (k === 'unknown' ? !FAMILY_COLORS[e.family] || e.family === 'unknown' : e.family === k)).length;
            return (
              <div
                key={k}
                id={`pt-legend-${k}`}
                tabIndex={0}
                role="button"
                aria-describedby={open ? `pt-legend-tip-${k}` : undefined}
                onMouseEnter={() => setHoverFam(k)}
                onMouseLeave={() => setHoverFam(null)}
                onFocus={() => setHoverFam(k)}
                onBlur={() => setHoverFam(null)}
                style={{
                  position: 'relative', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'help',
                  padding: '0.2rem 0.45rem', borderRadius: 6, outline: 'none',
                  background: open ? f.bg : 'transparent', border: `1px solid ${open ? f.border : 'transparent'}`,
                  transition: 'background 0.15s ease, border-color 0.15s ease'
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 3, background: f.bg, border: `1px solid ${f.border}` }} />
                <span style={{ color: open ? f.text : 'var(--text-muted)' }}>{f.name}</span>
                {open && info && (
                  <div
                    id={`pt-legend-tip-${k}`}
                    role="tooltip"
                    style={{
                      position: 'absolute', bottom: 'calc(100% + 10px)', ...(idx < arr.length / 2 ? { left: 0 } : { right: 0 }), zIndex: 50, width: 290,
                      background: 'rgba(10, 15, 28, 0.97)', border: `1px solid ${f.border}`, borderRadius: 12,
                      padding: '0.8rem 0.9rem', boxShadow: `0 14px 34px -10px rgba(0,0,0,0.7), 0 0 18px ${f.border}33`,
                      backdropFilter: 'blur(14px)', color: '#e2e8f0', fontSize: '0.78rem', lineHeight: 1.5,
                      pointerEvents: 'none', animation: 'modalEnter 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{info.emoji}</span>
                      <strong style={{ color: f.text, fontSize: '0.9rem' }}>{f.name}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{count} elements</span>
                    </div>
                    <p style={{ margin: '0 0 0.45rem' }}>{info.summary}</p>
                    <p style={{ margin: '0 0 0.3rem' }}><strong style={{ color: f.text }}>You know these:</strong> {info.examples}</p>
                    <p style={{ margin: 0 }}><strong style={{ color: f.text }}>💧 Water connection:</strong> {info.water}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspector: element + isotopes | decay */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        {/* Element & isotope list */}
        <div style={{ ...card, border: `1px solid ${fam.border}66` }}>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: 10, background: fam.bg, border: `2px solid ${fam.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{el?.z}</span>
              <strong style={{ fontSize: '1.5rem' }}>{el?.symbol}</strong>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.3rem' }}>
                <strong style={{ fontSize: '1.15rem' }}>{el?.name}</strong>
                {currStats && (
                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', fontFamily: 'var(--font-mono)' }}>
                    {currStats.total} known isotopes ({currStats.stableCount} stable)
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">{fam.name} · Period {el?.period} · Atomic mass {el?.mass}</div>
              <div className="text-xs" style={{ marginTop: '0.2rem', color: isRadioactiveEl(selZ) ? '#fde047' : 'var(--accent-emerald)' }}>
                {isRadioactiveEl(selZ) ? '☢ No stable isotopes — all known isotopes are radioactive' : '✓ Naturally stable element (has non-radioactive isotopes)'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.85rem' }}>
            {[
              ['Radius', el?.radius, 'pm'], ['1st IE', el?.ie, 'kJ/mol'], ['EN', el?.en, ''], ['EA', el?.ea, 'kJ/mol']
            ].map(([k, v, u]) => (
              <div key={k} style={kpi}>
                <span className="text-xs text-muted" style={{ display: 'block' }}>{k}</span>
                <strong style={{ fontSize: '0.85rem' }}>{v ?? '—'} <span className="text-xs text-muted">{v != null ? u : ''}</span></strong>
              </div>
            ))}
          </div>

          {/* Isotope Mass & Decay Energy Spectrum Track */}
          {isotopesByA.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: '0.6rem', marginBottom: '0.85rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.72rem' }}>
                <strong style={{ color: 'var(--accent-cyan)' }}>
                  Isotope Mass &amp; Decay Q-Spectrum ({isotopesByA[0][0]} – {isotopesByA[isotopesByA.length - 1][0]})
                </strong>
                <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                  Bar height = Q-value (MeV) · Green = Stable
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48, background: 'rgba(255,255,255,0.02)', padding: '2px 4px', borderRadius: 4, overflowX: 'auto' }}>
                {isotopesByA.map(n => {
                  const isCur = n[0] === effA;
                  const isSt = n[1] === 'Stable';
                  const qKeV = getNuclidePrimaryQ(n);
                  const hPct = isSt ? 30 : Math.max(15, Math.min(100, (qKeV / maxQForElement) * 100));
                  const pm = primaryMode(n[3]);
                  const barColor = isCur
                    ? 'var(--accent-purple)'
                    : isSt
                    ? 'var(--accent-emerald)'
                    : pm?.[0] === 'A'
                    ? 'var(--accent-rose)'
                    : pm?.[0]?.includes('B-')
                    ? '#38bdf8'
                    : '#fb923c';

                  return (
                    <div
                      key={n[0]}
                      onClick={() => selectNuclide(selZ, n[0])}
                      title={`${el?.symbol}-${n[0]} (${isSt ? 'Stable' : fmtTime(n[2])})\nDecay Q: ${fmtQMeV(qKeV)}\nMode: ${pm ? pm[0] : 'None'}`}
                      style={{
                        flex: '1 0 7px',
                        minWidth: 7,
                        maxWidth: 16,
                        height: `${hPct}%`,
                        background: barColor,
                        borderRadius: '2px 2px 0 0',
                        cursor: 'pointer',
                        opacity: isCur ? 1 : 0.75,
                        outline: isCur ? '2px solid #fff' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 3 }}>
                <span>A = {isotopesByA[0][0]}</span>
                <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Selected: {el?.symbol}-{effA}</span>
                <span>A = {isotopesByA[isotopesByA.length - 1][0]}</span>
              </div>
            </div>
          )}

          {/* Isotope Search, Filter & Sort Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                Isotopes Table ({filteredIsotopes.length} of {isotopes.length})
              </strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="text-xs text-muted">Sort:</span>
                <select
                  value={isoSort}
                  onChange={(e) => setIsoSort(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.5)', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                >
                  <option value="default">Default (Stable first, then t½)</option>
                  <option value="A">Mass number A (A → Z)</option>
                  <option value="q">Decay Energy Q (Highest first)</option>
                  <option value="halfLife">Half-life (Longest first)</option>
                  <option value="abund">Natural abundance %</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search isotope (e.g. 238, stable, alpha)..."
                value={isoSearch}
                onChange={(e) => setIsoSearch(e.target.value)}
                style={{
                  flex: '1 1 140px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.72rem',
                  color: 'var(--text-main)'
                }}
              />
              <div style={{ display: 'flex', gap: '0.2rem' }}>
                {[
                  ['all', 'All'],
                  ['stable', 'Stable'],
                  ['radioactive', '☢ Radio'],
                  ['alpha', 'α Alpha'],
                  ['beta', 'β Beta/EC']
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setIsoFilter(id)}
                    style={{
                      ...chip(isoFilter === id, '#a855f7'),
                      fontSize: '0.68rem',
                      padding: '0.2rem 0.45rem'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Isotopes table */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0c121e', zIndex: 1 }}>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '0.35rem' }}>Nuclide</th>
                  <th style={{ textAlign: 'right', padding: '0.35rem' }}>Half-life</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem' }}>Decay Mode</th>
                  <th style={{ textAlign: 'right', padding: '0.35rem', color: '#fde047' }}>Decay Energy Q</th>
                  <th style={{ textAlign: 'right', padding: '0.35rem' }}>Abund. / Daughter</th>
                </tr>
              </thead>
              <tbody>
                {!nuclides && <tr><td colSpan="5" style={{ padding: '0.6rem' }} className="text-muted">Loading…</td></tr>}
                {visibleIsotopes.length === 0 && nuclides && (
                  <tr><td colSpan="5" style={{ padding: '0.6rem', textAlign: 'center' }} className="text-muted">No isotopes matching current filter/search.</td></tr>
                )}
                {visibleIsotopes.map(n => {
                  const active = n[0] === effA;
                  const pm = primaryMode(n[3]);
                  const qKeV = getNuclidePrimaryQ(n);
                  const qStr = fmtQMeV(qKeV);
                  const isSt = n[1] === 'Stable';
                  const dInfo = pm ? MODE_INFO[pm[0]] : null;
                  const daughterSym = dInfo?.d ? sym(selZ + dInfo.d[0], n[0] + dInfo.d[1]) : null;

                  return (
                    <tr
                      key={n[0]}
                      onClick={() => selectNuclide(selZ, n[0])}
                      style={{
                        cursor: 'pointer',
                        background: active ? 'rgba(168,85,247,0.25)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.04)'
                      }}
                    >
                      <td style={{ padding: '0.32rem', fontWeight: 700, color: isSt ? 'var(--accent-emerald)' : '#fde047' }}>
                        {el?.symbol}-{n[0]}
                      </td>
                      <td style={{ padding: '0.32rem', textAlign: 'right' }}>
                        {isSt ? 'Stable' : fmtTime(n[2])}
                      </td>
                      <td style={{ padding: '0.32rem' }}>
                        {pm ? (
                          <span style={{ color: pm[0] === 'A' ? 'var(--accent-rose)' : pm[0].includes('B-') ? '#38bdf8' : '#fb923c' }}>
                            {pm[0]}{pm[1] != null ? ` ${fmtSig(pm[1])}%` : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.32rem', textAlign: 'right', fontWeight: 600, color: qKeV ? '#fde047' : 'var(--text-dim)' }}>
                        {qStr}
                      </td>
                      <td style={{ padding: '0.32rem', textAlign: 'right' }}>
                        {n[4] != null ? (
                          <span style={{ color: 'var(--accent-emerald)' }}>{n[4]}%</span>
                        ) : daughterSym ? (
                          <span style={{ color: 'var(--text-dim)' }}>→ {daughterSym}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredIsotopes.length > 12 && (
            <button
              className="btn-secondary"
              style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.3rem 0.7rem', width: '100%' }}
              onClick={() => setShowAllIsotopes(!showAllIsotopes)}
            >
              {showAllIsotopes ? 'Show fewer (top 12)' : `Show all ${filteredIsotopes.length} matching isotopes`}
            </button>
          )}
        </div>

        {/* Decay panel & Nuclear Energetics */}
        <div style={{ ...card, border: '1px solid rgba(253, 224, 71, 0.3)' }}>
          {!nuc ? (
            <span className="text-muted">{nuclides ? 'No nuclide data for this element.' : 'Loading nuclide data…'}</span>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: decay.stable ? 'var(--accent-emerald)' : '#fde047' }}>
                  <sup style={{ fontSize: '0.9rem' }}>{nuc[0]}</sup>{el?.symbol}
                </span>
                <strong style={{ fontSize: '1.1rem' }}>{el?.name}-{nuc[0]}</strong>
                <span className="text-xs text-muted">Z = {selZ}, N = {nuc[0] - selZ} (N/Z = {((nuc[0] - selZ) / selZ).toFixed(3)})</span>
              </div>

              {decay.stable ? (
                <div style={{ marginTop: '0.75rem', padding: '0.85rem', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--accent-emerald)' }}>✓ Stable ground-state nuclide: no spontaneous radioactive decay.</strong>
                  <div style={{ marginTop: '0.3rem' }}>
                    {nuc[4] != null ? (
                      <>Natural terrestrial abundance is <strong>{nuc[4]}%</strong>.</>
                    ) : (
                      <>Synthetic or minor stable isotope.</>
                    )} Choose another isotope in the list or spectrum bar above to explore radioactive decay modes and Q-values.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', margin: '0.85rem 0' }}>
                    <div style={kpi}>
                      <span className="text-xs text-muted" style={{ display: 'block' }}>Primary Decay Mode</span>
                      <strong style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>
                        {decay.info?.label ?? decay.pm?.[0] ?? '—'}{decay.pm?.[1] != null ? ` (${fmtSig(decay.pm[1])}%)` : ''}
                      </strong>
                    </div>
                    <div style={kpi}>
                      <span className="text-xs text-muted" style={{ display: 'block' }}>Half-life t½</span>
                      <strong style={{ color: 'var(--accent-amber)', fontSize: '0.85rem' }}>{fmtTime(decay.hls)}</strong>
                      <div className="text-xs text-dim">{nuc[1]}</div>
                    </div>
                    <div style={kpi}>
                      <span className="text-xs text-muted" style={{ display: 'block' }}>Decay Energy Q</span>
                      <strong style={{ color: '#fde047', fontSize: '0.85rem' }}>{fmtQMeV(decay.qKeV)}</strong>
                      <div className="text-xs text-dim">{decay.qKeV ? `${decay.qKeV.toLocaleString()} keV` : '—'}</div>
                    </div>
                    <div style={kpi}>
                      <span className="text-xs text-muted" style={{ display: 'block' }}>Decay Constant λ</span>
                      <strong style={{ color: 'var(--accent-blue)', fontSize: '0.82rem' }}>{fmtSig(decay.lambdaS)} s⁻¹</strong>
                      <div className="text-xs text-dim">{fmtSig(decay.lambdaS * SEC_PER_YEAR)} yr⁻¹</div>
                    </div>
                    <div style={kpi}>
                      <span className="text-xs text-muted" style={{ display: 'block' }}>Specific Activity</span>
                      <strong style={{ color: 'var(--accent-purple)', fontSize: '0.82rem' }}>{fmtSig(decay.specAct)} Bq/g</strong>
                      <div className="text-xs text-dim">{fmtSig(decay.specAct / 3.7e10)} Ci/g</div>
                    </div>
                    <div style={kpi}>
                      <span className="text-xs text-muted" style={{ display: 'block' }}>Daughter Nuclide</span>
                      {decay.daughter ? (
                        <button
                          style={{ ...chip(true, '#38bdf8'), marginTop: 2 }}
                          onClick={() => selectNuclide(decay.daughter.z, decay.daughter.A)}
                          title="Jump to daughter nuclide"
                        >
                          {sym(decay.daughter.z, decay.daughter.A)} →
                        </button>
                      ) : <strong style={{ fontSize: '0.82rem' }}>Fission fragments</strong>}
                    </div>
                  </div>

                  {/* Comprehensive Decay Kinematics & Reaction Energetics Card */}
                  {kinematics && (
                    <div style={{ background: 'rgba(253, 224, 71, 0.05)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.85rem', border: '1px solid rgba(253, 224, 71, 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                        <strong style={{ fontSize: '0.82rem', color: '#fde047' }}>
                          ⚡ Nuclear Reaction Kinematics &amp; Energetics
                        </strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          Q = Δm · c²
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.45rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: 4 }}>
                          <span className="text-muted" style={{ display: 'block', fontSize: '0.65rem' }}>Total Q-Value</span>
                          <strong style={{ color: '#fde047' }}>{kinematics.qMeV != null ? `${kinematics.qMeV.toFixed(4)} MeV` : '—'}</strong>
                          <div className="text-dim" style={{ fontSize: '0.65rem' }}>{kinematics.qKeV != null ? `${kinematics.qKeV.toLocaleString()} keV` : '—'}</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: 4 }}>
                          <span className="text-muted" style={{ display: 'block', fontSize: '0.65rem' }}>Energy per Disintegration</span>
                          <strong style={{ color: '#38bdf8' }}>{kinematics.qJoules != null ? `${kinematics.qJoules.toExponential(4)} J` : '—'}</strong>
                          <div className="text-dim" style={{ fontSize: '0.65rem' }}>1 MeV = 1.6022×10⁻¹³ J</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: 4 }}>
                          <span className="text-muted" style={{ display: 'block', fontSize: '0.65rem' }}>Mass Defect (Δm)</span>
                          <strong style={{ color: 'var(--accent-emerald)' }}>{kinematics.deltaM_u != null ? `${kinematics.deltaM_u.toFixed(6)} u` : '—'}</strong>
                          <div className="text-dim" style={{ fontSize: '0.65rem' }}>{kinematics.deltaM_kg != null ? `${kinematics.deltaM_kg.toExponential(3)} kg` : '—'}</div>
                        </div>
                      </div>

                      {/* Mode-specific kinematics partitioning */}
                      {kinematics.isAlpha && kinematics.alphaKinematics && (
                        <div style={{ background: 'rgba(244,63,94,0.08)', borderRadius: 6, padding: '0.5rem', marginBottom: '0.45rem', fontSize: '0.72rem', border: '1px solid rgba(244,63,94,0.2)' }}>
                          <strong style={{ color: 'var(--accent-rose)' }}>2-Body Alpha Recoil Kinematics:</strong>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.35rem', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                            <div>Alpha Particle (E<sub>α</sub>): <strong style={{ color: '#fff' }}>{kinematics.alphaKinematics.eAlphaMeV?.toFixed(4) ?? '—'} MeV</strong> ({kinematics.alphaKinematics.alphaPct?.toFixed(2) ?? '—'}%)</div>
                            <div>Daughter Recoil (E<sub>recoil</sub>): <strong style={{ color: '#fff' }}>{kinematics.alphaKinematics.eRecoilKeV?.toFixed(2) ?? '—'} keV</strong> ({kinematics.alphaKinematics.recoilPct?.toFixed(2) ?? '—'}%)</div>
                          </div>
                        </div>
                      )}

                      {kinematics.isBetaMinus && kinematics.betaMinusKinematics && (
                        <div style={{ background: 'rgba(56,189,248,0.08)', borderRadius: 6, padding: '0.5rem', marginBottom: '0.45rem', fontSize: '0.72rem', border: '1px solid rgba(56,189,248,0.2)' }}>
                          <strong style={{ color: '#38bdf8' }}>Beta-Minus 3-Body Continuum:</strong>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.35rem', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                            <div>β⁻ Endpoint E<sub>max</sub>: <strong style={{ color: '#fff' }}>{kinematics.betaMinusKinematics.eEndpointMeV?.toFixed(4) ?? '—'} MeV</strong></div>
                            <div>β⁻ Average E<sub>avg</sub>: <strong style={{ color: '#fff' }}>{kinematics.betaMinusKinematics.eAvgBetaMeV?.toFixed(4) ?? '—'} MeV</strong> (~Q/3)</div>
                            <div>Antineutrino ν̄<sub>e</sub> avg: <strong style={{ color: '#fff' }}>{kinematics.betaMinusKinematics.eAvgNuMeV?.toFixed(4) ?? '—'} MeV</strong> (~2Q/3)</div>
                          </div>
                        </div>
                      )}

                      {kinematics.isBetaPlus && kinematics.betaPlusKinematics && (
                        <div style={{ background: 'rgba(168,85,247,0.08)', borderRadius: 6, padding: '0.5rem', marginBottom: '0.45rem', fontSize: '0.72rem', border: '1px solid rgba(168,85,247,0.2)' }}>
                          <strong style={{ color: 'var(--accent-purple)' }}>Positron Emission (β⁺) &amp; Annihilation:</strong>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.35rem', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                            <div>Threshold (2m<sub>e</sub>c²): <strong style={{ color: '#fff' }}>1.0220 MeV</strong></div>
                            <div>β⁺ Endpoint E<sub>max</sub>: <strong style={{ color: '#fff' }}>{kinematics.betaPlusKinematics.eBetaPlusMaxMeV?.toFixed(4) ?? '—'} MeV</strong></div>
                            <div>Annihilation Radiation: <strong style={{ color: '#fff' }}>2 × 511 keV γ-rays</strong></div>
                          </div>
                        </div>
                      )}

                      {/* Tabulated ENSDF Q-Values */}
                      {(nuc[5] != null || nuc[6] != null || nuc[7] != null) && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <span>Tabulated Q-values:</span>
                          {nuc[5] != null && <span>Q<sub>α</sub> = <strong style={{ color: 'var(--text-main)' }}>{(nuc[5] / 1000).toFixed(3)} MeV</strong></span>}
                          {nuc[6] != null && <span>Q<sub>β⁻</sub> = <strong style={{ color: 'var(--text-main)' }}>{(nuc[6] / 1000).toFixed(3)} MeV</strong></span>}
                          {nuc[7] != null && <span>Q<sub>EC</sub> = <strong style={{ color: 'var(--text-main)' }}>{(nuc[7] / 1000).toFixed(3)} MeV</strong></span>}
                        </div>
                      )}
                    </div>
                  )}

                  {nuc[3].length > 1 && (
                    <div className="text-xs text-muted" style={{ marginBottom: '0.6rem' }}>
                      All branches: {nuc[3].map(m => `${MODE_INFO[m[0]]?.label ?? m[0]}${m[1] != null ? ` ${fmtSig(m[1])}%` : ''}`).join(' · ')}
                    </div>
                  )}

                  {/* Decay curve */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <strong style={{ color: 'var(--accent-cyan)' }}>N(t) = N₀·e<sup>−λt</sup></strong>
                      <span>After <strong>{elapsedHalfLives.toFixed(1)}</strong> half-lives ({fmtTime(elapsedHalfLives * decay.hls)}): <strong style={{ color: '#fde047' }}>{fmtSig(100 * Math.pow(2, -elapsedHalfLives))}%</strong> remains</span>
                    </div>
                    <svg viewBox={`0 0 ${curve.W} ${curve.H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                      <line x1={curve.x0} y1={curve.y0 + curve.h} x2={curve.x0 + curve.w} y2={curve.y0 + curve.h} stroke="rgba(255,255,255,0.2)" />
                      <line x1={curve.x0} y1={curve.y0} x2={curve.x0} y2={curve.y0 + curve.h} stroke="rgba(255,255,255,0.2)" />
                      {[0, 1, 2, 3, 4, 5, 6].map(n => (
                        <g key={n}>
                          <line x1={curve.x0 + (n / curve.maxN) * curve.w} y1={curve.y0} x2={curve.x0 + (n / curve.maxN) * curve.w} y2={curve.y0 + curve.h} stroke="rgba(255,255,255,0.05)" />
                          <text x={curve.x0 + (n / curve.maxN) * curve.w} y={curve.y0 + curve.h + 12} fill="var(--text-dim)" fontSize="8" textAnchor="middle">{n}t½</text>
                        </g>
                      ))}
                      {[1, 0.5, 0.25].map(f => (
                        <text key={f} x={curve.x0 - 4} y={curve.y0 + curve.h - f * curve.h + 3} fill="var(--text-dim)" fontSize="8" textAnchor="end">{f * 100}%</text>
                      ))}
                      <path d={curve.path} fill="none" stroke="#fde047" strokeWidth="2" />
                      <line x1={curve.mx} y1={curve.y0} x2={curve.mx} y2={curve.y0 + curve.h} stroke="rgba(56,189,248,0.5)" strokeDasharray="3 3" />
                      <circle cx={curve.mx} cy={curve.my} r="4.5" fill="#38bdf8" stroke="#fff" />
                      <text x={curve.x0 + curve.w / 2} y={curve.H - 2} fill="var(--text-muted)" fontSize="8" textAnchor="middle">time (half-lives)</text>
                    </svg>
                    <input id="pt-decay-slider" type="range" min="0" max="6" step="0.1" value={elapsedHalfLives} onChange={(e) => setElapsedHalfLives(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8' }} />
                  </div>
                </>
              )}

              {/* Decay chain */}
              {chain.length > 1 && (
                <div style={{ marginTop: '0.85rem' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Decay chain (following the main branch):</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem' }}>
                    {chain.map((s, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        {s.end === 'fission' ? (
                          <span className="text-xs" style={{ color: 'var(--accent-rose)' }}>fission fragments</span>
                        ) : (
                          <button
                            onClick={() => selectNuclide(s.z, s.A)}
                            title={s.hl}
                            style={{ ...chip(s.z === selZ && s.A === effA, s.end === 'stable' ? '#10b981' : '#fde047'), fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}
                          >
                            {sym(s.z, s.A)} <span style={{ opacity: 0.7 }}>{s.hl}</span>
                          </button>
                        )}
                        {i < chain.length - 1 && <span className="text-xs text-muted">{s.mode ? `—${s.mode}→` : '→'}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {isoResonances.length > 0 && (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem', borderRadius: 6, background: 'rgba(251,146,60,0.1)', fontSize: '0.78rem' }}>
                  <strong style={{ color: '#fb923c' }}>Resonance{isoResonances.length > 1 ? 's' : ''}:</strong> {isoResonances.map(r => `${fmtEnergy(r.E)} ${r.rx}`).join(', ')}
                  {isoResonances[0].sigma && <> · σ<sub>th</sub> ≈ {fmtSig(isoResonances[0].sigma)} b</>}
                </div>
              )}

              {notes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.78rem', lineHeight: 1.55 }}>
                  <div style={{ background: 'rgba(168,85,247,0.08)', padding: '0.6rem', borderRadius: 6 }}><strong style={{ color: 'var(--accent-purple)' }}>Nuclear engineering role:</strong> {notes.role}</div>
                  <div style={{ background: 'rgba(244,63,94,0.08)', padding: '0.6rem', borderRadius: 6 }}><strong style={{ color: 'var(--accent-rose)' }}>Drinking water / environment:</strong> {notes.water}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Trend chart */}
      <div style={card}>
        <strong style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>Periodic Trend: {TREND_LABELS[trendMetric]?.name ?? trendMetric}</strong>
        <p className="text-xs text-muted" style={{ margin: '0.2rem 0 0.6rem' }}>{TREND_LABELS[trendMetric]?.desc} Gaps mean no measured/tabulated value. Click a point to select the element.</p>
        {(() => {
          const W = 760, H = 230, x0 = 50, y0 = 15, w = W - x0 - 15, h = H - y0 - 35;
          const pts = ELEMENTS.map(e => ({ e, val: getElementTrendValue(e, trendMetric) })).filter(item => item.val != null);
          if (!pts.length) {
            return <div className="text-muted text-xs" style={{ padding: '1rem', textAlign: 'center' }}>No data points available for {trendMetric}</div>;
          }
          const vals = pts.map(p => p.val);
          const vMax = Math.max(...vals), vMin = Math.min(0, ...vals);
          const range = vMax - vMin || 1;
          const X = z => x0 + ((z - 1) / 117) * w;
          const Y = v => y0 + h - ((v - vMin) / range) * h;
          let d = '';
          let prevZ = null;
          pts.forEach(({ e, val }) => {
            d += `${prevZ !== null && e.z === prevZ + 1 ? 'L' : 'M'} ${X(e.z)} ${Y(val)} `;
            prevZ = e.z;
          });
          return (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <rect x={x0} y={y0} width={w} height={h} fill="rgba(0,0,0,0.3)" rx="6" />
              {[2, 10, 18, 36, 54, 86, 118].map((z, i) => (
                <g key={z}>
                  <line x1={X(z)} y1={y0} x2={X(z)} y2={y0 + h} stroke="rgba(168,85,247,0.25)" strokeDasharray="3 3" />
                  <text x={X(z) - 3} y={y0 + 10} fill="var(--text-dim)" fontSize="8" textAnchor="end">P{i + 1}</text>
                </g>
              ))}
              {vMin < 0 && <line x1={x0} y1={Y(0)} x2={x0 + w} y2={Y(0)} stroke="rgba(255,255,255,0.2)" />}
              <path d={d} fill="none" stroke="var(--accent-cyan)" strokeWidth="1.6" />
              {pts.map(({ e, val }) => (
                <circle
                  key={e.z}
                  cx={X(e.z)}
                  cy={Y(val)}
                  r={e.z === selZ ? 5 : 2.2}
                  fill={e.z === selZ ? 'var(--accent-purple)' : (FAMILY_COLORS[e.family]?.border || '#38bdf8')}
                  stroke="#fff"
                  strokeWidth={e.z === selZ ? 2 : 0.3}
                  style={{ cursor: 'pointer' }}
                  onClick={() => selectElement(e.z)}
                >
                  <title>{e.name} ({e.symbol}): {val} {TREND_LABELS[trendMetric]?.unit ?? ''}</title>
                </circle>
              ))}
              {[1, 20, 40, 60, 80, 100, 118].map(z => <text key={z} x={X(z)} y={y0 + h + 12} fill="var(--text-dim)" fontSize="8" textAnchor="middle">{z}</text>)}
              <text x={x0 + w / 2} y={H - 4} fill="var(--text-muted)" fontSize="9" textAnchor="middle">Atomic number Z (dashed lines = end of each period / noble gas)</text>
              <text x="12" y={y0 + h / 2} fill="var(--text-muted)" fontSize="9" textAnchor="middle" transform={`rotate(-90 12 ${y0 + h / 2})`}>{TREND_LABELS[trendMetric]?.unit || ''}</text>
            </svg>
          );
        })()}
      </div>

      {/* Resonance energies section */}
      <div style={{ ...card, border: '1px solid rgba(251,146,60,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <strong style={{ fontSize: '0.95rem', color: '#fb923c' }}>Resonance Energies of Common Interest &amp; Applications</strong>
            <p className="text-xs text-muted" style={{ margin: '0.2rem 0 0' }}>
              A resonance is an energy where a nucleus absorbs a neutron (or gamma ray) far more readily than at nearby energies, because the incoming energy matches an excited state of the compound nucleus.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
          <button style={chip(resCat === 'all', '#fb923c')} onClick={() => setResCat('all')}>All</button>
          {Object.entries(RES_CATS).map(([k, c]) => (
            <button key={k} style={chip(resCat === k, c.color)} onClick={() => setResCat(k)}>{c.name}</button>
          ))}
        </div>

        {/* Log energy axis */}
        <svg viewBox="0 0 760 210" style={{ width: '100%', height: 'auto', display: 'block', background: 'rgba(0,0,0,0.25)', borderRadius: 8 }}>
          {/* energy regions */}
          <rect x={ex(0.01)} y="20" width={ex(0.5) - ex(0.01)} height="150" fill="rgba(56,189,248,0.07)" />
          <rect x={ex(0.5)} y="20" width={ex(1e5) - ex(0.5)} height="150" fill="rgba(251,146,60,0.05)" />
          <text x={(ex(0.01) + ex(0.5)) / 2} y="34" fill="#7dd3fc" fontSize="9" textAnchor="middle">THERMAL (&lt; ~0.5 eV Cd cutoff)</text>
          <text x={(ex(0.5) + ex(1e5)) / 2} y="34" fill="#fdba74" fontSize="9" textAnchor="middle">EPITHERMAL / RESONANCE REGION → fast (&gt; 0.1 MeV)</text>
          <line x1={ex(0.0253)} y1="40" x2={ex(0.0253)} y2="170" stroke="rgba(56,189,248,0.6)" strokeDasharray="2 3" />
          <text x={ex(0.0253) + 3} y="166" fill="#7dd3fc" fontSize="8">0.0253 eV (2200 m/s)</text>
          {/* axis */}
          <line x1="50" y1="170" x2="730" y2="170" stroke="rgba(255,255,255,0.3)" />
          {[-2, -1, 0, 1, 2, 3, 4, 5].map(p => (
            <g key={p}>
              <line x1={ex(10 ** p)} y1="170" x2={ex(10 ** p)} y2="175" stroke="rgba(255,255,255,0.4)" />
              <text x={ex(10 ** p)} y="187" fill="var(--text-dim)" fontSize="9" textAnchor="middle">{fmtEnergy(10 ** p)}</text>
            </g>
          ))}
          <text x="390" y="204" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Energy (log scale)</text>
          {/* markers */}
          {resFiltered.map((r, i) => {
            const x = ex(r.E);
            const y = 60 + (i % 5) * 22;
            const c = RES_CATS[r.cat].color;
            const active = selRes === r;
            return (
              <g key={`${r.z}-${r.A}-${r.E}`} style={{ cursor: 'pointer' }} onClick={() => { setSelRes(r); selectNuclide(r.z, r.A); }}>
                <line x1={x} y1={y + 5} x2={x} y2="170" stroke={c} strokeOpacity={active ? 0.9 : 0.35} />
                <circle cx={x} cy={y} r={active ? 6 : 4.5} fill={c} stroke="#fff" strokeWidth={active ? 2 : 0.5} />
                <text x={x + 7} y={y + 3} fill={c} fontSize="9" fontWeight="700">{sym(r.z, r.A)}</text>
                <title>{sym(r.z, r.A)} {r.rx}: {fmtEnergy(r.E)} — {RES_CATS[r.cat].name}</title>
              </g>
            );
          })}
        </svg>

        {/* Table */}
        <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '0.35rem' }}>Nuclide</th>
                <th style={{ textAlign: 'right', padding: '0.35rem' }}>Resonance E₀</th>
                <th style={{ textAlign: 'left', padding: '0.35rem' }}>Reaction</th>
                <th style={{ textAlign: 'right', padding: '0.35rem' }}>σ thermal</th>
                <th style={{ textAlign: 'left', padding: '0.35rem' }}>Application</th>
                <th style={{ textAlign: 'left', padding: '0.35rem' }}>Why it matters</th>
              </tr>
            </thead>
            <tbody>
              {resFiltered.map(r => (
                <tr key={`${r.z}-${r.A}-${r.E}`} onClick={() => { setSelRes(r); selectNuclide(r.z, r.A); }}
                  style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', background: selRes === r ? 'rgba(251,146,60,0.15)' : 'transparent' }}>
                  <td style={{ padding: '0.35rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: RES_CATS[r.cat].color }}>{BY_Z[r.z].symbol}-{r.A}</td>
                  <td style={{ padding: '0.35rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtEnergy(r.E)}</td>
                  <td style={{ padding: '0.35rem', fontFamily: 'var(--font-mono)' }}>{r.rx}</td>
                  <td style={{ padding: '0.35rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.sigma ? `${fmtSig(r.sigma)} b` : '—'}</td>
                  <td style={{ padding: '0.35rem' }}>{RES_CATS[r.cat].name}</td>
                  <td style={{ padding: '0.35rem', color: 'var(--text-muted)', minWidth: 260 }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Application cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          {APPLICATIONS.filter(a => resCat === 'all' || a.cat === resCat || (resCat === 'fuel' && a.cat === 'doppler')).map(a => (
            <div key={a.cat} style={{ padding: '0.75rem', borderRadius: 8, background: `${RES_CATS[a.cat].color}14`, border: `1px solid ${RES_CATS[a.cat].color}40`, fontSize: '0.78rem', lineHeight: 1.55 }}>
              <strong style={{ color: RES_CATS[a.cat].color, display: 'block', marginBottom: '0.25rem' }}>{a.title}</strong>
              {a.body}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted" style={{ marginTop: '0.75rem' }}>
          Neutron values are the lowest strong resolved resonances, rounded, from ENDF/B-VIII.0 and the Mughabghab <em>Atlas of Neutron Resonances</em>. σ<sub>th</sub> is the 0.0253 eV cross section for the listed reaction. These are teaching values: check NNDC Sigma (nndc.bnl.gov/sigma) before using them in design.
        </p>
      </div>

      <p className="text-xs text-muted" style={{ margin: 0 }}>
        Element data: Periodic-Table-JSON (Bowserinator) and the mendeleev database. Nuclide half-lives, decay modes, Q-values and abundances: IAEA LiveChart of Nuclides (ENSDF, ground states). Q is shown for the main decay branch; for β⁺ the kinetic energy available is Q<sub>EC</sub> − 1.022 MeV.
      </p>
    </div>
  );
};

export default PeriodicNuclearStudio;
