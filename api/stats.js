import { jwtVerify } from 'jose';
import { calcGameDay, recalcOverall } from './_calc.js';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');
const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_OWNER = process.env.GITHUB_OWNER;
const GH_REPO  = process.env.GITHUB_REPO;
const GH_DAYS_DIR = 'data/days';
const GH_BASE  = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents`;

const GH_HEADERS = {
  Authorization: `Bearer ${GH_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
};

async function verifyAuth(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/hori_session=([^;]+)/);
  if (!match) return false;
  try { await jwtVerify(match[1], SECRET); return true; }
  catch { return false; }
}

function dateToISO(dateStr) {
  if (!dateStr) return '00000000';
  const parts = dateStr.split('.');
  if (parts.length !== 3) return '00000000';
  const [dd, mm, yyyy] = parts;
  return yyyy + mm.padStart(2, '0') + dd.padStart(2, '0');
}

function dayFilename(gd) {
  const iso = dateToISO(gd.date);
  const num = String(gd.game_no).padStart(3, '0');
  return `day_${iso}_${num}.json`;
}

// List all files in data/days/ and return [{name, path, sha}]
async function ghListDays() {
  const r = await fetch(`${GH_BASE}/${GH_DAYS_DIR}`, { headers: GH_HEADERS });
  if (!r.ok) throw new Error(`GitHub list failed: ${r.status} — ${await r.text()}`);
  const items = await r.json();
  return items.filter(i => i.type === 'file' && i.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name));
}

// Get a single file content + sha
async function ghGetFile(path) {
  const r = await fetch(`${GH_BASE}/${path}`, { headers: GH_HEADERS });
  if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
  const meta = await r.json();
  const content = Buffer.from(meta.content, 'base64').toString('utf-8');
  return { data: JSON.parse(content), sha: meta.sha };
}

// Write (create or update) a file
async function ghPutFile(path, data, sha, message) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message, content };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH_BASE}/${path}`, {
    method: 'PUT',
    headers: GH_HEADERS,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub PUT failed: ${r.status} — ${await r.text()}`);
  const resp = await r.json();
  return resp.content.sha;
}

// Delete a file
async function ghDeleteFile(path, sha, message) {
  const r = await fetch(`${GH_BASE}/${path}`, {
    method: 'DELETE',
    headers: GH_HEADERS,
    body: JSON.stringify({ message, sha }),
  });
  if (!r.ok) throw new Error(`GitHub DELETE failed: ${r.status} — ${await r.text()}`);
}

// Load all game days from GitHub (parallel)
async function loadAllDays() {
  const items = await ghListDays();
  const results = await Promise.all(items.map(item => ghGetFile(item.path)));
  return results.map(r => r.data);
}

function enrichData(game_days) {
  return { game_days: game_days.map(calcGameDay), overall: recalcOverall(game_days) };
}

function cleanGameDay(game_day) {
  return {
    game_no: game_day.game_no,
    date: game_day.date,
    best_game: game_day.best_game || '',
    games: (game_day.games || []).map(g => ({
      game: g.game,
      hori_kill: Number(g.hori_kill) || 0,
      hori_damage: Number(g.hori_damage) || 0,
      tami_kill: Number(g.tami_kill) || 0,
      tami_damage: Number(g.tami_damage) || 0,
      rank: Number(g.rank) || 0,
    })),
  };
}

export default async function handler(req, res) {
  const authed = await verifyAuth(req);
  if (!authed) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const game_days = await loadAllDays();
      return res.status(200).json(enrichData(game_days));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { action, game_day } = req.body || {};
    try {
      const ts = new Date().toISOString();

      if (action === 'save_game_day') {
        const clean = cleanGameDay(game_day);
        const filename = dayFilename(clean);
        const filePath = `${GH_DAYS_DIR}/${filename}`;

        // check if file exists (to get sha for update)
        let existingSha = null;
        try {
          const existing = await ghGetFile(filePath);
          existingSha = existing.sha;
        } catch { /* new file */ }

        // if date changed, the filename changes — find and delete old file by game_no
        if (!existingSha) {
          const items = await ghListDays();
          for (const item of items) {
            const { data, sha } = await ghGetFile(item.path);
            if (data.game_no === clean.game_no && item.path !== filePath) {
              await ghDeleteFile(item.path, sha, `stats: remove old day ${clean.game_no} file [${ts}]`);
              break;
            }
          }
        }

        await ghPutFile(filePath, clean, existingSha, `stats: update day ${clean.game_no} [${ts}]`);

        // recalc overall from all days
        const all = await loadAllDays();
        return res.status(200).json({ ok: true, overall: recalcOverall(all) });
      }

      if (action === 'delete_game_day') {
        const items = await ghListDays();
        for (const item of items) {
          const { data, sha } = await ghGetFile(item.path);
          if (data.game_no === game_day.game_no) {
            await ghDeleteFile(item.path, sha, `stats: delete day ${game_day.game_no} [${ts}]`);
            break;
          }
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
