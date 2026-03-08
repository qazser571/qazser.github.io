const contentsInner = document.querySelector("#contents-inner");
const leftWindow = document.querySelector("#wse-left-window");
const rightWindow = document.querySelector("#wse-right-window");
const windowSep = document.querySelector("#window-sep");
const windowSepToggle = document.querySelector("#window-sep-toggle-switch");

const viewMatch = document.querySelector("#view-match");
const viewMatchGroup = document.querySelector("#view-match-btn-group");
const viewMatchLeft = document.querySelector("#view-match-btn-left");
const viewMatchRight = document.querySelector("#view-match-btn-right");

const sectSepr = document.querySelector("#sect-sepr");
const sectSeprGroup = document.querySelector("#sect-sepr-group");

const BREAKPOINT = 1260;
const SCROLL_DURATION = 200; // 0.2초 고정
const windowUnits = new WeakMap();
let splitClosedByResize = false;

windowSepToggle.classList.remove("active");

/* ===================== UNIT 생성 ===================== */

createDummyUnits(leftWindow, 200);
createDummyUnits(rightWindow, 200);

initAllWindow(leftWindow);
initAllWindow(rightWindow);

windowUnits.set(rightWindow, [...windowUnits.get(leftWindow)]);

/* ===================== SPLIT ===================== */

windowSepToggle.addEventListener("click", () => {
    if (windowSep.classList.contains("disabled")) return;
    windowSepToggle.classList.toggle("active");
    if (windowSepToggle.classList.contains("active")) openSplit();
    else closeSplit();
});

function openSplit() {
    contentsInner.classList.add("win-sep");
    rightWindow.classList.add("show");
    syncInputs(leftWindow, rightWindow);
    syncInputs(rightWindow, leftWindow);
}

function closeSplit() {
    rightWindow.classList.remove("show");
    contentsInner.classList.remove("win-sep");
    windowSepToggle.classList.remove("active");
}

/* ===================== INPUT SYNC ===================== */

function syncInputs(source, target) {
    source.addEventListener("input", e => {
        if (
            !e.target.classList.contains("word-spell-input") &&
            !e.target.classList.contains("word-phon-input") &&
            !e.target.classList.contains("word-mean-input")
        ) return;

        const units = windowUnits.get(source);
        const unit = e.target.closest(".word-unit-wrapper");
        const index = units.indexOf(unit);
        if (index === -1) return;

        const targetUnits = windowUnits.get(target);
        const targetUnit = targetUnits[index];
        if (!targetUnit) return;

        let selector = "";
        if (e.target.classList.contains("word-spell-input")) selector = ".word-spell-input";
        if (e.target.classList.contains("word-phon-input")) selector = ".word-phon-input";
        if (e.target.classList.contains("word-mean-input")) selector = ".word-mean-input";

        const targetInput = targetUnit.querySelector(selector);
        if (targetInput && targetInput.value !== e.target.value) {
            targetInput.value = e.target.value;
        }
    });
}

/* ===================== NUMBERING ===================== */

function getNumberDigits(total) {
    const minDigits = 4;
    const maxDigits = String(total).length;
    return Math.max(minDigits, maxDigits);
}

function updateNumbers(windowEl) {
    const units = windowUnits.get(windowEl);
    const digits = getNumberDigits(units.length);
    units.forEach((unit, i) => {
        const num = String(i + 1).padStart(digits, "0");
        unit.querySelector(".word-number").textContent = num;
        unit.dataset.index = i;
    });
}

function createDummyUnits(windowEl, count) {
    const wrapper = windowEl.querySelector(".wse-words-wrapper-inner");
    const digits = getNumberDigits(count);
    const units = [];
    for (let i = 1; i <= count; i++) {
        const num = String(i).padStart(digits, "0");
        const unit = document.createElement("div");
        unit.className = "word-unit-wrapper";
        unit.dataset.index = i - 1;
        unit.innerHTML = `
        <div class="word-unit">
            <div class="word-number">${num}</div>
            <div class="word-spell">
                <input class="word-spell-input" type="text" value="spell${i}">
            </div>
            <div class="word-phon">
                <input class="word-phon-input" type="text" value="[phon${i}]">
            </div>
            <div class="word-mean">
                <input class="word-mean-input" type="text" value="meaning ${i}">
            </div>
        </div>
        <div class="word-add-btn"><i class="fa-solid fa-plus"></i></div>
        `;
        wrapper.appendChild(unit);
        units.push(unit);
    }
    windowUnits.set(windowEl, units);
}

/* ===================== VIEW / SECT ===================== */

viewMatch.addEventListener("click", e => {
    if (!e.target.closest("#view-match")) return;
    viewMatchGroup.classList.toggle("active");
});

sectSepr.addEventListener("click", e => {
    if (!e.target.closest("#sect-sepr")) return;
    sectSeprGroup.classList.toggle("active");
});

/* ===================== SEARCH ===================== */

function initSearch(windowEl) {
    const input = windowEl.querySelector(".search-word-input");
    const clearBtn = windowEl.querySelector(".search-del-btn");
    const scopeBtn = windowEl.querySelector(".search-scope");
    let mode = "spell";
    if (scopeBtn) {
        scopeBtn.textContent = "단어";
        scopeBtn.addEventListener("click", () => {
            mode = mode === "spell" ? "mean" : "spell";
            scopeBtn.textContent = mode === "spell" ? "단어" : "의미";
            runSearch(windowEl, input.value, mode);
        });
    }
    input.addEventListener("input", () => runSearch(windowEl, input.value, mode));
    clearBtn.addEventListener("click", () => {
        input.value = "";
        runSearch(windowEl, "", mode);
    });
}

