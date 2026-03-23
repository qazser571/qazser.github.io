/* wordSet-main.js */

import { getSetById, updateSet, deleteSet, updateStudyOptions, getStudyOptions } from "./storage.js";

/* =============================
    STATE
============================= */

const state = {
    sectionSize: 12,
    previousSectionSize: 12,
    searchText: "",
    viewMean: true,
    currentSet: null
};

let beforeSearchScrollTop = 0;
let wasSearching = false;
let openedSectionsBeforeSearch = new Set();

/* =============================
    DOM
============================= */

const wordsSectScrollArea = document.getElementById("words-sect-scroll-area");
const searchInput = document.getElementById("search-word-input");
const searchDelBtn = document.getElementById("search-del-btn");
const gotoInput = document.getElementById("gotonum-input");
const gotoArrow = document.getElementById("gotonum-arrow");
const viewMeanToggle = document.getElementById("view-mean-toggle-switch");
const sectSepr = document.getElementById("sect-sepr");
const sectSeprHeader = document.getElementById("sect-sepr-header");
const sectSeprHeaderSpan = sectSeprHeader.querySelector("span");
const sectSeprGroup = document.getElementById("sect-sepr-group");
const sectSeprSetup = document.getElementById("sect-sepr-setup");
const sectSeprWhole = document.getElementById("sect-sepr-whole");
const sectSeprInput = document.getElementById("sect-sepr-input");
const editBtn = document.getElementById("word-set-edit-btn");
const delBtn = document.getElementById("word-set-del-btn");

const setName = document.getElementById("word-set-name");
const wordsCount = document.getElementById("word-set-words-count");
const studyDate = document.getElementById("word-set-study-date");
const editDate = document.getElementById("word-set-edit-date");

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

/* =============================
    RENDER
============================= */

function renderSections() {

    const fragment = document.createDocumentFragment();
    const searchText = state.searchText.toLowerCase();
    let words = state.currentSet.words;

    if (searchText) {
        words = words.filter(word => word.spell.toLowerCase().includes(searchText));
    }

    const sectionMap = {};

    words.forEach((word, index) => {

        const section = state.sectionSize
            ? Math.floor(index / state.sectionSize) + 1
            : 1;

        if (!sectionMap[section]) sectionMap[section] = [];

        sectionMap[section].push(word);
    });

    Object.keys(sectionMap).forEach(sectionNum => {
        fragment.appendChild(createSectionElement(sectionNum, sectionMap[sectionNum], searchText));
    });

    wordsSectScrollArea.innerHTML = "";
    wordsSectScrollArea.appendChild(fragment);

    if (searchText) {
        document.querySelectorAll(".words-sect").forEach(sect => {
            if (sect.querySelector(".word-unit")) sect.classList.add("open");
        });
    } else if (openedSectionsBeforeSearch.size > 0) {
        document.querySelectorAll(".words-sect").forEach(sect => {
            const num = sect.dataset.sectionNum;
            if (openedSectionsBeforeSearch.has(num)) {
                sect.classList.add("open");
            }
        });
    }
}

function createSectionElement(sectionNum, words, searchText) {

    const wrapper = document.createElement("div");
    wrapper.className = "words-sect";
    wrapper.dataset.sectionNum = sectionNum;

    const header = document.createElement("div");
    header.className = "words-sect-header";

    header.innerHTML = `
        <div class="words-sect-header-inner">
            <div class="words-sect-header-left">
                <div class="sect-num">${sectionNum}구간</div>
                <div class="words-range">
                    ${words[0].id.toString().padStart(4, "0")}-${words[words.length - 1].id.toString().padStart(4, "0")}
                </div>
            </div>
            <div class="words-sect-header-right">
                <div class="memorize-btn">암기하기</div>
            </div>
        </div>
    `;

    header.addEventListener("click", (e) => {
        if (!e.target.closest(".memorize-btn")) {
            wrapper.classList.toggle("open");
        }
    });

    const group = document.createElement("div");
    group.className = "sect-words-group";

    words.forEach(word => {
        group.appendChild(createWordElement(word, searchText));
    });

    wrapper.appendChild(header);
    wrapper.appendChild(group);

    return wrapper;
}

