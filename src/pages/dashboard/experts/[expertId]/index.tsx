/**
 * Expert Profile Page
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCallOutline,
  IoMailOutline,
  IoIdCardOutline,
  IoCreateOutline,
  IoStatsChartOutline,
  IoCloseOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { expertService } from "@/services/expertService";
import { expertCommissionService } from "@/services/expertCommissionService";
import { Expert, ExpertCommission } from "@/types/models";
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
  startContent,
}: any) {
  return (
    <div className={`flex flex-col gap-1.5 w-full`}>
      {label && (
        <label className="text-[13px] font-medium text-mountain-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-center border border-mountain-200 rounded min-h-[38px] bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-100`}
      >
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
    </div>
  );
}

function ModalShell({ isOpen, onClose, title, children }: any) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`bg-white rounded shadow-lg w-full max-w-md pointer-events-auto flex flex-col max-h-[90vh]`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-mountain-100">
            <h3 className="text-[15px] font-bold text-mountain-900">{title}</h3>
            <button
              className="text-mountain-400 hover:text-mountain-600"
              onClick={onClose}
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto">{children}</div>
        </div>
      </div>
    </>
  );
}

export default function ExpertProfilePage() {
  const { expertId } = useParams<{ expertId: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser } = useAuth();

  const [expert, setExpert] = useState<Expert | null>(null);
  const [commissions, setCommissions] = useState<ExpertCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] =
    useState<ExpertCommission | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (expertId && clinicId) loadExpertProfile();
  }, [expertId, clinicId]);

  const loadExpertProfile = async () => {
    try {
      setLoading(true);
      const data = await expertService.getExpertById(expertId!);

      if (!data) {
        addToast({
          title: "Error",
          description: "Expert not found.",
          color: "danger",
        });
        navigate("/dashboard/experts");

        return;
      }
      setExpert(data);
      loadCommissions();
    } catch {
      addToast({
        title: "Error",
        description: "Failed to load profile.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCommissions = async () => {
    if (!clinicId || !expertId) return;
    try {
      setCommissionsLoading(true);
      const data = await expertCommissionService.getCommissionsByExpert(
        expertId,
        clinicId,
      );

      setCommissions(data);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedCommission) return;
    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) return;

    try {
      setPaymentProcessing(true);
      await expertCommissionService.payCommission(
        selectedCommission.id,
        amount,
        paymentForm.method,
        paymentForm.reference,
        paymentForm.notes,
        currentUser?.uid,
      );
      addToast({
        title: "Success",
        description: "Payment recorded.",
        color: "success",
      });
      loadCommissions();
      setIsPaymentModalOpen(false);
    } catch {
      addToast({
        title: "Error",
        description: "Payment failed.",
        color: "danger",
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  if (loading)
    return (
      <div className="p-12 flex justify-center">
        <Spinner size="md" />
      </div>
    );
  if (!expert)
    return (
      <div className="p-12 text-center text-mountain-500">
        Expert not found.
      </div>
    );

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="bordered" onClick={() => navigate(-1)}>
            <IoArrowBackOutline />
          </Button>
          <div>
            <h1 className={title({ size: "lg" })}>Expert Profile</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            startContent={<IoCreateOutline />}
            variant="bordered"
            onClick={() => navigate(`/dashboard/experts/${expertId}/edit`)}
          >
            Edit
          </Button>
        </div>
      </div>

      <div className="bg-white border border-mountain-200 rounded p-6 shadow-sm flex gap-6">
        <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center text-stat-sm font-bold text-teal-800">
          {expert.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-page-title font-bold">{expert.name}</h2>
          <p className="text-mountain-600 font-medium capitalize text-[14px]">
            {expert.speciality} • {expert.expertType}
          </p>
          <div className="flex gap-4 mt-4">
            <span className="flex items-center gap-1.5 text-[13px] bg-mountain-50 px-3 py-1 rounded border">
              <IoIdCardOutline /> License: {expert.licenseNumber}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] bg-mountain-50 px-3 py-1 rounded border">
              <IoStatsChartOutline /> Commission: {expert.defaultCommission}%
            </span>
          </div>
          <div className="flex gap-6 mt-4 text-[13.5px] text-mountain-600">
            <span className="flex items-center gap-2">
              <IoCallOutline /> {expert.phone}
            </span>
            {expert.email && (
              <span className="flex items-center gap-2">
                <IoMailOutline /> {expert.email}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-mountain-200 rounded shadow-sm">
        <div className="flex border-b border-mountain-100">
          {["overview", "commissions"].map((t) => (
            <button
              key={t}
              className={`px-5 py-4 text-[14px] font-semibold capitalize ${selectedTab === t ? "border-b-2 border-teal-600 text-teal-700 bg-teal-50/30" : "text-mountain-600 hover:bg-mountain-50"}`}
              onClick={() => setSelectedTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="p-6">
          {selectedTab === "overview" && (
            <div className="grid grid-cols-2 gap-8 text-[14px]">
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider border-b pb-2">
                  Professional details
                </h3>
                <div className="flex justify-between">
                  <span>Speciality</span>
                  <span className="font-semibold">{expert.speciality}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className="font-semibold capitalize">
                    {expert.expertType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>License</span>
                  <span className="font-semibold">{expert.licenseNumber}</span>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider border-b pb-2">
                  Earnings
                </h3>
                <div className="flex justify-between">
                  <span>Balance</span>
                  <span className="font-semibold">
                    NPR {expert.totalCommissionBalance || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Lifetime</span>
                  <span className="font-semibold">
                    NPR {expert.totalCommissionEarned || 0}
                  </span>
                </div>
              </div>
            </div>
          )}
          {selectedTab === "commissions" && (
            <div className="space-y-4">
              {commissionsLoading ? (
                <Spinner size="sm" />
              ) : commissions.length === 0 ? (
                <p className="text-mountain-500">No commissions recorded.</p>
              ) : (
                <table className="w-full text-left border rounded overflow-hidden">
                  <thead className="bg-mountain-50 text-[12.5px] font-semibold">
                    <tr>
                      <th className="p-3">Invoice</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] divide-y">
                    {commissions.map((c) => (
                      <tr key={c.id}>
                        <td className="p-3">#{c.invoiceNumber}</td>
                        <td className="p-3">{c.patientName}</td>
                        <td className="p-3 font-semibold">
                          NPR {c.commissionAmount}
                        </td>
                        <td className="p-3 capitalize">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] border ${c.status === "paid" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {c.status !== "paid" && (
                            <Button
                              color="primary"
                              size="sm"
                              variant="flat"
                              onClick={() => {
                                setSelectedCommission(c);
                                setPaymentForm({
                                  ...paymentForm,
                                  amount: (
                                    c.commissionAmount - (c.paidAmount || 0)
                                  ).toString(),
                                });
                                setIsPaymentModalOpen(true);
                              }}
                            >
                              Record Payment
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      <ModalShell
        isOpen={isPaymentModalOpen}
        title="Record Commission Payment"
        onClose={() => setIsPaymentModalOpen(false)}
      >
        <div className="p-5 flex flex-col gap-4">
          <CustomInput
            label="Amount to Pay"
            startContent="NPR"
            type="number"
            value={paymentForm.amount}
            onChange={(e: any) =>
              setPaymentForm({ ...paymentForm, amount: e.target.value })
            }
          />
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="bordered"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={paymentProcessing}
              onClick={handlePaymentSubmit}
            >
              Save Payment
            </Button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
