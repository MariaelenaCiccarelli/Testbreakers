# In questo file sono presenti i comandi per le procedure di avvio e gestione del sistema, e le indicazioni per espandere il pool di sfide

Per semplificare l'avvio e la gestione di Testbreakers, l'intera applicazione è dockerizzata e orchestrata tramite Docker Compose. Di seguito sono riportati i comandi fondamentali per la gestione del ciclo di vita dei container e per l'interrogazione della base di dati.

### Avvio e Gestione dell'Applicazione

Prima di eseguire qualsiasi comando, assicurarsi che il file `.env` sia correttamente configurato all'interno della directory `./Backend/`.

**Inizializzazione e Ricompilazione (Primo avvio o modifiche strutturali)**
Da lanciare alla prima esecuzione, oppure ogni volta che si modificano file di configurazione (come `Dockerfile`, `package.json` o quando si aggiunge una nuova sfida al pool di challenge):

docker compose --env-file ./Backend/.env up --build

### Arresto dell'Infrastruttura
Spegne i container liberando la memoria RAM del computer ospite, preservando intatta la persistenza dei dati all'interno dei volumi:
docker compose down

### Riavvio Rapido
Per riaccendere l'intera infrastruttura sfruttando le immagini già compilate nella cache:
docker compose --env-file ./Backend/.env up

### Ispezione dei Log in Tempo Reale
Per monitorare il comportamento dell'applicazione o intercettare eventuali messaggi di errore durante le sessioni di gioco:
* **Log globali di tutti i servizi**: docker compose logs -f
* **Log specifici del Backend API Express**: docker compose logs -f backend
* **Log specifici del Frontend Nginx/Angular**: docker compose logs -f frontend
* **Log specifici del Database PostgreSQL**: docker compose logs -f database

### Interrogazione e Query sul Database
PostgreSQL espone la porta interna 5432 sulla porta locale definita nella variabile ${DB_PORT} del file .env (es. 5432 o 5433). È possibile interrogare la base:
docker compose exec database psql -U tuo_utente_db -d tuo_nome_db
(Sostituire tuo_utente_db e tuo_nome_db con le credenziali reali del file .env)

Una volta all'interno del prompt di PostgreSQL, è possibile digitare query SQL standard (ricordando il punto e virgola finale), come ad esempio:
SELECT * FROM "Players";

Per abbandonare l'interfaccia a riga di comando di Postgres, digitare \q e premere Invio.

### Pulizia Totale e Reset dell'Ambiente (Hard Reset)
Nel caso in cui sia necessario forzare una pulizia profonda del sistema, rimuovendo cache obsolete, file residui o stati di memoria orfani:

Rimozione profonda di container e volumi orfani:
docker compose down --volumes --remove-orphans

Svuotamento della cache interna del costruttore (BuildKit Cache in Docker Desktop):
docker builder prune -a -f

Rimozione di tutte le immagini inutilizzate (comprese quelle contrassegnate come dangling):
docker image prune -a -f

Rimozione globale di sicurezza (Tabula Rasa):
docker system prune -a --volumes -f

## Guida alla Creazione di Nuove Sfide (Challenge Pool)

Il sistema integra un meccanismo di sincronizzazione automatica che popola e aggiorna il pool di sfide su PostgreSQL partendo da un archivio JSON strutturato. Per esplandere il pool di Challenge, bisogna inserire una nuova sfida all'interno del file di new-challenges.json, rispettando rigorosamente i vincoli strutturali del documento e i criteri del gameplay.

### Struttura Generale dell'Oggetto JSON

Ogni sfida è rappresentata da un oggetto JSON indipendente e deve configurare i seguenti campi primari:

* **title**: Una stringa che identifica il nome della sfida (ad esempio, "Login Form"). Vincolo di Unicità: ogni sfida deve avere un proprio titolo, diverso dalle altre.
* **description**: Una panoramica testuale sintetica che enuncia al programmatore e al tester i requisiti minimi e gli elementi che dovranno essere manipolati o intercettati durante i turni.
* **time**: Il tempo massimo espresso in secondi assegnato a ciascun partecipante per completare il proprio turno di gioco prima che scatti il timeout (ad esempio, "60").

### Definizione del Template HTML e del Test di Partenza

La stesura del codice iniziale richiede massima attenzione per non compromettere il motore virtuale di JSDOM e la visualizzazione nel client:

* **templateHTML**: Rappresenta il frammento di codice DOM di partenza. Deve contenere una marcatura HTML pulita, provvista di ID strutturali univoci sui nodi core che si intendono proteggere o testare.
* **templateTest**: Costituisce lo scheletro del test Playwright iniziale erogato al Tester durante il primo turno. Il codice deve presentare i metodi `page.locator('css=')` con la stringa di ricerca lasciata volutamente vuota dopo il prefisso `css=`, consentendo al giocatore di compilare il selettore mirato.

### Vincoli di Integrità e Meccanismi Anti-Cheat

La sezione denominata **particularities** costituisce il nucleo algoritmico che blinda le regole della sfida e si articola in due array fondamentali:

Il primo è il vettore **cannotDouble**. Al suo interno vanno inseriti, sotto forma di stringhe letterali complete (es. `id=\"username\"`), gli attributi identificativi sensibili del template originale. Il backend utilizzerà questa lista nera per verificare che il Coder, durante la sua fase di manipolazione, non cloni o duplichi tali ID nel DOM con l'intento malevolo di mandare in crash i selettori del Tester per violazione dello Strict Mode.

Il secondo è il vettore **expectedOrder**. Questo array deve ospitare gli ID purificati (es. `"username"`) dei nodi core nell'esatto ordine posizionale in cui compaiono all'interno dell'albero del DOM, dall'alto verso il basso. Questa sequenza viene sfruttata attivamente dal backend per convalidare il turno sia del Tester, accertando che quest'ultimo stia testando l'interfaccia rispettando l'ordine semantico corretto della pagina e senza escludere alcun componente fondamentale della sfida, che del Coder, impossibilitato a spostare gli elementi core del DOM.

### Procedura di Sincronizzazione e Applicazione delle Modifiche

Una volta inserito il nuovo oggetto JSON all'interno del pool di sfide, l'aggiornamento non richiede interventi manuali sul database relazionale. L'infrastruttura di Testbreakers gestisce l'allineamento tramite un bind-mount in tempo reale. L'unico vincolo operativo richiesto per rendere effettive le modifiche e caricare le nuove challenge nell'Arena è eseguire il riavvio del container del backend tramite Docker Compose. Al riavvio, la procedura di seeding intercetta il nuovo file, effettua un controllo differenziale e sincronizza PostgreSQL senza alterare lo storico dei match passati.
In caso di necessaria modifica alle sfide, è vivamente sconsigliata l'eliminazione delle challenge, in quanto questo comporterebbe anche l'eliminazione dei match associati, con conseguente modifica alle statistiche dei giocatori, rischiando di falsarle. Se necessario, procedere alla modifica tramite query dirette al database.

## Gestione del Dataset
Il Dataset è è isolato all’interno di un volume Docker e si struttura come una directory contenente singoli file JSON per ciascun match completato o in corso sulla piattaforma. Anche in caso di reset del Database e della piattaforma, i file all'interno del volume continueranno ad esistere: per evitare inconsistenza dei dati, è consigliata la rimozione manuale dei file.