function createWordElement(word, searchText) {

    const unit = document.createElement("div");

    unit.className = "word-unit";
    unit.dataset.wordId = word.id;

    if (word.status === "know") {
        unit.classList.add("know");
    } else if (word.status === "dontknow") {
        unit.classList.add("dontknow");
    }

    let spell = word.spell;

    if (searchText && spell.toLowerCase().includes(searchText)) {
        const regex = new RegExp(`(${searchText})`, "gi");
        spell = spell.replace(regex, `<span class="search-highlight">$1</span>`);
    }

    unit.innerHTML = `
        <div class="whet-know"></div>
        <div class="word-spell">${spell}</div>
        <div class="word-phon">${word.phon ?? ""}</div>
        <div class="word-mean">${word.mean ?? ""}</div>
    `;

    return unit;
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

function rememberOpenedSections() {

    openedSectionsBeforeSearch.clear();

    document.querySelectorAll(".words-sect.open").forEach(sect => {
        openedSectionsBeforeSearch.add(sect.dataset.sectionNum);
    });
}

searchInput.addEventListener("input", debounce(e => {

    const newText = e.target.value;
    const wasEmpty = state.searchText.length === 0;
    const isEmpty = newText.length === 0;

    if (wasEmpty && !isEmpty) {
        beforeSearchScrollTop = wordsSectScrollArea.scrollTop;
        rememberOpenedSections();
        wasSearching = true;
    }

    state.searchText = newText;

    renderSections();

    if (wasSearching && isEmpty) {
        wordsSectScrollArea.scrollTop = beforeSearchScrollTop;
        wasSearching = false;
    }

}, 150));

searchDelBtn.addEventListener("click", () => {

    const wasSearchingNow = state.searchText.length > 0;

    searchInput.value = "";
    state.searchText = "";

    renderSections();

    if (wasSearchingNow) {
        wordsSectScrollArea.scrollTop = beforeSearchScrollTop;
        wasSearching = false;
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
    MEANING TOGGLE
============================= */

viewMeanToggle.addEventListener("click", () => {

    state.viewMean = !state.viewMean;

    document.querySelectorAll(".word-mean").forEach(el => {
        el.style.display = state.viewMean ? "block" : "none";
    });

    viewMeanToggle.classList.toggle("active");
});

/* =============================
    SECTION CONTROL
============================= */

sectSepr.addEventListener("click", () => {
    sectSeprGroup.classList.toggle("active");
});

sectSeprWhole.addEventListener("click", () => {

    if (state.sectionSize !== 0) {
        state.previousSectionSize = state.sectionSize;
    }

    state.sectionSize = 0;
    sectSeprInput.value = state.previousSectionSize;
    sectSeprHeaderSpan.textContent = '전체 보기';

    const currentSet = getSetById(state.currentSet.id);
    if (currentSet) {
        currentSet.sectionSize = state.sectionSize;
        updateSet(currentSet);
    }

    renderSections();
    sectSeprGroup.classList.remove("active");
});

sectSeprSetup.addEventListener("click", () => {

    let num = parseInt(sectSeprInput.value);

    if (!num || num <= 0) {
        alert("숫자를 입력하세요");
        return;
    }

    state.sectionSize = num;
    state.previousSectionSize = num;
    sectSeprInput.value = num;
    sectSeprHeaderSpan.textContent = `${state.sectionSize}개씩 구간 분리`;

    const currentSet = getSetById(state.currentSet.id);
    if (currentSet) {
        currentSet.sectionSize = state.sectionSize;
        updateSet(currentSet);
    }

    renderSections();
    sectSeprGroup.classList.remove("active");
});

sectSeprInput.addEventListener("click", e => e.stopPropagation());

sectSeprInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        sectSeprSetup.click();
    }
});

sectSeprInput.addEventListener("input", () => {
    sectSeprInput.value = sectSeprInput.value.replace(/\D/g, "");
    if (sectSeprInput.value === '0') {
        sectSeprInput.value = state.previousSectionSize;
    }
});

document.addEventListener("click", e => {
    if (!sectSepr.contains(e.target)) {
        sectSeprGroup.classList.remove("active");
    }
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

document.getElementById("go-set-list")?.addEventListener("click", () => {
    location.href = "wordSet-list.html";
});

/* =========================================================
    🔥 추가 코드 (완전 반영)
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
});

stpopCloseBtn?.addEventListener("click", () => {
    stpopWrapper.classList.remove("show");

    /* 🔥 상태 초기화 */
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

    updateStudyOptions(setId, {
        [key]: el.classList.contains("active")
    });
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

/* ===== 초기 실행 ===== */

setTimeout(() => {
    if (state.currentSet) generateSectionButtons();
}, 0);