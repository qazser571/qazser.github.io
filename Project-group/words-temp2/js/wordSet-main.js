/* wordSet-main.js */

import { getSetById, updateSet, deleteSet, updateStudyOptions, getStudyOptions } from "./storage.js";

/* =============================
    STATE
============================= */

const state = {
    sectionSize: 12,
    previousSectionSize: 12,
    searchText: "",
    currentSet: null,
    viewDontKnowOnly: false
};
let isInitialRender = true;
let mobileToggleInitialized = false;
let searchModeActive = false;
let preSearchUIState = null;

/* =============================
    DOM
============================= */

const wordsSectScrollArea = document.getElementById("words-sect-scroll-area");
const searchInput = document.getElementById("search-word-input");
const searchDelBtn = document.getElementById("search-del-btn");
const gotoInput = document.getElementById("gotonum-input");
const gotoArrow = document.getElementById("gotonum-arrow");
const vdkwToggle = document.getElementById("vdkw-toggle-switch");
const meanViewMode = document.getElementById("mean-view-mode");
const mvmToggle = document.getElementById("mvm-toggle-switch");
const sectSepr = document.getElementById("sect-sepr");
const sectSeprHeader = document.getElementById("sect-sepr-header");
const sectSeprHeaderSpan = sectSeprHeader.querySelector("span");
const sectSeprGroup = document.getElementById("sect-sepr-group");
const sectSeprSetup = document.getElementById("sect-sepr-setup");
const sectSeprWhole = document.getElementById("sect-sepr-whole");
const sectSeprInput = document.getElementById("sect-sepr-input");
const delBtn = document.getElementById("word-set-del-btn");
const editBtn = document.getElementById("word-set-edit-btn");
const setName = document.getElementById("word-set-name");
const wordsCount = document.getElementById("word-set-words-count");
const studyDate = document.getElementById("word-set-study-date");
const editDate = document.getElementById("word-set-edit-date");
const setupBar = document.getElementById("setup-tools-verticalbar");
const setupLeft = document.getElementById("setup-tools-left");

/* ===== UI STATE SCROLL SAVE ===== */
const saveUIStateDebounced = debounce(saveUIState, 120);
wordsSectScrollArea?.addEventListener("scroll", saveUIStateDebounced);

const wordsListDownBtn = document.getElementById("words-list-down-btn");

wordsListDownBtn?.addEventListener("click", async () => {

    if (!state.currentSet) return;

    const originalSet = getSetById(setId);

    if (!originalSet || !originalSet.words?.length) {
        alert("저장할 단어가 없습니다.");
        return;
    }

    const lines = originalSet.words.map(word => {
        return `${word.spelling}<$#?0!#$>${word.meaning}`;
    });

    const text = lines.join("\n");

    try {

        /* ===== File System Access API 지원 ===== */
        if ("showSaveFilePicker" in window) {

            const handle = await window.showSaveFilePicker({
                suggestedName: `${originalSet.name}.txt`,
                types: [
                    {
                        description: "Text File",
                        accept: {
                            "text/plain": [".txt"]
                        }
                    }
                ]
            });

            const writable = await handle.createWritable();

            await writable.write(text);
            await writable.close();

            alert("단어 리스트가 저장되었습니다.");

        } else {

            /* ===== 미지원 브라우저 fallback ===== */

            const blob = new Blob([text], { type: "text/plain;charset=utf-8" });

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");

            a.href = url;
            a.download = `${originalSet.name}.txt`;

            document.body.appendChild(a);

            a.click();

            a.remove();

            URL.revokeObjectURL(url);

            alert("브라우저 제한으로 기본 다운로드 방식으로 저장되었습니다.");
        }

    } catch (err) {

        console.error(err);

        if (err.name !== "AbortError") {
            alert("파일 저장 중 오류가 발생했습니다.");
        }
    }
});

/* =============================
    LOAD DATA
============================= */

