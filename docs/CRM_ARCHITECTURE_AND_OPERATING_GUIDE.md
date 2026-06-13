# CRM Architecture & Operating Guide

Tento dokument je referenčný manuál pre AI aj ľudí, ktorí budú upravovať toto CRM. Slúži ako zdroj pravdy pre architektúru, dátové väzby, workflowy, pravidlá zmien a prevádzkové zásady. Pred každou väčšou úpravou CRM sa má tento dokument prečítať a rešpektovať.

## Účel systému

CRM je interný prevádzkový a obchodný systém pre správu:
- leadov,
- klientov,
- projektov,
- hostingov,
- prenájmov webov,
- provízií a odmien realizátorov,
- komunikácie,
- úloh,
- prístupov a hesiel,
- finančných väzieb a prehľadov.

Cieľ systému nie je iba evidencia záznamov, ale prepojenie obchodných, realizačných a finančných dát do jedného konzistentného pracovného prostredia.

## Základné princípy architektúry

### 1. Jedna entita, jeden význam
Každá tabuľka a UI sekcia má mať jasný účel. Nepridávať paralelné štruktúry, ktoré duplikujú už existujúcu doménu.

### 2. Additive-first vývoj
Zmeny schémy majú byť primárne aditívne:
- pridávať nové nullable stĺpce,
- pridávať nové tabuľky,
- robiť bezpečné backfilly,
- neprepisovať a nemažť produkčné dáta bez explicitného migračného plánu.

### 3. Sekčný pohľad vs globálny pohľad
V sekciách sa zobrazujú iba dáta patriace danej entite. Globálna agregácia patrí do financií alebo do klientského 360 pohľadu.

### 4. Golden-record prístup pri klientoch
Jeden reálny klient má byť reprezentovaný jedným kanonickým zákazníckym záznamom, ak je to možné. Priorita identity je:
1. `customer_id`
2. normalizovaný email
3. explicitný manuálny link
4. opatrná name heuristika

### 5. Legacy kompatibilita bez zamlčania reality
Staré záznamy sa nesmú tváriť ako plne prepojené nové záznamy. Legacy riadky majú zostať čitateľné, ale jasne označené.

### 6. Shared komponenty pred duplicáciou
Ak existuje zdieľaná logika alebo formulár, má sa rozšíriť shared komponent, nie vytvárať ďalšia sekčne špecifická kópia.

## Hlavné doménové oblasti

## Leady
Leady sú vstupný obchodný kontakt. Môžu byť neskôr povýšené alebo previazané na klienta.

Súvisiace oblasti:
- `leads`
- `lead_logs`
- `tasks`
- `communication_events`
- klientsky linking cez `customer_id`

## Klienti
Klienti predstavujú zjednotenú identitu naprieč projektmi, hostingom, prenájmami, províziami a komunikáciou.

Dôležité pravidlá:
- klient nemá byť duplikovaný medzi sekciami,
- klientský zoznam je cross-section pohľad,
- Customer 360 zhromažďuje súvisiace dáta cez `customer_id`, email a bezpečné sekundárne väzby.

## Projekty
Projekty sú primárne záznamy o realizácii zákazky. Používa sa tabuľka `project_notes`, ktorá dnes neslúži len na poznámky, ale aj na project-centric evidenciu.

Dôležité polia:
- `project_type`
- `customer_email`
- `customer_id`
- `lead_id`

Projekt má mať detail pohľadu s kartami typu:
- Prehľad,
- Poznámky,
- Provízie,
- Súvisiace,
- Heslá / prístupy.

## Hosting
Hosting je samostatná prevádzková entita a nesmie byť implicitne chápaný ako projekt. Hosting môže existovať aj bez projektu.

Dôležité pravidlá:
- hosting má vlastný detail,
- hosting má vlastné provízie,
- hosting väzby na projekt sú len explicitné alebo heuristické a heuristiky sa nesmú tváriť ako potvrdený link.

