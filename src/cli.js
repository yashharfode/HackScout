#!/usr/bin/env node
import { searchHackathons } from "./agent.js";

async function main() {
  const args = process.argv.slice(2);
  const query = args.filter(a => !a.startsWith("--")).join(" ") || "Find AI hackathons in India";

  console.error(`[HackScout] Initializing Phase 2 Agent...`);
  console.error(`[HackScout] Query: "${query}"`);

  const startTime = Date.now();
  const output = await searchHackathons(query);
  const durationMs = Date.now() - startTime;

  if (output.status === "error") {
    console.error(`[HackScout] Error: ${output.error}`);
  } else {
    console.error(`[HackScout] Completed in ${(durationMs / 1000).toFixed(2)}s. Scraped ${output.count_raw}, Filtered down to ${output.count_filtered} matching hackathons.\\n`);
  }

  // Output structured JSON as requested
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error("[HackScout] Fatal Error:", err);
  process.exit(1);
});
