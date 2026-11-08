# Ente Vero

Verifica se un SMS o un'email che dice di arrivare da un ente pubblico (Comune, ASP, INPS, PagoPA…) è autentico,
confrontando link e indirizzi con l'Indice delle Pubbliche Amministrazioni (IPA – AgID).

- Sito **statico**: nessun server, database, cookie o tracciamento.
- Il testo incollato viene analizzato **solo nel browser** di chi lo usa.
- Dati: IndicePA – AgID, licenza CC BY 4.0.

## Struttura

| File | Cosa contiene |
|---|---|
| `index.html` | La pagina del sito |
| `assets/verifica.js` | Il motore di verifica (link, siti sosia, campanelli d'allarme) |
| `assets/app.js`, `assets/style.css` | Interfaccia e grafica |
| `data/enti.js`, `data/enti.json` | Elenco enti dall'IPA (generato automaticamente) |
| `scripts/aggiorna_ipa.py` | Scarica i dati IPA e rigenera `data/` |
| `.github/workflows/aggiorna-dati.yml` | Aggiornamento automatico ogni lunedì |
| `tests/test_verifica.js` | Prove con messaggi truffa tipici |

## Pubblicazione su GitHub Pages

1. Crea un nuovo repository su GitHub (es. `ente-vero`), **pubblico**.
2. Carica tutti i file di questa cartella (anche la cartella nascosta `.github`).
3. *Settings → Pages*: Source = **Deploy from a branch**, branch `main`, cartella `/ (root)`.
4. *Settings → Actions → General → Workflow permissions*: **Read and write permissions**.
5. *Actions → Aggiorna dati Indice PA → Run workflow*: scarica l'elenco completo degli enti
   (la prima volta il sito contiene solo un elenco dimostrativo).
6. Dopo un paio di minuti il sito è online su `https://<tuo-utente>.github.io/ente-vero/`.

Se il download automatico dall'IPA non riesce (il portale può cambiare indirizzo), scarica a mano
il file CSV degli enti da indicepa.gov.it → Open Data e lancia:

    python scripts/aggiorna_ipa.py --csv enti.csv

## Prove

    node tests/test_verifica.js       # aggiungi -v per i dettagli
