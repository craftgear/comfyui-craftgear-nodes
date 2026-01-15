import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { normalizeSelectionValue } from '../../web/loadLorasWithTags/js/selectionValueUtils.js';

describe('normalizeSelectionValue', () => {
  it('normalizes selection values', () => {
    assert.equal(normalizeSelectionValue(null), '');
    assert.equal(normalizeSelectionValue(undefined), '');
    assert.equal(normalizeSelectionValue('["a"]'), '["a"]');
    assert.equal(normalizeSelectionValue(0), '0');
  });
});
