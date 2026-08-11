import React, { useEffect, useState } from 'react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

const HOURS_PER_YEAR = 8760;
// Matches Helios's default managed on-prem rate (adjustable there; fixed
// here since there's no client-adjustment UI in this template).
const DEFAULT_ONPREM_PER_CORE = 2175.58;
const AZURE_STATIC_PER_VCPU = 0.063; // Standard Esv5, Linux, PAYG, East US

const OCI_DB_KEYWORDS = [
  'oracle database enterprise edition',
  'oracle database standard edition',
  'oracle base database',
  'database cloud service',
];
const OCI_OCPU_METRICS = new Set(['ocpu per hour', 'ocpu-hour', 'ocpu hour']);

// Static fallback OCI list prices (USD/OCPU/hour) used if neither SAM-tool
// nor the live OCI API are reachable — mirrors Helios's fallback table.
const OCI_STATIC_BYOL = 0.448;
const OCI_STATIC_LI = 2.9008;

type OciRateSource = 'sam-tool' | 'live-oci' | 'static';

interface PricingState {
  loading: boolean;
  ociByolRate: number;
  ociLiRate: number;
  ociSource: OciRateSource;
  azurePerVcpuRate: number;
  usedLiveAzure: boolean;
}

/** Reads Helios/SAM-tool's own imported Oracle price list, via the
 * sam-pricing backend plugin (direct read of shared.oracle_product_list_prices). */
async function fetchSamToolOciRates(
  fetchApi: { fetch: typeof fetch },
  discoveryApi: { getBaseUrl(pluginId: string): Promise<string> },
): Promise<{ byol?: number; li?: number }> {
  const baseUrl = await discoveryApi.getBaseUrl('sam-pricing');
  const res = await fetchApi.fetch(`${baseUrl}/oracle-list-prices`);
  if (!res.ok) throw new Error(`SAM-tool pricing fetch failed: ${res.status}`);
  const rows = (await res.json()) as {
    productName: string;
    metric: string;
    listPrice: number;
  }[];
  let byol: number | undefined;
  let li: number | undefined;
  for (const row of rows) {
    const nameLower = (row.productName ?? '').toLowerCase();
    const metricLower = (row.metric ?? '').toLowerCase();
    if (!OCI_DB_KEYWORDS.some(kw => nameLower.includes(kw))) continue;
    if (!OCI_OCPU_METRICS.has(metricLower)) continue;
    if (byol === undefined && (nameLower.includes('byol') || nameLower.includes('bring your own'))) {
      byol = row.listPrice;
    }
    if (
      li === undefined &&
      (nameLower.includes('license included') || nameLower.includes('licence included'))
    ) {
      li = row.listPrice;
    }
  }
  return { byol, li };
}

async function fetchLiveOciRates(
  proxyBaseUrl: string,
): Promise<{ byol?: number; li?: number }> {
  const res = await fetch(`${proxyBaseUrl}/oci-pricing`);
  if (!res.ok) throw new Error(`OCI pricing fetch failed: ${res.status}`);
  const data = await res.json();
  const items = (data.items ?? []) as any[];
  let byol: number | undefined;
  let li: number | undefined;
  for (const item of items) {
    const nameLower = (item.displayName ?? '').toLowerCase();
    if (!OCI_DB_KEYWORDS.some(kw => nameLower.includes(kw))) continue;
    const metric = (item.metricName ?? '').toLowerCase();
    if (!OCI_OCPU_METRICS.has(metric)) continue;
    const usd = (item.currencyCodeLocalizations ?? []).find(
      (p: any) => (p.currencyCode ?? '').toUpperCase() === 'USD',
    );
    if (!usd) continue;
    const price = Number(usd.localizedPrice);
    if (byol === undefined && (nameLower.includes('byol') || nameLower.includes('bring your own'))) {
      byol = price;
    }
    if (
      li === undefined &&
      (nameLower.includes('license included') || nameLower.includes('licence included'))
    ) {
      li = price;
    }
  }
  return { byol, li };
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
  if (count === 0) throw new Error('No matching Azure SKUs returned');
  return total / count;
}

const OCI_SOURCE_LABEL: Record<OciRateSource, string> = {
  'sam-tool': "Helios/SAM-tool's imported price list",
  'live-oci': 'live OCI public pricing',
  static: 'OCI static fallback',
};

