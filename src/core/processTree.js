import { QueueManager } from "./QueueManager.js";

export class ProcessTree {
  constructor({
    textAdapter,
    imageAdapter,
    mock = false,
    concurrency = { text: 4, image: 2 },
    errorPolicy = {
      continueOnChildFailure: true, // Continue processing siblings if a child fails
      returnPartialResults: true, // Include partial results in the output
      maxRetries: 0, // Number of retries for failed nodes
      retryDelay: 1000, // Delay between retries in milliseconds
    },
  }) {
    this.textAdapter = textAdapter;
    this.imageAdapter = imageAdapter;
    this.mock = mock;
    this.errorPolicy = errorPolicy;
    this.queueManager = new QueueManager({ concurrency });

    // Set up progress logging
    this.queueManager.on("progress", (progress) => {
      console.log("\n🔄 Processing Progress:");
      console.log(`├─ Total Tasks: ${progress.total}`);
      console.log(
        `├─ Completed: ${progress.completed} (${progress.percentage}%)`
      );
      console.log(`├─ Failed: ${progress.failed}`);
      console.log(`├─ In Progress: ${progress.inProgress}`);
      console.log("├─ Text Queue:");
      console.log(`│  ├─ Waiting: ${progress.queues.text.waiting}`);
      console.log(`│  ├─ Processing: ${progress.queues.text.pending}`);
      console.log(`│  └─ Concurrency: ${progress.queues.text.concurrency}`);
      console.log("└─ Image Queue:");
      console.log(`   ├─ Waiting: ${progress.queues.image.waiting}`);
      console.log(`   ├─ Processing: ${progress.queues.image.pending}`);
      console.log(`   └─ Concurrency: ${progress.queues.image.concurrency}`);
    });
  }

  getMockResponse(node) {
    const count = node.validation?.minLength || 3;

    switch (node.type) {
      case "text":
        return `PT Mock text response for ${node.id}`;

      case "text-array":
        return Array(count)
          .fill()
          .map((_, i) => `PT Mock array item ${i + 1} for ${node.id}`);

      case "image":
        return `https://PT mock-image.com/${node.id}-${Date.now()}.jpg`;

      case "object":
        return { mockprop: `PT Mock object response for ${node.id}` };

      default:
        return null;
    }
  }

  validateInputs(requiredInputs, context) {
    const missing = requiredInputs.filter((key) => !(key in context));
    if (missing.length) {
      throw new Error(`Missing required inputs: ${missing.join(", ")}`);
    }
  }
  validateRequiredProps(node) {
    if (!node.config?.prompt) {
      throw new Error(`Missing prompt config for node ${node.id}`);
    }
  }

  async retryWithBackoff(operation, maxRetries, delay) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          console.log(
            `Retry attempt ${
              attempt + 1
            }/${maxRetries} for operation after error:`,
            error.message
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError;
  }

  async processNode(node, context) {
    const startTime = Date.now();
    let raw;
    let output;
    const childOutputs = {};
    const metadata = {
      nodeId: node.id,
      startTime,
      endTime: null,
      duration: null,
      type: node.type,
    };

    // Validate and prepare before queueing
    if (node.requiredInputs) {
      this.validateInputs(node.requiredInputs, context);
    }

    const prompt = this.preparePrompt(node, context);
    const modelConfig = node.config?.model || {};

    if (prompt && prompt.content) {
      console.log("prompt:", prompt);
      console.log("🐈 prompt:", prompt.content);
    }

    if (!this.mock && !prompt) {
      throw new Error(`Missing prompt config for node ${node.id}`);
    }

    if (node.validation?.required) {
      this.validateRequiredProps(node);
    }

    // Increment total tasks counter
    this.queueManager.incrementTotal();

    // Get appropriate queue based on node type
    const queueType = node.type === "image" ? "image" : "text";
    const queue = this.queueManager.getQueue(queueType);

    // Process current node
    if (this.mock) {
      raw = this.getMockResponse(node);
    } else {
      try {
        // Pass prompt and modelConfig into the queue function
        raw = await queue.add(
          async () => {
            switch (node.type) {
              case "text":
              case "text-array":
              case "object":
                return this.textAdapter.chat({
                  messages: prompt.content,
                  ...modelConfig,
                });

              case "image":
                return this.imageAdapter.generate(prompt.content, modelConfig);

              default:
                throw new Error(`Unknown node type: ${node.type}`);
            }
          },
          { nodeId: node.id, type: queueType }
        );
      } catch (error) {
        return {
          id: node.id,
          success: false,
          error: error.message,
          metadata,
        };
      }
    }

    output = node.type === "text-array" && !Array.isArray(raw) ? [raw] : raw;

    // Process children
    if (node.children?.length) {
      const processChild = async (child, childContext) => {
        const result = await this.processNode(child, childContext);
        return { childId: child.id, result };
      };

      if (
        node.type === "text-array" ||
        node.type === "object-array" ||
        Array.isArray(output)
      ) {
        node.children.forEach((child) => {
          childOutputs[child.id] = new Array(output.length);
        });

        const childProcessingPromises = [];

        for (let i = 0; i < output.length; i++) {
          const value = output[i];
          const childContext = {
            ...context,
            [node.outputKey]: value,
            i: value,
            index: i,
          };

          node.children.forEach((child) => {
            const promise = processChild(child, childContext).then(
              ({ childId, result }) => {
                childOutputs[childId][i] = result;
              }
            );
            childProcessingPromises.push(promise);
          });
        }

        await Promise.all(childProcessingPromises);
      } else {
        const childContext = {
          ...context,
          [node.outputKey]: output,
        };

        const childProcessingPromises = node.children.map((child) =>
          processChild(child, childContext).then(({ childId, result }) => {
            childOutputs[childId] = result;
          })
        );

        await Promise.all(childProcessingPromises);
      }
    }

    metadata.endTime = Date.now();
    metadata.duration = metadata.endTime - startTime;

    return {
      id: node.id,
      success: true,
      metadata,
      raw,
      prompt,
      childOutputs,
      output,
    };
  }

