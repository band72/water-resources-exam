import Component from './WaterVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'topic-water-resources',
  type: 'topic',
  title: "Water Resources & Hydraulics",
  category: "Hydraulics & Hydrology",
  componentName: 'WaterVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [],
  problems
};

export default plugin;
