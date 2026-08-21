import { parseIntent } from "./intent.js";
import { filterHackathons } from "./filter.js";
import { scrapeDevpost } from "./sites/devpost.js";
import { scrapeMLH } from "./sites/mlh.js";
import { 
  scrapeDevfolio, scrapeUnstop, scrapeHackerEarth, scrapeHack2Skill,
  scrapeDoraHacks, scrapeETHGlobal, scrapeTAIKAI, scrapeLablab,
  scrapeHackathonCom, scrapeLuma 
} from "./sites/priorityPlatforms.js";
import { deduplicate } from "./dedupe.js";

export async function searchHackathons(userQuery, onProgress = () => {}) {
  if (!userQuery) throw new Error("A query must be provided.");

  const sessionId = "HS-" + Math.random().toString(16).slice(2, 8).toUpperCase();
  onProgress({ type: "session_start", sessionId });

  // 1. Intent Parsing Started & Completed
  console.error(`[HackScout] Parsing intent with LLM...`);
  onProgress({ type: "intent_start", message: "🧠 Intent parsing started..." });
  const intent = await parseIntent(userQuery);
  onProgress({ type: "intent_completed", intent, message: "Intent parsing completed." });

  const platform_status = { 
    Devpost: "pending", 
    MLH: "pending",
    Devfolio: "pending",
    Unstop: "pending",
    HackerEarth: "pending",
    Hack2Skill: "pending",
    DoraHacks: "pending",
    ETHGlobal: "pending",
    TAIKAI: "pending",
    "lablab.ai": "pending",
    "Hackathon.com": "pending",
    Luma: "pending"
  };
  let rawResults = [];

  const runScraper = async (name, scraperFn) => {
    console.error(`[HackScout] Launching ${name} scraper...`);
    onProgress({ type: `${name.toLowerCase().replace('.', '_')}_start`, message: `🌐 ${name} search started...` });
    try {
      const results = await scraperFn(intent);
      platform_status[name] = "success";
      rawResults.push(...results);
      onProgress({ type: `${name.toLowerCase().replace('.', '_')}_completed`, site: name, count: results.length, message: `${name} search completed.` });
    } catch (err) {
      platform_status[name] = "error";
      console.error(`[HackScout] ${name} Error:`, err);
      onProgress({ type: `${name.toLowerCase().replace('.', '_')}_error`, site: name, message: `${name} search failed.` });
    }
  };

  await Promise.all([
    runScraper("Devpost", scrapeDevpost),
    runScraper("MLH", scrapeMLH),
    runScraper("Devfolio", scrapeDevfolio),
    runScraper("Unstop", scrapeUnstop),
    runScraper("HackerEarth", scrapeHackerEarth),
    runScraper("Hack2Skill", scrapeHack2Skill),
    runScraper("DoraHacks", scrapeDoraHacks),
    runScraper("ETHGlobal", scrapeETHGlobal),
    runScraper("TAIKAI", scrapeTAIKAI),
    runScraper("lablab.ai", scrapeLablab),
    runScraper("Hackathon.com", scrapeHackathonCom),
    runScraper("Luma", scrapeLuma)
  ]);

  const rawCount = rawResults.length;

  // 4. Deduplication
  onProgress({ type: "deduplication_start", message: "♻️ Deduplication started..." });
  const { deduped, duplicateCount } = deduplicate(rawResults);
  onProgress({ type: "deduplication_completed", count: duplicateCount, message: `Deduplication completed (${duplicateCount} removed).` });

  // 5. Filtering
  onProgress({ type: "filtering_start", message: "⚙️ Filtering started..." });
  const finalHackathons = filterHackathons(deduped, intent);
  const rejectedHackathons = deduped.filter(h => h._reject_reason);
  finalHackathons.forEach(h => delete h._reject_reason);
  onProgress({ type: "filtering_completed", count: finalHackathons.length, message: "Filtering completed." });

  // 6. Final Completion
  const finalResult = {
    status: "success",
    sessionId,
    query: userQuery,
    intent,
    platform_status,
    count_raw: rawCount,
    count_duplicates_removed: duplicateCount,
    count_filtered: finalHackathons.length,
    results: finalHackathons,
    _raw_rejected: rejectedHackathons
  };

  onProgress({ type: "complete", result: finalResult, message: `✨ ${finalHackathons.length} matching hackathons found` });
  return finalResult;
}
