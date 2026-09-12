import Component from './SoilVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'topic-soil-mechanics',
  type: 'topic',
  title: "Soil Mechanics & Foundations",
  category: "Soil Mechanics & Foundations",
  componentName: 'SoilVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [],
  problems
};

export default plugin;
