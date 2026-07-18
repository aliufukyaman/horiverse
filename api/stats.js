import { jwtVerify } from 'jose';
import { calcGameDay, recalcOverall } from './_calc.js';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');
const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_OWNER = process.env.GITHUB_OWNER;
const GH_REPO  = process.env.GITHUB_REPO;
const GH_DAYS_DIR = 'data/days';
const GH_BASE  = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;

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

// Get default branch HEAD SHA
async function getHeadSha() {
  const r = await fetch(`${GH_BASE}/git/ref/heads/master`, { headers: GH_HEADERS });
  if (!r.ok) throw new Error(`GitHub ref failed: ${r.status}`);
  const j = await r.json();
  return j.object.sha;
}

// Get tree SHA for data/days/ directory using Git Trees API — 1 API call for all files
async function loadAllDays() {
  const headSha = await getHeadSha();
  // recursive tree from HEAD — returns all blobs with their SHA and path
  const r = await fetch(`${GH_BASE}/git/trees/${headSha}?recursive=1`, { headers: GH_HEADERS });
  if (!r.ok) throw new Error(`GitHub tree failed: ${r.status} — ${await r.text()}`);
  const tree = await r.json();

  // filter to data/days/*.json, sort by filename
  const dayBlobs = tree.tree
    .filter(item => item.type === 'blob' && item.path.startsWith(`${GH_DAYS_DIR}/`) && item.path.endsWith('.json'))
    .sort((a, b) => a.path.localeCompare(b.path));

  // fetch each blob by SHA — blobs API returns base64 content, no rate-limit overhead vs contents API
  const results = await Promise.all(dayBlobs.map(async blob => {
    const r = await fetch(`${GH_BASE}/git/blobs/${blob.sha}`, { headers: GH_HEADERS });
    if (!r.ok) throw new Error(`GitHub blob failed: ${r.status}`);
    const j = await r.json();
    const content = Buffer.from(j.content, 'base64').toString('utf-8');
    return { data: JSON.parse(content), path: blob.path, blobSha: blob.sha };
  }));

  return results;
}

// Get a single file via contents API (needed to get file SHA for PUT)
async function ghGetFile(path) {
  const r = await fetch(`${GH_BASE}/contents/${path}`, { headers: GH_HEADERS });
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(`GitHub GET failed: ${r.status}`);
  }
  const meta = await r.json();
  const content = Buffer.from(meta.content, 'base64').toString('utf-8');
  return { data: JSON.parse(content), sha: meta.sha, path: meta.path };
}

// Write (create or update) a file
async function ghPutFile(path, data, sha, message) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message, content };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH_BASE}/contents/${path}`, {
    method: 'PUT',
    headers: GH_HEADERS,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub PUT failed: ${r.status} — ${await r.text()}`);
}

// Delete a file
async function ghDeleteFile(path, sha, message) {
  const r = await fetch(`${GH_BASE}/contents/${path}`, {
    method: 'DELETE',
    headers: GH_HEADERS,
    body: JSON.stringify({ message, sha }),
  });
  if (!r.ok) throw new Error(`GitHub DELETE failed: ${r.status} — ${await r.text()}`);
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
      const days = await loadAllDays();
      const game_days = days.map(d => d.data);
      return res.status(200).json(enrichData(game_days));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { action, game_day } = req.body || {};
    const ts = new Date().toISOString();
    try {
      if (action === 'save_game_day') {
        const clean = cleanGameDay(game_day);
        const filename = dayFilename(clean);
        const filePath = `${GH_DAYS_DIR}/${filename}`;

        // check if target file exists
        let existingSha = null;
        const existing = await ghGetFile(filePath);
        if (existing) existingSha = existing.sha;

        // if not found by name, check if game_no exists under a different filename (date changed)
        if (!existingSha) {
          const allDays = await loadAllDays();
          const old = allDays.find(d => d.data.game_no === clean.game_no && d.path !== filePath);
          if (old) {
            const oldFile = await ghGetFile(old.path);
            if (oldFile) await ghDeleteFile(old.path, oldFile.sha, `stats: remove old day ${clean.game_no} file [${ts}]`);
          }
        }

        await ghPutFile(filePath, clean, existingSha, `stats: update day ${clean.game_no} [${ts}]`);

        const allDays = await loadAllDays();
        return res.status(200).json({ ok: true, overall: recalcOverall(allDays.map(d => d.data)) });
      }

      if (action === 'delete_game_day') {
        const allDays = await loadAllDays();
        const target = allDays.find(d => d.data.game_no === game_day.game_no);
        if (target) {
          const f = await ghGetFile(target.path);
          if (f) await ghDeleteFile(target.path, f.sha, `stats: delete day ${game_day.game_no} [${ts}]`);
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
