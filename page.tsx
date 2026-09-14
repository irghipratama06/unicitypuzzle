'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS, type Board, type Difficulty, canMove, maxTile, move, newGame } from '../lib/game';

const UCT_DECIMALS = 18;
const UCT_COIN_ID = 'f581d30f593e4b369d684a4563b5246f07b1d265f7178a2c0a82b81f39c24dc0';
const TREASURY = process.env.NEXT_PUBLIC_GAME_RECIPIENT || '';
const SESSION_KEY = 'sphere-puzzle-session';

type SphereClient = any;

function toBaseUnits(uct: number) {
  return (BigInt(Math.round(uct * 1_000_000)) * 1000000000000n).toString();
}

function formatBalance(value: unknown): string {
  if (Array.isArray(value)) {
    const item = value.find((x: any) => x?.coinId === UCT_COIN_ID || x?.symbol === 'UCT') || value[0];
    const raw = item?.balance ?? item?.amount ?? item?.totalAmount ?? 0;
    const n = typeof raw === 'bigint' ? Number(raw) / 1e18 : Number(raw) / 1e18;
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
  }
  return '0';
}

export default function Home() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [board, setBoard] = useState<Board>(newGame());
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(LEVELS.easy.moves);
  const [won, setWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [deposit, setDeposit] = useState('5');
  const [credit, setCredit] = useState(0);
  const [wallet, setWallet] = useState<{ address?: string; nametag?: string } | null>(null);
  const [balance, setBalance] = useState('0');
  const [status, setStatus] = useState('Connect Sphere wallet to start.');
  const [busy, setBusy] = useState(false);
  const clientRef = useRef<SphereClient>(null);
  const disconnectRef = useRef<(() => Promise<void>) | null>(null);

  const level = LEVELS[difficulty];
  const treasuryConfigured = Boolean(TREASURY);
  const displayName = wallet?.nametag ? `@${wallet.nametag.replace(/^@/, '')}` : wallet?.address || 'Not connected';

  async function refreshBalance(client: SphereClient) {
    try {
      const result = await client.query('sphere_getBalance', { coinId: UCT_COIN_ID });
      setBalance(formatBalance(result));
    } catch {
      setBalance('—');
    }
  }

  async function connect() {
    setBusy(true);
    setStatus('Opening Sphere Connect…');
    try {
      const { autoConnect } = await import('@unicitylabs/sphere-sdk/connect/browser');
      const { SPHERE_NETWORKS } = await import('@unicitylabs/sphere-sdk/connect');
      const result = await autoConnect({
        dapp: { name: process.env.NEXT_PUBLIC_GAME_NAME || 'Sphere Puzzle', url: window.location.origin },
        walletUrl: 'https://sphere.unicity.network',
        network: SPHERE_NETWORKS.testnet2,
        permissions: ['identity:read', 'balance:read', 'transfer:request'],
        resumeSessionId: sessionStorage.getItem(SESSION_KEY) || undefined,
        silent: false,
      });
      clientRef.current = result.client;
      disconnectRef.current = result.disconnect;
      sessionStorage.setItem(SESSION_KEY, result.connection.sessionId);
      setWallet({ address: result.connection.identity?.directAddress, nametag: result.connection.identity?.nametag });
      result.client.on('wallet:locked', () => setStatus('Wallet locked — unlock it to continue.'));
      result.client.on('wallet:unlocked', ({ identity }: any) => {
        setWallet({ address: identity?.directAddress, nametag: identity?.nametag });
        setStatus('Wallet unlocked.');
        refreshBalance(result.client);
      });
      result.client.on('wallet:disconnected', () => {
        clientRef.current = null;
        setWallet(null);
        setStatus('Wallet disconnected.');
      });
      await refreshBalance(result.client);
      setStatus('Wallet connected. Choose a level and deposit.');
    } catch (error: any) {
      const code = error?.code;
      setStatus(code === 4008 ? 'Wrong network: switch Sphere to Unicity testnet2.' : (error?.message || 'Connection rejected.'));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    try { await disconnectRef.current?.(); } catch { /* wallet already gone */ }
    sessionStorage.removeItem(SESSION_KEY);
    clientRef.current = null;
    disconnectRef.current = null;
    setWallet(null);
    setStatus('Disconnected.');
  }

  async function depositUCT() {
    const amount = Number(deposit);
    if (!clientRef.current) return setStatus('Connect Sphere wallet first.');
    if (!treasuryConfigured) return setStatus('Treasury is not configured. Set NEXT_PUBLIC_GAME_RECIPIENT in Vercel.');
    if (!Number.isFinite(amount) || amount < level.fee) return setStatus(`Deposit must be at least ${level.fee} UCT for ${level.label}.`);
    setBusy(true);
    setStatus(`Confirm ${amount} UCT in Sphere…`);
    try {
      const result = await clientRef.current.intent('send', {
        to: TREASURY,
        amount: toBaseUnits(amount),
        coinId: UCT_COIN_ID,
        memo: `Sphere Puzzle ${level.label} deposit`,
      });
      setCredit(amount);
      setStatus(result?.deliveryPending ? 'Deposit certified; delivery is pending. Credit recorded for this session.' : `Deposit confirmed: ${amount} UCT.`);
      await refreshBalance(clientRef.current);
    } catch (error: any) {
      if (error?.code === 4201) setStatus('Transfer outcome unknown. Do not retry automatically; reconcile in the wallet first.');
      else if (error?.code === 4003 || error?.code === 4200) setStatus('Transfer rejected by user.');
      else setStatus(error?.message || 'Deposit failed.');
    } finally { setBusy(false); }
  }

  function resetGame(nextDifficulty = difficulty) {
    setDifficulty(nextDifficulty);
    setBoard(newGame());
    setScore(0);
    setMovesLeft(LEVELS[nextDifficulty].moves);
    setWon(false);
    setGameOver(false);
    setStatus(`Ready for ${LEVELS[nextDifficulty].label}.`);
  }

  function startGame() {
    if (!wallet) return setStatus('Connect Sphere wallet first.');
    if (credit < level.fee) return setStatus(`Deposit at least ${level.fee} UCT before playing.`);
    setCredit((v) => v - level.fee);
    setBoard(newGame());
    setScore(0);
    setMovesLeft(level.moves);
    setWon(false);
    setGameOver(false);
    setStatus(`${level.label} started — entry ${level.fee} UCT.`);
  }

  function handleMove(direction: 'left' | 'right' | 'up' | 'down') {
    if (gameOver || won || movesLeft <= 0) return;
    const result = move(board, direction);
    if (!result.moved) {
      if (!canMove(board)) setGameOver(true);
      return;
    }
    const nextMoves = movesLeft - 1;
    setBoard(result.board);
    setScore((s) => s + result.score);
    setMovesLeft(nextMoves);
    if (maxTile(result.board) >= level.target) { setWon(true); setStatus(`You cleared ${level.label}!`); }
    else if (nextMoves <= 0 || !canMove(result.board)) { setGameOver(true); setStatus('No more moves. Try again.'); }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); handleMove(dir); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tiles = useMemo(() => board.map((v, i) => <div key={i} className={`tile tile-${v || 'empty'}`}>{v || ''}</div>), [board]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Image src="/game-logo.jpeg" alt="Sphere Puzzle logo" width={64} height={64} priority /><div><span>SPHERE</span><strong>PUZZLE</strong></div></div>
        <div className="walletBox">
          {wallet ? <><span className="dot" /> <span title={displayName}>{displayName}</span><b>{balance} UCT</b><button onClick={disconnect}>Disconnect</button></> : <button className="connect" onClick={connect} disabled={busy}>{busy ? 'Connecting…' : 'Connect Sphere Wallet'}</button>}
        </div>
      </header>

      <section className="hero">
        <div><p className="eyebrow">UNICITY TESTNET2 · UCT</p><h1>Slide. Merge. <em>Win.</em></h1><p className="sub">A fast 2048-style puzzle powered by Sphere Connect. Every player connects a Sphere wallet before depositing UCT.</p></div>
        <div className="stats"><div><small>SCORE</small><b>{score.toLocaleString()}</b></div><div><small>MOVES</small><b>{movesLeft}</b></div><div><small>CREDIT</small><b>{credit} UCT</b></div></div>
      </section>

      <section className="content">
        <aside className="panel">
          <h2>Choose level</h2>
          <div className="levels">{(Object.keys(LEVELS) as Difficulty[]).map((d) => <button key={d} className={d === difficulty ? 'selected' : ''} onClick={() => resetGame(d)}><span>{LEVELS[d].label}</span><b>{LEVELS[d].fee} UCT</b><small>target {LEVELS[d].target.toLocaleString()}</small></button>)}</div>
          <div className="deposit"><label>Deposit amount</label><div className="input"><input type="number" min={level.fee} step="1" value={deposit} onChange={(e) => setDeposit(e.target.value)} /><span>UCT</span></div><button onClick={depositUCT} disabled={!wallet || busy}>{busy ? 'Waiting for wallet…' : `Deposit ${deposit || 0} UCT`}</button><p>Deposit is sent to the configured game treasury. The current session uses that deposit as playable credit.</p></div>
          <button className="start" onClick={startGame} disabled={!wallet || credit < level.fee}>PLAY {level.label.toUpperCase()} · {level.fee} UCT</button>
          <p className="status">{status}</p>
        </aside>

        <div className="gameWrap">
          <div className="gameHead"><div><span>LEVEL</span><strong>{level.label}</strong></div><div><span>TARGET</span><strong>{level.target.toLocaleString()}</strong></div><button onClick={() => resetGame()}>New game</button></div>
          <div className="board" aria-label="Puzzle board">{tiles}</div>
          <div className="controls"><button onClick={() => handleMove('up')}>↑</button><div><button onClick={() => handleMove('left')}>←</button><button onClick={() => handleMove('down')}>↓</button><button onClick={() => handleMove('right')}>→</button></div></div>
          <p className="hint">Use <kbd>W A S D</kbd> or arrow keys. Reach {level.target.toLocaleString()} before your moves run out.</p>
          {(won || gameOver) && <div className="overlay"><span>{won ? 'PUZZLE CLEARED' : 'GAME OVER'}</span><strong>{won ? `+${score.toLocaleString()} points` : 'Nice try.'}</strong><button onClick={startGame} disabled={!wallet || credit < level.fee}>{won ? 'Play another round' : 'Try again'}</button></div>}
        </div>
      </section>

      <footer><span>Sphere Puzzle</span><span>UCT decimals: {UCT_DECIMALS}</span><span>Network: testnet2 (id 4)</span><span>{treasuryConfigured ? 'Treasury configured' : 'Treasury not configured'}</span></footer>
    </main>
  );
}
