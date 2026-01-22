import { describe, expect, it } from 'vitest';

import {
  COPY_SOURCE_MISSING_MESSAGE,
  resolveCopySourceMessage,
} from '../../web/loadLorasWithTags/js/loadLorasWithTagsCopyHelpers.js';

describe('resolveCopySourceMessage', () => {
  it('returns missing message when sources are empty', () => {
    expect(resolveCopySourceMessage([])).toBe(COPY_SOURCE_MISSING_MESSAGE);
    expect(resolveCopySourceMessage(0)).toBe(COPY_SOURCE_MISSING_MESSAGE);
    expect(resolveCopySourceMessage(undefined)).toBe(COPY_SOURCE_MISSING_MESSAGE);
  });

  it('returns empty string when sources exist', () => {
    expect(resolveCopySourceMessage([1, 2])).toBe('');
    expect(resolveCopySourceMessage(1)).toBe('');
  });
});
