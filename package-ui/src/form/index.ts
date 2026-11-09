import {
  FormColors,
  FormOptions,
  FormValueOptions,
  FormValueWriteOptions,
} from "./base";
import {
  form_button,
  FormButton,
  type FormButtonOptions,
} from "./boolean/button/button";
import { form_lamp, FormLamp, type FormLampOptions } from "./boolean/lamp/lamp";
import {
  form_switch,
  FormSwitch,
  type FormSwitchOptions,
} from "./boolean/switch/switch";
import { form_group, FormGroup, type FormGroupOptions } from "./group/group";
import {
  form_group_collapser,
  FormGroupCollapser,
  type FormGroupCollapserOptions,
} from "./group/group_collapser";
import { form_list_field, ListFormField } from "./list/list_field";
import {
  type FormNumberOptions,
  type FormNumberWriteOptions,
} from "./number/number_base";
import {
  form_number_input,
  FormNumberInput,
} from "./number/number_input/number_input";
import { form_progress, FormProgress } from "./number/progress/progress";
import { form_slider, FormSlider } from "./number/slider/slider";
import { form_stepper, FormStepper } from "./number/stepper/stepper";
import {
  form_dropdown,
  FormDropdown,
  type FormDropDownOptions,
  type FormDropDownSelection,
} from "./selectors/drop_down/drop_down";
import { type FormSelections } from "./selectors/selector_base";
import {
  form_toggle_button,
  FormToggleButton,
  type FormToggleButtonSelection,
} from "./selectors/toggle_button/toggle_button";
import {
  form_spacer,
  FormSpacer,
  type FormSpacerOptions,
} from "./spacing/spacer";
import {
  form_color,
  FormColor,
  type FormColorOptions,
} from "./special/color/color_input";
import {
  form_date_time,
  FormDateTime,
  FormDateTimeMode,
  FormDateTimeType,
  type FormDateTimeOptions,
} from "./special/date_time/date_time_input";
import { form_ip, FormIp, type FormIpOptions } from "./special/ip/ip_input";
import {
  form_password,
  FormPassword,
  type FormPasswordOptions,
} from "./special/password/password_input";
import {
  form_text_input,
  FormTextInput,
  type FormTextInputOptions,
} from "./text/input/text_input";
import {
  form_text_multiline,
  FormTextMultiline,
  type FormTextMultilineOptions,
} from "./text/multi_line/text_multi_line";
import { form_text, FormText, type FormTextOptions } from "./text/text/text";

/**Form elements with label */
export const form = {
  FormColors,

  //Boolean
  button: form_button,
  switch: form_switch,
  lamp: form_lamp,

  //Group
  group: form_group,
  group_collapser: form_group_collapser,

  //Special
  color: form_color,
  date_time: form_date_time,
  FormDateTimeMode,
  FormDateTimeType,
  ip: form_ip,
  password: form_password,

  //Number
  progress: form_progress,
  number_input: form_number_input,
  slider: form_slider,
  stepper: form_stepper,

  //Selectors
  dropdown: form_dropdown,
  toggle_button: form_toggle_button,

  //Spacing
  spacer: form_spacer,

  //Text
  text: form_text,
  text_input: form_text_input,
  text_multiline: form_text_multiline,

  //List
  list_field: form_list_field,
};
export default form;

export type {
  FormButton,
  FormButtonOptions,
  FormColor,
  FormColorOptions,
  FormDateTime,
  FormDateTimeOptions,
  FormDropdown,
  FormDropDownOptions,
  FormDropDownSelection,
  FormGroup,
  FormGroupCollapser,
  FormGroupCollapserOptions,
  FormGroupOptions,
  FormIp,
  FormIpOptions,
  FormLamp,
  FormLampOptions,
  FormNumberInput,
  FormNumberOptions,
  FormNumberWriteOptions,
  FormOptions,
  FormPassword,
  FormPasswordOptions,
  FormProgress,
  FormSelections,
  FormSlider,
  FormSpacer,
  FormSpacerOptions,
  FormStepper,
  FormSwitch,
  FormSwitchOptions,
  FormText,
  FormTextInput,
  FormTextInputOptions,
  FormTextMultiline,
  FormTextMultilineOptions,
  FormTextOptions,
  FormToggleButton,
  FormToggleButtonSelection,
  FormValueOptions,
  FormValueWriteOptions,
  ListFormField,
};

export { FormColors, FormElement, FormValue, FormValueWrite } from "./base";
export {
  FormDateTimeMode,
  FormDateTimeType,
} from "./special/date_time/date_time_input";
