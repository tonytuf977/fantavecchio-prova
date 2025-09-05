import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const NotificheContext = createContext();

export const useNotifiche = () => {
  const context = useContext(NotificheContext);
  if (context === undefined) {
    throw new Error('useNotifiche deve essere usato all\'interno di un NotificheProvider');
  }
  return context;
};

export const NotificheProvider = ({ children }) => {
  const [notificheCount, setNotificheCount] = useState(0);
  const [scambiDaAccettareCount, setScambiDaAccettareCount] = useState(0);

  const checkNotifiche = async () => {
    const user = auth.currentUser;
    if (user) {
      console.log("Checking notifications for user:", user.uid);
      
      const utentiRef = collection(db, 'Utenti');
      const utenteQuery = query(utentiRef, where('id', '==', user.uid));
      const utenteSnapshot = await getDocs(utenteQuery);
      
      if (!utenteSnapshot.empty) {
        const userData = utenteSnapshot.docs[0].data();
        console.log("User data found:", userData);
        
        if (userData.idSquadra) {
          console.log("idSquadra found in user data:", userData.idSquadra);
          
          let count = 0;

          // Controlla le richieste di scambio in sospeso
          const richiesteRef = collection(db, 'RichiesteScambio');
          const richiesteQuery = query(richiesteRef, 
            where('squadraAvversaria', '==', userData.idSquadra),
            where('stato', '==', 'In attesa'),
            where('accettataAdmin', '==', true)
          );
          const richiesteSnapshot = await getDocs(richiesteQuery);
          count += richiesteSnapshot.size;
          console.log("Pending exchange requests:", richiesteSnapshot.size);

          // Controlla i rinnovi in sospeso
          const rinnoviRef = collection(db, 'RinnoviContratti');
          const rinnoviQuery = query(rinnoviRef,
            where('squadraId', '==', userData.idSquadra),
            where('stato', '==', 'In attesa')
          );
          const rinnoviSnapshot = await getDocs(rinnoviQuery);
          count += rinnoviSnapshot.size;
          console.log("Pending renewals:", rinnoviSnapshot.size);

          setNotificheCount(count);
          console.log("Total notifications set:", count);
        }

        // Controlla gli scambi da accettare (per admin)
        if (userData.ruolo === 'admin') {
          const scambiRef = collection(db, 'RichiesteScambio');
          const scambiQuery = query(scambiRef, 
            where('stato', '==', 'In attesa'),
            where('accettataAdmin', '==', false)
          );
          const scambiSnapshot = await getDocs(scambiQuery);
          const scambiCount = scambiSnapshot.size;
          console.log("Scambi da accettare trovati:", scambiCount);
          setScambiDaAccettareCount(scambiCount);
        } else {
          console.log("User is not admin, setting scambiDaAccettareCount to 0");
          setScambiDaAccettareCount(0);
        }
      } else {
        console.log("No user data found");
      }
    } else {
      console.log("No user logged in");
      setNotificheCount(0);
      setScambiDaAccettareCount(0);
    }
  };

  useEffect(() => {
    console.log("NotificheProvider mounted");
    checkNotifiche();
    const interval = setInterval(checkNotifiche, 60000); // Controlla ogni minuto
    return () => {
      console.log("NotificheProvider unmounted");
      clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    console.log("scambiDaAccettareCount aggiornato:", scambiDaAccettareCount);
  }, [scambiDaAccettareCount]);

  return (
    <NotificheContext.Provider value={{ notificheCount, scambiDaAccettareCount, checkNotifiche }}>
      {children}
    </NotificheContext.Provider>
  );
};

export default NotificheProvider;