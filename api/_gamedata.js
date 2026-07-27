// Clash of Clans game-data enrichment.
//
// Pulls the extracted game data (upgrade times + TH requirements) from
// ClashKing's public /json endpoints and turns a live player payload into
// per-category upgrade progress:  current / (TH-max – absolute-max) + time.
//
// Accuracy notes:
//  • current level + absolute max always come from the live API (correct).
//  • At the current MAX town hall, TH-max == absolute max, so it is exact.
//  • Below max TH, TH-max comes from game data: heroes via RequiredTownHallLevel,
//    troops/spells/pets/siege via LaboratoryLevel vs the max lab at that TH.
//  • Game data lags the very newest content (some 2025 heroes/spells/gear);
//    those items are flagged (missing:true) and their time is estimated from
//    the category's average per-level upgrade time, marked approximate.
//  • Hero equipment is upgraded with ores, not time — it carries no time.

const GD_BASE = 'https://api.clashk.ing';
const GD_TYPES = ['heroes', 'troops', 'spells', 'pets', 'supers', 'hero_equipment'];

// Pets / siege that game data may miss (kept in sync by hand for classification).
const EXTRA_PETS = ['Angry Jelly', 'Sneezy', 'Spirit Fox', 'Diggy', 'Frosty', 'Phoenix', 'Poison Lizard', 'Unicorn'];
const SIEGE = ['Wall Wrecker', 'Battle Blimp', 'Stone Slammer', 'Siege Barracks', 'Log Launcher', 'Flame Flinger', 'Battle Drill', 'Troop Launcher'];

// Sections shown per village, top → bottom (buildings intentionally excluded:
// Supercell's API does not expose building levels, and no reliable free
// per-level building data source exists).
// `gate` = how a category's TH-max is capped below the max town hall:
//   'th'  → item's own RequiredTownHallLevel (heroes)
//   'lab' → item's required LaboratoryLevel vs the max lab level at that TH
//   'none'→ ore/blacksmith gated (equipment) — only exact at the max TH
export const CATEGORIES = [
  { key: 'troops',        label: 'Troops',         icon: 'fa-dragon',          time: true,  gate: 'lab'  },
  { key: 'spells',        label: 'Spells',         icon: 'fa-wand-sparkles',   time: true,  gate: 'lab'  },
  { key: 'heroes',        label: 'Heroes',         icon: 'fa-crown',           time: true,  gate: 'th'   },
  { key: 'pets',          label: 'Pets',           icon: 'fa-paw',             time: true,  gate: 'lab'  },
  { key: 'siege',         label: 'Siege Machines', icon: 'fa-truck-monster',   time: true,  gate: 'lab'  },
  { key: 'heroEquipment', label: 'Hero Equipment', icon: 'fa-shield-halved',   time: false, gate: 'none' }, // ore-based
];

// Memoize the in-flight promises so concurrent villages fetch game data once.
let _gdPromise = null;
let _maxThPromise = null;

async function getJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'horiverse' } });
  if (!r.ok) throw new Error(`game data ${r.status} for ${url}`);
  return r.json();
}

function loadGameData() {
  if (!_gdPromise) _gdPromise = (async () => {
    const entries = await Promise.all(GD_TYPES.map(async t => [t, await getJson(`${GD_BASE}/json/${t}`)]));
    const gd = Object.fromEntries(entries);
    // Laboratory level → required TH, used to cap lab-gated categories below max TH.
    gd.__labMap = {};
    try {
      const buildings = await getJson(`${GD_BASE}/json/buildings`);
      const lab = buildings.Laboratory || {};
      for (const L in lab) if (typeof lab[L].TownHallLevel === 'number') gd.__labMap[L] = lab[L].TownHallLevel;
    } catch { /* leave empty → lab-gated items fall back to current level */ }
    return gd;
  })().catch(e => { _gdPromise = null; throw e; }); // don't cache failures
  return _gdPromise;
}

function maxLabAtTH(labMap, th) {
  let m = 0;
  for (const L in labMap) if (labMap[L] <= th) m = Math.max(m, Number(L));
  return m;
}

// Highest item level whose gating field value is ≤ cap (TH level or lab level).
function thMaxByField(gdItem, field, cap) {
  if (!gdItem) return null;
  let m = 0;
  for (const lvl in gdItem) {
    const req = gdItem[lvl][field];
    if ((typeof req === 'number' ? req : 1e9) <= cap) m = Math.max(m, Number(lvl));
  }
  return m || null;
}

function getMaxTH() {
  if (!_maxThPromise) _maxThPromise = (async () => {
    try {
      const ths = await getJson(`${GD_BASE}/list/townhalls`);
      return Array.isArray(ths) ? Math.max(...ths) : 17;
    } catch { return 17; }
  })();
  return _maxThPromise;
}

