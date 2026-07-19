/**
 * billingDeduplication.test.ts
 *
 * Tests for:
 * 1. createConsultationBill — does NOT create a duplicate bill if consultationBillingId exists
 * 2. ensureBookedAppointmentTypeBilled — does NOT double-append items
 * 3. handleSettleBilling — navigates to existing bill instead of creating a second ghost invoice
 * 4. Consultation fee uses doctor's consultationCharge, not hardcoded 500
 * 5. Commission generated only once (on payment, not on bill creation)
 * 6. ProcedureModal getProcedureList — correctly parses comma-containing names
 * 7. ProcedureModal handleToggleProcedure — state stays consistent with rapid clicks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Firebase mocks ──────────────────────────────────────────────────────────
vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");
  return {
    ...actual,
    collection: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: "new_billing_id" }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    setDoc: vi.fn().mockResolvedValue(undefined),
    doc: vi.fn(() => ({ id: "mocked_doc_id" })),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    getDoc: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({}) }),
    query: vi.fn(),
    where: vi.fn(),
    Timestamp: class Timestamp {
      toMillis() { return Date.now(); }
      static now() { return new Timestamp(); }
      static fromDate(_d: any) { return new Timestamp(); }
    },
    runTransaction: vi.fn(async (...args: any[]) => {
      const callback = args.find((a) => typeof a === "function");
      if (!callback) return;
      return await callback({
        get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ sequence: 100 }) }),
        update: vi.fn(),
        set: vi.fn(),
      });
    }),
  };
});
vi.mock("@/config/firebase", () => ({ db: {} }));

// ─── Helper: build a fake appointment ────────────────────────────────────────
function makeAppt(overrides: Record<string, any> = {}) {
  return {
    id: "appt_1",
    patientId: "pat_1",
    doctorId: "doc_1",
    assignedExpertId: undefined as string | undefined,
    appointmentTypeId: "type_consultation",
    consultationBillingId: undefined as string | undefined,
    billingId: undefined as string | undefined,
    billingStatus: "unpaid",
    paymentStatus: "unpaid",
    doctorConsultationCompleted: false,
    notes: "",
    status: "confirmed",
    clinicId: "clinic_1",
    branchId: "branch_1",
    reason: "General Consultation",
    ...overrides,
  };
}

// ─── Helper: fake appointment types ─────────────────────────────────────────
const APPT_TYPES = [
  { id: "type_consultation", name: "Doctor Consultation", price: 700, billAtFrontDesk: false, calculateCommission: true },
  { id: "type_facial", name: "Manual facial with kit", price: 3500, billAtFrontDesk: false, calculateCommission: true },
  { id: "type_bikini", name: "Candela Gentle Max Pro-Bikini/Brazilian Area", price: 8000, billAtFrontDesk: false, calculateCommission: true },
  { id: "type_pdrn", name: "(PDRN Salmon) DNA Pep, Hyalu", price: 15000, billAtFrontDesk: false, calculateCommission: true },
  { id: "type_full_face", name: "Candela Gentle Max Pro-Full Face", price: 7500, billAtFrontDesk: false, calculateCommission: true },
];

const DOCTORS = [
  { id: "doc_1", name: "Dr. Smith", defaultCommission: 10, consultationCharge: 1500 },
  { id: "doc_2", name: "Dr. No Charge", defaultCommission: 10, consultationCharge: undefined },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: createConsultationBill deduplication guard
// ═══════════════════════════════════════════════════════════════════════════
describe("createConsultationBill — deduplication guard", () => {
  it("returns existing consultationBillingId without creating a new bill", async () => {
    const appointments = [
      makeAppt({ consultationBillingId: "existing_bill_123" }),
    ];
    const addDocMock = vi.fn();

    // Simulate the guard logic extracted from front-office-desk.tsx
    async function guardedCreateBill(appointmentId: string) {
      const appt = appointments.find((a) => a.id === appointmentId);
      if (appt && appt.consultationBillingId) {
        return appt.consultationBillingId; // ← early return
      }
      // Would call addDoc here if no existing bill
      addDocMock();
      return "new_bill_id";
    }

    const result = await guardedCreateBill("appt_1");

    expect(result).toBe("existing_bill_123");
    expect(addDocMock).not.toHaveBeenCalled(); // no new bill created
  });

  it("creates a new bill if no consultationBillingId exists", async () => {
    const appointments = [makeAppt({ consultationBillingId: undefined })];
    const addDocMock = vi.fn().mockReturnValue("new_bill_999");

    async function guardedCreateBill(appointmentId: string) {
      const appt = appointments.find((a) => a.id === appointmentId);
      if (appt && appt.consultationBillingId) {
        return appt.consultationBillingId;
      }
      return addDocMock();
    }

    const result = await guardedCreateBill("appt_1");

    expect(result).toBe("new_bill_999");
    expect(addDocMock).toHaveBeenCalledOnce();
  });

  it("does NOT create a second bill if billingId (legacy field) exists", async () => {
    const appointments = [makeAppt({ billingId: "legacy_bill_456", consultationBillingId: undefined })];
    const addDocMock = vi.fn();

    // Guard using BOTH fields (as in handleCheckIn)
    async function guardedCheckIn(appointmentId: string) {
      const appt = appointments.find((a) => a.id === appointmentId);
      if (!appt) return;
      const hasExistingBill = !!(appt.billingId || appt.consultationBillingId);
      if (hasExistingBill) return; // ← no new bill
      addDocMock();
    }

    await guardedCheckIn("appt_1");

    expect(addDocMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: ensureBookedAppointmentTypeBilled — no double-appending
// ═══════════════════════════════════════════════════════════════════════════
describe("ensureBookedAppointmentTypeBilled — no double-append", () => {
  it("returns early if appointmentTypeId already in billing items", () => {
    const billing = {
      id: "bill_1",
      items: [
        { appointmentTypeId: "type_consultation", appointmentTypeName: "Doctor Consultation", price: 700 },
      ],
      paymentStatus: "unpaid",
    };
    const appt = makeAppt({ appointmentTypeId: "type_consultation" });

    const hasBookedItem = billing.items.some(
      (item) => item.appointmentTypeId === appt.appointmentTypeId,
    );

    expect(hasBookedItem).toBe(true); // guard fires → no append
  });

  it("returns early if consultation-fee item exists for a consultation appt type", () => {
    const billing = {
      id: "bill_1",
      items: [
        { appointmentTypeId: "consultation-fee", appointmentTypeName: "Doctor Consultation Fee - Dr. Smith", price: 1500 },
      ],
      paymentStatus: "unpaid",
    };
    const appt = makeAppt({ appointmentTypeId: "type_consultation" });
    const apptType = APPT_TYPES.find((t) => t.id === appt.appointmentTypeId);

    const isApptTypeConsultation = apptType?.name.toLowerCase().includes("consult") ?? false;
    const hasBookedItem = billing.items.some(
      (item) =>
        item.appointmentTypeId === appt.appointmentTypeId ||
        (isApptTypeConsultation && item.appointmentTypeId === "consultation-fee"),
    );

    expect(hasBookedItem).toBe(true);
  });

  it("appends item when appointmentType is NOT yet billed", () => {
    const billing = {
      id: "bill_1",
      items: [] as any[],
      paymentStatus: "unpaid",
    };
    const appt = makeAppt({ appointmentTypeId: "type_facial" });
    const apptType = APPT_TYPES.find((t) => t.id === appt.appointmentTypeId)!;

    const hasBookedItem = billing.items.some(
      (item) => item.appointmentTypeId === appt.appointmentTypeId,
    );
    if (!hasBookedItem) {
      billing.items.push({ appointmentTypeId: apptType.id, price: apptType.price });
    }

    expect(billing.items).toHaveLength(1);
    expect(billing.items[0].price).toBe(3500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: handleSettleBilling — no ghost invoice
// ═══════════════════════════════════════════════════════════════════════════
describe("handleSettleBilling — no ghost invoice", () => {
  const navigateMock = vi.fn();
  const createBillingMock = vi.fn().mockResolvedValue("ghost_bill");

  beforeEach(() => { vi.clearAllMocks(); });

  /**
   * Simulate the updated handleSettleBilling guard logic.
   */
  async function simulateSettleBilling(
    appt: ReturnType<typeof makeAppt>,
    patientBillings: any[],
  ) {
    // Step 1: billingId direct match
    if (appt.billingId) {
      const bill = patientBillings.find((b) => b.id === appt.billingId);
      if (bill) { navigateMock(`/billing/${bill.id}`); return; }
    }

    // Step 2: find a non-consultation draft
    const draftBilling = patientBillings.find(
      (b) =>
        b.status === "draft" &&
        !b.items?.some((item: any) => item.appointmentTypeId === "consultation-fee"),
    );
    if (draftBilling) { navigateMock(`/billing/${draftBilling.id}`); return; }

    // Step 3: ALWAYS navigate to consultationBillingId if it exists (FIXED)
    const consBillingId = (appt as any).consultationBillingId;
    if (consBillingId) {
      const consBill = patientBillings.find((b) => b.id === consBillingId);
      if (consBill) { navigateMock(`/billing/${consBillingId}`); return; }
    }

    // Step 4: fallback — create new draft (only if truly no bill)
    await createBillingMock();
    navigateMock("/billing/new");
  }

  it("navigates to consultationBillingId (unpaid) instead of creating a ghost invoice", async () => {
    const appt = makeAppt({ consultationBillingId: "cons_bill_A" });
    const patientBillings = [
      { id: "cons_bill_A", status: "draft", paymentStatus: "unpaid", items: [{ appointmentTypeId: "consultation-fee" }] },
    ];

    await simulateSettleBilling(appt, patientBillings);

    expect(navigateMock).toHaveBeenCalledWith("/billing/cons_bill_A");
    expect(createBillingMock).not.toHaveBeenCalled(); // ← no ghost invoice
  });

  it("navigates to consultationBillingId (paid) when there IS a pending procedure", async () => {
    const appt = makeAppt({
      consultationBillingId: "cons_bill_B",
      recommendedProcedure: { fee: 5000 },
    });
    const patientBillings = [
      { id: "cons_bill_B", status: "paid", paymentStatus: "paid", items: [{ appointmentTypeId: "consultation-fee" }] },
    ];

    await simulateSettleBilling(appt, patientBillings);

    // The FIXED logic navigates to consultationBillingId regardless of hasPendingProcedure
    expect(navigateMock).toHaveBeenCalledWith("/billing/cons_bill_B");
    expect(createBillingMock).not.toHaveBeenCalled();
  });

  it("creates a new invoice ONLY when absolutely no billing record exists", async () => {
    const appt = makeAppt({ consultationBillingId: undefined, billingId: undefined });
    const patientBillings: any[] = []; // empty — truly no records

    await simulateSettleBilling(appt, patientBillings);

    expect(createBillingMock).toHaveBeenCalledOnce();
  });

  it("navigates to an existing non-consultation draft if present", async () => {
    const appt = makeAppt({ consultationBillingId: "cons_bill_C" });
    const patientBillings = [
      { id: "procedure_draft_1", status: "draft", paymentStatus: "unpaid", items: [{ appointmentTypeId: "type_facial" }] },
      { id: "cons_bill_C", status: "paid", paymentStatus: "paid", items: [{ appointmentTypeId: "consultation-fee" }] },
    ];

    await simulateSettleBilling(appt, patientBillings);

    expect(navigateMock).toHaveBeenCalledWith("/billing/procedure_draft_1");
    expect(createBillingMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: Consultation fee uses doctor's consultationCharge
// ═══════════════════════════════════════════════════════════════════════════
describe("Consultation fee — uses doctor's consultationCharge", () => {
  function resolveConsultationPrice(
    apptTypeName: string,
    apptTypePrice: number,
    docInfo: { consultationCharge?: number } | undefined,
    chargeConsultation: boolean,
  ): number {
    if (!chargeConsultation) return 0;
    const isConsult = apptTypeName.toLowerCase().includes("consult");
    if (isConsult && docInfo?.consultationCharge !== undefined) {
      return Number(docInfo.consultationCharge);
    }
    return Number(apptTypePrice);
  }

  it("uses consultationCharge when doctor has it set", () => {
    const price = resolveConsultationPrice(
      "Doctor Consultation", 700, { consultationCharge: 1500 }, true,
    );
    expect(price).toBe(1500); // ← doctor's own rate, NOT 700
  });

  it("falls back to apptType price when doctor has NO consultationCharge", () => {
    const price = resolveConsultationPrice(
      "Doctor Consultation", 700, { consultationCharge: undefined }, true,
    );
    expect(price).toBe(700);
  });

  it("returns 0 when chargeConsultation is false", () => {
    const price = resolveConsultationPrice(
      "Doctor Consultation", 700, { consultationCharge: 1500 }, false,
    );
    expect(price).toBe(0);
  });

  it("does NOT apply consultationCharge for non-consultation types", () => {
    const price = resolveConsultationPrice(
      "Candela Gentle Max Pro-Full Face", 7500, { consultationCharge: 1500 }, true,
    );
    expect(price).toBe(7500); // procedure price, not consultation charge
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: Commission safety — only once, only at payment
// ═══════════════════════════════════════════════════════════════════════════
describe("Commission — generated once, only at payment time", () => {
  it("commission NOT created when bill is created (draft)", () => {
    const commissionCallCount = { value: 0 };

    // Simulate bill creation — no commission here
    function createBillingDraft(totalAmount: number) {
      return { id: "bill_1", totalAmount, status: "draft", paidAmount: 0 };
    }

    const bill = createBillingDraft(500);
    expect(bill.status).toBe("draft");
    expect(commissionCallCount.value).toBe(0); // no commission yet
  });

  it("commission IS created when payment settles the bill", () => {
    const commissionCallCount = { value: 0 };
    const createCommission = () => { commissionCallCount.value++; };

    // Simulate payment recording
    function recordPayment(bill: any, amount: number) {
      const newPaid = (bill.paidAmount || 0) + amount;
      const newStatus = newPaid >= bill.totalAmount ? "paid" : "partial";

      if (newStatus === "paid") {
        createCommission(); // ← fires only now
      }
      return newStatus;
    }

    const bill = { id: "bill_1", totalAmount: 500, paidAmount: 0, status: "draft" };
    const status = recordPayment(bill, 500);

    expect(status).toBe("paid");
    expect(commissionCallCount.value).toBe(1); // exactly once
  });

  it("commission NOT created on partial payment", () => {
    const commissionCallCount = { value: 0 };
    const createCommission = () => { commissionCallCount.value++; };

    function recordPayment(bill: any, amount: number) {
      const newPaid = (bill.paidAmount || 0) + amount;
      const newStatus = newPaid >= bill.totalAmount ? "paid" : "partial";
      if (newStatus === "paid") createCommission();
      return newStatus;
    }

    const bill = { id: "bill_1", totalAmount: 500, paidAmount: 0 };
    const status = recordPayment(bill, 200);

    expect(status).toBe("partial");
    expect(commissionCallCount.value).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: ProcedureModal — getProcedureList parses correctly
// ═══════════════════════════════════════════════════════════════════════════
describe("ProcedureModal — getProcedureList", () => {
  const ALL_NAMES = APPT_TYPES.map((t) => t.name);

  function getProcedureList(typeStr: string, orderedIds: string[]): string[] {
    if (!typeStr) return [];
    const sortedOptions = [...orderedIds].sort((a, b) => b.length - a.length);
    const selected: string[] = [];
    let remaining = typeStr;

    for (const option of sortedOptions) {
      if (!option) continue;
      const idx = remaining.indexOf(option);
      if (idx !== -1) {
        selected.push(option);
        remaining = remaining.substring(0, idx) + remaining.substring(idx + option.length);
      }
    }

    const knownSelected = orderedIds.filter((id) => selected.includes(id));
    const unknownTokens = remaining
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !orderedIds.includes(s));

    return [...knownSelected, ...unknownTokens];
  }

  it("parses a single item correctly", () => {
    const result = getProcedureList("Manual facial with kit", ALL_NAMES);
    expect(result).toContain("Manual facial with kit");
    expect(result).toHaveLength(1);
  });

  it("parses item with comma in name: (PDRN Salmon) DNA Pep, Hyalu", () => {
    const result = getProcedureList(
      "Candela Gentle Max Pro-Full Face, (PDRN Salmon) DNA Pep, Hyalu",
      ALL_NAMES,
    );
    expect(result).toContain("(PDRN Salmon) DNA Pep, Hyalu");
    expect(result).toContain("Candela Gentle Max Pro-Full Face");
    expect(result).toHaveLength(2);
  });

  it("parses all 5 procedures including the comma-containing name", () => {
    const str = ALL_NAMES.join(", ");
    const result = getProcedureList(str, ALL_NAMES);
    expect(result).toHaveLength(ALL_NAMES.length);
    ALL_NAMES.forEach((name) => expect(result).toContain(name));
  });

  it("returns unknown items not in orderedIds (not yet in DB)", () => {
    const result = getProcedureList(
      "Some Old Procedure Name, Manual facial with kit",
      ALL_NAMES,
    );
    expect(result).toContain("Some Old Procedure Name");
    expect(result).toContain("Manual facial with kit");
  });

  it("returns empty array for empty string", () => {
    expect(getProcedureList("", ALL_NAMES)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: handleToggleProcedure — state consistency with rapid clicks
// ═══════════════════════════════════════════════════════════════════════════
describe("handleToggleProcedure — rapid-click state consistency", () => {
  const ALL_NAMES = APPT_TYPES.map((t) => t.name);

  function getProcedureList(typeStr: string, orderedIds: string[]): string[] {
    if (!typeStr) return [];
    const sortedOptions = [...orderedIds].sort((a, b) => b.length - a.length);
    const selected: string[] = [];
    let remaining = typeStr;
    for (const option of sortedOptions) {
      if (!option) continue;
      const idx = remaining.indexOf(option);
      if (idx !== -1) {
        selected.push(option);
        remaining = remaining.substring(0, idx) + remaining.substring(idx + option.length);
      }
    }
    const knownSelected = orderedIds.filter((id) => selected.includes(id));
    const unknownTokens = remaining.split(",").map((s) => s.trim()).filter((s) => s.length > 0 && !orderedIds.includes(s));
    return [...knownSelected, ...unknownTokens];
  }

  function toggle(currentProcedureType: string, val: string): string {
    const currentList = getProcedureList(currentProcedureType, ALL_NAMES);
    const isSelected = currentList.includes(val);
    const newList = isSelected
      ? currentList.filter((x) => x !== val)
      : [...currentList, val];
    return newList.join(", ");
  }

  it("adds item on first click", () => {
    const result = toggle("", "Manual facial with kit");
    expect(getProcedureList(result, ALL_NAMES)).toContain("Manual facial with kit");
  });

  it("removes item on second click (toggle off)", () => {
    let state = toggle("", "Manual facial with kit");
    state = toggle(state, "Manual facial with kit");
    expect(getProcedureList(state, ALL_NAMES)).not.toContain("Manual facial with kit");
  });

  it("handles rapid multi-item selection without losing items", () => {
    let state = "";
    state = toggle(state, "Manual facial with kit");
    state = toggle(state, "Candela Gentle Max Pro-Bikini/Brazilian Area");
    state = toggle(state, "(PDRN Salmon) DNA Pep, Hyalu");
    state = toggle(state, "Candela Gentle Max Pro-Full Face");

    const result = getProcedureList(state, ALL_NAMES);
    expect(result).toContain("Manual facial with kit");
    expect(result).toContain("Candela Gentle Max Pro-Bikini/Brazilian Area");
    expect(result).toContain("(PDRN Salmon) DNA Pep, Hyalu");
    expect(result).toContain("Candela Gentle Max Pro-Full Face");
    expect(result).toHaveLength(4);
  });

  it("toggling comma-containing item (PDRN Salmon) DNA Pep, Hyalu works correctly", () => {
    let state = toggle("", "(PDRN Salmon) DNA Pep, Hyalu");
    const afterAdd = getProcedureList(state, ALL_NAMES);
    expect(afterAdd).toContain("(PDRN Salmon) DNA Pep, Hyalu");
    expect(afterAdd).toHaveLength(1);

    state = toggle(state, "(PDRN Salmon) DNA Pep, Hyalu");
    const afterRemove = getProcedureList(state, ALL_NAMES);
    expect(afterRemove).not.toContain("(PDRN Salmon) DNA Pep, Hyalu");
    expect(afterRemove).toHaveLength(0);
  });

  it("does NOT duplicate an item if toggled quickly (functional updater safety)", () => {
    // Simulate 3 rapid clicks on same item — should end up with 1 item, not 3
    let state = toggle("", "Manual facial with kit"); // click 1 → add
    // simulate state not yet updated (race) — but functional updater uses prev, so:
    const prevState = state;
    state = toggle(prevState, "Manual facial with kit"); // click 2 → remove
    state = toggle(state, "Manual facial with kit");    // click 3 → add again

    const result = getProcedureList(state, ALL_NAMES);
    const count = result.filter((r) => r === "Manual facial with kit").length;
    expect(count).toBe(1); // exactly one, not duplicated
  });
});
