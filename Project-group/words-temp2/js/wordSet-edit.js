/* wordSet-edit.js */

import { getSetById, updateSet, createSet, deleteSet } from "./storage.js";

const contentsInner = document.querySelector("#contents-inner");

const leftWindow = document.querySelector("#wse-left-window");
const rightWindow = document.querySelector("#wse-right-window");

const leftWrapper = document.querySelector("#left-words-wrapper");
const rightWrapper = document.querySelector("#right-words-wrapper");

const leftInner = document.querySelector("#left-words-wrapper-inner");
const rightInner = document.querySelector("#right-words-wrapper-inner");

const windowSep = document.querySelector("#window-sep");
const windowSepToggle = document.querySelector("#window-sep-toggle-switch");

const nameInput = document.querySelector("#word-set-name-input");

const viewMatch = document.querySelector("#view-match");
const viewMatchSpan = viewMatch.querySelector("span");
const viewMatchGroup = document.querySelector("#view-match-btn-group");
const viewMatchLeft = document.querySelector("#view-match-btn-left");
const viewMatchRight = document.querySelector("#view-match-btn-right");

const sectSepr = document.querySelector("#sect-sepr");
const sectSeprHeader = document.querySelector("#sect-sepr-header");
const sectSeprHeaderSpan = sectSeprHeader.querySelector("span");
const sectSeprGroup = document.querySelector("#sect-sepr-group");
const sectSeprWhole = document.querySelector("#sect-sepr-whole");
const sectSeprSetup = document.querySelector("#sect-sepr-setup");
const sectSeprInput = document.querySelector("#sect-sepr-input");

const delBtn = document.getElementById("word-set-del-btn");

const leftSearchScope = document.querySelector("#left-search-scope");
const rightSearchScope = document.querySelector("#right-search-scope");

const leftSearchInput = document.querySelector("#left-search-word-input");
const rightSearchInput = document.querySelector("#right-search-word-input");

const leftSearchDel = document.querySelector("#left-search-del-btn");
const rightSearchDel = document.querySelector("#right-search-del-btn");

const leftGotoInput = document.querySelector("#left-gotonum-input");
const rightGotoInput = document.querySelector("#right-gotonum-input");

const leftGotoArrow = document.querySelector("#left-gotonum-arrow");
const rightGotoArrow = document.querySelector("#right-gotonum-arrow");

const leftSelectDelete = document.querySelector("#left-select-delete");
const rightSelectDelete = document.querySelector("#right-select-delete");

const wordsCount = document.querySelector("#word-set-words-count");
const studyDate = document.querySelector("#word-set-study-date");
const editDate = document.querySelector("#word-set-edit-date");

const saveBtn = document.querySelector("#edit-save-btn");

const deleteUndoAlert = document.querySelector("#delete-undo-alert");
const deleteUndoOff = document.querySelector("#delete-undo-alert-off");
const deleteUndoBtn = document.querySelector("#delete-undo-btn");

const BREAKPOINT = 1260;

let currentSet = null;
let splitClosedByResize = false;
let deletedSnapshot = null;
let draftKey = null;

const IPA_KEYS = [
    ["i", "ɪ", "ɑ", "a", "b", "d", "f", "g", "k"], 
    ["e", "æ", "ɛ", "j", "l", "m", "n", "p"], 
    ["ʌ", "ə", "ɔ", "ɜ", "r", "s", "t", "v", "w"], 
    ["ʊ", "u", "θ", "ð", "z", "ʒ", "ŋ", "ʃ"], 
    ["ː", "ˈ", "ˌ"]
];

function clearDeleteUndo() {
    deletedSnapshot = null;
}

/* 페이지 로드시 초기화 */
clearDeleteUndo();

/* ===================== TEMP DATA ===================== */

let tempSet = null;
let isNewSet = false;

function cloneSet(set) {
    return {
        ...set,
        words: set.words.map(w => ({ ...w }))
    };
}

function getLocalISOString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString();
}

/* ===================== DRAFT SAVE ===================== */

function saveDraft() {

    if (!tempSet) return;

    const draft = {
        tempSet,
        sectionSize,
        scrollLeft: leftWrapper.scrollTop,
        scrollRight: rightWrapper.scrollTop
    };

    localStorage.setItem(draftKey, JSON.stringify(draft));
}

