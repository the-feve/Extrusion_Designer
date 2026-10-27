// The parts catalog (app/data/catalog.json). Loaded once by the page or a
// test and passed into the engine, so the engine never fetches anything.

export function makeCatalog(data) {
  const profiles = data.profiles || {};
  const parts = data.parts || {};
  return {
    data,
    profile(id) {
      const p = profiles[id];
      if (!p) throw new Error(`Unknown profile ${id}`);
      return { id, ...p };
    },
    part(id) {
      const p = parts[id];
      if (!p) throw new Error(`Unknown part ${id}`);
      return { id, pn: p.pn === undefined ? id : p.pn, ...p };
    },
    partsOfKind(kind) {
      return Object.keys(parts).filter((k) => parts[k].kind === kind).map((k) => this.part(k));
    },
    // Default corner bracket for a profile: the first one listed for it.
    bracketFor(profileId) {
      const b = this.partsOfKind('corner-bracket').find((p) => (p.forProfiles || []).includes(profileId));
      if (!b) throw new Error(`No corner bracket for profile ${profileId}`);
      return b;
    },
  };
}
