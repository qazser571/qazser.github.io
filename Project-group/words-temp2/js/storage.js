const STORAGE_KEY = "word_sets";


export function loadSets() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

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
        lastModifiedDate: new Date().toISOString()
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

    updatedSet.lastModifiedDate = new Date().toISOString();

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
    set.lastModifiedDate = new Date().toISOString();

    saveSets(sets);

    return newWord;
}


export function deleteWord(setId, wordId) {
    const sets = loadSets();
    const set = sets.find(s => s.id === setId);

    if (!set) return;

    set.words = set.words.filter(w => w.id !== wordId);
    set.lastModifiedDate = new Date().toISOString();

    saveSets(sets);
}


export function formatDate(date) {
    if (!date) return "----.--.--";

    return date.split("T")[0].replaceAll("-", ".");
}