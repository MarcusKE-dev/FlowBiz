import { useOnlineStatus } from '../../hooks/useOnlineStatus';
export default function ConnectivityIndicator() {
  const online = useOnlineStatus();
  return (
    <span className={`badge ${online ? 'bg-moss-100 text-moss-700' : 'bg-rust-100 text-rust-700'}`} title={online ? 'Online' : 'Offline — changes queue until reconnected'}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${online ? 'bg-moss-500' : 'bg-rust-500'}`} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}
