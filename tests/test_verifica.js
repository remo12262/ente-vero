// Test del motore di verifica: node tests/test_verifica.js
const EV = require("../assets/verifica.js");
const dati = require("../data/enti.json");
const m = new EV.Motore(dati);

const casi = [
  // [descrizione, testo, livello atteso (uno tra quelli elencati)]
  ["TARI falsa con dominio sosia del Comune",
   "Comune di Messina: la sua posizione TARI risulta irregolare. Regolarizzare entro 24 ore su https://comune-messina-tari.com/paga per evitare maggiorazioni.", ["rosso"]],
  ["Multa falsa su dominio .top",
   "Gentile utente, risulta un verbale non pagato per violazione del codice della strada. Paga ora: https://multe-pagopa.top/verifica", ["rosso"]],
  ["Finto INPS con refuso nel dominio",
   "INPS: hai diritto a un rimborso di 312 euro. Aggiorna i tuoi dati su inpps.it/rimborso", ["rosso"]],
  ["Finta ASP con link accorciato",
   "ASP Catania: il suo referto è disponibile. Per visualizzarlo inserisci il codice di verifica su bit.ly/3xYzAbC", ["rosso", "arancio"]],
  ["Finta Agenzia Entrate con estensione diversa",
   "Agenzia delle Entrate: ti spetta un rimborso. Accedi a agenziaentrate.com.rimborsi-online.info", ["rosso"]],
  ["Messaggio vero con link ufficiale",
   "Comune di Catania: dal 10 novembre riapre lo sportello anagrafe. Info su www.comune.catania.it", ["verde"]],
  ["Messaggio vero INPS senza link",
   "INPS: è disponibile una nuova comunicazione nella tua area riservata MyINPS.", ["grigio", "giallo"]],
  ["Richiamata a numero speciale",
   "Comune di Palermo, ufficio tributi: richiami urgentemente il numero 893 123456 per evitare il fermo amministrativo.", ["rosso"]],
  ["Email da Gmail che finge un Comune",
   "Da: ufficio.tributi.comune.messina@gmail.com — Gentile contribuente, il pagamento IMU risulta mancante. Effettua il pagamento tramite bonifico all'IBAN indicato.", ["rosso"]],
  ["Punycode",
   "Accedi subito al tuo fascicolo: https://xn--fscicolo-sanitario-qwb.com/login", ["rosso", "arancio"]],
  ["Sottodominio ingannevole",
   "Regione Siciliana: rimborso ticket disponibile su https://regione.sicilia.it.rimborso-ticket.online/", ["rosso"]],
  ["Messaggio privato innocuo",
   "Ciao, ci vediamo domani alle 18 al bar sotto casa?", ["grigio"]],
  ["Sosia senza altri segnali (possibile servizio legittimo non in IPA)",
   "Scarica la nuova app dei servizi: comune-messina.servizi-app.it", ["arancio"]],
  ["Video privato",
   "guarda questo video https://www.youtube.com/watch?v=abc123", ["giallo"]],
  ["Link ufficiale PagoPA",
   "Avviso di pagamento disponibile su https://checkout.pagopa.it", ["verde", "giallo"]],
];

let ok = 0;
for (const [desc, testo, attesi] of casi) {
  const r = m.analizza(testo);
  const passa = attesi.includes(r.livello);
  if (passa) ok++;
  console.log(`${passa ? "✅" : "❌"} ${desc} → ${r.livello} (punti ${r.punteggio})`);
  if (!passa || process.argv.includes("-v")) {
    r.link.forEach(l => console.log("    link", l.dominio, l.stato, "|", l.motivi.join(" / ")));
    r.email.forEach(l => console.log("    email", l.indirizzo, l.stato, "|", l.motivi.join(" / ")));
    console.log("    campanelli:", r.campanelli.map(c => c.id).join(", "), "| enti:", r.enti.map(i => typeof i === "number" ? dati.enti[i][0] : i).join(", "));
  }
}
console.log(`\n${ok}/${casi.length} casi corretti`);
// Ricerca enti
console.log("cerca 'messina':", m.cercaEnti("messina").map(i => dati.enti[i][0]));
console.log("cerca 'asp catania':", m.cercaEnti("asp catania").map(i => dati.enti[i][0]));
process.exit(ok === casi.length ? 0 : 1);
