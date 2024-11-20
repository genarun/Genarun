import { OpenAIClient } from "../adapters/openai.js";
import { ReplicateFluxDev } from "../adapters/replicate.js";
import {
  MockOpenAIClient,
  MockReplicateClient,
} from "../adapters/mockClients.js";

class ContextTracker {
  constructor() {
    this.history = [];
    this.currentStage = "";
  }

  push(stage, context) {
    this.history.push({
      stage,
      timestamp: new Date(),
      context: JSON.parse(JSON.stringify(context)), // Deep clone
      index: this.history.length,
    });
    this.currentStage = stage;
  }

  getLast() {
    return this.history[this.history.length - 1];
  }

  getHistory() {
    return this.history;
  }

  length() {
    return this.history.length;
  }
}

// Add these logging functions at the top
function logDebug(message, data) {
  console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

function logError(message, data) {
  console.error(
    `[ERROR] ${message}`,
    data ? JSON.stringify(data, null, 2) : ""
  );
}

// Add these utility functions at the top
function formatContextTree(context, depth = 0) {
  const indent = "  ".repeat(depth);
  let output = "";

  for (const [key, value] of Object.entries(context)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output += `${indent}${key}:\n${formatContextTree(value, depth + 1)}`;
    } else {
      output += `${indent}${key}: ${JSON.stringify(value)}\n`;
    }
  }
  return output;
}