## Prenájmy
Prenájmy reprezentujú weby alebo prenájmové entity. Historicky obsahujú aj špecifickú logiku realizátorov a podielov.

Aktuálny stav:
- časť logiky provízií žije v normalizovanej `commissions` tabuľke,
- časť percentuálnych podielov zostáva v `rental_websites.implementers` JSON modeli,
- tento dual model je dočasne akceptovaný, ale musí byť rešpektovaný pri úpravách.

## Provízie
Tabuľka `commissions` je normalizovaná vrstva na odmeny a provízie. Nejde len o prenájmy, ale o cross-entity model.

Dôležité polia:
- `implementer`
- `amount`
- `payment_form`
- `status` alebo paid/unpaid logika
- `date`
- `note`
- `source_type`
- `source_id`
- `customer_email`
- `customer_id`

### Pravidlá provízií
- v sekcii prenájmy sa zobrazujú len rental provízie,
- v hostingu len hosting provízie,
- v projektoch len project provízie,
- legacy alebo unlinked riadky sa nesmú miešať medzi sekčné riadky bez označenia,
- vo financiách sa naopak zobrazuje agregovaný cross-section pohľad podľa realizátora.

## Financie
Financie sú globálna vrstva. Tu je správne robiť cross-section agregáciu.

Sem patrí:
- payout/payment facts,
- cost records,
- payment records,
- payout records,
- implementer drill-down,
- review items,
- policy a governance vrstva.

### Pravidlá financií
- financie agregujú cez všetky sekcie,
- klik na realizátora má otvoriť detail všetkých relevantných provízií a odmien,
- každá položka v detaile musí byť identifikovateľná podľa zdroja a klienta.

## Komunikácia
`communication_events` je komunikačný timeline model.

Obsahuje komunikáciu naviazanú na leady alebo klientov. Má byť použitý ako časová os, nie ako izolovaná poznámka bez väzieb.

## Úlohy
Úlohy ostávajú samostatnou prevádzkovou vrstvou, ale majú byť prepojené s klientom, leadom alebo relevantnou entitou, ak je to možné.

## Prístupy a heslá
Prístupy a heslá už nesmú byť len jediné tri polia URL / meno / heslo. Model musí podporovať viacero credential riadkov.

Každý credential riadok má mať:
- label alebo účel,
- URL alebo systém,
- login / email,
- password,
- poznámku.

Zachováva sa backward kompatibilita so starým modelom synchronizáciou prvého riadku do legacy polí.

## Kľúčové dátové väzby

## Customer identity väzby
Priorita väzieb:
1. `customer_id`
2. `customer_email`
3. explicitný picker link
4. opatrné heuristiky cez meno

Nikdy nepridávať novú logiku, ktorá bude mať vyššiu dôveru než `customer_id` alebo email bez veľmi dobrého dôvodu.

## Source väzby pri províziách
Každá nová provízia má mať, ak je to možné:
- `source_type`
- `source_id`
- `customer_id` alebo `customer_email`

Nové neprepojené legacy riadky sa nemajú vytvárať, ak tomu nebráni výnimočný business dôvod.

## Project / Hosting / Rental väzby
- projekt a hosting sú samostatné entity,
- prenájmy majú vlastný model,
- klientský 360 pohľad ich môže zjednotiť, ale zdrojová entita sa nesmie stratiť.

## Workflowy systému

## 1. Lead workflow
1. Vytvorenie leadu.
2. Zaznamenanie logov alebo komunikácie.
3. Priradenie klienta alebo vytvorenie klienta.
4. Premena na realizáciu: projekt, hosting alebo prenájom.
5. Následné zobrazenie v klientskom timeline.

## 2. Projekt workflow
1. Vytvorenie projektu.
2. Nastavenie typu projektu.
3. Priradenie klienta cez picker.
4. Voliteľné napojenie na lead.
5. Správa poznámok, credentials a provízií.
6. Zobrazenie v Customer 360 a vo financiách.

