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
