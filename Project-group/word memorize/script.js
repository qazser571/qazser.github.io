"use strict";

const DB_NAME = "VocabularyStudyDB";
const DB_VERSION = 2;
const WORD_STORE = "words";
const META_STORE = "meta";

const DEFAULT_SETTINGS = {
    sectionSize: 80,
    timerEnabled: true,
    timerSeconds: 6,
    meaningCountTimeEnabled: true,
    meaningCountTimeSeconds: 1.5,
    meaningHidden: true,
    excludeKnown: false,
    darkMode: false
};

const ANSWER_FEEDBACK_TIME = 1000;

const state = {
    words: [],
    settings: { ...DEFAULT_SETTINGS },
    selectedSections: new Set(),
    session: null,
    timerId: null,
    timerStartedAt: 0,
    timerDuration: 0,
    timerRemaining: 0
};

const elements = {
    menuButton: document.getElementById("menuButton"),
    progressText: document.getElementById("progressText"),
    timerText: document.getElementById("timerText"),
    timerBar: document.getElementById("timerBar"),
    wordCard: document.getElementById("wordCard"),
    initialMessage: document.getElementById("initialMessage"),
    studyContent: document.getElementById("studyContent"),
    wordText: document.getElementById("wordText"),
    meaningSection: document.getElementById("meaningSection"),
    resultContent: document.getElementById("resultContent"),
    knowButton: document.getElementById("knowButton"),
    dontKnowButton: document.getElementById("dontKnowButton"),
    menuOverlay: document.getElementById("menuOverlay"),
    closeMenuButton: document.getElementById("closeMenuButton"),
    loadButton: document.getElementById("loadButton"),
    saveButton: document.getElementById("saveButton"),
    fileInput: document.getElementById("fileInput"),
    sectionSizeInput: document.getElementById("sectionSizeInput"),
    sectionList: document.getElementById("sectionList"),
    emptytextArea: document.getElementById("emptytextArea"),
    selectAllButton: document.getElementById("selectAllButton"),
    timerEnabledCheckbox: document.getElementById("timerEnabledCheckbox"),
    timerInput: document.getElementById("timerInput"),
    meaningCountTimeCheckbox: document.getElementById("meaningCountTimeCheckbox"),
    meaningCountTimeInput: document.getElementById("meaningCountTimeInput"),
    meaningHiddenCheckbox: document.getElementById("meaningHiddenCheckbox"),
    excludeKnownCheckbox: document.getElementById("excludeKnownCheckbox"),
    darkModeCheckbox: document.getElementById("darkModeCheckbox"),
    startButton: document.getElementById("startButton"),
    startMessage: document.getElementById("startMessage")
};

let dbPromise = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    bindEvents();

    try {
        await openDatabase();
        await loadStateFromDatabase();
        renderSettings();
        renderSections();
        renderInitialStudyState();
    } catch (error) {
        console.error(error);
        elements.initialMessage.textContent = "데이터 저장소를 초기화할 수 없습니다.";
    }
}

/* =========================================================
   Event binding
========================================================= */

function bindEvents() {
    elements.menuButton.addEventListener("click", openMenu);
    elements.closeMenuButton.addEventListener("click", closeMenu);

    elements.menuOverlay.addEventListener("click", (event) => {
        if (event.target === elements.menuOverlay) {
            closeMenu();
        }
    });

    elements.loadButton.addEventListener("click", () => {
        elements.fileInput.value = "";
        elements.fileInput.click();
    });

    elements.saveButton.addEventListener("click", handleSave);
    elements.fileInput.addEventListener("change", handleFileLoad);
    elements.sectionSizeInput.addEventListener("input", handleSectionSizeInput);
    elements.sectionSizeInput.addEventListener("blur", normalizeSectionSizeInput);
    elements.timerEnabledCheckbox.addEventListener("change", handleTimerEnabledChange);
    elements.timerInput.addEventListener("input", handleTimerInput);
    elements.timerInput.addEventListener("blur", normalizeTimerInput);
    elements.meaningCountTimeCheckbox.addEventListener("change", handleMeaningCountTimeEnabledChange);
    elements.meaningCountTimeInput.addEventListener("input", handleMeaningCountTimeInput);
    elements.meaningCountTimeInput.addEventListener("blur", normalizeMeaningCountTimeInput);
    elements.meaningHiddenCheckbox.addEventListener("change", handleMeaningHiddenChange);
    elements.excludeKnownCheckbox.addEventListener("change", handleExcludeKnownChange);
    elements.darkModeCheckbox.addEventListener("change", handleDarkModeChange);
    elements.selectAllButton.addEventListener("click", toggleAllSections);
    elements.startButton.addEventListener("click", startStudy);

    elements.knowButton.addEventListener("click", () => {
        handleAnswer(true);
    });

    elements.dontKnowButton.addEventListener("click", () => {
        handleAnswer(false);
    });

    elements.meaningSection.addEventListener("click", toggleMeaningVisibility);
}

