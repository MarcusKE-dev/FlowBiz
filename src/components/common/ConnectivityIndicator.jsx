import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import StatusPill from '../ui/StatusPill';

export default function ConnectivityIndicator() {
  const online = useOnlineStatus();
  return (
    <StatusPill
      tone={online ? 'info' : 'negative'}
      className="whitespace-nowrap"
      title={online ? 'Online' : 'Offline. Changes are saved and sync when you reconnect.'}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-primary-600' : 'bg-danger-600'}`}
        aria-hidden="true"
      />
      {online ? 'Online' : 'Offline'}
    </StatusPill>
  );
}
