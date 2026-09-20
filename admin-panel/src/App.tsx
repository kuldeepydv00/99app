import React, { useState, useEffect, useRef } from 'react';

// API Base URL

const safeToISO = (val: any) => {
  if (!val) return new Date().toISOString();
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (e) {}
  return new Date().toISOString();
};

const parseToTimestamp = (d: any, id?: any, userCreated?: any): number => {
  if (!d && !id) return 0;
  if (typeof d === 'number' && !isNaN(d) && d > 0) {
    return d < 10000000000 ? d * 1000 : d;
  }
  const str = String(d || '').trim();
  if (/^\d{10,13}$/.test(str)) {
    const num = parseInt(str, 10);
    return num < 10000000000 ? num * 1000 : num;
  }

  // Full ISO datetime with T or space
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(str)) {
    const t = new Date(str.replace(' ', 'T')).getTime();
    if (!isNaN(t)) return t;
  }

  // DD/MM/YYYY or DD-MM-YYYY with optional time
  const matchDMY = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?)?/i);
  if (matchDMY) {
    let [_, day, month, year, hr, min, sec, ampm] = matchDMY;
    let h = hr ? parseInt(hr, 10) : 0;
    if (ampm && ampm.toUpperCase() === 'PM' && h < 12) h += 12;
    if (ampm && ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    const t = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), h, min ? parseInt(min, 10) : 0, sec ? parseInt(sec, 10) : 0).getTime();
    if (!isNaN(t)) return t;
  }

  // Time-only string e.g. 10:35:53 am or 11:16 AM
  const matchTime = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?/i);
  if (matchTime) {
    let [_, hr, min, sec, ampm] = matchTime;
    let h = parseInt(hr, 10);
    if (ampm && ampm.toUpperCase() === 'PM' && h < 12) h += 12;
    if (ampm && ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    const base = userCreated ? new Date(userCreated) : new Date();
    const validBase = isNaN(base.getTime()) ? new Date() : base;
    return new Date(validBase.getFullYear(), validBase.getMonth(), validBase.getDate(), h, parseInt(min, 10), sec ? parseInt(sec, 10) : 0).getTime();
  }

  // Check 24-character hexadecimal MongoDB ObjectId in id or d
  const targetId = (id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) ? id :
                   (typeof d === 'string' && /^[0-9a-fA-F]{24}$/.test(d) ? d : null);
  if (targetId) {
    const epochSec = parseInt(targetId.substring(0, 8), 16);
    if (epochSec > 1600000000 && epochSec < 2500000000) return epochSec * 1000;
  }

  // Check 13-digit timestamp in id
  if (id) {
    const numMatch = String(id).match(/(\d{13})/);
    if (numMatch) {
      const epoch = parseInt(numMatch[1], 10);
      if (epoch > 1600000000000 && epoch < 2500000000000) return epoch;
    }
  }

  // Date-only string YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const t = new Date(str + 'T00:00:00').getTime();
    if (!isNaN(t)) return t;
  }

  const fallback = new Date(str).getTime();
  return isNaN(fallback) ? 0 : fallback;
};

const formatDisplayDate = (d: any, id?: any, fallbackDate?: any): string => {
  if (!d && !id) return 'Today';
  const ts = parseToTimestamp(d, id, fallbackDate);
  if (!ts) return d ? String(d) : 'Today';
  const dt = new Date(ts);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  let hours = dt.getHours();
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hrStr = String(hours).padStart(2, '0');
  return `${day}/${month}/${year} ${hrStr}:${minutes} ${ampm}`;
};



const API_BASE = typeof window !== 'undefined' ? (window.location.origin.includes('localhost') ? 'http://localhost:5002' : window.location.origin) : 'https://newmatkadomain.com';

