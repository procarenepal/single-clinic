import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * getInvoiceByNumber is the lynchpin of the "never mark an unfiled sale as
 * IRD-synced" guarantee: callers treat a null result as "this sale has no
 * ledger row" and refuse to touch irdSynced. If it ever returned something
 * truthy on an error, or swallowed a real outage as "not found" in a way
 * callers misread, that guarantee silently breaks — so its contract is
 * pinned here.
 */

const mockGet = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: vi.fn(),
      interceptors: { request: { use: vi.fn() } },
    }),
  },
}));

vi.mock("@/config/firebase", () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue("t") } },
}));
vi.mock("../../../config/firebase", () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue("t") } },
}));

describe("billingApi.getInvoiceByNumber — fail-closed ledger lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the ledger row when one exists", async () => {
    const { billingApi } = await import("../billingApi");

    mockGet.mockResolvedValueOnce({
      data: { id: 42, invoiceNumber: "INV-2083.084-0001", irdSynced: true },
    });

    const row = await billingApi.getInvoiceByNumber("INV-2083.084-0001");

    expect(row?.id).toBe(42);
  });

  it("returns null on 404 — the signal that a sale was never filed", async () => {
    const { billingApi } = await import("../billingApi");

    mockGet.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(
      billingApi.getInvoiceByNumber("INV-NOT-FILED"),
    ).resolves.toBeNull();
  });

  it("returns null rather than undefined when the backend answers with an empty body", async () => {
    const { billingApi } = await import("../billingApi");

    mockGet.mockResolvedValueOnce({ data: null });

    await expect(billingApi.getInvoiceByNumber("INV-X")).resolves.toBeNull();
  });

  it("THROWS on a non-404 failure instead of reporting 'not filed'", async () => {
    const { billingApi } = await import("../billingApi");

    // A backend outage must never be mistaken for "no ledger row" — that
    // would let a caller conclude a filed sale was unfiled.
    mockGet.mockRejectedValueOnce({ response: { status: 500 } });

    await expect(billingApi.getInvoiceByNumber("INV-Y")).rejects.toBeDefined();
  });

  it("THROWS on a network error with no response at all", async () => {
    const { billingApi } = await import("../billingApi");

    mockGet.mockRejectedValueOnce(new Error("Network Error"));

    await expect(billingApi.getInvoiceByNumber("INV-Z")).rejects.toThrow(
      "Network Error",
    );
  });
});
