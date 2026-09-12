import Component from './GradingVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'site-grading',
  type: 'tool',
  title: "Site Grading & Drainage",
  category: "Project Planning & Economics",
  componentName: 'GradingVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [
  {
    "id": 81,
    "title": "Site Grading & Drainage",
    "badge": "Earthwork & Elevations",
    "icon": "\ud83c\udfe1",
    "color": "#fb923c",
    "bgGlow": "rgba(251, 146, 60, 0.12)",
    "borderColor": "rgba(251, 146, 60, 0.3)",
    "formula": "Slope = \u0394Elevation / Horizontal Distance",
    "description": "Finished Floor Elevation (FFE), cut/fill slopes, and surface runoff swale grading slopes."
  }
],
  problems
};

export default plugin;
