# Heinrichshof Ads-Landingpages

Die neue Struktur erzeugt mehrere stabile Kampagnen-URLs aus einem gemeinsamen Design und zentral gepflegten Inhalten.

## Bestehende Kampagnen-URLs

- `/de/`
- `/de/algund/`
- `/de/ferienwohnung/`
- `/de/urlaub-mit-hund/`
- `/de/voucher/`
- `/en/`
- `/en/uk/`
- `/it/`
- `/nl/`

Zusätzlich werden die festen Saisonseiten `/de/fruehling/`, `/de/sommer/` und `/de/herbst/` gebaut.

## Saisonwechsel

Die dynamischen Kampagnenseiten behalten immer ihre URL. Mit `seasonMode: "auto"` wird die Saison beim Build anhand des Datums gewählt:

- Frühling: ab 7. Januar
- Sommer: ab 1. Juni
- Herbst inklusive Winterzauber: ab 20. August bis 6. Januar

Die Grenzen liegen zentral in `src/data/config.json`. Ein neuer Build beziehungsweise ein neues Deployment übernimmt die zu diesem Zeitpunkt passende Saison. Für einen Wechsel ganz ohne neuen Push wird später nur noch ein geplanter Deployment-Trigger benötigt.

Soll die Saison bewusst festgesetzt werden, `seasonMode` auf `manual` stellen und `activeSeason` auf `fruehling`, `sommer` oder `herbst` setzen. Die drei festen Saisonseiten verwenden unabhängig davon immer ihre eigene Saison.

## Angebote pflegen

Angebote liegen einmalig in `src/data/offers.json`. Jede Pauschale besitzt:

- Aufenthaltszeitraum: `stayFrom` und `stayTo`
- sichtbaren Werbezeitraum: `displayFrom` und `displayUntil`
- passende Kampagnenthemen in `audiences`
- passende Jahreszeiten in `seasons`
- einen zentralen Aktiv-Schalter `enabled`

Die Seiten zeigen ein Angebot nur innerhalb des Anzeigezeitraums. Das wird sowohl beim Erzeugen der Seiten als auch täglich im Browser geprüft. Abgelaufene Angebote verschwinden daher ohne Änderungen an einzelnen HTML-Dateien.

Mit `"audiences": ["all"]` erscheint ein Angebot auf allen Landingpages der eingetragenen Saison. Statt `all` können auch einzelne Zielgruppen wie `algund`, `ferienwohnung` oder `urlaub-mit-hund` hinterlegt werden.

Die drei Angebote und ihre Originalbilder wurden am 24.08.2026 von `https://www.heinrichshof.com/de/wohnen/angebote` aktualisiert.

## Bilder

Neue Originalbilder kommen in den zentralen Ordner `../assets`. Die für die Landingpages ausgewählten Originale liegen mit kurzen Dateinamen in `src/source-images`; Übergangsbilder in `../lp-alt/assets` bleiben als Rückfall erhalten.

Nach der Bildauswahl optimiert `npm run images` alle tatsächlich verwendeten Dateien in zwei responsive WebP-Größen. Die Bilder werden in `src/images` gespeichert und können anschließend mit dem Projekt versioniert werden.

## Gemeinsame Funktionen

- Alle Anfrageformulare verwenden `src/scripts/form.js`.
- Jeder erfolgreiche Lead löst `form_lead_success` aus.
- Das offizielle Booking-Südtirol-Widget wird auf jeder Seite erst kurz vor dem Buchungsbereich geladen.
- Eine erfolgreiche Widget-Anfrage löst ebenfalls `form_lead_success` aus.
- Footer, Kontaktdaten, Datenschutz und Buchungsdaten werden zentral aus `src/data/site.json` erzeugt.
- Hotelinfos, Hundeinfos, Ferienwohnungsinfos, Zimmerkarten und die deutschen Galerien liegen zentral in `src/data/content.json`.
- Übersetzte Bedienoberflächen, Hotelinfos, Zimmer, Galerien und Angebotstexte für EN, IT und NL liegen zentral in `src/data/locales.json`.
- Die Ferienwohnungs-LP verwendet ausschließlich das Appartement-Profil; die Hunde-LP besitzt ein eigenes Regel- und Infoprofil. Alle anderen deutschen LPs verwenden das gemeinsame Hotelprofil.
- Das Original-Logo liegt in `src/static/logo.png`. Desktop zeigt der feste Header „Direkt buchen“ und „Jetzt anfragen“; mobil ausschließlich Logo und Anfrage-CTA.
- Die Galerie erscheint am Desktop als großzügiges Raster und bleibt auf Mobilgeräten ein wischbarer Slider.
- CSS und JavaScript erhalten beim Build automatisch eine Inhaltsversion, damit Browser nach einem Deployment keine veralteten Dateien verwenden.

## Lokale Verwendung

- `npm run dev` startet die lokale Vorschau.
- `npm run build` erzeugt den fertigen statischen Ordner `dist`.
- `npm run check` prüft alle Routen, Sprungziele, Assets und Angebotszeiträume.

Für ein neues GitHub-Repo den Inhalt dieses Ordners als Repository-Wurzel verwenden. `dist`, `node_modules` und `.vercel` sind über `.gitignore` ausgeschlossen und werden nicht mitgepusht.

Die vorhandenen Dateien in `lp-alt` werden nicht verändert.
