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

export async function scrapeGeneric(platformName, platformUrl, keywordMatch, intent, urlPattern = null) {
  let sessionId = null;
  try {
    const sessionOutput = await runCmd("webcmd session create -f json", null, 15000);
    const sessionJson = safeJsonParse(sessionOutput);
    sessionId = sessionJson.id;

    const browserScript = `
      try {
        await page.goto(${JSON.stringify(platformUrl)}, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(3000);

        const hackathons = await page.evaluate(() => {
          const results = [];
          const seen = new Set();
          
          const links = Array.from(document.querySelectorAll('a[href]'));
          
          links.forEach(a => {
            const url = a.href;
            let text = a.innerText.trim();
            if (!text) {
               const parent = a.closest('div') || a.parentElement;
               if (parent) text = parent.innerText.trim();
            }
            
            const patternMatch = ${urlPattern ? `new RegExp('${urlPattern}').test(url)` : `url.includes('${keywordMatch}')`};

            if (patternMatch && text.length > 10) {
              
              // Filter out boring/nav links
              if (/^(about|contact|privacy|terms|login|sign up|sign in|home|dashboard|blog|community|help|faq|careers|pricing)/i.test(text.replace(/\\s+/g, ' '))) {
                return;
              }
              
              if (!seen.has(url)) {
                seen.add(url);
                
                const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
                let name = lines[0] || 'Unknown Hackathon';
                if (name.length > 50) name = name.substring(0, 50) + '...';
                
                let location = 'Online';
                if (/in-person|in person|offline|campus|hybrid/i.test(text)) location = 'In-Person';
                
                let status = 'Open';
                if (/closed|ended|past/i.test(text)) status = 'Ended';

                let prize = "See website";
                const prizeRegex = /(?:Prize(?:s)?(?:\\s*pool)?\\s*[:\\-]?\\s*[\\$₹€£]?[0-9,]+(?:[kKmM]?))|(?:[\\$₹€£]\\s*[0-9,]+(?:[kKmM]?))|(?:[0-9,]+(?:[kKmM]?)\\s*(?:USD|INR|Prize(?:s)?|Pool))/i;
                const pMatch = text.match(prizeRegex);
                if (pMatch) prize = pMatch[0].trim();

                let date = "See website";
                const dateRegex = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s*\\d{1,2}(?:st|nd|rd|th)?(?:[\\s\\-,]+\\d{1,2}(?:st|nd|rd|th)?)?(?:[\\s,]+202\\d)?)|(?:\\d{1,2}(?:st|nd|rd|th)?\\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:[\\s,]+202\\d)?)|(?:\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]202\\d)/i;
                const dMatch = text.match(dateRegex);
                if (dMatch) date = dMatch[0].trim();
                
                results.push({
                  name,
                  date,
                  location,
                  prize,
                  registration_status: status,
                  url,
                  tags: [],
                  organization: "${platformName}",
                  platform: "${platformName}"
                });
              }
            }
          });
          
          return results.slice(0, 15); // Return top 15 so we don't exceed limits
        });

        return hackathons;
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
