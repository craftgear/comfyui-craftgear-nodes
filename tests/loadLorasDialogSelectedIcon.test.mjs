import { describe, expect, it } from 'vitest';

import { loraDialogSelectedIconPath } from '../web/loadLorasWithTags/js/loadLorasWithTagsUiUtils.js';

describe('loraDialogSelectedIconPath', () => {
  it('exposes the tabler circle-check path', () => {
    expect(loraDialogSelectedIconPath).toBe(
      'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M9 12l2 2l4 -4',
    );
  });
});
