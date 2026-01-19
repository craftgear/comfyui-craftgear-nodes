import { app } from '../../../../scripts/app.js';

import { AUTO_SELECT_MISSING_LORA_SETTING_ID } from '../../loadLorasWithTags/js/loadLorasWithTagsSettings.js';
import { craftgearSettings } from './craftgearSettingsRegistry.js';

const autoSelectMissingLoraLabelId = `${AUTO_SELECT_MISSING_LORA_SETTING_ID}-label`;
const autoSelectMissingLoraWarningId =
  'craftgear-auto-select-missing-lora-warning';
const autoSelectMissingLoraWarningText =
  'A different LoRA with the same name may be selected.';

const createAutoSelectMissingLoraWarning = () => {
  const container = document.createElement('div');
  container.id = autoSelectMissingLoraWarningId;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '0.4rem';
  container.style.fontSize = '0.85em';
  container.style.lineHeight = '1.2';
  container.style.color = 'var(--p-text-muted-color, #888)';
  container.style.marginTop = '0.25rem';
  container.style.maxWidth = '28rem';

  const icon = document.createElement('i');
  icon.className = 'pi pi-exclamation-triangle';
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = autoSelectMissingLoraWarningText;

  container.append(icon, text);
  return container;
};

const insertAutoSelectMissingLoraWarning = () => {
  const label = document.getElementById(autoSelectMissingLoraLabelId);
  if (!label) {
    return false;
  }

  const settingItem = label.closest('.setting-item');
  if (!settingItem) {
    return false;
  }

  const existingWarning = document.getElementById(
    autoSelectMissingLoraWarningId
  );
  if (existingWarning && existingWarning.parentElement !== settingItem) {
    existingWarning.remove();
  }

  if (settingItem.querySelector(`#${autoSelectMissingLoraWarningId}`)) {
    return true;
  }

  settingItem.appendChild(createAutoSelectMissingLoraWarning());
  return true;
};

let hasAutoSelectMissingLoraObserver = false;
const observeAutoSelectMissingLoraWarning = () => {
  if (hasAutoSelectMissingLoraObserver) {
    return;
  }
  hasAutoSelectMissingLoraObserver = true;

  // 設定画面は再描画されるため、表示タイミングに合わせて注記を差し込む
  const observer = new MutationObserver(() => {
    insertAutoSelectMissingLoraWarning();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  insertAutoSelectMissingLoraWarning();
};

app.registerExtension({
  name: 'craftgear.settings',
  settings: craftgearSettings,
  setup: () => {
    observeAutoSelectMissingLoraWarning();
  },
});
