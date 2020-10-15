import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { FintrollerErrors, GenericErrors, RedemptionPoolErrors } from "../../../../helpers/errors";
import { PrecisionScalarForTokenWithEightDecimals, TokenAmounts, YTokenConstants } from "../../../../helpers/constants";
import { contextForStubbedUnderlyingWithEightDecimals } from "../../../../helpers/mochaContexts";
import { stubGetBondCollateralizationRatio } from "../../../stubs";

export default function shouldBehaveLikeRedeemUnderlying(): void {
  const underlyingAmount: BigNumber = TokenAmounts.OneHundred;
  const yTokenAmount: BigNumber = TokenAmounts.OneHundred;

  describe("when the bond matured", function () {
    beforeEach(async function () {
      /* Set the expiration time to now minus one hour. */
      const nowMinusOneHour: BigNumber = BigNumber.from(Math.round(new Date().getTime() / 1000) - 3600);
      await this.stubs.yToken.mock.expirationTime.returns(nowMinusOneHour);
    });

    describe("when the amount to redeemUnderlying is not zero", function () {
      describe("when the bond is listed", function () {
        beforeEach(async function () {
          await stubGetBondCollateralizationRatio.call(this, this.stubs.yToken.address);
        });

        describe("when the fintroller allows redeemUnderlying", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getRedeemUnderlyingAllowed
              .withArgs(this.stubs.yToken.address)
              .returns(true);
          });

          describe("when there is enough underlying liquidity", function () {
            beforeEach(async function () {
              const totalUnderlyingSupply: BigNumber = TokenAmounts.OneMillion;
              await this.contracts.redemptionPool.__godMode_setTotalUnderlyingSupply(totalUnderlyingSupply);
            });

            describe("when the call to burn the yTokens succeeds", function () {
              beforeEach(async function () {
                await this.stubs.yToken.mock.burn.withArgs(this.accounts.mark, yTokenAmount).returns(true);
              });

              describe("when the underlying has 18 decimals", function () {
                beforeEach(async function () {
                  await this.stubs.underlying.mock.transfer
                    .withArgs(this.accounts.mark, underlyingAmount)
                    .returns(true);
                });

                it("redeems the underlying", async function () {
                  const oldUnderlyingTotalSupply: BigNumber = await this.contracts.redemptionPool.totalUnderlyingSupply();
                  await this.contracts.redemptionPool.connect(this.signers.mark).redeemUnderlying(underlyingAmount);
                  const newUnderlyingTotalSupply: BigNumber = await this.contracts.redemptionPool.totalUnderlyingSupply();
                  expect(oldUnderlyingTotalSupply).to.equal(newUnderlyingTotalSupply.add(underlyingAmount));
                });

                it("emits a RedeemUnderlying event", async function () {
                  await expect(
                    this.contracts.redemptionPool.connect(this.signers.mark).redeemUnderlying(underlyingAmount),
                  )
                    .to.emit(this.contracts.redemptionPool, "RedeemUnderlying")
                    .withArgs(this.accounts.mark, underlyingAmount);
                });
              });

              contextForStubbedUnderlyingWithEightDecimals("when the underlying has 6 decimals", function () {
                const downscaledUnderlyingAmount: BigNumber = underlyingAmount.div(
                  PrecisionScalarForTokenWithEightDecimals,
                );

                beforeEach(async function () {
                  await this.stubs.underlying.mock.transfer
                    .withArgs(this.accounts.mark, downscaledUnderlyingAmount)
                    .returns(true);
                });

                it("redeems the underlying", async function () {
                  const oldUnderlyingTotalSupply: BigNumber = await this.contracts.redemptionPool.totalUnderlyingSupply();
                  await this.contracts.redemptionPool
                    .connect(this.signers.mark)
                    .redeemUnderlying(downscaledUnderlyingAmount);
                  const newUnderlyingTotalSupply: BigNumber = await this.contracts.redemptionPool.totalUnderlyingSupply();
                  expect(oldUnderlyingTotalSupply).to.equal(newUnderlyingTotalSupply.add(downscaledUnderlyingAmount));
                });
              });
            });

            describe("when the call to burn the yTokens does not succeed", function () {
              beforeEach(async function () {
                await this.stubs.yToken.mock.burn.withArgs(this.accounts.mark, underlyingAmount).returns(false);
              });

              it("reverts", async function () {
                await expect(
                  this.contracts.redemptionPool.connect(this.signers.mark).redeemUnderlying(underlyingAmount),
                ).to.be.reverted;
              });
            });
          });

          describe("when there is not enough underlying liquidity", function () {
            it("reverts", async function () {
              await expect(
                this.contracts.redemptionPool.connect(this.signers.mark).redeemUnderlying(underlyingAmount),
              ).to.be.revertedWith(RedemptionPoolErrors.RedeemUnderlyingInsufficientUnderlying);
            });
          });
        });

        describe("when the fintroller does not allow redeem underlying", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getRedeemUnderlyingAllowed
              .withArgs(this.stubs.yToken.address)
              .returns(false);
          });

          it("reverts", async function () {
            await expect(
              this.contracts.redemptionPool.connect(this.signers.mark).redeemUnderlying(underlyingAmount),
            ).to.be.revertedWith(RedemptionPoolErrors.RedeemUnderlyingNotAllowed);
          });
        });
      });

      describe("when the bond is not listed", function () {
        beforeEach(async function () {
          await this.stubs.fintroller.mock.getRedeemUnderlyingAllowed
            .withArgs(this.stubs.yToken.address)
            .revertsWithReason(FintrollerErrors.BondNotListed);
        });

        it("reverts", async function () {
          await expect(
            this.contracts.redemptionPool.connect(this.signers.mark).redeemUnderlying(underlyingAmount),
          ).to.be.revertedWith(FintrollerErrors.BondNotListed);
        });
      });
    });

    describe("when the amount to redeemUnderlying is zero", function () {
      it("reverts", async function () {
        const zeroRedeemUnderlyingAmount: BigNumber = Zero;
        await expect(
          this.contracts.redemptionPool.connect(this.signers.mark).redeemUnderlying(zeroRedeemUnderlyingAmount),
        ).to.be.revertedWith(RedemptionPoolErrors.RedeemUnderlyingZero);
      });
    });
  });

  describe("when the bond did not mature", function () {
    beforeEach(async function () {
      await this.stubs.yToken.mock.expirationTime.returns(YTokenConstants.DefaultExpirationTime);
    });

    it("reverts", async function () {
      await expect(
        this.contracts.redemptionPool.connect(this.signers.mark).redeemUnderlying(underlyingAmount),
      ).to.be.revertedWith(GenericErrors.BondNotMatured);
    });
  });
}