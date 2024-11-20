import Replicate from "replicate";

export class ReplicateClient {
  constructor(apiToken) {
    this.replicate = new Replicate({
      auth: apiToken || process.env.REPLICATE_API_TOKEN,
    });
  }

  /**
   * Run a model on Replicate
   * @param {string} model - The model identifier
   * @param {Object} input - The input parameters
   * @returns {Promise<any>} The model output
   */
  async run(model, input) {
    try {
      return await this.replicate.run(model, { input });
    } catch (error) {
      throw new Error(`Replicate API error: ${error.message}`);
    }
  }
}

export class ReplicateFluxDev {
  static MODEL_ID = "black-forest-labs/flux-dev";

  static DEFAULT_OPTIONS = {
    seed: 1,
    go_fast: true,
    guidance: 3.36,
    megapixels: "1",
    num_outputs: 1,
    aspect_ratio: "3:2",
    output_format: "png",
    output_quality: 80,
    prompt_strength: 0.8,
    num_inference_steps: 29,
  };

  constructor(apiToken) {
    this.client = new ReplicateClient(apiToken);
  }

  /**
   * Generate an image using Flux
   * @param {string} prompt - The image prompt
   * @param {Object} [options] - Optional parameters to override defaults
   * @returns {Promise<string>} The URL of the generated image
   */
  async generate(prompt, options = {}) {
    try {
      const input = {
        ...ReplicateFluxDev.DEFAULT_OPTIONS,
        ...options,
        prompt,
      };

      const output = await this.client.run(ReplicateFluxDev.MODEL_ID, input);

      if (Array.isArray(output) && output.length > 0) {
        return output[0];
      }

      throw new Error("No image URL returned from Flux model");
    } catch (error) {
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }
}

// Example usage:
// const flux = new ReplicateFluxDev();
//
// // Basic usage with just a prompt
// const imageUrl = await flux.generate('A beautiful sunset over mountains');
//
// // Advanced usage with custom options
// const imageUrl = await flux.generate('A beautiful sunset over mountains', {
//   aspect_ratio: '16:9',
//   output_quality: 100,
//   num_inference_steps: 50
// });s
