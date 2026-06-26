import { getSkillsPayload } from '../lib/core.js';
import { handleOptions, setCors } from './_cors.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.status(200).json(getSkillsPayload());
}