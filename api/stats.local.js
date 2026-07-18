import { jwtVerify } from 'jose';
import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { calcGameDay, recalcOverall } from './_calc.js';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');
const DAYS_DIR = join(process.cwd(), 'data', 'days');

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

function loadAll() {
  if (!existsSync(DAYS_DIR)) mkdirSync(DAYS_DIR, { recursive: true });
  const files = readdirSync(DAYS_DIR).filter(f => f.endsWith('.json')).sort();
  return files.map(f => JSON.parse(readFileSync(join(DAYS_DIR, f), 'utf-8')));
}

function saveDay(gd) {
  if (!existsSync(DAYS_DIR)) mkdirSync(DAYS_DIR, { recursive: true });
  writeFileSync(join(DAYS_DIR, dayFilename(gd)), JSON.stringify(gd, null, 2), 'utf-8');
}

function deleteDay(game_no) {
  if (!existsSync(DAYS_DIR)) return;
  const files = readdirSync(DAYS_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const gd = JSON.parse(readFileSync(join(DAYS_DIR, f), 'utf-8'));
    if (gd.game_no === game_no) { unlinkSync(join(DAYS_DIR, f)); return; }
  }
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
    const game_days = loadAll();
    return res.status(200).json(enrichData(game_days));
  }

  if (req.method === 'POST') {
    const { action, game_day } = req.body || {};

    if (action === 'save_game_day') {
      const clean = cleanGameDay(game_day);
      // remove old file if game_no exists (date might have changed → filename changes)
      deleteDay(clean.game_no);
      saveDay(clean);
      const all = loadAll();
      return res.status(200).json({ ok: true, overall: recalcOverall(all) });
    }

    if (action === 'delete_game_day') {
      deleteDay(game_day.game_no);
      const all = loadAll();
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
