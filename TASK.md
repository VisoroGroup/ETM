# TASK.md

> A `CLAUDE.md` 6. szekciója szerint: minden feladat előtt nézd át
> ezt a fájlt. Ha a feladat nincs itt, add hozzá.
>
> **Append-only.** Ne töröld a kész feladatokat — mozgasd a "Done"
> szekcióba.
>
> **Státuszok:** `[ ]` todo · `[~]` folyamatban · `[x]` kész · `[!]` blokkolt · `[-]` törölve

---

## Active

(nincs aktív feladat)

---

## Backlog

### `[ ]` Angol nyelv kivétele a választható nyelvek közül
- **Hozzáadva:** 2026-05-29
- **Megjegyzés:** Az EN csak ~9%-ban van lefordítva (93/1001 string), senki nem
  használja (Robert, 2026-05-29). Kivesszük a nyelvválasztóból; nem fordítjuk le.
  Előbb ellenőrizni: van-e cég `language='en'`-re állítva — ha igen, románra/
  magyarra kell állítani, mielőtt az opció eltűnik.

### `[ ]` Megfontolandó: közös `authedFetch` wrapper
- **Hozzáadva:** 2026-05-29
- **Megjegyzés:** Ha harmadszor is felbukkan a "raw fetch kihagyta az
  X-Active-Company headert" osztályú bug, érdemes közös wrappert csinálni.
  Lásd brain `2026-05-29-attachment-tenant-header`. Addig (Simplicity, CLAUDE.md 3. §) nem.

---

## Blocked

(nincs)

---

## Done

### `[x]` Projekt alapfájlok felépítése a meglévő kódból
- **Hozzáadva / kész:** 2026-05-29
- **Megjegyzés:** `PLANNING.md`, `TASK.md`, `examples/README.md`, `PRPs/README.md`
  felépítve a futó kódból (nem interjúval). Robert átnézte és jóváhagyta.

### `[x]` PROJECT.md elavultnak jelölése
- **Hozzáadva / kész:** 2026-05-29
- **Megjegyzés:** Megtartva történeti rekordként, a tetejére "ELAVULT" sáv került.
  A PLANNING.md a hivatalos forrás. (Robert rám bízta a döntést.)

### `[x]` Csatolmány megnézés/letöltés cross-tenant 404 fix + PDF-előnézet hiba-ág
- **Hozzáadva / kész:** 2026-05-29
- **Commit:** ca3e891
- **Megjegyzés:** A raw fájl-fetch kihagyta az `X-Active-Company` headert,
  ezért multi-céges usernél a nem-első cég csatolmánya 404-elt. Plusz a
  PDF-előnézet most hibát mutat a végtelen "Betöltés..." helyett.

---

## Cancelled

### `[-]` Payments / Financiar modul
- **Megjegyzés:** A 2026-03 verzióban létezett (route + dashboard), a kódból
  eltávolították. A törlés oka nincs dokumentálva — lásd PLANNING.md Nyitott
  kérdések. Itt csak a tény rögzítve, hogy a jövő ne keresse hiába.
