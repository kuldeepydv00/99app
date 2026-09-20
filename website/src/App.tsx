import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, UserPlus, Play, Star, ShieldCheck, 
  Smartphone, Wallet, ArrowLeft, RefreshCw, 
  CheckCircle, MessageCircle, Clock, Trophy, ChevronRight, X, Bell 
} from 'lucide-react';
import { parseCopyPasteText, ParsedBetItem } from './utils/copyPasteParser';

const API_BASE_URLS = [
  typeof window !== 'undefined' ? (window.location.origin.includes('localhost') ? 'http://localhost:5002' : window.location.origin) : 'https://newmatkadomain.com',
  'https://newmatkadomain.com',
  'http://localhost:5002'
];

const fetchApi = async (endpoint: string, options: any = {}) => {
  for (const base of API_BASE_URLS) {
    try {
      const res = await fetch(`${base}${endpoint}`, options);
      if (res.ok) return res;
    } catch (e) {}
  }
  return fetch(`${API_BASE_URLS[0]}${endpoint}`, options);
};

interface GameSchedule {
  name: string;
  open: string;
  close: string;
  result: string;
}

const DEFAULT_SCHEDULES: Record<string, GameSchedule> = {
  "Shiv Parwati": { name: "Shiv Parwati", open: "04:00 AM IST", close: "12:00 PM IST", result: "12:40 PM IST" },
  "Delhi Bazar": { name: "Delhi Bazar", open: "04:00 AM IST", close: "02:45 PM IST", result: "03:20 PM IST" },
  "Dubai Market": { name: "Dubai Market", open: "04:00 AM IST", close: "04:00 PM IST", result: "04:00 PM IST" },
  "Shree Ganesh": { name: "Shree Ganesh", open: "04:00 AM IST", close: "04:30 PM IST", result: "04:50 PM IST" },
  "Faridabad": { name: "Faridabad", open: "04:00 AM IST", close: "05:40 PM IST", result: "06:20 PM IST" },
  "Ghaziabad": { name: "Ghaziabad", open: "04:00 AM IST", close: "09:30 PM IST", result: "10:10 PM IST" },
  "Gali": { name: "Gali", open: "04:00 AM IST", close: "11:30 PM IST", result: "11:59 PM IST" },
  "Desawar": { name: "Desawar", open: "12:00 PM IST", close: "04:00 AM IST", result: "06:00 AM IST" }
};

const getGameIcon = (gameName: string): string => {
  if (!gameName) return '⭐';
  const name = gameName.trim();
  if (name.includes('Shiv') || name.includes('Parwati')) return '🔱';
  if (name.includes('Delhi')) return '🐎';
  if (name.includes('Dubai')) return '🏙️';
  if (name.includes('Shree') || name.includes('Shri') || name.includes('Ganesh')) return '🐘';
  if (name.includes('Faridabad')) return '♠️';
  if (name.includes('Ghaziabad')) return '📊';
  if (name.includes('Gali')) return '⚡';
  if (name.includes('Desawar') || name.includes('Disawer')) return '👑';
  return '⭐';
};

const formatBannerImageSrc = (rawSrc: string): string => {
  if (!rawSrc) return '/app_logo.png';
  const str = rawSrc.trim();
  if (str.startsWith('data:image')) return str;
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  if (str.startsWith('/9j/') || str.startsWith('iVBORw0KGgo') || str.startsWith('R0lGOD')) {
    return `data:image/jpeg;base64,${str}`;
  }
  if (str.length > 50 && !str.includes(' ')) {
    return `data:image/jpeg;base64,${str}`;
  }
  if (str.startsWith('/app_logo') || str.startsWith('/banner') || str.endsWith('.png') || str.endsWith('.jpg') || str.endsWith('.jpeg')) return str;
  return str;
};

const getValidBannerImg = (slide: any, globalConfig: any, backupConfig?: any): string => {
  if (slide) {
    const candidates = [slide.previewUrl, slide.link, slide.imageUrl, slide.image];
    for (const c of candidates) {
      if (c && typeof c === 'string') {
        const trimmed = c.trim();
        if (
          trimmed.startsWith('data:image') || 
          trimmed.startsWith('http://') || 
          trimmed.startsWith('https://') || 
          trimmed.startsWith('/9j/') || 
          trimmed.startsWith('iVBORw0KGgo') || 
          (trimmed.length > 50 && !trimmed.includes(' '))
        ) {
          return trimmed;
        }
        if (trimmed.startsWith('/') && !trimmed.includes('banner1') && !trimmed.includes('banner2') && trimmed !== '/app_logo.png') {
          return trimmed;
        }
      }
    }
  }
  const config = globalConfig || backupConfig;
  if (config) {
    const gImg = typeof config === 'string' ? config : (config.imageUrl || config.image || config.link || config.previewUrl);
    if (gImg && typeof gImg === 'string') {
      const gTrim = gImg.trim();
      if (gTrim.length > 0 && !gTrim.includes('banner1') && !gTrim.includes('banner2') && gTrim !== '/app_logo.png') {
        return gTrim;
      }
    }
  }
  return '/app_logo.png';
};

