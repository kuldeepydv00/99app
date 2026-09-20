const fs = require('fs');
const path = require('path');

const STORE_DIR = path.resolve(__dirname, '..');
const STORE_FILE = process.env.DATA_STORE_PATH || (
  fs.existsSync(path.join(STORE_DIR, 'dataStore.json'))
    ? path.join(STORE_DIR, 'dataStore.json')
    : (fs.existsSync(path.join(__dirname, 'dataStore.json')) ? path.join(__dirname, 'dataStore.json') : path.join(STORE_DIR, 'dataStore.json'))
);

// Central in-memory & file store for production persistence
let registeredUsers = [];

let userWalletStore = {
  balance: 0.00,
  name: '',
  mobile: ''
};

let memoryDeposits = [];
let memoryWithdrawals = [];
let memoryBets = [];
let memoryGameLedger = [];
let declaredResultsMap = {};
let declaredResultsDateMap = {};
let memoryResultsHistory = [];
let blockedMobiles = [];
let deletedMobiles = [];

const FORTY_DAYS_MS = 40 * 24 * 60 * 60 * 1000;

function purgeOldBets() {
  const cutoff = Date.now() - FORTY_DAYS_MS;
  for (let i = memoryBets.length - 1; i >= 0; i--) {
    const b = memoryBets[i];
    const bTime = b.created_at || b.createdAt ? new Date(b.created_at || b.createdAt).getTime() : Date.now();
    if (!isNaN(bTime) && bTime < cutoff) {
      memoryBets.splice(i, 1);
    }
  }
}

function purgeOldLedger() {
  const cutoff = Date.now() - FORTY_DAYS_MS;
  memoryGameLedger = memoryGameLedger.filter(item => {
    const itemTime = item.date ? new Date(item.date).getTime() : Date.now();
    return !isNaN(itemTime) && itemTime >= cutoff;
  });
}

function logLedgerTransaction(data) {
  purgeOldLedger();
  const entry = {
    id: 'ldg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    user: data.user || 'NasibAnsari',
    email: data.email || 'na0193354@gmail.com',
    phone: data.phone || '9007724336',
    amount: data.amount !== undefined ? (typeof data.amount === 'number' ? (data.amount >= 0 ? `+${data.amount}` : `${data.amount}`) : data.amount) : '+0.5',
    date: data.date || new Date().toISOString().replace('T', ' ').slice(0, 19),
    transactType: data.transactType || 'Commission',
    oldBal: data.oldBal || {
      wallet: '0.00',
      deposit: '0.00',
      winning: '0.00',
      commission: '7.85',
      bonus: '0.00',
      referral: '99.10'
    },
    newBal: data.newBal || {
      wallet: '0.00',
      deposit: '0.00',
      winning: '0.00',
      commission: '8.60',
      bonus: '0.00',
      referral: '99.10'
    },
    gameType: data.gameType || '-'
  };

  memoryGameLedger.unshift(entry);
  return entry;
}

let bannerConfig = {
  enabled: true,
  title: '99xmatka SATTA',
  subtitle: 'आपका भरोसा, हमारी पहचान',
  referralText: 'केवल 5 प्लेइंग यूजर को रिफर करें और पाएं ₹500 बोनस',
  commissionText: '4% लाइफटाइम कमिशन आपकी टीम के हर दांव पर',
  minDeposit: '100',
  minWithdrawal: '200',
  imageUrl: 'https://newmatkadomain.com/app_header.png'
};

let referralConfig = {
  enabled: true,
  signupBonus: 50,
  commissionPercentage: 4
};

let appVersionConfig = {
  latestVersionCode: 59,
  latestVersionName: '1.0.59',
  minSupportedVersion: 1,
  apkUrl: 'https://newmatkadomain.com/99xmatka.apk',
  updateMessage: '🚀 New Update Available! Golden bottom bar glow & full-width cards. Tap UPDATE NOW!',
  forceUpdate: true
};

