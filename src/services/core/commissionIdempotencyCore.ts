/**
 * Every commission-creation path (clinicianCommissionService,
 * staffCommissionService, referralCommissionService) used to check for a
 * duplicate with a query, then create with `addDoc` (an auto-generated id)
 * as two separate network round trips: read, decide, write. Two concurrent
 * calls for the same invoice+clinician — a retried request, a double
 * click before a button disables, two staff members racing the same
 * payment screen — could both see "no existing commission" before either
 * had written one, minting two payouts for the same work.
 *
 * The fix is a deterministic document id derived from what the commission
 * is FOR, so "does one already exist" becomes a single `get` by id inside
 * a transaction instead of a query — Firestore's optimistic concurrency
 * control then makes a duplicate attempt structurally impossible: a second
 * transaction racing the first is forced to retry, and on retry it sees
 * the document the first transaction just created and no-ops.
 */

/** Deterministic commission doc id for one clinician's payout on one
 * anchor (an invoice, or — before any invoice exists — a registration). */
export function commissionDocId(anchorId: string, entityId: string): string {
  return `${anchorId}_${entityId}`;
}

/**
 * The anchor for a commission created at patient registration, before any
 * billing/invoice document exists to key off of. Stable per registration
 * event (a patient id is minted once, right before this runs) — a retried
 * or duplicated registration-commission call collides on this and is
 * correctly treated as the same commission, not two.
 */
export function registrationAnchorId(patientId: string): string {
  return `reg_${patientId}`;
}
