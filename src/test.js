import "dotenv/config";
// usage.js
import { myTree, projectConfig } from "./tree1.js";
import processTree from "./core/processor.js";
import { saveResults } from "./utils.js";

async function main() {
  const settings = {
    useMock: true,
    enableLogging: true,
    openAiKey: process.env.OPENAI_API_KEY,
    replicateKey: process.env.REPLICATE_API_TOKEN,
  };

  const result = await processTree(myTree, { year: "2024" }, settings);

  console.log("Processing complete:");
  console.log("Success:", result.success);
  console.log("Errors:", result.errors);
  console.log("Generated data:", result.data);

  // Save results

  // In your main processing function:

  await saveResults(result, projectConfig);

  //await fs.writeFile("output.json", JSON.stringify(result, null, 2));
}

main().catch(console.error);
