/**
 * Configuration for the Oracle Database as a Service scaffolder template
 * (templates/oracle-dbaas). These are platform-level defaults — end users
 * never see them in the template form.
 */
export interface Config {
  oracleDbaas?: {
    /**
     * Oracle Cloud Infrastructure (OCI) provisioning config, used by the
     * oracle:oci:createDbSystem scaffolder action.
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
       * Availability domain for new DB Systems, e.g. 'Uocm:US-ASHBURN-AD-1'.
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
     * Microsoft Azure provisioning config, used by the
     * oracle:azure:createVm scaffolder action.
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
      /**
       * Marketplace image reference used as the VM base image.
       */
      image: {
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
  };
}
