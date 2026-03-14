import { jwtVerify } from 'jose';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { calcGameDay, recalcOverall } from './_calc.js';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');
const DATA_PATH = join(process.cwd(), 'data', 'pubg_stats.json');

async function verifyAuth(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/hori_session=([^;]+)/);
  if (!match) return false;
  try { await jwtVerify(match[1], SECRET); return true; }
  catch { return false; }
}

function load() { return JSON.parse(readFileSync(DATA_PATH, 'utf-8')); }
function save(data) { writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8'); }

function enrichData(raw) {
  return { game_days: raw.game_days.map(calcGameDay), overall: recalcOverall(raw.game_days) };
}

export default async function handler(req, res) {
  const authed = await verifyAuth(req);
  if (!authed) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    return res.status(200).json(enrichData(load()));
  }

  if (req.method === 'POST') {
    const { action, game_day } = req.body || {};
    const data = load();

    if (action === 'save_game_day') {
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
      save(data);
      return res.status(200).json({ ok: true, overall: recalcOverall(data.game_days) });
    }

    if (action === 'delete_game_day') {
      data.game_days = data.game_days.filter(g => g.game_no !== game_day.game_no);
      save(data);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