const params = new URLSearchParams(location.search);
const setId = params.get("id");
if (!setId) {
    alert("잘못된 접근입니다.");
} else {
    const set = getSetById(setId);
    if (!set) {
        alert("세트를 찾을 수 없습니다.");
    } else {
        state.sectionSize = set.sectionSize;
        state.previousSectionSize = set.sectionSize;
        sectSeprInput.value = state.sectionSize;
        state.currentSet = convertData(set);
        setName.textContent = set.name;
        wordsCount.textContent = `단어 : ${set.words.length}`;
        const latestStudy = set.words
            .map(w => w.lastStudyDate)
            .filter(Boolean)
            .sort()
            .pop();
        if (latestStudy) {
            const d = latestStudy.split("T")[0].replaceAll("-", ".");
            studyDate.textContent = `학습 : ${d}`;
        } else {
            studyDate.textContent = "학습 : 0000.00.00";
        }
        if (set.lastModifiedDate) {
            const d = set.lastModifiedDate.split("T")[0].replaceAll("-", ".");
            editDate.textContent = `수정 : ${d}`;
        }
        sectSeprHeaderSpan.textContent = state.sectionSize === 0 ? '전체 보기' : `${state.sectionSize}개씩 구간 분리`;
        renderSections();
    }
}

/* =============================
    DATA CONVERT
============================= */

function convertData(set) {
    const words = set.words.map((w, i) => ({
        originalId: w.id,
        id: i + 1,
        spell: w.spelling,
        phon: w.phonetic,
        mean: w.meaning,
        status: w.status
    }));
    return {
        id: set.id,
        name: set.name,
        words: words
    };
}
function updateSections() {
    const search = state.searchText.toLowerCase();
    document.querySelectorAll(".word-unit").forEach(unit => {
        const id = Number(unit.dataset.wordId);
        const word = state.currentSet.words[id - 1];
        let visible = true;
        if (search) visible = word.spell.toLowerCase().includes(search);
        if (state.viewDontKnowOnly) visible = visible && word.status === "dontknow";
        unit.style.display = visible ? "" : "none";
        const spellEl = unit.querySelector(".word-spell");
        const spell = word.spell;
        if (search && spell.toLowerCase().includes(search)) {
            const regex = new RegExp(`(${search})`, "gi");
            spellEl.innerHTML = spell.replace(regex, `<span class="search-highlight">$1</span>`);
        } else {
            spellEl.textContent = spell;
        }
    });
    updateSectionVisibility();
    updateVisibleBorders();
}
function updateSectionVisibility() {
    document.querySelectorAll(".words-sect").forEach(sect => {
        const hasVisibleWord = [...sect.querySelectorAll(".word-unit")].some(w => w.style.display !== "none");
        sect.style.display = hasVisibleWord ? "" : "none";
        if (searchModeActive && hasVisibleWord) {
            sect.classList.add("open");
        }
    });
}
function updateVisibleBorders() {
    document.querySelectorAll(".sect-words-group").forEach(group => {
        const visibleWords = [...group.querySelectorAll(".word-unit")].filter(el => el.style.display !== "none");
        visibleWords.forEach(el => el.classList.remove("has-border"));
        visibleWords.forEach((el, index) => {
            if (index !== visibleWords.length - 1) el.classList.add("has-border");
        });
    });
}

/* =============================
    RENDER
============================= */

function renderSections() {
    if (isInitialRender) {
        buildInitialSections();
        isInitialRender = false;
        restoreUIState();
    }
    updateSections();
}
function buildInitialSections() {
    const fragment = document.createDocumentFragment();
    const words = state.currentSet.words;
    const sectionMap = {};
    words.forEach((word, index) => {
        const section = state.sectionSize ? Math.floor(index / state.sectionSize) + 1 : 1;
        if (!sectionMap[section]) sectionMap[section] = [];
        sectionMap[section].push(word);
    });
    Object.keys(sectionMap).forEach(sectionNum => {
        const el = createSectionElement(sectionNum, sectionMap[sectionNum], "");
        fragment.appendChild(el);
    });
    wordsSectScrollArea.appendChild(fragment);
    applyMobileDefaultState();
}

