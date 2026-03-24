/* storage.js */

const STORAGE_KEY = "word_sets";


function generateTestWords(count) {
    const words = [];

    for (let i = 1; i <= count; i++) {
        const num = String(i).padStart(3, "0");

        words.push({
            id: crypto.randomUUID(),
            spelling: `word${num}`,
            phonetic: `/wɜːrd${num}/`,
            meaning: `테스트 의미 ${num}`,
            lastStudyDate: "2026-03-01T00:00:00.000Z",
            status: "never"
        });
    }

    return words;
}

function getLocalISOString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString();
}

function initializeTestData() {
    const testSet = {
        id: crypto.randomUUID(),
        name: "테스트 세트",
        words: generateTestWords(500),
        sectionSize: 10,
        showMeaning: true,
        splitMode: false,
        knowExclude: false,
        shuffleMode: false,
        lastModifiedDate: "2026-02-15T00:00:00.000Z"
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify([testSet]));
}


export function loadSets() {

    let raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
        initializeTestData();
        raw = localStorage.getItem(STORAGE_KEY);
    }

    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error("데이터 파싱 실패:", e);
        return [];
    }
}


export function saveSets(sets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}


export function createSet(name) {
    const sets = loadSets();

    const newSet = {
        id: crypto.randomUUID(),
        name: name,
        words: [],
        sectionSize: 10,
        showMeaning: true,
        splitMode: false,
        knowExclude: false,
        shuffleMode: false,
        lastModifiedDate: getLocalISOString()
    };

    sets.push(newSet);
    saveSets(sets);

    return newSet;
}


export function getSetById(id) {
    const sets = loadSets();
    return sets.find(set => set.id === id);
}


export function updateSet(updatedSet) {
    const sets = loadSets();

    const index = sets.findIndex(set => set.id === updatedSet.id);

    if (index === -1) return;

    updatedSet.lastModifiedDate = getLocalISOString();

    sets[index] = updatedSet;
    saveSets(sets);
}


export function deleteSet(id) {
    const sets = loadSets().filter(set => set.id !== id);
    saveSets(sets);
}


export function addWordToSet(setId, wordData) {
    const sets = loadSets();
    const set = sets.find(s => s.id === setId);

    if (!set) return;

    const newWord = {
        id: crypto.randomUUID(),
        spelling: wordData.spelling,
        phonetic: wordData.phonetic,
        meaning: wordData.meaning,
        lastStudyDate: null,
        status: "never"
    };

    set.words.push(newWord);
    set.lastModifiedDate = getLocalISOString();

    saveSets(sets);

    return newWord;
}


export function deleteWord(setId, wordId) {
    const sets = loadSets();
    const set = sets.find(s => s.id === setId);

    if (!set) return;

    set.words = set.words.filter(w => w.id !== wordId);
    set.lastModifiedDate = getLocalISOString();

    saveSets(sets);
}


export function formatDate(date) {
    if (!date) return "----.--.--";

    return date.split("T")[0].replaceAll("-", ".");
}


export function replaceWords(setId, words) {

    const sets = loadSets();

    const set = sets.find(s => s.id === setId);

    if (!set) return;

    set.words = words;
    set.lastModifiedDate = getLocalISOString();

    saveSets(sets);
}


/* =============================
    NEW: STUDY OPTIONS
============================= */

export function updateStudyOptions(setId, options) {
    const sets = loadSets();
    const set = sets.find(s => s.id === setId);

    if (!set) return;

    if (typeof options.knowExclude === "boolean") {
        set.knowExclude = options.knowExclude;
    }

    if (typeof options.shuffleMode === "boolean") {
        set.shuffleMode = options.shuffleMode;
    }

    set.lastModifiedDate = getLocalISOString();
    saveSets(sets);
}

export function getStudyOptions(setId) {
    const set = getSetById(setId);

    if (!set) return { knowExclude: false, shuffleMode: false };

    return {
        knowExclude: set.knowExclude ?? false,
        shuffleMode: set.shuffleMode ?? false
    };
}