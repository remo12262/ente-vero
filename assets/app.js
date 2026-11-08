/* Ente Vero — interfaccia. Nessun dato lascia il browser. */
(function () {
  "use strict";
  var dati = window.ENTI_DATI || { enti: [], domini_email: {} };
  var motore = new EnteVero.Motore(dati);
  var $ = function (id) { return document.getElementById(id); };

  // ---------- utilità DOM sicure (mai innerHTML con testo dell'utente) ----------
  function el(tag, attr, figli) {
    var n = document.createElement(tag);
    if (attr) Object.keys(attr).forEach(function (k) {
      if (k === "class") n.className = attr[k];
      else if (k === "text") n.textContent = attr[k];
      else n.setAttribute(k, attr[k]);
    });
    (figli || []).forEach(function (f) { if (f) n.appendChild(typeof f === "string" ? document.createTextNode(f) : f); });
    return n;
  }
  function linkUfficiale(dominio) {
    return el("a", { href: "https://" + dominio, rel: "noopener noreferrer", target: "_blank", text: dominio });
  }

  // ---------- intestazione dati ----------
  var dataAgg = dati.aggiornato ? new Date(dati.aggiornato).toLocaleDateString("it-IT") : "—";
  $("data-agg").textContent = dataAgg;
  $("data-agg-piede").textContent = dataAgg;
  if (dati.demo) $("avviso-demo").hidden = false;

  // ---------- schede ----------
  var schede = ["verifica", "cerca", "come", "note"];
  function mostra(nome) {
    schede.forEach(function (s) {
      $("sez-" + s).hidden = s !== nome;
      $("tab-" + s).setAttribute("aria-selected", s === nome ? "true" : "false");
    });
    if (history.replaceState) history.replaceState(null, "", "#" + nome);
  }
  schede.forEach(function (s) { $("tab-" + s).addEventListener("click", function () { mostra(s); }); });
  var h = (location.hash || "").slice(1);
  if (schede.indexOf(h) >= 0) mostra(h);

  // ---------- esempi ----------
  var ESEMPI = [
    "Comune di Messina: la sua posizione TARI 2026 risulta irregolare. Regolarizzi entro 24 ore su https://comune-messina-tari.com/paga per evitare maggiorazioni e sanzioni.",
    "Gentile utente, risulta un verbale non pagato per violazione del codice della strada (autovelox). Paga ora con PagoPA: https://multe-pagopa.top/verifica",
    "INPS: hai diritto a un rimborso di 312,40 euro. Per riceverlo aggiorna i tuoi dati e inserisci il codice di verifica su inpps.it/rimborso",
    "ASP Catania: il suo referto è disponibile. Per visualizzarlo inserisca il codice di verifica ricevuto su bit.ly/referto-asp",
    "Comune di Catania: dal 10 novembre lo sportello anagrafe riceve anche il sabato mattina. Prenotazioni e informazioni su www.comune.catania.it"
  ];
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (b) {
    b.addEventListener("click", function () { $("messaggio").value = ESEMPI[+b.getAttribute("data-es")]; verifica(); });
  });

  // ---------- risultato ----------
  var ETICHETTE = {
    ufficiale: ["Ufficiale", "ok"], sosia: ["Sito sosia", "ko"], pericoloso: ["Pericoloso", "ko"],
    sospetto: ["Sospetto", "warn"], accorciato: ["Link nascosto", "warn"], sconosciuto: ["Non ufficiale", "neutro"]
  };

  function schedaEnte(rif) {
    var nome, sito, pec, email, tipo;
    if (typeof rif === "string" && rif.indexOf("N:") === 0) {
      sito = rif.slice(2);
      var n = EnteVero.NAZIONALI.filter(function (x) { return x[0] === sito; })[0];
      nome = n ? n[1] : sito; tipo = "Servizio nazionale";
    } else {
      var e = dati.enti[rif]; if (!e) return null;
      nome = e[0]; tipo = e[1]; sito = e[2]; pec = e[3]; email = e[4];
    }
    var righe = [];
    if (sito) righe.push(el("li", null, ["Sito ufficiale: ", linkUfficiale(sito)]));
    if (pec) righe.push(el("li", null, ["PEC: ", el("span", { class: "mono", text: pec })]));
    if (email) righe.push(el("li", null, ["Email: ", el("span", { class: "mono", text: email })]));
    if (!righe.length) righe.push(el("li", { text: "Nessun recapito web registrato nell'Indice PA." }));
    return el("div", { class: "ente" }, [
      el("div", { class: "ente-nome", text: nome }),
      tipo ? el("div", { class: "ente-tipo", text: tipo }) : null,
      el("ul", null, righe)
    ]);
  }

  function consigli(livello) {
    var l = [];
    if (livello === "rosso" || livello === "arancio") {
      l.push("Non cliccare sui link, non rispondere e non chiamare i numeri indicati nel messaggio.");
      l.push("Se vuoi verificare, contatta l'ente con i recapiti ufficiali (qui sopra o nella sezione «Cerca un ente»).");
      l.push("Hai già inserito i dati della carta? Bloccala subito dall'app della banca o dal numero verde del circuito.");
      l.push("Hai inserito password o credenziali SPID? Cambiale subito e avvisa il tuo gestore di identità.");
      l.push("Puoi segnalare la truffa alla Polizia Postale su commissariatodips.it e avvisare l'ente imitato.");
      l.push("Poi cancella il messaggio, così nessuno in famiglia lo apre per errore.");
    } else {
      l.push("Anche se l'esito è rassicurante, non dare mai password, PIN o dati della carta via SMS o email.");
      l.push("Per pagare, entra tu nel sito dell'ente o nell'App IO, senza usare i link ricevuti.");
    }
    return el("ul", { class: "consigli" }, l.map(function (t) { return el("li", { text: t }); }));
  }

  function verifica() {
    var testo = $("messaggio").value;
    var box = $("risultato");
    box.textContent = "";
    if (!testo.trim()) { box.appendChild(el("p", { class: "vuoto", text: "Incolla prima il testo del messaggio." })); return; }
    var r = motore.analizza(testo);

    var card = el("div", { class: "esito esito-" + r.livello, tabindex: "-1" }, [
      el("div", { class: "esito-testa" }, [
        el("span", { class: "semaforo", "aria-hidden": "true" }),
        el("div", null, [el("h2", { text: r.titolo }), el("p", { text: r.sotto })])
      ])
    ]);

    var voci = r.link.map(function (x) { return ["Link", x.dominio, x]; })
      .concat(r.email.map(function (x) { return ["Email", x.indirizzo, x]; }));
    if (voci.length) {
      var sez = el("div", { class: "blocco" }, [el("h3", { text: "Indirizzi trovati nel messaggio" })]);
      voci.forEach(function (v) {
        var et = ETICHETTE[v[2].stato] || ETICHETTE.sconosciuto;
        sez.appendChild(el("div", { class: "voce" }, [
          el("div", { class: "voce-riga" }, [
            el("span", { class: "tipo", text: v[0] }),
            el("span", { class: "mono indirizzo", text: v[1] }),
            el("span", { class: "pill pill-" + et[1], text: et[0] })
          ]),
          el("ul", { class: "motivi" }, v[2].motivi.map(function (m) { return el("li", { text: m }); }))
        ]));
      });
      card.appendChild(sez);
    }

    if (r.campanelli.length) {
      var c = el("div", { class: "blocco" }, [el("h3", { text: "Campanelli d'allarme nel testo" })]);
      c.appendChild(el("ul", { class: "campanelli" }, r.campanelli.map(function (x) {
        return el("li", null, [el("span", { class: "ico", "aria-hidden": "true", text: x.icona }), x.testo]);
      })));
      card.appendChild(c);
    }

    // enti coinvolti: citati nel testo o imitati dai link
    var rif = r.enti.slice();
    r.link.concat(r.email).forEach(function (x) { if (typeof x.idx === "number" && x.idx >= 0 && rif.indexOf(x.idx) < 0) rif.push(x.idx); });
    var schede = rif.map(schedaEnte).filter(Boolean);
    if (schede.length) {
      var e = el("div", { class: "blocco" }, [el("h3", { text: "Recapiti ufficiali dell'ente (dall'Indice PA)" })]);
      schede.slice(0, 3).forEach(function (s) { e.appendChild(s); });
      card.appendChild(e);
    }

    card.appendChild(el("div", { class: "blocco" }, [el("h3", { text: "Cosa fare adesso" }), consigli(r.livello)]));
    card.appendChild(el("p", { class: "nota-limiti", text: "Valutazione automatica a scopo informativo, basata su dati pubblici: può sbagliare. Nel dubbio, contatta l'ente con i recapiti ufficiali." }));
    box.appendChild(card);
    card.focus({ preventScroll: true });
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("btn-verifica").addEventListener("click", verifica);
  $("btn-cancella").addEventListener("click", function () { $("messaggio").value = ""; $("risultato").textContent = ""; $("messaggio").focus(); });
  $("messaggio").addEventListener("keydown", function (ev) { if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) verifica(); });

  // ---------- cerca ente ----------
  var timer;
  $("cerca").addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var q = $("cerca").value, box = $("risultati-cerca");
      box.textContent = "";
      if (q.trim().length < 3) return;
      var idx = motore.cercaEnti(q, 15);
      // servizi nazionali
      EnteVero.NAZIONALI.forEach(function (n) {
        if (EnteVero.norm(n[1] + " " + n[0]).indexOf(EnteVero.norm(q)) >= 0) box.appendChild(schedaEnte("N:" + n[0]));
      });
      if (!idx.length && !box.childNodes.length) { box.appendChild(el("p", { class: "vuoto", text: "Nessun ente trovato. Prova con meno parole (es. «Catania» invece di «Comune di Catania centro»)." })); return; }
      idx.forEach(function (i) { box.appendChild(schedaEnte(i)); });
    }, 150);
  });
})();