function createSectionElement(sectionNum, words, searchText) {
    const wordsSect = document.createElement("div");
    wordsSect.className = "words-sect";
    wordsSect.dataset.sectionNum = sectionNum;
    const group = document.createElement("div");
    group.className = "sect-words-group";
    words.forEach(word => {
        group.appendChild(createWordElement(word, searchText));
    });
    if (state.sectionSize === 0) {
        wordsSect.classList.add("open");
        wordsSect.appendChild(group);
        return wordsSect;
    }
    const header = document.createElement("div");
    header.className = "words-sect-header";
    const startId = (sectionNum - 1) * state.sectionSize + 1;
    const endId = Math.min(sectionNum * state.sectionSize, state.currentSet.words.length);
    header.innerHTML = `
        <div class="words-sect-header-inner">
            <div class="words-sect-header-left">
                <div class="sect-num">${sectionNum}구간</div>
                <div class="words-range">
                    ${startId.toString().padStart(4,"0")}-${endId.toString().padStart(4,"0")}
                </div>
            </div>
            <div class="words-sect-header-right">
                <div class="memorize-btn">암기하기</div>
            </div>
        </div>
    `;
    header.querySelector(".memorize-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        openStudyPopupWithSection(sectionNum);
    });
    header.addEventListener("click", (e) => {
        if (e.target.closest(".memorize-btn")) return;
        const beforeTop = header.getBoundingClientRect().top;
        wordsSect.classList.toggle("open");
        const afterTop = header.getBoundingClientRect().top;
        const diff = afterTop - beforeTop;
        wordsSectScrollArea.scrollTop += diff;
        saveUIState();
    });
    wordsSect.appendChild(header);
    wordsSect.appendChild(group);
    return wordsSect;
}
function createWordElement(word, searchText) {
    const unit = document.createElement("div");
    unit.className = "word-unit";
    unit.dataset.wordId = word.id;
    updateWordClass(unit, word.status);
    const hasPhon = word.phon && word.phon.trim() !== "";
    unit.innerHTML = `
        <div class="whet-know"></div>
        <div class="word-spell">${word.spell}</div>
        <div class="word-phon">${hasPhon ? `[<span>${word.phon}</span>]` : ""}</div>
        <div class="word-mean">${word.mean ?? ""}</div>
        <div class="word-mean-pos hide"></div>
    `;
    unit.querySelector(".whet-know").addEventListener("click", (e) => {
        e.stopPropagation();
        const original = getSetById(setId);
        const real = original.words.find(w => w.id === word.originalId);
        if (!real) return;
        switch(real.status) {
            case "never":
            case "know":
                real.status = "dontknow";
                break;
            case "dontknow":
                real.status = "know";
                break;
            default:
                real.status = "dontknow";
                break;
        }
        updateSet(original);
        word.status = real.status;
        updateWordClass(unit, word.status);
    });
    return unit;
}
function updateWordClass(el, status) {
    el.classList.remove("know", "dontknow");
    if (status === "know") el.classList.add("know");
    else if (status === "dontknow") el.classList.add("dontknow");
}

/* =============================
    SEARCH
============================= */

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
searchInput.addEventListener("input", debounce(e => {

    const newText = e.target.value;
    const wasSearching = searchModeActive;

    state.searchText = newText;

    /* ===== 검색 시작 ===== */
    if (newText && !wasSearching) {

        searchModeActive = true;
        preSearchUIState = {
            openSections: [...document.querySelectorAll(".words-sect.open")]
                .map(el => Number(el.dataset.sectionNum)),
            scrollTop: wordsSectScrollArea.scrollTop
        };
    }

    if (!newText && wasSearching) {

        searchModeActive = false;
        renderSections();
        requestAnimationFrame(() => {
            restorePreSearchUI();
        });
        return;
    }
    renderSections();
}, 150));

searchDelBtn.addEventListener("click", () => {

    const wasSearchingNow = searchModeActive;
    searchInput.value = "";
    state.searchText = "";

    renderSections();

    if (wasSearchingNow) {
        searchModeActive = false;
        requestAnimationFrame(() => {
            restorePreSearchUI();
        });
    }
});

/* =============================
    GO TO NUMBER
============================= */

