// processors.js

class ProcessLogger {
  constructor(options = {}) {
    this.depth = 0;
    this.enabled = options.enabled ?? true;
    this.timestamps = options.timestamps ?? true;
  }

  iteration(current, total, item) {
    if (!this.enabled) return;
    const progress = Math.round((current / total) * 100);
    console.log(
      `${this.getPrefix()}📎 [${progress}%] Item ${current}/${total}: ${item}`
    );
  }

  summary(results) {
    if (!this.enabled) return;
    console.log(
      `${this.getPrefix()}📊 Processed ${results.length} items successfully`
    );
  }

  getPrefix() {
    const indent = "  ".repeat(this.depth);
    const timestamp = this.timestamps ? `[${new Date().toISOString()}] ` : "";
    return `${timestamp}${indent}`;
  }

  // Core logging methods
  start(message) {
    if (!this.enabled) return;
    console.log(`${this.getPrefix()}🚀 ${message}`);
    this.depth++;
  }

  end(message) {
    if (!this.enabled) return;
    this.depth--;
    console.log(`${this.getPrefix()}✅ ${message}`);
  }

  error(message, error) {
    if (!this.enabled) return;
    console.error(`${this.getPrefix()}❌ ${message}`);
    if (error?.stack) {
      console.error(`${this.getPrefix()}   ${error.stack}`);
    }
  }

  // Process-specific logging
  nodeStart(node, context) {
    this.start(`Processing node: ${node.id} (${node.type})`);
    this.debug(`Path: ${context.path.join("/")}`);
  }

  nodeEnd(node, result) {
    this.end(`Completed node: ${node.id}`);
  }

  // Specialized logging methods
  validation(message) {
    if (!this.enabled) return;
    console.log(`${this.getPrefix()}🔍 ${message}`);
  }

  generation(message) {
    if (!this.enabled) return;
    console.log(`${this.getPrefix()}🎨 ${message}`);
  }

  processing(message) {
    if (!this.enabled) return;
    console.log(`${this.getPrefix()}⚙️ ${message}`);
  }

  debug(message) {
    if (!this.enabled) return;
    console.log(`${this.getPrefix()}💭 ${message}`);
  }

  warn(message) {
    if (!this.enabled) return;
    console.warn(`${this.getPrefix()}⚠️ ${message}`);
  }

  data(message, data) {
    if (!this.enabled) return;
    console.log(`${this.getPrefix()}📊 ${message}`);
    if (data) {
      console.log(`${this.getPrefix()}   ${JSON.stringify(data, null, 2)}`);
    }
  }
}

/** @typedef {'text' | 'text-array' | 'image' | 'object'} NodeType */

/**
 * @typedef {Object} ProcessingNode
 * @property {string} id
 * @property {NodeType} type
 * @property {string} outputKey
 * @property {string[]} [requiredInputs]
 * @property {ProcessingNode[]} [generations]
 * @property {Object} config
 * @property {Object} [validation]
 * @property {number} [count]
 * @property {number} [expectedOutputCount]
 */

/**
 * @typedef {Object} ProcessingContext
 * @property {Object.<string, any>} values
 * @property {string[]} path
 * @property {Object} metadata
 */

/**
 * @typedef {Object} ProcessingResult
 * @property {NodeType} type
 * @property {string} path
 * @property {any} value
 * @property {ProcessingContext} context
 * @property {Object.<string, ProcessingResult>} [children]
 */

class ValidationError extends Error {
  /**
   * @param {string} message
   * @param {ProcessingNode} node
   * @param {ProcessingContext} context
   */
  constructor(message, node, context) {
    super(message);
    this.name = "ValidationError";
    this.node = node;
    this.context = context;
  }
}

class BaseNodeProcessor {
  constructor(logger) {
    this.logger = logger;
  }

  canHandle(node) {
    return this.supportedTypes().includes(node.type);
  }

  async process(node, context) {
    try {
      this.logger.processing(`Pre-processing ${node.id}`);
      await this.preProcess(node, context);

      this.logger.processing(`Executing ${node.id}`);
      const result = await this.executeProcess(node, context);

      this.logger.processing(`Post-processing ${node.id}`);
      await this.postProcess(node, context, result);

      const formatted = this.formatResult(node, context, result);
      this.logger.data(`Result for ${node.id}`, formatted);
      return formatted;
    } catch (error) {
      this.logger.error(`Error in node ${node.id}`, error);
      throw error;
    }
  }

  async preProcess(node, context) {
    // Default empty implementation
  }

