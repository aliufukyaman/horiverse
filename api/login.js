import { SignJWT } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'horiverse-fallback-secret-32chars!!');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (username !== validUser || password !== validPass) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = await new SignJWT({ user: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET);

  res.setHeader('Set-Cookie', `hori_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`);
  return res.status(200).json({ ok: true });
}
