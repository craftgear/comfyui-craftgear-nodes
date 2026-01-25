import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../scripts/app.js', () => ({ app: { registerExtension: () => {} } }));
vi.mock('../../../../scripts/api.js', () => ({ api: { fetchApi: async () => ({ ok: false }) } }));
vi.mock('../../../../scripts/ui.js', () => ({ $el: (tag = 'div') => document.createElement(tag) }));

import { releaseCanvasInteraction } from '../web/checkpoint_selector/js/checkpointSelectorNode.js';

describe('releaseCanvasInteraction', () => {
  it('clears canvas capture flags', () => {
    const canvas = {
      node_capturing_input: { dummy: true },
      node_dragged: { dummy: true },
      dragging_canvas: true,
    };
    const appBackup = global.app;
    global.app = { canvas };
    releaseCanvasInteraction();
    expect(canvas.node_capturing_input).toBeNull();
    expect(canvas.node_dragged).toBeNull();
    expect(canvas.dragging_canvas).toBe(false);
    global.app = appBackup;
  });
});
