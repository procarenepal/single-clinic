const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/pages/dashboard/hr/index.tsx");
let content = fs.readFileSync(filePath, "utf-8");

content = content.split("StaffAttendance,\n  AccountBill,").join(`StaffAttendance,\n  AccountBill,\n  ClinicHoliday,`);

content = content.split(`IoCreateOutline,\n  IoDocumentsOutline,\n} from "react-icons/io5";`).join(`IoCreateOutline,\n  IoDocumentsOutline,\n  IoTrashOutline,\n  IoCalendarOutline,\n} from "react-icons/io5";`);

content = content.split(`const [bills, setBills] = useState<AccountBill[]>([]);`).join(`const [bills, setBills] = useState<AccountBill[]>([]);\n  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);\n  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);\n  const [newHoliday, setNewHoliday] = useState({ name: "", date: format(new Date(), "yyyy-MM-dd") });`);

content = content.split(`shiftEndTime: "17:00",\n    defaultCommission: "0",\n    // Login account fields`).join(`shiftEndTime: "17:00",\n    allowedLeavesPerMonth: "4",\n    defaultCommission: "0",\n    // Login account fields`);

content = content.split(`shiftEndTime: "17:00",\n        defaultCommission: "0",\n        createAccount: false`).join(`shiftEndTime: "17:00",\n        allowedLeavesPerMonth: "4",\n        defaultCommission: "0",\n        createAccount: false`);

content = content.split(`shiftEndTime: staff.shiftEndTime || "17:00",\n      defaultCommission: (staff.defaultCommission || 0).toString(),`).join(`shiftEndTime: staff.shiftEndTime || "17:00",\n      allowedLeavesPerMonth: (staff.allowedLeavesPerMonth ?? 4).toString(),\n      defaultCommission: (staff.defaultCommission || 0).toString(),`);

content = content.split(`shiftEndTime: staffForm.shiftEndTime,\n        defaultCommission: parseFloat(staffForm.defaultCommission) || 0,`).join(`shiftEndTime: staffForm.shiftEndTime,\n        allowedLeavesPerMonth: parseInt(staffForm.allowedLeavesPerMonth) || 0,\n        defaultCommission: parseFloat(staffForm.defaultCommission) || 0,`);

content = content.split(`accountService.getBillsByClinic(clinicId!, branchId || undefined),\n      ]);`).join(`accountService.getBillsByClinic(clinicId!, branchId || undefined),\n        hrService.getHolidays(clinicId!),\n      ]);`);

content = content.split(`setBills(billsData);\n    } catch`).join(`setBills(billsData);\n      setHolidays(holidaysData);\n    } catch`);

// Use regex where easy
content = content.replace(
  /const \[payrollForm, setPayrollForm\] = useState\(\{([\s\S]*?)\}\);/,
  `const [payrollForm, setPayrollForm] = useState<{\n    amount: number;\n    paymentMethod: string;\n    notes: string;\n    selectedMonths: string[];\n    paymentType: "regular" | "advance";\n  }>({\n    amount: 0,\n    paymentMethod: "Cash",\n    notes: "",\n    selectedMonths: [format(new Date(), "MMMM yyyy")],\n    paymentType: "regular",\n  });`
);

