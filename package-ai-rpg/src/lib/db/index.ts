//Promise based IndexedDB, with errors as results.
import { err, ok, type Result } from "@chocbite/ts-lib/result";

/**A store of the database*/
export interface DbStore {
  /**Property, or properties for a compound key, the key is read from*/
  key: string | string[];
  /**Indexes by name, each the property or properties it indexes*/
  indexes?: { [name: string]: string | string[] };
}

const request = <T>(req: IDBRequest<T>) =>
  new Promise<Result<T, string>>((resolve) => {
    req.onsuccess = () => resolve(ok(req.result));
    req.onerror = () => resolve(err(String(req.error)));
  });

const complete = (tx: IDBTransaction) =>
  new Promise<Result<void, string>>((resolve) => {
    tx.oncomplete = () => resolve(ok(undefined));
    tx.onerror = tx.onabort = () => resolve(err(String(tx.error)));
  });

export class Db {
  readonly #idb: IDBDatabase;
  private constructor(idb: IDBDatabase) {
    this.#idb = idb;
  }

  /**Opens the database, missing stores and indexes are created.
   * Raise the version whenever stores or indexes are added, upgrades only run on a version change.
   * Removing or changing stores is not handled.*/
  static open(
    name: string,
    version: number,
    stores: { [name: string]: DbStore },
  ): Promise<Result<Db, string>> {
    return new Promise((resolve) => {
      const req = indexedDB.open(name, version);
      req.onupgradeneeded = () => {
        const idb = req.result;
        const tx = req.transaction!;
        for (const [store_name, def] of Object.entries(stores)) {
          const store = idb.objectStoreNames.contains(store_name)
            ? tx.objectStore(store_name)
            : idb.createObjectStore(store_name, { keyPath: def.key });
          for (const [index, key] of Object.entries(def.indexes ?? {}))
            if (!store.indexNames.contains(index)) store.createIndex(index, key);
        }
      };
      req.onsuccess = () => resolve(ok(new Db(req.result)));
      req.onerror = () => resolve(err(String(req.error)));
      req.onblocked = () =>
        resolve(err("The database is open in another tab with an older version, close it"));
    });
  }

  /**Reads the record with the key*/
  async get<T>(store: string, key: IDBValidKey): Promise<Result<T | undefined, string>> {
    const tx = this.#idb.transaction(store, "readonly");
    return request(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
  }

  /**Reads all records, optionally only those matching the query, from the store or one of its indexes*/
  async all<T>(
    store: string,
    query?: IDBValidKey | IDBKeyRange,
    index?: string,
  ): Promise<Result<T[], string>> {
    const tx = this.#idb.transaction(store, "readonly");
    const source = index ? tx.objectStore(store).index(index) : tx.objectStore(store);
    return request(source.getAll(query) as IDBRequest<T[]>);
  }

  /**Writes the records, replacing records with the same key*/
  put(store: string, ...values: unknown[]): Promise<Result<void, string>> {
    return this.write([store], (tx) => {
      const s = tx.objectStore(store);
      for (const value of values) s.put(value);
    });
  }

  /**Deletes the record with the key, or every record in the range*/
  delete(store: string, key: IDBValidKey | IDBKeyRange): Promise<Result<void, string>> {
    return this.write([store], (tx) => tx.objectStore(store).delete(key));
  }

  /**Runs writes to several stores in one transaction, all of them are applied or none*/
  write(
    stores: string[],
    writes: (tx: IDBTransaction) => void,
  ): Promise<Result<void, string>> {
    try {
      const tx = this.#idb.transaction(stores, "readwrite");
      const done = complete(tx);
      writes(tx);
      return done;
    } catch (e) {
      return Promise.resolve(err(String(e)));
    }
  }
}
