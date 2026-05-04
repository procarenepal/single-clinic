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
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";
import { Card, CardBody, CardHeader } from "@/components/ui/card";


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
      <div className="p-12 text-center text-text-muted">
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
            <h1 className={`${title({ size: "lg" })} text-primary`}>Expert Profile</h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              View and manage expert information
            </p>
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

      <div className="bg-surface border border-border-base rounded p-6 shadow-none flex gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-stat-sm font-bold text-primary">
          {expert.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-page-title font-bold text-text-main">{expert.name}</h2>
          <p className="text-text-muted font-medium capitalize text-[14px]">
            {expert.speciality} • {expert.expertType}
          </p>
          <div className="flex gap-4 mt-4">
            <span className="flex items-center gap-1.5 text-[13px] bg-surface-2 px-3 py-1 rounded border border-border-base text-text-main">
              <IoIdCardOutline /> License: {expert.licenseNumber}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] bg-surface-2 px-3 py-1 rounded border border-border-base text-text-main">
              <IoStatsChartOutline /> Commission: {expert.defaultCommission}%
            </span>
          </div>
          <div className="flex gap-6 mt-4 text-[13.5px] text-text-muted">
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

      <div className="bg-surface border border-border-base rounded shadow-none overflow-hidden">
        <div className="flex border-b border-border-base bg-surface-2/30">
          {["overview", "commissions"].map((t) => (
            <button
              key={t}
              className={`px-5 py-3 text-[13.5px] font-semibold capitalize transition-all ${selectedTab === t ? "border-b-2 border-primary text-primary bg-primary/5" : "text-text-muted hover:bg-surface-2 hover:text-text-main"}`}
              onClick={() => setSelectedTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="p-6">
          {selectedTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[13.5px]">
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider border-b border-border-base pb-2 text-text-muted text-[11px]">
                  Professional details
                </h3>
                <div className="flex justify-between">
                  <span className="text-text-muted">Speciality</span>
                  <span className="font-semibold text-text-main">{expert.speciality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Type</span>
                  <span className="font-semibold capitalize text-text-main">
                    {expert.expertType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">License</span>
                  <span className="font-semibold text-text-main">{expert.licenseNumber}</span>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider border-b border-border-base pb-2 text-text-muted text-[11px]">
                  Earnings
                </h3>
                <div className="flex justify-between">
                  <span className="text-text-muted">Balance</span>
                  <span className="font-bold text-success">
                    NPR {expert.totalCommissionBalance || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Lifetime</span>
                  <span className="font-semibold text-text-main">
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
                <p className="text-text-muted">No commissions recorded.</p>
              ) : (
                <div className="border border-border-base rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-2 text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Invoice</th>
                        <th className="p-3">Patient</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-[13px] divide-y divide-border-base/50">
                      {commissions.map((c) => (
                        <tr key={c.id}>
                          <td className="p-3">#{c.invoiceNumber}</td>
                          <td className="p-3">{c.patientName}</td>
                          <td className="p-3 font-semibold">
                            NPR {c.commissionAmount}
                          </td>
                          <td className="p-3">
                            <Chip
                              color={c.status === "paid" ? "success" : "warning"}
                              size="sm"
                              variant="flat"
                            >
                              {c.status}
                            </Chip>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>Record Commission Payment</ModalHeader>
          <ModalBody className="p-5 flex flex-col gap-4">
            <Input
              fullWidth
              label="Amount to Pay"
              placeholder="0.00"
              startContent={<span className="text-text-muted text-[12px] font-semibold">NPR</span>}
              type="number"
              value={paymentForm.amount}
              variant="bordered"
              onChange={(e: any) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
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
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
