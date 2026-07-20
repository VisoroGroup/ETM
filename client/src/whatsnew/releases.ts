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