  async postProcess(node, context, result) {
    // Default empty implementation
  }

  formatResult(node, context, result) {
    return {
      type: node.type,
      path: context.path.join("/"),
      value: result,
      context: this.updateContext(context, node, result),
    };
  }

  updateContext(context, node, result) {
    return {
      ...context,
      values: {
        ...context.values,
        [node.outputKey]: result,
        outputs: {
          ...context.values.outputs,
          [node.outputKey]: result,
        },
      },
    };
  }

  interpolateTemplate(template, context) {
    return template.replace(/\${([^}]+)}/g, (_, key) => {
      const value = context[key] || context.outputs?.[key];
      if (value === undefined) {
        throw new Error(`Missing template variable: ${key}`);
      }
      return String(value);
    });
  }
}

class ProcessingResult {
  constructor(success, data, error) {
    this.success = success;
    this.data = data;
    this.error = error;
  }
}

class TextNodeProcessor extends BaseNodeProcessor {
  constructor(client, logger) {
    super(logger);
    this.client = client;
  }

  supportedTypes() {
    return ["text"];
  }

  async executeProcess(node, context) {
    let finalResult = null;
    const prompts = Array.isArray(node.config.prompt)
      ? node.config.prompt
      : [node.config.prompt];

    for (const prompt of prompts) {
      this.logger.generation(
        `Generating text with prompt: ${prompt.template.substring(0, 50)}...`
      );
      const message = this.interpolateTemplate(prompt.template, context.values);
      const response = await this.client.chat({
        messages: [
          ...(prompt.system
            ? [{ role: "system", content: prompt.system }]
            : []),
          { role: "user", content: message },
        ],
        ...node.config.model,
      });

      try {
        finalResult = JSON.parse(response);
        this.logger.debug("Successfully parsed JSON response");
      } catch {
        finalResult = response;
        this.logger.debug("Using raw text response");
      }
    }

    return finalResult;
  }
}

class TextArrayNodeProcessor extends TextNodeProcessor {
  supportedTypes() {
    return ["text-array"];
  }

  async executeProcess(node, context) {
    const result = await super.executeProcess(node, context);

    if (!Array.isArray(result)) {
      throw new Error("Expected array result from text-array node");
    }

    if (
      node.expectedOutputCount &&
      result.length !== node.expectedOutputCount
    ) {
      this.logger.warn(
        `Array length mismatch: expected ${node.expectedOutputCount}, got ${result.length}`
      );
      throw new Error(
        `Expected ${node.expectedOutputCount} items but got ${result.length}`
      );
    }

    return result;
  }
}

class ImageNodeProcessor extends BaseNodeProcessor {
  constructor(client, logger) {
    super(logger);
    this.client = client;
  }

  supportedTypes() {
    return ["image"];
  }

  async executeProcess(node, context) {
    const count = node.count || 1;
    const prompts = Array(count)
      .fill()
      .map(() => {
        const template = this.interpolateTemplate(
          node.config.prompt.template,
          context.values
        );
        const prefix = node.config.prompt.prefix || "";
        const suffix = node.config.prompt.suffix || "";
        return `${prefix} ${template} ${suffix}`.trim();
      });

    this.logger.generation(`Generating ${count} images`);
    return Promise.all(
      prompts.map((prompt) => this.client.generate(prompt, node.config.model))
    );
  }
}

class ObjectNodeProcessor extends BaseNodeProcessor {
  constructor(client, logger) {
    super(logger);
    this.client = client;
  }

  supportedTypes() {
    return ["object"];
  }

  async executeProcess(node, context) {
    // Check if this node has prompts configuration
    if (node.config?.prompt) {
      this.logger.processing(`Generating content using prompts`);

      const prompts = Array.isArray(node.config.prompt)
        ? node.config.prompt
        : [node.config.prompt];

      let finalResult = null;

      for (const prompt of prompts) {
        const message = this.interpolateTemplate(
          prompt.template,
          context.values
        );

        const response = await this.client.chat({
          messages: [
            ...(prompt.system
              ? [{ role: "system", content: prompt.system }]
              : []),
            { role: "user", content: message },
          ],
          ...node.config.model,
        });

        try {
          finalResult = JSON.parse(response);
          this.logger.debug("Successfully parsed response as JSON");
        } catch {
          finalResult = response;
          this.logger.debug("Using raw response");
        }
      }

      return finalResult;
    }

    // Default object node behavior (container)
    return {};
  }
}

