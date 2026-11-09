# Bugs from review

Status: Fixed = fixed with a test, R = reproduced by running code, V = verified by reading, A = found by an agent reading, not verified yet.

## Core: state and event

1. [Fixed] `state/proxy.ts:174` Proxy compares by reference, array states mutate in place, so changes after the first are dropped.
2. [Fixed] `state/helpers/array.ts:251,256` `pop`/`shift` in `write_apply` check `if (items[0])`, removing a falsy value goes wrong.
3. [Fixed] `state/collected.ts:160-169,199-208` A throwing getter leaves `calc` true forever, the state never recomputes.
4. [Fixed] `state/collected.ts:177,193` Same source firing twice before the others makes the getter run with an empty slot.
5. [Fixed] `state/local.ts:450-463` If async init throws, pending awaits never resolve and later reads give `undefined`.
6. [Fixed] `state/local.ts:453` `set_ok` during async init is overwritten by the init result without notifying subscribers.
7. [Fixed] `state/local.ts:653` Lazy sync state reports `rsync === false` until first read.
8. [Fixed] `state/proxy.ts:226-231,271` Proxy copies `rok`/`rsync`/`writable` from the source, `p.ros` over `RES` reports `rok` false, `rosw` without write transform reports writable.
9. [Fixed] `array.ts:351`, `object.ts:262`, `boolean.ts:42` `!this.writable` tests a State object (always truthy), the `writable` option does nothing.
10. [Fixed] `state/local.ts:492-565` `write` calls `limit` but never `check`, an enum state accepts any value.
11. [Fixed] `state/base.ts:52` `to_json` emits `undefined` (invalid JSON) and does not walk nested plain objects.
12. [Fixed] `state/util.ts:30` `await_value` ignores the current value and never clears its timer.
13. [Fixed] `event/simple.ts:85`, `event/sub.ts:118` Listeners stored in plain `{}`, event names like `"toString"` throw.
14. [Fixed] `state/remote.ts:254` `timeout` only resets the fetching flag, awaiters hang.
15. [Fixed] `state/remote.ts:287` Rejected debounced `write_action` leaves write promises pending.
16. [Fixed] `event/simple.ts:140`, `event/sub.ts:217` A throwing proxy listener stops delivery to normal listeners.
17. [Fixed] `state/types.ts:138-142,181-185` `REA`/`REAW` extend `StateBase<ResultOk<RT>>`, should be `Result`.
18. [Fixed] `state/local.ts:150-172` `read_only`/`read_write` on RESW/ROAW/REAW typed as ROS/ROSW.
19. [Fixed] `state/local.ts:782,798` `roa`/`roaw` accept `Promise<SR<RT>>`, an "always ok" state can hold an error.

## Core: other modules

20. [Fixed] `math/conversion/linearization.ts:16` NaN for input above the last x, loop reads the first y as an x.
21. [Fixed] `common/async.ts:39-45` `sync_resolve(...).then(f, r)` calls `r` when `f` throws.
22. [Fixed] `common/async.ts:57` `sync_reject(promise)` returns the promise unchanged, so it resolves.
23. [Fixed] `common/async.ts:16-17` `sleep_lazy(ms)` without a function throws in the timer and never resolves.
24. [Fixed] `common/throttle.ts:22-32` A call during the last tick starts a second interval that never stops.
25. [Fixed] `common/equals.ts:26` Key order matters, all Dates are equal, `[1]` equals `{0:1}`.
26. [Fixed] `common/ip.ts:41-47` IPv6 `::` not expanded, bad input throws RangeError, numbers above 2^32 accepted as IPv4.
27. [Fixed] `string/index.ts:36-43` Date formatter prints UTC time with the local offset.
28. [Fixed] `math/hash/md5.ts:13` Non-ASCII input hashes wrong, only the low byte of each char is used.
29. [Fixed] `result/index.ts:389,392` `ResultInferOk`/`ResultInferErr` constraints are wrong, README example does not compile.
30. [Fixed] `parse/parse.ts:125` `"ok" in result` treats any object with an `ok` field as a Result.
31. [Fixed] `parse/fetch_parse.ts:277-313` Resubscribe during an in-flight fetch starts two polling loops, shared abort controller can miss requests.
32. [Fixed] `common/array.ts:46` `array_from_length(0, f, pre, post)` drops `pre` and `post`.
33. [Fixed] `parse/parse.ts:180-334` Parser writes defaults/transforms into the caller's input, also on a failed union branch.
34. [Fixed] `result/index.ts:208,213` Interface overloads declare the wrong error/value types. Not a real bug, the classes have correct types and the interface is not exported, fixed for consistency.
35. [Fixed] `common/async.ts:21-28` `deferrer` types `f` as `() => void` but calls it with an argument.

