import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { YTokenErrors } from "../../../helpers/errors";
import { TenTokens } from "../../../helpers/constants";

export default function shouldBehaveLikeWithdrawCollateral(): void {
  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.brad).openVault(this.stubs.yToken.address);
    });

    describe("when the amount to withdraw is not zero", function () {
      describe("when the caller deposited collateral", function () {
        beforeEach(async function () {
          await this.stubs.fintroller.mock.depositCollateralAllowed.withArgs(this.stubs.yToken.address).returns(true);
          await this.stubs.collateral.mock.transferFrom
            .withArgs(this.accounts.brad, this.contracts.balanceSheet.address, TenTokens)
            .returns(true);
          await this.contracts.balanceSheet
            .connect(this.signers.brad)
            .depositCollateral(this.stubs.yToken.address, TenTokens);
        });

        describe("when the caller did not lock the collateral", function () {
          beforeEach(async function () {
            await this.stubs.collateral.mock.transfer.withArgs(this.accounts.brad, TenTokens).returns(true);
          });

          it("makes the collateral withdrawal", async function () {
            await this.contracts.balanceSheet
              .connect(this.signers.brad)
              .withdrawCollateral(this.stubs.yToken.address, TenTokens);
          });

          it("emits a WithdrawCollateral event", async function () {
            await expect(
              this.contracts.balanceSheet
                .connect(this.signers.brad)
                .withdrawCollateral(this.stubs.yToken.address, TenTokens),
            )
              .to.emit(this.contracts.balanceSheet, "WithdrawCollateral")
              .withArgs(this.stubs.yToken.address, this.accounts.brad, TenTokens);
          });
        });

        describe("when the caller locked the collateral", function () {
          beforeEach(async function () {
            await this.contracts.balanceSheet
              .connect(this.signers.brad)
              .lockCollateral(this.stubs.yToken.address, TenTokens);
          });

          it("reverts", async function () {
            await expect(
              this.contracts.balanceSheet
                .connect(this.signers.brad)
                .withdrawCollateral(this.stubs.yToken.address, TenTokens),
            ).to.be.revertedWith(YTokenErrors.WithdrawCollateralInsufficientFreeCollateral);
          });
        });
      });

      describe("when the caller did not deposit any collateral", function () {
        it("reverts", async function () {
          await expect(
            this.contracts.balanceSheet
              .connect(this.signers.brad)
              .withdrawCollateral(this.stubs.yToken.address, TenTokens),
          ).to.be.revertedWith(YTokenErrors.WithdrawCollateralInsufficientFreeCollateral);
        });
      });
    });

    describe("when the amount to withdraw is zero", function () {
      it("reverts", async function () {
        await expect(
          this.contracts.balanceSheet.connect(this.signers.brad).withdrawCollateral(this.stubs.yToken.address, Zero),
        ).to.be.revertedWith(YTokenErrors.WithdrawCollateralZero);
      });
    });
  });

  describe("when the vault is not open", function () {
    it("reverts", async function () {
      await expect(
        this.contracts.balanceSheet.connect(this.signers.brad).withdrawCollateral(this.stubs.yToken.address, TenTokens),
      ).to.be.revertedWith(YTokenErrors.VaultNotOpen);
    });
  });
}