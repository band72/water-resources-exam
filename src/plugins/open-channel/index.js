import Component from './ProblemVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'open-channel',
  type: 'tool',
  title: "Open Channel Hydraulics",
  category: "Hydraulics & Hydrology",
  componentName: 'ProblemVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
  {
    "id": 1,
    "title": "Open Channel Hydraulics",
    "badge": "Manning's Flow",
    "icon": "\ud83c\udf0a",
    "color": "var(--accent-blue)",
    "bgGlow": "rgba(56, 189, 248, 0.12)",
    "borderColor": "rgba(56, 189, 248, 0.3)",
    "formula": "Q = (1.49/n) \u00b7 A \u00b7 R^(2/3) \u00b7 S^(1/2)",
    "description": "Interactive pipe & channel depth slider with real-time wetted perimeter and hydraulic radius calculations."
  }
],
  problems
};

export default plugin;
