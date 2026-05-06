import React, { useState, useEffect } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoPeopleOutline,
  IoCalendarOutline,
  IoWalletOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoEllipsisHorizontal,
  IoMailOutline,
  IoCallOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { hrService } from "@/services/hrService";
import { accountService } from "@/services/accountService";
import { StaffMember, StaffAttendance, AccountBill } from "@/types/models";
import { format, subDays, startOfDay } from "date-fns";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Card, CardBody } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { FileUploadComponent } from "@/components/FileUploadComponent";

import { Tabs, Tab } from "@heroui/tabs";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";

export default function HRPage() {
  const { clinicId, userData, branchId } = useAuthContext();
  const [activeTab, setActiveTab] = useState("directory");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [bills, setBills] = useState<AccountBill[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    amount: 0,
    paymentMethod: "Cash",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staffForm, setStaffForm] = useState({
    name: "",
    role: "Staff",
    age: "",
    email: "",
    phone: "",
    salary: "",
    joiningDate: format(new Date(), "yyyy-MM-dd"),
    status: "active" as StaffMember["status"],
    address: "",
    photoUrl: "",
  });

  useEffect(() => {
    if (!isStaffModalOpen) {
      setStaffForm({
        name: "",
        role: "Staff",
        age: "",
        email: "",
        phone: "",
        salary: "",
        joiningDate: format(new Date(), "yyyy-MM-dd"),
        status: "active",
        address: "",
        photoUrl: "",
      });
    }
  }, [isStaffModalOpen]);

  useEffect(() => {
    if (clinicId) {
      loadData();
    }
  }, [clinicId, branchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = subDays(new Date(), 30);
      const [staffData, attendanceData, billsData] = await Promise.all([
        hrService.getStaffByClinic(clinicId!, branchId || undefined),
        hrService.getAttendanceByRange(clinicId!, startOfDay(thirtyDaysAgo), new Date(), branchId || undefined),
        accountService.getBillsByClinic(clinicId!, branchId || undefined),
      ]);
      setStaff(staffData);
      setAttendance(attendanceData);
      setBills(billsData);
    } catch (error) {
      console.error("Error loading HR data:", error);
      addToast({ title: "Error", description: "Failed to load staff records", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name || !staffForm.role || !staffForm.salary) {
      addToast({ title: "Validation Error", description: "Please fill in all required fields", color: "warning" });
      return;
    }

    setSaving(true);
    try {
      await hrService.createStaff({
        ...staffForm,
        age: parseInt(staffForm.age) || 0,
        salary: parseFloat(staffForm.salary),
        joiningDate: new Date(staffForm.joiningDate),
        clinicId: clinicId!,
        branchId: branchId || "",
        createdBy: userData?.id || "",
      });

      addToast({ title: "Success", description: "Staff member registered successfully", color: "success" });
      setIsStaffModalOpen(false);
      loadData();
      setStaffForm({
        name: "",
        role: "Staff",
        age: "",
        email: "",
        phone: "",
        salary: "",
        joiningDate: format(new Date(), "yyyy-MM-dd"),
        status: "active",
        address: "",
        photoUrl: "",
      });
    } catch (error) {
      console.error("Error saving staff:", error);
      addToast({ title: "Error", description: "Failed to save staff record", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisburseSalary = async () => {
    if (!selectedStaff) return;
    try {
      const bill: Omit<AccountBill, "id" | "createdAt" | "updatedAt"> = {
        category: "salary",
        vendorName: selectedStaff.name,
        billNumber: `PAY-${Date.now().toString().slice(-6)}`,
        billDate: new Date(),
        totalAmount: Number(payrollForm.amount),
        paidAmount: Number(payrollForm.amount),
        dueAmount: 0,
        paymentStatus: "paid",
        paymentMethod: payrollForm.paymentMethod,
        description: `Salary for ${format(new Date(), 'MMMM yyyy')}. ${payrollForm.notes}`,
        clinicId: clinicId!,
        branchId: branchId || "",
        createdBy: userData?.id || "",
      };
      await accountService.createBill(bill);
      addToast({ title: "Success", description: "Salary disbursed successfully", color: "success" });
      setIsPayModalOpen(false);
      loadData(); // Refresh bills
    } catch (error) {
      console.error("Failed to disburse salary:", error);
      addToast({ title: "Error", description: "Failed to disburse salary", color: "danger" });
    }
  };

  const handleClockOut = async (member: StaffMember) => {
    try {
      const activeAttendance = attendance.find(a => a.staffId === member.id && a.status === 'present');
      if (!activeAttendance) return;

      await hrService.updateAttendance(activeAttendance.id, {
        checkOut: new Date(),
        status: "absent", // Mark as out for the day
      });
      loadData();
      addToast({ title: "Clocked Out", description: `${member.name} has clocked out`, color: "success" });
    } catch (error) {
      console.error("Failed to clock out:", error);
      addToast({ title: "Error", description: "Failed to clock out", color: "danger" });
    }
  };

  const markPresent = async (member: StaffMember) => {
    if (!clinicId) {
      addToast({ title: "Error", description: "Clinic ID missing. Please refresh.", color: "danger" });
      return;
    }

    try {
      await hrService.markAttendance({
        staffId: member.id,
        staffName: member.name,
        date: new Date(),
        checkIn: new Date(),
        checkOut: null,
        status: "present",
        clinicId: clinicId,
        branchId: branchId || "",
      });
      loadData();
      addToast({ title: "Attendance Marked", description: `${member.name} marked as present`, color: "success" });
    } catch (error) {
      console.error("Failed to mark attendance:", error);
      addToast({ title: "Error", description: "Failed to mark attendance", color: "danger" });
    }
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: staff.length,
    present: attendance.filter(a => a.status === 'present').length,
    payroll: staff.reduce((acc, s) => acc + s.salary, 0),
  };

  const formatDuration = (start: Date | null, end: Date | null) => {
    if (!start || !end) return "---";
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[15.5px] font-semibold text-primary tracking-tight">HR Management</h1>
          <p className="text-[10.5px] text-[rgb(var(--color-text-muted))] font-medium">Manage records, attendance, and payroll.</p>
        </div>
        <Button 
          color="primary" 
          startContent={<IoAddOutline />} 
          onPress={() => setIsStaffModalOpen(true)}
          className="font-semibold h-7 px-3 text-[11px]"
          radius="sm"
        >
          Add Staff Member
        </Button>
      </div>

      {/* HR Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]" shadow="none">
          <CardBody className="p-3 flex flex-row items-center justify-between">
            <div>
              <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">Total Staff</p>
              <h3 className="text-[16px] font-semibold text-[rgb(var(--color-text))] tracking-tight">{stats.total} Members</h3>
              <div className="mt-1">
                <span className="text-[8.5px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 tracking-wider">Directory</span>
              </div>
            </div>
            <IoPeopleOutline className="text-[28px] text-[rgb(var(--color-text-muted))] opacity-10" />
          </CardBody>
        </Card>

        <Card className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]" shadow="none">
          <CardBody className="p-3 flex flex-row items-center justify-between">
            <div>
              <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">Present Today</p>
              <h3 className="text-[16px] font-semibold text-primary tracking-tight">{stats.present} Active</h3>
              <p className="text-[8.5px] text-[rgb(var(--color-text-muted))] mt-1 font-semibold flex items-center gap-1 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
                Real-time
              </p>
            </div>
            <IoCheckmarkCircleOutline className="text-[28px] text-[rgb(var(--color-text-muted))] opacity-10" />
          </CardBody>
        </Card>

        <Card className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]" shadow="none">
          <CardBody className="p-3 flex flex-row items-center justify-between">
            <div>
              <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">Monthly Payroll</p>
              <h3 className="text-[16px] font-semibold text-[rgb(var(--color-text))] tracking-tight">Rs. {stats.payroll.toLocaleString()}</h3>
              <div className="mt-1">
                <span className="text-[8.5px] font-semibold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 tracking-wider">Liability</span>
              </div>
            </div>
            <IoWalletOutline className="text-[28px] text-[rgb(var(--color-text-muted))] opacity-10" />
          </CardBody>
        </Card>
      </div>

      {/* Tab Selection */}
      <div className="mb-6">
        <Tabs 
          selectedKey={activeTab} 
          onSelectionChange={(key) => setActiveTab(key as string)}
          variant="underlined"
          classNames={{
            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-[rgb(var(--color-border))]",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-0 h-12",
            tabContent: "group-data-[selected=true]:text-primary font-semibold text-[14px]"
          }}
        >
          <Tab 
            key="directory" 
            title={
              <div className="flex items-center gap-2">
                <IoPeopleOutline size={18} />
                <span>Staff Directory</span>
              </div>
            }
          />
          <Tab 
            key="attendance" 
            title={
              <div className="flex items-center gap-2">
                <IoTimeOutline size={18} />
                <span>Attendance Logs</span>
              </div>
            }
          />
        </Tabs>
      </div>

      {activeTab === "directory" ? (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[rgb(var(--color-surface-2))/0.3] p-4 rounded-xl border border-[rgb(var(--color-border))]">
            <div className="relative w-full md:w-96">
              <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, role or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Staff Registry Table */}
          <div className="mt-4">
            {loading ? (
              <div className="py-20 text-center">
                <Spinner label="Loading staff registry..." />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-[rgb(var(--color-border))] rounded-xl grayscale opacity-50">
                <IoPeopleOutline className="w-12 h-12 mx-auto mb-2" />
                <p className="text-[14px] font-bold">No staff records found</p>
              </div>
            ) : (
              <Card className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]" shadow="none">
                <Table 
                  aria-label="Staff registry"
                  shadow="none"
                  classNames={{
                    th: "bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] font-semibold text-[11px]",
                    td: "text-[13px] py-3 border-b border-[rgb(var(--color-border))]/50",
                  }}
                >
                  <TableHeader>
                    <TableColumn>Staff Member</TableColumn>
                    <TableColumn>Contact Details</TableColumn>
                    <TableColumn>Monthly Salary</TableColumn>
                    <TableColumn>Joining Date</TableColumn>
                    <TableColumn>Current Status</TableColumn>
                    <TableColumn align="center">Actions</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((member) => {
                      const isPresent = attendance.some(a => a.staffId === member.id && a.status === 'present' && format(a.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));
                      return (
                        <TableRow key={member.id} className="hover:bg-[rgb(var(--color-surface-2))/0.3] transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] flex items-center justify-center overflow-hidden shrink-0">
                                {member.photoUrl ? (
                                  <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[14px] font-black text-primary/40">{member.name.charAt(0)}</span>
                                )}
                              </div>
                              <div className="cursor-pointer group" onClick={() => { setSelectedStaff(member); setIsDetailModalOpen(true); }}>
                                <h3 className="text-[14px] font-semibold text-[rgb(var(--color-text))] group-hover:text-primary transition-colors">{member.name}</h3>
                                <p className="text-[10px] font-semibold text-primary tracking-tighter">{member.role}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--color-text))] font-medium">
                                <IoCallOutline className="w-3 h-3 text-[rgb(var(--color-text-muted))]" />
                                {member.phone}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--color-text-muted))]">
                                <IoMailOutline className="w-3 h-3" />
                                {member.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-semibold text-[rgb(var(--color-text))]">
                              <IoWalletOutline className="w-3.5 h-3.5 text-primary" />
                              Rs. {member.salary.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-[12px] text-[rgb(var(--color-text-muted))]">
                              <IoCalendarOutline className="w-3.5 h-3.5" />
                              {format(new Date(member.joiningDate), 'MMM dd, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border tracking-wider ${isPresent ? 'bg-success/10 text-success border-success/20' : 'bg-default-100 text-default-400 border-default-200'}`}>
                              {isPresent ? 'On duty' : 'Off duty'}
                            </span>
                          </TableCell>
                          <TableCell align="center">
                            <Button 
                              size="sm" 
                              color={isPresent ? "danger" : "primary"}
                              variant="flat"
                              className="font-semibold text-[10px] h-7 px-3"
                              onPress={() => isPresent ? handleClockOut(member) : markPresent(member)}
                            >
                              {isPresent ? "Clock Out" : "Mark Present"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </>
      ) : (
        <Card className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]" shadow="none">
          <Table 
            aria-label="Attendance logs"
            classNames={{
              th: "bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] font-semibold text-[11px]",
              td: "text-[13px] py-4 border-b border-[rgb(var(--color-border))]/50",
            }}
          >
            <TableHeader>
              <TableColumn>Staff Member</TableColumn>
              <TableColumn>Date</TableColumn>
              <TableColumn>Check In</TableColumn>
              <TableColumn>Check Out</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn align="center">Duration</TableColumn>
            </TableHeader>
            <TableBody emptyContent={"No attendance records found."}>
              {attendance.sort((a, b) => b.date.getTime() - a.date.getTime()).map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="font-semibold">{record.staffName}</div>
                  </TableCell>
                  <TableCell>{format(record.date, 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-success font-semibold">
                      <IoTimeOutline size={14} />
                      {record.checkIn ? format(record.checkIn, 'hh:mm a') : '---'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-rose-500 font-semibold">
                      <IoTimeOutline size={14} />
                      {record.checkOut ? format(record.checkOut, 'hh:mm a') : 'Still In'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${record.status === 'present' ? 'bg-success/10 text-success' : 'bg-default-100 text-default-400'}`}>
                      {record.status === 'present' ? 'On Duty' : 'Completed'}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <div className="font-semibold text-primary whitespace-nowrap">
                      {formatDuration(record.checkIn, record.checkOut)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Staff Modal */}
      <Modal 
        isOpen={isStaffModalOpen} 
        onOpenChange={setIsStaffModalOpen}
        size="2xl"
        scrollBehavior="outside"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
          header: "border-b border-[rgb(var(--color-border))] py-4 bg-[rgb(var(--color-surface))]",
          footer: "border-t border-[rgb(var(--color-border))] py-4 bg-[rgb(var(--color-surface))]",
          closeButton: "hover:bg-default-100 active:bg-default-200",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleSaveStaff}>
              <ModalHeader>
                <div className="flex flex-col">
                  <h2 className="text-[17px] font-semibold text-primary tracking-tight">Register new staff</h2>
                  <p className="text-[11.5px] text-[rgb(var(--color-text-muted))] font-medium">Add a new employee to your clinic's HR system.</p>
                </div>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-6 md:col-span-4">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Full Name</label>
                    <Input
                      placeholder="e.g. John Doe"
                      value={staffForm.name}
                      onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                      size="sm"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Job Role</label>
                    <Select
                      placeholder="Select role"
                      size="sm"
                      selectedKeys={[staffForm.role]}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;
                        setStaffForm({ ...staffForm, role: selectedKey });
                      }}
                    >
                      <SelectItem key="Doctor">Doctor</SelectItem>
                      <SelectItem key="Pharmacist">Pharmacist</SelectItem>
                      <SelectItem key="Nurse">Nurse</SelectItem>
                      <SelectItem key="Receptionist">Receptionist</SelectItem>
                      <SelectItem key="Lab Technician">Lab Technician</SelectItem>
                      <SelectItem key="Admin">Admin / Manager</SelectItem>
                      <SelectItem key="Staff">General Staff</SelectItem>
                    </Select>
                  </div>

                  <div className="col-span-6 md:col-span-1">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Age</label>
                    <Input
                      type="number"
                      placeholder="Age"
                      value={staffForm.age}
                      onChange={(e) => setStaffForm({ ...staffForm, age: e.target.value })}
                      size="sm"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Phone Number</label>
                    <Input
                      placeholder="Contact number"
                      value={staffForm.phone}
                      onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                      size="sm"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Email Address</label>
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                      size="sm"
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Monthly Salary (Rs.)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={staffForm.salary}
                      onChange={(e) => setStaffForm({ ...staffForm, salary: e.target.value })}
                      size="sm"
                      startContent={<span className="text-[12px] text-text-muted">Rs.</span>}
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Joining Date</label>
                    <Input
                      type="date"
                      value={staffForm.joiningDate}
                      onChange={(e) => setStaffForm({ ...staffForm, joiningDate: e.target.value })}
                      size="sm"
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Residential Address</label>
                    <Input
                      placeholder="Residential address"
                      value={staffForm.address}
                      onChange={(e) => setStaffForm({ ...staffForm, address: e.target.value })}
                      size="sm"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-wider mb-1.5 block">Staff Photo</label>
                    <FileUploadComponent 
                      uploadType="image"
                      onUploadComplete={(result) => setStaffForm({ ...staffForm, photoUrl: result.fileUrl })}
                      currentFile={staffForm.photoUrl ? { 
                        id: "", 
                        name: "Profile Photo", 
                        url: staffForm.photoUrl, 
                        type: "image/jpeg" 
                      } : undefined}
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} className="font-semibold text-[13px]">Cancel</Button>
                <Button color="primary" type="submit" isLoading={saving} className="font-semibold text-[13px] px-8">Register staff</Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
      {/* Staff Detail Modal */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onOpenChange={setIsDetailModalOpen}
        size="4xl"
        scrollBehavior="outside"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
          header: "border-b border-[rgb(var(--color-border))] py-4 bg-[rgb(var(--color-surface))]",
          footer: "border-t border-[rgb(var(--color-border))] py-4 bg-[rgb(var(--color-surface))]",
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] flex items-center justify-center overflow-hidden">
                    {selectedStaff?.photoUrl ? (
                      <img src={selectedStaff.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[24px] font-black text-primary/40">{selectedStaff?.name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-[18px] font-black text-[rgb(var(--color-text))] tracking-tight">{selectedStaff?.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20 uppercase tracking-widest">{selectedStaff?.role}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${selectedStaff?.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                        {selectedStaff?.status}
                      </span>
                    </div>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody className="py-6">
                {selectedStaff && (
                  <div className="space-y-6">
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1">Present Days</p>
                        <p className="text-[16px] font-black text-primary">{attendance.filter(a => a.staffId === selectedStaff.id && (a.status === 'present' || a.status === 'late')).length} Days</p>
                      </div>
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1">Absent Days</p>
                        <p className="text-[16px] font-black text-rose-500">{attendance.filter(a => a.staffId === selectedStaff.id && a.status === 'absent').length} Days</p>
                      </div>
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1">Total Paid</p>
                        <p className="text-[16px] font-black text-[rgb(var(--color-text))]">Rs. {bills.filter(b => b.category === 'salary' && b.vendorName === selectedStaff.name).reduce((acc, b) => acc + b.paidAmount, 0).toLocaleString()}</p>
                      </div>
                      <div className="p-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))/0.3]">
                        <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1">Current Salary</p>
                        <p className="text-[16px] font-black text-[rgb(var(--color-text))]">Rs. {selectedStaff.salary.toLocaleString()}</p>
                      </div>
                    </div>

                    <Tabs variant="underlined" classNames={{ tabList: "gap-6", tabContent: "font-bold text-[13px]" }}>
                      <Tab key="overview" title="Professional Overview">
                        <div className="grid grid-cols-2 gap-8 py-4">
                          <div className="space-y-4">
                            <h3 className="text-[11px] font-bold text-[rgb(var(--color-text))] uppercase tracking-wider border-b border-[rgb(var(--color-border))] pb-2">Contact Dossier</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-tighter">Direct Phone</p>
                                <p className="text-[13px] font-medium">{selectedStaff.phone}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-tighter">Email Address</p>
                                <p className="text-[13px] font-medium">{selectedStaff.email}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-tighter">Residential Address</p>
                                <p className="text-[13px] font-medium">{selectedStaff.address || 'Not documented'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-[11px] font-bold text-[rgb(var(--color-text))] uppercase tracking-wider border-b border-[rgb(var(--color-border))] pb-2">Employment Registry</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-tighter">Joining Date</p>
                                <p className="text-[13px] font-medium">{format(new Date(selectedStaff.joiningDate), 'MMM dd, yyyy')}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-tighter">Employee Age</p>
                                <p className="text-[13px] font-medium">{selectedStaff.age} Yrs</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-tighter">System ID</p>
                                <p className="text-[12px] font-mono">{selectedStaff.id.substring(0, 12)}...</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Tab>
                      <Tab key="attendance" title="Attendance History">
                        <div className="py-4">
                          <Table shadow="none" classNames={{ th: "text-[10px] uppercase", td: "text-[12px]" }}>
                            <TableHeader>
                              <TableColumn>Date</TableColumn>
                              <TableColumn>Check In</TableColumn>
                              <TableColumn>Check Out</TableColumn>
                              <TableColumn>Status</TableColumn>
                              <TableColumn align="center">Total Duration</TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No attendance records documented">
                              {attendance
                                .filter(a => a.staffId === selectedStaff.id)
                                .sort((a, b) => b.date.getTime() - a.date.getTime())
                                .map((record) => (
                                  <TableRow key={record.id}>
                                    <TableCell>{format(record.date, 'MMM dd, yyyy')}</TableCell>
                                    <TableCell>{record.checkIn ? format(record.checkIn, 'hh:mm a') : '---'}</TableCell>
                                    <TableCell>{record.checkOut ? format(record.checkOut, 'hh:mm a') : '---'}</TableCell>
                                    <TableCell>
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${record.status === 'present' ? 'bg-success/10 text-success' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {record.status}
                                      </span>
                                    </TableCell>
                                    <TableCell align="center" className="font-bold text-primary">{formatDuration(record.checkIn, record.checkOut)}</TableCell>
                                  </TableRow>
                                ))
                              }
                            </TableBody>
                          </Table>
                        </div>
                      </Tab>
                      <Tab key="payroll" title="Salary History">
                        <div className="py-4">
                          <Table shadow="none" classNames={{ th: "text-[10px] uppercase", td: "text-[12px]" }}>
                            <TableHeader>
                              <TableColumn>Bill #</TableColumn>
                              <TableColumn>Payment Date</TableColumn>
                              <TableColumn>Amount Paid</TableColumn>
                              <TableColumn>Method</TableColumn>
                              <TableColumn>Status</TableColumn>
                            </TableHeader>
                            <TableBody emptyContent="No salary payments found">
                              {bills
                                .filter(b => b.category === 'salary' && b.vendorName === selectedStaff.name)
                                .sort((a, b) => b.billDate.getTime() - a.billDate.getTime())
                                .map((bill) => (
                                  <TableRow key={bill.id}>
                                    <TableCell className="font-mono">{bill.billNumber}</TableCell>
                                    <TableCell>{format(bill.billDate, 'MMM dd, yyyy')}</TableCell>
                                    <TableCell className="font-bold text-success">Rs. {bill.paidAmount.toLocaleString()}</TableCell>
                                    <TableCell className="capitalize">{bill.paymentMethod || 'Cash'}</TableCell>
                                    <TableCell>
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-success/10 text-success">
                                        Paid
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))
                              }
                            </TableBody>
                          </Table>
                        </div>
                      </Tab>
                    </Tabs>
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="justify-between">
                <Button 
                  color="primary" 
                  className="font-bold"
                  onPress={() => {
                    setPayrollForm({ ...payrollForm, amount: selectedStaff.salary });
                    setIsPayModalOpen(true);
                  }}
                >
                  Pay Salary
                </Button>
                <Button color="danger" variant="flat" size="sm" className="font-bold" onPress={() => setIsDetailModalOpen(false)}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Salary Payment Modal */}
      <Modal 
        isOpen={isPayModalOpen} 
        onOpenChange={setIsPayModalOpen}
        size="md"
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <div className="flex flex-col">
                  <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))] tracking-tight">Confirm Payment</h2>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-normal">Recording salary for {selectedStaff?.name}</p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">Amount (Rs.)</label>
                    <Input
                      type="number"
                      value={payrollForm.amount.toString()}
                      onChange={(e) => setPayrollForm({ ...payrollForm, amount: Number(e.target.value) })}
                      size="sm"
                      startContent={<span className="text-[12px] text-text-muted">Rs.</span>}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">Payment Method</label>
                    <Select
                      size="sm"
                      selectedKeys={[payrollForm.paymentMethod]}
                      onSelectionChange={(keys) => setPayrollForm({ ...payrollForm, paymentMethod: Array.from(keys)[0] as string })}
                    >
                      <SelectItem key="Cash">Cash</SelectItem>
                      <SelectItem key="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem key="Cheque">Cheque</SelectItem>
                      <SelectItem key="E-Sewa">E-Sewa / Khalti</SelectItem>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest mb-1 block">Notes</label>
                    <Textarea
                      placeholder="e.g. Paid for May month including bonus"
                      value={payrollForm.notes}
                      onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
                      size="sm"
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" size="sm" className="font-bold" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" size="sm" className="font-bold" onPress={handleDisburseSalary}>
                  Confirm & Pay
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
