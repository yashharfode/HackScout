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

export async function scrapeDevpost(intent) {
  const searchTerm = intent.search_keyword || "hackathon";
  const searchUrl = `https://devpost.com/hackathons?search=${encodeURIComponent(searchTerm)}`;
  
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
          const tiles = Array.from(document.querySelectorAll('.hackathon-tile'));
          
          return tiles.map(tile => {
            const titleEl = tile.querySelector('h3') || tile.querySelector('.title') || tile.querySelector('h2');
            const name = titleEl ? titleEl.innerText.trim() : 'Unknown Hackathon';

            const statusEl = tile.querySelector('.status-label') || tile.querySelector('.status') || tile.querySelector('.time-left');
            const registration_status = statusEl ? statusEl.innerText.trim() : 'Open';

            const dateEl = tile.querySelector('.submission-period') || tile.querySelector('.date') || tile.querySelector('.submission-window');
            const date = dateEl ? dateEl.innerText.trim() : 'Dates TBA';

            const prizeEl = tile.querySelector('.prize') || tile.querySelector('.prize-amount');
            const prize = prizeEl ? prizeEl.innerText.trim().replace(/\\s+/g, ' ') : 'None listed';

            let location = 'Online';
            const locationIcon = tile.querySelector('.fa-globe, .fa-map-marker-alt, .fa-location-dot');
            if (locationIcon) {
              const infoEl = locationIcon.closest('.info-with-icon')?.querySelector('.info');
              if (infoEl) location = infoEl.innerText.trim();
            } else {
              const text = tile.innerText;
              if (/online/i.test(text)) location = 'Online';
              else if (/in-person|in person/i.test(text)) location = 'In-Person';
            }

            const anchor = tile.querySelector('a.tile-anchor') || tile.querySelector('a[href*="devpost.com"]');
            let url = anchor ? anchor.href : 'N/A';
            if (url.includes('?')) url = url.split('?')[0];
            
            const hostEl = tile.querySelector('.host-label, .host');
            let organization = hostEl ? hostEl.innerText.trim().replace(/^By\\s+/i, '') : null;

            const tags = Array.from(tile.querySelectorAll('.theme-label, .label')).map(el => el.innerText.trim());

            return { name, date, location, prize, registration_status, url, tags, organization, platform: "Devpost" };
          });
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
    console.error(`[Devpost Scraper Warning]: ${err.message}`);
    return [];
  } finally {
    if (sessionId) {
      try { await runCmd(`webcmd session close ${sessionId}`, null, 5000); } catch {}
    }
  }
}