/* ===================== LOAD ===================== */

const params = new URLSearchParams(location.search);
const setId = params.get("id");
draftKey = `word_edit_draft_${setId ?? "new"}`;

/* ===================== LOAD DRAFT ===================== */

const savedDraft = localStorage.getItem(draftKey);

if (savedDraft) {

    try {

        const draft = JSON.parse(savedDraft);

        tempSet = draft.tempSet;
        sectionSize = draft.sectionSize ?? 0;

        setTimeout(() => {
            leftWrapper.scrollTop = draft.scrollLeft ?? 0;
            rightWrapper.scrollTop = draft.scrollRight ?? 0;
        });

    } catch {
        localStorage.removeItem(draftKey);
    }

}

if (setId) {

    const set = getSetById(setId);

    if (!set) alert("세트를 찾을 수 없습니다.");

    currentSet = set;
    if (!tempSet) tempSet = cloneSet(set);

    nameInput.value = tempSet.name;

    wordsCount.textContent = `단어 : ${set.words.length}`;

    const dates = set.words
        .map(w => w.lastStudyDate)
        .filter(Boolean);

    if (!dates.length) {
        studyDate.textContent = "0000.00.00";
    } else {
        const latestStudy = dates.sort().pop();
        const d = latestStudy.split("T")[0].replaceAll("-", ".");
        studyDate.textContent = `학습 : ${d}`;
    }

    if (set.lastModifiedDate) {
        const d = set.lastModifiedDate.split("T")[0].replaceAll("-", ".");
        editDate.textContent = `수정 : ${d}`;
    } else {
        editDate.textContent = "0000.00.00";
    }

    sectSeprInput.value = set.sectionSize ?? "";

} else {

    isNewSet = true;

    if (!tempSet) tempSet = {
        id: crypto.randomUUID(),
        name: "",
        words: [],
        sectionSize: 20,
        showMeaning: true,
        splitMode: false,
        lastModifiedDate: null
    };

    sectSeprInput.value = 20;

    wordsCount.textContent = "단어 : 0";
    studyDate.textContent = "0000.00.00";
    editDate.textContent = "0000.00.00";
}

/* ===================== STATE ===================== */

let sectionSize = tempSet.sectionSize ?? 0;

function updateSectHeader() {
    if (sectionSize === 0) {
        sectSeprHeaderSpan.textContent = "전체 보기";
    } else {
        sectSeprHeaderSpan.textContent = `${sectionSize}개씩 구간 분리`;
    }
}

updateSectHeader();

let leftSearchMode = "word";
let rightSearchMode = "word";

/* ===================== INIT WORD COUNT ===================== */

function ensureMinimumWords() {
    if (tempSet.words.length === 0) return;

    while (tempSet.words.length < 5) {
        tempSet.words.push({
            id: crypto.randomUUID(),
            spelling: "",
            phonetic: "",
            meaning: "",
            lastStudyDate: null
        });
    }
}

ensureMinimumWords();

/* ===================== DELETE SET ===================== */

delBtn?.addEventListener("click", () => {

    if (!confirm("정말 이 세트를 삭제하시겠습니까?")) return;

    window.removeEventListener("beforeunload", beforeUnloadHandler);
    
    if (isNewSet) {
        tempSet = null;
        location.href = "wordSet-list.html";
        return;
    }

    deleteSet(setId);
    location.href = "wordSet-list.html";
});

/* ===================== RENDER ===================== */

renderAll();

function renderAll() {
    renderWindow(leftInner);
    renderWindow(rightInner);
    applyOverlapHighlight();
}

function renderWindow(inner) {

    const createBtn = inner.querySelector(".create-word-unit");

    inner.innerHTML = "";

    const frag = document.createDocumentFragment();
    const digits = getNumberDigits(tempSet.words.length);

    tempSet.words.forEach((word, i) => {

        const num = String(i + 1).padStart(digits, "0");
        const unit = createUnit(word, i, num);
        frag.appendChild(unit);

        if (sectionSize > 0 && (i + 1) % sectionSize === 0 && i !== tempSet.words.length - 1) {
            const bar = document.createElement("div");
            bar.className = "section-bar-unit";
            frag.appendChild(bar);
        }

    });

    inner.appendChild(frag);

    if (createBtn) inner.appendChild(createBtn);
}

