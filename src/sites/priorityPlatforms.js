import { scrapeGeneric } from "./genericBrowserScraper.js";

export async function scrapeDevfolio(intent) {
  // e.g. https://hackathon-name.devfolio.co/
  return scrapeGeneric("Devfolio", "https://devfolio.co/hackathons", "devfolio.co", intent, 'https://[^/]+\\.devfolio\\.co/?$');
}

export async function scrapeUnstop(intent) {
  return scrapeGeneric("Unstop", "https://unstop.com/hackathons", "unstop.com/hackathons/", intent);
}

export async function scrapeHackerEarth(intent) {
  return scrapeGeneric("HackerEarth", "https://www.hackerearth.com/challenges/hackathon/", "hackerearth.com/challenges/hackathon/", intent);
}

export async function scrapeHack2Skill(intent) {
  return scrapeGeneric("Hack2Skill", "https://hack2skill.com/hackathons-listing", "hack2skill.com/event/", intent);
}

export async function scrapeDoraHacks(intent) {
  return scrapeGeneric("DoraHacks", "https://dorahacks.io/hackathon", "dorahacks.io/hackathon/", intent);
}

export async function scrapeETHGlobal(intent) {
  return scrapeGeneric("ETHGlobal", "https://ethglobal.com/events", "ethglobal.com/events/", intent);
}

export async function scrapeTAIKAI(intent) {
  return scrapeGeneric("TAIKAI", "https://taikai.network/hackathons", "taikai.network/en/", intent);
}

export async function scrapeLablab(intent) {
  return scrapeGeneric("lablab.ai", "https://lablab.ai/event", "lablab.ai/event/", intent);
}

export async function scrapeHackathonCom(intent) {
  return scrapeGeneric("Hackathon.com", "https://www.hackathon.com/", "hackathon.com/event/", intent);
}

export async function scrapeLuma(intent) {
  // Luma events are hosted on luma.com internally
  return scrapeGeneric("Luma", "https://lu.ma/explore", "luma.com/", intent);
}