let settingsConfig = {
  whatsapp_number: '+917206561420',
  whatsapp_call_number: '+917206561420',
  app_download_link: 'https://newmatkadomain.com/99xmatka.apk',
  app_version: '1.0.15',
  bank_withdrawal_enable: true,
  upi_withdrawal_enable: true,
  lucky_card_maintenance: false,
  jodi_rate: 95,
  crossing_rate: 95,
  haroof_rate: 9.5,
  ekqr_enabled: true,
  ekqr_api_key: '8f12c3ab-b6d9-4e75-b116-a7de230f0d83',
  ekqr_webhook_url: 'https://newmatkadomain.com/api/payment/ekqr/webhook',
  min_deposit: 100,
  max_deposit: 50000,
  msg91_auth_key: '566370AIKfwtcrpvh6aa17ef3P1',
  msg91_template_id: '6aa1635ed61d0b5f8e0551e2',
  msg91_otp_length: 4,
  msg91_otp_expiry: 10,
  msg91_enabled: true
};

let gameSchedulesStore = {
  "Shiv Parwati": {
    name: "Shiv Parwati",
    open: "04:00 AM IST",
    close: "12:00 PM IST",
    result: "12:40 PM IST",
    openHour: 4, openMinute: 0,
    closeHour: 12, closeMinute: 0,
    resultHour: 12, resultMinute: 40,
    enabled: true
  },
  "Delhi Bazar": {
    name: "Delhi Bazar",
    open: "04:00 AM IST",
    close: "02:45 PM IST",
    result: "03:20 PM IST",
    openHour: 4, openMinute: 0,
    closeHour: 14, closeMinute: 45,
    resultHour: 15, resultMinute: 20,
    enabled: true
  },
  "Dubai Market": {
    name: "Dubai Market",
    open: "04:00 AM IST",
    close: "04:00 PM IST",
    result: "04:00 PM IST",
    openHour: 4, openMinute: 0,
    closeHour: 16, closeMinute: 0,
    resultHour: 16, resultMinute: 0,
    enabled: true
  },
  "Shree Ganesh": {
    name: "Shree Ganesh",
    open: "04:00 AM IST",
    close: "04:30 PM IST",
    result: "04:50 PM IST",
    openHour: 4, openMinute: 0,
    closeHour: 16, closeMinute: 30,
    resultHour: 16, resultMinute: 50,
    enabled: true
  },
  "Faridabad": {
    name: "Faridabad",
    open: "04:00 AM IST",
    close: "05:40 PM IST",
    result: "06:20 PM IST",
    openHour: 4, openMinute: 0,
    closeHour: 17, closeMinute: 40,
    resultHour: 18, resultMinute: 20,
    enabled: true
  },
  "Ghaziabad": {
    name: "Ghaziabad",
    open: "04:00 AM IST",
    close: "09:30 PM IST",
    result: "10:10 PM IST",
    openHour: 4, openMinute: 0,
    closeHour: 21, closeMinute: 30,
    resultHour: 22, resultMinute: 10,
    enabled: true
  },
  "Gali": {
    name: "Gali",
    open: "04:00 AM IST",
    close: "11:30 PM IST",
    result: "11:59 PM IST",
    openHour: 4, openMinute: 0,
    closeHour: 23, closeMinute: 30,
    resultHour: 23, resultMinute: 59,
    enabled: true
  },
  "Desawar": {
    name: "Desawar",
    open: "07:00 PM IST",
    close: "04:00 AM IST",
    result: "06:00 AM IST",
    openHour: 19, openMinute: 0,
    closeHour: 4, closeMinute: 0,
    resultHour: 6, resultMinute: 0,
    enabled: true
  }
};

const { chartRecords } = require('./historicalChartStore');

let bannersListStore = [];

let livePlayersMap = {
  "Shiv Parwati": 487556,
  "Delhi Bazar": 614919,
  "Dubai Market": 452810,
  "Shree Ganesh": 392152,
  "Shri Ganesh": 392152,
  "Faridabad": 345825,
  "Ghaziabad": 298700,
  "Gali": 512400,
  "Desawar": 684200,
  "Disawer": 684200
};