leftInner.addEventListener("click", e => {

    const btn = e.target.closest(".create-word-unit");
    if (!btn) return;

    const newWord = {
        id: crypto.randomUUID(),
        spelling: "",
        phonetic: "",
        meaning: "",
        lastStudyDate: null
    };

    tempSet.words.push(newWord);

    renderAll();
});

function createUnit(word, index, num) {

    const unit = document.createElement("div");

    unit.className = "word-unit-wrapper";
    unit.dataset.id = word.id;
    unit.dataset.index = index;

    unit.innerHTML = `
    <div class="word-unit">
        <div class="word-number">${num}</div>
        <div class="word-spell"><input class="word-spell-input" type="text" value="${word.spelling ?? ""}"></div>
        <div class="word-phon"><input class="word-phon-input" type="text" inputmode="none" value="${word.phonetic ?? ""}"></div>
        <div class="word-mean"><input class="word-mean-input" type="text" value="${word.meaning ?? ""}"></div>
    </div>
    <div class="word-add-btn"><i class="fa-solid fa-plus"></i></div>
    `;

    return unit;
}

/* ===================== NUMBER ===================== */

function getNumberDigits(total) {
    const minDigits = 4;
    const maxDigits = String(total).length;
    return Math.max(minDigits, maxDigits);
}

/* ===================== SCROLL ===================== */

