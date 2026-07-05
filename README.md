#[EN] This file contains the commands for launching and managing the system, as well as instructions for expanding the challenge pool.

To simplify launching and managing Testbreakers, the entire application is dockerized and orchestrated using Docker Compose. The following are the key commands for managing the container lifecycle and querying the database.

### Launching and Managing the Application

Before running any commands, ensure the `.env` file is correctly configured in the `./Backend/` directory.

**Initialization and Recompilation (First Run or Structural Changes)**
Run on first run, or whenever you modify configuration files (such as `Dockerfile`, `package.json`, or when adding a new challenge to the challenge pool):

docker compose --env-file ./Backend/.env up --build

### Infrastructure Shutdown
Shuts down containers, freeing up RAM on the host computer while preserving data persistence within the volumes:
docker compose down

### Quick Restart
To restart the entire infrastructure using the images already compiled in the cache:
docker compose --env-file ./Backend/.env up

### Real-Time Log Inspection
To monitor application behavior or intercept any error messages during game sessions:
* **Global logs for all services**: docker compose logs -f
* **Logs Express API Backend Specific Logs**: docker compose logs -f backend
* **Nginx/Angular Frontend Specific Logs**: docker compose logs -f frontend
* **PostgreSQL Database Specific Logs**: docker compose logs -f database

### Database Queries and Querying
PostgreSQL exposes internal port 5432 on the local port defined in the ${DB_PORT} variable in the .env file (e.g., 5432 or 5433). You can query the database:
docker compose exec database psql -U your_db_user -d your_db_name
(Replace your_db_user and your_db_name with the actual credentials from the .env file)

Once at the PostgreSQL prompt, you can type standard SQL queries (remembering the final semicolon), such as:
SELECT * FROM "Players";

To exit the Postgres command line interface, type \q and press Enter.

### Total Cleanup and Environment Reset (Hard Reset)
If you need to force a deep system cleanup, removing obsolete caches, residual files, or orphaned memory states:

Deep removal of orphaned containers and volumes:
docker compose down --volumes --remove-orphans

Purge the internal builder cache (BuildKit Cache in Docker Desktop):
docker builder prune -a -f

Remove all unused images (including those marked as dangling):
docker image prune -a -f

Global security cleanup (Tabula Rasa):
docker system prune -a --volumes -f

## Guide to Creating New Challenges (Challenge Pool)

The system integrates an automatic synchronization mechanism that populates and updates the PostgreSQL challenge pool from a structured JSON archive. To expand the Challenge pool, a new challenge must be inserted into the new-challenges.json file, strictly adhering to the document's structural constraints and gameplay criteria.

### General Structure of the JSON Object

Each challenge is represented by an independent JSON object and must have the following primary fields:

* **title**: A string identifying the name of the challenge (e.g., "Login Form"). Uniqueness Constraint: Each challenge must have its own title, different from the others.
* **description**: A concise textual overview that informs the programmer and tester of the minimum requirements and the elements that must be manipulated or intercepted during the rounds.
* **time**: The maximum time in seconds allotted to each participant to complete their round before a timeout occurs (e.g., "60").

### Defining the HTML Template and Initial Test

Writing the initial code requires utmost care to avoid compromising the JSDOM virtual engine and client display:

* **templateHTML**: Represents the initial DOM code fragment. It must contain clean HTML markup, with unique structural IDs on the core nodes you intend to protect or test.
* **templateTest**: This constitutes the skeleton of the initial Playwright test delivered to the Tester during the first round. The code must include the `page.locator('css=')` methods, with the search string intentionally left empty after the `css=` prefix, allowing the player to fill in the targeted selector.

### Integrity Constraints and Anti-Cheat Mechanisms

The section called **particularities** constitutes the algorithmic core that secures the challenge rules and is divided into two fundamental arrays:

The first is the **cannotDouble** vector. The sensitive identifying attributes of the original template must be inserted into it, in the form of complete literal strings (e.g., `id=\"username\"`). The backend will use this blacklist to verify that the Coder, during his manipulation phase, does not clone or duplicate these IDs in the DOM with the malicious intent of crashing the Tester's selectors due to a violation of Strict Mode.

The second is the **expectedOrder** vector. This array must contain the purified IDs (e.g., `"username"`) of the core nodes in the exact positional order in which they appear within the DOM tree, from top to bottom. This sequence is actively used by the backend to validate the Tester's turn, ensuring that they are testing the interface while respecting the correct semantic order of the page and without excluding any key challenge components, and the Coder's turn, as they are unable to move core DOM elements.

### Synchronization and Change Application Procedure

Once the new JSON object has been inserted into the challenge pool, updating does not require manual intervention on the relational database. The Testbreakers infrastructure manages the alignment via a real-time bind mount. The only operational requirement for the changes to take effect and upload the new challenges to the Arena is to restart the backend container using Docker Compose. Upon restart, the seeding procedure intercepts the new file, performs a differential check, and synchronizes PostgreSQL without altering the history of past matches.
If changes are necessary to challenges, deleting challenges is strongly discouraged, as this would also delete the associated matches, thus altering player statistics and potentially distorting them. If necessary, make the changes using direct database queries.

## Dataset Management
The Dataset is also managed by Docker and is structured as a directory containing individual JSON files for each match completed or in progress on the platform (Bind Mount). Even if you perform a deep platform reset, the files within the folder will continue to exist despite the database reset: to avoid data inconsistency, manually removing the files is recommended.




# [IT] In questo file sono presenti i comandi per le procedure di avvio e gestione del sistema, e le indicazioni per espandere il pool di sfide

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
Il Dataset è gestito anch'esso da Docker e si struttura come una directory contenente singoli file JSON per ciascun match completato o in corso sulla piattaforma (Bind Mount). Anche in caso di reset profondo della piattaforma, i file all'interno della cartella continueranno ad esistere nonostante l'azzeramento del Database: per evitare inconsistenza dei dati, è consigliata la rimozione manuale dei file.
