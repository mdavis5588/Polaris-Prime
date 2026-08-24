import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { fetchMyTenants, MyTenant } from './api';

const STORAGE_KEY = 'polaris-prime.current-tenant';

const tenantKey = (t: Pick<MyTenant, 'clientCode' | 'tenantId'>) =>
  `${t.clientCode}:${t.tenantId}`;

interface TenantContextValue {
  tenants: MyTenant[];
  loading: boolean;
  currentTenant: MyTenant | undefined;
  setCurrentTenant: (key: string) => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

/**
 * Fetches the signed-in user's real tenant list once, and tracks which one
 * they're currently working in — a purely local UX concern, persisted in
 * localStorage so it survives reloads. This selection is never trusted for
 * authorization on its own: every backend route that acts on a tenant
 * re-checks the caller's actual Azure AD group membership independently.
 */
export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [tenants, setTenants] = useState<MyTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentKey, setCurrentKey] = useState<string | undefined>(
    () => localStorage.getItem(STORAGE_KEY) ?? undefined,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMyTenants(discoveryApi, fetchApi);
        if (!cancelled) setTenants(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi]);

  // Default to the first tenant, or clear a stale selection (e.g. from a
  // tenant the user no longer has access to) once the real list is in.
  useEffect(() => {
    if (loading || tenants.length === 0) return;
    if (!currentKey || !tenants.some(t => tenantKey(t) === currentKey)) {
      setCurrentKey(tenantKey(tenants[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tenants]);

  const setCurrentTenant = (key: string) => {
    setCurrentKey(key);
    localStorage.setItem(STORAGE_KEY, key);
  };

  const currentTenant = useMemo(
    () => tenants.find(t => tenantKey(t) === currentKey),
    [tenants, currentKey],
  );

  return (
    <TenantContext.Provider value={{ tenants, loading, currentTenant, setCurrentTenant }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return ctx;
};

export { tenantKey };
