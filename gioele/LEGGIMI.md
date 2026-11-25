# Gioele – visite e documenti

App familiare (funziona nel browser e si installa sul telefono) per gestire le visite e i documenti sanitari di Gioele.

**Indirizzo:** https://simonegianatti83-blip.github.io/gioele/

## Cosa fa
- **Visite**: appuntamenti con data, ora, luogo, medico, motivo, esito e note. Per le visite dalla pediatra propone in automatico l'ambulatorio giusto per quel giorno e avvisa se l'orario è fuori ambulatorio.
- **Documenti**: referti, ricette, impegnative, esami, lettere di dimissione, certificati, vaccinazioni. Si fotografano (anche più pagine) o si carica il PDF, e si collegano alla visita.
- **Pediatra** (Dr.ssa Lopez Rios Norma Beatriz): orari dei due ambulatori, prossimi giorni di apertura, tasti per chiamare, e indica se *adesso* la linea prenotazioni (9–11) o i consulti telefonici (8:30–9:30, 14–14:30) sono aperti.
- **Google Calendar**: ogni visita finisce nel calendario "Gioele – Visite" con promemoria il giorno prima e 2 ore prima. Si possono anche importare le visite già presenti nel calendario personale.
- **Condivisione con Silvia**: tutto (visite, documenti, calendario) sta in una cartella Google Drive condivisa; quello che aggiunge uno dei due compare all'altro. Ogni visita o documento si può anche inviare con WhatsApp.
- **Referti dell'ospedale**: si scaricano dal Fascicolo Sanitario Elettronico Lombardia e si mandano all'app con *Condividi → Gioele* (Android) oppure con il tasto *+*.

## Privacy
Su GitHub c'è solo il programma, **nessun dato**. I dati stanno sul telefono e nel Google Drive/Calendar di famiglia.

## Collegare Google (una volta sola, ~10 minuti)
1. https://console.cloud.google.com → crea un progetto "Gioele Salute".
2. *API e servizi → Libreria*: abilita **Google Drive API** e **Google Calendar API**.
3. *Google Auth Platform* (schermata consenso OAuth): tipo **Esterno**, nome "Gioele"; in *Pubblico → Utenti di test* aggiungi la tua Gmail **e quella di Silvia**. Lascia l'app "In test".
4. *Client → Crea client → Applicazione web*; in "Origini JavaScript autorizzate" metti `https://simonegianatti83-blip.github.io`. Copia il **Client ID**.
5. Nell'app: *Impostazioni* → incolla il Client ID → *Salva e collega* → conferma la creazione dell'archivio.
6. *Impostazioni → Condividi con Silvia*: scrivi la sua Gmail → *Condividi*, poi *Manda il link dell'app a Silvia*. Lei apre il link e tocca *Collega Google*.

Google mostrerà "app non verificata": è normale per un'app personale → *Avanzate → Vai a Gioele*.
