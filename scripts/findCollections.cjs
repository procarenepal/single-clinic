const fs = require('fs');
const files = [
  'appointmentBillingService.ts',
  'pathologyService.ts',
  'doctorCommissionService.ts',
  'expertCommissionService.ts',
  'referralCommissionService.ts',
  'staffCommissionService.ts',
];
files.forEach(f => {
  try {
    const c = fs.readFileSync('src/services/' + f, 'utf8');
    c.split('\n').forEach((l, i) => {
      if (l.includes('COLLECTION') && l.includes('= ')) {
        console.log(f + ':' + i + ': ' + l.trim());
      }
    });
  } catch(e) {}
});
