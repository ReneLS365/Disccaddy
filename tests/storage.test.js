import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalDB } from "../src/db/LocalDB.js";
import { BagData } from "../src/data/BagData.js";
import { Lab } from "../src/data/Lab.js";
import { createRound, scoreThrow, roundRecord } from "../src/game/Round.js";

test("Eksisterende IndexedDB-state, billeder, katalog og runderekord bevares", async () => {
  const initial = BagData.empty();
  initial.profile.name = "Eksisterende profil";
  await new Promise((resolve, reject) => {
    const request = indexedDB.open("disc-flight-lab-v4", 3);
    request.onupgradeneeded = () => {
      for (const name of ["state", "images", "catalog"])
        request.result.createObjectStore(name);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction(["state", "images", "catalog"], "readwrite");
      tx.objectStore("state").put(initial, "root");
      tx.objectStore("images").put(new Blob(["image-content"]), "photo-1");
      tx.objectStore("catalog").put(
        { entries: [], date: "2026-09-22" },
        "current",
      );
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
  const opened = await LocalDB.open();
  assert.equal(opened.data.profile.name, initial.profile.name);
  assert.equal(await opened.images.get("photo-1").text(), "image-content");
  const p = { ...initial.settings, discId: "test", discName: "Test" },
    round = createRound(p, Lab.variations(p, 8));
  for (let i = 0; i < 8; i++)
    scoreThrow(round, { p, points: [{ p: [0, 0, -80] }] });
  const record = roundRecord(round);
  await LocalDB.save({ ...opened.data, rounds: [record] }, opened.images);
  const saved = await new Promise((resolve, reject) => {
    const request = indexedDB.open("disc-flight-lab-v4", 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction("state"),
        get = tx.objectStore("state").get("root");
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close();
    };
  });
  assert.deepEqual(BagData.validate(saved).rounds, [record]);
  assert.equal(saved.profile.name, initial.profile.name);
});
