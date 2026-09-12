import Component from './CanalVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'canal-lining',
  type: 'tool',
  title: "Canal Lining Estimator",
  category: "Hydraulics & Hydrology",
  componentName: 'CanalVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 2,
    "title": "Canal Lining Estimator",
    "badge": "Earthwork & Volume",
    "icon": "\ud83c\udfd7\ufe0f",
    "color": "var(--accent-amber)",
    "bgGlow": "rgba(245, 158, 11, 0.12)",
    "borderColor": "rgba(245, 158, 11, 0.3)",
    "formula": "V = Length \u00b7 Perimeter \u00b7 t \u00b7 (1 + Waste)",
    "description": "Parametric trapezoidal cross-section estimator with overexcavation and concrete waste factor modeling."
  }
],
  problems
};

export default plugin;