function toggleMeaningVisibility() {
    elements.meaningSection.classList.toggle("hidden-meaning");
}

/* =========================================================
   IndexedDB
========================================================= */

function openDatabase() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(WORD_STORE)) {
                db.createObjectStore(WORD_STORE, { keyPath: "id" });
            }

            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: "key" });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });

    return dbPromise;
}

function getDatabase() {
    return openDatabase();
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function loadStateFromDatabase() {
    const db = await getDatabase();

    const transaction = db.transaction([WORD_STORE, META_STORE], "readonly");
    const wordStore = transaction.objectStore(WORD_STORE);
    const metaStore = transaction.objectStore(META_STORE);

    let words = await requestToPromise(wordStore.getAll());
    words = normalizeLoadedWords(words);

    const sectionSize = await requestToPromise(metaStore.get("sectionSize"));
    const timerEnabled = await requestToPromise(metaStore.get("timerEnabled"));
    const timerSeconds = await requestToPromise(metaStore.get("timerSeconds"));
    const meaningCountTimeEnabled = await requestToPromise(metaStore.get("meaningCountTimeEnabled"));
    const meaningCountTimeSeconds = await requestToPromise(metaStore.get("meaningCountTimeSeconds"));
    const meaningHidden = await requestToPromise(metaStore.get("meaningHidden"));
    const excludeKnown = await requestToPromise(metaStore.get("excludeKnown"));
    const darkMode = await requestToPromise(metaStore.get("darkMode"));

    state.words = Array.isArray(words) ? words : [];

    await saveWordOrders(state.words);

    state.settings = {
        sectionSize: getValidPositiveInteger(sectionSize?.value, DEFAULT_SETTINGS.sectionSize),
        timerEnabled: typeof timerEnabled?.value === "boolean" ? timerEnabled.value : DEFAULT_SETTINGS.timerEnabled,
        timerSeconds: getValidPositiveInteger(timerSeconds?.value, DEFAULT_SETTINGS.timerSeconds),
        meaningCountTimeEnabled: typeof meaningCountTimeEnabled?.value === "boolean" ? meaningCountTimeEnabled.value : DEFAULT_SETTINGS.meaningCountTimeEnabled,
        meaningCountTimeSeconds: getValidPositiveNumber(meaningCountTimeSeconds?.value, DEFAULT_SETTINGS.meaningCountTimeSeconds),
        meaningHidden: typeof meaningHidden?.value === "boolean" ? meaningHidden.value : DEFAULT_SETTINGS.meaningHidden,
        excludeKnown: typeof excludeKnown?.value === "boolean" ? excludeKnown.value : DEFAULT_SETTINGS.excludeKnown,
        darkMode: typeof darkMode?.value === "boolean" ? darkMode.value : DEFAULT_SETTINGS.darkMode
    };

    await saveAllSettings();
    applyDarkMode();
}

async function saveAllSettings() {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(META_STORE, "readwrite");
        const store = transaction.objectStore(META_STORE);

        store.put({ key: "sectionSize", value: state.settings.sectionSize });
        store.put({ key: "timerEnabled", value: state.settings.timerEnabled });
        store.put({ key: "timerSeconds", value: state.settings.timerSeconds });
        store.put({ key: "meaningCountTimeEnabled", value: state.settings.meaningCountTimeEnabled });
        store.put({ key: "meaningCountTimeSeconds", value: state.settings.meaningCountTimeSeconds });
        store.put({ key: "meaningHidden", value: state.settings.meaningHidden });
        store.put({ key: "excludeKnown", value: state.settings.excludeKnown });
        store.put({ key: "darkMode", value: state.settings.darkMode });

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

async function saveWord(word) {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(WORD_STORE, "readwrite");
        const store = transaction.objectStore(WORD_STORE);

        const normalizedWord = {
            ...word,
            order: Number.isInteger(word.order) ? word.order : 0
        };

        store.put(normalizedWord);

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

function normalizeLoadedWords(words) {
    if (!Array.isArray(words)) {
        return [];
    }

    const hasValidOrder = words.length === 0 || words.every((word) => Number.isInteger(word?.order) && word.order >= 0);

    if (hasValidOrder) {
        return [...words].sort((a, b) => a.order - b.order);
    }

    return words.map((word, index) => ({
        ...word,
        order: index
    }));
}

async function saveWordOrders(words) {
    if (!Array.isArray(words) || words.length === 0) {
        return;
    }

    const db = await getDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(WORD_STORE, "readwrite");
        const store = transaction.objectStore(WORD_STORE);

        for (let index = 0; index < words.length; index += 1) {
            const word = words[index];

            if (!word?.id) {
                continue;
            }

            store.put({
                ...word,
                order: index
            });
        }

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

async function replaceDatabaseData(words, settings) {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([WORD_STORE, META_STORE], "readwrite");
        const wordStore = transaction.objectStore(WORD_STORE);
        const metaStore = transaction.objectStore(META_STORE);

        wordStore.clear();

        words.forEach((word, index) => {
            wordStore.put({
                ...word,
                order: index
            });
        });

        metaStore.put({ key: "sectionSize", value: settings.sectionSize });
        metaStore.put({ key: "timerEnabled", value: settings.timerEnabled });
        metaStore.put({ key: "timerSeconds", value: settings.timerSeconds });
        metaStore.put({ key: "meaningCountTimeEnabled", value: settings.meaningCountTimeEnabled });
        metaStore.put({ key: "meaningCountTimeSeconds", value: settings.meaningCountTimeSeconds });
        metaStore.put({ key: "meaningHidden", value: settings.meaningHidden });
        metaStore.put({ key: "excludeKnown", value: settings.excludeKnown });
        metaStore.put({ key: "darkMode", value: settings.darkMode });

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

/* =========================================================
   Menu
========================================================= */

function openMenu() {
    renderSettings();
    renderSections();
    elements.menuOverlay.classList.remove("hidden");
}

function closeMenu() {
    elements.menuOverlay.classList.add("hidden");
    elements.startMessage.textContent = "";
}

function renderSettings() {
    elements.sectionSizeInput.value = state.settings.sectionSize;
    elements.timerEnabledCheckbox.checked = state.settings.timerEnabled;
    elements.timerInput.value = state.settings.timerSeconds;
    elements.timerInput.disabled = !state.settings.timerEnabled;
    elements.meaningCountTimeCheckbox.checked = state.settings.meaningCountTimeEnabled;
    elements.meaningCountTimeInput.value = state.settings.meaningCountTimeSeconds;
    elements.meaningCountTimeInput.disabled = !state.settings.meaningCountTimeEnabled;
    elements.meaningHiddenCheckbox.checked = state.settings.meaningHidden;
    elements.excludeKnownCheckbox.checked = state.settings.excludeKnown;
    elements.darkModeCheckbox.checked = state.settings.darkMode;
    applyDarkMode();
}

function applyDarkMode() {
    document.documentElement.dataset.theme = state.settings.darkMode ? "dark" : "light";

    const themeColor = state.settings.darkMode ? "#111827" : "#2563eb";
    const themeMeta = document.querySelector('meta[name="theme-color"]');

    if (themeMeta) {
        themeMeta.content = themeColor;
    }
}

async function handleDarkModeChange() {
    state.settings.darkMode = elements.darkModeCheckbox.checked;
    applyDarkMode();
    await saveAllSettings();
}

function renderInitialStudyState() {
    stopTimer();

    elements.progressText.textContent = "0 / 0";
    elements.timerText.textContent = "0";
    elements.timerBar.style.transform = "scaleX(0)";
    elements.initialMessage.classList.remove("hidden");
    elements.studyContent.classList.add("hidden");
    elements.resultContent.classList.add("hidden");
    elements.wordCard.classList.remove("flash-correct", "flash-wrong");

    setAnswerButtonsEnabled(false);
}

/* =========================================================
   Section handling
========================================================= */

function getSectionCount() {
    if (state.words.length === 0) {
        return 0;
    }

    return Math.ceil(state.words.length / state.settings.sectionSize);
}

function getSections() {
    const sections = [];
    const sectionSize = state.settings.sectionSize;

    for (let start = 0; start < state.words.length; start += sectionSize) {
        const end = Math.min(start + sectionSize, state.words.length);

        sections.push({
            number: sections.length + 1,
            startIndex: start,
            endIndex: end
        });
    }

    return sections;
}

function renderSections() {
    const sections = getSections();
    elements.sectionList.innerHTML = "";
    elements.emptytextArea.innerHTML = "";

    if (sections.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "section-empty-message";
        emptyMessage.textContent = "불러온 단어가 없습니다.";
        elements.emptytextArea.appendChild(emptyMessage);
        elements.selectAllButton.textContent = "전체선택";
        return;
    }

    const validSectionNumbers = new Set(sections.map((section) => section.number));

    for (const number of state.selectedSections) {
        if (!validSectionNumbers.has(number)) {
            state.selectedSections.delete(number);
        }
    }

    for (const section of sections) {
        const sectionButton = document.createElement("button");

        sectionButton.type = "button";
        sectionButton.className = "section-item";
        sectionButton.textContent = section.number;

        if (state.selectedSections.has(section.number)) {
            sectionButton.classList.add("selected");
        }

        sectionButton.addEventListener("click", () => {
            toggleSection(section.number);
        });

        elements.sectionList.appendChild(sectionButton);
    }

    updateSelectAllText();
}

function toggleSection(sectionNumber) {
    if (state.selectedSections.has(sectionNumber)) {
        state.selectedSections.delete(sectionNumber);
    } else {
        state.selectedSections.add(sectionNumber);
    }

    renderSections();
}

function toggleAllSections() {
    const sections = getSections();

    if (sections.length === 0) {
        return;
    }

    const allSelected = state.selectedSections.size === sections.length;

    if (allSelected) {
        state.selectedSections.clear();
    } else {
        state.selectedSections = new Set(sections.map((section) => section.number));
    }

    renderSections();
}

function updateSelectAllText() {
    const totalSections = getSectionCount();
    const allSelected = totalSections > 0 && state.selectedSections.size === totalSections;

    elements.selectAllButton.textContent = allSelected ? "전체해제" : "전체선택";
}

/* =========================================================
   Setting changes
========================================================= */

async function handleSectionSizeInput() {
    const value = parsePositiveInteger(elements.sectionSizeInput.value);

    if (!value) {
        return;
    }

    state.settings.sectionSize = value;
    state.selectedSections.clear();

    await saveAllSettings();
    renderSections();
}

async function normalizeSectionSizeInput() {
    const value = parsePositiveInteger(elements.sectionSizeInput.value);

    if (!value) {
        elements.sectionSizeInput.value = state.settings.sectionSize;
        return;
    }

    state.settings.sectionSize = value;
    elements.sectionSizeInput.value = value;
    state.selectedSections.clear();

    await saveAllSettings();
    renderSections();
}

async function handleTimerEnabledChange() {
    state.settings.timerEnabled = elements.timerEnabledCheckbox.checked;
    elements.timerInput.disabled = !state.settings.timerEnabled;

    await saveAllSettings();

    if (state.session) {
        restartCurrentTimer();
    }

    renderSettings();
}

async function handleTimerInput() {
    const value = parsePositiveInteger(elements.timerInput.value);

    if (!value) {
        return;
    }

    state.settings.timerSeconds = value;
    await saveAllSettings();

    if (state.session && state.settings.timerEnabled) {
        restartCurrentTimer();
    }
}

async function normalizeTimerInput() {
    const value = parsePositiveInteger(elements.timerInput.value);

    if (!value) {
        elements.timerInput.value = state.settings.timerSeconds;
        return;
    }

    state.settings.timerSeconds = value;
    elements.timerInput.value = value;

    await saveAllSettings();

    if (state.session && state.settings.timerEnabled) {
        restartCurrentTimer();
    }
}

async function handleMeaningCountTimeEnabledChange() {
    state.settings.meaningCountTimeEnabled = elements.meaningCountTimeCheckbox.checked;
    elements.meaningCountTimeInput.disabled = !state.settings.meaningCountTimeEnabled;

    await saveAllSettings();
}

async function handleMeaningCountTimeInput() {
    const value = parsePositiveHalfSecond(elements.meaningCountTimeInput.value);

    if (value === null) {
        return;
    }

    state.settings.meaningCountTimeSeconds = value;
    await saveAllSettings();
}

async function normalizeMeaningCountTimeInput() {
    const value = parsePositiveHalfSecond(elements.meaningCountTimeInput.value);

    if (value === null) {
        elements.meaningCountTimeInput.value = state.settings.meaningCountTimeSeconds;
        return;
    }

    state.settings.meaningCountTimeSeconds = value;
    elements.meaningCountTimeInput.value = value;

    await saveAllSettings();
}

async function handleMeaningHiddenChange() {
    state.settings.meaningHidden = elements.meaningHiddenCheckbox.checked;
    await saveAllSettings();
    renderSettings();
}

async function handleExcludeKnownChange() {
    state.settings.excludeKnown = elements.excludeKnownCheckbox.checked;
    await saveAllSettings();
    renderSettings();
}

/* =========================================================
   Study start
========================================================= */

function startStudy() {
    clearStartMessage();

    const selectedWords = getSelectedWordsForStudy();

    if (selectedWords.length === 0) {
        const selectedSectionCount = state.selectedSections.size;

        if (selectedSectionCount === 0) {
            showStartMessage("구간을 하나 이상 선택해주세요.");
        } else {
            showStartMessage("학습할 단어가 없습니다.");
        }

        return;
    }

    stopTimer();

    state.session = {
        words: selectedWords,
        currentIndex: 0,
        answers: [],
        answering: false
    };

    elements.menuOverlay.classList.add("hidden");
    renderCurrentStudyWord();
}

function getSelectedWordsForStudy() {
    const sections = getSections();
    const sortedSectionNumbers = [...state.selectedSections].sort((a, b) => a - b);
    const selectedWords = [];

    for (const sectionNumber of sortedSectionNumbers) {
        const section = sections.find((item) => item.number === sectionNumber);

        if (!section) {
            continue;
        }

        for (let index = section.startIndex; index < section.endIndex; index += 1) {
            const word = state.words[index];

            if (!word) {
                continue;
            }

            if (state.settings.excludeKnown && word.status === 1) {
                continue;
            }

            selectedWords.push(word);
        }
    }

    return selectedWords;
}

/* =========================================================
   Study rendering
========================================================= */

function renderCurrentStudyWord() {
    if (!state.session) {
        return;
    }

    const session = state.session;
    const currentWord = session.words[session.currentIndex];

    if (!currentWord) {
        finishStudy();
        return;
    }

    elements.progressText.textContent = `${session.currentIndex + 1} / ${session.words.length}`;
    elements.wordText.textContent = currentWord.word;
    elements.meaningSection.innerHTML = "";
    elements.meaningSection.classList.toggle("hidden-meaning", state.settings.meaningHidden);

    const meanings = Array.isArray(currentWord.meanings) && currentWord.meanings.length > 0
        ? currentWord.meanings
        : [currentWord.rawMeaning];

    meanings.forEach((meaning, index) => {
        const item = document.createElement("div");
        const number = document.createElement("span");
        const text = document.createElement("span");

        item.className = "meaning-item";
        number.className = "meaning-number";
        text.className = "meaning-text";

        number.textContent = `${index + 1}.`;
        text.textContent = meaning;

        item.appendChild(number);
        item.appendChild(text);
        elements.meaningSection.appendChild(item);
    });

    elements.initialMessage.classList.add("hidden");
    elements.studyContent.classList.remove("hidden");
    elements.resultContent.classList.add("hidden");
    elements.wordCard.classList.remove("flash-correct", "flash-wrong");

    /* 새 단어가 시작되었으므로 답변 처리 상태를 초기화 */
    session.answering = false;

    setAnswerButtonsEnabled(true);
    startTimer();
}

function setAnswerButtonsEnabled(enabled) {
    elements.knowButton.disabled = !enabled;
    elements.dontKnowButton.disabled = !enabled;
}

/* =========================================================
   Timer
========================================================= */

function startTimer() {
    stopTimer();

    if (!state.session) {
        return;
    }

    if (!state.settings.timerEnabled) {
        state.timerDuration = 0;
        state.timerRemaining = 0;
        updateTimerDisplay();
        return;
    }

    const currentWord = state.session.words[state.session.currentIndex];
    const meaningCount = Array.isArray(currentWord?.meanings) ? currentWord.meanings.length : 1;
    const additionalMeaningCount = Math.max(0, meaningCount - 1);

    const additionalSeconds = state.settings.meaningCountTimeEnabled
        ? additionalMeaningCount * state.settings.meaningCountTimeSeconds
        : 0;

    state.timerDuration = (state.settings.timerSeconds + additionalSeconds) * 1000;
    state.timerRemaining = state.timerDuration;
    state.timerStartedAt = performance.now();

    elements.timerBar.style.transition = "none";
    elements.timerBar.style.transform = "scaleX(1)";

    void elements.timerBar.offsetWidth;

    elements.timerBar.style.transition = "transform 0.08s linear";

    updateTimerDisplay();

    state.timerId = window.setInterval(updateTimer, 50);
}

function restartCurrentTimer() {
    if (!state.session || state.session.answering) {
        return;
    }

    startTimer();
}

function updateTimer() {
    if (!state.session) {
        stopTimer();
        return;
    }

    const elapsed = performance.now() - state.timerStartedAt;

    state.timerRemaining = Math.max(0, state.timerDuration - elapsed);

    updateTimerDisplay();

    if (state.timerRemaining <= 0) {
        stopTimer();
        handleAnswer(false);
    }
}

function updateTimerDisplay() {
    if (!state.settings.timerEnabled) {
        elements.timerText.textContent = "∞";
        elements.timerBar.style.transform = "scaleX(1)";
        return;
    }

    const seconds = Math.ceil(state.timerRemaining / 1000);

    elements.timerText.textContent = Math.max(0, seconds);

    const progress = state.timerDuration > 0
        ? state.timerRemaining / state.timerDuration
        : 0;

    elements.timerBar.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
}

function stopTimer() {
    if (state.timerId !== null) {
        window.clearInterval(state.timerId);
        state.timerId = null;
    }
}

/* =========================================================
   Answer handling
========================================================= */

async function handleAnswer(isKnown) {
    if (!state.session || state.session.answering) {
        return;
    }

    const session = state.session;
    const currentWord = session.words[session.currentIndex];

    if (!currentWord) {
        return;
    }

    session.answering = true;

    stopTimer();
    setAnswerButtonsEnabled(false);

    const newStatus = isKnown ? 1 : 0;

    currentWord.status = newStatus;

    const sourceWord = state.words.find((word) => word.id === currentWord.id);

    if (sourceWord) {
        sourceWord.status = newStatus;
    }

    saveWord({
        ...currentWord,
        status: newStatus
    }).catch((error) => {
        console.error(error);
    });

    session.answers.push({
        wordId: currentWord.id,
        result: isKnown ? "correct" : "wrong"
    });

    elements.wordCard.classList.remove("flash-correct", "flash-wrong");
    void elements.wordCard.offsetWidth;

    if (isKnown) {
        elements.wordCard.classList.add("flash-correct");
    } else {
        elements.wordCard.classList.add("flash-wrong");
    }

    await wait(ANSWER_FEEDBACK_TIME);

    if (state.session !== session) {
        return;
    }

    elements.wordCard.classList.remove("flash-correct", "flash-wrong");

    session.currentIndex += 1;

    if (session.currentIndex >= session.words.length) {
        finishStudy();
        return;
    }

    renderCurrentStudyWord();
}

/* =========================================================
   Study completion
========================================================= */

function finishStudy() {
    if (!state.session) {
        return;
    }

    stopTimer();

    const session = state.session;

    elements.progressText.textContent = `${session.words.length} / ${session.words.length}`;
    elements.timerText.textContent = "0";
    elements.timerBar.style.transform = "scaleX(0)";

    setAnswerButtonsEnabled(false);

    elements.studyContent.classList.add("hidden");
    elements.initialMessage.classList.add("hidden");
    elements.resultContent.classList.remove("hidden");

    renderResults(session);

    state.session = null;
}

function renderResults(session) {
    elements.resultContent.innerHTML = "";

    const title = document.createElement("div");
    title.className = "result-title";
    title.textContent = "학습 결과";

    elements.resultContent.appendChild(title);

    const resultList = document.createElement("div");
    resultList.className = "result-list";

    const wrongAnswers = session.answers.filter((answer) => answer.result === "wrong");
    const correctAnswers = session.answers.filter((answer) => answer.result === "correct");

    appendResultUnits(resultList, wrongAnswers, session.words, false);
    appendResultUnits(resultList, correctAnswers, session.words, true);

    elements.resultContent.appendChild(resultList);
}

function appendResultUnits(resultList, answers, sessionWords, isCorrect) {
    for (const answer of answers) {
        const word = sessionWords.find((item) => item.id === answer.wordId);

        if (!word) {
            continue;
        }

        const unit = document.createElement("div");
        unit.className = `result-unit ${isCorrect ? "correct" : "wrong"}`;

        const mark = document.createElement("span");
        mark.className = "result-mark";
        mark.textContent = isCorrect ? "O" : "X";

        const wordText = document.createElement("span");
        wordText.className = "result-word";
        wordText.textContent = word.word;

        const meaning = document.createElement("span");
        meaning.className = "result-meaning";
        meaning.textContent = word.rawMeaning;

        unit.appendChild(mark);
        unit.appendChild(wordText);
        unit.appendChild(meaning);

        resultList.appendChild(unit);
    }
}

/* =========================================================
   TXT load
========================================================= */

async function handleFileLoad(event) {
    const file = event.target.files?.[0];

    if (!file) {
        return;
    }

    try {
        const text = await file.text();
        const parsed = parseTextData(text);

        parsed.settings.meaningHidden = state.settings.meaningHidden;
        parsed.settings.darkMode = state.settings.darkMode;

        if (parsed.words.length === 0) {
            showStartMessage("불러온 TXT 파일에서 단어를 찾지 못했습니다.");
            return;
        }

        await replaceDatabaseData(parsed.words, parsed.settings);

        stopTimer();

        state.words = parsed.words.map((word, index) => ({
            ...word,
            order: index
        }));

        state.settings = parsed.settings;
        state.selectedSections.clear();
        state.session = null;

        renderSettings();
        renderSections();
        renderInitialStudyState();

        elements.startMessage.textContent = `${parsed.words.length}개의 단어를 불러왔습니다.`;
        elements.startMessage.style.color = "#16a34a";
    } catch (error) {
        console.error(error);
        elements.startMessage.textContent = "파일을 불러오는 중 오류가 발생했습니다.";
        elements.startMessage.style.color = "#dc2626";
    }
}

function parseTextData(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    const firstLine = (lines[0] ?? "").trim();
    const headerResult = parseHeader(firstLine);

    let wordStartIndex = 0;

    let settings = {
        ...DEFAULT_SETTINGS
    };

    if (headerResult.detected) {
        settings = {
            ...DEFAULT_SETTINGS,
            ...headerResult.settings
        };

        wordStartIndex = 1;
    }

    const words = [];

    for (let index = wordStartIndex; index < lines.length; index += 1) {
        const line = lines[index].trim();

        if (!line) {
            continue;
        }

        const word = parseWordLine(line);

        if (word) {
            word.order = words.length;
            words.push(word);
        }
    }

    return {
        settings,
        words
    };
}

function parseHeader(line) {
    const markerMatch = line.match(/^<\$@\s*(.*?)\s*@\$>\s*$/);

    if (!markerMatch) {
        return {
            detected: false,
            settings: {}
        };
    }

    const content = markerMatch[1];
    const settings = {};

    const sectionMatch = content.match(/구간\s*분리\s*:\s*(\d+)/);
    const timerMatch = content.match(/타이머\s*:\s*(\d+)/);
    const timerEnabledMatch = content.match(/타이머\s*사용\s*여부\s*:\s*([OX])/i);
    const excludeKnownMatch = content.match(/아는\s*단어\s*제외\s*여부\s*:\s*([OX])/i);

    if (sectionMatch) {
        settings.sectionSize = getValidPositiveInteger(
            Number(sectionMatch[1]),
            DEFAULT_SETTINGS.sectionSize
        );
    }

    if (timerMatch) {
        settings.timerSeconds = getValidPositiveInteger(
            Number(timerMatch[1]),
            DEFAULT_SETTINGS.timerSeconds
        );
    }

    if (timerEnabledMatch) {
        settings.timerEnabled = timerEnabledMatch[1].toUpperCase() === "O";
    }

    if (excludeKnownMatch) {
        settings.excludeKnown = excludeKnownMatch[1].toUpperCase() === "O";
    }

    return {
        detected: true,
        settings
    };
}

function generateWordId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return Date.now().toString(36) +
        "-" +
        Math.random().toString(36).slice(2) +
        "-" +
        Math.random().toString(36).slice(2);
}

function parseWordLine(line) {
    const match = line.match(/^(.+?)<\$#\?([01])!\#\$>(.*)$/);

    if (!match) {
        return null;
    }

    const word = match[1].trim();
    const status = Number(match[2]);
    const rawMeaning = match[3].trim();

    if (!word) {
        return null;
    }

    const meanings = splitMeanings(rawMeaning);

    return {
        id: generateWordId(),
        word,
        meanings,
        rawMeaning,
        status
    };
}

function splitMeanings(rawMeaning) {
    if (!rawMeaning) {
        return [""];
    }

    const meanings = rawMeaning
        .split(/\s*(?:\/|‖)\s*/)
        .map((meaning) => meaning.trim())
        .filter((meaning) => meaning.length > 0);

    return meanings.length > 0 ? meanings : [rawMeaning];
}

/* =========================================================
   TXT save
========================================================= */

async function handleSave() {
    if (state.words.length === 0) {
        showStartMessage("저장할 단어가 없습니다.");
        return;
    }

    const text = createExportText();

    try {
        if ("showSaveFilePicker" in window) {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: "vocabulary-data.txt",
                types: [
                    {
                        description: "TXT 파일",
                        accept: {
                            "text/plain": [".txt"]
                        }
                    }
                ]
            });

            const writable = await fileHandle.createWritable();

            await writable.write(text);
            await writable.close();

            showStartMessage("TXT 파일을 저장했습니다.", true);
            return;
        }

        downloadTextFile(text);
    } catch (error) {
        if (error?.name === "AbortError") {
            return;
        }

        console.error(error);
        downloadTextFile(text);
    }
}

function createExportText() {
    const header = `<$@구간 분리:${state.settings.sectionSize}/` +
        `타이머:${state.settings.timerSeconds}/` +
        `타이머 사용 여부:${state.settings.timerEnabled ? "O" : "X"}/` +
        `아는 단어 제외 여부:${state.settings.excludeKnown ? "O" : "X"}@$>`;

    const wordLines = state.words.map((word) => {
        return `${word.word}<$#?${word.status}!#$>${word.rawMeaning}`;
    });

    return [header, ...wordLines].join("\n");
}

function downloadTextFile(text) {
    const blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "vocabulary-data.txt";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showStartMessage("TXT 파일을 다운로드했습니다.", true);
}

/* =========================================================
   Utilities
========================================================= */

function parsePositiveHalfSecond(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0.5) {
        return null;
    }

    const rounded = Math.round(number * 2) / 2;

    return rounded;
}

function getValidPositiveNumber(value, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0.5) {
        return fallback;
    }

    return Math.round(number * 2) / 2;
}

function parsePositiveInteger(value) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        return null;
    }

    return number;
}

function getValidPositiveInteger(value, fallback) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        return fallback;
    }

    return number;
}

function wait(milliseconds) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

function showStartMessage(message, success = false) {
    elements.startMessage.textContent = message;
    elements.startMessage.style.color = success ? "#16a34a" : "#dc2626";
}

function clearStartMessage() {
    elements.startMessage.textContent = "";
    elements.startMessage.style.color = "";
}
