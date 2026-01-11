// hook/useErrorLogs.js
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
  startAfter,
  updateDoc,
  doc
} from 'firebase/firestore';

const useErrorLogs = (filters = {}) => {
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
        collection(db, 'ErrorLogs'),
        orderBy('timestamp', 'desc')
      );

      // Applica filtri
      if (filters.errorType) {
        q = query(q, where('errorType', '==', filters.errorType));
      }
      if (filters.severity) {
        q = query(q, where('severity', '==', filters.severity));
      }
      if (filters.component) {
        q = query(q, where('component', '==', filters.component));
      }
      if (filters.resolved !== undefined) {
        q = query(q, where('resolved', '==', filters.resolved));
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
      console.error('Errore nel recupero degli error logs:', err);
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

  const markAsResolved = async (logId) => {
    try {
      await updateDoc(doc(db, 'ErrorLogs', logId), { resolved: true });
      setLogs(prevLogs => 
        prevLogs.map(log => 
          log.id === logId ? { ...log, resolved: true } : log
        )
      );
    } catch (err) {
      console.error('Errore nel marcare errore come risolto:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.errorType, filters.severity, filters.component, filters.resolved, filters.startDate, filters.endDate]);

  return { logs, loading, error, loadMore, hasMore, refetch: fetchLogs, markAsResolved };
};

export default useErrorLogs;
