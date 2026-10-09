const DEFAULT_PROFILE_NAME = "default";

function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeProfileKeys(keys, defaultKeys) {
  const defaults = isObjectRecord(defaultKeys) ? defaultKeys : {};
  const source = isObjectRecord(keys) ? keys : {};
  const profile = {};
  Object.keys(defaults).forEach(key => {
    const value = source[key];
    profile[key] = typeof value === "string" ? value : (typeof defaults[key] === "string" ? defaults[key] : "");
  });
  return profile;
}

function profileFromRaw(raw, defaultKeys, migrate) {
  const merged = {
    ...(isObjectRecord(defaultKeys) ? defaultKeys : {}),
    ...(isObjectRecord(raw) ? raw : {})
  };
  const migrated = migrate(merged);
  return normalizeProfileKeys(migrated, defaultKeys);
}

function emptyStore(defaultKeys, migrate) {
  return {
    activeProfile: DEFAULT_PROFILE_NAME,
    profiles: {
      [DEFAULT_PROFILE_NAME]: profileFromRaw({}, defaultKeys, migrate)
    }
  };
}

function isStoreShape(value) {
  return isObjectRecord(value) && isObjectRecord(value.profiles);
}

function normalizeApiKeyStore(raw, defaultKeys, migrateGoogleApiKeys) {
  const migrate = typeof migrateGoogleApiKeys === "function"
    ? migrateGoogleApiKeys
    : (keys) => keys;

  if (!isObjectRecord(raw)) {
    return emptyStore(defaultKeys, migrate);
  }

  const profiles = {};
  if (isStoreShape(raw)) {
    Object.keys(raw.profiles).forEach(rawName => {
      const name = String(rawName || "").trim();
      if (!name || Object.prototype.hasOwnProperty.call(profiles, name)) {
        return;
      }
      profiles[name] = profileFromRaw(raw.profiles[rawName], defaultKeys, migrate);
    });
  } else {
    profiles[DEFAULT_PROFILE_NAME] = profileFromRaw(raw, defaultKeys, migrate);
  }

  if (!Object.prototype.hasOwnProperty.call(profiles, DEFAULT_PROFILE_NAME)) {
    profiles[DEFAULT_PROFILE_NAME] = profileFromRaw({}, defaultKeys, migrate);
  }

  const ordered = {
    [DEFAULT_PROFILE_NAME]: profiles[DEFAULT_PROFILE_NAME]
  };
  Object.keys(profiles).sort((left, right) => left.localeCompare(right)).forEach(name => {
    if (name === DEFAULT_PROFILE_NAME) {
      return;
    }
    ordered[name] = profiles[name];
  });

  let activeProfile = DEFAULT_PROFILE_NAME;
  if (typeof raw.activeProfile === "string") {
    const trimmed = raw.activeProfile.trim();
    if (trimmed && Object.prototype.hasOwnProperty.call(ordered, trimmed)) {
      activeProfile = trimmed;
    }
  }

  return {
    activeProfile,
    profiles: ordered
  };
}

function profileNames(store) {
  const profiles = isObjectRecord(store?.profiles) ? store.profiles : {};
  const names = Object.keys(profiles)
    .filter(name => name !== DEFAULT_PROFILE_NAME)
    .sort((left, right) => left.localeCompare(right));
  if (Object.prototype.hasOwnProperty.call(profiles, DEFAULT_PROFILE_NAME)) {
    return [DEFAULT_PROFILE_NAME, ...names];
  }
  return names;
}

function cloneStore(store) {
  const profiles = {};
  const source = isObjectRecord(store?.profiles) ? store.profiles : {};
  Object.keys(source).forEach(name => {
    profiles[name] = { ...(isObjectRecord(source[name]) ? source[name] : {}) };
  });
  const requested = typeof store?.activeProfile === "string" ? store.activeProfile : "";
  const activeProfile = Object.prototype.hasOwnProperty.call(profiles, requested)
    ? requested
    : (Object.prototype.hasOwnProperty.call(profiles, DEFAULT_PROFILE_NAME)
      ? DEFAULT_PROFILE_NAME
      : (Object.keys(profiles)[0] || DEFAULT_PROFILE_NAME));
  return {
    activeProfile,
    profiles
  };
}