class ProcessingPipeline {
  constructor(textClient, imageClient, validator, logger) {
    this.processors = [
      new TextNodeProcessor(textClient, logger),
      new TextArrayNodeProcessor(textClient, logger),
      new ImageNodeProcessor(imageClient, logger),
      new ObjectNodeProcessor(textClient, logger),
    ];
    this.validator = validator;
    this.logger = logger;
  }

  // Add this method
  async process(node, initialContext) {
    try {
      this.logger.nodeStart(node, initialContext);

      await this.validator.validate(node, initialContext);
      const processor = this.findProcessor(node);
      const result = await processor.process(node, initialContext);

      if (node.generations) {
        this.logger.processing("Processing child generations");
        result.children = await this.processChildren(node, result.context);
      }

      this.logger.nodeEnd(node, result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process node: ${node.id}`, error);
      throw this.wrapError(error, node, initialContext);
    }
  }

  findProcessor(node) {
    const processor = this.processors.find((p) => p.canHandle(node));
    if (!processor) {
      throw new Error(`No processor found for node type: ${node.type}`);
    }
    return processor;
  }

  async processChildren(parentNode, parentContext) {
    const results = {};

    for (const childNode of parentNode.generations) {
      this.logger.processing(`Processing child node: ${childNode.type}`);

      // Check for array input requirements
      const arrayInputs =
        childNode.requiredInputs?.filter((input) => input.endsWith("[]")) || [];
      if (arrayInputs.length > 0) {
        // For each array input required, check if parent has produced it
        for (const arrayInput of arrayInputs) {
          const baseInputName = arrayInput.replace("[]", "");
          const inputArray = parentContext.values[baseInputName];

          if (Array.isArray(inputArray)) {
            this.logger.processing(
              `Iterating over ${inputArray.length} items for ${baseInputName}`
            );

            const iterationResults = [];
            for (const [index, item] of inputArray.entries()) {
              this.logger.processing(
                `📎 Processing item ${index + 1}/${inputArray.length}: ${item}`
              );

              const itemContext = this.createChildContext(
                parentContext,
                childNode
              );
              itemContext.values = {
                ...itemContext.values,
                [baseInputName]: item, // Set current item as the input value
              };
              itemContext.metadata.index = index;

              try {
                const result = await this.process(childNode, itemContext);
                iterationResults.push(result);
              } catch (error) {
                this.logger.error(`Failed processing item ${index + 1}`, error);
                throw error;
              }
            }

            results[childNode.outputKey] = iterationResults;
          }
        }
      } else if (childNode.requiredInputs?.includes(parentNode.outputKey)) {
        // Direct connection between parent output and child input
        const parentValue = parentContext.values[parentNode.outputKey];

        if (Array.isArray(parentValue)) {
          this.logger.processing(
            `Processing array from parent: ${parentValue.length} items`
          );

          const iterationResults = [];
          for (const [index, item] of parentValue.entries()) {
            this.logger.processing(
              `📎 Processing item ${index + 1}/${parentValue.length}`
            );

            const itemContext = this.createChildContext(
              parentContext,
              childNode
            );
            itemContext.values[parentNode.outputKey] = item;
            itemContext.metadata.index = index;

            try {
              const result = await this.process(childNode, itemContext);
              iterationResults.push(result);
            } catch (error) {
              this.logger.error(`Failed processing item ${index + 1}`, error);
              throw error;
            }
          }

          results[childNode.outputKey] = iterationResults;
        } else {
          // Single item processing
          const childContext = this.createChildContext(
            parentContext,
            childNode
          );
          results[childNode.outputKey] = await this.process(
            childNode,
            childContext
          );
        }
      } else {
        // Regular (non-iterative) processing
        const childContext = this.createChildContext(parentContext, childNode);
        results[childNode.outputKey] = await this.process(
          childNode,
          childContext
        );
      }
    }

    return results;
  }

  createChildContext(parentContext, childNode) {
    // Deep clone the values to prevent mutations affecting siblings
    return {
      values: JSON.parse(
        JSON.stringify({
          ...parentContext.values,
        })
      ),
      path: [...parentContext.path, childNode.outputKey],
      metadata: {
        depth: (parentContext.metadata?.depth || 0) + 1,
        parentNode: childNode.id,
        index: parentContext.metadata?.index,
      },
    };
  }

  wrapError(error, node, context) {
    if (error instanceof ValidationError) return error;
    return new Error(
      `Error processing node ${node.id} at path ${context.path.join("/")}: ${
        error.message
      }`
    );
  }
}

// Main processTree function
export default async function processTree(node, context = {}, settings = {}) {
  const logger = new ProcessLogger(settings.logging);
  logger.start("Starting processing tree");

  const validator = new ContextValidator()
    .addStep(new RequiredInputsValidator())
    .addStep(new OutputValidator());

  const textClient = new MockOpenAIClient();
  const imageClient = new MockReplicateClient();

  const pipeline = new ProcessingPipeline(
    textClient,
    imageClient,
    validator,
    logger
  );

  const initialContext = {
    values: context,
    path: [],
    metadata: {
      depth: 0,
    },
  };

  try {
    const result = await pipeline.process(node, initialContext);
    logger.end("Processing tree completed successfully");
    return result;
  } catch (error) {
    logger.error("Processing tree failed", error);
    return {
      type: "error",
      path: "",
      value: null,
      context: initialContext,
      error: error.message,
    };
  }
}

class ContextValidator {
  constructor() {
    this.steps = [];
  }

  /**
   * @param {Object} step
   * @param {function(ProcessingNode, ProcessingContext): Promise<void>} step.validate
   */
  addStep(step) {
    this.steps.push(step);
    return this;
  }

  /**
   * @param {ProcessingNode} node
   * @param {ProcessingContext} context
   */
  async validate(node, context) {
    for (const step of this.steps) {
      await step.validate(node, context);
    }
  }
}

class RequiredInputsValidator {
  /**
   * @param {ProcessingNode} node
   * @param {ProcessingContext} context
   */
  async validate(node, context) {
    if (!node.requiredInputs) return;

    const missingInputs = node.requiredInputs.filter((input) => {
      const inputName = input.replace("[]", "");
      return input.includes("[]")
        ? !Array.isArray(context.values[inputName])
        : context.values[inputName] === undefined;
    });

    if (missingInputs.length > 0) {
      throw new ValidationError(
        `Missing required inputs: ${missingInputs.join(", ")}`,
        node,
        context
      );
    }
  }
}

class OutputValidator {
  /**
   * @param {ProcessingNode} node
   * @param {ProcessingContext} context
   */
  async validate(node, context) {
    if (!node.validation?.required) return;

    const result = context.values[node.outputKey];
    if (!result) return;

    try {
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      const missing = node.validation.required.filter(
        (key) => !(key in parsed)
      );

      if (missing.length > 0) {
        throw new ValidationError(
          `Missing required fields in output: ${missing.join(", ")}`,
          node,
          context
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(
        `Invalid output format: ${error.message}`,
        node,
        context
      );
    }
  }
}

class MockOpenAIClient {
  async chat({ messages }) {
    // Just return 20 items array for any prompt
    const mockIdeas = [
      "Urban Wildlife in Megacities",
      "Last Traditional Craftsmen",
      "Climate Refugee Stories",
      "Digital Detox Communities",
      "Vertical Farming Revolution",
      "Underground City Life",
      "Ocean Cleanup Warriors",
      "Digital Nomad Culture",
      "Ancient Trades Today",
      "Sustainable Fashion",
      "Ghost Towns of Tech",
      "Future of Healthcare",
      "Arctic Communities",
      "Zero-Waste Pioneers",
      "Urban Beekeepers",
      "New Nuclear Age",
      "Seed Preservation",
      "Global Water Crisis",
      "Mars Colony Training",
      "AI Mental Health",
    ];

    // When asking for project details, return appropriate object
    if (messages.some((m) => m.content.includes("subject:"))) {
      return JSON.stringify({
        description: "A comprehensive photographic exploration",
        title: "Sample Project",
        slug: "sample-project",
        photographerName: "John Doe",
        photographerBio: "Experienced photographer",
        photographerPortraitPhotoDescription: "Professional headshot",
      });
    }

    // When asking for visual descriptions, return array of descriptions
    if (messages.some((m) => m.content.includes("visual scenes"))) {
      return JSON.stringify([
        "Scene 1 description",
        "Scene 2 description",
        "Scene 3 description",
        "Scene 4 description",
        "Scene 5 description",
      ]);
    }

    // For all other cases (including idea generation), return the ideas array
    return JSON.stringify(mockIdeas);
  }
}

export class MockReplicateClient {
  async generate(prompt, config) {
    console.log("\nMock Replicate Generate:");
    console.log("Prompt:", prompt);
    console.log("Config:", config);
    return `mock-image-url-for-${prompt.slice(0, 30)}...`;
  }
}

/**
 * @param {ProcessingNode} node
 * @param {Object} context
 * @param {Object} settings
 */

// Add this to the end of your file for direct testing
/*
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("Running test...");
  runTest().catch(console.error);
}
*/
