// test.js
import { processTree } from "./core/processor.js";

const testTree = {
  id: "yearlCollection",
  type: "object",
  requiredInputs: ["year"],
  outputKey: "editionData",
  generations: [
    {
      id: "idea-gen",
      type: "text-array",
      expectedOutputCount: 20,
      outputKey: "ideas",
      config: {
        prompt: [
          {
            template:
              "Generate 40 new worthy important news events and topics ideas for ${year}",
          },
        ],
        model: {
          name: "text",
          temperature: 0.8,
        },
      },
    },
  ],
};

async function runTest() {
  console.log("Starting test...");
  const result = await processTree(testTree, { year: "2024" });
  console.log("\nResult:", JSON.stringify(result, null, 2));
}

runTest().catch(console.error);
