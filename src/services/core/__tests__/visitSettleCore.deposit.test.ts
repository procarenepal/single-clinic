import { describe, it, expect } from "vitest";

import { splitDepositApplication } from "../visitSettleCore";

describe("splitDepositApplication", () => {
  it("applies a credit-funded deposit without touching the wallet again", () => {
    // NPR 500 of standing credit covered the whole consultation at check-in.
    expect(
      splitDepositApplication({ depositedAmount: 500, depositFromCredit: 500, total: 500 }),
    ).toEqual({ creditPart: 500, walletPart: 0, creditExcess: 0 });
  });

  it("deducts only the cash share still held in the wallet", () => {
    expect(
      splitDepositApplication({ depositedAmount: 700, depositFromCredit: 0, total: 700 }),
    ).toEqual({ creditPart: 0, walletPart: 700, creditExcess: 0 });
  });

  it("uses the credit share first, then the held cash, up to the invoice total", () => {
    // 300 credit + 400 cash deposited; invoice ends at 600.
    expect(
      splitDepositApplication({ depositedAmount: 700, depositFromCredit: 300, total: 600 }),
    ).toEqual({ creditPart: 300, walletPart: 300, creditExcess: 0 });
  });

  it("returns credit the invoice did not need", () => {
    // 500 credit taken at check-in; a discount brought the invoice to 350.
    expect(
      splitDepositApplication({ depositedAmount: 500, depositFromCredit: 500, total: 350 }),
    ).toEqual({ creditPart: 350, walletPart: 0, creditExcess: 150 });
  });

  it("never counts more credit than was deposited, and tolerates garbage", () => {
    expect(
      splitDepositApplication({ depositedAmount: 200, depositFromCredit: 900, total: 200 }),
    ).toEqual({ creditPart: 200, walletPart: 0, creditExcess: 0 });
    expect(
      splitDepositApplication({ depositedAmount: 0, depositFromCredit: 0, total: 0 }),
    ).toEqual({ creditPart: 0, walletPart: 0, creditExcess: 0 });
  });
});
