import Component from './HelicalHouseVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'helical-house',
  type: 'tool',
  title: "50'×50' House Slab & Helical Pile Design",
  category: 'Soil Mechanics & Foundations',
  componentName: 'HelicalHouseVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
    {
      id: 189,
      title: "50'×50' Slab & Helical Pile Design",
      badge: "Deep Foundations / Geotech",
      icon: "🏗️",
      color: "var(--accent-emerald)",
      bgGlow: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      formula: "Qult = Ah · qult(boring) · SF = Qult / Qallow",
      description: "50×50 ft house slab load modeling, direct geotechnical soil boring report integration (qult), hydrostatic pore pressure, and 4-tier Safety Factor comparison matrix (SF = 1.0, 1.5, 2.0, 3.0)."
    }
  ],
  problems
};

export default plugin;