function gotoNumber() {
    const num = parseInt(gotoInput.value);
    if (!num) return;
    const target = document.querySelector(`.word-unit[data-word-id="${num}"]`);
    if (target) {
        const sect = target.closest(".words-sect");
        if (sect) sect.classList.add("open");
        const containerRect = wordsSectScrollArea.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const y = wordsSectScrollArea.scrollTop + (targetRect.top - containerRect.top);
        smoothScrollTo(wordsSectScrollArea, y, 100);
    }
}
gotoArrow.addEventListener("click", gotoNumber);
gotoInput.addEventListener("keydown", e => {
    if (e.key === "Enter") gotoNumber();
});

/* =============================
    SCROLL
============================= */

function smoothScrollTo(container, targetY, duration = 100) {
    const startY = container.scrollTop;
    const diff = targetY - startY;
    const startTime = performance.now();
    function step(currentTime) {
        const time = Math.min(1, (currentTime - startTime) / duration);
        const eased = time * (2 - time);
        container.scrollTop = startY + diff * eased;
        if (time < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/* =============================
    UI STATE SAVE / RESTORE
============================= */

function getUIStateKey() {
    return `wordSetUI-${setId}`;
}

function saveUIState() {
    if (searchModeActive) return;
    if (!state.currentSet) return;
    const openSections = [...document.querySelectorAll(".words-sect.open")].map(el => Number(el.dataset.sectionNum));
    const uiState = {
        openSections,
        scrollTop: wordsSectScrollArea.scrollTop
    };
    sessionStorage.setItem(
        getUIStateKey(),
        JSON.stringify(uiState)
    );
}
function restoreUIState() {
    const raw = sessionStorage.getItem(getUIStateKey());
    if (!raw) return;
    const uiState = JSON.parse(raw);
    uiState.openSections?.forEach(num => {
        const sect = document.querySelector(`.words-sect[data-section-num="${num}"]`);
        if (sect) sect.classList.add("open");
    });
    requestAnimationFrame(() => {
        wordsSectScrollArea.scrollTop = uiState.scrollTop ?? 0;
    });
}

function restorePreSearchUI() {
    if (!preSearchUIState) return;

    const { openSections, scrollTop } = preSearchUIState;
    document.querySelectorAll(".words-sect").forEach(el => el.classList.remove("open"));

    openSections.forEach(num => {
        const sect = document.querySelector(`.words-sect[data-section-num="${num}"]`);
        if (sect) sect.classList.add("open");
    });

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            wordsSectScrollArea.scrollTop = scrollTop ?? 0;
        });
    });

    preSearchUIState = null;
}

/* =============================
    VIEW DONT KNOW ONLY
============================= */

vdkwToggle?.addEventListener("click", () => {
    state.viewDontKnowOnly = !state.viewDontKnowOnly;
    vdkwToggle.classList.toggle("active");
    renderSections();
    setupLeft.classList.remove("show");
});

/* =============================
    SECTION CONTROL
============================= */

sectSeprHeader.addEventListener("click", (e) => {
    e.stopPropagation();
    sectSeprGroup.classList.toggle("active");
});
sectSeprGroup.addEventListener("click", (e) => {
    e.stopPropagation();
});
sectSeprInput.setAttribute("inputmode", "numeric");
sectSeprInput.setAttribute("enterkeyhint", "go");

sectSeprWhole.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.sectionSize !== 0) {
        state.previousSectionSize = state.sectionSize;
    }
    state.sectionSize = 0;
    sectSeprInput.value = state.previousSectionSize;
    sectSeprHeaderSpan.textContent = '전체 보기';
    const currentSet = getSetById(setId);
    if (currentSet) {
        currentSet.sectionSize = state.sectionSize;
        updateSet(currentSet);
    }
    isInitialRender = true;
    wordsSectScrollArea.innerHTML = "";
    renderSections();
    sectSeprGroup.classList.remove("active");
    setupLeft.classList.remove("show");
});
sectSeprSetup.addEventListener("click", (e) => {
    e.stopPropagation();
    let num = parseInt(sectSeprInput.value);
    if (!num || num <= 0) {
        alert("숫자를 입력하세요");
        return;
    }
    state.sectionSize = num;
    state.previousSectionSize = num;
    sectSeprInput.value = num;
    sectSeprHeaderSpan.textContent = `${state.sectionSize}개씩 구간 분리`;
    const currentSet = getSetById(setId);
    if (currentSet) {
        currentSet.sectionSize = state.sectionSize;
        updateSet(currentSet);
    }
    isInitialRender = true;
    wordsSectScrollArea.innerHTML = "";
    renderSections();
    sectSeprGroup.classList.remove("active");
    setupLeft.classList.remove("show");
});
sectSeprInput.addEventListener("click", e => e.stopPropagation());
sectSeprInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        sectSeprSetup.click();
        sectSeprGroup.classList.remove("active");
    }
});
sectSeprInput.addEventListener("input", () => {
    sectSeprInput.value = sectSeprInput.value.replace(/\D/g, "");
    if (sectSeprInput.value === '0') sectSeprInput.value = state.previousSectionSize;
});
document.addEventListener("click", e => {
    if (!sectSepr.contains(e.target)) sectSeprGroup.classList.remove("active");
});

