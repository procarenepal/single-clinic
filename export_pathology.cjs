const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('pathology.json', 'utf8'));
  if (data.pathologyTestTemplates && data.pathologyTestTemplates.length > 0) {
     console.log('Sample pathologyTestTemplates:', JSON.stringify(data.pathologyTestTemplates[0], null, 2));
  } else {
     console.log('No pathologyTestTemplates');
  }
} catch (e) {
  console.error(e);
}
