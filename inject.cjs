const fs = require('fs');
const p = 'src/pages/dashboard/hr/index.tsx';
let data = fs.readFileSync(p, 'utf8');

const target1 = `        <Button
          className="font-semibold h-7 px-3 text-[11px]"
          color="primary"
          radius="sm"
          startContent={<IoAddOutline />}
          onPress={() => setIsStaffModalOpen(true)}
        >
          Add Staff Member
        </Button>
      </div>`;

const rep1 = `        <div className="flex gap-2">
          <Button
            className="bg-white border border-mountain-200 text-mountain-700 font-medium h-7 px-3 text-[11px]"
            radius="sm"
            startContent={<IoCalendarOutline />}
            onPress={() => setIsHolidaysModalOpen(true)}
          >
            Manage Holidays
          </Button>
          <Button
            className="font-semibold h-7 px-3 text-[11px]"
            color="primary"
            radius="sm"
            startContent={<IoAddOutline />}
            onPress={() => setIsStaffModalOpen(true)}
          >
            Add Staff Member
          </Button>
        </div>
      </div>`;

data = data.replace(target1, rep1);

const target2 = `      </Modal>
    </div>
  );
}`;

const rep2 = `      </Modal>

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
}`;

data = data.replace(target2, rep2);

fs.writeFileSync(p, data);
console.log('done');
