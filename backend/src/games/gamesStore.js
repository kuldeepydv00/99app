// Persistent store for the new games (99x Matka, Number / Card / Colour Trading).
// Kept in its own file (gamesStore.json) so the existing dataStore.json is never touched.
const fs = require('fs');
const path = require('path');

const GAMES_STORE_FILE = process.env.GAMES_STORE_PATH || path.resolve(__dirname, '..', '..', 'gamesStore.json');

const MATKA99_MARKETS = [
  { key: 'Shiv Parwati', name: 'Shiv Parwatii' },
  { key: 'Delhi Bazar', name: 'Delhi Bazarr' },
  { key: 'Dubai Market', name: 'Dubai Markett' },
  { key: 'Shree Ganesh', name: 'Shree Ganeshh' },
  { key: 'Faridabad', name: 'Faridabadd' },
  { key: 'Ghaziabad', name: 'Ghaziabadd' },
  { key: 'Gali', name: 'Galii' },
  { key: 'Desawar', name: 'Desawarr' }
];

function defaultState() {
  const enabled = {};
  MATKA99_MARKETS.forEach(m => { enabled[m.key] = true; });
  return {
    config: {
      number: { enabled: true, payout: 99, minBet: 10, maxBet: 10000 },
      card: { enabled: true, payout: 50, minBet: 10, maxBet: 10000 },
      colour: { enabled: true, payout: 2, minBet: 10, maxBet: 5000 }
    },
    rounds: { number: {}, card: {}, colour: {} },
    bets: [],
    matka99: {
      config: { payout: 99, minBet: 10, maxBet: 10000 },
      enabled,
      results: {},   // dateKey -> { marketKey: 'NN' }  (also the 99x chart)
      declared: {}   // marketKey -> { number: 'NN', date, declaredAt }
    }
  };
}

const state = defaultState();

function load() {
  try {
    if (!fs.existsSync(GAMES_STORE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(GAMES_STORE_FILE, 'utf-8'));
    if (raw.config) {
      for (const g of Object.keys(state.config)) {
        if (raw.config[g]) Object.assign(state.config[g], raw.config[g]);
      }
    }
    if (raw.rounds) {
      for (const g of Object.keys(state.rounds)) {
        if (raw.rounds[g] && typeof raw.rounds[g] === 'object') state.rounds[g] = raw.rounds[g];
      }
    }
    if (Array.isArray(raw.bets)) state.bets = raw.bets;
    if (raw.matka99) {
      if (raw.matka99.config) Object.assign(state.matka99.config, raw.matka99.config);
      if (raw.matka99.enabled) Object.assign(state.matka99.enabled, raw.matka99.enabled);
      if (raw.matka99.results) state.matka99.results = raw.matka99.results;
      if (raw.matka99.declared) state.matka99.declared = raw.matka99.declared;
    }
    // 99x payout is fixed by design
    state.matka99.config.payout = 99;
    console.log(`[Games Store] Loaded ${state.bets.length} new-game bets from ${GAMES_STORE_FILE}`);
  } catch (err) {
    console.error('[Games Store] Load error:', err.message);
  }
}

// Money-affecting writes (bets, settlements, config) call saveNow() immediately.
// Housekeeping (new empty rounds, status flips) calls markDirty() and is flushed every 3s.
let dirty = false;
function saveNow() {
  try {
    const tmp = GAMES_STORE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf-8');
    fs.renameSync(tmp, GAMES_STORE_FILE);
    dirty = false;
  } catch (err) {
    console.error('[Games Store] Save error:', err.message);
  }
}
function markDirty() { dirty = true; }

const flushTimer = setInterval(() => { if (dirty) saveNow(); }, 3000);
if (flushTimer.unref) flushTimer.unref();
process.on('exit', () => { if (dirty) saveNow(); });

load();

module.exports = { state, saveNow, markDirty, MATKA99_MARKETS, GAMES_STORE_FILE };