## UI

36. [Fixed] `base/base.ts:80-85` Without an intersection observer, visible subscriptions are never unsubscribed on disconnect.
37. [Fixed] `base/base.ts:144` Removing the observer from a disconnected element subscribes it.
38. [Fixed] `base/intersect_observer.ts:49-57` A queued deferred "visible" can fire after disconnect and resubscribe.
39. [Fixed] `base/intersect_observer.ts:69` With `{}` options the immediate vs deferred check differs between browsers. Worse than listed, Chromium ignored any equal visible/hidden deferral.
40. [Fixed] `base/base.ts:501-505` `detach_state_from_attribute` never deletes the map entry.
41. [Fixed] `form/base.ts:66` Passing `description` silently drops `value`, and `description` is never rendered. Description is now shown as a tooltip.
42. [Fixed] `form/base.ts:95-97` `#func` never assigned, `bind()` twice leaves two states driving one widget.
43. [Fixed] `slider.ts:210,217`, `stepper.ts:211,218` `replaceChild` arguments reversed, `icon_decrease`/`icon_increase` throw.
44. [Fixed] `slider.ts:338`, `stepper.ts:327`, `number_input.ts:184` Auto step is `1/decimals`, 2 decimals gives 0.5 not 0.01.
45. [Fixed] `form/` pointer handling: no `pointercancel`, stepper auto repeat runs forever, momentary buttons stick.
46. [Fixed] `form/text/input/text_input.ts:110` `maxLength = -1` throws when `max_length` is cleared.
47. [Fixed] `drop_down.ts:380,312` Popup attached to the main document only (wrong in popouts), scroll check runs before the table is filled. One popup per document through DOCUMENT_HANDLER.
48. [Fixed] `context-menu/option.ts:42`, `submenu.ts:42` `navigator.vibrate` throws on Safari.
49. [Fixed] `context-menu/engine.ts:114` `context_menu_default(false)` does not clear the default or block the OS menu.
50. [Fixed] `canvas/viewport.ts:218,224` `document`/`window` listeners never removed, uses global `document` not `ownerDocument`.
51. [Fixed] `theme/engine.ts:145-149` `SCALE.sub` without initial update, `rem_to_px` assumes 16 px; `ANIMATION_SPEED` never subscribed.
52. [Fixed] `svg/util/angleToAnchorPoint.ts:6` Negative angles mirrored instead of wrapped.
53. [Fixed] `list/container.ts:148` User supplied observer ignored, passed as options.
54. [Fixed] `form/group/group_collapser.ts:96` Collapse then reopen during the animation leaves it collapsed.
55. [Fixed] `document/document.ts:47` `<link>` stylesheets not copied to popouts.
56. [Fixed] `base/base_loop.ts:38` `slice(index)` over-appends on batched changes, "fresh" skips the destructor. Unfinished `base_loop_state` removed.
57. [Fixed] button/switch/lamp `set icon` Setting the icon twice leaves duplicate icons.
58. [Fixed] `theme/settings.ts:67` OS dark mode listener overwrites and persists over the user's explicit theme choice. Now `theme_init` is mandatory, it decides if a System theme following the OS is offered, the OS never writes the stored choice.
59. [Fixed] settings `get` Corrupt stored value used without a validity check.
60. [Fixed] `theme/builtIn.ts` Scrollbar colour variables typed as `"Font"`.
61. [Fixed] `keyboard/base.ts:69,75` `body.style.transform` clobbers user styles and breaks `position: fixed`. The page's own transform is kept and restored, the shift never moves the element's top off screen. Fixed elements still move while the keyboard is open, accepted.
62. [Fixed] `base/define_element.ts:92` Duplicate define check sniffs a Chromium specific error message.
63. [Fixed] context-menu, list, svg text: labels set with `innerHTML`, only a problem if labels come from data.

## Found while fixing

