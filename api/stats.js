import { jwtVerify } from 'jose';
import { calcGameDay, recalcOverall } from './_calc.js';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');
const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_OWNER = process.env.GITHUB_OWNER;
const GH_REPO  = process.env.GITHUB_REPO;
const GH_PATH  = 'data/pubg_stats.json';
const GH_API   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PATH}`;

async function verifyAuth(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/hori_session=([^;]+)/);
  if (!match) return false;
  try { await jwtVerify(match[1], SECRET); return true; }
  catch { return false; }
}

async function ghGet() {
  const r = await fetch(GH_API, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
  const meta = await r.json();
  const content = Buffer.from(meta.content, 'base64').toString('utf-8');
  return { data: JSON.parse(content), sha: meta.sha };
}

async function ghPut(data, sha) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const r = await fetch(GH_API, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `stats: update [${new Date().toISOString()}]`,
      content,
      sha,
    }),
  });
  if (!r.ok) throw new Error(`GitHub PUT failed: ${r.status} — ${await r.text()}`);
}

function enrichData(raw) {
  const game_days = raw.game_days.map(calcGameDay);
  const overall = recalcOverall(raw.game_days);
  return { game_days, overall };
}

export default async function handler(req, res) {
  const authed = await verifyAuth(req);
  if (!authed) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const { data } = await ghGet();
      return res.status(200).json(enrichData(data));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { action, game_day } = req.body || {};
    try {
      const { data, sha } = await ghGet();

      if (action === 'save_game_day') {
        // strip computed fields before saving — store only static data
        const clean = {
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
        const idx = data.game_days.findIndex(g => g.game_no === clean.game_no);
        if (idx >= 0) data.game_days[idx] = clean;
        else { data.game_days.push(clean); data.game_days.sort((a, b) => a.game_no - b.game_no); }
        await ghPut(data, sha);
        return res.status(200).json({ ok: true, overall: recalcOverall(data.game_days) });
      }

      if (action === 'delete_game_day') {
        data.game_days = data.game_days.filter(g => g.game_no !== game_day.game_no);
        await ghPut(data, sha);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
