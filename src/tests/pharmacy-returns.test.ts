import { describe, it, expect } from "vitest";

// Replicating the logic from src/pages/dashboard/pharmacy.tsx to test correctness of Sales Return math
function calculatePharmacyDashboardSummary(purchases: any[]) {
  const totalSales = purchases.reduce((sum, purchase) => {
    const returnedAmount =
      purchase.totalReturnedAmount && purchase.totalReturnedAmount > 0
        ? purchase.totalReturnedAmount
        : (purchase.returns ?? []).reduce(
            (retSum: number, r: any) => retSum + Math.abs(r.totalAmount || 0),
            0
          );
    return sum + Math.max(0, (purchase.netAmount || 0) - returnedAmount);
  }, 0);

  const totalItems = purchases.reduce((sum, purchase) => {
    const returnedQty = (purchase.returns ?? []).reduce(
      (retSum: number, r: any) => {
        return (
          retSum +
          (r.items ?? []).reduce(
            (iSum: number, i: any) => iSum + (i.quantity || 0),
            0
          )
        );
      },
      0
    );
    const purchasedQty = purchase.items.reduce(
      (itemSum: number, item: any) => itemSum + item.quantity,
      0
    );
    return sum + Math.max(0, purchasedQty - returnedQty);
  }, 0);

  return { totalSales, totalItems };
}

describe("Pharmacy Sell Return Calculations", () => {
  it("should calculate total sales and items correctly without returns", () => {
    const purchases = [
      {
        netAmount: 1000,
        items: [{ quantity: 2 }, { quantity: 3 }],
        returns: [],
      },
    ];

    const result = calculatePharmacyDashboardSummary(purchases);

    expect(result.totalSales).toBe(1000);
    expect(result.totalItems).toBe(5);
  });

  it("should deduct returned amounts and quantities correctly when a return exists", () => {
    const purchases = [
      {
        netAmount: 1000, // Total was 1000
        items: [{ quantity: 2 }, { quantity: 3 }], // 5 items total
        returns: [
          {
            totalAmount: -200, // They returned 1 item worth 200
            items: [{ quantity: 1 }],
          },
        ],
      },
    ];

    const result = calculatePharmacyDashboardSummary(purchases);

    // netAmount (1000) - returnedAmount (200) = 800
    expect(result.totalSales).toBe(800);
    // items (5) - returnedQty (1) = 4
    expect(result.totalItems).toBe(4);
  });

  it("should handle totalReturnedAmount property directly if populated", () => {
    const purchases = [
      {
        netAmount: 1000,
        totalReturnedAmount: 250, // Passed directly on the purchase object
        items: [{ quantity: 4 }], // 4 items total
        returns: [
          {
            // The logic prioritizes totalReturnedAmount if > 0, but still uses returns array for qty
            totalAmount: -250,
            items: [{ quantity: 1 }],
          },
        ],
      },
    ];

    const result = calculatePharmacyDashboardSummary(purchases);

    // netAmount (1000) - returnedAmount (250) = 750
    expect(result.totalSales).toBe(750);
    // items (4) - returnedQty (1) = 3
    expect(result.totalItems).toBe(3);
  });

  it("should floor at 0 if returns somehow exceed the purchase amounts (defense against negative stats)", () => {
    const purchases = [
      {
        netAmount: 500,
        items: [{ quantity: 1 }],
        returns: [
          {
            totalAmount: -600, // Exceeds netAmount
            items: [{ quantity: 2 }], // Exceeds purchased qty
          },
        ],
      },
    ];

    const result = calculatePharmacyDashboardSummary(purchases);

    // Should not drop below 0
    expect(result.totalSales).toBe(0);
    expect(result.totalItems).toBe(0);
  });

  it("should calculate correctly across multiple purchases with and without returns", () => {
    const purchases = [
      {
        netAmount: 500, // No returns
        items: [{ quantity: 10 }],
      },
      {
        netAmount: 800, // With returns
        items: [{ quantity: 4 }],
        returns: [
          {
            totalAmount: -300,
            items: [{ quantity: 2 }],
          },
        ],
      },
      {
        netAmount: 1200, // Fully returned
        items: [{ quantity: 5 }],
        returns: [
          {
            totalAmount: -1200,
            items: [{ quantity: 5 }],
          },
        ],
      },
    ];

    const result = calculatePharmacyDashboardSummary(purchases);

    // Sales: 500 + (800-300) + (1200-1200) = 500 + 500 + 0 = 1000
    expect(result.totalSales).toBe(1000);
    
    // Items: 10 + (4-2) + (5-5) = 10 + 2 + 0 = 12
    expect(result.totalItems).toBe(12);
  });
});
