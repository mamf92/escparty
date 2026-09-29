/**
 * A name to start a guest off with at a scoreboard party: Eurovision
 * legends, so the awards read like a Eurovision night. Guests can type
 * their own instead.
 */
export const PARTY_NAMES = [
    "Loreen", "Käärijä", "Conchita", "Rybak", "Netta", "Lordi", "Verka", "Ruslana",
    "Måneskin", "Nemo", "JJ", "Dana International", "Johnny Logan", "Céline", "Lys Assia",
    "Sandie Shaw", "Jedward", "Babushka", "Dustin the Turkey", "Epic Sax Guy", "Daði",
    "Hatari", "Subwoolfer", "Salvador", "Marija", "Helena", "Sertab", "Lena", "Emmelie",
    "Duncan", "Kalush", "Jamala", "Måns", "Carola", "Bobbysocks", "Secret Garden",
];

export const randomPartyName = (): string => PARTY_NAMES[Math.floor(Math.random() * PARTY_NAMES.length)];