  async process(tree, initialContext = {}) {
    // Reset queue stats before starting new process
    this.queueManager.reset();

    try {
      return await this.processNode(tree, initialContext);
    } catch (error) {
      console.error("Failed to process tree:", error);
      throw error;
    }
  }
  // Centralized prompt preparation
  formatPrompt(template, context, parentContext = {}) {
    console.log("\n🔍 Format prompt:", {
      template,
      context: JSON.stringify(context, null, 2),
      parentContext: JSON.stringify(parentContext, null, 2),
    });

    const formatted = template.replace(
      /\${(parent\.)?([.\w]+)}/g,
      (match, isParent, key) => {
        let value;
        if (isParent) {
          value = this.getNestedValue(parentContext, key);
          console.log(`  📌 Parent substitution ${match} →`, value);
        } else {
          value =
            this.getNestedValue(context, key) ??
            this.getNestedValue(parentContext, key);
          console.log(`  📌 Context substitution ${match} →`, value);
        }
        return value ?? "";
      }
    );

    console.log("✨ Result:", formatted);
    return formatted;
  }

  preparePrompt(node, context, parentContext = {}) {
    const { prompt } = node.config;
    if (!prompt) return null;

    console.log("\n📑 Preparing prompt for node:", node.id);

    if (Array.isArray(prompt)) {
      return {
        type: "chat",
        content: prompt.map((p) => ({
          role: p.system ? "system" : "user",
          content: this.formatPrompt(p.template, context, parentContext),
          parseJson: p.parseJson,
        })),
      };
    }

    const parts = [
      prompt.prefix && this.formatPrompt(prompt.prefix, context, parentContext),
      prompt.template &&
        this.formatPrompt(prompt.template, context, parentContext),
      prompt.suffix && this.formatPrompt(prompt.suffix, context, parentContext),
    ].filter(Boolean);

    return {
      type: "completion",
      content: parts.join(" "),
      parseJson: prompt.parseJson,
    };
  }

  /*
  preparePromptMessages(node, context) {
    const { prompt } = node.config;
    if (!prompt) return null;

    // Handle array of prompt steps
    if (Array.isArray(prompt)) {
      return prompt.map((p) => ({
        role: p.system ? "system" : "user",
        content: this.formatPrompt(p.template, context),
      }));
    }

    // Handle single prompt object
    const parts = [
      prompt.prefix && this.formatPrompt(prompt.prefix, context),
      this.formatPrompt(prompt.template, context),
      prompt.suffix && this.formatPrompt(prompt.suffix, context),
    ].filter(Boolean);

    return [
      {
        role: "user",
        content: parts.join(" "),
      },
    ];
  }*/

  // Helper to safely get nested object values
  getNestedValue(obj, path) {
    return path.split(".").reduce((acc, part) => {
      return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, obj);
  }
  /*
  async processText(node, context) {
    const messages = [
      {
        role: "user",
        content:
          typeof context === "string" ? context : JSON.stringify(context),
      },
    ];

    return this.textAdapter.chat({ messages });
  }

  async processTextArray(node, context) {
    const count = node.output.expectedCount || 1;
    const messages = [
      {
        role: "user",
        content:
          typeof context === "string" ? context : JSON.stringify(context),
      },
    ];

    const response = await this.textAdapter.chat({ messages });

    let results;
    try {
      results = JSON.parse(response);
      results = Array.isArray(results) ? results : [results];
      results = results.slice(0, count);
    } catch (e) {
      results = [response];
    }

    return results;
  }

  async processImage(node, context) {
    const input = node.inputs.reduce((acc, key) => {
      acc[key] = context[key];
      return acc;
    }, {});

    return this.imageAdapter.generate({
      input,
      model: node.output.model,
    });
  }

  async processObject(node, context) {
    if (node.children?.length) {
      return this.processChildren(node, context);
    }
    return {};
  }*/

  async processChildren(node, context) {
    if (!node.children?.length) return null;

    const results = await Promise.all(
      node.children.map((child) => this.processNode(child, context))
    );

    return results.reduce((acc, result) => {
      return { ...acc, ...result };
    }, {});
  }

  async process(tree, initialContext = {}) {
    try {
      return await this.processNode(tree, initialContext);
    } catch (error) {
      console.error("Failed to process tree:", error);
      throw error;
    }
  }
}
