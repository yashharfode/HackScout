import { exec } from "node:child_process";

function safeJsonParse(str) {
  try {
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(str.substring(firstBrace, lastBrace + 1));
    }
    return JSON.parse(str);
  } catch (e) {
    throw new Error(`JSON parse error on string: ${str.slice(0, 100)}...`);
  }
}

async function runCmd(command, stdinInput = null, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const child = exec(command, { maxBuffer: 10 * 1024 * 1024, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`Command failed: ${error.message}`));
      resolve(stdout.trim());
    });
    if (stdinInput && child.stdin) {
      child.stdin.write(stdinInput);
      child.stdin.end();
    }
  });
}

export async function scrapeViaSearchEngine(platformName, domainMatch, intent) {
  const searchTerm = intent.search_keyword || "hackathon";
  const query = `site:${domainMatch} ${searchTerm}`;
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  let sessionId = null;
  try {
    const sessionOutput = await runCmd("webcmd session create -f json", null, 15000);
    const sessionJson = safeJsonParse(sessionOutput);
    sessionId = sessionJson.id;

    const browserScript = `
      try {
        await page.goto(${JSON.stringify(searchUrl)}, { waitUntil: 'domcontentloaded', timeout: 25000 });
        
        const hackathons = await page.evaluate(() => {
          const results = Array.from(document.querySelectorAll('.result'));
          return results.map(res => {
            const titleEl = res.querySelector('.result__title');
            const name = titleEl ? titleEl.innerText.trim() : 'Unknown Hackathon';
            
            const urlEl = res.querySelector('.result__url');
            let url = urlEl ? urlEl.href : '';
            if (!url) url = res.querySelector('.result__snippet')?.parentElement?.href || '';
            
            const snippetEl = res.querySelector('.result__snippet');
            const snippet = snippetEl ? snippetEl.innerText.trim() : '';

            // Attempt to infer location
            let location = 'Online';
            if (/in-person|in person|offline/i.test(snippet)) location = 'In-Person';
            if (/india|usa|uk|canada/i.test(snippet)) {
               const match = snippet.match(/(india|usa|uk|canada)/i);
               if (match) location = match[0];
            }

            // Default defaults
            let date = 'See website';
            let prize = 'See website';

            return {
              name,
              date,
              location,
              prize,
              registration_status: "Open", // DDG results typically skew to active/archived depending on search, default to Open so filter handles it or passes it
              url,
              tags: [],
              organization: null,
              platform: "${platformName}"
            };
          });
        });

        // Filter out junk
        return hackathons.filter(h => h.url && !h.url.includes('duckduckgo.com') && h.name !== 'Unknown Hackathon');
      } catch (err) {
        return { error: err.message };
      }
    `;

    const runOutput = await runCmd(`webcmd --session ${sessionId} browser run --stdin`, browserScript, 30000);
    const parsedRun = safeJsonParse(runOutput);
    
    if (!parsedRun.ok) throw new Error("webcmd browser run failed");
    if (parsedRun.result && parsedRun.result.error) throw new Error(parsedRun.result.error);
    
    return Array.isArray(parsedRun.result) ? parsedRun.result : [];
  } catch (err) {
    console.error(`[${platformName} Scraper Warning]: ${err.message}`);
    return [];
  } finally {
    if (sessionId) {
      try { await runCmd(`webcmd session close ${sessionId}`, null, 5000); } catch {}
    }
  }
}