function saveDiskStore() {
  try {
    const data = {
      registeredUsers,
      userWalletStore,
      memoryDeposits,
      memoryWithdrawals,
      memoryBets,
      declaredResultsMap,
      declaredResultsDateMap,
      memoryResultsHistory,
      gameSchedulesStore,
      chartRecords,
      bannerConfig,
      referralConfig,
      appVersionConfig,
      settingsConfig,
      bannersListStore,
      blockedMobiles,
      deletedMobiles,
      livePlayersMap
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    const legacyPath = path.join(__dirname, 'dataStore.json');
    if (legacyPath !== STORE_FILE && fs.existsSync(legacyPath)) {
      try { fs.writeFileSync(legacyPath, JSON.stringify(data, null, 2), 'utf-8'); } catch (e) {}
    }
  } catch (err) {
    console.error('[Disk Store] Save Error:', err.message);
  }
}

function loadDiskStore() {
  try {
    let targetFile = STORE_FILE;
    if (!fs.existsSync(targetFile) && fs.existsSync(path.join(__dirname, 'dataStore.json'))) {
      targetFile = path.join(__dirname, 'dataStore.json');
    }
    if (fs.existsSync(targetFile)) {
      const raw = fs.readFileSync(targetFile, 'utf-8');
      const data = JSON.parse(raw);
      if (data.registeredUsers && Array.isArray(data.registeredUsers)) {
        registeredUsers.length = 0;
        data.registeredUsers.forEach(u => {
          if (u.winning_balance !== undefined && u.winning_balance < 0) u.winning_balance = 0.00;
          if (u.deposit_balance !== undefined && u.deposit_balance < 0) u.deposit_balance = 0.00;
          if (u.commission_balance !== undefined && u.commission_balance < 0) u.commission_balance = 0.00;
          if (u.bonus_balance !== undefined && u.bonus_balance < 0) u.bonus_balance = 0.00;
          u.balance = parseFloat(((u.deposit_balance || 0) + (u.winning_balance || 0)).toFixed(2));
          if (u.balance < 0) u.balance = 0.00;
          registeredUsers.push(u);
        });
      }
      if (data.userWalletStore) Object.assign(userWalletStore, data.userWalletStore);
      if (data.memoryDeposits && Array.isArray(data.memoryDeposits)) memoryDeposits.length = 0, memoryDeposits.push(...data.memoryDeposits);
      if (data.memoryWithdrawals && Array.isArray(data.memoryWithdrawals)) memoryWithdrawals.length = 0, memoryWithdrawals.push(...data.memoryWithdrawals);
      if (data.memoryBets && Array.isArray(data.memoryBets)) {
        memoryBets.length = 0;
        const seenBetKeys = new Set();
        data.memoryBets.forEach(b => {
          const cleanMob = String(b.user || b.mobile || '').replace(/[^0-9]/g, '').slice(-10);
          const num = b.number !== undefined ? b.number : '';
          const amt = parseFloat(b.bet_amount || b.amount || 0);
          const game = b.game_name || '';
          const ep = b.created_at ? new Date(b.created_at).getTime() : (b.timestamp || 0);
          const timeBucket = Math.floor(ep / 15000);
          const key = `${cleanMob}_${game}_${num}_${amt}_${timeBucket}`;
          const idKey = String(b._id || b.id || '');
          if ((idKey && seenBetKeys.has(idKey)) || seenBetKeys.has(key)) return;
          if (idKey) seenBetKeys.add(idKey);
          seenBetKeys.add(key);
          memoryBets.push(b);
        });
      }
      if (data.declaredResultsMap) Object.assign(declaredResultsMap, data.declaredResultsMap);
      if (data.declaredResultsDateMap) Object.assign(declaredResultsDateMap, data.declaredResultsDateMap);
      if (data.memoryResultsHistory && Array.isArray(data.memoryResultsHistory)) memoryResultsHistory.length = 0, memoryResultsHistory.push(...data.memoryResultsHistory);
      
      // Backfill any missing date keys in declaredResultsDateMap from memoryResultsHistory
      Object.keys(declaredResultsMap).forEach(g => {
        if (!declaredResultsDateMap[g] && Array.isArray(memoryResultsHistory)) {
          const hist = memoryResultsHistory.find(h => (h.category === g || h.game_name === g) && h.date);
          if (hist && hist.date) {
            declaredResultsDateMap[g] = hist.date;
          }
        }
      });

      // Hydrate declaredResultsMap for games from memoryResultsHistory so results remain visible while market is closed
      // ONLY hydrate results from TODAY or YESTERDAY to prevent very old results showing
      const istNowBoot = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
      const todayKeyBoot = `${istNowBoot.getUTCFullYear()}-${String(istNowBoot.getUTCMonth() + 1).padStart(2, '0')}-${String(istNowBoot.getUTCDate()).padStart(2, '0')}`;
      const yesterdayBoot = new Date(istNowBoot.getTime() - (24 * 60 * 60 * 1000));
      const yesterdayKeyBoot = `${yesterdayBoot.getUTCFullYear()}-${String(yesterdayBoot.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayBoot.getUTCDate()).padStart(2, '0')}`;
      const allMarkets = ['Shiv Parwati', 'Delhi Bazar', 'Dubai Market', 'Shree Ganesh', 'Faridabad', 'Ghaziabad', 'Gali', 'Desawar'];
      allMarkets.forEach(g => {
        if ((declaredResultsMap[g] === undefined || declaredResultsMap[g] === null) && Array.isArray(memoryResultsHistory)) {
          const hist = memoryResultsHistory.find(h => {
            const match = (h.category === g || h.game_name === g ||
              (g === 'Desawar' && (h.category === 'Disawer' || h.game_name === 'Disawer')) ||
              (g === 'Shree Ganesh' && (h.category === 'Shri Ganesh' || h.game_name === 'Shri Ganesh')));
            return match && h.number !== undefined && h.number !== '--' && (h.date === todayKeyBoot || h.date === yesterdayKeyBoot);
          });
          if (hist && hist.number !== undefined && hist.number !== '--') {
            const num = parseInt(hist.number);
            if (!isNaN(num)) {
              declaredResultsMap[g] = num;
              declaredResultsDateMap[g] = hist.date;
              if (g === 'Desawar') {
                declaredResultsMap['Disawer'] = num;
                declaredResultsDateMap['Disawer'] = hist.date;
              }
              if (g === 'Shree Ganesh') {
                declaredResultsMap['Shri Ganesh'] = num;
                declaredResultsDateMap['Shri Ganesh'] = hist.date;
              }
            }
          }
        }
      });
      if (data.gameSchedulesStore) {
        Object.assign(gameSchedulesStore, data.gameSchedulesStore);
        for (const k in gameSchedulesStore) {
          if (gameSchedulesStore[k].enabled === undefined) {
            gameSchedulesStore[k].enabled = true;
          }
        }
      }
      if (data.chartRecords) Object.assign(chartRecords, data.chartRecords);
      if (data.bannerConfig) Object.assign(bannerConfig, data.bannerConfig);
      if (data.referralConfig) Object.assign(referralConfig, data.referralConfig);
      if (data.appVersionConfig) Object.assign(appVersionConfig, data.appVersionConfig);
      appVersionConfig.latestVersionCode = 59;
      appVersionConfig.latestVersionName = '1.0.59';
      appVersionConfig.updateMessage = '🚀 New Update Available! Golden bottom bar glow & full-width cards. Tap UPDATE NOW!';
      appVersionConfig.forceUpdate = true;
      appVersionConfig.apkUrl = 'https://newmatkadomain.com/99xmatka.apk';
      if (data.settingsConfig) Object.assign(settingsConfig, data.settingsConfig);
      if (data.bannersListStore && Array.isArray(data.bannersListStore)) bannersListStore.length = 0, bannersListStore.push(...data.bannersListStore);
      if (data.blockedMobiles && Array.isArray(data.blockedMobiles)) blockedMobiles.length = 0, blockedMobiles.push(...data.blockedMobiles);
      if (data.deletedMobiles && Array.isArray(data.deletedMobiles)) deletedMobiles.length = 0, deletedMobiles.push(...data.deletedMobiles);
      if (data.livePlayersMap && typeof data.livePlayersMap === 'object') Object.assign(livePlayersMap, data.livePlayersMap);
      console.log(`[Disk Store] Successfully loaded disk data from ${targetFile}! Registered users: ${registeredUsers.length}`);
    }
  } catch (err) {
    console.error('[Disk Store] Load Error:', err.message);
  }
}

// Initial load on server startup
loadDiskStore();

let memoryNotifications = [];

module.exports = {
  registeredUsers,
  userWalletStore,
  memoryDeposits,
  memoryWithdrawals,
  memoryBets,
  memoryGameLedger,
  memoryNotifications,
  declaredResultsMap,
  declaredResultsDateMap,
  memoryResultsHistory,
  gameSchedulesStore,
  bannerConfig,
  referralConfig,
  appVersionConfig,
  settingsConfig,
  bannersListStore,
  saveDiskStore,
  logLedgerTransaction,
  purgeOldLedger,
  purgeOldBets,
  blockedMobiles,
  deletedMobiles,
  livePlayersMap
};
