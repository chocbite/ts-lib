import { form_errors } from "./errors";
import {
  FormColors,
  type FormValueCreateOptions,
  type FormValueOptions,
  type FormValueWriteOptions,
} from "./base";
import {
  form_button,
  FormButton,
  type FormButtonCreateOptions,
  type FormButtonOptions,
} from "./boolean/button/button";
import {
  form_lamp,
  FormLamp,
  type FormLampCreateOptions,
  type FormLampOptions,
} from "./boolean/lamp/lamp";
import {
  form_switch,
  FormSwitch,
  type FormSwitchCreateOptions,
  type FormSwitchOptions,
} from "./boolean/switch/switch";
import {
  form_group,
  FormGroup,
  type FormGroupCreateOptions,
  type FormGroupOptions,
} from "./group/group";
import {
  form_group_collapser,
  FormGroupCollapser,
  type FormGroupCollapserOptions,
} from "./group/group_collapser";
import {
  type FormNumberCreateOptions,
  type FormNumberOptions,
  type FormStepperCreateOptions,
  type FormStepperOptions,
} from "./number/number_base";
import {
  form_number_input,
  FormNumberInput,
} from "./number/number_input/number_input";
import {
  form_progress,
  FormProgress,
  type FormProgressCreateOptions,
  type FormProgressOptions,
} from "./number/progress/progress";
import { form_slider, FormSlider } from "./number/slider/slider";
import { form_stepper, FormStepper } from "./number/stepper/stepper";
import {
  form_dropdown,
  FormDropdown,
  type FormDropDownCreateOptions,
  type FormDropDownOptions,
  type FormDropDownSelection,
} from "./selectors/drop_down/drop_down";
import {
  form_dropdown_multi,
  FormDropdownMulti,
  type FormDropDownMultiCreateOptions,
  type FormDropDownMultiOptions,
} from "./selectors/drop_down/drop_down_multi";
import {
  type FormSelectorCreateOptions,
  type FormSelectorOption,
  type FormSelectorOptions,
  type FormSelections,
} from "./selectors/selector_base";
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
  type FormColorCreateOptions,
  type FormColorOptions,
} from "./special/color/color_input";
import {
  form_date_time,
  FormDateTime,
  FormDateTimeMode,
  FormDateTimePrecision,
  FormDateTimeType,
  type FormDateTimeCreateOptions,
  type FormDateTimeOptions,
} from "./special/date_time/date_time_input";
import {
  form_ip,
  FormIp,
  type FormIpCreateOptions,
  type FormIpOptions,
} from "./special/ip/ip_input";
import {
  form_password,
  FormPassword,
  type FormPasswordCreateOptions,
  type FormPasswordOptions,
} from "./special/password/password_input";
import {
  form_text_input,
  FormTextInput,
  type FormTextInputCreateOptions,
  type FormTextInputOptions,
} from "./text/input/text_input";
import {
  form_text_multiline,
  FormTextMultiline,
  type FormTextMultilineCreateOptions,
  type FormTextMultilineOptions,
} from "./text/multi_line/text_multi_line";
import { form_text, FormText, type FormTextOptions } from "./text/text/text";

/**Form elements with label */
export const form = {
  FormColors,
  /**The kinds of the NiceErrors the form elements make, like form.errors.READ_ONLY*/
  errors: form_errors,

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
  FormDateTimePrecision,
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
  dropdown_multi: form_dropdown_multi,
  toggle_button: form_toggle_button,

  //Spacing
  spacer: form_spacer,

  //Text
  text: form_text,
  text_input: form_text_input,
  text_multiline: form_text_multiline,
};
export default form;

export type {
  FormButton,
  FormButtonCreateOptions,
  FormButtonOptions,
  FormColor,
  FormColorCreateOptions,
  FormColorOptions,
  FormDateTime,
  FormDateTimeCreateOptions,
  FormDateTimeOptions,
  FormDropdown,
  FormDropDownCreateOptions,
  FormDropDownOptions,
  FormDropDownSelection,
  FormDropdownMulti,
  FormDropDownMultiCreateOptions,
  FormDropDownMultiOptions,
  FormGroup,
  FormGroupCollapser,
  FormGroupCollapserOptions,
  FormGroupCreateOptions,
  FormGroupOptions,
  FormIp,
  FormIpCreateOptions,
  FormIpOptions,
  FormLamp,
  FormLampCreateOptions,
  FormLampOptions,
  FormNumberCreateOptions,
  FormNumberInput,
  FormNumberOptions,
  FormPassword,
  FormPasswordCreateOptions,
  FormPasswordOptions,
  FormProgress,
  FormProgressCreateOptions,
  FormProgressOptions,
  FormSelectorCreateOptions,
  FormSelectorOption,
  FormSelectorOptions,
  FormSelections,
  FormSlider,
  FormSpacer,
  FormSpacerOptions,
  FormStepper,
  FormStepperCreateOptions,
  FormStepperOptions,
  FormSwitch,
  FormSwitchCreateOptions,
  FormSwitchOptions,
  FormText,
  FormTextInput,
  FormTextInputCreateOptions,
  FormTextInputOptions,
  FormTextMultiline,
  FormTextMultilineCreateOptions,
  FormTextMultilineOptions,
  FormTextOptions,
  FormToggleButton,
  FormToggleButtonSelection,
  FormValueCreateOptions,
  FormValueOptions,
  FormValueWriteOptions,
};

export { FormColors, FormElement, FormValue, FormValueWrite } from "./base";
export {
  FormDateTimeMode,
  FormDateTimePrecision,
  FormDateTimeType,
} from "./special/date_time/date_time_input";
