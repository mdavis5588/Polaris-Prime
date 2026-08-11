/**
 * Configuration for the Oracle Database as a Service scaffolder template
 * (templates/oracle-dbaas). These are platform-level defaults — end users
 * never see them in the template form.
 */
export interface Config {
  oracleDbaas?: {
    /**
     * Clients this platform provisions databases for, each with the cloud
     * tenants they have access to (e.g. a dev/test OCI tenancy and a
     * separate production Azure subscription). Only code/name/target are
     * ever exposed to the browser (via the dbaas-tenants backend plugin);
     * everything else here stays server-side and is only read when a
     * scaffolder action actually runs against that tenant.
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
      tenants: {
        /**
         * Unique tenant identifier within this client, e.g. 'acme-dev'.
         */
        id: string;
        /**
         * Display name shown in the Tenant picker.
         */
        name: string;
        /**
         * Which cloud this tenant is on — determines whether `oci` or
         * `azure` below is used, and which Deployment Target branch this
         * tenant appears under.
         */
        target: 'oci' | 'azure';
        /**
         * OCI tenancy config, used by the oracle:oci:createDbSystem
         * scaffolder action. Required when target is 'oci'.
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
         * Azure subscription/tenant config, used by the
         * oracle:azure:createVm scaffolder action. Required when target is
         * 'azure'.
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
}
