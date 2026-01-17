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

const stripLoraBasename = (label) => {
  const text = String(label ?? '');
  if (!text) {
    return text;
  }
  const lastSlash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
  const base = lastSlash >= 0 ? text.slice(lastSlash + 1) : text;
  return stripLoraExtension(base);
};

export { stripLoraExtension, stripLoraBasename };
