// Shared calculation logic — imported by stats.js and stats.local.js

// Score formula v2:
//   kill_score  = min(kill, 10) / 10                          → 0..1  (weight 50%)
//   dmg_score   = min(damage, 1000) / 1000                   → 0..1  (weight 20%)
//   rank_score  = piecewise: rank1=1.0, rank2-3 linear→0.8,
//                 rank4-10 linear→0.5, rank11-50 linear→0, 51+=0  (weight 30%)
//   final = kill_score*0.50 + dmg_score*0.20 + rank_score*0.30
function rankScore(r) {
  if (r <= 0) return 0;
  if (r === 1)        return 1.0;
  if (r <= 3)         return 0.9 - (r - 2) * 0.1;           // rank2→0.9, rank3→0.8
  if (r <= 10)        return 0.8 - (r - 3) / 7 * 0.3;       // rank4→~0.76 .. rank10→0.5
  if (r <= 50)        return 0.5 - (r - 10) / 40 * 0.5;     // rank11→~0.49 .. rank50→0
  return 0;
}

export function calcScore(kill, damage, rank) {
  const k = Math.min(Number(kill) || 0, 10) / 10;
  const d = Math.min(Number(damage) || 0, 1000) / 1000;
  const rs = rankScore(Number(rank) || 0);
  return parseFloat((k * 0.50 + d * 0.20 + rs * 0.30).toFixed(4));
}

export function calcGameDay(gd) {
  const games = (gd.games || []).map(g => ({
    ...g,
    hori_score: calcScore(g.hori_kill, g.hori_damage, g.rank),
    tami_score: calcScore(g.tami_kill, g.tami_damage, g.rank),
    score: parseFloat(((calcScore(g.hori_kill, g.hori_damage, g.rank) + calcScore(g.tami_kill, g.tami_damage, g.rank)) / 2).toFixed(4)),
  }));

  const n = games.length || 1;
  const sum = (key) => games.reduce((s, g) => s + (Number(g[key]) || 0), 0);

  const total = {
    hori_kill: sum('hori_kill'),
    hori_damage: Math.round(sum('hori_damage') / n),
    tami_kill: sum('tami_kill'),
    tami_damage: Math.round(sum('tami_damage') / n),
    rank: parseFloat((sum('rank') / n).toFixed(1)),
    hori_score: parseFloat((sum('hori_score') / n).toFixed(2)),
    tami_score: parseFloat((sum('tami_score') / n).toFixed(2)),
    score: parseFloat((sum('score') / n).toFixed(2)),
  };

  return { ...gd, games, total };
}

