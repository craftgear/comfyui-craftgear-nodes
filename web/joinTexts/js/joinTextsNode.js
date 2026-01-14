import { app } from '../../../../scripts/app.js';

const TARGET_NODE_CLASS = 'JoinTextNode';

const isTargetNode = (node) => (node?.comfyClass || node?.type || '') === TARGET_NODE_CLASS;

const hideSeparatorInput = (node) => {
  if (!node || node.__joinTextsSeparatorHidden) {
    return;
  }
  const inputs = node.inputs || [];
  const index = inputs.findIndex((input) => input?.name === 'separator');
  if (index >= 0 && typeof node.removeInput === 'function') {
    node.removeInput(index);
  }
  node.__joinTextsSeparatorHidden = true;
};

app.registerExtension({
  name: 'craftgear.joinTexts',
  nodeCreated(node) {
    if (!isTargetNode(node)) {
      return;
    }
    hideSeparatorInput(node);
  },
  loadedGraphNode(node) {
    if (!isTargetNode(node)) {
      return;
    }
    hideSeparatorInput(node);
  },
});
