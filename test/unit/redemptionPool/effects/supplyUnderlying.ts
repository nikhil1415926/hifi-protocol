import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { FintrollerErrors, GenericErrors, RedemptionPoolErrors } from "../../../../helpers/errors";
import { fintrollerConstants, fyTokenConstants, precisionScalars, tokenAmounts } from "../../../../helpers/constants";
import { getNow } from "../../../../helpers/time";

export default function shouldBehaveLikeSupplyUnderlying(): void {
  const underlyingAmount: BigNumber = tokenAmounts.oneHundred;
  const fyTokenAmount: BigNumber = tokenAmounts.oneHundred;

  describe("when the bond matured", function () {
    beforeEach(async function () {
      const nowMinusOneHour: BigNumber = getNow().sub(3600);
      await this.stubs.fyToken.mock.expirationTime.returns(nowMinusOneHour);
    });

    it("reverts", async function () {
      await expect(
        this.contracts.redemptionPool.connect(this.signers.maker).supplyUnderlying(underlyingAmount),
      ).to.be.revertedWith(GenericErrors.BondMatured);
    });
  });

  describe("when the bond did not mature", function () {
    beforeEach(async function () {
      await this.stubs.fyToken.mock.expirationTime.returns(fyTokenConstants.expirationTime);
    });

    describe("when the amount of underlying to supply is zero", function () {
      it("reverts", async function () {
        const zeroUnderlyingAmount: BigNumber = Zero;
        await expect(
          this.contracts.redemptionPool.connect(this.signers.maker).supplyUnderlying(zeroUnderlyingAmount),
        ).to.be.revertedWith(RedemptionPoolErrors.SupplyUnderlyingZero);
      });
    });

    describe("when the amount of underlying to supply is not zero", function () {
      describe("when the bond is not listed", function () {
        beforeEach(async function () {
          await this.stubs.fintroller.mock.getSupplyUnderlyingAllowed
            .withArgs(this.stubs.fyToken.address)
            .revertsWithReason(FintrollerErrors.BondNotListed);
        });

        it("reverts", async function () {
          await expect(
            this.contracts.redemptionPool.connect(this.signers.maker).supplyUnderlying(underlyingAmount),
          ).to.be.revertedWith(FintrollerErrors.BondNotListed);
        });
      });

      describe("when the bond is listed", function () {
        beforeEach(async function () {
          await this.stubs.fintroller.mock.getBondCollateralizationRatio
            .withArgs(this.stubs.fyToken.address)
            .returns(fintrollerConstants.defaultCollateralizationRatio);
        });

        describe("when the fintroller does not allow supply underlying", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getSupplyUnderlyingAllowed
              .withArgs(this.stubs.fyToken.address)
              .returns(false);
          });

          it("reverts", async function () {
            await expect(
              this.contracts.redemptionPool.connect(this.signers.maker).supplyUnderlying(underlyingAmount),
            ).to.be.revertedWith(RedemptionPoolErrors.SupplyUnderlyingNotAllowed);
          });
        });

        describe("when the fintroller allows supply underlying", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getSupplyUnderlyingAllowed
              .withArgs(this.stubs.fyToken.address)
              .returns(true);
          });

          describe("when the call to mint the fyTokens does not succeed", function () {
            beforeEach(async function () {
              await this.stubs.fyToken.mock.mint.withArgs(this.accounts.maker, underlyingAmount).returns(false);
            });

            it("reverts", async function () {
              await expect(this.contracts.redemptionPool.connect(this.signers.maker).supplyUnderlying(underlyingAmount))
                .to.be.reverted;
            });
          });

          describe("when the call to mint the fyTokens succeeds", function () {
            beforeEach(async function () {
              await this.stubs.fyToken.mock.mint.withArgs(this.accounts.maker, fyTokenAmount).returns(true);
            });

            describe("when the underlying has 8 decimals", function () {
              beforeEach(async function () {
                await this.stubs.underlying.mock.decimals.returns(BigNumber.from(8));
                await this.stubs.fyToken.mock.underlyingPrecisionScalar.returns(precisionScalars.tokenWith8Decimals);
              });

              const downscaledUnderlyingAmount: BigNumber = underlyingAmount.div(precisionScalars.tokenWith8Decimals);

              beforeEach(async function () {
                await this.stubs.underlying.mock.transferFrom
                  .withArgs(this.accounts.maker, this.contracts.redemptionPool.address, downscaledUnderlyingAmount)
                  .returns(true);
              });

              it("supplies the underlying", async function () {
                const oldUnderlyingTotalSupply: BigNumber = await this.contracts.redemptionPool.totalUnderlyingSupply();
                await this.contracts.redemptionPool
                  .connect(this.signers.maker)
                  .supplyUnderlying(downscaledUnderlyingAmount);
                const newUnderlyingTotalSupply: BigNumber = await this.contracts.redemptionPool.totalUnderlyingSupply();
                expect(oldUnderlyingTotalSupply).to.equal(newUnderlyingTotalSupply.sub(downscaledUnderlyingAmount));
              });
            });

            describe("when the underlying has 18 decimals", function () {
              beforeEach(async function () {
                await this.stubs.underlying.mock.decimals.returns(BigNumber.from(18));
                await this.stubs.fyToken.mock.underlyingPrecisionScalar.returns(precisionScalars.tokenWith18Decimals);
              });

              beforeEach(async function () {
                await this.stubs.underlying.mock.transferFrom
                  .withArgs(this.accounts.maker, this.contracts.redemptionPool.address, underlyingAmount)
                  .returns(true);
              });

              it("supplies the underlying", async function () {
                const oldUnderlyingTotalSupply: BigNumber = await this.contracts.redemptionPool.totalUnderlyingSupply();
                await this.contracts.redemptionPool.connect(this.signers.maker).supplyUnderlying(underlyingAmount);
                const newUnderlyingTotalSupply: BigNumber = await this.contracts.redemptionPool.totalUnderlyingSupply();
                expect(oldUnderlyingTotalSupply).to.equal(newUnderlyingTotalSupply.sub(underlyingAmount));
              });

              it("emits a SupplyUnderlying event", async function () {
                await expect(
                  this.contracts.redemptionPool.connect(this.signers.maker).supplyUnderlying(underlyingAmount),
                )
                  .to.emit(this.contracts.redemptionPool, "SupplyUnderlying")
                  .withArgs(this.accounts.maker, underlyingAmount, fyTokenAmount);
              });
            });
          });
        });
      });
    });
  });
}