function nextProfileName(profiles) {
  let index = 2;
  while (Object.prototype.hasOwnProperty.call(profiles, "profile " + index)) {
    index += 1;
  }
  return "profile " + index;
}

function createProfile(store, sourceName) {
  const next = cloneStore(store);
  if (!Object.prototype.hasOwnProperty.call(next.profiles, DEFAULT_PROFILE_NAME)) {
    next.profiles[DEFAULT_PROFILE_NAME] = {};
  }
  const requested = typeof sourceName === "string" ? sourceName.trim() : "";
  const source = next.profiles[requested]
    || next.profiles[next.activeProfile]
    || next.profiles[DEFAULT_PROFILE_NAME];
  const name = nextProfileName(next.profiles);
  next.profiles[name] = { ...source };
  next.activeProfile = name;
  return {
    ok: true,
    store: next,
    name
  };
}

function renameProfile(store, fromName, toName) {
  const profiles = isObjectRecord(store?.profiles) ? store.profiles : {};
  const from = typeof fromName === "string" ? fromName.trim() : "";
  const to = typeof toName === "string" ? toName.trim() : "";
  if (!from || !Object.prototype.hasOwnProperty.call(profiles, from)) {
    return { ok: false, store: cloneStore(store), reason: "missing" };
  }
  if (!to) {
    return { ok: false, store: cloneStore(store), reason: "empty" };
  }
  if (from === DEFAULT_PROFILE_NAME && to !== from) {
    return { ok: false, store: cloneStore(store), reason: "protected" };
  }
  if (to === from) {
    return { ok: true, store: cloneStore(store), name: from };
  }
  if (Object.prototype.hasOwnProperty.call(profiles, to)) {
    return { ok: false, store: cloneStore(store), reason: "duplicate", name: to };
  }

  const next = cloneStore(store);
  const ordered = {};
  Object.keys(next.profiles).forEach(name => {
    ordered[name === from ? to : name] = next.profiles[name];
  });
  next.profiles = ordered;
  if (next.activeProfile === from) {
    next.activeProfile = to;
  }
  return { ok: true, store: next, name: to };
}

function deleteProfile(store, name) {
  const profiles = isObjectRecord(store?.profiles) ? store.profiles : {};
  const target = typeof name === "string" ? name.trim() : "";
  if (!target || !Object.prototype.hasOwnProperty.call(profiles, target)) {
    return { ok: false, store: cloneStore(store), reason: "missing" };
  }
  if (target === DEFAULT_PROFILE_NAME) {
    return { ok: false, store: cloneStore(store), reason: "protected" };
  }

  const next = cloneStore(store);
  delete next.profiles[target];
  if (!Object.prototype.hasOwnProperty.call(next.profiles, DEFAULT_PROFILE_NAME)) {
    next.profiles[DEFAULT_PROFILE_NAME] = {};
  }
  next.activeProfile = DEFAULT_PROFILE_NAME;
  return { ok: true, store: next, name: DEFAULT_PROFILE_NAME };
}

function profileActionMessage(action, result) {
  if (!result || result.ok) {
    return "";
  }
  if (result.reason === "empty") {
    return "Enter a profile name.";
  }
  if (result.reason === "duplicate") {
    return "Profile name already exists: " + result.name + ".";
  }
  if (result.reason === "protected" && action === "rename") {
    return "The default profile cannot be renamed.";
  }
  if (result.reason === "protected" && action === "delete") {
    return "The default profile cannot be deleted.";
  }
  return "";
}

module.exports = {
  DEFAULT_PROFILE_NAME,
  normalizeApiKeyStore,
  profileNames,
  createProfile,
  renameProfile,
  deleteProfile,
  profileActionMessage
};
