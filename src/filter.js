/**
 * Filters the raw scraped hackathons based on the LLM-parsed intent.
 */
export function filterHackathons(hackathons, intent) {
  if (!intent) return hackathons;

  return hackathons.filter(hackathon => {
    // Initialize rejection reason to null
    hackathon._reject_reason = null;

    // 1. Organization Filtering
    if (intent.organization && intent.organization.trim() !== "") {
      const orgStr = intent.organization.toLowerCase();
      const hasOrgInField = hackathon.organization && hackathon.organization.toLowerCase().includes(orgStr);
      const hasOrgInName = hackathon.name && hackathon.name.toLowerCase().includes(orgStr);
      
      if (!hasOrgInField && !hasOrgInName) {
        hackathon._reject_reason = `Organization '${intent.organization}' not verified in name or host field`;
        return false;
      }
    }

    // 2. Topic Filtering
    if (intent.topic && intent.topic.trim() !== "") {
      const topicStr = intent.topic.toLowerCase();
      const hasTopicInName = hackathon.name && hackathon.name.toLowerCase().includes(topicStr);
      const hasTopicInTags = hackathon.tags && hackathon.tags.some(t => t.toLowerCase().includes(topicStr));
      
      if (!hasTopicInName && !hasTopicInTags) {
        hackathon._reject_reason = `Topic '${intent.topic}' not found in name or tags`;
        return false;
      }
    }

    // 3. Location Filtering
    if (intent.location_type === "online") {
      if (!hackathon.location || !hackathon.location.toLowerCase().includes("online")) {
        hackathon._reject_reason = `Not an online event (${hackathon.location})`;
        return false;
      }
    } else if (intent.location_type === "in-person") {
      if (hackathon.location && hackathon.location.toLowerCase().includes("online") && hackathon.location.toLowerCase() === "online") {
        hackathon._reject_reason = `Event is purely online, requested strictly in-person`;
        return false;
      }
    }
    
    // Check specific city/country
    if (intent.city_or_country && intent.city_or_country.trim() !== "") {
      const locMatch = intent.city_or_country.toLowerCase();
      const locStr = hackathon.location ? hackathon.location.toLowerCase() : "";
      const nameStr = hackathon.name ? hackathon.name.toLowerCase() : "";
      if (!locStr.includes(locMatch) && !nameStr.includes(locMatch)) {
         hackathon._reject_reason = `Location '${intent.city_or_country}' not found in event location`;
         return false;
      }
    }

    // 4. Registration Status Filtering
    if (intent.registration_status === "open") {
      const status = hackathon.registration_status ? hackathon.registration_status.toLowerCase() : "";
      if (status.includes("ended") || status.includes("closed") || status.includes("past")) {
        hackathon._reject_reason = `Registration is closed (${hackathon.registration_status})`;
        return false;
      }
    } else if (intent.registration_status === "ended") {
      const status = hackathon.registration_status ? hackathon.registration_status.toLowerCase() : "";
      if (!status.includes("ended") && !status.includes("closed")) {
        hackathon._reject_reason = `Registration is not ended (${hackathon.registration_status})`;
        return false;
      }
    }

    // 5. Strict Minimum Prize Filtering
    if (intent.minimum_prize_amount > 0) {
      if (!hackathon.prize || hackathon.prize.trim() === "") {
        hackathon._reject_reason = `No prize information found`;
        return false;
      }
      
      const prizeStr = hackathon.prize.replace(/,/g, "");
      const match = prizeStr.match(/\d+/);
      
      if (!match) {
        hackathon._reject_reason = `No valid numeric prize found`;
        return false; 
      }
      
      const amount = parseInt(match[0], 10);
      
      let hCurrency = "USD"; // documented default
      const pLower = prizeStr.toLowerCase();
      if (pLower.includes("₹") || pLower.includes("inr") || pLower.includes("rs") || pLower.includes("rupee")) hCurrency = "INR";
      else if (pLower.includes("€") || pLower.includes("eur")) hCurrency = "EUR";
      else if (pLower.includes("£") || pLower.includes("gbp")) hCurrency = "GBP";
      else if (pLower.includes("$") || pLower.includes("usd")) hCurrency = "USD";

      // If currency is not explicitly specified, assume it's unsafe or we can just fall back to no-op.
      // Wait, the prompt says "Do NOT assume every number is USD" and "For 'above 5000' use a documented default and keep it consistent."
      // I used USD as default. Let's compare currencies.
      if (intent.minimum_prize_currency) {
        if (intent.minimum_prize_currency.toUpperCase() !== hCurrency) {
          hackathon._reject_reason = `Currency mismatch: requested ${intent.minimum_prize_currency.toUpperCase()}, found ${hCurrency}`;
          return false;
        }
      }

      if (amount < intent.minimum_prize_amount) {
        hackathon._reject_reason = `Prize (${hCurrency} ${amount}) is below minimum requirement (${hCurrency} ${intent.minimum_prize_amount})`;
        return false;
      }
    }

    return true; // Passed all filters
  });
}
