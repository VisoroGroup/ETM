# AGENTS.md — First-Run Setup Protocol

> Ezt a fájlt a Claude Code akkor olvassa el, amikor a `CLAUDE.md`
> 1. szekciója (First-Run Protocol) idehívja. A protokoll csak egyszer
> fut le projektenként — az első session elején, amikor a projekt
> alapfájljai (PLANNING.md, TASK.md, examples/, PRPs/) még nincsenek
> kitöltve.
>
> **A teljes interjú magyarul folyik.** Robert nem programozó —
> az ő nyelvén kell kérdezni és magyarázni. Soha ne használj
> szakzsargont magyarázat nélkül.
>
> **Az interjú adaptív.** Ne kérdezz mindent fixen. A projekt
> komplexitása dönti el, milyen mélyen menj. Egy egyszerű script
> 5 kérdést igényel; egy webalkalmazás 15-öt.

---

## A protokoll célja

A protokoll végén ezeknek a fájloknak kell létezniük és kitöltve lenniük:

1. **`PLANNING.md`** — projekt-architektúra, célok, tech stack, korlátok
2. **`TASK.md`** — futó feladatlista, az első konkrét feladatokkal
3. **`examples/README.md`** — útmutató a minták mappához
4. **`PRPs/README.md`** — útmutató a feature-tervek mappához
5. **`brain/README.md` és `brain/INDEX.md`** — session-emlékezet rendszer
   (a globális `~/.claude/CLAUDE.md` írja le a részleteket; itt csak
   bootstrapelni kell)

Ha ezek a végén megvannak és Robert jóváhagyta őket, a protokoll
kész. **Csak ezután** szabad bármilyen kódot írni vagy más feladatot
elkezdeni.

---

## A protokoll lépései

### 0. lépés — Köszönés és kontextus

Mielőtt kérdezel, mondd meg Robertnek **röviden, egyszerűen**, hogy mi
fog történni. Példa-szöveg (használd ezt vagy ehhez hasonlót):

> Robert, mielőtt nekikezdek bárminek, fel kell építenünk a projekt
> alapjait. A `CLAUDE.md` szabályai szerint létezniük kell bizonyos
> fájloknak, amik elmondják nekem, mit építünk, hogyan, és milyen
> szabályok szerint. Ezeket most együtt fogjuk kitölteni.
>
> Néhány kérdést fogok feltenni, te a saját szavaiddal válaszolsz —
> nem kell hozzá semmilyen technikai tudás. Én megírom a fájlokat
> a válaszaid alapján, és a végén megmutatom, hogy jóváhagyd.
>
> Nagyjából 5–15 perc. Kezdhetjük?

Várd meg a megerősítést, mielőtt a következő lépésre lépsz.

### 1. lépés — Az alap három kérdés (mindig kötelező)

Tedd fel **egyenként, egymás után**, ne egyszerre. Várd meg minden
válaszát, majd a következő kérdés előtt foglald össze egy mondatban,
mit értettél, hogy korrigálhasson.

**1.1 kérdés — Mit építünk?**

> Egy mondatban: mit szeretnél, hogy ez a projekt csináljon?
> Ne aggódj a szóhasználaton, írd le ahogy egy ismerősödnek mondanád el.

Ebből kinyered a projekt **célját**.

**1.2 kérdés — Kinek?**

> Ki fogja ezt használni? Egy konkrét személy, csapat, vagy szervezet?
> (Pl. "Visoro belső használatra", "egy konkrét polgármester",
> "magamnak", "publikus weboldal bárkinek".)

Ebből kinyered a **felhasználó**t. Ez kulcsfontosságú — ha nincs
konkrét felhasználó, a projekt nem jól definiált.

**1.3 kérdés — Mi NEM tartozik bele?**

> Van olyan dolog, ami **biztosan nem** része ennek a projektnek?
> Pl. nem fogja kezelni a fizetéseket, nem cseréli le a meglévő
> rendszert, csak prototípus, stb.

Ebből kinyered az **out of scope**-ot. Ez gyakran fontosabb, mint
a "mit csinál" — megakadályozza a scope creep-et.

### 2. lépés — Adaptív elágazás

A három alapkérdés válaszai alapján döntsd el, milyen típusú projektről
van szó, és csak az ahhoz illeszkedő kérdéseket tedd fel.

