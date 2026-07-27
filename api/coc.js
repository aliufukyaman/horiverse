import { jwtVerify } from 'jose';
import { VILLAGES, normTag, sampleVillage } from './_villages.js';
import { enrichPlayer } from './_gamedata.js';

const SECRET   = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');
// Default: ClashKing's public no-auth passthrough to the official CoC API — works from any IP (incl. Vercel).
// To use the official API / RoyaleAPI proxy instead, set COC_PROXY_BASE + COC_API_TOKEN.
const COC_BASE  = process.env.COC_PROXY_BASE || 'https://api.clashk.ing/v1';
const COC_TOKEN = process.env.COC_API_TOKEN || '';                 // optional developer JWT (only for authed proxies)
const RESOURCE  = process.env.COC_RESOURCE || 'players';           // 'players' (bases) or 'clans'

// Reuse the same JWT session cookie the admin login sets — one password gates both areas.
async function verifyAuth(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/hori_session=([^;]+)/);
  if (!m) return false;
  try { await jwtVerify(m[1], SECRET); return true; } catch { return false; }
}

async function fetchVillage(v) {
  const tag = normTag(v.tag);
  const base = { key: v.key, name: v.name, tag: tag ? `#${tag}` : '', resource: RESOURCE };

  let player, source, note;
  if (!tag) {
    player = sampleVillage(v); source = 'sample'; note = `No tag set for ${v.key} — showing sample data.`;
  } else {
    try {
      const headers = { Accept: 'application/json' };
      if (COC_TOKEN) headers.Authorization = `Bearer ${COC_TOKEN}`; // only needed for authed proxies
      const r = await fetch(`${COC_BASE}/${RESOURCE}/%23${tag}`, { headers });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return { ...base, source: 'error', error: `CoC API ${r.status}: ${body.reason || body.message || body.detail || 'request failed'}` };
      player = body; source = 'live';
    } catch (e) {
      return { ...base, source: 'error', error: e.message };
    }
  }

  try {
    const enriched = await enrichPlayer(player);
    return { ...base, source, note, playerName: player.name, ...enriched };
  } catch (e) {
    return { ...base, source: 'error', error: `Enrichment failed: ${e.message}` };
  }
}

export default async function handler(req, res) {
  if (!(await verifyAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

  const only = (req.query && req.query.village) || null;
  const list = only ? VILLAGES.filter(v => v.key === only) : VILLAGES;
  const villages = await Promise.all(list.map(fetchVillage));
  return res.status(200).json({ resource: RESOURCE, source: COC_BASE, villages });
}
