/**
 * The question bank (#71, #72): every built-in question, tagged with a
 * difficulty and a category, for the quiz builder's picker and the premade
 * templates.
 *
 * The 30 classic questions stay in their three JSON files (the classic
 * easy/medium/hard quizzes load those directly, #71 keeps that working) and
 * are tagged here. Everything else is new content, current to the 2026
 * contest in Vienna and the road to Burgas 2027.
 */
import type { QuizDifficulty, QuizQuestion } from "../utils/QuizDataProvider";
import type { BankQuestion, QuestionCategory } from "../utils/quizModel";
import easyClassics from "./escBeginnerQuiz.json";
import mediumClassics from "./escIntermediateQuiz.json";
import hardClassics from "./escAdvancedQuiz.json";

/** The classic questions' categories, by their original numeric id. */
const CLASSIC_CATEGORIES: Record<number, QuestionCategory> = {
    1: "records", 2: "winners", 3: "hosts", 4: "songs", 5: "winners",
    6: "spectacle", 7: "records", 8: "records", 9: "winners", 10: "winners",
    11: "nordic", 12: "winners", 13: "records", 14: "nordic", 15: "records",
    16: "winners", 17: "songs", 18: "records", 19: "winners", 20: "nordic",
    21: "hosts", 22: "records", 23: "winners", 24: "records", 25: "records",
    26: "records", 27: "winners", 28: "winners", 29: "hosts", 30: "nordic",
};

const tagClassics = (questions: QuizQuestion[], difficulty: QuizDifficulty): BankQuestion[] =>
    questions
        .filter(question => !question.disabled)
        .map(question => ({
            id: `classic-${question.id}`,
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer,
            source: "bank",
            difficulty,
            category: CLASSIC_CATEGORIES[Number(question.id)] ?? "records",
        }));

type NewQuestion = Omit<BankQuestion, "source">;

