// src/core/loadTree.js

export const NODE_TYPES = {
  OBJECT: "object",
  TEXT_ARRAY: "text-array",
  IMAGE: "image",
};

function isValidNode(node) {
  const errors = [];

  if (!node) {
    errors.push("Node is null or undefined");
    return false;
  }

  if (!node.id) errors.push("Missing node.id");
  if (!node.type) errors.push("Missing node.type");

  const validTypes = Object.values(NODE_TYPES).map((t) => t.toLowerCase());
  if (!validTypes.includes(node.type.toLowerCase())) {
    errors.push(
      `Invalid node.type: ${node.type}. Expected one of: ${validTypes.join(
        ", "
      )}`
    );
  }

  if (errors.length > 0) {
    console.warn(`Invalid node ${node?.id || "unknown"}:`, errors);
    return false;
  }

  return true;
}

function computeExpectedOutput(node, processedChildren) {
  if (!node) return null;

  // Leaf nodes
  if (!processedChildren.length) {
    if (node.type.toLowerCase() === "image") {
      return "https://example.com/image.jpg";
    }
    return node.type.toLowerCase().includes("text") ? "sample text" : null;
  }

  // Array nodes
  if (node.type.toLowerCase() === "text-array") {
    return processedChildren.map((child) => child.expectedOutput);
  }

  // Object nodes with multiple children
  if (processedChildren.length > 1) {
    return processedChildren.reduce(
      (acc, child) => ({
        ...acc,
        [child.id]: child.expectedOutput,
      }),
      {}
    );
  }

  // Single child inherits child's output
  return processedChildren[0]?.expectedOutput;
}

export function loadTree(node) {
  if (!node || !node.id || !node.type) {
    return null;
  }

  const processedChildren = (node.generations || [])
    .map((child) => loadTree(child))
    .filter(Boolean);

  const expectedOutput = computeExpectedOutput(node, processedChildren);

  return {
    id: node.id,
    type: node.type.toLowerCase(),
    outputKey: node.outputKey,
    hasInputs:
      Array.isArray(node.requiredInputs) && node.requiredInputs.length > 0,
    inputs: node.requiredInputs || [],
    config: node.config || {}, //ai configs
    output: processOutput(node),
    hasChildren: processedChildren.length > 0,
    children: processedChildren,
    expectedOutput,
    // expectedOutputProps: Object.keys(expectedOutput || {}), //unreliable with arrays and strs
    isValidNode: true,
    validation: node.validation || {},
  };
}

function processOutput(node) {
  const output = {
    validation: node.validation || {},
    model: node.config?.model || {},
  };

  if (node.type.toLowerCase() === NODE_TYPES.TEXT_ARRAY.toLowerCase()) {
    output.expectedCount = node.validation?.minLength || null;
  }

  return output;
}

export function loadFullTree(node) {
  const processedNode = loadTree(node);

  if (!processedNode) {
    return null;
  }

  return {
    ...processedNode,
    children: Array.isArray(node.generations)
      ? node.generations.map((child) => loadFullTree(child)).filter(Boolean)
      : [],
  };
}
