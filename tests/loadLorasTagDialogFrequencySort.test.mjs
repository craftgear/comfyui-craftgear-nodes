import { describe, expect, it } from 'vitest';

import { sortTagDialogItems } from '../web/loadLorasWithTags/js/loadLorasWithTagsUiUtils.js';

describe('sortTagDialogItems (frequency sorting)', () => {
  it('orders infinity-frequency tags by name ascending before other tags', () => {
    const entries = [
      { trigger: 'beta' },
      { trigger: 'gamma' },
      { trigger: 'alpha' },
      { trigger: 'delta' },
    ];
    const frequencies = {
      beta: Infinity,
      alpha: Infinity,
      delta: 2,
      gamma: 1,
    };

    const sorted = sortTagDialogItems(entries, 'frequency', frequencies);
    const triggers = sorted.map((item) => item.trigger);

    expect(triggers).toEqual(['alpha', 'beta', 'delta', 'gamma']);
  });

  it('applies the same ordering when sort value is unspecified', () => {
    const entries = [
      { trigger: 'beta' },
      { trigger: 'alpha' },
      { trigger: 'gamma' },
    ];
    const frequencies = {
      beta: Infinity,
      alpha: Infinity,
      gamma: 0,
    };

    const sorted = sortTagDialogItems(entries, undefined, frequencies);
    const triggers = sorted.map((item) => item.trigger);

    expect(triggers).toEqual(['alpha', 'beta', 'gamma']);
  });
});
