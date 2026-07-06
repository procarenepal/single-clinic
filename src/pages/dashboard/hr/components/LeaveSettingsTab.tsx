import React, { useState, useEffect } from "react";
import { Button, Input, Card, CardBody, Switch } from "@heroui/react";
import { IoAddOutline, IoTrashOutline, IoPencilOutline } from "react-icons/io5";
import { leaveTypeService } from "@/services/leaveTypeService";
import { LeaveType } from "@/types/models";
import { useAuthContext } from "@/context/AuthContext";
import { addToast } from "@/components/ui/toast";

const COLORS = [
  "bg-red-500", "bg-blue-500", "bg-green-500",
  "bg-purple-500", "bg-orange-500", "bg-pink-500",
  "bg-teal-500", "bg-indigo-500", "bg-cyan-500"
];

export const LeaveSettingsTab: React.FC = () => {
  const { clinicId } = useAuthContext();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    id: "",
    name: "",
    defaultDays: "",
    color: COLORS[0],
    isPaid: true
  });

  useEffect(() => {
    if (clinicId) loadLeaveTypes();
  }, [clinicId]);

  const loadLeaveTypes = async () => {
    try {
      setLoading(true);
      const types = await leaveTypeService.getLeaveTypes(clinicId!);
      setLeaveTypes(types);
    } catch (e) {
      addToast({ title: "Error", description: "Failed to load leave types.", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.defaultDays) {
      addToast({ title: "Error", description: "Name and Days are required.", color: "warning" });
      return;
    }

    try {
      const data = {
        name: form.name,
        defaultDays: parseInt(form.defaultDays),
        color: form.color,
        isPaid: form.isPaid,
        clinicId: clinicId!
      };

      if (form.id) {
        await leaveTypeService.updateLeaveType(form.id, data);
        addToast({ title: "Updated", description: "Leave type updated.", color: "success" });
      } else {
        await leaveTypeService.addLeaveType(data);
        addToast({ title: "Added", description: "Leave type created.", color: "success" });
      }

      setForm({ id: "", name: "", defaultDays: "", color: COLORS[0], isPaid: true });
      loadLeaveTypes();
    } catch (e) {
      addToast({ title: "Error", description: "Failed to save leave type.", color: "danger" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave type?")) return;
    try {
      await leaveTypeService.deleteLeaveType(id);
      addToast({ title: "Deleted", description: "Leave type deleted.", color: "success" });
      loadLeaveTypes();
    } catch (e) {
      addToast({ title: "Error", description: "Failed to delete.", color: "danger" });
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="w-full space-y-6 pb-20">

      {/* ADD / EDIT Section */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardBody className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[15px] font-bold text-gray-800">
              {form.id ? "Edit Leave Type" : "Add Leave Type"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block flex items-center gap-1">
                🏷️ Leave Name
              </label>
              <Input
                size="sm"
                placeholder="e.g. Vacation"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block flex items-center gap-1">
                📅 Days
              </label>
              <Input
                size="sm"
                type="number"
                placeholder="e.g. 20"
                value={form.defaultDays}
                onChange={e => setForm(prev => ({ ...prev, defaultDays: e.target.value }))}
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block flex items-center gap-1">
                🎨 Color
              </label>
              <div className="flex items-center gap-1.5 p-1 border border-default-200 rounded-lg h-10 overflow-x-auto bg-gray-50">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, color: c }))}
                    className={`w-6 h-6 rounded-full shrink-0 ${c} ${form.color === c ? 'ring-2 ring-offset-2 ring-blue-500' : 'opacity-70 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
            <div className="md:col-span-2 flex items-center h-10">
              <Switch
                size="sm"
                isSelected={form.isPaid}
                onValueChange={(val) => setForm(prev => ({ ...prev, isPaid: val }))}
              >
                <span className="text-[12px] font-semibold text-gray-700">Paid Leave</span>
              </Switch>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button
                color="primary"
                size="sm"
                className="w-full font-bold h-10"
                startContent={<IoAddOutline />}
                onPress={handleSave}
              >
                {form.id ? "Save" : "Add leave"}
              </Button>
              {form.id && (
                <Button
                  color="danger"
                  variant="flat"
                  size="sm"
                  isIconOnly
                  className="h-10 w-10 shrink-0"
                  onPress={() => setForm({ id: "", name: "", defaultDays: "", color: COLORS[0], isPaid: true })}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* LIST Section */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">📄</span>
            <h3 className="font-bold text-gray-800 text-[14px]">Leave types</h3>
          </div>
          <span className="text-xs font-bold text-gray-400">{leaveTypes.length} types</span>
        </div>

        <div className="divide-y divide-gray-100">
          {leaveTypes.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No leave types found.</div>
          ) : (
            leaveTypes.map(type => (
              <div key={type.id} className="flex items-center justify-between p-4 px-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${type.color}`} />
                  <span className="font-bold text-gray-800 text-[13px]">{type.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold">
                    {type.defaultDays}.0 days
                  </span>
                  {!type.isPaid && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[11px] font-bold">
                      Unpaid
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={() => setForm({
                      id: type.id,
                      name: type.name,
                      defaultDays: type.defaultDays.toString(),
                      color: type.color,
                      isPaid: type.isPaid !== false // default to true if undefined
                    })}
                  >
                    <IoPencilOutline className="text-gray-600" />
                  </Button>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    color="danger"
                    onPress={() => handleDelete(type.id)}
                  >
                    <IoTrashOutline />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
