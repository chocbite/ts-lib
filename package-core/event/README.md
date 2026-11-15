# @chocbite/ts-lib/event

Typed event handlers. Events are named by the keys of a map type, and each key's type is the data that event carries.

- **`EventHandler`**: plain named events.
- **`EventHandlerSub`**: named events with sub paths, so listeners can subscribe to one branch of a tree, for example one field of a record.

```typescript
import { EventHandler } from "@chocbite/ts-lib/event";

interface DoorEvents {
  open: { by: string };
  close: undefined;
}

class Door {
  #events = new EventHandler<DoorEvents, Door>(this);
  get events() {
    return this.#events.consumer;
  }
  open(by: string) {
    this.#events.emit("open", { by });
  }
}

const door = new Door();
door.events.on("open", (e) => console.log(e.data.by, e.target === door));
door.open("Ann"); // "Ann" true
```

## Producer and consumer

The handler has two views:

- **`consumer`** (`EventConsumer`): `on`, `off`, `proxy_on` and `proxy_off`. Expose this to the outside.
- **`producer`** (`EventProducer`): everything, including `emit` and `clear`. Keep this to the owner.

Both getters return the handler itself, typed as the narrower interface, so they cost nothing.

## EventHandler

`new EventHandler<Events, Target>(target)`, where `Events` maps event names to their data type and `target` is put on every event. `target` is a public field and can be changed later.

### Listening

```typescript
const listener = door.events.on("open", (e) => {
  e.type; // "open"
  e.target; // the handler's target
  e.data; // { by: string }
});
door.events.off("open", listener);
```

`on` and `off` return the listener, so it can be stored where it is added. Listeners are kept in a `Set` per event:

- Adding the same function twice logs an error and keeps one.
- Removing a function that is not added logs an error.
- A listener's return value is ignored, so it stays subscribed until `off` is called.

### Emitting

```typescript
events.emit("open", { by: "Ann" });
```

The listener gets an `E` object with `type`, `target` and `data`:

- The `E` object is frozen, but `data` is passed as is and is not frozen or copied.
- Listeners run synchronously, in the order they were added.
- An error thrown by a listener is caught and logged with `console.error`, and the remaining listeners still run.
- When an event has no listeners and no proxies, `emit` doesn't create an event object.

### Inspecting and clearing

| Method                  | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `in_use(name)`          | True if the event has at least one listener.   |
| `has(name, listener)`   | True if that listener is added to the event.   |
| `amount(name)`          | Number of listeners on the event.              |
| `clear(name)`           | Removes all listeners of the event.            |

These only count normal listeners, not proxies.

Event names are stored in a `Map`, so names like `toString` or `constructor` are safe.

### Proxies

A proxy listener gets every event of the handler, whatever its name:

```typescript
events.proxy_on((e) => console.log("any event", e.type, e.data));
```

Proxies run before the normal listeners. Errors in them are caught and logged the same way.

`proxy_func()` returns a function that passes the events it receives on to this handler's own listeners for the same event name. Register it as a proxy on another handler to forward all of that handler's events:

```typescript
const inner = new EventHandler<DoorEvents, string>("inner");
const outer = new EventHandler<DoorEvents, string>("outer");
outer.on("open", (e) => console.log(e.target)); // "inner"
inner.proxy_on(outer.proxy_func());
inner.emit("open", { by: "Ann" });
```

Forwarded events keep the original event object, so `target` is the source handler's target. They reach only the receiving handler's normal listeners, not its own proxies, so chains of handlers do not loop.

## EventHandlerSub

Works like `EventHandler`, but `on`, `off`, `emit`, `in_use`, `has`, `amount` and `clear` take an optional sub path, an array of strings. The event object is an `ESub`, which also has `sub`, the path it was emitted with.

```typescript
import { EventHandlerSub } from "@chocbite/ts-lib/event";

const events = new EventHandlerSub<{ change: number }, null>(null);
events.on("change", (e) => console.log("any", e.sub));
events.on("change", (e) => console.log("user.name", e.data), ["user", "name"]);

events.emit("change", 5, ["user", "name"]); // only the user.name listener
events.emit("change", 6); // only the listener without a path
```

An event only reaches listeners on exactly the path it was emitted with. Listeners on a parent path, or with no path, don't get events from deeper paths, and the other way around. To hear everything, use a proxy.

### Clearing

```typescript
events.clear("change", ["user"]); // listeners on user only, user.name stays
events.clear("change", ["user"], true); // listeners on user and every path below it
events.clear("change", undefined, true); // every listener of the event, on every path
```

### Proxies

`proxy_on` listeners get every event, on every path. This includes paths that have never had a listener, and they get the event's `sub` path. `proxy_func()` forwards events to the listeners on the same name and the same path, like `emit` does.
