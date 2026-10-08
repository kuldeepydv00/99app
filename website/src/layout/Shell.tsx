import type { ComponentType, ReactNode } from 'react';
import {
  LayoutGrid, Sparkles, Crown, Gem, Plane, Flame, Coins, Palette, Hash, Spade,
  ReceiptText, ChartColumn, Wallet, ArrowDownToLine, ArrowUpFromLine, Bell,
  Gift, BookOpen, Headphones, Smartphone, LogOut, Menu, X, UserRound, Plus,
  House, MessageCircle, ShieldCheck, Zap, PanelLeftClose, Dices, Bomb
} from 'lucide-react';
import type { TradingGame } from '../games/api';

// Casino layout: desktop sidebar, top bar, mobile bottom bar, mobile menu and footer.
// Every action comes from App, so these pieces only draw the layout.

export type HomeSection = null | 'originals' | 'matka' | 'matka99';
export type WebTab = 'home' | 'mybets' | 'charts' | 'referral';

export type ShellActions = {
  home: () => void;
  section: (s: Exclude<HomeSection, null>) => void;
  jet: () => void;
  instant: (g: 'dice' | 'mines') => void;
  trading: (g: TradingGame) => void;
  myBets: () => void;
  charts: () => void;
  wallet: () => void;
  deposit: () => void;
  withdraw: () => void;
  refer: () => void;
  rules: () => void;
  profile: () => void;
  notifications: () => void;
  download: () => void;
  logout: () => void;
  supportUrl: string;
};

const CROWN_PATH = 'M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z';

export const money = (n: number | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label="99xmatka home" className="nv-tap flex shrink-0 items-center gap-1.5">
      <svg className="h-7 w-7 shrink-0 fill-nv-gold drop-shadow-[0_0_6px_rgba(242,193,78,0.45)]" viewBox="0 0 24 24" aria-hidden="true">
        <path d={CROWN_PATH} />
      </svg>
      <span className="flex flex-col items-start leading-none">
        <span className="text-[17px] font-bold tracking-tight"><span className="text-nv-gold">99x</span><span className="text-white">MATKA</span></span>
        <span className="mt-1 hidden text-[7.5px] font-semibold tracking-[0.24em] text-nv-mute min-[400px]:block">TRUST • FAST • WIN</span>
      </span>
    </button>
  );
}

type Item = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  tone?: string;
};

function NavItem({ it, collapsed, after }: { it: Item; collapsed: boolean; after?: () => void }) {
  const Icon = it.icon;
  const cls = `nv-tap group flex w-full items-center gap-3 rounded-md py-2.5 text-[13.5px] font-semibold transition-colors ${
    collapsed ? 'justify-center px-0' : 'px-3'
  } ${it.active ? 'bg-nv-card2 text-white' : 'text-nv-text hover:bg-nv-card2 hover:text-white'}`;
  const inner = (
    <>
      <Icon className={`h-[18px] w-[18px] shrink-0 ${it.active ? 'text-white' : it.tone || 'text-nv-mute group-hover:text-white'}`} strokeWidth={2.2} />
      {!collapsed && <span className="truncate">{it.label}</span>}
    </>
  );
  if (it.href) {
    return (
      <a href={it.href} target="_blank" rel="noreferrer" title={collapsed ? it.label : undefined} onClick={after} className={cls}>{inner}</a>
    );
  }
  return (
    <button onClick={() => { it.onClick?.(); after?.(); }} title={collapsed ? it.label : undefined} className={cls}>{inner}</button>
  );
}

function Group({ items, collapsed, after }: { items: Item[]; collapsed: boolean; after?: () => void }) {
  return (
    <div className="space-y-0.5 rounded-lg bg-nv-card/80 p-1.5">
      {items.map(it => <NavItem key={it.key} it={it} collapsed={collapsed} after={after} />)}
    </div>
  );
}

