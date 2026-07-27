// Clash of Clans max-level enrichment.
//
// Max levels are STATIC and live in the project at:
//     api/coc-game-data.json   ← hand-edit this file.
// Sourced from clash.ninja/guides/max-levels-for-each-th (per-TH max level for
// every item). Loaded once at startup — never fetched at runtime. Only the
// player/user data is fetched live (see api/coc.js).
//
// Each item is a map { "<TownHall>": maxLevel }. A group with "live": true gets
// personal progress bars (current level comes from the live API, matched by
// name); "live": false groups (Defenses, Traps, Walls, Resources, Army
// buildings) have no per-player level in the CoC API, so they are shown as
// TH targets (max level at your TH) only.
//
// To hide an item, delete it from the file. To fix a max level, edit its number.
// There are no upgrade times — this source lists levels only.

import { readFileSync } from 'fs';

let GD, GD_ERROR = null;
try {
  GD = JSON.parse(readFileSync(new URL('./coc-game-data.json', import.meta.url), 'utf-8'));
} catch (e) {
  GD = { maxTownHall: 17, groups: [] };
  GD_ERROR = `api/coc-game-data.json could not be read — ${e.message}`;
}

const ICONS = {
  troops: 'fa-dragon', darktroops: 'fa-skull', spells: 'fa-wand-sparkles',
  siegemachines: 'fa-truck-monster', heroes: 'fa-crown', pets: 'fa-paw',
  defenses: 'fa-chess-rook', traps: 'fa-bomb', walls: 'fa-border-all',
  resources: 'fa-coins', armybuildings: 'fa-warehouse',
};

// name → current level, from every upgradeable array the live API returns.
function currentLevels(player) {
  const map = {};
  const add = arr => (arr || []).forEach(x => {
    if (x && (x.village === undefined || x.village === 'home')) map[x.name] = Number(x.level) || 0;
  });
  add(player.heroes); add(player.troops); add(player.spells); add(player.heroEquipment);
  return map;
}

// Max level of an item at the player's TH (exact column, else highest TH ≤ player's).
function itemThMax(table, playerTH) {
  if (table[String(playerTH)] != null) return table[String(playerTH)];
  let best = null, bestTh = -1;
  for (const th in table) { const t = Number(th); if (t <= playerTH && t > bestTh) { bestTh = t; best = table[th]; } }
  return best; // null → not available at/under this TH
}
function itemAbsMax(table) { let m = 0; for (const th in table) m = Math.max(m, table[th]); return m; }
function itemUnlockTH(table) { let m = Infinity; for (const th in table) m = Math.min(m, Number(th)); return isFinite(m) ? m : null; }

export function enrichPlayer(player) {
  if (GD_ERROR) throw new Error(GD_ERROR);
  const playerTH = Number(player.townHallLevel) || GD.maxTownHall || 17;
  const cur = currentLevels(player);

  // Items are kept in file order (the game's real order). Units not yet
  // available at the player's TH are included as passive "future" entries.
  const categories = (GD.groups || []).map(g => {
    const items = [];
    let availCount = 0, maxedCount = 0;
    for (const name in g.items) {
      const table = g.items[name];
      const absMax = itemAbsMax(table);
      const thMaxRaw = itemThMax(table, playerTH);
      if (thMaxRaw == null) {                          // not unlocked at this TH yet → passive
        items.push({ name, future: true, unlockTH: itemUnlockTH(table), absMax, current: g.live ? 0 : null });
        continue;
      }
      availCount++;
      if (g.live) {
        const current = cur[name] ?? 0;
        const maxed = current >= thMaxRaw;
        if (maxed) maxedCount++;
        items.push({ name, current, thMax: Math.max(thMaxRaw, current), absMax, maxed, future: false });
      } else {
        items.push({ name, current: null, thMax: thMaxRaw, absMax, ref: true, future: false });
      }
    }
    return { key: g.key, label: g.label, icon: ICONS[g.key] || 'fa-cube', live: !!g.live, count: availCount, maxedCount, items };
  }).filter(c => c.items.length > 0);

  const lt = player.leagueTier || player.league || player.builderBaseLeague || null;
  const header = {
    townHallLevel: playerTH,
    expLevel: player.expLevel,
    league: lt ? { name: lt.name, icon: (lt.iconUrls && (lt.iconUrls.small || lt.iconUrls.medium)) || '' } : null,
    role: player.role, tag: player.tag,
    stats: {
      bestTrophies: player.bestTrophies, warStars: player.warStars,
      attackWins: player.attackWins, defenseWins: player.defenseWins,
      donations: player.donations, donationsReceived: player.donationsReceived,
    },
  };

  return { playerTH, maxTH: GD.maxTownHall, header, categories };
}
