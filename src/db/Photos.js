export const Photos = (() => {
  const mime = /^image\/(jpeg|png|webp)$/;
  const dataURL = (blob) =>
    new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => no(r.error);
      r.readAsDataURL(blob);
    });
  async function resize(file) {
    if (!/^image\//.test(file.type) || file.size > 30 * 1024 * 1024)
      throw new Error("Vælg et billede på højst 30 MB.");
    const url = URL.createObjectURL(file),
      img = new Image();
    try {
      img.src = url;
      await img.decode();
      const scale = Math.min(
          1,
          1024 / Math.max(img.naturalWidth, img.naturalHeight),
        ),
        c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const b = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.82));
      if (!b) throw new Error();
      return b;
    } catch {
      throw new Error("Billedet kunne ikke læses. Prøv JPG, PNG eller WebP.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function refs(data) {
    return [
      ...new Set(
        [...data.bag, ...(data.comparisons || []).map((c) => c.disc)]
          .map((d) => d?.imageId)
          .filter(Boolean),
      ),
    ];
  }
  async function pack(data, images) {
    const out = { ...data, exportedAt: new Date().toISOString(), images: [] };
    for (const id of refs(data)) {
      const blob = images.get(id);
      if (!blob) throw new Error("Et lokalt billede mangler: " + id);
      out.images.push({ id, dataUrl: await dataURL(blob) });
    }
    return out;
  }
  async function unpack(raw, data) {
    const images = new Map();
    if (raw.images !== undefined && !Array.isArray(raw.images))
      throw new Error("Ugyldig billedliste.");
    if ((raw.images || []).length > 203)
      throw new Error("For mange billeder i backup.");
    for (const x of raw.images || []) {
      if (
        typeof x.id !== "string" ||
        x.id.length > 100 ||
        images.has(x.id) ||
        typeof x.dataUrl !== "string" ||
        x.dataUrl.length > 4 * 1024 * 1024
      )
        throw new Error("Ugyldigt billede i backup.");
      const m = x.dataUrl.match(
        /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/,
      );
      if (!m || !mime.test(m[1]))
        throw new Error("Ugyldigt billedformat i backup.");
      let b;
      try {
        const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
        b = new Blob([bytes], { type: m[1] });
      } catch {
        throw new Error("Billeddata er beskadiget.");
      }
      const u = URL.createObjectURL(b),
        i = new Image();
      try {
        i.src = u;
        await i.decode();
        if (i.naturalWidth > 4096 || i.naturalHeight > 4096) throw new Error();
      } catch {
        throw new Error("Billeddata kunne ikke læses.");
      } finally {
        URL.revokeObjectURL(u);
      }
      images.set(x.id, b);
    }
    for (const id of refs(data))
      if (!images.has(id)) throw new Error("Backup mangler et billede.");
    return images;
  }
  return { resize, dataURL, refs, pack, unpack };
})();
