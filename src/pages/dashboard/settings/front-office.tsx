/**
 * Settings › Front Office
 *
 * The clinic-level facts the front desk used to be asked for on every
 * visit, configured once: which catalogue type is "the consultation",
 * which is the default expert service, the rooms and cabins (replacing two
 * hardcoded lists), who may discount / override prices / remove lines /
 * skip triage / settle / refund / sell packages, and two behaviour
 * switches. Saved as the `frontOffice` block on the clinic's billing
 * settings; defaults apply wherever a field is unset.
 */
import { useEffect, useMemo, useState } from "react";
import {
  IoArrowBackOutline,
  IoAddOutline,
  IoTrashOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Checkbox,
  Spinner,
  Link,
} from "@/components/ui";
import { Select, SelectItem } from "@/components/ui/select";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { withFrontOfficeDefaults } from "@/services/core/frontOfficePermissionCore";
import { DEFAULT_ROOMS } from "@/services/core/catalogueFlagsCore";
import type {
  AppointmentType,
  FrontOfficeRoom,
  FrontOfficeSettings,
  UserRole,
} from "@/types/models";

const ROLES: Array<{ key: UserRole; label: string }> = [
  { key: "clinic-admin", label: "Clinic admin" },
  { key: "staff", label: "Front desk staff" },
  { key: "doctor", label: "Doctor" },
  { key: "expert", label: "Expert" },
  { key: "hr", label: "HR" },
];

const ROLE_LISTS: Array<{
  field: keyof Pick<
    FrontOfficeSettings,
    | "discountRoles"
    | "priceOverrideRoles"
    | "lineRemovalRoles"
    | "skipTriageRoles"
    | "settleRoles"
    | "refundRoles"
    | "sellPackageRoles"
  >;
  label: string;
  help: string;
}> = [
  {
    field: "settleRoles",
    label: "Settle and close a visit",
    help: "Files the one IRD invoice and takes the payment.",
  },
  {
    field: "discountRoles",
    label: "Give a discount",
    help: "On the check-in sheet and the settle sheet. Others see it read-only.",
  },
  {
    field: "priceOverrideRoles",
    label: "Override a catalogue price",
    help: "At settle only, reason required, logged on the line.",
  },
  {
    field: "lineRemovalRoles",
    label: "Remove a declined service",
    help: "At settle, reason required.",
  },
  {
    field: "skipTriageRoles",
    label: "Send to a cabin without triage",
    help: "Recorded on the visit.",
  },
  {
    field: "refundRoles",
    label: "Refund wallet credit in cash",
    help: "After a no-show or cancel; otherwise the money stays as credit.",
  },
  { field: "sellPackageRoles", label: "Sell a package", help: "" },
];

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `room-${Date.now()}`;

