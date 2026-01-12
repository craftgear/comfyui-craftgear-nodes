import { app } from '../../../../scripts/app.js';
import { api } from '../../../../scripts/api.js';
import { $el } from '../../../../scripts/ui.js';

const TARGET_NODE_NAME = 'AutoLoraLoader';
const LORA_WIDGET_NAME = 'lora_name';
const SELECTION_WIDGET_NAME = 'trigger_selection';
const DIALOG_ID = 'my-custom-node-trigger-dialog';

const getNodeName = (node) => node?.comfyClass || node?.type || '';
const isTargetNode = (node) => getNodeName(node).includes(TARGET_NODE_NAME);
const getWidget = (node, name) => node.widgets?.find((widget) => widget.name === name);

const parseSelection = (selectionText, triggers) => {
	if (!selectionText) {
		return new Set(triggers);
	}
	try {
		const parsed = JSON.parse(selectionText);
		if (!Array.isArray(parsed)) {
			return new Set(triggers);
		}
		return new Set(parsed.map((item) => String(item)));
	} catch (_error) {
		return new Set(triggers);
	}
};

const fetchTriggers = async (loraName) => {
	const response = await api.fetchApi('/my_custom_node/lora_triggers', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ lora_name: loraName }),
	});
	if (!response.ok) {
		return [];
	}
	const data = await response.json();
	if (!data || !Array.isArray(data.triggers)) {
		return [];
	}
	return data.triggers.map((trigger) => String(trigger));
};

const closeDialog = () => {
	const existing = document.getElementById(DIALOG_ID);
	if (existing) {
		existing.remove();
	}
};

const showMessage = (message) => {
	closeDialog();
	const overlay = $el('div', {
		id: DIALOG_ID,
		style: {
			position: 'fixed',
			inset: '0',
			background: 'rgba(0, 0, 0, 0.5)',
			zIndex: 10000,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		},
	});
	const panel = $el('div', {
		style: {
			background: '#1e1e1e',
			color: '#e0e0e0',
			padding: '16px',
			borderRadius: '8px',
			minWidth: '280px',
			maxWidth: '60vw',
			fontFamily: 'sans-serif',
		},
	});
	const body = $el('div', { textContent: message, style: { marginBottom: '16px' } });
	const okButton = $el('button', { textContent: 'OK' });
	okButton.onclick = closeDialog;
	panel.append(body, okButton);
	overlay.append(panel);
	document.body.append(overlay);
};

const openTriggerDialog = async (node) => {
	const loraWidget = getWidget(node, LORA_WIDGET_NAME);
	const selectionWidget = getWidget(node, SELECTION_WIDGET_NAME);
	const loraName = loraWidget?.value;
	if (!loraName || loraName === 'None') {
		showMessage('LoRA を選択して下さい');
		return;
	}
	const triggers = await fetchTriggers(loraName);
	if (triggers.length === 0) {
		showMessage('トリガーワードが見つかりません');
		return;
	}
	const selected = parseSelection(selectionWidget?.value ?? '', triggers);

	closeDialog();
	const overlay = $el('div', {
		id: DIALOG_ID,
		style: {
			position: 'fixed',
			inset: '0',
			background: 'rgba(0, 0, 0, 0.6)',
			zIndex: 10000,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		},
	});
	const panel = $el('div', {
		style: {
			background: '#1e1e1e',
			color: '#e0e0e0',
			padding: '16px',
			borderRadius: '8px',
			width: '60vw',
			maxHeight: '70vh',
			display: 'flex',
			flexDirection: 'column',
			fontFamily: 'sans-serif',
		},
	});
	const title = $el('div', {
		textContent: 'Trigger words',
		style: { fontSize: '16px', marginBottom: '12px' },
	});
	const topControls = $el('div', {
		style: {
			display: 'flex',
			gap: '12px',
			alignItems: 'center',
			marginBottom: '12px',
		},
	});
	const list = $el('div', {
		style: {
			overflow: 'auto',
			padding: '8px',
			background: '#2a2a2a',
			borderRadius: '6px',
			flex: '1 1 auto',
		},
	});

	const items = triggers.map((trigger) => {
		const checkbox = $el('input', { type: 'checkbox' });
		checkbox.checked = selected.has(trigger);
		const label = $el('label', {
			style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' },
		});
		label.append(checkbox, $el('span', { textContent: trigger }));
		list.append(label);
		return { trigger, checkbox };
	});

	const actions = $el('div', {
		style: {
			display: 'flex',
			gap: '8px',
			justifyContent: 'space-between',
			marginTop: '12px',
		},
	});
	const leftActions = $el('div', { style: { display: 'flex', gap: '8px' } });
	const rightActions = $el('div', { style: { display: 'flex', gap: '8px' } });
	const selectAllButton = $el('button', { textContent: 'All' });
	const selectNoneButton = $el('button', { textContent: 'None' });
	const applyButton = $el('button', { textContent: 'Apply' });
	const cancelButton = $el('button', { textContent: 'Cancel' });

	const updateToggleState = () => {
		return;
	};

	selectAllButton.onclick = () => {
		items.forEach((item) => {
			item.checkbox.checked = true;
		});
	};
	selectNoneButton.onclick = () => {
		items.forEach((item) => {
			item.checkbox.checked = false;
		});
	};
	cancelButton.onclick = closeDialog;
	applyButton.onclick = () => {
		const selectedTriggers = items.filter((item) => item.checkbox.checked).map((item) => item.trigger);
		if (selectionWidget) {
			selectionWidget.value = JSON.stringify(selectedTriggers);
		}
		app.graph.setDirtyCanvas(true, true);
		closeDialog();
	};

	topControls.append(selectAllButton, selectNoneButton);
	rightActions.append(cancelButton, applyButton);
	actions.append(leftActions, rightActions);

	panel.append(title, topControls, list, actions);
	overlay.append(panel);
	document.body.append(overlay);
};

const hideSelectionWidget = (node) => {
	const selectionWidget = getWidget(node, SELECTION_WIDGET_NAME);
	if (!selectionWidget) {
		return;
	}
	selectionWidget.computeSize = () => [0, -4];
	if (selectionWidget.inputEl) {
		selectionWidget.inputEl.style.display = 'none';
	}
};

const hookLoraWidget = (node) => {
	const loraWidget = getWidget(node, LORA_WIDGET_NAME);
	const selectionWidget = getWidget(node, SELECTION_WIDGET_NAME);
	if (!loraWidget || loraWidget.__triggerHooked) {
		return;
	}
	const originalCallback = loraWidget.callback;
	loraWidget.callback = function () {
		const result = originalCallback?.apply(this, arguments) ?? loraWidget.value;
		if (selectionWidget) {
			selectionWidget.value = '';
		}
		return result;
	};
	loraWidget.__triggerHooked = true;
};

app.registerExtension({
	name: 'my_custom_node.loraTriggerToggle',
	nodeCreated(node) {
		if (!isTargetNode(node)) {
			return;
		}
		hideSelectionWidget(node);
		hookLoraWidget(node);
		if (!node.__triggerButtonAdded) {
			node.addWidget('button', 'Select Trigger Words', 'Edit', () => openTriggerDialog(node));
			node.__triggerButtonAdded = true;
		}
	},
});
