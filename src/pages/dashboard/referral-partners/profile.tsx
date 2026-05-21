import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCallOutline,
  IoMailOutline,
  IoStatsChartOutline,
  IoWalletOutline,
  IoCashOutline,
  IoCloseOutline,
  IoReceiptOutline,
  IoCreateOutline,
  IoPeopleOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { referralPartnerService } from "@/services/referralPartnerService";
import { referralCommissionService } from "@/services/referralCommissionService";
import { ReferralPartner, ReferralCommission, Patient } from "@/types/models";
import { addToast } from "@/components/ui/toast";

// ── Custom UI Helpers ────────────────────────────────────────────────────────
function CustomInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  description,
  startContent,
}: any) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="flex items-center border border-mountain-200 rounded min-h-[38px] bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100">
        {startContent && (
          <div className="pl-3 pr-2 text-mountain-400 font-medium text-[13px]">
            {startContent}
          </div>
        )}
        <input
          className="flex-1 w-full text-[13.5px] px-3 py-1.5 bg-transparent outline-none text-mountain-800 placeholder:text-mountain-400"
          name={name}
          placeholder={placeholder}
          required={required}
          type={type}
          value={value}
          onChange={onChange}
        />
      </div>
      {description && (
        <p className="text-[11.5px] text-mountain-500">{description}</p>
      )}
    </div>
  );
}

function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: any) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        className="w-full min-h-[38px] bg-white border border-mountain-200 text-mountain-800 text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100 transition-shadow"
        required={required}
        value={value}
        onChange={onChange}
      >
        {placeholder && (
          <option disabled hidden value="">
            {placeholder}
          </option>
        )}
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ModalShell({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  isDismissable = true,
  hideCloseButton = false,
}: any) {
  if (!isOpen) return null;
  const sizeClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };
  const maxWidth = sizeClasses[size] || "max-w-md";

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
        onClick={() => isDismissable && onClose()}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`bg-white rounded shadow-lg w-full ${maxWidth} pointer-events-auto flex flex-col max-h-[90vh]`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-mountain-100">
            <h3 className="text-[15px] font-bold text-mountain-900 leading-none">
              {title}
            </h3>
            {!hideCloseButton && (
              <button
                className="text-mountain-400 hover:text-mountain-600 transition-colors"
                onClick={onClose}
              >
                <IoCloseOutline className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto">{children}</div>
        </div>
      </div>
    </>
  );
}

