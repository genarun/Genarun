export function cleanOutput(node, parents = []) {
  if (!node?.output) return null;

  const outputKey = node.outputKey;
  const nodeType = node.type;

  // Get base output
  let cleaned = getCleanedValue(node.output, nodeType);

  // Handle child outputs
  if (node.childOutputs) {
    const childResults = {};

    for (const [childId, childOutput] of Object.entries(node.childOutputs)) {
      // Handle parallel arrays
      if (Array.isArray(childOutput)) {
        childResults[childId] = childOutput.map((item) =>
          cleanOutput({ ...item, type: node.children?.[0]?.type })
        );
      } else {
        childResults[childId] = cleanOutput(childOutput);
      }
    }

    // Merge or nest child results
    if (Object.keys(childResults).length === 1) {
      const [key, value] = Object.entries(childResults)[0];
      if (!outputKey) {
        cleaned = value; // Collapse single child
      } else {
        cleaned = {
          [outputKey]: cleaned,
          [key]: value,
        };
      }
    } else if (Object.keys(childResults).length > 0) {
      cleaned = {
        ...(outputKey ? { [outputKey]: cleaned } : cleaned),
        ...childResults,
      };
    }
  }

  return cleaned;
}

function getCleanedValue(output, type) {
  if (!output) return null;

  switch (type) {
    case "text-array":
      return Array.isArray(output) ? output : [output];
    case "image":
      return typeof output === "string" ? output : output.url;
    case "object":
      return typeof output === "object" ? output : { value: output };
    default:
      return output;
  }
}
