import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDirtyCanvas = vi.fn();
const registerExtension = vi.fn();

vi.mock('../../../../scripts/app.js', () => ({
  app: {
    graph: {
      setDirtyCanvas,
    },
    registerExtension,
  },
}), { virtual: true });

const {
  ensureSeparatorSpacer,
  SEPARATOR_SPACER_NAME,
  SEPARATOR_SPACER_HEIGHT,
} = await import('../web/join_text_node/js/joinTextNode.js');

describe('ensureSeparatorSpacer', () => {
  beforeEach(() => {
    setDirtyCanvas.mockClear();
  });

  it('inserts a spacer before the separator widget', () => {
    const node = {
      widgets: [{ name: 'separator', computeSize: (width) => [width ?? 0, 20] }],
    };

    const updated = ensureSeparatorSpacer(node, SEPARATOR_SPACER_HEIGHT);

    expect(updated).toBe(true);
    expect(node.widgets[0].name).toBe(SEPARATOR_SPACER_NAME);
    expect(node.widgets[1].name).toBe('separator');
    expect(node.widgets[0].computeSize(100)[1]).toBe(SEPARATOR_SPACER_HEIGHT);
    expect(setDirtyCanvas).toHaveBeenCalledWith(true, true);
  });

  it('repositions a misplaced spacer without duplicating it', () => {
    const node = {
      widgets: [
        { name: 'separator', computeSize: (width) => [width ?? 0, 18] },
        {
          name: SEPARATOR_SPACER_NAME,
          computeSize: (width) => [width ?? 0, 2],
          height: 2,
        },
      ],
    };

    const updated = ensureSeparatorSpacer(node, SEPARATOR_SPACER_HEIGHT);

    expect(updated).toBe(true);
    expect(node.widgets[0].name).toBe(SEPARATOR_SPACER_NAME);
    expect(node.widgets[1].name).toBe('separator');
    expect(node.widgets.filter((widget) => widget.name === SEPARATOR_SPACER_NAME)).toHaveLength(1);
    expect(node.widgets[0].computeSize(50)[1]).toBe(SEPARATOR_SPACER_HEIGHT);
    expect(setDirtyCanvas).toHaveBeenCalledWith(true, true);
  });

  it('does nothing when the spacer is already placed', () => {
    const spacer = {
      name: SEPARATOR_SPACER_NAME,
      computeSize: (width) => [width ?? 0, SEPARATOR_SPACER_HEIGHT],
      height: SEPARATOR_SPACER_HEIGHT,
    };
    const node = {
      widgets: [spacer, { name: 'separator', computeSize: (width) => [width ?? 0, 12] }],
    };

    const updated = ensureSeparatorSpacer(node, SEPARATOR_SPACER_HEIGHT);

    expect(updated).toBe(false);
    expect(node.widgets[0]).toBe(spacer);
    expect(setDirtyCanvas).not.toHaveBeenCalled();
  });

  it('ignores nodes without a separator widget', () => {
    const node = { widgets: [{ name: 'other' }] };

    const updated = ensureSeparatorSpacer(node, SEPARATOR_SPACER_HEIGHT);

    expect(updated).toBe(false);
    expect(setDirtyCanvas).not.toHaveBeenCalled();
  });
});
