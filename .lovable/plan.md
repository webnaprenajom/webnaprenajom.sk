## Cieľ
Po zatočení kolesom šťastia a získaní zľavy automaticky zobraziť rovnaký 2-krokový pop-up (`OfferRedeemDialog`) ako pri CTA z e-mailovej ponuky — s predvyplneným zľavovým kódom (kupónom z výhry), aby návštevník mohol rovno odoslať dopyt.

## Zmeny

### 1. `src/components/OfferRedeemDialog.tsx` — pridať programové otvorenie
Dialog momentálne reaguje len na `?discount=` v URL. Pridať druhý spôsob otvorenia cez globálny custom event, aby sa dal volať odkiaľkoľvek:

- V `useEffect` zaregistrovať listener na `window` event `"open-offer-redeem"` s `event.detail.code`.
- Pri prijatí: nastaviť `discountCode` a `setOpen(true)`, krok zostane `offer`.

### 2. `src/components/WheelOfFortuneSection.tsx` — nahradiť tlačidlo "Super, idem si objednať"
Vo víťaznej vetve (`result.prize.value > 0`) zmeniť handler tlačidla:
- Namiesto `reset()` zavolať `window.dispatchEvent(new CustomEvent("open-offer-redeem", { detail: { code: result.prize.coupon } }))`.
- Text tlačidla upraviť na: **„Uplatniť zľavu a poslať dopyt"**.
- Pôvodný `reset` ponechať dostupný cez sekundárny `Button variant="ghost"` s textom „Zavrieť" (drobný link).

### Technické detaily
- Custom event je čisto klientový — žiadne nové závislosti, žiadne zmeny v Supabase ani v `App.tsx` (dialog je už globálne mount-nutý).
- Kód kupónu je už uppercase (`WIN10-XXXXX`), takže pasuje do existujúceho `discountCode` poľa.
- Po odoslaní dopytu prejde užívateľ rovnakým „success" krokom v dialogu — žiadna ďalšia logika netreba.

## Mimo rozsahu
- Lokalizované verzie (`/en`, `/de`) — Wheel of Fortune sa zobrazuje len na SK domovskej stránke.
- Žiadne zmeny v edge funkciách `wheel-spin` ani `send-lead-email`.