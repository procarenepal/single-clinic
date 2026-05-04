/**
 * PatientContactTab — Clinic Clarity, zero HeroUI
 * Replaced: Card, CardBody, CardHeader, Button, Chip, Divider, Input, Modal,
 *           ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, addToast (heroui)
 */
import { useState } from "react";
import {
  IoPeopleOutline,
  IoCallOutline,
  IoMailOutline,
  IoLocationOutline,
  IoPersonOutline,
  IoAddOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoShieldCheckmarkOutline,
  IoBusinessOutline,
  IoIdCardOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Patient } from "@/types/models";

interface PatientContactTabProps {
  patient: Patient;
}

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
  isPrimary: boolean;
}

interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber?: string;
  expiryDate?: Date;
  status: "active" | "inactive" | "expired";
}

// ── Shared card ───────────────────────────────────────────────────────────────
function InfoCard({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border-base rounded overflow-hidden h-full">
      <div className="flex items-center justify-between px-3 py-2.5 bg-surface-2 border-b border-border-base/50">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h3 className="text-[13px] font-semibold text-text-main">
            {title}
          </h3>
        </div>
        {action}
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  if (!value) return null;

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-primary shrink-0">{icon}</span>
      <div>
        <p className="text-[10.5px] text-text-muted font-medium uppercase tracking-[0.05em]">
          {label}
        </p>
        <p className="text-[12.5px] text-text-main font-medium">{value}</p>
      </div>
    </div>
  );
}

// ── Insurance status badge ────────────────────────────────────────────────────
const INS_BADGE: Record<string, string> = {
  active: "bg-health-100 text-health-700 border-health-200",
  inactive: "bg-saffron-100 text-saffron-700 border-saffron-200",
  expired: "bg-red-100 text-red-700 border-red-200",
};

