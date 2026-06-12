# ADR 0003: Section-Scoped Commissions with Cross-Section Finance View

## Status
Accepted

## Context
CRM zobrazuje provízie v sekciách Prenájmy, Hosting, Projekty a zároveň potrebuje globálny finančný pohľad podľa realizátora.

## Decision
Sekčné obrazovky zobrazujú iba provízie patriace danej entite alebo source typu. Cross-section agregácia patrí výhradne do finančných pohľadov.

## Consequences
- Prenájmy zobrazujú len rental-linked provízie.
- Hosting zobrazuje len hosting-linked provízie.
- Projekty zobrazujú len project-linked provízie.
- Financie môžu agregovať naprieč všetkými source typmi.
- Legacy riadky sa nesmú tváriť ako sekčne linked dáta bez označenia.
