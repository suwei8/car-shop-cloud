const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('research/har-extracted.json', 'utf8'));
  const samples = data.samples || {};

  console.log('=== Available Sample Keys in har-extracted.json ===');
  console.log(Object.keys(samples));

  for (const [key, value] of Object.entries(samples)) {
    console.log(`\n======================================================`);
    console.log(`Sample Key: ${key}`);
    console.log(JSON.stringify(value, null, 2).slice(0, 1500) + '...\n');
  }

} catch (err) {
  console.error(err);
}
