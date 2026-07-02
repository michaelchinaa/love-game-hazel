import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomCode, results } = req.body;

    if (!roomCode || !results) {
      return res.status(400).json({ error: 'Missing roomCode or results' });
    }

    // Use the root results.json file
    const resultsPath = path.join(process.cwd(), 'results.json');

    // Read existing results
    let existingResults = [];
    try {
      const fileContent = fs.readFileSync(resultsPath, 'utf8');
      existingResults = JSON.parse(fileContent);
    } catch (err) {
      // File doesn't exist yet, start with empty array
      existingResults = [];
    }

    // Add new result with timestamp
    const newResult = {
      roomCode,
      ...results,
      savedAt: new Date().toISOString()
    };

    existingResults.push(newResult);

    // Write back to file
    fs.writeFileSync(resultsPath, JSON.stringify(existingResults, null, 2));

    return res.status(200).json({
      success: true,
      message: 'Results saved successfully',
      totalResults: existingResults.length
    });

  } catch (error) {
    console.error('Error saving results:', error);
    return res.status(500).json({
      error: 'Failed to save results',
      details: error.message
    });
  }
}