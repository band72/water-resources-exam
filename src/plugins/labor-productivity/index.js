import Component from './LaborVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'labor-productivity',
  type: 'tool',
  title: "Labor Productivity & Cost",
  category: "Project Planning & Economics",
  componentName: 'LaborVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 4,
    "title": "Labor Productivity & Cost",
    "badge": "Project Planning",
    "icon": "\ud83d\udc77",
    "color": "#eab308",
    "bgGlow": "rgba(234, 179, 8, 0.12)",
    "borderColor": "rgba(234, 179, 8, 0.3)",
    "formula": "Productivity = Output / Work-Hours",
    "description": "Crew size, daily production rate, labor burden, and unit cost parametric estimator."
  }
],
  problems
};

export default plugin;
