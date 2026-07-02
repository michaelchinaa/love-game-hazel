import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
 try {
  // Use the root results.json file
  const resultsPath = path.join(process.cwd(), 'results.json');

  let results = [];
  try {
   const fileContent = fs.readFileSync(resultsPath, 'utf8');
   results = JSON.parse(fileContent);
  } catch (err) {
   // File doesn't exist yet
   results = [];
  }

  // If roomCode is provided, filter results
  const { roomCode } = req.query;
  if (roomCode) {
   results = results.filter(r => r.roomCode === roomCode);
  }

  return res.status(200).json({
   success: true,
   results,
   total: results.length
  });

 } catch (error) {
  console.error('Error getting results:', error);
  return res.status(500).json({
   error: 'Failed to get results',
   details: error.message
  });
 }
}