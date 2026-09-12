import Component from './ConstructionVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'topic-construction',
  type: 'topic',
  title: "Construction Management",
  category: "Project Planning & Economics",
  componentName: 'ConstructionVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [],
  problems
};

export default plugin;
