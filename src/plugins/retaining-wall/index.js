import Component from './RetainingWallVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'retaining-wall',
  type: 'tool',
  title: "Gravity Retaining Wall Stability",
  category: "Soil Mechanics & Foundations",
  componentName: 'RetainingWallVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
  {
    "id": 96,
    "title": "Retaining Wall Stability",
    "badge": "Soil Mechanics",
    "icon": "\ud83e\uddf1",
    "color": "var(--accent-cyan)",
    "bgGlow": "rgba(6, 182, 212, 0.12)",
    "borderColor": "rgba(6, 182, 212, 0.3)",
    "formula": "FS_OT = \u03a3M_R / M_OT \u00b7 Ka = tan\u00b2(45\u00b0 - \u03c6/2)",
    "description": "Rankine active lateral pressure, concrete gravity wall weight decomposition, and overturning factor of safety."
  },
  {
    "id": 97,
    "title": "Submerged Wall & Pore Pressure",
    "badge": "Soil Mechanics",
    "icon": "\ud83d\udca7",
    "color": "#38bdf8",
    "bgGlow": "rgba(56, 189, 248, 0.12)",
    "borderColor": "rgba(56, 189, 248, 0.3)",
    "formula": "P_w = \u00bd \u00b7 \u03b3_w \u00b7 h_w\u00b2 \u00b7 \u03c3'_a = Ka \u00b7 \u03c3'_v",
    "description": "Partially submerged backfill with hydrostatic pore water pressure, buoyant unit weight, and overturning stability."
  }
],
  problems
};

export default plugin;