## 3. Hosting workflow
1. Vytvorenie hostingu.
2. Výber klienta cez picker.
3. Správa hosting detailu.
4. Pridanie hosting provízií.
5. Zobrazenie v klientskom detaile a vo financiách.

## 4. Rental workflow
1. Vytvorenie alebo editácia prenájmu.
2. Priradenie klienta, ak je známy.
3. Evidencia realizátorov a podielov.
4. Zobrazenie rental-linked provízií v sekcii.
5. Prenos agregácie do financií.

## 5. Commission workflow
1. Vznik provízie z konkrétnej sekcie alebo z workbenchu.
2. Povinné overenie implementera.
3. Doplnenie source väzieb a klienta.
4. Zobrazenie v sekčnej entite podľa source typu.
5. Zobrazenie vo financiách pod realizátorom.

## 6. Customer 360 workflow
1. Načítať klienta podľa `customer_id` alebo email identity.
2. Zobraziť súvisiace leady, projekty, hostingy, prenájmy, provízie, úlohy a komunikáciu.
3. Nezobrazovať duplicity tej istej identity, ak už boli bezpečne zlúčené v browse vrstve.

## 7. Credentials workflow
1. Pri projekte alebo relevantnej entite pridávať ľubovoľný počet credential riadkov.
2. Každý riadok má mať význam a účel.
3. Po uložení sa majú dáta vedieť znovu načítať bez straty kompatibility.

## Prevádzkové pravidlá pre úpravy

## Pred každou úpravou
Pred zmenou CRM treba overiť:
- či už neexistuje shared komponent alebo helper,
- či zmena neporušuje sekčný scope dát,
- či sa nemení customer identity precedence,
- či sa nevytvára nová paralelná tabuľka alebo model bez nutnosti,
- či zmena zachová legacy kompatibilitu tam, kde je potrebná.

## Zakázané typy zmien bez explicitného schválenia
- deštruktívne migrácie na produkčných tabuľkách,
- mazanie alebo premenovanie polí bez migračného plánu,
- nové sekčne špecifické formuláre tam, kde existuje shared model,
- tiché miešanie legacy a linked dát bez labelov,
- auto-merge klientov bez guardrailov,
- heuristické spájanie entít prezentované ako potvrdený link,
- reset alebo seed produkčných dát.

## Požadovaný štandard implementácie
Každá zmena má:
- mať jasný business dôvod,
- rešpektovať existujúcu architektúru,
- používať shared helpery a shared UI tam, kde dávajú zmysel,
- obsahovať testy pri kritickej business logike,
- mať migration-first prístup pri databázových zmenách,
- zachovať mobilnú použiteľnosť adminu.

## Pravidlá pre migrácie
- každá migrácia musí byť aditívna alebo bezpečne backfillová,
- produkčné dáta sa nesmú poškodiť,
- backfill pravidlá musia byť konzervatívne,
- schema reload a následný smoke test sú povinné,
- ak migrácia zlyhá, treba riešiť konkrétny filename a konkrétnu SQL chybu.

## Pravidlá pre AI asistenta pri úpravách
AI má pred každou väčšou zmenou:
1. prečítať tento dokument,
2. identifikovať dotknutú doménu,
3. pomenovať riziká pre existujúce väzby,
4. navrhnúť additive riešenie,
5. zohľadniť legacy kompatibilitu,
6. zohľadniť mobil a admin UX,
7. nepredpokladať, že preview DB a produkčná DB sú rovnaké bez overenia.

AI nesmie:
- zavádzať nové identity pravidlá bez rešpektovania golden-record precedence,
- rozbíjať source logiku provízií,
- zdvojovať klientov medzi sekciami,
- meniť shared workflow na sekčný workaround bez dôvodu,
- ignorovať existujúce migračné batche a release poznámky.

## Známe stabilné architektonické rozhodnutia

