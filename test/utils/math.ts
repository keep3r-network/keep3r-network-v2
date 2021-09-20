import { toUnit } from '@utils/bn';
import { BigNumber } from 'ethers';

export function mathUtilsFactory(rewardPeriodTime: number, inflationPeriodTime: number): MathUtils {
  return {
    calcPeriod: (timestamp: number) => timestamp - (timestamp % rewardPeriodTime),
    calcLiquidityToAdd: (credits: BigNumber) => credits.mul(inflationPeriodTime).div(rewardPeriodTime),
    calcPeriodCredits: (liquidityAdded: BigNumber) => liquidityAdded.mul(rewardPeriodTime).div(inflationPeriodTime),
    calcMintedCredits: (jobPeriodCredits: BigNumber, cooldown: number) => jobPeriodCredits.mul(cooldown).div(rewardPeriodTime),
    increase1Tick: (amount: BigNumber) => amount.mul(10001).div(10000),
    decrease1Tick: (amount: BigNumber) => amount.mul(10000).div(10001),
    blockShiftPrecision: toUnit(0.0001).toNumber(),
  };
}

export interface MathUtils {
  calcPeriod: (timestamp: number) => number;
  calcLiquidityToAdd: (credits: BigNumber) => BigNumber;
  calcPeriodCredits: (liquidityAdded: BigNumber) => BigNumber;
  calcMintedCredits: (jobPeriodCredits: BigNumber, cooldown: number) => BigNumber;
  increase1Tick: (amount: BigNumber) => BigNumber;
  decrease1Tick: (amount: BigNumber) => BigNumber;
  blockShiftPrecision: number;
}
