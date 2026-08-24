export type SovereigntyAnswer = 'yes' | 'no';
export type SupportModel = 'fully-managed' | 'self-supported';
export type DbProduct = 'oracle' | 'sqlserver' | 'mongodb' | 'postgresql';
export type DeploymentTarget = 'onprem' | 'oci' | 'azure';

export interface DbaasWizardState {
  dataSovereignty: SovereigntyAnswer | null;
  client: string | null;
  tenant: string | null;
  supportModel: SupportModel | null;
  dbProduct: DbProduct | null;
  dbVersion: string | null;
  dbName: string;
  dbAdminPassword: string;
  desiredCpuCores: number | null;
  memoryGb: number | null;
  desiredStorageGb: number | null;
  target: DeploymentTarget | null;
  licenseModel: string | null;
  ociShape: string | null;
  azureVmSize: string | null;
}

export const initialWizardState: DbaasWizardState = {
  dataSovereignty: null,
  client: null,
  tenant: null,
  supportModel: null,
  dbProduct: null,
  dbVersion: null,
  dbName: '',
  dbAdminPassword: '',
  desiredCpuCores: null,
  memoryGb: null,
  desiredStorageGb: null,
  target: null,
  licenseModel: null,
  ociShape: null,
  azureVmSize: null,
};

export const DB_VERSIONS: Record<DbProduct, { value: string; label: string }[]> = {
  oracle: [
    { value: '23ai', label: 'Oracle 23ai (Latest)' },
    { value: '19c', label: 'Oracle 19c (N-1)' },
  ],
  sqlserver: [
    { value: '2025', label: 'SQL Server 2025 (Latest)' },
    { value: '2022', label: 'SQL Server 2022 (N-1)' },
  ],
  mongodb: [
    { value: '8.0', label: 'MongoDB 8.0 (Latest)' },
    { value: '7.0', label: 'MongoDB 7.0 (N-1)' },
  ],
  postgresql: [
    { value: '18', label: 'PostgreSQL 18 (Latest)' },
    { value: '17', label: 'PostgreSQL 17 (N-1)' },
  ],
};

export const FULLY_MANAGED_ONPREM_TIER: Record<DbProduct, string> = {
  oracle: 'Oracle Exadata',
  sqlserver: 'SQL Server',
  mongodb: 'MongoDB',
  postgresql: 'PostgreSQL',
};
