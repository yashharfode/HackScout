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

export async function scrapeMLH(intent) {
  const searchUrl = `https://mlh.io/events`;
  
  let sessionId = null;
  try {
    const sessionOutput = await runCmd("webcmd session create -f json", null, 15000);
    const sessionJson = safeJsonParse(sessionOutput);
    sessionId = sessionJson.id;

    const browserScript = `
      try {
        await page.goto(${JSON.stringify(searchUrl)}, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(1500);

        const hackathons = await page.evaluate(() => {
          // Attempt JSON extraction first
          const el = document.querySelector('script[data-page="app"]');
          if (el) {
            try {
              const data = JSON.parse(el.innerText);
              const events = data.props?.events || data.props?.initialEvents || [];
              if (events.length > 0) {
                return events.map(e => ({
                  name: e.name,
                  date: e.startDate || 'Dates TBA',
                  location: e.location || 'Online',
                  prize: "None listed",
                  registration_status: "Open",
                  url: e.url,
                  tags: ["MLH"],
                  organization: "MLH",
                  platform: "MLH"
                })).slice(0, 30);
              }
            } catch(e) {}
          }

          // Fallback to DOM extraction
          const tiles = Array.from(document.querySelectorAll('.event-wrapper, .event'));
          
          return tiles.map(tile => {
            const nameEl = tile.querySelector('.event-name, h3');
            const name = nameEl ? nameEl.innerText.trim() : 'Unknown MLH Event';

            const dateEl = tile.querySelector('.event-date, p:nth-of-type(1)');
            const date = dateEl ? dateEl.innerText.trim() : 'Dates TBA';

            let location = 'In-Person';
            const locEl = tile.querySelector('.event-location');
            if (locEl) {
               location = locEl.innerText.trim();
            } else {
               const text = tile.innerText;
               if (/online|digital|virtual/i.test(text)) location = 'Online';
            }

            const anchor = tile.querySelector('a');
            const url = anchor ? anchor.href : 'https://mlh.io/events';
            
            const logoEl = tile.querySelector('.event-logo img');
            let organization = logoEl && logoEl.alt ? logoEl.alt.trim() : null;

            return { 
              name, 
              date, 
              location, 
              prize: "None listed", 
              registration_status: "Open",
              url, 
              tags: ["MLH"], 
              organization, 
              platform: "MLH" 
            };
          }).slice(0, 30);
        });

        return hackathons.filter(h => h.name !== 'Unknown MLH Event');
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
    console.error(`[MLH Scraper Warning]: ${err.message}`);
    return [];
  } finally {
    if (sessionId) {
      try { await runCmd(`webcmd session close ${sessionId}`, null, 5000); } catch {}
    }
  }
}
