import {
  DEFAULT_FONT_SIZE as commentableDefaultFontSize,
  FONT_SIZE_SETTING_ID as commentableFontSizeSettingId,
} from "../../commentable_multiline_text/js/commentableMultilineTextSettings.js";
import {
  DEFAULT_FONT_SIZE as tagToggleDefaultFontSize,
  FONT_SIZE_SETTING_ID as tagToggleFontSizeSettingId,
} from "../../tag_toggle_text/js/tagToggleTextSettings.js";
import {
  AUTO_SELECT_MISSING_LORA_SETTING_ID,
  DEFAULT_AUTO_SELECT_MISSING_LORA,
  DEFAULT_MIN_FREQUENCY,
  MIN_FREQUENCY_SETTING_ID,
} from "../../loadLorasWithTags/js/loadLorasWithTagsSettings.js";

const craftgearSettings = [
  {
    id: MIN_FREQUENCY_SETTING_ID,
    name: "Hide tags with frequency at or below n",
    type: "number",
    category: [
      "craftgear",
      "Load Loras With Tags",
      "Hide tags with frequency at or below n",
    ],
    attrs: {
      min: 0,
      step: 1,
    },
    defaultValue: DEFAULT_MIN_FREQUENCY,
  },
  {
    id: AUTO_SELECT_MISSING_LORA_SETTING_ID,
    name: 'Auto select missing LoRA by name',
    type: 'boolean',
    category: ['craftgear', 'Load Loras With Tags', 'Auto select missing LoRA by name'],
    defaultValue: DEFAULT_AUTO_SELECT_MISSING_LORA,
  },
  {
    id: commentableFontSizeSettingId,
    name: "Font Size",
    type: "slider",
    category: ["craftgear", "Commentable Multiline Text", "Font Size"],
    attrs: {
      min: 8,
      max: 36,
    },
    defaultValue: commentableDefaultFontSize,
  },
  {
    id: tagToggleFontSizeSettingId,
    name: "Font Size",
    type: "slider",
    category: ["craftgear", "Toggle Tags", "Font Size"],
    attrs: {
      min: 8,
      max: 36,
    },
    defaultValue: tagToggleDefaultFontSize,
  },
];

export { craftgearSettings };
