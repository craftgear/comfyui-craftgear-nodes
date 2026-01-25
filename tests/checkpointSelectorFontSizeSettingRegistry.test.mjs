import { describe, expect, it } from 'vitest';

import { craftgearSettings } from '../web/settings/js/craftgearSettingsRegistry.js';
import {
  CHECKPOINT_FONT_SIZE_SETTING_ID,
  DEFAULT_CHECKPOINT_FONT_SIZE,
} from '../web/checkpoint_selector/js/checkpointSelectorSettings.js';

const findSetting = (id) => craftgearSettings.find((entry) => entry.id === id);

describe('craftgearSettingsRegistry (Checkpoint Selector font size)', () => {
  it('exposes font size slider for Checkpoint Selector', () => {
    const setting = findSetting(CHECKPOINT_FONT_SIZE_SETTING_ID);
    expect(setting).toBeDefined();
    expect(setting?.type).toBe('slider');
    expect(setting?.defaultValue).toBe(DEFAULT_CHECKPOINT_FONT_SIZE);
    expect(setting?.attrs?.min).toBe(8);
    expect(setting?.attrs?.max).toBe(36);
    expect(setting?.category).toEqual([
      'craftgear',
      'Checkpoint Selector',
      'Font Size',
    ]);
  });
});
