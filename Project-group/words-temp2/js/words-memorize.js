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
    setId: null
};

/* =============================
    DOM
============================= */

const contents = document.getElementById("contents");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const progress = document.getElementById("memorize-progress");
const exitBtn = document.getElementById("memorize-exit-btn");

function getLocalISOString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString();
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

    state.words = data.words || [];
    state.setId = data.setId;

    if (data.shuffle) {
        state.words.sort(() => Math.random() - 0.5);
    }

    state.total = state.words.length;
}

/* =============================
    RENDER
============================= */

function renderCards() {

    contents.innerHTML = "";

    contents.style.display = "flex";
    contents.style.flexWrap = "nowrap";
    contents.style.transition = "transform 0.3s ease";

    state.words.forEach(word => {

        const wrapper = document.createElement("div");
        wrapper.className = "card-wrapper";

        wrapper.style.width = "100%";
        wrapper.style.flexShrink = "0";

        wrapper.innerHTML = `
            <div class="cardwrap-inner">
                <div class="card">
                    <div class="card-top">
                        <div class="card-top-inner">
                            <div class="card-spell">${word.spell}</div>
                            <div class="card-phon">${word.phon ?? ""}</div>
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

        contents.appendChild(wrapper);
    });

    updateView();
}

let resizeTimer;

window.addEventListener("resize", () => {

    contents.style.transition = "none";

    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {

        updateView();

        requestAnimationFrame(() => {
            contents.style.transition = "transform 0.3s ease";
        });

    }, 50);
});

/* =============================
    VIEW CONTROL
============================= */

function updateView() {

    const width = contents.parentElement.clientWidth;

    contents.style.transform = `translateX(-${state.currentIndex * width}px)`;

    progress.textContent = `${state.currentIndex + 1}/${state.total}`;

    prevBtn.classList.toggle("hide", state.currentIndex === 0);
    nextBtn.classList.toggle("hide", state.currentIndex === state.total - 1);
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

    state.isDragging = true;
    state.startX = e.clientX;
    state.currentX = e.clientX;

    contents.style.transition = "none";

    contents.setPointerCapture(e.pointerId);
});

contents.addEventListener("pointermove", e => {

    if (!state.isDragging) return;

    state.currentX = e.clientX;

    const containerWidth = contents.parentElement.clientWidth;
    let dx = state.currentX - state.startX;

    if ((state.currentIndex === 0 && dx > 0) ||
        (state.currentIndex === state.total - 1 && dx < 0)) {
        dx *= 0.3;
    }

    const base = -state.currentIndex * containerWidth;

    contents.style.transform = `translateX(${base + dx}px)`;
});

function handlePointerEnd(e) {

    if (!state.isDragging) return;

    state.isDragging = false;

    contents.releasePointerCapture(e.pointerId);

    const containerWidth = contents.parentElement.clientWidth;
    const dx = state.currentX - state.startX;
    const threshold = containerWidth * 0.25;

    contents.style.transition = "transform 0.3s ease";

    if (dx < -threshold && state.currentIndex < state.total - 1) {
        state.currentIndex++;
    } else if (dx > threshold && state.currentIndex > 0) {
        state.currentIndex--;
    }

    updateView();
}

contents.addEventListener("pointerup", handlePointerEnd);
contents.addEventListener("pointercancel", handlePointerEnd);

contents.addEventListener("pointerleave", () => {
    if (!state.isDragging) return;

    state.isDragging = false;
    contents.style.transition = "transform 0.3s ease";
    updateView();
});

/* =============================
    CARD INTERACTION
============================= */

let goNextDelay = 300;

contents.addEventListener("click", e => {

    const wrapper = e.target.closest(".card-wrapper");
    if (!wrapper) return;

    const index = [...contents.children].indexOf(wrapper);
    const word = state.words[index];

    if (e.target.closest(".card-cover")) wrapper.classList.add("open");
    if (e.target.closest(".card-means")) wrapper.classList.remove("open");

    if (e.target.closest(".idontknow-btn")) {

        const dont = wrapper.querySelector(".idontknow-btn");
        const know = wrapper.querySelector(".iknow-btn");

        dont.classList.add("active");
        know.classList.remove("active");

        updateWordState(word, "dontknow");

        setTimeout(goNext, goNextDelay);
    }

    if (e.target.closest(".iknow-btn")) {

        const dont = wrapper.querySelector(".idontknow-btn");
        const know = wrapper.querySelector(".iknow-btn");

        know.classList.add("active");
        dont.classList.remove("active");

        updateWordState(word, "know");

        setTimeout(goNext, goNextDelay);
    }
});

/* =============================
    STORAGE
============================= */

function updateWordState(word, status) {

    const sets = loadSets();
    const targetSet = sets.find(s => s.id === state.setId);

    if (!targetSet) return;

    const idx = targetSet.words.findIndex(w => w.id === word.originalId);

    if (idx === -1) {
        console.error("매칭 실패", word.originalId);
        return;
    }

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
}

init();
