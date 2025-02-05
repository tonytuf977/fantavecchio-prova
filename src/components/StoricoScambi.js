import React from 'react';
import { useStoricoScambi } from '../hook/useStoricoScambi';

function StoricoScambi() {
  const { storicoScambi, loading, error } = useStoricoScambi();

  if (loading) return <div>Caricamento storico scambi...</div>;
  if (error) return <div>Errore nel caricamento dello storico scambi: {error}</div>;

  return (
    <div className="container mt-5">
      <h2>Storico Scambi</h2>
      {storicoScambi.length === 0 ? (
        <p>Nessuno scambio trovato.</p>
      ) : (
        storicoScambi.map((scambio, index) => (
          <div key={index} className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">Data Proposta: {scambio.dataRichiesta ? new Date(scambio.dataRichiesta).toLocaleDateString() : 'Data non disponibile'}</h5>
              <p>Squadra Richiedente: {scambio.squadraRichiedente || 'N/A'}</p>
              <p>Squadra Avversaria: {scambio.squadraAvversaria || 'N/A'}</p>
              <div>
                <strong>Giocatori Offerti:</strong>
                <ul>
                  {Array.isArray(scambio.giocatoriOfferti) && scambio.giocatoriOfferti.length > 0 ? (
                    scambio.giocatoriOfferti.map((giocatore, idx) => (
                      <li key={idx}>{giocatore}</li>
                    ))
                  ) : (
                    <li>Nessun giocatore offerto</li>
                  )}
                </ul>
              </div>
              <div>
                <strong>Giocatori Richiesti:</strong>
                <ul>
                  {Array.isArray(scambio.giocatoriRichiesti) && scambio.giocatoriRichiesti.length > 0 ? (
                    scambio.giocatoriRichiesti.map((giocatore, idx) => (
                      <li key={idx}>{giocatore}</li>
                    ))
                  ) : (
                    <li>Nessun giocatore richiesto</li>
                  )}
                </ul>
              </div>
              <p>Stato: {scambio.stato || 'N/A'}</p>
              {scambio.stato === 'Completato' && (
                <p>Data Scambio: {scambio.dataScambio ? new Date(scambio.dataScambio).toLocaleDateString() : 'Data non disponibile'}</p>
              )}
              {scambio.clausola && <p><strong>Clausola:</strong> {scambio.clausola}</p>}
              {scambio.valoriGiocatori && (
                <div>
                  <strong>Valori Giocatori:</strong>
                  <ul>
                    {Object.entries(scambio.valoriGiocatori).map(([giocatoreId, valore]) => (
                      <li key={giocatoreId}>{giocatoreId}: {valore} €</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default StoricoScambi;


