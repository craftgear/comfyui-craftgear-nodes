import { app } from '../../../../scripts/app.js';

import { craftgearSettings } from './craftgearSettingsRegistry.js';

app.registerExtension({
  name: 'craftgear.settings',
  settings: craftgearSettings,
});
