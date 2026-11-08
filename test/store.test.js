const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createStateStore } = require('../src/store');

test('conserve uniquement les données du parcours de bienvenue et de vérification', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'welcomebot-'));
  const file = path.join(folder, 'state.json');
  fs.writeFileSync(file, JSON.stringify({
    config: { welcomeChannelId: '100' },
    profiles: {
      42: { language: 'fr', completed: ['waitlists'], sponsoredUserId: '84', unrelated: true },
    },
    sessions: { 42: { threadId: '200' } },
    verifications: { 42: { status: 'accepted' } },
    legacyFeatureA: { 42: 99 },
    legacyFeatureB: { created: 5 },
  }));

  const store = createStateStore(file);
  const state = store.load();
  store.save(state);
  const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));

  assert.deepEqual(Object.keys(persisted).sort(), ['config', 'profiles', 'sessions', 'verifications']);
  assert.deepEqual(persisted.profiles['42'], {
    language: 'fr', completed: ['waitlists'], sponsoredUserId: '84',
  });
  assert.equal(persisted.verifications['42'].status, 'accepted');
});
