import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomCode, results } = req.body;

    if (!roomCode || !results) {
      return res.status(400).json({ error: 'Missing roomCode or results' });
    }

    const key = `results:${roomCode}`;
    await kv.set(key, {
      ...results,
      savedAt: new Date().toISOString()
    });

    await kv.lpush('results:all', roomCode);

    await kv.del(`game:${roomCode}`);
    await kv.del(`room:${roomCode}:players`);

    return res.status(200).json({
      success: true,
      message: 'Results saved successfully'
    });

  } catch (error) {
    console.error('Error saving results:', error);
    return res.status(500).json({
      error: 'Failed to save results',
      details: error.message
    });
  }
}