/** Two big buttons at the top of the menu, like a casino's Casino / Sports switch. */
function FeatureButtons({ a, section, tab, after }: { a: ShellActions; section: HomeSection; tab: WebTab; after?: () => void }) {
  const btn = (key: 'originals' | 'matka', label: string, Icon: ComponentType<{ className?: string }>, bg: string) => {
    const on = tab === 'home' && section === key;
    return (
      <button key={key} onClick={() => { a.section(key); after?.(); }}
        className={`nv-tap relative flex h-10 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-md text-[12px] font-bold uppercase tracking-wide text-white shadow-md ring-1 transition ${on ? 'ring-white/70' : 'ring-white/10 hover:brightness-110'}`}
        style={{ background: bg }}>
        <Icon className="hidden h-4 w-4 opacity-90 min-[330px]:block lg:hidden" />
        <span className="drop-shadow">{label}</span>
      </button>
    );
  };
  return (
    <div className="flex flex-1 gap-2">
      {btn('originals', 'Originals', Sparkles, 'linear-gradient(135deg, #2B7FF5 0%, #1458C4 60%, #0D3B8A 100%)')}
      {btn('matka', 'Matka', Crown, 'linear-gradient(135deg, #1FBF73 0%, #0E8A50 60%, #075C36 100%)')}
    </div>
  );
}

function navGroups(a: ShellActions, tab: WebTab, section: HomeSection): Item[][] {
  const home = tab === 'home';
  return [
    [
      { key: 'lobby', label: 'Lobby', icon: LayoutGrid, onClick: a.home, active: home && !section },
      { key: 'originals', label: '99x Originals', icon: Sparkles, onClick: () => a.section('originals'), active: home && section === 'originals' },
      { key: 'matka', label: 'Matka', icon: Crown, onClick: () => a.section('matka'), active: home && section === 'matka' },
      { key: 'matka99', label: '99x Matka', icon: Gem, onClick: () => a.section('matka99'), active: home && section === 'matka99' }
    ],
    [
      { key: 'jet', label: '99x Jet', icon: Plane, onClick: a.jet },
      { key: 'mines', label: 'Mines', icon: Bomb, onClick: () => a.instant('mines') },
      { key: 'dice', label: 'Dice', icon: Dices, onClick: () => a.instant('dice') },
      { key: 'dragontiger', label: 'Dragon Tiger', icon: Flame, onClick: () => a.trading('dragontiger') },
      { key: 'toss', label: 'Toss', icon: Coins, onClick: () => a.trading('toss') },
      { key: 'colour', label: 'Colour Trading', icon: Palette, onClick: () => a.trading('colour') },
      { key: 'number', label: 'Number Trading', icon: Hash, onClick: () => a.trading('number') },
      { key: 'card', label: 'Card Trading', icon: Spade, onClick: () => a.trading('card') }
    ],
    [
      { key: 'mybets', label: 'My Bets', icon: ReceiptText, onClick: a.myBets, active: tab === 'mybets' },
      { key: 'charts', label: 'Charts & Results', icon: ChartColumn, onClick: a.charts, active: tab === 'charts' },
      { key: 'wallet', label: 'Wallet', icon: Wallet, onClick: a.wallet },
      { key: 'deposit', label: 'Deposit', icon: ArrowDownToLine, onClick: a.deposit, tone: 'text-nv-green' },
      { key: 'withdraw', label: 'Withdraw', icon: ArrowUpFromLine, onClick: a.withdraw },
      { key: 'notifications', label: 'Notifications', icon: Bell, onClick: a.notifications }
    ],
    [
      { key: 'refer', label: 'Refer & Earn', icon: Gift, onClick: a.refer, tone: 'text-nv-gold' },
      { key: 'rules', label: 'Rules & Rates', icon: BookOpen, onClick: a.rules },
      { key: 'support', label: 'Live Support', icon: Headphones, href: a.supportUrl },
      { key: 'download', label: 'Download App', icon: Smartphone, onClick: a.download }
    ]
  ];
}

