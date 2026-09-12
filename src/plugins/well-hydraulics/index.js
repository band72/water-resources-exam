import Component from './WellVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'well-hydraulics',
  type: 'tool',
  title: "Groundwater Well Hydraulics",
  category: "Hydraulics & Hydrology",
  componentName: 'WellVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 62,
    "title": "Groundwater Well Hydraulics",
    "badge": "Aquifer Drawdown",
    "icon": "\ud83d\udeb0",
    "color": "var(--accent-cyan)",
    "bgGlow": "rgba(6, 182, 212, 0.12)",
    "borderColor": "rgba(6, 182, 212, 0.3)",
    "formula": "s = (Q / 2\u03c0T) \u00b7 ln(R / r)",
    "description": "Theis and Dupuit equilibrium drawdown cones for steady radial flow in confined and unconfined aquifers."
  }
],
  problems
};

export default plugin;