64. [Fixed] `math/index.ts:11` `number_step_start_decimal` returns early when there is no step, so `decimals` is ignored and number `limit` does not round with only `decimals` set.
65. [Fixed] Number, string and enum helpers ignore the `writable` option in `check` (array, object and boolean use `check_writable`).
66. [Fixed] `state/README.md` string helper example uses option `max_bytes`, the code calls it `max_length_bytes`.
67. [Fixed] `state/local.ts` calls `helper.on_change` on every set, but `on_change` is not part of the public `Helper` interface, a custom helper without it throws `on_change is not a function`.

## User added

xx. [Fixed] Investigate if double call of state check can be prevented. Form elements no longer call `state.check` before `write`, `write` checks and its error is shown.

# Bugs from the UI test pass

Status F = failing test exists (run `npm test -w @chocbite/ts-lib-ui`), T = failing type test (fails `npx tsc --noEmit`), A = looks wrong, no test yet.

## Form: text, special, selectors

68. [Fixed] `text_input.ts:59,66`, `text_multi_line.ts:84` Max length / max bytes check ignores the selection, a full field can not be typed over.
69. [Fixed] `text_input.ts:43`, `text_multi_line.ts:48` A state change made while focused is not shown after the focus leaves.
70. [Fixed] `text_input.ts:158` Max length of a previously bound state stays after rebinding.
71. [Fixed] `text_multi_line.ts:203-208` The `filter` option is never applied.
72. [Fixed] `text_multi_line.ts:142` `maxLength = -1` throws when max length is cleared, same as #46.
73. [Fixed] `text_multi_line.ts:68,101` A second `onkeydown` replaces the one that stops Enter reaching parent elements.
74. [Fixed] `text_multi_line.scss:29-30` `base.$size_height - 0.2rem` compiles to invalid CSS, both height rules are dropped.
75. [Fixed] `ip_input.ts:40,48` Undeclared `length` resolves to `window.length`, separators and Delete never move to the next part.
76. [Fixed] `ip_input.ts:62` Full part check ignores the selection, a full part can not be typed over.
77. [Fixed] `ip_input.ts:80` A value above 255 in the last IPv4 part is not blocked, it compares with `#parts.length` (8).
78. [Fixed] `ip_input.ts:189` Changing the type removes the warning input.
79. [Fixed] `ip_input.ts:145,148,161,171` An incomplete address on Enter/blur, or pasting text that is not an address, throws instead of warning.
80. [Fixed] `form/base.ts:280`, `ip_input.ts:145` Every blur calls `change` and writes the state, a new `IPAddress` never equals the buffer. Now compared with the new `IPAddress.equals`.
81. [Fixed] `date_time_input.scss:63-66` Icon selectors use `material_action_...` names, the icons are never shown.
82. [Fixed] `date_time_input.ts:138` String mode with the time type clears the value, `new Date("10:30")` is invalid.
83. [Fixed] `date_time_input.ts:84` Uses today's timezone offset, dates on the other side of daylight saving are an hour off. The tests only fail in a daylight saving timezone.
84. [Fixed] `selector_base.ts:53` Number keys of an enum become strings, nothing is selected and "1" is written. Enum keys are now strings only, number keys are rejected by the types.
85. [Fixed] `selector_base.ts:43` Rebinding to a state without a list keeps following the old list.
86. [Fixed] `toggle_button.ts:93` Selected index not reset for an unknown value, arrows start from the old position.
87. [Fixed] `drop_down.ts:128,315` Opening another dropdown from code does not close the first.

## Form: base, number, boolean, group

88. [Fixed] `number_input.ts:104`, `stepper.ts:180`, `slider.ts:204` The bound value is drawn with 0 decimals before the related decimals arrive, the decimals setter does not redraw, 2.5 shows as "3".
89. [Fixed] `form/base.ts:108-110` Rebinding to a state without related info keeps the old min/max.
90. [Fixed] `form/base.ts:227-230`, `number_input.ts:49-54`, `stepper.ts:57` Focus then blur without editing writes the stale shown value back, reverting a newer state value.
91. [Fixed] `form/base.ts:280` A typed value that rounds to the current value leaves the typed text on screen.
92. [Fixed] `stepper.ts:26,270-275` (also number input, slider) Default decimals 0 rounds fractional steps away, step 0.1 never moves. Without decimals they now come from step and start.
93. [Fixed] `stepper.ts:162-166` No digits can be typed after a minus sign.
94. [Fixed] `stepper.ts:101` Clicking the number area without a value throws (`firstChild!` is null).
95. [Fixed] `slider.ts:243-245` Without a max (Infinity) the handle jumps to the left edge.
96. [Fixed] `button.ts:108`, `switch.ts:54` A keyup of another key clears the Enter/Space handler, a momentary button stays on and the switch does not toggle.
97. [Fixed] `switch.ts:84-91` No `pointercancel`, the switch stays active after a cancelled press.
98. [Fixed] `group_base.ts:64-67` The `line` border is never removed when the border changes.
99. [Fixed] `group.ts`, `group_base.ts` The group `change` listener is accepted but never called. It gets the values of all components that have one.
100. [Fixed] `group_collapser.ts:59` Starting collapsed shows the collapse icon instead of the expand icon.
101. [Fixed] `group_collapser.ts:71` Setting `group` keeps pointing at the removed group, `replaceChild` returns the old node.