function scrollWrapper(wrapper, target, duration) {

    const start = wrapper.scrollTop;
    const distance = target - start;
    const startTime = performance.now();

    function ease(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {

        const t = Math.min((now - startTime) / duration, 1);
        const eased = ease(t);

        wrapper.scrollTop = start + distance * eased;

        if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

/* ===================== VIEW MATCH ===================== */

viewMatchSpan.addEventListener("click", () => {
    if (!rightWindow.classList.contains("show")) return;

    viewMatchGroup.classList.toggle("active");
});

document.addEventListener("click", e => {
    if (!viewMatch.contains(e.target)) viewMatchGroup.classList.remove("active");
});

document.addEventListener("click", e => {
    if (!sectSepr.contains(e.target) && !sectSeprGroup.contains(e.target)) {
        sectSeprGroup.classList.remove("active");
    }
});

viewMatchLeft.addEventListener("click", () => {
    scrollWrapper(rightInner, leftInner.scrollTop, 100);
    viewMatchGroup.classList.remove("active");
});

viewMatchRight.addEventListener("click", () => {
    scrollWrapper(leftInner, rightInner.scrollTop, 100);
    viewMatchGroup.classList.remove("active");
});

/* ===================== SECTION ===================== */

sectSeprHeader.addEventListener("click", () => {
    sectSeprGroup.classList.toggle("active");
});

sectSeprWhole.addEventListener("click", () => {
    sectionSize = 0;
    sectSeprInput.value = "";
    updateSectHeader();
    renderAll();
    saveDraft();
    sectSeprGroup.classList.remove("active");
});

function applySectionInput() {

    const v = Number(sectSeprInput.value);
    if (!v) return;

    sectionSize = v;
    updateSectHeader();
    renderAll();
    saveDraft();
    sectSeprGroup.classList.remove("active");
}

sectSeprSetup.addEventListener("click", e => {
    if (e.target === sectSeprInput) return;
    applySectionInput();
});

sectSeprInput.addEventListener("keydown", e => {
    if (e.key === "Enter") applySectionInput();
});

sectSeprInput.addEventListener("input", () => {
    sectSeprInput.value = sectSeprInput.value.replace(/[^0-9]/g, "");
});

/* ===================== SEARCH MODE ===================== */

leftSearchScope.textContent = "단어 검색";
rightSearchScope.textContent = "단어 검색";

leftSearchScope.addEventListener("click", () => {
    leftSearchMode = leftSearchMode === "word" ? "mean" : "word";
    leftSearchScope.textContent = leftSearchMode === "word" ? "단어 검색" : "의미 검색";
    search(leftInner, leftSearchInput.value, leftSearchMode);
});

rightSearchScope.addEventListener("click", () => {
    rightSearchMode = rightSearchMode === "word" ? "mean" : "word";
    rightSearchScope.textContent = rightSearchMode === "word" ? "단어 검색" : "의미 검색";
    search(rightInner, rightSearchInput.value, rightSearchMode);
});

/* ===================== SEARCH ===================== */

function search(inner, keyword, mode) {

    const units = inner.querySelectorAll(".word-unit-wrapper");
    const bars = inner.querySelectorAll(".section-bar-unit");

    if (!keyword) {
        units.forEach(u => u.style.display = "");
        bars.forEach(b => b.style.display = "");
        return;
    }

    bars.forEach(b => b.style.display = "none");

    units.forEach(unit => {

        const id = unit.dataset.id;
        const word = tempSet.words.find(w => w.id === id);
        const text = mode === "word" ? word.spelling : word.meaning;

        if ((text ?? "").includes(keyword)) {
            unit.style.display = "";
        } else {
            unit.style.display = "none";
        }

    });

}

/* ===================== OVERLAP HIGHLIGHT ===================== */

function applyOverlapHighlight() {

    document.querySelectorAll(".word-unit-wrapper").forEach(u => u.classList.remove("word-overlap"));

    const spellingMap = new Map();

    tempSet.words.forEach(word => {
        const val = word.spelling.trim();
        if (!val) return;
        if (!spellingMap.has(val)) spellingMap.set(val, []);
        spellingMap.get(val).push(word.id);
    });

    for (const [_, ids] of spellingMap) {
        if (ids.length > 1) {
            ids.forEach(id => {
                const unit = document.querySelector(`.word-unit-wrapper[data-id="${id}"]`);
                if (unit) unit.classList.add("word-overlap");
            });
        }
    }

}

/* ===================== LEFT/RIGHT SEARCH INPUT ===================== */

leftSearchInput.addEventListener("input", () => {
    search(leftInner, leftSearchInput.value, leftSearchMode);
    applyOverlapHighlight();
});

rightSearchInput.addEventListener("input", () => {
    search(rightInner, rightSearchInput.value, rightSearchMode);
    applyOverlapHighlight();
});

/* ===================== SEARCH DELETE BTN ===================== */

leftSearchDel.addEventListener("click", () => {
    leftSearchInput.value = "";
    search(leftInner, "", leftSearchMode);
    applyOverlapHighlight();
});

rightSearchDel.addEventListener("click", () => {
    rightSearchInput.value = "";
    search(rightInner, "", rightSearchMode);
    applyOverlapHighlight();
});

/* ===================== GOTO ===================== */

function gotoNumber(inner, value) {

    const num = Number(value);
    if (!num) return;

    const unit = inner.querySelectorAll(".word-unit-wrapper")[num - 1];
    if (!unit) return;

    const rect = unit.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();

    const target = inner.scrollTop + (rect.top - innerRect.top) - 5;

    scrollWrapper(inner, target, 100);
}

function bindGoto(input, inner) {

    input.addEventListener("keydown", e => {

        if (e.key !== "Enter") return;

        e.preventDefault();
        gotoNumber(inner, input.value);
        input.blur();   // 키보드 닫기
    });

    input.addEventListener("change", () => {
        gotoNumber(inner, input.value);
    });

    input.addEventListener("click", () => {
        gotoNumber(inner, input.value);
    });
}

bindGoto(leftGotoInput, leftInner);
bindGoto(rightGotoInput, rightInner);

/* ===================== SELECT DELETE ===================== */

function toggleSelectMode(wrapper, btn) {

    const active = btn.classList.toggle("active");
    wrapper.classList.toggle("select-mode");
    const inputs = wrapper.querySelectorAll("input");
    inputs.forEach(i => i.readOnly = active);
    btn.textContent = active ? "삭제하기" : "선택삭제";
}

leftSelectDelete.addEventListener("click", () => handleDeleteMode(leftWrapper, leftSelectDelete, leftInner));
rightSelectDelete.addEventListener("click", () => handleDeleteMode(rightWrapper, rightSelectDelete, rightInner));

function handleDeleteMode(wrapper, btn, inner) {

    if (!btn.classList.contains("active")) {
        toggleSelectMode(wrapper, btn);
        return;
    }

    const selected = inner.querySelectorAll(".word-unit-wrapper.selected");

    if (!selected.length) {
        alert("선택된 단어가 없습니다.");
        toggleSelectMode(wrapper, btn);
        return;
    }

    const a = selected.length;

    /* 삭제 전 상태 저장 */
    deletedSnapshot = {
        words: tempSet.words.map(w => ({ ...w })),
        sectionSize,
        scrollTop: wrapper.scrollTop
    };

    if (!confirm(`이 ${a}개 단어를 삭제하기겠습니까?`)) {
        clearDeleteUndo();
        return;
    }

    const firstVisible = getTopUnit(inner);
    const deletedIds = [...selected].map(u => u.dataset.id);

    tempSet.words = tempSet.words.filter(w => !deletedIds.includes(w.id));

    toggleSelectMode(wrapper, btn);

    renderAll();
    restoreScroll(inner, wrapper, firstVisible);
    saveDraft();

    /* undo 알림 표시 */
    deleteUndoAlert.classList.add("active");
}

/* ===================== GET TOP UNIT ===================== */

function getTopUnit(inner) {

    const units = [...inner.querySelectorAll(".word-unit-wrapper")];
    const top = inner.parentElement.scrollTop;

    for (let i = 0; i < units.length; i++) {

        if (units[i].offsetTop >= top) {
            return units[i].dataset.id;
        }

    }

    return units[0]?.dataset.id;
}

function restoreScroll(inner, wrapper, id) {

    let index = tempSet.words.findIndex(w => w.id === id);

    while (index >= 0) {

        const unit = inner.querySelector(`.word-unit-wrapper[data-id="${tempSet.words[index].id}"]`);

        if (unit) {
            wrapper.scrollTop = unit.offsetTop;
            return;
        }

        index--;
    }

}

/* ===================== SELECT UNIT ===================== */

function handleUnitClick(inner, wrapper) {

    inner.addEventListener("click", e => {

        if (!wrapper.classList.contains("select-mode")) return;
        const unit = e.target.closest(".word-unit-wrapper");
        if (!unit) return;

        unit.classList.toggle("selected");
    });

}

handleUnitClick(leftInner, leftWrapper);
handleUnitClick(rightInner, rightWrapper);

/* ===================== ADD WORD ===================== */

function addWord(index) {

    const newWord = {
        id: crypto.randomUUID(),
        spelling: "",
        phonetic: "",
        meaning: "",
        lastStudyDate: null
    };

    tempSet.words.splice(index + 1, 0, newWord);

}

function updateNumbers() {

    const digits = getNumberDigits(tempSet.words.length);

    document.querySelectorAll(".word-unit-wrapper").forEach((unit, i) => {

        const num = String(i + 1).padStart(digits, "0");

        unit.querySelector(".word-number").textContent = num;
    });

}

function handleAdd(inner) {

    inner.addEventListener("click", e => {

        const btn = e.target.closest(".word-add-btn");
        if (!btn) return;
        const wrapper = btn.closest(".word-unit-wrapper");
        const id = wrapper.dataset.id;
        const index = tempSet.words.findIndex(w => w.id === id);
        addWord(index);
        const digits = getNumberDigits(tempSet.words.length);
        const newUnit = createUnit(tempSet.words[index + 1], index + 1, String(index + 2).padStart(digits, "0"));
        wrapper.after(newUnit);
        const otherInner = inner === leftInner ? rightInner : leftInner;
        const otherWrapper = otherInner.querySelector(`.word-unit-wrapper[data-id="${id}"]`);
        const newUnit2 = createUnit(tempSet.words[index + 1], index + 1, String(index + 2).padStart(digits, "0"));
        otherWrapper.after(newUnit2);
        updateNumbers();
        applyOverlapHighlight();
        saveDraft();
    });

}

handleAdd(leftInner);
handleAdd(rightInner);

/* ===================== TAB / ENTER ADD WORD ===================== */

function handleTabCreate(inner){

    inner.addEventListener("keydown", e=>{

        const isTab = e.key === "Tab";
        const isEnter = e.key === "Enter";

        if(!isTab && !isEnter) return;
        if(!e.target.classList.contains("word-mean-input")) return;

        const wrapper = e.target.closest(".word-unit-wrapper");
        const units = inner.querySelectorAll(".word-unit-wrapper");

        /* 마지막 유닛에서만 동작 */
        if(wrapper !== units[units.length-1]) return;

        e.preventDefault();

        const id = wrapper.dataset.id;
        const index = tempSet.words.findIndex(w=>w.id===id);

        addWord(index);

        const digits = getNumberDigits(tempSet.words.length);

        const newUnit = createUnit(
            tempSet.words[index+1],
            index+1,
            String(index+2).padStart(digits,"0")
        );

        wrapper.after(newUnit);

        const otherInner = inner === leftInner ? rightInner : leftInner;
        const otherWrapper = otherInner.querySelector(`.word-unit-wrapper[data-id="${id}"]`);

        const newUnit2 = createUnit(
            tempSet.words[index+1],
            index+1,
            String(index+2).padStart(digits,"0")
        );

        otherWrapper.after(newUnit2);

        updateNumbers();
        applyOverlapHighlight();
        saveDraft();

        newUnit.querySelector(".word-spell-input").focus();
    });

}

handleTabCreate(leftInner);
handleTabCreate(rightInner);

/* ===================== SPLIT ===================== */

windowSepToggle.classList.remove("active");
viewMatch.classList.add("disabled");

windowSepToggle.addEventListener("click", () => {

    if (windowSep.classList.contains("disabled")) return;
    windowSepToggle.classList.toggle("active");
    if (windowSepToggle.classList.contains("active")) openSplit();
    else closeSplit();
});

function openSplit() {
    contentsInner.classList.add("win-sep");
    rightWindow.classList.add("show");
    viewMatch.classList.remove("disabled");
}

function closeSplit() {
    rightWindow.classList.remove("show");
    contentsInner.classList.remove("win-sep");
    windowSepToggle.classList.remove("active");
    viewMatch.classList.add("disabled");
}

if (tempSet.splitMode) {
    windowSepToggle.classList.add("active");
    openSplit();
} else {
    closeSplit();
}

/* ===================== RESPONSIVE ===================== */

window.addEventListener("resize", handleResponsive);
handleResponsive();

function handleResponsive() {

    const width = window.innerWidth;

    if (width <= BREAKPOINT) {

        windowSep.classList.add("disabled");
        if (windowSepToggle.classList.contains("active")) {

            splitClosedByResize = true;
            closeSplit();
        }

    } else {

        windowSep.classList.remove("disabled");
        if (splitClosedByResize) {

            splitClosedByResize = false;
            windowSepToggle.classList.add("active");
            openSplit();
        }

    }
}

/* ===================== SAVE ===================== */

function collectInputs() {
    const units = leftInner.querySelectorAll(".word-unit-wrapper");

    units.forEach(unit => {

        const id = unit.dataset.id;

        const word = tempSet.words.find(w => w.id === id);
        if (!word) return;

        word.spelling = unit.querySelector(".word-spell-input").value;
        word.phonetic = unit.querySelector(".word-phon-input").value;
        word.meaning = unit.querySelector(".word-mean-input").value;

    });

    applyOverlapHighlight();
}

/* ===================== RESET STATUS IF SPELL CHANGED ===================== */

function resetStatusIfSpellingChanged() {

    if (!currentSet) return;

    const originalMap = new Map();

    currentSet.words.forEach(w => {
        originalMap.set(w.id, w.spelling);
    });

    tempSet.words.forEach(word => {

        const originalSpelling = originalMap.get(word.id);

        if (originalSpelling === undefined) return;

        if ((originalSpelling ?? "") !== (word.spelling ?? "")) {
            word.status = "never";
        }

    });

}

saveBtn.addEventListener("click", () => {

    collectInputs();

    resetStatusIfSpellingChanged();

    tempSet.name = nameInput.value;
    tempSet.sectionSize = sectionSize;
    tempSet.splitMode = windowSepToggle.classList.contains("active");
    tempSet.lastModifiedDate = getLocalISOString();

    window.removeEventListener("beforeunload", beforeUnloadHandler);
    localStorage.removeItem(draftKey);

    if (isNewSet) {
        const newSet = createSet(tempSet.name);
        newSet.words = tempSet.words;
        newSet.sectionSize = tempSet.sectionSize;
        newSet.showMeaning = tempSet.showMeaning;
        newSet.splitMode = tempSet.splitMode;
        updateSet(newSet);
        location.href = `wordSet-main.html?id=${newSet.id}`;
        return;
    }

    updateSet(tempSet);

    location.href = `wordSet-main.html?id=${tempSet.id}`;
});

/* ===================== BEFORE UNLOAD ===================== */

function beforeUnloadHandler(e) {
    e.preventDefault();
    e.returnValue = "";
}

window.addEventListener("beforeunload", beforeUnloadHandler);

/* ===================== SYNC INPUT ===================== */

function syncInput(inner, otherInner) {

    inner.addEventListener("input", e => {

        const input = e.target;

        if (!input.classList.contains("word-spell-input") &&
            !input.classList.contains("word-phon-input") &&
            !input.classList.contains("word-mean-input")) return;

        const wrapper = input.closest(".word-unit-wrapper");
        if (!wrapper) return;

        const id = wrapper.dataset.id;
        const word = tempSet.words.find(w => w.id === id);
        if (!word) return;

        if (input.classList.contains("word-spell-input")) {
            word.spelling = input.value;
        } else if (input.classList.contains("word-phon-input")) {
            word.phonetic = input.value;
        } else if (input.classList.contains("word-mean-input")) {
            word.meaning = input.value;
        }

        const otherUnit = otherInner.querySelector(`.word-unit-wrapper[data-id="${id}"]`);
        if (!otherUnit) return;

        if (input.classList.contains("word-spell-input")) {
            otherUnit.querySelector(".word-spell-input").value = word.spelling;
        } else if (input.classList.contains("word-phon-input")) {
            otherUnit.querySelector(".word-phon-input").value = word.phonetic;
        } else if (input.classList.contains("word-mean-input")) {
            otherUnit.querySelector(".word-mean-input").value = word.meaning;
        }

        applyOverlapHighlight();
        saveDraft();
    });

}

syncInput(leftInner, rightInner);
syncInput(rightInner, leftInner);

/* ===================== DELETE UNDO ALERT OFF ===================== */

deleteUndoOff.addEventListener("click", () => {
    deleteUndoAlert.classList.remove("active");
    clearDeleteUndo();
});

/* ===================== DELETE UNDO ===================== */

function restoreDeletedSnapshot() {

    if (!deletedSnapshot) return;

    tempSet.words = deletedSnapshot.words.map(w => ({ ...w }));
    sectionSize = deletedSnapshot.sectionSize;

    updateSectHeader();
    renderAll();

    leftWrapper.scrollTop = deletedSnapshot.scrollTop;
    rightWrapper.scrollTop = deletedSnapshot.scrollTop;

    deleteUndoAlert.classList.remove("active");
    clearDeleteUndo();
    saveDraft();
}

/* 버튼 undo */
deleteUndoBtn.addEventListener("click", restoreDeletedSnapshot);

/* ===================== CTRL + Z UNDO ===================== */

document.addEventListener("keydown", e => {

    const isUndo =
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z";

    if (!isUndo) return;

    /* input 입력중이면 기본 undo 허용 */
    const active = document.activeElement;
    if (
        active &&
        (active.tagName === "INPUT" ||
         active.tagName === "TEXTAREA" ||
         active.isContentEditable)
    ) return;

    if (!deletedSnapshot) return;

    e.preventDefault();

    restoreDeletedSnapshot();

});

nameInput.addEventListener("input", saveDraft);




















/* ===================== IPA KEYBOARD ===================== */

const IPA_ROWS = [
    ["i","ɪ","ɑ","a","b","d","f","g","k","DEL"],
    ["e","æ","ɛ","j","l","m","n","p","BACK"],
    ["ʌ","ə","ɔ","ɜ","r","s","t","v","w","ENTER"],
    ["ʊ","u","θ","ð","z","ʒ","ŋ","ʃ","PASTE"],
    ["ː","ˈ","ˌ","SPACE","<",">"]
];

const GAP_X = 10;

const ipaKeyboard = document.querySelector("#ipa-keyboard");
const ipaKeyboardInner = document.querySelector("#ipa-keyboard-inner");

let activeInput = null;

/* ✅ 초기 상태 강제 숨김 */
ipaKeyboard.classList.remove("show");

buildKeyboard();
resizeKeyboard();

window.addEventListener("resize", resizeKeyboard);

/* ---------- build ---------- */

function buildKeyboard(){

    ipaKeyboardInner.innerHTML="";

    IPA_ROWS.forEach((rowData,rowIndex)=>{

        const row=document.createElement("div");
        row.className="ipa-row";

        if(rowIndex===1||rowIndex===3){
            row.classList.add("offset");
        }

        rowData.forEach(key=>{

            const btn=document.createElement("button");
            btn.type="button";
            btn.className="ipa-key";
            btn.dataset.key=key;
            btn.textContent=getLabel(key);

            btn.addEventListener("pointerdown",e=>{
                e.preventDefault();
                e.stopPropagation();
                pressKey(key);
            });

            row.appendChild(btn);
        });

        ipaKeyboardInner.appendChild(row);
    });
}

/* ---------- width ---------- */

function resizeKeyboard(){

    const innerWidth=ipaKeyboardInner.clientWidth;

    const baseCols=10;
    const gaps=baseCols-1;

    const keyWidth=
        (innerWidth-GAP_X*gaps)/baseCols;

    document.querySelectorAll(".ipa-key")
    .forEach(btn=>{

        const key=btn.dataset.key;

        if(key==="SPACE"){
            btn.style.width=
                keyWidth*5+GAP_X*4+"px";
        }
        else if(key==="BACK"||key==="PASTE"){
            btn.style.width=
                keyWidth*1.5+"px";
        }
        else{
            btn.style.width=keyWidth+"px";
        }
    });
}

/* ---------- label ---------- */

function getLabel(key){

    if(key==="BACK") return "⌫";
    if(key==="ENTER") return "↵";
    if(key==="DEL") return "Del";
    if(key==="PASTE") return "📋";
    if(key==="SPACE") return "Space";

    return key;
}

/* ---------- typing ---------- */

function pressKey(key){

    if(!activeInput) return;

    activeInput.focus();

    const start = activeInput.selectionStart;
    const end = activeInput.selectionEnd;
    const len = activeInput.value.length;

    /* ================= DELETE (앞삭제) ================= */
    if(key==="DEL"){

        if(start !== end){
            document.execCommand("insertText", false, "");
            return;
        }

        if(start < len){
            activeInput.setSelectionRange(start, start + 1);
            document.execCommand("insertText", false, "");
        }

        return;
    }

    /* ================= BACKSPACE ================= */
    if(key==="BACK"){

        if(start !== end){
            document.execCommand("insertText", false, "");
            return;
        }

        if(start > 0){
            activeInput.setSelectionRange(start - 1, start);
            document.execCommand("insertText", false, "");
        }

        return;
    }

    /* ================= CURSOR LEFT ================= */
    if(key==="<"){

        const pos = Math.max(0, start - 1);
        activeInput.setSelectionRange(pos, pos);
        return;
    }

    /* ================= CURSOR RIGHT ================= */
    if(key===">"){

        const pos = Math.min(len, start + 1);
        activeInput.setSelectionRange(pos, pos);
        return;
    }

    /* ================= ENTER ================= */
    if(key==="ENTER"){
        activeInput.blur();
        return;
    }

    /* ================= SPACE ================= */
    if(key==="SPACE"){
        document.execCommand("insertText", false, " ");
        return;
    }

    /* ================= PASTE ================= */
    if(key==="PASTE"){
        navigator.clipboard
            .readText()
            .then(t=>{
                document.execCommand("insertText", false, t);
            });
        return;
    }

    /* ================= NORMAL INPUT ================= */
    document.execCommand("insertText", false, key);
}

/* ---------- open ---------- */

document.addEventListener("focusin",e=>{

    const input=e.target.closest(".word-phon-input");

    if(!input) return;

    activeInput=input;
    openKeyboard();
});

/* ---------- outside click close ---------- */

document.addEventListener("pointerdown",e=>{

    const insideKeyboard=e.target.closest("#ipa-keyboard");
    const insideInput=e.target.closest(".word-phon-input");

    if(insideKeyboard||insideInput) return;

    closeKeyboard();
});

/* ---------- helpers ---------- */

function openKeyboard(){
    ipaKeyboard.classList.add("show");
}

function closeKeyboard(){
    ipaKeyboard.classList.remove("show");
    activeInput=null;
}