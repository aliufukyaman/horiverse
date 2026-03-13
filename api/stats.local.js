// Local dev override — uses filesystem instead of GitHub API
// server.js bu dosyayı import eder
import { jwtVerify } from 'jose';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');
const DATA_PATH = join(process.cwd(), 'data', 'pubg_stats.json');

async function verifyAuth(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/hori_session=([^;]+)/);
  if (!match) return false;
  try { await jwtVerify(match[1], SECRET); return true; }
  catch { return false; }
}

function load() {
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
}

function save(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function recalcOverall(game_days) {
  let hori_total_kills=0, tami_total_kills=0, total_games_played=0, total_wins=0, total_top3=0;
  let hori_damage_sum=0, tami_damage_sum=0, all_hori_dmg=[], all_tami_dmg=[];
  let hori_max_dmg=0, tami_max_dmg=0, hori_max_kill=0, tami_max_kill=0;
  let hp_h=0, hp_t=0, hp_eq=0, kl_h=0, kl_t=0, kl_eq=0;
  let best_score=-1, best_ref=null, hori_best_score=-1, hori_best_ref=null, tami_best_score=-1, tami_best_ref=null;
  let team_kill_best=0, team_kill_ref=null, team_dmg_best=0, team_dmg_ref=null, team_score_best=-1, team_score_ref=null;

  game_days.forEach(gd => {
    const games = gd.games || [];
    total_games_played += games.length;
    let day_hk=0, day_tk=0, day_hd=0, day_td=0, day_score=0;
    games.forEach(g => {
      const hk=Number(g.hori_kill)||0, tk=Number(g.tami_kill)||0;
      const hd=Number(g.hori_damage)||0, td=Number(g.tami_damage)||0;
      const rank=Number(g.rank)||99, hs=Number(g.hori_score)||0, ts=Number(g.tami_score)||0, sc=Number(g.score)||0;
      hori_total_kills+=hk; tami_total_kills+=tk;
      hori_damage_sum+=hd; tami_damage_sum+=td;
      all_hori_dmg.push(hd); all_tami_dmg.push(td);
      if(hd>hori_max_dmg)hori_max_dmg=hd; if(td>tami_max_dmg)tami_max_dmg=td;
      if(hk>hori_max_kill)hori_max_kill=hk; if(tk>tami_max_kill)tami_max_kill=tk;
      if(rank===1)total_wins++; if(rank<=3&&rank>0)total_top3++;
      if(hd>td)hp_h++; else if(td>hd)hp_t++; else hp_eq++;
      if(hk>tk)kl_h++; else if(tk>hk)kl_t++; else kl_eq++;
      const ref=`Day ${gd.game_no}, Game ${g.game}`;
      if(sc>best_score){best_score=sc;best_ref=`${ref} (score: ${sc.toFixed(4)})`;}
      if(hs>hori_best_score){hori_best_score=hs;hori_best_ref=`${ref} (score: ${hs.toFixed(4)})`;}
      if(ts>tami_best_score){tami_best_score=ts;tami_best_ref=`${ref} (score: ${ts.toFixed(4)})`;}
      day_hk+=hk;day_tk+=tk;day_hd+=hd;day_td+=td;day_score+=sc;
    });
    const tk2=day_hk+day_tk,ad=games.length>0?(day_hd+day_td)/2/games.length:0,as=games.length>0?day_score/games.length:0;
    if(tk2>team_kill_best){team_kill_best=tk2;team_kill_ref=gd.game_no;}
    if(ad>team_dmg_best){team_dmg_best=ad;team_dmg_ref=gd.game_no;}
    if(as>team_score_best){team_score_best=as;team_score_ref=gd.game_no;}
  });

  all_hori_dmg.sort((a,b)=>a-b); all_tami_dmg.sort((a,b)=>a-b);
  const hori_median=all_hori_dmg[Math.floor(all_hori_dmg.length/2)]||0;
  const tami_median=all_tami_dmg[Math.floor(all_tami_dmg.length/2)]||0;
  const hori_mean=total_games_played>0?(hori_damage_sum/total_games_played).toFixed(1):0;
  const tami_mean=total_games_played>0?(tami_damage_sum/total_games_played).toFixed(1):0;
  const hpt=hp_h+hp_t+hp_eq, klt=kl_h+kl_t+kl_eq;
  return {
    hori_total_kills,tami_total_kills,total_games_played,total_wins,total_top3,
    win_rate:total_games_played>0?((total_wins/total_games_played)*100).toFixed(1)+'%':'0%',
    top3_rate:total_games_played>0?((total_top3/total_games_played)*100).toFixed(1)+'%':'0%',
    hori_kill_avg:total_games_played>0?(hori_total_kills/total_games_played).toFixed(3):0,
    tami_kill_avg:total_games_played>0?(tami_total_kills/total_games_played).toFixed(3):0,
    hori_max_kill,tami_max_kill,
    hori_damage_mean_median:`${hori_mean}, ${hori_median}`,
    tami_damage_mean_median:`${tami_mean}, ${tami_median}`,
    hori_damage_max:hori_max_dmg,tami_damage_max:tami_max_dmg,
    hp_comparison:`H: %${hpt>0?((hp_h/hpt)*100).toFixed(1):0}, Eq:%${hpt>0?((hp_eq/hpt)*100).toFixed(1):0}, T: %${hpt>0?((hp_t/hpt)*100).toFixed(1):0}`,
    kill_comparison:`H: %${klt>0?((kl_h/klt)*100).toFixed(1):0}, Eq:%${klt>0?((kl_eq/klt)*100).toFixed(1):0}, T: %${klt>0?((kl_t/klt)*100).toFixed(1):0}`,
    team_total_kill_best:`${team_kill_best} — Day ${team_kill_ref}`,
    team_avg_damage_best:`${team_dmg_best.toFixed(1)} — Day ${team_dmg_ref}`,
    team_avg_score_best:`${team_score_best.toFixed(4)} — Day ${team_score_ref}`,
    hori_best_game:hori_best_ref,tami_best_game:tami_best_ref,best_game_ever:best_ref,
  };
}

export default async function handler(req, res) {
  const authed = await verifyAuth(req);
  if (!authed) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    return res.status(200).json(load());
  }

  if (req.method === 'POST') {
    const { action, game_day } = req.body || {};
    const data = load();

    if (action === 'save_game_day') {
      const idx = data.game_days.findIndex(g => g.game_no === game_day.game_no);
      if (idx >= 0) data.game_days[idx] = game_day;
      else { data.game_days.push(game_day); data.game_days.sort((a,b)=>a.game_no-b.game_no); }
      data.overall = recalcOverall(data.game_days);
      save(data);
      return res.status(200).json({ ok: true, overall: data.overall });
    }

    if (action === 'delete_game_day') {
      data.game_days = data.game_days.filter(g => g.game_no !== game_day.game_no);
      data.overall = recalcOverall(data.game_days);
      save(data);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
