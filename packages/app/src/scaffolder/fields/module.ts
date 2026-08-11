import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';
import { BoxedChoiceField } from './BoxedChoiceField';

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

export const scaffolderFieldsModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [boxedChoiceFormField],
});

export default scaffolderFieldsModule;
