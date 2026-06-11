/** RC1 release notes — rendered in admin rollout view. */

export type ReleaseNoteSection = {
  id: string;
  title: string;
  bullets: string[];
};

export const RELEASE_NOTES_RC1: ReleaseNoteSection[] = [
  {
    id: "nav",
    title: "Bočná navigácia",
    bullets: [
      "Jednotný sidebar: Operatíva (Dnes, Leady, Klienti, Úlohy), Dodávky (Projekty, Prenájmy, Hosting), Financie, Nástroje.",
      "Staré cesty (/admin/commissions) presmerujú do Financií.",
    ],
  },
  {
    id: "finance",
    title: "Zjednodušenie financií",
    bullets: [
      "Provízie a náklady sú v module Financie — pokročilý režim pre reconciliation, settlement a governance.",
      "Potvrdené fakty (payment/payout/cost) sú oddelené od legacy importu a workflow záznamov.",
    ],
  },
  {
    id: "deliveries",
    title: "Projekty / prenájmy / hosting",
    bullets: [
      "Tri samostatné moduly v sekcii Dodávky namiesto jedného zmiešaného prehľadu.",
      "Detail entity zobrazuje prepojené provízie a zákazníka kde je k dispozícii.",
    ],
  },
  {
    id: "commissions",
    title: "Provízie a prepojenie zdroja",
    bullets: [
      "Provízia by mala mať source_type + source_id (projekt, prenájom, hosting).",
      "Legacy riadky bez zdroja zostávajú viditeľné — dopĺňajte pri úpravách, nie hromadne.",
    ],
  },
  {
    id: "workbench",
    title: "Zákaznícky workspace (360°)",
    bullets: [
      "Kanónická cesta: /admin/customers/:uuid. Legacy e-mail: /admin/customer/:email.",
      "Záložky: Prehľad, Komunikácia, Projekty, Prenájmy, Hosting, Financie, Úlohy, História.",
      "Rýchle vytvorenie úlohy, projektu, prenájmu, hostingu alebo provízie s predvyplneným klientom.",
      "URL stav: ?tab= a ?comm= pre zdieľateľné deep linky.",
    ],
  },
  {
    id: "communication",
    title: "Komunikačná časová os",
    bullets: [
      "Filtre: prichádzajúce, odchádzajúce, neprepojené, vo vlákne.",
      "Operácie inbound e-mailov: /admin/communication-ops (incidenty, reconciliácia).",
    ],
  },
  {
    id: "tasks",
    title: "Prepojenie úloh",
    bullets: [
      "Nové pole tasks.customer_id — ukladá sa pri vytvorení/úprave z pickera alebo workspace.",
      "Bezpečný backfill len cez lead.customer_id; meno klienta samo o sebe nestačí.",
    ],
  },
];

export const RC1_QA_CHECKLIST = [
  "Otvoriť /admin/customers/:uuid — všetky záložky workspace, metriky a quick-create.",
  "Otvoriť /admin/customer/:email — legacy režim, rovnaký workspace.",
  "Deep link ?tab=komunikacia&comm=unlinked — filter komunikácie sa obnoví.",
  "/admin/commissions → redirect na Financie / provízie.",
  "Vytvoriť úlohu z workspace — customer_id sa uloží.",
  "Communication ops — zobrazí neprepojené inbound a incidenty.",
  "Stav CRM (/admin/rollout-health) — legacy checklist bez chýb načítania.",
];
