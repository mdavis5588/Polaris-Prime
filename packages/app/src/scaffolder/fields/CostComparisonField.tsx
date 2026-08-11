import React, { useEffect, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

const HOURS_PER_YEAR = 8760;
// Matches Helios's default managed on-prem rate (adjustable there; fixed
// here since there's no client-adjustment UI in this template). This is a
// blended managed-service rate (infra + support + license), unlike the
// cloud rows below which are compute/license + storage added separately.
const DEFAULT_ONPREM_PER_CORE = 2175.58;

const AZURE_STATIC_PER_VCPU = 0.063; // Standard Esv5, Linux, PAYG, East US
// Rough, unverified approximations — confirm against current published
// rates before relying on these for real budgeting.
const OCI_STATIC_STORAGE_PER_GB_MONTH = 0.0255; // OCI Block Volume, approx.
const AZURE_STATIC_STORAGE_PER_GB_MONTH = 0.12; // Premium SSD, blended approx.

// Matches Helios's own keyword list, including Exadata Cloud@Customer.
const OCI_DB_KEYWORDS = [
  'oracle database enterprise edition',
  'oracle database standard edition',
  'oracle base database',
  'database cloud service',
  'exadata database',
  'exadata cloud@customer',
  'exacc',
];
const OCI_OCPU_METRICS = new Set(['ocpu per hour', 'ocpu-hour', 'ocpu hour']);

// Static fallback OCI list prices (USD/OCPU/hour) — mirrors Helios's table.
const OCI_STATIC_BYOL = 0.448;
const OCI_STATIC_LI = 2.9008;
const OCI_STATIC_EXACC_BYOL = 0.448;
const OCI_STATIC_EXACC_LI = 3.5168;

const AZURE_PREMIUM_SSD_TIER_GB: Record<string, number> = {
  P1: 4,
  P2: 8,
  P3: 16,
  P4: 32,
  P6: 64,
  P10: 128,
  P15: 256,
  P20: 512,
  P30: 1024,
  P40: 2048,
  P50: 4096,
  P60: 8192,
  P70: 16384,
  P80: 32768,
};

type OciRateSource = 'sam-tool' | 'live-oci' | 'static';

interface OciRates {
  byol?: number;
  li?: number;
  exaccByol?: number;
  exaccLi?: number;
}

interface PricingState {
  loading: boolean;
  ociByolRate: number;
  ociLiRate: number;
  ociExaccByolRate?: number;
  ociExaccLiRate?: number;
  ociSource: OciRateSource;
  ociStoragePerGbMonth: number;
  usedLiveOciStorage: boolean;
  azurePerVcpuRate: number;
  usedLiveAzure: boolean;
  azureStoragePerGbMonth: number;
  usedLiveAzureStorage: boolean;
}

/** Shared parser for OCI DB SKU rows, whichever source they came from —
 * mirrors Helios's build_oci_comparison filtering (requires "enterprise"
 * in the name for non-ExaCC rows, tracks ExaCC separately). */
function parseOciRates(
  rows: { name: string; metric: string; price: number }[],
): OciRates {
  const result: OciRates = {};
  for (const row of rows) {
    const nameLower = row.name.toLowerCase();
    const metricLower = row.metric.toLowerCase();
    if (!OCI_OCPU_METRICS.has(metricLower)) continue;
    if (!OCI_DB_KEYWORDS.some(kw => nameLower.includes(kw))) continue;
    const isExacc =
      nameLower.includes('cloud@customer') || nameLower.includes('exacc');
    if (!isExacc && !nameLower.includes('enterprise')) continue;
    const isByol =
      nameLower.includes('byol') || nameLower.includes('bring your own');
    const isLi =
      nameLower.includes('license included') ||
      nameLower.includes('licence included');
    if (isExacc) {
      if (isByol && result.exaccByol === undefined) result.exaccByol = row.price;
      if (isLi && result.exaccLi === undefined) result.exaccLi = row.price;
    } else {
      if (isByol && result.byol === undefined) result.byol = row.price;
      if (isLi && result.li === undefined) result.li = row.price;
    }
  }
  return result;
}

async function fetchSamToolOciRates(
  fetchApi: { fetch: typeof fetch },
  discoveryApi: { getBaseUrl(pluginId: string): Promise<string> },
): Promise<OciRates> {
  const baseUrl = await discoveryApi.getBaseUrl('sam-pricing');
  const res = await fetchApi.fetch(`${baseUrl}/oracle-list-prices`);
  if (!res.ok) throw new Error(`SAM-tool pricing fetch failed: ${res.status}`);
  const rows = (await res.json()) as {
    productName: string;
    metric: string;
    listPrice: number;
  }[];
  return parseOciRates(
    rows.map(r => ({ name: r.productName, metric: r.metric, price: r.listPrice })),
  );
}

async function fetchLiveOciCatalog(proxyBaseUrl: string): Promise<any[]> {
  const res = await fetch(`${proxyBaseUrl}/oci-pricing`);
  if (!res.ok) throw new Error(`OCI pricing fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []) as any[];
}

function parseLiveOciRates(items: any[]): OciRates {
  const rows = items
    .map(item => {
      const usd = (item.currencyCodeLocalizations ?? []).find(
        (p: any) => (p.currencyCode ?? '').toUpperCase() === 'USD',
      );
      if (!usd) return null;
      return {
        name: item.displayName ?? '',
        metric: (item.metricName ?? '').toLowerCase(),
        price: Number(usd.localizedPrice),
      };
    })
    .filter((r): r is { name: string; metric: string; price: number } => r !== null);
  return parseOciRates(rows);
}

function findOciStorageRate(items: any[]): number | undefined {
  for (const item of items) {
    const nameLower = (item.displayName ?? '').toLowerCase();
    if (!nameLower.includes('block volume')) continue;
    const usd = (item.currencyCodeLocalizations ?? []).find(
      (p: any) => (p.currencyCode ?? '').toUpperCase() === 'USD',
    );
    if (usd) return Number(usd.localizedPrice);
  }
  return undefined;
}

async function fetchAzurePerVcpuRate(proxyBaseUrl: string): Promise<number> {
  const res = await fetch(`${proxyBaseUrl}/azure-pricing`);
  if (!res.ok) throw new Error(`Azure pricing fetch failed: ${res.status}`);
  const data = await res.json();
  const items = (data.Items ?? []) as any[];
  let total = 0;
  let count = 0;
  for (const item of items) {
    const match = /E(\d+)s/.exec(item.skuName ?? '');
    if (match && item.retailPrice) {
      total += Number(item.retailPrice) / Number(match[1]);
      count += 1;
    }
  }
  if (count === 0) throw new Error('No matching Azure VM SKUs returned');
  return total / count;
}

async function fetchAzureStoragePerGbRate(proxyBaseUrl: string): Promise<number> {
  const res = await fetch(`${proxyBaseUrl}/azure-storage-pricing`);
  if (!res.ok) throw new Error(`Azure storage pricing fetch failed: ${res.status}`);
  const data = await res.json();
  const items = (data.Items ?? []) as any[];
  let total = 0;
  let count = 0;
  for (const item of items) {
    const match = /^P(\d+)$/.exec((item.skuName ?? '').trim());
    if (!match) continue;
    const gb = AZURE_PREMIUM_SSD_TIER_GB[`P${match[1]}`];
    if (!gb || !item.retailPrice) continue;
    total += Number(item.retailPrice) / gb;
    count += 1;
  }
  if (count === 0) throw new Error('No matching Azure disk SKUs returned');
  return total / count;
}

const OCI_SOURCE_LABEL: Record<OciRateSource, string> = {
  'sam-tool': "Helios/SAM-tool's imported price list",
  'live-oci': 'live OCI public pricing',
  static: 'OCI static fallback',
};

/**
 * Shows a live, total-cost-ish annual comparison across On-Premises, OCI,
 * Exadata Cloud@Customer (ExaCC), and Azure (BYOL vs. License Included),
 * based on the CPU cores and storage entered earlier in this step.
 *
 * OCI/ExaCC rates: Helios/SAM-tool's own imported price list first, then
 * the live public OCI API, then a static fallback. Azure compute + both
 * storage rates: live public Retail Prices API, then static fallback.
 * License math (OCPU/vCPU x hours, Azure's core-factor doubling) is
 * Oracle-specific and gated to dbProduct === 'oracle'.
 *
 * Known gaps, called out in the footer: On-Prem is a single blended
 * managed-service rate (not license-only, so not perfectly apples-to-
 * apples with the license+storage cloud figures); ExaCC excludes its
 * additional infrastructure subscription fee, same as Helios; storage
 * rates are approximated where live parsing isn't available.
 */
export const CostComparisonField = ({
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [pricing, setPricing] = useState<PricingState>({
    loading: true,
    ociByolRate: OCI_STATIC_BYOL,
    ociLiRate: OCI_STATIC_LI,
    ociExaccByolRate: OCI_STATIC_EXACC_BYOL,
    ociExaccLiRate: OCI_STATIC_EXACC_LI,
    ociSource: 'static',
    ociStoragePerGbMonth: OCI_STATIC_STORAGE_PER_GB_MONTH,
    usedLiveOciStorage: false,
    azurePerVcpuRate: AZURE_STATIC_PER_VCPU,
    usedLiveAzure: false,
    azureStoragePerGbMonth: AZURE_STATIC_STORAGE_PER_GB_MONTH,
    usedLiveAzureStorage: false,
  });

  const allAnswers =
    (formContext as { formData?: Record<string, any> } | undefined)
      ?.formData ?? {};
  const dbProduct = allAnswers?.dbProduct as string | undefined;
  const cpuCores = Number(allAnswers?.desiredCpuCores) || 0;
  const storageGb = Number(allAnswers?.desiredStorageGb) || 0;
  const dataSovereigntyRequired =
    allAnswers?.dataSovereignty?.hasDataSovereigntyRequirement === 'yes';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');

      let ociRates: OciRates = {};
      let ociSource: OciRateSource = 'static';

      try {
        const samRates = await fetchSamToolOciRates(fetchApi, discoveryApi);
        if (Object.keys(samRates).length > 0) {
          ociRates = samRates;
          ociSource = 'sam-tool';
        }
      } catch {
        // fall through to live OCI API
      }

      // Always fetch the live OCI catalog: needed as a rate fallback when
      // SAM-tool didn't supply them, and needed for storage pricing either
      // way, since SAM-tool's price list doesn't include storage SKUs.
      let ociItems: any[] = [];
      try {
        ociItems = await fetchLiveOciCatalog(proxyBaseUrl);
      } catch {
        ociItems = [];
      }

      if (ociSource === 'static' && ociItems.length > 0) {
        const liveRates = parseLiveOciRates(ociItems);
        if (Object.keys(liveRates).length > 0) {
          ociRates = liveRates;
          ociSource = 'live-oci';
        }
      }

      let ociStoragePerGbMonth = OCI_STATIC_STORAGE_PER_GB_MONTH;
      let usedLiveOciStorage = false;
      const liveStorageRate = findOciStorageRate(ociItems);
      if (liveStorageRate !== undefined) {
        ociStoragePerGbMonth = liveStorageRate;
        usedLiveOciStorage = true;
      }

      let azurePerVcpuRate = AZURE_STATIC_PER_VCPU;
      let usedLiveAzure = false;
      try {
        azurePerVcpuRate = await fetchAzurePerVcpuRate(proxyBaseUrl);
        usedLiveAzure = true;
      } catch {
        // keep static fallback
      }

      let azureStoragePerGbMonth = AZURE_STATIC_STORAGE_PER_GB_MONTH;
      let usedLiveAzureStorage = false;
      try {
        azureStoragePerGbMonth = await fetchAzureStoragePerGbRate(proxyBaseUrl);
        usedLiveAzureStorage = true;
      } catch {
        // keep static fallback
      }

      if (!cancelled) {
        setPricing({
          loading: false,
          ociByolRate: ociRates.byol ?? OCI_STATIC_BYOL,
          ociLiRate: ociRates.li ?? OCI_STATIC_LI,
          ociExaccByolRate: ociRates.exaccByol ?? OCI_STATIC_EXACC_BYOL,
          ociExaccLiRate: ociRates.exaccLi ?? OCI_STATIC_EXACC_LI,
          ociSource,
          ociStoragePerGbMonth,
          usedLiveOciStorage,
          azurePerVcpuRate,
          usedLiveAzure,
          azureStoragePerGbMonth,
          usedLiveAzureStorage,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi]);

  if (dbProduct !== 'oracle') {
    return (
      <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Cost comparison is only available for Oracle today — OCI/Azure
        Oracle licensing math doesn't apply to {dbProduct || 'this product'}.
      </div>
    );
  }

  if (cpuCores <= 0) {
    return (
      <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Enter the number of CPU cores above to see estimated costs.
      </div>
    );
  }

  if (pricing.loading) {
    return <div style={{ marginBottom: '1.25rem' }}>Loading live pricing…</div>;
  }

  const ociStorageAnnual = pricing.ociStoragePerGbMonth * storageGb * 12;
  const azureStorageAnnual = pricing.azureStoragePerGbMonth * storageGb * 12;

  const onpremAnnual = DEFAULT_ONPREM_PER_CORE * cpuCores;

  const ociByolAnnual = pricing.ociByolRate * cpuCores * HOURS_PER_YEAR + ociStorageAnnual;
  const ociLiAnnual = pricing.ociLiRate * cpuCores * HOURS_PER_YEAR + ociStorageAnnual;

  const exaccByolAnnual =
    pricing.ociExaccByolRate !== undefined
      ? pricing.ociExaccByolRate * cpuCores * HOURS_PER_YEAR + ociStorageAnnual
      : undefined;
  const exaccLiAnnual =
    pricing.ociExaccLiRate !== undefined
      ? pricing.ociExaccLiRate * cpuCores * HOURS_PER_YEAR + ociStorageAnnual
      : undefined;

  // Oracle core factor 0.5 on Azure Intel VMs -> 2 vCPUs per physical core.
  const azureVcpus = cpuCores * 2;
  const azureByolAnnual =
    pricing.azurePerVcpuRate * azureVcpus * HOURS_PER_YEAR + azureStorageAnnual;
  // No independent Azure Licence Included rate is fetched live; Oracle
  // Database@Azure Exadata is OCPU-billed like OCI, so the OCI LI rate is
  // used as a proxy here, same as Helios's static fallback approach.
  const azureLiAnnual = pricing.ociLiRate * cpuCores * HOURS_PER_YEAR + azureStorageAnnual;

  const fmt = (n?: number) =>
    n === undefined
      ? '—'
      : n.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        });

  // Data sovereignty rules out every cloud/hybrid option regardless of
  // pricing — don't show them at all, not even as unaffordable options.
  const rows = dataSovereigntyRequired
    ? [{ label: 'On-Premises', byol: fmt(onpremAnnual), li: '—' }]
    : [
        { label: '1. On-Premises', byol: fmt(onpremAnnual), li: '—' },
        { label: '2. Oracle Cloud (OCI)', byol: fmt(ociByolAnnual), li: fmt(ociLiAnnual) },
        {
          label: '3. Exadata Cloud@Customer (ExaCC)',
          byol: fmt(exaccByolAnnual),
          li: fmt(exaccLiAnnual),
        },
        { label: '4. Microsoft Azure', byol: fmt(azureByolAnnual), li: fmt(azureLiAnnual) },
      ];

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        background: 'rgba(139, 92, 246, 0.06)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
        Estimated Annual Cost ({cpuCores} {cpuCores === 1 ? 'core' : 'cores'}
        {storageGb > 0 ? `, ${storageGb} GB storage` : ''})
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Option</th>
            <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>BYOL</th>
            <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>
              License Included
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.5rem' }}>{row.label}</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.byol}</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.li}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
        {dataSovereigntyRequired ? (
          <>
            On-Prem is a single blended managed-service rate ($
            {DEFAULT_ONPREM_PER_CORE.toLocaleString()}/core/year — infra,
            support, and license together).
          </>
        ) : (
          <>
            OCI/ExaCC: {OCI_SOURCE_LABEL[pricing.ociSource]}. Storage: OCI{' '}
            {pricing.usedLiveOciStorage ? 'live' : 'static approx.'}, Azure{' '}
            {pricing.usedLiveAzureStorage ? 'live' : 'static approx.'}. Azure
            compute: {pricing.usedLiveAzure ? 'live' : 'static'}. On-Prem is a
            single blended managed-service rate ($
            {DEFAULT_ONPREM_PER_CORE.toLocaleString()}/core/year — infra,
            support, and license together), so it isn't directly
            apples-to-apples with the license+storage-only cloud figures.
            ExaCC excludes its additional infrastructure subscription fee.
            Excludes networking and negotiated discounts.
          </>
        )}
      </div>
    </div>
  );
};
