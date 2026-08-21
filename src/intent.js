import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
});

export async function parseIntent(query) {
  const primaryModel = process.env.PRIMARY_MODEL || "google/gemma-4-31b-it:free";
  const secondaryModel = process.env.SECONDARY_MODEL || process.env.OPENAI_MODEL || "openai/gpt-oss-20b:free";

  const systemPrompt = `You are a strict natural language search intent parser for a hackathon discovery agent.
Your job is to analyze the user's query and extract the following schema as valid JSON.
DO NOT output anything other than JSON.

CRITICAL RULE:
NEVER invent constraints.

If the user does not explicitly mention:
- organization -> null
- topic -> null
- location -> null
- registration status -> any
- skill level -> null/any
- minimum prize -> 0

--------------------------------------------------
ORGANIZATION EXTRACTION
--------------------------------------------------
Understand phrases such as:
"by Google"
"from Google"
"Google hackathons"
"Microsoft hackathons"
"hackathons by AWS"
Example: "Find Hackathon by Google" -> organization = "Google"

--------------------------------------------------
TOPIC EXTRACTION
--------------------------------------------------
Recognize: AI, Artificial Intelligence, Machine Learning, ML, Web3, Blockchain, Cybersecurity, Cloud, FinTech, HealthTech, etc.
Example: "Find Web3 hackathons" -> topic = "Web3"

--------------------------------------------------
LOCATION EXTRACTION
--------------------------------------------------
Recognize: India, Madhya Pradesh, Delhi, Mumbai, Bangalore, Vidisha, USA, etc.
Example: "Find Web3 hackathons in Madhya Pradesh" -> city_or_country = "Madhya Pradesh"

--------------------------------------------------
PRIZE EXTRACTION
--------------------------------------------------
Correctly understand:
50000 INR
₹50000
₹50,000
50k INR
50000 rupees
$50,000
50k USD
above 50000 INR
more than ₹5,000
minimum prize of $10,000

Example: "Find hackathons with prize above 5000 INR" must produce:
minimum_prize_amount = 5000
minimum_prize_currency = "INR"

Do NOT silently convert the user's requested currency inside the intent parser.
Currency normalization should happen in the deterministic filter.

--------------------------------------------------
REGISTRATION STATUS
--------------------------------------------------
Only set "open" when the user explicitly says:
- open
- active
- accepting registrations
- currently accepting
- registration open
Do NOT infer open from the fact that an event has future dates.

--------------------------------------------------
SEARCH KEYWORD
--------------------------------------------------
Do NOT send the complete natural-language query to Devpost.
The search keyword should contain the semantic topic/entity needed for discovery.
Examples:
"Find AI hackathons in India with prize above 50000 INR" -> search_keyword = "AI hackathon"
"Find Google hackathons" -> search_keyword = "Google hackathon"
"Find Web3 hackathons in Madhya Pradesh" -> search_keyword = "Web3 hackathon"

{
  "search_keyword": "A short 1-3 word keyword optimized for a website search.",
  "organization": "The specific organization/entity explicitly mentioned as the host. null if none.",
  "topic": "The main topic or category if explicitly specified. null if none.",
  "location_type": "Must be 'online', 'in-person', or 'any'",
  "city_or_country": "Specific city or country if mentioned, otherwise null.",
  "skill_level": "Must be 'beginner', 'advanced', or 'any'",
  "registration_status": "Must be 'open', 'upcoming', 'ended', or 'any'",
  "minimum_prize_amount": Numeric minimum prize value requested. 0 if none specified.,
  "minimum_prize_currency": "Must be 'INR', 'USD', 'EUR', 'GBP', or null"
}`;

  async function callLLM(model) {
    const params = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Query: "${query}"` }
      ],
      temperature: 0.1
    };

    // OpenRouter models handle json_object format cleanly
    try {
      params.response_format = { type: "json_object" };
    } catch (e) {}

    const response = await openai.chat.completions.create(params);
    let content = response.choices[0].message.content.trim();
    
    // Clean markdown code blocks if model wraps output in ```json ... ```
    if (content.startsWith("```")) {
      content = content.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    }
    
    return JSON.parse(content);
  }

  // Attempt 1: Primary Model (Gemma)
  try {
    console.log(`[IntentParser] Calling Primary Model (${primaryModel})...`);
    const parsed = await callLLM(primaryModel);
    return parsed;
  } catch (primaryErr) {
    console.warn(`[IntentParser] Primary model (${primaryModel}) failed: ${primaryErr.message}. Falling back to Secondary Model (${secondaryModel})...`);
  }

  // Attempt 2: Secondary Model (GPT)
  try {
    console.log(`[IntentParser] Calling Secondary Model (${secondaryModel})...`);
    const parsed = await callLLM(secondaryModel);
    return parsed;
  } catch (secondaryErr) {
    console.error(`[IntentParser] Secondary model (${secondaryModel}) failed: ${secondaryErr.message}. Returning default fallback intent.`);
  }

  // Fallback
  return {
    search_keyword: query,
    organization: null,
    topic: null,
    location_type: "any",
    city_or_country: null,
    skill_level: "any",
    registration_status: "any",
    minimum_prize_amount: 0,
    minimum_prize_currency: null
  };
}