const q = (
    id: string,
    difficulty: QuizDifficulty,
    category: QuestionCategory,
    question: string,
    correctAnswer: string,
    wrong: string[],
): NewQuestion => ({
    id,
    difficulty,
    category,
    question,
    correctAnswer,
    // The right answer's position is mixed in by the id, so it isn't always first.
    options: insertAt(wrong, correctAnswer, [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % (wrong.length + 1)),
});

const insertAt = (items: string[], item: string, index: number) => [...items.slice(0, index), item, ...items.slice(index)];

const NEW_QUESTIONS: NewQuestion[] = [
    // --- Easy ---
    q("w-e-01", "easy", "winners", "Who won Eurovision 2023 with 'Tattoo'?", "Loreen", ["Käärijä", "Noa Kirel", "Mae Muller"]),
    q("w-e-02", "easy", "winners", "Which Italian rock band won Eurovision 2021?", "Måneskin", ["Il Volo", "Mahmood & Blanco", "Lo Stato Sociale"]),
    q("w-e-03", "easy", "winners", "Which country won Eurovision 2024 with Nemo's 'The Code'?", "Switzerland", ["Croatia", "Ukraine", "France"]),
    q("w-e-04", "easy", "winners", "Which Finnish band won Eurovision 2006 dressed as monsters?", "Lordi", ["Nightwish", "The Rasmus", "Children of Bodom"]),
    q("w-e-05", "easy", "winners", "Who won Eurovision 2014 for Austria?", "Conchita Wurst", ["Zoë", "Cesár Sampson", "Nathan Trent"]),
    q("w-e-06", "easy", "winners", "Which Norwegian violinist won Eurovision 2009 with 'Fairytale'?", "Alexander Rybak", ["Didrik Solli-Tangen", "Tooji", "Carl Espen"]),
    q("w-e-07", "easy", "hosts", "Where is Eurovision 2027 being held?", "Burgas, Bulgaria", ["Sofia, Bulgaria", "Vienna, Austria", "Varna, Bulgaria"]),
    q("w-e-08", "easy", "winners", "Who won Eurovision 2026 with 'Bangaranga'?", "DARA", ["JJ", "Nemo", "Loreen"]),
    q("w-e-09", "easy", "songs", "Which country sent Käärijä and his green bolero with 'Cha Cha Cha' in 2023?", "Finland", ["Estonia", "Sweden", "Latvia"]),
    q("w-e-10", "easy", "records", "How many points is the famous 'douze points'?", "12", ["10", "20", "8"]),
    q("w-e-11", "easy", "records", "What does 'nul points' mean in Eurovision?", "Zero points", ["Twelve points", "A tie", "A disqualification"]),
    q("w-e-12", "easy", "spectacle", "Which Israeli winner made chicken noises in 'Toy' in 2018?", "Netta", ["Eden Alene", "Noa Kirel", "Kobi Marimi"]),
    q("w-e-13", "easy", "nordic", "What is Norway's national Eurovision selection called?", "Melodi Grand Prix", ["Dansk Melodi Grand Prix", "Uuden Musiikin Kilpailu", "Söngvakeppnin"]),
    q("w-e-14", "easy", "nordic", "What is Sweden's national Eurovision selection called?", "Melodifestivalen", ["Söngvakeppnin", "Svenska Schlagerfestivalen", "Dansk Melodi Grand Prix"]),
    q("w-e-15", "easy", "spectacle", "Which Norwegian act in wolf masks sang 'Give That Wolf a Banana' in 2022?", "Subwoolfer", ["Keiino", "Wig Wam", "Gåte"]),
    q("w-e-16", "easy", "winners", "Which Ukrainian band won Eurovision 2022 with 'Stefania'?", "Kalush Orchestra", ["Go_A", "Tvorchi", "Jerry Heil"]),
    q("w-e-17", "easy", "hosts", "Which city hosted Eurovision 2024?", "Malmö", ["Stockholm", "Gothenburg", "Liverpool"]),
    q("w-e-18", "easy", "records", "Which five countries are the 'Big Five' that get a place in the final automatically?", "France, Germany, Italy, Spain and the United Kingdom", ["France, Germany, Italy, Sweden and the United Kingdom", "Germany, Italy, Spain, Sweden and Ireland", "France, Germany, Spain, Netherlands and the United Kingdom"]),
    q("w-e-19", "easy", "spectacle", "Which Moldovan act became a meme as 'Epic Sax Guy' in 2010?", "SunStroke Project", ["Zdob și Zdub", "Pasha Parfeny", "Aliona Moon"]),
    q("w-e-20", "easy", "songs", "Which Irish twins represented Ireland in both 2011 and 2012?", "Jedward", ["The Tolmachevy Sisters", "Bros", "The Brothers Grimm"]),
    q("w-e-21", "easy", "winners", "Which country won Eurovision 2025 with JJ's 'Wasted Love'?", "Austria", ["Switzerland", "Sweden", "Israel"]),
    q("w-e-22", "easy", "nordic", "Which Icelandic act danced in green jumpers to 'Think About Things'?", "Daði Freyr", ["Hatari", "Systur", "Yohanna"]),
    q("w-e-23", "easy", "records", "How long can a Eurovision song be, at most?", "3 minutes", ["4 minutes", "2 minutes 30 seconds", "5 minutes"]),
    q("w-e-25", "easy", "spectacle", "Which instrument did Alexander Rybak play on stage in 'Fairytale'?", "Violin", ["Accordion", "Mandolin", "Saxophone"]),
    q("w-e-26", "easy", "spectacle", "Which Dutch act sang 'Europapa' in 2024?", "Joost Klein", ["Duncan Laurence", "S10", "Mia Nicolai"]),
    q("w-e-24", "easy", "spectacle", "What's the Eurovision name for a sudden jump up a key near the end of a song?", "Key change", ["Sequin swell", "Bridge drop", "Douze lift"]),

    // --- Medium ---
    q("w-m-01", "medium", "hosts", "Where was the first Eurovision Song Contest held in 1956?", "Lugano", ["Geneva", "Zürich", "Cannes"]),
    q("w-m-02", "medium", "records", "How many countries took part in the first Eurovision in 1956?", "7", ["10", "5", "12"]),
    q("w-m-03", "medium", "nordic", "Which Norwegian duo gave Norway its first win in 1985 with 'La det swinge'?", "Bobbysocks!", ["Secret Garden", "Wig Wam", "Dollie de Luxe"]),
    q("w-m-04", "medium", "nordic", "Which act won for Norway in 1995 with the almost instrumental 'Nocturne'?", "Secret Garden", ["Wig Wam", "Elisabeth Andreassen", "Jan Werner"]),
    q("w-m-05", "medium", "winners", "Which country did Salvador Sobral win for in 2017?", "Portugal", ["Spain", "Brazil", "Italy"]),
    q("w-m-06", "medium", "winners", "Who won Eurovision 2015 for Sweden with 'Heroes'?", "Måns Zelmerlöw", ["Eric Saade", "Danny Saucedo", "Robin Bengtsson"]),
    q("w-m-07", "medium", "hosts", "Which country hosted Eurovision 2023 on behalf of winner Ukraine?", "United Kingdom", ["Poland", "Sweden", "Netherlands"]),
    q("w-m-08", "medium", "records", "In which year was Eurovision cancelled?", "2020", ["2001", "2021", "1999"]),
    q("w-m-09", "medium", "songs", "Which Ukrainian drag act came second in 2007 with 'Dancing Lasha Tumbai'?", "Verka Serduchka", ["Ruslana", "Jamala", "Mika Newton"]),
    q("w-m-10", "medium", "songs", "Which Russian grandmothers baked on stage in 2012 with 'Party for Everybody'?", "Buranovskiye Babushki", ["t.A.T.u.", "The Tolmachevy Sisters", "Serebro"]),
    q("w-m-11", "medium", "winners", "Who won Eurovision 2019 for the Netherlands with 'Arcade'?", "Duncan Laurence", ["Joost Klein", "S10", "Jeangu Macrooy"]),
    q("w-m-12", "medium", "nordic", "Which Norwegian group won the televote in 2019 with 'Spirit in the Sky'?", "Keiino", ["Subwoolfer", "Alessandra", "Gåte"]),
    q("w-m-13", "medium", "records", "Which country made its Eurovision debut in 2015?", "Australia", ["Canada", "Kazakhstan", "New Zealand"]),
    q("w-m-14", "medium", "winners", "Which Danish brothers won Eurovision 2000 with 'Fly on the Wings of Love'?", "The Olsen Brothers", ["The Kessler Twins", "Brødrene Olsen & Søn", "The Herreys"]),
    q("w-m-15", "medium", "records", "Who is one of only two artists to win Eurovision twice as a performer, with 'Euphoria' and 'Tattoo'?", "Loreen", ["Carola", "Charlotte Perrelli", "Helena Paparizou"]),
    q("w-m-16", "medium", "nordic", "Which Norwegian singer famously scored nul points in 1978 with 'Mil etter mil'?", "Jahn Teigen", ["Finn Kalvik", "Tor Endresen", "Åse Kleveland"]),
    q("w-m-17", "medium", "records", "Which two countries both finished on nul points in the 2015 final?", "Austria and Germany", ["United Kingdom and France", "Spain and Portugal", "Norway and Sweden"]),
    q("w-m-18", "medium", "winners", "Which Greek singer won Eurovision 2005 with 'My Number One'?", "Helena Paparizou", ["Sakis Rouvas", "Anna Vissi", "Eleftheria Eleftheriou"]),
    q("w-m-19", "medium", "hosts", "Which country hosted Eurovision in 2012?", "Azerbaijan", ["Georgia", "Turkey", "Armenia"]),
    q("w-m-20", "medium", "spectacle", "Which Irish act in 2008 was a turkey puppet singing 'Irelande Douze Pointe'?", "Dustin the Turkey", ["Jedward", "Bosco", "Zig and Zag"]),
    q("w-m-21", "medium", "songs", "Which language was Marija Šerifović's winning 'Molitva' sung in?", "Serbian", ["Croatian", "Bosnian", "English"]),
    q("w-m-22", "medium", "winners", "Which Ukrainian singer won Eurovision 2016 with '1944'?", "Jamala", ["Ruslana", "Tina Karol", "Svetlana Loboda"]),
    q("w-m-23", "medium", "nordic", "Which Icelandic act sang the techno-punk 'Hatrið mun sigra' in 2019?", "Hatari", ["Systur", "Of Monsters and Men", "Svala"]),
    q("w-m-25", "medium", "spectacle", "What did Måns Zelmerlöw share the stage with when he won with 'Heroes' in 2015?", "Animated stick figures", ["A live choir of children", "A giant hamster wheel", "Fire-breathing dancers"]),
    q("w-m-26", "medium", "spectacle", "Which global star performed as an interval act at Eurovision 2019 in Tel Aviv?", "Madonna", ["Lady Gaga", "Justin Timberlake", "Celine Dion"]),
    q("w-m-24", "medium", "spectacle", "Who performed the 2016 interval act 'Love Love Peace Peace' with Måns Zelmerlöw?", "Petra Mede", ["Sarah Dawn Finer", "Charlotte Perrelli", "Carola"]),

    // --- Hard ---
    q("w-h-01", "hard", "winners", "Which singer won the very first Eurovision in 1956?", "Lys Assia", ["Corry Brokken", "Freddy Quinn", "Jetty Paerl"]),
    q("w-h-02", "hard", "winners", "Which British singer won barefoot in 1967 with 'Puppet on a String'?", "Sandie Shaw", ["Lulu", "Cilla Black", "Dusty Springfield"]),
    q("w-h-03", "hard", "hosts", "Why did Edinburgh host Eurovision 1972 after Monaco's win?", "Monaco couldn't host, so the BBC stepped in", ["Monaco won a coin toss to swap", "Scotland won in 1971", "Edinburgh bid higher than Monte Carlo"]),
    q("w-h-04", "hard", "hosts", "Which small Irish town hosted Eurovision 1993?", "Millstreet", ["Kilkenny", "Tralee", "Ennis"]),
    q("w-h-05", "hard", "records", "Johnny Logan won twice as a singer. How did he win a third time, in 1992?", "As the writer of 'Why Me?'", ["As a backing singer", "As the conductor", "As the host"]),
    q("w-h-06", "hard", "records", "In which year did the 1-8, 10 and 12 points system first appear?", "1975", ["1956", "1969", "1980"]),
    q("w-h-07", "hard", "nordic", "Which Swedish group won in 1984 with 'Diggi-Loo Diggi-Ley'?", "Herreys", ["Brotherhood of Man", "Bucks Fizz", "ABBA"]),
    q("w-h-08", "hard", "winners", "Which French-speaking Belgian singer won in 1986, aged 13?", "Sandra Kim", ["Lara Fabian", "Axelle Red", "Jacqueline Boyer"]),
    q("w-h-09", "hard", "records", "Which British act scored nul points in 2003 with 'Cry Baby'?", "Jemini", ["Daz Sampson", "Scooch", "Andy Abraham"]),
    q("w-h-10", "hard", "hosts", "Which city hosted Eurovision 1986, the first time Norway hosted?", "Bergen", ["Oslo", "Trondheim", "Stavanger"]),
    q("w-h-11", "hard", "winners", "Which Israeli band won Eurovision 1979 at home in Jerusalem?", "Milk and Honey", ["Alphabeta", "Hakol Over Habibi", "Ofarim"]),
    q("w-h-12", "hard", "songs", "What was Yugoslavia's only Eurovision win, in 1989?", "Riva – 'Rock Me'", ["Novi Fosili – 'Ja sam za ples'", "Danijel – 'Džuli'", "Tajči – 'Hajde da ludujemo'"]),
    q("w-h-13", "hard", "records", "With how many points did Alexander Rybak set the old-system record in 2009?", "387", ["342", "412", "298"]),
    q("w-h-14", "hard", "winners", "Which Estonian trio won in 2001 with 'Everybody'?", "Tanel Padar, Dave Benton & 2XL", ["Ines & Friends", "Urban Symphony", "Sahlene & 2XL"]),
    q("w-h-15", "hard", "winners", "Which Latvian singer won in 2002 with 'I Wanna'?", "Marie N", ["Aisha", "Laima Vaikule", "Samanta Tīna"]),
    q("w-h-16", "hard", "songs", "Which future Grease star represented the United Kingdom in 1974, the year ABBA won?", "Olivia Newton-John", ["Lulu", "Cliff Richard", "Sandie Shaw"]),
    q("w-h-17", "hard", "records", "Which country returned to Eurovision in 2024 after 30 years away?", "Luxembourg", ["Monaco", "Andorra", "Slovakia"]),
    q("w-h-18", "hard", "hosts", "Which country hosted Eurovision 2026?", "Austria", ["Switzerland", "Bulgaria", "Germany"]),
    q("w-h-19", "hard", "records", "What was Italy's first Eurovision win, in 1964?", "Gigliola Cinquetti – 'Non ho l'età'", ["Domenico Modugno – 'Nel blu, dipinto di blu'", "Toto Cutugno – 'Insieme: 1992'", "Al Bano & Romina Power – 'Magic Oh Magic'"]),
    q("w-h-20", "hard", "nordic", "Which Finnish rapper came second in 2023 but won the televote?", "Käärijä", ["Blind Channel", "Lordi", "Windows95man"]),
    q("w-h-21", "hard", "records", "Which year did the United Kingdom's James Newman score nul points with 'Embers'?", "2021", ["2019", "2022", "2017"]),
    q("w-h-22", "hard", "songs", "What did Salvador Sobral famously tell the arena after winning in 2017?", "That music isn't fireworks, it's feeling", ["That he'd never sing in English", "That the jury was always right", "That he'd return the next year"]),
    q("w-h-23", "hard", "winners", "Which French entry won in 1977, the last French win to date?", "Marie Myriam – 'L'oiseau et l'enfant'", ["Frida Boccara – 'Un jour, un enfant'", "Patricia Kaas – 'Et s'il fallait le faire'", "Amir – 'J'ai cherché'"]),
    q("w-h-24", "hard", "hosts", "On which days are the Eurovision 2027 semi-finals and final?", "11, 13 and 15 May", ["12, 14 and 16 May", "9, 11 and 13 May", "13, 15 and 17 May"]),
];

export const BANK_QUESTIONS: BankQuestion[] = [
    ...tagClassics(easyClassics as QuizQuestion[], "easy"),
    ...tagClassics(mediumClassics as QuizQuestion[], "medium"),
    ...tagClassics(hardClassics as QuizQuestion[], "hard"),
    ...NEW_QUESTIONS.map((question): BankQuestion => ({ ...question, source: "bank" })),
];

export const bankQuestion = (id: string): BankQuestion | undefined =>
    BANK_QUESTIONS.find(question => question.id === id);
