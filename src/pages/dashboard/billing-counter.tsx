/**
 * Billing Counter — one invoice for the whole visit.
 *
 * Appointment, pathology and pharmacy each had their own billing screen, so a
 * patient who had a consultation, gave blood and collected medicines left with
 * three separate invoices carrying three numbers from the shared IRD sequence.
 * This counter issues ONE invoice for the lot.
 *
 * It deliberately adds no billing logic of its own. Line items are assembled
 * here and then handed to the same `calculateInvoiceTotals` and `createBilling`
 * every other screen already uses, so item-level tax and discount, the IRD
 * payload, the gapless invoice number, the MySQL ledger row and the commission
 * engine all behave identically to an appointment invoice. The only thing new
 * is that the lines may come from three different catalogues, which each item
 * records in `lineKind`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoReceiptOutline,
  IoAddOutline,
  IoTrashOutline,
  IoFlaskOutline,
  IoMedkitOutline,
  IoBriefcaseOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { pathologyService } from "@/services/pathologyService";
import { medicineService } from "@/services/medicineService";
import {
  AppointmentBilling,
  AppointmentBillingItem,
  AppointmentBillingSettings,
  AppointmentType,
  Doctor,
  Medicine,
  PathologyTestType,
  Patient,
} from "@/types/models";

type LineKind = NonNullable<AppointmentBillingItem["lineKind"]>;

const KIND_META: Record<
  LineKind,
  { label: string; icon: React.ReactNode; chip: string }
> = {
  service: {
    label: "Service",
    icon: <IoBriefcaseOutline />,
    chip: "bg-primary/10 text-primary",
  },
  lab: {
    label: "Lab Test",
    icon: <IoFlaskOutline />,
    chip: "bg-warning/10 text-warning",
  },
  medicine: {
    label: "Medicine",
    icon: <IoMedkitOutline />,
    chip: "bg-success/10 text-success",
  },
};

const money = (n: number) => n.toFixed(2);

export default function BillingCounterPage() {
  const navigate = useNavigate();
  const { currentUser, clinicId } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [apptTypes, setApptTypes] = useState<AppointmentType[]>([]);
  const [labTests, setLabTests] = useState<PathologyTestType[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [settings, setSettings] = useState<AppointmentBillingSettings | null>(
    null,
  );

  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [items, setItems] = useState<AppointmentBillingItem[]>([]);
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [discountValue, setDiscountValue] = useState(0);
  const [applyTax, setApplyTax] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // Which catalogue the "add line" row is currently picking from
  const [pickKind, setPickKind] = useState<LineKind>("service");
  const [pickId, setPickId] = useState("");

  useEffect(() => {
    if (!clinicId) return;

    (async () => {
      try {
        // Every catalogue is clinic-scoped; an empty one simply means nothing
        // of that kind is configured yet, which must not break the others.
        const [p, d, at, lt, med, st] = await Promise.all([
          patientService.getPatientsByClinic(clinicId).catch(() => []),
          doctorService.getDoctorsByClinic(clinicId).catch(() => []),
          appointmentTypeService
            .getAppointmentTypesByClinic(clinicId)
            .catch(() => []),
          // pathologyTestTypes is the priced billing catalogue —
          // pathologyTests holds per-patient test records (it requires a
          // patientName and carries a sampleNumber), which is not what a
          // billing counter picks from.
          pathologyService.getTestTypesByClinic(clinicId).catch(() => []),
          medicineService.getMedicinesByClinic(clinicId, true).catch(() => []),
          appointmentBillingService
            .getBillingSettings(clinicId)
            .catch(() => null),
        ]);

        setPatients(p);
        setDoctors(d);
        setApptTypes(at);
        setLabTests(lt);
        setMedicines(med);
        setSettings(st);
      } finally {
        setLoading(false);
      }
    })();
  }, [clinicId]);

  const taxPercentage = applyTax ? settings?.defaultTaxPercentage || 0 : 0;

  const totals = useMemo(
    () =>
      appointmentBillingService.calculateInvoiceTotals(
        items,
        discountType,
        discountValue,
        taxPercentage,
      ),
    [items, discountType, discountValue, taxPercentage],
  );

  const catalogue = useMemo(() => {
    if (pickKind === "service") {
      return apptTypes.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price || 0,
        taxable: false,
      }));
    }
    if (pickKind === "lab") {
      return labTests.map((t) => ({
        id: t.id,
        name: t.name || "Lab Test",
        price: t.price || 0,
        // A test type carries its own tax treatment precisely so staff don't
        // have to remember it per invoice — honour it rather than defaulting.
        taxable: Boolean(t.isTaxable),
        taxRate: t.taxRate || undefined,
      }));
    }

    return medicines.map((m) => ({
      id: m.id,
      name: [m.name, m.strength].filter(Boolean).join(" "),
      price: m.price || 0,
      // Medicines carry their own VAT configuration in the catalogue, unlike
      // services and tests which are exempt here unless staff say otherwise.
      taxable: Boolean(m.isVatApplied),
      taxRate: m.vatPercentage || undefined,
    }));
  }, [pickKind, apptTypes, labTests, medicines]);

  const addLine = () => {
    const entry = catalogue.find((c) => c.id === pickId);

    if (!entry) return;

    const doctor = doctors.find((d) => d.id === doctorId);

    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        // The source catalogue id lives here, as it already does for every
        // other non-appointment charge on this model.
        appointmentTypeId: entry.id,
        appointmentTypeName: entry.name,
        price: entry.price,
        quantity: 1,
        amount: entry.price,
        commission: 0,
        // Only a clinician's own service earns commission. A lab test or a
        // box of tablets must not, or attaching a doctor to the visit would
        // quietly pay them a percentage of the pharmacy bill.
        calculateCommission: pickKind === "service",
        doctorId: pickKind === "service" ? doctorId || undefined : undefined,
        doctorName: pickKind === "service" ? doctor?.name : undefined,
        isTaxable: entry.taxable,
        taxRate: (entry as { taxRate?: number }).taxRate,
        lineKind: pickKind,
      },
    ]);
    setPickId("");
  };

  const patchLine = (id: string, patch: Partial<AppointmentBillingItem>) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;

        const next = { ...it, ...patch };
        const gross = (next.price || 0) * (next.quantity || 0);
        const itemDiscount =
          next.discountType === "percent"
            ? (gross * (next.discountValue || 0)) / 100
            : next.discountValue || 0;

        next.discountAmount = Math.min(itemDiscount, gross);
        next.amount = gross - next.discountAmount;

        return next;
      }),
    );

  const removeLine = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const patient = patients.find((p) => p.id === patientId);
  const hasMedicineLine = items.some((it) => it.lineKind === "medicine");

  const submit = async () => {
    if (!currentUser || !clinicId) return;

    if (!patient) {
      addToast({
        title: "Select a patient",
        description: "An invoice needs a patient before it can be issued.",
        color: "danger",
      });

      return;
    }

    if (items.length === 0) {
      addToast({
        title: "Nothing to bill",
        description: "Add at least one service, lab test or medicine.",
        color: "danger",
      });

      return;
    }

    try {
      setSubmitting(true);

      const firstService = items.find((it) => it.lineKind === "service");
      const doctor = doctors.find((d) => d.id === doctorId);

      const data: Omit<AppointmentBilling, "id" | "createdAt" | "updatedAt"> = {
        invoiceNumber: "", // assigned by the Java ledger inside createBilling
        clinicId,
        branchId: "",
        patientId: patient.id,
        patientName: patient.name,
        patientPanVat: "",
        buyerPan: "",
        doctorId: firstService?.doctorId || doctorId || "",
        doctorName: firstService?.doctorName || doctor?.name || "",
        doctorType: "regular",
        items,
        invoiceDate: new Date(),
        subtotal: totals.subtotal,
        discountType,
        discountValue,
        discountAmount: totals.totalDiscount,
        itemDiscountAmount: totals.itemDiscountAmount,
        mainDiscountAmount: totals.mainDiscountAmount,
        taxPercentage,
        taxAmount: totals.taxAmount,
        taxableAmount: totals.taxableAmount,
        exemptAmount: totals.exemptAmount,
        totalAmount: totals.totalAmount,
        status: "draft",
        paymentStatus: "unpaid",
        paymentMethod,
        paidAmount: 0,
        balanceAmount: totals.totalAmount,
        createdBy: currentUser.uid,
      } as Omit<AppointmentBilling, "id" | "createdAt" | "updatedAt">;

      const { id, invoiceNumber } =
        await appointmentBillingService.createBilling(data);

      addToast({
        title: `Invoice ${invoiceNumber} created`,
        description: `${items.length} line(s), NPR ${money(totals.totalAmount)}.`,
        color: "success",
      });
      navigate(`/dashboard/appointments-billing/${id}`);
    } catch (error: any) {
      addToast({
        title: "Could not create the invoice",
        description: error?.message || "Please try again.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-text-muted">Loading catalogues…</div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <IoReceiptOutline className="text-2xl text-primary" />
        <h1 className={title({ size: "sm" })}>Billing Counter</h1>
      </div>
      <p className="text-xs text-text-muted -mt-2">
        One invoice for the whole visit — consultation, lab tests and medicines
        on a single bill and a single IRD invoice number.
      </p>

      <Card>
        <CardHeader className="text-sm font-semibold">Patient</CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-3">
          <Select
            isRequired
            label="Patient"
            placeholder="Select a patient"
            selectedKeys={patientId ? [patientId] : []}
            onSelectionChange={(k) =>
              setPatientId(String(Array.from(k)[0] ?? ""))
            }
          >
            {patients.map((p) => (
              <SelectItem
                key={p.id}
              >{`${p.name}${p.mobile ? ` — ${p.mobile}` : ""}`}</SelectItem>
            ))}
          </Select>
          <Select
            label="Attending clinician"
            placeholder="Optional"
            selectedKeys={doctorId ? [doctorId] : []}
            onSelectionChange={(k) =>
              setDoctorId(String(Array.from(k)[0] ?? ""))
            }
          >
            {doctors.map((d) => (
              <SelectItem key={d.id}>{d.name}</SelectItem>
            ))}
          </Select>
          <Select
            label="Payment method"
            selectedKeys={[paymentMethod]}
            onSelectionChange={(k) =>
              setPaymentMethod(String(Array.from(k)[0] ?? "cash"))
            }
          >
            <SelectItem key="cash">Cash</SelectItem>
            <SelectItem key="card">Card</SelectItem>
            <SelectItem key="cheque">Cheque</SelectItem>
            <SelectItem key="credit">Credit</SelectItem>
          </Select>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="text-sm font-semibold">Add a line</CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_META) as LineKind[]).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={pickKind === k ? "solid" : "bordered"}
                onClick={() => {
                  setPickKind(k);
                  setPickId("");
                }}
              >
                <span className="flex items-center gap-1.5">
                  {KIND_META[k].icon}
                  {KIND_META[k].label}
                </span>
              </Button>
            ))}
          </div>

          {catalogue.length === 0 ? (
            <p className="text-xs text-warning">
              No {KIND_META[pickKind].label.toLowerCase()} entries are
              configured for this clinic yet.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <Select
                  label={KIND_META[pickKind].label}
                  placeholder={`Select a ${KIND_META[pickKind].label.toLowerCase()}`}
                  selectedKeys={pickId ? [pickId] : []}
                  onSelectionChange={(k) =>
                    setPickId(String(Array.from(k)[0] ?? ""))
                  }
                >
                  {catalogue.map((c) => (
                    <SelectItem key={c.id}>
                      {`${c.name} — NPR ${money(c.price)}`}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <Button color="primary" isDisabled={!pickId} onClick={addLine}>
                <span className="flex items-center gap-1.5">
                  <IoAddOutline /> Add
                </span>
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="text-sm font-semibold">
          Invoice lines ({items.length})
        </CardHeader>
        <CardBody className="space-y-3">
          {items.length === 0 ? (
            <p className="text-xs text-text-muted">
              Nothing added yet. Pick a service, lab test or medicine above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-default-100">
                  <tr>
                    {[
                      "Kind",
                      "Item",
                      "Qty",
                      "Rate",
                      "Discount",
                      "Tax",
                      "Amount",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-2 py-1.5 text-left font-semibold whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const kind = (it.lineKind || "service") as LineKind;

                    return (
                      <tr key={it.id} className="border-t border-default-100">
                        <td className="px-2 py-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${KIND_META[kind].chip}`}
                          >
                            {KIND_META[kind].icon}
                            {KIND_META[kind].label}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          {it.appointmentTypeName}
                          {it.doctorName ? (
                            <span className="text-text-muted">
                              {" "}
                              · {it.doctorName}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1 w-20">
                          <Input
                            min={1}
                            size="sm"
                            type="number"
                            value={String(it.quantity)}
                            onValueChange={(v) =>
                              patchLine(it.id, { quantity: Number(v) || 1 })
                            }
                          />
                        </td>
                        <td className="px-2 py-1 w-24">
                          <Input
                            min={0}
                            size="sm"
                            type="number"
                            value={String(it.price)}
                            onValueChange={(v) =>
                              patchLine(it.id, { price: Number(v) || 0 })
                            }
                          />
                        </td>
                        <td className="px-2 py-1 w-36">
                          <div className="flex gap-1">
                            <Input
                              min={0}
                              size="sm"
                              type="number"
                              value={String(it.discountValue || 0)}
                              onValueChange={(v) =>
                                patchLine(it.id, {
                                  discountValue: Number(v) || 0,
                                })
                              }
                            />
                            <select
                              className="rounded border border-border-base bg-surface px-1 text-xs"
                              value={it.discountType || "flat"}
                              onChange={(e) =>
                                patchLine(it.id, {
                                  discountType: e.target.value as
                                    | "flat"
                                    | "percent",
                                })
                              }
                            >
                              <option value="flat">NPR</option>
                              <option value="percent">%</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <label className="flex items-center gap-1">
                            <input
                              checked={Boolean(it.isTaxable)}
                              type="checkbox"
                              onChange={(e) =>
                                patchLine(it.id, {
                                  isTaxable: e.target.checked,
                                })
                              }
                            />
                            <span className="text-text-muted">
                              {it.isTaxable
                                ? `${it.taxRate ?? settings?.defaultTaxPercentage ?? 0}%`
                                : "Exempt"}
                            </span>
                          </label>
                        </td>
                        <td className="px-2 py-1 text-right font-semibold whitespace-nowrap">
                          {money(it.amount)}
                        </td>
                        <td className="px-2 py-1">
                          <Button
                            isIconOnly
                            color="danger"
                            size="sm"
                            variant="light"
                            onClick={() => removeLine(it.id)}
                          >
                            <IoTrashOutline />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="text-sm font-semibold">
            Invoice discount &amp; tax
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-end gap-2">
              <Input
                label="Discount on the whole bill"
                min={0}
                type="number"
                value={String(discountValue)}
                onValueChange={(v) => setDiscountValue(Number(v) || 0)}
              />
              <select
                className="h-10 rounded border border-border-base bg-surface px-2 text-sm"
                value={discountType}
                onChange={(e) =>
                  setDiscountType(e.target.value as "flat" | "percent")
                }
              >
                <option value="flat">NPR</option>
                <option value="percent">%</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={applyTax}
                type="checkbox"
                onChange={(e) => setApplyTax(e.target.checked)}
              />
              Apply {settings?.defaultTaxPercentage ?? 0}% VAT to taxable lines
            </label>
            {hasMedicineLine ? (
              <p className="text-xs text-warning">
                This bill includes medicines. Stock is not yet deducted from
                this counter — dispense them through the Pharmacy screen so
                batch stock and expiry stay correct.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="text-sm font-semibold">Totals</CardHeader>
          <CardBody className="space-y-1 text-sm">
            {[
              ["Subtotal", totals.subtotal],
              ["Item discounts", -totals.itemDiscountAmount],
              ["Bill discount", -totals.mainDiscountAmount],
              ["Taxable", totals.taxableAmount],
              ["Exempt", totals.exemptAmount],
              ["VAT", totals.taxAmount],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between">
                <span className="text-text-muted">{label}</span>
                <span>{money(Number(value))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border-base pt-2 text-base font-semibold">
              <span>Total</span>
              <span>NPR {money(totals.totalAmount)}</span>
            </div>
            <Button
              fullWidth
              className="mt-3"
              color="primary"
              isDisabled={submitting || items.length === 0 || !patientId}
              onClick={submit}
            >
              {submitting ? "Creating invoice…" : "Create one invoice"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