## List, selection

102. [Fixed] `list/container.ts:299-308`, `list/row.ts:283-292`, `base/base_loop.ts:73-76`, `canvas/viewport.ts:416-420` Moving more than one item reads `from_index + i` after earlier nodes were removed, rows/nodes are scrambled or a TypeError is thrown.
103. [Fixed] `list/container.ts:166-187` Replacing the columns does not rebuild existing rows.
104. [Fixed] `list/types.ts:29` The column `order` option is never used. Columns without `order` use their position.
105. [Fixed] `list/add_row.ts:512` Disabled is never cleared again.
106. [Fixed] `list/add_row.ts:505-512`, `list/key_field.ts:429-433`, `list/row.ts:135-143` A fixed value replacing a state (text, disabled, icon, openable) does not detach the state, which overwrites it again. A falsy `openable` is ignored.
107. [Fixed] `list/row.ts:135-148` A row created opened with an openable state never opens, the state only arrives after connect. Only the first value of the state counts.
108. [Fixed] `list/row.ts:155-156` A sub row without a context menu summons the parent row's menu. It now shows no menu.
109. [Fixed] `selection/selection.ts:46-66` An offset past the end, or an empty contenteditable, gives no caret and no focus.
110. [Fixed] `list/types.ts:70` The transformer's `state` argument is typed as the top level rows type, sub rows can pass a State.

## Keyboard, settings, spinner

111. [Fixed] `settings/index.ts:135` `set(id, value: any)` accepts values JSON can not store, a Map is stored as `{}`. Now typed `SettingsJson`.
112. [Fixed] `settings/index.ts:117-123` A version migration runs again on every `get`, also on already migrated data.
113. [Fixed] `spinner/index.scss:24` Dots use the old variable `--@chocolatelibui/spinners/color`, they are always black.
114. [Fixed] `keyboard_keys.ts:113` Key events are sent with `ctrlKey: true`, every key looks like Ctrl+key.
115. [Fixed] `keyboard_keys.ts:271` Digit keys get code `Key1` instead of `Digit1`. Characters without a key of their own now get an empty code.
116. [Fixed] `keyboard_keys.ts:155-159` Opening for another input drops the pending `change` of the previous input.
117. [Fixed] `keyboard_keys.ts:221` `setRangeText` throws on email and number inputs, number keyboards do not work on number inputs. These inputs are now edited with `execCommand`, setting the value of a number input clears partial numbers like `-` and `1.`. Left/Right threw on them too.
118. [Fixed] `keyboard_datetime.ts:80` Month and week values are not parsed, the keyboard opens on the current date.
119. [Fixed] `keyboard_color.ts:285-289,352-357` `change` is never emitted after a slider release or square drag. Also emitted on close and when opened for another input now.
120. [Fixed] `keyboard_color.ts:244,355` The hue is lost when a drag passes the grey edge of the square. The keyboard read its own input events back.
121. [Fixed] `keyboard/index.ts:63-67`, `keyboard/base.ts:332-340` Focus moving by keyboard or `.focus()` leaves two keyboards open. Opening a keyboard closes the open one, which emits its pending `change`.

## Base, svg, canvas, context menu

