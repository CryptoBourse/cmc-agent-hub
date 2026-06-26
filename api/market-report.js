import { runMarketReport } from '../lib/core.js';
import { handleOptions, setCors } from './_cors.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const result = await runMarketReport();
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}