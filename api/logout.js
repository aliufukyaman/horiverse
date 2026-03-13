export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'hori_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
  return res.status(200).json({ ok: true });
}
