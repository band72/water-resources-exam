import Component from './EconVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'econ-depreciation',
  type: 'tool',
  title: "Engineering Economics",
  category: "Project Planning & Economics",
  componentName: 'EconVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 3,
    "title": "Engineering Economics",
    "badge": "Depreciation & PV",
    "icon": "\ud83d\udcc8",
    "color": "var(--accent-emerald)",
    "bgGlow": "rgba(16, 185, 129, 0.12)",
    "borderColor": "rgba(16, 185, 129, 0.3)",
    "formula": "BV_t = Cost - t \u00b7 [(Cost - Salvage) / Life]",
    "description": "Straight-line depreciation calculator and cash-flow timeline for construction equipment valuation."
  }
],
  problems
};

export default plugin;
