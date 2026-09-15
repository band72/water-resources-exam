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

plugins.forEach((plugin) => {
  if (!plugin) return;
  pluginByIdMap[plugin.id] = plugin;

  if (plugin.componentName && plugin.component) {
    componentMap[plugin.componentName] = plugin.component;
    pluginByComponentMap[plugin.componentName] = plugin;
  }

  if (Array.isArray(plugin.problems)) {
    allProblems.push(...plugin.problems);
  }

  if (Array.isArray(plugin.toolCards)) {
    allSimulatorTools.push(...plugin.toolCards);
  }
});

// Sort all problems by ID
allProblems.sort((a, b) => (a.id || 0) - (b.id || 0));

// Sort simulator tools by ID (or problem id)
allSimulatorTools.sort((a, b) => (a.id || 0) - (b.id || 0));

export const pluginRegistry = {
  plugins,
  getPlugins: () => plugins,
  getPlugin: (id) => pluginByIdMap[id],
  getPluginByComponent: (componentName) => pluginByComponentMap[componentName],
  getComponent: (componentName) => componentMap[componentName],
  getAllProblems: () => allProblems,
  getSimulatorTools: () => allSimulatorTools
};

export default pluginRegistry;