// ── Add contact modal ─────────────────────────────────────────────────────────
function AddContactModal({
  onAdd,
  onClose,
}: {
  onAdd: (c: Omit<EmergencyContact, "id">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    relationship: "",
    phone: "",
    email: "",
    address: "",
    isPrimary: false,
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const valid = !!(form.name && form.relationship && form.phone);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-hidden">
      <div className="bg-surface dark:bg-surface-2 border border-border-base rounded w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-base/50">
          <h3 className="text-[14px] font-semibold text-text-main">
            Add Emergency Contact
          </h3>
          <button
            className="text-text-muted/60 hover:text-text-main"
            type="button"
            onClick={onClose}
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { k: "name", label: "Full Name *", ph: "Enter full name" },
            {
              k: "relationship",
              label: "Relationship *",
              ph: "e.g. Spouse, Father",
            },
            { k: "phone", label: "Phone *", ph: "Enter phone number" },
            { k: "email", label: "Email", ph: "Enter email" },
          ].map((f) => (
            <div key={f.k} className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-text-main">
                {f.label}
              </label>
              <input
                className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted/40"
                placeholder={f.ph}
                type="text"
                value={(form as any)[f.k]}
                onChange={set(f.k)}
              />
            </div>
          ))}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[12px] font-medium text-text-main">
              Address
            </label>
            <input
              className="h-9 px-2.5 text-[12.5px] border border-border-base rounded bg-surface text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted/40"
              placeholder="Enter address"
              type="text"
              value={form.address}
              onChange={set("address")}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
            <input
              checked={form.isPrimary}
              className="w-3.5 h-3.5 accent-primary rounded"
              type="checkbox"
              onChange={(e) =>
                setForm((p) => ({ ...p, isPrimary: e.target.checked }))
              }
            />
            <span className="text-[12.5px] text-text-main">
              Set as primary emergency contact
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <Button
            color="default"
            size="sm"
            variant="bordered"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={!valid}
            size="sm"
            onClick={() => valid && onAdd(form)}
          >
            Add Contact
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PatientContactTab({ patient }: PatientContactTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContact[]
  >([
    {
      id: "1",
      name: "Jane Doe",
      relationship: "Spouse",
      phone: "+977-9841234567",
      email: "jane.doe@email.com",
      address: "Kathmandu, Nepal",
      isPrimary: true,
    },
    {
      id: "2",
      name: "John Doe Sr.",
      relationship: "Father",
      phone: "+977-9851234567",
      isPrimary: false,
    },
  ]);

  const [insuranceInfo] = useState<InsuranceInfo>({
    provider: "Nepal Health Insurance",
    policyNumber: "NHI-2024-001234",
    groupNumber: "GRP-456",
    expiryDate: new Date("2025-12-31"),
    status: "active",
  });

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const handleAdd = (c: Omit<EmergencyContact, "id">) => {
    let contacts = emergencyContacts;

    if (c.isPrimary)
      contacts = contacts.map((x) => ({ ...x, isPrimary: false }));
    setEmergencyContacts([...contacts, { id: Date.now().toString(), ...c }]);
    setShowAddModal(false);
    addToast({ title: "Contact added", color: "success" });
  };

  const handleDelete = (id: string) => {
    setEmergencyContacts((p) => p.filter((c) => c.id !== id));
    addToast({ title: "Contact removed", color: "success" });
  };

  const setPrimary = (id: string) => {
    setEmergencyContacts((p) =>
      p.map((c) => ({ ...c, isPrimary: c.id === id })),
    );
    addToast({ title: "Primary contact updated", color: "success" });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Primary + Insurance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Primary Contact */}
        <InfoCard
          icon={<IoPersonOutline className="w-4 h-4" />}
          title="Primary Contact Information"
        >
          <ContactRow
            icon={<IoCallOutline className="w-3.5 h-3.5" />}
            label="Mobile"
            value={patient.mobile}
          />
          <ContactRow
            icon={<IoMailOutline className="w-3.5 h-3.5" />}
            label="Email"
            value={patient.email}
          />
          <ContactRow
            icon={<IoLocationOutline className="w-3.5 h-3.5" />}
            label="Address"
            value={patient.address}
          />
          <ContactRow
            icon={<IoIdCardOutline className="w-3.5 h-3.5" />}
            label="Reg. Number"
            value={patient.regNumber}
          />
        </InfoCard>

        {/* Insurance */}
        <InfoCard
          action={
            <Button
              color="default"
              size="sm"
              startContent={<IoCreateOutline className="w-3 h-3" />}
              variant="bordered"
            >
              Edit
            </Button>
          }
          icon={<IoShieldCheckmarkOutline className="w-4 h-4" />}
          title="Insurance Information"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <p className="text-[10.5px] text-text-muted uppercase tracking-wider">
                Provider
              </p>
              <p className="text-[12.5px] font-medium text-text-main">
                {insuranceInfo.provider}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] text-text-muted uppercase tracking-wider">
                Policy No.
              </p>
              <p className="text-[12.5px] font-medium text-text-main">
                {insuranceInfo.policyNumber}
              </p>
            </div>
            {insuranceInfo.groupNumber && (
              <div>
                <p className="text-[10.5px] text-text-muted uppercase tracking-wider">
                  Group No.
                </p>
                <p className="text-[12.5px] font-medium text-text-main">
                  {insuranceInfo.groupNumber}
                </p>
              </div>
            )}
            <div>
              <p className="text-[10.5px] text-text-muted uppercase tracking-wider">
                Status
              </p>
              <span
                className={`text-[10.5px] font-semibold px-2 py-0.5 rounded border capitalize ${INS_BADGE[insuranceInfo.status] || "bg-surface-2 text-text-muted border-border-base"}`}
              >
                {insuranceInfo.status}
              </span>
            </div>
            {insuranceInfo.expiryDate && (
              <div>
                <p className="text-[10.5px] text-text-muted uppercase tracking-wider">
                  Expires
                </p>
                <p className="text-[12.5px] font-medium text-text-main">
                  {fmtDate(insuranceInfo.expiryDate)}
                </p>
              </div>
            )}
          </div>
        </InfoCard>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-surface border border-border-base rounded overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 bg-surface-2 border-b border-border-base/50">
          <div className="flex items-center gap-2">
            <IoPeopleOutline className="w-4 h-4 text-primary" />
            <h3 className="text-[13px] font-semibold text-text-main">
              Emergency Contacts
            </h3>
          </div>
          <Button
            color="primary"
            size="sm"
            startContent={<IoAddOutline className="w-3.5 h-3.5" />}
            onClick={() => setShowAddModal(true)}
          >
            Add Contact
          </Button>
        </div>

        <div className="p-3">
          {emergencyContacts.length === 0 ? (
            <div className="py-10 text-center">
              <IoPeopleOutline className="mx-auto w-10 h-10 text-text-muted/30 mb-3" />
              <p className="text-[13px] font-medium text-text-main mb-1">
                No emergency contacts
              </p>
              <p className="text-[12px] text-text-muted mb-3">
                Add emergency contacts for this patient.
              </p>
              <Button
                color="primary"
                size="sm"
                startContent={<IoAddOutline className="w-3.5 h-3.5" />}
                onClick={() => setShowAddModal(true)}
              >
                Add First Contact
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {emergencyContacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between border border-border-base/50 rounded p-3 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 border border-primary/20 rounded-full">
                      <IoPersonOutline className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-[13px] font-semibold text-text-main">
                          {c.name}
                        </h4>
                        {c.isPrimary && (
                          <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <p className="text-[11.5px] text-text-muted">
                          <span className="text-text-muted/60">
                            Relationship:{" "}
                          </span>
                          {c.relationship}
                        </p>
                        <p className="text-[11.5px] text-text-muted">
                          <span className="text-text-muted/60">Phone: </span>
                          {c.phone}
                        </p>
                        {c.email && (
                          <p className="text-[11.5px] text-text-muted">
                            <span className="text-text-muted/60">Email: </span>
                            {c.email}
                          </p>
                        )}
                        {c.address && (
                          <p className="text-[11.5px] text-text-muted">
                            <span className="text-text-muted/60">Address: </span>
                            {c.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {!c.isPrimary && (
                      <Button
                        color="default"
                        size="sm"
                        variant="bordered"
                        onClick={() => setPrimary(c.id)}
                      >
                        Set Primary
                      </Button>
                    )}
                    <Button
                      color="default"
                      size="sm"
                      startContent={<IoCreateOutline className="w-3 h-3" />}
                      variant="bordered"
                    >
                      Edit
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      startContent={<IoTrashOutline className="w-3 h-3" />}
                      variant="bordered"
                      onClick={() => handleDelete(c.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Workplace + Communication */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCard
          icon={<IoBusinessOutline className="w-4 h-4" />}
          title="Workplace Information"
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Occupation", "Software Engineer"],
              ["Company", "Tech Solutions Pvt. Ltd."],
              ["Work Phone", "+977-1-4567890"],
              ["Work Address", "Putalisadak, Kathmandu"],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-[10.5px] text-text-muted uppercase tracking-wider">
                  {l}
                </p>
                <p className="text-[12.5px] font-medium text-text-main">
                  {v}
                </p>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard
          icon={<IoMailOutline className="w-4 h-4" />}
          title="Communication Preferences"
        >
          <div className="space-y-3">
            <div>
              <p className="text-[10.5px] text-text-muted uppercase tracking-wider mb-1">
                Preferred Contact
              </p>
              <span className="text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">
                Mobile Phone
              </span>
            </div>
            <div>
              <p className="text-[10.5px] text-text-muted uppercase tracking-wider">
                Language
              </p>
              <p className="text-[12.5px] font-medium text-text-main">
                English, Nepali
              </p>
            </div>
            <div>
              <p className="text-[10.5px] text-text-muted uppercase tracking-wider">
                Best Time
              </p>
              <p className="text-[12.5px] font-medium text-text-main">
                9:00 AM – 5:00 PM (Weekdays)
              </p>
            </div>
            <div>
              <p className="text-[10.5px] text-text-muted uppercase tracking-wider mb-1.5">
                Notifications
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["Appointment Reminders", true],
                  ["Lab Results", true],
                  ["Marketing", false],
                ].map(([l, on]) => (
                  <span
                    key={String(l)}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border
                    ${on ? "bg-health-100 text-health-700 border-health-200" : "bg-surface-2 text-text-muted border-border-base"}`}
                  >
                    {String(l)}
                    {!on && " (off)"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </InfoCard>
      </div>

      {/* Add modal */}
      {showAddModal && (
        <AddContactModal
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
