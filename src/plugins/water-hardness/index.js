import Component from './HardnessVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'water-hardness',
  type: 'tool',
  title: "Water Hardness & Softening",
  category: "Water & Wastewater Systems",
  componentName: 'HardnessVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 86,
    "title": "Water Hardness & Softening",
    "badge": "Water Chemistry",
    "icon": "\ud83e\uddea",
    "color": "#10b981",
    "bgGlow": "rgba(16, 185, 129, 0.12)",
    "borderColor": "rgba(16, 185, 129, 0.3)",
    "formula": "meq/L = (mg/L) / EW \u00b7 CaCO3 = meq/L \u00b7 50",
    "description": "Cation and anion milliequivalent bar charts for lime-soda water softening and alkalinity balance."
  }
],
  problems
};

export default plugin;
