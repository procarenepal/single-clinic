const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = [
  {from: 'pagePath="/dashboard/patients/new"', to: 'pagePath="/dashboard/patients"'},
  {from: 'pagePath="/dashboard/patients/:patientId"', to: 'pagePath="/dashboard/patients"'},
  {from: 'pagePath="/dashboard/patients/:patientId/edit"', to: 'pagePath="/dashboard/patients"'},
  
  {from: 'pagePath="/dashboard/doctors/new"', to: 'pagePath="/dashboard/doctors"'},
  {from: 'pagePath="/dashboard/doctors/:doctorId"', to: 'pagePath="/dashboard/doctors"'},
  {from: 'pagePath="/dashboard/doctors/:doctorId/edit"', to: 'pagePath="/dashboard/doctors"'},

  {from: 'pagePath="/dashboard/experts/new"', to: 'pagePath="/dashboard/experts"'},
  {from: 'pagePath="/dashboard/experts/:expertId"', to: 'pagePath="/dashboard/experts"'},
  {from: 'pagePath="/dashboard/experts/:expertId/edit"', to: 'pagePath="/dashboard/experts"'},

  {from: 'pagePath="/dashboard/appointments/new"', to: 'pagePath="/dashboard/appointments"'},
  {from: 'pagePath="/dashboard/appointments/:id"', to: 'pagePath="/dashboard/appointments"'},
  {from: 'pagePath="/dashboard/appointments/:id/edit"', to: 'pagePath="/dashboard/appointments"'},

  {from: 'pagePath="/dashboard/prescriptions/new"', to: 'pagePath="/dashboard/prescriptions"'},
  {from: 'pagePath="/dashboard/prescriptions/:prescriptionId"', to: 'pagePath="/dashboard/prescriptions"'},
  {from: 'pagePath="/dashboard/prescriptions/:prescriptionId/edit"', to: 'pagePath="/dashboard/prescriptions"'},

  {from: 'pagePath="/dashboard/front-office/manage-visitors"', to: 'pagePath="/dashboard/front-office"'},
  {from: 'pagePath="/dashboard/front-office/manage-call-logs"', to: 'pagePath="/dashboard/front-office"'},

  {from: 'pagePath="/dashboard/settings/referral-partners/new"', to: 'pagePath="/dashboard/settings/referral-partners"'},
  {from: 'pagePath="/dashboard/settings/referral-partners/:partnerId/edit"', to: 'pagePath="/dashboard/settings/referral-partners"'},
  {from: 'pagePath="/dashboard/settings/referral-partners/:partnerId"', to: 'pagePath="/dashboard/settings/referral-partners"'}
];

for (const r of replacements) {
  code = code.split(r.from).join(r.to);
}

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
