export class ProcessTree {
  constructor({ textAdapter, imageAdapter, mock = false }) {
    this.textAdapter = textAdapter;
    this.imageAdapter = imageAdapter;
    this.mock = mock;
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

    if (node.requiredInputs) {
      this.validateInputs(node.requiredInputs, context);
    }

    // Prepare messages and model config
    const prompt = this.preparePrompt(node, context);
    const modelConfig = node.config?.model || {};

    if (prompt && prompt.content) {
      console.log("prompt:   :", prompt);
      console.log("🐈 prompt:   :", prompt.content);
    }
    // Validate node-specific requirements
    if (!this.mock && !prompt) {
      throw new Error(`Missing prompt config for node ${node.id}`);
    }

    if (node.validation?.required) {
      this.validateRequiredProps(node);
    }

    // Process with unified approach
    if (this.mock) {
      raw = this.getMockResponse(node);
    } else {
      try {
        switch (node.type) {
          case "text":
          case "text-array":
          case "object":
            raw = await this.textAdapter.chat({
              messages: prompt.content,
              ...modelConfig,
            });
            break;

          case "image":
            raw = await this.imageAdapter.generate(prompt.content, modelConfig);
            break;

          default:
            throw new Error(`Unknown node type: ${node.type}`);
        }
      } catch (error) {
        return {
          id: node.id,
          success: false,
          error: error.message,
          metadata,
        };
      }
    }

    // Post-process output based on type
    output = node.type === "text-array" && !Array.isArray(raw) ? [raw] : raw;

    // Validate output
    if (node.validation?.minLength && Array.isArray(output)) {
      if (output.length < node.validation.minLength) {
        console.warn(
          `Output length ${output.length} below minimum ${node.validation.minLength}`
        );
        /*
        throw new Error(
          `Output length ${output.length} below minimum ${node.validation.minLength}`
        );*/
      }
    }

    // Process children with array handling
    if (node.children?.length) {
      if (
        node.type === "text-array" ||
        node.type === "object-array" ||
        Array.isArray(output)
      ) {
        // Initialize array outputs for each child
        node.children.forEach((child) => {
          childOutputs[child.id] = [];
        });

        // Process each array item
        for (let i = 0; i < output.length; i++) {
          const value = output[i];
          const childContext = {
            ...context,
            //  [node.outputKey]: output[i],
            //  i, // Pass array index to children
            [node.outputKey]: value, // Pass array item value
            i: value, // Pass value as 'i'
            index: i, // Pass numeric index as 'index'
          };

          for (const child of node.children) {
            const result = await this.processNode(child, childContext);
            childOutputs[child.id][i] = result;
          }
        }
      } else {
        // Normal non-array processing
        const childContext = {
          ...context,
          [node.outputKey]: output,
        };

        for (const child of node.children) {
          childOutputs[child.id] = await this.processNode(child, childContext);
        }
      }
    }
    metadata.endTime = Date.now();
    metadata.duration = metadata.endTime - startTime;

    return {
      id: node.id,
      success: true, // Processing status
      metadata, // Processing metadata
      raw, // Raw response before processing
      prompt, //: messages || null, // Prompt messages used in pipeline
      childOutputs, // Results from child nodes
      output, // Processed output used in pipeline
    };
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
