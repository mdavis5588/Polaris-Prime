import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';
import { BoxedChoiceField } from './BoxedChoiceField';
import { MultiChoiceBoxField } from './MultiChoiceBoxField';
import { InfoNoteField } from './InfoNoteField';
import { DeploymentTargetField } from './DeploymentTargetField';
import { CostComparisonField } from './CostComparisonField';
import { ClientPickerField } from './ClientPickerField';
import { TenantPickerField } from './TenantPickerField';

const boxedChoiceFormField = FormFieldBlueprint.make({
  name: 'boxed-choice',
  params: {
    field: () =>
      Promise.resolve(
        createFormField({
          name: 'BoxedChoice',
          component: BoxedChoiceField,
        }),
      ),
  },
});

const multiChoiceBoxFormField = FormFieldBlueprint.make({
  name: 'multi-choice-box',
  params: {
    field: () =>
      Promise.resolve(
        createFormField({
          name: 'MultiChoiceBox',
          component: MultiChoiceBoxField,
        }),
      ),
  },
});

const infoNoteFormField = FormFieldBlueprint.make({
  name: 'info-note',
  params: {
    field: () =>
      Promise.resolve(
        createFormField({
          name: 'InfoNote',
          component: InfoNoteField,
        }),
      ),
  },
});

const deploymentTargetFormField = FormFieldBlueprint.make({
  name: 'deployment-target',
  params: {
    field: () =>
      Promise.resolve(
        createFormField({
          name: 'DeploymentTarget',
          component: DeploymentTargetField,
        }),
      ),
  },
});

const costComparisonFormField = FormFieldBlueprint.make({
  name: 'cost-comparison',
  params: {
    field: () =>
      Promise.resolve(
        createFormField({
          name: 'CostComparison',
          component: CostComparisonField,
        }),
      ),
  },
});

const clientPickerFormField = FormFieldBlueprint.make({
  name: 'client-picker',
  params: {
    field: () =>
      Promise.resolve(
        createFormField({
          name: 'ClientPicker',
          component: ClientPickerField,
        }),
      ),
  },
});

const tenantPickerFormField = FormFieldBlueprint.make({
  name: 'tenant-picker',
  params: {
    field: () =>
      Promise.resolve(
        createFormField({
          name: 'TenantPicker',
          component: TenantPickerField,
        }),
      ),
  },
});

export const scaffolderFieldsModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [
    boxedChoiceFormField,
    multiChoiceBoxFormField,
    infoNoteFormField,
    deploymentTargetFormField,
    costComparisonFormField,
    clientPickerFormField,
    tenantPickerFormField,
  ],
});

export default scaffolderFieldsModule;