export function recalcOverall(game_days) {
  let hori_total_kills = 0, tami_total_kills = 0;
  let total_games_played = 0, total_wins = 0, total_top3 = 0;
  let hori_damage_sum = 0, tami_damage_sum = 0;
  let all_hori_dmg = [], all_tami_dmg = [];
  let hori_max_dmg = 0, tami_max_dmg = 0;
  let hori_max_kill = 0, tami_max_kill = 0;
  let hp_h = 0, hp_t = 0, hp_eq = 0;
  let kl_h = 0, kl_t = 0, kl_eq = 0;
  let best_score = -1, best_ref = null;
  let hori_best_score = -1, hori_best_ref = null;
  let tami_best_score = -1, tami_best_ref = null;
  let team_kill_best = 0, team_kill_ref = null;
  let team_dmg_best = 0, team_dmg_ref = null;
  let team_score_best = -1, team_score_ref = null;
  let team_rank_best = 999, team_rank_ref = null;
  // extra stats
  let hori_score_sum = 0, tami_score_sum = 0, score_count = 0;
  let day_scores = []; // {game_no, score} for best/worst days
  let top3_streak = 0, cur_streak = 0;
  let win_streak = 0, cur_win_streak = 0;
  let no_kill_games = 0; // games where both players got 0 kills

  game_days.forEach(gd => {
    const enriched = calcGameDay(gd);
    const games = enriched.games;
    total_games_played += games.length;
    let day_hk = 0, day_tk = 0, day_hd = 0, day_td = 0, day_score = 0, day_rank = 0;

    games.forEach(g => {
      const hk = Number(g.hori_kill) || 0;
      const tk = Number(g.tami_kill) || 0;
      const hd = Number(g.hori_damage) || 0;
      const td = Number(g.tami_damage) || 0;
      const rank = Number(g.rank) || 99;
      const hs = g.hori_score;
      const ts = g.tami_score;
      const sc = g.score;

      hori_total_kills += hk; tami_total_kills += tk;
      hori_damage_sum += hd; tami_damage_sum += td;
      all_hori_dmg.push(hd); all_tami_dmg.push(td);
      if (hd > hori_max_dmg) hori_max_dmg = hd;
      if (td > tami_max_dmg) tami_max_dmg = td;
      if (hk > hori_max_kill) hori_max_kill = hk;
      if (tk > tami_max_kill) tami_max_kill = tk;
      if (rank === 1) total_wins++;
      if (rank <= 3 && rank > 0) total_top3++;
      if (hd > td) hp_h++; else if (td > hd) hp_t++; else hp_eq++;
      if (hk > tk) kl_h++; else if (tk > hk) kl_t++; else kl_eq++;

      const ref = `Day ${gd.game_no}, Game ${g.game}`;
      if (sc > best_score)      { best_score = sc;      best_ref = `${ref} (score: ${sc.toFixed(2)})`; }
      if (hs > hori_best_score) { hori_best_score = hs; hori_best_ref = `${ref} (score: ${hs.toFixed(2)})`; }
      if (ts > tami_best_score) { tami_best_score = ts; tami_best_ref = `${ref} (score: ${ts.toFixed(2)})`; }

      hori_score_sum += hs; tami_score_sum += ts; score_count++;
      if (hk === 0 && tk === 0) no_kill_games++;
      day_hk += hk; day_tk += tk; day_hd += hd; day_td += td;
      day_score += sc; day_rank += rank;
    });

    const n = games.length || 1;
    const team_kills = day_hk + day_tk;
    const team_avg_dmg = (day_hd + day_td) / 2 / n;
    const team_avg_score = day_score / n;
    const team_avg_rank = day_rank / n;

    if (team_kills > team_kill_best)      { team_kill_best = team_kills;      team_kill_ref = gd.game_no; }
    if (team_avg_dmg > team_dmg_best)     { team_dmg_best = team_avg_dmg;     team_dmg_ref = gd.game_no; }
    if (team_avg_score > team_score_best) { team_score_best = team_avg_score; team_score_ref = gd.game_no; }
    if (team_avg_rank < team_rank_best)   { team_rank_best = team_avg_rank;   team_rank_ref = gd.game_no; }

    day_scores.push({ game_no: gd.game_no, score: team_avg_score });

    // top3 streak (per game)
    games.forEach(g => {
      const r = Number(g.rank) || 99;
      if (r <= 3 && r > 0) { cur_streak++; if (cur_streak > top3_streak) top3_streak = cur_streak; }
      else cur_streak = 0;
      if (r === 1) { cur_win_streak++; if (cur_win_streak > win_streak) win_streak = cur_win_streak; }
      else cur_win_streak = 0;
    });
  });

  all_hori_dmg.sort((a, b) => a - b);
  all_tami_dmg.sort((a, b) => a - b);
  const hori_median = all_hori_dmg[Math.floor(all_hori_dmg.length / 2)] || 0;
  const tami_median = all_tami_dmg[Math.floor(all_tami_dmg.length / 2)] || 0;
  const hori_mean = total_games_played > 0 ? Math.round(hori_damage_sum / total_games_played) : 0;
  const tami_mean = total_games_played > 0 ? Math.round(tami_damage_sum / total_games_played) : 0;
  const hpt = hp_h + hp_t + hp_eq;
  const klt = kl_h + kl_t + kl_eq;
  const pct = (a, t) => t > 0 ? ((a / t) * 100).toFixed(1) : '0.0';

  return {
    hori_total_kills, tami_total_kills,
    total_games_played, total_wins, total_top3,
    win_rate:  `${pct(total_wins, total_games_played)}%`,
    top3_rate: `${pct(total_top3, total_games_played)}%`,
    hori_kill_avg: total_games_played > 0 ? (hori_total_kills / total_games_played).toFixed(2) : '0.00',
    tami_kill_avg: total_games_played > 0 ? (tami_total_kills / total_games_played).toFixed(2) : '0.00',
    hori_max_kill, tami_max_kill,
    hori_damage_mean: hori_mean,
    tami_damage_mean: tami_mean,
    hori_damage_median: hori_median,
    tami_damage_median: tami_median,
    hori_damage_max: hori_max_dmg,
    tami_damage_max: tami_max_dmg,
    hp_h: pct(hp_h, hpt), hp_eq: pct(hp_eq, hpt), hp_t: pct(hp_t, hpt),
    kl_h: pct(kl_h, klt), kl_eq: pct(kl_eq, klt), kl_t: pct(kl_t, klt),
    team_total_kill_best:  `${team_kill_best} — Day ${team_kill_ref}`,
    team_avg_damage_best:  `${Math.round(team_dmg_best)} — Day ${team_dmg_ref}`,
    team_avg_score_best:   `${team_score_best.toFixed(2)} — Day ${team_score_ref}`,
    team_avg_rank_best:    `${team_rank_best.toFixed(1)} — Day ${team_rank_ref}`,
    hori_best_game: hori_best_ref,
    tami_best_game: tami_best_ref,
    best_game_ever: best_ref,
    // raw numbers for charts
    hori_kill_total: hori_total_kills,
    tami_kill_total: tami_total_kills,
    // extra stats for 4th panel
    hori_score_avg: score_count > 0 ? (hori_score_sum / score_count).toFixed(3) : '0.000',
    tami_score_avg: score_count > 0 ? (tami_score_sum / score_count).toFixed(3) : '0.000',
    top3_streak,
    win_streak,
    no_kill_games,
    no_kill_rate: `${pct(no_kill_games, total_games_played)}%`,
    // per-player kill streaks (consecutive games with ≥1 kill)
    hori_kill_streak: (() => {
      let best=0, cur=0;
      game_days.forEach(gd => calcGameDay(gd).games.forEach(g => {
        if ((Number(g.hori_kill)||0) >= 1) { cur++; if(cur>best) best=cur; } else cur=0;
      }));
      return best;
    })(),
    tami_kill_streak: (() => {
      let best=0, cur=0;
      game_days.forEach(gd => calcGameDay(gd).games.forEach(g => {
        if ((Number(g.tami_kill)||0) >= 1) { cur++; if(cur>best) best=cur; } else cur=0;
      }));
      return best;
    })(),
    // raw eq counts for comparison
    hp_eq_raw: pct(hp_eq, hpt),
    kl_eq_raw: pct(kl_eq, klt),
  };
}