export default function FrontOfficeSettingsPage() {
  const { clinicId, currentUser } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [form, setForm] = useState<FrontOfficeSettings>(
    withFrontOfficeDefaults(null),
  );
  const [newRoom, setNewRoom] = useState("");
  const [newRoomExclusive, setNewRoomExclusive] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        setLoading(true);
        const [settings, catalogue] = await Promise.all([
          appointmentBillingService.getBillingSettings(clinicId),
          appointmentTypeService.getAppointmentTypes(clinicId),
        ]);
        const stored = withFrontOfficeDefaults(settings?.frontOffice);

        setTypes(catalogue.filter((t) => t.isActive !== false));
        // Propose the old hardcoded room list when none is configured yet;
        // nothing is written until Save.
        setForm(
          stored.rooms.length > 0
            ? stored
            : { ...stored, rooms: DEFAULT_ROOMS },
        );
      } catch (error) {
        console.error("Error loading front office settings:", error);
        addToast({
          title: "Error",
          description: "Could not load front office settings.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [clinicId]);

  const doctorPricedTypes = useMemo(
    () => types.filter((t) => t.pricedBy === "doctor"),
    [types],
  );

  const toggleRole = (
    field: (typeof ROLE_LISTS)[number]["field"],
    role: UserRole,
  ) => {
    setForm((prev) => {
      const list = prev[field];
      const next = list.includes(role)
        ? list.filter((r) => r !== role)
        : [...list, role];

      return { ...prev, [field]: next };
    });
  };

  const addRoom = () => {
    const name = newRoom.trim();

    if (!name) return;
    if (form.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      addToast({
        title: "Already listed",
        description: `"${name}" is already a room.`,
        color: "warning",
      });

      return;
    }
    const room: FrontOfficeRoom = {
      id: slug(name),
      name,
      isExclusive: newRoomExclusive,
    };

    setForm((prev) => ({ ...prev, rooms: [...prev.rooms, room] }));
    setNewRoom("");
  };

  const removeRoom = (id: string) =>
    setForm((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((r) => r.id !== id),
    }));

  const handleSave = async () => {
    if (!clinicId) return;
    if (!form.settleRoles.length) {
      addToast({
        title: "Nobody can settle",
        description:
          "At least one role must be able to settle and close a visit.",
        color: "warning",
      });

      return;
    }
    try {
      setSaving(true);
      await appointmentBillingService.updateFrontOfficeSettings(
        clinicId,
        form,
        currentUser?.uid || "system",
      );
      addToast({
        title: "Saved",
        description: "Front office settings updated.",
        color: "success",
      });
    } catch (error) {
      console.error("Error saving front office settings:", error);
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not save.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Front Office
          </h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            What the desk decides once instead of every visit: default services,
            rooms, who may do what.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/dashboard/settings">
            <Button startContent={<IoArrowBackOutline />} variant="light">
              Back to Settings
            </Button>
          </Link>
          <Button color="primary" isLoading={saving} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <h3 className="text-lg font-semibold">Default services</h3>
          <p className="text-xs text-text-muted">
            The intake sheet pre-selects these. They replace the old rule that
            matched a type by its name.
          </p>
        </CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Doctor consultation type"
            name="defaultConsultationTypeId"
            value={form.defaultConsultationTypeId || ""}
            variant="bordered"
            onChange={(e: any) =>
              setForm((p) => ({
                ...p,
                defaultConsultationTypeId: e.target.value || undefined,
              }))
            }
          >
            <SelectItem key="" value="">
              — none —
            </SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
                {t.pricedBy === "doctor"
                  ? " (priced by the doctor's charge)"
                  : ` (NPR ${t.price})`}
              </SelectItem>
            ))}
          </Select>
          <Select
            label="Default expert service"
            name="defaultExpertTypeId"
            value={form.defaultExpertTypeId || ""}
            variant="bordered"
            onChange={(e: any) =>
              setForm((p) => ({
                ...p,
                defaultExpertTypeId: e.target.value || undefined,
              }))
            }
          >
            <SelectItem key="" value="">
              — none —
            </SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} (NPR {t.price})
              </SelectItem>
            ))}
          </Select>
          {doctorPricedTypes.length > 0 && (
            <p className="md:col-span-2 text-xs text-text-muted">
              Priced by each doctor's consultation charge:{" "}
              {doctorPricedTypes.map((t) => t.name).join(", ")}. Every active
              doctor needs a charge set, or check-in for that type is refused.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <h3 className="text-lg font-semibold">Rooms and cabins</h3>
          <p className="text-xs text-text-muted">
            Exclusive rooms hold one patient at a time; the triage sheet warns
            when one is occupied.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="divide-y divide-border-base border border-border-base rounded">
            {form.rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="text-sm text-text-main">{room.name}</span>
                <div className="flex items-center gap-3">
                  <Checkbox
                    isSelected={room.isExclusive}
                    size="sm"
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        rooms: p.rooms.map((r) =>
                          r.id === room.id ? { ...r, isExclusive: v } : r,
                        ),
                      }))
                    }
                  >
                    One patient at a time
                  </Checkbox>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onClick={() => removeRoom(room.id)}
                  >
                    <IoTrashOutline />
                  </Button>
                </div>
              </div>
            ))}
            {form.rooms.length === 0 && (
              <p className="px-3 py-3 text-sm text-text-muted">No rooms yet.</p>
            )}
          </div>
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <Input
              label="Add a room"
              placeholder="e.g. OPD Room 4"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
            />
            <Checkbox
              isSelected={newRoomExclusive}
              size="sm"
              onValueChange={setNewRoomExclusive}
            >
              One patient at a time
            </Checkbox>
            <Button
              startContent={<IoAddOutline />}
              variant="flat"
              onClick={addRoom}
            >
              Add
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <h3 className="text-lg font-semibold">Who may do what</h3>
          <p className="text-xs text-text-muted">
            Money and clinical shortcuts are role decisions, not per-visit
            checkboxes.
          </p>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="py-2 pr-4">Action</th>
                {ROLES.map((r) => (
                  <th key={r.key} className="py-2 px-2 text-center">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_LISTS.map((row) => (
                <tr key={row.field} className="border-t border-border-base">
                  <td className="py-2 pr-4">
                    <div className="font-medium text-text-main">
                      {row.label}
                    </div>
                    {row.help && (
                      <div className="text-xs text-text-muted">{row.help}</div>
                    )}
                  </td>
                  {ROLES.map((r) => (
                    <td key={r.key} className="py-2 px-2 text-center">
                      <Checkbox
                        aria-label={`${row.label}: ${r.label}`}
                        isSelected={form[row.field].includes(r.key)}
                        size="sm"
                        onValueChange={() => toggleRole(row.field, r.key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <h3 className="text-lg font-semibold">Behaviour</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <Checkbox
            isSelected={form.triageForExpertVisits}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, triageForExpertVisits: v }))
            }
          >
            Require triage vitals for expert-only visits (laser, aesthetic
            sessions)
          </Checkbox>
          <Checkbox
            isSelected={form.collectProcedureBeforePerforming}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, collectProcedureBeforePerforming: v }))
            }
          >
            Collect a procedure's fee before the expert performs it (otherwise
            at settle)
          </Checkbox>
          <div className="pt-2 border-t border-border-base">
            <p className="text-xs uppercase tracking-wide text-text-muted mb-2">
              Rollout previews
            </p>
            <div className="flex flex-col gap-2">
              <Checkbox
                isSelected={form.settleV2}
                onValueChange={(v) => setForm((p) => ({ ...p, settleV2: v }))}
              >
                New settle sheet (file, pay and close in one confirm)
              </Checkbox>
              <Checkbox
                isSelected={form.intakeV2}
                onValueChange={(v) => setForm((p) => ({ ...p, intakeV2: v }))}
              >
                New intake sheet
              </Checkbox>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
