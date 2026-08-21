/**
 * Deterministically deduplicates hackathons based on normalized name.
 */
export function deduplicate(hackathons) {
  const seen = new Set();
  const deduped = [];
  let duplicateCount = 0;

  for (const h of hackathons) {
    if (!h.name) continue;
    
    // Normalize: lowercase, remove non-alphanumeric, strip spaces
    const normalized = h.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (seen.has(normalized)) {
      duplicateCount++;
      continue;
    }
    
    seen.add(normalized);
    deduped.push(h);
  }

  return { deduped, duplicateCount };
}