### RC4
- section-scoped commission filtering,
- shared commission fields,
- unified clients browse grid,
- multi-row credentials,
- mobile admin zlepšenia.

### RC5
- customer identity precedence,
- duplicate prevention guardrails,
- rental customer identity krok,
- normalized commission insert payload,
- rollout health identity metriky.

### RC6
- **Profit model:** `operating_cost` on `hosting_records` and `project_notes`; profit = max(0, revenue − operating_cost). Hosting revenue base = `monthly_price`; project revenue base = sum of linked `payment_records`.
- **RBAC:** roles `admin` | `user` via `user_roles`; `team_profiles` maps auth user → `implementer_name` for commission/finance scoping. Settings and user management are admin-only. Role `user` sees only own commissions (RLS + UI filter).
- **Email integration contract:** `user_email_accounts` per user with status `connected` | `disconnected` | `error` | `pending`; Settings UI ready; provider sync is stub (`manual` / pending).
- **Communication handoff:** `customer_communication_summaries` with rolling summary, decisions, open topics, next steps; deterministic rebuild from `communication_events` (LLM can replace builder later).
- **Paid/unpaid:** rental implementer dialog toggles `commissions.payment_status`; Finance totals use shared `payment_status` field.
- **Workbench UX:** communication summary panel replaces user-facing rollout/comm-ops links (admin diagnostics remain dev/admin routes).

### RC6.5
- **Route access helpers:** `routeAccess.ts` + `useAccessContext`; `AdminOnlyGate` on critical routes (superseded by `ProtectedAdminOutlet` in RC6.6).
- **Finance scope:** role=user sees only own commission totals; org-wide rental KPIs hidden.
- **Profit fallbacks:** `profitContext.ts` — safe display when revenue/cost basis missing.
- **Team profile guardrails:** `TeamProfileNotice`, scoped empty states, `TeamSetupDiagnostics`.
- **Commission consistency:** `commissionConsistency.ts` — dual-model warnings.

### RC6.6
- **Route model:** all `/admin/*` routes under `ProtectedAdminOutlet`; `canAccessRoute()` is single enforcement point.
- **Audit trail:** `admin_audit_log` — role/profile/commission status changes; admin-only read in Settings.
- **Write helpers:** `writePermissions.ts` — UI aligned with admin-only commission RLS.
- **Governance:** Access review panel + confirm dialogs for privileged changes.
- ADR: `docs/adr/RC66-audit-trail-access-governance.md`

Tieto rozhodnutia sa považujú za stabilné a nové zmeny ich nemajú obchádzať, ale rozvíjať.

## Budúci odporúčaný smer
Ďalší vývoj má smerovať najmä do:
- bezpečného customer merge workflow,
- FK repointingu na canonical customer,
- ďalšej redukcie legacy commission creation,
- postupnej normalizácie rental špecifík,
- **IMAP/OAuth email provider sync** a automatic summary updates,
- **commission write RLS** for role=user if needed,
- data quality governance a health metrík,
- bezpečného production rollout procesu.

## Definícia úspechu
CRM sa považuje za správne navrhnuté a upravené vtedy, keď:
- sekcie ukazujú len svoje relevantné dáta,
- financie vedia robiť globálny drill-down,
- klient existuje čo najviac ako jedna identita,
- nové záznamy sú viac linked a menej legacy,
- AI ani developer nevytvárajú paralelné architektúry,
- zmeny sú procesné, testované a spätne kompatibilné,
- produkčné dáta zostávajú chránené.

## Odporúčanie pre uloženie v repozitári
Tento dokument uložiť napríklad ako:
- `docs/CRM_ARCHITECTURE_AND_OPERATING_GUIDE.md`

Voliteľne sa dá doplniť aj krátky súbor:
- `docs/AI_CHANGE_GUARDRAILS.md`

ktorý bude obsahovať len stručné pravidlá pre AI pri každej zmene.