const helpers = `
  const getPreviouslyPaid = (months: string[]) => {
    if (!selectedStaff || !bills) return 0;
    return bills
      .filter((b) => b.category === "salary" && b.vendorName === selectedStaff.name)
      .filter((b) => months.some((m) => b.description?.includes(m)))
      .reduce((sum, b) => sum + b.paidAmount, 0);
  };

  const getLeaveDeductions = (months: string[]) => {
    if (!selectedStaff || !attendance) return 0;
    const allowedLeaves = selectedStaff.allowedLeavesPerMonth ?? 4;
    
    const absentDays = attendance.filter((a) => {
      const isAbsent = a.status === "absent";
      const isSelectedStaff = a.staffId === selectedStaff.id;
      const isSelectedMonth = months.includes(format(a.date, "MMMM yyyy"));
      const isHoliday = holidays.some(h => format(h.date, "yyyy-MM-dd") === format(a.date, "yyyy-MM-dd"));
      return isAbsent && isSelectedStaff && isSelectedMonth && !isHoliday;
    }).length;

    const totalAllowedLeaves = allowedLeaves * months.length;
    const unpaidLeaves = Math.max(0, absentDays - totalAllowedLeaves);
    
    const dailyWage = (selectedStaff.salary || 0) / 30;
    return Math.round(unpaidLeaves * dailyWage);
  };

  const calculateExpectedAmount = (months: string[], type: "regular" | "advance") => {
    if (type === "advance") return 0;
    const baseExpected = (selectedStaff?.salary || 0) * (months.length || 1);
    const previouslyPaid = getPreviouslyPaid(months);
    const leaveDeductions = getLeaveDeductions(months);
    return Math.max(0, baseExpected - previouslyPaid - leaveDeductions);
  };
`;

content = content.split(`const handleDisburseSalary = async () => {`).join(helpers + `\n  const handleDisburseSalary = async () => {`);

content = content.replace(
  /const expectedTotal =\n        \(selectedStaff\.salary \|\| 0\) \* \(payrollForm\.selectedMonths\.length \|\| 1\);\n      const paidAmount = Number\(payrollForm\.amount\);/,
  `const expectedTotal = calculateExpectedAmount(payrollForm.selectedMonths, payrollForm.paymentType);\n      const paidAmount = Number(payrollForm.amount);`
);