export default async function processTree(node, context = {}, settings = {}) {
  const logs = [];
  const errors = [];
  const contextTracker = new ContextTracker();

  function log(message, level = "info") {
    if (settings.enableLogging) {
      const entry = { timestamp: new Date(), level, message };
      logs.push(entry);
      console.log(`[${level}] ${message}`);
    }
  }

  function logState(message, data = {}) {
    const { node, context, path, expected, received } = data;
    console.log("\n=== State Log ===");
    console.log(`🔍 ${message}`);

    if (node) {
      console.log("\n📍 Current Node:");
      console.log(`  ID: ${node.id}`);
      console.log(`  Type: ${node.type}`);
      console.log(`  Required Inputs: ${JSON.stringify(node.requiredInputs)}`);
    }

    if (path) {
      console.log("\n🛣️  Path:", path.join(" -> "));
    }

    if (expected) {
      console.log("\n⚠️  Expected:", expected);
      console.log("📦 Received:", received);
    }

    if (context) {
      console.log("\n🌳 Context Tree:");
      console.log(formatContextTree(context));
    }

    console.log("\n=== State Change ===");

    console.log("Node:", data.nodeId);
    console.log("Changed keys:", data.changes);
    console.log("Context history length:", contextHistory.length);
    if (data.error) {
      console.log("🚨 Error:", data.error);
      console.log("Context at error:");
      console.dir(contextHistory[contextHistory.length - 1], { depth: null });
    }

    console.log("================\n");
  }

  const clients = settings.useMock
    ? {
        text: new MockOpenAIClient(),
        image: new MockReplicateClient(),
      }
    : {
        text: new OpenAIClient(settings.apiKey),
        image: new ReplicateFluxDev(settings.replicateKey),
      };

  async function processNode(node, context, path = []) {
    const currentPath = [...path, node.outputKey];
    log(`Processing node: ${node.id} at path: ${currentPath.join("/")}`);
    contextTracker.push("processNode", context);
    validateInputs(node, context);

    let result;
    switch (node.type) {
      case "text":
      case "text-array":
        result = await processTextNode(node, context, clients.text);
        break;
      case "image":
        result = await processImageNode(node, context, clients.image);
        break;
      case "object":
        result = await processObjectNode(node, context, currentPath);
        break;
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }

    return buildNodeOutput(node, result, context, currentPath);
  }

  async function buildNodeOutput(node, rawResult, parentContext, path) {
    const isArrayOutput =
      node.type === "text-array" || node.expectedOutputCount > 1;
    const normalizedResult = normalizeResult(rawResult, isArrayOutput);

    if (isArrayOutput && Array.isArray(normalizedResult)) {
      return processArrayItems(node, normalizedResult, parentContext, path);
    }

    return processSingleItem(node, normalizedResult, parentContext, path);
  }

  async function processArrayItems(node, items, parentContext, path) {
    if (!node.generations) {
      return {
        type: "array",
        path: path.join("/"),
        items,
      };
    }

    const processedItems = await Promise.all(
      items.map(async (item, index) => {
        // Debug logging
        console.log(`Processing array item ${index}:`, item);

        const itemContext = {
          ...parentContext,
          [node.outputKey]: item,
          outputs: {
            ...parentContext.outputs,
            [node.outputKey]: item,
          },
          currentPath: path,
          currentIndex: index,
          projectText: item, // Ensure this is set for backward compatibility
        };

        // Debug logging
        console.log(`Item context:`, itemContext);

        const childResults = await processChildren(node, itemContext, [
          ...path,
          index,
        ]);

        return {
          value: item,
          path: [...path, index].join("/"),
          ...childResults,
        };
      })
    );

    return {
      type: "array",
      path: path.join("/"),
      items: processedItems,
    };
  }

  // Update processSingleItem with enhanced logging
  async function processSingleItem(node, value, parentContext, path) {
    logState("Processing single item", {
      node,
      context: parentContext,
      path,
    });

    if (!node.generations) {
      return {
        type: "single",
        path: path.join("/"),
        value,
      };
    }

    const itemContext = createItemContext(node, value, parentContext, path);
    logState("Created item context", {
      node,
      context: itemContext,
      path,
    });

    try {
      const childResults = await processChildren(node, itemContext, path);
      return {
        type: "single",
        path: path.join("/"),
        value,
        ...childResults,
      };
    } catch (error) {
      logState("Error processing children", {
        node,
        context: itemContext,
        path,
        error: error.message,
      });
      throw error;
    }
  }

  const contextHistory = [];

  function pushContext(stage, context) {
    contextHistory.push({
      stage,
      timestamp: new Date(),
      context: { ...context },
    });
  }

  function createItemContext(node, value, parentContext, path, index = null) {
    // Track previous context
    pushContext("pre-createItemContext", parentContext);

    const newContext = {
      ...parentContext,
      [node.outputKey]: value,
      outputs: {
        ...parentContext.outputs,
        [node.outputKey]: value,
      },
      currentPath: path,
      currentIndex: index ?? parentContext.currentIndex,
    };

    // If this is a project-details node, ensure description gets propagated
    if (node.id === "project-details" && value?.description) {
      newContext.description = value.description;
    }

    // For visual-descriptions, ensure array format
    if (node.id === "visual-descriptions" && value) {
      newContext.visualDescriptions = Array.isArray(value) ? value : [value];
    }

    pushContext("post-createItemContext", newContext);

    logState("Context Creation", {
      nodeId: node.id,
      before: parentContext,
      after: newContext,
      changes: Object.keys(newContext).filter(
        (k) =>
          JSON.stringify(newContext[k]) !== JSON.stringify(parentContext[k])
      ),
    });

    return newContext;
  }

  async function processChildren(node, context, path) {
    if (!node.generations) return {};

    const results = {};
    for (const child of node.generations) {
      results[child.outputKey] = await processNode(child, context, path);
    }
    return results;
  }

  async function processTextNode(node, context, client) {
    let chatHistory = [];
    let finalResult;

    for (const prompt of node.config.prompt) {
      const message = interpolateTemplate(prompt.template, context);
      const response = await client.chat({
        messages: [
          ...(prompt.system
            ? [{ role: "system", content: prompt.system }]
            : []),
          ...chatHistory,
          { role: "user", content: message },
        ],
        ...node.config.model,
      });

      chatHistory.push(
        { role: "user", content: message },
        { role: "assistant", content: response }
      );

      finalResult = response;
    }

    return parseResult(finalResult, node);
  }

  async function processImageNode(node, context, client) {
    const count = node.count || 1;
    const prompts = Array(count)
      .fill()
      .map(() => {
        const template = interpolateTemplate(
          node.config.prompt.template,
          context
        );
        return `${node.config.prompt.prefix || ""} ${template} ${
          node.config.prompt.suffix || ""
        }`;
      });

    return Promise.all(
      prompts.map((prompt) => client.generate(prompt, node.config.model))
    );
  }

  async function processObjectNode(node, context, path) {
    const result = {};
    if (node.generations) {
      for (const child of node.generations) {
        result[child.outputKey] = await processNode(child, context, path);
      }
    }
    return result;
  }

  function normalizeResult(result, expectArray) {
    if (typeof result === "string") {
      try {
        const parsed = JSON.parse(result);
        return expectArray && !Array.isArray(parsed) ? [parsed] : parsed;
      } catch {
        return expectArray ? [result] : result;
      }
    }
    return result;
  }

  // Modify validateInputs to use enhanced logging
  async function validateInputs(node, context) {
    logState("Validating inputs", { node, context });

    if (!node.requiredInputs) return true;

    const missingInputs = node.requiredInputs.filter((input) => {
      const inputName = input.replace("[]", "");
      const hasInput = input.includes("[]")
        ? Array.isArray(context[inputName])
        : context[inputName] !== undefined;

      if (!hasInput) {
        logState(`Missing required input: ${input}`, {
          node,
          context,
          expected: input,
          received: context[inputName],
        });
      }
      return !hasInput;
    });

    if (missingInputs.length > 0) {
      throw new Error(`Missing required inputs: ${missingInputs.join(", ")}`);
    }

    return true;
  }

  function findInContext(context, key) {
    if (key in context) return true;
    if (key in (context.outputs || {})) return true;
    return false;
  }

  function interpolateTemplate(template, context) {
    return template.replace(/\${([^}]+)}/g, (_, key) => {
      const value = context[key] || context.outputs?.[key];
      if (value === undefined) {
        throw new Error(`Missing template variable: ${key}`);
      }
      return value;
    });
  }

  function parseResult(result, node) {
    try {
      const parsed = JSON.parse(result);
      if (node.validation?.required) {
        validateRequired(parsed, node.validation.required);
      }
      return parsed;
    } catch (e) {
      return result;
    }
  }

  function validateRequired(obj, required) {
    const missing = required.filter((key) => !(key in obj));
    if (missing.length > 0) {
      throw new Error(
        `Missing required fields in response: ${missing.join(", ")}`
      );
    }
  }

  try {
    const result = await processNode(node, context);
    return {
      success: true,
      data: result,
      logs,
      errors,
    };
  } catch (error) {
    log(error.message, "error");
    errors.push(error);
    return {
      success: false,
      error: error.message,
      logs,
      errors,
    };
  }
}
