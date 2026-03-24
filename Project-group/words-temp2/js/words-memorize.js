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
    hasMoved: false,
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

    if (state.words.length === 0) {
        alert("학습할 단어가 없습니다.");
        location.href = `wordSet-main.html?id=${state.setId}`;
        return;
    }

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

        const dontBtn = wrapper.querySelector(".idontknow-btn");
        const knowBtn = wrapper.querySelector(".iknow-btn");

        [dontBtn, knowBtn].forEach(btn => {
            btn.addEventListener("pointerdown", e => {
                e.stopPropagation();
            });
        });

        dontBtn.addEventListener("click", e => {

            if (state.hasMoved) return;

            e.stopPropagation();

            dontBtn.classList.add("active");
            knowBtn.classList.remove("active");

            updateWordState(word, "dontknow");

            setTimeout(goNext, goNextDelay);
        });

        knowBtn.addEventListener("click", e => {

            if (state.hasMoved) return;

            e.stopPropagation();

            knowBtn.classList.add("active");
            dontBtn.classList.remove("active");

            updateWordState(word, "know");

            setTimeout(goNext, goNextDelay);
        });

        const cover = wrapper.querySelector(".card-cover");
        const means = wrapper.querySelector(".card-means");

        cover.addEventListener("click", e => {

            if (state.hasMoved) return;

            e.stopPropagation();
            wrapper.classList.add("open");
        });

        means.addEventListener("click", e => {

            if (state.hasMoved) return;

            e.stopPropagation();
            wrapper.classList.remove("open");
        });

        contents.appendChild(wrapper);
    });

    updateView();
}

/* =============================
    VIEW CONTROL
============================= */

function updateView() {

    const width = contents.parentElement.clientWidth;

    contents.style.transition = "transform 0.3s ease";

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
    DRAG (정상 UX 버전)
============================= */

contents.addEventListener("pointerdown", e => {

    state.isPointerDown = true;
    state.isDragging = false;
    state.hasMoved = false;
    state.startX = e.clientX;
    state.currentX = e.clientX;

    contents.style.transition = "none";
});

contents.addEventListener("pointermove", e => {

    if (!state.isPointerDown) return;

    const dx = e.clientX - state.startX;

    // 🔥 threshold 넘으면 그때부터 드래그 시작
    if (!state.isDragging && Math.abs(dx) > 8) {
        state.isDragging = true;
        state.hasMoved = true;
        contents.setPointerCapture(e.pointerId);
    }

    if (!state.isDragging) return;

    state.currentX = e.clientX;

    const containerWidth = contents.parentElement.clientWidth;

    let move = dx;

    if ((state.currentIndex === 0 && move > 0) ||
        (state.currentIndex === state.total - 1 && move < 0)) {
        move *= 0.3;
    }

    const base = -state.currentIndex * containerWidth;

    contents.style.transform = `translateX(${base + move}px)`;
});

function handlePointerEnd(e) {

    if (!state.isPointerDown) return;

    state.isPointerDown = false;

    if (!state.isDragging) return;

    contents.releasePointerCapture(e.pointerId);

    const dx = state.currentX - state.startX;
    const threshold = 80;

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