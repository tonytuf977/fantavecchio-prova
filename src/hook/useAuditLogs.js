// hook/useAuditLogs.js
import { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where,
  Timestamp,
  startAfter
} from 'firebase/firestore';

const useAuditLogs = (filters = {}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = async (isLoadMore = false) => {
    try {
      setLoading(true);
      setError(null);

      let q = query(
        collection(db, 'AuditLogs'),
        orderBy('timestamp', 'desc')
      );

      // Applica filtri
      if (filters.action) {
        q = query(q, where('action', '==', filters.action));
      }
      if (filters.userEmail) {
        q = query(q, where('userEmail', '==', filters.userEmail));
      }
      if (filters.startDate) {
        q = query(q, where('timestamp', '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters.endDate) {
        q = query(q, where('timestamp', '<=', Timestamp.fromDate(filters.endDate)));
      }

      // Paginazione
      if (isLoadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      q = query(q, limit(50));

      const querySnapshot = await getDocs(q);
      const logsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));

      if (isLoadMore) {
        setLogs(prev => [...prev, ...logsData]);
      } else {
        setLogs(logsData);
      }

      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length === 50);
    } catch (err) {
      console.error('Errore nel recupero degli audit logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchLogs(true);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.action, filters.userEmail, filters.startDate, filters.endDate]);

  return { logs, loading, error, loadMore, hasMore, refetch: fetchLogs };
};

export default useAuditLogs;
