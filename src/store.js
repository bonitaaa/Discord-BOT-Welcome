const fs = require('node:fs');
const path = require('node:path');

function emptyState() {
  return { config: {}, profiles: {}, sessions: {}, verifications: {} };
}

function normalizeState(source = {}) {
  const profiles = Object.fromEntries(Object.entries(source.profiles || {}).map(([id, profile = {}]) => [id, {
    language: profile.language === 'en' ? 'en' : profile.language === 'fr' ? 'fr' : null,
    completed: Array.isArray(profile.completed)
      ? profile.completed.filter((value) => typeof value === 'string')
      : [],
    sponsoredUserId: typeof profile.sponsoredUserId === 'string' ? profile.sponsoredUserId : null,
  }]));
  return {
    config: source.config && typeof source.config === 'object' ? source.config : {},
    profiles,
    sessions: source.sessions && typeof source.sessions === 'object' ? source.sessions : {},
    verifications: source.verifications && typeof source.verifications === 'object'
      ? source.verifications
      : {},
  };
}

function createStateStore(filePath) {
  return {
    load() {
      try {
        return normalizeState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
      } catch (error) {
        if (error.code !== 'ENOENT') console.error('Lecture de la sauvegarde impossible :', error);
        return emptyState();
      }
    },
    save(state) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(normalizeState(state), null, 2));
      fs.renameSync(temporary, filePath);
    },
  };
}

module.exports = { createStateStore, emptyState, normalizeState };
