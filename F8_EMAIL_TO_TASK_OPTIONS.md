# F8 — Email-to-task: opciók Robertnek

Ez a feature egy **bejövő email** infrastruktúrát igényel. Magyarul: valaki elküld egy emailt egy egyedi címre, és abból task lesz. Ehhez **nem elég a mai SMTP** — külső szolgáltatás kell, ami fogadja az emailt, elemzi és POST-olja az ETM backendnek.

Három realista opció. Mind három beüzemelése ~1 órás munka (backend endpoint írás) + konfiguráció.

---

## Opció A — **Cloudflare Email Workers (INGYENES)** ⭐ javaslat

**Hogy működik:**
1. Te tulajdonolod a `visoro-global.ro` domaint (vagy létrehozol egyet, pl. `tasks.visoro-global.ro`).
2. Cloudflare-en beállítasz egy **Email Routing** szabályt: `tasks@visoro-global.ro` → egy Cloudflare Worker script.
3. A Worker beolvassa az emailt, parse-olja (subject, body, CC, from), és POST-ol az ETM backend egyik endpointjára (`/api/inbound/email`).
4. A backend létrehozza a taskot.

**Előnyök:**
- ✅ **INGYENES** (Cloudflare Workers free tier: 100 000 email / nap)
- ✅ Már használsz Cloudflare-t (látom a Cloudflare MCP-t is)
- ✅ A te domainedhez kötve — nem külső szolgáltatónál van az email
- ✅ Teljes kontroll: bármit csinálhatsz a Worker script-ben (anti-spam, whitelist, stb.)

**Hátrányok:**
- A domaint Cloudflare-en kell kezelni (ha ott van már, nulla munka; ha nem, át kell migrálni DNS-t)
- Egy kis Worker JS-t kell írni (~20 sor)

**Költség:** 0 RON / hó

---

## Opció B — **SendGrid Inbound Parse**

**Hogy működik:**
1. Létrehozol SendGrid accountot.
2. Beállítasz egy MX rekordot DNS-ben: `tasks.visoro-global.ro` → SendGrid szerverek.
3. SendGrid-en konfigurálsz egy Inbound Parse webhook-ot: „bárki email-t küld a `tasks.visoro-global.ro` domainre → POST a Te URL-edre"
4. A backend fogadja, parse-olja, task-ot csinál.

**Előnyök:**
- ✅ SendGrid a de facto standard, megbízható
- ✅ Jó dokumentáció és parser (attachmenteket is kezel automatikusan)
- ✅ Inbound Parse **INGYENES** a free tier-en (max 40 email / nap kimenő, inbound unlimited)

**Hátrányok:**
- ❌ Kell fiók regisztráció, domain verification
- ❌ Ha a kimenő emailekhez is SendGrid-et használsz, a forgalom nő → fizetős csomag kellhet ($19.95/hó Essentials)

**Költség:** 0 RON / hó (Free), vagy ~100 RON / hó (Essentials)

---

## Opció C — **Microsoft 365 Flow / Power Automate**

**Hogy működik:**
1. Használd ki, hogy már Microsoft 365-öt használsz.
2. Hozz létre egy shared inbox-ot: `tasks@visoro-global.ro` (Microsoft konzol).
3. Power Automate flow: „When email arrives → HTTP POST to ETM".
4. Backend fogadja.

**Előnyök:**
- ✅ Nincs új szolgáltató: minden Microsoft-nál marad
- ✅ A shared inbox-ot Emőke/Mária bármikor megnézheti manuálisan is
- ✅ Power Automate jön a M365 Business csomaggal

**Hátrányok:**
- ❌ Power Automate UI-s (Robert magyarázat alapján nem developer) → de elég egy flow, egyszerű
- ❌ Késleltetés: a Power Automate 1-5 perces polling-gal fut általában
- ❌ Ha Microsoft ki-le-bekap, az email-ek késhetnek

**Költség:** 0 RON / hó (már benne van a M365 Business csomagodban)

---

## Backend oldal (mindhárom opció ugyanazt igényli)

Írok egy új endpoint-ot a backendbe:

**POST /api/inbound/email** (public — csak shared secret védi)

Payload (a szolgáltató küldi):
```json
{
  "from": "client@example.com",
  "to": "tasks@visoro-global.ro",
  "cc": ["emoke@visoro-global.ro"],
  "subject": "Proba productie - urgent",
  "body_plain": "Kérem holnapig intézzétek. due: 2026-04-25",
  "attachments": [...]
}
```

**Logika:**
1. Validálja a shared secret headert (hogy ne bárki pingelhesse az endpointot)
2. `from` alapján vagy CC alapján egyezteti a user táblával → ha egyezik, az lesz a responsabil; ha nem egyezik, Robert (superadmin) lesz creator
3. Subject → task title
4. Body plain → description
5. Keres `due: YYYY-MM-DD` mintát a bodyban → ha van, az a dátum; ha nincs, +7 nap
6. Ha a CC-ben van egy létező user, az lesz responsabil
7. Attachment-eket feltölti
8. Notification az assignee-nek (ugyanaz mint manuális task create-nél)

**Biztonság:**
- Shared secret header, amit a Worker / SendGrid webhook küld
- Spam limit: max 50 email/óra/from cím
- Whitelist opcionálisan: csak bizonyos domainekről (pl. Visoro partnerek)

---

## Mit kérdezek Tőled:

1. **Melyik opciót?** Én az **A-t (Cloudflare)** javaslom — 0 lej, teljes kontroll, már használod.
2. **Milyen email címet szeretnél?** Pl.:
   - `tasks@visoro-global.ro` (a meglévő domain aldomain-jére)
   - `tasks.visoro-global.ro` mint külön aldomain (ha a főt nem akarod érinteni)
3. **Ha az emailben nincs CC-ben Visoro user, kire legyen assignálva?** Én Robertre állítanám default-nak (te elolvasod, átassignolod).
4. **Departament kötelező új taskhoz (M5 miatt).** Az email-ből nem tudjuk kitalálni. Két opció:
   - **Minden inbound task „7 - Administrativ / Resurse / Administrare" posztra megy** (Robert default)
   - **Subject-ben kell megadni:** pl. `[FINANCIAR/Plăți] Subject` → a bracketből parseoljuk a posztot
5. **Anti-spam:** Akarsz-e whitelist-et (csak meghatározott domainekről fogad)? Vagy nyitva legyen bárkinek?

Jelezd vissza és egy-két commit alatt kész van.
