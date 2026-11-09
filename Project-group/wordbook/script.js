/* =================================
   DOM 요소
================================= */

const appContainer = document.getElementById("appContainer");

const loadButton = document.getElementById("loadButton");
const viewButton = document.getElementById("viewButton");

const fileInput = document.getElementById("fileInput");

const wordCount = document.getElementById("wordCount");
const statusMessage = document.getElementById("statusMessage");

const wordPopup = document.getElementById("wordPopup");
const wordList = document.getElementById("wordList");

const popupWordCount = document.getElementById("popupWordCount");

const closeButton = document.getElementById("closeButton");
const popupCloseButton = document.getElementById("popupCloseButton");


/* =================================
   기본 설정
================================= */

const DB_NAME = "EnglishWordBook";
const DB_VERSION = 1;

const WORD_STORE = "words";
const META_STORE = "metadata";

const SEPARATORS = [
    "<$#?1!#$>",
    "<$#?0!#$>"
];

let db = null;
let words = [];


/* =================================
   IndexedDB 초기화
================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {

            const database = event.target.result;

            if (!database.objectStoreNames.contains(WORD_STORE)) {

                database.createObjectStore(WORD_STORE, {
                    keyPath: "id",
                    autoIncrement: true
                });

            }

            if (!database.objectStoreNames.contains(META_STORE)) {

                database.createObjectStore(META_STORE, {
                    keyPath: "key"
                });

            }

        };

        request.onsuccess = function(event) {

            resolve(event.target.result);

        };

        request.onerror = function() {

            reject(request.error);

        };

    });

}


/* =================================
   IndexedDB에 단어 저장
================================= */

function saveWords(newWords, fileName) {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            [WORD_STORE, META_STORE],
            "readwrite"
        );

        const wordStore = transaction.objectStore(WORD_STORE);
        const metaStore = transaction.objectStore(META_STORE);

        // 기존 단어 삭제 후 새로운 단어 저장
        wordStore.clear();

        newWords.forEach(word => {

            wordStore.add({
                english: word.english,
                korean: word.korean
            });

        });

        metaStore.put({
            key: "lastImport",
            fileName: fileName,
            wordCount: newWords.length,
            importedAt: new Date().toISOString()
        });

        transaction.oncomplete = function() {

            resolve();

        };

        transaction.onerror = function() {

            reject(transaction.error);

        };

        transaction.onabort = function() {

            reject(transaction.error);

        };

    });

}


/* =================================
   IndexedDB에서 단어 불러오기
================================= */

function getSavedWords() {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            WORD_STORE,
            "readonly"
        );

        const store = transaction.objectStore(WORD_STORE);

        const request = store.getAll();

        request.onsuccess = function() {

            resolve(request.result);

        };

        request.onerror = function() {

            reject(request.error);

        };

    });

}


/* =================================
   TXT 파일 분석
================================= */

function parseTextFile(text) {

    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

    const result = [];
    const errors = [];

    lines.forEach((line, index) => {

        const trimmedLine = line.trim();

        // 빈 줄 무시
        if (!trimmedLine) {
            return;
        }

        // 두 가지 구분자 중 하나 검색
        let separatorIndex = -1;
        let usedSeparator = "";

        for (const separator of SEPARATORS) {

            const index = trimmedLine.indexOf(separator);

            if (index !== -1) {

                separatorIndex = index;
                usedSeparator = separator;

                break;

            }

        }

        // 구분자가 없는 경우
        if (separatorIndex === -1) {

            errors.push(index + 1);

            return;

        }

        const english = trimmedLine
            .slice(0, separatorIndex)
            .trim();

        const korean = trimmedLine
            .slice(separatorIndex + usedSeparator.length)
            .trim();

        if (!english || !korean) {

            errors.push(index + 1);

            return;

        }

        result.push({
            english: english,
            korean: korean
        });

    });

    return {
        words: result,
        errors: errors
    };

}


/* =================================
   단어 개수 업데이트
================================= */

