// utils.js
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export async function saveResults(data, config) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = join(process.cwd(), config.baseDir, "outputs");

  try {
    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    // Save full results including logs
    await writeFile(
      join(outputDir, `results-${timestamp}.json`),
      JSON.stringify(data, null, 2)
    );

    // Save just the generated data if successful
    if (data.success && config.outputFormats.includes("json")) {
      await writeFile(
        join(outputDir, `data-${timestamp}.json`),
        JSON.stringify(data.data, null, 2)
      );
    }

    // Save markdown if requested
    if (data.success && config.outputFormats.includes("md")) {
      const markdown = generateMarkdown(data.data);
      await writeFile(
        join(outputDir, `documentation-${timestamp}.md`),
        markdown
      );
    }

    return {
      success: true,
      savedAt: timestamp,
      outputDir,
    };
  } catch (error) {
    console.error("Error saving results:", error);
    throw error;
  }
}

function generateMarkdown(data) {
  // Convert data object to markdown format
  return `# Generated Content\n\n${JSON.stringify(data, null, 2)}`;
}
