import { app } from '../../../../scripts/app.js';

import { scoreFuzzy } from './loraFuzzyMatch.js';

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

const ensureItemMetadata = (items) => {
	items.forEach((item, index) => {
		if (!item.dataset.loraFuzzyIndex) {
			item.dataset.loraFuzzyIndex = String(index);
		}
	});
};

const restoreOriginalOrder = (items) => {
	const sorted = items.slice().sort((a, b) => {
		const aIndex = Number(a.dataset.loraFuzzyIndex ?? 0);
		const bIndex = Number(b.dataset.loraFuzzyIndex ?? 0);
		return aIndex - bIndex;
	});

	const parent = sorted[0]?.parentElement;
	if (!parent) {
		return;
	}
	for (const item of sorted) {
		item.style.display = '';
		parent.appendChild(item);
	}
};

const applyFuzzyFilter = (items, query) => {
	const trimmed = query.trim();
	if (!trimmed) {
		restoreOriginalOrder(items);
		return;
	}

	const scored = items
		.map((item) => ({ item, label: getItemLabel(item), score: scoreFuzzy(trimmed, getItemLabel(item)) }))
		.filter((entry) => entry.score !== Number.NEGATIVE_INFINITY)
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			const aIndex = Number(a.item.dataset.loraFuzzyIndex ?? 0);
			const bIndex = Number(b.item.dataset.loraFuzzyIndex ?? 0);
			return aIndex - bIndex;
		});

	const parent = items[0]?.parentElement;
	if (!parent) {
		return;
	}

	for (const item of items) {
		item.style.display = 'none';
	}

	for (const entry of scored) {
		entry.item.style.display = '';
		parent.appendChild(entry.item);
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
		applyFuzzyFilter(items, filterInput.value ?? '');
	};

	filterInput.addEventListener('input', onInput, true);
	filterInput.addEventListener('keyup', onInput, true);
	filterInput.addEventListener('change', onInput, true);

	applyFuzzyFilter(items, filterInput.value ?? '');
};

app.registerExtension({
	name: 'my_custom_node.loraFuzzyCombo',
	init() {
		const observer = new MutationObserver((mutations) => {
			const node = app.canvas?.current_node;
			const widget = app.canvas?.getWidgetAtCursor?.();
			if (!node || !widget || !isTargetWidget(widget) || !isTargetNode(node)) {
				return;
			}

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

		observer.observe(document.body, { childList: true, subtree: false });
	},
});