function updateWordCount() {

    wordCount.textContent = words.length;

    popupWordCount.textContent = words.length + "개";

}


/* =================================
   단어 불러오기 버튼
================================= */

loadButton.addEventListener("click", function() {

    fileInput.click();

});


/* =================================
   파일 선택
================================= */

fileInput.addEventListener("change", async function(event) {

    const file = event.target.files[0];

    if (!file) {
        return;
    }

    try {

        const text = await file.text();

        const parsed = parseTextFile(text);

        if (parsed.words.length === 0) {

            alert(
                "불러올 수 있는 단어가 없습니다.\n" +
                "TXT 파일의 형식을 확인해 주세요."
            );

            return;

        }

        const confirmMessage =
            "총 " + parsed.words.length + "개의 단어를 불러옵니다.\n\n" +
            "기존에 저장된 단어는 새로운 단어로 교체됩니다.";

        if (!confirm(confirmMessage)) {
            return;
        }

        await saveWords(parsed.words, file.name);

        words = await getSavedWords();

        updateWordCount();

        let message =
            parsed.words.length + "개의 단어를 저장했습니다.";

        if (parsed.errors.length > 0) {

            message +=
                "\n형식이 올바르지 않은 줄: " +
                parsed.errors.length + "개";

            console.warn(
                "읽지 못한 줄 번호:",
                parsed.errors
            );

        }

        statusMessage.textContent =
            parsed.words.length + "개의 단어를 불러왔습니다.";

        if (parsed.errors.length > 0) {
            alert(message);
        }

    } catch (error) {

        console.error(error);

        alert("파일을 불러오는 중 오류가 발생했습니다.");

    } finally {

        // 동일한 파일을 다시 선택할 수 있도록 초기화
        fileInput.value = "";

    }

});


/* =================================
   단어 목록 표시
================================= */

function renderWords() {

    wordList.replaceChildren();

    if (words.length === 0) {

        const emptyMessage = document.createElement("div");

        emptyMessage.className = "empty-message";

        emptyMessage.textContent =
            "저장된 단어가 없습니다.";

        wordList.appendChild(emptyMessage);

        return;

    }

    const fragment = document.createDocumentFragment();

    words.forEach((word, index) => {

        const item = document.createElement("article");

        item.className = "word-item";

        const english = document.createElement("div");

        english.className = "word-english";

        english.textContent = word.english;

        const korean = document.createElement("div");

        korean.className = "word-korean";

        korean.textContent = word.korean;

        item.appendChild(english);
        item.appendChild(korean);

        fragment.appendChild(item);

    });

    wordList.appendChild(fragment);

}


/* =================================
   단어 보기 버튼
================================= */

viewButton.addEventListener("click", function() {

    renderWords();

    updateWordCount();

    appContainer.classList.add("is-viewing");

    // 팝업을 열 때 스크롤을 맨 위로 이동
    wordList.scrollTop = 0;

});


/* =================================
   단어장 닫기
================================= */

function closeWordPopup() {

    appContainer.classList.remove("is-viewing");

}


closeButton.addEventListener("click", closeWordPopup);

popupCloseButton.addEventListener("click", closeWordPopup);


/* =================================
   ESC 키로 닫기
================================= */

document.addEventListener("keydown", function(event) {

    if (
        event.key === "Escape" &&
        appContainer.classList.contains("is-viewing")
    ) {

        closeWordPopup();

    }

});


/* =================================
   프로그램 시작
================================= */

async function initializeApp() {

    try {

        db = await openDatabase();

        words = await getSavedWords();

        updateWordCount();

        if (words.length > 0) {

            statusMessage.textContent =
                "저장된 단어 " + words.length + "개를 불러왔습니다.";

        }

    } catch (error) {

        console.error(error);

        statusMessage.textContent =
            "데이터베이스를 불러오지 못했습니다.";

        alert(
            "IndexedDB 초기화에 실패했습니다.\n" +
            "브라우저의 저장소 설정을 확인해 주세요."
        );

    }

}


initializeApp();