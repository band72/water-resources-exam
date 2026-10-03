/**
 * Plugin registry
 * ---------------
 * Every folder in src/plugins/<name>/index.js that default-exports a plugin object is
 * discovered automatically — App.jsx never needs to know about individual problems.
 *
 * Plugin contract (all fields except `id` optional):
 *   id                  unique plugin id (usually the folder name)
 *   componentName       string referenced by problems[].component
 *   component           React visualizer, receives { problem, ...problem }
 *   embedsGenericViewer true if the visualizer renders GenericProblemViewer itself
 *   problems            array of problem objects (problems.json)
 *   toolCards           dashboard "Interactive Simulator" cards
 *   headerLinks         [{ id, label, icon, color, tint, title, target, activeFor[], order }]
 *                       quick-launch buttons in the app header
 *   crossLinks          [{ id, showFor[], icon, color, tint, title, subtitle,
 *                          links: [{ label, target, color, tint, solid }] }]
 *                       "related lab" banners shown under matching problem statements
 */

// Eagerly import all plugin definitions
const pluginModules = import.meta.glob('./*/index.js', { eager: true });

// Extract and initialize all plugins
const plugins = Object.values(pluginModules).map((mod) => mod.default || mod);

// Build component and lookup maps
const componentMap = {};
const pluginByComponentMap = {};
const pluginByIdMap = {};
const allProblems = [];
const allSimulatorTools = [];
const allHeaderLinks = [];
const allCrossLinks = [];
const seenProblemIds = new Map();

plugins.forEach((plugin) => {
  if (!plugin) return;
  pluginByIdMap[plugin.id] = plugin;

  if (plugin.componentName && componentMap[plugin.componentName] && componentMap[plugin.componentName] !== plugin.component) {
    console.warn(`[plugins] componentName "${plugin.componentName}" is registered by more than one plugin`);
  }

  if (plugin.componentName && plugin.component) {
    componentMap[plugin.componentName] = plugin.component;
    pluginByComponentMap[plugin.componentName] = plugin;
  }

  if (Array.isArray(plugin.problems)) {
    plugin.problems.forEach((p) => {
      if (seenProblemIds.has(p.id)) {
        console.warn(`[plugins] duplicate problem id ${p.id} in "${plugin.id}" (already in "${seenProblemIds.get(p.id)}")`);
      }
      seenProblemIds.set(p.id, plugin.id);
    });
    allProblems.push(...plugin.problems);
  }

  if (Array.isArray(plugin.headerLinks)) {
    allHeaderLinks.push(...plugin.headerLinks.map((l) => ({ ...l, pluginId: plugin.id })));
  }

  if (Array.isArray(plugin.crossLinks)) {
    allCrossLinks.push(...plugin.crossLinks.map((l) => ({ ...l, pluginId: plugin.id })));
  }

  if (Array.isArray(plugin.toolCards)) {
    allSimulatorTools.push(...plugin.toolCards);
  }
});

// Sort all problems by ID
allProblems.sort((a, b) => (a.id || 0) - (b.id || 0));

// Sort simulator tools by ID (or problem id)
allSimulatorTools.sort((a, b) => (a.id || 0) - (b.id || 0));

// Header buttons in declared order
allHeaderLinks.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

export const pluginRegistry = {
  plugins,
  getPlugins: () => plugins,
  getPlugin: (id) => pluginByIdMap[id],
  getPluginByComponent: (componentName) => pluginByComponentMap[componentName],
  getComponent: (componentName) => componentMap[componentName],
  getAllProblems: () => allProblems,
  getSimulatorTools: () => allSimulatorTools,
  getHeaderLinks: () => allHeaderLinks,
  getCrossLinksFor: (problemId) => allCrossLinks.filter((l) => Array.isArray(l.showFor) && l.showFor.includes(problemId))
};

export default pluginRegistry;
