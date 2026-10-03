import Component from './HardnessVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'water-hardness',
  type: 'tool',
  title: 'Water Hardness, Chemistry & Nuclear Studio',
  category: 'Water & Wastewater Systems',
  componentName: 'HardnessVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
    {
      id: 86,
      title: '3D Water Hardness & 3rd-Grader Molecular Lab',
      badge: 'Water Chemistry / 3D Simulation',
      icon: '🧊',
      color: '#38bdf8',
      bgGlow: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.3)',
      formula: 'TH = Ca Hardness + Mg Hardness, meq/L × 50.04',
      description: 'Interactive 3D water beaker with floating Ca2+ and Mg2+ mineral magnets, soap scum curd formation, boiling kettle scale precipitation, ion-exchange resin beads, and 3rd-grader intuition guides.'
    },
    {
      id: 87,
      title: 'Meq Converter & Softening Equation Balancer',
      badge: 'Chemistry / Neutrality Balance',
      icon: '⚗️',
      color: '#10b981',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      formula: 'meq/L = mg/L / EW, Lime: CO2 + Alk + Mg, Soda: NCH',
      description: 'Cation and anion milliequivalent bar charts, electroneutrality validator, and step-by-step stoichiometric balancing for lime-soda ash water softening precipitation reactions.'
    },
    {
      id: 93,
      title: 'Interactive Periodic Table & Nuclear Radionuclides',
      badge: 'Nuclear Engineering / Periodic Trends',
      icon: '⚛️',
      color: '#a855f7',
      bgGlow: 'rgba(168, 85, 247, 0.12)',
      borderColor: 'rgba(168, 85, 247, 0.3)',
      formula: 'N(t) = N0 · e^(-λt), Q-value MeV, Atomic Radius & Electronegativity',
      description: 'Complete 118-element interactive periodic table with radionuclide decay energies (U-235, Pu-239, Ra-226, Cs-137), nuclear cross-sections, and graphical element family trends.'
    }
  ],
  problems
};

export default plugin;
