import { useDailySession } from '../../hooks/useDailySession';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

export default function RequireOpenSession({ children }) {
  const { isAdmin } = useAuth();
  const { session, loading, isClosed } = useDailySession();
  if (loading) return <LoadingSpinner />;
  if (isClosed) {
    return <div className="mx-auto max-w-sm pt-8"><EmptyState title="Today's session is closed" description="This page is locked until the day is reopened." /></div>;
  }
  if (!session) {
    return <div className="mx-auto max-w-sm pt-8"><EmptyState title="Counter not opened yet" description={isAdmin ? "Open today's session from Counter or Dashboard first." : "Ask your owner to open today's session first."} /></div>;
  }
  return children;
}