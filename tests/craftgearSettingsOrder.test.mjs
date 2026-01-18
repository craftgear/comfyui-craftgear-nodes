import { describe, expect, it } from 'vitest';

import { craftgearSettings } from '../web/settings/js/craftgearSettingsRegistry.js';

describe('craftgearSettings', () => {
  it('keeps the settings order', () => {
    const ids = craftgearSettings.map((setting) => setting.id);
    expect(ids).toEqual([
      'craftgear.loadLorasWithTags.minFrequencyThreshold',
      'craftgear.loadLorasWithTags.autoSelectMissingLora',
      'craftgear.commentableMultilineText.fontSize',
      'craftgear.tagToggleText.fontSize',
    ]);

    const categories = craftgearSettings.map((setting) => setting.category);
    expect(categories).toEqual([
      ['craftgear', 'Load Loras With Tags', 'Hide tags with frequency at or below n'],
      ['craftgear', 'Load Loras With Tags', 'Auto select missing LoRA by name'],
      ['craftgear', 'Commentable Multiline Text', 'Font Size'],
      ['craftgear', 'Toggle Tags', 'Font Size'],
    ]);
  });
});
