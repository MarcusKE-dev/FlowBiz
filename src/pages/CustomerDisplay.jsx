import { useEffect, useMemo, useRef, useState } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed, Volume2, VolumeX, Maximize, Minimize,
  Minus, Plus, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useIndustry } from '../hooks/useIndustry';
import { useTickets } from '../hooks/useTickets';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import useProductImage from '../hooks/useProductImage';
import { tenantQuery } from '../lib/tenant';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatKES } from '../utils/currency';
import { readRoom } from '../domain/fnb/ticket';
import { readFloor } from '../domain/fnb/floor';
import { sellableProducts } from '../domain/fnb/catalog';
import {
  DISPLAY_STAGE, DISPLAY_STAGE_LABELS, displayStage, readOrderBoard, readMenuReel,
  readyIds, newlyReady, waitingMinutes,
} from '../domain/fnb/display';

// ── Per-device scale ─────────────────────────────────────────────────

const SCALE_KEY = 'flowbiz.customerDisplay.scale';
const SCALE_STEPS = [0.75, 0.9, 1, 1.15, 1.35, 1.6];

function readStoredScale() {
  try {
    const stored = Number(localStorage.getItem(SCALE_KEY));
    return SCALE_STEPS.includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

function writeStoredScale(value) {
  try { localStorage.setItem(SCALE_KEY, String(value)); } catch { /* not fatal */ }
}

// ── The chime ────────────────────────────────────────────────────────

function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);       // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);   // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => ctx.close?.();
  } catch {
    // Audio context failures are non-fatal.
  }
}

// ── Solid Status Colors ──────────────────────────────────────────────

const TONE = {
  [DISPLAY_STAGE.ORDERED]: {
    card: 'border-2 border-ink-700 bg-ink-900',
    name: 'text-white',
    label: 'text-ink-300',
    waiting: 'text-ink-300',
  },
  [DISPLAY_STAGE.PREPARING]: {
    card: 'border-2 border-[#C77A0B] bg-[#5A320A]',
    name: 'text-white',
    label: 'text-warning-200',
    waiting: 'text-warning-200',
  },
  [DISPLAY_STAGE.READY]: {
    card: 'border-2 border-[#5F6DE0] bg-[#1B2CC1]',
    name: 'text-white',
    label: 'text-white',
    waiting: 'text-white/90',
  },
  [DISPLAY_STAGE.SERVED]: {
    card: 'border-2 border-ink-800 bg-ink-950',
    name: 'text-ink-400',
    label: 'text-ink-500',
    waiting: 'text-ink-500',
  },
};

const FREE_CARD = 'border-2 border-ink-700 bg-ink-900';

/**
 * ONE TABLE: Solid rectangle, high-visibility white text.
 */
