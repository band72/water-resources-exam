import Component from './HydraulicRamVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'hydraulic-ram',
  type: 'tool',
  title: "Hydraulic Ram Pump",
  category: "Hydraulics & Hydrology",
  componentName: 'HydraulicRamVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 6,
    "title": "Hydraulic Ram Pump",
    "badge": "Water Hammer",
    "icon": "\u2699\ufe0f",
    "color": "#a855f7",
    "bgGlow": "rgba(168, 85, 247, 0.12)",
    "borderColor": "rgba(168, 85, 247, 0.3)",
    "formula": "q \u00b7 h = Q \u00b7 H \u00b7 \u03b7",
    "description": "Interactive waste valve cycle, impulse water hammer pressure surge, and delivery head simulation."
  }
],
  problems
};

export default plugin;
