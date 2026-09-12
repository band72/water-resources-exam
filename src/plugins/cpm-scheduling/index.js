import Component from './CpmArrowVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'cpm-scheduling',
  type: 'tool',
  title: "Critical Path Method (CPM)",
  category: "Project Planning & Economics",
  componentName: 'CpmArrowVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 80,
    "title": "Critical Path Method (CPM)",
    "badge": "Project Scheduling",
    "icon": "\u23f1\ufe0f",
    "color": "var(--accent-indigo)",
    "bgGlow": "rgba(99, 102, 241, 0.12)",
    "borderColor": "rgba(99, 102, 241, 0.3)",
    "formula": "Total Float = LF - EF = LS - ES",
    "description": "Interactive activity-on-arrow network diagram, forward/backward pass computations, and critical path highlights."
  }
],
  problems
};

export default plugin;
