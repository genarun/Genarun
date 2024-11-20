// openai.js
import OpenAI from "openai";

const CHEAP_OPENAI_MODEL = "gpt-4o-mini";

const JSON_MODEL = "gpt-4-1106-preview";

// Environment configuration
const getApiKey = () => {
  // Browser environment
  if (typeof window !== "undefined") {
    return import.meta.env?.VITE_OPENAI_API_KEY;
  }
  // Node.js environment
  if (typeof process !== "undefined") {
    return process.env?.OPENAI_API_KEY;
  }
  return null;
};

export class OpenAIClient {
  constructor(apiKey) {
    this.client = new OpenAI({
      apiKey: apiKey || getApiKey(),
      dangerouslyAllowBrowser: true,
    });
  }

  #parseJsonResponse(content, shouldParse) {
    if (!shouldParse) return content;

    try {
      console.log("🔍 Parsing JSON response...", content);
      const parsed = JSON.parse(content);
      console.log("✅ JSON parsed successfully");

      //ok! if there's a single data key and if it's an object. we'll return that object
      if (parsed && parsed.data && typeof parsed === "object") {
        return parsed.data;
      }

      return parsed;
    } catch (e) {
      console.error("❌ JSON parsing failed:", e.message);
      throw new Error(`Failed to parse JSON response: ${content}`);
    }
  }

  async chat({
    messages,
    model = CHEAP_OPENAI_MODEL || JSON_MODEL || "gpt-4",
    temperature = 0.7,
    maxTokens = 400, //For dev...
    stream = false,
    // json = false,
  }) {
    try {
      // Single message - existing behavior
      if (messages.length === 1) {
        console.log("📩 Single message request:", messages[0].content);

        const completion = await this.client.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream,
          response_format: {
            type: messages[0].parseJson ? "json_object" : "text",
          },
        });

        if (stream) return completion;
        const content = completion.choices[0].message.content;
        console.log("✨ Response:", content);
        return this.#parseJsonResponse(content, messages[0].parseJson);
      }

      // Multiple messages - handle turnsconsole.log(`🔄 Processing ${messages.length} conversation turns...`);
      let conversation = [];
      let finalResponse;

      for (const message of messages) {
        console.group(`Turn ${conversation.length / 2 + 1}`);

        // Add system message if present
        if (message.system) {
          console.log("🤖 System:", message.system);
          conversation.push({
            role: "system",
            content: message.system,
          });
        }

        // Define userMessage before using it
        const userMessage = message.template || message.content;
        console.log("👤 User:", userMessage);
        conversation.push({
          role: "user",
          content: userMessage,
        });

        // Get completion
        const completion = await this.client.chat.completions.create({
          model,
          messages: conversation,
          temperature,
          max_tokens: maxTokens,
          response_format: {
            type: message.parseJson ? "json_object" : "text",
          },
        });

        finalResponse = completion.choices[0].message.content;
        console.log("🤖 Assistant:", finalResponse);
        console.groupEnd();

        // Add assistant response to conversation
        conversation.push({
          role: "assistant",
          content: finalResponse,
        });
      }

      // Rest of the multi-message code...
      // At the end, replace direct JSON.parse with:
      return this.#parseJsonResponse(
        finalResponse,
        messages[messages.length - 1]?.parseJson
      );
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async generateImageNO({
    prompt,
    model = "dall-e-3",
    quality = "standard",
    size = "1024x1024",
    style = "natural",
    n = 1,
  }) {
    try {
      const response = await this.client.images.generate({
        model,
        prompt,
        n,
        quality,
        size,
        style,
      });

      return response.data.map((img) => img.url);
    } catch (error) {
      throw new Error(`OpenAI Image API error: ${error.message}`);
    }
  }

  validateMessages(messages) {
    if (!Array.isArray(messages)) {
      throw new Error("Messages must be an array");
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw new Error("Each message must have role and content");
      }
      if (!["user", "system", "assistant"].includes(msg.role)) {
        throw new Error("Invalid message role");
      }
    }
  }
}
