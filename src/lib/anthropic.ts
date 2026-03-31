import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Creates an Anthropic client authenticated via either:
 * 1. ANTHROPIC_API_KEY env var (standard)
 * 2. Claude CLI OAuth credentials (fallback)
 */
export function createAnthropicClient(): Anthropic {
  // If standard API key is set, use it
  if (process.env.ANTHROPIC_API_KEY) {
    return new Anthropic();
  }

  // Fall back to Claude CLI OAuth credentials
  const credPath = path.join(os.homedir(), ".claude", ".credentials.json");
  try {
    const raw = fs.readFileSync(credPath, "utf-8");
    const creds = JSON.parse(raw);
    const token = creds?.claudeAiOauth?.accessToken;
    if (token) {
      return new Anthropic({
        apiKey: token,
        baseURL: "https://api.anthropic.com",
      });
    }
  } catch {
    // credentials file not found or unreadable
  }

  // Last resort — will fail with auth error but gives a clear message
  throw new Error(
    "No Anthropic credentials found. Set ANTHROPIC_API_KEY or log in with Claude CLI."
  );
}