function runSearch(windowEl, keyword, mode) {
    const units = windowUnits.get(windowEl);
    const key = keyword.trim().toLowerCase();
    units.forEach(unit => {
        const spell = unit.querySelector(".word-spell-input");
        const mean = unit.querySelector(".word-mean-input");
        if (key === "") {
            unit.style.display = "";
            return;
        }
        let matched = false;
        if (mode === "spell") matched = spell.value.toLowerCase().includes(key);
        if (mode === "mean") matched = mean.value.toLowerCase().includes(key);
        unit.style.display = matched ? "" : "none";
    });
}

/* ===================== GOTO ===================== */

function initGoto(windowEl) {
    const input = windowEl.querySelector(".wse-gotonum-input");
    const btn = windowEl.querySelector(".wse-gotonum-arrow");
    const wrapper = windowEl.querySelector(".wse-words-wrapper-inner");

    function go() {
        const num = parseInt(input.value, 10);
        if (!num) return;
        const units = windowUnits.get(windowEl);
        const unit = units[num - 1];
        if (!unit) return;
        animateScrollToUnit(wrapper, unit, SCROLL_DURATION);
    }

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") go();
    });
    btn.addEventListener("click", go);
}

function animateScrollToUnit(container, unit, duration) {
    const start = container.scrollTop;
    const end = unit.offsetTop;
    const change = end - start;
    const startTime = performance.now();

    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        container.scrollTop = start + change * progress;
        if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}

/* ===================== VIEW MATCH ===================== */

viewMatchLeft.addEventListener("click", () => viewMatchSync("left"));
viewMatchRight.addEventListener("click", () => viewMatchSync("right"));

function viewMatchSync(direction) {
    if (!leftWindow.classList.contains("show") || !rightWindow.classList.contains("show")) return;
    const leftWrapper = leftWindow.querySelector(".wse-words-wrapper-inner");
    const rightWrapper = rightWindow.querySelector(".wse-words-wrapper-inner");

    if (direction === "left") animateScroll(rightWrapper, leftWrapper.scrollTop, SCROLL_DURATION);
    else animateScroll(leftWrapper, rightWrapper.scrollTop, SCROLL_DURATION);
}

function animateScroll(container, to, duration) {
    const start = container.scrollTop;
    const change = to - start;
    const startTime = performance.now();

    function step(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        container.scrollTop = start + change * progress;
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

/* ===================== SELECT DELETE ===================== */

function initSelectDelete(windowEl) {
    const btn = windowEl.querySelector(".select-delete");
    const wrapper = windowEl.querySelector(".wse-words-wrapper");
    let mode = false;

    btn.addEventListener("click", () => {
        if (!mode) {
            mode = true;
            wrapper.classList.add("select-mode");
            btn.classList.add("active");
            windowEl.querySelectorAll("input").forEach(i => i.readOnly = true);
        } else {
            const selected = windowEl.querySelectorAll(".word-unit-wrapper.selected");
            if (selected.length === 0) {
                alert("선택된 단어가 없습니다.");
                exit();
                return;
            }
            if (!confirm("선택한 단어를 삭제하시겠습니까?")) return;

            selected.forEach(u => {
                [leftWindow, rightWindow].forEach(win => {
                    const units = windowUnits.get(win);
                    const index = units.indexOf(u);
                    if (index !== -1) {
                        units[index].remove();
                        units.splice(index, 1);
                        updateNumbers(win);
                    }
                });
            });

            exit();
        }
    });

    wrapper.addEventListener("click", e => {
        if (!mode) return;
        const unit = e.target.closest(".word-unit-wrapper");
        if (!unit) return;
        unit.classList.toggle("selected");
    });

    function exit() {
        mode = false;
        wrapper.classList.remove("select-mode");
        btn.classList.remove("active");
        windowEl.querySelectorAll("input").forEach(i => i.readOnly = false);
        windowEl.querySelectorAll(".selected").forEach(u => u.classList.remove("selected"));
    }
}

/* ===================== ADD ===================== */

function initAddBtn(windowEl) {
    const inner = windowEl.querySelector(".wse-words-wrapper-inner");
    inner.addEventListener("click", e => {
        const btn = e.target.closest(".word-add-btn");
        if (!btn) return;
        const unit = btn.closest(".word-unit-wrapper");

        [leftWindow, rightWindow].forEach(win => {
            const units = windowUnits.get(win);
            const index = units.indexOf(unit);
            const newUnit = unit.cloneNode(true);
            newUnit.querySelectorAll("input").forEach(i => i.value = "");
            unit.after(newUnit);
            units.splice(index + 1, 0, newUnit);
            updateNumbers(win);
        });
    });
}

/* ===================== INITIALIZATION ===================== */

function initAllWindow(windowEl) {
    initSearch(windowEl);
    initGoto(windowEl);
    initSelectDelete(windowEl);
    initAddBtn(windowEl);
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

// ===================== INITIAL SPLIT STATE =====================
if (!windowSep.classList.contains("disabled") && windowSepToggle.classList.contains("active")) {
    openSplit();
}