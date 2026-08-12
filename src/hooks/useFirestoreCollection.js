import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
export function useFirestoreCollection(queryRef) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  useEffect(() => {
    if (!queryRef) { setData([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(queryRef,
      snap => { setData(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); setError(null); },
      err  => { setError(err.message); setLoading(false); }
    );
    return unsub;
  }, [queryRef]);
  return { data, loading, error };
}
