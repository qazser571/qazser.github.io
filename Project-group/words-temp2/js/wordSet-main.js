document.addEventListener("DOMContentLoaded", async () => {

    /* =============================
        DATABASE
    ============================= */

    const DB_NAME = "wordSetDB";
    const DB_VERSION = 1;

    let db;

    const dbRequest = indexedDB.open(DB_NAME, DB_VERSION);

    dbRequest.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("sets")) db.createObjectStore("sets", { keyPath: "id" });
    };

    dbRequest.onsuccess = (e) => {
        db = e.target.result;
        loadSetData();
    };


    /* =============================
        STATE
    ============================= */

    const state = {
        sectionSize: 12,
        searchText: "",
        viewMean: true,
        currentSet: null
    };


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
    const sectSeprGroup = document.getElementById("sect-sepr-group");
    const sectSeprSetup = document.getElementById("sect-sepr-setup");
    const sectSeprWhole = document.getElementById("sect-sepr-whole");
    const sectSeprInput = document.getElementById("sect-sepr-input");
    const editBtn = document.getElementById("word-set-edit-btn");


    /* =============================
        LOAD DATA
    ============================= */

    async function loadSetData() {

        const tx = db.transaction("sets", "readonly");
        const store = tx.objectStore("sets");
        const request = store.get("sample-set");

        request.onsuccess = () => {

            if (!request.result) {
                const sample = generateSampleData();
                saveSet(sample);
                state.currentSet = sample;
            } else {
                state.currentSet = request.result;
            }

            renderSections();
        };
    }


    function saveSet(setData) {
        const tx = db.transaction("sets", "readwrite");
        tx.objectStore("sets").put(setData);
    }


    /* =============================
        SAMPLE DATA
    ============================= */

    function generateSampleData() {

        const words = [];

        for (let i = 1; i <= 200; i++) {
            words.push({
                id: i,
                spell: "word" + i,
                phon: "[phon]",
                mean: "의미 " + i,
                section: Math.floor((i - 1) / state.sectionSize) + 1
            });
        }

        return {
            id: "sample-set",
            name: "샘플 세트",
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

        words.forEach(word => {
            if (!sectionMap[word.section]) sectionMap[word.section] = [];
            sectionMap[word.section].push(word);
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
        }
    }


    function createSectionElement(sectionNum, words, searchText) {

        const wrapper = document.createElement("div");
        wrapper.className = "words-sect";

        const header = document.createElement("div");
        header.className = "words-sect-header";

        header.innerHTML = `
            <div class="words-sect-header-inner">
                <div class="sect-num">${sectionNum}구간</div>
                <div class="words-range">
                    ${words[0].id.toString().padStart(4, "0")}
                    -
                    ${words[words.length - 1].id.toString().padStart(4, "0")}
                </div>
            </div>
        `;

        const group = document.createElement("div");
        group.className = "sect-words-group";

        words.forEach(word => {
            group.appendChild(createWordElement(word, searchText));
        });

        header.addEventListener("click", () => {
            wrapper.classList.toggle("open");
        });

        wrapper.appendChild(header);
        wrapper.appendChild(group);

        return wrapper;
    }


    function createWordElement(word, searchText) {

        const unit = document.createElement("div");

        unit.className = "word-unit";
        unit.dataset.wordId = word.id;

        let spell = word.spell;

        if (searchText && spell.toLowerCase().includes(searchText)) {
            const regex = new RegExp(`(${searchText})`, "gi");
            spell = spell.replace(regex, `<span class="search-highlight">$1</span>`);
        }

        unit.innerHTML = `
            <div class="whet-know"></div>
            <div class="word-spell">${spell}</div>
            <div class="word-phon">${word.phon}</div>
            <div class="word-mean">${word.mean}</div>
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


    searchInput.addEventListener("input", debounce(e => {
        state.searchText = e.target.value;
        renderSections();
    }, 150));


    searchDelBtn.addEventListener("click", () => {
        searchInput.value = "";
        state.searchText = "";
        renderSections();
    });


    /* =============================
        CUSTOM SCROLL (0.2s)
    ============================= */

    function smoothScrollTo(container, targetY, duration = 200) {

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

            smoothScrollTo(wordsSectScrollArea, y, 200);
        }
    }


    gotoArrow.addEventListener("click", gotoNumber);

    gotoInput.addEventListener("keydown", e => {
        if (e.key === "Enter") gotoNumber();
    });


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
        state.sectionSize = 0;
        renderSections();
        sectSeprGroup.classList.remove("active");
    });


    sectSeprSetup.addEventListener("click", () => {

        const num = parseInt(sectSeprInput.value);

        if (!num || num <= 0) {
            alert("숫자를 입력하세요");
            return;
        }

        state.sectionSize = num;
        renderSections();
        sectSeprGroup.classList.remove("active");
    });


    /* =============================
        EDIT PAGE
    ============================= */

    editBtn?.addEventListener("click", () => {
        if (!state.currentSet) return;
        location.href = `wordSet-edit.html?id=${state.currentSet.id}`;
    });


    /* =============================
        BACK TO LIST
    ============================= */

    document.getElementById("go-set-list")?.addEventListener("click", () => {
        location.href = "wordSet-list.html";
    });

});