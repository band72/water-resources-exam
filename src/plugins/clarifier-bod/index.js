import Component from './EnviroVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'clarifier-bod',
  type: 'tool',
  title: "Primary Clarifier (BOD)",
  category: "Water & Wastewater Systems",
  componentName: 'EnviroVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 77,
    "title": "Primary Clarifier (BOD)",
    "badge": "Wastewater Treatment",
    "icon": "\ud83e\uddea",
    "color": "var(--accent-purple)",
    "bgGlow": "rgba(168, 85, 247, 0.12)",
    "borderColor": "rgba(168, 85, 247, 0.3)",
    "formula": "SOR = Q / A_surface \u00b7 \u03b7 = 1 - (BOD_e / BOD_i)",
    "description": "Surface overflow rate (SOR), hydraulic detention time, and BOD removal efficiency analysis."
  }
],
  problems
};

export default plugin;