function TableCard({ table, now }) {
  const stage = displayStage(table.stage);
  const tone = TONE[stage] || TONE[DISPLAY_STAGE.ORDERED];
  const waiting = table.tickets.length > 0 ? waitingMinutes(table.tickets[0], now) : null;

  return (
    <div
      className={`flex min-h-0 flex-col justify-center gap-[0.25em] overflow-hidden border-2 px-[0.85em] py-[0.55em] transition-colors duration-300 ${
        table.occupied ? tone.card : FREE_CARD
      }`}
    >
      <div className="flex items-center">
        <span
          className={`min-w-0 truncate text-[1.45em] font-bold leading-tight tracking-tight ${
            table.occupied ? tone.name : 'text-white'
          }`}
        >
          {table.name}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-[0.5em]">
        {table.occupied ? (
          <>
            <span className={`truncate text-[0.82em] font-bold uppercase tracking-[0.1em] ${tone.label}`}>
              {DISPLAY_STAGE_LABELS[stage] || 'Seated'}
            </span>
            {waiting !== null && (
              <span className={`num shrink-0 text-[0.8em] font-semibold ${tone.waiting}`}>
                {waiting} min
              </span>
            )}
          </>
        ) : (
          <span className="truncate text-[0.82em] font-semibold uppercase tracking-[0.1em] text-white">
            Free{table.seats ? ` · ${table.seats} seats` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ONE ORDER: Solid rectangle for counter trade with no tables.
 */
function OrderCard({ entry }) {
  const tone = TONE[entry.stage] || TONE[DISPLAY_STAGE.ORDERED];

  return (
    <div
      className={`flex min-h-0 flex-col justify-center gap-[0.25em] overflow-hidden border-2 px-[0.85em] py-[0.55em] transition-colors duration-300 ${tone.card}`}
    >
      <div className="flex items-center">
        <span className={`min-w-0 truncate text-[1.45em] font-bold leading-tight tracking-tight ${tone.name}`}>
          {entry.label}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-[0.5em]">
        <span className={`truncate text-[0.82em] font-bold uppercase tracking-[0.1em] ${tone.label}`}>
          {DISPLAY_STAGE_LABELS[entry.stage]}
        </span>
        {entry.waiting !== null && (
          <span className={`num shrink-0 text-[0.8em] font-semibold ${tone.waiting}`}>
            {entry.waiting} min
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ONE SIDE OF THE ROOM.
 * Shows title and count when present; if "Tables" heading is omitted,
 * shows the seated count at the far left and keeps column grids aligned.
 */
function RoomSide({ title, count, cards, empty }) {
  const columns = cards.length > 6 ? 2 : 1;
  const hasHeader = Boolean(title || count);

  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-[0.55em]">
      {hasHeader ? (
        <div className="flex shrink-0 items-baseline justify-between gap-[0.5em] text-[0.8em] font-bold uppercase tracking-[0.18em] text-white">
          <span className="truncate text-white">{title || count}</span>
          {title && count && (
            <span className="num shrink-0 font-semibold tracking-normal text-white">{count}</span>
          )}
        </div>
      ) : (
        <div className="h-[1.2em] shrink-0" aria-hidden="true" />
      )}

      {cards.length === 0 ? (
        <div className="flex flex-1 items-center justify-center border-2 border-ink-800 bg-ink-900/40 px-[1em]">
          <p className="text-center text-[0.9em] font-medium text-ink-400">{empty}</p>
        </div>
      ) : (
        <div
          className="grid min-h-0 flex-1 gap-[0.5em]"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridAutoRows: 'minmax(0, 1fr)',
          }}
        >
          {cards}
        </div>
      )}
    </section>
  );
}

/**
 * INDIVIDUAL FEED ITEM IN THE MENU REEL
 */
function FeedItem({ entry }) {
  const { src } = useProductImage(entry.product);
  const [failedSrc, setFailedSrc] = useState(null);
  const showPhoto = Boolean(src) && failedSrc !== src;

  return (
    <div className="flex min-h-[52vh] shrink-0 flex-col items-center justify-center px-[1em] py-[2.2em] text-center">
      {showPhoto ? (
        <div className="flex flex-1 items-center justify-center">
          <img
            src={src}
            alt=""
            onError={() => setFailedSrc(src)}
            className="max-h-[38vh] w-auto max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <UtensilsCrossed
            className="h-[3.2em] w-[3.2em] text-ink-600"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="mt-[0.8em] flex shrink-0 flex-col items-center gap-[0.25em]">
        {entry.category && (
          <span className="text-[0.78em] font-bold uppercase tracking-[0.24em] text-primary-400">
            {entry.category}
          </span>
        )}
        <h2 className="max-w-[15em] text-[1.45em] font-bold leading-tight tracking-tight text-white lg:text-[1.65em]">
          {entry.name}
        </h2>
        <p className="num text-[1.35em] font-bold text-primary-300 lg:text-[1.55em]">
          {formatKES(entry.price)}
        </p>
      </div>
    </div>
  );
}

/**
 * UNENCLOSED MENU FEED:
 * Scrolls continuously from bottom to top in a smooth loop, and can be
 * manually scrolled or swiped like a phone feed.
 */
function MenuFeed({ reel }) {
  const scrollRef = useRef(null);
  const isInteracting = useRef(false);
  const resumeTimer = useRef(null);
  const animFrameId = useRef(null);

  const displayItems = useMemo(() => {
    if (reel.length <= 1) return reel;
    return [...reel, ...reel, ...reel];
  }, [reel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || reel.length <= 1) return undefined;

    let lastTime = performance.now();
    const SPEED_PPS = 48; // Smooth 48 pixels/second scroll rate

    const step = (time) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (!isInteracting.current && el) {
        el.scrollTop += SPEED_PPS * dt;
        const oneSetHeight = el.scrollHeight / 3;
        if (oneSetHeight > 0 && el.scrollTop >= oneSetHeight) {
          el.scrollTop -= oneSetHeight;
        }
      }
      animFrameId.current = requestAnimationFrame(step);
    };

    animFrameId.current = requestAnimationFrame(step);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [reel.length]);

  const handleTouchStart = () => {
    isInteracting.current = true;
    clearTimeout(resumeTimer.current);
  };

  const handleTouchEnd = () => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      isInteracting.current = false;
      const el = scrollRef.current;
      if (el && reel.length > 1) {
        const oneSetHeight = el.scrollHeight / 3;
        if (oneSetHeight > 0) {
          while (el.scrollTop >= oneSetHeight) {
            el.scrollTop -= oneSetHeight;
          }
        }
      }
    }, 2500);
  };

  if (reel.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-[2em]">
        <p className="max-w-[16em] text-center text-[1em] font-medium text-white">
          Add items to the menu with a photo and a price, and they run here.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onPointerDown={handleTouchStart}
      onPointerUp={handleTouchEnd}
      onPointerCancel={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleTouchStart}
      onScroll={() => {
        if (isInteracting.current) {
          clearTimeout(resumeTimer.current);
          resumeTimer.current = setTimeout(() => {
            isInteracting.current = false;
          }, 2500);
        }
      }}
      className="flex h-full w-full flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollBehavior: 'auto' }}
    >
      {displayItems.map((entry, idx) => (
        <FeedItem key={`${entry.id}-${idx}`} entry={entry} />
      ))}
    </div>
  );
}

// ── The board ────────────────────────────────────────────────────────

export default function CustomerDisplay() {
  const navigate = useNavigate();
  const { businessId } = useAuth();
  const { settings } = useSettings();
  const industry = useIndustry();
  const { tickets, loading, enabled } = useTickets();

  const [scale, setScale] = useState(readStoredScale);
  const [sound, setSound] = useState(false);
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const wasReady = useRef(null);

  const productsQ = useMemo(
    () => (businessId
      ? tenantQuery('products', businessId, where('deleted', '!=', true), orderBy('deleted'), orderBy('name'))
      : null),
    [businessId]
  );
  const { data: products } = useFirestoreCollection(productsQ);

  const tablesOn = industry.can('tables');

  const board = useMemo(() => readOrderBoard(tickets, { now }), [tickets, now]);
  const reel = useMemo(() => readMenuReel(sellableProducts(products)), [products]);

  const tableNames = useMemo(
    () => (Array.isArray(settings?.tables) ? settings.tables : []),
    [settings]
  );
  const floorPlan = settings?.floorPlan || null;

  const floor = useMemo(
    () => (tablesOn
      ? readFloor({ tableNames, plan: floorPlan, room: readRoom(tableNames, tickets) })
      : null),
    [tablesOn, tableNames, floorPlan, tickets]
  );

  const sides = useMemo(() => {
    if (floor) {
      const half = Math.ceil(floor.tables.length / 2);
      return {
        kind: 'tables',
        leftTitle: null, // "Tables" heading removed
        rightTitle: null, // "Tables" heading removed
        leftCount: `${floor.occupied} of ${floor.tables.length} seated`,
        rightCount: null,
        left: floor.tables.slice(0, half),
        right: floor.tables.slice(half),
      };
    }
    return {
      kind: 'orders',
      leftTitle: 'Preparing',
      rightTitle: 'Ready',
      leftCount: board.working.length > 0 ? String(board.working.length) : null,
      rightCount: board.ready.length > 0 ? String(board.ready.length) : null,
      left: board.working,
      right: board.ready,
    };
  }, [floor, board]);

  // ── Thirty second interval for waiting times ──────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // ── Ready chime ───────────────────────────────────────────────────
  useEffect(() => {
    const current = readyIds(board);
    const fresh = newlyReady(wasReady.current, current);
    if (wasReady.current !== null && fresh.length > 0 && sound) playChime();
    wasReady.current = current;
  }, [board, sound]);

  // ── Fullscreen tracking ───────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Auto-hide controls ────────────────────────────────────────────
  useEffect(() => {
    let timer = null;
    const wake = () => {
      setControls(true);
      clearTimeout(timer);
      timer = setTimeout(() => setControls(false), 6000);
    };
    wake();
    for (const evt of ['pointermove', 'pointerdown', 'keydown']) {
      window.addEventListener(evt, wake);
    }
    return () => {
      clearTimeout(timer);
      for (const evt of ['pointermove', 'pointerdown', 'keydown']) {
        window.removeEventListener(evt, wake);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  const stepScale = (direction) => {
    const at = SCALE_STEPS.indexOf(scale);
    const next = SCALE_STEPS[Math.min(SCALE_STEPS.length - 1, Math.max(0, at + direction))];
    setScale(next);
    writeStoredScale(next);
  };

  if (!enabled) {
    return (
      <Shell scale={scale}>
        <div className="flex flex-1 flex-col items-center justify-center gap-[0.6em] px-[2em] text-center">
          <UtensilsCrossed className="h-[3em] w-[3em] text-ink-600" strokeWidth={1.25} aria-hidden="true" />
          <h1 className="text-[1.8em] font-semibold text-white">This business does not keep open orders</h1>
          <p className="max-w-[24em] text-[1em] text-ink-400">
            The customer display shows the room and the order queue. Turn on open orders for this
            business and the board fills itself.
          </p>
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell scale={scale}>
        <div className="flex flex-1 items-center justify-center">
          <LoadingSpinner label="Opening the board" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell scale={scale}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-[1em] px-[1.2em] pb-[0.7em] pt-[0.9em]">
        <div className="flex min-w-0 items-center gap-[0.6em]">
          <span className="flex h-[1.9em] w-[1.9em] shrink-0 items-center justify-center border border-ink-700 bg-ink-900 text-primary-400">
            <UtensilsCrossed className="h-[1.05em] w-[1.05em]" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h1 className="truncate text-[1.35em] font-bold tracking-tight text-white">
            {settings?.shopName || 'FlowBiz'}
          </h1>
        </div>

        <div
          className={`flex items-center gap-[0.35em] transition-opacity duration-500 ${
            controls ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <ControlButton onClick={() => stepScale(-1)} label="Make everything smaller" disabled={scale === SCALE_STEPS[0]}>
            <Minus className="h-[1.05em] w-[1.05em]" strokeWidth={2.25} aria-hidden="true" />
          </ControlButton>
          <ControlButton
            onClick={() => stepScale(1)}
            label="Make everything bigger"
            disabled={scale === SCALE_STEPS[SCALE_STEPS.length - 1]}
          >
            <Plus className="h-[1.05em] w-[1.05em]" strokeWidth={2.25} aria-hidden="true" />
          </ControlButton>
          <ControlButton
            onClick={() => setSound((on) => !on)}
            label={sound ? 'Turn the ready chime off' : 'Turn the ready chime on'}
            active={sound}
          >
            {sound
              ? <Volume2 className="h-[1.05em] w-[1.05em]" strokeWidth={1.75} aria-hidden="true" />
              : <VolumeX className="h-[1.05em] w-[1.05em]" strokeWidth={1.75} aria-hidden="true" />}
          </ControlButton>
          <ControlButton onClick={toggleFullscreen} label={fullscreen ? 'Leave full screen' : 'Full screen'}>
            {fullscreen
              ? <Minimize className="h-[1.05em] w-[1.05em]" strokeWidth={1.75} aria-hidden="true" />
              : <Maximize className="h-[1.05em] w-[1.05em]" strokeWidth={1.75} aria-hidden="true" />}
          </ControlButton>
          <ControlButton onClick={() => navigate('/floor')} label="Close the display and go back">
            <X className="h-[1.05em] w-[1.05em]" strokeWidth={2} aria-hidden="true" />
          </ControlButton>
        </div>
      </header>

      {/* ── Main Layout: Tables, Unenclosed Center Reel, Tables ────── */}
      <main className="grid min-h-0 flex-1 gap-[0.9em] px-[1.2em] pb-[1.1em] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <RoomSide
          title={sides.leftTitle}
          count={sides.leftCount}
          cards={sides.kind === 'tables'
            ? sides.left.map((t) => <TableCard key={t.name} table={t} now={now} />)
            : sides.left.map((e) => <OrderCard key={e.id} entry={e} />)}
          empty={sides.kind === 'tables' ? 'No tables named yet' : 'Nothing cooking'}
        />

        {/* Center column: Open, unenclosed vertical feed running from bottom to top */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <MenuFeed reel={reel} />
        </section>

        <RoomSide
          title={sides.rightTitle}
          count={sides.rightCount}
          cards={sides.kind === 'tables'
            ? sides.right.map((t) => <TableCard key={t.name} table={t} now={now} />)
            : sides.right.map((e) => <OrderCard key={e.id} entry={e} />)}
          empty={sides.kind === 'tables' ? 'No tables on this side' : 'Nothing ready'}
        />
      </main>
    </Shell>
  );
}

// ── Base Shell & Controls ─────────────────────────────────────────────

function Shell({ scale, children }) {
  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-ink-950 text-white selection:bg-primary-500/40"
      style={{ fontSize: `calc(clamp(0.95rem, 0.62vw + 0.5rem, 2.4rem) * ${scale})` }}
    >
      {children}
    </div>
  );
}

function ControlButton({ onClick, label, children, active = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`flex h-[1.9em] w-[1.9em] items-center justify-center border transition-colors disabled:opacity-25 ${
        active
          ? 'border-[#5F6DE0] bg-[#1B2CC1] text-white'
          : 'border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}