/* =============================
    EDIT PAGE
============================= */

editBtn?.addEventListener("click", () => {
    location.href = `wordSet-edit.html?id=${state.currentSet.id}`;
});

/* =============================
    DELETE SET
============================= */

delBtn?.addEventListener("click", () => {
    if (confirm("정말 이 세트를 삭제하시겠습니까?")) {
        deleteSet(state.currentSet.id);
        location.href = "wordSet-list.html";
    }
});

/* =============================
    BACK TO LIST
============================= */

document.getElementById("go-set-list-btn")?.addEventListener("click", () => {
    location.href = "wordSet-list.html";
});

/* =========================================================
    추가 코드
========================================================= */

const studyTestBtn = document.getElementById("study-test-btn");
const stpopWrapper = document.getElementById("stpop-wrapper");
const stpopCloseBtn = document.getElementById("stpop-close-btn");
const stpopTitle = document.getElementById("stpop-title");
const studyBtn = document.getElementById("study-btn");
const testBtn = document.getElementById("test-btn");
const stSelectBtns = document.getElementById("st-select-btns");
const stpopSectInner = document.getElementById("stpop-sect-inner");
const stpopBottom = document.getElementById("stpop-bottom");
const studyStartBtn = document.getElementById("study-start-btn");
const testStartBtn = document.getElementById("test-start-btn");
const knowexcSwitch = document.getElementById("knowexc-switch");
const shuffleSwitch = document.getElementById("shuffle-switch");
const selectedSections = new Set();

/* ===== 팝업 ===== */

studyTestBtn?.addEventListener("click", () => {
    stpopWrapper.classList.add("show");
    stpopTitle.textContent = "선택하기";
    generateSectionButtons();
});
stpopCloseBtn?.addEventListener("click", () => {
    stpopWrapper.classList.remove("show");
    stSelectBtns.classList.add("show");
    stpopSectInner.classList.remove("show");
    stpopBottom.classList.remove("show");
    studyStartBtn.classList.remove("show");
    testStartBtn.classList.remove("show");
    selectedSections.clear();
    document.querySelectorAll(".stpop-sect").forEach(el => {
        el.classList.remove("selected");
    });
});

/* ===== 모드 선택 ===== */

studyBtn?.addEventListener("click", () => {
    stSelectBtns.classList.remove("show");
    stpopSectInner.classList.add("show");
    stpopBottom.classList.add("show");
    studyStartBtn.classList.add("show");
    stpopTitle.textContent = "구간별 학습";
});

testBtn?.addEventListener("click", () => {
    stSelectBtns.classList.remove("show");
    stpopSectInner.classList.add("show");
    stpopBottom.classList.add("show");
    testStartBtn.classList.add("show");
    stpopTitle.textContent = "구간별 테스트";
});

/* =============================
    MEMORIZE BUTTON
============================= */

function openStudyPopupWithSection(sectionNum) {
    stpopWrapper.classList.add("show");
    stpopTitle.textContent = "구간별 학습";
    stSelectBtns.classList.remove("show");
    stpopSectInner.classList.add("show");
    stpopBottom.classList.add("show");
    studyStartBtn.classList.add("show");
    testStartBtn.classList.remove("show");
    generateSectionButtons();
    selectedSections.clear();
    document.querySelectorAll(".stpop-sect").forEach(el => {
        el.classList.remove("selected");
    });
    const target = [...document.querySelectorAll(".stpop-sect")].find(el => parseInt(el.textContent) === parseInt(sectionNum));
    if (target) {
        target.classList.add("selected");
        selectedSections.add(parseInt(sectionNum));
    }
}

