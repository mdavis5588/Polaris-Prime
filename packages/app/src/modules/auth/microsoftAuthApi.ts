import { ApiBlueprint } from '@backstage/frontend-plugin-api';
import {
  microsoftAuthApiRef,
  discoveryApiRef,
  oauthRequestApiRef,
  configApiRef,
} from '@backstage/core-plugin-api';
import { MicrosoftAuth } from '@backstage/core-app-api';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';

export const microsoftAuthApi = ApiBlueprint.make({
  params: define =>
    define({
      api: microsoftAuthApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        oauthRequestApi: oauthRequestApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
        MicrosoftAuth.create({
          discoveryApi,
          oauthRequestApi,
          configApi,
          provider: {
            id: 'microsoft',
            title: 'Microsoft',
            icon: AccountCircleIcon,
          },
        }),
    }),
});

export default microsoftAuthApi;
