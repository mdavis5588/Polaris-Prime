import type { NetworkProvider } from './types';

const NOT_IMPLEMENTED =
  'On-prem resource groups and network security groups are not yet implemented — ' +
  'pending the orchestrator API contract (see docs/orchestrator-api-contract.md). ' +
  'This request was logged for manual follow-up.';

/**
 * Placeholder until the on-prem orchestrator's API exists. Intentionally
 * throws on every operation, matching the established pattern for
 * on-prem DBaaS/deploy actions elsewhere in this codebase — the
 * canonical Resource Group/NSG model and the Azure provider are real and
 * usable today; only this side is blocked on infrastructure that doesn't
 * exist yet.
 */
export function createOnPremNetworkProvider(): NetworkProvider {
  return {
    async createResourceGroup() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async deleteResourceGroup() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async createNsg() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async deleteNsg() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async addRule() {
      throw new Error(NOT_IMPLEMENTED);
    },
    async removeRule() {
      throw new Error(NOT_IMPLEMENTED);
    },
  };
}
