const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('research/har-extracted.json', 'utf8'));
  const requests = data.requests || [];

  console.log('=== Analyzing billing / 开单 processes in Baisiyi ===');

  const targets = ['/api/workshop/reception', '/api/workshop/customer', '/api/worksheet/getWorksheetByRegisterNo', '/api/worksheet/getWorkSheetRepair'];

  for (const r of requests) {
    if (targets.some(t => r.path === t)) {
      console.log(`\n======================================================`);
      console.log(`[${r.method}] ${r.path}`);
      console.log(`Query: ${JSON.stringify(r.query)}`);
      
      // Request Body
      if (r.body) {
        try {
          const parsedBody = JSON.parse(r.body);
          console.log('Request Body:', JSON.stringify(parsedBody, null, 2));
        } catch {
          console.log('Request Body (Raw):', r.body);
        }
      }

      // Response Content
      if (r.response) {
        try {
          const parsedRes = JSON.parse(r.response);
          console.log('Response (Truncated):', JSON.stringify(parsedRes, null, 2).slice(0, 1500) + '...');
        } catch {
          console.log('Response (Raw):', r.response.slice(0, 1500) + '...');
        }
      }
    }
  }

} catch (err) {
  console.error('Error analyzing billing:', err);
}
