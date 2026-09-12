import Component from './EnergyRunoffVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'runoff-energy',
  type: 'tool',
  title: "Runoff Specific Energy",
  category: "Hydraulics & Hydrology",
  componentName: 'EnergyRunoffVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 82,
    "title": "Runoff Specific Energy",
    "badge": "Hydraulic Jumps",
    "icon": "\u26c8\ufe0f",
    "color": "var(--accent-rose)",
    "bgGlow": "rgba(244, 63, 94, 0.12)",
    "borderColor": "rgba(244, 63, 94, 0.3)",
    "formula": "E = y + V\u00b2 / (2g) \u00b7 Fr = V / \u221a(g \u00b7 y)",
    "description": "Specific energy curves, critical depth (yc), Froude number regimes, and hydraulic jump energy loss."
  }
],
  problems
};

export default plugin;
