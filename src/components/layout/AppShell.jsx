import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import TopHeader from './TopHeader';

// Whether the rail is pinned open. A device preference, so it lives in
// localStorage rather than in the business document — the till's laptop
// and the owner's desktop can reasonably disagree.
const PIN_KEY = 'flowbiz_sidebar_pinned';

function readPinned() {
  try {
    return localStorage.getItem(PIN_KEY) === 'true';
  } catch {
    return false;
  }
}

// A mouse crossing the rail on its way somewhere else should not throw
// the navigation open, and a mouse that briefly clips the edge of the
// content should not slam it shut mid-reach.
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;

// Hover-to-expand is for pointers only. A touch device synthesises
// mouseenter on tap, which would make the rail flap open every time
// someone reached for a nav item, so it is gated on a real hover
// capability rather than on screen width alone.
function canHover() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(hover: hover)').matches;
}

export default function AppShell({ children }) {
  // The rail is now the default on every page, not just /counter. The
  // manual toggle pins it open instead of merely expanding it, and that
  // pin is what persists.
  const [pinned, setPinned] = useState(readPinned);
  const [hoverOpen, setHoverOpen] = useState(false);
  const timerRef = useRef(null);

  // Set the moment a nav item is clicked, cleared when the pointer leaves
  // the rail. Without it, clicking a page collapses the panel and the
  // still-hovering pointer immediately reopens it — the mouse never moved,
  // so nothing ever tells the rail the hover is stale.
  //
  // A ref, not state: it must not trigger a render, and `schedule` reads
  // it from inside a timeout where a state value captured at callback
  // creation would be stale.
  const suppressedRef = useRef(false);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const schedule = useCallback((open) => {
    if (!canHover()) return;
    // Closing is always allowed. Opening is not, while suppressed.
    if (open && suppressedRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => setHoverOpen(open),
      open ? OPEN_DELAY_MS : CLOSE_DELAY_MS
    );
  }, []);

  // Collapse the moment a page is chosen, and stay collapsed until the
  // pointer leaves the rail and comes back.
  //
  // `event.detail === 0` means the click came from the keyboard (Enter on
  // a focused link), not from a pointer. Collapsing there would fight the
  // focus expansion below: the rail would shut with focus still inside it
  // and then flicker back open on the next Tab. Pointer clicks only.
  const handleNavigate = useCallback((event) => {
    if (pinned) return;              // pinned means pinned
    if (event && event.detail === 0) return;
    clearTimeout(timerRef.current);
    suppressedRef.current = true;
    setHoverOpen(false);
  }, [pinned]);

  // Leaving the rail re-arms hover expansion as well as scheduling the
  // close. This is the only thing that clears suppression.
  const handleMouseLeave = useCallback(() => {
    if (pinned) return;
    suppressedRef.current = false;
    schedule(false);
  }, [pinned, schedule]);

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      try { localStorage.setItem(PIN_KEY, next ? 'true' : 'false'); } catch { /* storage unavailable */ }
      return next;
    });
    clearTimeout(timerRef.current);
    suppressedRef.current = false;
    setHoverOpen(false);
  }, []);

  const expanded = pinned || hoverOpen;

  return (
    // `app-viewport` fixes the shell to exactly the viewport height and
    // `overflow-hidden` stops anything escaping it, which is what makes
    // <main> below the single scrolling region of the application. With
    // the old `min-h-screen` the shell's height was indefinite, so the
    // main area sized to its own content, the row grew with it and the
    // DOCUMENT scrolled — taking the rail and the header up with it on
    // every long page. See index.css.
    <div className="app-viewport flex overflow-hidden bg-canvas">
      {/* The rail keeps its 68px slot in the flex layout at all times and
          the expanded panel overlays the content, so hovering never
          reflows the page under the pointer. When pinned, the slot grows
          instead and the layout settles as it always did. */}
      <div
        className={`relative hidden shrink-0 transition-[width] duration-200 lg:block ${
          pinned ? 'w-60' : 'w-[68px]'
        }`}
        onMouseEnter={() => !pinned && schedule(true)}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={() => !pinned && setHoverOpen(true)}
        onBlurCapture={(e) => {
          if (!pinned && !e.currentTarget.contains(e.relatedTarget)) setHoverOpen(false);
        }}
      >
        <Sidebar
          collapsed={!expanded}
          pinned={pinned}
          overlay={!pinned && hoverOpen}
          onToggleCollapse={togglePin}
          onNavigate={handleNavigate}
        />
      </div>

      {/* `min-w-0` so a wide table or a long unbroken string inside the
          page scrolls within its own container instead of stretching this
          column and squeezing the rail. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader />
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-6 sm:px-6 lg:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
