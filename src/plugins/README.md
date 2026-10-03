# Interactive Problem Plugins

Each folder here is a self-contained plugin, auto-discovered by [`registry.js`](./registry.js) via `import.meta.glob('./*/index.js')`.
`App.jsx` has **no problem-specific code**: header buttons, "related lab" banners, dashboard cards and visualizers all come from plugin declarations.

```
src/plugins/<plugin-id>/
├── index.js            plugin definition (default export)
├── problems.json       problems owned by this plugin
├── <Name>Visualizer.jsx
└── data/ …             optional plugin-private data (lazy-import large files)
```

## Minimal `index.js`

```js
import { lazy } from 'react';
import problems from './problems.json';

// Code-split: the visualizer bundle loads only when one of these problems is opened
const Component = lazy(() => import('./MyVisualizer.jsx'));

export default {
  id: 'my-plugin',
  componentName: 'MyVisualizer',   // problems[].component must equal this
  component: Component,
  embedsGenericViewer: false,      // true if the visualizer renders <GenericProblemViewer> itself
  problems,
  toolCards: [ /* dashboard "Interactive Simulator" cards */ ],
  headerLinks: [                   // optional quick-launch button in the app header
    { id: 'my-lab', label: 'My Lab', icon: '🧪', color: 'var(--accent-blue)', tint: '56, 189, 248',
      title: 'Tooltip', target: 300, activeFor: [300, 301], order: 60 }
  ],
  crossLinks: [                    // optional banner under matching problem statements
    { id: 'my-banner', showFor: [300, 301], icon: '🧪', color: 'var(--accent-blue)', tint: '56, 189, 248',
      title: 'My Lab', subtitle: 'What it does',
      links: [{ label: 'Open (#300) →', target: 300, color: 'var(--accent-blue)', tint: '56, 189, 248', solid: true }] }
  ]
};
```

## Rules

- Plugins must not import from other plugins. Shared UI belongs in `src/components/` (for example `MathText`, `GenericProblemViewer`).
- Problem IDs must be unique across all plugins. The registry logs a console warning on duplicates.
- Plugins link to each other only by **problem ID**, using `target` / `showFor`.
- Write exponents and subscripts as `x^2`, `R^(2/3)`, `Q_AB`, `Q_AB^{(1)}`. `MathText` renders them as real superscripts and subscripts.
