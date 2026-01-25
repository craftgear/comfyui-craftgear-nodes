import { describe, expect, it } from 'vitest';

import { craftgearSettings } from '../web/settings/js/craftgearSettingsRegistry.js';
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_SETTING_ID,
} from '../web/loadLorasWithTags/js/loadLorasWithTagsSettings.js';

const findSetting = (id) => craftgearSettings.find((entry) => entry.id === id);

describe('craftgearSettingsRegistry', () => {
  it('exposes font size slider for Load Loras With Tags', () => {
    const setting = findSetting(FONT_SIZE_SETTING_ID);
    expect(setting).toBeDefined();
    expect(setting?.type).toBe('slider');
    expect(setting?.defaultValue).toBe(DEFAULT_FONT_SIZE);
    expect(setting?.attrs?.min).toBe(8);
    expect(setting?.attrs?.max).toBe(36);
    expect(setting?.category).toEqual([
      'craftgear',
      'Load Loras With Tags',
      'Font Size',
    ]);
  });
});
