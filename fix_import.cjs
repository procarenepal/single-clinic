const fs = require('fs');
const p = 'src/pages/dashboard/hr/index.tsx';
let data = fs.readFileSync(p, 'utf8');

const target = `  StaffMember,
  StaffAttendance,
  AccountBill,
  StaffCommission,
} from "@/types/models";`;

const rep = `  StaffMember,
  StaffAttendance,
  AccountBill,
  StaffCommission,
  ClinicHoliday,
} from "@/types/models";`;

data = data.replace(target, rep);
fs.writeFileSync(p, data);
console.log('done');
