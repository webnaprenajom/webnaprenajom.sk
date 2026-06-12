# AI Change Guardrails

Tento súbor obsahuje povinné pravidlá pre AI asistenta, developera a každého, kto upravuje CRM.

## Povinné pravidlo aktualizácie dokumentácie

Ak sa pri úprave CRM zmení čokoľvek z nasledujúceho, musí sa v tom istom pracovnom kroku aktualizovať aj dokumentácia:
- architektúra systému,
- dátový model,
- databázové tabuľky alebo stĺpce,
- identity pravidlá klientov,
- prepojenia medzi sekciami,
- workflowy používateľov,
- shared komponenty a shared business logika,
- pravidlá provízií, financií alebo klientských väzieb,
- mobilné UX správanie pri kľúčových workflowoch,
- prevádzkové alebo migračné pravidlá.

## Povinnosť AI po každej významnej zmene

AI musí po každej významnej zmene urobiť všetky tieto kroky:
1. identifikovať, ktoré časti architektúry boli zmenené,
2. zistiť, či je potrebné upraviť `docs/CRM_ARCHITECTURE_AND_OPERATING_GUIDE.md`,
3. ak ide o významné rozhodnutie, vytvoriť alebo aktualizovať ADR v `docs/adr/`,
4. doplniť alebo upraviť release notes,
5. vo výstupe explicitne uviesť, ktoré dokumentačné súbory boli zmenené.

## Zákaz nezdokumentovaných architektonických zmien

AI nesmie urobiť významnú zmenu v týchto oblastiach bez aktualizácie dokumentácie:
- customer identity logika,
- source logika provízií,
- zákaznícke dedupe pravidlá,
- shared form modely,
- entity detail workflowy,
- finančné agregácie,
- klientsky 360 pohľad,
- credentials model,
- databázové migrácie s dopadom na business logiku.

## Povinný výstup AI pri architektonickej zmene

Ak AI robí väčšiu zmenu, na konci musí uviesť sekciu v tomto tvare:

### Documentation updates required
- Updated: `docs/CRM_ARCHITECTURE_AND_OPERATING_GUIDE.md`
- Updated: `docs/AI_CHANGE_GUARDRAILS.md` (if needed)
- Added/Updated ADR: `docs/adr/...`
- Updated release notes: `scripts/RELEASE_NOTES_....md`

Ak dokumentácia nebola potrebná meniť, AI musí explicitne napísať:

### Documentation review
No architecture or workflow documentation changes required for this batch.

## Definícia významnej zmeny

Za významnú zmenu sa považuje akákoľvek zmena, ktorá:
- mení význam entity alebo sekcie,
- mení väzby medzi tabuľkami alebo doménami,
- mení spôsob, ako sa vytvárajú alebo linkujú klienti,
- mení scope dát v sekcii alebo vo financiách,
- zavádza nový shared helper alebo ruší starý shared helper,
- mení spôsob, ako sa vytvárajú provízie,
- mení spôsob, ako sa agregujú alebo filtrujú dáta,
- mení dôležitý create/edit workflow.

## Procesné pravidlo

Žiadny významný batch sa nepovažuje za dokončený, kým nie sú aktualizované:
- architecture guide,
- ADR záznamy, ak sú potrebné,
- release notes.

## Priorita pri konflikte

Ak vznikne konflikt medzi rýchlou implementáciou a zachovaním architektonickej konzistencie, prioritu má architektonická konzistencia, spätná kompatibilita a ochrana produkčných dát.
