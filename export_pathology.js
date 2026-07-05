const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('pathology.json', 'utf8'));
  console.log('Top level keys:', Object.keys(data));
  if (data.pathologyTests) {
     console.log('Sample test:', data.pathologyTests[0]);
  }
} catch (e) {
  console.error(e);
}
