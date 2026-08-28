import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { IoPrintOutline } from "react-icons/io5";

/**
 * Embedded billing/IRD user manual — required by IRD's Electronic Billing
 * Procedure ("a help file or user manual available in Nepali or English,
 * both in print and embedded within the software"). This page is both:
 * printable (via the Print button, using the browser's native print) and
 * embedded (reachable from within the app itself, not an external document).
 */
export default function BillingHelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h1 className="text-xl font-semibold">Billing &amp; IRD Sync — User Manual</h1>
        <Button
          color="primary"
          startContent={<IoPrintOutline />}
          variant="flat"
          onPress={() => window.print()}
        >
          Print
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <h2 className="text-lg font-semibold">Billing &amp; IRD (CBMS) Sync — User Manual</h2>
          <p className="text-sm text-default-500">
            Covers invoice creation, IRD synchronization, reprints, cancellation, and credit notes.
          </p>
        </CardHeader>
        <CardBody className="space-y-6 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold mb-1">1. Creating an Invoice</h3>
            <p>
              Invoices are created automatically when an appointment, pathology test, or
              pharmacy sale is finalized. Each invoice is assigned a sequential invoice
              number in the format <code>INV-{"{fiscal year}"}-{"{0000}"}</code>, unique
              per clinic and Nepali fiscal year. Invoice numbers are never reused or
              skipped, and are assigned automatically — staff do not choose or edit them.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">2. IRD Synchronization</h3>
            <p>
              If IRD sync is enabled in Clinic Settings, every finalized invoice is sent
              to the Government of Nepal's Central Billing Monitoring System (CBMS)
              automatically at the moment of creation. The invoice record shows whether
              the sync succeeded, and the response code returned by IRD.
            </p>
            <p className="mt-2">
              If a sync attempt fails (e.g. network issue, IRD outage), the system
              automatically retries with increasing delays (1 minute, 5 minutes, 30
              minutes, 2 hours, then 12 hours). After 5 failed attempts, the invoice is
              flagged <strong>&quot;Needs Manual Review&quot;</strong> and stops
              retrying automatically — a staff member should use the{" "}
              <strong>Retry Sync</strong> action once the underlying issue (credentials,
              connectivity) is resolved.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">3. Reprinting an Invoice</h3>
            <p>
              An invoice can be printed at any time from its detail view. The first
              print is the original. Every print after that is automatically marked{" "}
              <strong>&quot;COPY OF ORIGINAL – N&quot;</strong> at the top of the
              printout, where N counts which reprint this is (1st, 2nd, 3rd, and so
              on) — this happens automatically and cannot be turned off, per IRD
              requirements.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">4. Cancelling an Invoice</h3>
            <p>
              An invoice can only be cancelled before it has been marked as paid or
              finalized. Cancelling requires typing a reason, which is permanently
              recorded on the invoice — a cancellation cannot be completed without one.
              Cancelled invoices are never deleted; they remain visible with a
              &quot;Cancelled&quot; status and the recorded reason.
            </p>
            <p className="mt-2">
              To reverse an invoice that has <em>already</em> been paid and synced to
              IRD, use <strong>Issue Credit Note</strong> instead (see below) — a
              cancellation is not possible at that stage.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">5. Credit Notes (Sales Returns)</h3>
            <p>
              A Credit Note reverses an already IRD-synced invoice — for example, a
              refund or a corrected charge. Issuing one requires a documented reason
              and creates a brand-new invoice record with negative amounts, linked back
              to the original invoice. The original invoice is never edited or deleted
              — it stays exactly as it was submitted to IRD, with a note added showing
              it was reversed by the credit note.
            </p>
            <p className="mt-2">
              The credit note itself is submitted to IRD separately (via IRD's
              sales-return endpoint), and its own sync status is tracked the same way
              as a normal invoice.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">6. Data Retention</h3>
            <p>
              No invoice, invoice line item, or IRD sync record can be deleted from the
              system by any user — this is enforced at the software level, not just by
              policy. Corrections are always made by creating a new record (a
              cancellation note or a credit note), never by editing or removing the
              original.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">7. Support</h3>
            <p>
              For questions about IRD sync failures, credentials, or this manual,
              contact your clinic administrator or ProCare support.
            </p>
          </section>
        </CardBody>
      </Card>
    </div>
  );
}