122. [Fixed] `base/base.ts:74-76` Visible is set before `is_connected`, a connected state attached from `on_visible` is never subscribed.
123. [Fixed] `base/base.ts:93` A plain value in `opts()` does not detach a state attached by an earlier `opts()`.
124. [Fixed] `base/intersect_observer.ts:301-320` A hide joins a timer already running, the real hidden deferral is anywhere from 0 to the full time. Every hidden element now has its own deadline.
125. [Fixed] `canvas/viewport.ts:150-221` No pointercancel, after a cancelled drag the next drag counts as a second finger and pans at half speed.
126. [Fixed] `svg/primitives/ellipse.ts:241-249` Negative sweeps over 180 degrees draw the small arc (`Math.abs` missing), a 360 degree arc draws nothing. The doc comments said radians, the angles are degrees.
127. [Fixed] `svg/primitives/shared.ts:5-15` `svg.create("defs")` and `svg.create("clipPath")`, documented in the README, are rejected by the types. Now typed with the DOM's `SVGElementTagNameMap`.
128. [Fixed] `context-menu/menu.ts:204` `dont_cover` computes x but never sets left, the menu lands at left 0.
129. [Fixed] `context-menu/menu.ts:209` `dont_cover` with a tall element places the menu off screen.
130. [Fixed] `context-menu/menu.ts:124-125` A divider at either end sends arrow key focus to the wrong end.
131. [Fixed] `context-menu/container.ts:45` A menu replacing an open menu loses the element focus should return to.
132. [Fixed] `context-menu/container.ts:47` Summoning a menu while a submenu is open throws NotFoundError. The old menu is now closed before it is replaced.

## Looked wrong, tests written while fixing

133. [Fixed] `canvas/viewport.ts:324,329` `pan_x`/`pan_y` start at 1 instead of 0. The resize offset being 0 is not a bug, pan is relative to the center.
134. [Fixed] `context-menu/line.ts:268-281` A menu of only dividers recurses forever in `focus_next`; `menu.ts:87-91` a promise menu closed before it resolves still opens itself.
135. [Fixed] `keyboard/base.ts:367-368` Opening for an input in another document leaves the old document's listeners.
136. [Fixed] `theme_init_variable_root` and `settings_init` silently replace a group of the same name; the theme dash check runs before the name transform. A duplicate name now throws, like `define_element`.
137. [Fixed] Base elements add children in their constructor, so `document.createElement("spinner-spinner")` throws, only the factories work. Decided: HTML is not supported, documented in the ui README, AGENTS.md and the `Base` doc comment.
138. [Fixed] `list/container.ts:179` Resizing a column writes `init_width` into the caller's column options; `list/add_row.ts:534-537` `state` getter throws "Method not implemented".
139. [Fixed] `password_input.ts:30` The password is cleared on focus and not restored on blur without typing; `date_time_input.ts:138` string dates `YYYY-MM-DD` are parsed as UTC; text filters with the `g` flag give alternating results.
140. [Fixed] `stepper.ts:67-75` `pointer_id` never cleared and id 0 skipped; `slider.ts:112,148` Escape handler not removed after a drag; `group.ts:102` `elements` getter only returns elements with an id; `form/base.ts:144-149` `clear()` does not reset the error flag.
141. [Fixed] `viewport_mover.ts:334,338,399` Grid 0 gives NaN, mover handles ignore pointercancel, mover/transformer stays after its element is removed.
142. [Fixed] `svg/trials.ts` Leftover `console.error("TESTETSWE")`. The trials files were removed.
143. [Fixed] `keyboard_keys.ts:306` Left at the start of an input moves the cursor to the end, `setSelectionRange(-1)` wraps.
144. [Fixed] `keyboard/base.ts` Tab or `.focus()` to an element that is not the input leaves the keyboard open, the `blur` listener skipped blurs of the input itself. Now closes on `focusin` outside the keyboard and the input.

## Found while fixing, not done yet

145. [Fixed] `date_time_input.ts` A state change made while focused is not shown after the focus leaves, same as #69.
146. [Fixed] `list/add_row.ts` The `icon` option of `ListAddRowOptions` is never used. Shown before the text in the `add_icon` theme color.
147. [Fixed] `list/row.ts`, `list/types.ts` `ListRow.state` and `ListRowParent.state` are typed as the top level rows type, sub rows can be a State, same as #110 one level down. Now `ListParentRows<A>`.
148. [Fixed] `form/number/progress.ts` Does not redraw when decimals, min or max change after a value, only matters for related states that arrive late.
149. [Fixed] `theme/variables.ts` `theme_set_name_transform` is not exported from the theme module, consumers can not use it. Removed, theme variable groups have no package name in them. Renaming stored settings is `settings_set_name_transform`, which now reports with `console.error` when called after a settings group was made, documented in the ui README.
