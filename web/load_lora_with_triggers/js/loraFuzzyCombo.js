import { app } from '../../../../scripts/app.js';

import { filterFuzzyIndices, matchFuzzyPositions } from './loraFuzzyMatch.js';
import { buildFuzzyReindexMap } from './loraFuzzyOrderUtils.js';

const TARGET_NODE_NAMES = [
	'LoadLoraWithTriggers',
	'LoadLoraWithTriggersStack',
	'load_lora_with_triggers_stack',
];

const getNodeName = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => TARGET_NODE_NAMES.some((name) => getNodeName(node).includes(name));
const isTargetWidget = (widget) =>
	widget?.name === 'lora_name' || widget?.name?.startsWith('lora_name_');

const getMenuItems = (menu) =>
	Array.from(menu.querySelectorAll('.litemenu-entry')).filter((item) => item.dataset && 'value' in item.dataset);

const getItemLabel = (item) => {
	const value = item.dataset.value;
	if (value !== undefined && value !== null) {
		return String(value);
	}
	return item.textContent?.trim() ?? '';
};

const getOriginalLabel = (item) => {
	const stored = item.dataset.loraFuzzyLabel;
	if (stored !== undefined) {
		return stored;
	}
	const label = getItemLabel(item);
	item.dataset.loraFuzzyLabel = label;
	return label;
};

const restoreItemLabels = (items) => {
	items.forEach((item) => {
		item.textContent = getOriginalLabel(item);
	});
};

const ensureHighlightStyle = () => {
	if (document.getElementById('lora-fuzzy-highlight-style')) {
		return;
	}
	const style = document.createElement('style');
	style.id = 'lora-fuzzy-highlight-style';
	style.textContent = `.lora-fuzzy-hit{background:rgba(255,230,0,0.35);border-radius:2px;padding:0 1px;}`;
	document.head?.appendChild(style);
};

const escapeHtml = (text) =>
	text.replace(/[&<>"']/g, (char) => {
		const map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		};
		return map[char] ?? char;
	});

const buildHighlightHtml = (label, positions) => {
	if (!positions || positions.length === 0) {
		return escapeHtml(label);
	}
	const hitSet = new Set(positions);
	let html = '';
	for (let i = 0; i < label.length; i += 1) {
		const char = escapeHtml(label[i]);
		if (hitSet.has(i)) {
			html += `<span class="lora-fuzzy-hit">${char}</span>`;
		} else {
			html += char;
		}
	}
	return html;
};

const ensureItemMetadata = (items) => {
	items.forEach((item, index) => {
		if (!item.dataset.loraFuzzyIndex) {
			item.dataset.loraFuzzyIndex = String(index);
		}
		if (!item.dataset.loraFuzzyOriginalIndex) {
			item.dataset.loraFuzzyOriginalIndex = String(index);
		}
	});
};

const restoreOriginalOrder = (items, parentOverride) => {
	const sorted = items.slice().sort((a, b) => {
		const aIndex = Number(a.dataset.loraFuzzyOriginalIndex ?? 0);
		const bIndex = Number(b.dataset.loraFuzzyOriginalIndex ?? 0);
		return aIndex - bIndex;
	});

	const parent =
		parentOverride ??
		sorted.find((item) => item.parentElement)?.parentElement ??
		sorted[0]?.parentElement;
	if (!parent) {
		return;
	}
	for (const item of sorted) {
		item.style.display = '';
		item.dataset.loraFuzzyIndex = item.dataset.loraFuzzyOriginalIndex ?? '0';
		parent.appendChild(item);
	}
};

const applyFuzzyFilter = (menu, items, query) => {
	const trimmed = query.trim();
	if (!trimmed) {
		restoreItemLabels(items);
		restoreOriginalOrder(items, menu);
		return;
	}

	const labels = items.map((item) => getOriginalLabel(item));
	const { visible, hidden } = filterFuzzyIndices(trimmed, labels);
	const reindexMap = buildFuzzyReindexMap(visible);
	const parent = menu;
	if (!parent) {
		return;
	}

	for (const index of hidden) {
		const item = items[index];
		if (!item) {
			continue;
		}
		item.style.display = 'none';
		item.dataset.loraFuzzyIndex = item.dataset.loraFuzzyOriginalIndex ?? '0';
		item.textContent = getOriginalLabel(item);
		if (item.parentElement) {
			item.parentElement.removeChild(item);
		}
	}

	ensureHighlightStyle();
	for (const index of visible) {
		const item = items[index];
		if (!item) {
			continue;
		}
		const label = labels[index];
		const positions = matchFuzzyPositions(trimmed, label);
		item.innerHTML = buildHighlightHtml(label, positions ?? []);
		item.dataset.loraFuzzyIndex = String(reindexMap[index] ?? 0);
		item.style.display = '';
		parent.appendChild(item);
	}
};

const attachFuzzyFilter = (menu) => {
	if (menu.dataset.loraFuzzyAttached === '1') {
		return;
	}

	const filterInput = menu.querySelector('.comfy-context-menu-filter');
	if (!filterInput) {
		return;
	}

	const items = getMenuItems(menu);
	if (items.length === 0) {
		return;
	}

	ensureItemMetadata(items);
	menu.dataset.loraFuzzyAttached = '1';

	const onInput = (event) => {
		event.stopImmediatePropagation();
		applyFuzzyFilter(menu, items, filterInput.value ?? '');
	};

	filterInput.addEventListener('input', onInput, true);
	filterInput.addEventListener('keyup', onInput, true);
	filterInput.addEventListener('change', onInput, true);

	applyFuzzyFilter(menu, items, filterInput.value ?? '');
};

app.registerExtension({
	name: 'my_custom_node.loraFuzzyCombo',
	init() {
		const attachExistingMenus = () => {
			const menus = document.querySelectorAll('.litecontextmenu');
			menus.forEach((menu) => {
				if (menu.querySelector('.comfy-context-menu-filter')) {
					attachFuzzyFilter(menu);
				}
			});
		};

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const added of mutation.addedNodes) {
					if (added.classList?.contains('litecontextmenu')) {
						if (!added.querySelector('.comfy-context-menu-filter')) {
							continue;
						}
						requestAnimationFrame(() => attachFuzzyFilter(added));
						return;
					}
				}
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });
		attachExistingMenus();
	},
});
