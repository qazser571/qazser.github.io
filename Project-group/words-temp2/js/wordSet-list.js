import {
    loadSets,
    createSet,
    deleteSet,
    formatDate
} from "./storage.js";


document.addEventListener("DOMContentLoaded", () => {

    const state = {
        sets: loadSets(),
        searchKeyword: ""
    };


    const scrollInner = document.getElementById("word-set-scroll-inner");
    const searchBox = document.getElementById("search-box");
    const searchDelBtn = document.getElementById("search-del-btn");
    const createBtn = document.getElementById("set-create-btn");
    const dataSaveBtn = document.getElementById("data-save");
    const dataLoadBtn = document.getElementById("data-load");


    function render() {
        scrollInner.innerHTML = "";

        const filtered = state.sets.filter(set =>
            set.name.toLowerCase().includes(state.searchKeyword.toLowerCase())
        );

        if (filtered.length === 0) {
            scrollInner.innerHTML = `<div style="padding:20px;color:#777;">세트가 없습니다.</div>`;
            return;
        }

        filtered.forEach(set => {

            const div = document.createElement("div");
            div.className = "word-set-unit";

            div.innerHTML = `
                <div class="word-set-name">
                    <span>${set.name}</span>
                </div>
                <div class="word-set-info">
                    <div class="word-set-words-count">
                        단어 : ${set.words.length}
                    </div>
                    <div class="word-set-study-date">
                        학습 : ${getLastStudyText(set)}
                    </div>
                </div>
            `;

            div.addEventListener("click", () => {
                location.href = `wordSet-main.html?id=${set.id}`;
            });

            scrollInner.appendChild(div);
        });
    }


    function getLastStudyText(set) {
        if (!set.words.length) return "----.--.--";

        const dates = set.words
            .map(w => w.lastStudyDate)
            .filter(d => d);

        if (!dates.length) return "----.--.--";

        const latest = dates.sort().reverse()[0];

        return formatDate(latest);
    }


    searchBox.addEventListener("input", e => {
        state.searchKeyword = e.target.value;
        render();
    });


    searchDelBtn.addEventListener("click", () => {
        searchBox.value = "";
        state.searchKeyword = "";
        render();
    });


    createBtn.addEventListener("click", () => {

        const name = prompt("세트 이름을 입력하세요");
        if (!name) return;

        const sets = loadSets();

        const newSet = {
            id: crypto.randomUUID(),
            name,
            words: [],
            sectionSize: 10,
            showMeaning: true,
            splitMode: false,
            lastModifiedDate: new Date().toISOString()
        };

        sets.push(newSet);

        state.sets = sets;
        createSet(name);
        render();
    });


    dataSaveBtn.addEventListener("click", () => {

        const dataStr = JSON.stringify(state.sets, null, 2);

        const blob = new Blob([dataStr], {
            type: "application/json"
        });

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "wordSets.json";
        a.click();

        URL.revokeObjectURL(url);
    });


    dataLoadBtn.addEventListener("click", () => {

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";

        input.onchange = e => {

            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = ev => {

                try {

                    const parsed = JSON.parse(ev.target.result);

                    if (!Array.isArray(parsed)) {
                        alert("잘못된 데이터 형식입니다.");
                        return;
                    }

                    state.sets = parsed;
                    localStorage.setItem("word_sets", JSON.stringify(parsed));

                    render();

                } catch {
                    alert("JSON 파일 오류");
                }
            };

            reader.readAsText(file);
        };

        input.click();
    });


    render();

});