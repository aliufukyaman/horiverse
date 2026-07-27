// Ordered Clash of Clans village config (one entry = one tab in clash.html).
//
// Live data is fetched via api/coc.js from ClashKing's public no-auth
// passthrough (https://api.clashk.ing/v1) — no developer JWT required.
//
// NB on tags: CoC tags never contain the letter "O" — every "O" is a zero (0).
//   #UOCCCY9L → #U0CCCY9L ,  #ROLRPUY88 → #R0LRPUY88 (both verified live).
//
// The 8-char `ingameToken` values are the in-game "API Token"
// (Settings → More Settings → API Token). They are ONLY usable with
// POST /players/{tag}/verifytoken to prove base ownership — they cannot fetch
// profile data, so they are kept here only for possible future ownership checks.
export const VILLAGES = [
  {
    key: 'horizon1710',
    name: 'Horizon1710',
    tag: process.env.COC_TAG_HORIZON1710 || '#U0CCCY9L',
    ingameToken: process.env.COC_TOKEN_HORIZON1710 || 'tfjadt8j',
  },
  {
    key: 'tami64',
    name: 'Tami64',
    tag: process.env.COC_TAG_TAMI64 || '#RUL2UL8P',
    ingameToken: process.env.COC_TOKEN_TAMI64 || 'cwjettt8',
  },
  {
    key: 'horiverse',
    name: 'Horiverse',
    tag: process.env.COC_TAG_HORIVERSE || '#R0LRPUY88',
    ingameToken: process.env.COC_TOKEN_HORIVERSE || '3kfmyctp',
  },
];

// Normalize a Clash of Clans tag: strip leading '#', uppercase, trim.
export function normTag(tag) {
  return String(tag || '').trim().toUpperCase().replace(/^#/, '');
}

// Sample player payload (mirrors the real /players/{tag} shape) so the panels
// render before live credentials are configured. `_sample: true` flags it.
export function sampleVillage(v) {
  const bump = { horizon1710: 0, tami64: 1, horiverse: 2 }[v.key] || 0;
  return {
    tag: v.tag ? `#${normTag(v.tag)}` : `#SAMPLE${bump}`,
    name: v.name,
    townHallLevel: 15,
    townHallWeaponLevel: 4,
    expLevel: 210 + bump * 12,
    trophies: 4800 + bump * 130,
    bestTrophies: 5200 + bump * 100,
    warStars: 1200 + bump * 90,
    attackWins: 120 + bump * 20,
    defenseWins: 45 + bump * 5,
    builderHallLevel: 10,
    builderBaseTrophies: 3800 + bump * 60,
    bestBuilderBaseTrophies: 4100 + bump * 60,
    role: ['leader', 'coLeader', 'admin'][bump % 3],
    warPreference: 'in',
    donations: 1500 + bump * 300,
    donationsReceived: 1400 + bump * 250,
    clanCapitalContributions: 250000 + bump * 40000,
    clan: { tag: `#HORIV${bump}`, name: 'Horiverse', clanLevel: 12, badgeUrls: {} },
    leagueTier: { id: 29000022, name: 'Legend League', iconUrls: {} },
    labels: [{ name: 'Clan Wars' }, { name: 'Trophy Pushing' }, { name: 'Active Donator' }],
    heroes: [
      { name: 'Barbarian King', level: 80, maxLevel: 90, village: 'home' },
      { name: 'Archer Queen', level: 85, maxLevel: 90, village: 'home' },
      { name: 'Grand Warden', level: 55, maxLevel: 65, village: 'home' },
      { name: 'Royal Champion', level: 30, maxLevel: 40, village: 'home' },
    ],
    spells: [
      { name: 'Lightning Spell', level: 11, maxLevel: 11, village: 'home' },
      { name: 'Rage Spell', level: 6, maxLevel: 6, village: 'home' },
    ],
    troops: [
      { name: 'Barbarian', level: 12, maxLevel: 12, village: 'home' },
      { name: 'Dragon', level: 9, maxLevel: 10, village: 'home' },
    ],
    achievements: [
      { name: 'Sweet Victory!', stars: 3, value: 4800, target: 3200, info: 'Reach a number of trophies' },
      { name: 'War Hero', stars: 3, value: 1200, target: 1000, info: 'Earn war stars' },
      { name: 'Friend in Need', stars: 3, value: 250000, target: 100000, info: 'Donate troops' },
    ],
    _sample: true,
  };
}
