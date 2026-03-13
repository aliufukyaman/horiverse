import { jwtVerify } from 'jose';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');
const DATA_PATH = join(process.cwd(), 'data', 'pubg_stats.json');

async function verifyAuth(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/hori_session=([^;]+)/);
  if (!match) return false;
  try {
    await jwtVerify(match[1], SECRET);
    return true;
  } catch {
    return false;
  }
}

function loadData() {
  try {
    return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  } catch {
    return { game_days: [], overall: {} };
  }
}

function saveData(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function recalcOverall(game_days) {
  let hori_total_kills = 0;
  let tami_total_kills = 0;
  let total_games_played = 0;
  let total_wins = 0;
  let total_top3 = 0;
  let hori_kill_count = 0;
  let tami_kill_count = 0;
  let hori_damage_sum = 0;
  let tami_damage_sum = 0;
  let all_hori_damages = [];
  let all_tami_damages = [];
  let hori_max_damage = 0;
  let tami_max_damage = 0;
  let hp_hori_wins = 0, hp_tami_wins = 0, hp_eq = 0, hp_total = 0;
  let kill_hori_wins = 0, kill_tami_wins = 0, kill_eq = 0, kill_total = 0;
  let best_score = -1, best_score_gd = null;
  let hori_best_score = -1, hori_best_gd = null;
  let tami_best_score = -1, tami_best_gd = null;
  let team_kill_best = 0, team_kill_best_gd = null;
  let team_damage_best = 0, team_damage_best_gd = null;
  let team_score_best = -1, team_score_best_gd = null;

  game_days.forEach(gd => {
    const games = gd.games || [];
    total_games_played += games.length;

    games.forEach(g => {
      const hk = Number(g.hori_kill) || 0;
      const tk = Number(g.tami_kill) || 0;
      const hd = Number(g.hori_damage) || 0;
      const td = Number(g.tami_damage) || 0;
      const rank = Number(g.rank) || 99;
      const hs = Number(g.hori_score) || 0;
      const ts = Number(g.tami_score) || 0;
      const sc = Number(g.score) || 0;

      hori_total_kills += hk;
      tami_total_kills += tk;
      hori_kill_count++;
      tami_kill_count++;
      hori_damage_sum += hd;
      tami_damage_sum += td;
      all_hori_damages.push(hd);
      all_tami_damages.push(td);
      if (hd > hori_max_damage) hori_max_damage = hd;
      if (td > tami_max_damage) tami_max_damage = td;
      if (rank === 1) total_wins++;
      if (rank <= 3) total_top3++;

      hp_total++;
      if (hd > td) hp_hori_wins++;
      else if (hd < td) hp_tami_wins++;
      else hp_eq++;

      kill_total++;
      if (hk > tk) kill_hori_wins++;
      else if (hk < tk) kill_tami_wins++;
      else kill_eq++;

      if (sc > best_score) { best_score = sc; best_score_gd = `Game No:${gd.game_no}, Game ${g.game}`; }
      if (hs > hori_best_score) { hori_best_score = hs; hori_best_gd = `Game No:${gd.game_no}, Game ${g.game}`; }
      if (ts > tami_best_score) { tami_best_score = ts; tami_best_gd = `Game No:${gd.game_no}, Game ${g.game}`; }
    });

    const t = gd.total || {};
    const gd_kills = (Number(t.hori_kill) || 0) + (Number(t.tami_kill) || 0);
    const gd_damage = ((Number(t.hori_damage) || 0) + (Number(t.tami_damage) || 0)) / 2;
    const gd_score = Number(t.score) || 0;

    if (gd_kills >= team_kill_best) { team_kill_best = gd_kills; team_kill_best_gd = gd.game_no; }
    if (gd_damage >= team_damage_best) { team_damage_best = gd_damage; team_damage_best_gd = gd.game_no; }
    if (gd_score >= team_score_best) { team_score_best = gd_score; team_score_best_gd = gd.game_no; }
  });

  const hori_kill_avg = hori_kill_count > 0 ? (hori_total_kills / hori_kill_count).toFixed(3) : 0;
  const tami_kill_avg = tami_kill_count > 0 ? (tami_total_kills / tami_kill_count).toFixed(3) : 0;
  all_hori_damages.sort((a, b) => a - b);
  all_tami_damages.sort((a, b) => a - b);
  const hori_median = all_hori_damages[Math.floor(all_hori_damages.length / 2)] || 0;
  const tami_median = all_tami_damages[Math.floor(all_tami_damages.length / 2)] || 0;
  const hori_mean = hori_kill_count > 0 ? (hori_damage_sum / hori_kill_count).toFixed(1) : 0;
  const tami_mean = tami_kill_count > 0 ? (tami_damage_sum / tami_kill_count).toFixed(1) : 0;
  const win_rate = total_games_played > 0 ? ((total_wins / total_games_played) * 100).toFixed(1) + '%' : '0%';
  const top3_rate = total_games_played > 0 ? ((total_top3 / total_games_played) * 100).toFixed(1) + '%' : '0%';
  const hp_h = hp_total > 0 ? ((hp_hori_wins / hp_total) * 100).toFixed(1) : 0;
  const hp_e = hp_total > 0 ? ((hp_eq / hp_total) * 100).toFixed(1) : 0;
  const hp_t = hp_total > 0 ? ((hp_tami_wins / hp_total) * 100).toFixed(1) : 0;
  const kl_h = kill_total > 0 ? ((kill_hori_wins / kill_total) * 100).toFixed(1) : 0;
  const kl_e = kill_total > 0 ? ((kill_eq / kill_total) * 100).toFixed(1) : 0;
  const kl_t = kill_total > 0 ? ((kill_tami_wins / kill_total) * 100).toFixed(1) : 0;

  return {
    hori_total_kills,
    tami_total_kills,
    total_games_played,
    total_wins,
    total_top3,
    win_rate,
    top3_rate,
    hori_kill_avg,
    tami_kill_avg,
    hori_damage_mean_median: `${hori_mean}, ${hori_median}`,
    tami_damage_mean_median: `${tami_mean}, ${tami_median}`,
    hori_damage_max: hori_max_damage,
    tami_damage_max: tami_max_damage,
    hp_comparison: `H: %${hp_h}, Eq:%${hp_e}, T: %${hp_t}`,
    kill_comparison: `H: %${kl_h}, Eq:%${kl_e}, T: %${kl_t}`,
    team_total_kill_best: `${team_kill_best}, Game No:${team_kill_best_gd}`,
    team_avg_damage_best: `${team_damage_best.toFixed(1)}, Game No:${team_damage_best_gd}`,
    team_avg_score_best: `${team_score_best.toFixed(3)}, Game No:${team_score_best_gd}`,
    hori_best_game: hori_best_gd,
    tami_best_game: tami_best_gd,
    best_game_ever: best_score_gd,
  };
}

export default async function handler(req, res) {
  const authed = await verifyAuth(req);
  if (!authed) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const data = loadData();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { action, game_day } = req.body || {};

    if (action === 'save_game_day') {
      const data = loadData();
      const idx = data.game_days.findIndex(g => g.game_no === game_day.game_no);
      if (idx >= 0) {
        data.game_days[idx] = game_day;
      } else {
        data.game_days.push(game_day);
        data.game_days.sort((a, b) => a.game_no - b.game_no);
      }
      data.overall = recalcOverall(data.game_days);
      saveData(data);
      return res.status(200).json({ ok: true, overall: data.overall });
    }

    if (action === 'delete_game_day') {
      const data = loadData();
      data.game_days = data.game_days.filter(g => g.game_no !== game_day.game_no);
      data.overall = recalcOverall(data.game_days);
      saveData(data);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
