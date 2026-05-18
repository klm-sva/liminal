import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    process.env[key.trim()] = rest.join("=").trim();
  }
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not found in .env.local");
  process.exit(1);
}

const client = new Anthropic({ apiKey });

async function main() {
  console.log("Sending test message to Anthropic...\n");
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 64,
    messages: [{ role: "user", content: "Say hello in 5 words or less." }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "(no text)";
  console.log("Response:", text);
  console.log("\nAPI key works.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