/* ===== 구간 생성 ===== */

function generateSectionButtons() {
    stpopSectInner.innerHTML = "";
    const total = state.currentSet.words.length;
    const size = state.sectionSize || total;
    const count = Math.ceil(total / size);
    for (let i = 1; i <= count; i++) {
        const el = document.createElement("div");
        el.className = "stpop-sect";
        el.textContent = i;
        el.addEventListener("click", () => {
            if (el.classList.contains("selected")) {
                el.classList.remove("selected");
                selectedSections.delete(i);
            } else {
                el.classList.add("selected");
                selectedSections.add(i);
            }
        });
        stpopSectInner.appendChild(el);
    }
}

/* ===== 스위치 ===== */

function toggleSwitch(el, key) {
    el.classList.toggle("active");
    updateStudyOptions(setId, {[key]: el.classList.contains("active")});
}
knowexcSwitch?.addEventListener("click", () => {
    toggleSwitch(knowexcSwitch, "knowExclude");
});
shuffleSwitch?.addEventListener("click", () => {
    toggleSwitch(shuffleSwitch, "shuffleMode");
});

/* ===== 초기 상태 ===== */

if (setId) {
    const opt = getStudyOptions(setId);
    if (opt.knowExclude) knowexcSwitch?.classList.add("active");
    if (opt.shuffleMode) shuffleSwitch?.classList.add("active");
}

/* ===== 시작 ===== */

studyStartBtn?.addEventListener("click", () => {
    if (selectedSections.size === 0) {
        alert("구간을 선택하세요");
        return;
    }
    const size = state.sectionSize || state.currentSet.words.length;
    let selected = [];
    state.currentSet.words.forEach((w, i) => {
        const sec = Math.floor(i / size) + 1;
        if (selectedSections.has(sec)) selected.push(w);
    });
    const original = getSetById(setId);
    if (knowexcSwitch.classList.contains("active")) {
        selected = selected.filter(w => {
            const real = original.words.find(x => x.id === w.originalId);
            return real && real.status !== "know";
        });
    }
    if (selected.length === 0) {
        alert("선택한 조건에 해당하는 단어가 없습니다.");
        return;
    }
    const payload = {
        words: selected.map(w => ({
            originalId: w.originalId,
            spell: w.spell,
            phon: w.phon,
            mean: w.mean
        })),
        shuffle: shuffleSwitch.classList.contains("active"),
        setId: setId
    };
    sessionStorage.setItem("studyData", JSON.stringify(payload));
    location.href = "words-memorize.html";
});

/* =============================
    MOBILE MEAN TOGGLE
============================= */

function isMobileView() {
    return window.matchMedia("(max-width: 480px)").matches;
}
const mobileQuery = window.matchMedia("(max-width: 480px)");

mobileQuery.addEventListener("change", applyMobileDefaultState);

document.addEventListener("DOMContentLoaded", () => {
    applyMobileDefaultState();
    setupMobileToggle();
});
function applyMobileDefaultState() {
    if (isMobileView()) {
        meanViewMode?.classList.add("hide");
        document.querySelectorAll(".word-unit").forEach(unit => {
            const spell = unit.querySelector(".word-spell");
            const phon = unit.querySelector(".word-phon");
            const mean = unit.querySelector(".word-mean");
            spell.classList.remove("hide");
            phon.classList.remove("hide");
            mean.classList.add("hide");
            unit.dataset.meanVisible = "false";
        });
    } else {
        meanViewMode?.classList.remove("hide");
        document.querySelectorAll(".word-unit").forEach(unit => {
            const spell = unit.querySelector(".word-spell");
            const phon = unit.querySelector(".word-phon");
            const mean = unit.querySelector(".word-mean");
            spell.classList.remove("hide");
            phon.classList.remove("hide");
            mean.classList.remove("hide");
            unit.dataset.meanVisible = "true";
        });
    }
}

