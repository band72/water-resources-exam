import { Suspense } from 'react';
import GenericProblemViewer from '../components/GenericProblemViewer';
import { pluginRegistry } from './registry';

/**
 * Unified, decoupled Problem Renderer component
 * Replaces hardcoded switch / nested ternaries in App.jsx
 */
// Shown while a code-split visualizer bundle is downloading
const VisualizerLoading = () => (
  <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
    ⏳ Loading interactive lab…
  </div>
);

export const PluginRenderer = ({ problem }) => {
  if (!problem) return null;

  const plugin = pluginRegistry.getPluginByComponent(problem.component);
  // Component is a stable reference from the module-level plugin registry
  // (built once from import.meta.glob), so it never changes across renders
  // for a given problem.component.
  const Component = plugin?.component || pluginRegistry.getComponent(problem.component);

  if (!Component) {
    return <GenericProblemViewer problem={problem} key={problem.id} />;
  }

  // If the visualizer already embeds GenericProblemViewer internally (e.g. RetainingWall, OpenChannel)
  if (plugin?.embedsGenericViewer) {
    return (
      <Suspense fallback={<VisualizerLoading />}>
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Component problem={problem} {...problem} />
      </Suspense>
    );
  }

  // Otherwise, render the dedicated visualizer along with the generic problem viewer
  return (
    <>
      <Suspense fallback={<VisualizerLoading />}>
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Component problem={problem} {...problem} />
      </Suspense>
      <GenericProblemViewer problem={problem} key={problem.id} />
    </>
  );
};
