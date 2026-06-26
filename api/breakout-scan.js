import { runBreakoutScan } from '../lib/core.js';
import { handleOptions, setCors } from './_cors.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const result = await runBreakoutScan(body.parameters || body);
    res.status(result.error ? 207 : 200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}