/**
 * Shows a live cost comparison across On-Premises, OCI, and Azure (BYOL vs.
 * License Included) for the CPU core count entered earlier in this step.
 *
 * OCI rates are read in priority order: Helios/SAM-tool's own imported
 * price list (shared.oracle_product_list_prices, via the sam-pricing
 * backend plugin) first, since that reflects the org's actual negotiated
 * prices; then Oracle's public pricing API; then a static fallback.
 * Azure rates come from the public Retail Prices API (no org-specific
 * source exists for that), or a static fallback. Oracle-only: the
 * licensing math doesn't apply to other database engines.
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
    ociSource: 'static',
    azurePerVcpuRate: AZURE_STATIC_PER_VCPU,
    usedLiveAzure: false,
  });

  const allAnswers =
    (formContext as { formData?: Record<string, any> } | undefined)
      ?.formData ?? {};
  const dbProduct = allAnswers?.dbProduct as string | undefined;
  const cpuCores = Number(allAnswers?.desiredCpuCores) || 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');

      let ociByolRate = OCI_STATIC_BYOL;
      let ociLiRate = OCI_STATIC_LI;
      let ociSource: OciRateSource = 'static';

      try {
        const samRates = await fetchSamToolOciRates(fetchApi, discoveryApi);
        if (samRates.byol !== undefined || samRates.li !== undefined) {
          if (samRates.byol !== undefined) ociByolRate = samRates.byol;
          if (samRates.li !== undefined) ociLiRate = samRates.li;
          ociSource = 'sam-tool';
        }
      } catch {
        // fall through to live OCI API
      }

      if (ociSource === 'static') {
        try {
          const liveRates = await fetchLiveOciRates(proxyBaseUrl);
          if (liveRates.byol !== undefined || liveRates.li !== undefined) {
            if (liveRates.byol !== undefined) ociByolRate = liveRates.byol;
            if (liveRates.li !== undefined) ociLiRate = liveRates.li;
            ociSource = 'live-oci';
          }
        } catch {
          // keep static fallback
        }
      }

      let azurePerVcpuRate = AZURE_STATIC_PER_VCPU;
      let usedLiveAzure = false;
      try {
        azurePerVcpuRate = await fetchAzurePerVcpuRate(proxyBaseUrl);
        usedLiveAzure = true;
      } catch {
        // keep static fallback
      }

      if (!cancelled) {
        setPricing({
          loading: false,
          ociByolRate,
          ociLiRate,
          ociSource,
          azurePerVcpuRate,
          usedLiveAzure,
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

  const onpremAnnual = DEFAULT_ONPREM_PER_CORE * cpuCores;
  const ociByolAnnual = pricing.ociByolRate * cpuCores * HOURS_PER_YEAR;
  const ociLiAnnual = pricing.ociLiRate * cpuCores * HOURS_PER_YEAR;
  // Oracle core factor 0.5 on Azure Intel VMs -> 2 vCPUs per physical core.
  const azureVcpus = cpuCores * 2;
  const azureByolAnnual = pricing.azurePerVcpuRate * azureVcpus * HOURS_PER_YEAR;
  // No independent Azure Licence Included rate is fetched live; Oracle
  // Database@Azure Exadata is OCPU-billed like OCI, so the OCI LI rate is
  // used as a proxy here, same as Helios's static fallback approach.
  const azureLiAnnual = pricing.ociLiRate * cpuCores * HOURS_PER_YEAR;

  const fmt = (n: number) =>
    n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });

  const rows = [
    { label: '1. On-Premises', byol: fmt(onpremAnnual), li: '—' },
    { label: '2. Oracle Cloud (OCI)', byol: fmt(ociByolAnnual), li: fmt(ociLiAnnual) },
    { label: '3. Microsoft Azure', byol: fmt(azureByolAnnual), li: fmt(azureLiAnnual) },
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
        Estimated Annual Cost ({cpuCores} {cpuCores === 1 ? 'core' : 'cores'})
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
        Compute-only list price estimates (OCI: {OCI_SOURCE_LABEL[pricing.ociSource]}
        , Azure: {pricing.usedLiveAzure ? 'live Azure pricing' : 'Azure static fallback'}
        ). On-Prem uses a fixed ${DEFAULT_ONPREM_PER_CORE.toLocaleString()}
        /core/year managed-service rate. Excludes storage, networking, and
        negotiated discounts.
      </div>
    </div>
  );
};