/* 클릭 토글 */
function setupMobileToggle() {
    if (mobileToggleInitialized) return;
    mobileToggleInitialized = true;
    document.addEventListener("click", (e) => {
        if (mvmToggle?.classList.contains("active")) return;
        if (!isMobileView()) return;
        const unit = e.target.closest(".word-unit");
        if (!unit) return;
        const spell = unit.querySelector(".word-spell");
        const phon = unit.querySelector(".word-phon");
        const mean = unit.querySelector(".word-mean");
        const isVisible = unit.dataset.meanVisible === "true";
        if (isVisible) {
            spell.classList.remove("hide");
            phon.classList.remove("hide");
            mean.classList.add("hide");
            unit.dataset.meanVisible = "false";
        } else {
            spell.classList.add("hide");
            phon.classList.add("hide");
            mean.classList.remove("hide");
            unit.dataset.meanVisible = "true";
        }
    });
}

/* 리사이즈 대응 */
window.addEventListener("resize", () => {
    applyMobileDefaultState();
});

/* 최초 적용 */
document.addEventListener("DOMContentLoaded", () => {
    applyMobileDefaultState();
    setupMobileToggle();
});

/* ===== 토글 ===== */
setupBar?.addEventListener("click", (e) => {
    e.stopPropagation(); // 바깥 클릭 이벤트 방지
    setupLeft.classList.toggle("show");
});

/* ===== 외부 클릭 시 닫기 ===== */
document.addEventListener("click", (e) => {

    // setup 영역 내부 클릭이면 무시
    if (setupLeft.contains(e.target) || setupBar.contains(e.target)) return;

    setupLeft.classList.remove("show");
});

/* ===== 초기 실행 ===== */
setTimeout(() => {
    if (state.currentSet) generateSectionButtons();
}, 0);


/* =============================
    MEAN VIEW MODE
============================= */

function resetMeanViewModeActive() {

    document.querySelectorAll(".word-unit").forEach(unit => {

        const spell = unit.querySelector(".word-spell");
        const phon = unit.querySelector(".word-phon");
        const mean = unit.querySelector(".word-mean");
        const meanPos = unit.querySelector(".word-mean-pos");

        spell.classList.remove("hide");
        phon.classList.remove("hide");
        meanPos.classList.remove("hide");

        mean.classList.add("hide");

        unit.dataset.meanOpened = "false";
    });
}

function resetMeanViewModeInactive() {

    document.querySelectorAll(".word-unit").forEach(unit => {

        const spell = unit.querySelector(".word-spell");
        const phon = unit.querySelector(".word-phon");
        const mean = unit.querySelector(".word-mean");
        const meanPos = unit.querySelector(".word-mean-pos");

        spell.classList.remove("hide");
        phon.classList.remove("hide");
        mean.classList.remove("hide");

        meanPos.classList.add("hide");

        unit.dataset.meanOpened = "false";
    });
}

/* ===== mvm 토글 ===== */

mvmToggle?.addEventListener("click", () => {

    mvmToggle.classList.toggle("active");

    if (mvmToggle.classList.contains("active")) {
        resetMeanViewModeActive();
    } else {
        resetMeanViewModeInactive();
    }
});

/* ===== word 클릭 동작 ===== */

document.addEventListener("click", (e) => {

    if (!mvmToggle?.classList.contains("active")) return;

    const unit = e.target.closest(".word-unit");
    if (!unit) return;

    if (e.target.closest(".whet-know")) return;

    const spell = unit.querySelector(".word-spell");
    const phon = unit.querySelector(".word-phon");
    const mean = unit.querySelector(".word-mean");
    const meanPos = unit.querySelector(".word-mean-pos");

    const opened = unit.dataset.meanOpened === "true";

    if (opened) {

        spell.classList.remove("hide");
        phon.classList.remove("hide");
        meanPos.classList.remove("hide");

        mean.classList.add("hide");

        unit.dataset.meanOpened = "false";

    } else {

        spell.classList.add("hide");
        phon.classList.add("hide");
        meanPos.classList.add("hide");

        mean.classList.remove("hide");

        unit.dataset.meanOpened = "true";
    }
});

window.addEventListener("beforeunload", saveUIState);