/** Desktop sidebar (lg and up). Collapses to icons. */
export function SideRail({ a, tab, section, collapsed, onToggle }: {
  a: ShellActions; tab: WebTab; section: HomeSection; collapsed: boolean; onToggle: () => void;
}) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-black/30 bg-nv-side shadow-[4px_0_16px_rgba(0,0,0,0.25)] transition-[width] duration-200 lg:flex ${collapsed ? 'w-[68px]' : 'w-60'}`}>
      <div className={`flex h-16 shrink-0 items-center gap-2 ${collapsed ? 'justify-center px-2' : 'px-3'}`}>
        <button onClick={onToggle} aria-label={collapsed ? 'Open menu' : 'Close menu'}
          className="nv-tap flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-nv-text transition-colors hover:bg-nv-card2 hover:text-white">
          {collapsed ? <Menu className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
        {!collapsed && <FeatureButtons a={a} section={section} tab={tab} />}
      </div>
      <nav className="nv-noscroll flex-1 space-y-2.5 overflow-y-auto px-2.5 pb-4 pt-1">
        {navGroups(a, tab, section).map((g, i) => <Group key={i} items={g} collapsed={collapsed} />)}
        <Group collapsed={collapsed} items={[{ key: 'logout', label: 'Logout', icon: LogOut, onClick: a.logout, tone: 'text-nv-red' }]} />
      </nav>
    </aside>
  );
}

/** Slide-out menu for phones and tablets. */
export function MobileMenu({ a, tab, section, onClose, name, mobile, balance }: {
  a: ShellActions; tab: WebTab; section: HomeSection; onClose: () => void; name?: string; mobile?: string; balance: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div className="nv-fade absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="nv-drawer relative flex h-full w-[300px] max-w-[86vw] flex-col bg-nv-side shadow-2xl">
        <div className="flex items-center gap-3 border-b border-nv-line/60 px-4 py-4">
          <button onClick={() => { a.profile(); onClose(); }} className="nv-tap flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nv-blue2 to-[#0E3F8F] text-base font-bold text-white">
              {(name || 'P').trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{name || 'Player'}</span>
              <span className="block text-[11px] text-nv-mute">+91 {mobile || '—'}</span>
              <span className="mt-0.5 block text-[12px] font-semibold tabular-nums text-nv-green">{money(balance)}</span>
            </span>
          </button>
          <button onClick={onClose} aria-label="Close menu"
            className="nv-tap flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-nv-card text-nv-text hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="nv-noscroll flex-1 space-y-2.5 overflow-y-auto p-3">
          <FeatureButtons a={a} section={section} tab={tab} after={onClose} />
          {navGroups(a, tab, section).map((g, i) => <Group key={i} items={g} collapsed={false} after={onClose} />)}
          <Group collapsed={false} after={onClose} items={[{ key: 'logout', label: 'Logout', icon: LogOut, onClick: a.logout, tone: 'text-nv-red' }]} />
        </nav>
        <p className="border-t border-nv-line/60 px-4 py-3 text-center text-[10.5px] text-nv-dim">99xmatka v2.4 · 18+ · Play responsibly</p>
      </div>
    </div>
  );
}

/** Sticky top bar: logo, wallet with Deposit, notifications and profile. */
export function TopBar({ a, balance, unread }: { a: ShellActions; balance: number; unread: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/30 bg-nv-side/95 shadow-[0_4px_14px_rgba(0,0,0,0.3)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-3 sm:px-6 lg:h-16">
        <Logo onClick={a.home} />
        <div className="flex min-w-0 flex-1 justify-end sm:justify-center">
          <div className="flex min-w-0 items-stretch overflow-hidden rounded-md bg-nv-bg ring-1 ring-nv-line/70">
            <button onClick={a.wallet} aria-label="Wallet"
              className="nv-tap flex min-w-0 items-center gap-1.5 px-2.5 text-[13px] font-semibold tabular-nums text-white transition-colors hover:bg-nv-card sm:px-3.5 sm:text-sm">
              <Wallet className="hidden h-4 w-4 shrink-0 text-nv-mute sm:block" />
              <span className="truncate">{money(balance)}</span>
            </button>
            <button onClick={a.deposit}
              className="nv-tap flex h-9 shrink-0 items-center gap-1 bg-nv-blue px-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-nv-blue2 sm:h-10 sm:px-4 sm:text-sm">
              <Plus className="h-4 w-4 sm:hidden" strokeWidth={2.6} />
              <span className="hidden sm:inline">Deposit</span>
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={a.notifications} aria-label="Notifications"
            className="nv-tap relative hidden h-10 w-10 items-center justify-center rounded-md text-nv-text transition-colors hover:bg-nv-card2 hover:text-white sm:flex">
            <Bell className="h-[19px] w-[19px]" />
            {unread && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-nv-red ring-2 ring-nv-side" />}
          </button>
          <button onClick={a.profile} aria-label="Profile"
            className="nv-tap flex h-9 w-9 items-center justify-center rounded-md text-nv-text transition-colors hover:bg-nv-card2 hover:text-white sm:h-10 sm:w-10">
            <UserRound className="h-[19px] w-[19px]" />
          </button>
        </div>
      </div>
    </header>
  );
}

/** Phone / tablet bottom bar. */
export function BottomBar({ a, tab, onMenu, menuOpen }: { a: ShellActions; tab: WebTab; onMenu: () => void; menuOpen: boolean }) {
  const item = (key: string, label: string, Icon: ComponentType<{ className?: string; strokeWidth?: number }>, on: boolean, onClick?: () => void, href?: string) => {
    const cls = `nv-tap flex flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-semibold transition-colors ${on ? 'text-white' : 'text-nv-mute hover:text-white'}`;
    const body: ReactNode = (
      <>
        <Icon className={`h-5 w-5 ${on ? 'text-nv-blue2' : ''}`} strokeWidth={on ? 2.4 : 2} />
        <span>{label}</span>
      </>
    );
    return href
      ? <a key={key} href={href} target="_blank" rel="noreferrer" className={cls}>{body}</a>
      : <button key={key} onClick={onClick} className={cls}>{body}</button>;
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/40 bg-nv-side/95 shadow-[0_-6px_18px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto grid h-[60px] max-w-xl grid-cols-5">
        {item('menu', 'Menu', Menu, menuOpen, onMenu)}
        {item('home', 'Casino', House, tab === 'home' && !menuOpen, a.home)}
        {item('bets', 'My Bets', ReceiptText, tab === 'mybets' && !menuOpen, a.myBets)}
        {item('charts', 'Charts', ChartColumn, tab === 'charts' && !menuOpen, a.charts)}
        {item('chat', 'Chat', MessageCircle, false, undefined, a.supportUrl)}
      </div>
    </nav>
  );
}

/** Site footer: trust points, links, responsible play note. */
export function SiteFooter({ a }: { a: ShellActions }) {
  const link = 'text-left text-[13px] text-nv-mute transition-colors hover:text-white';
  return (
    <footer className="mt-10 border-t border-black/30 bg-nv-side/60">
      <div className="mx-auto max-w-[1200px] px-4 pb-28 pt-8 sm:px-6 lg:pb-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          <div className="col-span-2">
            <Logo onClick={a.home} />
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-nv-mute">
              Matka markets and 99x Originals in one place. Fast results, a secure wallet and support round the clock.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[{ i: ShieldCheck, t: '100% Secure' }, { i: Zap, t: 'Instant results' }, { i: Headphones, t: '24x7 support' }].map(({ i: I, t }) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-md bg-nv-card px-2.5 py-1.5 text-[12px] font-medium text-nv-text">
                  <I className="h-3.5 w-3.5 text-nv-green" />{t}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-[13px] font-semibold text-white">Games</p>
            <div className="flex flex-col gap-2">
              <button className={link} onClick={() => a.section('matka')}>Matka</button>
              <button className={link} onClick={() => a.section('matka99')}>99x Matka</button>
              <button className={link} onClick={a.jet}>99x Jet</button>
              <button className={link} onClick={() => a.instant('mines')}>Mines</button>
              <button className={link} onClick={() => a.instant('dice')}>Dice</button>
              <button className={link} onClick={() => a.trading('dragontiger')}>Dragon Tiger</button>
              <button className={link} onClick={() => a.section('originals')}>All Originals</button>
            </div>
          </div>
          <div>
            <p className="mb-3 text-[13px] font-semibold text-white">Help</p>
            <div className="flex flex-col gap-2">
              <button className={link} onClick={a.rules}>Rules & Rates</button>
              <a className={link} href={a.supportUrl} target="_blank" rel="noreferrer">Live Support</a>
              <button className={link} onClick={a.refer}>Refer & Earn</button>
              <button className={link} onClick={a.download}>Download App</button>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-nv-line/50 pt-5 text-[12px] text-nv-dim sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <span className="rounded border border-nv-dim px-1 text-[10px] font-bold text-nv-mute">18+</span>
            Play responsibly. Only bet what you can afford to lose.
          </span>
          <span>© {new Date().getFullYear()} 99xmatka</span>
        </div>
      </div>
    </footer>
  );
}
