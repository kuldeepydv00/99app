import { useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { gamesGet, gamesPost } from './api';
import { NvModal, PlayButton, Segmented } from './kit';

type Fair = {
  current: { serverHash: string; clientSeed: string; nonce: number };
  previous: { serverSeed: string; serverHash: string; clientSeed: string; nonces: number; endedAt: string }[];
  howItWorks: string[];
};

function Mono({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold text-nv-text">{label}</p>
      <div className="flex items-center gap-2 rounded-md bg-nv-input px-3 py-2 ring-1 ring-nv-edge">
        <span className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-white">{value}</span>
        <button aria-label={`Copy ${label}`} className="nv-tap shrink-0 text-nv-mute hover:text-white"
          onClick={() => { try { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ } }}>
          {copied ? <span className="text-[11px] font-semibold text-nv-green">Copied</span> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** Seeds for Dice and Mines: see the hashed server seed, change the client seed, check past bets. */
export default function FairnessModal({ open, onClose, mobile, game }: { open: boolean; onClose: () => void; mobile: string; game: 'dice' | 'mines' }) {
  const [tab, setTab] = useState<'seeds' | 'verify'>('seeds');
  const [fair, setFair] = useState<Fair | null>(null);
  const [client, setClient] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({ serverSeed: '', clientSeed: '', nonce: '0', mines: '3' });
  const [vOut, setVOut] = useState<{ serverHash: string; roll?: number; minesAt?: number[] } | null>(null);

  useEffect(() => {
    if (!open || !mobile) return;
    setMsg(''); setVOut(null);
    gamesGet<Fair>(`/api/games/fairness?mobile=${mobile}`).then(d => { setFair(d); setClient(d.current.clientSeed); }).catch(e => setMsg(e.message));
  }, [open, mobile]);

  const rotate = async () => {
    setBusy(true); setMsg('');
    try {
      const d = await gamesPost<Fair>('/api/games/fairness/rotate', { mobile, clientSeed: client });
      setFair(d); setClient(d.current.clientSeed);
      setMsg('New seeds are in use. Your old server seed is shown below.');
    } catch (e: any) { setMsg(e.message || 'Could not change seeds'); }
    setBusy(false);
  };

  const verify = async () => {
    setBusy(true); setMsg(''); setVOut(null);
    try { setVOut(await gamesPost('/api/games/fairness/verify', { ...v, game })); }
    catch (e: any) { setMsg(e.message || 'Could not check'); }
    setBusy(false);
  };

  const input = 'h-10 w-full rounded-md bg-nv-input px-3 font-mono text-[12.5px] text-white ring-1 ring-nv-edge focus:outline-none focus:ring-nv-blue2';
  return (
    <NvModal open={open} onClose={onClose} title="Fairness" wide>
      <Segmented options={[{ value: 'seeds', label: 'Seeds' }, { value: 'verify', label: 'Verify' }]} value={tab} onChange={setTab} />
      <div className="mt-4 space-y-3">
        {tab === 'seeds' && (
          fair ? (
            <>
              <Mono label="Active server seed (hashed)" value={fair.current.serverHash} />
              <div>
                <p className="mb-1 text-[12px] font-semibold text-nv-text">Active client seed</p>
                <input value={client} onChange={e => setClient(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64))} className={input} />
              </div>
              <p className="text-[12px] text-nv-mute">Total bets with this pair: <b className="text-white">{fair.current.nonce}</b></p>
              <PlayButton tone="grey" onClick={rotate} busy={busy}><RefreshCw className="mr-2 h-4 w-4" />Change seeds</PlayButton>
              {fair.previous[0] && (
                <div className="space-y-2 rounded-md bg-nv-input/50 p-3 ring-1 ring-nv-edge">
                  <p className="text-[12px] font-semibold text-white">Previous seeds ({fair.previous[0].nonces} bets)</p>
                  <Mono label="Server seed (revealed)" value={fair.previous[0].serverSeed} />
                  <Mono label="Client seed" value={fair.previous[0].clientSeed} />
                </div>
              )}
              <ul className="space-y-1.5 text-[12px] leading-relaxed text-nv-mute">
                {fair.howItWorks.map((l, i) => <li key={i}>• {l}</li>)}
              </ul>
            </>
          ) : <p className="py-6 text-center text-[13px] text-nv-mute">{msg || 'Loading…'}</p>
        )}
        {tab === 'verify' && (
          <>
            <input placeholder="Server seed (revealed)" value={v.serverSeed} onChange={e => setV({ ...v, serverSeed: e.target.value.trim() })} className={input} />
            <input placeholder="Client seed" value={v.clientSeed} onChange={e => setV({ ...v, clientSeed: e.target.value.trim() })} className={input} />
            <div className="flex gap-2">
              <input placeholder="Nonce" inputMode="numeric" value={v.nonce} onChange={e => setV({ ...v, nonce: e.target.value.replace(/[^0-9]/g, '') })} className={input} />
              {game === 'mines' && <input placeholder="Mines" inputMode="numeric" value={v.mines} onChange={e => setV({ ...v, mines: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} className={input} />}
            </div>
            <PlayButton onClick={verify} busy={busy}>Check result</PlayButton>
            {vOut && (
              <div className="space-y-2 rounded-md bg-nv-input/50 p-3 ring-1 ring-nv-edge">
                <Mono label="Hash of this server seed" value={vOut.serverHash} />
                {vOut.roll !== undefined && <p className="text-[13px] text-nv-text">Roll: <b className="text-[18px] text-white">{vOut.roll.toFixed(2)}</b></p>}
                {vOut.minesAt && <p className="text-[13px] text-nv-text">Mines on tiles: <b className="text-white">{vOut.minesAt.map(t => t + 1).join(', ')}</b> (1 = top left)</p>}
              </div>
            )}
          </>
        )}
        {msg && tab === 'seeds' && fair && <p className="text-center text-[12px] font-semibold text-nv-text">{msg}</p>}
        {msg && tab === 'verify' && <p className="text-center text-[12px] font-semibold text-nv-red">{msg}</p>}
      </div>
    </NvModal>
  );
}
