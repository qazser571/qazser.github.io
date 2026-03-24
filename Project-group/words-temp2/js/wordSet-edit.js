/* wordSet-edit.js */

import { getSetById, updateSet, createSet } from "./storage.js";

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

const BREAKPOINT = 1260;

let currentSet = null;
let splitClosedByResize = false;

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

/* ===================== LOAD ===================== */

const params = new URLSearchParams(location.search);
const setId = params.get("id");

if (setId) {

    const set = getSetById(setId);

    if (!set) alert("세트를 찾을 수 없습니다.");

    currentSet = set;
    tempSet = cloneSet(set);

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

    tempSet = {
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

/* ===================== RENDER ===================== */

renderAll();

function renderAll() {
    renderWindow(leftInner);
    renderWindow(rightInner);
    applyOverlapHighlight(); // ← 중복 체크 추가
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
        <div class="word-phon"><input class="word-phon-input" type="text" value="${word.phonetic ?? ""}"></div>
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
    sectSeprGroup.classList.remove("active");
});

function applySectionInput() {

    const v = Number(sectSeprInput.value);
    if (!v) return;

    sectionSize = v;
    updateSectHeader();
    renderAll();
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

leftSearchScope.textContent = "단어";
rightSearchScope.textContent = "단어";

leftSearchScope.addEventListener("click", () => {
    leftSearchMode = leftSearchMode === "word" ? "mean" : "word";
    leftSearchScope.textContent = leftSearchMode === "word" ? "단어" : "의미";
    search(leftInner, leftSearchInput.value, leftSearchMode);
});

rightSearchScope.addEventListener("click", () => {
    rightSearchMode = rightSearchMode === "word" ? "mean" : "word";
    rightSearchScope.textContent = rightSearchMode === "word" ? "단어" : "의미";
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

    // 먼저 모두 제거
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

/* ===================== LEFT/RIGHT SEARCH INPUT에 적용 ===================== */

leftSearchInput.addEventListener("input", () => {
    search(leftInner, leftSearchInput.value, leftSearchMode);
    applyOverlapHighlight();
});

rightSearchInput.addEventListener("input", () => {
    search(rightInner, rightSearchInput.value, rightSearchMode);
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

leftGotoInput.addEventListener("keydown", e => {
    if (e.key === "Enter") gotoNumber(leftInner, leftGotoInput.value);
});

rightGotoInput.addEventListener("keydown", e => {
    if (e.key === "Enter") gotoNumber(rightInner, rightGotoInput.value);
});

leftGotoArrow.addEventListener("click", () => {
    gotoNumber(leftInner, leftGotoInput.value);
});

rightGotoArrow.addEventListener("click", () => {
    gotoNumber(rightInner, rightGotoInput.value);
});

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
    if (!confirm(`이 ${a}개 단어를 삭제하기겠습니까?`)) return;
    const firstVisible = getTopUnit(inner);
    const deletedIds = [...selected].map(u => u.dataset.id);
    tempSet.words = tempSet.words.filter(w => !deletedIds.includes(w.id));

    toggleSelectMode(wrapper, btn);
    renderAll();
    restoreScroll(inner, wrapper, firstVisible);
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
    });

}

handleAdd(leftInner);
handleAdd(rightInner);

/* ===================== TAB ADD WORD ===================== */

function handleTabCreate(inner){

    inner.addEventListener("keydown", e=>{

        if(e.key !== "Tab") return;
        if(!e.target.classList.contains("word-mean-input")) return;

        const wrapper = e.target.closest(".word-unit-wrapper");
        const units = inner.querySelectorAll(".word-unit-wrapper");
        if(wrapper !== units[units.length-1]) return;

        e.preventDefault();

        const id = wrapper.dataset.id;
        const index = tempSet.words.findIndex(w=>w.id===id);

        addWord(index);

        const digits = getNumberDigits(tempSet.words.length);

        const newUnit = createUnit(tempSet.words[index+1], index+1, String(index+2).padStart(digits,"0"));
        wrapper.after(newUnit);

        const otherInner = inner === leftInner ? rightInner : leftInner;
        const otherWrapper = otherInner.querySelector(`.word-unit-wrapper[data-id="${id}"]`);
        const newUnit2 = createUnit(tempSet.words[index+1], index+1, String(index+2).padStart(digits,"0"));
        otherWrapper.after(newUnit2);

        updateNumbers();
        applyOverlapHighlight();

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

    applyOverlapHighlight(); // ← 저장 전에도 중복 체크
}

saveBtn.addEventListener("click", () => {

    collectInputs();

    tempSet.name = nameInput.value;
    tempSet.sectionSize = sectionSize;
    tempSet.splitMode = windowSepToggle.classList.contains("active");
    tempSet.lastModifiedDate = getLocalISOString()

    window.removeEventListener("beforeunload", beforeUnloadHandler); // ← 항상 제거

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


/* ===================== TXT IMPORT (#etest-btn) ===================== */

const etestBtn = document.getElementById("etest-btn");

etestBtn?.addEventListener("click", async () => {

    try {

        const res = await fetch("./words.txt");

        if (!res.ok) throw new Error("파일 없음");

        const text = await res.text();

        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

        const parsedWords = lines.map(line => {

            const [left, right] = line.split("<$#?0!#$>");

            let spelling = "";
            let phonetic = "";

            if (left) {

                const phonMatch = left.match(/\[(.*?)\]/);

                if (phonMatch) {
                    phonetic = `[${phonMatch[1]}]`;
                    spelling = left.replace(phonMatch[0], "").trim();
                } else {
                    spelling = left.trim();
                }

            }

            return {
                id: crypto.randomUUID(),
                spelling: spelling,
                phonetic: phonetic,
                meaning: (right ?? "").trim(),
                lastStudyDate: null
            };

        });

        tempSet.words = parsedWords;

        renderAll();

        wordsCount.textContent = `단어 : ${tempSet.words.length}`;

    } catch (e) {
        console.error("txt 불러오기 실패:", e);
        alert("❌ words.txt 불러오기 실패\n👉 Live Server로 실행해야 합니다");
    }

});

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

        // 1️⃣ 데이터 반영
        if (input.classList.contains("word-spell-input")) {
            word.spelling = input.value;
        } else if (input.classList.contains("word-phon-input")) {
            word.phonetic = input.value;
        } else if (input.classList.contains("word-mean-input")) {
            word.meaning = input.value;
        }

        // 2️⃣ 반대쪽 동기화
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

    });

}

// 양쪽에 적용
syncInput(leftInner, rightInner);
syncInput(rightInner, leftInner);
