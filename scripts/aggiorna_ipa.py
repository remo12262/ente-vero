#!/usr/bin/env python3
"""Ente Vero — aggiornamento dei dati dall'Indice delle Pubbliche Amministrazioni (IPA).

Scarica l'elenco degli enti dal portale open data IPA (AgID) e genera data/enti.json
con, per ogni ente: denominazione, tipologia, sito istituzionale, PEC ed email generale.

Uso:
    python scripts/aggiorna_ipa.py                 # scarica dal portale IPA
    python scripts/aggiorna_ipa.py --csv enti.csv  # usa un file scaricato a mano

Non vengono salvati dati personali: niente nomi dei responsabili, solo recapiti dell'ente.
Dati: IndicePA – AgID, licenza CC BY 4.0.
"""
import argparse
import csv
import io
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
USCITA = RADICE / "data" / "enti.json"
UA = {"User-Agent": "EnteVero/1.0 (verifica anti-truffa, open data IPA)"}

# Portale open data IPA (CKAN). Si provano più indirizzi nel caso cambino.
BASI_CKAN = [
    "https://indicepa.gov.it/ipa-dati",
    "https://www.indicepa.gov.it/ipa-dati",
]

PROVIDER = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.it", "libero.it", "virgilio.it", "alice.it",
    "tim.it", "tiscali.it", "hotmail.com", "hotmail.it", "outlook.com", "outlook.it", "live.com",
    "live.it", "icloud.com", "aol.com", "fastwebnet.it", "email.it", "inwind.it", "pec.it",
    "legalmail.it", "arubapec.it", "pec.aruba.it", "postacert.it", "pec.libero.it", "cert.legalmail.it",
    "pec.actalis.it", "registerpec.it", "pecveneto.it", "gigapec.it", "sicurezzapostale.it",
    "pec.poste.it", "postecert.it", "messaggipec.it", "certificazioneposta.it", "mypec.eu", "cgn.legalmail.it",
}
PAROLE_PA = re.compile(r"comune|regione|provincia|asl|asp|ausl|ulss|ats|asst|ospedal|policlinic|"
                       r"universit|istruzione|scuola|\.gov\.it$|\.edu\.it$|ministero|inps|inail|agenzia")