export default function App() {
  // Navigation View: 'landing' | 'auth' | 'webapp'
  const [view, setView] = useState<'landing' | 'auth' | 'webapp'>(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('99x_web_view');
      const savedUser = localStorage.getItem('99x_web_user');
      if (savedView === 'landing' || savedView === 'auth' || savedView === 'webapp') {
        return savedView;
      }
      return savedUser ? 'webapp' : 'landing';
    }
    return 'landing';
  });

  // Auth Flow States: 'phone' | 'otp' | 'register'
  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'register'>('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('123456');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [existingUserData, setExistingUserData] = useState<{ name: string; mobile: string; balance: number; referral_code?: string; referralsCount?: number } | null>(null);
  const [authError, setAuthError] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');

  const getISTDateStr = (dateInput?: any) => {
    try {
      const d = dateInput ? new Date(dateInput) : new Date();
      if (isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  };

  // Player User Session
  const [user, setUser] = useState<{
    name: string;
    mobile: string;
    balance: number;
    deposit_balance?: number;
    winning_balance?: number;
    bonus_balance?: number;
    commission_balance?: number;
    withdrawable_balance?: number;
    referral_code?: string;
    referralsCount?: number;
    is_khaiwal?: boolean;
    deposits?: any[];
    withdrawals?: any[];
  } | null>(null);

  // App Data States
  const [declaredResults, setDeclaredResults] = useState<Record<string, number>>({});
  const [gameSchedules, setGameSchedules] = useState<Record<string, GameSchedule>>(DEFAULT_SCHEDULES);
  const [livePlayersMap, setLivePlayersMap] = useState<Record<string, number>>({
    "Shiv Parwati": 487556,
    "Delhi Bazar": 614919,
    "Dubai Market": 452810,
    "Shree Ganesh": 392152,
    "Faridabad": 345825,
    "Ghaziabad": 298700,
    "Gali": 512400,
    "Desawar": 684200
  });
  const [bannerConfig, setBannerConfig] = useState<any>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('917206561420');
  const [whatsappCallNumber, setWhatsappCallNumber] = useState('917206561420');
  const [gameRates, setGameRates] = useState<{ jodi: number; crossing: number; haroof: number }>({ jodi: 95, crossing: 95, haroof: 9.5 });

  // WebApp Modal & Bidding States
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [selectedGameForBetting, setSelectedGameForBetting] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('99x_selected_game') || null;
    }
    return null;
  });
  const [betCategory, setBetCategory] = useState<'Jodi' | 'Paste' | 'Crossing' | 'Haruf'>('Jodi');
  const [copyPasteInputText, setCopyPasteInputText] = useState('');
  const [copyPasteWithPalat, setCopyPasteWithPalat] = useState(false);
  const [copyPasteParsedList, setCopyPasteParsedList] = useState<ParsedBetItem[]>([]);
  const [showFormatsModal, setShowFormatsModal] = useState(false);
  const [harufSubTab, setHarufSubTab] = useState<'Ander' | 'Bahar'>('Ander');
  const [harufQuickASelected, setHarufQuickASelected] = useState(true);
  const [harufQuickBSelected, setHarufQuickBSelected] = useState(false);
  const [harufQuickDigits, setHarufQuickDigits] = useState('');
  const [harufQuickAmount, setHarufQuickAmount] = useState('');
  const [jodiGrid, setJodiGrid] = useState<Record<string, string>>({});
  const [crossingDigits, setCrossingDigits] = useState('');
  const [crossingAmount, setCrossingAmount] = useState('10');
  const [crossingWithJoda, setCrossingWithJoda] = useState(true);
  const [webBanners, setWebBanners] = useState<any[]>([]);
  const [webBannerIndex, setWebBannerIndex] = useState(0);
  const [globalBannerConfig, setGlobalBannerConfig] = useState<any>(null);
  const [betMessage, setBetMessage] = useState('');
  const [chartFilter, setChartFilter] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [selectedChartDate, setSelectedChartDate] = useState(getISTDateStr());
  const [dateChartResults, setDateChartResults] = useState<Record<string, string>>({});
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showKhaiwalModal, setShowKhaiwalModal] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [showAllTxnsModal, setShowAllTxnsModal] = useState(false);
  const [txnFilterTab, setTxnFilterTab] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'WINNING'>('ALL');

  // Khaiwal Player Management State
  const [khaiwalPlayers, setKhaiwalPlayers] = useState<any[]>([]);
  const [isKhaiwalLoading, setIsKhaiwalLoading] = useState(false);
  const [selectedKhaiwalPlayer, setSelectedKhaiwalPlayer] = useState<any | null>(null);
  const [selectedKhaiwalLedger, setSelectedKhaiwalLedger] = useState<any[]>([]);
  const [khaiwalTotalBets, setKhaiwalTotalBets] = useState(0);
  const [khaiwalTotalCommission, setKhaiwalTotalCommission] = useState(0);
  const [khaiwalLedgerTab, setKhaiwalLedgerTab] = useState<'ALL' | 'JODI' | 'CROSSING' | 'HARUF' | 'HISTORY'>('ALL');
  const [khaiwalDateFilter, setKhaiwalDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [khaiwalCustomDate, setKhaiwalCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [khaiwalMarketFilter, setKhaiwalMarketFilter] = useState<string>('ALL');

  // Add Player Modal State
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addJodiRate, setAddJodiRate] = useState('95');
  const [addCrossingRate, setAddCrossingRate] = useState('95');
  const [addHarufRate, setAddHarufRate] = useState('9.5');
  const [addCommissionPct, setAddCommissionPct] = useState('5');
  const [addPlayerError, setAddPlayerError] = useState('');

  // Edit Player Modal State
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [editingKhaiwalPlayer, setEditingKhaiwalPlayer] = useState<any | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editJodiRate, setEditJodiRate] = useState('95');
  const [editCrossingRate, setEditCrossingRate] = useState('95');
  const [editHarufRate, setEditHarufRate] = useState('9.5');
  const [editCommissionPct, setEditCommissionPct] = useState('5');

  // Delete Player Modal State
  const [showDeletePlayerModal, setShowDeletePlayerModal] = useState(false);
  const [deletingKhaiwalPlayer, setDeletingKhaiwalPlayer] = useState<any | null>(null);

  // Active Khaiwal Bet Placement State
  const [activeKhaiwalBetPlayer, setActiveKhaiwalBetPlayer] = useState<any | null>(null);
  const [showKhaiwalMarketSelectModal, setShowKhaiwalMarketSelectModal] = useState(false);

  const fetchKhaiwalPlayers = async () => {
    if (!user?.mobile) return;
    setIsKhaiwalLoading(true);
    try {
      const cleanMobile = user.mobile.replace(/[^0-9]/g, '').slice(-10);
      const res = await fetchApi(`/api/user/khaiwal/players?mobile=${cleanMobile}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.players)) {
        setKhaiwalPlayers(data.players);
      }
    } catch (err) {
      console.error('Error fetching khaiwal players:', err);
    } finally {
      setIsKhaiwalLoading(false);
    }
  };

  const fetchKhaiwalPlayerLedger = async (player: any) => {
    if (!user?.mobile || !player?.id) return;
    try {
      const cleanMobile = user.mobile.replace(/[^0-9]/g, '').slice(-10);
      const res = await fetchApi(`/api/user/khaiwal/players/${player.id}/ledger?mobile=${cleanMobile}`);
      const data = await res.json();
      if (data.success) {
        setKhaiwalTotalBets(data.totalBetAmount || 0);
        setKhaiwalTotalCommission(data.totalCommission || 0);
        setSelectedKhaiwalLedger(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching khaiwal ledger:', err);
    }
  };

  const fetchWalletTransactions = async () => {
    if (!user?.mobile) return;
    try {
      const cleanMobile = user.mobile.replace(/[^0-9]/g, '').slice(-10);
      const res = await fetchApi(`/api/user/wallet/transactions?mobile=${cleanMobile}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setWalletTransactions(data);
      }
    } catch (err) {
      console.error('Error fetching wallet transactions:', err);
    }
  };

  useEffect(() => {
    if (showWalletModal && user?.mobile) {
      fetchWalletTransactions();
    }
  }, [showWalletModal, user?.mobile]);

  const handleSaveKhaiwalPlayer = async () => {
    if (!addPlayerName.trim()) {
      setAddPlayerError('Please enter player name');
      return;
    }
    if (!user?.mobile) return;
    try {
      const cleanMobile = user.mobile.replace(/[^0-9]/g, '').slice(-10);
      const res = await fetchApi('/api/user/khaiwal/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: cleanMobile,
          name: addPlayerName.trim(),
          jodi_rate: parseFloat(addJodiRate) || 95,
          crossing_rate: parseFloat(addCrossingRate) || 95,
          haroof_rate: parseFloat(addHarufRate) || 9.5,
          commission_pct: addCommissionPct !== '' && !isNaN(parseFloat(addCommissionPct)) ? parseFloat(addCommissionPct) : 0
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddPlayerModal(false);
        setAddPlayerName('');
        setAddPlayerError('');
        fetchKhaiwalPlayers();
      } else {
        setAddPlayerError(data.message || 'Failed to add player');
      }
    } catch (err: any) {
      setAddPlayerError(err.message || 'Error saving player');
    }
  };

  const handleUpdateKhaiwalPlayer = async () => {
    if (!editingKhaiwalPlayer || !editPlayerName.trim() || !user?.mobile) return;
    try {
      const cleanMobile = user.mobile.replace(/[^0-9]/g, '').slice(-10);
      const res = await fetchApi('/api/user/khaiwal/players/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: cleanMobile,
          playerId: editingKhaiwalPlayer.id,
          name: editPlayerName.trim(),
          jodi_rate: parseFloat(editJodiRate) || 95,
          crossing_rate: parseFloat(editCrossingRate) || 95,
          haroof_rate: parseFloat(editHarufRate) || 9.5,
          commission_pct: editCommissionPct !== '' && !isNaN(parseFloat(editCommissionPct)) ? parseFloat(editCommissionPct) : 0
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowEditPlayerModal(false);
        setEditingKhaiwalPlayer(null);
        fetchKhaiwalPlayers();
      }
    } catch (err) {
      console.error('Error updating player:', err);
    }
  };

  const handleDeleteKhaiwalPlayer = async () => {
    if (!deletingKhaiwalPlayer || !user?.mobile) return;
    try {
      const cleanMobile = user.mobile.replace(/[^0-9]/g, '').slice(-10);
      const res = await fetchApi('/api/user/khaiwal/players/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: cleanMobile,
          playerId: deletingKhaiwalPlayer.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowDeletePlayerModal(false);
        if (selectedKhaiwalPlayer?.id === deletingKhaiwalPlayer.id) {
          setSelectedKhaiwalPlayer(null);
        }
        setDeletingKhaiwalPlayer(null);
        fetchKhaiwalPlayers();
      }
    } catch (err) {
      console.error('Error deleting player:', err);
    }
  };
  const [copiedToast, setCopiedToast] = useState(false);
  const [isWebUserBlocked, setIsWebUserBlocked] = useState(false);
  const [isWebUserDeleted, setIsWebUserDeleted] = useState(false);
  const [myBetsDateFilter, setMyBetsDateFilter] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [myBetsSelectedDate, setMyBetsSelectedDate] = useState(getISTDateStr());
  const [myBetsMarketFilter, setMyBetsMarketFilter] = useState<string>('All');
  const [selectedDetailGame, setSelectedDetailGame] = useState<string | null>(null);

  // Referral Details State
  const [referralDetails, setReferralDetails] = useState<{
    referral_code: string;
    referralsCount: number;
    totalCommission: number;
    referredUsers: Array<{
      id: string;
      name: string;
      mobile: string;
      date: string;
      bonus: number;
      betCommission: number;
      totalEarned: number;
    }>;
  }>({
    referral_code: '',
    referralsCount: 0,
    totalCommission: 0,
    referredUsers: []
  });

  // Referral Date Filter State
  const [refFilterType, setRefFilterType] = useState<'all' | 'today' | 'yesterday' | 'custom'>('all');
  const [refFilterDate, setRefFilterDate] = useState<string>('all');
  const [refFilterLabel, setRefFilterLabel] = useState<string>('All Time');
  const [isTransferringCommission, setIsTransferringCommission] = useState(false);
  const [commissionTransferMsg, setCommissionTransferMsg] = useState('');

  const fetchWebsiteReferralDetails = async (filterDate: string = refFilterDate) => {
    const saved = localStorage.getItem('99x_web_user');
    const mob = user?.mobile || (saved ? JSON.parse(saved)?.mobile : null);
    if (!mob) return;
    const cleanMobile = mob.replace(/[^0-9]/g, '').slice(-10);
    try {
      const queryParam = filterDate !== 'all' ? `&date=${filterDate}` : '';
      const res = await fetchApi(`/api/user/referral-details?mobile=${cleanMobile}${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        setReferralDetails({
          referral_code: (data.referral_code || cleanMobile).replace(/^REF/i, ''),
          referralsCount: data.referralsCount !== undefined ? data.referralsCount : 0,
          totalCommission: data.totalCommission !== undefined ? data.totalCommission : 0,
          referredUsers: data.referredUsers || []
        });
      }
    } catch (e) {}
  };

  const handleCommissionTransfer = async () => {
    const saved = localStorage.getItem('99x_web_user');
    const mob = user?.mobile || (saved ? JSON.parse(saved)?.mobile : null);
    if (!mob) return;
    const commBal = user?.commission_balance !== undefined ? user.commission_balance : (referralDetails?.totalCommission || 0);
    if (commBal <= 0) {
      setCommissionTransferMsg('⚠️ No commission balance available to transfer');
      return;
    }
    setIsTransferringCommission(true);
    setCommissionTransferMsg('');
    try {
      const res = await fetchApi('/api/user/commission/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mob })
      });
      const data = await res.json();
      if (data.success) {
        setCommissionTransferMsg(`✅ ${data.message}`);
        // Update local user state
        setUser(prev => prev ? {
          ...prev,
          commission_balance: 0,
          deposit_balance: data.newDepositBalance,
          balance: data.newBalance
        } : prev);
        fetchWebsiteReferralDetails(refFilterDate);
      } else {
        setCommissionTransferMsg(`❌ ${data.message}`);
      }
    } catch (e) {
      setCommissionTransferMsg('❌ Transfer failed. Please try again.');
    }
    setIsTransferringCommission(false);
  };

  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchWebsiteNotifications = async () => {
    try {
      const res = await fetchApi('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setNotificationsList(data);
          setUnreadCount(data.length);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchWebsiteNotifications();
    const interval = setInterval(fetchWebsiteNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const [applyRefInput, setApplyRefInput] = useState('');
  const [applyRefStatus, setApplyRefStatus] = useState('');

  const handleApplyReferralCode = async () => {
    if (!applyRefInput.trim()) {
      setApplyRefStatus('Please enter a referral code');
      return;
    }
    setApplyRefStatus('Applying...');
    const saved = localStorage.getItem('99x_web_user');
    const mob = user?.mobile || (saved ? JSON.parse(saved)?.mobile : null);
    if (!mob) {
      setApplyRefStatus('Please log in first');
      return;
    }

    try {
      const res = await fetchApi('/api/user/apply-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mob,
          referral_code: applyRefInput.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setApplyRefStatus(data.message);
        setApplyRefInput('');
        fetchWebsiteReferralDetails();
      } else {
        setApplyRefStatus(data.message || 'Failed to apply referral code');
      }
    } catch (e) {
      setApplyRefStatus('Server error while applying code');
    }
  };

  useEffect(() => {
    fetchWebsiteReferralDetails();
  }, [showReferralModal, user?.mobile]);

  const formatChartDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const parseTimeMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const clean = timeStr.replace(/IST/i, '').trim();
    const match = clean.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const getIstCurrentMinutes = (): number => {
    try {
      const now = new Date();
      const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
      const timePart = istString.split(', ')[1] || istString;
      const parts = timePart.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    } catch (e) {
      const now = new Date();
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      return istTime.getUTCHours() * 60 + istTime.getUTCMinutes();
    }
  };

  const isGameBettingOpen = (gameName: string, sched?: GameSchedule) => {
    if (!gameName) return false;
    const resolvedKey = gameName === 'Disawer' ? 'Desawar' : (gameName === 'Shri Ganesh' ? 'Shree Ganesh' : gameName);
    const altKey = resolvedKey === 'Desawar' ? 'Disawer' : (resolvedKey === 'Shree Ganesh' ? 'Shri Ganesh' : resolvedKey);

    // 1. If result has already been declared for today, market is CLOSED
    const result = declaredResults[resolvedKey] ?? declaredResults[altKey] ?? declaredResults[gameName];
    if (result !== undefined && result !== null && String(result).trim() !== '' && String(result) !== '--') {
      return false;
    }

    // 2. Get target schedule or fallback to DEFAULT_SCHEDULES
    const targetSched = sched || gameSchedules[resolvedKey] || gameSchedules[gameName] || DEFAULT_SCHEDULES[resolvedKey] || DEFAULT_SCHEDULES[gameName];
    if (!targetSched) return false;
    if ((targetSched as any).enabled === false) return false;

    try {
      const currentMins = getIstCurrentMinutes();
      const openMins = parseTimeMinutes(targetSched.open);
      const closeMins = parseTimeMinutes(targetSched.close);

      if (openMins === 0 && closeMins === 0) return false;

      const isDesawar = resolvedKey === 'Desawar';
      if (isDesawar || closeMins < openMins) {
        return currentMins >= openMins || currentMins < closeMins;
      }
      return currentMins >= openMins && currentMins < closeMins;
    } catch (e) {
      return false;
    }
  };

  const getRemainingMinutesToClose = (gameName: string, sched?: GameSchedule): number => {
    const resolvedKey = gameName === 'Disawer' ? 'Desawar' : (gameName === 'Shri Ganesh' ? 'Shree Ganesh' : gameName);
    const targetSched = sched || gameSchedules[resolvedKey] || gameSchedules[gameName];
    if (!targetSched) return -1;

    try {
      const currentMins = getIstCurrentMinutes();
      const closeMins = parseTimeMinutes(targetSched.close);
      let diff = closeMins - currentMins;
      if (diff < 0) diff += 1440;
      return diff;
    } catch (e) {
      return -1;
    }
  };

  // Fetch Date-wise Chart Results from Backend & DB
  useEffect(() => {
    const fetchDateChart = async () => {
      let targetDate = new Date().toISOString().split('T')[0];
      if (chartFilter === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        targetDate = y.toISOString().split('T')[0];
      } else if (chartFilter === 'custom') {
        targetDate = selectedChartDate;
      }

      try {
        const res = await fetchApi(`/api/game/chart-results?date=${targetDate}`);
        if (res.ok) {
          const data = await res.json();
          setDateChartResults(data.results || {});
        }
      } catch (e) {}
    };

    fetchDateChart();
  }, [chartFilter, selectedChartDate]);

  // Fetch dynamic promotional banners from Admin Panel
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const resB = await fetchApi('/api/game/banners');
        if (resB && resB.ok) {
          const bannersData = await resB.json();
          if (Array.isArray(bannersData) && bannersData.length > 0) {
            const activeB = bannersData.filter((b: any) => b.status === 'Active' || b.enabled !== false);
            if (activeB.length > 0) {
              setWebBanners(activeB);
            }
          }
        }
      } catch (e) {}

      try {
        const resConfig = await fetchApi('/api/game/banner');
        if (resConfig && resConfig.ok) {
          const configData = await resConfig.json();
          if (configData) {
            setGlobalBannerConfig(configData);
            setBannerConfig(configData);
          }
        }
      } catch (e) {}
    };

    fetchBanners();
    const interval = setInterval(fetchBanners, 8000);
    return () => clearInterval(interval);
  }, []);

  // Auto-slide hero banner carousel every 4 seconds
  useEffect(() => {
    if (webBanners.length <= 1) return;
    const timer = setInterval(() => {
      setWebBannerIndex((prev) => (prev + 1) % webBanners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [webBanners.length]);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositTab, setDepositTab] = useState<'instant' | 'manual'>('instant');
  const [depositAmount, setDepositAmount] = useState('300');
  const [depositUtr, setDepositUtr] = useState('');
  const [depositMessage, setDepositMessage] = useState('');
  const [isGeneratingEkqr, setIsGeneratingEkqr] = useState(false);
  const [ekqrOrderData, setEkqrOrderData] = useState<any>(null);
  const [isCheckingEkqrStatus, setIsCheckingEkqrStatus] = useState(false);
  const [ekqrStatusText, setEkqrStatusText] = useState('');
  const [activeUpiId, setActiveUpiId] = useState('8930507940@ybl');
  const [activeMerchantName, setActiveMerchantName] = useState('99xmatka');

  useEffect(() => {
    if (showDepositModal) {
      const fetchActiveUpi = async () => {
        try {
          let res = await fetchApi('/api/payment-methods');
          if (!res.ok) {
            res = await fetchApi('/api/admin/payment-methods');
          }
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const active = data.find((p: any) => p.status === 'Active') || data[0];
              const upi = active.upi_id || active.upiId || active.upi;
              if (upi) setActiveUpiId(upi);
              if (active.merchant_name) setActiveMerchantName(active.merchant_name);
            }
          }
        } catch (e) {}
      };
      fetchActiveUpi();
    }
  }, [showDepositModal]);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('200');
  const [withdrawMethod, setWithdrawMethod] = useState<'UPI' | 'Bank'>('UPI');
  const [withdrawUpi, setWithdrawUpi] = useState('');
  useEffect(() => {
    if (showKhaiwalModal && user?.is_khaiwal) {
      fetchKhaiwalPlayers();
    }
  }, [showKhaiwalModal, user]);

  const [withdrawHolderName, setWithdrawHolderName] = useState('');
  const [withdrawBankAcc, setWithdrawBankAcc] = useState('');
  const [withdrawBankIfsc, setWithdrawBankIfsc] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [isWithdrawSubmitting, setIsWithdrawSubmitting] = useState(false);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawMessage('');
    const numAmt = parseFloat(withdrawAmount);

    if (!numAmt || numAmt < 200) {
      setWithdrawMessage('Error: Minimum withdrawal amount is ₹200');
      return;
    }

    const withdrawable = user?.winning_balance !== undefined ? user.winning_balance : (user?.balance || 0);
    if (user && numAmt > withdrawable) {
      setWithdrawMessage(`Error: You can only withdraw your winning balance. Withdrawable balance: ₹${withdrawable.toFixed(2)}`);
      return;
    }

    const detailsStr = withdrawMethod === 'UPI' 
      ? (withdrawUpi || 'UPI ID') 
      : `Acc: ${withdrawBankAcc}, IFSC: ${withdrawBankIfsc}`;

    if (withdrawMethod === 'UPI' && !withdrawUpi.trim()) {
      setWithdrawMessage('Error: Please enter a valid UPI ID');
      return;
    }

    if (withdrawMethod === 'Bank' && (!withdrawBankAcc.trim() || !withdrawBankIfsc.trim())) {
      setWithdrawMessage('Error: Please enter Account Number and IFSC Code');
      return;
    }

    setIsWithdrawSubmitting(true);

    try {
      const res = await fetchApi('/api/user/withdraw/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: user?.mobile,
          mobile: user?.mobile,
          amount: numAmt,
          method: withdrawMethod,
          details: detailsStr,
          holder_name: withdrawHolderName || user?.name || 'Player'
        })
      });

      const data = await res.json();
      if (data.success) {
        setWithdrawMessage(`✅ Request Submitted! ₹${numAmt} will be settled within 15 minutes.`);
        if (user) {
          const newBal = data.newBalance !== undefined ? data.newBalance : Math.max(0, user.balance - numAmt);
          const updatedUser = { ...user, balance: newBal };
          setUser(updatedUser);
          localStorage.setItem('99x_web_user', JSON.stringify(updatedUser));
        }
        setTimeout(() => {
          setShowWithdrawModal(false);
          setWithdrawMessage('');
        }, 2500);
      } else {
        setWithdrawMessage(`Error: ${data.message || 'Withdrawal failed'}`);
      }
    } catch (err) {
      if (user) {
        const updatedUser = { ...user, balance: Math.max(0, user.balance - numAmt) };
        setUser(updatedUser);
        localStorage.setItem('99x_web_user', JSON.stringify(updatedUser));
      }
      setWithdrawMessage(`✅ Withdrawal request of ₹${numAmt} submitted! Settling within 15 minutes.`);
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawMessage('');
      }, 2500);
    } finally {
      setIsWithdrawSubmitting(false);
    }
  };

  const [activeWebTab, setActiveWebTab] = useState<'home' | 'mybets' | 'charts' | 'referral'>('home');
  const [myBetsList, setMyBetsList] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem('99x_web_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('99x_web_tab', activeWebTab);
  }, [activeWebTab]);

  useEffect(() => {
    if (selectedGameForBetting) {
      localStorage.setItem('99x_selected_game', selectedGameForBetting);
    } else {
      localStorage.removeItem('99x_selected_game');
    }
  }, [selectedGameForBetting]);

  // Load saved session & bets on launch & immediately sync live profile
  useEffect(() => {
    const saved = localStorage.getItem('99x_web_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        if (u && u.mobile) {
          fetchApi(`/api/user/profile?mobile=${u.mobile}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data) {
                const fresh = {
                  ...u,
                  name: data.name && data.name !== 'User' ? data.name : u.name,
                  balance: data.balance !== undefined ? data.balance : u.balance
                };
                setUser(fresh);
                localStorage.setItem('99x_web_user', JSON.stringify(fresh));
              }
            })
            .catch(() => {});
        }
      } catch (e) {}
    }

    const savedMob = saved ? JSON.parse(saved)?.mobile : null;
    if (savedMob) {
      const savedBets = localStorage.getItem(`99x_my_bets_${savedMob}`);
      if (savedBets) {
        try {
          const b = JSON.parse(savedBets);
          if (Array.isArray(b) && b.length > 0) setMyBetsList(b);
        } catch (e) {}
      }
    }
  }, []);

  // Poll backend data
  const refreshData = async () => {
    try {
      // Fetch Banner
      const bRes = await fetchApi('/api/game/banner');
      if (bRes.ok) {
        const bData = await bRes.json();
        setBannerConfig(bData);
        setGlobalBannerConfig(bData);
      }

      // Fetch Banners List
      try {
        const blRes = await fetchApi('/api/game/banners');
        if (blRes.ok) {
          const blData = await blRes.json();
          if (Array.isArray(blData) && blData.length > 0) {
            const activeB = blData.filter((b: any) => b.status === 'Active' || b.enabled !== false);
            if (activeB.length > 0) setWebBanners(activeB);
          }
        }
      } catch (e) {}

            // Fetch Results
      const rRes = await fetchApi('/api/game/results');
      if (rRes.ok) {
        const rData = await rRes.json();
        setDeclaredResults(rData);
      }

      // Fetch Schedules
      const sRes = await fetchApi('/api/admin/schedules');
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Object.keys(sData).length > 0) {
          setGameSchedules(sData);
        }
      }

      // Fetch Live Players Count
      const lpRes = await fetchApi('/api/game/live-players');
      if (lpRes.ok) {
        const lpData = await lpRes.json();
        if (lpData && lpData.data) {
          setLivePlayersMap(lpData.data);
        }
      }

      // Fetch Settings (WhatsApp number, rates, etc.)
      const setRes = await fetchApi('/api/app/settings');
      if (setRes.ok) {
        const setData = await setRes.json();
        if (setData.whatsapp_number) {
          setWhatsappNumber(setData.whatsapp_number.replace(/[^0-9]/g, ''));
        }
        if (setData.whatsapp_call_number) {
          setWhatsappCallNumber(setData.whatsapp_call_number.replace(/[^0-9]/g, ''));
        }
        if (setData.jodi_rate !== undefined || setData.crossing_rate !== undefined || setData.haroof_rate !== undefined) {
          setGameRates({
            jodi: setData.jodi_rate !== undefined ? Number(setData.jodi_rate) : 95,
            crossing: setData.crossing_rate !== undefined ? Number(setData.crossing_rate) : 95,
            haroof: setData.haroof_rate !== undefined ? Number(setData.haroof_rate) : 9.5
          });
        }
      }

      // Refresh User Wallet & Profile Name from Backend live!
      const currentSaved = localStorage.getItem('99x_web_user');
      const activeMobile = user?.mobile || (currentSaved ? JSON.parse(currentSaved)?.mobile : null);
      if (activeMobile) {
        const uRes = await fetchApi(`/api/user/profile?mobile=${activeMobile}`);
        if (uRes.ok) {
          const uData = await uRes.json();
          if (uData.is_deleted || uData.message === 'No Authentication') {
            setIsWebUserDeleted(true);
            setIsWebUserBlocked(false);
            setUser(null);
            localStorage.removeItem('99x_web_user');
          } else if (uData.is_blocked || uData.error === 'NO_INTERNET') {
            setIsWebUserBlocked(true);
            setIsWebUserDeleted(false);
          } else {
            setIsWebUserBlocked(false);
            setIsWebUserDeleted(false);
            setUser(prev => {
              const currentName = uData.name && uData.name !== 'User' ? uData.name : (prev?.name || `User ${activeMobile.slice(-4)}`);
              const currentBal = uData.balance !== undefined ? uData.balance : (prev?.balance || 0);
              const updated = { 
                name: currentName,
                mobile: activeMobile,
                balance: currentBal,
                deposit_balance: uData.deposit_balance !== undefined ? uData.deposit_balance : (prev?.deposit_balance || 0),
                winning_balance: uData.winning_balance !== undefined ? uData.winning_balance : (prev?.winning_balance || 0),
                bonus_balance: uData.bonus_balance !== undefined ? uData.bonus_balance : (prev?.bonus_balance !== undefined ? prev.bonus_balance : 200),
                commission_balance: uData.commission_balance !== undefined ? uData.commission_balance : (prev?.commission_balance || 0),
                withdrawable_balance: uData.winning_balance !== undefined ? uData.winning_balance : (prev?.winning_balance || 0),
                is_khaiwal: uData.is_khaiwal === true
              };
              localStorage.setItem('99x_web_user', JSON.stringify(updated));
              return updated;
            });
          }
        }

        // Fetch My Bets for active logged-in user
        const bHistoryRes = await fetchApi(`/api/game/my-bets?mobile=${activeMobile}`);
        if (bHistoryRes.ok) {
          const bHistory = await bHistoryRes.json();
          if (Array.isArray(bHistory)) {
            setMyBetsList(bHistory);
            localStorage.setItem(`99x_my_bets_${activeMobile}`, JSON.stringify(bHistory));
          }
        }

        // Fetch Referral Stats Live
        const cleanMob = activeMobile.replace(/[^0-9]/g, '').slice(-10);
        const refRes = await fetchApi(`/api/user/referral-details?mobile=${cleanMob}`);
        if (refRes.ok) {
          const refData = await refRes.json();
          setReferralDetails({
            referral_code: (refData.referral_code || cleanMob).replace(/^REF/i, ''),
            referralsCount: refData.referralsCount || 0,
            totalCommission: refData.totalCommission || 0,
            referredUsers: refData.referredUsers || []
          });
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 3000);
    return () => clearInterval(timer);
  }, [user?.mobile]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  // Auth Handler 1: Phone Submit (Checks if number is registered and dispatches MSG91 OTP)
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMobile = mobileNumber.replace(/[^0-9]/g, '').slice(-10);
    if (cleanMobile.length < 10) {
      setAuthError('Please enter valid 10-digit mobile number');
      return;
    }
    setAuthError('');
    setOtpSuccessMessage('');
    setIsExistingUser(false);
    setExistingUserData(null);
    setIsSendingOtp(true);

    try {
      // 1. Check existing user info
      const checkRes = await fetchApi(`/api/user/check?mobile=${cleanMobile}`);
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data && data.exists && data.user) {
          const uName = (data.user.name || '').trim();
          const isRealName = uName.length > 0 && !uName.startsWith('User ') && uName !== 'User';
          if (isRealName) {
            setIsExistingUser(true);
            setExistingUserData({
              name: uName,
              mobile: cleanMobile,
              balance: data.user.balance || 0
            });
          }
        }
      }

      // 2. Dispatch real SMS OTP via MSG91
      const otpRes = await fetchApi('/api/user/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanMobile })
      });
      const otpData = await otpRes.json().catch(() => ({}));
      if (otpRes.ok && otpData.success !== false) {
        setResendTimer(30);
        setOtpInput('');
        setOtpSuccessMessage(otpData.message || 'OTP sent successfully to your mobile!');
        setAuthStep('otp');
      } else {
        setAuthError(otpData.message || 'Failed to send OTP via SMS. Please try again.');
      }
    } catch (err: any) {
      // Fallback to OTP screen in case of temporary network glitch
      setResendTimer(30);
      setAuthStep('otp');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Auth Handler 1b: Resend OTP via MSG91
  const handleResendOtp = async () => {
    if (resendTimer > 0 || isSendingOtp) return;
    const cleanMobile = mobileNumber.replace(/[^0-9]/g, '').slice(-10);
    if (cleanMobile.length < 10) return;
    setIsSendingOtp(true);
    setAuthError('');
    setOtpSuccessMessage('');
    try {
      const res = await fetchApi('/api/user/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanMobile })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setResendTimer(30);
        setOtpSuccessMessage(data.message || 'New OTP sent successfully!');
      } else {
        // Fallback retry using send-otp
        const fallbackRes = await fetchApi('/api/user/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: cleanMobile })
        });
        const fbData = await fallbackRes.json().catch(() => ({}));
        if (fallbackRes.ok && fbData.success !== false) {
          setResendTimer(30);
          setOtpSuccessMessage('New OTP sent successfully!');
        } else {
          setAuthError(fbData.message || data.message || 'Failed to resend OTP.');
        }
      }
    } catch (e: any) {
      setAuthError('Failed to connect to OTP service');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Auth Handler 2: OTP Submit (Verifies via MSG91 backend API)
  const handleOtpSubmit = async (val: string) => {
    if (val.length === 4 && !isVerifyingOtp) {
      const cleanMobile = mobileNumber.replace(/[^0-9]/g, '').slice(-10);
      setIsVerifyingOtp(true);
      setAuthError('');

      try {
        const verifyRes = await fetchApi('/api/user/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: cleanMobile, otp: val })
        });
        const verifyData = await verifyRes.json().catch(() => ({}));

        if (!verifyRes.ok || verifyData.success === false) {
          setAuthError(verifyData.message || 'Invalid OTP code. Please enter the code sent to your phone.');
          setOtpInput('');
          setIsVerifyingOtp(false);
          return;
        }

        // OTP Verified successfully!
        let registeredProfile = existingUserData;

        // Double check live with backend if registered user has a real name
        if (!registeredProfile) {
          try {
            const res = await fetchApi(`/api/user/check?mobile=${cleanMobile}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.exists && data.user) {
                const uName = (data.user.name || '').trim();
                const isRealName = uName.length > 0 && !uName.startsWith('User ') && uName !== 'User';
                if (isRealName) {
                  registeredProfile = {
                    name: uName,
                    mobile: cleanMobile,
                    balance: data.user.balance || 0
                  };
                }
              }
            }
          } catch (e) {}
        }

        const hasRealName = registeredProfile?.name && 
          !registeredProfile.name.startsWith('User ') && 
          registeredProfile.name !== 'User';

        if (hasRealName) {
          // ALREADY REGISTERED USER WITH REAL NAME -> Redirect directly to Main WebApp Page!
          const loggedInUser = registeredProfile!;
          setUser(loggedInUser);
          localStorage.setItem('99x_web_user', JSON.stringify(loggedInUser));
          setView('webapp');
        } else {
          // NEW USER OR UNNAMED USER -> Ask for Full Name & Referral Code!
          setAuthStep('register');
        }
      } catch (err: any) {
        setAuthError('Network error during verification. Please try again.');
      } finally {
        setIsVerifyingOtp(false);
      }
    }
  };

  // Auth Handler 3: New Account Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName.trim()) {
      setAuthError('Please enter your full name');
      return;
    }
    const cleanMobile = mobileNumber.replace(/[^0-9]/g, '');
    const ownRef = cleanMobile;
    const newUser = {
      name: registerName.trim(),
      mobile: cleanMobile,
      balance: 0.00,
      referral_code: ownRef
    };

    try {
      await fetchApi('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName.trim(),
          mobile: cleanMobile,
          password: registerPassword || '123456',
          referral_code: referralCodeInput.trim()
        })
      });
    } catch (e) {}

    setUser(newUser);
    localStorage.setItem('99x_web_user', JSON.stringify(newUser));
    setView('webapp');
  };

  // Bet Submission Handler
  const handlePlaceBet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setView('auth');
      return;
    }

    if (!selectedGameForBetting || !isGameBettingOpen(selectedGameForBetting, gameSchedules[selectedGameForBetting])) {
      setBetMessage(`⏳ Result is PENDING for ${selectedGameForBetting || 'this market'}.`);
      return;
    }

    const activeBets: { num: string; amt: number; type: string }[] = [];

    if (betCategory === 'Jodi' || betCategory === 'Crossing') {
      Object.entries(jodiGrid).forEach(([num, valStr]) => {
        const val = Math.max(0, parseInt(valStr) || 0);
        if (val > 0) {
          activeBets.push({ num, amt: val, type: betCategory === 'Crossing' ? 'CROSSING' : 'JODI' });
        }
      });
    } else if (betCategory === 'Paste') {
      copyPasteParsedList.forEach(item => {
        if (item.amount > 0) {
          activeBets.push({ num: item.jodi, amt: item.amount, type: 'JODI' });
        }
      });
    } else if (betCategory === 'Haruf') {
      Object.entries(jodiGrid).forEach(([key, valStr]) => {
        const val = Math.max(0, parseInt(valStr) || 0);
        if (val > 0) {
          if (key.startsWith('A')) {
            const num = key.replace('A', '');
            activeBets.push({ num, amt: val, type: 'HAROOF_ANDER' });
          } else if (key.startsWith('B')) {
            const num = key.replace('B', '');
            activeBets.push({ num, amt: val, type: 'HAROOF_BAHAR' });
          } else {
            activeBets.push({ num: key, amt: val, type: 'HAROOF_ANDER' });
          }
        }
      });
    }

    const totalReq = activeBets.reduce((sum, b) => sum + b.amt, 0);

    if (activeBets.length === 0 || totalReq <= 0) {
      setBetMessage('Please enter amount on at least one number.');
      return;
    }

    if (activeKhaiwalBetPlayer) {
      try {
        await fetchApi('/api/user/khaiwal/log-player-bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: user.mobile,
            playerId: activeKhaiwalBetPlayer.id,
            playerName: activeKhaiwalBetPlayer.name,
            gameName: selectedGameForBetting,
            betCategory: betCategory,
            bets: activeBets,
            totalAmount: totalReq
          })
        });
        if (selectedKhaiwalPlayer?.id === activeKhaiwalBetPlayer.id) {
          fetchKhaiwalPlayerLedger(selectedKhaiwalPlayer);
        }
      } catch (err: any) {
        console.error('Error logging player bet:', err);
      }
    }

    if (user.balance < totalReq) {
      setBetMessage(`Insufficient wallet balance (Need ₹${totalReq})! Please add money.`);
      return;
    }

    try {
      const res = await fetchApi('/api/game/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_name: selectedGameForBetting,
          bet_type: betCategory.toUpperCase(),
          bets: activeBets.map(b => ({ number: b.num, bet_amount: b.amt, bet_type: b.type || betCategory.toUpperCase() })),
          mobile: user.mobile,
          userPhone: user.mobile
        })
      });

      const data = await res.json();
      if (res.ok || data.message) {
        setBetMessage('🎉 Bet placed successfully!');
        if (user) {
          const newBal = data.newBalance !== undefined ? data.newBalance : Math.max(0, user.balance - totalReq);
          const updatedUser = { ...user, balance: newBal };
          setUser(updatedUser);
          localStorage.setItem('99x_web_user', JSON.stringify(updatedUser));
        }

        // Store new bets in local list & localStorage so they never disappear
        const newBetRecords = activeBets.map(b => ({
          _id: `bet_${Date.now()}_${b.num}`,
          game_name: selectedGameForBetting || 'Delhi Bazar',
          bet_type: b.type || betCategory.toUpperCase(),
          number: b.num,
          bet_amount: b.amt,
          potential_payout: b.amt * (betCategory.toLowerCase() === 'jodi' ? 95 : 10),
          win_amount: 0,
          status: 'PENDING',
          user: user?.mobile || 'User',
          created_at: new Date().toISOString()
        }));

        setMyBetsList(prev => {
          const updated = [...newBetRecords, ...prev];
          if (user?.mobile) {
            localStorage.setItem(`99x_my_bets_${user.mobile}`, JSON.stringify(updated));
          }
          return updated;
        });

        setJodiGrid({});
        setCopyPasteInputText('');
        setCrossingDigits('');
        setCopyPasteParsedList([]);
        refreshData();
        setTimeout(() => {
          setBetMessage('');
        }, 2500);
      } else {
        setBetMessage(`Error: ${data.message || 'Bet placement failed'}`);
      }
    } catch (e) {
      setBetMessage('Bet placement failed. Please try again.');
    }
  };

  // Deposit Submission (Manual UTR)
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositMessage('');
    const amtNum = parseFloat(depositAmount) || 500;
    const utrStr = depositUtr.trim() || `UTR${Date.now()}`;
    const userLabel = user ? `${user.name} (${user.mobile})` : 'Player';

    try {
      const res = await fetchApi('/api/user/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userLabel,
          mobile: user?.mobile || '9007724336',
          amount: amtNum,
          method: 'Manual UPI (UTR)',
          utr: utrStr
        })
      });

      const data = await res.json();
      if (res.ok || data.success) {
        setDepositMessage('✅ Deposit request submitted! Admin will verify and approve shortly.');
        setTimeout(() => {
          setShowDepositModal(false);
          setDepositMessage('');
          setDepositUtr('');
        }, 2200);
      } else {
        setDepositMessage(`Error: ${data.message || 'Deposit submission failed'}`);
      }
    } catch (e) {
      setDepositMessage('Error: Failed to connect to server. Please try again.');
    }
  };

  // Handle start instant EKQR payment
  const handleStartEkqrPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDepositMessage('');
    const amtNum = parseFloat(depositAmount) || 100;
    if (amtNum < 100) {
      setDepositMessage('Error: Minimum deposit amount is ₹100');
      return;
    }

    setIsGeneratingEkqr(true);
    setEkqrStatusText('Initiating secure UPI gateway...');

    const rawName = (user?.name || '').trim().replace(/[^a-zA-Z0-9 ]/g, '');
    const validName = rawName.length >= 3 ? rawName : (rawName.length > 0 ? `${rawName} Player` : 'Player');
    const cleanMob = (user?.mobile || '').replace(/[^0-9]/g, '').slice(-10) || '9007724336';
    const validEmail = (user as any)?.email && (user as any).email.includes('@') ? (user as any).email : `user${cleanMob}@gmail.com`;

    try {
      const res = await fetchApi('/api/payment/ekqr/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amtNum,
          mobile: cleanMob,
          name: validName,
          email: validEmail,
          redirect_url: window.location.href
        })
      });

      const data = await res.json();
      if (data.success) {
        setEkqrOrderData(data);
        setEkqrStatusText('Payment link generated! Please pay using any UPI app below.');
      } else {
        setDepositMessage(`Error: ${data.message || 'Failed to create payment order'}`);
      }
    } catch (err: any) {
      setDepositMessage(`Error: ${err.message || 'Failed to connect to payment gateway'}`);
    } finally {
      setIsGeneratingEkqr(false);
    }
  };

  // Poll EKQR status automatically when ekqrOrderData is active
  useEffect(() => {
    let interval: any = null;
    if (showDepositModal && ekqrOrderData && ekqrOrderData.client_txn_id) {
      interval = setInterval(async () => {
        try {
          const res = await fetchApi('/api/payment/ekqr/check-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_txn_id: ekqrOrderData.client_txn_id,
              txn_date: ekqrOrderData.txn_date
            })
          });
          const data = await res.json();
          if (data.status === 'success' || data.is_approved) {
            clearInterval(interval);
            const creditedAmt = parseFloat(depositAmount) || 100;
            setDepositMessage(`🎉 Payment of ₹${creditedAmt} Successful! Balance credited to wallet.`);
            if (user) {
              const newBal = data.newBalance !== undefined ? data.newBalance : (user.balance + creditedAmt);
              const updated = { ...user, balance: newBal, deposit_balance: (user.deposit_balance || 0) + creditedAmt };
              setUser(updated);
              localStorage.setItem('99x_web_user', JSON.stringify(updated));
            }
            setTimeout(() => {
              setShowDepositModal(false);
              setEkqrOrderData(null);
              setDepositMessage('');
            }, 3000);
          } else if (data.status === 'failure') {
            clearInterval(interval);
            setDepositMessage('❌ Payment failed or cancelled. Please try again.');
          }
        } catch (e) {}
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showDepositModal, ekqrOrderData, user, depositAmount]);

  // Manual Check Status button
  const handleManualCheckEkqrStatus = async () => {
    if (!ekqrOrderData || !ekqrOrderData.client_txn_id) return;
    setIsCheckingEkqrStatus(true);
    setDepositMessage('');
    try {
      const res = await fetchApi('/api/payment/ekqr/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_txn_id: ekqrOrderData.client_txn_id,
          txn_date: ekqrOrderData.txn_date
        })
      });
      const data = await res.json();
      if (data.status === 'success' || data.is_approved) {
        const creditedAmt = parseFloat(depositAmount) || 100;
        setDepositMessage(`🎉 Payment of ₹${creditedAmt} Verified! Balance credited.`);
        if (user) {
          const newBal = data.newBalance !== undefined ? data.newBalance : (user.balance + creditedAmt);
          const updated = { ...user, balance: newBal, deposit_balance: (user.deposit_balance || 0) + creditedAmt };
          setUser(updated);
          localStorage.setItem('99x_web_user', JSON.stringify(updated));
        }
        setTimeout(() => {
          setShowDepositModal(false);
          setEkqrOrderData(null);
          setDepositMessage('');
        }, 3000);
      } else if (data.status === 'pending') {
        alert('⏳ Payment is still pending. If you have already paid in your UPI app, please wait 5-10 seconds for the bank confirmation.');
      } else {
        alert(`Status: ${data.message || 'Payment not completed yet'}`);
      }
    } catch (e) {
      alert('Error verifying payment status. Please try again in a moment.');
    } finally {
      setIsCheckingEkqrStatus(false);
    }
  };

  const isDownloadingApkRef = useRef(false);

  // Download APK Trigger (Single-fire download with debounce to prevent duplicate triggers)
  const handleDownloadApk = () => {
    if (isDownloadingApkRef.current) return;
    isDownloadingApkRef.current = true;
    setTimeout(() => {
      isDownloadingApkRef.current = false;
    }, 3000);

    const timestamp = Date.now();
    const apkUrl = `/99xmatka.apk?v=${timestamp}`;
    const link = document.createElement('a');
    link.href = apkUrl;
    link.setAttribute('download', '99xmatka.apk');
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      } catch (e) {}
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex justify-center">
      <div className="w-full max-w-xl bg-white min-h-screen flex flex-col relative">

        {/* Full Screen Blocked Overlay */}
        {isWebUserBlocked && (
          <div className="fixed inset-0 z-50 bg-[#0F172A] text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mb-6">
              <span className="text-4xl">📡</span>
            </div>
            <h1 className="text-2xl font-black text-red-500 mb-2">No Internet Connection</h1>
            <p className="text-slate-400 text-sm max-w-xs mb-6">
              Please check your network settings and try again. Your session will resume automatically once restored.
            </p>
            <button 
              onClick={() => refreshData()} 
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
            >
              Retry Connection 🔄
            </button>
          </div>
        )}

        {/* Full Screen Deleted Overlay */}
        {isWebUserDeleted && (
          <div className="fixed inset-0 z-50 bg-[#0F172A] text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-6">
              <span className="text-4xl">🔒</span>
            </div>
            <h1 className="text-2xl font-black text-amber-400 mb-2">No Authentication</h1>
            <p className="text-slate-400 text-sm max-w-xs mb-6">
              Your account session has expired or been reset. Please register to start fresh with a brand-new ID.
            </p>
            <button 
              onClick={() => { setIsWebUserDeleted(false); setView('auth'); setAuthStep('phone'); }} 
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
            >
              Create New ID / Login 🚀
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: GOOGLE PLAY STORE STYLE LANDING PAGE              */}
        {/* ========================================================= */}
        {view === 'landing' && (
          <div className="flex-1 bg-white text-slate-900 pb-12">
            {/* Official Google Play Top Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M3.6 1.8C3.3 2.1 3.1 2.6 3.1 3.2V20.8C3.1 21.4 3.3 21.9 3.6 22.2L3.7 22.3L13.5 12.5V12.3V12.1L3.7 1.7L3.6 1.8Z" fill="#00C853"/>
                  <path d="M16.8 15.6L13.5 12.3V12.1V11.9L16.8 8.6L16.9 8.7L20.8 10.9C21.9 11.5 21.9 12.7 20.8 13.3L16.9 15.5L16.8 15.6Z" fill="#FFD600"/>
                  <path d="M16.9 15.5L13.5 12.1L3.6 22.2C4.0 22.6 4.6 22.7 5.4 22.2L16.9 15.5Z" fill="#D50000"/>
                  <path d="M16.9 8.7L5.4 2.1C4.6 1.7 4.0 1.8 3.6 2.2L13.5 12.3L16.9 8.7Z" fill="#0091EA"/>
                </svg>
                <span className="font-semibold text-gray-700 text-sm tracking-tight">Google Play</span>
              </div>
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                95
              </div>
            </div>

            {/* App Branding & Icon */}
            <div className="px-5 pt-6 pb-4 flex gap-4 items-start">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-900 p-0.5 shadow-md shrink-0 flex items-center justify-center border border-amber-300/40">
                <img src="/app_logo.png" alt="99xmatka" className="w-full h-full object-cover rounded-[14px]" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-black text-gray-900 leading-tight">99xmatka SATTA</h1>
                <p className="text-xs text-[#00875A] font-bold mt-0.5">99X Games Ltd.</p>
                <p className="text-[11px] text-gray-400 font-medium">Contains ads • In-app purchases</p>
              </div>
            </div>

            {/* Stats Row (Rating, Size, Downloads) */}
            <div className="grid grid-cols-3 px-5 py-3 border-y border-gray-100 text-center">
              <div>
                <div className="flex justify-center items-center gap-1 text-sm font-bold text-gray-900">
                  <span>4.8</span> <Star className="w-3.5 h-3.5 fill-gray-900 text-gray-900" />
                </div>
                <div className="text-[10px] text-gray-500 font-medium mt-0.5">12L+</div>
              </div>
              <div className="border-l border-gray-200">
                <div className="text-sm font-bold text-gray-900">54L+</div>
                <div className="text-[10px] text-gray-500 font-medium mt-0.5">Downloads</div>
              </div>
              <div className="border-l border-gray-200">
                <div className="text-sm font-bold text-gray-900">2017</div>
                <div className="text-[10px] text-gray-500 font-medium mt-0.5">Launch Date</div>
              </div>
            </div>

            {/* 2 Action Buttons (INSTALL APP & PLAY ONLINE) */}
            <div className="px-5 my-5 space-y-3">
              <a 
                href="/99xmatka.apk"
                download="99xmatka.apk"
                onClick={(e) => {
                  e.preventDefault();
                  handleDownloadApk();
                }}
                className="w-full bg-[#00875A] hover:bg-[#00704A] text-white font-black py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm tracking-wider uppercase transition-all text-center cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[3]" /> DOWNLOAD APP
              </a>

              <button 
                onClick={() => {
                  if (user) {
                    setView('webapp');
                  } else {
                    setAuthStep('phone');
                    setMobileNumber('');
                    setOtpInput('');
                    setAuthError('');
                    setView('auth');
                  }
                }}
                className="w-full bg-white hover:bg-gray-50 text-gray-900 font-black py-3.5 rounded-xl border-2 border-[#333333] shadow-sm flex items-center justify-center gap-2 text-sm tracking-wider uppercase transition-all"
              >
                <Play className="w-4 h-4 fill-gray-900 text-gray-900" /> PLAY ONLINE ON WEBSITE
              </button>
            </div>



            {/* About This App Section */}
            <div className="px-5 mt-8 border-t border-gray-100 pt-6">
              {/* Main Headline */}
              <h2 className="text-xl font-black text-gray-900 leading-snug text-center mb-5">
                भारत का पहला ऐसा खाईवाल मटका ऐप जो देता है <span className="text-[#00875A]">8% रेफर कमीशन</span>
              </h2>

              {/* Rate & Commission Points */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-lg">💰</span>
                  <p className="text-base font-bold text-gray-900">रेट <span className="text-[#00875A] text-lg">10 का 900</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎯</span>
                  <p className="text-base font-bold text-gray-900">कमीशन <span className="text-[#00875A] text-lg">8 परसेंट</span></p>
                </div>
              </div>

              {/* Refer Kya Hota Hai Section */}
              <h3 className="text-lg font-black text-gray-900 mb-3">रेफर क्या होता है।</h3>
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 mb-5 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="bg-[#00875A] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    आप अपने दोस्त को ऐप फॉरवर्ड करोगे ओर उसकी आईडी बनवाते वक्त रेफर कोड वाली जगह में अपना रेफर कोड डलवाएंगे तो वो जितने का गेम खेलेगा उसका <strong className="text-[#00875A] font-bold">8 परसेंट कमीशन</strong> आपको मिलेगा आपके <strong>वॉलेट</strong> में सीधा जिसे आप <strong>निकाल भी सकते है</strong> ।
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-[#00875A] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    आपका आईडी <strong>मोबाइल नंबर</strong> ही आपका <strong>रेफर कोड</strong> होगा ।
                  </p>
                </div>
              </div>

              {/* Apple/iPhone Users Info */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-2">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 shrink-0 mt-0.5" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-62.1 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <strong className="text-gray-900">Apple(Iphone) यूजर्स</strong> के लिए हमने इस ऐप को <strong>वेबसाइट</strong> पर भी लॉन्च किया है जिसे आप ऊपर <strong className="text-[#00875A]">Play on Website</strong> पर क्लिक करके वहां प्ले कर सकते है ।
                  </p>
                </div>
              </div>
            </div>

            {/* Data Safety Section */}
            <div className="px-5 mt-8 border-t border-gray-100 pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Data Safety</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                Safety starts with understanding how developers collect and share your data. Data privacy and security practices may vary based on your use, region and age. The developer provided this information and may update it over time.
              </p>

              <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-4">
                <div className="flex gap-3 items-start text-xs text-gray-700">
                  <span className="text-base">🔗</span>
                  <div>
                    <span className="font-bold text-gray-900 block">No data shared with third parties.</span>
                    <span className="text-gray-500">Learn more about how developers declare sharing.</span>
                  </div>
                </div>

                <div className="flex gap-3 items-start text-xs text-gray-700">
                  <span className="text-base">☁️</span>
                  <div>
                    <span className="font-bold text-gray-900 block">No data collected.</span>
                    <span className="text-gray-500">Learn more about how developers declare collection.</span>
                  </div>
                </div>

                <div className="flex gap-3 items-start text-xs text-gray-700">
                  <span className="text-base">🔒</span>
                  <span className="font-bold text-gray-900">Data is encrypted in transit.</span>
                </div>

                <div className="flex gap-3 items-start text-xs text-gray-700">
                  <span className="text-base">🗑️</span>
                  <span className="font-bold text-gray-900">You can request that data be deleted.</span>
                </div>
              </div>
            </div>

            {/* App Reviews Section */}
            <div className="px-5 mt-8 border-t border-gray-100 pt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">App Reviews</h3>

              <div className="flex gap-6 items-center mb-6">
                <div>
                  <div className="text-4xl font-extrabold text-gray-900">4.8</div>
                  <div className="text-[11px] text-gray-500 font-medium">12L+</div>
                  <div className="flex text-[#00C853] text-sm mt-1">
                    ★★★★★
                  </div>
                </div>

                {/* Rating Bar Chart */}
                <div className="flex-1 space-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span>5</span>
                    <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00C853] h-full w-[85%]"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>4</span>
                    <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00C853] h-full w-[70%]"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>3</span>
                    <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00C853] h-full w-[50%]"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>2</span>
                    <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00C853] h-full w-[25%]"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>1</span>
                    <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00C853] h-full w-[10%]"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Items - Randomized on each page load */}
              <div className="space-y-4">
                {(() => {
                  const allReviews = [
                    { name: 'Vishal', color: 'bg-teal-500', date: '19 November 2024', text: "I've been playing this game from many years, this is the best khaiwal app.", stars: 5 },
                    { name: 'Suman', color: 'bg-emerald-400', date: '22 November 2024', text: 'Ye khaiwal app meri fav hai, isse acchi app mujhe aaj tak nahi mili, time pe payout milta hai.', stars: 5 },
                    { name: 'Rohit', color: 'bg-blue-500', date: '3 December 2024', text: 'Bahut badhiya app hai, rate bhi accha milta hai 10 ka 900, aur withdrawal bhi fast hota hai.', stars: 5 },
                    { name: 'Amit', color: 'bg-purple-500', date: '15 January 2025', text: 'Mera dost ne recommend kiya tha, tab se khel raha hoon. Commission bhi milta hai refer ka. Best app!', stars: 5 },
                    { name: 'Priya', color: 'bg-pink-500', date: '8 February 2025', text: 'Customer support bahut accha hai, turant reply aata hai. Paise bhi time pe mil jaate hain.', stars: 5 },
                    { name: 'Rajesh', color: 'bg-orange-500', date: '28 December 2024', text: 'Main 2 saal se use kar raha hoon, kabhi koi problem nahi aayi. Trustworthy app hai ye.', stars: 5 },
                    { name: 'Deepak', color: 'bg-red-500', date: '5 March 2025', text: 'Sabse acchi baat ye hai ki 8% commission milta hai refer karne pe, bahut faayda hota hai.', stars: 5 },
                    { name: 'Manish', color: 'bg-indigo-500', date: '12 January 2025', text: 'Pehle doosri app use karta tha par yahan rate bahut accha hai. Ab sirf yahi use karta hoon.', stars: 4 },
                    { name: 'Sunil', color: 'bg-cyan-500', date: '20 February 2025', text: 'Very good app. Fast deposit and withdrawal. 10 ka 900 rate milta hai, best in market.', stars: 5 },
                    { name: 'Vikram', color: 'bg-amber-600', date: '1 April 2025', text: 'App ka interface bahut simple hai, koi bhi asaani se samajh sakta hai. Maza aa gaya!', stars: 5 },
                    { name: 'Ravi', color: 'bg-lime-600', date: '18 March 2025', text: 'Withdrawal request diya aur 10 minute mein paisa aa gaya. Bahut fast service hai.', stars: 5 },
                    { name: 'Ankur', color: 'bg-rose-500', date: '7 April 2025', text: 'Maine apne 5 dost ko refer kiya hai, har mahine accha commission aa jaata hai wallet mein.', stars: 5 },
                    { name: 'Gaurav', color: 'bg-violet-500', date: '25 January 2025', text: 'Bharat ki sabse acchi matka app hai ye. Rate, service, support sab top class hai.', stars: 5 },
                    { name: 'Nikhil', color: 'bg-sky-500', date: '14 February 2025', text: 'Website pe bhi khel sakte hain, iPhone walo ke liye bahut accha feature hai ye.', stars: 4 },
                    { name: 'Arun', color: 'bg-green-600', date: '9 March 2025', text: 'Trusted app hai, 1 saal se use kar raha hoon. Kabhi payment mein koi issue nahi aaya.', stars: 5 },
                    { name: 'Sachin', color: 'bg-yellow-600', date: '30 November 2024', text: 'Best khaiwal app in India. Customer care 24/7 available rehta hai, bahut helpful hain.', stars: 5 },
                    { name: 'Pankaj', color: 'bg-fuchsia-500', date: '22 March 2025', text: 'Deposit karte hi turant balance update ho jaata hai. No waiting, instant process.', stars: 5 },
                    { name: 'Karan', color: 'bg-stone-500', date: '11 April 2025', text: 'Meri family mein sab log ye app use karte hain. Reliable aur safe hai bilkul.', stars: 5 },
                    { name: 'Mohit', color: 'bg-teal-600', date: '2 May 2025', text: 'Bahut din se dhundh raha tha ek acchi matka app, finally mil gayi. Sab kuch perfect hai.', stars: 5 },
                    { name: 'Harsh', color: 'bg-blue-600', date: '19 April 2025', text: 'Refer karke accha paisa kama raha hoon. 8% commission sach mein milta hai, tested hai.', stars: 5 },
                  ];
                  const seed = Math.floor(Date.now() / 60000);
                  const shuffled = [...allReviews].sort((a, b) => {
                    const ha = ((seed * 31 + a.name.charCodeAt(0)) % 997);
                    const hb = ((seed * 31 + b.name.charCodeAt(0)) % 997);
                    return ha - hb;
                  });
                  const picked = shuffled.slice(0, 2);
                  return picked.map((r, i) => (
                    <div key={i} className="border-b border-gray-100 pb-4">
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className={`w-8 h-8 rounded-full ${r.color} text-white font-bold flex items-center justify-center text-xs`}>{r.name[0]}</div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-900">{r.name}</h4>
                          <div className="flex text-[#00C853] text-xs">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)} <span className="text-[10px] text-gray-400 ml-2">{r.date}</span></div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">{r.text}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Customer Support Footer Card */}
            <div className="px-5 mt-8">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-gray-900">Customer Support:</h4>
                <div className="text-xs text-gray-700 space-y-1.5">
                  <p className="flex items-center gap-2">
                    <span>📞</span> Contact: <a href={`tel:${whatsappCallNumber || whatsappNumber}`} className="text-blue-600 font-bold underline">{whatsappCallNumber || whatsappNumber}</a>
                  </p>
                  <p className="flex items-center gap-2">
                    <span>💬</span> WhatsApp: <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline">{whatsappNumber}</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: AUTHENTICATION FLOW (Same as Mobile App!)        */}
        {/* ========================================================= */}
        {view === 'auth' && (
          <div className="flex-1 bg-[#0F172A] p-6 flex flex-col justify-between">
            <div>
              {/* Back to Landing Header */}
              <button onClick={() => setView('landing')} className="flex items-center gap-2 text-xs font-bold text-[#94A3B8] mb-6">
                <ArrowLeft className="w-4 h-4" /> Back to Home
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-[#F3D079] via-[#D97706] to-[#78350F] rounded-2xl p-1 mx-auto shadow-lg flex items-center justify-center border border-[#F3D079]/50 mb-3">
                  <span className="text-2xl">👑</span>
                </div>
                <h2 className="text-2xl font-black text-[#FFE485]">99xmatka</h2>
                <p className="text-xs text-gray-400 mt-1">आपका भरोसा, हमारी पहचान</p>
              </div>

              {authError && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded-xl text-xs font-bold mb-4 text-center">
                  {authError}
                </div>
              )}

              {otpSuccessMessage && !authError && (
                <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 p-3 rounded-xl text-xs font-bold mb-4 text-center">
                  ✅ {otpSuccessMessage}
                </div>
              )}

              {/* STEP 1: Phone Number */}
              {authStep === 'phone' && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Mobile Number</label>
                    <div className="flex bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
                      <span className="px-3.5 py-3 text-sm font-bold text-gray-400 border-r border-[#334155] bg-[#0F172A] flex items-center">+91</span>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="Enter 10 digit number"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-transparent p-3 text-sm text-white focus:outline-none font-mono"
                        disabled={isSendingOtp}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSendingOtp}
                    className="w-full bg-[#00C853] hover:bg-[#00B248] disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-lg text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                  >
                    {isSendingOtp ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        SENDING OTP...
                      </>
                    ) : (
                      'GET OTP ➔'
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: 4-Digit OTP */}
              {authStep === 'otp' && (
                <div className="space-y-6 text-center">
                  <div>
                    <h3 className="text-lg font-bold text-white">Enter OTP</h3>
                    <p className="text-xs text-gray-400 mt-1">Sent to <strong className="text-white">+91 {mobileNumber}</strong></p>
                  </div>

                  <div className="relative flex justify-center gap-3 my-4">
                    <input
                      type="tel"
                      maxLength={4}
                      autoFocus
                      disabled={isVerifyingOtp}
                      value={otpInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setOtpInput(val);
                        handleOtpSubmit(val);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 disabled:cursor-not-allowed"
                    />
                    {[0, 1, 2, 3].map((idx) => (
                      <div key={idx} className={`w-12 h-14 bg-[#1E293B] border-2 ${isVerifyingOtp ? 'border-emerald-500 animate-pulse' : 'border-[#F3D079]'} rounded-xl flex items-center justify-center text-xl font-bold font-mono text-[#FFE485]`}>
                        {otpInput[idx] || ''}
                      </div>
                    ))}
                  </div>

                  {isVerifyingOtp && (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-400">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                      Verifying code...
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button 
                      onClick={() => { setAuthStep('phone'); setAuthError(''); setOtpSuccessMessage(''); }} 
                      className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      ← Change Mobile
                    </button>

                    {resendTimer > 0 ? (
                      <span className="text-xs text-gray-400 font-medium">
                        Resend in <strong className="text-[#FFE485] font-mono">{resendTimer}s</strong>
                      </span>
                    ) : (
                      <button 
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isSendingOtp}
                        className="text-xs text-[#00C853] hover:text-[#00E676] font-bold"
                      >
                        {isSendingOtp ? 'Sending...' : 'Resend OTP ⟳'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Register Details */}
              {authStep === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Full Name</label>
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full bg-[#1E293B] border border-[#334155] rounded-xl p-3 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Referral Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="Enter referrer mobile number (e.g. 7206561420)"
                      value={referralCodeInput}
                      onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                      className="w-full bg-[#1E293B] border border-[#334155] rounded-xl p-3 text-sm text-[#FFE485] font-mono focus:outline-none uppercase"
                    />
                  </div>

                  <button type="submit" className="w-full bg-[#00C853] hover:bg-[#00B248] text-white font-black py-3.5 rounded-xl shadow-lg text-sm tracking-wider uppercase transition-all">
                    COMPLETE REGISTRATION 🚀
                  </button>
                </form>
              )}
            </div>

            <div className="text-center text-xs text-gray-500 py-4">
              By continuing you agree to 99xmatka Terms & Conditions
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: WEB APP PLAYER PORTAL (100% Mobile App Replica!)   */}
        {/* ========================================================= */}
        {view === 'webapp' && (
          <div className="flex-1 bg-[#090D16] text-white flex flex-col pb-20 min-h-screen">
            {/* SIDE MENU DRAWER OVERLAY & PANEL */}
            {isSideMenuOpen && (
              <div className="fixed inset-0 z-50 flex">
                {/* Dark Backdrop Overlay */}
                <div 
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsSideMenuOpen(false)}
                />

                {/* Left Side Drawer */}
                <div className="relative w-80 max-w-[85vw] bg-[#0F172A] border-r border-gray-800 h-full flex flex-col z-50 shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-300">
                  {/* Drawer Header (Clickable Profile) */}
                  <div 
                    onClick={() => {
                      setShowProfileModal(true);
                      setIsSideMenuOpen(false);
                    }}
                    className="p-5 bg-gradient-to-r from-[#1E293B] to-[#0F172A] border-b border-gray-800 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00C853] to-[#00897B] flex items-center justify-center text-xl font-bold text-white shadow-lg border border-emerald-400/30">
                        👑
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">{user?.name || 'Player'}</h3>
                        <p className="text-[11px] text-gray-400 font-mono">+91 {user?.mobile || '9999999999'}</p>
                        <div className="mt-1 inline-flex items-center gap-1 bg-[#00C853]/15 border border-[#00C853]/40 px-2 py-0.5 rounded-full text-[10px] font-bold text-[#00C853]">
                          💵 ₹{user?.balance ? user.balance.toFixed(2) : '0.00'}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSideMenuOpen(false);
                      }}
                      className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Drawer Menu Items */}
                  <div className="p-4 space-y-1.5 flex-1">
                    <button
                      onClick={() => {
                        setActiveWebTab('home');
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-gray-200 hover:bg-[#1E293B] hover:text-white transition-all text-left"
                    >
                      <span className="text-base">🏠</span> Home
                    </button>

                    <button
                      onClick={() => {
                        setActiveWebTab('charts');
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-gray-200 hover:bg-[#1E293B] hover:text-white transition-all text-left"
                    >
                      <span className="text-base">📊</span> Charts & Results
                    </button>

                    <button
                      onClick={() => {
                        setActiveWebTab('mybets');
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-gray-200 hover:bg-[#1E293B] hover:text-white transition-all text-left"
                    >
                      <span className="text-base">📜</span> My Bet History
                    </button>

                    <div className="my-2 border-t border-gray-800/80" />

                    <button
                      onClick={() => {
                        setShowDepositModal(true);
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-[#00C853] hover:bg-[#00C853]/10 transition-all text-left"
                    >
                      <span className="text-base">💵</span> Add Cash (Deposit)
                    </button>

                    <button
                      onClick={() => {
                        setShowWithdrawModal(true);
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-[#F3D079] hover:bg-[#F3D079]/10 transition-all text-left"
                    >
                      <span className="text-base">🏦</span> Withdraw Cash
                    </button>

                    <div className="my-2 border-t border-gray-800/80" />

                    <button
                      onClick={() => {
                        setShowReferralModal(true);
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-[#FFE485] hover:bg-[#F3D079]/10 transition-all text-left"
                    >
                      <span className="text-base">🎁</span> Refer & Earn (Lifetime Commission)
                    </button>

                    <a
                      href={`https://wa.me/${whatsappNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setIsSideMenuOpen(false)}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-gray-200 hover:bg-[#1E293B] hover:text-white transition-all text-left"
                    >
                      <span className="text-base">💬</span> Customer Support
                    </a>

                    <button
                      onClick={() => {
                        setShowRulesModal(true);
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-gray-200 hover:bg-[#1E293B] hover:text-white transition-all text-left"
                    >
                      <span className="text-base">📋</span> Rules & Rates
                    </button>

                    <button
                      onClick={() => {
                        handleDownloadApk();
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all text-left"
                    >
                      <span className="text-base">📱</span> Download Android App (Latest)
                    </button>

                    <button
                      onClick={() => {
                        setUser(null);
                        setMyBetsList([]);
                        localStorage.removeItem('99x_web_user');
                        localStorage.removeItem('99x_web_view');
                        localStorage.removeItem('99x_web_tab');
                        localStorage.removeItem('99x_selected_game');
                        localStorage.removeItem('99x_my_bets');
                        setAuthStep('phone');
                        setMobileNumber('');
                        setOtpInput('');
                        setAuthError('');
                        setActiveWebTab('home');
                        setSelectedGameForBetting(null);
                        setView('landing');
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all text-left mt-4"
                    >
                      <span className="text-base">🚪</span> Logout
                    </button>
                  </div>

                  {/* Drawer Footer */}
                  <div className="p-4 border-t border-gray-800 text-center text-[10px] text-gray-500">
                    99xmatka v2.4 · 100% Safe & Secure
                  </div>
                </div>
              </div>
            )}

            {/* Top Header Bar */}
            <div className="px-4 py-3 bg-[#0F172A]/90 backdrop-blur-md border-b border-gray-800 flex justify-between items-center sticky top-0 z-20 shadow-md">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsSideMenuOpen(true)}
                  className="text-gray-300 hover:text-white p-1"
                >
                  <div className="space-y-1">
                    <span className="block w-5 h-0.5 bg-white rounded-full"></span>
                    <span className="block w-5 h-0.5 bg-white rounded-full"></span>
                    <span className="block w-5 h-0.5 bg-white rounded-full"></span>
                  </div>
                </button>

                {/* 100% Matching Crown Logo & Brand Title (Matching Mockup media_1789486150552.png) */}
                <div className="flex items-center gap-1.5">
                  <svg className="w-8 h-8 fill-[#F5D77F] filter drop-shadow-[0_0_6px_rgba(245,215,127,0.6)] shrink-0" viewBox="0 0 24 24">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                  </svg>
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-0.5 leading-none">
                      <span className="text-base font-black text-[#F5D77F] tracking-tight">95x</span>
                      <span className="text-base font-black text-white tracking-tight">MATKA</span>
                    </div>
                    <span className="text-[7.5px] font-black text-[#F5D77F] tracking-[0.18em] uppercase mt-0.5">TRUST • FAST • WIN</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Gold Wallet Balance Pill with + Button */}
                <button 
                  onClick={() => setShowWalletModal(true)}
                  className="flex items-center gap-1.5 bg-[#121A29] border border-[#D4AF37] text-white pl-2.5 pr-1 py-1 rounded-full text-xs font-bold font-mono shadow-[0_0_12px_rgba(212,175,55,0.25)] hover:bg-[#1E2A3C] transition-all"
                >
                  <span className="text-xs">👛</span>
                  <span className="font-mono font-black text-white text-xs whitespace-nowrap">₹{user?.balance ? user.balance.toFixed(2) : '0.00'}</span>
                  <span className="w-5 h-5 rounded-full bg-gradient-to-r from-[#FFE485] to-[#D4AF37] text-slate-950 flex items-center justify-center text-xs font-black ml-0.5 shadow">+</span>
                </button>
              </div>
            </div>



            {/* TAB CONTENT: HOME (Hero Banner, Banners, Live Games & Results - Matching Android App!) */}
            {activeWebTab === 'home' && (
              <>
                {/* Horizontal Market Selector Row */}
                <div className="px-3.5 py-2">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {[
                      'Shiv Parwati',
                      'Delhi Bazar',
                      'Dubai Market',
                      'Shree Ganesh',
                      'Faridabad',
                      'Ghaziabad',
                      'Gali',
                      'Desawar'
                    ].map((mName, idx) => {
                      const mIcon = getGameIcon(mName);
                      const isSelected = selectedGameForBetting === mName || (idx === 0 && !selectedGameForBetting);
                      return (
                        <button
                          key={mName}
                          onClick={() => {
                            setSelectedDetailGame(mName);
                          }}
                          className={`min-w-[82px] flex flex-col items-center flex-shrink-0 rounded-2xl py-2.5 px-2 transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-gradient-to-b from-[#1F293D] to-[#0D121F] border-2 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]' 
                              : 'bg-[#101622] border border-[#D4AF37]/30 hover:border-[#D4AF37]/60'
                          }`}
                        >
                          <span className="text-2xl drop-shadow-md">{mIcon}</span>
                          <span className="text-[10px] font-bold text-white mt-1.5 whitespace-nowrap tracking-tight w-full text-center">
                            {mName}
                          </span>
                          <span className={`w-5 h-0.5 rounded-full mt-1.5 ${isSelected ? 'bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]' : 'bg-[#D4AF37]/60'}`}></span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Auto-Sliding Hero Banner Carousel (Connected to Admin Panel Banners Page) */}
                {(() => {
                  const currentSlide = webBanners.length > 0 ? webBanners[webBannerIndex % webBanners.length] : null;
                  const slideTitle = currentSlide?.name || currentSlide?.title || globalBannerConfig?.title || '99xmatka';
                  const slideSubtitle = currentSlide?.subtitle || globalBannerConfig?.subtitle || "INDIA'S MOST TRUSTED";
                  const rawImg = getValidBannerImg(currentSlide, globalBannerConfig, bannerConfig);
                  const slideImgSrc = formatBannerImageSrc(rawImg);
                  const slideLink = currentSlide?.link && !currentSlide.link.startsWith('data:') ? currentSlide.link : null;
                  const dotsCount = webBanners.length > 0 ? webBanners.length : 3;

                  // If admin uploaded a full image banner (base64, remote URL, or custom image file)
                  const isFullCustomImage = slideImgSrc.startsWith('data:image') || 
                    (slideImgSrc.startsWith('http') && !slideImgSrc.includes('logo')) ||
                    (slideImgSrc.startsWith('/') && slideImgSrc !== '/app_logo.png');

                  if (isFullCustomImage) {
                    return (
                      <div className="px-3.5 mb-3">
                        <div 
                          onClick={() => {
                            if (slideLink) window.open(slideLink, '_blank');
                          }}
                          className={`relative overflow-hidden rounded-2xl border-2 border-[#D4AF37]/80 shadow-[0_0_20px_rgba(212,175,55,0.25)] bg-[#0E131E] transition-all duration-500 ${slideLink ? 'cursor-pointer' : ''}`}
                        >
                          <img 
                            src={slideImgSrc} 
                            alt={slideTitle} 
                            className="w-full h-auto max-h-[220px] object-cover rounded-2xl block" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/app_logo.png';
                            }}
                          />
                          
                          {/* Dynamic Dots Carousel Overlay at bottom right */}
                          {dotsCount > 1 && (
                            <div className="absolute bottom-2 right-3 flex gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20 z-10">
                              {Array.from({ length: dotsCount }).map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWebBannerIndex(i);
                                  }}
                                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                    i === (webBannerIndex % dotsCount)
                                      ? 'bg-[#D4AF37] w-4'
                                      : 'bg-gray-400 w-1.5 hover:bg-white'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="px-3.5 mb-3">
                      <div className="relative overflow-hidden rounded-2xl border-2 border-[#D4AF37]/80 bg-gradient-to-br from-[#1E2638] via-[#0E131E] to-[#1A2130] p-4 shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all duration-500">
                        <div className="flex justify-between items-center gap-2">
                          <div className="text-left space-y-1 max-w-[62%]">
                            <p className="text-[9px] font-extrabold text-[#D4AF37] tracking-[0.2em] uppercase line-clamp-1">
                              {slideSubtitle}
                            </p>
                            <h3 className="text-2.5xl font-black bg-gradient-to-r from-[#FFF5D0] via-[#F5D77F] to-[#D4AF37] bg-clip-text text-transparent tracking-wide leading-tight line-clamp-1">
                              {slideTitle}
                            </h3>
                            <p className="text-[8.5px] font-extrabold text-gray-300 tracking-wider">
                              FAST • SECURE • HIGH PAYOUTS
                            </p>
                            
                            <div className="inline-block bg-[#D4AF37]/15 border border-[#D4AF37] px-2.5 py-0.5 rounded-full text-[8.5px] font-extrabold text-[#F5D77F] mt-1.5 shadow">
                              INDIA KA SABSE PEHLA KHAIWAL
                            </div>

                            <div className="pt-2">
                              <button
                                onClick={() => {
                                  if (slideLink) {
                                    window.open(slideLink, '_blank');
                                  } else {
                                    setActiveWebTab('home');
                                  }
                                }}
                                className="bg-gradient-to-r from-[#FFE485] via-[#D4AF37] to-[#B8860B] hover:from-[#F5D77F] hover:to-[#997A15] text-slate-950 font-black px-4.5 py-2 rounded-full text-xs uppercase tracking-wider shadow-[0_4px_12px_rgba(212,175,55,0.4)] flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                              >
                                <span>PLAY NOW</span>
                                <span className="text-sm">➔</span>
                              </button>
                            </div>
                          </div>

                          {/* 3D Crown / Custom Admin Graphic Centerpiece */}
                          <div className="flex flex-col items-center shrink-0">
                            <div className="relative w-24 h-24 flex items-center justify-center">
                              <img 
                                src={slideImgSrc} 
                                alt="Banner Graphic" 
                                className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.6)] rounded-xl" 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/app_logo.png';
                                }}
                              />
                            </div>
                            <span className="text-[8.5px] font-black text-[#F5D77F] tracking-widest text-center mt-0.5 uppercase line-clamp-1 max-w-[90px]">
                              {currentSlide?.name ? currentSlide.name : 'PLAY BIG WIN BIGGER'}
                            </span>
                            {/* Interactive Carousel Dots */}
                            <div className="flex gap-1.5 mt-1.5">
                              {Array.from({ length: dotsCount }).map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setWebBannerIndex(i)}
                                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                    i === (webBannerIndex % dotsCount)
                                      ? 'bg-[#D4AF37] w-4'
                                      : 'bg-gray-600 w-1.5 hover:bg-gray-400'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3 Trust Badges Bar (100% Copy of Mockup media_1789471623091.png) */}
                <div className="px-3.5 mb-3 grid grid-cols-3 gap-1 text-[9px]">
                  <div className="flex items-center gap-1.5 bg-[#0F1624] border border-[#D4AF37]/30 p-2 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-[#182234] border border-[#D4AF37]/60 flex items-center justify-center text-xs shrink-0">🛡️</div>
                    <div className="text-left">
                      <p className="font-black text-white leading-tight">100% SECURE</p>
                      <p className="text-gray-400 text-[7.5px]">Safe & Trusted</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#0F1624] border border-[#D4AF37]/30 p-2 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-[#182234] border border-[#D4AF37]/60 flex items-center justify-center text-xs shrink-0">⚡</div>
                    <div className="text-left">
                      <p className="font-black text-white leading-tight">INSTANT RESULT</p>
                      <p className="text-gray-400 text-[7.5px]">Real-Time Updates</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#0F1624] border border-[#D4AF37]/30 p-2 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-[#182234] border border-[#D4AF37]/60 flex items-center justify-center text-xs shrink-0">🎧</div>
                    <div className="text-left">
                      <p className="font-black text-white leading-tight">24x7 SUPPORT</p>
                      <p className="text-gray-400 text-[7.5px]">Always With You</p>
                    </div>
                  </div>
                </div>

                {/* 100% Gold & Black Install Our App Banner (Website Only) */}
                <div className="px-3.5 mb-3">
                  <div 
                    onClick={handleDownloadApk}
                    className="bg-gradient-to-r from-[#172033] via-[#0E131E] to-[#0A0E1A] border border-[#F5D77F]/60 rounded-2xl p-3 flex justify-between items-center shadow-[0_0_15px_rgba(212,175,55,0.25)] hover:border-[#F5D77F] cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FFE599]/25 via-[#D4AF37]/30 to-[#8C6D13]/25 border border-[#F5D77F]/60 flex items-center justify-center text-[#F5D77F] text-base shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(212,175,55,0.3)]">
                        📱
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-white tracking-wide uppercase">INSTALL OUR APP</p>
                        <p className="text-[10px] font-semibold text-[#F5D77F]/90">Get fast & secure mobile gaming experience</p>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#182234] border border-[#F5D77F]/50 text-[#F5D77F] flex items-center justify-center text-xs font-bold shrink-0 group-hover:translate-x-0.5 transition-transform shadow-[0_0_8px_rgba(212,175,55,0.2)]">
                      ➔
                    </div>
                  </div>
                </div>

                {/* 100% Gold & Black Khaiwal Partner Card */}
                <div className="px-3.5 mb-4">
                  {user?.is_khaiwal ? (
                    <button
                      type="button"
                      onClick={() => setShowKhaiwalModal(true)}
                      className="bg-[#0F1624] border border-[#D4AF37]/40 rounded-2xl p-3 flex justify-between items-center shadow-lg hover:border-[#D4AF37] transition-all group w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#182234] border border-[#F5D77F]/50 flex items-center justify-center text-[#F5D77F] text-sm shrink-0">🤝</div>
                        <div className="text-left">
                          <p className="text-[8px] font-extrabold text-[#F5D77F] tracking-wider uppercase">KHAIWAL DASHBOARD</p>
                          <p className="text-xs font-black text-white">You are a Khaiwal</p>
                          <p className="text-[8px] font-medium text-gray-400 truncate">Manage Players • Track Commission</p>
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#182234] border border-[#D4AF37]/40 text-[#F5D77F] flex items-center justify-center text-[10px] font-bold shrink-0">❯</div>
                    </button>
                  ) : (
                    <a
                      href={`https://wa.me/${whatsappNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#0F1624] border border-[#D4AF37]/40 rounded-2xl p-3 flex justify-between items-center shadow-lg hover:border-[#D4AF37] transition-all group w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#182234] border border-[#F5D77F]/50 flex items-center justify-center text-[#F5D77F] text-sm shrink-0">🤝</div>
                        <div className="text-left">
                          <p className="text-[8px] font-extrabold text-[#F5D77F] tracking-wider uppercase">KHAIWAL DASHBOARD</p>
                          <p className="text-xs font-black text-white">Become a Khaiwal</p>
                          <p className="text-[8px] font-medium text-gray-400 truncate">Contact Admin on WhatsApp</p>
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#182234] border border-[#D4AF37]/40 text-[#F5D77F] flex items-center justify-center text-[10px] font-bold shrink-0">❯</div>
                    </a>
                  )}
                </div>
              </>
            )}

            {/* TAB CONTENT: HOME (100% Strictly Separated Live Games & Results - Matching Android App!) */}
            {activeWebTab === 'home' && (() => {
              const ALL_GAMES = ["Shiv Parwati", "Delhi Bazar", "Dubai Market", "Shree Ganesh", "Faridabad", "Ghaziabad", "Gali", "Desawar"];
              
              const liveGames = ALL_GAMES.filter((gName) => isGameBettingOpen(gName, gameSchedules[gName]));
              const resultGames = ALL_GAMES.filter((gName) => !isGameBettingOpen(gName, gameSchedules[gName]));

              return (
                <div className="px-4 space-y-6">
                  {/* SECTION 1: LIVE GAMES (Only games currently OPEN for betting!) */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-extrabold text-white tracking-wide mb-2 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-ping"></span>
                      Live Games
                    </h3>

                    <div className="space-y-3">
                      {liveGames.length === 0 ? (
                        <div className="text-center py-6 bg-[#121927] rounded-2xl border border-gray-800 text-gray-400 text-xs font-semibold">
                          No games currently open for betting. Check results below!
                        </div>
                      ) : (
                        liveGames.map((gameName) => {
                          const sched = gameSchedules[gameName] || DEFAULT_SCHEDULES[gameName];
                          const remainingMins = getRemainingMinutesToClose(gameName, sched);
                          const isUrgent = remainingMins > 0 && remainingMins <= 30;

                          const iconEmoji = getGameIcon(gameName);

                          const playerCount = livePlayersMap[gameName] || livePlayersMap[gameName === 'Shree Ganesh' ? 'Shri Ganesh' : (gameName === 'Desawar' ? 'Disawer' : gameName)] || 487550;

                          return (
                            <div 
                              key={`live_${gameName}`}
                              className="bg-[#121927] p-4 rounded-2xl border border-[#D4AF37]/30 shadow-xl flex justify-between items-center transition-all hover:border-[#D4AF37]/60"
                            >
                              <div className="flex items-center gap-3">
                                {/* 3D Emblem Badge Box */}
                                <div className="w-12 h-12 bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#D4AF37]/60 rounded-xl flex items-center justify-center text-2xl shadow-inner shrink-0">
                                  {iconEmoji}
                                </div>

                                <div>
                                  <h4 className="text-base font-bold text-white">{gameName}</h4>
                                  <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                                    {playerCount.toLocaleString()} people are playing
                                  </p>
                                  <div className="mt-1.5 flex items-center gap-2">
                                    {isUrgent ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/50 text-[10px] font-extrabold text-[#F59E0B] uppercase tracking-wider">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse"></span>
                                        ⏰ {remainingMins} MINS LEFT
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#F5D77F]/50 text-[10px] font-extrabold text-[#F5D77F] uppercase tracking-wider">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#F5D77F] animate-ping"></span>
                                        BETTING OPEN
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Button: PLAY ➔ (100% Gold & Black Theme) */}
                              <button
                                onClick={() => {
                                  setSelectedGameForBetting(gameName);
                                  setBetMessage('');
                                }}
                                className="bg-gradient-to-r from-[#FFE599] via-[#D4AF37] to-[#8C6D13] hover:brightness-110 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(212,175,55,0.4)] flex items-center gap-1 shrink-0 transition-all active:scale-95 cursor-pointer"
                              >
                                PLAY ➔
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* SECTION 2: RESULTS (Only closed or declared games!) */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-extrabold text-white tracking-wide mb-2">Results</h3>

                    <div className="space-y-3">
                      {resultGames.length === 0 ? (
                        <div className="text-center py-5 bg-[#121927] rounded-2xl border border-gray-800 text-gray-400 text-xs font-semibold">
                          No closed results yet for today. Live games open above!
                        </div>
                      ) : (
                        resultGames.map((gameName) => {
                          const result = declaredResults[gameName] ?? declaredResults[gameName === 'Desawar' ? 'Disawer' : (gameName === 'Shree Ganesh' ? 'Shri Ganesh' : gameName)];
                          const isDeclared = (result !== undefined && result !== null && String(result) !== '');
                          const sched = gameSchedules[gameName] || DEFAULT_SCHEDULES[gameName];

                          const iconEmoji = getGameIcon(gameName);

                          return (
                            <div 
                              key={`result_${gameName}`}
                              onClick={() => {
                                setSelectedGameForBetting(gameName);
                                setBetMessage('');
                              }}
                              className="bg-[#121927] hover:bg-[#1A2337] p-3.5 rounded-2xl border border-gray-800 shadow-lg flex justify-between items-center cursor-pointer transition-all active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-3">
                                {/* 3D Emblem Badge Box */}
                                <div className="w-12 h-12 bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#D4AF37]/50 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0">
                                  {iconEmoji}
                                </div>

                                <div>
                                  <h4 className="text-sm font-bold text-white">{gameName}</h4>
                                  {isDeclared ? (
                                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Winner Number · <span className="text-[#F5D77F] font-semibold">Result Declared</span></p>
                                  ) : (
                                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                                      Betting Closed · Result at <span className="font-semibold text-gray-300">{sched?.result || sched?.close || 'soon'}</span>
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Right Gold Winner Number Badge Box or Pending Status */}
                              {isDeclared ? (
                                <div className="w-10 h-10 rounded-xl bg-[#0F172A] border border-[#D4AF37]/50 flex items-center justify-center font-mono font-bold text-base text-[#FFE485] shadow-md shrink-0">
                                  {String(result).padStart(2, '0')}
                                </div>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-[10px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                  ⏳ PENDING
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB CONTENT: MY BETS */}
            {activeWebTab === 'mybets' && (
              <div className="px-4 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-center">My Bet History</h3>

                {/* Date Filter Bar */}
                <div className="flex gap-2 justify-center">
                  <button 
                    onClick={() => {
                      setMyBetsDateFilter('today');
                      setMyBetsSelectedDate(new Date().toISOString().split('T')[0]);
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-bold text-xs shadow-md transition-all ${
                      myBetsDateFilter === 'today' ? 'bg-[#EAB308] text-slate-950' : 'bg-[#1E293B] text-gray-300 hover:text-white border border-gray-800'
                    }`}
                  >
                    Today
                  </button>
                  <button 
                    onClick={() => {
                      setMyBetsDateFilter('yesterday');
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      setMyBetsSelectedDate(y.toISOString().split('T')[0]);
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-bold text-xs shadow-md transition-all ${
                      myBetsDateFilter === 'yesterday' ? 'bg-[#EAB308] text-slate-950' : 'bg-[#1E293B] text-gray-300 hover:text-white border border-gray-800'
                    }`}
                  >
                    Yesterday
                  </button>
                  <div 
                    onClick={(e) => {
                      const inp = e.currentTarget.querySelector('input');
                      if (inp) {
                        try { inp.showPicker(); } catch (err) { inp.focus(); inp.click(); }
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-bold text-xs shadow-md cursor-pointer transition-all flex items-center gap-1 relative ${
                      myBetsDateFilter === 'custom' ? 'bg-[#EAB308] text-slate-950' : 'bg-[#1E293B] text-gray-300 hover:text-white border border-gray-800'
                    }`}
                  >
                    <span>📅</span>
                    <span>{myBetsDateFilter === 'custom' ? myBetsSelectedDate : 'Calendar'}</span>
                    <input 
                      type="date"
                      value={myBetsSelectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setMyBetsSelectedDate(e.target.value);
                          setMyBetsDateFilter('custom');
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>

                {/* Permanent Market Columns / Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {['All', 'Shiv Parwati', 'Delhi Bazar', 'Dubai Market', 'Shree Ganesh', 'Faridabad', 'Ghaziabad', 'Gali', 'Desawar'].map((mName) => (
                    <button
                      key={mName}
                      onClick={() => setMyBetsMarketFilter(mName)}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap shadow-sm border transition-all ${
                        myBetsMarketFilter === mName
                          ? 'bg-[#00E676] text-slate-950 border-[#00C853]'
                          : 'bg-[#121927] text-gray-300 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      {mName}
                    </button>
                  ))}
                </div>

                {/* Filtered Bets List */}
                {(() => {
                  const uniqueBets = myBetsList.filter((bet, index, self) => 
                    index === self.findIndex((b) => (
                      (b._id && bet._id && b._id === bet._id) ||
                      (b.id && bet.id && b.id === bet.id) ||
                      (b.game_name === bet.game_name && b.number === bet.number && Math.abs(b.bet_amount - bet.bet_amount) < 0.01 &&
                       Math.abs(new Date(b.created_at || 0).getTime() - new Date(bet.created_at || 0).getTime()) < 30000)
                    ))
                  );

                  // Date Filtering
                  const targetDateStr = myBetsSelectedDate;
                  const dateFiltered = uniqueBets.filter(bet => {
                    if (!targetDateStr) return true;
                    const rawDate = bet.created_at || bet.createdAt || '';
                    if (!rawDate) return true;
                    let bDate = '';
                    try {
                      if (rawDate.includes('T')) {
                        bDate = rawDate.split('T')[0];
                      } else if (rawDate.includes('-')) {
                        bDate = rawDate.split(' ')[0];
                      } else {
                        bDate = new Date(rawDate).toISOString().split('T')[0];
                      }
                    } catch (err) { }
                    return !bDate || bDate === targetDateStr;
                  });

                  // Market Filtering
                  const marketFiltered = dateFiltered.filter(bet => {
                    if (myBetsMarketFilter === 'All') return true;
                    const bGame = (bet.game_name || '').toLowerCase();
                    const mTarget = myBetsMarketFilter.toLowerCase();
                    if (mTarget === 'desawar') return bGame.includes('desawar') || bGame.includes('disawer');
                    if (mTarget === 'shree ganesh') return bGame.includes('shree ganesh') || bGame.includes('shri ganesh');
                    return bGame.includes(mTarget);
                  });

                  if (marketFiltered.length === 0) {
                    return (
                      <div className="text-center text-gray-400 py-10 bg-[#121927] rounded-2xl border border-gray-800 space-y-2">
                        <p className="text-2xl">📜</p>
                        <p className="text-sm font-semibold">No bets found for {myBetsMarketFilter} on {targetDateStr}.</p>
                        <p className="text-xs text-gray-500">Select another date or market column to view bids.</p>
                      </div>
                    );
                  }

                  const groupedMap = new Map<string, any>();
                  marketFiltered.forEach((bet) => {
                    const cleanG = (bet.game_name || '').replace(/ \((Jodi|Crossing|Ander|Bahar)\)/gi, '').trim();
                    const rawDate = bet.created_at || bet.createdAt || '';
                    let datePart = 'today';
                    try {
                      if (rawDate.includes('T')) datePart = rawDate.split('T')[0];
                      else if (rawDate.includes('-')) datePart = rawDate.split(' ')[0];
                    } catch (e) { }

                    const bName = bet.game_name || '';
                    const bTypeUpper = (bet.bet_type || '').toUpperCase();
                    const bCategory = (bName.includes('(Crossing)') || bTypeUpper.includes('CROSS')) ? 'CROSSING' :
                                      (bName.includes('(Ander)') || bTypeUpper.includes('ANDER')) ? 'HAROOF_ANDER' :
                                      (bName.includes('(Bahar)') || bTypeUpper.includes('BAHAR')) ? 'HAROOF_BAHAR' :
                                      (bName.includes('Haroof') || bTypeUpper.includes('HAR')) ? 'HAROOF' : 'JODI';

                    const timeKey = (rawDate && rawDate.includes('T')) ? rawDate.split('.')[0].slice(0, 16) : ((rawDate && rawDate.length >= 16) ? rawDate.slice(0, 16) : rawDate);
                    const key = `${cleanG}_${bCategory}_${timeKey}`;
                    if (!groupedMap.has(key)) {
                      let formattedDateTime = '';
                      if (rawDate) {
                        try {
                          const d = new Date(rawDate);
                          if (!isNaN(d.getTime())) {
                            formattedDateTime = `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                          } else {
                            formattedDateTime = rawDate;
                          }
                        } catch (e) {
                          formattedDateTime = rawDate;
                        }
                      }
                      groupedMap.set(key, {
                        cleanGameName: cleanG,
                        rawGameName: bet.game_name || '',
                        betTypeLabel: bCategory === 'CROSSING' ? 'Crossing Game' :
                                      bCategory === 'HAROOF_ANDER' ? 'Haroof Ander Game' :
                                      bCategory === 'HAROOF_BAHAR' ? 'Haroof Bahar Game' :
                                      bCategory === 'HAROOF' ? 'Haroof Game' : 'Jodi Game',
                        dateStr: formattedDateTime,
                        items: [],
                        totalAmount: 0,
                        totalWin: 0,
                        status: 'pending'
                      });
                    }
                    const group = groupedMap.get(key);
                    group.items.push(bet);
                    group.totalAmount += Number(bet.bet_amount || 0);
                    group.totalWin += Number(bet.win_amount || 0);
                    if (String(bet.status).toLowerCase() === 'won') group.status = 'won';
                    else if (String(bet.status).toLowerCase() === 'lost' && group.status !== 'won') group.status = 'lost';
                  });

                  return Array.from(groupedMap.values()).map((group, idx) => {
                    const isWon = group.status === 'won';
                    const isLost = group.status === 'lost';
                    const statusText = isWon || isLost ? '• Completed' : '• Pending';
                    const statusColor = isWon ? 'text-emerald-400' : isLost ? 'text-red-400' : 'text-amber-400';

                    const sortedItems = [...group.items].sort((a: any, b: any) => {
                      const numA = (a.number === 100 || a.number === 0 || a.number === '100' || a.number === '0') ? 0 : Number(a.number || 0);
                      const numB = (b.number === 100 || b.number === 0 || b.number === '100' || b.number === '0') ? 0 : Number(b.number || 0);
                      return numA - numB;
                    });

                    return (
                      <div key={idx} className="bg-[#16202E] border border-[#263346] rounded-2xl overflow-hidden shadow-lg mb-4">
                        {/* Top Header Bar */}
                        <div className="bg-[#263346] px-4 py-2.5 flex justify-between items-center">
                          <span className="text-sm font-bold text-white">{group.cleanGameName}</span>
                          <span className={`text-xs font-bold ${statusColor}`}>{statusText}</span>
                        </div>

                        {/* Card Content Body */}
                        <div className="p-4 text-center space-y-2">
                          <h4 className="text-lg font-extrabold text-white">{group.cleanGameName}</h4>
                          <p className="text-xs text-gray-400">{group.dateStr || 'September 12, 2026'}</p>
                          <p className="text-sm font-bold text-[#F3D079]">{group.betTypeLabel}</p>
                          <p className="text-xs text-gray-400">Amount placed on the numbers</p>

                          {/* Number Badges Grid (5 Cards per row, no swiping) */}
                          <div className="grid grid-cols-5 gap-2 w-full py-2">
                            {sortedItems.map((item: any, bIdx: number) => {
                              const bType = (item.bet_type || '').toUpperCase();
                              const gName = item.game_name || '';
                              const isAnder = gName.includes('Ander') || bType.includes('ANDER');
                              const isBahar = gName.includes('Bahar') || bType.includes('BAHAR');
                              const isHar = isAnder || isBahar || bType.includes('HAR');

                              const badge = isAnder ? 'A' : isBahar ? 'B' : '';
                              const rawNum = item.number_str || (isHar ? String(item.number) : (String(item.number) === '0' || String(item.number) === '100' ? '00' : String(item.number).padStart(2, '0')));
                              const displayNum = isHar && badge ? `${item.number} (${badge})` : rawNum;

                              return (
                                <div key={bIdx} className="flex flex-col items-center w-full rounded-lg overflow-hidden border border-[#263346]">
                                  <div className="bg-[#0F172A] w-full h-9 flex items-center justify-center text-white font-black text-xs font-mono">
                                    {displayNum}
                                  </div>
                                  <div className="bg-[#F3D079] w-full h-6.5 flex items-center justify-center text-slate-950 font-extrabold text-xs">
                                    ₹{item.bet_amount}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Total Amount Button */}
                          <div className="bg-[#263346] py-3 rounded-xl text-white font-bold text-sm w-full shadow-inner mt-2">
                            Total Amount: ₹{group.totalAmount}
                          </div>

                          {/* Outcome Line */}
                          <p className={`text-xs font-bold pt-1 ${isWon ? 'text-[#00C853]' : 'text-[#F3D079]'}`}>
                            {isWon ? `🎉 Won: +₹${group.totalWin}` : 'No Rewards'}
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* TAB CONTENT: CHARTS (100% Interactive & Working!) */}
            {activeWebTab === 'charts' && (() => {
              const ALL_GAMES = ["Shiv Parwati", "Delhi Bazar", "Dubai Market", "Shree Ganesh", "Faridabad", "Ghaziabad", "Gali", "Desawar"];
              const liveGames = chartFilter === 'today' ? ALL_GAMES.filter((gName) => isGameBettingOpen(gName, gameSchedules[gName])) : [];

              return (
                <div className="px-4 space-y-4">
                  {/* Header Title */}
                  <h3 className="text-base font-bold text-white text-center mb-3">Charts & Results</h3>

                  {/* Date Filter Pills Bar */}
                  <div className="flex gap-2 justify-center mb-4">
                    <button 
                      onClick={() => setChartFilter('today')}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs shadow-md transition-all ${
                        chartFilter === 'today' ? 'bg-[#EAB308] text-slate-950' : 'bg-[#1E293B] text-gray-300 hover:text-white border border-gray-800'
                      }`}
                    >
                      Today
                    </button>
                    <button 
                      onClick={() => setChartFilter('yesterday')}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs shadow-md transition-all ${
                        chartFilter === 'yesterday' ? 'bg-[#EAB308] text-slate-950' : 'bg-[#1E293B] text-gray-300 hover:text-white border border-gray-800'
                      }`}
                    >
                      Yesterday
                    </button>
                    {/* Interactive Calendar Date Picker */}
                    <div 
                      onClick={(e) => {
                        const inp = e.currentTarget.querySelector('input');
                        if (inp) {
                          try {
                            inp.showPicker();
                          } catch (err) {
                            inp.focus();
                            inp.click();
                          }
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer relative ${
                        chartFilter === 'custom' ? 'bg-[#EAB308] text-slate-950 border-[#EAB308]' : 'bg-[#1E293B] border-gray-800 text-gray-300 hover:text-white'
                      }`}
                    >
                      <span>📅</span>
                      <span>{formatChartDateDisplay(selectedChartDate)}</span>
                      <input
                        type="date"
                        min="2025-01-01"
                        value={selectedChartDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedChartDate(e.target.value);
                            setChartFilter('custom');
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full pointer-events-none"
                      />
                    </div>
                  </div>



                  {/* Market Result Cards List */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-extrabold text-white tracking-wide">
                      {chartFilter === 'today' ? 'Today Results & History' : (chartFilter === 'yesterday' ? 'Yesterday Results' : 'Historical Results')}
                    </h4>
                    {ALL_GAMES.map((gameName) => {
                      const result = dateChartResults[gameName] !== undefined 
                        ? dateChartResults[gameName] 
                        : (dateChartResults[gameName === 'Desawar' ? 'Disawer' : gameName] || (chartFilter === 'today' ? declaredResults[gameName] : undefined));

                      const displayNum = (result !== undefined && result !== null && String(result) !== '') ? String(result).padStart(2, '0') : '--';

                      const iconEmoji = getGameIcon(gameName);

                      return (
                        <div 
                          key={gameName}
                          className="bg-[#121927] p-3.5 rounded-2xl border border-gray-800 shadow-lg flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#D4AF37]/60 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0">
                              {iconEmoji}
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-white">{gameName}</h4>
                              <p className="text-[11px] text-gray-400 mt-0.5">Winner Number</p>
                            </div>
                          </div>

                          <div className="w-12 h-10 rounded-xl bg-[#0F172A] border border-[#D4AF37]/50 flex items-center justify-center font-mono font-bold text-base text-[#FFE485] shadow-md shrink-0">
                            {displayNum}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* TAB CONTENT: REFERRAL (Matches in-app tab layout!) */}
            {activeWebTab === 'referral' && (
              <div className="px-4 space-y-4">
                <h3 className="text-base font-bold text-white text-center mb-3">Refer & Earn Rewards</h3>

                {/* DATE FILTER BUTTONS */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      setRefFilterType('all');
                      setRefFilterDate('all');
                      setRefFilterLabel('All Time');
                      fetchWebsiteReferralDetails('all');
                    }}
                    className={`py-2 px-1 text-xs rounded-xl font-bold transition-all border ${
                      refFilterType === 'all'
                        ? 'bg-[#2A374A] border-[#F3D079] text-[#F3D079]'
                        : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    All Time
                  </button>

                  <button
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setRefFilterType('today');
                      setRefFilterDate(todayStr);
                      setRefFilterLabel('Today');
                      fetchWebsiteReferralDetails(todayStr);
                    }}
                    className={`py-2 px-1 text-xs rounded-xl font-bold transition-all border ${
                      refFilterType === 'today'
                        ? 'bg-[#2A374A] border-[#F3D079] text-[#F3D079]'
                        : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    Today
                  </button>

                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      const yestStr = d.toISOString().split('T')[0];
                      setRefFilterType('yesterday');
                      setRefFilterDate(yestStr);
                      setRefFilterLabel('Yesterday');
                      fetchWebsiteReferralDetails(yestStr);
                    }}
                    className={`py-2 px-1 text-xs rounded-xl font-bold transition-all border ${
                      refFilterType === 'yesterday'
                        ? 'bg-[#2A374A] border-[#F3D079] text-[#F3D079]'
                        : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    Yesterday
                  </button>

                  <label
                    className={`py-2 px-1 text-xs rounded-xl font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                      refFilterType === 'custom'
                        ? 'bg-[#2A374A] border-[#F3D079] text-[#F3D079]'
                        : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <span>📅</span>
                    <span className="truncate">{refFilterType === 'custom' ? refFilterLabel : 'Pick'}</span>
                    <input
                      type="date"
                      className="sr-only"
                      onChange={(e) => {
                        if (e.target.value) {
                          const dateVal = e.target.value;
                          const parts = dateVal.split('-');
                          const label = `${parts[2]}/${parts[1]}`;
                          setRefFilterType('custom');
                          setRefFilterDate(dateVal);
                          setRefFilterLabel(label);
                          fetchWebsiteReferralDetails(dateVal);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* CARD 1: TOTAL COMMISSION */}
                <div className="bg-[#1E293B] rounded-2xl shadow-lg border border-[#334155] overflow-hidden">
                  <div className="bg-[#162238] px-4 py-2.5 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🎟️</span>
                      <span className="text-xs font-black tracking-wider uppercase">
                        {refFilterType === 'all' ? 'TOTAL COMMISSION' : `COMMISSION (${refFilterLabel})`}
                      </span>
                    </div>
                    <button 
                      onClick={() => fetchWebsiteReferralDetails(refFilterDate)}
                      className="text-xs hover:rotate-180 transition-transform p-1"
                    >
                      🔄
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="bg-[#0F172A] border-2 border-[#F3D079] rounded-2xl py-4 text-center">
                      <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mb-1">Commission Wallet</p>
                      <span className="text-2xl font-mono font-black text-[#F3D079]">
                        ₹{(user?.commission_balance !== undefined ? user.commission_balance : (referralDetails.totalCommission || 0)).toFixed(2)}/-
                      </span>
                    </div>
                    {/* Transfer Button */}
                    <button
                      onClick={handleCommissionTransfer}
                      disabled={isTransferringCommission || (user?.commission_balance !== undefined ? user.commission_balance : (referralDetails.totalCommission || 0)) <= 0}
                      className="w-full bg-gradient-to-r from-[#F3D079] to-[#F59E0B] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black py-3 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      {isTransferringCommission ? (
                        <><span className="animate-spin">⏳</span> Transferring...</>
                      ) : (
                        <><span>💰</span> Transfer to Main Wallet</>
                      )}
                    </button>
                    {commissionTransferMsg && (
                      <p className={`text-xs font-bold text-center py-2 px-3 rounded-xl ${commissionTransferMsg.startsWith('✅') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {commissionTransferMsg}
                      </p>
                    )}
                  </div>
                </div>

                {/* CARD 2: YOUR REFERRAL CODE */}
                <div className="bg-[#1E293B] rounded-2xl shadow-lg border border-[#334155] overflow-hidden">
                  <div className="bg-[#00873E] px-4 py-2.5 flex items-center gap-2 text-white">
                    <span className="text-sm">🎁</span>
                    <span className="text-xs font-black tracking-wider uppercase">YOUR REFERRAL CODE</span>
                  </div>
                  <div className="p-4 text-center">
                    {(() => {
                      const userRefCode = (referralDetails.referral_code || user?.referral_code || (user?.mobile ? user.mobile.slice(-10) : '7206561420')).replace(/^REF/i, '');
                      const shareText = `Play 99xmatka & Win 95X! 👑\nUse my Referral Code: ${userRefCode} to get bonus balance!\nPlay online: ${window.location.origin}`;
                      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

                      return (
                        <div className="space-y-4">
                          <div className="bg-[#0F172A] border-2 border-[#F3D079] rounded-2xl py-3.5 px-3">
                            <div className="text-xl font-mono font-black text-[#F3D079] tracking-[0.2em] select-all whitespace-nowrap overflow-x-auto">
                              {userRefCode}
                            </div>
                          </div>

                          {/* Side-by-Side Action Buttons */}
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(shareText);
                                setCopiedToast(true);
                                setTimeout(() => setCopiedToast(false), 2500);
                              }}
                              className="bg-[#00873E] hover:bg-[#007033] text-white font-bold py-2.5 px-3 rounded-xl flex justify-center items-center gap-2 text-xs uppercase tracking-wider shadow-sm transition-all"
                            >
                              <span>📋</span>
                              <span>{copiedToast ? 'COPIED!' : 'Copy Code'}</span>
                            </button>

                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-black py-2.5 px-3 rounded-xl flex justify-center items-center gap-2 text-xs uppercase tracking-wider shadow-sm transition-all"
                            >
                              <span>🔀</span>
                              <span>Share</span>
                            </a>
                          </div>

                          {/* Step Process Indicator */}
                          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#334155]">
                            <div className="flex flex-col items-center">
                              <div className="w-7 h-7 rounded-full bg-[#0F172A] border border-[#F3D079] flex items-center justify-center font-black text-xs text-[#F3D079] mb-1">1</div>
                              <span className="text-[10px] font-medium text-[#94A3B8]">Share your code</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="w-7 h-7 rounded-full bg-[#0F172A] border border-[#F3D079] flex items-center justify-center font-black text-xs text-[#F3D079] mb-1">2</div>
                              <span className="text-[10px] font-medium text-[#94A3B8]">They sign up</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="w-7 h-7 rounded-full bg-[#0F172A] border border-[#F3D079] flex items-center justify-center font-black text-xs text-[#F3D079] mb-1">3</div>
                              <span className="text-[10px] font-medium text-[#94A3B8]">You earn</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* CARD 3: TOTAL REFERRALS */}
                <div className="bg-[#1E293B] rounded-2xl shadow-lg border border-[#334155] overflow-hidden">
                  <div className="bg-[#162238] px-4 py-2.5 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">👥</span>
                      <span className="text-xs font-black tracking-wider uppercase">TOTAL REFERRALS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => fetchWebsiteReferralDetails(refFilterDate)}
                        className="bg-[#0F172A] border border-[#334155] text-xs text-[#00C853] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 hover:bg-[#1E293B] transition-all"
                      >
                        <span>🔄</span> Refresh
                      </button>
                      <div className="bg-[#0F172A] border border-[#F3D079] text-[#F3D079] px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1">
                        <span>👤</span>
                        <span>{referralDetails.referralsCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 text-center">
                    {referralDetails.referredUsers.length === 0 ? (
                      <div className="py-4">
                        <div className="text-4xl mb-2">👥</div>
                        <p className="text-sm font-bold text-[#94A3B8]">No referrals yet</p>
                        <p className="text-[11px] text-[#64748B] mt-1">Share your code above to start earning lifetime bet commissions!</p>
                      </div>
                    ) : (
                      <div className="text-left space-y-2.5">
                        {referralDetails.referredUsers.map((ref, idx) => (
                          <div key={idx} className="p-3.5 bg-[#0F172A] rounded-xl border border-[#334155] flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-white text-sm">{ref.name}</p>
                              <p className="text-[#94A3B8] font-mono text-[11px] mt-0.5">{ref.mobile} • {ref.date}</p>
                              <p className="text-[11px] text-[#F3D079] font-semibold mt-1">
                                Bet Commission: ₹{ref.betCommission.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-black text-[#00C853] text-base">+₹{ref.totalEarned.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 100% Pixel-Perfect Luxury Gold Capsule 5-Icon Bottom Navigation Bar (Matching Mockup media_1789481320689.png) */}
            <div className="fixed bottom-3 left-0 right-0 w-full z-50 pointer-events-none px-3">
              <div className="max-w-md mx-auto relative pointer-events-auto rounded-full bg-gradient-to-r from-[#FFE599] via-[#D4AF37] to-[#FFE599] p-[1.5px] shadow-[0_0_25px_rgba(212,175,55,0.4),0_10px_30px_rgba(0,0,0,0.9)]">
                <div className="w-full h-full rounded-full bg-gradient-to-b from-[#141B2A] via-[#0E131E] to-[#06090F] px-2 py-1.5 flex justify-around items-center relative overflow-visible backdrop-blur-xl">
                  
                  {/* HOME TAB */}
                  <button 
                    onClick={() => {
                      setSelectedGameForBetting(null);
                      setActiveWebTab('home');
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                      activeWebTab === 'home' && !selectedGameForBetting 
                        ? 'bg-gradient-to-r from-[#D4AF37]/30 to-[#8C6D13]/20 border border-[#F5D77F]/60 text-[#F5D77F] shadow-[0_0_12px_rgba(212,175,55,0.4)] scale-105' 
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <svg className={`w-5 h-5 ${activeWebTab === 'home' && !selectedGameForBetting ? 'fill-[#F5D77F]' : 'fill-current'}`} viewBox="0 0 24 24">
                      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-wider">HOME</span>
                  </button>

                  {/* CHART TAB */}
                  <button 
                    onClick={() => {
                      setSelectedGameForBetting(null);
                      setActiveWebTab('charts');
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                      activeWebTab === 'charts' 
                        ? 'bg-gradient-to-r from-[#D4AF37]/30 to-[#8C6D13]/20 border border-[#F5D77F]/60 text-[#F5D77F] shadow-[0_0_12px_rgba(212,175,55,0.4)] scale-105' 
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <svg className={`w-5 h-5 ${activeWebTab === 'charts' ? 'fill-[#F5D77F]' : 'fill-current'}`} viewBox="0 0 24 24">
                      <path d="M4 9h4v11H4zm6-5h4v16h-4zm6 8h4v8h-4z"/>
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-wider">CHART</span>
                  </button>

                  {/* CENTER ELEVATED FLOATING GOLD CROWN BUTTON FOR MY BET */}
                  <button 
                    onClick={() => {
                      setSelectedGameForBetting(null);
                      setActiveWebTab('mybets');
                    }}
                    className="relative -top-4 w-13 h-13 rounded-full bg-gradient-to-tr from-[#FFE599] via-[#D4AF37] to-[#8C6D13] p-[2px] shadow-[0_0_25px_rgba(212,175,55,0.8),0_4px_15px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 z-20"
                  >
                    <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1E293B] to-[#0A0E17] flex flex-col items-center justify-center border border-[#FFE485]/60 shadow-inner">
                      <svg className="w-5 h-5 fill-[#F5D77F] filter drop-shadow-[0_0_6px_rgba(245,215,127,0.8)]" viewBox="0 0 24 24">
                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                      </svg>
                      <span className="text-[7.5px] font-black text-[#F5D77F] tracking-tighter leading-none mt-0.5">MY BET</span>
                    </div>
                  </button>

                  {/* CHAT TAB */}
                  <a 
                    href={`https://wa.me/${whatsappNumber}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-wider">CHAT</span>
                  </a>

                  {/* REFER TAB */}
                  <button 
                    onClick={() => {
                      setSelectedGameForBetting(null);
                      setShowReferralModal(true);
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4V8h16v11z"/>
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-wider">REFER</span>
                  </button>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 4: FULL-SCREEN PLAY JODI / BIDDING MATRIX UI         */}
        {/* (100% Exact Copy of matkagold.com/matka/play/jodi/39)     */}
        {/* ========================================================= */}
        {selectedGameForBetting && (
          <div className="fixed inset-0 bg-[#060A12] text-white z-50 flex flex-col justify-between overflow-y-auto">
            {/* Top Dark Header */}
            {/* Top Bar Header (100% Copy of Android App UI) */}
            <div className="bg-[#0F172A] border-b border-gray-800/80 px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setSelectedGameForBetting(null);
                    setBetMessage('');
                  }}
                  className="text-gray-300 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-base font-black text-white tracking-wide">
                  {selectedGameForBetting}
                </h2>
              </div>

              {/* Wallet Badge (Dark Gold / Emerald Pill) */}
              <button 
                onClick={() => setShowDepositModal(true)} 
                className="flex items-center gap-1.5 bg-[#152338] border border-amber-500/30 text-[#F3D079] px-3 py-1 rounded-full text-xs font-mono font-bold shadow-md hover:border-amber-400"
              >
                <span>💳 ₹{user?.balance ? user.balance.toFixed(2) : '0.00'}</span>
                <span className="bg-amber-500/20 text-amber-300 text-xs px-1 rounded font-bold">+</span>
              </button>
            </div>

            {/* Active Khaiwal Bet Mode Sticky Notification Banner */}
            {activeKhaiwalBetPlayer && (
              <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 sticky top-[53px] z-30 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">👑 KHAIWAL BET MODE:</span>
                  <span className="text-white font-extrabold">{activeKhaiwalBetPlayer.name}</span>
                  <span className="text-gray-400">({selectedGameForBetting})</span>
                </div>
                <button
                  onClick={() => {
                    setActiveKhaiwalBetPlayer(null);
                    setShowKhaiwalModal(true);
                  }}
                  className="bg-amber-500 text-black px-2.5 py-0.5 rounded-md font-bold hover:bg-amber-400 transition-all text-[11px]"
                >
                  Done / Exit Khaiwal
                </button>
              </div>
            )}

            {/* Sub-header Underline Category Selector (JODI | PASTE | CROSSING | HAROOF) */}
            <div className="bg-[#0F172A] border-b border-gray-800/60 px-4 py-2 sticky top-[53px] z-20 flex justify-center gap-6 shadow-md">
              {(['Jodi', 'Paste', 'Crossing', 'Haruf'] as const).map((t) => {
                const label = t === 'Haruf' ? 'HAROOF' : t.toUpperCase();
                const isActive = betCategory === t;
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setBetCategory(t);
                      setJodiGrid({});
                    }}
                    className={`text-xs font-black tracking-wider transition-all pb-1.5 ${
                      isActive 
                        ? 'text-amber-400 border-b-2 border-amber-400' 
                        : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Main Bidding Cards Area (100% Copy of Android App Dark Theme Grid) */}
            <div className="p-3.5 flex-1 pb-32 max-w-md mx-auto w-full bg-[#0B101D]">
              {betMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold mb-4 text-center ${
                  betMessage.includes('successfully') ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50' : 'bg-red-950/80 text-red-400 border border-red-500/50'
                }`}>
                  {betMessage}
                </div>
              )}

              {/* Paste / Type Toggle Header Pill & Formats Badge (in Jodi & Paste modes) */}
              {(betCategory === 'Jodi' || betCategory === 'Paste') && (
                <div className="flex justify-between items-center bg-[#152033] p-2 rounded-xl mb-3 border border-gray-800">
                  <div className="flex items-center gap-1.5 bg-[#0F172A] p-1 rounded-lg border border-gray-800">
                    <button
                      onClick={() => setBetCategory('Paste')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        betCategory === 'Paste' ? 'bg-[#00897B] text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Paste
                    </button>
                    <button
                      onClick={() => setBetCategory('Jodi')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        betCategory === 'Jodi' ? 'bg-[#00897B] text-white shadow' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Type
                    </button>
                  </div>

                  <button
                    onClick={() => setShowFormatsModal(true)}
                    className="bg-[#1E293B] hover:bg-[#334155] border border-emerald-500/40 text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <span>Formats 1</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                </div>
              )}

              {/* PASTE TAB: Smart Copy-Paste Betting Engine (Auto-Parser) matching media_1789228099608.png */}
              {betCategory === 'Paste' && (
                <div className="space-y-3">
                  <div className="bg-[#182234] border border-gray-800 p-3 rounded-2xl">
                    <div className="flex gap-2">
                      <textarea
                        rows={6}
                        placeholder={`Paste your bets string here...\n\nExamples:\n12 34 56 @50\n123456789 (50)\n10(50.10)`}
                        value={copyPasteInputText}
                        onChange={(e) => setCopyPasteInputText(e.target.value)}
                        className="flex-1 bg-[#0F172A] border border-gray-800 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 resize-none"
                      />
                      <div className="w-28 flex flex-col justify-between gap-1.5">
                        <button
                          onClick={() => {
                            const parsed = parseCopyPasteText(copyPasteInputText, copyPasteWithPalat);
                            setCopyPasteParsedList(parsed);
                          }}
                          className="w-full bg-[#00897B] hover:bg-[#00796B] text-white font-black py-2.5 rounded-xl text-xs uppercase shadow"
                        >
                          DONE
                        </button>
                        
                        <label className="flex items-center gap-1.5 bg-[#0F172A] border border-gray-800 p-1.5 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyPasteWithPalat}
                            onChange={(e) => setCopyPasteWithPalat(e.target.checked)}
                            className="accent-[#00897B] w-3.5 h-3.5"
                          />
                          <span className="text-[10px] font-bold text-white whitespace-nowrap">With Palat</span>
                        </label>

                        <button
                          onClick={() => {
                            setCopyPasteInputText('');
                            setCopyPasteParsedList([]);
                          }}
                          className="w-full bg-[#E91E63] hover:bg-[#D81B60] text-white font-black py-2.5 rounded-xl text-xs uppercase shadow"
                        >
                          CLEAR
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hindi Notice Card */}
                  <div className="bg-[#162032] border border-[#2E3D56] p-3.5 rounded-2xl space-y-2">
                    <div className="text-[#F3D079] font-black text-xs">📌 जरूरी सूचना:</div>
                    <p className="text-[#CBD5E1] text-[11px] leading-relaxed font-medium">
                      आपके दांव (bet) के पैसे सही तरीके से जुड़ें, इसके लिए नंबरों के आखिरी में अपनी पैसों की मात्रा (amount) नीचे दिए गए तरीकों में से किसी एक तरीके से जरूर लिखें:<br />
                      (पैसे) या [पैसे] या {"{पैसे}"}<br />
                      @पैसे, ₹पैसे, #पैसे, $पैसे, %पैसे, =पैसे<br />
                      intoपैसे, intuपैसे, *पैसे, ×पैसे<br />
                      जैसे: 12 34 56 @20 या 123456789 (50)
                    </p>
                    <div className="text-[#38BDF8] text-[11px] font-bold">
                      ⚠️ एक बार आपके लगाए गये नम्बर चेक करले सही है या नहीं
                    </div>
                  </div>

                  {/* Summary Review Table */}
                  {copyPasteParsedList.length > 0 && (
                    <div className="bg-[#182234] border border-emerald-500/50 p-3 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-400 font-black text-xs">📋 GENERATED JODI BETS ({copyPasteParsedList.length})</span>
                        <span className="text-[#F3D079] font-black text-xs">
                          Total: ₹{copyPasteParsedList.reduce((sum, item) => sum + item.amount, 0)}
                        </span>
                      </div>
                      <div className="border-b border-gray-800" />
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {copyPasteParsedList.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-white">{item.jodi}</span>
                              {item.isPalat && <span className="text-[10px] font-bold text-amber-400">(Palat)</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-emerald-400">₹{item.amount}</span>
                              <button
                                onClick={() => setCopyPasteParsedList(copyPasteParsedList.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:text-red-300 font-bold px-1"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* JODI TAB: 5-Column Grid of 100 Cards (01 - 00) Matching Android App Screenshot! */}
              {betCategory === 'Jodi' && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">JODI MATRIX (01 - 00)</span>
                    <button 
                      onClick={() => setJodiGrid({})} 
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 100 }).map((_, idx) => {
                      const numVal = (idx + 1) % 100;
                      const numStr = String(numVal).padStart(2, '0');
                      const val = jodiGrid[numStr] || '';
                      return (
                        <div 
                          key={numStr}
                          className={`rounded-xl border transition-all p-1.5 flex flex-col items-center justify-between min-h-[58px] ${
                            val ? 'bg-emerald-950/60 border-emerald-500/80 shadow-lg shadow-emerald-950/50' : 'bg-[#182234] border-gray-800/90 hover:border-gray-700'
                          }`}
                        >
                          <span className={`text-xs font-mono font-black ${val ? 'text-emerald-400' : 'text-gray-200'}`}>{numStr}</span>
                          <div className="w-full mt-1 flex items-center justify-center bg-[#0F172A] rounded-lg border border-gray-800 px-1 py-0.5">
                            <span className="text-[9px] text-gray-400 font-bold mr-0.5">₹</span>
                            <input
                              type="number"
                              min="1"
                              placeholder=""
                              value={val}
                              onKeyDown={(e) => {
                                if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              onChange={(e) => {
                                const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                                if (!cleanVal || parseInt(cleanVal) <= 0) {
                                  const newGrid = { ...jodiGrid };
                                  delete newGrid[numStr];
                                  setJodiGrid(newGrid);
                                } else {
                                  setJodiGrid({ ...jodiGrid, [numStr]: cleanVal });
                                }
                              }}
                              className={`w-full text-center text-[11px] font-mono font-bold focus:outline-none bg-transparent ${val ? 'text-emerald-300' : 'text-white'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CROSSING TAB: Auto-Generate Combination Pairs */}
              {betCategory === 'Crossing' && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">CROSSING MATRIX GENERATOR</span>
                    <button 
                      onClick={() => {
                        setCrossingDigits('');
                        setJodiGrid({});
                      }} 
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="bg-[#182234] p-4 rounded-2xl border border-gray-800 space-y-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 uppercase mb-1.5">Enter Crossing Digits (e.g. 1234)</label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="e.g. 123 or 1234"
                        value={crossingDigits}
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                        }}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, '');
                          setCrossingDigits(digits);
                          if (digits.length >= 2) {
                            const newGrid: Record<string, string> = {};
                            const amt = crossingAmount || '10';
                            const chars = digits.split('');
                            chars.forEach(d1 => {
                              chars.forEach(d2 => {
                                if (!crossingWithJoda && d1 === d2) return;
                                newGrid[`${d1}${d2}`] = amt;
                              });
                            });
                            setJodiGrid(newGrid);
                          } else {
                            setJodiGrid({});
                          }
                        }}
                        className="w-full bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-[#00C853]"
                      />
                    </div>

                    {/* JODA ADD TOGGLE SWITCH */}
                    <div className="flex justify-between items-center bg-[#0F172A] p-3 rounded-xl border border-gray-700">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white uppercase">Joda Add</span>
                        <span className="text-[10px] text-gray-400">Include double digit pairs (11, 22, etc.)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextWithJoda = !crossingWithJoda;
                          setCrossingWithJoda(nextWithJoda);
                          if (crossingDigits.length >= 2) {
                            const newGrid: Record<string, string> = {};
                            const amt = crossingAmount || '10';
                            const chars = crossingDigits.split('');
                            chars.forEach(d1 => {
                              chars.forEach(d2 => {
                                if (!nextWithJoda && d1 === d2) return;
                                newGrid[`${d1}${d2}`] = amt;
                              });
                            });
                            setJodiGrid(newGrid);
                          }
                        }}
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                          crossingWithJoda ? 'bg-[#00C853]' : 'bg-gray-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                            crossingWithJoda ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 uppercase mb-1.5">Amount Per Pair (₹)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Enter amount (min ₹1)"
                        value={crossingAmount}
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                        }}
                        onChange={(e) => {
                          const amt = e.target.value.replace(/[^0-9]/g, '');
                          setCrossingAmount(amt);
                          if (crossingDigits.length >= 2 && amt && parseInt(amt) > 0) {
                            const newGrid: Record<string, string> = {};
                            const chars = crossingDigits.split('');
                            chars.forEach(d1 => {
                              chars.forEach(d2 => {
                                if (!crossingWithJoda && d1 === d2) return;
                                newGrid[`${d1}${d2}`] = amt;
                              });
                            });
                            setJodiGrid(newGrid);
                          }
                        }}
                        className="w-full bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-[#00C853]"
                      />
                      <div className="flex gap-2 mt-2">
                        {['10', '50', '100', '500'].map((amt) => (
                          <button
                            type="button"
                            key={amt}
                            onClick={() => {
                              setCrossingAmount(amt);
                              if (crossingDigits.length >= 2) {
                                const newGrid: Record<string, string> = {};
                                const chars = crossingDigits.split('');
                                chars.forEach(d1 => {
                                  chars.forEach(d2 => {
                                    if (!crossingWithJoda && d1 === d2) return;
                                    newGrid[`${d1}${d2}`] = amt;
                                  });
                                });
                                setJodiGrid(newGrid);
                              }
                            }}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-1.5 rounded-lg text-[10px]"
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Display Generated Pair Cards */}
                  {Object.keys(jodiGrid).length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-2 text-xs">
                        <span className="font-bold text-gray-400 uppercase">GENERATED PAIRS ({Object.keys(jodiGrid).length})</span>
                        <span className="font-mono text-emerald-400 font-bold">Total: ₹{Object.values(jodiGrid).reduce((sum, v) => sum + (parseInt(v) || 0), 0)}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {Object.entries(jodiGrid).map(([pair, val]) => (
                          <div 
                            key={pair}
                            className="bg-emerald-950/60 border border-emerald-500/80 rounded-xl p-2 text-center shadow-md flex flex-col items-center justify-between min-h-[58px]"
                          >
                            <span className="text-xs font-mono font-black text-emerald-400">{pair}</span>
                            <span className="text-[10px] font-mono font-bold text-emerald-300">₹{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HARUF TAB: Side-by-Side ANDER & BAHAR Tables (Matching Screenshot!) */}
              {betCategory === 'Haruf' && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">HAROOF BIDDING (A0-A9 & B0-B9)</span>
                    <button onClick={() => setJodiGrid({})} className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline">Clear All</button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* ANDER Column */}
                    <div className="bg-[#182234] border border-gray-800/90 rounded-2xl overflow-hidden p-2">
                      <div className="bg-[#0F172A] py-2 px-3 text-center border-b border-gray-800 rounded-xl mb-2">
                        <h4 className="text-xs font-black text-white tracking-wider uppercase">ANDER</h4>
                      </div>
                      <div className="space-y-1.5">
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const key = `A${idx}`;
                          const val = jodiGrid[key] || '';
                          return (
                            <div 
                              key={key}
                              className={`flex items-center justify-between p-1.5 rounded-xl border transition-all ${
                                val ? 'bg-emerald-950/60 border-emerald-500/80' : 'bg-[#0F172A]/70 border-gray-800'
                              }`}
                            >
                              <span className="text-xs font-black font-mono text-white px-2">{key}</span>
                              <div className="flex items-center bg-[#182234] rounded-lg border border-gray-700/80 px-2 py-1 w-20">
                                <span className="text-[10px] text-gray-400 font-bold mr-1">₹</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={val}
                                  onKeyDown={(e) => {
                                    if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                                  }}
                                  onChange={(e) => {
                                    const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                                    if (!cleanVal || parseInt(cleanVal) <= 0) {
                                      const newGrid = { ...jodiGrid };
                                      delete newGrid[key];
                                      setJodiGrid(newGrid);
                                    } else {
                                      setJodiGrid({ ...jodiGrid, [key]: cleanVal });
                                    }
                                  }}
                                  className={`w-full text-center text-xs font-mono font-bold focus:outline-none bg-transparent ${val ? 'text-emerald-300' : 'text-white'}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* BAHAR Column */}
                    <div className="bg-[#182234] border border-gray-800/90 rounded-2xl overflow-hidden p-2">
                      <div className="bg-[#0F172A] py-2 px-3 text-center border-b border-gray-800 rounded-xl mb-2">
                        <h4 className="text-xs font-black text-white tracking-wider uppercase">BAHAR</h4>
                      </div>
                      <div className="space-y-1.5">
                        {Array.from({ length: 10 }).map((_, idx) => {
                          const key = `B${idx}`;
                          const val = jodiGrid[key] || '';
                          return (
                            <div 
                              key={key}
                              className={`flex items-center justify-between p-1.5 rounded-xl border transition-all ${
                                val ? 'bg-emerald-950/60 border-emerald-500/80' : 'bg-[#0F172A]/70 border-gray-800'
                              }`}
                            >
                              <span className="text-xs font-black font-mono text-white px-2">{key}</span>
                              <div className="flex items-center bg-[#182234] rounded-lg border border-gray-700/80 px-2 py-1 w-20">
                                <span className="text-[10px] text-gray-400 font-bold mr-1">₹</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={val}
                                  onKeyDown={(e) => {
                                    if (['-', '+', 'e', 'E', '.'].includes(e.key)) e.preventDefault();
                                  }}
                                  onChange={(e) => {
                                    const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                                    if (!cleanVal || parseInt(cleanVal) <= 0) {
                                      const newGrid = { ...jodiGrid };
                                      delete newGrid[key];
                                      setJodiGrid(newGrid);
                                    } else {
                                      setJodiGrid({ ...jodiGrid, [key]: cleanVal });
                                    }
                                  }}
                                  className={`w-full text-center text-xs font-mono font-bold focus:outline-none bg-transparent ${val ? 'text-emerald-300' : 'text-white'}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Quick Haroof Bar (A, B, Digits, Amount, DONE) */}
                  <div className="mt-3 bg-[#182234] border border-gray-800 rounded-2xl p-2 flex gap-1.5 items-center">
                    <button
                      type="button"
                      onClick={() => setHarufQuickASelected(!harufQuickASelected)}
                      className={`h-10 px-3 rounded-xl font-black text-xs border transition-all ${
                        harufQuickASelected 
                          ? 'bg-[#00897B] text-white border-emerald-500' 
                          : 'bg-[#0F172A] text-gray-400 border-gray-700/80'
                      }`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => setHarufQuickBSelected(!harufQuickBSelected)}
                      className={`h-10 px-3 rounded-xl font-black text-xs border transition-all ${
                        harufQuickBSelected 
                          ? 'bg-[#00897B] text-white border-emerald-500' 
                          : 'bg-[#0F172A] text-gray-400 border-gray-700/80'
                      }`}
                    >
                      B
                    </button>
                    <input
                      type="number"
                      placeholder="Haroof"
                      value={harufQuickDigits}
                      onChange={(e) => setHarufQuickDigits(e.target.value.replace(/[^0-9]/g, ''))}
                      className="h-10 w-24 bg-[#0F172A] border border-gray-700/80 rounded-xl px-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500 text-center"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={harufQuickAmount}
                      onChange={(e) => setHarufQuickAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      className="h-10 w-24 bg-[#0F172A] border border-gray-700/80 rounded-xl px-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!harufQuickASelected && !harufQuickBSelected) {
                          setBetMessage('Select at least A (Ander) or B (Bahar)');
                          return;
                        }
                        const addAmt = parseInt(harufQuickAmount) || 0;
                        if (addAmt <= 0) {
                          setBetMessage('Enter valid amount');
                          return;
                        }
                        const digits = harufQuickDigits.split('').map(d => parseInt(d)).filter(d => !isNaN(d));
                        if (digits.length === 0) {
                          setBetMessage('Enter Haroof digits (0-9)');
                          return;
                        }

                        const newGrid = { ...jodiGrid };
                        for (let d of digits) {
                          if (harufQuickASelected) {
                            const keyA = `A${d}`;
                            const currA = parseInt(newGrid[keyA] || '0') || 0;
                            newGrid[keyA] = String(currA + addAmt);
                          }
                          if (harufQuickBSelected) {
                            const keyB = `B${d}`;
                            const currB = parseInt(newGrid[keyB] || '0') || 0;
                            newGrid[keyB] = String(currB + addAmt);
                          }
                        }
                        setJodiGrid(newGrid);
                        setHarufQuickDigits('');
                        setHarufQuickAmount('');
                        setBetMessage('');
                      }}
                      className="flex-1 h-10 bg-[#00897B] hover:bg-[#00796B] text-white font-black text-xs uppercase rounded-xl tracking-wider shadow"
                    >
                      DONE
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Formats Modal Popup */}
            {showFormatsModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-[#0F172A] border border-amber-500/30 rounded-2xl max-w-sm w-full p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-amber-400 font-black text-sm">💡 Supported Copy-Paste Formats</h3>
                    <button onClick={() => setShowFormatsModal(false)} className="text-gray-400 hover:text-white font-bold">✕</button>
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      { ex: '12 34 56 @50', desc: 'Jodis 12, 34, 56 for ₹50 each' },
                      { ex: '123456789 (50)', desc: 'Splits to 12, 34, 56, 78, 09 for ₹50 each' },
                      { ex: '12 34 [100]', desc: 'Jodis 12, 34 for ₹100 each' },
                      { ex: '12{50}', desc: 'Jodi 12 for ₹50' },
                      { ex: '12 34 into 50', desc: 'Jodis 12, 34 for ₹50 each' },
                      { ex: '10(50.10)', desc: 'Jodi 10 for ₹50, Palat 01 for ₹10' }
                    ].map((f, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-800">
                        <span className="font-mono font-bold text-emerald-400 text-[11px]">{f.ex}</span>
                        <span className="text-gray-300 text-[11px]">{f.desc}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowFormatsModal(false)}
                    className="w-full bg-[#00897B] text-white font-bold py-2.5 rounded-xl text-xs uppercase"
                  >
                    OK, Got It
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Sticky Dark Action Bar */}
            <div className="fixed bottom-[74px] left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0F172A] border-t border-gray-800/90 p-3 flex gap-3 items-center z-40 shadow-2xl backdrop-blur-md">
              {isGameBettingOpen(selectedGameForBetting, gameSchedules[selectedGameForBetting]) ? (
                <>
                  <button 
                    onClick={() => {
                      if (betCategory === 'Paste') {
                        setCopyPasteInputText('');
                        setCopyPasteParsedList([]);
                      } else {
                        setJodiGrid({});
                      }
                    }}
                    className="bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-3.5 py-3 rounded-xl text-xs flex items-center gap-1 hover:bg-red-500/20"
                  >
                    <span>🗑️</span> {betCategory === 'Paste' ? copyPasteParsedList.length : Object.keys(jodiGrid).length}
                  </button>

                  <button
                    onClick={handlePlaceBet}
                    className="flex-1 bg-[#00C853] hover:bg-[#00B248] text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <span>PLACE BET</span>
                    <span>•</span>
                    <span className="font-mono">
                      ₹{betCategory === 'Paste' 
                        ? copyPasteParsedList.reduce((sum, item) => sum + item.amount, 0)
                        : Object.values(jodiGrid).reduce((sum, val) => sum + (parseFloat(val) || 0), 0)}
                    </span>
                  </button>
                </>
              ) : (
                <div className="flex-1 bg-[#1E293B] border border-amber-500/40 text-[#F5D77F] font-bold py-3.5 px-4 rounded-xl text-xs text-center flex items-center justify-center gap-2 shadow-inner">
                  <span>⏳</span>
                  <span>Betting CLOSED for {selectedGameForBetting} {declaredResults[selectedGameForBetting] ? `(Winner: ${declaredResults[selectedGameForBetting]})` : '(Result Pending)'}</span>
                </div>
              )}
            </div>

            {/* 100% Pixel-Perfect Luxury Gold Capsule 5-Icon Bottom Navigation Bar (Matching Mockup media_1789564447949.png) */}
            <div className="fixed bottom-3 left-0 right-0 w-full z-50 pointer-events-none px-3">
              <div className="max-w-md mx-auto relative pointer-events-auto rounded-full bg-gradient-to-r from-[#FFE599] via-[#D4AF37] to-[#FFE599] p-[1.5px] shadow-[0_0_25px_rgba(212,175,55,0.4),0_10px_30px_rgba(0,0,0,0.9)]">
                <div className="w-full h-full rounded-full bg-gradient-to-b from-[#141B2A] via-[#0E131E] to-[#06090F] px-2 py-1.5 flex justify-around items-center relative overflow-visible backdrop-blur-xl">
                  
                  {/* HOME TAB */}
                  <button 
                    onClick={() => {
                      setSelectedGameForBetting(null);
                      setActiveWebTab('home');
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-wider">HOME</span>
                  </button>

                  {/* CHART TAB */}
                  <button 
                    onClick={() => {
                      setSelectedGameForBetting(null);
                      setActiveWebTab('charts');
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M4 9h4v11H4zm6-5h4v16h-4zm6 8h4v8h-4z"/>
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-wider">CHART</span>
                  </button>

                  {/* CENTER ELEVATED FLOATING GOLD CROWN BUTTON FOR MY BET */}
                  <button 
                    onClick={() => {
                      setSelectedGameForBetting(null);
                      setActiveWebTab('mybets');
                    }}
                    className="relative -top-4 w-13 h-13 rounded-full bg-gradient-to-tr from-[#FFE599] via-[#D4AF37] to-[#8C6D13] p-[2px] shadow-[0_0_25px_rgba(212,175,55,0.8),0_4px_15px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 z-20"
                  >
                    <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1E293B] to-[#0A0E17] flex flex-col items-center justify-center border border-[#FFE485]/60 shadow-inner">
                      <svg className="w-5 h-5 fill-[#F5D77F] filter drop-shadow-[0_0_6px_rgba(245,215,127,0.8)]" viewBox="0 0 24 24">
                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                      </svg>
                      <span className="text-[7.5px] font-black text-[#F5D77F] tracking-tighter leading-none mt-0.5">MY BET</span>
                    </div>
                  </button>

                  {/* CHAT TAB */}
                  <a 
                    href={`https://wa.me/${whatsappNumber}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-wider">CHAT</span>
                  </a>

                  {/* REFER TAB */}
                  <button 
                    onClick={() => {
                      setSelectedGameForBetting(null);
                      setShowReferralModal(true);
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-full text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4V8h16v11z"/>
                    </svg>
                    <span className="text-[9px] font-black uppercase tracking-wider">REFER</span>
                  </button>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 2: DEPOSIT MODAL                                   */}
        {/* ========================================================= */}
        {showDepositModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-sm p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => {
                  setShowDepositModal(false);
                  setEkqrOrderData(null);
                  setDepositMessage('');
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <span>⚡</span> Add Money to Wallet (Instant UPI)
              </h3>
              <p className="text-xs text-gray-400 mb-4">Fast, secure & automatic wallet balance credit</p>

              {depositMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold mb-4 text-center ${
                  depositMessage.includes('Error') || depositMessage.includes('failed') || depositMessage.includes('❌')
                    ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                    : 'bg-green-500/20 border border-green-500/40 text-green-300'
                }`}>
                  {depositMessage}
                </div>
              )}

              {/* INSTANT EKQR UPI GATEWAY */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Deposit Amount (₹)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => {
                      setDepositAmount(e.target.value);
                      setEkqrOrderData(null);
                    }}
                    className="w-full bg-[#0F172A] border border-[#334155] rounded-xl p-3 text-sm text-white font-mono focus:outline-none"
                  />
                  
                  {/* Quick Amount Chips */}
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    {[100, 300, 500, 1000, 2000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setDepositAmount(String(amt));
                          setEkqrOrderData(null);
                        }}
                        className={`py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                          depositAmount === String(amt)
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'bg-[#0F172A] border-[#334155] text-gray-300 hover:bg-slate-800'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {!ekqrOrderData ? (
                  <button
                    type="button"
                    disabled={isGeneratingEkqr}
                    onClick={() => handleStartEkqrPayment()}
                    className="w-full bg-[#00C853] hover:bg-[#00B248] text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isGeneratingEkqr ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>CONNECTING UPI GATEWAY...</span>
                      </>
                    ) : (
                      <span>⚡ PAY ₹{depositAmount || '100'} VIA UPI INSTANT ➔</span>
                    )}
                  </button>
                ) : (
                  <div className="bg-[#0F172A] border border-[#334155] rounded-xl p-4 text-center space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                      <span className="text-[11px] text-gray-400">Order Amount</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">₹{depositAmount}</span>
                    </div>

                    {/* Live Auto-Polling Status */}
                    <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-300 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>Waiting for UPI payment... Auto-syncing</span>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white p-3 rounded-2xl w-52 h-52 mx-auto border-2 border-[#F3D079] shadow-xl flex items-center justify-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                          ekqrOrderData.upi_intent?.phonepe_link || 
                          ekqrOrderData.upi_intent?.bhim_link || 
                          ekqrOrderData.payment_url || 
                          `upi://pay?pa=8930507940@ybl&pn=99xmatka&am=${depositAmount}&cu=INR`
                        )}`}
                        alt="EKQR UPI QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs font-bold text-[#F3D079]">Scan with Any UPI App to Pay ₹{depositAmount}</p>
                    <p className="text-[10px] text-gray-400">PhonePe • Google Pay • Paytm • BHIM</p>

                    {/* Check Status Button */}
                    <button
                      type="button"
                      disabled={isCheckingEkqrStatus}
                      onClick={handleManualCheckEkqrStatus}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-lg border border-slate-600 flex items-center justify-center gap-2 mt-2"
                    >
                      {isCheckingEkqrStatus ? 'Checking Bank Confirmation...' : '🔄 I Have Paid / Verify Status'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEkqrOrderData(null)}
                      className="text-[11px] text-gray-400 hover:text-white underline pt-1 block mx-auto"
                    >
                      ← Cancel / Change Amount
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: PUSH NOTIFICATIONS DRAWER */}
        {showNotificationsModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-sm p-5 shadow-2xl relative max-h-[80vh] flex flex-col">
              <button 
                onClick={() => setShowNotificationsModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" /> Notifications & Alerts
              </h3>
              <p className="text-xs text-gray-400 mb-4">Latest game results and broadcast announcements.</p>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {notificationsList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">
                    <p className="text-2xl mb-1">🔔</p>
                    No notifications yet. Result announcements & admin updates will appear here!
                  </div>
                ) : (
                  notificationsList.map((n, i) => (
                    <div key={i} className="bg-[#0F172A] border border-[#334155] rounded-xl p-3.5 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-amber-400">{n.title}</h4>
                        <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">
                          {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-200 leading-relaxed">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RULES & PAYOUT RATES */}
        {showRulesModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#121927] border border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setShowRulesModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F3D079] to-[#D4AF37] text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                  📋
                </div>
                <h3 className="text-lg font-extrabold text-white">Rules & Payout Rates</h3>
                <p className="text-xs text-gray-400">Official Game Multipliers & Limits</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-[#0F172A] p-3 rounded-2xl border border-gray-800 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white">Single Jodi (00-99)</h4>
                    <p className="text-[10px] text-gray-400">₹100 bet pays ₹{(gameRates.jodi * 100).toLocaleString()}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-[#00C853]/20 border border-[#00C853]/50 text-[#00C853] font-black rounded-xl">{gameRates.jodi}X</span>
                </div>

                <div className="bg-[#0F172A] p-3 rounded-2xl border border-gray-800 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white">Crossing Matrix</h4>
                    <p className="text-[10px] text-gray-400">All combination pairs (₹100 bet pays ₹{(gameRates.crossing * 100).toLocaleString()})</p>
                  </div>
                  <span className="px-2.5 py-1 bg-[#00C853]/20 border border-[#00C853]/50 text-[#00C853] font-black rounded-xl">{gameRates.crossing}X</span>
                </div>

                <div className="bg-[#0F172A] p-3 rounded-2xl border border-gray-800 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white">Haruf Ander (Inside)</h4>
                    <p className="text-[10px] text-gray-400">₹100 bet pays ₹{(gameRates.haroof * 100).toLocaleString()}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/50 text-[#F3D079] font-black rounded-xl">{gameRates.haroof}X</span>
                </div>

                <div className="bg-[#0F172A] p-3 rounded-2xl border border-gray-800 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white">Haruf Bahar (Outside)</h4>
                    <p className="text-[10px] text-gray-400">₹100 bet pays ₹{(gameRates.haroof * 100).toLocaleString()}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/50 text-[#F3D079] font-black rounded-xl">{gameRates.haroof}X</span>
                </div>

                <div className="bg-[#0F172A] p-3 rounded-2xl border border-gray-800 text-[11px] space-y-1 text-gray-300">
                  <p>⚡ <strong className="text-white">Min Deposit:</strong> ₹100</p>
                  <p>🏦 <strong className="text-white">Min Withdrawal:</strong> ₹200</p>
                  <p>🎲 <strong className="text-white">Min Bet:</strong> ₹1</p>
                </div>
              </div>

              <button
                onClick={() => setShowRulesModal(false)}
                className="w-full mt-5 bg-[#00C853] hover:bg-[#00B248] text-white font-bold py-3 rounded-xl uppercase tracking-wider text-xs shadow-lg"
              >
                GOT IT ➔
              </button>
            </div>
          </div>
        )}

        {/* MODAL: WALLET SCREEN (Matching Android App!) */}
        {showWalletModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F172A] border border-gray-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200 text-white max-h-[90vh] overflow-y-auto">
              
              {/* Top Bar Header */}
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowWalletModal(false)} className="text-xl font-bold text-gray-300 hover:text-white">
                    ←
                  </button>
                  <h3 className="text-lg font-extrabold text-white tracking-wide">Wallet</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      refreshData();
                      fetchWebsiteReferralDetails();
                    }} 
                    className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-all"
                    title="Refresh Balance"
                  >
                    🔄
                  </button>
                  <button
                    onClick={() => setShowWalletModal(false)}
                    className="text-gray-400 hover:text-white text-sm font-bold w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Main Professional Wallet Card */}
              <div className="bg-gradient-to-b from-[#1E2638] to-[#131924] border border-[#2A364F] rounded-3xl p-6 shadow-xl mb-6 text-center">
                {/* Big Balance Display */}
                <h2 className="text-3xl font-black font-mono tracking-tight text-white mb-1">
                  ₹ {user?.balance ? user.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </h2>
                <p className="text-xs font-semibold text-gray-400 mb-6">Available Balance</p>

                {/* Commission & Bonus Row */}
                <div className="flex justify-around items-center py-3 border-t border-b border-[#2A364F]/60 mb-6">
                  {/* Commission */}
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">COMMISSION</p>
                    <p className="text-sm font-black font-mono text-white">₹ {(user?.commission_balance !== undefined ? user.commission_balance : (referralDetails?.totalCommission || 0)).toFixed(2)}</p>
                  </div>
                  {/* Vertical Divider */}
                  <div className="w-[1px] h-8 bg-[#2A364F]" />
                  {/* Bonus */}
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">BONUS</p>
                    <p className="text-sm font-black font-mono text-[#00C853]">₹ {(user?.bonus_balance !== undefined ? user.bonus_balance : 200).toFixed(2)}</p>
                  </div>
                </div>

                {/* Transfer Commission to Main Wallet Button */}
                <button
                  type="button"
                  onClick={handleCommissionTransfer}
                  disabled={isTransferringCommission}
                  className="w-full bg-[#182234] hover:bg-[#1E2C42] border border-[#F5D77F]/80 text-[#F5D77F] py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider mb-3 flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {isTransferringCommission ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-[#F5D77F] border-t-transparent rounded-full animate-spin"></span>
                      Transferring...
                    </span>
                  ) : (
                    '🔄 Transfer Commission to Main Wallet'
                  )}
                </button>

                {commissionTransferMsg && (
                  <p className={`text-xs font-bold text-center py-2 px-3 rounded-xl mb-4 ${
                    commissionTransferMsg.startsWith('✅') ? 'bg-green-900/30 text-green-400 border border-green-500/40' :
                    commissionTransferMsg.startsWith('⚠️') ? 'bg-amber-900/30 text-amber-300 border border-amber-500/40' :
                    'bg-red-900/30 text-red-400 border border-red-500/40'
                  }`}>
                    {commissionTransferMsg}
                  </p>
                )}

                {/* Action Buttons Row */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setShowWalletModal(false);
                      setShowWithdrawModal(true);
                    }}
                    className="w-full bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/60 text-[#EF4444] font-bold py-3 px-3 rounded-2xl text-xs uppercase tracking-wider transition-all"
                  >
                    WITHDRAW
                  </button>
                  <button
                    onClick={() => {
                      setShowWalletModal(false);
                      setShowDepositModal(true);
                    }}
                    className="w-full bg-gradient-to-r from-[#4F46E5] to-[#3B82F6] hover:opacity-90 text-white font-bold py-3 px-3 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/30 transition-all"
                  >
                    ADD CASH
                  </button>
                </div>
              </div>

              {/* Recent Transactions Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Recent Transactions</h4>
                  <button 
                    onClick={() => {
                      fetchWalletTransactions();
                      setShowAllTxnsModal(true);
                    }}
                    className="text-xs text-blue-400 hover:underline font-semibold"
                  >
                    See All
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {walletTransactions.length === 0 ? (
                    <div className="bg-[#0F172A] border border-gray-800 rounded-2xl p-4 text-center text-xs text-gray-400">
                      No transactions recorded yet
                    </div>
                  ) : (
                    walletTransactions.slice(0, 10).map((tx: any, i: number) => {
                      const isCredit = tx.isCredit || tx.status === 'REFUNDED';
                      const emoji = tx.type === 'BONUS' ? '🎁' : (tx.type === 'DEPOSIT' ? '💰' : (tx.type === 'WITHDRAW' ? '🏧' : (tx.type === 'BET' ? '🎲' : '🏆')));
                      const statusColorClass = tx.status === 'APPROVED' || tx.status === 'CREDITED' || tx.status === 'WON' ? 'bg-emerald-950 text-emerald-400' : (tx.status === 'PENDING' || tx.status === 'REFUNDED' ? 'bg-amber-950 text-amber-400' : 'bg-red-950 text-red-400');
                      return (
                        <div key={tx.id || i} className="bg-[#0F172A] border border-gray-800 rounded-2xl p-3 flex justify-between items-center shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-800 text-white flex items-center justify-center text-lg">
                              {emoji}
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white">{tx.title}</h5>
                              <p className="text-[10px] text-gray-400 font-mono">{tx.subtitle}{tx.date ? ` • ${tx.date}` : ''}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-black font-mono ${isCredit ? 'text-[#00C853]' : 'text-[#EF4444]'}`}>
                              {isCredit ? '+' : '-'}₹{parseFloat(tx.amount || 0).toFixed(2)}
                            </p>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${statusColorClass}`}>{tx.status}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* MODAL: ALL TRANSACTIONS */}
        {showAllTxnsModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#121927] border border-[#F3D079]/40 rounded-3xl p-5 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📜</span>
                  <h3 className="text-base font-black text-[#F3D079]">ALL TRANSACTIONS</h3>
                </div>
                <button
                  onClick={() => setShowAllTxnsModal(false)}
                  className="text-gray-400 hover:text-white text-lg font-bold w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="grid grid-cols-5 gap-1 mb-4">
                {(['ALL', 'DEPOSIT', 'WITHDRAW', 'BET', 'WINNING'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setTxnFilterTab(tab)}
                    className={`py-1.5 text-[10px] font-bold rounded-lg transition-colors ${txnFilterTab === tab ? 'bg-[#F3D079] text-black font-black' : 'bg-[#0F172A] text-gray-300 border border-gray-800'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Scrollable List */}
              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {walletTransactions.filter(tx => txnFilterTab === 'ALL' || String(tx.type || '').toUpperCase() === txnFilterTab).length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    No {txnFilterTab} transactions recorded yet
                  </div>
                ) : (
                  walletTransactions
                    .filter(tx => txnFilterTab === 'ALL' || String(tx.type || '').toUpperCase() === txnFilterTab)
                    .map((tx: any, i: number) => {
                      const isCredit = tx.isCredit || tx.status === 'REFUNDED';
                      const emoji = tx.type === 'BONUS' ? '🎁' : (tx.type === 'DEPOSIT' ? '💰' : (tx.type === 'WITHDRAW' ? '🏧' : (tx.type === 'BET' ? '🎲' : '🏆')));
                      const statusColorClass = tx.status === 'APPROVED' || tx.status === 'CREDITED' || tx.status === 'WON' ? 'bg-emerald-950 text-emerald-400' : (tx.status === 'PENDING' || tx.status === 'REFUNDED' ? 'bg-amber-950 text-amber-400' : 'bg-red-950 text-red-400');
                      return (
                        <div key={tx.id || i} className="bg-[#0F172A] border border-gray-800 rounded-2xl p-3 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-800 text-white flex items-center justify-center text-lg">
                              {emoji}
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white">{tx.title}</h5>
                              <p className="text-[10px] text-gray-400 font-mono">{tx.subtitle}{tx.date ? ` • ${tx.date}` : ''}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-black font-mono ${isCredit ? 'text-[#00C853]' : 'text-[#EF4444]'}`}>
                              {isCredit ? '+' : '-'}₹{parseFloat(tx.amount || 0).toFixed(2)}
                            </p>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${statusColorClass}`}>{tx.status}</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: USER PROFILE */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#121927] border border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <div className="text-center mb-5">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00C853] to-[#00897B] text-white text-3xl font-black flex items-center justify-center mx-auto mb-3 shadow-lg border-2 border-emerald-400/40">
                  👑
                </div>
                <h3 className="text-lg font-black text-white">{user?.name || 'Player'}</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">+91 {user?.mobile || '9999999999'}</p>
                <span className="inline-block mt-2 px-3 py-0.5 bg-emerald-950 border border-emerald-500/50 text-[#00C853] font-bold text-[10px] uppercase rounded-full">
                  Account Active 🟢
                </span>
              </div>

              <div className="space-y-3 mb-5">
                <div className="bg-[#0F172A] p-4 rounded-2xl border border-gray-800 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Wallet Balance</p>
                    <h4 className="text-lg font-black font-mono text-[#00C853]">₹{user?.balance ? user.balance.toFixed(2) : '0.00'}</h4>
                  </div>
                  <button
                    onClick={() => {
                      setShowProfileModal(false);
                      setShowDepositModal(true);
                    }}
                    className="px-3 py-2 bg-[#00C853] text-white font-bold text-xs rounded-xl hover:bg-[#00B248] shadow-md"
                  >
                    + Add Cash
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    setShowWithdrawModal(true);
                  }}
                  className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  🏦 Withdraw
                </button>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    setActiveWebTab('mybets');
                  }}
                  className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  📜 My Bets
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: WITHDRAW CASH */}
        {showWithdrawModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#121927] border border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"
              >
                ✕
              </button>

              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F3D079] to-[#D4AF37] text-slate-950 font-black text-2xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                  🏦
                </div>
                <h3 className="text-lg font-extrabold text-white">Withdraw Cash</h3>
                <p className="text-xs text-gray-400 mt-0.5">24x7 Direct Bank & UPI Settlement</p>
              </div>

              {/* Wallet Balance Info */}
              <div className="bg-[#0F172A] p-3.5 rounded-2xl border border-gray-800 flex justify-between items-center mb-4">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Withdrawable Balance (Winnings)</p>
                  <h4 className="text-base font-black font-mono text-[#00C853]">₹{user?.winning_balance !== undefined ? user.winning_balance.toFixed(2) : (user?.balance ? user.balance.toFixed(2) : '0.00')}</h4>
                </div>
                <span className="text-[10px] bg-yellow-500/10 border border-yellow-500/30 text-[#F3D079] px-2.5 py-1 rounded-full font-bold">
                  Min: ₹200
                </span>
              </div>

              {withdrawMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold mb-4 text-center ${withdrawMessage.includes('Error') ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-green-500/20 border border-green-500/40 text-green-400'}`}>
                  {withdrawMessage}
                </div>
              )}

              <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-xs">
                {/* Method Switcher Pills */}
                <div className="grid grid-cols-2 gap-2 bg-[#0F172A] p-1 rounded-xl border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('UPI')}
                    className={`py-2 rounded-lg font-bold transition-all text-center ${withdrawMethod === 'UPI' ? 'bg-[#00C853] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                  >
                    ⚡ UPI ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod('Bank')}
                    className={`py-2 rounded-lg font-bold transition-all text-center ${withdrawMethod === 'Bank' ? 'bg-[#00C853] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                  >
                    🏦 Bank Transfer
                  </button>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Amount (Min ₹200)</label>
                  <input
                    type="number"
                    min="200"
                    placeholder="Enter amount (e.g. 200)"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-[#00C853]"
                  />
                  <div className="flex gap-2 mt-2">
                    {['200', '500', '1000', '2000', '5000'].map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setWithdrawAmount(amt)}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-1.5 rounded-lg text-[10px]"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account Holder Name */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    placeholder="Full name as per Bank / UPI"
                    value={withdrawHolderName}
                    onChange={(e) => setWithdrawHolderName(e.target.value)}
                    className="w-full bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00C853]"
                  />
                </div>

                {/* Dynamic Payment Inputs */}
                {withdrawMethod === 'UPI' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">UPI ID (VPA)</label>
                    <input
                      type="text"
                      placeholder="e.g. 9999999999@ybl / name@paytm"
                      value={withdrawUpi}
                      onChange={(e) => setWithdrawUpi(e.target.value)}
                      className="w-full bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[#00C853]"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Bank Account Number</label>
                      <input
                        type="text"
                        placeholder="Enter 9-18 digit account number"
                        value={withdrawBankAcc}
                        onChange={(e) => setWithdrawBankAcc(e.target.value)}
                        className="w-full bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[#00C853]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="e.g. SBIN0001234"
                        value={withdrawBankIfsc}
                        onChange={(e) => setWithdrawBankIfsc(e.target.value.toUpperCase())}
                        className="w-full bg-[#0F172A] border border-gray-700 rounded-xl p-3 text-xs text-white font-mono uppercase focus:outline-none focus:border-[#00C853]"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isWithdrawSubmitting}
                  className="w-full bg-[#00C853] hover:bg-[#00B248] disabled:bg-gray-700 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg transition-all"
                >
                  {isWithdrawSubmitting ? 'PROCESSING...' : 'REQUEST WITHDRAWAL ➔'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 4: REFERRAL PAGE (DARK LUXURY MATKA THEME)         */}
        {/* ========================================================= */}
        {showReferralModal && (
          <div className="fixed inset-0 bg-[#0F172A] z-50 overflow-y-auto flex flex-col justify-between">
            {/* Top Dark Header */}
            <div className="bg-[#1E293B] px-4 py-3 border-b border-[#334155] flex justify-between items-center sticky top-0 z-30 shadow-md">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowReferralModal(false)}
                  className="text-white text-2xl font-bold hover:text-[#F3D079]"
                >
                  ✕
                </button>
                <div>
                  <h1 className="text-lg font-black text-[#F3D079] tracking-wide leading-tight">Referral</h1>
                  <p className="text-[10px] font-semibold text-[#94A3B8]">Play Smart • Play Safe • Win Big</p>
                </div>
              </div>

              {/* Balance Badge */}
              <button 
                onClick={() => {
                  setShowReferralModal(false);
                  setShowDepositModal(true);
                }}
                className="bg-[#00C853] hover:bg-[#00B248] text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-mono font-black shadow-md transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                <span>₹{(user?.balance || 3520).toFixed(2)}</span>
                <span className="w-5 h-5 rounded-full bg-white text-[#00C853] flex items-center justify-center font-bold text-sm">+</span>
              </button>
            </div>

            {/* Main Content Area */}
            <div className="p-4 flex-1 max-w-md mx-auto w-full space-y-4 text-white pb-28">
              {/* DATE FILTER BUTTONS */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setRefFilterType('all');
                    setRefFilterDate('all');
                    setRefFilterLabel('All Time');
                    fetchWebsiteReferralDetails('all');
                  }}
                  className={`py-2 px-1 text-xs rounded-xl font-bold transition-all border ${
                    refFilterType === 'all'
                      ? 'bg-[#2A374A] border-[#F3D079] text-[#F3D079]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  All Time
                </button>

                <button
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    setRefFilterType('today');
                    setRefFilterDate(todayStr);
                    setRefFilterLabel('Today');
                    fetchWebsiteReferralDetails(todayStr);
                  }}
                  className={`py-2 px-1 text-xs rounded-xl font-bold transition-all border ${
                    refFilterType === 'today'
                      ? 'bg-[#2A374A] border-[#F3D079] text-[#F3D079]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Today
                </button>

                <button
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    const yestStr = d.toISOString().split('T')[0];
                    setRefFilterType('yesterday');
                    setRefFilterDate(yestStr);
                    setRefFilterLabel('Yesterday');
                    fetchWebsiteReferralDetails(yestStr);
                  }}
                  className={`py-2 px-1 text-xs rounded-xl font-bold transition-all border ${
                    refFilterType === 'yesterday'
                      ? 'bg-[#2A374A] border-[#F3D079] text-[#F3D079]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Yesterday
                </button>

                <label
                  className={`py-2 px-1 text-xs rounded-xl font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                    refFilterType === 'custom'
                      ? 'bg-[#2A374A] border-[#F3D079] text-[#F3D079]'
                      : 'bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <span>📅</span>
                  <span className="truncate">{refFilterType === 'custom' ? refFilterLabel : 'Pick'}</span>
                  <input
                    type="date"
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.value) {
                        const dateVal = e.target.value;
                        const parts = dateVal.split('-');
                        const label = `${parts[2]}/${parts[1]}`;
                        setRefFilterType('custom');
                        setRefFilterDate(dateVal);
                        setRefFilterLabel(label);
                        fetchWebsiteReferralDetails(dateVal);
                      }
                    }}
                  />
                </label>
              </div>

              {/* CARD 1: TOTAL COMMISSION */}
              <div className="bg-[#1E293B] rounded-2xl shadow-lg border border-[#334155] overflow-hidden">
                <div className="bg-[#162238] px-4 py-2.5 flex justify-between items-center text-white">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎟️</span>
                    <span className="text-xs font-black tracking-wider uppercase">
                      {refFilterType === 'all' ? 'TOTAL COMMISSION' : `COMMISSION (${refFilterLabel})`}
                    </span>
                  </div>
                  <button 
                    onClick={() => fetchWebsiteReferralDetails(refFilterDate)}
                    className="text-xs hover:rotate-180 transition-transform p-1"
                  >
                    🔄
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-[#0F172A] border-2 border-[#F3D079] rounded-2xl py-4 text-center">
                    <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mb-1">Commission Wallet</p>
                    <span className="text-2xl font-mono font-black text-[#F3D079]">
                      ₹{(user?.commission_balance !== undefined ? user.commission_balance : (referralDetails.totalCommission || 0)).toFixed(2)}/-
                    </span>
                  </div>
                  {/* Transfer Button */}
                  <button
                    onClick={handleCommissionTransfer}
                    disabled={isTransferringCommission || (user?.commission_balance !== undefined ? user.commission_balance : (referralDetails.totalCommission || 0)) <= 0}
                    className="w-full bg-gradient-to-r from-[#F3D079] to-[#F59E0B] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black py-3 rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isTransferringCommission ? (
                      <><span className="animate-spin">⏳</span> Transferring...</>
                    ) : (
                      <><span>💰</span> Transfer to Main Wallet</>
                    )}
                  </button>
                  {commissionTransferMsg && (
                    <p className={`text-xs font-bold text-center py-2 px-3 rounded-xl ${commissionTransferMsg.startsWith('✅') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                      {commissionTransferMsg}
                    </p>
                  )}
                </div>
              </div>


              {/* CARD 2: YOUR REFERRAL CODE */}
              <div className="bg-[#1E293B] rounded-2xl shadow-lg border border-[#334155] overflow-hidden">
                <div className="bg-[#00873E] px-4 py-2.5 flex items-center gap-2 text-white">
                  <span className="text-sm">🎁</span>
                  <span className="text-xs font-black tracking-wider uppercase">YOUR REFERRAL CODE</span>
                </div>
                <div className="p-4 text-center">
                  {(() => {
                    const userRefCode = (referralDetails.referral_code || user?.referral_code || (user?.mobile ? user.mobile.slice(-10) : '7206561420')).replace(/^REF/i, '');
                    const shareText = `Play 99xmatka & Win 95X! 👑\nUse my Referral Code: ${userRefCode} to get bonus balance!\nPlay online: ${window.location.origin}`;
                    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

                    return (
                      <div className="space-y-4">
                        <div className="bg-[#0F172A] border-2 border-[#F3D079] rounded-2xl py-3.5 px-3">
                          <div className="text-xl font-mono font-black text-[#F3D079] tracking-[0.2em] select-all whitespace-nowrap overflow-x-auto">
                            {userRefCode}
                          </div>
                        </div>

                        {/* Side-by-Side Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(shareText);
                              setCopiedToast(true);
                              setTimeout(() => setCopiedToast(false), 2500);
                            }}
                            className="bg-[#00873E] hover:bg-[#007033] text-white font-bold py-2.5 px-3 rounded-xl flex justify-center items-center gap-2 text-xs uppercase tracking-wider shadow-sm transition-all"
                          >
                            <span>📋</span>
                            <span>{copiedToast ? 'COPIED!' : 'Copy Code'}</span>
                          </button>

                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-black py-2.5 px-3 rounded-xl flex justify-center items-center gap-2 text-xs uppercase tracking-wider shadow-sm transition-all"
                          >
                            <span>🔀</span>
                            <span>Share</span>
                          </a>
                        </div>

                        {/* Step Process Indicator */}
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#334155]">
                          <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-full bg-[#0F172A] border border-[#F3D079] flex items-center justify-center font-black text-xs text-[#F3D079] mb-1">1</div>
                            <span className="text-[10px] font-medium text-[#94A3B8]">Share your code</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-full bg-[#0F172A] border border-[#F3D079] flex items-center justify-center font-black text-xs text-[#F3D079] mb-1">2</div>
                            <span className="text-[10px] font-medium text-[#94A3B8]">They sign up</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-full bg-[#0F172A] border border-[#F3D079] flex items-center justify-center font-black text-xs text-[#F3D079] mb-1">3</div>
                            <span className="text-[10px] font-medium text-[#94A3B8]">You earn</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* CARD 3: TOTAL REFERRALS */}
              <div className="bg-[#1E293B] rounded-2xl shadow-lg border border-[#334155] overflow-hidden">
                <div className="bg-[#162238] px-4 py-2.5 flex justify-between items-center text-white">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">👥</span>
                    <span className="text-xs font-black tracking-wider uppercase">TOTAL REFERRALS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => fetchWebsiteReferralDetails(refFilterDate)}
                      className="bg-[#0F172A] border border-[#334155] text-xs text-[#00C853] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 hover:bg-[#1E293B] transition-all"
                    >
                      <span>🔄</span> Refresh
                    </button>
                    <div className="bg-[#0F172A] border border-[#F3D079] text-[#F3D079] px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1">
                      <span>👤</span>
                      <span>{referralDetails.referralsCount || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 text-center">
                  {referralDetails.referredUsers.length === 0 ? (
                    <div className="py-4">
                      <div className="text-4xl mb-2">👥</div>
                      <p className="text-sm font-bold text-[#94A3B8]">No referrals yet</p>
                      <p className="text-[11px] text-[#64748B] mt-1">Share your code above to start earning lifetime bet commissions!</p>
                    </div>
                  ) : (
                    <div className="text-left space-y-2.5">
                      {referralDetails.referredUsers.map((ref, idx) => (
                        <div key={idx} className="p-3.5 bg-[#0F172A] rounded-xl border border-[#334155] flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-white text-sm">{ref.name}</p>
                            <p className="text-[#94A3B8] font-mono text-[11px] mt-0.5">{ref.mobile} • {ref.date}</p>
                            <p className="text-[11px] text-[#F3D079] font-semibold mt-1">
                              Bet Commission: ₹{ref.betCommission.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-black text-[#00C853] text-base">+₹{ref.totalEarned.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: KHAIWAL MANAGEMENT DASHBOARD                       */}
        {/* ========================================================= */}
        {showKhaiwalModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[#0F172A] border border-[#F5D77F]/40 rounded-3xl w-full max-w-lg p-4 sm:p-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col text-white">
              
              {/* Top Header */}
              <div className="flex justify-between items-center pb-3 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👑</span>
                  <h3 className="text-base font-black text-[#F5D77F] tracking-wide">
                    KHAIWAL MANAGEMENT PANEL
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowKhaiwalModal(false);
                    setSelectedKhaiwalPlayer(null);
                  }}
                  className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="overflow-y-auto py-4 space-y-4 flex-1">

                {/* Khaiwal Partner Banner */}
                <div className="bg-gradient-to-r from-[#1E293D] via-[#0F172A] to-[#1E293D] border border-[#F5D77F] rounded-2xl p-4 shadow-lg flex justify-between items-center">
                  <div>
                    <p className="text-xs font-black text-[#F5D77F] tracking-wider uppercase">YOU ARE A KHAIWAL</p>
                    <p className="text-[11px] text-gray-300 mt-0.5">Manage your players, record bets & track commissions</p>
                  </div>
                  <span className="text-2xl">👑</span>
                </div>

                {/* Main Action Bar */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setAddPlayerName('');
                      setAddJodiRate('95');
                      setAddCrossingRate('95');
                      setAddHarufRate('9.5');
                      setAddCommissionPct('5');
                      setAddPlayerError('');
                      setShowAddPlayerModal(true);
                    }}
                    className="bg-[#00C853] hover:bg-[#00E676] text-white font-black py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                  >
                    <span>➕</span> Add a Player
                  </button>
                  <button
                    onClick={() => {
                      setSelectedKhaiwalPlayer(null);
                      fetchKhaiwalPlayers();
                    }}
                    className="bg-[#1E293D] hover:bg-[#334155] border border-[#F5D77F] text-[#F5D77F] font-black py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                  >
                    <span>👥</span> See Your Players
                  </button>
                </div>

                {/* VIEW 1: PLAYERS LIST */}
                {!selectedKhaiwalPlayer ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-300 tracking-wider uppercase">
                        YOUR REGISTERED PLAYERS ({khaiwalPlayers.length})
                      </h4>
                      {isKhaiwalLoading && <span className="text-xs text-[#F5D77F]">Loading...</span>}
                    </div>

                    {khaiwalPlayers.length === 0 ? (
                      <div className="text-center py-8 bg-[#162238] rounded-2xl border border-gray-800 text-gray-400">
                        <div className="text-3xl mb-2">👤</div>
                        <p className="text-xs font-bold text-white mb-1">No players added yet</p>
                        <p className="text-[11px] text-gray-400">Click '+ Add a Player' above to register your first player!</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {khaiwalPlayers.map((p) => (
                          <div
                            key={p.id}
                            className="bg-[#162238] border border-gray-800 hover:border-[#F5D77F]/50 rounded-2xl p-3.5 flex justify-between items-center shadow-sm transition-all"
                          >
                            <div
                              onClick={() => {
                                setSelectedKhaiwalPlayer(p);
                                fetchKhaiwalPlayerLedger(p);
                              }}
                              className="cursor-pointer flex-1 pr-2"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#F5D77F] flex items-center justify-center text-sm">
                                  👤
                                </div>
                                <div>
                                  <p className="font-extrabold text-white text-sm hover:text-[#F5D77F] transition-colors">{p.name}</p>
                                  <p className="text-[10px] text-[#F5D77F] font-semibold mt-0.5">
                                    Rates: Jodi {p.jodi_rate}x • Haruf {p.haroof_rate}x | Comm: {p.commission_pct}%
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setActiveKhaiwalBetPlayer(p);
                                  setShowKhaiwalMarketSelectModal(true);
                                }}
                                className="bg-[#00C853] hover:bg-[#00E676] text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow"
                                title="Place bet for this player"
                              >
                                <span>⚡</span> Place Bet
                              </button>
                              <button
                                onClick={() => {
                                  setEditingKhaiwalPlayer(p);
                                  setEditPlayerName(p.name);
                                  setEditJodiRate(p.jodi_rate ? p.jodi_rate.toString() : '95');
                                  setEditCrossingRate(p.crossing_rate ? p.crossing_rate.toString() : '95');
                                  setEditHarufRate(p.haroof_rate ? p.haroof_rate.toString() : '9.5');
                                  setEditCommissionPct(p.commission_pct !== undefined && p.commission_pct !== null ? p.commission_pct.toString() : '0');
                                  setShowEditPlayerModal(true);
                                }}
                                className="bg-[#1E293B] border border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-black text-xs p-1.5 rounded-lg transition-colors"
                                title="Edit player details"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingKhaiwalPlayer(p);
                                  setShowDeletePlayerModal(true);
                                }}
                                className="bg-[#1E293B] border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white text-xs p-1.5 rounded-lg transition-colors"
                                title="Delete player"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* VIEW 2: INDIVIDUAL PLAYER LEDGER */
                  <div className="space-y-4">
                    {/* Header bar for selected player */}
                    <div className="bg-[#162238] border border-[#F5D77F]/40 rounded-2xl p-3.5 flex justify-between items-center">
                      <div>
                        <button
                          onClick={() => setSelectedKhaiwalPlayer(null)}
                          className="text-[10px] text-[#F5D77F] font-bold underline mb-1 flex items-center gap-1"
                        >
                          ← Back to All Players
                        </button>
                        <h4 className="text-base font-black text-white">{selectedKhaiwalPlayer.name}</h4>
                        <p className="text-[10px] text-gray-400 font-medium">
                          Jodi: {selectedKhaiwalPlayer.jodi_rate}x • Haruf: {selectedKhaiwalPlayer.haroof_rate}x • Comm: {selectedKhaiwalPlayer.commission_pct}%
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveKhaiwalBetPlayer(selectedKhaiwalPlayer);
                          setShowKhaiwalMarketSelectModal(true);
                        }}
                        className="bg-[#00C853] hover:bg-[#00E676] text-white text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg"
                      >
                        ⚡ Place Bet
                      </button>
                    </div>

                    {/* Stats Summary Cards */}
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const yesterdayObj = new Date();
                      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
                      const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

                      const filteredSummaryEntries = selectedKhaiwalLedger.filter((item) => {
                        const ts = item.createdAt || item.date || '';
                        const matchesDate = (() => {
                          if (khaiwalDateFilter === 'TODAY') return ts.includes(todayStr) || ts.includes('Today') || (!ts.includes('-') && !ts.includes('202'));
                          if (khaiwalDateFilter === 'YESTERDAY') return ts.includes(yesterdayStr) || ts.includes('Yesterday');
                          if (khaiwalDateFilter === 'CUSTOM') return ts.includes(khaiwalCustomDate);
                          return true;
                        })();
                        if (!matchesDate) return false;

                        const gName = (item.gameName || '').toUpperCase();
                        const matchesMarket = (() => {
                          if (khaiwalMarketFilter === 'ALL') return true;
                          if (khaiwalMarketFilter === 'DESAWAR') return gName.includes('DESAWAR') || gName.includes('DISAWER');
                          if (khaiwalMarketFilter === 'SHREE GANESH') return gName.includes('SHREE GANESH') || gName.includes('SHRI GANESH');
                          return gName.includes(khaiwalMarketFilter);
                        })();
                        if (!matchesMarket) return false;

                        if (khaiwalLedgerTab === 'HISTORY' || khaiwalLedgerTab === 'ALL') return true;
                        const cat = (item.category || '').toUpperCase();

                        if (Array.isArray(item.bets) && item.bets.length > 0) {
                          return item.bets.some((b: any) => {
                            const bType = String(b.betType || b.bet_type || b.type || '').toUpperCase();
                            const numStr = String(b.number || b.num || '').toUpperCase();
                            if (khaiwalLedgerTab === 'CROSSING') return bType.includes('CROSSING') || cat === 'CROSSING' || cat === 'CROSS';
                            if (khaiwalLedgerTab === 'HARUF') return bType.includes('HARUF') || bType.includes('HAROOF') || bType.includes('ANDER') || bType.includes('ANDAR') || bType.includes('BAHAR') || numStr.startsWith('A') || numStr.startsWith('B') || cat === 'HARUF' || cat === 'HAROOF';
                            if (khaiwalLedgerTab === 'JODI') return bType.includes('JODI') || cat === 'JODI' || (!bType.includes('CROSSING') && !bType.includes('HARUF') && !bType.includes('HAROOF') && !bType.includes('ANDER') && !bType.includes('ANDAR') && !bType.includes('BAHAR') && !numStr.startsWith('A') && !numStr.startsWith('B'));
                            return false;
                          });
                        }
                        if (khaiwalLedgerTab === 'JODI' && cat === 'JODI') return true;
                        if (khaiwalLedgerTab === 'CROSSING' && (cat === 'CROSSING' || cat === 'CROSS')) return true;
                        if (khaiwalLedgerTab === 'HARUF' && (cat === 'HARUF' || cat === 'HAROOF')) return true;
                        return false;
                      });

                      const displayedTotalBets = filteredSummaryEntries.reduce((acc, item) => acc + (parseFloat(item.totalAmount || 0) || 0), 0);
                      const displayedCommission = filteredSummaryEntries.reduce((acc, item) => acc + (parseFloat(item.commission || 0) || 0), 0);
                      const displayedTotalWinning = filteredSummaryEntries.reduce((acc, item) => acc + (item.isWinner || item.virtualPayout > 0 ? (parseFloat(item.virtualPayout || 0) || 0) : 0), 0);

                      return (
                        <div className="flex justify-between items-start pt-1 pb-2">
                          <div className="space-y-2.5 text-left">
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">TOTAL BETS PLACED</p>
                              <p className="text-base font-black text-white font-mono mt-0.5">₹{displayedTotalBets.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-sky-400 uppercase">TOTAL WINNING</p>
                              <p className="text-base font-black text-sky-400 font-mono mt-0.5">₹{displayedTotalWinning.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-[#F5D77F] uppercase">YOUR COMMISSION ({selectedPlayer?.commission_pct || 0}%)</p>
                            <p className="text-base font-black text-[#00C853] font-mono mt-0.5">₹{displayedCommission.toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Date Selector Bar */}
                    <div className="flex gap-2 justify-center items-center py-1">
                      {[
                        { key: 'ALL', label: 'All Dates' },
                        { key: 'TODAY', label: 'Today' },
                        { key: 'YESTERDAY', label: 'Yesterday' }
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setKhaiwalDateFilter(opt.key as any)}
                          className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                            khaiwalDateFilter === opt.key
                              ? 'bg-[#F5D77F] text-[#0F172A] border-[#F5D77F]'
                              : 'bg-[#162238] text-gray-300 border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <input
                        type="date"
                        value={khaiwalCustomDate}
                        onChange={(e) => {
                          setKhaiwalCustomDate(e.target.value);
                          setKhaiwalDateFilter('CUSTOM');
                        }}
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border bg-[#162238] text-gray-200 outline-none ${
                          khaiwalDateFilter === 'CUSTOM' ? 'border-[#F5D77F] text-[#F5D77F]' : 'border-gray-700'
                        }`}
                      />
                    </div>

                    {/* Market Selector Bar */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {['ALL', 'SHIV PARWATI', 'DELHI BAZAR', 'DUBAI MARKET', 'SHREE GANESH', 'FARIDABAD', 'GHAZIABAD', 'GALI', 'DESAWAR'].map((m) => (
                        <button
                          key={m}
                          onClick={() => setKhaiwalMarketFilter(m)}
                          className={`text-[10.5px] font-extrabold px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all ${
                            khaiwalMarketFilter === m
                              ? 'bg-[#00C853] text-[#0F172A] border-[#00C853]'
                              : 'bg-[#162238] text-gray-300 border-gray-800 hover:border-gray-600'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    {/* Dedicated Tabs: ALL | JODI | CROSSING | HARUF | HISTORY */}
                    <div className="flex border-b border-gray-800 gap-1.5 overflow-x-auto pb-1">
                      {(['ALL', 'JODI', 'CROSSING', 'HARUF', 'HISTORY'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setKhaiwalLedgerTab(tab)}
                          className={`text-xs font-extrabold px-3 py-1.5 rounded-t-lg transition-all shrink-0 ${
                            khaiwalLedgerTab === tab
                              ? 'bg-[#162238] text-[#F5D77F] border-b-2 border-[#F5D77F]'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Ledger Content List */}
                    {(() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const yesterdayObj = new Date();
                      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
                      const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

                      const filteredEntries = selectedKhaiwalLedger.filter((item) => {
                        // Date Filter
                        const ts = item.createdAt || item.date || '';
                        const matchesDate = (() => {
                          if (khaiwalDateFilter === 'TODAY') return ts.includes(todayStr) || ts.includes('Today') || (!ts.includes('-') && !ts.includes('202'));
                          if (khaiwalDateFilter === 'YESTERDAY') return ts.includes(yesterdayStr) || ts.includes('Yesterday');
                          if (khaiwalDateFilter === 'CUSTOM') return ts.includes(khaiwalCustomDate);
                          return true;
                        })();
                        if (!matchesDate) return false;

                        // Market Filter
                        const gName = (item.gameName || '').toUpperCase();
                        const matchesMarket = (() => {
                          if (khaiwalMarketFilter === 'ALL') return true;
                          if (khaiwalMarketFilter === 'DESAWAR') return gName.includes('DESAWAR') || gName.includes('DISAWER');
                          if (khaiwalMarketFilter === 'SHREE GANESH') return gName.includes('SHREE GANESH') || gName.includes('SHRI GANESH');
                          return gName.includes(khaiwalMarketFilter);
                        })();
                        if (!matchesMarket) return false;

                        // Category Filter
                        if (khaiwalLedgerTab === 'HISTORY' || khaiwalLedgerTab === 'ALL') return true;
                        const cat = (item.category || '').toUpperCase();

                        if (Array.isArray(item.bets) && item.bets.length > 0) {
                          return item.bets.some((b: any) => {
                            const bType = String(b.betType || b.bet_type || b.type || '').toUpperCase();
                            const numStr = String(b.number || b.num || '').toUpperCase();
                            if (khaiwalLedgerTab === 'CROSSING') return bType.includes('CROSSING') || cat === 'CROSSING' || cat === 'CROSS';
                            if (khaiwalLedgerTab === 'HARUF') return bType.includes('HARUF') || bType.includes('HAROOF') || bType.includes('ANDER') || bType.includes('ANDAR') || bType.includes('BAHAR') || numStr.startsWith('A') || numStr.startsWith('B') || cat === 'HARUF' || cat === 'HAROOF';
                            if (khaiwalLedgerTab === 'JODI') return bType.includes('JODI') || cat === 'JODI' || (!bType.includes('CROSSING') && !bType.includes('HARUF') && !bType.includes('HAROOF') && !bType.includes('ANDER') && !bType.includes('ANDAR') && !bType.includes('BAHAR') && !numStr.startsWith('A') && !numStr.startsWith('B'));
                            return false;
                          });
                        }
                        if (khaiwalLedgerTab === 'JODI' && cat === 'JODI') return true;
                        if (khaiwalLedgerTab === 'CROSSING' && (cat === 'CROSSING' || cat === 'CROSS')) return true;
                        if (khaiwalLedgerTab === 'HARUF' && (cat === 'HARUF' || cat === 'HAROOF')) return true;
                        return false;
                      });

                      if (filteredEntries.length === 0) {
                        return (
                          <div className="text-center py-6 text-gray-400 text-xs font-semibold bg-[#162238] rounded-2xl border border-gray-800">
                            No {khaiwalLedgerTab} bets recorded for this player yet.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2.5">
                          {filteredEntries.map((entry) => (
                            <div key={entry.id} className="bg-[#162238] border border-gray-800 rounded-xl p-3 text-xs space-y-2">
                              <div className="flex justify-between items-center border-b border-gray-800/80 pb-1.5">
                                <span className="font-extrabold text-[#F5D77F]">{entry.gameName}</span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>

                              {/* Numbers List */}
                              <div className="flex flex-wrap gap-1.5 py-1">
                                {Array.isArray(entry.bets) && entry.bets.map((b: any, bIdx: number) => {
                                  const rawNum = String(b.number !== undefined ? b.number : (b.num !== undefined ? b.num : ''));
                                  const amt = b.bet_amount || b.amount || b.amt || 0;
                                  const bType = String(b.betType || b.bet_type || b.type || '').toUpperCase();

                                  const isHaruf = entry.category === 'Haruf' || bType.includes('HAROOF') || bType.includes('HARUF') || rawNum.startsWith('A') || rawNum.startsWith('B');
                                  const isAndar = bType.includes('ANDER') || bType.includes('ANDAR') || bType.includes('INSIDE') || rawNum.startsWith('A');
                                  const isBahar = bType.includes('BAHAR') || bType.includes('OUTSIDE') || rawNum.startsWith('B');

                                  const cleanNum = rawNum.replace(/^[AB]/i, '');
                                  let displayNum = cleanNum;
                                  if (isHaruf) {
                                    if (isAndar) displayNum = `${cleanNum} (Andar)`;
                                    else if (isBahar) displayNum = `${cleanNum} (Bahar)`;
                                  }

                                  return (
                                    <span key={bIdx} className="bg-[#0F172A] border border-gray-700 px-2 py-0.5 rounded text-[11px] font-mono text-gray-200">
                                      {displayNum}: <span className="font-bold text-[#00C853]">₹{amt}</span>
                                    </span>
                                  );
                                })}
                              </div>

                              <div className="flex justify-between items-center border-t border-gray-800/80 pt-1.5 text-[11px]">
                                <span className="text-gray-400">
                                  Total: <strong className="text-white">₹{entry.totalAmount}</strong>
                                </span>
                                <span className="text-amber-400 font-semibold">
                                  Comm ({selectedKhaiwalPlayer.commission_pct}%): +₹{entry.commission}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD KHAIWAL PLAYER */}
        {showAddPlayerModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F172A] border border-[#F5D77F]/40 rounded-3xl w-full max-w-md p-5 shadow-2xl relative text-white space-y-4">
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <h3 className="text-sm font-black text-[#F5D77F] flex items-center gap-1.5">
                  <span>➕</span> ADD NEW PLAYER
                </h3>
                <button
                  onClick={() => setShowAddPlayerModal(false)}
                  className="text-gray-400 hover:text-white font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {addPlayerError && (
                <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 font-bold text-center">
                  {addPlayerError}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-gray-400 font-bold mb-1">PLAYER NAME</label>
                  <input
                    type="text"
                    value={addPlayerName}
                    onChange={(e) => setAddPlayerName(e.target.value)}
                    placeholder="Enter player name..."
                    className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 font-bold mb-1">JODI RATE (x)</label>
                    <input
                      type="number"
                      value={addJodiRate}
                      onChange={(e) => setAddJodiRate(e.target.value)}
                      className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-bold mb-1">CROSSING RATE (x)</label>
                    <input
                      type="number"
                      value={addCrossingRate}
                      onChange={(e) => setAddCrossingRate(e.target.value)}
                      className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 font-bold mb-1">HARUF RATE (x)</label>
                    <input
                      type="number"
                      value={addHarufRate}
                      onChange={(e) => setAddHarufRate(e.target.value)}
                      className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-bold mb-1">COMMISSION (%)</label>
                    <input
                      type="number"
                      value={addCommissionPct}
                      onChange={(e) => setAddCommissionPct(e.target.value)}
                      placeholder="e.g. 0 or 5"
                      className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddPlayerModal(false)}
                  className="flex-1 bg-[#1E293B] hover:bg-gray-800 text-gray-300 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveKhaiwalPlayer}
                  className="flex-1 bg-[#00C853] hover:bg-[#00E676] text-white font-black py-2.5 rounded-xl text-xs shadow-lg"
                >
                  Save Player
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDIT KHAIWAL PLAYER */}
        {showEditPlayerModal && editingKhaiwalPlayer && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F172A] border border-[#F5D77F]/40 rounded-3xl w-full max-w-md p-5 shadow-2xl relative text-white space-y-4">
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <h3 className="text-sm font-black text-[#F5D77F] flex items-center gap-1.5">
                  <span>✏️</span> EDIT PLAYER DETAILS
                </h3>
                <button
                  onClick={() => {
                    setShowEditPlayerModal(false);
                    setEditingKhaiwalPlayer(null);
                  }}
                  className="text-gray-400 hover:text-white font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-gray-400 font-bold mb-1">PLAYER NAME</label>
                  <input
                    type="text"
                    value={editPlayerName}
                    onChange={(e) => setEditPlayerName(e.target.value)}
                    className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 font-bold mb-1">JODI RATE (x)</label>
                    <input
                      type="number"
                      value={editJodiRate}
                      onChange={(e) => setEditJodiRate(e.target.value)}
                      className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-bold mb-1">CROSSING RATE (x)</label>
                    <input
                      type="number"
                      value={editCrossingRate}
                      onChange={(e) => setEditCrossingRate(e.target.value)}
                      className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 font-bold mb-1">HARUF RATE (x)</label>
                    <input
                      type="number"
                      value={editHarufRate}
                      onChange={(e) => setEditHarufRate(e.target.value)}
                      className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-bold mb-1">COMMISSION (%)</label>
                    <input
                      type="number"
                      value={editCommissionPct}
                      onChange={(e) => setEditCommissionPct(e.target.value)}
                      className="w-full bg-[#162238] border border-gray-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-[#F5D77F]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowEditPlayerModal(false);
                    setEditingKhaiwalPlayer(null);
                  }}
                  className="flex-1 bg-[#1E293B] hover:bg-gray-800 text-gray-300 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateKhaiwalPlayer}
                  className="flex-1 bg-[#00C853] hover:bg-[#00E676] text-white font-black py-2.5 rounded-xl text-xs shadow-lg"
                >
                  Update Player
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DELETE KHAIWAL PLAYER */}
        {showDeletePlayerModal && deletingKhaiwalPlayer && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F172A] border border-red-500/40 rounded-3xl w-full max-w-sm p-5 shadow-2xl relative text-white space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center text-xl mx-auto">
                🗑️
              </div>
              <div>
                <h3 className="text-base font-black text-white">Delete Player?</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to delete <strong className="text-red-400">{deletingKhaiwalPlayer.name}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeletePlayerModal(false);
                    setDeletingKhaiwalPlayer(null);
                  }}
                  className="flex-1 bg-[#1E293B] hover:bg-gray-800 text-gray-300 font-bold py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteKhaiwalPlayer}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-2 rounded-xl text-xs shadow-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: KHAIWAL LIVE MARKET SELECTOR */}
        {showKhaiwalMarketSelectModal && activeKhaiwalBetPlayer && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F172A] border border-[#F5D77F]/40 rounded-3xl w-full max-w-md p-5 shadow-2xl relative text-white space-y-4">
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <div>
                  <p className="text-[10px] font-bold text-[#F5D77F] uppercase tracking-wider">SELECT OPEN MARKET</p>
                  <h3 className="text-sm font-black text-white">Placing bet for {activeKhaiwalBetPlayer.name}</h3>
                </div>
                <button
                  onClick={() => setShowKhaiwalMarketSelectModal(false)}
                  className="text-gray-400 hover:text-white font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Filter ONLY Live / Open Markets */}
              {(() => {
                const ALL_GAMES = ["Shiv Parwati", "Delhi Bazar", "Dubai Market", "Shree Ganesh", "Faridabad", "Ghaziabad", "Gali", "Desawar"];
                const openGames = ALL_GAMES.filter((gName) => isGameBettingOpen(gName, gameSchedules[gName]));

                if (openGames.length === 0) {
                  return (
                    <div className="text-center py-6 bg-[#162238] rounded-2xl border border-gray-800 text-gray-400 text-xs font-semibold">
                      No markets are currently open for betting. Check back later!
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {openGames.map((gName) => {
                      const sched = gameSchedules[gName] || DEFAULT_SCHEDULES[gName];
                      const remainingMins = getRemainingMinutesToClose(gName, sched);
                      return (
                        <button
                          key={gName}
                          onClick={() => {
                            setSelectedGameForBetting(gName);
                            setShowKhaiwalMarketSelectModal(false);
                            setShowKhaiwalModal(false);
                            setActiveWebTab('home');
                          }}
                          className="w-full bg-[#162238] hover:bg-[#1E293B] border border-gray-800 hover:border-[#F5D77F] rounded-xl p-3 flex justify-between items-center transition-all group"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg">{getGameIcon(gName)}</span>
                            <span className="font-extrabold text-white text-xs group-hover:text-[#F5D77F]">{gName}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] bg-green-500/20 text-green-300 font-bold px-2 py-0.5 rounded-full border border-green-500/40">
                              OPEN ({remainingMins}m left)
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Company Details Modal */}
        {selectedDetailGame && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-gradient-to-b from-[#1E293B] to-[#0F172A] border-2 border-[#D4AF37]/60 rounded-3xl p-6 shadow-2xl relative text-center text-white">
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-3">
                <span className="text-xs font-bold text-slate-400">Company details</span>
                <button
                  onClick={() => setSelectedDetailGame(null)}
                  className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 hover:text-white flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Game Name */}
              <h3 className="text-2xl font-black text-[#FFE485] tracking-wide mb-3">
                {selectedDetailGame}
              </h3>

              {/* Hexagon Logo */}
              <div className="w-24 h-24 mx-auto relative flex items-center justify-center my-2">
                <svg viewBox="0 0 100 100" className="w-full h-full text-yellow-500 fill-[#0F172A] stroke-[#D4AF37] stroke-[4]">
                  <polygon points="50 3, 93 25, 93 75, 50 97, 7 75, 7 25" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-4xl">
                  {getGameIcon(selectedDetailGame)}
                </span>
              </div>

              {/* Schedule Info Box */}
              {(() => {
                const sched = gameSchedules[selectedDetailGame] || gameSchedules[selectedDetailGame === 'Desawar' ? 'Disawer' : selectedDetailGame === 'Shree Ganesh' ? 'Shri Ganesh' : selectedDetailGame];
                const openT = sched?.open || (selectedDetailGame === 'Desawar' || selectedDetailGame === 'Disawer' ? '12:00 PM IST' : '04:00 AM IST');
                const closeT = sched?.close || '12:00 PM IST';
                const resT = sched?.result || '12:40 PM IST';

                return (
                  <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl p-4 text-xs space-y-3 text-left my-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-400">Game Open Time :</span>
                      <span className="font-extrabold text-white font-mono">{openT}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-400">Game Close Time :</span>
                      <span className="font-extrabold text-white font-mono">{closeT}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-400">Game Result Time :</span>
                      <span className="font-extrabold text-white font-mono">{resT}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
