import { describe, expect, it } from 'vitest';

import {
  resolveTagDialogFilterValue,
  shouldSelectTagDialogFilterOnOpen,
} from '../web/loadLorasWithTags/js/loadLorasWithTagsUiUtils.js';

describe('resolveTagDialogFilterValue', () => {
  it('returns empty string for missing values', () => {
    expect(resolveTagDialogFilterValue()).toBe('');
    expect(resolveTagDialogFilterValue(null)).toBe('');
  });

  it('trims saved filter values', () => {
    expect(resolveTagDialogFilterValue('  cat  ')).toBe('cat');
  });
});

describe('shouldSelectTagDialogFilterOnOpen', () => {
  it('returns false for empty filters', () => {
    expect(shouldSelectTagDialogFilterOnOpen()).toBe(false);
    expect(shouldSelectTagDialogFilterOnOpen('   ')).toBe(false);
  });

  it('returns true for non empty filters', () => {
    expect(shouldSelectTagDialogFilterOnOpen('cat')).toBe(true);
  });
});