// Canvas Chart Component for Deposits, Withdraws, etc.
function CanvasChart({ title, color, dataPoints, chartType, labels }: { title: string; color: string; dataPoints: number[]; chartType: string; labels?: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 20, width - 60, height - 55);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Amount (₹)', 0, 0);
    ctx.restore();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px sans-serif';
    ctx.fillText('99xmatka Analytics', 40, height - 8);
    ctx.fillText('Live Dashboard', width - 110, height - 8);

    const paddingLeft = 50;
    const paddingBottom = 45;
    const chartWidth = width - 70;
    const chartHeight = height - 70;

    const points = (dataPoints && dataPoints.length > 0) ? dataPoints : [0, 0, 0, 0, 0, 0];
    const maxVal = Math.max(...points, 100);
    const stepX = chartWidth / (points.length - 1);
    const defaultLabels = ['12 AM-4 AM', '4 AM-8 AM', '8 AM-12 PM', '12 PM-4 PM', '4 PM-8 PM', '8 PM-12 AM'];
    const xLabels = (labels && labels.length === points.length) ? labels : defaultLabels;

    if (chartType === 'column' || chartType === 'bar') {
      const barWidth = (chartWidth / points.length) * 0.45;
      points.forEach((val, i) => {
        const barH = (val / maxVal) * chartHeight;
        const x = paddingLeft + i * (chartWidth / points.length) + 15;
        const y = height - paddingBottom - barH;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, barWidth, Math.max(2, barH));

        // Label below
        ctx.fillStyle = '#64748B';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(xLabels[i] || '', x + barWidth / 2, height - paddingBottom + 16);

        // Value on top if > 0
        if (val > 0) {
          ctx.fillStyle = '#1E293B';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`₹${val}`, x + barWidth / 2, y - 5);
        }
      });
    } else {
      ctx.beginPath();
      points.forEach((val, i) => {
        const x = paddingLeft + i * stepX;
        const y = height - paddingBottom - (val / maxVal) * chartHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      points.forEach((val, i) => {
        const x = paddingLeft + i * stepX;
        const y = height - paddingBottom - (val / maxVal) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label below
        ctx.fillStyle = '#64748B';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(xLabels[i] || '', x, height - paddingBottom + 16);

        // Value on top if > 0
        if (val > 0) {
          ctx.fillStyle = '#1E293B';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`₹${val}`, x, Math.max(15, y - 8));
        }
      });
    }
  }, [dataPoints, color, chartType, labels]);

  return (
    <div className="bg-white rounded-lg border border-[#DEE2E6] shadow-sm p-4 text-center">
      <h2 className="text-2xl font-bold text-[#212529] mb-4">{title}</h2>
      <div className="w-full flex justify-center">
        <canvas ref={canvasRef} width={700} height={280} className="w-full max-w-3xl h-auto" />
      </div>
    </div>
  );
}

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('admin_authenticated') === 'true';
  });
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState('');

  // Active Tab State
  const [activeTab, setActiveTabRaw] = useState<
    'dashboard' | 'admins' | 'users' | 'userChange' | 'gameLedger' | 'wallets' |
    'walletTransactions' | 'deposits' | 'withdraws' | 'commission' |
    'leaderboard' | 'payouts' | 'banners' | 'referral' | 'packages' | 'paymentMethods' | 'pushNotifications' | 'settings' |
    'userDetails' | 'userEdit' | 'bids' | 'results' | 'winnings' | 'gameHistory' | 'categories'
  >(() => {
    const saved = localStorage.getItem('adminActiveTab');
    const validTabs = ['dashboard', 'admins', 'users', 'userChange', 'gameLedger', 'wallets', 'walletTransactions', 'deposits', 'withdraws', 'commission', 'leaderboard', 'payouts', 'banners', 'referral', 'packages', 'paymentMethods', 'pushNotifications', 'settings', 'bids', 'results', 'winnings', 'gameHistory', 'categories'];
    return (saved && validTabs.includes(saved)) ? saved as any : 'dashboard';
  });
  const setActiveTab = (tab: any) => { localStorage.setItem('adminActiveTab', tab); setActiveTabRaw(tab); };
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Live Players state for User Change module
  const [livePlayers, setLivePlayers] = useState<{ [key: string]: number | string }>({
    "Shiv Parwati": 487556,
    "Delhi Bazar": 614919,
    "Dubai Market": 452810,
    "Shree Ganesh": 392152,
    "Faridabad": 345825,
    "Ghaziabad": 298700,
    "Gali": 512400,
    "Desawar": 684200
  });
  const [savingLivePlayers, setSavingLivePlayers] = useState(false);

  // Fetch live players count once on entering userChange tab
  useEffect(() => {
    if (activeTab === 'userChange') {
      fetch(`${API_BASE}/api/admin/live-players`)
        .then(res => res.json())
        .then(data => {
          if (data && data.data) setLivePlayers(data.data);
        })
        .catch(() => {});
    }
  }, [activeTab]);

  // Matka Game Header Dropdown Open State
  const [matkaDropdownOpen, setMatkaDropdownOpen] = useState(false);

  // User View Navigation State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetailsTab, setUserDetailsTab] = useState<'profile' | 'bankDetails' | 'walletTransaction' | 'gameHistory' | 'referHistory' | 'gameLedger'>('profile');

  // Sidebar Open State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Table Page Entries Limit
  const [entriesPerPage, setEntriesPerPage] = useState('10');

  // Dashboard Filters & Calendar System
  const getTodayISTString = () => {
    const now = new Date();
    const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const d = String(ist.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [dashboardStartDate, setDashboardStartDate] = useState<string>(getTodayISTString);
  const [dashboardEndDate, setDashboardEndDate] = useState<string>(getTodayISTString);
  const dashboardStartDateRef = useRef<string>(getTodayISTString());
  const dashboardEndDateRef = useRef<string>(getTodayISTString());
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [graphStartDate, setGraphStartDate] = useState(() => {
    const s = getTodayISTString().split('-');
    return `${s[2]}-${s[1]}-${s[0]}`;
  });
  const [graphEndDate, setGraphEndDate] = useState(() => {
    const s = getTodayISTString().split('-');
    return `${s[2]}-${s[1]}-${s[0]}`;
  });
  const [chartType, setChartType] = useState<'line' | 'column' | 'bar' | 'pie' | 'doughnut'>('line');

  // Generic Filter Bar Input States
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterGameType, setFilterGameType] = useState('All');
  const [filterTxnType, setFilterTxnType] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchNumberInput, setSearchNumberInput] = useState('');

  // Smart Date Matching Helper to prevent date format mismatch
  const isDateInRange = (recordDate?: string, startDateStr?: string, endDateStr?: string) => {
    if (!recordDate) return false;
    const rDate = new Date(recordDate);
    if (isNaN(rDate.getTime())) return true;
    
    rDate.setHours(0,0,0,0);
    
    const parseFilterDate = (dStr: string) => {
      const parts = dStr.trim().split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
        return new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
      }
      return new Date(dStr);
    };

    const hasStart = Boolean(startDateStr && startDateStr.trim());
    const hasEnd = Boolean(endDateStr && endDateStr.trim());

    // Single-date filter: If user selects only Start Date, match records strictly on that date!
    if (hasStart && !hasEnd) {
      const sDate = parseFilterDate(startDateStr!);
      return !isNaN(sDate.getTime()) && rDate.getTime() === sDate.getTime();
    }
    
    // Single-date filter: If user selects only End Date, match records strictly on that date!
    if (!hasStart && hasEnd) {
      const eDate = parseFilterDate(endDateStr!);
      return !isNaN(eDate.getTime()) && rDate.getTime() === eDate.getTime();
    }

    if (hasStart) {
      const sDate = parseFilterDate(startDateStr!);
      if (!isNaN(sDate.getTime()) && rDate < sDate) return false;
    }
    
    if (hasEnd) {
      const eDate = parseFilterDate(endDateStr!);
      if (!isNaN(eDate.getTime()) && rDate > eDate) return false;
    }
    
    return true;
  };

  // Applied Active Filter States (Triggered by clicking Search button or submitting filter form)
  const [appliedCategory, setAppliedCategory] = useState('All');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedGameType, setAppliedGameType] = useState('All');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedSearchNumber, setAppliedSearchNumber] = useState('');

  // Search & Clear Handlers
  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedCategory(filterCategory);
    setAppliedSearch(filterSearch);
    setAppliedGameType(filterGameType);
    setAppliedStartDate(filterStartDate);
    setAppliedEndDate(filterEndDate);
    setAppliedSearchNumber(searchNumberInput);
  };

  const handleClearFilters = () => {
    setFilterSearch('');
    setFilterCategory('All');
    setFilterGameType('All');
    setFilterTxnType('All');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchNumberInput('');

    setAppliedCategory('All');
    setAppliedSearch('');
    setAppliedGameType('All');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setAppliedSearchNumber('');
  };

  // Data Lists State (Populated dynamically from live backend API)
  const [stats, setStats] = useState<any>({});

  const fetchDashboardStats = async (start?: string, end?: string) => {
    try {
      setStatsLoading(true);
      const s = start || dashboardStartDateRef.current;
      const e = end || dashboardEndDateRef.current;
      const res = await fetch(`${API_BASE}/api/admin/stats?startDate=${s}&endDate=${e}`);
      if (res.ok) {
        const data = await res.json();
        if (data.startDate === dashboardStartDateRef.current && data.endDate === dashboardEndDateRef.current) {
          setStats(data);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard stats for date range', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    let newEnd = dashboardEndDateRef.current;
    if (newStart > newEnd) {
      newEnd = newStart;
    }
    dashboardStartDateRef.current = newStart;
    dashboardEndDateRef.current = newEnd;
    setDashboardStartDate(newStart);
    setDashboardEndDate(newEnd);
    const sParts = newStart.split('-');
    const eParts = newEnd.split('-');
    if (sParts.length === 3) setGraphStartDate(`${sParts[2]}-${sParts[1]}-${sParts[0]}`);
    if (eParts.length === 3) setGraphEndDate(`${eParts[2]}-${eParts[1]}-${eParts[0]}`);
    fetchDashboardStats(newStart, newEnd);
  };

  const handleEndDateChange = (newEnd: string) => {
    if (!newEnd) return;
    let newStart = dashboardStartDateRef.current;
    if (newEnd < newStart) {
      newStart = newEnd;
    }
    dashboardStartDateRef.current = newStart;
    dashboardEndDateRef.current = newEnd;
    setDashboardStartDate(newStart);
    setDashboardEndDate(newEnd);
    const sParts = newStart.split('-');
    const eParts = newEnd.split('-');
    if (sParts.length === 3) setGraphStartDate(`${sParts[2]}-${sParts[1]}-${sParts[0]}`);
    if (eParts.length === 3) setGraphEndDate(`${eParts[2]}-${eParts[1]}-${eParts[0]}`);
    fetchDashboardStats(newStart, newEnd);
  };

  const handleSetRange = (s: string, e: string) => {
    dashboardStartDateRef.current = s;
    dashboardEndDateRef.current = e;
    setDashboardStartDate(s);
    setDashboardEndDate(e);
    const sParts = s.split('-');
    const eParts = e.split('-');
    if (sParts.length === 3) setGraphStartDate(`${sParts[2]}-${sParts[1]}-${sParts[0]}`);
    if (eParts.length === 3) setGraphEndDate(`${eParts[2]}-${eParts[1]}-${eParts[0]}`);
    fetchDashboardStats(s, e);
  };

  const handleDashboardSetToday = () => {
    const today = getTodayISTString();
    handleSetRange(today, today);
  };

  const handleDashboardSetYesterday = () => {
    const cur = new Date();
    const ist = new Date(cur.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    ist.setDate(ist.getDate() - 1);
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const d = String(ist.getDate()).padStart(2, '0');
    const yest = `${y}-${m}-${d}`;
    handleSetRange(yest, yest);
  };

  const handleDashboardSetLast7Days = () => {
    const today = getTodayISTString();
    const cur = new Date();
    const ist = new Date(cur.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    ist.setDate(ist.getDate() - 6);
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const d = String(ist.getDate()).padStart(2, '0');
    const past7 = `${y}-${m}-${d}`;
    handleSetRange(past7, today);
  };

  const handleDashboardSetThisMonth = () => {
    const today = getTodayISTString();
    const cur = new Date();
    const ist = new Date(cur.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const y = ist.getFullYear();
    const m = String(ist.getMonth() + 1).padStart(2, '0');
    const startMonth = `${y}-${m}-01`;
    handleSetRange(startMonth, today);
  };

  const [users, setUsers] = useState<any[]>([]);

  const [gameSchedules, setGameSchedules] = useState<Record<string, any>>({});
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editScheduleForm, setEditScheduleForm] = useState({ open: '', close: '', result: '' });
  
  const [categoriesList, setCategoriesList] = useState<any[]>([
    { id: '1', name: 'Desawar', seniority: 1, image: '', status: 'Active' },
    { id: '8', name: 'Shiv Parwati', seniority: 2, image: '', status: 'Active' },
    { id: '6', name: 'Delhi Bazar', seniority: 3, image: '', status: 'Active' },
    { id: '7', name: 'Dubai Market', seniority: 4, image: '', status: 'Active' },
    { id: '5', name: 'Shree Ganesh', seniority: 5, image: '', status: 'Active' },
    { id: '3', name: 'Faridabad', seniority: 6, image: '', status: 'Active' },
    { id: '4', name: 'Ghaziabad', seniority: 7, image: '', status: 'Active' },
    { id: '2', name: 'Gali', seniority: 8, image: '', status: 'Active' }
  ]);

  const [bidsList, setBidsList] = useState<any[]>([]);
  const [resultsList, setResultsList] = useState<any[]>([]);
  const [editingResult, setEditingResult] = useState<any>(null);
  const [editResultNumber, setEditResultNumber] = useState('');
  const [winningsList, setWinningsList] = useState<any[]>([]);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [bannersList, setBannersList] = useState<any[]>([]);
  const [packagesList, setPackagesList] = useState<any[]>([]);
  const [paymentMethodsList, setPaymentMethodsList] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [gameLedgerList, setGameLedgerList] = useState<any[]>([]);

  // Modals Control
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddBannerModal, setShowAddBannerModal] = useState(false);
  const [showAddPackageModal, setShowAddPackageModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAddResultModal, setShowAddResultModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showViewBidModal, setShowViewBidModal] = useState(false);
  const [viewingBid, setViewingBid] = useState<any>(null);
  const [showEditBidModal, setShowEditBidModal] = useState(false);
  const [editBidForm, setEditBidForm] = useState({ id: '', number: '', amount: 10, category: '', gameType: '', user: '', phone: '' });

  // Game History Breakdown Modal Control
  const [showGameHistoryModal, setShowGameHistoryModal] = useState(false);
  const [selectedGameHistoryCategory, setSelectedGameHistoryCategory] = useState('Desawar');
  const [breakdownSortMode, setBreakdownSortMode] = useState<'numerical' | 'descending'>('numerical');
  const [selectedNumberDetailsModal, setSelectedNumberDetailsModal] = useState<{
    category: string;
    sectionTitle: string;
    numberLabel: string;
    bids: any[];
    totalAmount: number;
  } | null>(null);

  // Edit Item States
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  const [editingPayment, setEditingPayment] = useState<any>(null);

  // Form States
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', phone: '', gender: 'Male', dob: '1995-01-01', address: '', bank_name: '', bank_account_number: '', branch_name: '', ifsc_code: '', upi: '', status: 'Active', initialBalance: '500' });
  const [editUserForm, setEditUserForm] = useState<any>({});
  
  const [bannerForm, setBannerForm] = useState({ name: '', type: 'Image', link: '', image: 'banner1.png', previewUrl: '', status: 'Active' });
  const [packageForm, setPackageForm] = useState({ packageName: '', appName: '', status: 'Active' });
  const [adminForm, setAdminForm] = useState({ name: '', username: '', mobile: '', password: '', role: 'Super Admin', status: 'Active' });
  const [paymentForm, setPaymentForm] = useState<any>({ name: 'PhonePe / GPay / Paytm UPI', upi_id: '8930507940@ybl', merchant_name: 'Matka Official', ordering: 1, status: 'Active' });

  const [resultForm, setResultForm] = useState({ category: 'Desawar', resultDate: new Date().toISOString().split('T')[0], resultNumber: '', reResultNumber: '' });
  const [categoryForm, setCategoryForm] = useState({ type: 'Matka', name: '', status: 'Active', seniority: 1, image: '', previewUrl: '', description: '' });
  const [referralCommissionPct, setReferralCommissionPct] = useState(4);
  const [referralStatus, setReferralStatus] = useState('Active');
  const [referralPromoText, setReferralPromoText] = useState('केवल 5 प्लेइंग यूजर को रिफर करें और पाएं ₹500 बोनस');
  const referralLoadedRef = useRef(false);
  const versionLoadedRef = useRef(false);
  const bannerLoadedRef = useRef(false);

  const [walletTargetUser, setWalletTargetUser] = useState<any>(null);
  const [walletActionType, setWalletActionType] = useState<'add' | 'deduct'>('add');
  const [walletAmtInput, setWalletAmtInput] = useState('500');

  // Settings State
  const settingsLoadedRef = useRef(false);
  const [settingsForm, setSettingsForm] = useState<{
    whatsapp_number: string;
    whatsapp_call_number: string;
    app_download_link: string;
    app_version: string;
    bank_withdrawal_enable: boolean;
    upi_withdrawal_enable: boolean;
    lucky_card_maintenance: boolean;
    jodi_rate: string | number;
    crossing_rate: string | number;
    haroof_rate: string | number;
    ekqr_enabled: boolean;
    ekqr_api_key: string;
    ekqr_webhook_url: string;
    min_deposit: string | number;
    max_deposit: string | number;
    msg91_auth_key?: string;
    msg91_template_id?: string;
    msg91_otp_length?: string | number;
    msg91_otp_expiry?: string | number;
    msg91_enabled?: boolean;
  }>({
    whatsapp_number: '+917206561420',
    whatsapp_call_number: '+917206561420',
    app_download_link: 'https://newmatkadomain.com/99xmatka.apk',
    app_version: '1.0.15',
    bank_withdrawal_enable: true,
    upi_withdrawal_enable: true,
    lucky_card_maintenance: false,
    jodi_rate: 90,
    crossing_rate: 90,
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
  });

  // Dynamic Bet Multiplier Resolution Helper
  const getBetMultiplier = (b: any) => {
    if (b && b.multiplier && !isNaN(Number(b.multiplier)) && Number(b.multiplier) > 0) {
      return Number(b.multiplier);
    }
    if (b && b.potential_payout && b.bet_amount && !isNaN(Number(b.potential_payout)) && !isNaN(Number(b.bet_amount)) && Number(b.bet_amount) > 0) {
      return parseFloat((Number(b.potential_payout) / Number(b.bet_amount)).toFixed(2));
    }
    if (b && b.potential_payout && b.amount && !isNaN(Number(b.potential_payout)) && !isNaN(Number(b.amount)) && Number(b.amount) > 0) {
      return parseFloat((Number(b.potential_payout) / Number(b.amount)).toFixed(2));
    }
    const bType = String(b?.gameType || b?.bet_type || '').toUpperCase();
    const isHaroof = bType.includes('HAR') || bType.includes('ANDER') || bType.includes('BAHAR');
    if (isHaroof) return Number(settingsForm.haroof_rate) || 9.5;
    if (bType.includes('CROSS')) return Number(settingsForm.crossing_rate) || (Number(settingsForm.jodi_rate) || 90);
    return Number(settingsForm.jodi_rate) || 90;
  };



  // Authentication Handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setOtpSentMessage('');
    setAuthLoading(true);

    const ADMIN_EMAIL = 'nedstarkontop@gmail.com';
    const ADMIN_PASS = 'Y2004S143lovE';
    const ADMIN_PHONE = '7206561420';

    if (loginUsername !== ADMIN_EMAIL || loginPassword !== ADMIN_PASS) {
      setAuthError('Invalid email or password');
      setAuthLoading(false);
      return;
    }

    // Credentials valid — send OTP to admin phone
    try {
      const res = await fetch(`${API_BASE}/api/user/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: ADMIN_PHONE })
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setLoginStep(2);
        setOtpSentMessage(`OTP sent to +91 ${ADMIN_PHONE.slice(0, 3)}****${ADMIN_PHONE.slice(-3)}`);
      } else {
        // Fallback - still proceed to OTP step
        setLoginStep(2);
        setOtpSentMessage('OTP sent to registered mobile');
      }
    } catch (err) {
      // If server unreachable, still go to OTP step
      setLoginStep(2);
      setOtpSentMessage('OTP sent to registered mobile');
    } finally {
      setAuthLoading(false);
    }
  };

  // Universal client cycle date resolution for any market
  const getGameCycleDateClient = (categoryName: string, dateInput?: any) => {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return safeToISO(new Date());
    const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (5.5 * 60 * 60 * 1000));
    const curMins = istDate.getHours() * 60 + istDate.getMinutes();

    const sched = (gameSchedules && (gameSchedules[categoryName] || 
      (categoryName === 'Desawar' ? gameSchedules['Disawer'] : 
      (categoryName === 'Disawer' ? gameSchedules['Desawar'] : 
      (categoryName === 'Shree Ganesh' ? gameSchedules['Shri Ganesh'] : 
      (categoryName === 'Shri Ganesh' ? gameSchedules['Shree Ganesh'] : null))))));

    const parseMins = (str?: string) => {
      if (!str) return 0;
      const match = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return 0;
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    if (sched && sched.open && sched.close) {
      const openM = parseMins(sched.open);
      const closeM = parseMins(sched.close);

      if (closeM < openM || categoryName === 'Desawar' || categoryName === 'Disawer') {
        if (curMins >= 300) { // 05:00 AM onwards belongs to tomorrow morning
          const nextDay = new Date(istDate.getTime() + (24 * 60 * 60 * 1000));
          return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
        } else {
          return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
        }
      }

      const resultM = sched.result ? parseMins(sched.result) : closeM;
      const cutoff = Math.max(closeM, resultM);
      if (curMins >= cutoff) {
        const nextDay = new Date(istDate.getTime() + (24 * 60 * 60 * 1000));
        return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
      }
    }

    return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
  };

  // Get market game breakdown totals & per-number stakes
  const getMarketBreakdown = (categoryName: string, startDate?: string, endDate?: string) => {
    const jodiMap: { [key: string]: number } = {};
    const crossMap: { [key: string]: number } = {};
    const haroofAnderMap: { [key: string]: number } = {};
    const haroofBaharMap: { [key: string]: number } = {};

    let jodiTotal = 0;
    let crossTotal = 0;
    let haroofTotal = 0;

    bidsList.forEach(b => {
      if (b.category === categoryName) {
        if (startDate || endDate) {
          const bDate = b.rawDate || b.date || safeToISO(b.created_at);
          if (!isDateInRange(bDate, startDate, endDate)) return;
        }
        const amt = parseFloat(b.amount) || 0;
        const gType = (b.gameType || '').toUpperCase();
        const isHar = gType.includes('HAROOF') || gType.includes('HAROP') || gType.includes('HROPE') || gType.includes('ANDER') || gType.includes('BAHAR') || gType.includes('HARUF');
        const numStr = isHar ? String(b.number !== undefined ? b.number : '0') : String(b.number !== undefined ? b.number : '00').padStart(2, '0');

        if (gType.includes('CROSS')) {
          crossMap[numStr] = (crossMap[numStr] || 0) + amt;
          crossTotal += amt;
        } else if (isHar) {
          const digitNum = parseInt(numStr) % 10;
          if (gType.includes('BAHAR') || gType.includes('HAROOF_B')) {
            const digit = `B${digitNum}`;
            haroofBaharMap[digit] = (haroofBaharMap[digit] || 0) + amt;
          } else {
            const digit = `A${digitNum}`;
            haroofAnderMap[digit] = (haroofAnderMap[digit] || 0) + amt;
          }
          haroofTotal += amt;
        } else {
          jodiMap[numStr] = (jodiMap[numStr] || 0) + amt;
          jodiTotal += amt;
        }
      }
    });

    const totalInvestment = jodiTotal + crossTotal + haroofTotal;

    // Match declared winning result specifically for the cycle date being viewed
    let targetCycleDate = startDate;
    if (!targetCycleDate) {
      targetCycleDate = getGameCycleDateClient(categoryName, new Date());
    }

    const matchedResult = resultsList.find(r => {
      const isGameMatch = (r.category === categoryName) ||
        (categoryName === 'Desawar' && r.category === 'Disawer') ||
        (categoryName === 'Disawer' && r.category === 'Desawar') ||
        (categoryName === 'Shree Ganesh' && r.category === 'Shri Ganesh') ||
        (categoryName === 'Shri Ganesh' && r.category === 'Shree Ganesh');
      if (!isGameMatch) return false;
      const rDateStr = r.date || safeToISO(r.rawDate || r.createdAt || r.created_at);
      return rDateStr === targetCycleDate;
    });
    const winningNumStr = (matchedResult && matchedResult.resultNumber !== undefined) ? String(matchedResult.resultNumber).padStart(2, '0') : null;
    const winningAnderDigit = winningNumStr ? `A${winningNumStr.charAt(0)}` : null;
    const winningBaharDigit = winningNumStr ? `B${winningNumStr.charAt(1)}` : null;

    const activeJodiRate = Number(settingsForm.jodi_rate) || 90;
    const activeCrossRate = Number(settingsForm.crossing_rate) || 90;
    const activeHaroofRate = Number(settingsForm.haroof_rate) || 9.5;

    const jodiWinTotal = winningNumStr ? (jodiMap[winningNumStr] || 0) * activeJodiRate : 0;
    const crossWinTotal = winningNumStr ? (crossMap[winningNumStr] || 0) * activeCrossRate : 0;
    const haroofWinTotal = (winningAnderDigit && winningBaharDigit)
      ? (((haroofAnderMap[winningAnderDigit] || 0) * activeHaroofRate) + ((haroofBaharMap[winningBaharDigit] || 0) * activeHaroofRate))
      : 0;
    const totalWinningAmount = jodiWinTotal + crossWinTotal + haroofWinTotal;

    return {
      jodiMap,
      crossMap,
      haroofAnderMap,
      haroofBaharMap,
      jodiTotal,
      crossTotal,
      haroofTotal,
      totalInvestment,
      winningNumStr,
      winningAnderDigit,
      winningBaharDigit,
      jodiWinTotal,
      crossWinTotal,
      haroofWinTotal,
      totalWinningAmount
    };
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const ADMIN_PHONE = '7206561420';

    try {
      const res = await fetch(`${API_BASE}/api/user/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: ADMIN_PHONE, otp: loginOtp })
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setIsAuthenticated(true);
        localStorage.setItem('admin_authenticated', 'true');
        setStatusMessage('Welcome back, Admin!');
      } else {
        setAuthError(data.message || 'Invalid OTP. Please check your SMS.');
      }
    } catch (err) {
      setAuthError('Failed to verify OTP. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin_authenticated');
    setLoginStep(1);
  };

  // Fetch Live Data
  const fetchLiveData = async () => {
    try {
      const curStart = dashboardStartDateRef.current;
      const curEnd = dashboardEndDateRef.current;
      const [
        statsRes, usersRes, adminsRes, depRes, wdRes, bidsRes, winRes, pmRes, notifRes, bannerRes, versionRes, settingsRes, bannersListRes, resultsRes
      , schedRes, referralRes, lpRes, ledgerRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats?startDate=${curStart}&endDate=${curEnd}`),
        fetch(`${API_BASE}/api/admin/users`),
        fetch(`${API_BASE}/api/admin/admins`),
        fetch(`${API_BASE}/api/admin/deposits`),
        fetch(`${API_BASE}/api/admin/withdrawals`),
        fetch(`${API_BASE}/api/admin/bets`),
        fetch(`${API_BASE}/api/admin/winnings`),
        fetch(`${API_BASE}/api/admin/payment-methods`),
        fetch(`${API_BASE}/api/admin/notifications`),
        fetch(`${API_BASE}/api/game/banner`),
        fetch(`${API_BASE}/api/app/version`),
        fetch(`${API_BASE}/api/app/settings`),
        fetch(`${API_BASE}/api/admin/banners`),
        fetch(`${API_BASE}/api/admin/results-history`),
        fetch(`${API_BASE}/api/game/schedules`),
        fetch(`${API_BASE}/api/admin/referral-config`),
        fetch(`${API_BASE}/api/admin/live-players`),
        fetch(`${API_BASE}/api/admin/game-ledger`)
      ]);

      if (ledgerRes && ledgerRes.ok) {
        try {
          const lData = await ledgerRes.json();
          if (Array.isArray(lData)) setGameLedgerList(lData);
        } catch (e) {}
      }

      if (lpRes && lpRes.ok) {
        try {
          const lpData = await lpRes.json();
          if (lpData && lpData.data && activeTabRef.current !== 'userChange') {
            setLivePlayers(lpData.data);
          }
        } catch (e) {}
      }

      if (statsRes.ok) {
        const sData = await statsRes.json();
        if (sData.startDate === dashboardStartDateRef.current && sData.endDate === dashboardEndDateRef.current) {
          setStats(sData);
        }
      }
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        if (Array.isArray(notifData)) setNotificationsList(notifData);
      }
      if (schedRes && schedRes.ok) setGameSchedules(await schedRes.json());

      if (referralRes && referralRes.ok) {
        try {
          const rData = await referralRes.json();
          if (rData && !referralLoadedRef.current) {
            referralLoadedRef.current = true;
            if (rData.commissionPercentage !== undefined) {
              setReferralCommissionPct(Number(rData.commissionPercentage) || 4);
            }
            if (rData.promoText !== undefined) {
              setReferralPromoText(rData.promoText);
            }
            if (rData.status !== undefined) {
              setReferralStatus(rData.status);
            } else if (rData.enabled !== undefined) {
              setReferralStatus(rData.enabled ? 'Active' : 'Deactive');
            }
          }
        } catch (e) {}
      }
      
      if (versionRes && versionRes.ok) {
        try {
          const vData = await versionRes.json();
          if (vData && !versionLoadedRef.current) {
            versionLoadedRef.current = true;
            setAppVersionForm({
              latestVersionCode: vData.latestVersionCode !== undefined ? vData.latestVersionCode : 1,
              latestVersionName: vData.latestVersionName || 'v1.0.0',
              apkUrl: vData.apkUrl || 'https://newmatkadomain.com/99xmatka.apk',
              updateMessage: vData.updateMessage || '🚀 A new performance update is available! Tap Update now to get the latest features.',
              forceUpdate: vData.forceUpdate !== undefined ? vData.forceUpdate : false
            });
          }
        } catch (e) {}
      }
      if (settingsRes && settingsRes.ok) {
        try {
          const sData = await settingsRes.json();
          if (sData && !settingsLoadedRef.current) {
            settingsLoadedRef.current = true;
            setSettingsForm({
              whatsapp_number: sData.whatsapp_number || '+917206561420',
              whatsapp_call_number: sData.whatsapp_call_number || '+917206561420',
              app_download_link: sData.app_download_link || 'https://newmatkadomain.com/99xmatka.apk',
              app_version: sData.app_version || '1.0.0',
              bank_withdrawal_enable: sData.bank_withdrawal_enable !== undefined ? sData.bank_withdrawal_enable : true,
              upi_withdrawal_enable: sData.upi_withdrawal_enable !== undefined ? sData.upi_withdrawal_enable : true,
              lucky_card_maintenance: sData.lucky_card_maintenance !== undefined ? sData.lucky_card_maintenance : false,
              jodi_rate: sData.jodi_rate !== undefined ? sData.jodi_rate : 90,
              crossing_rate: sData.crossing_rate !== undefined ? sData.crossing_rate : 90,
              haroof_rate: sData.haroof_rate !== undefined ? sData.haroof_rate : 9.5,
              ekqr_enabled: sData.ekqr_enabled !== undefined ? sData.ekqr_enabled : true,
              ekqr_api_key: sData.ekqr_api_key || '8f12c3ab-b6d9-4e75-b116-a7de230f0d83',
              ekqr_webhook_url: sData.ekqr_webhook_url || 'https://newmatkadomain.com/api/payment/ekqr/webhook',
              min_deposit: sData.min_deposit !== undefined ? sData.min_deposit : 100,
              max_deposit: sData.max_deposit !== undefined ? sData.max_deposit : 50000,
              msg91_auth_key: sData.msg91_auth_key || '566370AIKfwtcrpvh6aa17ef3P1',
              msg91_template_id: sData.msg91_template_id || '6aa1635ed61d0b5f8e0551e2',
              msg91_otp_length: sData.msg91_otp_length !== undefined ? sData.msg91_otp_length : 4,
              msg91_otp_expiry: sData.msg91_otp_expiry !== undefined ? sData.msg91_otp_expiry : 10,
              msg91_enabled: sData.msg91_enabled !== undefined ? sData.msg91_enabled : true
            });
          }
        } catch (e) {}
      }
      let activeBannerData = null;
      if (bannerRes && bannerRes.ok) {
        try {
          activeBannerData = await bannerRes.json();
          if (activeBannerData && !bannerLoadedRef.current) {
            bannerLoadedRef.current = true;
            setBannerGlobalForm({
              title: activeBannerData.title || '',
              subtitle: activeBannerData.subtitle || '',
              referralText: activeBannerData.referralText || '',
              commissionText: activeBannerData.commissionText || '',
              minDeposit: activeBannerData.minDeposit || '100',
              minWithdrawal: activeBannerData.minWithdrawal || '300',
              imageUrl: activeBannerData.imageUrl || '',
              enabled: activeBannerData.enabled !== undefined ? activeBannerData.enabled : true
            });
          }
        } catch (e) {}
      }
      if (bannersListRes && bannersListRes.ok) {
        try {
          const blData = await bannersListRes.json();
          if (Array.isArray(blData) && blData.length > 0) {
            setBannersList(blData);
          } else if (activeBannerData && activeBannerData.imageUrl) {
            setBannersList([{
              id: 'active_banner',
              name: activeBannerData.title || 'Active Banner',
              type: 'Image',
              link: activeBannerData.imageUrl,
              image: '',
              previewUrl: activeBannerData.imageUrl,
              status: activeBannerData.enabled ? 'Active' : 'Inactive'
            }]);
          }
        } catch (e) {}
      }
      if (pmRes.ok) {
        const pmData = await pmRes.json();
        if (Array.isArray(pmData) && pmData.length > 0) setPaymentMethodsList(pmData);
      } else {
        try {
          const altRes = await fetch(`${API_BASE}/api/payment-methods`);
          if (altRes.ok) {
            const pmData = await altRes.json();
            if (Array.isArray(pmData) && pmData.length > 0) setPaymentMethodsList(pmData);
          }
        } catch (e) {}
      }
      if (usersRes.ok) {
        const uList = await usersRes.json();
        if (Array.isArray(uList)) {
          setUsers(uList);
        }
      }
      if (adminsRes.ok) {
        const aList = await adminsRes.json();
        if (Array.isArray(aList) && aList.length > 0) setAdminsList(aList);
      }
      if (depRes.ok) setDeposits(await depRes.json());
      if (wdRes.ok) setWithdrawals(await wdRes.json());
      if (winRes.ok) {
        const wData = await winRes.json();
        if (Array.isArray(wData) && wData.length > 0) setWinningsList(wData);
      }
      if (bidsRes.ok) {
        const rawBids = await bidsRes.json();
        if (Array.isArray(rawBids)) {
          const formatted = rawBids.map((b: any, idx: number) => {
            const gType = String(b.bet_type || b.gameType || 'jodi').toUpperCase();
            const isHaroof = gType.includes('HAR') || gType.includes('ANDER') || gType.includes('BAHAR');
            const numStr = isHaroof 
              ? String(b.number !== undefined ? b.number : '0') 
              : (String(b.number) === '0' || String(b.number) === '100' ? '00' : String(b.number !== undefined ? b.number : '00').padStart(2, '0'));
            
            let cycleDate = b.date_key || b.createdDateKey;
            const gameName = b.game_name || b.category || '';

            if (!cycleDate && b.created_at) {
              cycleDate = getGameCycleDateClient(gameName, b.created_at);
            }

            return {
              id: b._id || b.id || `bid_${idx}_${Date.now()}`,
              date: b.created_at ? new Date(b.created_at).toLocaleString() : '2026-08-29 09:51:51',
              rawDate: cycleDate, // Cycle date key for filtering & breakdowns
              cycleDate: cycleDate,
              date_key: cycleDate,
              created_at: b.created_at,
              user: b.user || b.username || 'User',
              phone: b.mobile || (b.user && b.user.includes('(') ? b.user.split('(')[1].replace(')', '') : '7206561420'),
              category: b.game_name || b.category || 'Delhi Bazar',
              gameType: b.bet_type || b.gameType || 'jodi',
              number: numStr,
              amount: b.bet_amount || b.amount || 10,
              bet_amount: b.bet_amount || b.amount || 10,
              multiplier: b.multiplier,
              potential_payout: b.potential_payout,
              win_amount: b.win_amount || b.winAmount || 0,
              winAmount: b.win_amount || b.winAmount || 0,
              status: b.status === 'won' ? 'Won' : (b.status === 'lost' ? 'Lost' : 'Pending')
            };
          });
          setBidsList(formatted);
        }
      }
      if (resultsRes && resultsRes.ok) {
        const rData = await resultsRes.json();
        if (Array.isArray(rData)) {
          const canonicalMap: { [k: string]: string } = {
            'disawer': 'Desawar',
            'desawar': 'Desawar',
            'shri ganesh': 'Shree Ganesh',
            'shree ganesh': 'Shree Ganesh',
            'faridabad': 'Faridabad',
            'ghaziabad': 'Ghaziabad',
            'gali': 'Gali',
            'dubai market': 'Dubai Market',
            'delhi bazar': 'Delhi Bazar',
            'shiv parwati': 'Shiv Parwati'
          };
          const seen = new Set<string>();
          const mappedResults: any[] = [];
          for (const r of rData) {
            const rawCat = (r.game_name || r.category || '').trim();
            const lowCat = rawCat.toLowerCase();
            const cat = canonicalMap[lowCat] || rawCat;
            const dateStr = r.date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A');
            const key = `${cat}_${dateStr}`;
            if (seen.has(key)) continue;
            seen.add(key);
            mappedResults.push({
              id: r._id || r.id || `res_${cat}_${dateStr}`,
              date: dateStr,
              rawDate: safeToISO(r.rawDate || r.created_at || r.date),
              category: cat,
              resultNumber: String(r.number || r.resultNumber || '00').padStart(2, '0'),
              createdAt: r.createdAt || (r.created_at ? new Date(r.created_at).toLocaleString() : 'N/A'),
              resultBy: r.declared_by || r.resultBy || 'Admin'
            });
          }
          setResultsList(mappedResults);
        }
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchLiveData();
      const interval = setInterval(fetchLiveData, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // EDIT BID NUMBER HANDLER
  const handleDeleteBid = async (b: any) => {
    if (!confirm(`Are you sure you want to delete bid for ${b.number}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/bids/${b.id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setBidsList(prev => prev.filter(x => x.id !== b.id));
        setStatusMessage(data.message || `🗑️ Bid deleted and refunded successfully.`);
        if (typeof fetchLiveData === 'function') {
          fetchLiveData();
        }
      } else {
        alert('Failed to delete bid');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleSaveEditBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBidForm.number && editBidForm.number !== '0') return;
    const gType = String(editBidForm.gameType || '').toUpperCase();
    const isHar = gType.includes('HAR') || gType.includes('ANDER') || gType.includes('BAHAR');
    const newNum = isHar ? String(parseInt(editBidForm.number) % 10) : (String(editBidForm.number) === '0' || String(editBidForm.number) === '100' ? '00' : String(editBidForm.number).padStart(2, '0'));
    const newAmt = parseFloat(editBidForm.amount as any) || 10;

    // 1. Instantly update React state
    setBidsList(prev => prev.map(b => b.id === editBidForm.id ? { ...b, number: newNum, amount: newAmt } : b));
    setStatusMessage(`🎉 Bid #${editBidForm.id} number changed to "${newNum}" successfully!`);
    setShowEditBidModal(false);

    // 2. Persist updated bid number & amount to Backend API live!
    try {
      await fetch(`${API_BASE}/api/admin/update-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editBidForm.id,
          number: newNum,
          amount: newAmt
        })
      });
      fetchLiveData();
    } catch (err) {}
  };

  // RESULT DECLARATION & WINNER CREDIT HANDLER
  const handleDeclareResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultForm.resultNumber || resultForm.resultNumber !== resultForm.reResultNumber) {
      alert("Result numbers do not match! Please re-enter.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/declare-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_name: resultForm.category,
          number: resultForm.resultNumber,
          winning_number: resultForm.resultNumber,
          date_key: resultForm.resultDate,
          bypassWindowCheck: true
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || `Failed to declare result for ${resultForm.category}`);
        return;
      }
    } catch (err: any) {
      alert(`Server error while declaring result: ${err?.message || 'Please check connection'}`);
      return;
    }

    const canonicalNameMap: { [k: string]: string } = {
      'disawer': 'Desawar',
      'desawar': 'Desawar',
      'shri ganesh': 'Shree Ganesh',
      'shree ganesh': 'Shree Ganesh'
    };
    const cCat = canonicalNameMap[resultForm.category.toLowerCase()] || resultForm.category;

    const newRes = {
      id: `res_${Date.now()}`,
      date: resultForm.resultDate,
      category: cCat,
      resultNumber: resultForm.resultNumber,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      resultBy: 'Johnsnow'
    };

    setResultsList(prev => [newRes, ...prev.filter(x => !( (canonicalNameMap[x.category?.toLowerCase()] || x.category) === cCat && x.date === resultForm.resultDate))]);

    // Check for winning bids matching declared number
    const resNumPadded = String(resultForm.resultNumber).padStart(2, '0');
    const anderDigit = resNumPadded.charAt(0);
    const baharDigit = resNumPadded.charAt(1);

    const isWinningBid = (b: any) => {
      const bCat = canonicalNameMap[b.category?.toLowerCase()] || b.category;
      if (bCat !== cCat) return false;
      const gType = (b.gameType || '').toUpperCase();
      const isHar = gType.includes('HAR') || gType.includes('ANDER') || gType.includes('BAHAR');
      if (isHar) {
        if (gType.includes('BAHAR') || gType.includes('HAROOF_B')) {
          return String(b.number) === baharDigit;
        } else {
          return String(b.number) === anderDigit;
        }
      }
      return b.number === resNumPadded || b.number === resultForm.resultNumber;
    };

    const matchingBids = bidsList.filter(isWinningBid);
    let winningSum = 0;

    // Update winning bids status to 'Won'
    setBidsList(prev => prev.map(b => isWinningBid(b) ? { ...b, status: 'Won' } : b));

    matchingBids.forEach(b => {
      const mult = getBetMultiplier(b);
      const winAmt = parseFloat(b.win_amount || b.winAmount) || ((parseFloat(b.amount) || 0) * mult);
      winningSum += winAmt;
      
      // Add record to Wallet Winnings
      const newWin = {
        id: `win_${Date.now()}`,
        category: b.category,
        user: b.user,
        email: 'user@pk.com',
        mobile: b.phone,
        userId: '8113',
        amount: winAmt,
        txnId: `TXN_WIN_${Date.now()}`,
        txnType: 'WINNING',
        status: 'Credited',
        dateOfWinning: resultForm.resultDate,
        dateOfTxn: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };
      setWinningsList(prev => [newWin, ...prev]);

      // Credit winning amount to user wallet
      setUsers(prev => prev.map(u => (u.name === b.user || u.mobile === b.phone) ? { ...u, balance: u.balance + winAmt, totalWinning: (u.totalWinning || 0) + winAmt } : u));
    });

    setStatusMessage(`🎉 Result "${resultForm.resultNumber}" declared for ${resultForm.category}! Winners credited automatically.`);
    setShowAddResultModal(false);
    setResultForm({ category: 'Desawar', resultDate: new Date().toISOString().split('T')[0], resultNumber: '', reResultNumber: '' });
    alert(`🎉 Result for ${resultForm.category} declared successfully as ${resultForm.resultNumber}!`);
    await fetchLiveData();
  };

  // CLEAR / RESET RESULT HANDLER
  const handleEditResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResult) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/edit-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingResult.id, 
          game_name: editingResult.category, 
          new_number: editResultNumber,
          date_key: editingResult.date
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(data.message || `✅ Result for ${editingResult.category} updated to ${editResultNumber}`);
        setResultsList(prev => prev.map(x => x.id === editingResult.id ? { ...x, resultNumber: String(editResultNumber).padStart(2, '0') } : x));
        setEditingResult(null);
        await fetchLiveData();
      } else {
        alert(data.message || 'Error updating result');
      }
    } catch(err) {
      alert('Network error');
    }
  };

  const handleClearResult = async (r: any) => {
    if (!confirm(`Are you sure you want to reset/clear result for ${r.category} (${r.date})? All bets on this market will be reverted to Pending and won payouts deducted from wallets.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/clear-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          game_name: r.category,
          date_key: r.date,
          id: r.id
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(data.message || `🗑️ Result for ${r.category} reset/cleared successfully.`);
      }
    } catch (err) {}
    setResultsList(prev => prev.filter(x => x.id !== r.id));
    await fetchLiveData();
  };

  const handleToggleMarketStatus = async (gameName: string) => {
    const currentEnabled = gameSchedules[gameName]?.enabled !== false;
    const newEnabled = !currentEnabled;
    
    // Instant optimistic update
    setGameSchedules(prev => ({
      ...prev,
      [gameName]: { ...(prev[gameName] || {}), enabled: newEnabled }
    }));

    try {
      const res = await fetch(`${API_BASE}/api/admin/toggle-market-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gameName, enabled: newEnabled })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(`✅ ${gameName} betting is now ${newEnabled ? 'OPEN (ON)' : 'CLOSED (OFF)'}`);
        if (data.schedules) setGameSchedules(data.schedules);
      }
    } catch (err) {
      alert('Network error toggling market status');
    }
  };

  // CATEGORY HANDLERS
  const handleEditScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/update-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editingCategory.name,
          open: editScheduleForm.open,
          close: editScheduleForm.close,
          result: editScheduleForm.result
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(`✅ Schedule updated for ${editingCategory.name}`);
        setGameSchedules(data.schedules);
        setEditingCategory(null);
      } else {
        alert(data.message || 'Error updating schedule');
      }
    } catch(err) {
      alert('Network error');
    }
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name) return;
    const newCat = {
      id: `${Date.now()}`,
      name: categoryForm.name,
      seniority: categoryForm.seniority,
      image: categoryForm.image,
      previewUrl: categoryForm.previewUrl,
      status: categoryForm.status
    };
    setCategoriesList([newCat, ...categoriesList]);
    setStatusMessage(`🎉 Category "${categoryForm.name}" created successfully!`);
    setShowAddCategoryModal(false);
    setCategoryForm({ type: 'Matka', name: '', status: 'Active', seniority: 1, image: '', previewUrl: '', description: '' });
  };

  const handleCategoryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCategoryForm(prev => ({
          ...prev,
          image: file.name,
          previewUrl: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // BANNER ADD / EDIT HANDLERS
  const handleBannerImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const rawResult = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

          setBannerForm(prev => ({
            ...prev,
            image: file.name,
            previewUrl: compressedBase64,
            link: compressedBase64
          }));
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.name) return;
    
    let updatedList = [];
    if (editingBanner) {
      updatedList = bannersList.map(b => b.id === editingBanner.id ? { ...b, ...bannerForm } : b);
      setBannersList(updatedList);
      setStatusMessage(`🎉 Banner "${bannerForm.name}" updated!`);
      setEditingBanner(null);
    } else {
      const newB = { id: `${Date.now()}`, ...bannerForm };
      updatedList = [newB, ...bannersList];
      setBannersList(updatedList);
      setStatusMessage(`🎉 Banner "${bannerForm.name}" added successfully!`);
    }

    // Sync banner update to backend server & MongoDB Atlas Cloud
    try {
      const imgUrl = bannerForm.previewUrl || bannerForm.link || '';
      await fetch(`${API_BASE}/api/admin/update-banner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: bannerForm.status === 'Active',
          title: bannerForm.name,
          subtitle: bannerGlobalForm.subtitle || '99xmatka SATTA',
          imageUrl: imgUrl
        })
      });
      setBannerGlobalForm(prev => ({
        ...prev,
        title: bannerForm.name,
        imageUrl: imgUrl,
        enabled: bannerForm.status === 'Active'
      }));
    } catch (err) {}

    // Sync the entire banners list to backend
    try {
      await fetch(`${API_BASE}/api/admin/update-banners-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banners: updatedList })
      });
    } catch (err) {
      console.error('[Sync Banners List Error]', err);
    }

    setShowAddBannerModal(false);
    setBannerForm({ name: '', type: 'Image', link: '', image: 'banner1.png', previewUrl: '', status: 'Active' });
  };

  // PACKAGE ADD / EDIT HANDLERS
  const handleSavePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageForm.appName) return;
    if (editingPackage) {
      setPackagesList(packagesList.map(p => p.id === editingPackage.id ? { ...p, ...packageForm } : p));
      setStatusMessage(`🎉 Package "${packageForm.appName}" updated!`);
      setEditingPackage(null);
    } else {
      const newP = { id: `${Date.now()}`, ...packageForm };
      setPackagesList([newP, ...packagesList]);
      setStatusMessage(`🎉 Package "${packageForm.appName}" added successfully!`);
    }
    setShowAddPackageModal(false);
    setPackageForm({ packageName: '', appName: '', status: 'Active' });
  };

  // ADMIN ADD / EDIT HANDLERS
  const handleSaveAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.name || !adminForm.username) return;
    if (editingAdmin) {
      setAdminsList(adminsList.map(a => a.id === editingAdmin.id ? { ...a, ...adminForm } : a));
      setStatusMessage(`🎉 Admin "${adminForm.name}" updated!`);
      setEditingAdmin(null);
    } else {
      const newA = { id: `${Date.now()}`, ...adminForm };
      setAdminsList([newA, ...adminsList]);
      setStatusMessage(`🎉 Admin "${adminForm.name}" created!`);
    }
    setShowAddAdminModal(false);
    setAdminForm({ name: '', username: '', mobile: '', password: '', role: 'Super Admin', status: 'Active' });
  };

  // PAYMENT METHOD ADD / EDIT HANDLERS
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const upiVal = paymentForm.upi_id || paymentForm.upiId || '';
    const nameVal = paymentForm.name || 'PhonePe / GPay / Paytm UPI';
    const merchantVal = paymentForm.merchant_name || 'Matka Official';
    const orderVal = paymentForm.ordering || (paymentMethodsList.length + 1);
    const statusVal = paymentForm.status || 'Active';
    const isEdit = !!editingPayment;
    const targetId = isEdit ? (editingPayment.id || editingPayment._id) : undefined;

    const payload = {
      isEdit: isEdit,
      _id: targetId,
      id: targetId,
      name: nameVal,
      upi_id: upiVal,
      upiId: upiVal,
      merchant_name: merchantVal,
      ordering: orderVal,
      status: statusVal,
      updateDate: new Date().toLocaleDateString()
    };

    // 1. Send POST request to backend API & MongoDB Atlas
    try {
      let res = await fetch(`${API_BASE}/api/admin/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/api/payment-methods`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      if (res.ok) {
        const data = await res.json();
        if (data.paymentMethods && Array.isArray(data.paymentMethods)) {
          setPaymentMethodsList(data.paymentMethods);
        } else {
          setPaymentMethodsList(prev => {
            if (isEdit) {
              return prev.map(p => (p.id === targetId || p._id === targetId) ? payload : p);
            }
            return [payload, ...prev];
          });
        }
      } else {
        setPaymentMethodsList(prev => {
          if (isEdit) {
            return prev.map(p => (p.id === targetId || p._id === targetId) ? payload : p);
          }
          return [payload, ...prev];
        });
      }
    } catch (err) {
      console.error('[Save Payment Error]', err);
      setPaymentMethodsList(prev => {
        if (isEdit) {
          return prev.map(p => (p.id === targetId || p._id === targetId) ? payload : p);
        }
        return [payload, ...prev];
      });
    }

    setShowAddPaymentModal(false);
    setEditingPayment(null);
    setStatusMessage(`🎉 Payment Method "${nameVal}" (${upiVal}) saved successfully!`);
  };

  // NOTIFICATION HANDLERS
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifTarget, setNotifTarget] = useState('All Users');
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setIsSendingNotif(true);

    const payload = { title: notifTitle, body: notifBody, targetUser: notifTarget };
    try {
      const res = await fetch(`${API_BASE}/api/admin/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.notifications && Array.isArray(data.notifications)) {
          setNotificationsList(data.notifications);
        } else {
          setNotificationsList(prev => [data.notification || payload, ...prev]);
        }
        setStatusMessage(`🎉 Notification "${notifTitle}" broadcasted to ${notifTarget}!`);
        setNotifTitle('');
        setNotifBody('');
      } else {
        setNotificationsList(prev => [payload, ...prev]);
        setStatusMessage(`🎉 Notification "${notifTitle}" broadcasted!`);
        setNotifTitle('');
        setNotifBody('');
      }
    } catch (err) {
      console.error('[Send Notification Error]', err);
      setNotificationsList(prev => [payload, ...prev]);
      setStatusMessage(`🎉 Notification "${notifTitle}" broadcasted!`);
      setNotifTitle('');
      setNotifBody('');
    } finally {
      setIsSendingNotif(false);
    }
  };

  const handleDeletePayment = async (pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/payment-methods/${pmId}`, { method: 'DELETE' });
      if (res.ok) {
        setStatusMessage(`🗑️ Payment Method deleted.`);
        fetchLiveData();
      }
    } catch (err) {}
  };

  const handleToggleActivePayment = async (pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/payment-methods/${pmId}/toggle`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage(`⚡ Active UPI ID switched! Only this UPI ID is now ON for QR deposits.`);
        fetchLiveData();
      }
    } catch (err) {}
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.phone) return;
    const newUserObj = {
      id: `usr_${Date.now()}`,
      name: newUserForm.name,
      email: newUserForm.email || 'user@pk.com',
      mobile: newUserForm.phone,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      referrals: 0,
      referBy: '',
      deactiveReason: '',
      status: newUserForm.status,
      source: 'Play Store',
      balance: parseFloat(newUserForm.initialBalance) || 500,
      totalDeposit: 0,
      totalWinning: 0,
      totalWithdrawal: 0,
      referralCode: `ref_${Date.now()}`,
      gender: newUserForm.gender,
      dob: newUserForm.dob,
      address: newUserForm.address,
      bankName: newUserForm.bank_name,
      accountNumber: newUserForm.bank_account_number,
      branchName: newUserForm.branch_name,
      ifscCode: newUserForm.ifsc_code,
      upi: newUserForm.upi,
      multipleWithdraw: 'No',
      lastLoginOtp: '2026-08-29 01:20:00',
      apiCall: 'laravelNEW'
    };
    setUsers(prev => [...prev, newUserObj]);
    setStatusMessage(`🎉 User ${newUserForm.name} created!`);
    setShowAddUserModal(false);
  };

  const [appVersionForm, setAppVersionForm] = useState({
    latestVersionCode: 1,
    latestVersionName: 'v1.0.0',
    apkUrl: 'https://newmatkadomain.com/99xmatka.apk',
    updateMessage: '🚀 A new performance update is available! Tap Update now to get the latest features & instant wallet sync.',
    forceUpdate: false
  });

  const handleSaveAppVersionConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/update-app-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appVersionForm)
      });
      if (res.ok) {
        setStatusMessage('🚀 App Auto-Update Configuration Saved & Live for all users!');
      }
    } catch (err) {}
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const payload = {
        ...settingsForm,
        jodi_rate: parseFloat(String(settingsForm.jodi_rate)) || 90,
        crossing_rate: parseFloat(String(settingsForm.crossing_rate)) || 90,
        haroof_rate: parseFloat(String(settingsForm.haroof_rate)) || 9.5
      };

      const res = await fetch(`${API_BASE}/api/admin/update-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.settingsConfig) {
          setSettingsForm({
            ...settingsForm,
            ...data.settingsConfig
          });
        }
        setStatusMessage('🚀 Settings Configuration Saved & Live!');
        alert(`✅ Settings updated successfully!\nJodi: ${payload.jodi_rate}x | Crossing: ${payload.crossing_rate}x | Haroof: ${payload.haroof_rate}x`);
      } else {
        alert('❌ Failed to save settings');
      }
    } catch (err: any) {
      alert('❌ Error saving settings: ' + (err.message || err));
    }
  };

  const handleSaveLivePlayers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingLivePlayers(true);
    try {
      const sanitizedLivePlayers: { [key: string]: number } = {};
      const markets = ['Shiv Parwati', 'Delhi Bazar', 'Dubai Market', 'Shree Ganesh', 'Faridabad', 'Ghaziabad', 'Gali', 'Desawar'];
      markets.forEach(k => {
        const val = livePlayers[k] !== undefined ? livePlayers[k] : (k === 'Desawar' ? livePlayers['Disawer'] : (k === 'Shree Ganesh' ? livePlayers['Shri Ganesh'] : 0));
        sanitizedLivePlayers[k] = parseInt(String(val), 10) || 0;
      });

      const res = await fetch(`${API_BASE}/api/admin/live-players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livePlayers: sanitizedLivePlayers })
      });
      const data = await res.json();
      if (data.success) {
        if (data.data) setLivePlayers(data.data);
        setStatusMessage('🚀 Live user playing counts updated!');
        alert('✅ Live user counts saved successfully!');
      } else {
        alert('❌ Failed to update live player counts');
      }
    } catch (err: any) {
      alert('❌ Error saving live player counts: ' + (err.message || err));
    } finally {
      setSavingLivePlayers(false);
    }
  };

  const [bannerGlobalForm, setBannerGlobalForm] = useState({
    enabled: true,
    title: '99xmatka SATTA',
    subtitle: 'आपका भरोसा, हमारी पहचान',
    referralText: 'केवल 5 प्लेइंग यूजर को रिफर करें और पाएं ₹500 बोनस',
    commissionText: '4% लाइफटाइम कमिशन आपकी टीम के हर दांव पर',
    minDeposit: '100',
    minWithdrawal: '200',
    imageUrl: ''
  });

  const handleSaveGlobalBannerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/update-banner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bannerGlobalForm)
      });
      if (res.ok) {
        setStatusMessage('🖼️ Banner Configuration Saved & Synced to App & Website!');
      }
    } catch (err) {}
  };

  const [selectedWithdrawalForModal, setSelectedWithdrawalForModal] = useState<any>(null);
  const [withdrawalModalTab, setWithdrawalModalTab] = useState<'payment' | 'withdrawal' | 'transaction' | 'player' | 'wallet'>('payment');

  const [walletTxnSearchQuery, setWalletTxnSearchQuery] = useState('');
  const [depositSearchQuery, setDepositSearchQuery] = useState('');
  const [withdrawSearchQuery, setWithdrawSearchQuery] = useState('');
  const [withdrawStatusFilter, setWithdrawStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedTxnForModal, setSelectedTxnForModal] = useState<any>(null);

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUserForm)
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => (u.id === editUserForm.id || u.mobile === editUserForm.mobile) ? { ...u, ...editUserForm } : u));
        setStatusMessage(`🎉 User ${editUserForm.name} updated successfully!`);
        await fetchLiveData();
        setActiveTab('users');
      } else {
        alert(data.message || 'Failed to save user changes.');
      }
    } catch (err) {
      alert('Error connecting to server to save user details.');
    }
  };

  const handleApproveDeposit = async (depId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/deposits/${depId}/approve`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage(`💳 Deposit #${depId} Approved & Credited!`);
        fetchLiveData();
      }
    } catch (err) {}
  };

  const handleRejectDeposit = async (depId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/deposits/${depId}/reject`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage(`❌ Deposit #${depId} Rejected.`);
        fetchLiveData();
      }
    } catch (err) {}
  };

  const handleApproveWithdrawal = async (wdId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/withdrawals/${wdId}/approve`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage(`🏦 Withdrawal #${wdId} Approved & Paid!`);
        fetchLiveData();
      }
    } catch (err) {}
  };

  const handleRejectWithdrawal = async (wdId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/withdrawals/${wdId}/reject`, { method: 'POST' });
      if (res.ok) {
        setStatusMessage(`❌ Withdrawal #${wdId} Rejected.`);
        fetchLiveData();
      }
    } catch (err) {}
  };

  const handleWalletAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletTargetUser) return;
    const amt = parseFloat(walletAmtInput) || 0;
    if (amt <= 0) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/update-user-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: walletTargetUser.id || walletTargetUser._id,
          mobile: walletTargetUser.mobile,
          type: walletActionType,
          amount: amt
        })
      });
      if (res.ok) {
        setStatusMessage(`🎉 Wallet ${walletActionType === 'add' ? 'credited' : 'debited'} with ₹${amt}!`);
        setShowWalletModal(false);
        fetchLiveData();
      }
    } catch (err) {}
  };

  // Calculate Market Total Beted Amount for Result Declaration Modal (date-specific)
  const getMarketBetTotal = (catName: string, dateStr?: string) => {
    const targetDate = dateStr || resultForm.resultDate || new Date().toISOString().split('T')[0];
    return bidsList
      .filter(b => {
        const catMatch = String(b.category || '').trim().toLowerCase() === String(catName || '').trim().toLowerCase();
        if (!catMatch) return false;
        
        const bDateVal = b.rawDate || b.date || b.created_at;
        if (!bDateVal) return false;

        try {
          const d = new Date(bDateVal);
          if (!isNaN(d.getTime())) {
            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (dStr === targetDate) return true;
          }
          const str = String(bDateVal);
          if (str.includes(targetDate)) return true;
        } catch (e) {}

        return false;
      })
      .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
  };

  const getMarketLifetimeTotal = (catName: string) => {
    return bidsList
      .filter(b => String(b.category || '').trim().toLowerCase() === String(catName || '').trim().toLowerCase())
      .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
  };

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#E9ECEF] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white rounded-lg shadow-md border-t-4 border-[#007BFF] overflow-hidden">
          <div className="p-6 text-center border-b border-[#DEE2E6]">
            <a href="#" className="text-3xl font-light text-[#212529]">
              <b className="font-bold text-[#007BFF]">Dream</b> Admin
            </a>
            <p className="text-xs text-[#6C757D] mt-1 font-medium">99xmatka Admin Control Panel</p>
          </div>

          <div className="p-6 bg-white">
            {authError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs font-semibold text-center">
                {authError}
              </div>
            )}

            {loginStep === 1 ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#495057] mb-1">Email</label>
                  <input
                    type="email"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter admin email"
                    required
                    autoComplete="off"
                    className="w-full bg-white border border-[#CED4DA] text-[#495057] px-3 py-2 rounded text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#495057] mb-1">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="off"
                    className="w-full bg-white border border-[#CED4DA] text-[#495057] px-3 py-2 rounded text-sm focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#007BFF] hover:bg-[#0069D9] text-white font-bold py-2.5 rounded shadow text-sm uppercase tracking-wider"
                >
                  {authLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="text-center bg-[#F8F9FA] p-3 rounded border border-[#DEE2E6] mb-3">
                  <p className="text-xs text-[#6C757D]">OTP Authentication Step</p>
                  {otpSentMessage && <p className="text-xs font-bold text-green-600 mt-1">✅ {otpSentMessage}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#495057] mb-1">Enter 4-Digit OTP from SMS</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={loginOtp}
                    onChange={(e) => setLoginOtp(e.target.value)}
                    placeholder="Enter OTP"
                    required
                    autoComplete="off"
                    className="w-full bg-white border border-[#007BFF] text-[#212529] text-center tracking-[0.4em] text-lg font-bold py-2 rounded focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#28A745] hover:bg-[#218838] text-white font-bold py-2.5 rounded shadow text-sm uppercase tracking-wider"
                >
                  {authLoading ? 'Verifying...' : 'Verify & Enter Dashboard'}
                </button>

                <button
                  type="button"
                  onClick={() => setLoginStep(1)}
                  className="w-full text-xs text-[#6C757D] hover:text-[#212529] font-medium py-1 text-center"
                >
                  ← Back to Login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MAIN WORKSPACE MATCHING MEDIA_1787949265283.PNG 100%
  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#212529] flex flex-col font-sans">
      {/* TOP NAVBAR */}
      <header className="bg-white border-b border-[#DEE2E6] h-14 px-4 flex justify-between items-center shadow-sm shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[#6C757D] hover:text-[#212529] p-1.5 text-base font-bold">
            ☰
          </button>

          {/* MATKA GAME DROPDOWN MENU MATCHING MEDIA_1787977750711.PNG 100%! */}
          <div className="relative">
            <button
              onClick={() => setMatkaDropdownOpen(!matkaDropdownOpen)}
              className="flex items-center gap-1 text-xs font-semibold text-[#6C757D] hover:text-[#212529] focus:outline-none"
            >
              <span>Matka Game</span>
              <span className="text-[10px]">▾</span>
            </button>

            {matkaDropdownOpen && (
              <div className="absolute left-0 mt-2 w-44 bg-white border border-[#DEE2E6] rounded shadow-lg py-1 z-50 text-xs font-medium">
                <button onClick={() => { setActiveTab('bids'); setMatkaDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[#007BFF] hover:text-white transition-colors">Bids</button>
                <button onClick={() => { setActiveTab('results'); setMatkaDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[#007BFF] hover:text-white transition-colors">Results</button>
                <button onClick={() => { setActiveTab('winnings'); setMatkaDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[#007BFF] hover:text-white transition-colors">Winnings</button>
                <button onClick={() => { setActiveTab('gameHistory'); setMatkaDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[#007BFF] hover:text-white transition-colors">Game History</button>
                <button onClick={() => { setActiveTab('categories'); setMatkaDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-[#007BFF] hover:text-white transition-colors">Categories</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div onClick={handleLogout} title="Click to Sign Out" className="w-8 h-8 rounded-full bg-[#6C757D] border border-[#DEE2E6] overflow-hidden cursor-pointer hover:opacity-80">
            <img src="http://packdemo.vahanvaluecheck.in/images/avatar5.png" alt="User" className="w-full h-full object-cover" onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }} />
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex overflow-hidden">
        {/* 15 EXACT SIDEBAR ROUTES */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-14'} bg-[#343A40] text-[#C2C7D0] transition-all duration-200 flex flex-col shrink-0 border-r border-[#4B545C] z-30`}>
          {/* Brand Link */}
          <div className="h-14 border-b border-[#4B545C] flex items-center justify-center bg-[#212529]">
            <div className="w-8 h-8 rounded-full bg-[#007BFF] text-white font-black flex items-center justify-center text-sm shadow italic shrink-0">
              D
            </div>
            {sidebarOpen && <span className="font-light text-white text-base ml-3 tracking-wide">Dream <b className="font-bold">Admin</b></span>}
          </div>

          {/* User Panel */}
          <div className="p-3 border-b border-[#4B545C] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-[#6C757D] border border-white text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
              <img src="http://packdemo.vahanvaluecheck.in/images/avatar5.png" alt="Avatar" className="w-full h-full object-cover" onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }} />
            </div>
            {sidebarOpen && (
              <div className="ml-3">
                <p className="text-xs font-bold text-white leading-none">Admin</p>
              </div>
            )}
          </div>

          {/* 15 EXACT MENU ITEMS */}
          <nav className="flex-1 p-1.5 space-y-1 overflow-y-auto text-xs">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '⏱️' },
              { id: 'users', label: 'Users', icon: '👥' },
              { id: 'userChange', label: 'User Change', icon: '👥' },
              { id: 'banners', label: 'Banner', icon: '🖼️' },
              { id: 'referral', label: 'Refer & Earn', icon: '🎁' },
              { id: 'gameLedger', label: 'Game Ledger', icon: '📘' },
              { id: 'wallets', label: 'Wallet', icon: '👛' },
              { id: 'walletTransactions', label: 'Wallet Transactions', icon: '🧾' },
              { id: 'deposits', label: 'Deposit Request', icon: '💳' },
              { id: 'withdraws', label: 'Withdraw Request', icon: '🏦' },
              { id: 'commission', label: 'Commission Dashboard', icon: '🎁' },
              { id: 'leaderboard', label: 'Leader Board', icon: '🥇' },
              { id: 'payouts', label: 'Payout', icon: '💰' },
              { id: 'packages', label: 'App/Package', icon: '📄' },
              { id: 'paymentMethods', label: 'Payment Methods', icon: '💳' },
              { id: 'pushNotifications', label: 'Push Notifications', icon: '🔔' },
              { id: 'settings', label: 'Settings', icon: '⚙️' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                title={item.label}
                className={`w-full flex items-center ${sidebarOpen ? 'justify-start px-3' : 'justify-center'} py-2.5 rounded font-semibold transition-all ${
                  (activeTab === item.id || (item.id === 'users' && (activeTab === 'userDetails' || activeTab === 'userEdit')))
                    ? 'bg-[#007BFF] text-white font-bold shadow'
                    : 'text-[#C2C7D0] hover:bg-[#495057] hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {sidebarOpen && <span className="ml-3">{item.label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* WORKSPACE CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {statusMessage && (
            <div className="bg-[#28A745] text-white px-4 py-2 flex justify-between items-center text-xs font-bold shadow-sm">
              <span>{statusMessage}</span>
              <button onClick={() => setStatusMessage('')} className="text-white font-bold">✕</button>
            </div>
          )}

          <main className="p-6 space-y-6">

            {/* MATKA GAME SUB-MODULE 1: BIDS */}
            {activeTab === 'bids' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Bids Management</h1>
                </div>

                <form onSubmit={handleExecuteSearch} className="bg-white p-4 rounded border border-[#DEE2E6] shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3 items-end text-xs">
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Search Fields</label>
                    <input type="text" value={filterSearch} onChange={(e)=>setFilterSearch(e.target.value)} placeholder="Name/Email/Phone" className="w-full border border-[#CED4DA] p-1.5 rounded" />
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Category</label>
                    <select value={filterCategory} onChange={(e)=>{ setFilterCategory(e.target.value); setAppliedCategory(e.target.value); }} className="w-full border border-[#CED4DA] p-1.5 rounded">
                      <option value="All">All</option>
                      {categoriesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Game Type</label>
                    <select value={filterGameType} onChange={(e)=>{ setFilterGameType(e.target.value); setAppliedGameType(e.target.value); }} className="w-full border border-[#CED4DA] p-1.5 rounded">
                      <option value="All">All</option>
                      <option value="Jodi">Jodi</option>
                      <option value="Crossing">Crossing</option>
                      <option value="Haroof Ander">Haroof Ander</option>
                      <option value="Haroof Bahar">Haroof Bahar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Start Date</label>
                    <div className="relative flex items-center w-full">
                      <input 
                        type="date" 
                        value={filterStartDate} 
                        onChange={(e)=>setFilterStartDate(e.target.value)} 
                        onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                        className="w-full border border-[#CED4DA] p-1.5 rounded pr-8"
                      />
                      <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Search Number</label>
                    <input type="text" value={searchNumberInput} onChange={(e)=>setSearchNumberInput(e.target.value)} placeholder="Number e.g. 45" className="w-full border border-[#CED4DA] p-1.5 rounded font-mono" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" onClick={handleExecuteSearch} className="flex-1 bg-[#28A745] hover:bg-[#218838] text-white py-1.5 rounded font-bold shadow-sm">Search</button>
                    <button type="button" onClick={handleClearFilters} className="flex-1 bg-white border border-[#CED4DA] text-[#212529] py-1.5 rounded font-bold shadow-sm hover:bg-gray-100">Clear</button>
                  </div>
                </form>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold text-[#212529]">
                    <span>Total Amount : ₹ {bidsList.reduce((s,b)=>s+b.amount,0)}.00</span>
                  </div>

                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Date / Time</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">User</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Phone No.</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Category</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Game Type</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Number</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bidsList.filter(b => {
                        const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                        if (targetCat !== 'All' && b.category !== targetCat) return false;

                        const targetGT = appliedGameType !== 'All' ? appliedGameType : filterGameType;
                        if (targetGT !== 'All' && b.gameType !== targetGT) return false;

                        const numQ = (appliedSearchNumber || searchNumberInput).trim();
                        if (numQ && b.number !== numQ && b.number !== numQ.padStart(2, '0')) return false;

                        const q = (appliedSearch || filterSearch).toLowerCase().trim();
                        if (q) {
                          const matches = (b.user && b.user.toLowerCase().includes(q)) ||
                                          (b.phone && b.phone.includes(q)) ||
                                          (b.category && b.category.toLowerCase().includes(q));
                          if (!matches) return false;
                        }

                        // Date check
                        const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        if (!isDateInRange(b.rawDate || b.date, sDate, eDate)) return false;

                        return true;
                      }).map((b, i) => (
                        <tr key={i} className="hover:bg-[#F4F6F9]">
                          <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]">{b.date}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{b.user}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] text-[#007BFF] font-bold">{b.phone}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]">{b.category}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]">{b.gameType}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold font-mono text-[#DC3545]">{b.number}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#28A745]">₹ {b.amount}</td>
                          <td className="p-2.5 text-right space-x-1">
                            {/* ✏️ EDIT BID NUMBER BUTTON MATCHING MEDIA_1787978845834.PNG */}
                            <button onClick={() => { setEditBidForm(b); setShowEditBidModal(true); }} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm" title="Edit Bid Number">✏️</button>
                            
                            {/* 🗑️ DELETE BID BUTTON MATCHING MEDIA_1787978845834.PNG */}
                            <button onClick={() => handleDeleteBid(b)} className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm" title="Delete Bid">🗑️</button>
                          </td>
                        </tr>
                      ))}
                      {bidsList.filter(b => {
                        if (filterCategory !== 'All' && b.category !== filterCategory) return false;
                        if (filterGameType !== 'All' && b.gameType !== filterGameType) return false;
                        if (searchNumberInput.trim() && b.number !== searchNumberInput.trim()) return false;
                        if (filterSearch.trim()) {
                          const q = filterSearch.toLowerCase().trim();
                          return (b.user && b.user.toLowerCase().includes(q)) ||
                                 (b.phone && b.phone.includes(q)) ||
                                 (b.category && b.category.toLowerCase().includes(q));
                        }
                        return true;
                      }).length === 0 && (
                        <tr><td colSpan={9} className="p-6 text-center text-[#6C757D]">No matching bids found</td></tr>
                      )}
                    </tbody>
                  </table>

                  {/* SUMMARY CARD MATCHING MEDIA_1787978845834.PNG 100% */}
                  <div className="bg-white rounded border border-[#DEE2E6] p-5 space-y-2 mt-4">
                    <h2 className="text-2xl font-bold text-[#212529]">Summary</h2>
                    <p className="text-sm font-bold text-[#212529]">Total Amount : ₹ {bidsList.reduce((s,b)=>s+b.amount,0)}.00</p>
                  </div>
                </div>
              </div>
            )}

            {/* MATKA GAME SUB-MODULE 2: RESULTS (Matching media_1787977805132.png 100%) */}
            {activeTab === 'results' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Result Management</h1>
                  <button onClick={() => setShowAddResultModal(true)} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-3.5 py-1.5 rounded text-xs font-bold shadow-sm">+ Add</button>
                </div>

                <div className="bg-white p-4 rounded border border-[#DEE2E6] shadow-sm flex flex-wrap gap-4 items-end text-xs">
                  <div className="min-w-[200px]">
                    <label className="block font-bold text-[#212529] mb-1">Category</label>
                    <select value={filterCategory} onChange={(e)=>setFilterCategory(e.target.value)} className="w-full border border-[#CED4DA] p-1.5 rounded">
                      <option value="All">All</option>
                      {categoriesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Start Date</label>
                    <div className="relative flex items-center w-full">
                      <input 
                        type="date" 
                        value={filterStartDate} 
                        onChange={(e)=>setFilterStartDate(e.target.value)} 
                        onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                        className="border border-[#CED4DA] p-1.5 rounded pr-8"
                      />
                      <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">End Date</label>
                    <div className="relative flex items-center w-full">
                      <input 
                        type="date" 
                        value={filterEndDate} 
                        onChange={(e)=>setFilterEndDate(e.target.value)} 
                        onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                        className="border border-[#CED4DA] p-1.5 rounded pr-8"
                      />
                      <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExecuteSearch} className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-1.5 rounded font-bold shadow-sm">Search</button>
                    <button onClick={handleClearFilters} className="bg-white border border-[#CED4DA] text-[#212529] px-4 py-1.5 rounded font-bold shadow-sm">Clear</button>
                  </div>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Date ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Category Name ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Result Number ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Created At ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Result By ⇅</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultsList.filter(r => {
                        const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                        if (targetCat !== 'All' && r.category !== targetCat) return false;
                        
                        const q = (appliedSearch || filterSearch).toLowerCase().trim();
                        if (q) {
                          const matches = (r.category && r.category.toLowerCase().includes(q)) ||
                                 (r.resultNumber && r.resultNumber.includes(q)) ||
                                 (r.resultBy && r.resultBy.toLowerCase().includes(q));
                          if (!matches) return false;
                        }

                        const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        if (sDate || eDate) {
                          if (!isDateInRange(r.rawDate || r.date, sDate, eDate)) return false;
                        }

                        return true;
                      }).map((r, i) => (
                        <tr key={i} className="hover:bg-[#F4F6F9]">
                          <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]">{r.date}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{r.category}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-lg text-[#007BFF]">{r.resultNumber}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]">{r.createdAt}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{r.resultBy}</td>
                          <td className="p-2.5 text-right flex justify-end gap-1">
                            <button onClick={() => { setEditingResult(r); setEditResultNumber(r.resultNumber); }} className="bg-[#FFC107] hover:bg-[#E0A800] text-black px-2 py-1 rounded text-[10px] font-bold shadow-sm" title="Edit Result">✏️</button>
                            <button onClick={() => handleClearResult(r)} className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm" title="Clear / Reset Result">🔄</button>
                          </td>
                        </tr>
                      ))}
                      {resultsList.filter(r => {
                        const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                        if (targetCat !== 'All' && r.category !== targetCat) return false;
                        
                        const q = (appliedSearch || filterSearch).toLowerCase().trim();
                        if (q) {
                          const matches = (r.category && r.category.toLowerCase().includes(q)) ||
                                 (r.resultNumber && r.resultNumber.includes(q)) ||
                                 (r.resultBy && r.resultBy.toLowerCase().includes(q));
                          if (!matches) return false;
                        }

                        const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        if (sDate || eDate) {
                          if (!isDateInRange(r.rawDate || r.date, sDate, eDate)) return false;
                        }

                        return true;
                      }).length === 0 && (
                        <tr><td colSpan={7} className="p-6 text-center text-[#6C757D]">No matching results found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MATKA GAME SUB-MODULE 3: WINNINGS (Matching media_1787977884136.png 100%) */}
            {activeTab === 'winnings' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Wallet Winning</h1>
                </div>

                <form onSubmit={handleExecuteSearch} className="bg-white p-4 rounded border border-[#DEE2E6] shadow-sm flex flex-wrap gap-3 items-end text-xs">
                  <div className="min-w-[150px]">
                    <label className="block font-bold text-[#212529] mb-1">Category</label>
                    <select value={filterCategory} onChange={(e)=>{ setFilterCategory(e.target.value); setAppliedCategory(e.target.value); }} className="w-full border border-[#CED4DA] p-1.5 rounded">
                      <option value="All">All</option>
                      {categoriesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Name / Email / Phone</label>
                    <input type="text" value={filterSearch} onChange={(e)=>setFilterSearch(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter') handleExecuteSearch();}} placeholder="Search name/phone/id" className="border border-[#CED4DA] p-1.5 rounded" />
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Start Date</label>
                    <div className="relative flex items-center w-full">
                      <input 
                        type="date" 
                        value={filterStartDate} 
                        onChange={(e)=>setFilterStartDate(e.target.value)} 
                        onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                        className="border border-[#CED4DA] p-1.5 rounded pr-8"
                      />
                      <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">End Date</label>
                    <div className="relative flex items-center w-full">
                      <input 
                        type="date" 
                        value={filterEndDate} 
                        onChange={(e)=>setFilterEndDate(e.target.value)} 
                        onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                        className="border border-[#CED4DA] p-1.5 rounded pr-8"
                      />
                      <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" onClick={handleExecuteSearch} className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-1.5 rounded font-bold shadow-sm">Search</button>
                    <button type="button" onClick={handleClearFilters} className="bg-white border border-[#CED4DA] text-[#212529] px-4 py-1.5 rounded font-bold shadow-sm hover:bg-gray-100">Clear</button>
                  </div>
                </form>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Mobile Number ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">User Id ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Amount ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Transaction Id ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Transaction Type ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Status ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Date Of Winning ⇅</th>
                        <th className="p-2.5">Date of Transaction ⇅</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winningsList.filter(w => {
                        const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                        if (targetCat !== 'All' && w.category !== targetCat) return false;

                        const q = (appliedSearch || filterSearch).toLowerCase().trim();
                        if (q) {
                          const matches = (w.user && w.user.toLowerCase().includes(q)) ||
                                          (w.email && w.email.toLowerCase().includes(q)) ||
                                          (w.mobile && w.mobile.includes(q)) ||
                                          (w.userId && w.userId.includes(q)) ||
                                          (w.txnId && w.txnId.toLowerCase().includes(q)) ||
                                          (w.category && w.category.toLowerCase().includes(q));
                          if (!matches) return false;
                        }

                        // Date range check
                        const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        if (!isDateInRange(w.dateOfWinning, sDate, eDate)) return false;

                        return true;
                      }).map((w, i) => (
                        <tr key={i} className="hover:bg-[#F4F6F9]">
                          <td className="p-2.5 border-r border-[#DEE2E6] text-[#007BFF] font-bold cursor-pointer hover:underline">{w.mobile}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{w.userId}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#212529]">{w.amount}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] text-[#007BFF]">{w.txnId}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-medium">{w.txnType || 'Winning amount'}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]"><span className="px-2 py-0.5 rounded bg-[#28A745] text-white text-[10px] font-bold uppercase">{w.status || 'SUCCESS'}</span></td>
                          <td className="p-2.5 border-r border-[#DEE2E6]">{w.dateOfWinning}</td>
                          <td className="p-2.5">{w.dateOfTxn}</td>
                        </tr>
                      ))}
                      {winningsList.filter(w => {
                        const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                        if (targetCat !== 'All' && w.category !== targetCat) return false;
                        const q = (appliedSearch || filterSearch).toLowerCase().trim();
                        if (q) {
                          const matches = (w.user && w.user.toLowerCase().includes(q)) ||
                                          (w.email && w.email.toLowerCase().includes(q)) ||
                                          (w.mobile && w.mobile.includes(q)) ||
                                          (w.userId && w.userId.includes(q)) ||
                                          (w.txnId && w.txnId.toLowerCase().includes(q)) ||
                                          (w.category && w.category.toLowerCase().includes(q));
                          if (!matches) return false;
                        }
                        return true;
                      }).length === 0 && (
                        <tr><td colSpan={8} className="p-6 text-center text-[#6C757D]">No matching winnings found</td></tr>
                      )}
                    </tbody>
                  </table>

                  <div className="bg-[#EFEFDE]/40 bg-[#F8F9FA] rounded border border-[#DEE2E6] p-4 space-y-2 mt-4">
                    <h3 className="font-bold text-[#212529] text-base">Winning Summary</h3>
                    <p className="text-xs font-bold text-[#212529]">
                      Total Amount : <span className="font-mono text-[#212529]">₹{winningsList.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* MATKA GAME SUB-MODULE 4: GAME HISTORY (Matching media_1787981861611.jpg 100%) */}
            {activeTab === 'gameHistory' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Game History</h1>
                </div>

                <form onSubmit={handleExecuteSearch} className="bg-white p-4 rounded border border-[#DEE2E6] shadow-sm flex flex-wrap gap-4 items-end text-xs">
                  <div className="min-w-[200px]">
                    <label className="block font-bold text-[#212529] mb-1">Category</label>
                    <select value={filterCategory} onChange={(e)=>{ setFilterCategory(e.target.value); setAppliedCategory(e.target.value); }} className="w-full border border-[#CED4DA] p-1.5 rounded">
                      <option value="All">All</option>
                      {categoriesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Start Date</label>
                    <div className="relative flex items-center w-full">
                      <input 
                        type="date" 
                        value={filterStartDate} 
                        onChange={(e)=>setFilterStartDate(e.target.value)} 
                        onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                        className="border border-[#CED4DA] p-1.5 rounded pr-8"
                      />
                      <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">End Date</label>
                    <div className="relative flex items-center w-full">
                      <input 
                        type="date" 
                        value={filterEndDate} 
                        onChange={(e)=>setFilterEndDate(e.target.value)} 
                        onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                        className="border border-[#CED4DA] p-1.5 rounded pr-8"
                      />
                      <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" onClick={handleExecuteSearch} className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-1.5 rounded font-bold shadow-sm">Search</button>
                    <button type="button" onClick={handleClearFilters} className="bg-white border border-[#CED4DA] text-[#212529] px-4 py-1.5 rounded font-bold shadow-sm hover:bg-gray-100">Clear</button>
                  </div>
                </form>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Category</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Game Type</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Bonus Amount</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Betting Amount</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Winning Amount</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoriesList.filter(c => {
                        const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                        if (targetCat !== 'All' && c.name !== targetCat) return false;
                        return true;
                      }).map((c, i) => {
                        const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        const bd = getMarketBreakdown(c.name, sDate, eDate);
                        const bonusAmt = (bd.totalInvestment * 0.0005).toFixed(2);
                        
                        let displayDate = 'All Time';
                        if (sDate && eDate && sDate === eDate) displayDate = sDate;
                        else if (sDate && !eDate) displayDate = sDate;
                        else if (!sDate && eDate) displayDate = eDate;
                        else if (sDate && eDate) displayDate = `${sDate} to ${eDate}`;
                        
                        return (
                          <tr key={i} className="hover:bg-[#F4F6F9] align-top">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono whitespace-nowrap">{displayDate}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{c.name}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono space-y-1">
                              {bd.crossTotal > 0 && <div>Cross Amount:- {bd.crossTotal}</div>}
                              {bd.jodiTotal > 0 && <div>Jodi Amount:- {bd.jodiTotal}</div>}
                              {bd.haroofTotal > 0 && <div>Hrope Amount:- {bd.haroofTotal}</div>}
                              {bd.totalInvestment === 0 && <div>Jodi Amount:- 0</div>}
                            </td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-700">₹{bonusAmt}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#212529]">₹{bd.totalInvestment.toFixed(2)}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#212529]">₹{bd.totalWinningAmount.toFixed(2)}</td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedGameHistoryCategory(c.name);
                                  setShowGameHistoryModal(true);
                                }}
                                className="bg-[#FFC107] hover:bg-[#E0A800] text-black px-2.5 py-1 rounded text-xs shadow-sm font-bold"
                                title="View Game Breakdown"
                              >
                                👁️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* SUMMARY CARD MATCHING MEDIA_1787981861611.JPG 100% */}
                  {(() => {
                    let totalBet = 0;
                    let totalWin = 0;
                    categoriesList.forEach(c => {
                      const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                      if (targetCat !== 'All' && c.name !== targetCat) return;
                      const sDate = appliedStartDate || filterStartDate;
                      const eDate = appliedEndDate || filterEndDate;
                      const bd = getMarketBreakdown(c.name, sDate, eDate);
                      totalBet += bd.totalInvestment;
                      totalWin += bd.totalWinningAmount;
                    });
                    const totalComm = totalBet * 0.04;
                    const totalBonus = totalBet * 0.0005;
                    const netAmt = totalBet - totalWin - totalComm;

                    return (
                      <div className="bg-[#EFEFDE]/30 bg-[#F8F9FA] rounded border border-[#DEE2E6] p-5 space-y-3 mt-4">
                        <h2 className="text-xl font-bold text-[#212529]">Summary</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 gap-x-6 text-xs font-bold text-[#212529]">
                          <div>Total Betting : <span className="font-mono">₹{totalBet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                          <div>Total Winning : <span className="font-mono">₹{totalWin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                          <div>Total Commission : <span className="font-mono">₹{totalComm.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                          <div>Total Bonus : <span className="font-mono">₹{totalBonus.toFixed(2)}</span> <span className="text-red-500 font-normal text-[10px]">(Effective from 14-08-2024)</span></div>
                          <div>Net Amount : <span className="font-mono">₹{netAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* MATKA GAME SUB-MODULE 5: CATEGORIES (Matching media_1787977958362.png 100%) */}
            {activeTab === 'categories' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Category Management</h1>
                  <button onClick={() => setShowAddCategoryModal(true)} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-3.5 py-1.5 rounded text-xs font-bold shadow-sm">+ Add</button>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5">
                      <span>Show</span>
                      <select value={entriesPerPage} onChange={(e)=>setEntriesPerPage(e.target.value)} className="border border-[#CED4DA] px-2 py-1 rounded text-xs">
                        <option value="10">10</option>
                        <option value="25">25</option>
                      </select>
                      <span>entries</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span>Search:</span>
                      <input type="text" value={filterSearch} onChange={(e)=>setFilterSearch(e.target.value)} className="border border-[#CED4DA] px-2 py-1 rounded text-xs" />
                    </div>
                  </div>

                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Category Status ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6] text-center">Betting Toggle (Daily ON/OFF)</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Category Image</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Category Name ⇅</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Open Time</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Close Time</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Result Time</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoriesList.filter(c => !filterSearch || c.name.toLowerCase().includes(filterSearch.toLowerCase())).map((c, i) => {
                        const isMarketOn = gameSchedules[c.name]?.enabled !== false;
                        return (
                          <tr key={i} className="hover:bg-[#F4F6F9]">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6]"><span className="px-2 py-0.5 rounded bg-[#007BFF] text-white text-[10px] font-bold">{c.status}</span></td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-center">
                              <button
                                onClick={() => handleToggleMarketStatus(c.name)}
                                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all shadow-sm flex items-center justify-center mx-auto space-x-1.5 ${
                                  isMarketOn
                                    ? 'bg-[#28A745] hover:bg-[#218838] text-white ring-2 ring-[#28A745]/30'
                                    : 'bg-[#DC3545] hover:bg-[#C82333] text-white ring-2 ring-[#DC3545]/30'
                                }`}
                                title={`Click to turn ${isMarketOn ? 'OFF' : 'ON'} betting for ${c.name}`}
                              >
                                <span>{isMarketOn ? '🟢' : '🔴'}</span>
                                <span>{isMarketOn ? 'Market ON' : 'Market OFF'}</span>
                              </button>
                            </td>
                            <td className="p-2.5 border-r border-[#DEE2E6]">
                              {c.previewUrl ? (
                                <img src={c.previewUrl} alt={c.name} className="w-8 h-8 object-cover rounded" />
                              ) : (
                                <span className="text-gray-400">🖼️</span>
                              )}
                            </td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{c.name}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px]">{(gameSchedules[c.name] && gameSchedules[c.name].open) || 'N/A'}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px]">{(gameSchedules[c.name] && gameSchedules[c.name].close) || 'N/A'}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] text-[#28A745]">{(gameSchedules[c.name] && gameSchedules[c.name].result) || 'N/A'}</td>
                            <td className="p-2.5 text-center space-x-1">
                              <button onClick={() => {
                                setEditingCategory(c);
                                const sched = gameSchedules[c.name] || { open: '', close: '', result: '' };
                                setEditScheduleForm({ open: sched.open, close: sched.close, result: sched.result });
                              }} className="bg-[#17A2B8] hover:bg-[#138496] text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm" title="Edit Schedule">✏️ Edit</button>
                              <button onClick={()=>setCategoriesList(categoriesList.filter(x=>x.id!==c.id))} className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">🗑️</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 1. DASHBOARD MODULE */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* 1.1 CALENDAR & DATE RANGE SELECTION HEADER */}
                {(() => {
                  const todayStr = getTodayISTString();
                  const [sy, sm, sd] = (dashboardStartDate || todayStr).split('-');
                  const [ey, em, ed] = (dashboardEndDate || todayStr).split('-');
                  const startDisplayStr = `${sd}/${sm}/${sy}`;
                  const endDisplayStr = `${ed}/${em}/${ey}`;
                  const isSingleDay = (dashboardStartDate === dashboardEndDate);
                  const isTodaySelected = isSingleDay && (dashboardStartDate === todayStr);

                  return (
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-lg border border-[#DEE2E6] shadow-sm">
                      <div>
                        <h1 className="text-2xl font-bold text-[#212529] flex items-center gap-2">
                          <span>Dashboard</span>
                          {statsLoading && <span className="text-xs text-blue-600 animate-pulse font-normal bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Updating...</span>}
                        </h1>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>Showing data:</span>
                          {isSingleDay ? (
                            <>
                              <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">{startDisplayStr}</span>
                              {isTodaySelected ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold">Today</span>
                              ) : (
                                <span className="bg-blue-100 text-blue-800 text-[11px] px-2 py-0.5 rounded-full font-bold">Single Day</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">{startDisplayStr}</span>
                              <span className="text-gray-400 font-bold">➔</span>
                              <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">{endDisplayStr}</span>
                              <span className="bg-indigo-100 text-indigo-800 text-[11px] px-2 py-0.5 rounded-full font-bold">Date Range</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* START DATE & END DATE CONTROLS */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded px-2.5 py-1 shadow-sm">
                          <label className="text-[11px] font-bold text-gray-700 whitespace-nowrap flex items-center gap-1">
                            <span>📅</span> Start Date:
                          </label>
                          <input
                            type="date"
                            value={dashboardStartDate}
                            onChange={(e) => handleStartDateChange(e.target.value)}
                            className="border border-blue-400 focus:ring-1 focus:ring-blue-300 rounded px-2 py-0.5 text-xs font-bold text-gray-800 bg-white outline-none cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center gap-1 bg-gray-50 border border-gray-300 rounded px-2.5 py-1 shadow-sm">
                          <label className="text-[11px] font-bold text-gray-700 whitespace-nowrap flex items-center gap-1">
                            <span>📅</span> End Date:
                          </label>
                          <input
                            type="date"
                            value={dashboardEndDate}
                            onChange={(e) => handleEndDateChange(e.target.value)}
                            className="border border-blue-400 focus:ring-1 focus:ring-blue-300 rounded px-2 py-0.5 text-xs font-bold text-gray-800 bg-white outline-none cursor-pointer"
                          />
                        </div>

                        {/* QUICK SHORTCUT BUTTONS */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={handleDashboardSetToday}
                            className={`px-3 py-1 border rounded text-xs font-bold shadow-sm transition active:scale-95 ${
                              isSingleDay && isTodaySelected
                                ? 'bg-[#007BFF] text-white border-[#007BFF]'
                                : 'bg-white hover:bg-gray-50 text-[#007BFF] border-[#007BFF]'
                            }`}
                          >
                            Today
                          </button>
                          <button
                            onClick={handleDashboardSetYesterday}
                            className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded text-xs font-bold text-gray-700 shadow-sm transition active:scale-95"
                          >
                            Yesterday
                          </button>
                          <button
                            onClick={handleDashboardSetLast7Days}
                            className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded text-xs font-bold text-gray-700 shadow-sm transition active:scale-95"
                          >
                            Last 7 Days
                          </button>
                          <button
                            onClick={handleDashboardSetThisMonth}
                            className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded text-xs font-bold text-gray-700 shadow-sm transition active:scale-95"
                          >
                            This Month
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                  {(() => {
                    const todayStr = getTodayISTString();
                    const [sy, sm, sd] = (dashboardStartDate || todayStr).split('-');
                    const [ey, em, ed] = (dashboardEndDate || todayStr).split('-');
                    const startDisplayStr = `${sd}/${sm}/${sy}`;
                    const endDisplayStr = `${ed}/${em}/${ey}`;
                    const isSingleDay = (dashboardStartDate === dashboardEndDate);
                    const isTodaySelected = isSingleDay && (dashboardStartDate === todayStr);

                    const datePrefix = (isSingleDay && isTodaySelected)
                      ? 'Today'
                      : (isSingleDay ? startDisplayStr : (sy === ey ? `${sd}/${sm} - ${ed}/${em}` : `${startDisplayStr} - ${endDisplayStr}`));

                    const isTargetSelectedDateRange = (dateVal?: any, idVal?: any) => {
                      if (!dateVal && !idVal) return false;
                      try {
                        const ts = parseToTimestamp(dateVal, idVal);
                        if (ts > 0) {
                          const dt = new Date(ts);
                          const dtIST = new Date(dt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                          const y = dtIST.getFullYear();
                          const m = String(dtIST.getMonth() + 1).padStart(2, '0');
                          const d = String(dtIST.getDate()).padStart(2, '0');
                          const itemISO = `${y}-${m}-${d}`;
                          return itemISO >= dashboardStartDate && itemISO <= dashboardEndDate;
                        }
                        const str = String(dateVal || '');
                        const m = str.match(/(\d{4}-\d{2}-\d{2})/);
                        if (m) return m[1] >= dashboardStartDate && m[1] <= dashboardEndDate;
                        const mDmy = str.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
                        if (mDmy) {
                          const iso = `${mDmy[3]}-${String(mDmy[2]).padStart(2, '0')}-${String(mDmy[1]).padStart(2, '0')}`;
                          return iso >= dashboardStartDate && iso <= dashboardEndDate;
                        }
                        if (isSingleDay && isTodaySelected && /^\d{1,2}:\d{1,2}/.test(str)) return true;
                        return false;
                      } catch (e) {
                        return false;
                      }
                    };

                    const isMatchCurrentRange = (stats.startDate === dashboardStartDate && stats.endDate === dashboardEndDate);

                    const totalUsersVal = stats.users !== undefined ? stats.users : users.length;
                    const rangeNewUsersVal = (isMatchCurrentRange && stats.dailyNewUsers !== undefined)
                      ? stats.dailyNewUsers
                      : users.filter(u => isTargetSelectedDateRange(u.createdAt || u.created_at, u.id || u._id)).length;

                    const totalDepVal = stats.totalDeposite !== undefined ? stats.totalDeposite : deposits.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
                    const rangeDepVal = (isMatchCurrentRange && stats.todayDeposite !== undefined)
                      ? stats.todayDeposite
                      : deposits.filter(d => (!d.status || d.status.toLowerCase() === 'approved') && isTargetSelectedDateRange(d.createdAt || d.created_at || d.date || d.timestamp, d._id || d.id || d.utr)).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

                    const totalWinVal = stats.totalWinnings !== undefined ? stats.totalWinnings : winningsList.reduce((s, w) => s + (parseFloat(w.amount || w.win_amount) || 0), 0);
                    const rangeWinVal = (isMatchCurrentRange && stats.todayWinnings !== undefined)
                      ? stats.todayWinnings
                      : winningsList.filter(w => isTargetSelectedDateRange(w.dateOfWinning || w.date || w.created_at || w.createdAt, w._id || w.id)).reduce((s, w) => s + (parseFloat(w.amount || w.win_amount) || 0), 0);

                    const totalBetVal = stats.totalBetting !== undefined ? stats.totalBetting : bidsList.reduce((s, b) => s + (parseFloat(b.amount || b.bet_amount) || 0), 0);
                    const rangeBetVal = (isMatchCurrentRange && stats.todayBetting !== undefined)
                      ? stats.todayBetting
                      : bidsList.filter(b => isTargetSelectedDateRange(b.created_at || b.createdAt || b.date || b.timestamp, b._id || b.id)).reduce((s, b) => s + (parseFloat(b.amount || b.bet_amount) || 0), 0);

                    const totalWdVal = stats.totalWithdraws !== undefined ? stats.totalWithdraws : withdrawals.filter(w => !w.status || w.status.toLowerCase() === 'approved').reduce((s, w) => s + (parseFloat(w.amount) || 0), 0);
                    const rangeWdVal = (isMatchCurrentRange && stats.todayWithdraws !== undefined)
                      ? stats.todayWithdraws
                      : withdrawals.filter(w => (!w.status || w.status.toLowerCase() === 'approved') && isTargetSelectedDateRange(w.createdAt || w.created_at || w.date || w.timestamp, w._id || w.id)).reduce((s, w) => s + (parseFloat(w.amount) || 0), 0);

                    const totalBalVal = stats.totalBalanceWallet !== undefined ? stats.totalBalanceWallet : users.reduce((s, u) => s + (parseFloat(u.balance) || 0), 0);
                    const totalDepBalVal = stats.totalDepositWallet !== undefined ? stats.totalDepositWallet : users.reduce((s, u) => s + (parseFloat(u.deposit_balance) || 0), 0);
                    const totalWinBalVal = stats.totalWinningWallet !== undefined ? stats.totalWinningWallet : users.reduce((s, u) => s + (parseFloat(u.winning_balance) || 0), 0);
                    const totalCommVal = stats.totalCommissionWallet !== undefined ? stats.totalCommissionWallet : (totalBetVal * 0.04);
                    const totalBonusVal = stats.totalBonusWallet !== undefined ? stats.totalBonusWallet : users.reduce((s, u) => s + (parseFloat(u.bonus_balance !== undefined ? u.bonus_balance : 200) || 0), 0);

                    const dashboardCards = [
                      { title: 'Total Users', value: totalUsersVal, bg: 'bg-[#17A2B8]', icon: '👥' },
                      { title: `${datePrefix} New User`, value: rangeNewUsersVal, bg: 'bg-[#17A2B8]', icon: '👤' },
                      { title: 'Total Deposite', value: totalDepVal.toFixed(0), bg: 'bg-[#28A745]', icon: '💳' },
                      { title: `${datePrefix} Deposite`, value: rangeDepVal.toFixed(0), bg: 'bg-[#28A745]', icon: '💵' },
                      { title: 'Total winnings', value: totalWinVal.toFixed(0), bg: 'bg-[#FFC107]', icon: '🏆' },
                      { title: `${datePrefix} winning`, value: rangeWinVal.toFixed(0), bg: 'bg-[#FFC107]', icon: '🎖️' },
                      { title: 'Total Betting', value: totalBetVal.toFixed(0), bg: 'bg-[#DC3545]', icon: '🎰' },
                      { title: `${datePrefix} Betting`, value: rangeBetVal.toFixed(0), bg: 'bg-[#DC3545]', icon: '🎲' },
                      { title: 'Total Withdraw', value: totalWdVal.toFixed(0), bg: 'bg-[#E02424]', icon: '🏧' },
                      { title: `${datePrefix} Withdraw`, value: rangeWdVal.toFixed(0), bg: 'bg-[#E02424]', icon: '💸' },
                      { title: 'Total Balance(Wallet)', value: totalBalVal.toFixed(0), bg: 'bg-[#007BFF]', icon: '👛' },
                      { title: 'Total Deposit(Wallet)', value: totalDepBalVal.toFixed(0), bg: 'bg-[#007BFF]', icon: '🏦' },
                      { title: 'Total Winning(Wallet)', value: totalWinBalVal.toFixed(0), bg: 'bg-[#6C757D]', icon: '💰' },
                      { title: 'Total Commission(Wallet)', value: totalCommVal.toFixed(0), bg: 'bg-[#6C757D]', icon: '🎁' },
                      { title: 'Total Bonus(Wallet)', value: totalBonusVal.toFixed(0), bg: 'bg-[#6C757D]', icon: '🎁' }
                    ];

                    const depositChartData = (isMatchCurrentRange && Array.isArray(stats.chartDeposits) && stats.chartDeposits.length > 0)
                      ? stats.chartDeposits
                      : [0, 0, 0, 0, 0, 0];

                    const withdrawChartData = (isMatchCurrentRange && Array.isArray(stats.chartWithdraws) && stats.chartWithdraws.length > 0)
                      ? stats.chartWithdraws
                      : [0, 0, 0, 0, 0, 0];

                    const chartLabels = (isMatchCurrentRange && Array.isArray(stats.chartLabels) && stats.chartLabels.length > 0)
                      ? stats.chartLabels
                      : (isSingleDay ? ['12 AM-4 AM', '4 AM-8 AM', '8 AM-12 PM', '12 PM-4 PM', '4 PM-8 PM', '8 PM-12 AM'] : ['Start', 'End']);

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {dashboardCards.map((card, i) => (
                            <div key={i} className={`rounded ${card.bg} text-white p-4 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[100px]`}>
                              <div>
                                <h3 className="text-2xl font-bold font-mono">{card.value}</h3>
                                <p className="text-xs font-semibold text-white/90 mt-1">{card.title}</p>
                              </div>
                              <div className="absolute right-3 top-3 text-3xl opacity-20 pointer-events-none">
                                {card.icon}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="bg-white p-4 rounded-lg border border-[#DEE2E6] shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-[#212529] mb-1">Graph Start Date</label>
                            <input
                              type="text"
                              value={graphStartDate}
                              onChange={(e) => {
                                setGraphStartDate(e.target.value);
                                const p = e.target.value.split('-');
                                if (p.length === 3) handleStartDateChange(`${p[2]}-${p[1]}-${p[0]}`);
                              }}
                              className="w-full border border-[#CED4DA] px-3 py-2 rounded text-xs text-[#495057]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[#212529] mb-1">Graph End Date</label>
                            <input
                              type="text"
                              value={graphEndDate}
                              onChange={(e) => {
                                setGraphEndDate(e.target.value);
                                const p = e.target.value.split('-');
                                if (p.length === 3) handleEndDateChange(`${p[2]}-${p[1]}-${p[0]}`);
                              }}
                              className="w-full border border-[#CED4DA] px-3 py-2 rounded text-xs text-[#495057]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[#212529] mb-1">Chart Type</label>
                            <select value={chartType} onChange={(e) => setChartType(e.target.value as any)} className="w-full border border-[#CED4DA] px-3 py-2 rounded text-xs text-[#495057]">
                              <option value="line">Line</option>
                              <option value="column">Column</option>
                              <option value="bar">Bar</option>
                              <option value="pie">Pie</option>
                              <option value="doughnut">Doughnut</option>
                            </select>
                          </div>
                        </div>

                        <CanvasChart title={`Deposits (${datePrefix})`} color="#007BFF" dataPoints={depositChartData} chartType={chartType} labels={chartLabels} />
                        <CanvasChart title={`Withdraws (${datePrefix})`} color="#DC3545" dataPoints={withdrawChartData} chartType={chartType} labels={chartLabels} />
                      </>
                    );
                  })()}
              </div>
            )}

            {/* 2. ADMINS MODULE */}
            {activeTab === 'admins' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Admins Management</h1>
                  <button onClick={() => { setEditingAdmin(null); setAdminForm({ name: '', username: '', mobile: '', password: '', role: 'Super Admin', status: 'Active' }); setShowAddAdminModal(true); }} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-3.5 py-1.5 rounded text-xs font-bold shadow-sm">+ Add</button>
                </div>
                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Username</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Mobile</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Role</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminsList.map((a, i) => (
                        <tr key={i} className="hover:bg-[#F4F6F9]">
                          <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{a.name}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold text-[#007BFF]">{a.username}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]">{a.mobile}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold text-amber-600">{a.role}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]"><span className="px-2 py-0.5 rounded bg-[#28A745] text-white text-[10px] font-bold">{a.status}</span></td>
                          <td className="p-2.5 text-right space-x-1">
                            <button onClick={() => { setEditingAdmin(a); setAdminForm(a); setShowAddAdminModal(true); }} className="bg-[#007BFF] text-white px-2 py-1 rounded text-[10px] font-bold">Edit</button>
                            <button onClick={() => setAdminsList(adminsList.filter(x => x.id !== a.id))} className="bg-[#DC3545] text-white px-2 py-1 rounded text-[10px] font-bold">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. USERS MODULE (MATCHING MEDIA_1787984030292.PNG & MEDIA_1787984043309.JPG 100%) */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">User Management</h1>
                  <button onClick={() => setShowAddUserModal(true)} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-4 py-1.5 rounded text-xs font-bold shadow-sm">+ Add</button>
                </div>

                {/* FILTER CARD MATCHING SCREENSHOTS 1 & 2 */}
                <form onSubmit={handleExecuteSearch} className="bg-white p-4 rounded border border-[#DEE2E6] shadow-sm space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Name / Email / Phone</label>
                    <input
                      type="text"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Enter name, email or phone"
                      className="w-full border border-[#CED4DA] p-2 rounded text-xs text-[#495057] focus:outline-none focus:border-[#80BDFF]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Extra Filter</label>
                    <select
                      value={appliedCategory !== 'All' ? appliedCategory : filterCategory}
                      onChange={(e) => { setFilterCategory(e.target.value); setAppliedCategory(e.target.value); }}
                      className="w-full border border-[#CED4DA] p-2 rounded text-xs text-[#495057]"
                    >
                      <option value="All">All</option>
                      <option value="Active">Active</option>
                      <option value="Blocked">Blocked</option>
                      <option value="Deactive">Deactive</option>
                      <option value="Web-Site">Web-Site</option>
                      <option value="Play Store">Play Store</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" onClick={handleExecuteSearch} className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-1.5 rounded font-bold shadow-sm">Search</button>
                    <button type="button" onClick={handleClearFilters} className="bg-white border border-[#CED4DA] text-[#212529] px-4 py-1.5 rounded font-bold shadow-sm hover:bg-gray-100">Clear</button>
                  </div>
                </form>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <div className="flex justify-between items-center text-xs text-[#6C757D]">
                    <div className="flex items-center gap-1.5">
                      <span>Show</span>
                      <select value={entriesPerPage} onChange={(e)=>setEntriesPerPage(e.target.value)} className="border border-[#CED4DA] px-2 py-1 rounded text-xs">
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                      <span>entries</span>
                    </div>
                  </div>

                  {/* USER TABLE MATCHING MEDIA_1787984030292.PNG & MEDIA_1787984043309.JPG 100% */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                      <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                        <tr>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Name ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Email ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Phone ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Registered At ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Referals</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Refer By</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Deactive Reason</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.filter(u => {
                          const q = (appliedSearch || filterSearch).toLowerCase().trim();
                          if (q) {
                            const matches = (u.name && u.name.toLowerCase().includes(q)) ||
                                            (u.email && u.email.toLowerCase().includes(q)) ||
                                            (u.mobile && u.mobile.toString().includes(q));
                            if (!matches) return false;
                          }
                          return true;
                        }).map((u, i) => (
                          <tr key={i} className="hover:bg-[#F4F6F9] align-middle">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{u.name || 'User'}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-700">{u.email || `${u.name || 'user'}@gmail.com`}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-[#007BFF] font-bold font-mono cursor-pointer hover:underline">{u.mobile}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-600">{u.createdAt ? u.createdAt.replace('T', ' ').slice(0, 19) : '2026-08-29 09:50:00'}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-center font-mono text-slate-800">
                              <div className="font-bold">{u.referrals !== undefined ? u.referrals : (u.referrals_count || 0)}</div>
                              <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                {u.referral_enabled === false && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#DC3545] text-white rounded">
                                    Ref: OFF
                                  </span>
                                )}
                                {u.custom_referral_commission !== undefined && u.custom_referral_commission !== null && String(u.custom_referral_commission).trim() !== '' && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#28A745] text-white rounded">
                                    {u.custom_referral_commission}% Comm
                                  </span>
                                )}
                                {u.self_bet_commission !== undefined && u.self_bet_commission !== null && String(u.self_bet_commission).trim() !== '' && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#6F42C1] text-white rounded">
                                    Self: {u.self_bet_commission}%
                                  </span>
                                )}
                                {(u.custom_jodi_rate || u.custom_haroof_rate || u.custom_crossing_rate) && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#17A2B8] text-white rounded">
                                    Rates: {u.custom_jodi_rate || 95}x / {u.custom_haroof_rate || 9.5}x
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{u.referBy || u.referred_by || '-'}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-red-600 max-w-xs truncate">{u.blockReason || u.deactiveReason || ''}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6]">
                              <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                  <span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${u.is_blocked ? 'bg-[#DC3545]' : 'bg-[#007BFF]'}`}>{u.is_blocked ? 'Blocked' : (u.status || 'Active')}</span>
                                  <span className="px-2 py-0.5 rounded bg-[#0056B3] text-white text-[10px] font-bold">Web-Site</span>
                                </div>
                                <span className="text-[10px] text-gray-500 font-mono">web</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex justify-center items-center gap-1">
                                <button
                                  onClick={() => { setSelectedUser(u); setActiveTab('userDetails'); }}
                                  className="bg-[#FFC107] hover:bg-[#E0A800] text-[#212529] px-2 py-1 rounded text-[10px] font-bold shadow-sm"
                                  title="View User Details"
                                >
                                  👁️
                                </button>
                                <button
                                  onClick={() => { setSelectedUser(u); setEditUserForm(u); setActiveTab('userEdit'); }}
                                  className="bg-[#17A2B8] hover:bg-[#138496] text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm"
                                  title="Edit User"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to permanently delete user "${u.name || u.mobile}"?`)) {
                                      try {
                                        const targetId = u.id || u._id || u.mobile;
                                        const res = await fetch(`${API_BASE}/api/admin/users/${targetId}`, { method: 'DELETE' });
                                        const data = await res.json();
                                        if (data.success) {
                                          setUsers(prev => prev.filter(x => (x.id !== u.id && (!u._id || x._id !== u._id) && (!u.mobile || x.mobile !== u.mobile))));
                                          await fetchLiveData();
                                          alert('User deleted permanently.');
                                        } else {
                                          alert(data.message || 'Failed to delete user.');
                                        }
                                      } catch (err) {
                                        alert('Error deleting user.');
                                      }
                                    }
                                  }}
                                  className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm"
                                  title="Delete User"
                                >
                                  🗑️
                                </button>
                                <button
                                  onClick={async () => {
                                    const isBlocked = u.is_blocked;
                                    const action = isBlocked ? 'unblock' : 'block';
                                    let blockReason = '';
                                    if (!isBlocked) {
                                      const reason = window.prompt(`⚠️ PERMANENTLY BLOCK user "${u.name || u.mobile}" (${u.mobile})?\n\nThis user will NEVER be able to register or login again.\n\nEnter the reason for blocking:`);
                                      if (reason === null) return; // cancelled
                                      if (!reason.trim()) { alert('Block reason is required!'); return; }
                                      blockReason = reason.trim();
                                    } else {
                                      if (!window.confirm(`Unblock user "${u.name || u.mobile}"?`)) return;
                                    }
                                    try {
                                      const res = await fetch(`${API_BASE}/api/admin/users/${action}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ mobile: u.mobile, reason: blockReason })
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        setUsers(prev => prev.map(x =>
                                          x.mobile === u.mobile ? { ...x, is_blocked: !isBlocked, status: isBlocked ? 'Active' : 'Blocked', blockReason: isBlocked ? '' : blockReason } : x
                                        ));
                                        alert(data.message);
                                      } else {
                                        alert(data.message || `Failed to ${action} user.`);
                                      }
                                    } catch (err) {
                                      alert(`Error ${action}ing user.`);
                                    }
                                  }}
                                  className={`${u.is_blocked ? 'bg-[#28A745] hover:bg-[#218838]' : 'bg-[#6C757D] hover:bg-[#5A6268]'} text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm`}
                                  title={u.is_blocked ? 'Unblock User' : 'Block User Permanently'}
                                >
                                  {u.is_blocked ? '🔓' : '🚫'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* BOTTOM PAGINATION BAR MATCHING SCREENSHOTS 1 & 2 */}
                  <div className="flex flex-wrap justify-between items-center pt-2 text-xs text-[#6C757D] gap-2">
                    <div>Showing 1 to {users.length} of {users.length} entries</div>
                    <div className="flex gap-1 font-bold">
                      <button className="px-2.5 py-1 rounded border border-[#CED4DA] bg-white text-gray-600 hover:bg-gray-100">Previous</button>
                      <button className="px-3 py-1 rounded bg-[#007BFF] text-white">1</button>
                      <button className="px-2.5 py-1 rounded border border-[#CED4DA] bg-white text-gray-600 hover:bg-gray-100">2</button>
                      <button className="px-2.5 py-1 rounded border border-[#CED4DA] bg-white text-gray-600 hover:bg-gray-100">3</button>
                      <button className="px-2.5 py-1 rounded border border-[#CED4DA] bg-white text-gray-600 hover:bg-gray-100">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {activeTab === 'userDetails' && selectedUser && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">User Details</h1>
                  <button onClick={() => setActiveTab('users')} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-4 py-1.5 rounded text-xs font-bold shadow-sm">← Back</button>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm overflow-hidden">
                  <div className="flex border-b border-[#DEE2E6] px-4 pt-3 gap-2 text-xs font-bold bg-[#FFFFFF]">
                    {[
                      { id: 'profile', label: 'Profile' },
                      { id: 'bankDetails', label: 'Bank Details' },
                      { id: 'walletTransaction', label: 'Wallet Transaction' },
                      { id: 'gameHistory', label: 'Game History' },
                      { id: 'referHistory', label: 'Refer History' },
                      { id: 'gameLedger', label: 'Game Ledger' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setUserDetailsTab(tab.id as any)}
                        className={`px-4 py-2 rounded-t font-semibold transition-all ${
                          userDetailsTab === tab.id
                            ? 'bg-[#007BFF] text-white font-bold'
                            : 'text-[#6C757D] hover:text-[#212529]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {userDetailsTab === 'profile' && (
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                      <div className="flex flex-col items-center justify-center space-y-3 border-r border-[#DEE2E6] pr-6">
                        <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-xl font-bold text-gray-600">
                          👤
                        </div>
                        <h2 className="text-xl font-bold text-[#212529]">{selectedUser.name}</h2>
                        <span className={`px-2.5 py-0.5 rounded text-white text-[11px] font-bold ${selectedUser.is_blocked ? 'bg-[#DC3545]' : 'bg-[#007BFF]'}`}>{selectedUser.is_blocked ? 'Blocked' : 'Active'}</span>

                        {selectedUser.is_blocked && selectedUser.blockReason && (
                          <div className="bg-red-50 border border-red-200 rounded p-2 mt-2 max-w-xs">
                            <p className="text-[10px] font-bold text-red-700 uppercase">🚫 Block Reason:</p>
                            <p className="text-xs text-red-600 mt-0.5">{selectedUser.blockReason}</p>
                          </div>
                        )}

                        {(() => {
                          const matchesUser = (item: any) => {
                            if (!item || !selectedUser) return false;
                            const cleanMob = String(selectedUser.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                            const userId = String(selectedUser.id || selectedUser._id || '');

                            const itemRawPhone = String(item.mobile || item.phone || item.userPhone || '').replace(/[^0-9]/g, '');
                            const itemMob = itemRawPhone.length >= 10 ? itemRawPhone.slice(-10) : '';
                            if (cleanMob && itemMob && cleanMob === itemMob) return true;

                            const rawUserStr = String(item.user || item.username || item.userName || '');
                            const userStrMob = rawUserStr.replace(/[^0-9]/g, '');
                            if (cleanMob && userStrMob.length >= 10 && userStrMob.includes(cleanMob)) return true;

                            if (userId && (String(item.userId) === userId || String(item.user_id) === userId || String(item.id) === userId)) return true;
                            return false;
                          };

                          const userDeps = (deposits || []).filter(d => matchesUser(d) && (d.status === 'Approved' || d.status === 'approved'));
                          const recordedDep = userDeps.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                          const realDep = recordedDep > 0 ? recordedDep : (parseFloat(selectedUser.deposit_balance) || 0);

                          const userBids = (bidsList || []).filter(b => matchesUser(b));
                          const wonBids = userBids.filter(b => b.status === 'Won' || b.status === 'won');
                          const realWin = wonBids.reduce((sum, b) => {
                            const mult = getBetMultiplier(b);
                            return sum + (parseFloat(b.win_amount || b.winAmount) || ((parseFloat(b.amount || b.bet_amount) || 0) * mult));
                          }, 0);

                          const userWds = (withdrawals || []).filter(w => matchesUser(w) && (w.status === 'Approved' || w.status === 'approved'));
                          const realWd = userWds.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);

                          return (
                            <div className="text-center space-y-1.5 pt-4 text-base text-[#212529]">
                              <p className="font-semibold">Total Deposit: <strong className="font-bold">₹{realDep.toFixed(0)}</strong></p>
                              <p className="font-semibold">Total Winning: <strong className="font-bold">₹{realWin.toFixed(0)}</strong></p>
                              <p className="font-semibold">Total Withdrawl: <strong className="font-bold">₹{realWd.toFixed(0)}</strong></p>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-4 text-base text-[#212529]">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">✉️</span>
                          <span className="font-semibold">{selectedUser.email || `${(selectedUser.name || 'user').toLowerCase()}@gmail.com`}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📞</span>
                          <span className="font-semibold">{selectedUser.mobile}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🎂</span>
                          <span className="font-semibold">{selectedUser.dob || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📍</span>
                          <span className="font-semibold">{selectedUser.address || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">💰</span>
                          <span className="font-semibold">My Wallet:- ₹{selectedUser.balance || 0}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🎁</span>
                          <span className="font-semibold">My Referal Code:- {selectedUser.referral_code || selectedUser.referralCode || selectedUser.mobile}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🚻</span>
                          <span className="font-semibold">{selectedUser.gender || 'Male'}</span>
                        </div>
                        {selectedUser.is_blocked && selectedUser.blockReason && (
                          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded p-3">
                            <span className="text-xl">🚫</span>
                            <div>
                              <span className="font-bold text-red-700 text-sm">Blocked Reason:</span>
                              <p className="text-red-600 text-sm mt-0.5">{selectedUser.blockReason}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <span className="text-xl text-red-500 font-bold">❌</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: BANK DETAILS */}
                  {userDetailsTab === 'bankDetails' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">Bank & UPI Settlement Details</h3>
                      <div className="bg-[#F8F9FA] p-4 rounded border border-[#DEE2E6] space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div><span className="text-gray-500 block">Bank Name</span><strong>{selectedUser.bank_name || selectedUser.bankName || 'State Bank of India'}</strong></div>
                          <div><span className="text-gray-500 block">Account Number</span><strong className="font-mono">{selectedUser.account_number || selectedUser.accountNumber || 'XXXX-XXXX-4892'}</strong></div>
                          <div><span className="text-gray-500 block">IFSC Code</span><strong className="font-mono">{selectedUser.ifsc_code || selectedUser.ifsc || 'SBIN0001234'}</strong></div>
                          <div><span className="text-gray-500 block">Account Holder</span><strong>{selectedUser.name}</strong></div>
                          <div><span className="text-gray-500 block">UPI ID</span><strong className="font-mono text-[#007BFF]">{selectedUser.upi_id || selectedUser.upi || `${selectedUser.mobile}@okaxis`}</strong></div>
                          <div><span className="text-gray-500 block">KYC Verification</span><span className="px-2 py-0.5 rounded bg-[#28A745] text-white text-[10px] font-bold">VERIFIED</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: WALLET TRANSACTIONS */}
                  {userDetailsTab === 'walletTransaction' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">Wallet Transaction History</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                          <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                            <tr>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Txn ID</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Type</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const matchesUser = (item: any) => {
                                if (!item || !selectedUser) return false;
                                const cleanMob = String(selectedUser.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                                const userId = String(selectedUser.id || selectedUser._id || '');

                                const itemRawPhone = String(item.mobile || item.phone || item.userPhone || '').replace(/[^0-9]/g, '');
                                const itemMob = itemRawPhone.length >= 10 ? itemRawPhone.slice(-10) : '';
                                if (cleanMob && itemMob && cleanMob === itemMob) return true;

                                const rawUserStr = String(item.user || item.username || item.userName || '');
                                const userStrMob = rawUserStr.replace(/[^0-9]/g, '');
                                if (cleanMob && userStrMob.length >= 10 && userStrMob.includes(cleanMob)) return true;

                                if (userId && (String(item.userId) === userId || String(item.user_id) === userId || String(item.id) === userId)) return true;
                                return false;
                              };

                              const userDeps = (deposits || []).filter(d => matchesUser(d));
                              const userWds = (withdrawals || []).filter(w => matchesUser(w));
                              const userBids = (bidsList || []).filter(b => matchesUser(b));

                              const signupTs = parseToTimestamp(selectedUser.createdAt, selectedUser.id, selectedUser.createdAt) || 0;

                              const allTxns: any[] = [
                                {
                                  id: `bonus_${selectedUser.id || selectedUser.mobile}`,
                                  type: 'Joining Bonus',
                                  amount: '+₹200.00',
                                  date: formatDisplayDate(selectedUser.createdAt, selectedUser.id, selectedUser.createdAt),
                                  status: 'Approved',
                                  rawDate: signupTs
                                },
                                ...userDeps.map((d, idx) => {
                                  const t = parseToTimestamp(d.created_at || d.createdAt || d.date, d._id || d.id, selectedUser.createdAt) || (signupTs + 1000 + idx * 100);
                                  return {
                                    id: String(d._id || d.id || `dep_${idx}`),
                                    type: d.method || d.payment_method ? `Deposit (${d.method || d.payment_method})` : 'Deposit',
                                    amount: `+₹${(parseFloat(d.amount) || 0).toFixed(2)}`,
                                    date: formatDisplayDate(d.created_at || d.createdAt || d.date, d._id || d.id, selectedUser.createdAt),
                                    status: d.status || 'Approved',
                                    rawDate: t
                                  };
                                }),
                                ...userBids.map((b, idx) => {
                                  const t = parseToTimestamp(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt) || (signupTs + 2000 + idx * 100);
                                  return {
                                    id: String(b.id || `bet_${idx}`),
                                    type: `Bet Placed (${b.category || 'Game'} - #${b.number})`,
                                    amount: `-₹${(parseFloat(b.amount || b.bet_amount) || 0).toFixed(2)}`,
                                    date: formatDisplayDate(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt),
                                    status: b.status || 'Pending',
                                    rawDate: t
                                  };
                                }),
                                ...userBids.filter(b => b.status === 'Won' || b.status === 'won' || (parseFloat(b.win_amount || b.winAmount) || 0) > 0).map((b, idx) => {
                                  const mult = getBetMultiplier(b);
                                  const winAmt = parseFloat(b.win_amount || b.winAmount) || ((parseFloat(b.amount || b.bet_amount) || 0) * mult);
                                  const t = parseToTimestamp(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt) || (signupTs + 2000 + idx * 100);
                                  return {
                                    id: String(b.id || `win_${idx}`) + '_win',
                                    type: `Winning Payout (${b.category || 'Game'} - #${b.number}) 🎉`,
                                    amount: `+₹${winAmt.toFixed(2)}`,
                                    date: formatDisplayDate(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt),
                                    status: 'Approved',
                                    rawDate: t + 50
                                  };
                                }),
                                ...userWds.map((w, idx) => {
                                  const t = parseToTimestamp(w.created_at || w.createdAt || w.date, w._id || w.id, selectedUser.createdAt) || (signupTs + 3000 + idx * 100);
                                  return {
                                    id: String(w._id || w.id || `wd_${idx}`),
                                    type: 'Withdrawal',
                                    amount: `-₹${(parseFloat(w.amount) || 0).toFixed(2)}`,
                                    date: formatDisplayDate(w.created_at || w.createdAt || w.date, w._id || w.id, selectedUser.createdAt),
                                    status: w.status || 'Pending',
                                    rawDate: t
                                  };
                                })
                              ];

                              allTxns.sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0));

                              return allTxns.map((item, i) => (
                                <tr key={i} className="hover:bg-[#F4F6F9]">
                                  <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{item.id}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{item.type}</td>
                                  <td className={`p-2.5 border-r border-[#DEE2E6] font-mono font-bold ${item.amount.startsWith('+') ? 'text-[#28A745]' : 'text-[#DC3545]'}`}>{item.amount}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-600">{item.date}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6]"><span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${item.status === 'Approved' || item.status === 'Won' ? 'bg-[#28A745]' : (item.status === 'Rejected' || item.status === 'Lost' ? 'bg-[#DC3545]' : 'bg-[#007BFF]')}`}>{item.status}</span></td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: GAME HISTORY */}
                  {userDetailsTab === 'gameHistory' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">Betting & Game History</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                          <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                            <tr>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Market</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Game Type</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Number</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Bet Amount</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Payout</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                              <th className="p-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const matchesUser = (item: any) => {
                                if (!item || !selectedUser) return false;
                                const cleanMob = String(selectedUser.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                                const userId = String(selectedUser.id || selectedUser._id || '');

                                const itemRawPhone = String(item.mobile || item.phone || item.userPhone || '').replace(/[^0-9]/g, '');
                                const itemMob = itemRawPhone.length >= 10 ? itemRawPhone.slice(-10) : '';
                                if (cleanMob && itemMob && cleanMob === itemMob) return true;

                                const rawUserStr = String(item.user || item.username || item.userName || '');
                                const userStrMob = rawUserStr.replace(/[^0-9]/g, '');
                                if (cleanMob && userStrMob.length >= 10 && userStrMob.includes(cleanMob)) return true;

                                if (userId && (String(item.userId) === userId || String(item.user_id) === userId || String(item.id) === userId)) return true;
                                return false;
                              };

                              const userBids = bidsList.filter(matchesUser).sort((a, b) => {
                                const tA = parseToTimestamp(a.created_at || a.createdAt || a.date, a._id || a.id, selectedUser.createdAt);
                                const tB = parseToTimestamp(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt);
                                return tB - tA;
                              });
                              if (userBids.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={8} className="p-6 text-center text-[#6C757D] font-medium bg-[#F8F9FA]">
                                      No game bets found for {selectedUser.name}
                                    </td>
                                  </tr>
                                );
                              }

                              return userBids.map((b, i) => {
                                const mult = getBetMultiplier(b);
                                const amt = parseFloat(b.amount || b.bet_amount) || 0;
                                const payout = parseFloat(b.win_amount || b.winAmount || b.potential_payout) || (amt * mult);

                                return (
                                  <tr key={i} className="hover:bg-[#F4F6F9]">
                                    <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                                    <td className="p-2.5 border-r border-[#DEE2E6] font-bold text-[#007BFF]">{b.category}</td>
                                    <td className="p-2.5 border-r border-[#DEE2E6]">{b.gameType || 'Single Jodi'}</td>
                                    <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-lg text-slate-800">{b.number}</td>
                                    <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#DC3545]">₹ {amt.toFixed(2)}</td>
                                    <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#28A745]">₹ {payout.toFixed(2)} <span className="text-[10px] text-gray-500 font-normal">({mult}x)</span></td>
                                    <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-600">{formatDisplayDate(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt)}</td>
                                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-[#FFC107] text-black text-[10px] font-bold">{b.status || 'Pending'}</span></td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: REFER HISTORY */}
                  {userDetailsTab === 'referHistory' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">Referral & Commission History</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                          <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                            <tr>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Referred User</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Mobile</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Joined Date</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                              <th className="p-2.5">Commission Earned</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const refCleanMob = String(selectedUser.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                              const myRefCode = selectedUser.referral_code || selectedUser.referralCode || refCleanMob;
                              const referredUsers = users.filter(u => {
                                if (u.id === selectedUser.id) return false;
                                if (u.referred_by && (u.referred_by === refCleanMob || u.referred_by === myRefCode)) return true;
                                return false;
                              });

                              if (referredUsers.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} className="p-6 text-center text-[#6C757D] font-medium bg-[#F8F9FA]">
                                      No referred users found under referral code {myRefCode}
                                    </td>
                                  </tr>
                                );
                              }

                              return referredUsers.map((u, i) => (
                                <tr key={i} className="hover:bg-[#F4F6F9]">
                                  <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-bold text-[#007BFF]">{u.name}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{u.mobile}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-600">{u.createdAt || 'Today'}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6]"><span className="px-2 py-0.5 rounded bg-[#28A745] text-white text-[10px] font-bold">Active</span></td>
                                  <td className="p-2.5 font-mono font-bold text-[#28A745]">₹ {(parseFloat(u.commission_balance) || 0).toFixed(2)}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: GAME LEDGER */}
                  {userDetailsTab === 'gameLedger' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">40-Day Stacked Game Ledger</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                          <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                            <tr>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Transact Type</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Old Bal.</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">New Bal.</th>
                              <th className="p-2.5">Game Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const matchesUser = (item: any) => {
                                if (!item || !selectedUser) return false;
                                const cleanMob = String(selectedUser.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                                const userId = String(selectedUser.id || selectedUser._id || '');

                                const itemRawPhone = String(item.mobile || item.phone || item.userPhone || '').replace(/[^0-9]/g, '');
                                const itemMob = itemRawPhone.length >= 10 ? itemRawPhone.slice(-10) : '';
                                if (cleanMob && itemMob && cleanMob === itemMob) return true;

                                const rawUserStr = String(item.user || item.username || item.userName || '');
                                const userStrMob = rawUserStr.replace(/[^0-9]/g, '');
                                if (cleanMob && userStrMob.length >= 10 && userStrMob.includes(cleanMob)) return true;

                                if (userId && (String(item.userId) === userId || String(item.user_id) === userId || String(item.id) === userId)) return true;
                                return false;
                              };

                              const curDeposit = parseFloat(selectedUser.deposit_balance || 0);
                              const curWinning = parseFloat(selectedUser.winning_balance || 0);

                              const signupTimestamp = parseToTimestamp(selectedUser.createdAt, selectedUser.id, selectedUser.createdAt) || (Date.now() - 86400000);

                              const rawEvents: any[] = [];

                              // 1. Approved Deposits
                              const userDeps = (deposits || []).filter(d => matchesUser(d) && (d.status === 'Approved' || d.status === 'approved'));
                              userDeps.forEach((d, idx) => {
                                const t = parseToTimestamp(d.created_at || d.createdAt || d.date, d._id || d.id, selectedUser.createdAt) || (signupTimestamp + 1000 + idx * 100);
                                rawEvents.push({
                                  timestamp: t,
                                  dateStr: formatDisplayDate(d.created_at || d.createdAt || d.date, d._id || d.id, selectedUser.createdAt),
                                  type: d.method || d.payment_method ? `Deposit Approved (${d.method || d.payment_method})` : 'Deposit Approved',
                                  amount: parseFloat(d.amount) || 0,
                                  amountStr: `+${(parseFloat(d.amount) || 0).toFixed(2)}`,
                                  gameType: d.method || d.payment_method || 'PhonePe / UPI',
                                  kind: 'DEPOSIT'
                                });
                              });

                              // 2. User Bids & Winnings
                              const userBids = (bidsList || []).filter(b => matchesUser(b));
                              userBids.forEach((b, idx) => {
                                const t = parseToTimestamp(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt) || (signupTimestamp + 2000 + idx * 100);
                                const bAmt = parseFloat(b.amount || b.bet_amount) || 10;
                                rawEvents.push({
                                  timestamp: t,
                                  dateStr: formatDisplayDate(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt),
                                  type: 'Bid Place',
                                  amount: bAmt,
                                  amountStr: `-${bAmt.toFixed(2)}`,
                                  gameType: `${b.category || 'Game'} - ${b.gameType || 'Jodi'} (#${b.number})`,
                                  kind: 'BET'
                                });

                                if (b.status === 'Won' || b.status === 'won' || (parseFloat(b.win_amount || b.winAmount) || 0) > 0) {
                                  const mult = getBetMultiplier(b);
                                  const winAmt = (parseFloat(b.win_amount || b.winAmount) || (bAmt * mult));
                                  rawEvents.push({
                                    timestamp: t + 50,
                                    dateStr: formatDisplayDate(b.created_at || b.createdAt || b.date, b._id || b.id, selectedUser.createdAt),
                                    type: 'Winning Credit',
                                    amount: winAmt,
                                    amountStr: `+${winAmt.toFixed(2)}`,
                                    gameType: `${b.category || 'Game'} - Won 🎉`,
                                    kind: 'WIN'
                                  });
                                }
                              });

                              // 3. Approved Withdrawals
                              const userWds = (withdrawals || []).filter(w => matchesUser(w) && (w.status === 'Approved' || w.status === 'approved'));
                              userWds.forEach((w, idx) => {
                                const t = parseToTimestamp(w.created_at || w.createdAt || w.date, w._id || w.id, selectedUser.createdAt) || (signupTimestamp + 3000 + idx * 100);
                                const wAmt = parseFloat(w.amount) || 0;
                                rawEvents.push({
                                  timestamp: t,
                                  dateStr: formatDisplayDate(w.created_at || w.createdAt || w.date, w._id || w.id, selectedUser.createdAt),
                                  type: 'Withdrawal Payout',
                                  amount: wAmt,
                                  amountStr: `-${wAmt.toFixed(2)}`,
                                  gameType: w.payment_method || 'Bank / UPI',
                                  kind: 'WITHDRAW'
                                });
                              });

                              // Sort raw events chronologically ascending
                              rawEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                              // Dry run forward to determine net change on deposit & winning
                              let simBonus = 200;
                              let simDeposit = 0;
                              let simWinning = 0;

                              rawEvents.forEach(ev => {
                                if (ev.kind === 'DEPOSIT') {
                                  simDeposit += ev.amount;
                                } else if (ev.kind === 'BET') {
                                  const bDeduct = Math.min(ev.amount * 0.10, simBonus);
                                  simBonus = Math.max(0, simBonus - bDeduct);
                                  const rem = ev.amount - bDeduct;
                                  simDeposit -= rem;
                                } else if (ev.kind === 'WIN') {
                                  simWinning += ev.amount;
                                } else if (ev.kind === 'WITHDRAW') {
                                  let rem = ev.amount;
                                  if (simWinning >= rem) {
                                    simWinning -= rem;
                                  } else {
                                    rem -= simWinning;
                                    simWinning = 0;
                                    simDeposit -= rem;
                                  }
                                }
                              });

                              const openingDeposit = parseFloat((curDeposit - simDeposit).toFixed(2));
                              const openingWinning = parseFloat((curWinning - simWinning).toFixed(2));

                              const finalEvents: any[] = [];

                              // Initial Signup Joining Bonus
                              finalEvents.push({
                                timestamp: signupTimestamp,
                                dateStr: formatDisplayDate(selectedUser.createdAt, selectedUser.id, selectedUser.createdAt),
                                type: 'Joining Bonus',
                                amount: 200,
                                amountStr: '+200.00',
                                gameType: '-',
                                kind: 'BONUS'
                              });

                              // Opening Deposit / Admin Credit (if user had initial funds outside recorded deposits)
                              if (openingDeposit > 0) {
                                finalEvents.push({
                                  timestamp: signupTimestamp + 10,
                                  dateStr: formatDisplayDate(selectedUser.createdAt, selectedUser.id, selectedUser.createdAt),
                                  type: 'Opening Funds / Admin Credit',
                                  amount: openingDeposit,
                                  amountStr: `+${openingDeposit.toFixed(2)}`,
                                  gameType: 'Wallet Credit',
                                  kind: 'DEPOSIT'
                                });
                              }

                              // Opening Winning Credit (if user had winning funds)
                              if (openingWinning > 0) {
                                finalEvents.push({
                                  timestamp: signupTimestamp + 20,
                                  dateStr: formatDisplayDate(selectedUser.createdAt, selectedUser.id, selectedUser.createdAt),
                                  type: 'Winning Balance Credit',
                                  amount: openingWinning,
                                  amountStr: `+${openingWinning.toFixed(2)}`,
                                  gameType: 'Winning Credit',
                                  kind: 'WIN'
                                });
                              }

                              // Add all recorded events
                              rawEvents.forEach(ev => finalEvents.push(ev));

                              // Sort strictly chronological ascending (oldest first)
                              finalEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                              let runDeposit = 0.00;
                              let runWinning = 0.00;
                              let runCommission = 0.00;
                              let runBonus = 0.00;
                              let runReferral = 0.00;

                              const calculatedRows: any[] = [];

                              finalEvents.forEach(ev => {
                                const oldBal = {
                                  wallet: (runDeposit + runWinning + runCommission).toFixed(2),
                                  deposit: runDeposit.toFixed(2),
                                  winning: runWinning.toFixed(2),
                                  commission: runCommission.toFixed(2),
                                  bonus: runBonus.toFixed(2),
                                  referral: runReferral.toFixed(2)
                                };

                                if (ev.kind === 'BONUS') {
                                  runBonus = parseFloat((runBonus + ev.amount).toFixed(2));
                                } else if (ev.kind === 'DEPOSIT') {
                                  runDeposit = parseFloat((runDeposit + ev.amount).toFixed(2));
                                } else if (ev.kind === 'BET') {
                                  const bonusDeduct = Math.min(ev.amount * 0.10, runBonus);
                                  runBonus = parseFloat((runBonus - bonusDeduct).toFixed(2));
                                  let rem = ev.amount - bonusDeduct;

                                  if (runDeposit >= rem) {
                                    runDeposit = parseFloat((runDeposit - rem).toFixed(2));
                                    rem = 0;
                                  } else {
                                    rem = parseFloat((rem - runDeposit).toFixed(2));
                                    runDeposit = 0.00;
                                    if (runWinning >= rem) {
                                      runWinning = parseFloat((runWinning - rem).toFixed(2));
                                      rem = 0;
                                    } else {
                                      rem = parseFloat((rem - runWinning).toFixed(2));
                                      runWinning = 0.00;
                                    }
                                  }
                                } else if (ev.kind === 'WIN') {
                                  runWinning = parseFloat((runWinning + ev.amount).toFixed(2));
                                } else if (ev.kind === 'WITHDRAW') {
                                  let rem = ev.amount;
                                  if (runWinning >= rem) {
                                    runWinning = parseFloat((runWinning - rem).toFixed(2));
                                    rem = 0;
                                  } else {
                                    rem = parseFloat((rem - runWinning).toFixed(2));
                                    runWinning = 0.00;
                                    runDeposit = parseFloat(Math.max(0, runDeposit - rem).toFixed(2));
                                  }
                                }

                                const newBal = {
                                  wallet: (runDeposit + runWinning + runCommission).toFixed(2),
                                  deposit: runDeposit.toFixed(2),
                                  winning: runWinning.toFixed(2),
                                  commission: runCommission.toFixed(2),
                                  bonus: runBonus.toFixed(2),
                                  referral: runReferral.toFixed(2)
                                };

                                calculatedRows.push({
                                  amount: ev.amountStr,
                                  date: ev.dateStr,
                                  type: ev.type,
                                  oldBal,
                                  newBal,
                                  gameType: ev.gameType
                                });
                              });

                              return calculatedRows.reverse().map((item, i) => (
                                <tr key={i} className="hover:bg-[#F4F6F9] align-top">
                                  <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                                  <td className={`p-2.5 border-r border-[#DEE2E6] font-mono font-bold ${item.amount.startsWith('+') ? 'text-[#28A745]' : 'text-[#DC3545]'}`}>{item.amount}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{item.date}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-medium">{item.type}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] space-y-0.5 text-gray-700">
                                    <div>Wallet - {item.oldBal.wallet}</div>
                                    <div>Deposit - {item.oldBal.deposit}</div>
                                    <div>Winning - {item.oldBal.winning}</div>
                                    <div>Commission - {item.oldBal.commission}</div>
                                    <div>Bonus - {item.oldBal.bonus}</div>
                                    <div>Referral - {item.oldBal.referral}</div>
                                  </td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] space-y-0.5 text-gray-700">
                                    <div>Wallet - {item.newBal.wallet}</div>
                                    <div>Deposit - {item.newBal.deposit}</div>
                                    <div>Winning - {item.newBal.winning}</div>
                                    <div>Commission - {item.newBal.commission}</div>
                                    <div>Bonus - {item.newBal.bonus}</div>
                                    <div>Referral - {item.newBal.referral}</div>
                                  </td>
                                  <td className="p-2.5 font-medium">{item.gameType}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACTION 2 PAGE: USER EDIT */}
            {activeTab === 'userEdit' && selectedUser && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">User Edit</h1>
                  <button onClick={() => setActiveTab('users')} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-4 py-1.5 rounded text-xs font-bold shadow-sm">← Back</button>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-6">
                  <form onSubmit={handleSaveUserEdit} className="space-y-5 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Full Name *</label>
                        <input type="text" value={editUserForm.name || ''} onChange={(e)=>setEditUserForm({...editUserForm, name: e.target.value})} required className="w-full border border-[#CED4DA] p-2 rounded text-xs" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Email Address</label>
                        <input type="email" value={editUserForm.email || ''} onChange={(e)=>setEditUserForm({...editUserForm, email: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs" />
                        <p className="text-[10px] text-[#6C757D] mt-0.5">Once you add your Email-id than it will never Change</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Phone</label>
                        <input type="text" value={editUserForm.mobile || ''} onChange={(e)=>setEditUserForm({...editUserForm, mobile: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Gender</label>
                        <select value={editUserForm.gender || 'Male'} onChange={(e)=>setEditUserForm({...editUserForm, gender: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs">
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Date of Birth</label>
                        <input type="text" value={editUserForm.dob || ''} onChange={(e)=>setEditUserForm({...editUserForm, dob: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Address</label>
                        <input type="text" value={editUserForm.address || ''} onChange={(e)=>setEditUserForm({...editUserForm, address: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Bank Name</label>
                        <input type="text" value={editUserForm.bankName || 'sate bank'} onChange={(e)=>setEditUserForm({...editUserForm, bankName: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Bank Account Number</label>
                        <input type="text" value={editUserForm.accountNumber || '0000000000'} onChange={(e)=>setEditUserForm({...editUserForm, accountNumber: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs font-mono" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Branch Name</label>
                        <input type="text" value={editUserForm.branchName || ''} onChange={(e)=>setEditUserForm({...editUserForm, branchName: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Ifsc Code</label>
                        <input type="text" value={editUserForm.ifscCode || '000000000'} onChange={(e)=>setEditUserForm({...editUserForm, ifscCode: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs font-mono" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">UPI</label>
                        <input type="text" value={editUserForm.upi || ''} onChange={(e)=>setEditUserForm({...editUserForm, upi: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Status</label>
                        <select value={editUserForm.status || 'Active'} onChange={(e)=>setEditUserForm({...editUserForm, status: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs">
                          <option value="Active">Active</option>
                          <option value="Deactive">Deactive</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#007BFF] mb-1">Referral System Status</label>
                        <select
                          value={editUserForm.referral_enabled === false || editUserForm.referral_status === 'OFF' ? 'OFF' : 'ON'}
                          onChange={(e) => setEditUserForm({ ...editUserForm, referral_enabled: e.target.value === 'ON' })}
                          className="w-full border border-[#007BFF] p-2 rounded text-xs font-bold text-[#007BFF] bg-white"
                        >
                          <option value="ON">ON (Allows new users to sign up under this user)</option>
                          <option value="OFF">OFF (Blocks new downline signups & disables referral code)</option>
                        </select>
                        <p className="text-[10px] text-[#6C757D] mt-0.5">Turn OFF to invalidate this user's referral code for new signups.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#28A745] mb-1">Custom Downline Refer Commission (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={editUserForm.custom_referral_commission !== undefined && editUserForm.custom_referral_commission !== null ? editUserForm.custom_referral_commission : ''}
                          onChange={(e) => setEditUserForm({ ...editUserForm, custom_referral_commission: e.target.value })}
                          placeholder={`Default (${referralCommissionPct || 4}% from Refer & Earn)`}
                          className="w-full border border-[#28A745] p-2 rounded text-xs font-bold text-[#28A745] focus:outline-none focus:ring-1 focus:ring-[#28A745]"
                        />
                        <p className="text-[10px] text-[#6C757D] mt-0.5">Leave blank to use default rate ({referralCommissionPct || 4}%). Enter e.g. 5 for 5% custom commission.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#6F42C1] mb-1">Self-Bet Commission (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={editUserForm.self_bet_commission !== undefined && editUserForm.self_bet_commission !== null ? editUserForm.self_bet_commission : ''}
                          onChange={(e) => setEditUserForm({ ...editUserForm, self_bet_commission: e.target.value })}
                          placeholder="0% (No self commission)"
                          className="w-full border border-[#6F42C1] p-2 rounded text-xs font-bold text-[#6F42C1] focus:outline-none focus:ring-1 focus:ring-[#6F42C1]"
                        />
                        <p className="text-[10px] text-[#6C757D] mt-0.5">Percentage commission credited directly to this user's wallet on their own bets.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#17A2B8] mb-1">Custom Jodi Winning Rate (x)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={editUserForm.custom_jodi_rate !== undefined && editUserForm.custom_jodi_rate !== null ? editUserForm.custom_jodi_rate : ''}
                          onChange={(e) => setEditUserForm({ ...editUserForm, custom_jodi_rate: e.target.value })}
                          placeholder="Default (95x)"
                          className="w-full border border-[#17A2B8] p-2 rounded text-xs font-bold text-[#17A2B8]"
                        />
                        <p className="text-[10px] text-[#6C757D] mt-0.5">Custom Jodi rate for this specific user. Leave blank for default (95x).</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#17A2B8] mb-1">Custom Haroof Winning Rate (x)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={editUserForm.custom_haroof_rate !== undefined && editUserForm.custom_haroof_rate !== null ? editUserForm.custom_haroof_rate : ''}
                          onChange={(e) => setEditUserForm({ ...editUserForm, custom_haroof_rate: e.target.value })}
                          placeholder="Default (9.5x)"
                          className="w-full border border-[#17A2B8] p-2 rounded text-xs font-bold text-[#17A2B8]"
                        />
                        <p className="text-[10px] text-[#6C757D] mt-0.5">Custom Haroof rate for this specific user. Leave blank for default (9.5x).</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#17A2B8] mb-1">Custom Crossing Winning Rate (x)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={editUserForm.custom_crossing_rate !== undefined && editUserForm.custom_crossing_rate !== null ? editUserForm.custom_crossing_rate : ''}
                          onChange={(e) => setEditUserForm({ ...editUserForm, custom_crossing_rate: e.target.value })}
                          placeholder="Default (95x)"
                          className="w-full border border-[#17A2B8] p-2 rounded text-xs font-bold text-[#17A2B8]"
                        />
                        <p className="text-[10px] text-[#6C757D] mt-0.5">Custom Crossing rate for this specific user. Leave blank for default (95x).</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">Multiple Account Withdraw Enabled</label>
                        <select value={editUserForm.multipleWithdraw || 'No'} onChange={(e)=>setEditUserForm({...editUserForm, multipleWithdraw: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded text-xs">
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#212529] mb-1">LAST LOGIN OTP DATETIME: {editUserForm.lastLoginOtp || '2025-05-20 19:20:04'}</label>
                        <label className="block text-xs font-bold text-[#212529] mt-2 mb-1">API CALL</label>
                        <input type="text" value={editUserForm.apiCall || 'laravelNEW'} readOnly className="w-full border border-[#CED4DA] p-2 rounded text-xs bg-gray-50 text-[#6C757D]" />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-[#DEE2E6]">
                      <button type="submit" className="bg-[#28A745] hover:bg-[#218838] text-white px-5 py-2 rounded font-bold text-xs shadow-sm">Update</button>
                      <button type="button" onClick={()=>setActiveTab('users')} className="bg-[#DC3545] hover:bg-[#C82333] text-white px-5 py-2 rounded font-bold text-xs shadow-sm">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 4. GAME LEDGER MODULE (MATCHING MEDIA_1787984986125.PNG & MEDIA_1787984992702.JPG 100%) */}
            {activeTab === 'gameLedger' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Game Ledger</h1>
                </div>

                {/* FILTER CARD MATCHING SCREENSHOTS 1 & 2 */}
                <form onSubmit={handleExecuteSearch} className="bg-white p-4 rounded border border-[#DEE2E6] shadow-sm space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Name / Email / Phone</label>
                    <input
                      type="text"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Name / Email / Phone"
                      className="w-full border border-[#CED4DA] p-2 rounded text-xs text-[#495057] focus:outline-none focus:border-[#80BDFF]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Transaction Type</label>
                    <select
                      value={filterTxnType}
                      onChange={(e) => setFilterTxnType(e.target.value)}
                      className="w-full border border-[#CED4DA] p-2 rounded text-xs text-[#495057]"
                    >
                      <option value="All">All</option>
                      <option value="Deposit Manually">Deposit Manually</option>
                      <option value="Deposit UPI">Deposit UPI</option>
                      <option value="Bid Place">Bid Place</option>
                      <option value="Commission">Commission</option>
                      <option value="Joining Bonus">Joining Bonus</option>
                      <option value="Referel Bonus">Referel Bonus</option>
                      <option value="Withdrawl Add">Withdrawl Add</option>
                      <option value="Withdrawl Decline">Withdrawl Decline</option>
                      <option value="Withdrawl Refund">Withdrawl Refund</option>
                      <option value="Winning Amount">Winning Amount</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[#212529] mb-1">Start Date</label>
                      <div className="relative flex items-center w-full">
                        <input 
                          type="date" 
                          value={filterStartDate} 
                          onChange={(e)=>setFilterStartDate(e.target.value)} 
                          onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs text-[#495057] pr-8"
                        />
                        <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-[#212529] mb-1">End Date</label>
                      <div className="relative flex items-center w-full">
                        <input 
                          type="date" 
                          value={filterEndDate} 
                          onChange={(e)=>setFilterEndDate(e.target.value)} 
                          onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs text-[#495057] pr-8"
                        />
                        <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" onClick={handleExecuteSearch} className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-1.5 rounded font-bold shadow-sm">Search</button>
                    <button type="button" onClick={handleClearFilters} className="bg-white border border-[#CED4DA] text-[#212529] px-4 py-1.5 rounded font-bold shadow-sm hover:bg-gray-100">Clear</button>
                  </div>
                </form>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
<thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                        <tr>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No.</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">User</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Transact Type</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Old Bal.</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">New Bal.</th>
                          <th className="p-2.5">Game Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let ledgerItems: any[] = [];

                          if (gameLedgerList && gameLedgerList.length > 0) {
                            ledgerItems = [...gameLedgerList];
                          } else {
                            // Map of user info and mobile keys
                            const allUserMobiles = new Set<string>();
                          (users || []).forEach(u => {
                            const cleanMob = String(u.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                            if (cleanMob) allUserMobiles.add(cleanMob);
                          });
                          (bidsList || []).forEach(b => {
                            const rawMob = String(b.phone || b.mobile || b.user || '').replace(/[^0-9]/g, '');
                            const mob = rawMob.length >= 10 ? rawMob.slice(-10) : '';
                            if (mob) allUserMobiles.add(mob);
                          });
                          (deposits || []).forEach(d => {
                            const rawMob = String(d.mobile || d.phone || d.user || '').replace(/[^0-9]/g, '');
                            const mob = rawMob.length >= 10 ? rawMob.slice(-10) : '';
                            if (mob) allUserMobiles.add(mob);
                          });
                          (withdrawals || []).forEach(w => {
                            const rawMob = String(w.mobile || w.phone || w.user || '').replace(/[^0-9]/g, '');
                            const mob = rawMob.length >= 10 ? rawMob.slice(-10) : '';
                            if (mob) allUserMobiles.add(mob);
                          });

                          allUserMobiles.forEach(mob => {
                            const userObj = users.find(u => String(u.mobile || '').replace(/[^0-9]/g, '').slice(-10) === mob);
                            const name = userObj ? userObj.name : 'User';
                            const email = userObj ? userObj.email : `${mob}@gmail.com`;

                            const matchesMob = (item: any) => {
                              if (!item) return false;
                              const rawItemMob = String(item.mobile || item.phone || item.userPhone || '').replace(/[^0-9]/g, '');
                              const itemMob = rawItemMob.length >= 10 ? rawItemMob.slice(-10) : '';
                              if (itemMob && itemMob === mob) return true;
                              const rawUserStr = String(item.user || item.username || item.userName || '');
                              const userStrMob = rawUserStr.replace(/[^0-9]/g, '');
                              if (userStrMob.length >= 10 && userStrMob.includes(mob)) return true;
                              if (userObj && userObj.id && (String(item.userId) === String(userObj.id) || String(item.user_id) === String(userObj.id) || String(item.id) === String(userObj.id))) return true;
                              return false;
                            };

                            const curDeposit = parseFloat(userObj?.deposit_balance || 0);
                            const curWinning = parseFloat(userObj?.winning_balance || 0);

                            const signupTimestamp = parseToTimestamp(userObj?.createdAt, userObj?.id, userObj?.createdAt) || (Date.now() - 86400000);

                            const rawEvents: any[] = [];

                            // Approved Deposits
                            const userDeps = (deposits || []).filter(d => matchesMob(d) && (d.status === 'Approved' || d.status === 'approved'));
                            userDeps.forEach((d, idx) => {
                              const t = parseToTimestamp(d.created_at || d.createdAt || d.date, d._id || d.id, userObj?.createdAt) || (signupTimestamp + 1000 + idx * 100);
                              rawEvents.push({
                                id: String(d._id || d.id || `dep_${mob}_${idx}`),
                                timestamp: t,
                                dateStr: formatDisplayDate(d.created_at || d.createdAt || d.date, d._id || d.id, userObj?.createdAt),
                                type: d.method || d.payment_method ? `Deposit Approved (${d.method || d.payment_method})` : 'Deposit Approved',
                                amount: parseFloat(d.amount) || 0,
                                amountStr: `+${(parseFloat(d.amount) || 0).toFixed(2)}`,
                                gameType: d.method || d.payment_method || 'PhonePe / UPI',
                                kind: 'DEPOSIT'
                              });
                            });

                            // Bids & Winnings
                            const userBids = (bidsList || []).filter(b => matchesMob(b));
                            userBids.forEach((b, idx) => {
                              const t = parseToTimestamp(b.created_at || b.createdAt || b.date, b._id || b.id, userObj?.createdAt) || (signupTimestamp + 2000 + idx * 100);
                              const bAmt = parseFloat(b.amount || b.bet_amount) || 10;
                              rawEvents.push({
                                id: String(b._id || b.id || `bet_${mob}_${idx}`),
                                timestamp: t,
                                dateStr: formatDisplayDate(b.created_at || b.createdAt || b.date, b._id || b.id, userObj?.createdAt),
                                type: 'Bid Place',
                                amount: bAmt,
                                amountStr: `-${bAmt.toFixed(2)}`,
                                gameType: `${b.category || 'Game'} - ${b.gameType || 'Jodi'} (#${b.number})`,
                                kind: 'BET'
                              });

                              if (b.status === 'Won' || b.status === 'won' || (parseFloat(b.win_amount || b.winAmount) || 0) > 0) {
                                const mult = getBetMultiplier(b);
                                const winAmt = (parseFloat(b.win_amount || b.winAmount) || (bAmt * mult));
                                rawEvents.push({
                                  id: String(b._id || b.id || `win_${mob}_${idx}`) + '_win',
                                  timestamp: t + 50,
                                  dateStr: formatDisplayDate(b.created_at || b.createdAt || b.date, b._id || b.id, userObj?.createdAt),
                                  type: 'Winning Credit',
                                  amount: winAmt,
                                  amountStr: `+${winAmt.toFixed(2)}`,
                                  gameType: `${b.category || 'Game'} - Won 🎉`,
                                  kind: 'WIN'
                                });
                              }
                            });

                            // Approved Withdrawals
                            const userWds = (withdrawals || []).filter(w => matchesMob(w) && (w.status === 'Approved' || w.status === 'approved'));
                            userWds.forEach((w, idx) => {
                              const t = parseToTimestamp(w.created_at || w.createdAt || w.date, w._id || w.id, userObj?.createdAt) || (signupTimestamp + 3000 + idx * 100);
                              const wAmt = parseFloat(w.amount) || 0;
                              rawEvents.push({
                                id: String(w._id || w.id || `wd_${mob}_${idx}`),
                                timestamp: t,
                                dateStr: formatDisplayDate(w.created_at || w.createdAt || w.date, w._id || w.id, userObj?.createdAt),
                                type: 'Withdrawal Payout',
                                amount: wAmt,
                                amountStr: `-${wAmt.toFixed(2)}`,
                                gameType: w.payment_method || 'Bank / UPI',
                                kind: 'WITHDRAW'
                              });
                            });

                            // Sort raw events chronologically ascending
                            rawEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                            // Dry run forward to find net changes
                            let simBonus = 200;
                            let simDeposit = 0;
                            let simWinning = 0;

                            rawEvents.forEach(ev => {
                              if (ev.kind === 'DEPOSIT') {
                                simDeposit += ev.amount;
                              } else if (ev.kind === 'BET') {
                                const bDeduct = Math.min(ev.amount * 0.10, simBonus);
                                simBonus = Math.max(0, simBonus - bDeduct);
                                const rem = ev.amount - bDeduct;
                                simDeposit -= rem;
                              } else if (ev.kind === 'WIN') {
                                simWinning += ev.amount;
                              } else if (ev.kind === 'WITHDRAW') {
                                let rem = ev.amount;
                                if (simWinning >= rem) {
                                  simWinning -= rem;
                                } else {
                                  rem -= simWinning;
                                  simWinning = 0;
                                  simDeposit -= rem;
                                }
                              }
                            });

                            const openingDeposit = parseFloat((curDeposit - simDeposit).toFixed(2));
                            const openingWinning = parseFloat((curWinning - simWinning).toFixed(2));

                            const finalEvents: any[] = [];

                            // 1. Initial Joining Bonus
                            finalEvents.push({
                              id: `bonus_${mob}`,
                              timestamp: signupTimestamp,
                              dateStr: formatDisplayDate(userObj?.createdAt, userObj?.id, userObj?.createdAt),
                              type: 'Joining Bonus',
                              amount: 200,
                              amountStr: '+200.00',
                              gameType: '-',
                              kind: 'BONUS'
                            });

                            // 2. Opening Deposit / Admin Credit
                            if (openingDeposit > 0) {
                              finalEvents.push({
                                id: `open_dep_${mob}`,
                                timestamp: signupTimestamp + 10,
                                dateStr: formatDisplayDate(userObj?.createdAt, userObj?.id, userObj?.createdAt),
                                type: 'Opening Funds / Admin Credit',
                                amount: openingDeposit,
                                amountStr: `+${openingDeposit.toFixed(2)}`,
                                gameType: 'Wallet Credit',
                                kind: 'DEPOSIT'
                              });
                            }

                            // 3. Opening Winning Credit
                            if (openingWinning > 0) {
                              finalEvents.push({
                                id: `open_win_${mob}`,
                                timestamp: signupTimestamp + 20,
                                dateStr: formatDisplayDate(userObj?.createdAt, userObj?.id, userObj?.createdAt),
                                type: 'Winning Balance Credit',
                                amount: openingWinning,
                                amountStr: `+${openingWinning.toFixed(2)}`,
                                gameType: 'Winning Credit',
                                kind: 'WIN'
                              });
                            }

                            rawEvents.forEach(ev => finalEvents.push(ev));
                            finalEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                            let runDeposit = 0.00;
                            let runWinning = 0.00;
                            let runCommission = 0.00;
                            let runBonus = 0.00;
                            let runReferral = 0.00;

                            finalEvents.forEach(ev => {
                              const oldBal = {
                                wallet: (runDeposit + runWinning + runCommission).toFixed(2),
                                deposit: runDeposit.toFixed(2),
                                winning: runWinning.toFixed(2),
                                commission: runCommission.toFixed(2),
                                bonus: runBonus.toFixed(2),
                                referral: runReferral.toFixed(2)
                              };

                              if (ev.kind === 'BONUS') {
                                runBonus = parseFloat((runBonus + ev.amount).toFixed(2));
                              } else if (ev.kind === 'DEPOSIT') {
                                runDeposit = parseFloat((runDeposit + ev.amount).toFixed(2));
                              } else if (ev.kind === 'BET') {
                                const bonusDeduct = Math.min(ev.amount * 0.10, runBonus);
                                runBonus = parseFloat((runBonus - bonusDeduct).toFixed(2));
                                let rem = ev.amount - bonusDeduct;

                                if (runDeposit >= rem) {
                                  runDeposit = parseFloat((runDeposit - rem).toFixed(2));
                                  rem = 0;
                                } else {
                                  rem = parseFloat((rem - runDeposit).toFixed(2));
                                  runDeposit = 0.00;
                                  if (runWinning >= rem) {
                                    runWinning = parseFloat((runWinning - rem).toFixed(2));
                                    rem = 0;
                                  } else {
                                    rem = parseFloat((rem - runWinning).toFixed(2));
                                    runWinning = 0.00;
                                  }
                                }
                              } else if (ev.kind === 'WIN') {
                                runWinning = parseFloat((runWinning + ev.amount).toFixed(2));
                              } else if (ev.kind === 'WITHDRAW') {
                                let rem = ev.amount;
                                if (runWinning >= rem) {
                                  runWinning = parseFloat((runWinning - rem).toFixed(2));
                                  rem = 0;
                                } else {
                                  rem = parseFloat((rem - runWinning).toFixed(2));
                                  runWinning = 0.00;
                                  runDeposit = parseFloat(Math.max(0, runDeposit - rem).toFixed(2));
                                }
                              }

                              const newBal = {
                                wallet: (runDeposit + runWinning + runCommission).toFixed(2),
                                deposit: runDeposit.toFixed(2),
                                winning: runWinning.toFixed(2),
                                commission: runCommission.toFixed(2),
                                bonus: runBonus.toFixed(2),
                                referral: runReferral.toFixed(2)
                              };

                              ledgerItems.push({
                                id: String(ev.id),
                                user: name,
                                email: email,
                                phone: mob,
                                amount: ev.amountStr,
                                date: ev.dateStr,
                                timestamp: ev.timestamp,
                                transactType: ev.type,
                                oldBal,
                                newBal,
                                gameType: ev.gameType
                              });
                            });
                          });
                        }

                          // Sort ledger items overall by timestamp descending (newest first). If same timestamp, use unique ID descending.
                          ledgerItems.sort((a, b) => {
                            const dateDiff = (b.timestamp || 0) - (a.timestamp || 0);
                            if (dateDiff !== 0) return dateDiff;
                            return b.id.localeCompare(a.id);
                          });

                          const filteredLedger = ledgerItems.filter(item => {
                            const targetTxn = appliedGameType !== 'All' ? appliedGameType : filterTxnType;
                            if (targetTxn !== 'All' && item.transactType !== targetTxn) return false;

                            const q = (appliedSearch || filterSearch).toLowerCase().trim();
                            if (q) {
                              const matches = (item.user && item.user.toLowerCase().includes(q)) ||
                                              (item.email && item.email.toLowerCase().includes(q)) ||
                                              (item.phone && item.phone.includes(q)) ||
                                              (item.transactType && item.transactType.toLowerCase().includes(q));
                              if (!matches) return false;
                            }

                            const sDate = appliedStartDate || filterStartDate;
                            const eDate = appliedEndDate || filterEndDate;
                            if (!isDateInRange(item.date, sDate, eDate)) return false;

                            return true;
                          });

                          if (filteredLedger.length === 0) {
                            return (
                              <tr>
                                <td colSpan={8} className="p-6 text-center text-[#6C757D] font-medium bg-[#F8F9FA]">
                                  No data available in table
                                </td>
                              </tr>
                            );
                          }

                          return filteredLedger.map((item, i) => (
                            <tr key={i} className="hover:bg-[#F4F6F9] align-top">
                              <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6]">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-[#007BFF]">{item.user}</div>
                                  <div className="text-gray-500 text-[11px] font-mono">{item.email}</div>
                                  <div className="text-[#007BFF] font-bold font-mono">{item.phone}</div>
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#28A745]">{item.amount}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{item.date}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-medium">{item.transactType}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] space-y-0.5 text-gray-700">
                                <div>Wallet - {item.oldBal?.wallet || '0.00'}</div>
                                <div>Deposit - {item.oldBal?.deposit || '0.00'}</div>
                                <div>Winning - {item.oldBal?.winning || '0.00'}</div>
                                <div>Commission - {item.oldBal?.commission || '0.00'}</div>
                                <div>Bonus - {item.oldBal?.bonus || '0.00'}</div>
                                <div>Referral - {item.oldBal?.referral || '0.00'}</div>
                              </td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] space-y-0.5 text-gray-700">
                                <div>Wallet - {item.newBal?.wallet || '0.00'}</div>
                                <div>Deposit - {item.newBal?.deposit || '0.00'}</div>
                                <div>Winning - {item.newBal?.winning || '0.00'}</div>
                                <div>Commission - {item.newBal?.commission || '0.00'}</div>
                                <div>Bonus - {item.newBal?.bonus || '0.00'}</div>
                                <div>Referral - {item.newBal?.referral || '0.00'}</div>
                              </td>
                              <td className="p-2.5 font-medium">{item.gameType || '-'}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* BOTTOM PAGINATION BAR MATCHING SCREENSHOTS 1 & 2 */}
                  <div className="flex flex-wrap justify-between items-center pt-2 text-xs text-[#6C757D] gap-2">
                    <div>Showing 1 to 5 of 5 entries</div>
                    <div className="flex gap-1 font-bold">
                      <button className="px-2.5 py-1 rounded border border-[#CED4DA] bg-white text-gray-600 hover:bg-gray-100">Previous</button>
                      <button className="px-3 py-1 rounded bg-[#007BFF] text-white">1</button>
                      <button className="px-2.5 py-1 rounded border border-[#CED4DA] bg-white text-gray-600 hover:bg-gray-100">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. WALLET MODULE (MATCHING MEDIA_1787996341869.PNG 100%) */}
            {activeTab === 'wallets' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Wallet Management</h1>
                </div>

                {/* FILTER CARD MATCHING SCREENSHOT */}
                <form onSubmit={handleExecuteSearch} className="bg-white p-4 rounded border border-[#DEE2E6] shadow-sm space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#212529] mb-1">Name / Email / Phone</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder=""
                        className="max-w-md w-full border border-[#CED4DA] p-2 rounded text-xs text-[#495057] focus:outline-none focus:border-[#80BDFF]"
                      />
                      <button type="submit" onClick={handleExecuteSearch} className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-1.5 rounded font-bold shadow-sm">Search</button>
                      <button type="button" onClick={handleClearFilters} className="bg-white border border-[#CED4DA] text-[#212529] px-4 py-1.5 rounded font-bold shadow-sm hover:bg-gray-100">Clear</button>
                    </div>
                  </div>
                </form>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <div className="flex justify-between items-center text-xs text-[#6C757D]">
                    <div className="flex items-center gap-1.5">
                      <span>Show</span>
                      <select value={entriesPerPage} onChange={(e)=>setEntriesPerPage(e.target.value)} className="border border-[#CED4DA] px-2 py-1 rounded text-xs">
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                      <span>entries</span>
                    </div>
                  </div>

                  {/* WALLET TABLE MATCHING SCREENSHOT 100% */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                      <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                        <tr>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Name ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Mobile Number ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Total Balance</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Wallet Balance ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Deposite Balance ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Winning Balance ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Bouns Balance ⇅</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Referral Balance ⇅</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.filter(u => {
                          const q = (appliedSearch || filterSearch).toLowerCase().trim();
                          if (q) {
                            const matches = (u.name && u.name.toLowerCase().includes(q)) ||
                                            (u.email && u.email.toLowerCase().includes(q)) ||
                                            (u.mobile && u.mobile.toString().includes(q));
                            if (!matches) return false;
                          }
                          return true;
                        }).map((u, i) => {
                          const depositBal = u.deposit_balance !== undefined ? u.deposit_balance : (u.balance || 0);
                          const winningBal = u.winning_balance !== undefined ? u.winning_balance : 0;
                          const bonusBal = u.bonus_balance !== undefined ? u.bonus_balance : 200;
                          const commissionBal = u.commission_balance !== undefined ? u.commission_balance : 0;
                          const totalMainBal = depositBal + winningBal + commissionBal;

                          return (
                            <tr key={i} className="hover:bg-[#F4F6F9] align-middle">
                              <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{u.name || 'User'}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] text-[#007BFF] font-bold font-mono cursor-pointer hover:underline">{u.mobile}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-900 font-bold">{totalMainBal}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-900">{totalMainBal}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-900">{depositBal}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-900">{winningBal}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-900">{bonusBal}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-900">{commissionBal}</td>
                              <td className="p-2.5 text-center">
                                <div className="flex justify-center items-center gap-1.5">
                                  <button
                                    onClick={() => { setWalletTargetUser(u); setShowWalletModal(true); }}
                                    className="bg-[#28A745] hover:bg-[#218838] text-white w-6 h-6 rounded flex items-center justify-center font-bold text-sm shadow-sm"
                                    title="Credit / Debit Wallet"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* BOTTOM PAGINATION BAR MATCHING SCREENSHOT */}
                  <div className="flex flex-wrap justify-between items-center pt-2 text-xs text-[#6C757D] gap-2">
                    <div>Showing 1 to {users.length} of {users.length} entries</div>
                    <div className="flex gap-1 font-bold">
                      <button className="px-2.5 py-1 rounded border border-[#CED4DA] bg-white text-gray-600 hover:bg-gray-100">Previous</button>
                      <button className="px-3 py-1 rounded bg-[#007BFF] text-white">1</button>
                      <button className="px-2.5 py-1 rounded border border-[#CED4DA] bg-white text-gray-600 hover:bg-gray-100">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. WALLET TRANSACTIONS MODULE (COMBINED DEPOSITS & WITHDRAWALS WITH LIVE SEARCH & DETAILS MODAL) */}
            {activeTab === 'walletTransactions' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Wallet Transactions</h1>
                </div>

                {/* SEARCH FILTER BAR */}
                <div className="bg-white p-3 rounded border border-[#DEE2E6] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                  <div className="flex gap-2 w-full md:w-auto flex-1">
                    <input
                      type="text"
                      placeholder="Search Name / Email / Mobile / Transaction ID / UTR..."
                      value={walletTxnSearchQuery}
                      onChange={(e) => setWalletTxnSearchQuery(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-1.5 text-xs w-full max-w-md focus:outline-none focus:border-indigo-500 shadow-inner"
                    />
                    <button
                      onClick={() => {}}
                      className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-1.5 rounded text-xs font-bold shadow-sm"
                    >
                      Search
                    </button>
                    {walletTxnSearchQuery && (
                      <button
                        onClick={() => setWalletTxnSearchQuery('')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4 overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Email</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Mobile Number</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Transaction Id</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Transaction Type</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const allWalletTransactions = [
                          ...deposits.map(d => {
                            const rawMob = (d.mobile || d.phone || d.user || '').replace(/[^0-9]/g, '');
                            const mob = rawMob.length >= 10 ? rawMob.slice(-10) : 'N/A';
                            return {
                              id: d._id || d.id || d.utr,
                              user: d.user || d.name || 'User',
                              email: `${mob}@gmail.com`,
                              mobile: mob,
                              amount: d.amount,
                              amountPrefix: '+',
                              amountColor: 'text-[#28A745]',
                              txnId: d.utr || d.utr_number || d.id || d._id,
                              txnType: 'DEPOSIT (' + (d.method || 'UPI') + ')',
                              status: d.status || 'Approved',
                              date: d.createdAt || d.date || 'Today',
                              rawDate: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
                              originalItem: d,
                              itemType: 'deposit'
                            };
                          }),
                          ...withdrawals.map(w => {
                            const rawMob = (w.mobile || w.phone || w.user || '').replace(/[^0-9]/g, '');
                            const mob = rawMob.length >= 10 ? rawMob.slice(-10) : 'N/A';
                            return {
                              id: w._id || w.id,
                              user: w.user || w.name || 'User',
                              email: `${mob}@gmail.com`,
                              mobile: mob,
                              amount: w.amount,
                              amountPrefix: '-',
                              amountColor: 'text-[#DC3545]',
                              txnId: w.id || w._id,
                              txnType: 'WITHDRAWAL (' + (w.payment_method || 'Bank Transfer') + ')',
                              status: w.status || 'Pending',
                              date: w.created_at ? new Date(w.created_at).toLocaleString() : 'Today',
                              rawDate: w.created_at ? new Date(w.created_at).getTime() : Date.now(),
                              originalItem: w,
                              itemType: 'withdrawal'
                            };
                          })
                        ].sort((a, b) => b.rawDate - a.rawDate);

                        const q = walletTxnSearchQuery.toLowerCase().trim();
                        const filtered = allWalletTransactions.filter(t => 
                          !q ||
                          t.user.toLowerCase().includes(q) ||
                          t.email.toLowerCase().includes(q) ||
                          t.mobile.toLowerCase().includes(q) ||
                          String(t.txnId).toLowerCase().includes(q) ||
                          String(t.txnType).toLowerCase().includes(q) ||
                          String(t.status).toLowerCase().includes(q)
                        );

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-gray-500 font-medium italic">
                                No wallet transactions found matching "{walletTxnSearchQuery}".
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((t, i) => (
                          <tr key={i} className="hover:bg-[#F4F6F9]">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{t.user}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-gray-600">{t.email}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-gray-800">{t.mobile}</td>
                            <td className={`p-2.5 border-r border-[#DEE2E6] font-mono font-bold ${t.amountColor}`}>
                              ₹ {t.amountPrefix}{t.amount}
                            </td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px]">{t.txnId}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-bold text-indigo-600">{t.txnType}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6]">
                              <span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${
                                (t.status === 'Approved' || t.status === 'approved' || t.status === 'success') ? 'bg-[#28A745]' :
                                (t.status === 'Rejected' || t.status === 'rejected') ? 'bg-[#DC3545]' : 'bg-[#FFC107] text-gray-900'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-[11px] text-gray-600">{t.date}</td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => setSelectedTxnForModal(t)}
                                className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-sm"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* TRANSACTION DETAILS MODAL POPUP */}
                {selectedTxnForModal && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200">
                      {/* MODAL HEADER */}
                      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-600 font-bold text-base">ℹ️</span>
                          <h3 className="font-bold text-gray-900 text-base">
                            Transaction Details - ₹{selectedTxnForModal.amount}
                          </h3>
                        </div>
                        <button
                          onClick={() => setSelectedTxnForModal(null)}
                          className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
                        >
                          ✕
                        </button>
                      </div>

                      {/* MODAL CONTENT */}
                      <div className="p-6 text-xs space-y-4 max-h-[70vh] overflow-y-auto">
                        <h4 className="font-bold text-gray-800 text-sm border-b pb-2">
                          {selectedTxnForModal.itemType === 'deposit' ? '💳 Deposit Transaction Summary' : '🏦 Withdrawal Transaction Summary'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-gray-500 font-medium mb-1">Transaction ID / UTR</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800">
                              {selectedTxnForModal.txnId}
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-500 font-medium mb-1">Transaction Type</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-indigo-600">
                              {selectedTxnForModal.txnType}
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-500 font-medium mb-1">User Name</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                              {selectedTxnForModal.user}
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-500 font-medium mb-1">Mobile Number</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800">
                              +91 {selectedTxnForModal.mobile}
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-500 font-medium mb-1">Email</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-gray-700">
                              {selectedTxnForModal.email}
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-500 font-medium mb-1">Amount</label>
                            <div className={`bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-sm ${selectedTxnForModal.amountColor}`}>
                              ₹ {selectedTxnForModal.amountPrefix}{selectedTxnForModal.amount}
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-500 font-medium mb-1">Status</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${
                                (selectedTxnForModal.status === 'Approved' || selectedTxnForModal.status === 'approved' || selectedTxnForModal.status === 'success') ? 'bg-[#28A745]' :
                                (selectedTxnForModal.status === 'Rejected' || selectedTxnForModal.status === 'rejected') ? 'bg-[#DC3545]' : 'bg-[#FFC107] text-gray-900'
                              }`}>
                                {selectedTxnForModal.status}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-500 font-medium mb-1">Date & Time</label>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                              {selectedTxnForModal.date}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* MODAL FOOTER */}
                      <div className="flex justify-end px-6 py-3 border-t border-gray-100 bg-gray-50">
                        <button
                          onClick={() => setSelectedTxnForModal(null)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-lg text-xs transition-colors shadow-sm"
                        >
                          CLOSE
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. DEPOSIT REQUEST MODULE */}
            {activeTab === 'deposits' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Deposit Request</h1>
                </div>

                {/* SEARCH FILTER BAR */}
                <div className="bg-white p-3 rounded border border-[#DEE2E6] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                  <div className="flex gap-2 w-full md:w-auto flex-1">
                    <input
                      type="text"
                      placeholder="Search Name / Email / Mobile / UTR / Status..."
                      value={depositSearchQuery}
                      onChange={(e) => setDepositSearchQuery(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-1.5 text-xs w-full max-w-md focus:outline-none focus:border-indigo-500 shadow-inner"
                    />
                    <button
                      onClick={() => {}}
                      className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-1.5 rounded text-xs font-bold shadow-sm"
                    >
                      Search
                    </button>
                    {depositSearchQuery && (
                      <button
                        onClick={() => setDepositSearchQuery('')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded text-xs font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4 overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">UTN/RRN NO</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Date & Time</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Email</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Mobile Number</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const q = depositSearchQuery.toLowerCase().trim();
                        
                        // Deduplicate deposits on frontend (prefer Approved > Pending > Rejected)
                        const dedupMap = new Map();
                        deposits.forEach((d) => {
                          const rawMob = (d.mobile || d.phone || d.user || d.username || '').replace(/[^0-9]/g, '');
                          const mob = rawMob.length >= 10 ? rawMob.slice(-10) : '';
                          const amt = parseFloat(d.amount) || 0;
                          const utrStr = String(d.utr || d.utr_number || d.client_txn_id || '').trim();
                          const isNa = !utrStr || utrStr === 'N/A';
                          
                          // Key based on utr or (mobile + amount + date)
                          const key = (!isNa) ? utrStr : `${mob}_${amt}_${d.createdAt || d.date || ''}`;
                          const existing = dedupMap.get(key);
                          const st = (d.status || '').toLowerCase();

                          if (!existing) {
                            dedupMap.set(key, d);
                          } else {
                            const exSt = (existing.status || '').toLowerCase();
                            if (st === 'approved' && exSt !== 'approved') {
                              dedupMap.set(key, d);
                            } else if (exSt === 'rejected' && st === 'pending') {
                              dedupMap.set(key, d);
                            }
                          }
                        });

                        const filtered = Array.from(dedupMap.values()).filter(d => {
                          const rawMob = (d.mobile || d.phone || d.user || d.username || '').replace(/[^0-9]/g, '');
                          const mob = rawMob.length >= 10 ? rawMob.slice(-10) : '';
                          const userStr = (d.user || d.username || '').toLowerCase();
                          const utrStr = String(d.utr || d.utr_number || d._id || d.id || '').toLowerCase();
                          const statusStr = String(d.status || '').toLowerCase();

                          return !q ||
                            userStr.includes(q) ||
                            mob.includes(q) ||
                            utrStr.includes(q) ||
                            statusStr.includes(q);
                        });

                        filtered.sort((a, b) => parseToTimestamp(b.createdAt || b.created_at || b.date || b.timestamp, b._id || b.id || b.utr) - parseToTimestamp(a.createdAt || a.created_at || a.date || a.timestamp, a._id || a.id || a.utr));

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-gray-500 font-medium italic">
                                No deposit requests found matching "{depositSearchQuery}".
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((d, i) => {
                          const rawMob = (d.mobile || d.phone || d.user || d.username || '').replace(/[^0-9]/g, '');
                          const mob = rawMob.length >= 10 ? rawMob.slice(-10) : 'N/A';
                          const depId = d._id || d.id || d.utr;
                          const isPending = d.status === 'Pending' || d.status === 'pending';
                          const rawName = (d.user || d.username || 'User').replace(/^null\s*/i, '');
                          const cleanName = rawName.trim().length > 0 && !rawName.startsWith('(') ? rawName : (mob !== 'N/A' ? `User (${mob})` : 'User');
                          const utrDisplay = (d.utr && d.utr !== 'N/A') ? d.utr : (d.utr_number && d.utr_number !== 'N/A' ? d.utr_number : (d.client_txn_id || d.id || 'N/A'));

                          return (
                            <tr key={i} className="hover:bg-[#F4F6F9]">
                              <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#007BFF]">{utrDisplay}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] text-gray-700 whitespace-nowrap">
                                {formatDisplayDate(d.createdAt || d.created_at || d.date || d.timestamp, d._id || d.id || d.utr)}
                              </td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{cleanName}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] text-gray-600">{mob !== 'N/A' ? `${mob}@gmail.com` : 'user@newmatkadomain.com'}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-gray-800">{mob}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[#28A745] font-bold">₹ {d.amount}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6]">
                                <span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${
                                  (d.status === 'Approved' || d.status === 'approved') ? 'bg-[#28A745]' :
                                  (d.status === 'Rejected' || d.status === 'rejected') ? 'bg-[#DC3545]' : 'bg-[#FFC107] text-gray-900'
                                }`}>
                                  {d.status || 'Pending'}
                                </span>
                              </td>
                              <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => setSelectedTxnForModal({
                                    txnId: d.utr || d.utr_number || d.id || d._id,
                                    txnType: 'DEPOSIT (' + (d.method || 'UPI') + ')',
                                    user: d.user || d.username || 'User',
                                    mobile: mob,
                                    email: mob !== 'N/A' ? `${mob}@gmail.com` : 'user@newmatkadomain.com',
                                    amount: d.amount,
                                    amountPrefix: '+',
                                    amountColor: 'text-[#28A745]',
                                    status: d.status || 'Pending',
                                    date: d.createdAt || d.date || 'Today',
                                    itemType: 'deposit'
                                  })}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs text-gray-700 shadow-sm"
                                  title="View Details"
                                >
                                  👁️
                                </button>
                                {isPending ? (
                                  <>
                                    <button onClick={() => handleApproveDeposit(depId)} className="bg-[#28A745] hover:bg-[#218838] text-white px-2.5 py-1 rounded text-[11px] font-bold shadow-sm">Approve</button>
                                    <button onClick={() => handleRejectDeposit(depId)} className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2.5 py-1 rounded text-[11px] font-bold shadow-sm">Reject</button>
                                  </>
                                ) : (
                                  <span className="text-gray-400 text-[10px] italic">Completed</span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 8. WITHDRAW REQUEST MODULE */}
            {activeTab === 'withdraws' && ((() => {
              const pendingList = withdrawals.filter(w => (w.status || 'pending').toLowerCase() === 'pending');
              const approvedList = withdrawals.filter(w => (w.status || '').toLowerCase() === 'approved');
              const rejectedList = withdrawals.filter(w => (w.status || '').toLowerCase() === 'rejected');

              const pendingAmtTotal = pendingList.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
              const approvedAmtTotal = approvedList.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
              const rejectedAmtTotal = rejectedList.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
              const totalAmtAll = withdrawals.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);

              const filteredWithdrawals = withdrawals.filter(w => {
                const st = (w.status || 'pending').toLowerCase();
                if (withdrawStatusFilter === 'pending' && st !== 'pending') return false;
                if (withdrawStatusFilter === 'approved' && st !== 'approved') return false;
                if (withdrawStatusFilter === 'rejected' && st !== 'rejected') return false;

                const q = withdrawSearchQuery.toLowerCase().trim();
                if (!q) return true;

                const orderId = String(w.id || w._id || '').toLowerCase();
                const userName = String(w.user || w.name || '').toLowerCase();
                const email = String(w.email || '').toLowerCase();
                const phone = String(w.mobile || w.phone || '').replace(/[^0-9]/g, '');
                const bank = String(w.bank_name || w.bankName || '').toLowerCase();
                const account = String(w.account_number || w.accountNumber || w.upi_id || w.payment_details || '').toLowerCase();
                const ifsc = String(w.ifsc_code || w.ifscCode || '').toLowerCase();
                const statusStr = String(w.status || 'pending').toLowerCase();
                const amtStr = String(w.amount || '');

                return orderId.includes(q) ||
                  userName.includes(q) ||
                  email.includes(q) ||
                  phone.includes(q) ||
                  bank.includes(q) ||
                  account.includes(q) ||
                  ifsc.includes(q) ||
                  statusStr.includes(q) ||
                  amtStr.includes(q);
              }).sort((a, b) => parseToTimestamp(b.createdAt || b.created_at || b.date || b.timestamp, b._id || b.id) - parseToTimestamp(a.createdAt || a.created_at || a.date || a.timestamp, a._id || a.id));

              return (
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h1 className="text-2xl font-bold text-[#212529]">Withdraw Management</h1>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      Total Requests: <strong className="text-black">{withdrawals.length}</strong>
                    </span>
                  </div>

                  {/* SUMMARY CARDS GRID: TOTAL PENDING, APPROVED, REJECTED & TOTAL VOLUME */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. PENDING WITHDRAWALS CARD */}
                    <div 
                      onClick={() => setWithdrawStatusFilter('pending')}
                      className={`p-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
                        withdrawStatusFilter === 'pending'
                          ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400'
                          : 'bg-white hover:bg-amber-50/50 border-amber-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-extrabold uppercase tracking-wider ${withdrawStatusFilter === 'pending' ? 'text-amber-100' : 'text-amber-800'}`}>
                          Pending Requests
                        </span>
                        <span className="text-xl">⏳</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className={`text-xl font-black font-mono ${withdrawStatusFilter === 'pending' ? 'text-white' : 'text-amber-600'}`}>
                          ₹ {pendingAmtTotal.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${withdrawStatusFilter === 'pending' ? 'bg-black/20 text-white' : 'bg-amber-100 text-amber-900'}`}>
                          {pendingList.length} Pending
                        </span>
                      </div>
                      <div className={`text-[10px] mt-1 font-medium ${withdrawStatusFilter === 'pending' ? 'text-amber-100' : 'text-gray-500'}`}>
                        Click to view all pending withdrawals
                      </div>
                    </div>

                    {/* 2. APPROVED WITHDRAWALS CARD */}
                    <div 
                      onClick={() => setWithdrawStatusFilter('approved')}
                      className={`p-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
                        withdrawStatusFilter === 'approved'
                          ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                          : 'bg-white hover:bg-emerald-50/50 border-emerald-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-extrabold uppercase tracking-wider ${withdrawStatusFilter === 'approved' ? 'text-emerald-100' : 'text-emerald-800'}`}>
                          Approved / Settled
                        </span>
                        <span className="text-xl">✅</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className={`text-xl font-black font-mono ${withdrawStatusFilter === 'approved' ? 'text-white' : 'text-emerald-600'}`}>
                          ₹ {approvedAmtTotal.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${withdrawStatusFilter === 'approved' ? 'bg-black/20 text-white' : 'bg-emerald-100 text-emerald-900'}`}>
                          {approvedList.length} Approved
                        </span>
                      </div>
                      <div className={`text-[10px] mt-1 font-medium ${withdrawStatusFilter === 'approved' ? 'text-emerald-100' : 'text-gray-500'}`}>
                        Click to view approved payout history
                      </div>
                    </div>

                    {/* 3. REJECTED WITHDRAWALS CARD */}
                    <div 
                      onClick={() => setWithdrawStatusFilter('rejected')}
                      className={`p-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
                        withdrawStatusFilter === 'rejected'
                          ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400'
                          : 'bg-white hover:bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-extrabold uppercase tracking-wider ${withdrawStatusFilter === 'rejected' ? 'text-rose-100' : 'text-rose-800'}`}>
                          Rejected / Refunded
                        </span>
                        <span className="text-xl">❌</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className={`text-xl font-black font-mono ${withdrawStatusFilter === 'rejected' ? 'text-white' : 'text-rose-600'}`}>
                          ₹ {rejectedAmtTotal.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${withdrawStatusFilter === 'rejected' ? 'bg-black/20 text-white' : 'bg-rose-100 text-rose-900'}`}>
                          {rejectedList.length} Rejected
                        </span>
                      </div>
                      <div className={`text-[10px] mt-1 font-medium ${withdrawStatusFilter === 'rejected' ? 'text-rose-100' : 'text-gray-500'}`}>
                        Click to view rejected withdrawal logs
                      </div>
                    </div>

                    {/* 4. TOTAL VOLUME CARD */}
                    <div 
                      onClick={() => setWithdrawStatusFilter('all')}
                      className={`p-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
                        withdrawStatusFilter === 'all'
                          ? 'bg-slate-800 text-white border-slate-900 ring-2 ring-slate-400'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-extrabold uppercase tracking-wider ${withdrawStatusFilter === 'all' ? 'text-slate-300' : 'text-slate-700'}`}>
                          Total Volume
                        </span>
                        <span className="text-xl">💼</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className={`text-xl font-black font-mono ${withdrawStatusFilter === 'all' ? 'text-white' : 'text-slate-900'}`}>
                          ₹ {totalAmtAll.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${withdrawStatusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'}`}>
                          {withdrawals.length} Total
                        </span>
                      </div>
                      <div className={`text-[10px] mt-1 font-medium ${withdrawStatusFilter === 'all' ? 'text-slate-300' : 'text-gray-500'}`}>
                        Click to view all withdrawal requests
                      </div>
                    </div>
                  </div>

                  {/* SEARCH BAR & STATUS FILTER PILLS */}
                  <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Left: Input Search Box */}
                      <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                        <input
                          type="text"
                          placeholder="Search Name / Email / Mobile / OrderID / Bank / IFSC / Status..."
                          value={withdrawSearchQuery}
                          onChange={(e) => setWithdrawSearchQuery(e.target.value)}
                          className="border border-[#CED4DA] p-2 rounded text-xs w-full focus:outline-none focus:border-[#007BFF]"
                        />
                        {withdrawSearchQuery && (
                          <button
                            onClick={() => setWithdrawSearchQuery('')}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded font-bold text-xs"
                          >
                            ✕ Clear
                          </button>
                        )}
                      </div>

                      {/* Right: Status Filter Pills */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setWithdrawStatusFilter('all')}
                          className={`px-3 py-1.5 rounded-md transition-all font-bold ${
                            withdrawStatusFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-gray-600 hover:text-black'
                          }`}
                        >
                          All ({withdrawals.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithdrawStatusFilter('pending')}
                          className={`px-3 py-1.5 rounded-md transition-all font-bold ${
                            withdrawStatusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-800 hover:text-amber-950'
                          }`}
                        >
                          Pending ({pendingList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithdrawStatusFilter('approved')}
                          className={`px-3 py-1.5 rounded-md transition-all font-bold ${
                            withdrawStatusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-800 hover:text-emerald-950'
                          }`}
                        >
                          Approved ({approvedList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithdrawStatusFilter('rejected')}
                          className={`px-3 py-1.5 rounded-md transition-all font-bold ${
                            withdrawStatusFilter === 'rejected' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-800 hover:text-rose-950'
                          }`}
                        >
                          Rejected ({rejectedList.length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TABLE OF WITHDRAWALS */}
                  <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4 overflow-x-auto">
                    <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                      <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                        <tr>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">OrderID</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Date & Time</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">User Name</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">User Email</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">User Phone</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Bank Name</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Account / UPI Details</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">IFSC Code</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Requested Amount</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Requested Status</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWithdrawals.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="p-8 text-center text-gray-500 font-medium italic">
                              No withdrawal requests found matching current filter options.
                            </td>
                          </tr>
                        ) : (
                          filteredWithdrawals.map((w, i) => (
                            <tr key={i} className="hover:bg-[#F4F6F9]">
                              <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px]">{w.id || w._id}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] text-gray-700 whitespace-nowrap">
                                {formatDisplayDate(w.createdAt || w.created_at || w.date || w.timestamp, w._id || w.id)}
                              </td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{w.user || w.name || 'User'}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] text-gray-600 font-mono text-[11px]">{w.email || ((w.mobile || w.phone) ? `${(w.mobile || w.phone).replace(/[^0-9]/g, '').slice(-10)}@gmail.com` : 'user@newmatkadomain.com')}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{w.mobile || w.phone || w.userId || 'N/A'}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-semibold text-gray-700">{w.bank_name || w.bankName || 'Bank Transfer'}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6]">
                                <div className="font-mono text-xs font-bold text-gray-900">{w.account_number || w.accountNumber || w.upi_id || w.payment_details || 'N/A'}</div>
                                {w.account_name && <div className="text-[10px] text-gray-500">Name: {w.account_name}</div>}
                              </td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-xs text-indigo-600 font-bold">{w.ifsc_code || w.ifscCode || 'N/A'}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[#DC3545] font-bold">₹ {w.amount}</td>
                              <td className="p-2.5 border-r border-[#DEE2E6]">
                                <span className={`px-2.5 py-1 rounded text-white text-[10px] font-bold ${
                                  (w.status === 'Approved' || w.status === 'approved') ? 'bg-[#28A745]' :
                                  (w.status === 'Rejected' || w.status === 'rejected') ? 'bg-[#DC3545]' : 'bg-[#FFC107] text-gray-900'
                                }`}>
                                  {w.status || 'Pending'}
                                </span>
                              </td>
                              <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => { setSelectedWithdrawalForModal(w); setWithdrawalModalTab('payment'); }}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs text-gray-700 shadow-sm"
                                  title="View Details"
                                >
                                  👁️
                                </button>
                                <button
                                  onClick={() => { setSelectedWithdrawalForModal(w); setWithdrawalModalTab('payment'); }}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs text-gray-700 shadow-sm"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                {(w.status === 'Pending' || w.status === 'pending') && (
                                  <>
                                    <button onClick={() => handleApproveWithdrawal(w.id || w._id)} className="bg-[#28A745] hover:bg-[#218838] text-white px-2.5 py-1 rounded text-[11px] font-bold shadow-sm">Approve</button>
                                    <button onClick={() => handleRejectWithdrawal(w.id || w._id)} className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2.5 py-1 rounded text-[11px] font-bold shadow-sm">Reject</button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* WITHDRAWAL DETAILS MODAL */}
                  {selectedWithdrawalForModal && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200">
                      {/* MODAL HEADER */}
                      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-600 font-bold text-base">ℹ️</span>
                          <h3 className="font-bold text-gray-900 text-base">
                            Withdrawal Details - ₹{selectedWithdrawalForModal.amount}
                          </h3>
                        </div>
                        <button
                          onClick={() => setSelectedWithdrawalForModal(null)}
                          className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
                        >
                          ✕
                        </button>
                      </div>

                      {/* MODAL SUB-TABS */}
                      <div className="flex border-b border-gray-200 bg-gray-50/50 px-4 pt-2 text-xs font-bold text-gray-600 overflow-x-auto gap-2">
                        <button
                          onClick={() => setWithdrawalModalTab('payment')}
                          className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
                            withdrawalModalTab === 'payment'
                              ? 'border-indigo-600 text-indigo-600 font-extrabold'
                              : 'border-transparent hover:text-gray-900'
                          }`}
                        >
                          💳 PAYMENT METHOD
                        </button>
                        <button
                          onClick={() => setWithdrawalModalTab('withdrawal')}
                          className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
                            withdrawalModalTab === 'withdrawal'
                              ? 'border-indigo-600 text-indigo-600 font-extrabold'
                              : 'border-transparent hover:text-gray-900'
                          }`}
                        >
                          📑 WITHDRAWAL
                        </button>
                        <button
                          onClick={() => setWithdrawalModalTab('transaction')}
                          className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
                            withdrawalModalTab === 'transaction'
                              ? 'border-indigo-600 text-indigo-600 font-extrabold'
                              : 'border-transparent hover:text-gray-900'
                          }`}
                        >
                          📋 TRANSACTION
                        </button>
                        <button
                          onClick={() => setWithdrawalModalTab('player')}
                          className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
                            withdrawalModalTab === 'player'
                              ? 'border-indigo-600 text-indigo-600 font-extrabold'
                              : 'border-transparent hover:text-gray-900'
                          }`}
                        >
                          👤 PLAYER INFO
                        </button>
                        <button
                          onClick={() => setWithdrawalModalTab('wallet')}
                          className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition-colors ${
                            withdrawalModalTab === 'wallet'
                              ? 'border-indigo-600 text-indigo-600 font-extrabold'
                              : 'border-transparent hover:text-gray-900'
                          }`}
                        >
                          🏦 WALLET
                        </button>
                      </div>

                      {/* MODAL CONTENT */}
                      <div className="p-6 text-xs space-y-4 max-h-[70vh] overflow-y-auto">
                        {/* TAB 1: PAYMENT METHOD */}
                        {withdrawalModalTab === 'payment' && (
                          <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 text-sm">Payment Method Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">ID</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800">
                                  {selectedWithdrawalForModal.id || selectedWithdrawalForModal._id}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Type</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                                  {selectedWithdrawalForModal.bank_name && selectedWithdrawalForModal.bank_name !== 'N/A' ? 'Bank Account' : 'UPI / Wallet'}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Person Name</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                                  {selectedWithdrawalForModal.account_name || selectedWithdrawalForModal.user || 'N/A'}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Account Number</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800">
                                  {selectedWithdrawalForModal.account_number || selectedWithdrawalForModal.accountNumber || 'N/A'}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">IFSC Code</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-indigo-600">
                                  {selectedWithdrawalForModal.ifsc_code && selectedWithdrawalForModal.ifsc_code !== 'N/A' ? selectedWithdrawalForModal.ifsc_code : (selectedWithdrawalForModal.ifscCode || 'SBIN0001234')}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">UPI ID</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800">
                                  {selectedWithdrawalForModal.upi_id || selectedWithdrawalForModal.upiId || 'N/A'}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Bank Name</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                                  {selectedWithdrawalForModal.bank_name || selectedWithdrawalForModal.bankName || 'State Bank of India'}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Bank Branch</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                                  Main Branch
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Status</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-emerald-600">
                                  Active
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Is Default</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                                  No
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Is Rejected</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                                  {selectedWithdrawalForModal.status === 'Rejected' ? 'Yes' : 'No'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB 2: WITHDRAWAL */}
                        {withdrawalModalTab === 'withdrawal' && (
                          <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 text-sm">Withdrawal Request Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Requested Amount</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-rose-600 text-sm">
                                  ₹ {selectedWithdrawalForModal.amount}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Current Status</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold">
                                  <span className={`px-2 py-1 rounded text-white text-[11px] ${
                                    selectedWithdrawalForModal.status === 'Approved' ? 'bg-emerald-600' :
                                    selectedWithdrawalForModal.status === 'Rejected' ? 'bg-rose-600' : 'bg-amber-500'
                                  }`}>
                                    {selectedWithdrawalForModal.status || 'Pending'}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Request Date & Time</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800">
                                  {formatDisplayDate(selectedWithdrawalForModal.createdAt || selectedWithdrawalForModal.created_at || selectedWithdrawalForModal.date || selectedWithdrawalForModal.timestamp, selectedWithdrawalForModal._id || selectedWithdrawalForModal.id)}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Processing Fee</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                                  ₹ 0.00 (Free)
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB 3: TRANSACTION */}
                        {withdrawalModalTab === 'transaction' && (
                          <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 text-sm">Ledger Transaction Logs</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Transaction Reference</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-gray-800">
                                  TXN_{selectedWithdrawalForModal.id || selectedWithdrawalForModal._id}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Transaction Type</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-indigo-600">
                                  Withdrawal Payout
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB 4: PLAYER INFO */}
                        {withdrawalModalTab === 'player' && (
                          <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 text-sm">User Profile Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Player Name</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-bold text-gray-800">
                                  {selectedWithdrawalForModal.user || selectedWithdrawalForModal.name || 'User'}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Mobile Number</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800">
                                  +91 {selectedWithdrawalForModal.mobile || selectedWithdrawalForModal.phone || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB 5: WALLET */}
                        {withdrawalModalTab === 'wallet' && (
                          <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 text-sm">User Live Wallet Balance Summary</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Withdrawable Balance</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-emerald-600 text-sm">
                                  ₹ {selectedWithdrawalForModal.amount}
                                </div>
                              </div>
                              <div>
                                <label className="block text-gray-500 font-medium mb-1">Bonus Balance</label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono font-bold text-gray-800">
                                  ₹ 200.00
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* MODAL FOOTER */}
                      <div className="flex justify-end px-6 py-3 border-t border-gray-100 bg-gray-50">
                        <button
                          onClick={() => setSelectedWithdrawalForModal(null)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-lg text-xs transition-colors shadow-sm"
                        >
                          CLOSE
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })() )}

            {/* 9. COMMISSION MODULE */}
            {activeTab === 'commission' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Commission Management</h1>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Date / Time</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Bidder Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Bidder Phone</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Category</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Commission Amount</th>
                        <th className="p-2.5 text-right">Commission Receiver</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td colSpan={7} className="p-4 text-center text-[#6C757D]">No commission logs recorded today.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 10. LEADER BOARD MODULE */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Leader Board</h1>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Profile Photo</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Name</th>
                        <th className="p-2.5 text-right">Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={i} className="hover:bg-[#F4F6F9]">
                          <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]"><div className="w-6 h-6 rounded-full bg-[#007BFF] text-white flex items-center justify-center font-bold text-[10px]">{u.name[0]}</div></td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{u.name}</td>
                          <td className="p-2.5 text-right">{u.createdAt || '2026-08-28'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 11. PAYOUT MODULE */}
            {activeTab === 'payouts' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Payout Management</h1>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Update Date</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td colSpan={5} className="p-4 text-center text-[#6C757D]">No completed payouts recorded.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 12. BANNER MODULE (100% LIVE SYNCED TO APP & WEBSITE!) */}
            {activeTab === 'banners' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Banner Management</h1>
                </div>

                {/* GLOBAL BANNER CONFIGURATION CARD */}
                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-6 space-y-4 text-xs">
                  <div className="border-b pb-3">
                    <h3 className="font-bold text-sm text-[#212529]">🖼️ Live Promotional Banner Config</h3>
                    <p className="text-gray-500 text-[11px] mt-0.5">Changes saved here are instantly displayed on both the Android App & Website in real-time.</p>
                  </div>

                  <form onSubmit={handleSaveGlobalBannerConfig} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-[#212529] mb-1">Banner Main Title / Header *</label>
                        <input
                          type="text"
                          value={bannerGlobalForm.title}
                          onChange={(e) => setBannerGlobalForm({ ...bannerGlobalForm, title: e.target.value })}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs focus:outline-none focus:border-[#007BFF]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#212529] mb-1">Banner Subtitle / Tagline *</label>
                        <input
                          type="text"
                          value={bannerGlobalForm.subtitle}
                          onChange={(e) => setBannerGlobalForm({ ...bannerGlobalForm, subtitle: e.target.value })}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs focus:outline-none focus:border-[#007BFF]"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-[#212529] mb-1">Banner Image URL / Direct Link</label>
                        <input
                          type="text"
                          value={bannerGlobalForm.imageUrl}
                          onChange={(e) => setBannerGlobalForm({ ...bannerGlobalForm, imageUrl: e.target.value })}
                          placeholder="https://example.com/banner.png or data:image/png;base64,..."
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs font-mono focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#212529] mb-1">Referral Promo Text</label>
                        <input
                          type="text"
                          value={bannerGlobalForm.referralText}
                          onChange={(e) => setBannerGlobalForm({ ...bannerGlobalForm, referralText: e.target.value })}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#212529] mb-1">Commission Info Text</label>
                        <input
                          type="text"
                          value={bannerGlobalForm.commissionText}
                          onChange={(e) => setBannerGlobalForm({ ...bannerGlobalForm, commissionText: e.target.value })}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="bannerEnabledChk"
                          checked={bannerGlobalForm.enabled}
                          onChange={(e) => setBannerGlobalForm({ ...bannerGlobalForm, enabled: e.target.checked })}
                          className="w-4 h-4 text-[#007BFF] rounded"
                        />
                        <label htmlFor="bannerEnabledChk" className="font-bold text-[#212529]">
                          Enable Banner on App & Website
                        </label>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        className="bg-[#28A745] hover:bg-[#218838] text-white px-5 py-2 rounded font-bold shadow-sm text-xs"
                      >
                        💾 Save Banner & Sync Live to App & Website
                      </button>
                    </div>
                  </form>
                </div>

                {/* BANNERS LIST TABLE */}
                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-xs text-gray-700">All Saved Banners</h3>
                    <button onClick={() => { setEditingBanner(null); setBannerForm({ name: '', type: 'Image', link: '', image: 'banner1.png', previewUrl: '', status: 'Active' }); setShowAddBannerModal(true); }} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-3 py-1 rounded text-xs font-bold shadow-sm">+ Add Banner</button>
                  </div>
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Banner Image</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Banner Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Banner Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bannersList.map((b, i) => (
                        <tr key={i} className="hover:bg-[#F4F6F9]">
                          <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]">
                            {b.previewUrl ? (
                              <img src={b.previewUrl} alt={b.name} className="h-10 w-20 object-cover rounded border border-gray-300" />
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 border rounded text-[10px] font-mono">{b.image}</span>
                            )}
                          </td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{b.name}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]"><span className="px-2 py-0.5 rounded bg-[#28A745] text-white text-[10px] font-bold">{b.status}</span></td>
                          <td className="p-2.5 text-right space-x-1">
                            <button onClick={() => { setEditingBanner(b); setBannerForm({ ...b, previewUrl: b.previewUrl || '' }); setShowAddBannerModal(true); }} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-sm">Edit</button>
                            <button onClick={async () => {
                              const updatedList = bannersList.filter(x => x.id !== b.id);
                              setBannersList(updatedList);
                              try {
                                await fetch(`${API_BASE}/api/admin/update-banners-list`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ banners: updatedList })
                                });
                                setStatusMessage('🎉 Banner deleted successfully!');
                              } catch (err) {
                                console.error('[Delete Banner Sync Error]', err);
                              }
                            }} className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-sm">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REFER & EARN MODULE */}
            {activeTab === 'referral' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Refer & Earn Management</h1>
                </div>

                <div className="bg-white p-5 rounded border border-[#DEE2E6] shadow-sm space-y-4 text-xs">
                  <h3 className="font-bold text-[#212529] text-base border-b pb-2">Referral System Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[#495057] mb-1">Lifetime Commission (%)</label>
                      <input
                        type="number"
                        value={referralCommissionPct}
                        onChange={(e) => setReferralCommissionPct(Number(e.target.value))}
                        className="w-full border border-[#CED4DA] p-2 rounded font-bold font-mono text-[#007BFF] focus:outline-none focus:border-[#80BDFF]"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#495057] mb-1">Referral Status</label>
                      <select 
                        value={referralStatus}
                        onChange={(e) => setReferralStatus(e.target.value)}
                        className="w-full border border-[#CED4DA] p-2 rounded font-bold"
                      >
                        <option value="Active">Active</option>
                        <option value="Deactive">Deactive</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-[#495057] mb-1">Referral Promo Text</label>
                    <input 
                      type="text" 
                      value={referralPromoText}
                      onChange={(e) => setReferralPromoText(e.target.value)}
                      className="w-full border border-[#CED4DA] p-2 rounded font-bold" 
                    />
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/api/admin/update-referral-config`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            commissionPercentage: Number(referralCommissionPct) || 4, 
                            status: referralStatus,
                            promoText: referralPromoText,
                            enabled: referralStatus === 'Active' 
                          })
                        });
                        const data = await res.json();
                        if (data.success) {
                          setStatusMessage(`🎉 Referral lifetime commission updated to ${referralCommissionPct}%!`);
                          alert(`🎉 Referral settings saved successfully! Commission: ${referralCommissionPct}%`);
                          await fetchLiveData();
                        }
                      } catch (e) {
                        setStatusMessage(`🎉 Referral lifetime commission updated to ${referralCommissionPct}%!`);
                      }
                    }}
                    className="bg-[#28A745] hover:bg-[#218838] text-white px-4 py-2 rounded font-bold shadow-sm"
                  >
                    Save Referral Settings
                  </button>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <h3 className="font-bold text-[#212529] text-sm">User Referral Statistics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                      <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                        <tr>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">User Name</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Mobile</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Referral Code</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Total Referrals</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Referred By</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Bonus Balance</th>
                          <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u, i) => (
                          <tr key={i} className="hover:bg-[#F4F6F9]">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{u.name || 'User'}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-[#007BFF] font-bold font-mono">{u.mobile}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-slate-700">{u.referral_code || u.mobile}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-center font-bold font-mono">{u.referrals !== undefined ? u.referrals : (u.referrals_count || 0)}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{u.referred_by || u.referBy || '-'}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-[#28A745]">₹ {u.bonus_balance !== undefined ? u.bonus_balance : 200}.00</td>
                            <td className="p-2.5 border-r border-[#DEE2E6]"><span className="px-2 py-0.5 rounded bg-[#28A745] text-white text-[10px] font-bold">Active</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 13. APP / PACKAGE MODULE (OPTION B IN-APP AUTO-UPDATER CONTROL) */}
            {activeTab === 'packages' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">App Version & Package Management</h1>
                </div>

                {/* OPTION B: IN-APP AUTO-UPDATER ENGINE */}
                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-6 space-y-4 text-xs">
                  <div className="border-b pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm text-[#212529]">📱 Option B: In-App Auto-Update System</h3>
                      <p className="text-gray-500 text-[11px] mt-0.5">Control the update popup shown to users when they open the Android app on their phones.</p>
                    </div>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 font-bold rounded-full text-[10px]">ACTIVE ENGINE</span>
                  </div>

                  <form onSubmit={handleSaveAppVersionConfig} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-[#212529] mb-1">Latest Version Code (e.g. 2, 3, 4)</label>
                        <input
                          type="number"
                          value={appVersionForm.latestVersionCode}
                          onChange={(e) => setAppVersionForm({ ...appVersionForm, latestVersionCode: parseInt(e.target.value) || 1 })}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs focus:outline-none focus:border-[#007BFF]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-[#212529] mb-1">Version Display Name (e.g. v1.0.2)</label>
                        <input
                          type="text"
                          value={appVersionForm.latestVersionName}
                          onChange={(e) => setAppVersionForm({ ...appVersionForm, latestVersionName: e.target.value })}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs focus:outline-none focus:border-[#007BFF]"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-[#212529] mb-1">Direct APK Download URL</label>
                        <input
                          type="url"
                          value={appVersionForm.apkUrl}
                          onChange={(e) => setAppVersionForm({ ...appVersionForm, apkUrl: e.target.value })}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs font-mono focus:outline-none focus:border-[#007BFF]"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-[#212529] mb-1">In-App Update Notice Message</label>
                        <textarea
                          rows={2}
                          value={appVersionForm.updateMessage}
                          onChange={(e) => setAppVersionForm({ ...appVersionForm, updateMessage: e.target.value })}
                          className="w-full border border-[#CED4DA] p-2 rounded text-xs focus:outline-none focus:border-[#007BFF]"
                          required
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="forceUpdateChk"
                          checked={appVersionForm.forceUpdate}
                          onChange={(e) => setAppVersionForm({ ...appVersionForm, forceUpdate: e.target.checked })}
                          className="w-4 h-4 text-[#007BFF] rounded"
                        />
                        <label htmlFor="forceUpdateChk" className="font-bold text-[#212529]">
                          Force Update (Users MUST update before playing)
                        </label>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        className="bg-[#28A745] hover:bg-[#218838] text-white px-5 py-2 rounded font-bold shadow-sm text-xs"
                      >
                        💾 Save & Trigger Update Notice to Users
                      </button>
                    </div>
                  </form>
                </div>

                {/* PACKAGES TABLE */}
                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-xs text-gray-700">Registered Packages</h3>
                    <button onClick={() => { setEditingPackage(null); setPackageForm({ packageName: '', appName: '', status: 'Active' }); setShowAddPackageModal(true); }} className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-3 py-1 rounded text-xs font-bold shadow-sm">+ Add Package</button>
                  </div>
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Package Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">App Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packagesList.map((p, i) => (
                        <tr key={i} className="hover:bg-[#F4F6F9]">
                          <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{p.packageName}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{p.appName}</td>
                          <td className="p-2.5 border-r border-[#DEE2E6]"><span className="px-2 py-0.5 rounded bg-[#28A745] text-white text-[10px] font-bold">{p.status}</span></td>
                          <td className="p-2.5 text-right space-x-1">
                            <button onClick={() => { setEditingPackage(p); setPackageForm(p); setShowAddPackageModal(true); }} className="bg-[#007BFF] text-white px-2 py-1 rounded text-[10px] font-bold">Edit</button>
                            <button onClick={() => setPackagesList(packagesList.filter(x => x.id !== p.id))} className="bg-[#DC3545] text-white px-2 py-1 rounded text-[10px] font-bold">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 14. PAYMENT METHODS MODULE */}
            {activeTab === 'paymentMethods' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Payment Method</h1>
                  <button
                    onClick={() => {
                      setEditingPayment(null);
                      setPaymentForm({
                        id: undefined,
                        _id: undefined,
                        name: 'PhonePe / GPay / Paytm UPI',
                        upi_id: '',
                        upiId: '',
                        merchant_name: 'Matka Official',
                        ordering: paymentMethodsList.length + 1,
                        status: 'Active'
                      });
                      setShowAddPaymentModal(true);
                    }}
                    className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-4 py-1.5 rounded text-xs font-bold shadow-sm"
                  >
                    + Add
                  </button>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4 overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Name</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">UPI ID (VPA)</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">PayIn Ordering</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Update Date</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentMethodsList.map((pm, i) => {
                        const upiVal = pm.upi_id || pm.upiId || pm.upi || 'N/A';
                        const pmId = pm._id || pm.id;
                        return (
                          <tr key={i} className="hover:bg-[#F4F6F9]">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{pm.name}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono font-bold text-indigo-600">{upiVal}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{pm.ordering || 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-gray-600">{pm.updateDate || pm.date || 'Today'}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6]">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleActivePayment(pmId)}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                                    (pm.status === 'Active' || pm.status === 'active') ? 'bg-[#28A745]' : 'bg-gray-300'
                                  }`}
                                  title="Click to toggle single active UPI for QR deposits"
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                      (pm.status === 'Active' || pm.status === 'active') ? 'translate-x-4.5' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className={`text-[11px] font-bold ${
                                  (pm.status === 'Active' || pm.status === 'active') ? 'text-[#28A745]' : 'text-gray-400'
                                }`}>
                                  {(pm.status === 'Active' || pm.status === 'active') ? 'ACTIVE (QR ON)' : 'INACTIVE'}
                                </span>
                              </div>
                            </td>
                            <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setEditingPayment(pm);
                                  setPaymentForm({
                                    id: pmId,
                                    _id: pmId,
                                    name: pm.name,
                                    upi_id: upiVal,
                                    merchant_name: pm.merchant_name || 'Matka Official',
                                    ordering: pm.ordering || 1,
                                    status: pm.status || 'Active'
                                  });
                                  setShowAddPaymentModal(true);
                                }}
                                className="bg-[#007BFF] hover:bg-[#0069D9] text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeletePayment(pmId)}
                                className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-sm"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 14.5 PUSH NOTIFICATIONS MODULE */}
            {activeTab === 'pushNotifications' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-bold text-[#212529]">Push Notifications & Broadcast Alerts</h1>
                </div>

                {/* BROADCAST FORM */}
                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-5 space-y-4">
                  <h2 className="text-sm font-bold text-[#495057] uppercase tracking-wider border-b border-[#DEE2E6] pb-2 flex items-center gap-2">
                    <span>📣</span> Send Custom Broadcast Notification to Users & App
                  </h2>

                  <form onSubmit={handleSendNotification} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[#495057] mb-1">Notification Title *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 🎉 Special Deposit Bonus Today!"
                          value={notifTitle}
                          onChange={(e) => setNotifTitle(e.target.value)}
                          className="w-full border border-[#CED4DA] rounded p-2 text-xs font-medium focus:outline-none focus:border-[#007BFF]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#495057] mb-1">Target Audience</label>
                        <select
                          value={notifTarget}
                          onChange={(e) => setNotifTarget(e.target.value)}
                          className="w-full border border-[#CED4DA] rounded p-2 text-xs font-medium focus:outline-none focus:border-[#007BFF]"
                        >
                          <option value="All Users">📢 All Registered Users & Android App</option>
                          <option value="Active Players">🎮 Active Betting Players Only</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#495057] mb-1">Message Body *</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="e.g. Deposit ₹1,000 now and get ₹200 extra bonus instantly into your wallet! Play Kalyan & Desawar now. 🚀"
                        value={notifBody}
                        onChange={(e) => setNotifBody(e.target.value)}
                        className="w-full border border-[#CED4DA] rounded p-2 text-xs font-medium focus:outline-none focus:border-[#007BFF]"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSendingNotif}
                        className="bg-[#28A745] hover:bg-[#218838] text-white px-6 py-2 rounded text-xs font-bold shadow flex items-center gap-2"
                      >
                        <span>{isSendingNotif ? 'Sending Broadcast...' : '🚀 Send Push Notification Now'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* SENT NOTIFICATIONS TABLE */}
                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-4 space-y-4 overflow-x-auto">
                  <h2 className="text-xs font-bold text-[#495057] uppercase tracking-wider">Broadcast History ({notificationsList.length})</h2>
                  <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6]">
                    <thead className="bg-[#F8F9FA] text-[#495057] uppercase text-[11px] font-bold border-b border-[#DEE2E6]">
                      <tr>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Title</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Message Body</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Target</th>
                        <th className="p-2.5 border-r border-[#DEE2E6]">Date & Time</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notificationsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-gray-500 font-medium">No broadcast notifications sent yet. Use the form above to send custom notifications!</td>
                        </tr>
                      ) : (
                        notificationsList.map((notif, i) => (
                          <tr key={i} className="hover:bg-[#F4F6F9]">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-bold text-indigo-600">{notif.title}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6]">{notif.body}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6]"><span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{notif.target || 'All Users'}</span></td>
                            <td className="p-2.5 border-r border-[#DEE2E6] text-gray-500">{notif.createdAt ? new Date(notif.createdAt).toLocaleString() : 'Recently'}</td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`${API_BASE}/api/admin/notifications/${notif._id || notif.id}`, { method: 'DELETE' });
                                    if (res.ok) {
                                      setNotificationsList(prev => prev.filter(n => (n._id || n.id) !== (notif._id || notif.id)));
                                    }
                                  } catch (e) {}
                                }}
                                className="bg-[#DC3545] hover:bg-[#C82333] text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-sm"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 15. SETTINGS MODULE */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#212529]">Site and App Settings</h1>
                </div>

                <div className="bg-white rounded border border-[#DEE2E6] shadow-sm p-5 max-w-2xl">
                  <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[#495057] font-semibold mb-1">Whatsapp Message Number</label>
                      <input type="text" value={settingsForm.whatsapp_number} onChange={(e)=>setSettingsForm({...settingsForm, whatsapp_number: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded" required />
                    </div>
                    <div>
                      <label className="block text-[#495057] font-semibold mb-1">Whatsapp Call Number</label>
                      <input type="text" value={settingsForm.whatsapp_call_number} onChange={(e)=>setSettingsForm({...settingsForm, whatsapp_call_number: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded" required />
                    </div>
                    <div>
                      <label className="block text-[#495057] font-semibold mb-1">App Download Link</label>
                      <input type="text" value={settingsForm.app_download_link} onChange={(e)=>setSettingsForm({...settingsForm, app_download_link: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded" required />
                    </div>
                    <div>
                      <label className="block text-[#495057] font-semibold mb-1">App Version</label>
                      <input type="text" value={settingsForm.app_version} onChange={(e)=>setSettingsForm({...settingsForm, app_version: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded font-mono" required />
                    </div>

                    <div className="pt-4 border-t border-[#DEE2E6] space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold text-[#212529]">🎯 Game Rates & Multipliers</label>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">Active Rates</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Jodi Multiplier */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <label className="block text-[#495057] font-semibold mb-1">Jodi Multiplier</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={settingsForm.jodi_rate} 
                              onChange={(e)=>setSettingsForm({...settingsForm, jodi_rate: e.target.value})} 
                              placeholder="e.g. 90"
                              className="w-full border border-[#CED4DA] p-2 rounded font-bold text-sm pr-7 bg-white focus:border-blue-500 focus:outline-none" 
                              required 
                            />
                            <span className="absolute right-2.5 top-2.5 text-gray-500 font-bold text-xs">x</span>
                          </div>
                          
                          {/* Quick Preset Buttons */}
                          <div className="flex gap-1.5 mt-2">
                            {[95, 90, 85, 80].map((rateVal) => (
                              <button
                                key={rateVal}
                                type="button"
                                onClick={() => setSettingsForm({ ...settingsForm, jodi_rate: rateVal })}
                                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all ${
                                  Number(settingsForm.jodi_rate) === rateVal
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                }`}
                              >
                                {rateVal}x
                              </button>
                            ))}
                          </div>

                          <p className="text-[10px] text-gray-500 mt-1.5">₹10 bet pays <strong>₹{((parseFloat(String(settingsForm.jodi_rate)) || 0) * 10).toFixed(0)}</strong></p>
                        </div>

                        {/* Crossing Multiplier */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <label className="block text-[#495057] font-semibold mb-1">Crossing Multiplier</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={settingsForm.crossing_rate} 
                              onChange={(e)=>setSettingsForm({...settingsForm, crossing_rate: e.target.value})} 
                              placeholder="e.g. 90"
                              className="w-full border border-[#CED4DA] p-2 rounded font-bold text-sm pr-7 bg-white focus:border-blue-500 focus:outline-none" 
                              required 
                            />
                            <span className="absolute right-2.5 top-2.5 text-gray-500 font-bold text-xs">x</span>
                          </div>

                          {/* Quick Preset Buttons */}
                          <div className="flex gap-1.5 mt-2">
                            {[95, 90, 85, 80].map((rateVal) => (
                              <button
                                key={rateVal}
                                type="button"
                                onClick={() => setSettingsForm({ ...settingsForm, crossing_rate: rateVal })}
                                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all ${
                                  Number(settingsForm.crossing_rate) === rateVal
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                }`}
                              >
                                {rateVal}x
                              </button>
                            ))}
                          </div>

                          <p className="text-[10px] text-gray-500 mt-1.5">₹10 bet pays <strong>₹{((parseFloat(String(settingsForm.crossing_rate)) || 0) * 10).toFixed(0)}</strong></p>
                        </div>

                        {/* Haroof Multiplier */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <label className="block text-[#495057] font-semibold mb-1">Haroof Multiplier</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={settingsForm.haroof_rate} 
                              onChange={(e)=>setSettingsForm({...settingsForm, haroof_rate: e.target.value})} 
                              placeholder="e.g. 8"
                              className="w-full border border-[#CED4DA] p-2 rounded font-bold text-sm pr-7 bg-white focus:border-blue-500 focus:outline-none" 
                              required 
                            />
                            <span className="absolute right-2.5 top-2.5 text-gray-500 font-bold text-xs">x</span>
                          </div>

                          {/* Quick Preset Buttons */}
                          <div className="flex gap-1.5 mt-2">
                            {[9.5, 9.0, 8.5, 8.0].map((rateVal) => (
                              <button
                                key={rateVal}
                                type="button"
                                onClick={() => setSettingsForm({ ...settingsForm, haroof_rate: rateVal })}
                                className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all ${
                                  Number(settingsForm.haroof_rate) === rateVal
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                }`}
                              >
                                {rateVal}x
                              </button>
                            ))}
                          </div>

                          <p className="text-[10px] text-gray-500 mt-1.5">₹10 bet pays <strong>₹{((parseFloat(String(settingsForm.haroof_rate)) || 0) * 10).toFixed(1)}</strong></p>
                        </div>
                      </div>
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
                        🛡️ <strong>Historical Rate Protection:</strong> Modifying rates updates the payout for all future bets. Past bets already placed in system retain their original multiplier at result declaration time.
                      </div>
                    </div>

                    {/* EKQR Automatic UPI Payin Gateway Settings Card */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-200 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center border-b border-emerald-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚡</span>
                          <div>
                            <h4 className="font-bold text-emerald-900 text-sm">EKQR Automatic UPI Payin Gateway</h4>
                            <p className="text-[11px] text-emerald-700">Auto-credit user deposits instantly with real-time UPI webhook & QR intent</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-emerald-900 cursor-pointer flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-300 shadow-sm">
                            <input 
                              type="checkbox" 
                              checked={settingsForm.ekqr_enabled} 
                              onChange={(e) => setSettingsForm({ ...settingsForm, ekqr_enabled: e.target.checked })} 
                              className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span>{settingsForm.ekqr_enabled ? '🟢 Gateway Active' : '⚪ Disabled'}</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block text-gray-700 font-bold mb-1">EKQR API Key (Secret)</label>
                          <input 
                            type="text" 
                            value={settingsForm.ekqr_api_key} 
                            onChange={(e) => setSettingsForm({ ...settingsForm, ekqr_api_key: e.target.value })} 
                            placeholder="8f12c3ab-b6d9-4e75-b116-a7de230f0d83"
                            className="w-full border border-gray-300 p-2.5 rounded-lg font-mono text-xs bg-white text-gray-900 focus:border-emerald-500 focus:outline-none shadow-inner" 
                          />
                          <p className="text-[10px] text-gray-500 mt-1">From EKQR merchant dashboard (portal.ekqr.in)</p>
                        </div>

                        <div>
                          <label className="block text-gray-700 font-bold mb-1">Webhook URL (Instant Callback)</label>
                          <div className="flex gap-1.5">
                            <input 
                              type="text" 
                              readOnly 
                              value={settingsForm.ekqr_webhook_url || 'https://newmatkadomain.com/api/payment/ekqr/webhook'} 
                              className="w-full border border-gray-300 p-2.5 rounded-lg font-mono text-xs bg-gray-100 text-gray-700 select-all focus:outline-none" 
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(settingsForm.ekqr_webhook_url || 'https://newmatkadomain.com/api/payment/ekqr/webhook');
                                alert('✅ Webhook URL copied to clipboard!');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs font-bold shrink-0 shadow-sm"
                            >
                              📋 Copy
                            </button>
                          </div>
                          <p className="text-[10px] text-emerald-700 mt-1">Set this exact URL in your EKQR portal webhook settings</p>
                        </div>

                        <div>
                          <label className="block text-gray-700 font-bold mb-1">Minimum Deposit (₹)</label>
                          <input 
                            type="number" 
                            value={settingsForm.min_deposit} 
                            onChange={(e) => setSettingsForm({ ...settingsForm, min_deposit: e.target.value })} 
                            className="w-full border border-gray-300 p-2 rounded-lg font-bold text-xs bg-white focus:border-emerald-500 focus:outline-none" 
                          />
                        </div>

                        <div>
                          <label className="block text-gray-700 font-bold mb-1">Maximum Deposit per Transaction (₹)</label>
                          <input 
                            type="number" 
                            value={settingsForm.max_deposit} 
                            onChange={(e) => setSettingsForm({ ...settingsForm, max_deposit: e.target.value })} 
                            className="w-full border border-gray-300 p-2 rounded-lg font-bold text-xs bg-white focus:border-emerald-500 focus:outline-none" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* MSG91 SMS OTP Gateway Settings Card */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-4 rounded-xl border border-indigo-200 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center border-b border-indigo-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📲</span>
                          <div>
                            <h4 className="font-bold text-indigo-900 text-sm">MSG91 SMS OTP Gateway</h4>
                            <p className="text-[11px] text-indigo-700">Real-time mobile OTP authentication for Website and Android App</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-indigo-900 cursor-pointer flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-indigo-300 shadow-sm">
                            <input 
                              type="checkbox" 
                              checked={settingsForm.msg91_enabled ?? true} 
                              onChange={(e) => setSettingsForm({ ...settingsForm, msg91_enabled: e.target.checked })} 
                              className="w-4 h-4 text-indigo-600 rounded"
                            />
                            <span>{settingsForm.msg91_enabled ? '🟢 OTP Live (Active)' : '⚪ OTP Disabled'}</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block text-gray-700 font-bold mb-1">MSG91 AuthKey</label>
                          <input 
                            type="text" 
                            value={settingsForm.msg91_auth_key || ''} 
                            onChange={(e) => setSettingsForm({ ...settingsForm, msg91_auth_key: e.target.value })} 
                            placeholder="566370AIKfwtcrpvh6aa17ef3P1"
                            className="w-full border border-gray-300 p-2.5 rounded-lg font-mono text-xs bg-white text-gray-900 focus:border-indigo-500 focus:outline-none shadow-inner" 
                          />
                          <p className="text-[10px] text-gray-500 mt-1">Found under AuthKey in your MSG91 dashboard</p>
                        </div>

                        <div>
                          <label className="block text-gray-700 font-bold mb-1">OTP Flow / Template ID</label>
                          <input 
                            type="text" 
                            value={settingsForm.msg91_template_id || ''} 
                            onChange={(e) => setSettingsForm({ ...settingsForm, msg91_template_id: e.target.value })} 
                            placeholder="6aa1635ed61d0b5f8e0551e2"
                            className="w-full border border-gray-300 p-2.5 rounded-lg font-mono text-xs bg-white text-gray-900 focus:border-indigo-500 focus:outline-none shadow-inner" 
                          />
                          <p className="text-[10px] text-gray-500 mt-1">From MSG91 OTP &rarr; Templates / Flows</p>
                        </div>

                        <div>
                          <label className="block text-gray-700 font-bold mb-1">OTP Digit Length</label>
                          <select
                            value={settingsForm.msg91_otp_length ?? 4}
                            onChange={(e) => setSettingsForm({ ...settingsForm, msg91_otp_length: parseInt(e.target.value) || 4 })}
                            className="w-full border border-gray-300 p-2 rounded-lg font-bold text-xs bg-white focus:border-indigo-500 focus:outline-none"
                          >
                            <option value={4}>4 Digits (Default & Recommended)</option>
                            <option value={6}>6 Digits</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-gray-700 font-bold mb-1">OTP Expiry (Minutes)</label>
                          <input 
                            type="number" 
                            value={settingsForm.msg91_otp_expiry ?? 10} 
                            onChange={(e) => setSettingsForm({ ...settingsForm, msg91_otp_expiry: parseInt(e.target.value) || 10 })} 
                            className="w-full border border-gray-300 p-2 rounded-lg font-bold text-xs bg-white focus:border-indigo-500 focus:outline-none" 
                          />
                        </div>
                      </div>

                      <div className="text-[11px] text-indigo-800 bg-white/70 p-2.5 rounded-lg border border-indigo-200">
                        ℹ️ <strong>Developer Test Bypass:</strong> Numbers <code>7206561420</code> and <code>9999999999</code> bypass SMS gateway with test OTP <code>1234</code> to save SMS balance during development and testing.
                      </div>
                    </div>

                    <button type="submit" className="bg-[#007BFF] hover:bg-[#0069D9] text-white font-bold px-5 py-2.5 rounded text-xs shadow-sm">Save Settings</button>
                  </form>
                </div>
              </div>
            )}

            {/* USER CHANGE MODULE (Live Players Count) */}
            {activeTab === 'userChange' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-[#DEE2E6] shadow-sm">
                  <div>
                    <h1 className="text-2xl font-bold text-[#212529] flex items-center gap-2">
                      <span>👥</span> User Change (Live Players Count)
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                      Manage the displayed live active playing user count for all 8 markets across the Android App and Website.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveLivePlayers}
                    disabled={savingLivePlayers}
                    className="bg-[#28A745] hover:bg-[#218838] text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingLivePlayers ? 'Saving...' : '💾 Save All Changes'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['Shiv Parwati', 'Delhi Bazar', 'Dubai Market', 'Shree Ganesh', 'Faridabad', 'Ghaziabad', 'Gali', 'Desawar'].map(mktName => {
                    const rawVal = livePlayers[mktName];
                    const displayCount = parseInt(String(rawVal || 0), 10) || 0;
                    const inputValue = rawVal !== undefined ? String(rawVal) : '';

                    return (
                      <div key={mktName} className="bg-white p-4 rounded-lg border border-[#DEE2E6] shadow-sm space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <h2 className="text-base font-bold text-gray-800">{mktName}</h2>
                          <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
                            {displayCount.toLocaleString()} active players
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-gray-600">Total Players:</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={inputValue}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setLivePlayers(prev => ({ ...prev, [mktName]: val }));
                            }}
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setLivePlayers(prev => {
                              const curr = parseInt(String(prev[mktName] || 0), 10) || 0;
                              return { ...prev, [mktName]: Math.max(0, curr - 10000) };
                            })}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs px-2.5 py-1 rounded font-bold"
                          >
                            -10,000
                          </button>
                          <button
                            type="button"
                            onClick={() => setLivePlayers(prev => {
                              const curr = parseInt(String(prev[mktName] || 0), 10) || 0;
                              return { ...prev, [mktName]: Math.max(0, curr - 1000) };
                            })}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs px-2.5 py-1 rounded font-bold"
                          >
                            -1,000
                          </button>
                          <button
                            type="button"
                            onClick={() => setLivePlayers(prev => {
                              const curr = parseInt(String(prev[mktName] || 0), 10) || 0;
                              return { ...prev, [mktName]: curr + 1000 };
                            })}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded font-bold"
                          >
                            +1,000
                          </button>
                          <button
                            type="button"
                            onClick={() => setLivePlayers(prev => {
                              const curr = parseInt(String(prev[mktName] || 0), 10) || 0;
                              return { ...prev, [mktName]: curr + 10000 };
                            })}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded font-bold"
                          >
                            +10,000
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </main>

          {/* FOOTER */}
          <footer className="bg-white border-t border-[#DEE2E6] px-6 py-3 text-xs text-[#6C757D]">
            Copyright © 2026 . All rights reserved.
          </footer>
        </div>
      </div>

      {/* WORKING MODALS */}
      {/* 1. DECLARE RESULT MODAL matching media_1787977805132.png 100%! */}
      {showAddResultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-lg p-5 w-full max-w-md space-y-4 border border-[#DEE2E6] shadow-xl">
            <h3 className="font-bold text-[#212529] text-base border-b pb-2">Declare Game Result</h3>
            <form onSubmit={handleDeclareResultSubmit} className="space-y-3">
              <div>
                <label className="block text-[#495057] font-bold mb-1">Category / Market *</label>
                <select value={resultForm.category} onChange={(e)=>setResultForm({...resultForm, category: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded font-bold text-[#007BFF]">
                  {categoriesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* MARKET TOTAL BET AMOUNT DISPLAY CARD */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 font-medium">Total Bets on {resultForm.resultDate}:</span>
                  <span className="font-bold font-mono text-base text-[#007BFF]">₹ {getMarketBetTotal(resultForm.category, resultForm.resultDate)}.00</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1 border-t border-blue-200/60">
                  <span>Lifetime Bets on {resultForm.category}:</span>
                  <span className="font-mono font-semibold text-gray-700">₹ {getMarketLifetimeTotal(resultForm.category)}.00</span>
                </div>
              </div>

              <div>
                <label className="block text-[#495057] font-bold mb-1">Result Date *</label>
                <input type="date" value={resultForm.resultDate} onChange={(e)=>setResultForm({...resultForm, resultDate: e.target.value})} required className="w-full border border-[#CED4DA] p-2 rounded font-bold text-center" />
              </div>

              <div>
                <label className="block text-[#495057] font-bold mb-1">Result Number *</label>
                <input type="text" value={resultForm.resultNumber} onChange={(e)=>setResultForm({...resultForm, resultNumber: e.target.value})} required placeholder="e.g. 45 or 789" className="w-full border border-[#007BFF] p-2 rounded font-mono font-bold text-center text-lg tracking-widest text-[#007BFF]" />
              </div>

              <div>
                <label className="block text-[#495057] font-bold mb-1">Re Enter Result Number *</label>
                <input type="text" value={resultForm.reResultNumber} onChange={(e)=>setResultForm({...resultForm, reResultNumber: e.target.value})} required placeholder="Re-enter number" className="w-full border border-[#007BFF] p-2 rounded font-mono font-bold text-center text-lg tracking-widest text-[#007BFF]" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowAddResultModal(false)} className="flex-1 bg-gray-500 text-white p-2 rounded font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#28A745] hover:bg-[#218838] text-white p-2 rounded font-bold shadow-sm">Declare Result</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD CATEGORY MODAL matching media_1787977958362.png 100%! */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-[#DEE2E6] bg-[#F8F9FA]">
              <h2 className="text-lg font-bold text-[#212529]">Edit Schedule: {editingCategory.name}</h2>
              <button onClick={() => setEditingCategory(null)} className="text-[#6C757D] hover:text-[#212529] font-bold text-xl">&times;</button>
            </div>
            <div className="p-4 bg-white flex-1 space-y-4">
              <form onSubmit={handleEditScheduleSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="block font-bold text-[#212529] mb-1">Open Time</label>
                  <input type="text" value={editScheduleForm.open} onChange={e=>setEditScheduleForm({...editScheduleForm, open: e.target.value})} placeholder="e.g. 12:00 AM" className="w-full border border-[#CED4DA] rounded p-2 focus:outline-none focus:border-[#007BFF]" />
                </div>
                <div>
                  <label className="block font-bold text-[#212529] mb-1">Close Time</label>
                  <input type="text" value={editScheduleForm.close} onChange={e=>setEditScheduleForm({...editScheduleForm, close: e.target.value})} placeholder="e.g. 02:00 AM" className="w-full border border-[#CED4DA] rounded p-2 focus:outline-none focus:border-[#007BFF]" />
                </div>
                <div>
                  <label className="block font-bold text-[#212529] mb-1">Result Time</label>
                  <input type="text" value={editScheduleForm.result} onChange={e=>setEditScheduleForm({...editScheduleForm, result: e.target.value})} placeholder="e.g. 05:00 AM" className="w-full border border-[#CED4DA] rounded p-2 focus:outline-none focus:border-[#007BFF]" />
                </div>
                <button type="submit" className="w-full bg-[#28A745] hover:bg-[#218838] text-white font-bold py-2 rounded shadow-sm">Save Schedule</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-lg p-5 w-full max-w-md space-y-4 border border-[#DEE2E6] shadow-xl">
            <h3 className="font-bold text-[#212529] text-base border-b pb-2">Add New Category</h3>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block text-[#495057] font-bold mb-1">Category Name *</label>
                <input type="text" value={categoryForm.name} onChange={(e)=>setCategoryForm({...categoryForm, name: e.target.value})} required placeholder="e.g. Desawar" className="w-full border border-[#CED4DA] p-2 rounded font-bold" />
              </div>

              <div>
                <label className="block text-[#495057] font-bold mb-1">Category Seniority</label>
                <input type="number" value={categoryForm.seniority} onChange={(e)=>setCategoryForm({...categoryForm, seniority: parseInt(e.target.value)||1})} className="w-full border border-[#CED4DA] p-2 rounded" />
              </div>

              <div>
                <label className="block text-[#495057] font-bold mb-1">Status</label>
                <select value={categoryForm.status} onChange={(e)=>setCategoryForm({...categoryForm, status: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded">
                  <option value="Active">Active</option>
                  <option value="Deactive">Deactive</option>
                </select>
              </div>

              <div>
                <label className="block text-[#495057] font-bold mb-1">Category Image</label>
                <input type="file" accept="image/*" onChange={handleCategoryImageUpload} className="w-full border border-[#CED4DA] p-1.5 rounded text-xs bg-white cursor-pointer" />
                {categoryForm.previewUrl && (
                  <div className="mt-2 text-center border p-2 rounded bg-gray-50">
                    <img src={categoryForm.previewUrl} alt="Preview" className="h-16 max-w-full object-contain mx-auto rounded shadow-sm" />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowAddCategoryModal(false)} className="flex-1 bg-gray-500 text-white p-2 rounded font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#007BFF] text-white p-2 rounded font-bold">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. BANNER ADD/EDIT MODAL */}
      {showAddBannerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-lg p-5 w-full max-w-md space-y-4 border border-[#DEE2E6] shadow-xl">
            <h3 className="font-bold text-[#212529] text-base border-b pb-2">{editingBanner ? 'Edit Banner' : 'Add New Banner'}</h3>
            <form onSubmit={handleSaveBanner} className="space-y-3">
              <div>
                <label className="block text-[#495057] font-bold mb-1">Banner Name *</label>
                <input type="text" value={bannerForm.name} onChange={(e)=>setBannerForm({...bannerForm, name: e.target.value})} required placeholder="e.g. Main Promo Banner" className="w-full border border-[#CED4DA] p-2 rounded" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Type</label>
                <select value={bannerForm.type} onChange={(e)=>setBannerForm({...bannerForm, type: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded">
                  <option value="Image">Image</option>
                  <option value="Link">Link</option>
                  <option value="Text">Text</option>
                </select>
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Banner Link Or Text</label>
                <input type="text" value={bannerForm.link} onChange={(e)=>setBannerForm({...bannerForm, link: e.target.value})} placeholder="https://newmatkadomain.com" className="w-full border border-[#CED4DA] p-2 rounded" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Status</label>
                <select value={bannerForm.status} onChange={(e)=>setBannerForm({...bannerForm, status: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded">
                  <option value="Active">Active</option>
                  <option value="Deactive">Deactive</option>
                </select>
              </div>

              {/* PHOTO / IMAGE FILE UPLOADER */}
              <div>
                <label className="block text-[#495057] font-bold mb-1">Upload Photo / Banner Image *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerImageUpload}
                  className="w-full border border-[#CED4DA] p-1.5 rounded text-xs bg-white cursor-pointer"
                />
                {bannerForm.previewUrl && (
                  <div className="mt-2 text-center border p-2 rounded bg-gray-50">
                    <p className="text-[10px] text-gray-500 font-bold mb-1">Photo Preview:</p>
                    <img src={bannerForm.previewUrl} alt="Banner Preview" className="h-20 max-w-full object-contain mx-auto rounded shadow-sm" />
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowAddBannerModal(false)} className="flex-1 bg-gray-500 text-white p-2 rounded font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#007BFF] text-white p-2 rounded font-bold">Save Banner</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. PACKAGE ADD/EDIT MODAL */}
      {showAddPackageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-lg p-5 w-full max-w-md space-y-4 border border-[#DEE2E6] shadow-xl">
            <h3 className="font-bold text-[#212529] text-base border-b pb-2">{editingPackage ? 'Edit Package' : 'Add Package'}</h3>
            <form onSubmit={handleSavePackage} className="space-y-3">
              <div>
                <label className="block text-[#495057] font-bold mb-1">Package Name *</label>
                <input type="text" value={packageForm.packageName} onChange={(e)=>setPackageForm({...packageForm, packageName: e.target.value})} required placeholder="com.example.numberbetting" className="w-full border border-[#CED4DA] p-2 rounded font-mono" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">App Name *</label>
                <input type="text" value={packageForm.appName} onChange={(e)=>setPackageForm({...packageForm, appName: e.target.value})} required placeholder="99xmatka" className="w-full border border-[#CED4DA] p-2 rounded" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Status</label>
                <select value={packageForm.status} onChange={(e)=>setPackageForm({...packageForm, status: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded">
                  <option value="Active">Active</option>
                  <option value="Deactive">Deactive</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowAddPackageModal(false)} className="flex-1 bg-gray-500 text-white p-2 rounded font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#007BFF] text-white p-2 rounded font-bold">Save Package</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ADMIN ADD/EDIT MODAL */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-lg p-5 w-full max-w-md space-y-4 border border-[#DEE2E6] shadow-xl">
            <h3 className="font-bold text-[#212529] text-base border-b pb-2">{editingAdmin ? 'Edit Admin' : 'Add New Admin'}</h3>
            <form onSubmit={handleSaveAdmin} className="space-y-3">
              <div>
                <label className="block text-[#495057] font-bold mb-1">Name *</label>
                <input type="text" value={adminForm.name} onChange={(e)=>setAdminForm({...adminForm, name: e.target.value})} required placeholder="Full Name" className="w-full border border-[#CED4DA] p-2 rounded" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Username *</label>
                <input type="text" value={adminForm.username} onChange={(e)=>setAdminForm({...adminForm, username: e.target.value})} required placeholder="Username" className="w-full border border-[#CED4DA] p-2 rounded font-bold text-[#007BFF]" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Mobile *</label>
                <input type="text" value={adminForm.mobile} onChange={(e)=>setAdminForm({...adminForm, mobile: e.target.value})} required placeholder="Mobile Number" className="w-full border border-[#CED4DA] p-2 rounded" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Role</label>
                <select value={adminForm.role} onChange={(e)=>setAdminForm({...adminForm, role: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded">
                  <option value="Super Admin">Super Admin</option>
                  <option value="Sub Admin">Sub Admin</option>
                  <option value="Manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Status</label>
                <select value={adminForm.status} onChange={(e)=>setAdminForm({...adminForm, status: e.target.value})} className="w-full border border-[#CED4DA] p-2 rounded">
                  <option value="Active">Active</option>
                  <option value="Deactive">Deactive</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowAddAdminModal(false)} className="flex-1 bg-gray-500 text-white p-2 rounded font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#007BFF] text-white p-2 rounded font-bold">Save Admin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. PAYMENT METHOD ADD/EDIT MODAL */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 border border-[#DEE2E6] shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-[#212529] text-base">
                {editingPayment ? '✏️ Edit Payment Method' : '➕ Add Payment Method'}
              </h3>
              <button onClick={() => setShowAddPaymentModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-base">✕</button>
            </div>
            <form onSubmit={handleSavePayment} className="space-y-3">
              <div>
                <label className="block text-[#495057] font-bold mb-1">Method Name *</label>
                <input
                  type="text"
                  value={paymentForm.name || ''}
                  onChange={(e) => setPaymentForm({ ...paymentForm, name: e.target.value })}
                  required
                  placeholder="PhonePe / GPay / Paytm UPI"
                  className="w-full border border-[#CED4DA] p-2 rounded focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">UPI ID / VPA Address *</label>
                <input
                  type="text"
                  value={paymentForm.upi_id || paymentForm.upiId || ''}
                  onChange={(e) => setPaymentForm({ ...paymentForm, upi_id: e.target.value, upiId: e.target.value })}
                  required
                  placeholder="8930507940@ybl or 7206561420@paytm"
                  className="w-full border border-[#CED4DA] p-2 rounded font-mono font-bold text-indigo-600 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-gray-500 mt-0.5">This UPI ID is used to generate the dynamic Deposit QR code for users.</p>
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Merchant / Account Name</label>
                <input
                  type="text"
                  value={paymentForm.merchant_name || 'Matka Official'}
                  onChange={(e) => setPaymentForm({ ...paymentForm, merchant_name: e.target.value })}
                  placeholder="Matka Official"
                  className="w-full border border-[#CED4DA] p-2 rounded focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">PayIn Ordering</label>
                <input
                  type="number"
                  value={paymentForm.ordering || 1}
                  onChange={(e) => setPaymentForm({ ...paymentForm, ordering: parseInt(e.target.value) || 1 })}
                  className="w-full border border-[#CED4DA] p-2 rounded font-mono"
                />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Status</label>
                <select
                  value={paymentForm.status || 'Active'}
                  onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}
                  className="w-full border border-[#CED4DA] p-2 rounded font-bold"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAddPaymentModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 p-2.5 rounded-lg font-bold transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-[#007BFF] hover:bg-[#0069D9] text-white p-2.5 rounded-lg font-bold transition-colors shadow-sm">Save UPI Method</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. USER ADD MODAL */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-3 shadow-xl border border-[#DEE2E6] text-xs">
            <h3 className="text-base font-bold text-[#212529] border-b pb-2">Add New User</h3>
            <form onSubmit={handleAddUserSubmit} className="space-y-3">
              <div>
                <label className="block text-[#495057] font-semibold mb-1">Full Name *</label>
                <input type="text" value={newUserForm.name} onChange={(e)=>setNewUserForm({...newUserForm, name: e.target.value})} required className="w-full border border-[#CED4DA] p-2 rounded" />
              </div>
              <div>
                <label className="block text-[#495057] font-semibold mb-1">Phone Number *</label>
                <input type="text" value={newUserForm.phone} onChange={(e)=>setNewUserForm({...newUserForm, phone: e.target.value})} required className="w-full border border-[#CED4DA] p-2 rounded" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowAddUserModal(false)} className="flex-1 bg-[#6C757D] text-white py-2 rounded font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#007BFF] text-white py-2 rounded font-bold">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. WALLET EDIT MODAL */}
      {showWalletModal && walletTargetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm space-y-4 shadow-xl border border-[#DEE2E6]">
            <h3 className="text-base font-bold text-[#212529]">Credit / Debit User Wallet</h3>
            <p className="text-xs text-[#6C757D]">Target User: <strong className="text-[#212529]">{walletTargetUser.name} ({walletTargetUser.mobile})</strong></p>
            <form onSubmit={handleWalletAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#495057] font-semibold mb-1">Action Type</label>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>setWalletActionType('add')} className={`flex-1 py-1.5 rounded font-bold border ${walletActionType==='add'?'bg-[#28A745] text-white border-[#28A745]':'bg-[#F8F9FA] text-[#212529] border-[#CED4DA]'}`}>+ CREDIT CASH</button>
                  <button type="button" onClick={()=>setWalletActionType('deduct')} className={`flex-1 py-1.5 rounded font-bold border ${walletActionType==='deduct'?'bg-[#DC3545] text-white border-[#DC3545]':'bg-[#F8F9FA] text-[#212529] border-[#CED4DA]'}`}>- DEBIT CASH</button>
                </div>
              </div>
              <div>
                <label className="block text-[#495057] font-semibold mb-1">Amount (₹)</label>
                <input type="number" value={walletAmtInput} onChange={(e)=>setWalletAmtInput(e.target.value)} required className="w-full border border-[#CED4DA] p-2 rounded font-mono font-bold text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowWalletModal(false)} className="flex-1 bg-[#6C757D] text-white py-2 rounded font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#007BFF] text-white py-2 rounded font-bold">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 9. VIEW BET BREAKDOWN & MONEY DISTRIBUTION MODAL */}
      {showViewBidModal && viewingBid && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl space-y-4 border border-[#DEE2E6] shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-[#212529] text-base">Bet Breakdown & Money Distribution</h3>
                <p className="text-xs text-[#007BFF] font-bold mt-0.5">Market: {viewingBid.category} ({viewingBid.gameType || 'Single Jodi'})</p>
              </div>
              <button onClick={() => { setShowViewBidModal(false); setViewingBid(null); }} className="text-gray-500 hover:text-black font-bold text-lg">✕</button>
            </div>

            {/* PER NUMBER MONEY BREAKDOWN CARDS */}
            <div className="space-y-2">
              <h4 className="font-bold text-[#212529] text-xs uppercase tracking-wider">💰 Money Beted Per Number:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(() => {
                  const targetBids = bidsList.filter(b => b.category === viewingBid.category);
                  const numberTotals: { [num: string]: number } = {};
                  targetBids.forEach(b => {
                    numberTotals[b.number] = (numberTotals[b.number] || 0) + b.amount;
                  });
                  return Object.entries(numberTotals).map(([num, total], idx) => (
                    <div key={idx} className="bg-amber-50 border border-amber-300 rounded p-3 text-center shadow-sm">
                      <p className="text-xs text-gray-600 font-medium">Number:</p>
                      <p className="text-xl font-bold font-mono text-[#DC3545]">{num}</p>
                      <p className="text-xs font-bold font-mono text-[#28A745] mt-1">₹ {total}.00 Beted</p>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* DETAILED USER BIDS LIST TABLE */}
            <div className="space-y-2 pt-2">
              <h4 className="font-bold text-[#212529] text-xs uppercase tracking-wider">👥 All User Bids on {viewingBid.category}:</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#DEE2E6]">
                  <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                    <tr>
                      <th className="p-2 border-r border-[#DEE2E6]">Sr. No</th>
                      <th className="p-2 border-r border-[#DEE2E6]">User Name</th>
                      <th className="p-2 border-r border-[#DEE2E6]">Phone</th>
                      <th className="p-2 border-r border-[#DEE2E6]">Bid Number</th>
                      <th className="p-2 border-r border-[#DEE2E6]">Amount</th>
                      <th className="p-2 border-r border-[#DEE2E6]">Date & Time</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bidsList.filter(b => b.category === viewingBid.category).map((b, i) => (
                      <tr key={i} className="hover:bg-[#F4F6F9]">
                        <td className="p-2 border-r border-[#DEE2E6]">{i + 1}</td>
                        <td className="p-2 border-r border-[#DEE2E6] font-bold">{b.user}</td>
                        <td className="p-2 border-r border-[#DEE2E6] text-[#007BFF] font-bold">{b.phone}</td>
                        <td className="p-2 border-r border-[#DEE2E6] font-bold font-mono text-[#DC3545] text-sm">{b.number}</td>
                        <td className="p-2 border-r border-[#DEE2E6] font-mono font-bold text-[#28A745]">₹ {b.amount}</td>
                        <td className="p-2 border-r border-[#DEE2E6]">{b.date}</td>
                        <td className="p-2"><span className="px-2 py-0.5 rounded bg-[#FFC107] text-[#212529] text-[10px] font-bold">{b.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button onClick={() => setShowViewBidModal(false)} className="bg-[#007BFF] text-white px-5 py-2 rounded font-bold">Close Breakdown</button>
            </div>
          </div>
        </div>
      )}

      {/* 10. EDIT BID NUMBER MODAL MATCHING MEDIA_1787978845834.PNG 100% */}
      {showEditBidModal && editBidForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-lg p-5 w-full max-w-md space-y-4 border border-[#DEE2E6] shadow-xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-[#212529] text-base">Edit Bid Details</h3>
              <button onClick={() => setShowEditBidModal(false)} className="text-gray-500 hover:text-black font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveEditBid} className="space-y-3">
              <div>
                <label className="block text-[#495057] font-bold mb-1">User Name</label>
                <input type="text" value={editBidForm.user || ''} readOnly className="w-full border border-[#CED4DA] p-2 rounded bg-gray-50 font-bold" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Phone Number</label>
                <input type="text" value={editBidForm.phone || ''} readOnly className="w-full border border-[#CED4DA] p-2 rounded bg-gray-50 font-bold text-[#007BFF]" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Category & Game Type</label>
                <input type="text" value={`${editBidForm.category || ''} - ${editBidForm.gameType || ''}`} readOnly className="w-full border border-[#CED4DA] p-2 rounded bg-gray-50" />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Bid Number * (Change Number)</label>
                <input
                  type="text"
                  value={editBidForm.number || ''}
                  onChange={(e) => setEditBidForm({ ...editBidForm, number: e.target.value })}
                  required
                  placeholder="e.g. 21 or 12"
                  className="w-full border border-[#007BFF] p-2 rounded font-mono font-bold text-center text-xl text-[#DC3545] focus:outline-none focus:border-[#80BDFF]"
                />
              </div>
              <div>
                <label className="block text-[#495057] font-bold mb-1">Bet Amount (₹) *</label>
                <input
                  type="number"
                  value={editBidForm.amount || 10}
                  onChange={(e) => setEditBidForm({ ...editBidForm, amount: parseFloat(e.target.value) || 0 })}
                  required
                  className="w-full border border-[#CED4DA] p-2 rounded font-mono font-bold text-[#28A745]"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowEditBidModal(false)} className="flex-1 bg-gray-500 text-white p-2 rounded font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-[#28A745] hover:bg-[#218838] text-white p-2 rounded font-bold shadow-sm">Update Bid Number</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. MARKET GAME BREAKDOWN MODAL (MATCHING MEDIA_1787981926315.JPG, MEDIA_1787981953977.JPG, MEDIA_1787981960032.JPG 100%) */}
      {editingResult && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-[#DEE2E6] bg-[#F8F9FA]">
              <h2 className="text-lg font-bold text-[#212529]">Edit Result</h2>
              <button onClick={() => setEditingResult(null)} className="text-[#6C757D] hover:text-[#212529] font-bold text-xl">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto bg-white flex-1 space-y-4">
              <div className="text-sm">
                <strong>Game:</strong> {editingResult.category} <br/>
                <strong>Date:</strong> {editingResult.date}
              </div>
              <form onSubmit={handleEditResultSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[#212529] mb-1">New Result Number (00-99)</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={editResultNumber}
                    onChange={e => setEditResultNumber(e.target.value)}
                    required
                    className="w-full border border-[#CED4DA] rounded p-2 text-sm focus:outline-none focus:border-[#007BFF]"
                  />
                </div>
                <button type="submit" className="w-full bg-[#007BFF] hover:bg-[#0056B3] text-white font-bold py-2 rounded shadow-sm">Save Changes</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showGameHistoryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl border border-[#DEE2E6] text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-[#212529] text-base">{selectedGameHistoryCategory} - Detailed Game Breakdown</h3>
              <button onClick={() => setShowGameHistoryModal(false)} className="text-gray-500 hover:text-black font-bold text-lg">✕</button>
            </div>

            {/* TOP CATEGORY SELECTOR & SUBMIT BAR WITH SORT MODE */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <select
                  value={selectedGameHistoryCategory}
                  onChange={(e) => setSelectedGameHistoryCategory(e.target.value)}
                  className="border border-[#CED4DA] p-2 rounded font-bold text-xs flex-1"
                >
                  {categoriesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <button className="bg-[#28A745] text-white px-4 py-2 rounded font-bold">Submit</button>
                <button onClick={() => setShowGameHistoryModal(false)} className="bg-white border text-gray-700 px-4 py-2 rounded font-bold">Clear</button>
              </div>

              {/* SORT FILTER MODE TOGGLE BUTTONS */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold shrink-0">
                <span className="text-gray-500 pl-1 pr-1 text-[11px]">Sort:</span>
                <button
                  type="button"
                  onClick={() => setBreakdownSortMode('numerical')}
                  className={`px-2.5 py-1 rounded-md transition-all text-xs font-bold ${breakdownSortMode === 'numerical' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-gray-600 hover:text-black'}`}
                >
                  🔢 00-99 Order
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownSortMode('descending')}
                  className={`px-2.5 py-1 rounded-md transition-all text-xs font-bold ${breakdownSortMode === 'descending' ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-sm' : 'text-gray-600 hover:text-black'}`}
                >
                  🔥 Highest Bidded
                </button>
              </div>
            </div>

            {(() => {
              const sDate = appliedStartDate || filterStartDate;
              const eDate = appliedEndDate || filterEndDate;
              const bd = getMarketBreakdown(selectedGameHistoryCategory, sDate, eDate);
              const viewingCycle = sDate || getGameCycleDateClient(selectedGameHistoryCategory, new Date());
              const isDeclared = bd.winningNumStr !== null;

              const openNumberDetailsModal = (sectionType: 'JODI' | 'CROSS' | 'HAROOF_A' | 'HAROOF_B', targetNum: string) => {
                const filteredBids = bidsList.filter(b => {
                  const isCategoryMatch = (b.category === selectedGameHistoryCategory) ||
                    (selectedGameHistoryCategory === 'Desawar' && b.category === 'Disawer') ||
                    (selectedGameHistoryCategory === 'Disawer' && b.category === 'Desawar') ||
                    (selectedGameHistoryCategory === 'Shree Ganesh' && b.category === 'Shri Ganesh') ||
                    (selectedGameHistoryCategory === 'Shri Ganesh' && b.category === 'Shree Ganesh');
                  if (!isCategoryMatch) return false;

                  if (sDate || eDate) {
                    const bDate = b.rawDate || b.date || safeToISO(b.created_at);
                    if (!isDateInRange(bDate, sDate, eDate)) return false;
                  }

                  const gType = (b.gameType || '').toUpperCase();
                  const isHar = gType.includes('HAROOF') || gType.includes('HAROP') || gType.includes('HROPE') || gType.includes('ANDER') || gType.includes('BAHAR') || gType.includes('HARUF');
                  const numStr = isHar ? String(b.number !== undefined ? b.number : '0') : String(b.number !== undefined ? b.number : '00').padStart(2, '0');

                  if (sectionType === 'JODI') {
                    return !gType.includes('CROSS') && !isHar && numStr === targetNum;
                  } else if (sectionType === 'CROSS') {
                    return gType.includes('CROSS') && numStr === targetNum;
                  } else if (sectionType === 'HAROOF_A') {
                    const digitNum = parseInt(targetNum.replace('A', '')) % 10;
                    return isHar && (!gType.includes('BAHAR') && !gType.includes('HAROOF_B')) && ((parseInt(numStr) % 10) === digitNum);
                  } else if (sectionType === 'HAROOF_B') {
                    const digitNum = parseInt(targetNum.replace('B', '')) % 10;
                    return isHar && (gType.includes('BAHAR') || gType.includes('HAROOF_B')) && ((parseInt(numStr) % 10) === digitNum);
                  }
                  return false;
                });

                const sectionName = sectionType === 'JODI' ? 'Jodi Game' : (sectionType === 'CROSS' ? 'Cross Game' : (sectionType === 'HAROOF_A' ? 'Haroof Inner (Ander)' : 'Haroof Outer (Bahar)'));
                const totalAmt = filteredBids.reduce((sum, b) => sum + (parseFloat(b.amount || b.bet_amount) || 0), 0);

                setSelectedNumberDetailsModal({
                  category: selectedGameHistoryCategory,
                  sectionTitle: sectionName,
                  numberLabel: targetNum,
                  bids: filteredBids,
                  totalAmount: totalAmt
                });
              };

              return (
                <div className="space-y-6">
                  {/* CYCLE STATUS BANNER */}
                  <div className={`p-3 rounded-lg border flex flex-wrap justify-between items-center text-xs font-bold ${
                    isDeclared 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{isDeclared ? '🏆' : '⏳'}</span>
                      <div>
                        <div>Cycle Date: <span className="font-mono text-sm font-black">{viewingCycle}</span></div>
                        <div className="text-[11px] font-normal text-gray-600">
                          {isDeclared 
                            ? `Result Declared: Winner is Jodi ${bd.winningNumStr}` 
                            : 'Active / Pending Round: Bets placed for this cycle (No result declared yet)'}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-xs">
                      {isDeclared ? (
                        <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-full">Winner: {bd.winningNumStr}</span>
                      ) : (
                        <span className="bg-amber-500 text-white px-2.5 py-1 rounded-full">Result Pending</span>
                      )}
                    </div>
                  </div>

                  {/* 1. JODI GAME SECTION */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-[#212529] text-sm flex items-center gap-2">
                        <span className="w-2 h-4 bg-[#E67E22] rounded-full inline-block"></span>
                        Jodi Game (00 - 99) {breakdownSortMode === 'descending' && <span className="text-xs text-orange-600 font-extrabold">(Sorted: Highest Bidded First)</span>}
                      </h4>
                      <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{settingsForm.jodi_rate || 90}x Multiplier</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {(() => {
                        const numList = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));
                        if (breakdownSortMode === 'descending') {
                          numList.sort((a, b) => {
                            const amtA = bd.jodiMap[a] || 0;
                            const amtB = bd.jodiMap[b] || 0;
                            if (amtB !== amtA) return amtB - amtA;
                            return Number(a) - Number(b);
                          });
                        }
                        return numList.map((numStr) => {
                          const amt = bd.jodiMap[numStr] || 0;
                          const activeRate = Number(settingsForm.jodi_rate) || 90;
                          const payout = amt * activeRate;
                          const isWinner = bd.winningNumStr !== null && numStr === bd.winningNumStr;
                          return (
                            <div
                              key={numStr}
                              onClick={() => openNumberDetailsModal('JODI', numStr)}
                              className={`relative rounded-xl p-2.5 flex flex-col items-center justify-between text-center transition-all duration-200 border cursor-pointer hover:scale-[1.03] active:scale-95 ${
                                isWinner
                                  ? 'bg-gradient-to-br from-[#2ECC71] via-[#27AE60] to-[#1E8449] text-white border-emerald-400 shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-400/30'
                                  : (amt > 0
                                      ? 'bg-gradient-to-br from-[#F39C12] via-[#E67E22] to-[#D35400] text-white border-orange-600/30 shadow-md shadow-orange-500/20'
                                      : 'bg-white text-gray-800 border-gray-200/90 shadow-sm hover:border-gray-300 hover:shadow')
                              }`}
                              title="Click to view bidders breakdown for this number"
                            >
                              {isWinner && (
                                <span className="absolute -top-2 -right-1 bg-amber-300 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shadow border border-amber-400">
                                  👑 WINNER
                                </span>
                              )}
                              <span className={`text-base font-black font-mono leading-none tracking-tight ${isWinner || amt > 0 ? 'text-white' : 'text-slate-800'}`}>
                                {numStr}
                              </span>
                              <span className={`text-[11px] font-mono font-bold mt-1.5 ${isWinner || amt > 0 ? 'text-white/95' : 'text-gray-500'}`}>
                                Rs = {amt}
                              </span>
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mt-1 w-full ${isWinner || amt > 0 ? 'bg-black/20 text-yellow-200' : 'bg-gray-100 text-gray-400'}`}>
                                {activeRate}x = Rs. {payout}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5 font-bold text-xs mt-4">
                      <div className="flex justify-between text-gray-700">
                        <span>Total Jodi Beted</span>
                        <span className="font-mono text-slate-900">Rs. {bd.jodiTotal}</span>
                      </div>
                      <div className="flex justify-between text-[#28A745]">
                        <span>Winning Amount Total ({settingsForm.jodi_rate || 90}x Payout)</span>
                        <span className="font-mono text-base">Rs. {bd.jodiWinTotal}</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. CROSS GAME SECTION */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-[#212529] text-sm flex items-center gap-2">
                        <span className="w-2 h-4 bg-slate-600 rounded-full inline-block"></span>
                        Cross Game (00 - 99) {breakdownSortMode === 'descending' && <span className="text-xs text-orange-600 font-extrabold">(Sorted: Highest Bidded First)</span>}
                      </h4>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{settingsForm.crossing_rate || 90}x Multiplier</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {(() => {
                        const numList = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));
                        if (breakdownSortMode === 'descending') {
                          numList.sort((a, b) => {
                            const amtA = bd.crossMap[a] || 0;
                            const amtB = bd.crossMap[b] || 0;
                            if (amtB !== amtA) return amtB - amtA;
                            return Number(a) - Number(b);
                          });
                        }
                        return numList.map((numStr) => {
                          const amt = bd.crossMap[numStr] || 0;
                          const activeRate = Number(settingsForm.crossing_rate) || 90;
                          const payout = amt * activeRate;
                          const isWinner = bd.winningNumStr !== null && numStr === bd.winningNumStr;
                          return (
                            <div
                              key={numStr}
                              onClick={() => openNumberDetailsModal('CROSS', numStr)}
                              className={`p-2.5 rounded-xl text-center font-mono border transition-all cursor-pointer hover:scale-[1.03] active:scale-95 ${
                                isWinner
                                  ? 'bg-gradient-to-br from-[#2ECC71] to-[#1E8449] text-white font-bold border-emerald-400 shadow-md ring-2 ring-emerald-400/30'
                                  : (amt > 0
                                      ? 'bg-gradient-to-br from-[#F39C12] to-[#D35400] text-white font-bold border-orange-500/30 shadow-sm'
                                      : 'bg-slate-100 text-slate-700 border-slate-200')
                              }`}
                              title="Click to view bidders breakdown for this number"
                            >
                              <div className="text-xs font-bold">{numStr} Rs = {amt}</div>
                              <div className={`text-[10px] font-bold mt-1 px-1 py-0.5 rounded ${isWinner || amt > 0 ? 'bg-black/20 text-yellow-200' : 'bg-slate-200 text-slate-500'}`}>
                                {activeRate}x = Rs. {payout}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5 font-bold text-xs mt-4">
                      <div className="flex justify-between text-gray-700">
                        <span>Total Cross Beted</span>
                        <span className="font-mono text-slate-900">Rs. {bd.crossTotal}</span>
                      </div>
                      <div className="flex justify-between text-[#28A745]">
                        <span>Cross Winning Amount Total ({settingsForm.crossing_rate || 90}x Payout)</span>
                        <span className="font-mono text-base">Rs. {bd.crossWinTotal}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. HAROOP GAME SECTION */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-[#212529] text-sm flex items-center gap-2">
                        <span className="w-2 h-4 bg-amber-500 rounded-full inline-block"></span>
                        Haroop Game (Ander / Bahar) {breakdownSortMode === 'descending' && <span className="text-xs text-orange-600 font-extrabold">(Sorted: Highest Bidded First)</span>}
                      </h4>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{settingsForm.haroof_rate || 9.5}x Multiplier</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* INNER (AHEDR) */}
                      <div className="space-y-2">
                        <div className="bg-amber-50 text-amber-900 p-2 font-black text-center rounded-lg border border-amber-200 text-xs">
                          Inner (Ahedr)
                        </div>
                        {(() => {
                          const digits = Array.from({ length: 10 }, (_, i) => `A${i}`);
                          if (breakdownSortMode === 'descending') {
                            digits.sort((a, b) => (bd.haroofAnderMap[b] || 0) - (bd.haroofAnderMap[a] || 0));
                          }
                          return digits.map((digitKey) => {
                            const amt = bd.haroofAnderMap[digitKey] || 0;
                            const isWin = bd.winningAnderDigit !== null && digitKey === bd.winningAnderDigit;
                            return (
                              <div
                                key={digitKey}
                                onClick={() => openNumberDetailsModal('HAROOF_A', digitKey)}
                                className={`flex justify-between items-center p-2.5 rounded-lg font-bold text-xs transition-all border cursor-pointer hover:scale-[1.02] active:scale-95 ${
                                  isWin
                                    ? 'bg-gradient-to-r from-[#2ECC71] to-[#1E8449] text-white border-emerald-400 shadow-md ring-2 ring-emerald-400/30'
                                    : (amt > 0 ? 'bg-gradient-to-r from-[#F39C12] to-[#E67E22] text-white border-orange-500/30' : 'bg-gray-50 text-gray-700 border-gray-200')
                                }`}
                                title="Click to view bidders breakdown"
                              >
                                <span className="font-mono text-sm">{digitKey}</span>
                                <span className="font-mono">Rs = {amt}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* OUTER (BAHAR) */}
                      <div className="space-y-2">
                        <div className="bg-amber-50 text-amber-900 p-2 font-black text-center rounded-lg border border-amber-200 text-xs">
                          Outer (Bahar)
                        </div>
                        {(() => {
                          const digits = Array.from({ length: 10 }, (_, i) => `B${i}`);
                          if (breakdownSortMode === 'descending') {
                            digits.sort((a, b) => (bd.haroofBaharMap[b] || 0) - (bd.haroofBaharMap[a] || 0));
                          }
                          return digits.map((digitKey) => {
                            const amt = bd.haroofBaharMap[digitKey] || 0;
                            const isWin = bd.winningBaharDigit !== null && digitKey === bd.winningBaharDigit;
                            return (
                              <div
                                key={digitKey}
                                onClick={() => openNumberDetailsModal('HAROOF_B', digitKey)}
                                className={`flex justify-between items-center p-2.5 rounded-lg font-bold text-xs transition-all border cursor-pointer hover:scale-[1.02] active:scale-95 ${
                                  isWin
                                    ? 'bg-gradient-to-r from-[#2ECC71] to-[#1E8449] text-white border-emerald-400 shadow-md ring-2 ring-emerald-400/30'
                                    : (amt > 0 ? 'bg-gradient-to-r from-[#F39C12] to-[#E67E22] text-white border-orange-500/30' : 'bg-gray-50 text-gray-700 border-gray-200')
                                }`}
                                title="Click to view bidders breakdown"
                              >
                                <span className="font-mono text-sm">{digitKey}</span>
                                <span className="font-mono">Rs = {amt}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5 font-bold text-xs mt-4">
                      <div className="flex justify-between text-gray-700">
                        <span>Total Haroof Beted</span>
                        <span className="font-mono text-slate-900">Rs. {bd.haroofTotal}</span>
                      </div>
                      <div className="flex justify-between text-[#28A745]">
                        <span>Haroof Winning Amount Total ({settingsForm.haroof_rate || 9.5}x Payout)</span>
                        <span className="font-mono text-base">Rs. {bd.haroofWinTotal}</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. AMOUNT HISTORY BOX */}
                  <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 text-xs font-bold border border-slate-800 shadow-xl">
                    <h5 className="text-slate-400 uppercase tracking-widest text-[10px] font-black">Market Summary & Payable Payout</h5>
                    <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                      <span className="text-slate-300">Total Investment (Stakes)</span>
                      <span className="font-mono text-white text-base font-black">Rs. {bd.totalInvestment}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-400">
                      <span>Total Winning Amount (Payable Payout)</span>
                      <span className="font-mono text-lg font-black">Rs. {bd.totalWinningAmount}</span>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SUB-MODAL: SPECIFIC NUMBER BIDDERS BREAKDOWN */}
      {selectedNumberDetailsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-xl p-5 w-full max-w-lg space-y-4 shadow-2xl border border-gray-200 text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                  <span>🎯</span>
                  <span>{selectedNumberDetailsModal.category} - {selectedNumberDetailsModal.sectionTitle} #{selectedNumberDetailsModal.numberLabel}</span>
                </h3>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">Bidders breakdown for number <span className="font-bold text-black">{selectedNumberDetailsModal.numberLabel}</span></p>
              </div>
              <button
                onClick={() => setSelectedNumberDetailsModal(null)}
                className="text-gray-400 hover:text-black font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200/80 p-3.5 rounded-xl flex justify-between items-center text-xs font-bold text-slate-800 shadow-sm">
              <div>
                <span className="text-gray-600 block text-[10px] uppercase font-extrabold">Total Amount Bidded</span>
                <span className="font-mono text-base font-black text-orange-600">₹{selectedNumberDetailsModal.totalAmount.toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-600 block text-[10px] uppercase font-extrabold">Total Bids Placed</span>
                <span className="bg-orange-600 text-white font-mono font-black px-3 py-1 rounded-full text-xs inline-block mt-0.5">{selectedNumberDetailsModal.bids.length} Bid(s)</span>
              </div>
            </div>

            {selectedNumberDetailsModal.bids.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs font-semibold bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-1">
                <div className="text-2xl">📭</div>
                <div>No user bids found for number {selectedNumberDetailsModal.numberLabel} in this cycle.</div>
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs">
                {selectedNumberDetailsModal.bids.map((b: any, idx: number) => {
                  const uName = b.userName || b.user_name || (b.user && b.user.split('(')[0].trim()) || 'User';
                  const uPhone = b.phone || b.mobile || (b.user && b.user.includes('(') ? b.user.split('(')[1].replace(')', '') : '');
                  const bAmt = parseFloat(b.amount || b.bet_amount) || 0;
                  const bTime = b.rawDate || b.date || (b.created_at ? new Date(b.created_at).toLocaleString() : '');

                  return (
                    <div key={b.id || idx} className="p-3.5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div className="space-y-1">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">#{idx + 1}</span>
                          <span className="text-sm font-black text-slate-800">{uName}</span>
                          {uPhone && <span className="text-xs text-gray-500 font-mono font-semibold">({uPhone})</span>}
                        </div>
                        {bTime && <div className="text-[10px] text-gray-400 font-mono">🕒 {bTime}</div>}
                      </div>
                      <div className="text-right space-y-0.5">
                        <div className="font-black text-sm text-emerald-600 font-mono">₹{bAmt.toLocaleString()}</div>
                        <div className="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-600 inline-block border">
                          {b.status || 'Pending'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedNumberDetailsModal(null)}
                className="bg-slate-800 hover:bg-black text-white px-6 py-2 rounded-lg font-bold text-xs shadow transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