export default function ReferralPartnerProfilePage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser } = useAuth();

  const [partner, setPartner] = useState<ReferralPartner | null>(null);
  const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
  const [referredPatients, setReferredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] =
    useState<ReferralCommission | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (partnerId && clinicId) loadInitialData();
  }, [partnerId, clinicId]);

  const loadInitialData = async () => {
    if (!partnerId || !clinicId) return;
    try {
      setLoading(true);
      const partnerData =
        await referralPartnerService.getReferralPartnerById(partnerId);

      if (!partnerData) {
        addToast({
          title: "Error",
          description: "Partner not found",
          color: "danger",
        });
        navigate("/dashboard/settings/referral-partners");

        return;
      }

      setPartner(partnerData);

      // Trigger other data loads in background
      loadPatients();
      loadCommissions();
    } catch (err) {
      console.error(err);
      addToast({
        title: "Error",
        description: "Failed to load profile",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    if (!partnerId || !clinicId) return;
    try {
      setPatientsLoading(true);
      const patients = await referralPartnerService.getPatientsByReferral(
        clinicId,
        partnerId,
      );

      setReferredPatients(patients);
    } catch (err) {
      console.error("Error loading patients:", err);
    } finally {
      setPatientsLoading(false);
    }
  };

  const loadCommissions = async () => {
    if (!partnerId || !clinicId) return;
    try {
      setCommissionsLoading(true);
      const data = await referralCommissionService.getCommissionsByPartner(
        partnerId,
        clinicId,
      );

      setCommissions(data);
    } catch (err) {
      console.error("Error loading commissions:", err);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const handlePaymentOpen = (commission: ReferralCommission) => {
    setSelectedCommission(commission);
    setPaymentForm({
      amount: (
        commission.commissionAmount - (commission.paidAmount || 0)
      ).toString(),
      method: "cash",
      reference: "",
      notes: "",
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCommission || !clinicId) return;
    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) {
      addToast({
        title: "Error",
        description: "Invalid amount",
        color: "warning",
      });

      return;
    }

    const remaining =
      selectedCommission.commissionAmount -
      (selectedCommission.paidAmount || 0);

    if (amount > remaining) {
      addToast({
        title: "Error",
        description: "Amount exceeds pending balance",
        color: "warning",
      });

      return;
    }

    try {
      setPaymentProcessing(true);
      await referralCommissionService.payCommission(
        selectedCommission.id!,
        amount,
        paymentForm.method,
        paymentForm.reference || undefined,
        paymentForm.notes || undefined,
        currentUser?.uid,
      );
      addToast({
        title: "Success",
        description: "Payment recorded",
        color: "success",
      });
      setIsPaymentModalOpen(false);
      loadCommissions();
    } catch (err) {
      addToast({
        title: "Error",
        description: "Payment failed",
        color: "danger",
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => `NPR ${amount.toLocaleString()}`;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={title({ size: "lg" })}>Partner Profile</h1>
        </div>
        <div className="bg-white border border-mountain-200 rounded p-12 flex items-center justify-center shadow-sm">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (!partner) return null;

  const stats = commissions.reduce(
    (acc, c) => {
      acc.total += c.commissionAmount;
      acc.paid += c.paidAmount || 0;

      return acc;
    },
    { total: 0, paid: 0 },
  );
  const pending = stats.total - stats.paid;

  // Aggregate unique patients from both sources
  const patientsFromCommissions = commissions.map((c) => ({
    // Use name as fallback ID if patientId is missing (e.g., for pathology outsiders)
    id: c.patientId || `name:${c.patientName}`,
    name: c.patientName,
    // We might not have all details for these patients from commission alone
    isLegacy: true,
  }));

  // Create a unique set of patients based on ID
  const allUniquePatients = [...referredPatients];

  patientsFromCommissions.forEach((pc) => {
    if (!allUniquePatients.find((p) => p.id === pc.id)) {
      allUniquePatients.push(pc as any);
    }
  });

  const totalPatientsCount = allUniquePatients.length;

  const getStatusColor = (status: string) => {
    if (status === "paid") return "bg-teal-50 text-teal-700 border-teal-200";
    if (status === "pending")
      return "bg-amber-50 text-amber-700 border-amber-200";
    if (status === "cancelled") return "bg-red-50 text-red-700 border-red-200";

    return "bg-mountain-50 text-mountain-700 border-mountain-200";
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header / Navigation */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="bordered" onClick={() => navigate(-1)}>
            <IoArrowBackOutline className="w-4 h-4" />
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Partner Profile
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              View and manage information
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            startContent={<IoCreateOutline className="w-4 h-4" />}
            variant="bordered"
          >
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-white border border-mountain-200 rounded shadow-sm p-6 overflow-hidden relative">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10 w-full">
          <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center border border-teal-200 shrink-0 text-stat-sm font-bold text-teal-800">
            {partner.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center md:justify-start">
              <h2 className="text-page-title font-bold text-mountain-900">
                {partner.name}
              </h2>
              <span
                className={`inline-flex px-2 py-0.5 border rounded-full text-[12px] font-semibold tracking-wide uppercase ${partner.isActive ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-red-50 text-red-700 border-red-200"}`}
              >
                <span
                  className={`w-2 h-2 rounded-full mr-1.5 inline-block ${partner.isActive ? "bg-teal-500" : "bg-red-500"}`}
                />
                {partner.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-mountain-600 font-medium text-[15px] mt-1.5 uppercase tracking-widest">
              {partner.partnerType}
            </p>
            <div className="flex flex-wrap gap-4 mt-4 justify-center md:justify-start">
              <span className="flex items-center gap-1.5 text-[13.5px] text-mountain-700 font-medium bg-mountain-50 px-3 py-1.5 rounded border border-mountain-100">
                <IoStatsChartOutline className="text-teal-600" />
                Rate: {partner.defaultCommission}%
              </span>
              <span className="flex items-center gap-1.5 text-[13.5px] text-mountain-700 font-medium bg-mountain-50 px-3 py-1.5 rounded border border-mountain-100">
                <IoCallOutline className="text-teal-600" />
                {partner.phone}
              </span>
              {partner.email && (
                <span className="flex items-center gap-1.5 text-[13.5px] text-mountain-700 font-medium bg-mountain-50 px-3 py-1.5 rounded border border-mountain-100">
                  <IoMailOutline className="text-teal-600" />
                  {partner.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Patients",
            val: totalPatientsCount,
            icon: <IoPeopleOutline className="w-6 h-6 text-indigo-600" />,
            bg: "bg-indigo-50 border-indigo-100",
          },
          {
            label: "Total Bills",
            val: commissions.length,
            icon: <IoReceiptOutline className="w-6 h-6 text-teal-600" />,
            bg: "bg-teal-50 border-teal-100",
          },
          {
            label: "Total Commission",
            val: formatCurrency(stats.total),
            icon: <IoWalletOutline className="w-6 h-6 text-green-600" />,
            bg: "bg-green-50 border-green-100",
          },
          {
            label: "Pending Balance",
            val: formatCurrency(pending),
            icon: <IoCashOutline className="w-6 h-6 text-amber-600" />,
            bg: "bg-amber-50 border-amber-100",
          },
        ].map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 p-5 rounded shadow-sm border ${s.bg}`}
          >
            <div className="p-3 bg-white rounded-full shadow-sm">{s.icon}</div>
            <div>
              <p className="text-stat-sm text-mountain-900 leading-none">
                {s.val}
              </p>
              <p className="text-[13px] text-mountain-600 font-medium mt-1">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabbed Interface */}
      <div className="bg-white border border-mountain-200 rounded shadow-sm">
        <div className="flex border-b border-mountain-100 overflow-x-auto">
          {[
            { key: "overview", label: "Overview" },
            { key: "invoices", label: "Invoices" },
            { key: "patients", label: "Patients" },
            { key: "commission", label: "Commission" },
          ].map((t) => (
            <button
              key={t.key}
              className={`px-5 py-4 text-[14px] font-semibold whitespace-nowrap transition-colors border-b-2 ${
                selectedTab === t.key
                  ? "border-teal-600 text-teal-700 bg-teal-50/30"
                  : "border-transparent text-mountain-600 hover:text-mountain-900 hover:bg-mountain-50"
              }`}
              onClick={() => setSelectedTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {selectedTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-[15px] font-bold text-mountain-900 uppercase tracking-wider mb-4 border-b border-mountain-100 pb-2">
                  Details
                </h3>
                <div className="flex justify-between text-[14px] border-b border-mountain-50 pb-2">
                  <span className="text-mountain-500">Partner Type</span>
                  <span className="font-semibold capitalize text-mountain-900">
                    {partner.partnerType}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] border-b border-mountain-50 pb-2">
                  <span className="text-mountain-500">Commission Rate</span>
                  <span className="font-semibold text-mountain-900">
                    {partner.defaultCommission}%
                  </span>
                </div>
                <div className="flex justify-between text-[14px] border-b border-mountain-50 pb-2">
                  <span className="text-mountain-500">Address</span>
                  <span className="font-semibold text-mountain-900">
                    {partner.address || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] pb-2">
                  <span className="text-mountain-500">Phone</span>
                  <span className="font-semibold text-mountain-900">
                    {partner.phone}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[15px] font-bold text-mountain-900 uppercase tracking-wider mb-4 border-b border-mountain-100 pb-2">
                  System
                </h3>
                <div className="flex justify-between text-[14px] border-b border-mountain-50 pb-2">
                  <span className="text-mountain-500">Created At</span>
                  <span className="font-semibold text-mountain-900">
                    {partner.createdAt.toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] pb-2">
                  <span className="text-mountain-500">Last Modified</span>
                  <span className="font-semibold text-mountain-900">
                    {partner.updatedAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {selectedTab === "invoices" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[16px] font-bold text-mountain-900 font-bold">
                  Pathology Invoices
                </h3>
                <Button
                  isLoading={commissionsLoading}
                  size="sm"
                  variant="bordered"
                  onClick={loadCommissions}
                >
                  Refresh
                </Button>
              </div>
              {commissions.length > 0 ? (
                <div className="overflow-x-auto border border-mountain-100 rounded">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-mountain-50 border-b border-mountain-100">
                        <th className="px-5 py-3 text-[12.5px] font-bold text-mountain-600 uppercase">
                          Invoice
                        </th>
                        <th className="px-5 py-3 text-[12.5px] font-bold text-mountain-600 uppercase">
                          Patient
                        </th>
                        <th className="px-5 py-3 text-[12.5px] font-bold text-mountain-600 uppercase">
                          Amount
                        </th>
                        <th className="px-5 py-3 text-[12.5px] font-bold text-mountain-600 uppercase">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mountain-100">
                      {commissions.map((c) => (
                        <tr key={c.id} className="hover:bg-mountain-50/30">
                          <td className="px-5 py-3 font-bold text-[13.5px] text-mountain-900 underline pointer-cursor">
                            {c.invoiceNumber}
                          </td>
                          <td className="px-5 py-3 font-semibold text-mountain-700">
                            {c.patientName}
                          </td>
                          <td className="px-5 py-3 font-bold text-teal-700">
                            {formatCurrency(c.totalInvoiceAmount)}
                          </td>
                          <td className="px-5 py-3 text-mountain-500">
                            {new Date(c.invoiceDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-mountain-400 bg-mountain-50 rounded">
                  No invoices recorded yet.
                </div>
              )}
            </div>
          )}

          {selectedTab === "patients" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[16px] font-bold text-mountain-900">
                  Referred Patients
                </h3>
                <Button
                  isLoading={patientsLoading}
                  size="sm"
                  variant="bordered"
                  onClick={loadPatients}
                >
                  Refresh
                </Button>
              </div>
              {allUniquePatients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {allUniquePatients.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 border border-mountain-200 rounded hover:border-teal-300 transition-colors flex items-start gap-4 shadow-sm bg-white"
                    >
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded flex items-center justify-center font-bold">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-[14px] text-mountain-900 leading-tight">
                          {p.name}
                        </p>
                        {p.regNumber ? (
                          <p className="text-[12px] text-mountain-500 mt-1">
                            Reg: {p.regNumber} • {p.age}y
                          </p>
                        ) : (
                          <p className="text-[12px] text-mountain-400 mt-1 italic">
                            Billing history patient
                          </p>
                        )}
                        <p className="text-[12.5px] text-mountain-700 font-medium mt-0.5">
                          {p.mobile || p.phone || "No contact info"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-mountain-400 bg-mountain-50 rounded">
                  No patients referred yet.
                </div>
              )}
            </div>
          )}

          {selectedTab === "commission" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-[16px] font-bold text-mountain-900 flex items-center gap-2">
                  <IoReceiptOutline className="text-teal-600" /> Commission
                  Records
                </h3>
                <Button
                  isLoading={commissionsLoading}
                  size="sm"
                  variant="bordered"
                  onClick={loadCommissions}
                >
                  Refresh Data
                </Button>
              </div>
              {commissions.length > 0 ? (
                <div className="space-y-3">
                  {commissions.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 border border-mountain-200 rounded flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white shadow-sm hover:border-teal-300"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-[15px] text-mountain-900">
                            {c.invoiceNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(c.status)}`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-[13.5px] font-medium text-mountain-700">
                          {c.patientName} -{" "}
                          <span className="text-[12.5px] text-mountain-500 font-normal">
                            {(c.serviceNames || []).join(", ") ||
                              "Referral Service / Registration"}
                          </span>
                        </p>
                        <p className="text-[12px] text-mountain-500 mt-1">
                          Rate: {c.commissionPercentage}% • Total:{" "}
                          {formatCurrency(c.totalInvoiceAmount)}
                        </p>
                      </div>
                      <div className="text-left md:text-right flex flex-col md:items-end gap-2">
                        <div>
                          <p className="text-[18px] font-bold text-mountain-900 leading-none">
                            {formatCurrency(c.commissionAmount)}
                          </p>
                          {c.status === "pending" && (
                            <p className="text-[12px] text-amber-600 font-medium mt-1">
                              Pending:{" "}
                              {formatCurrency(
                                c.commissionAmount - (c.paidAmount || 0),
                              )}
                            </p>
                          )}
                        </div>
                        {c.status !== "paid" && (
                          <Button
                            color="success"
                            size="sm"
                            startContent={<IoCashOutline />}
                            onClick={() => handlePaymentOpen(c)}
                          >
                            Record Pay
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-mountain-400 bg-mountain-50 rounded">
                  No commissions recorded yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Standardized Payment Modal */}
      <ModalShell
        hideCloseButton={paymentProcessing}
        isDismissable={!paymentProcessing}
        isOpen={isPaymentModalOpen}
        title="Pay Commission"
        onClose={() => !paymentProcessing && setIsPaymentModalOpen(false)}
      >
        <div className="p-6">
          {selectedCommission && (
            <div className="mb-6 p-4 bg-mountain-50 border border-mountain-100 rounded text-[13.5px] space-y-1">
              <p>
                <span className="text-mountain-400 uppercase font-bold text-[10px] tracking-wider">
                  Invoice:
                </span>{" "}
                <span className="font-bold text-mountain-800">
                  {selectedCommission.invoiceNumber}
                </span>
              </p>
              <div className="mt-2 pt-2 border-t border-mountain-200">
                <p className="text-[11px] text-mountain-400 font-bold uppercase tracking-wider mb-1">
                  Outstanding Balance
                </p>
                <p className="text-[20px] font-bold text-amber-600 leading-none">
                  {formatCurrency(
                    selectedCommission.commissionAmount -
                      (selectedCommission.paidAmount || 0),
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <CustomInput
              required
              label="Payment Amount"
              startContent="NPR"
              type="number"
              value={paymentForm.amount}
              onChange={(e: any) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
            />
            <CustomSelect
              required
              label="Payment Method"
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank_transfer", label: "Bank Transfer" },
                { value: "cheque", label: "Cheque" },
              ]}
              value={paymentForm.method}
              onChange={(e: any) =>
                setPaymentForm({ ...paymentForm, method: e.target.value })
              }
            />
            {(paymentForm.method === "bank_transfer" ||
              paymentForm.method === "cheque") && (
              <CustomInput
                label="Reference / Transaction ID"
                placeholder="Enter transaction number..."
                value={paymentForm.reference}
                onChange={(e: any) =>
                  setPaymentForm({ ...paymentForm, reference: e.target.value })
                }
              />
            )}
            <CustomInput
              label="Notes (Optional)"
              placeholder="Add brief details..."
              value={paymentForm.notes}
              onChange={(e: any) =>
                setPaymentForm({ ...paymentForm, notes: e.target.value })
              }
            />

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-mountain-100">
              <Button
                disabled={paymentProcessing}
                variant="bordered"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                color="success"
                disabled={
                  !paymentForm.amount || parseFloat(paymentForm.amount) <= 0
                }
                isLoading={paymentProcessing}
                onClick={handlePaymentSubmit}
              >
                Submit Payment
              </Button>
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