**Ha a projekt egyszerű script vagy egyetlen fájl** (pl. "egy Python
szkript ami CSV-t alakít át"):
- ugorj a **3. lépés (rövid)** verzióra
- 4-5 további kérdés elég

**Ha a projekt webalkalmazás vagy szolgáltatás** (pl. "egy weboldal,
ahol a polgármesterek bejelentkeznek"):
- menj a **3. lépés (közepes)** verzióra
- 8-12 további kérdés

**Ha a projekt komplex rendszer** (pl. több komponens, integrációk,
külső API-k):
- menj a **3. lépés (teljes)** verzióra
- 12-18 további kérdés

**Ha bizonytalan vagy**, kérdezd meg Robertet:

> Ahogy hallom, ez egy [típus] projekt. Stimmel? Vagy valami nagyobb /
> kisebb / másabb dolgot tervezel?

### 3. lépés — Tematikus kérdéscsoportok

Az alábbi csoportokból annyit kérdezz, amennyi a projekt komplexitásához
illik. Egyszerre **csak egy csoportot** dolgozz fel, és minden csoport
végén foglald össze, mit értettél.

#### 3.A Tech stack és környezet

Csak akkor menj részletekbe, ha kód lesz a projektben. Ha a projekt
csak dokumentumokat vagy tartalmat termel, ezt kihagyhatod.

- Milyen környezetben fog futni? (pl. weboldal, mobiltelefon,
  Robert saját számítógépe, Visoro szerver)
- Van-e már megkezdett kód, vagy nulláról indulunk?
- Vannak-e konkrét eszközök, amiket muszáj használni?
  (Pl. "ez a meglévő Postgres adatbázishoz csatlakozik",
  "Excel-be kell exportálnia", "QGIS-szel kompatibilis legyen")
- Van-e olyan eszköz, amit **nem** szabad használni?
  (Pl. "ne kerüljön külső felhőszolgáltatásba",
  "csak a Visoro szerveren fusson")

Ha Robert nem tudja a választ egy technikai kérdésre, **te ajánlj
2-3 lehetőséget röviden**, és kérdezd meg, melyik tetszik. Ne döntsd
el helyette.

#### 3.B Sikerkritériumok

- Honnan fogjuk **tudni**, hogy a projekt működik? Mi a legegyszerűbb
  teszt, amit te magad el tudsz végezni, hogy ellenőrizd?
- Van-e konkrét, mérhető cél? (Pl. "ne tartson 5 másodpercnél tovább",
  "30 polgármesterre kell skálázódnia")

Ha Robert nem tud konkrét sikerkritériumot mondani, segíts neki:
ajánlj 2-3 lehetséges kritériumot a projekt típusa alapján, és kérdezd
meg, melyik fontos.

#### 3.C Korlátok és érzékeny területek

- Vannak-e adatok, amiket **nem szabad** kiengedni a Visoro infrastruktúrából?
- Van-e jogi szabályozás, amire figyelni kell? (Pl. GDPR, közbeszerzési
  szabályok, RSV-vonatkozó jogszabályok)
- Vannak-e határidők? (Pl. "egy hónapon belül kell egy demó",
  "soha nincs határidő, hobbi projekt")

#### 3.D Integrációk és külső kapcsolatok

Csak ha komplex rendszer:
- Csatlakozik-e más Visoro rendszerhez? (FGO, ClickUp, Airtable, QGIS,
  Urbanistul Virtual)
- Vannak-e külső API-k, amiket használni fog?
- Hogyan jutnak be az adatok? (Manuális feltöltés, mobil mérés,
  külső import?)
- Hova mennek az adatok ki? (Térkép, Excel, PDF, weboldal?)

#### 3.E Az első feladat

Mindig kérdezd meg a végén:
- Mi az **első konkrét lépés**, amivel kezdeni szeretnél, miután
  ez a setup kész? (Ez kerül a `TASK.md` Active szekciójába.)

### 4. lépés — Összefoglalás Robertnek

Mielőtt megírod a fájlokat, foglald össze az interjút **strukturáltan,
de magyarul, közérthetően**:

> Rendben, akkor összefoglalom, mit értettem. Kérlek olvasd át, és
> ha bármi nem stimmel, javítsuk most.
>
> **A projekt:** [egy mondat]
> **Kinek:** [felhasználó]
> **Nem része:** [out of scope, listázva]
> **Tech stack:** [ha releváns]
> **Sikerkritériumok:** [listázva]
> **Korlátok:** [ha vannak]
> **Első feladat:** [konkrét akció]
>
> Stimmel ez? Van bármi, amit hozzátennél vagy javítanál?

Várd meg a megerősítést. Ha javít, korrigálj és kérdezz vissza,
mielőtt továbbmész.

### 5. lépés — A fájlok megírása

Csak Robert megerősítése után írd meg a fájlokat. Ezt **egyetlen
turn-ben** csináld, hogy ne fragmentálódjon.

Sorrendben:

1. **`PLANNING.md`** — minden, amit megbeszéltetek, strukturált formában.
   Kövesd az alábbi struktúrát, de **csak azokat a szekciókat töltsd ki,
   amikről van információ**. Ne hagyj ott `<placeholder>`-eket vagy
   üres szekciókat — ha valamiről nincs adat, hagyd ki a szekciót,
   és tedd hozzá egy "Open Questions" listához a végén.

2. **`TASK.md`** — az alap struktúrával (Active / Backlog / Blocked /
   Done / Cancelled), az első konkrét feladattal az Active szekcióban.

3. **`examples/README.md`** — az általános útmutató (lásd a sablon
   szekciót lent).

4. **`PRPs/README.md`** — az általános útmutató (lásd a sablon
   szekciót lent).

5. **`brain/README.md` és `brain/INDEX.md`** — a session-emlékezet
   rendszer bootstrapja. Lásd a sablonokat a fájl alján
   ("brain/README.md váz" és "brain/INDEX.md váz" szekciók).
   Az `INDEX.md` üresen indul (csak a fejléc + üres tábla).
   Az első valódi bejegyzést akkor írod, amikor az első push megtörtént.

### 6. lépés — Bemutatás és jóváhagyás

A fájlok megírása után mutasd meg Robertnek **közérthetően magyarul**,
mit írtál bele. Ne pasztáld be a teljes fájlokat — foglald össze
szekciónként:

> Megírtam az öt fájlt. Itt van röviden, mi került mindegyikbe:
>
> - `PLANNING.md` — itt szerepel [főbb pontok 3-4 sorban]
> - `TASK.md` — itt van az első feladat: [feladat]
> - `examples/README.md` — útmutató, hogy mikor és hogyan adunk hozzá
>   mintákat. Egyelőre üres a mappa.
> - `PRPs/README.md` — útmutató a feature-tervekhez. Az első PRP-t
>   akkor írjuk, amikor az első nagyobb funkcióhoz érünk.
> - `brain/README.md` + `brain/INDEX.md` — a session-emlékezet
>   rendszer. Minden push után írok ide egy rövid bejegyzést, hogy a
>   következő session ne kezdjen vakon.
>
> Megnyitottam mindegyiket, kérlek nézz át — főleg a `PLANNING.md`-t,
> mert a többiekre az fog épülni. Bármi, amit pontosítani kéne?

Várd meg a végleges OK-t. Ha javít, javítsd, és kérdezz újra vissza.

### 7. lépés — Folytatás Robert eredeti kérésével

Csak ezután térj vissza Robert eredeti kéréséhez (amivel a session-t
kezdte), és mondd:

> A setup kész. Most visszatérek az eredeti kérésedhez: [Robert eredeti
> kérése]. A `CLAUDE.md` szabályai szerint kezdem a [Plan / Context /
> Build / Validate] fázisokkal.

---

## Sablonok a fájlokhoz

### `PLANNING.md` váz, amit kitöltesz az interjú alapján

Csak azokat a szekciókat tartsd meg, amikről van információ. Ne hagyj
üres szekciókat vagy placeholder-eket.

```markdown
# PLANNING.md

## 1. Projekt
- **Név:** [név]
- **Tulajdonos:** Robert Ledenyi / Visoro Global SRL
- **Indítva:** [dátum]
- **Státusz:** [prototípus / aktív fejlesztés / karbantartás]

## 2. Cél
[Egy bekezdés a célról, közérthetően. Ki használja, mit csinál, miért.]

**Nem része:**
- [out of scope tétel 1]
- [out of scope tétel 2]

## 3. Sikerkritériumok
- [konkrét, mérhető kritérium]
- [...]

## 4. Architektúra
[Ha releváns. Ha egyszerű script, ez kihagyható.]

### 4.1 Komponensek
| Komponens | Felelősség | Technológia |
|-----------|-----------|-------------|
| [...] | [...] | [...] |

### 4.2 Adatáramlás
[Számozott lépések, vagy elhagyva ha nem releváns.]

## 5. Tech stack
- **Nyelv(ek):** [...]
- **Keretrendszer(ek):** [...]
- **Adatbázis:** [...] (ha van)
- **Hosting / futtatás:** [...]
- **Egyéb fontos eszközök:** [...]

## 6. Stílus és konvenciók
[Csak ha kód lesz. Egyszerű projekteknél kihagyható.]
- **Linter:** [...]
- **Tesztelés:** [...]
- **Naming:** [...]

## 7. Korlátok
### 7.1 Kemény (nem sérthetők meg)
- [...]
### 7.2 Puha (preferenciák)
- [...]

## 8. Nyitott kérdések
[Amik az interjú során nem tisztázódtak.]
- [...]

## 9. Hivatkozások
- **Külső:** [linkek]
- **Belső:** [Visoro dokumentumok, ClickUp, Airtable]

---
*Utoljára frissítve: [dátum] - first-run setup.*
```

### `TASK.md` váz

```markdown
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

### `[ ]` [első feladat címe az interjúból]
- **Hozzáadva:** [dátum]
- **Tulajdonos:** Robert
- **Akceptálási kritérium:** [hogy tudjuk, kész van]
- **Megjegyzés:** [opcionális]

---

## Backlog
[üres lista, vagy az interjúban említett későbbi feladatok]

---

## Blocked
[üres]

---

## Done
[üres]

---

## Cancelled
[üres]
```

### `examples/README.md` (azonos minden projektben, statikus)

Másold ide szó szerint:

```markdown
# examples/ — Kanonikus minták

A `CLAUDE.md` 7. szekciója szerint ez a mappa **kanonikus**: ha
egy minta itt van, az a forrás. Ha a kódbázis máshol eltér tőle,
a minta nyer (kivéve, ha Robert mást mond).

## Mit teszünk ide

Kis, önálló példa-fájlokat, amik megmutatják, hogyan csináljuk
ebben a projektben az adott dolgot. Nem teljes feature-eket —
csak a mintát.

## Mikor adunk hozzá újat

Akkor, ha egy mintát több helyen szeretnénk követni, vagy ha
ugyanazt a konvenciót egynél többször elmagyaráztuk volna.

## Hogyan adunk hozzá

1. Hozz létre egy fájlt a megfelelő néven (pl. `api_endpoint.py`).
2. A fájl tetején legyen egy komment-blokk:
   ```
   # Példa: [egy soros leírás]
   # Mintázat: [mit demonstrál]
   # Használd: [mikor másold]
   # Ne használd: [mikor nem ez a megfelelő]
   # Utoljára átnézve: [dátum]
   ```
3. Tartsd rövidre. ~150 sor felett vágd ketté.
4. Vedd fel az alábbi listára.

## Index
| Fájl | Mintázat | Utoljára átnézve |
|------|----------|------------------|
| (még nincs) | — | — |

## Frissesség
Negyedévente menj végig — ami elavult, javítsd vagy töröld.
```

### `PRPs/README.md` (azonos minden projektben, statikus)

Másold ide szó szerint:

```markdown
# PRPs/ — Product Requirements Prompts

A `CLAUDE.md` 8. szekciója szerint: minden olyan feature-höz, ami
egynél több fájlt érint, **a kód előtt** PRP-t kell írni.

## Mi a PRP

Egy strukturált dokumentum, ami megmondja a Claude Code-nak (vagy
egy fejlesztőnek), pontosan mit kell megépíteni, milyen kontextusban,
milyen lépésekben, és hogyan ellenőrizzük, hogy kész.

## Mikor írunk PRP-t

**Igen:**
- Ha a feature több fájlt érint
- Ha új komponens, szolgáltatás vagy alrendszer kerül be
- Ha a "kész" feltételek nem nyilvánvalóak a címből

**Nem:**
- Egyetlen fájl módosítása
- Tipográfiai javítás, egysoros bug fix

Kétség esetén: írunk. 10 perc most, órák megspórolása később.

## Elnevezés

`PRPs/NNN-[feature-slug].md`, ahol `NNN` 3 jegyű sorszám
(`001`, `002`, ...). A sorszámot ne rendezzük át — történeti.

## Életciklus

1. **Draft** — Robert vagy Claude megírja
2. **Approved** — Robert jóváhagyja, dátummal
3. **In progress** — épül
4. **Done** — kész, marad a mappában történeti rekordként
5. **Superseded** — ha későbbi PRP felváltja, ne töröld, csak jelöld

## Index
| # | Cím | Státusz | Indítva | Kész |
|---|-----|---------|---------|------|
| — | (még nincs) | — | — | — |
```

### `brain/README.md` váz (azonos minden projektben, statikus)

Másold ide szó szerint:

```markdown
# brain/ — session memory

> Ezt a mappát a Claude automatikusan használja. Robertnek nem kell
> kézzel írnia ide semmit.

## Mire jó

Minden Claude session "nulláról" indul — nincs emléke az előző
beszélgetésekből. A `brain/` ezt oldja meg: minden jelentős push
után írok ide egy rövid bejegyzést, és a következő session elején
elolvasom az indexet és a legutóbbi bejegyzéseket.

## Szerkezet

- **`INDEX.md`** — táblázat: dátum, slug, terület-tagek, egysoros cím.
  Mindig rövid.
- **`YYYY-MM-DD-<slug>.md`** — egy fájl egy jelentős session vagy
  döntés. Max ~150 sor.

## Mikor írok bejegyzést

- Minden sikeres `git push` után, ami felhasználói viselkedést,
  architektúrát vagy nem-triviális döntést érint.
- Olyan beszélgetés után, ami új constraint-et vagy preferenciát
  szül, akkor is, ha kód nem ment ki.
- **Nem írok** triviális egysoros bugfix után.

## Mi van egy bejegyzésben

`# YYYY-MM-DD — <cím>`, majd:
- `**Tags:**` terület-tagek
- `**Commit:**` rövid hash
- `**Related:**` PRP-k, korábbi brain bejegyzések
- `## Mit kért` — egy bekezdés
- `## Mit változott` — file:line bullets
- `## Miért — döntések` — főleg amiket egy jövő session
  újra-tárgyalhatna
- `## Gotcha jövő-Claude-nak` — a legfontosabb szekció
- `## Hivatkozások`

## Olvasási rend (session elején)

- `brain/INDEX.md` teljes egészében.
- A legutóbbi 3 bejegyzés.
- Bármi, ami a mostani feladat **területéhez tagelve** van.

## Kompakció

Ha az INDEX 100+ bejegyzésre nő, Robert szólhat *"kompaktold a
brain-t"*, és a régebbi azonos-témájú bejegyzéseket tematikus
összefoglalókká vonom össze, megtartva a döntéseket és gotchákat.
```

### `brain/INDEX.md` váz (azonos minden projektben, statikus)

Másold ide szó szerint:

```markdown
# brain/INDEX.md

> Append-only index. Új bejegyzés mindig **a táblázat tetejére** kerül
> (legfrissebb fent). A `slug` megegyezik a fájlnévvel `.md` nélkül.

| Dátum | Slug | Tags | Cím |
|-------|------|------|-----|
```

---

## Mit ne csinálj az interjú alatt

- **Ne kérdezz egyszerre több kérdést.** Egyetlen kérdés, válasz, összefoglalás, következő kérdés.
- **Ne használj szakszavakat magyarázat nélkül.** Ha "API"-t mondasz, mondd meg egy mondatban, mit jelent abban a kontextusban.
- **Ne döntsd el helyette a technikai kérdéseket.** Ha nem tudja, ajánlj 2-3 opciót röviden, és kérdezd meg, melyik tetszik.
- **Ne pasztálj kódot vagy hosszú struktúrákat az interjú közben.** Az interjú beszélgetés, nem dokumentum.
- **Ne ugorj át lépéseket, ha Robert siet.** Ha azt mondja "csak csináld", emlékeztesd: a 0. lépésben mondtad, 5–15 perc lesz, ez most az alap. Az utána jövő munka tízszer gyorsabb lesz tőle.
- **Ne kezdj el kódolni vagy fájlokat létrehozni a fő feladaton, amíg a setup nem teljes és Robert nem hagyta jóvá.**

---

## Mit csinálj, ha valami félresiklik

- **Ha Robert válasza homályos:** kérdezz vissza konkrétabban, példával.
  Pl. "Mit értesz pontosan az alatt, hogy 'gyors legyen'? Másodperc, vagy
  azt érted, hogy ne kelljen sokat kattintgatni?"
- **Ha Robert ellentmond magának egy korábbi válasznak:** mondd ki, és
  kérdezd meg, melyik az érvényes.
- **Ha Robert leállít az interjú közepén ("csak kezdjük el"):**
  emlékeztesd a `CLAUDE.md` 1. szekciójára, ami kötelez. Ha továbbra is
  ragaszkodik, mondd: "Rendben, de jelzem, hogy a `CLAUDE.md` 11. szekciója
  szerint ez egy override, és csak erre a session-re érvényes. A következő
  session-ben az interjút be fogom fejezni." És jegyezd fel a hiányzó
  válaszokat a `PLANNING.md` "Nyitott kérdések" szekciójába.

---

*Az `AGENTS.md` vége. Ezt a fájlt ne módosítsd projekt-specifikusan —
ez minden Robert projekt számára azonos. Ha javítani akarod a protokollt,
a master verziót módosítsd a project-template-ben.*
