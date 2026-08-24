/**
 * Configuration for the Database as a Service plugin
 * (packages/app/src/plugins/dbaas, packages/backend/src/plugins/dbaas).
 * These are platform-level defaults — end users never see them in the
 * wizard.
 */
export interface Config {
  oracleDbaas?: {
    /**
     * Clients this platform provisions databases for. Only code/name and
     * the tenant tags' id/name are ever exposed to the browser (via the
     * dbaas-tenants backend plugin); the oci/azure credentials below stay
     * server-side and are only read when a scaffolder action actually
     * runs.
     */
    clients?: {
      /**
       * Short unique client identifier, e.g. 'acme'.
       */
      code: string;
      /**
       * Display name shown in the Client picker.
       */
      name: string;
      /**
       * Tracking/cost-attribution tags this client uses to group their own
       * deployments — NOT tied to any specific cloud account. A single tag
       * can end up applied to a mix of on-prem and cloud resources; every
       * provisioned resource gets tagged with whichever one was picked.
       */
      tenants: {
        /**
         * Unique tag identifier within this client, e.g. 'tenant-1'.
         */
        id: string;
        /**
         * Display name shown in the Tenant picker.
         */
        name: string;
      }[];
      /**
       * This client's OCI tenancy config, used by the
       * oracle:oci:createDbSystem scaffolder action whenever this client
       * deploys to OCI. One account per client — not per tenant tag.
       */
      oci?: {
        /**
         * OCI region to provision into, e.g. 'us-ashburn-1'.
         */
        region: string;
        /**
         * Tenancy OCID used for API authentication.
         * @visibility secret
         */
        tenancyOcid: string;
        /**
         * User OCID used for API authentication.
         * @visibility secret
         */
        userOcid: string;
        /**
         * API signing key fingerprint.
         * @visibility secret
         */
        fingerprint: string;
        /**
         * PEM-encoded API signing private key.
         * @visibility secret
         */
        privateKey: string;
        /**
         * Passphrase for the API signing private key, if it's encrypted.
         * @visibility secret
         */
        passphrase?: string;
        /**
         * Compartment OCID that new DB Systems are launched into.
         */
        compartmentId: string;
        /**
         * Availability domain for new DB Systems, e.g.
         * 'Uocm:US-ASHBURN-AD-1'.
         */
        availabilityDomain: string;
        /**
         * Subnet OCID that new DB Systems are attached to.
         */
        subnetId: string;
        /**
         * SSH public key installed on new DB Systems.
         */
        sshPublicKey: string;
      };
      /**
       * This client's Azure subscription/tenant config, used by the
       * oracle:azure:createVm scaffolder action whenever this client
       * deploys to Azure. One account per client — not per tenant tag.
       */
      azure?: {
        /**
         * Azure subscription ID that VMs are created in.
         */
        subscriptionId: string;
        /**
         * Azure AD tenant ID used for service authentication.
         * @visibility secret
         */
        tenantId: string;
        /**
         * Client (application) ID of the service principal used to
         * authenticate to Azure.
         * @visibility secret
         */
        clientId: string;
        /**
         * Client secret of the service principal used to authenticate to
         * Azure.
         * @visibility secret
         */
        clientSecret: string;
        /**
         * Resource group that new VMs and NICs are created in.
         */
        resourceGroup: string;
        /**
         * Azure region/location for new VMs, e.g. 'eastus'.
         */
        location: string;
        /**
         * Resource ID of the subnet new VM NICs are attached to.
         */
        subnetId: string;
        /**
         * Local admin username created on new VMs.
         * @default oracleadmin
         */
        adminUsername?: string;
      };
    }[];

    /**
     * Marketplace image reference for Azure VMs — shared across all Azure
     * tenants, since it's about which OS/DB image to boot, not
     * tenant-specific like the auth/network config above.
     */
    azureImage?: {
      /**
       * Marketplace image publisher, e.g. 'Oracle'.
       */
      publisher: string;
      /**
       * Marketplace image offer, e.g. 'oracle-database'.
       */
      offer: string;
      /**
       * Fallback SKU used when no version-specific SKU is configured
       * below.
       */
      defaultSku: string;
      /**
       * Map of Oracle version (as selected in the template, e.g. '19c')
       * to the marketplace image SKU to use for that version.
       */
      skus?: {
        [oracleVersion: string]: string;
      };
    };
  };

  /**
   * Read-only connection to Helios/SAM-tool's Postgres database, used by
   * the sam-pricing backend plugin to read shared.oracle_product_list_prices
   * for accurate Oracle pricing in the DBaaS cost comparison, instead of
   * relying only on public list prices.
   */
  samTool?: {
    database?: {
      host: string;
      port: number;
      database: string;
      user: string;
      /**
       * @visibility secret
       */
      password: string;
      /**
       * Whether to connect over SSL. Defaults to false.
       */
      ssl?: boolean;
    };
  };

  /**
   * Platform-wide, login-scoped tenants — the hybrid on-prem/Azure
   * deployment concept, distinct from oracleDbaas.clients[].tenants[]
   * (a DBaaS-specific cost-tracking tag list). Each tenant here maps to
   * an Azure AD security group; a signed-in user's access is resolved by
   * checking live Microsoft Graph group membership on every request, via
   * the tenants backend plugin (packages/backend/src/plugins/tenants/).
   */
  platformTenants?: {
    /**
     * Azure AD app registration used for app-only (client credentials)
     * Microsoft Graph calls to check group membership. Needs the
     * GroupMember.Read.All (or Directory.Read.All) Graph API APPLICATION
     * permission, admin-consented in the Azure AD tenant. Can be the same
     * app registration as auth.providers.microsoft, or a separate one.
     */
    graph: {
      tenantId: string;
      clientId: string;
      /**
       * @visibility secret
       */
      clientSecret: string;
    };
    /**
     * One entry per tenant. adGroupId is the Azure AD security group's
     * object id — membership in that group is what grants a user access
     * to this tenant.
     */
    tenants: {
      adGroupId: string;
      /**
       * Which client (organization) this tenant belongs to.
       */
      clientCode: string;
      /**
       * Unique tenant identifier within the client, e.g. 'tenant-1'.
       */
      tenantId: string;
      /**
       * Display name shown in the tenant switcher.
       */
      name: string;
      /**
       * On-prem resource pool this tenant can deploy services onto via
       * the orchestrator API (not yet implemented — see
       * packages/backend/src/plugins/tenants/router.ts).
       */
      onPrem?: {
        resourcePoolId: string;
        orchestratorUrl: string;
      };
      /**
       * This tenant's Azure account, if it also deploys to Azure — used
       * by the networking plugin (packages/backend/src/plugins/networking/)
       * to provision real Resource Groups and NSGs via a service
       * principal scoped to this one subscription.
       */
      azure?: {
        subscriptionId: string;
        /**
         * Azure AD tenant ID this service principal authenticates
         * against. Can be the same tenant as auth.providers.microsoft,
         * but the service principal itself is separate from that sign-in
         * app registration.
         */
        tenantId: string;
        clientId: string;
        /**
         * @visibility secret
         */
        clientSecret: string;
        /**
         * Azure region new resource groups/NSGs/deployments are created
         * in, e.g. 'eastus'.
         */
        location: string;
        /**
         * Subnet new service deployments' network interfaces are
         * attached to.
         */
        subnetId: string;
      };
    }[];
  };
}
