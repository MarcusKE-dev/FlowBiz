// src/hooks/useTickets.js
//
// THE FLOOR, LIVE — every open ticket and every line still in play, from
// exactly TWO listeners, however many tables the room has.
//
// The listener design is the part worth reading. The obvious shape — one
// listener per open ticket for its lines — is what a naive port of the
// old single-document order would produce, and it is wrong twice over: a
// restaurant with twenty tables would hold twenty-one live subscriptions,
// and every one of them would have to be opened and closed as tickets
// come and go. So instead:
//
//   ONE listener on the open ticket HEADERS. What it always was.
//
//   ONE listener on every line still IN PLAY — `open: true`, which a line
//   carries until its ticket is charged or abandoned. The query therefore
//   bounds itself to exactly the work currently in the room, and a paid
//   table leaves it without anything having to remember to unsubscribe.
//
//   It is deliberately NOT a query on the fulfillment stages. A table that
//   has eaten and not yet paid has every line at `served`, and a query
//   written that way would drop the ticket off the floor at precisely the
//   moment somebody needs to charge it.
//
// That one query is also, filtered client-side, exactly what the kitchen
// screen needs — which is why the kitchen screen has no listener of its
// own either.
//
// BOTH ARE CAPABILITY-GATED. A shop with no open orders opens neither and
// pays for no reads it will never use, exactly as the orders listener has
// always behaved.

import { useMemo } from 'react';
import { where, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useIndustry } from './useIndustry';
import { tenantQuery } from '../lib/tenant';
import { useFirestoreCollection } from './useFirestoreCollection';
import { readTicket, TICKET_STATUS } from '../domain/fnb/ticket';

export function useTickets() {
  const { businessId } = useAuth();
  const industry = useIndustry();
  const on = industry.can('orders');

  const headersQ = useMemo(
    () => (businessId && on
      ? tenantQuery('orders', businessId,
          where('status', '==', TICKET_STATUS.OPEN),
          orderBy('openedAt', 'desc'), limit(200))
      : null),
    [businessId, on]
  );

  const linesQ = useMemo(
    () => (businessId && on
      ? tenantQuery('orderLines', businessId,
          where('open', '==', true),
          orderBy('seq', 'asc'), limit(1000))
      : null),
    [businessId, on]
  );

  const { data: headers, loading: headersLoading } = useFirestoreCollection(headersQ);
  const { data: lines, loading: linesLoading } = useFirestoreCollection(linesQ);

  // VOIDED LINES ARE KEPT IN THIS LIST. They belong to the ticket and the
  // check screen has to show what was taken off and by whom; readTicket()
  // already separates them from the live ones and totals only the live.
  // Filtering them out here would make a void invisible the moment it
  // happened, which is the opposite of the point of recording it.
  const tickets = useMemo(
    () => headers.map((header) => readTicket(header, lines)).filter(Boolean),
    [headers, lines]
  );

  return {
    tickets,
    lines,
    loading: on && (headersLoading || linesLoading),
    enabled: on,
  };
}

/**
 * One ticket, read the same way — for the counter, which is working on a
 * single table and needs its VOIDED lines too so it can show what was
 * taken off and by whom.
 *
 * It reuses the floor's line list rather than opening a listener of its
 * own. The one case that needs a separate read is a ticket whose lines
 * have all been served but which is still open — a table that has eaten
 * and not yet paid — and that is what `extraLines` is for: the counter
 * passes the result of its own by-ticket query when it has one.
 */
export function useTicket(ticketId, { lines = [], extraLines = [] } = {}) {
  const { tickets } = useTickets();
  return useMemo(() => {
    if (!ticketId) return null;
    const found = tickets.find((t) => t.id === ticketId);
    if (!found) return null;
    if (extraLines.length === 0) return found;
    const merged = [...lines, ...extraLines];
    return readTicket(found.order, merged);
  }, [ticketId, tickets, lines, extraLines]);
}
