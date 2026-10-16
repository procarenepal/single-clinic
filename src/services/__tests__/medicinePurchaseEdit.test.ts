import { describe, it, expect } from "vitest";

import pharmacyService from "../pharmacyService";

describe("pharmacyService.updateMedicinePurchase", () => {
  it("refuses items and amounts before touching Firestore", async () => {
    await expect(
      pharmacyService.updateMedicinePurchase("any-purchase", {
        items: [],
        netAmount: 1,
        paymentNote: "fine",
      } as any),
    ).rejects.toThrow(/cannot be edited \(items, netAmount\)/);
  });
});