content = content.replace(
  /let paymentStatus: "paid" \| "partial" \| "pending" = "paid";\n      if \(dueAmount > 0\) paymentStatus = "partial";\n\n      const bill: Omit<AccountBill, "id" \| "createdAt" \| "updatedAt"> = \{/,
  `let paymentStatus: "paid" | "partial" | "pending" = "paid";\n      if (dueAmount > 0) paymentStatus = "partial";\n\n      let description = \`Salary for \${payrollForm.selectedMonths.join(", ")}. \${payrollForm.notes}\`;\n      if (dueAmount < 0) {\n        description = \`[Advance/Bonus] \` + description;\n      } else if (dueAmount > 0) {\n        description = \`[Partial Payment] \` + description;\n      }\n\n      const bill: Omit<AccountBill, "id" | "createdAt" | "updatedAt"> = {`
);

content = content.replace(
  /description: `Salary for \$\{payrollForm\.selectedMonths\.join\(\n          ", ",\n        \)\}\. \$\{payrollForm\.notes\}`/g,
  `description: description`
);

content = content.replace(
  /Add Staff Member\n        <\/Button>\n      <\/div>/g,
  `Add Staff Member\n        </Button>\n        <Button className="font-semibold shadow-sm ml-2 bg-white border border-mountain-200 text-mountain-700" radius="sm" startContent={<IoCalendarOutline />} onPress={() => setIsHolidaysModalOpen(true)}>\n          Manage Holidays\n        </Button>\n      </div>`
);

content = content.replace(
  /value=\{staffForm\.defaultCommission\}\n                    onChange=\{\(e\) =>\n                      setStaffForm\(\{\n                        \.\.\.staffForm,\n                        defaultCommission: e\.target\.value,\n                      \}\)\n                    \}\n                  \/>\n                <\/div>\n                <div className="col-span-6 md:col-span-2">/g,
  `value={staffForm.defaultCommission}\n                    onChange={(e) =>\n                      setStaffForm({\n                        ...staffForm,\n                        defaultCommission: e.target.value,\n                      })\n                    }\n                  />\n                </div>\n                <div className="col-span-6 md:col-span-2">\n                  <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">\n                    Paid Leaves / Mo\n                  </label>\n                  <Input\n                    placeholder="4"\n                    size="sm"\n                    type="number"\n                    value={staffForm.allowedLeavesPerMonth}\n                    onChange={(e) =>\n                      setStaffForm({\n                        ...staffForm,\n                        allowedLeavesPerMonth: e.target.value,\n                      })\n                    }\n                  />\n                </div>\n                <div className="col-span-6 md:col-span-2">`
);

content = content.replace(
  /<div>\n                    <label className="text-\[11px\] font-bold text-mountain-600 uppercase tracking-wider mb-2 block">\n                      Salary Month\(s\)\n                    <\/label>/g,
  `<Tabs\n                    selectedKey={payrollForm.paymentType}\n                    onSelectionChange={(key) => {\n                      const type = key as "regular" | "advance";\n                      setPayrollForm({\n                        ...payrollForm,\n                        paymentType: type,\n                        amount: calculateExpectedAmount(payrollForm.selectedMonths, type),\n                      });\n                    }}\n                    size="sm"\n                    className="mb-2"\n                    classNames={{\n                      tabList: "bg-mountain-50 border border-mountain-200",\n                      cursor: "bg-white shadow-sm",\n                      tab: "font-semibold text-mountain-600",\n                    }}\n                  >\n                    <Tab key="regular" title="Regular Salary" />\n                    <Tab key="advance" title="Advance Payment" />\n                  </Tabs>\n\n                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">\n                    <label className="text-[11px] font-bold text-mountain-600 uppercase tracking-wider mb-2 block">\n                      Salary Month(s)\n                    </label>`
);

content = content.replace(
  /amount: \(selectedStaff\?\.salary \|\| 0\) \* \(newSelected\.length \|\| 1\)/g,
  `amount: calculateExpectedAmount(newSelected, payrollForm.paymentType)`
);

content = content.replace(
  /<div className="flex justify-between text-\[12px\]">\n                        <span className="text-mountain-600">Months Selected:<\/span>\n                        <span className="font-semibold text-mountain-900">\{payrollForm\.selectedMonths\.length\}<\/span>\n                      <\/div>\n                      <div className="flex justify-between text-\[13px\] font-bold pt-2">\n                        <span className="text-mountain-900">Total Payout:<\/span>\n                        <span className="text-health-700">Rs\. \{payrollForm\.amount\.toLocaleString\(\)\}<\/span>\n                      <\/div>/g,
  `<div className="flex justify-between text-[12px]">\n                        <span className="text-mountain-600">Months Selected:</span>\n                        <span className="font-semibold text-mountain-900">{payrollForm.selectedMonths.length}</span>\n                      </div>\n                      <div className="flex justify-between text-[12px]">\n                        <span className="text-mountain-600">Expected Salary:</span>\n                        <span className="font-semibold text-mountain-900">\n                          Rs. {((selectedStaff?.salary || 0) * (payrollForm.selectedMonths.length || 1)).toLocaleString()}\n                        </span>\n                      </div>\n                      {getLeaveDeductions(payrollForm.selectedMonths) > 0 && (\n                        <div className="flex justify-between text-[12px] text-rose-600">\n                          <span>Leave Deductions:</span>\n                          <span className="font-semibold">\n                            - Rs. {getLeaveDeductions(payrollForm.selectedMonths).toLocaleString()}\n                          </span>\n                        </div>\n                      )}\n                      {getPreviouslyPaid(payrollForm.selectedMonths) > 0 && (\n                        <div className="flex justify-between text-[12px] text-health-600">\n                          <span>Previously Paid (Advance):</span>\n                          <span className="font-semibold">\n                            - Rs. {getPreviouslyPaid(payrollForm.selectedMonths).toLocaleString()}\n                          </span>\n                        </div>\n                      )}\n                      <div className="flex justify-between text-[13px] font-bold pt-2">\n                        <span className="text-mountain-900">Due Amount:</span>\n                        <span className="text-amber-600">Rs. {calculateExpectedAmount(payrollForm.selectedMonths, "regular").toLocaleString()}</span>\n                      </div>\n                      <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-mountain-200">\n                        <span className="text-mountain-900">Total Payout:</span>\n                        <span className="text-health-700">Rs. {payrollForm.amount.toLocaleString()}</span>\n                      </div>`
);

const holidaysModal = `
      {/* Yearly Holidays Modal */}
      <Modal
        classNames={{
          wrapper: "z-[10000]",
          backdrop: "z-[9999]",
          base: "bg-white border border-mountain-200 shadow-xl",
        }}
        isOpen={isHolidaysModalOpen}
        onClose={() => setIsHolidaysModalOpen(false)}
        size="md"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 border-b border-mountain-100 pb-3">
            <h2 className="text-[16px] font-bold text-mountain-900 leading-tight">
              Manage Yearly Holidays
            </h2>
            <p className="text-[12px] text-mountain-500 font-medium">
              Staff absences on these dates won't deduct from their salary
            </p>
          </ModalHeader>
          <ModalBody className="py-4">
            <div className="flex gap-2 items-end mb-4">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-mountain-600 uppercase tracking-wider mb-1 block">
                  Holiday Name
                </label>
                <Input
                  size="sm"
                  placeholder="e.g. Dashain"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                />
              </div>
              <div className="w-[140px]">
                <label className="text-[11px] font-bold text-mountain-600 uppercase tracking-wider mb-1 block">
                  Date
                </label>
                <Input
                  size="sm"
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                />
              </div>
              <Button
                color="primary"
                className="font-semibold"
                onPress={async () => {
                  if (!newHoliday.name || !newHoliday.date || !clinicId) return;
                  try {
                    setSaving(true);
                    await hrService.addHoliday(clinicId, newHoliday.name, new Date(newHoliday.date));
                    setNewHoliday({ name: "", date: format(new Date(), "yyyy-MM-dd") });
                    const updated = await hrService.getHolidays(clinicId);
                    setHolidays(updated);
                  } catch (e) {
                    console.error("Error adding holiday:", e);
                  } finally {
                    setSaving(false);
                  }
                }}
                isLoading={saving}
              >
                Add
              </Button>
            </div>

            <div className="border border-mountain-200 rounded-lg overflow-hidden bg-mountain-50">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-mountain-100 border-b border-mountain-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-mountain-700">Date</th>
                    <th className="px-3 py-2 font-semibold text-mountain-700">Holiday</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mountain-100 bg-white">
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-mountain-400">
                        No holidays added yet.
                      </td>
                    </tr>
                  ) : (
                    holidays
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((holiday) => (
                      <tr key={holiday.id} className="hover:bg-mountain-50 transition-colors">
                        <td className="px-3 py-2 font-medium text-mountain-900">
                          {format(holiday.date, "MMM dd, yyyy")}
                        </td>
                        <td className="px-3 py-2 text-mountain-600">
                          {holiday.name}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            className="p-1.5 text-mountain-400 hover:text-danger hover:bg-danger-50 rounded-md transition-colors"
                            onClick={async () => {
                              if (!holiday.id || !clinicId) return;
                              try {
                                await hrService.deleteHoliday(holiday.id);
                                const updated = await hrService.getHolidays(clinicId);
                                setHolidays(updated);
                              } catch (e) {
                                console.error("Error deleting holiday:", e);
                              }
                            }}
                          >
                            <IoTrashOutline size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="font-semibold text-mountain-700 bg-white border border-mountain-200"
              onPress={() => setIsHolidaysModalOpen(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </div>
  );
`;

content = content.replace(/    <\/div>\n  \);\n\}\n/g, holidaysModal + "\n}\n");
content = content.replace(/    <\/div>\n  \);\n\}/g, holidaysModal + "\n}");

fs.writeFileSync(filePath, content);
console.log("Fixes applied successfully.");
