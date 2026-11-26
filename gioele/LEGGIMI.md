# Gioele – visite e documenti

App familiare (funziona nel browser e si installa sul telefono) per gestire le visite e i documenti sanitari di Gioele.

**Indirizzo:** https://simonegianatti83-blip.github.io/gioele/

## Cosa fa
- **Visite**: appuntamenti con data, ora, luogo, medico, motivo, esito e note. Per le visite dalla pediatra propone in automatico l'ambulatorio giusto per quel giorno e avvisa se l'orario è fuori ambulatorio.
- **Documenti**: referti, ricette, impegnative, esami, lettere di dimissione, certificati, vaccinazioni. Si fotografano (anche più pagine) o si carica il PDF, e si collegano alla visita.
- **Pediatra** (Dr.ssa Lopez Rios Norma Beatriz): orari dei due ambulatori, prossimi giorni di apertura, tasti per chiamare, e indica se *adesso* la linea prenotazioni (9–11) o i consulti telefonici (8:30–9:30, 14–14:30) sono aperti.
- **Dal calendario all'app**: gli eventi inseriti a mano nel calendario "Gioele – Visite" diventano visite dell'app; se vengono spostati o cancellati nel calendario, la visita si aggiorna o diventa annullata. Promemoria dell'app ed eventi ricorrenti (es. vitamina D) sono esclusi.
- **Google Calendar**: ogni visita finisce nel calendario "Gioele – Visite" con promemoria il giorno prima e 2 ore prima. Si possono anche importare le visite già presenti nel calendario personale.
- **Condivisione con Silvia**: tutto (visite, documenti, calendario) sta in una cartella Google Drive condivisa; quello che aggiunge uno dei due compare all'altro. Ogni visita o documento si può anche inviare con WhatsApp.
- **Lettura automatica dei documenti**: quando carichi un PDF (es. dal Fascicolo Sanitario) o fotografi un referto cartaceo, l'app legge il testo (OCR in italiano, direttamente sul telefono) e riconosce se è un esame del sangue, una visita specialistica, un accesso al pronto soccorso, un ricovero, un'ecografia/RX/ECG, una vaccinazione, una ricetta, un'impegnativa o un certificato. Compila da sola data, struttura, reparto, diagnosi e, per gli esami, i valori con quelli fuori norma. Ricoveri, PS e visite vengono aggiunti allo storico.
- **Documenti personali** (sezione a parte, esclusa dal riepilogo medico): certificato/atto di nascita, tessera sanitaria, carta d'identità, passaporto, residenza/stato di famiglia, nido/scuola, esenzioni/104, ISEE/assegno unico, assicurazioni. Dalla foto l'app legge tipo, numero, codice fiscale (con correzione degli errori dell'OCR e verifica del carattere di controllo), date di rilascio e scadenza; completa da sola i dati di Gioele che mancano. Le scadenze compaiono in Home negli ultimi 60 giorni e vanno nel calendario Google con promemoria 4 settimane e 1 settimana prima. Se un documento personale viene caricato tra i sanitari, l'app propone di spostarlo.
- **Salute** (nuova sezione):
  - *Pasti*: poppate (seno, minuti, cronometro con cambio seno) e rinforzi in ml; quantità indicata per pasto = giorni di vita × 10 ml (il giorno della nascita non conta: 0 ml, poi 10, 20, 30…), 6-7 pasti nelle 24 ore; regola modificabile; grafico e totali giornalieri, anche nel riepilogo PDF.
  - *Prossimo pasto*: ogni 3 h 30 dall'inizio dell'ultimo pasto (modificabile), mostrato in Home e spostato in automatico come evento con avviso nel calendario Google.
  - *Vitamina D*: riquadro in Home "da dare / data ✓" (promemoria giornaliero nel calendario).
  - *Pannolini*: pipì e cacca con un tocco (o con colore e consistenza), conteggi del giorno e delle 24 ore (avviso se nessuna pipì in 24 ore), avviso per feci molto chiare o con sangue; nel riepilogo PDF.
  - *Crescita*: peso, lunghezza e circonferenza della testa con percentili e grafici sulle curve OMS 2006 (dati LMS ufficiali OMS, maschi 0-5 anni, in `oms.js`).
  - *Vaccini* e *bilanci di salute*: calendario indicativo calcolato dalla data di nascita, da segnare come fatto; i bilanci si segnano da soli con le visite "Bilancio di salute"; promemoria nel calendario Google per i prossimi 4 mesi.
  - *Screening neonatali*: metabolico, udito, saturimetria, riflesso rosso, ecografia delle anche.
  - *Farmaci*: registro delle dosi (chi, quando), dosi e intervalli indicati dalla pediatra, avviso se una dose arriva troppo presto o si supera il massimo giornaliero.
  - *Febbre*: temperatura e sintomi con grafico degli ultimi 7 giorni.
  - *Tappe*: tappe dello sviluppo e ricordi con foto.
- **Domande per la prossima visita** (in Visite), stampate anche nel riepilogo.
- **Spese mediche per il 730** (Documenti → Spese): foto dello scontrino con lettura di importo, data, tipo, pagamento tracciabile e codice fiscale; totale annuo ed elenco CSV.
- **Scheda emergenze** (Home e Altro): allergie, terapie, contatti e numeri utili, in PDF da stampare.
- **Nonni in sola lettura**: condivisione con ruolo "solo vedere" su Drive e Calendar; l'app non permette modifiche.
- **Festivi e ferie**: l'app conosce i festivi italiani (Pasqua e Pasquetta comprese, 4 ottobre dal 2026) e il patrono di Sondrio (19 giugno); le ferie della pediatra si aggiungono a mano e valgono anche per Silvia.
- **Riepilogo PDF per il medico**: un tasto crea un PDF con dati, anamnesi, ricoveri e PS, visite specialistiche, esami (valori fuori norma e andamento), ecografie/RX, vaccini e visite dal pediatra, dalla nascita a oggi, con in fondo (a scelta) la copia di tutti i documenti.
- **Referti dell'ospedale**: si scaricano dal Fascicolo Sanitario Elettronico Lombardia e si mandano all'app con *Condividi → Gioele* (Android) oppure con il tasto *+*.

## Privacy
Su GitHub c'è solo il programma, **nessun dato**. I dati stanno sul telefono e nel Google Drive/Calendar di famiglia.

## Collegare Google (una volta sola, ~10 minuti)
1. https://console.cloud.google.com → crea un progetto "Gioele Salute".
2. *API e servizi → Libreria*: abilita **Google Drive API** e **Google Calendar API**.
3. *Google Auth Platform* (schermata consenso OAuth): tipo **Esterno**, nome "Gioele". Poi *Pubblico → Pubblica app* → **In produzione** (non serve la verifica di Google per un'app di famiglia; l'accesso così non scade ogni 7 giorni).
4. *Client → Crea client → Applicazione web*; in "Origini JavaScript autorizzate" metti `https://simonegianatti83-blip.github.io`. Copia il **Client ID**.
5. Nell'app: *Impostazioni* → incolla il Client ID → *Salva e collega* → conferma la creazione dell'archivio.
6. *Impostazioni → Condividi con Silvia*: scrivi la sua Gmail → *Condividi*, poi *Manda il link dell'app a Silvia*. Lei apre il link e tocca *Collega Google*.

Google mostrerà "app non verificata": è normale per un'app personale → *Avanzate → Vai a Gioele*.

## Librerie incluse
- `ocr/`: Tesseract.js 5.1.1 e dati per l'italiano (licenza Apache 2.0, vedi `ocr/LICENSE-tesseract.txt`).
- Lettura e creazione PDF: pdf.js e pdf-lib già presenti nella radice del sito.
