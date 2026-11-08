/*
 * Ente Vero — motore di verifica.
 * Tutto il controllo avviene nel browser: il testo incollato non viene inviato a nessun server.
 * Funziona anche in Node (per i test): module.exports = EnteVero.
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Domini nazionali ufficiali usati spesso nelle truffe (integrano i dati IPA)
  // ---------------------------------------------------------------------------
  var NAZIONALI = [
    ["pagopa.gov.it", "PagoPA S.p.A."],
    ["pagopa.it", "PagoPA S.p.A."],
    ["notifichedigitali.it", "SEND – Servizio Notifiche Digitali (PagoPA)"],
    ["io.italia.it", "App IO (PagoPA)"],
    ["inps.it", "INPS"],
    ["inail.it", "INAIL"],
    ["agenziaentrate.gov.it", "Agenzia delle Entrate"],
    ["agenziaentrateriscossione.gov.it", "Agenzia delle Entrate-Riscossione"],
    ["salute.gov.it", "Ministero della Salute"],
    ["fascicolosanitario.gov.it", "Fascicolo Sanitario Elettronico"],
    ["spid.gov.it", "SPID"],
    ["cartaidentita.interno.gov.it", "Carta d'identità elettronica – Ministero dell'Interno"],
    ["interno.gov.it", "Ministero dell'Interno"],
    ["poliziadistato.it", "Polizia di Stato"],
    ["commissariatodips.it", "Polizia Postale – Commissariato di P.S. online"],
    ["governo.it", "Presidenza del Consiglio dei Ministri"],
    ["mit.gov.it", "Ministero delle Infrastrutture e dei Trasporti"],
    ["ilportaledellautomobilista.it", "Portale dell'Automobilista (MIT)"],
    ["aci.it", "ACI – Automobile Club d'Italia"],
    ["poste.it", "Poste Italiane (gestore di servizio pubblico)"]
  ];

  // Servizi di posta gratuiti o condivisi: un ente pubblico non scrive da qui.
  var PROVIDER_POSTA = [
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.it", "libero.it", "virgilio.it", "alice.it",
    "tim.it", "tiscali.it", "hotmail.com", "hotmail.it", "outlook.com", "outlook.it", "live.com",
    "live.it", "icloud.com", "me.com", "aol.com", "fastwebnet.it", "email.it", "inwind.it",
    "proton.me", "protonmail.com", "gmx.com", "gmx.it", "mail.com", "yandex.com", "tutanota.com"
  ];

  var ACCORCIATORI = [
    "bit.ly", "tinyurl.com", "t.ly", "cutt.ly", "is.gd", "rb.gy", "shorturl.at", "t.co", "ow.ly",
    "s.id", "buff.ly", "rebrand.ly", "tiny.cc", "goo.su", "short.gy", "urlz.fr", "v.gd", "qrco.de",
    "lnkd.in", "bit.do", "tr.ee", "u.to", "x.gd", "shorturl.com", "surl.li", "clck.ru"
  ];

  // Estensioni di dominio molto usate nelle campagne truffa (indizio, non prova)
  var TLD_RISCHIOSI = [
    "top", "xyz", "icu", "live", "click", "shop", "info", "online", "site", "vip", "buzz", "cfd",
    "sbs", "rest", "lol", "monster", "quest", "cyou", "bond", "today", "support", "help", "link",
    "work", "fun", "life", "store", "website", "space", "pw", "cc", "ru", "cn", "su", "tk", "ml",
    "ga", "cf", "gq", "zip", "mov", "app"
  ];

  // Parole che "travestono" un dominio da ente pubblico
  var ESCHE_LUNGHE = [
    "pagopa", "agenziaentrate", "entrate", "riscossione", "comune", "regione", "ministero",
    "fascicolo", "sanitario", "sanita", "polizia", "municipale", "carabinieri", "prefettura",
    "tributi", "rimborso", "rimborsi", "multe", "verbale", "verbali", "sanzione", "sanzioni",
    "notifiche", "governo", "italia", "autostrade", "telepass", "bollo", "ticket", "esenzione",
    "prenotazione", "referto", "referti", "vaccino"
  ];
  var ESCHE_CORTE = [
    "inps", "inail", "asl", "asp", "ausl", "ulss", "ats", "asst", "tari", "imu", "tasi", "cup",
    "spid", "cie", "aci", "pra", "gov", "fse", "send", "io", "mit", "pa", "multa", "ente", "pec"
  ];

  // ---------------------------------------------------------------------------
  // Campanelli d'allarme nel testo
  // ---------------------------------------------------------------------------
  var CAMPANELLI = [
    { id: "urgenza", peso: 2, icona: "⏰",
      testo: "Mette fretta o minaccia conseguenze (scadenze, sospensioni, maggiorazioni).",
      re: /\b(entro (le )?(24|48|72) ?(ore|h)\b|entro oggi|entro domani|scade oggi|in scadenza|ultimo avviso|ultimo sollecito|avviso finale|immediatamente|urgente|urgenza|senza ulteriore preavviso|sar[aà] sospes|verr[aà] (sospes|bloccat|disattivat|annullat)|sospension|bloccat|disattivat|maggiorazion|interessi di mora|pignorament|fermo amministrativo|azione legale|procedura di riscossione|sanzion[ei] aggiuntiv)/i },
    { id: "pagamento", peso: 3, icona: "💳",
      testo: "Chiede un pagamento o i dati della carta tramite il messaggio.",
      re: /\b(paga(re)? (ora|subito|online|qui)|effettua (il )?pagamento|procedi (al|con il) pagamento|saldare|regolarizz[a-z]*|importo (dovuto|da pagare|residuo)|dati della carta|numero (della )?carta|carta di credito|cvv|scadenza della carta|iban|bonifico|ricarica)/i },
    { id: "credenziali", peso: 4, icona: "🔑",
      testo: "Chiede password, codici, PIN o credenziali SPID: nessun ente lo fa mai via SMS o email.",
      re: /\b(password|passw|pin\b|otp|codice (di )?(verifica|sicurezza|conferma|temporaneo)|credenziali|codice usa e getta|inserisci (il|i tuoi) (codic|dat)|conferma (i tuoi )?dati|aggiorna(re)? (i tuoi )?dati|verifica(re)? (la tua )?identit[aà])/i },
    { id: "esca_soldi", peso: 2, icona: "🎁",
      testo: "Promette rimborsi, bonus o accrediti: è un'esca classica.",
      re: /\b(rimborso|ti spetta|hai diritto|accredito|bonus|indennit[aà] in attesa|somma a tuo favore|credito d'imposta a tuo favore|eccedenza)/i },
    { id: "generico", peso: 1, icona: "👤",
      testo: "Saluto generico (es. «Gentile utente»): un ente di solito sa chi sei.",
      re: /\b(gentile (cliente|utente|contribuente|cittadino|assistito)|caro (cliente|utente)|egregio (cliente|utente))/i },
    { id: "richiamata", peso: 3, icona: "📞",
      testo: "Ti invita a richiamare un numero indicato nel messaggio.",
      re: /\b(chiam[aio](re)?|richiam[aio](re)?|contatt[aio](re)?|telefon[aio](re)?)\b[^.\n]{0,40}\b(numero|n\.|al|il)\b[^.\n]{0,12}\d{3}/i },
    { id: "numero_speciale", peso: 4, icona: "☎️",
      testo: "Contiene un numero a pagamento (es. 89x, 16x, 4xx) o estero: richiamarlo costa caro.",
      re: /(^|[^\d])(89[0-9][\s.-]?\d{3}|16[0-9]{2}[\s.-]?\d{3}|4[0-9]{2}[\s.-]?\d{4}|\+(?!39)\d{2,3}[\s.-]?\d{3,})/ },
    { id: "multa", peso: 1, icona: "🚓",
      testo: "Parla di multe o verbali: le multe vere arrivano per raccomandata, PEC o app IO/SEND, non con un link da SMS.",
      re: /\b(multa|verbale|infrazione|violazione del codice della strada|autovelox|contravvenzione)/i },
    { id: "pacco", peso: 1, icona: "📦",
      testo: "Parla di pacchi o spedizioni in giacenza: schema di truffa molto diffuso.",
      re: /\b(pacco|spedizione|giacenza|consegna (non riuscita|fallita|sospesa)|indirizzo incompleto)/i }
  ];

  // ---------------------------------------------------------------------------
  // Utilità
  // ---------------------------------------------------------------------------
  function norm(s) {
    return (s || "").toString().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function pulisciDominio(d) {
    d = (d || "").toString().trim().toLowerCase();
    d = d.replace(/^[a-z]+:\/\//, "").replace(/^www\d?\./, "");
    d = d.split(/[\/?#:\s]/)[0];
    d = d.replace(/^.*@/, "");      // trucco user@dominio
    d = d.replace(/\.+$/, "");
    return d;
  }

  function registrabile(d) {
    var p = d.split(".");
    if (p.length <= 2) return d;
    var ult2 = p.slice(-2).join(".");
    if (["gov.it", "edu.it", "co.uk", "com.br", "co.it", "net.it", "org.uk"].indexOf(ult2) >= 0) {
      return p.slice(-3).join(".");
    }
    return ult2;
  }

  function tld(d) { var p = d.split("."); return p[p.length - 1]; }

  function eSottodominio(d, base) { return d === base || d.slice(-(base.length + 1)) === "." + base; }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 3) return 9;
    var m = [], i, j;
    for (i = 0; i <= b.length; i++) m[i] = [i];
    for (j = 0; j <= a.length; j++) m[0][j] = j;
    for (i = 1; i <= b.length; i++) for (j = 1; j <= a.length; j++)
      m[i][j] = Math.min(m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1), m[i][j - 1] + 1, m[i - 1][j] + 1);
    return m[b.length][a.length];
  }

  // ---------------------------------------------------------------------------
  // Motore
  // ---------------------------------------------------------------------------
  function Motore(dati) {
    this.enti = (dati && dati.enti) || [];   // [nome, tipologia, sito, pec, email]
    this.meta = dati || {};
    this.ufficiali = {};                     // dominio -> {nome, fonte, idx}
    this.nuclei = [];                        // [nucleo, dominio] per riconoscere i sosia
    var self = this;
    var mailDomini = (dati && dati.domini_email) || {};

    this.enti.forEach(function (e, i) {
      var d = pulisciDominio(e[2]);
      if (d && d.indexOf(".") > 0) self._aggiungi(d, e[0], "IPA", i);
    });
    Object.keys(mailDomini).forEach(function (d) {
      if (!self.ufficiali[d]) self._aggiungi(d, (self.enti[mailDomini[d]] || [""])[0], "IPA (email)", mailDomini[d]);
    });
    NAZIONALI.forEach(function (n) { if (!self.ufficiali[n[0]]) self._aggiungi(n[0], n[1], "nazionale", -1); });
  }

  Motore.prototype._aggiungi = function (d, nome, fonte, idx) {
    if (PROVIDER_POSTA.indexOf(d) >= 0 || ACCORCIATORI.indexOf(d) >= 0) return; // mai "ufficiali"
    this.ufficiali[d] = { nome: nome, fonte: fonte, idx: idx };
    // "nucleo": il dominio senza estensione e senza punti, es. comune.messina.it -> comunemessina
    var senzaTld = d.split(".").slice(0, -1).join(".").replace(/^(www|pec|mail|posta)\./, "");
    if (/\.gov$|\.edu$/.test(senzaTld)) senzaTld = senzaTld.replace(/\.(gov|edu)$/, "");
    var nucleo = senzaTld.replace(/[.\-]/g, "");
    if (nucleo.length >= 6) this.nuclei.push([nucleo, d]);
  };

  Motore.prototype.ufficiale = function (d) {
    var p = d.split(".");
    for (var i = 0; i < p.length - 1; i++) {
      var cand = p.slice(i).join(".");
      if (this.ufficiali[cand]) return { dominio: cand, info: this.ufficiali[cand] };
    }
    return null;
  };

  Motore.prototype.estraiLink = function (testo) {
    var trovati = [], visti = {};
    var re = /\b((?:https?:\/\/|www\.)[^\s<>"'«»]+|(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9\-]+)(?:\/[^\s<>"'«»]*)?)/gi;
    var m;
    while ((m = re.exec(testo)) !== null) {
      var grezzo = m[1].replace(/[),.;:!?»]+$/, "");
      // escludi indirizzi email (gestiti a parte) e numeri decimali
      var prima = testo.charAt(m.index - 1);
      if (prima === "@") continue;
      if (/^\d+(\.\d+)+$/.test(grezzo)) continue;
      var d = pulisciDominio(grezzo);
      if (!d || d.indexOf(".") < 0) continue;
      if (/^\d+\.\d+$/.test(d)) continue;
      // evita falsi positivi tipo "es.ti" o abbreviazioni: richiede TLD noto o schema esplicito
      var esplicito = /^(https?:\/\/|www\.)/i.test(grezzo);
      var t = tld(d);
      if (!esplicito && !/^(it|com|net|org|eu|info|gov|edu|io|me|co|biz|xyz|top|icu|live|click|shop|online|site|vip|app|ly|gl|gd|at|cc|ru|cn|tk|pw|link|store|support|help|website|space|fun|life|today|bond|cfd|sbs|lol|buzz|rest|quest|cyou|monster|zip|mov|tr|ee|to|fr|de|es|uk|ch|li|su|ml|ga|cf|gq|work)$/.test(t) && t.indexOf("xn--") !== 0) continue;
      if (!visti[d]) { visti[d] = 1; trovati.push({ grezzo: grezzo, dominio: d }); }
    }
    return trovati;
  };

  Motore.prototype.estraiEmail = function (testo) {
    var re = /[a-z0-9._%+\-]+@([a-z0-9.\-]+\.[a-z]{2,24})/gi, m, out = [], visti = {};
    while ((m = re.exec(testo)) !== null) {
      var ind = m[0].toLowerCase();
      if (!visti[ind]) { visti[ind] = 1; out.push({ indirizzo: ind, dominio: m[1].toLowerCase() }); }
    }
    return out;
  };

  Motore.prototype.analizzaDominio = function (d) {
    var r = { dominio: d, stato: "sconosciuto", motivi: [], ente: null, sosiaDi: null };
    var uff = this.ufficiale(d);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d)) {
      r.stato = "pericoloso"; r.motivi.push("Il link è un indirizzo numerico (IP) invece di un nome: gli enti non lo fanno mai.");
      return r;
    }
    if (uff) {
      r.stato = "ufficiale"; r.ente = uff.info.nome; r.dominioUfficiale = uff.dominio; r.idx = uff.info.idx;
      r.motivi.push("Il dominio " + uff.dominio + " risulta ufficiale (" + (uff.info.fonte === "nazionale" ? "servizio nazionale" : "Indice PA") + ").");
      return r;
    }
    if (ACCORCIATORI.indexOf(d) >= 0 || ACCORCIATORI.indexOf(registrabile(d)) >= 0) {
      r.stato = "accorciato";
      r.motivi.push("È un link accorciato: nasconde il sito di destinazione. Gli enti pubblici non usano link accorciati negli SMS.");
      return r;
    }
    var reg = registrabile(d);
    var compatto = d.replace(/[.\-]/g, "");
    // 1) contiene il "nucleo" di un dominio ufficiale (es. comune-messina-pagamenti.com)
    for (var i = 0; i < this.nuclei.length; i++) {
      var n = this.nuclei[i];
      if (compatto.indexOf(n[0]) >= 0) {
        r.stato = "sosia"; r.sosiaDi = n[1]; r.ente = this.ufficiali[n[1]].nome; r.idx = this.ufficiali[n[1]].idx;
        r.motivi.push("Imita il sito ufficiale " + n[1] + " (" + r.ente + ") ma NON è quel sito.");
        break;
      }
    }
    // 2) quasi uguale a un dominio ufficiale (refusi voluti: inpss.it, agenziaentrte.gov.it)
    if (r.stato !== "sosia") {
      var regNoTld = reg.split(".")[0];
      for (var k in this.ufficiali) {
        var kr = registrabile(k), krNo = kr.split(".")[0];
        if (krNo.length >= 4 && regNoTld !== krNo && levenshtein(regNoTld, krNo) <= (krNo.length >= 8 ? 2 : 1)) {
          r.stato = "sosia"; r.sosiaDi = k; r.ente = this.ufficiali[k].nome; r.idx = this.ufficiali[k].idx;
          r.motivi.push("Il nome è quasi identico a " + k + " (" + r.ente + "): è un trucco per ingannare a colpo d'occhio.");
          break;
        }
        if (krNo.length >= 4 && regNoTld === krNo && tld(kr) !== tld(reg)) {
          r.stato = "sosia"; r.sosiaDi = k; r.ente = this.ufficiali[k].nome; r.idx = this.ufficiali[k].idx;
          r.motivi.push("Ha lo stesso nome di " + k + " ma un'estensione diversa (." + tld(reg) + "): non è il sito ufficiale.");
          break;
        }
      }
    }
    // 3) parole-esca da ente pubblico in un dominio non ufficiale
    var parti = d.split(/[.\-]/);
    var esche = [];
    ESCHE_LUNGHE.forEach(function (w) { if (compatto.indexOf(w) >= 0) esche.push(w); });
    ESCHE_CORTE.forEach(function (w) { if (parti.indexOf(w) >= 0 && w !== tld(d)) esche.push(w); });
    if (/gov|governo/.test(compatto) && !/\.gov\.it$/.test(d)) esche.push("gov");
    if (esche.length && r.stato !== "sosia") {
      r.stato = "sospetto";
      r.motivi.push("Usa parole da ente pubblico (" + esche.slice(0, 4).join(", ") + ") ma non è un dominio ufficiale presente nell'Indice PA.");
    } else if (esche.length) {
      r.esche = esche;
    }
    if (d.indexOf("xn--") >= 0) {
      if (r.stato === "sconosciuto") r.stato = "sospetto";
      r.motivi.push("Contiene caratteri «travestiti» (punycode xn--): lettere straniere che sembrano italiane.");
    }
    if (TLD_RISCHIOSI.indexOf(tld(d)) >= 0) {
      if (r.stato === "sconosciuto") r.stato = "sospetto";
      r.motivi.push("L'estensione ." + tld(d) + " è molto usata nelle truffe e non è usata dagli enti pubblici italiani.");
    }
    if (d.split(".").length >= 5 && r.stato !== "ufficiale") {
      r.motivi.push("Ha molti livelli di sottodominio: spesso serve a far comparire un nome «ufficiale» all'inizio del link.");
      if (r.stato === "sconosciuto") r.stato = "sospetto";
    }
    if (r.stato === "sconosciuto") {
      r.motivi.push("Questo dominio non appartiene a nessun ente presente nell'Indice PA. Se il messaggio dice di venire da un ente pubblico, è un segnale negativo.");
    }
    return r;
  };

  Motore.prototype.analizzaEmail = function (e) {
    if (PROVIDER_POSTA.indexOf(e.dominio) >= 0) {
      var loc = e.indirizzo.split("@")[0].replace(/[.\-_]/g, ""), finto = null;
      for (var i = 0; i < this.nuclei.length; i++) if (loc.indexOf(this.nuclei[i][0]) >= 0) { finto = this.nuclei[i][1]; break; }
      var mot = ["È una casella di posta gratuita (" + e.dominio + "): un ente pubblico non scrive ai cittadini da qui."];
      if (finto) mot.push("Il nome della casella imita " + this.ufficiali[finto].nome + ", il cui dominio ufficiale è " + finto + ".");
      return { indirizzo: e.indirizzo, stato: "sospetto", provider: true, ente: finto ? this.ufficiali[finto].nome : null,
        idx: finto ? this.ufficiali[finto].idx : undefined, motivi: mot };
    }
    var uff = this.ufficiale(e.dominio);
    if (uff) return { indirizzo: e.indirizzo, stato: "ufficiale", ente: uff.info.nome, idx: uff.info.idx,
      motivi: ["Il dominio email " + uff.dominio + " risulta di un ente («" + uff.info.nome + "»). Attenzione: il mittente si può falsificare e una casella vera può essere violata."] };
    var a = this.analizzaDominio(e.dominio);
    return { indirizzo: e.indirizzo, stato: a.stato === "sconosciuto" ? "sconosciuto" : a.stato, ente: a.ente, idx: a.idx,
      motivi: a.motivi.map(function (m) { return m.replace("Il link", "L'indirizzo"); }) };
  };

  Motore.prototype.cercaEnti = function (q, max) {
    var t = norm(q).split(" ").filter(function (x) { return x.length > 1 && ["di", "del", "della", "dei", "il", "la", "lo", "le"].indexOf(x) < 0; });
    if (!t.length) return [];
    var out = [];
    for (var i = 0; i < this.enti.length && out.length < 400; i++) {
      var n = norm(this.enti[i][0] + " " + (this.enti[i][2] || ""));
      var ok = true;
      for (var j = 0; j < t.length; j++) { if ((" " + n + " ").indexOf(" " + t[j]) < 0) { ok = false; break; } }
      if (ok) out.push(i);
    }
    var enti = this.enti;
    out.sort(function (a, b) { return enti[a][0].length - enti[b][0].length; });
    return out.slice(0, max || 10);
  };

  Motore.prototype.entiCitati = function (testo) {
    var out = [], self = this, m;
    var re = /\b(comune|citt[aà]|asp|asl|ausl|azienda sanitaria provinciale|azienda sanitaria|regione|provincia|ospedale|policlinico|prefettura)\s+(?:di\s+|della\s+|del\s+|dell'\s*)?([A-Za-zÀ-ÿ'’]+)(?:\s+([A-Za-zÀ-ÿ'’]+))?/gi;
    var vuote = ["il", "la", "lo", "le", "i", "gli", "un", "una", "per", "con", "su", "da", "dal", "dalla", "al", "alla", "e", "ed", "che", "non", "ha", "ufficio", "informa", "comunica", "avvisa"];
    while ((m = re.exec(testo)) !== null) {
      var tipo = m[1].toLowerCase().replace("azienda sanitaria provinciale", "azienda sanitaria provinciale");
      if (tipo === "asp") tipo = "azienda sanitaria provinciale";
      if (tipo === "asl" || tipo === "ausl") tipo = "azienda sanitaria";
      var w1 = m[2], w2 = m[3];
      if (vuote.indexOf(w1.toLowerCase()) >= 0) continue;
      var trovati = (w2 && vuote.indexOf(w2.toLowerCase()) < 0) ? self.cercaEnti(tipo + " " + w1 + " " + w2, 1) : [];
      if (!trovati.length) trovati = self.cercaEnti(tipo + " " + w1, 1);
      if (!trovati.length && tipo !== m[1].toLowerCase()) trovati = self.cercaEnti(m[1] + " " + w1, 1);
      trovati.forEach(function (i) { if (out.indexOf(i) < 0) out.push(i); });
    }
    [["inps", "inps.it"], ["agenzia delle entrate", "agenziaentrate.gov.it"], ["pagopa", "pagopa.gov.it"],
     ["fascicolo sanitario", "fascicolosanitario.gov.it"]].forEach(function (p) {
      if (norm(testo).indexOf(p[0]) >= 0 && out.indexOf("N:" + p[1]) < 0) out.push("N:" + p[1]);
    });
    return out;
  };

  Motore.prototype.analizza = function (testo) {
    var self = this;
    testo = (testo || "").toString().slice(0, 10000);
    var ris = { link: [], email: [], campanelli: [], enti: [], punteggio: 0 };

    var emails = this.estraiEmail(testo);
    var testoSenzaEmail = testo;
    emails.forEach(function (e) { testoSenzaEmail = testoSenzaEmail.split(e.indirizzo).join(" "); });
    // anche maiuscole
    testoSenzaEmail = testoSenzaEmail.replace(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,24}/gi, " ");

    ris.link = this.estraiLink(testoSenzaEmail).map(function (l) { var a = self.analizzaDominio(l.dominio); a.grezzo = l.grezzo; return a; });
    ris.email = emails.map(function (e) { return self.analizzaEmail(e); });

    CAMPANELLI.forEach(function (c) { if (c.re.test(testo)) { ris.campanelli.push(c); ris.punteggio += c.peso; } });

    var nSosia = 0, nPeric = 0, nSosp = 0, nUff = 0, nAcc = 0, nSconosciuti = 0;
    var parlaDiEnte0 = /\b(comune|asp|asl|inps|agenzia|ministero|regione|tribut|tari|imu|pagopa|polizia|prefettura|fascicolo|sanitari|ticket|esenzione|multa|verbale|send|ufficio)\b/i.test(testo);
    ris.link.concat(ris.email).forEach(function (x) {
      if (x.stato === "pericoloso") nPeric++;
      else if (x.stato === "sosia" || (x.provider && parlaDiEnte0)) nSosia++;
      else if (x.stato === "sospetto") nSosp++;
      else if (x.stato === "accorciato") nAcc++;
      else if (x.stato === "ufficiale") nUff++;
      else nSconosciuti++;
    });

    var citati = this.entiCitati(testo);
    ris.enti = citati;
    var parlaDiEnte = citati.length > 0 || /\b(comune|asp|asl|inps|agenzia|ministero|regione|tribut|tari|imu|pagopa|polizia|prefettura|fascicolo|sanitari|ticket|esenzione|multa|verbale|send)\b/i.test(testo);

    var p = ris.punteggio + nPeric * 9 + nSosia * 6 + nSosp * 4 + nAcc * 4 + (parlaDiEnte ? nSconosciuti * 3 : nSconosciuti);
    if (ris.link.length && parlaDiEnte && nUff === 0) p += 1; // link in un messaggio "da ente" non ufficiale
    ris.punteggio = p;

    var livello, titolo, sotto;
    if (p >= 9) {
      livello = "rosso"; titolo = "Quasi certamente una truffa";
      sotto = "Non cliccare, non rispondere, non chiamare i numeri indicati. Se hai già inserito dati, segui i consigli qui sotto.";
    } else if (p >= 4 || nSosia > 0 || nSosp > 0 || nAcc > 0 || (parlaDiEnte && nSconosciuti > 0)) {
      livello = "arancio"; titolo = "Attenzione: diversi segnali sospetti";
      sotto = "Non usare i link o i numeri del messaggio. Verifica contattando l'ente con i recapiti ufficiali qui sotto.";
    } else if (nUff > 0 && nUff === ris.link.length + ris.email.length) {
      livello = "verde"; titolo = "I link portano a siti ufficiali";
      sotto = "Buon segno, ma non è una garanzia assoluta: se il messaggio chiede soldi o dati in modo insolito, verifica comunque con l'ente.";
    } else if (!ris.link.length && !ris.email.length && p < 2) {
      livello = "grigio"; titolo = "Nessun link e pochi segnali da analizzare";
      sotto = "Non ho trovato indirizzi da controllare. Se il messaggio ti chiede di chiamare, pagare o dare dati, verifica sempre con i recapiti ufficiali.";
    } else {
      livello = "giallo"; titolo = "Nessun segnale grave, ma resta prudente";
      sotto = "Il controllo non ha trovato elementi tipici delle truffe. In caso di dubbio, entra nel sito dell'ente digitandone tu l'indirizzo.";
    }
    ris.livello = livello; ris.titolo = titolo; ris.sotto = sotto;
    return ris;
  };

  var EnteVero = { Motore: Motore, norm: norm, pulisciDominio: pulisciDominio, registrabile: registrabile, NAZIONALI: NAZIONALI };
  if (typeof module !== "undefined" && module.exports) module.exports = EnteVero; else root.EnteVero = EnteVero;
})(this);
