/* word-memorize.js */

import { loadSets, saveSets } from "./storage.js";

/* =============================
    STATE
============================= */

const state = {
    words: [],
    currentIndex: 0,
    total: 0,
    startX: 0,
    currentX: 0,
    isDragging: false,
    isPointerDown: false,
    setId: null,
    slideWidth: 0
};

/* =============================
    DOM
============================= */

const contents = document.getElementById("contents");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const progress = document.getElementById("memorize-progress");
const exitBtn = document.getElementById("memorize-exit-btn");

/* =============================
    UTIL
============================= */

function getLocalISOString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString();
}

function shuffleArray(arr) {
    const copied = [...arr];

    for (let i = copied.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }

    return copied;
}

function isSameWordList(a, b) {

    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (
            a[i].originalId !== b[i].originalId ||
            a[i].spell !== b[i].spell ||
            a[i].phon !== b[i].phon ||
            a[i].mean !== b[i].mean
        ) {
            return false;
        }
    }

    return true;
}

/* =============================
    LOAD DATA
============================= */

function loadData() {

    const raw = sessionStorage.getItem("studyData");

    if (!raw) {
        alert("잘못된 접근입니다.");
        location.href = "wordSet-main.html";
        return;
    }

    const data = JSON.parse(raw);

    const newWords = data.words || [];
    const newShuffle = data.shuffle;

    state.setId = data.setId;

    if (newWords.length === 0) {
        alert("학습할 단어가 없습니다.");
        location.href = `wordSet-main.html?id=${state.setId}`;
        return;
    }

    const prevRaw = sessionStorage.getItem("memorizeWordList");
    const prevShuffle = sessionStorage.getItem("memorizeShuffle") === "true";
    const prevShuffledListRaw = sessionStorage.getItem("memorizeShuffledList");

    let usePrevIndex = false;

    if (prevRaw) {

        const prevList = JSON.parse(prevRaw);
        const prevShuffledList = prevShuffledListRaw ? JSON.parse(prevShuffledListRaw) : null;

        if (isSameWordList(prevList, newWords)) {

            if (prevShuffle === newShuffle) {

                usePrevIndex = true;

                if (newShuffle && prevShuffledList) {
                    state.words = prevShuffledList;
                } else {
                    state.words = newWords;
                }

            } else {

                if (newShuffle) {
                    const shuffled = shuffleArray(newWords);
                    state.words = shuffled;
                    sessionStorage.setItem("memorizeShuffledList", JSON.stringify(shuffled));
                } else {
                    state.words = newWords;
                    sessionStorage.removeItem("memorizeShuffledList");
                }

                sessionStorage.setItem("memorizeIndex", "0");
            }

        } else {

            if (newShuffle) {
                const shuffled = shuffleArray(newWords);
                state.words = shuffled;
                sessionStorage.setItem("memorizeShuffledList", JSON.stringify(shuffled));
            } else {
                state.words = newWords;
                sessionStorage.removeItem("memorizeShuffledList");
            }

            sessionStorage.setItem("memorizeIndex", "0");
        }

    } else {

        if (newShuffle) {
            const shuffled = shuffleArray(newWords);
            state.words = shuffled;
            sessionStorage.setItem("memorizeShuffledList", JSON.stringify(shuffled));
        } else {
            state.words = newWords;
        }

        sessionStorage.setItem("memorizeIndex", "0");
    }

    sessionStorage.setItem("memorizeWordList", JSON.stringify(newWords));
    sessionStorage.setItem("memorizeShuffle", newShuffle);

    state.total = state.words.length;

    if (usePrevIndex) {
        const savedIndex = sessionStorage.getItem("memorizeIndex");
        if (savedIndex !== null) {
            state.currentIndex = parseInt(savedIndex, 10) || 0;
        }
    } else {
        state.currentIndex = 0;
    }
}

/* =============================
    RENDER
============================= */