// Sum UpgradeTimeH for levels (current, thMax].
// Game data lags the newest levels, so missing ones are ESTIMATED by carrying
// forward the last known per-level time (upgrade times plateau at the top).
// known=false whenever any level had to be estimated → UI shows "≈".
function remainingHours(gdItem, current, thMax) {
  if (!gdItem || !thMax || thMax <= current) return { hours: 0, known: !!gdItem };
  let hours = 0, known = true, lastKnown = 0;
  for (let L = 1; L <= current; L++) {              // seed carry-forward from levels already owned
    const e = gdItem[String(L)];
    if (e && typeof e.UpgradeTimeH === 'number') lastKnown = e.UpgradeTimeH;
  }
  for (let L = current + 1; L <= thMax; L++) {
    const e = gdItem[String(L)];
    if (e && typeof e.UpgradeTimeH === 'number') { hours += e.UpgradeTimeH; lastKnown = e.UpgradeTimeH; }
    else { hours += lastKnown; known = false; }     // estimate missing level via carry-forward
  }
  return { hours, known };
}

// Mean per-level upgrade hours across a whole game-data source — used to
// estimate time for items entirely absent from game data (newest content).
function avgUpgradeHours(gdSource) {
  let sum = 0, n = 0;
  for (const name in gdSource) for (const lvl in gdSource[name]) {
    const h = gdSource[name][lvl].UpgradeTimeH;
    if (typeof h === 'number') { sum += h; n++; }
  }
  return n ? sum / n : 0;
}

function enrichItem(apiItem, gdItem, playerTH, maxTH, cat, maxLab, fallbackH) {
  const current = Number(apiItem.level) || 0;
  const absMax = Number(apiItem.maxLevel) || current;
  // At (or above) the game's max TH, every item's TH cap equals its absolute max.
  let thMax;
  if (playerTH >= maxTH) thMax = absMax;
  else if (cat.gate === 'th')  thMax = thMaxByField(gdItem, 'RequiredTownHallLevel', playerTH);
  else if (cat.gate === 'lab') thMax = thMaxByField(gdItem, 'LaboratoryLevel', maxLab);
  else thMax = null; // equipment below max TH is blacksmith/ore gated → cap unknown
  const missing = !gdItem;
  if (thMax != null) thMax = Math.max(thMax, current); // never below what the player already has
  const remLevels = thMax == null ? null : Math.max(0, thMax - current);

  let remHours = null, timeKnown = null;
  if (cat.time) {
    const rem = remainingHours(gdItem, current, thMax);
    remHours = rem.hours; timeKnown = rem.known && !missing;
    // Item not in game data at all → estimate from the category's average per-level time.
    if (missing && remLevels > 0 && fallbackH > 0) { remHours = Math.round(remLevels * fallbackH); timeKnown = false; }
  }
  return {
    name: apiItem.name,
    current, absMax,
    thMax: thMax == null ? null : thMax,
    remLevels,
    maxed: thMax != null && current >= thMax,
    remHours, timeKnown, missing,
  };
}

export async function enrichPlayer(player, maxThHint) {
  const gd = await loadGameData();
  const maxTH = maxThHint || (await getMaxTH());
  const playerTH = Number(player.townHallLevel) || maxTH;

  const petSet = new Set([...Object.keys(gd.pets || {}), ...EXTRA_PETS]);
  const siegeSet = new Set(SIEGE);
  const superSet = new Set(Object.keys(gd.supers || {}));
  const isSuper = n => superSet.has(String(n).replace(/\s/g, '')) || String(n).startsWith('Super ');

  const home = (arr) => (arr || []).filter(x => x && (x.village === undefined || x.village === 'home'));
  const homeTroops = home(player.troops);

  const buckets = {
    heroes: home(player.heroes),
    spells: home(player.spells),
    heroEquipment: home(player.heroEquipment),
    pets: homeTroops.filter(t => petSet.has(t.name)),
    siege: homeTroops.filter(t => siegeSet.has(t.name)),
    troops: homeTroops.filter(t => !petSet.has(t.name) && !siegeSet.has(t.name) && !isSuper(t.name)),
  };
  const gdFor = { heroes: gd.heroes, spells: gd.spells, heroEquipment: gd.hero_equipment,
                  pets: gd.pets, siege: gd.troops, troops: gd.troops };
  const maxLab = maxLabAtTH(gd.__labMap || {}, playerTH);
  const fallbackH = {}; // per-category mean per-level hours, for items missing from game data
  for (const cat of CATEGORIES) fallbackH[cat.key] = cat.time ? avgUpgradeHours(gdFor[cat.key] || {}) : 0;

  const categories = CATEGORIES.map(cat => {
    const items = (buckets[cat.key] || [])
      .map(it => enrichItem(it, gdFor[cat.key] && gdFor[cat.key][it.name], playerTH, maxTH, cat, maxLab, fallbackH[cat.key]))
      .sort((a, b) => (a.maxed - b.maxed) || (b.remHours || 0) - (a.remHours || 0) || a.name.localeCompare(b.name));
    const totalHours = cat.time ? items.reduce((s, i) => s + (i.remHours || 0), 0) : 0;
    const timeComplete = cat.time ? items.every(i => i.timeKnown) : true;
    const maxedCount = items.filter(i => i.maxed).length;
    return { key: cat.key, label: cat.label, icon: cat.icon, hasTime: cat.time,
             totalHours, timeComplete, maxedCount, count: items.length, items };
  }).filter(c => c.count > 0);

  const grandHours = categories.reduce((s, c) => s + (c.hasTime ? c.totalHours : 0), 0);
  const grandComplete = categories.every(c => !c.hasTime || c.timeComplete);

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

  return { playerTH, maxTH, header, totals: { grandHours, grandComplete }, categories };
}
