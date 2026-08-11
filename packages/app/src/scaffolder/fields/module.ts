import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';
import { BoxedChoiceField } from './BoxedChoiceField';
import { MultiChoiceBoxField } from './MultiChoiceBoxField';
import { InfoNoteField } from './InfoNoteField';

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

export const scaffolderFieldsModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [boxedChoiceFormField, multiChoiceBoxFormField, infoNoteFormField],
});

export default scaffolderFieldsModule;
