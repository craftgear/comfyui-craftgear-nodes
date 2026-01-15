const stripLoraExtension = (label) => {
	const text = String(label ?? '');
	if (!text) {
		return text;
	}
	const lastSlash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
	const dotIndex = text.lastIndexOf('.');
	if (dotIndex <= lastSlash || dotIndex === text.length - 1) {
		return text;
	}
	return text.slice(0, dotIndex);
};

export { stripLoraExtension };