function renderCards() {

    contents.innerHTML = "";

    state.slideWidth = contents.parentElement.clientWidth;

    state.words.forEach(word => {

        const wrapper = document.createElement("div");
        wrapper.className = "card-wrapper";
        wrapper.style.width = state.slideWidth + "px";
        wrapper.style.flexShrink = "0";

        const hasPhon = word.phon && word.phon.trim() !== "";
        wrapper.innerHTML = `
            <div class="cardwrap-inner">
                <div class="card">
                    <div class="card-top">
                        <div class="card-top-inner">
                            <div class="card-spell">${word.spell}</div>
                            <div class="card-phon">${hasPhon ? `[<span>${word.phon}</span>]` : ""}</div>
                        </div>
                    </div>
                    <div class="card-bottom">
                        <div class="card-means">${word.mean ?? ""}</div>
                        <div class="card-cover"><span>클릭하여 의미 보기</span></div>
                    </div>
                </div>
                <div class="card-btns">
                    <div class="card-btns-inner">
                        <div class="idontknow-btn">아직 몰라요</div>
                        <div class="iknow-btn">이제 알아요</div>
                    </div>
                </div>
            </div>
        `;

        const dontBtn = wrapper.querySelector(".idontknow-btn");
        const knowBtn = wrapper.querySelector(".iknow-btn");

        dontBtn.addEventListener("click", e => {
            if (state.isDragging) return;
            e.stopPropagation();
            dontBtn.classList.add("active");
            knowBtn.classList.remove("active");
            updateWordState(word, "dontknow");
            setTimeout(goNext, 200);
        });

        knowBtn.addEventListener("click", e => {
            if (state.isDragging) return;
            e.stopPropagation();
            knowBtn.classList.add("active");
            dontBtn.classList.remove("active");
            updateWordState(word, "know");
            setTimeout(goNext, 200);
        });

        const cover = wrapper.querySelector(".card-cover");
        const means = wrapper.querySelector(".card-means");

        cover.addEventListener("click", e => {
            if (state.isDragging) return;
            e.stopPropagation();
            wrapper.classList.add("open");
        });

        means.addEventListener("click", e => {
            if (state.isDragging) return;
            e.stopPropagation();
            wrapper.classList.remove("open");
        });

        contents.appendChild(wrapper);
    });
    
}

/* =============================
    VIEW
============================= */

function updateView(noAnimation = false) {

    contents.style.transition = noAnimation ? "none" : "transform 0.3s ease";

    contents.style.transform =
        `translate3d(-${state.currentIndex * state.slideWidth}px,0,0)`;

    progress.textContent = `${state.currentIndex + 1}/${state.total}`;

    prevBtn.classList.toggle("hide", state.currentIndex === 0);
    nextBtn.classList.toggle("hide", state.currentIndex === state.total - 1);

    sessionStorage.setItem("memorizeIndex", state.currentIndex);
}

function goNext() {
    if (state.currentIndex < state.total - 1) {
        state.currentIndex++;
        updateView();
    }
}

function goPrev() {
    if (state.currentIndex > 0) {
        state.currentIndex--;
        updateView();
    }
}

/* =============================
    BUTTON
============================= */

nextBtn.addEventListener("click", goNext);
prevBtn.addEventListener("click", goPrev);

/* =============================
    DRAG (완전 안정 버전)
============================= */

contents.addEventListener("pointerdown", e => {

    state.isPointerDown = true;
    state.isDragging = false;

    state.startX = e.clientX;
    state.currentX = e.clientX;

    contents.style.transition = "none";
});

contents.addEventListener("pointermove", e => {

    if (!state.isPointerDown) return;

    const dx = e.clientX - state.startX;

    if (!state.isDragging && Math.abs(dx) > 8) {
        state.isDragging = true;
        contents.setPointerCapture(e.pointerId);
    }

    if (!state.isDragging) return;

    state.currentX = e.clientX;

    let move = dx;

    if (
        (state.currentIndex === 0 && move > 0) ||
        (state.currentIndex === state.total - 1 && move < 0)
    ) {
        move *= 0.3;
    }

    const base = -state.currentIndex * state.slideWidth;

    contents.style.transform =
        `translate3d(${base + move}px,0,0)`;
});

function handlePointerEnd(e) {

    if (!state.isPointerDown) return;

    state.isPointerDown = false;

    try {
        contents.releasePointerCapture(e.pointerId);
    } catch {}

    if (!state.isDragging) return;

    const dx = state.currentX - state.startX;
    const threshold = 80;

    contents.style.transition = "transform 0.3s ease";

    if (dx < -threshold && state.currentIndex < state.total - 1) {
        state.currentIndex++;
    } else if (dx > threshold && state.currentIndex > 0) {
        state.currentIndex--;
    }

    updateView();

    state.isDragging = false;
}

contents.addEventListener("pointerup", handlePointerEnd);
contents.addEventListener("pointercancel", handlePointerEnd);

/* =============================
    RESIZE
============================= */

window.addEventListener("resize", () => {

    const prevIndex = state.currentIndex;

    renderCards();

    state.currentIndex = prevIndex;
    updateView(true);
});

/* =============================
    STORAGE
============================= */

function updateWordState(word, status) {

    const sets = loadSets();
    const targetSet = sets.find(s => s.id === state.setId);

    if (!targetSet) return;

    const idx = targetSet.words.findIndex(w => w.id === word.originalId);

    if (idx === -1) return;

    targetSet.words[idx].status = status;
    targetSet.words[idx].lastStudyDate = getLocalISOString();

    saveSets(sets);
}

/* =============================
    EXIT
============================= */

exitBtn.addEventListener("click", () => {
    if (confirm("변경사항이 저장되지 않을 수 있습니다. 나가시겠습니까?")) {
        location.href = `wordSet-main.html?id=${state.setId}`;
    }
});

/* =============================
    INIT
============================= */

function init() {
    loadData();
    renderCards();
    updateView(true);
}

init();