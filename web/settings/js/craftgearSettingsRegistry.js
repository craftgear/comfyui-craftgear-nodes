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
  AUTO_SELECT_INFINITY_WORDS_ONLY_SETTING_ID,
  DEFAULT_AUTO_SELECT_MISSING_LORA,
  DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY,
  DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
  DEFAULT_MIN_FREQUENCY,
  DEFAULT_LORA_STRENGTH_MAX,
  DEFAULT_LORA_STRENGTH_MIN,
  LORA_STRENGTH_MAX_SETTING_ID,
  LORA_STRENGTH_MIN_SETTING_ID,
  LORA_PREVIEW_ZOOM_SCALE_SETTING_ID,
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
    name: "Auto select missing LoRA by name",
    type: "boolean",
    category: [
      "craftgear",
      "Load Loras With Tags",
      "Auto select missing LoRA by name",
    ],
    defaultValue: DEFAULT_AUTO_SELECT_MISSING_LORA,
  },
  {
    id: AUTO_SELECT_INFINITY_WORDS_ONLY_SETTING_ID,
    name: "Auto select ∞ tags only",
    type: "boolean",
    category: ["craftgear", "Load Loras With Tags", "Auto select ∞ tags only"],
    defaultValue: DEFAULT_AUTO_SELECT_INFINITY_WORDS_ONLY,
  },
  {
    id: LORA_PREVIEW_ZOOM_SCALE_SETTING_ID,
    name: "Preview hover zoom scale",
    type: "number",
    category: ["craftgear", "Load Loras With Tags", "Preview hover zoom scale"],
    attrs: {
      min: 1,
      step: 0.1,
    },
    defaultValue: DEFAULT_LORA_PREVIEW_ZOOM_SCALE,
  },
  {
    id: LORA_STRENGTH_MIN_SETTING_ID,
    name: "LoRA strength minimum",
    type: "number",
    category: ["craftgear", "Load Loras With Tags", "LoRA strength minimum"],
    attrs: {
      step: 0.1,
      min: -10,
    },
    defaultValue: DEFAULT_LORA_STRENGTH_MIN,
  },
  {
    id: LORA_STRENGTH_MAX_SETTING_ID,
    name: "LoRA strength maximum",
    type: "number",
    category: ["craftgear", "Load Loras With Tags", "LoRA strength maximum"],
    attrs: {
      step: 0.1,
      min: -10,
    },
    defaultValue: DEFAULT_LORA_STRENGTH_MAX,
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
