import { describe, expect, it } from 'vitest';

import { setWidgetHidden } from '../web/checkpoint_selector/js/checkpointSelectorUiUtils.js';

const createWidget = () => ({
  __checkpointSelectorHidden: false,
  computeSize: (width) => [width, 20],
});

describe('setWidgetHidden height handling', () => {
  it('sets hidden widget height to zero', () => {
    const widget = createWidget();
    setWidgetHidden(widget, true);
    const [, height] = widget.computeSize(100);
    expect(height).toBe(0);
  });

  it('restores original height when unhidden', () => {
    const widget = createWidget();
    setWidgetHidden(widget, true);
    setWidgetHidden(widget, false);
    const [, height] = widget.computeSize(100);
    expect(height).toBe(20);
  });

  it('keeps total height non-negative with many hidden widgets', () => {
    const widgets = Array.from({ length: 20 }, createWidget);
    widgets.forEach((widget) => setWidgetHidden(widget, true));
    const totalHeight = widgets.reduce(
      (sum, widget) => sum + widget.computeSize(120)[1],
      0,
    );
    expect(totalHeight).toBeGreaterThanOrEqual(0);
  });
});
