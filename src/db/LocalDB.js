export const LocalDB = (() => {
  let db,
    chain = Promise.resolve();
  const storedImages = new Set();
  const request = (r) =>
    new Promise((ok, no) => {
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  async function open() {
    const r = indexedDB.open("disc-flight-lab-v4", 3);
    r.onupgradeneeded = () => {
      for (const n of ["state", "images", "catalog"])
        if (!r.result.objectStoreNames.contains(n))
          r.result.createObjectStore(n);
    };
    db = await new Promise((ok, no) => {
      const timer = setTimeout(
        () =>
          no(
            new Error(
              "Lokal database svarede ikke. Luk andre faner og prøv igen.",
            ),
          ),
        8000,
      );
      r.onsuccess = () => {
        clearTimeout(timer);
        ok(r.result);
      };
      r.onerror = () => {
        clearTimeout(timer);
        no(r.error);
      };
      r.onblocked = () => {
        clearTimeout(timer);
        no(new Error("Luk andre faner med appen og prøv igen."));
      };
    });
    db.onversionchange = () => db.close();
    const tx = db.transaction(["state", "images", "catalog"]);
    const [data, keys, blobs, catalog] = await Promise.all([
      request(tx.objectStore("state").get("root")),
      request(tx.objectStore("images").getAllKeys()),
      request(tx.objectStore("images").getAll()),
      request(tx.objectStore("catalog").get("current")),
    ]);
    keys.forEach((k) => storedImages.add(k));
    return {
      data,
      images: new Map(keys.map((k, i) => [k, blobs[i]])),
      catalog,
    };
  }
  function save(data, images) {
    const snapshot = structuredClone(data),
      pending = [...images].filter(([id]) => !storedImages.has(id));
    const work = () =>
      new Promise((ok, no) => {
        if (!db) {
          no(new Error("Lokal lagring er ikke tilgængelig."));
          return;
        }
        const tx = db.transaction(["state", "images"], "readwrite");
        tx.objectStore("state").put(snapshot, "root");
        for (const [id, blob] of pending)
          tx.objectStore("images").put(blob, id);
        tx.oncomplete = () => {
          pending.forEach(([id]) => storedImages.add(id));
          ok();
        };
        tx.onerror = tx.onabort = () =>
          no(tx.error || new Error("Kunne ikke gemme lokalt."));
      });
    const next = chain.then(work);
    chain = next.catch((error) => {
      console.error("Lokal gemmekø fejlede.", error);
    });
    return next;
  }
  function cache(value) {
    return new Promise((ok, no) => {
      if (!db) {
        no(new Error("Ingen lokal cache"));
        return;
      }
      const tx = db.transaction("catalog", "readwrite");
      tx.objectStore("catalog").put(value, "current");
      tx.oncomplete = ok;
      tx.onerror = tx.onabort = () =>
        no(tx.error || new Error("Kataloget kunne ikke gemmes."));
    });
  }
  return { open, save, cache };
})();
