import { describe, expect, it } from 'vitest';

import { resolveSelectedCheckpointLabels } from '../web/checkpoint_selector/js/checkpointSelectorUiUtils.js';

const buildSlot = (value) => ({
  ckptWidget: { value },
});

describe('resolveSelectedCheckpointLabels', () => {
  it('collects non-empty labels and ignores None', () => {
    const slots = [
      buildSlot('modelA'),
      buildSlot('None'),
      buildSlot(''),
      buildSlot('modelB'),
    ];
    expect(resolveSelectedCheckpointLabels(slots)).toEqual(
      new Set(['modelA', 'modelB']),
    );
  });

  it('returns empty set for invalid input', () => {
    expect(resolveSelectedCheckpointLabels(null)).toEqual(new Set());
  });
});
