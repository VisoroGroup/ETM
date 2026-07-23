/**
 * "Noutăți" (What's New) release entries, versioned with the code.
 *
 * WORKFLOW RULE (CLAUDE.md §7): every push that changes user-facing behavior
 * MUST append a new entry here (RO + HU text, optional screenshot under
 * client/public/release-notes/). The newest entry goes FIRST and its `id` is
 * the previous top id + 1. Users who haven't seen the latest id get the
 * popup once after the deploy; the megaphone icon re-opens it any time.
 */

export type ReleaseLang = 'ro' | 'hu';

/** Per-language text; the UI picks the active company's language, RO fallback. */
export type LocalizedText = { ro: string; hu: string };

export interface ReleaseItem {
    title: LocalizedText;
    description: LocalizedText;
    /** Optional screenshot, e.g. '/release-notes/2026-07-org-chart.png'. */
    image?: string;
}

export interface Release {
    /** Monotonically increasing; the seen-marker stored per user. */
    id: number;
    /** YYYY-MM-DD, shown in the popup header. */
    date: string;
    items: ReleaseItem[];
}

/** Newest first. The popup shows at most the 3 newest releases. */
export const RELEASES: Release[] = [
    {
        id: 9,
        date: '2026-07-21',
        items: [
            {
                title: {
                    ro: 'Panoul principal: sarcinile sunt ordonate după termen, nu după stadiu',
                    hu: 'Vezérlőpult: a feladatok határidő szerint, nem stádium szerint',
                },
                description: {
                    ro: 'În vizualizarea Listă, sarcinile nu mai sunt grupate pe stadii (De rezolvat / În realizare / Blocat), ci apar într-o listă unică ordonată după termen — cel mai apropiat termen sus, apoi în jos. Se aplică la toate secțiunile (Sarcinile mele, Create de mine și, pentru administratori, pe utilizator). Stadiul rămâne vizibil pe fiecare rând. Sarcinile blocate și cele fără termen trec la final.',
                    hu: 'A Listă nézetben a feladatok többé nem stádium szerint csoportosulnak (Megoldandó / Folyamatban / Blokkolt), hanem egyetlen, határidő szerint rendezett listában jelennek meg — a legközelebbi határidő legfelül, onnan lefelé. Minden szekcióra érvényes (Saját feladatok, Általam létrehozott és — adminoknál — felhasználónként). A stádium továbbra is látszik minden soron. A blokkolt és a határidő nélküli feladatok a lista aljára kerülnek.',
                },
            },
            {
                title: {
                    ro: 'Memento pe email cu 5 zile înainte de termen — și către responsabil',
                    hu: 'E-mail emlékeztető 5 nappal a határidő előtt — a felelősnek is',
                },
                description: {
                    ro: 'Emailul zilnic anunță acum sarcinile care se apropie de termen cu 5 zile lucrătoare înainte (apoi 2 și 1), în loc de 4. În plus, responsabilul sarcinii (persoana pe care este atribuită) primește de acum memento-ul — până acum putea fi omis.',
                    hu: 'A napi e-mail mostantól 5 munkanappal a határidő előtt jelzi a közelgő feladatokat (majd 2 és 1 nappal), a korábbi 4 helyett. Ráadásul a feladat felelőse (akire a feladat rá van szignálva) mostantól megkapja az emlékeztetőt — eddig kimaradhatott.',
                },
            },
        ],
    },
    {
        id: 8,
        date: '2026-07-20',
        items: [
            {
                title: {
                    ro: 'Departamentul moștenit nu mai apare nicăieri la firmele fără structură',
                    hu: 'Az örökölt részleg sehol nem jelenik meg a struktúra nélküli cégeknél',
                },
                description: {
                    ro: 'Am făcut curățenie completă: la firmele fără structură organizatorică, eticheta veche de departament nu mai apare nicăieri — nici în lista personală de sarcini, nici în exportul CSV, în bara de acțiuni în masă, în jurnalul de activitate (feed și sarcină) sau la șabloane.',
                    hu: 'Teljes tisztítást csináltunk: a szervezeti struktúra nélküli cégeknél a régi részleg-címke többé sehol nem jelenik meg — sem a személyes feladatlistában, sem a CSV-exportban, a tömeges műveletek sávjában, a tevékenységnaplóban (feed és feladat) vagy a sablonoknál.',
                },
            },
        ],
    },
    {
        id: 7,
        date: '2026-07-20',
        items: [
            {
                title: {
                    ro: 'Raportul de finalizare nu mai arată un departament irelevant',
                    hu: 'A befejezési jelentés nem mutat oda nem illő részleget',
                },
                description: {
                    ro: 'La firmele fără structură organizatorică (ex. Visoro Hungary, Neo Plan), raportul de finalizare a sarcinii nu mai afișează un „Departament" moștenit (ex. „Comunicare și HR") care nu se aplică acolo.',
                    hu: 'A szervezeti struktúra nélküli cégeknél (pl. Visoro Hungary, Neo Plan) a feladat befejezési jelentése többé nem mutat egy oda nem illő, örökölt „Részleg" mezőt (pl. „Comunicare și HR").',
                },
            },
        ],
    },
    {
        id: 6,
        date: '2026-07-20',
        items: [
            {
                title: {
                    ro: 'Lista de responsabili se reîmprospătează sigur după schimbarea firmei',
                    hu: 'A felelős-lista megbízhatóan frissül cégváltás után',
                },
                description: {
                    ro: 'După ce schimbi firma activă, lista din care alegi responsabilul se reîncarcă sigur (cu reîncercare și la revenirea în tab), ca să apară toți colegii firmei curente — nu cei rămași de la firma anterioară.',
                    hu: 'Miután céget váltasz, a felelős-választó lista megbízhatóan újratöltődik (újrapróbálkozással és a fülre visszatéréskor is), így a jelenlegi cég összes kollégája megjelenik — nem az előző cégnél ragadt névsor.',
                },
            },
        ],
    },
    {
        id: 5,
        date: '2026-07-20',
        items: [
            {
                title: {
                    ro: 'Responsabilii nu se mai pierd când cineva iese din firmă',
                    hu: 'A felelősök nem vesznek el, ha valaki kikerül a cégből',
                },
                description: {
                    ro: 'Sarcinile recurente, cele din șabloane și duplicatele nu mai păstrează ca responsabil pe cineva care nu mai e membru al firmei — se creează fără responsabil, ca să fie reatribuite. În plus, când modifici accesul unui utilizator, aplicația te avertizează dacă i-ai lua o firmă în care încă are sarcini deschise.',
                    hu: 'Az ismétlődő, a sablonból és a duplikálással készülő feladatok többé nem tartják meg felelősként azt, aki már nem tagja a cégnek — felelős nélkül jönnek létre, hogy újra ki lehessen osztani. Emellett a felhasználó hozzáférésének módosításakor a rendszer figyelmeztet, ha olyan céget vennél el tőle, ahol még van nyitott feladata.',
                },
            },
        ],
    },
    {
        id: 4,
        date: '2026-07-20',
        items: [
            {
                title: {
                    ro: 'Responsabilul rămâne vizibil chiar dacă a ieșit din firmă',
                    hu: 'A felelős akkor is látszik, ha már kikerült a cégből',
                },
                description: {
                    ro: 'Dacă o sarcină (sau subsarcină) e atribuită cuiva care nu mai e membru al firmei active, selectorul „Responsabil” arăta gol. Acum numele persoanei atribuite apare mereu în listă, așa că se vede clar cine e responsabil.',
                    hu: 'Ha egy feladat (vagy részfeladat) olyasvalakire volt szignálva, aki már nem tagja az aktív cégnek, a „Felelős” választó üresen jelent meg. Mostantól a felelős neve mindig szerepel a listában, így egyértelmű, ki a felelős.',
                },
            },
        ],
    },
    {
        id: 3,
        date: '2026-07-14',
        items: [
            {
                title: {
                    ro: 'Lista @mențiuni arată toți colegii',
                    hu: 'Az @említés lista minden kollégát mutat',
                },
                description: {
                    ro: 'Când scrii @ într-un comentariu, lista derulantă conține acum toți colegii din firmă, nu doar primii 5 în ordine alfabetică.',
                    hu: 'Amikor kommentben @-ot írsz, a legördülő lista mostantól az összes céges kollégát tartalmazza, nem csak az ábécé első 5 nevét.',
                },
            },
        ],
    },
    {
        id: 2,
        date: '2026-07-14',
        items: [
            {
                title: {
                    ro: 'Meniul de schimbare a stării nu se mai taie',
                    hu: 'A státusz-váltó menü többé nem vágódik le',
                },
                description: {
                    ro: 'Când schimbi starea unei sarcini din listă (De rezolvat, În realizare, Blocat, Terminat), meniul apare acum întreg — chiar și la ultimul rând dintr-o secțiune, unde înainte era tăiat.',
                    hu: 'Amikor a listából váltasz feladat-státuszt (De rezolvat, În realizare, Blocat, Terminat), a menü mostantól teljes egészében látszik — a szekció utolsó soránál is, ahol eddig levágódott.',
                },
            },
        ],
    },
    {
        id: 1,
        date: '2026-07-07',
        items: [
            {
                title: {
                    ro: 'Structura organizatorică actualizată',
                    hu: 'Frissített szervezeti struktúra',
                },
                description: {
                    ro: 'Organigrama Visoro Global urmează acum tabelul de organizare din 30 iunie: subdivizii noi, posturi pe produse în Producție (Ortofoto, RENNS, RSV, Cartinspect, GPR, WebGIS) și responsabili actualizați.',
                    hu: 'A Visoro Global szervezeti fája mostantól a június 30-i szervezési táblát követi: új subdivíziók, termék-alapú posztok a Producție-ban (Ortofoto, RENNS, RSV, Cartinspect, GPR, WebGIS) és frissített felelősök.',
                },
            },
            {
                title: {
                    ro: 'Sarcinile recurente arată următoarea scadență',
                    hu: 'Az ismétlődő feladatok a következő esedékességet mutatják',
                },
                description: {
                    ro: 'O sarcină recurentă activă nu mai apare ca „depășită”: pe liste și pe Dashboard vezi data următoarei scadențe, ajustată la zile lucrătoare.',
                    hu: 'Az aktív ismétlődő feladat többé nem „lejárt”: a listákon és a Dashboardon a következő esedékes dátumot látod, munkanapokhoz igazítva.',
                },
            },
            {
                title: {
                    ro: 'Cardurile de statistici deschid fereastră instant',
                    hu: 'A statisztika-kártyák azonnali felugrót nyitnak',
                },
                description: {
                    ro: 'Un clic pe oricare din cele 4 carduri (Active, Depășite, Blocate, Finalizate luna aceasta) deschide direct lista sarcinilor, grupate pe responsabil.',
                    hu: 'A 4 kártya (Aktív, Lejárt, Blokkolt, E havi lezárt) bármelyikére kattintva azonnal felugrik a feladatlista, felelős szerint csoportosítva.',
                },
            },
            {
                title: {
                    ro: 'Sarcinile blocate nu mai apar ca depășite',
                    hu: 'A blokkolt feladatok nem jelennek meg lejártként',
                },
                description: {
                    ro: 'Cât timp o sarcină e „blocat”, termenul ei stă pe pauză: nu mai e numărată la „Depășite” și data nu se mai colorează roșu.',
                    hu: 'Amíg egy feladat „blocat”, a határideje áll: nem számít bele a „Depășite” számba, és a dátuma nem piroslik.',
                },
            },
        ],
    },
];

export const LATEST_RELEASE_ID = RELEASES[0]?.id ?? 0;

/** Pick the text for the company language; anything but 'hu' reads Romanian. */
export function pickText(text: LocalizedText, language: string): string {
    return language === 'hu' ? text.hu : text.ro;
}