def scarica(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def trova_risorsa_enti():
    """Cerca nel catalogo CKAN la risorsa 'Enti' in CSV."""
    errori = []
    for base in BASI_CKAN:
        for azione in ("package_show?id=enti", "package_search?q=enti&rows=50"):
            try:
                js = json.loads(scarica(f"{base}/api/3/action/{azione}"))
                ris = js.get("result", {})
                pacchetti = ris.get("results", [ris]) if isinstance(ris, dict) else []
                for p in pacchetti:
                    for r in p.get("resources", []):
                        nome = (r.get("name") or "") + " " + (r.get("description") or "")
                        fmt = (r.get("format") or "").lower()
                        url = r.get("url") or ""
                        if re.search(r"\benti\b", nome, re.I) and ("csv" in fmt or url.lower().endswith(".csv")):
                            if not re.search(r"\b(aoo|uo|unit|uffic|fattur)", nome, re.I):
                                return url
            except Exception as e:  # noqa: BLE001
                errori.append(f"{base}/{azione}: {e}")
    raise RuntimeError("Risorsa 'Enti' non trovata nel portale IPA.\n" + "\n".join(errori))


def colonna(intestazioni, *chiavi):
    for k in chiavi:
        for h in intestazioni:
            if re.sub(r"[^a-z0-9]", "", h.lower()) == re.sub(r"[^a-z0-9]", "", k.lower()):
                return h
    for k in chiavi:
        for h in intestazioni:
            if k.lower() in h.lower():
                return h
    return None


def dominio(v):
    v = (v or "").strip().lower()
    v = re.sub(r"^[a-z]+://", "", v)
    v = re.sub(r"^www\d?\.", "", v)
    v = re.split(r"[/?#:\s]", v)[0].strip(".")
    return v if "." in v else ""


def leggi_csv(contenuto: bytes):
    testo = None
    for cod in ("utf-8-sig", "latin-1"):
        try:
            testo = contenuto.decode(cod)
            break
        except UnicodeDecodeError:
            continue
    campione = testo[:5000]
    try:
        dialetto = csv.Sniffer().sniff(campione, delimiters=",;\t|")
    except csv.Error:
        dialetto = csv.excel
    return list(csv.DictReader(io.StringIO(testo), dialect=dialetto))


def costruisci(righe):
    if not righe:
        raise RuntimeError("File enti vuoto.")
    h = list(righe[0].keys())
    c_nome = colonna(h, "Denominazione_ente", "des_amm", "Denominazione")
    c_tipo = colonna(h, "Tipologia", "tipologia_istat", "Categoria")
    c_sito = colonna(h, "Sito_istituzionale", "sito_istituzionale", "Sito")
    c_mail = [x for x in h if re.search(r"mail", x, re.I) and not re.search(r"tipo", x, re.I)]
    c_tipomail = {x: colonna(h, "Tipo_" + x) for x in c_mail}
    c_liq = colonna(h, "Ente_in_liquidazione")
    if not c_nome:
        raise RuntimeError(f"Colonna della denominazione non trovata. Intestazioni: {h}")

    enti, uso_domini = [], Counter()
    mail_per_ente = []
    for r in righe:
        nome = (r.get(c_nome) or "").strip()
        if not nome:
            continue
        if c_liq and (r.get(c_liq) or "").strip().upper() in ("S", "SI", "TRUE", "1"):
            continue
        sito = dominio(r.get(c_sito)) if c_sito else ""
        pec, email, domini_mail = "", "", set()
        for cm in c_mail:
            v = (r.get(cm) or "").strip().lower()
            if "@" not in v:
                continue
            tipo = (r.get(c_tipomail.get(cm) or "") or "").lower()
            if ("pec" in tipo or ".pec." in v or "@pec" in v or "cert" in v.split("@")[1]) and not pec:
                pec = v
            elif not email:
                email = v
            domini_mail.add(v.split("@")[1])
        tipo = (r.get(c_tipo) or "").strip() if c_tipo else ""
        enti.append([nome, tipo, sito, pec, email])
        mail_per_ente.append(domini_mail)
        for d in domini_mail:
            uso_domini[d] += 1

    # domini email propri dell'ente (esclusi provider condivisi)
    domini_email = {}
    for i, dm in enumerate(mail_per_ente):
        for d in dm:
            condiviso = uso_domini[d] > 3 and not PAROLE_PA.search(d)
            if d in PROVIDER or condiviso:
                continue
            if d != enti[i][2] and d not in domini_email:
                domini_email[d] = i
    # i siti condivisi da troppi enti non identificano un ente (es. portali di servizio)
    uso_siti = Counter(e[2] for e in enti if e[2])
    for e in enti:
        if e[2] and (e[2] in PROVIDER or (uso_siti[e[2]] > 20 and not PAROLE_PA.search(e[2]))):
            e[2] = ""
    return enti, domini_email


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="file CSV degli enti scaricato a mano dal portale IPA")
    ap.add_argument("--demo", action="store_true", help="segna i dati come dimostrativi")
    a = ap.parse_args()

    if a.csv:
        contenuto = Path(a.csv).read_bytes()
        fonte_url = "file locale"
    else:
        fonte_url = trova_risorsa_enti()
        print("Scarico:", fonte_url)
        contenuto = scarica(fonte_url)

    enti, domini_email = costruisci(leggi_csv(contenuto))
    if not a.demo and len(enti) < 1000:
        raise RuntimeError(f"Solo {len(enti)} enti: dato anomalo, non sovrascrivo il file esistente.")

    out = {
        "aggiornato": date.today().isoformat(),
        "fonte": "IndicePA – Agenzia per l'Italia Digitale (AgID), licenza CC BY 4.0",
        "fonte_url": fonte_url,
        "demo": bool(a.demo),
        "campi": ["denominazione", "tipologia", "sito", "pec", "email"],
        "enti": enti,
        "domini_email": domini_email,
    }
    USCITA.parent.mkdir(parents=True, exist_ok=True)
    testo = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    USCITA.write_text(testo, encoding="utf-8")
    # stessa cosa come script JS: così il sito funziona anche aprendo index.html dal computer
    USCITA.with_suffix(".js").write_text("window.ENTI_DATI=" + testo + ";", encoding="utf-8")
    print(f"Scritti {len(enti)} enti e {len(domini_email)} domini email in {USCITA} "
          f"({USCITA.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print("ERRORE:", e, file=sys.stderr)
        sys.exit(1)
