import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

export function useSetupStatus() {

  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {

    const unsubscribe = onSnapshot(
      doc(db, "meta", "setup"),
      (snap) => {
        setSetupComplete(snap.exists());
        setLoading(false);
      },
      () => {
        setSetupComplete(false);
        setLoading(false);
      }
    );

    return unsubscribe;

  }, []);

  return {
    loading,
    setupComplete
  };

}