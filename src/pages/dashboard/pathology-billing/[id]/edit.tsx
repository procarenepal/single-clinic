/**
 * Pathology Edit Invoice Page — a real, bookmarkable route wrapping the
 * existing PathologyBillingTab create/edit form (in standalone mode via
 * hideTabBar/onEditComplete) rather than re-implementing it. See the
 * "Pathology Edit — Real Route Instead of Tab-Switch Hack" plan for why:
 * the form is large and tightly coupled to test/testType/category catalogs
 * already loaded internally by PathologyBillingTab, and duplicating it
 * risks exactly the kind of drift that caused the SellPackageModal tax/PAN
 * gap to slip through earlier this session.
 */
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { IoArrowBackOutline } from "react-icons/io5";

import DashboardNotFoundPage from "../../not-found";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthContext } from "@/context/AuthContext";
import { pathologyBillingService } from "@/services/pathologyBillingService";
import { PathologyBilling } from "@/types/models";
import PathologyBillingTab from "@/components/pathology/PathologyBillingTab";

export default function PathologyEditInvoicePage() {
  const { id: invoiceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clinicId, userData, isLoading: authLoading } = useAuthContext();
  const branchId = userData?.branchId ?? null;

  const [invoice, setInvoice] = useState<PathologyBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!invoiceId || authLoading || !clinicId) return;

      try {
        setLoading(true);

        const invoiceData =
          await pathologyBillingService.getBillingById(invoiceId);

        if (!invoiceData) {
          setError("Invoice not found");

          return;
        }

        if (invoiceData.clinicId !== clinicId) {
          setError("This invoice does not belong to your clinic.");

          return;
        }

        setInvoice(invoiceData);
      } catch (err: any) {
        console.error("Error loading invoice for edit:", err);
        setError(err?.message || "Failed to load invoice.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [invoiceId, authLoading, clinicId]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!clinicId) {
    return <DashboardNotFoundPage />;
  }

  if (error || !invoice) {
    return (
      <div className="bg-surface border border-border-base rounded p-12 text-center">
        <h3 className="text-[15px] font-semibold text-text-main mb-1">
          Error Loading Invoice
        </h3>
        <p className="text-[13.5px] text-text-muted mb-6">
          {error || "Invoice not found"}
        </p>
        <Button
          color="primary"
          onClick={() => navigate("/dashboard/pathology?tab=billing")}
        >
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col justify-between items-start gap-4">
        <div>
          <h1 className={title({ size: "sm" })}>Edit Pathology Invoice</h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Invoice:{" "}
            <span className="font-semibold text-text-main">
              {invoice.invoiceNumber}
            </span>
          </p>
        </div>
        <Button
          startContent={<IoArrowBackOutline />}
          variant="bordered"
          onClick={() => navigate(`/dashboard/pathology-billing/${invoice.id}`)}
        >
          Back
        </Button>
      </div>

      <PathologyBillingTab
        branchId={branchId || clinicId}
        clinicId={clinicId}
        hideTabBar
        initialEditInvoiceId={invoice.id}
        onEditComplete={() =>
          // PathologyBillingTab already shows its own success toast on save
          // (and none on cancel) — this only needs to navigate back.
          navigate(`/dashboard/pathology-billing/${invoice.id}`)
        }
      />
    </div>
  );
}
