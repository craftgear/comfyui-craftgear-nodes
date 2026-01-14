const normalizeSavedValues = (values, maxStack) => {
	if (!Array.isArray(values)) {
		return null;
	}
	const expected = maxStack * 4;
	const legacyWithoutToggle = maxStack * 3;
	const legacyWithControls = maxStack * 5;
	const maybeDropLeading = (list) => {
		if (list.length === expected + 1) {
			return list.slice(1);
		}
		if (list.length === legacyWithoutToggle + 1) {
			return list.slice(1);
		}
		if (list.length === legacyWithControls + 1) {
			return list.slice(1);
		}
		return list;
	};
	const trimmed = maybeDropLeading(values);
	if (trimmed.length !== values.length) {
		return normalizeSavedValues(trimmed, maxStack);
	}
	if (values.length === legacyWithControls) {
		const compacted = [];
		for (let index = 0; index < maxStack; index += 1) {
			const base = index * 5;
			compacted.push(values[base], values[base + 1], true, values[base + 4]);
		}
		return compacted;
	}
	if (values.length === legacyWithoutToggle) {
		const expanded = [];
		for (let index = 0; index < maxStack; index += 1) {
			const base = index * 3;
			expanded.push(values[base], values[base + 1], true, values[base + 2]);
		}
		return expanded;
	}
	if (values.length > expected) {
		return values.slice(0, expected);
	}
	return values.slice();
};

export { normalizeSavedValues };
