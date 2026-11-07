Must be doable with a more itterative approach core\src\math\conversion\linearization.ts
Try fix ! core\src\common\hash.ts
Try fix ! core\src\math\hash\md5.ts

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
14. [A] `state/remote.ts:254` `timeout` only resets the fetching flag, awaiters hang.
15. [A] `state/remote.ts:287` Rejected debounced `write_action` leaves write promises pending.
16. [A] `event/simple.ts:140`, `event/sub.ts:217` A throwing proxy listener stops delivery to normal listeners.
17. [A] `state/types.ts:138-142,181-185` `REA`/`REAW` extend `StateBase<ResultOk<RT>>`, should be `Result`.
18. [A] `state/local.ts:150-172` `read_only`/`read_write` on RESW/ROAW/REAW typed as ROS/ROSW.
19. [A] `state/local.ts:782,798` `roa`/`roaw` accept `Promise<SR<RT>>`, an "always ok" state can hold an error.

## Core: other modules

20. [R] `math/conversion/linearization.ts:16` NaN for input above the last x, loop reads the first y as an x.
21. [R] `common/async.ts:39-45` `sync_resolve(...).then(f, r)` calls `r` when `f` throws.
22. [R] `common/async.ts:57` `sync_reject(promise)` returns the promise unchanged, so it resolves.
23. [A] `common/async.ts:16-17` `sleep_lazy(ms)` without a function throws in the timer and never resolves.
24. [R] `common/throttle.ts:22-32` A call during the last tick starts a second interval that never stops.
25. [R] `common/equals.ts:26` Key order matters, all Dates are equal, `[1]` equals `{0:1}`.
26. [R] `common/ip.ts:41-47` IPv6 `::` not expanded, bad input throws RangeError, numbers above 2^32 accepted as IPv4.
27. [R] `string/index.ts:36-43` Date formatter prints UTC time with the local offset.
28. [R] `math/hash/md5.ts:13` Non-ASCII input hashes wrong, only the low byte of each char is used.
29. [R] `result/index.ts:389,392` `ResultInferOk`/`ResultInferErr` constraints are wrong, README example does not compile.
30. [R] `parse/parse.ts:125` `"ok" in result` treats any object with an `ok` field as a Result.
31. [A] `parse/fetch_parse.ts:277-313` Resubscribe during an in-flight fetch starts two polling loops, shared abort controller can miss requests.
32. [A] `common/array.ts:46` `array_from_length(0, f, pre, post)` drops `pre` and `post`.
33. [A] `parse/parse.ts:180-334` Parser writes defaults/transforms into the caller's input, also on a failed union branch.
34. [A] `result/index.ts:208,213` Interface overloads declare the wrong error/value types.
35. [A] `common/async.ts:21-28` `deferrer` types `f` as `() => void` but calls it with an argument.

## UI

36. [A] `base/base.ts:80-85` Without an intersection observer, visible subscriptions are never unsubscribed on disconnect.
37. [A] `base/base.ts:144` Removing the observer from a disconnected element subscribes it.
38. [A] `base/intersect_observer.ts:49-57` A queued deferred "visible" can fire after disconnect and resubscribe.
39. [A] `base/intersect_observer.ts:69` With `{}` options the immediate vs deferred check differs between browsers.
40. [A] `base/base.ts:501-505` `detach_state_from_attribute` never deletes the map entry.
41. [V] `form/base.ts:66` Passing `description` silently drops `value`, and `description` is never rendered.
42. [V] `form/base.ts:95-97` `#func` never assigned, `bind()` twice leaves two states driving one widget.
43. [V] `slider.ts:210,217`, `stepper.ts:211,218` `replaceChild` arguments reversed, `icon_decrease`/`icon_increase` throw.
44. [V] `slider.ts:338`, `stepper.ts:327`, `number_input.ts:184` Auto step is `1/decimals`, 2 decimals gives 0.5 not 0.01.
45. [A] `form/` pointer handling: no `pointercancel`, stepper auto repeat runs forever, momentary buttons stick.
46. [A] `form/text/input/text_input.ts:110` `maxLength = -1` throws when `max_length` is cleared.
47. [A] `drop_down.ts:380,312` Popup attached to the main document only (wrong in popouts), scroll check runs before the table is filled.
48. [A] `context-menu/option.ts:42`, `submenu.ts:42` `navigator.vibrate` throws on Safari.
49. [A] `context-menu/engine.ts:114` `context_menu_default(false)` does not clear the default or block the OS menu.
50. [A] `canvas/viewport.ts:218,224` `document`/`window` listeners never removed, uses global `document` not `ownerDocument`.
51. [A] `theme/engine.ts:145-149` `SCALE.sub` without initial update, `rem_to_px` assumes 16 px; `ANIMATION_SPEED` never subscribed.
52. [A] `svg/util/angleToAnchorPoint.ts:6` Negative angles mirrored instead of wrapped.
53. [A] `list/container.ts:148` User supplied observer ignored, passed as options.
54. [A] `form/group/group_collapser.ts:96` Collapse then reopen during the animation leaves it collapsed.
55. [A] `document/document.ts:47` `<link>` stylesheets not copied to popouts.
56. [A] `base/base_loop.ts:38` `slice(index)` over-appends on batched changes, "fresh" skips the destructor.
57. [A] button/switch/lamp `set icon` Setting the icon twice leaves duplicate icons.
58. [A] `theme/settings.ts:67` OS dark mode listener overwrites and persists over the user's explicit theme choice.
59. [A] settings `get` Corrupt stored value used without a validity check.
60. [A] `theme/builtIn.ts` Scrollbar colour variables typed as `"Font"`.
61. [A] `keyboard/base.ts:69,75` `body.style.transform` clobbers user styles and breaks `position: fixed`.
62. [A] `base/define_element.ts:92` Duplicate define check sniffs a Chromium specific error message.
63. [A] context-menu, list, svg text: labels set with `innerHTML`, only a problem if labels come from data.

## Found while fixing

64. [V] `math/index.ts:11` `number_step_start_decimal` returns early when there is no step, so `decimals` is ignored and number `limit` does not round with only `decimals` set.
65. [V] Number, string and enum helpers ignore the `writable` option in `check` (array, object and boolean use `check_writable`).
66. [V] `state/README.md` string helper example uses option `max_bytes`, the code calls it `max_length_bytes`.
