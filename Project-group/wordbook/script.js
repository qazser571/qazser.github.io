/* =================================
   DOM 요소
================================= */
const appContainer = document.getElementById("appContainer");

const loadButton = document.getElementById("loadButton");
const viewButton = document.getElementById("viewButton");
const downloadButton = document.getElementById("downloadButton");

const fileInput = document.getElementById("fileInput");

const wordCount = document.getElementById("wordCount");
const statusMessage = document.getElementById("statusMessage");

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
   새로 불러온 단어는 상태를 항상 0으로 초기화
================================= */
function saveWords(newWords, fileName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            [WORD_STORE, META_STORE],
            "readwrite"
        );

        const wordStore = transaction.objectStore(WORD_STORE);
        const metaStore = transaction.objectStore(META_STORE);

        wordStore.clear();

        newWords.forEach(word => {
            wordStore.add({
                english: word.english,
                korean: word.korean,
                status: 0
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
   기존 데이터에 status가 없다면 0으로 처리
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
            const savedWords = request.result.map(word => ({
                ...word,
                status: word.status === 1 ? 1 : 0
            }));

            resolve(savedWords);
        };

        request.onerror = function() {
            reject(request.error);
        };
    });
}

/* =================================
   단어 상태를 IndexedDB에 저장
================================= */
function updateWordStatus(wordId, newStatus) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            WORD_STORE,
            "readwrite"
        );

        const store = transaction.objectStore(WORD_STORE);
        const request = store.get(wordId);

        request.onsuccess = function() {
            const word = request.result;

            if (!word) {
                reject(new Error("해당 단어를 찾을 수 없습니다."));
                return;
            }

            word.status = newStatus;
            store.put(word);
        };

        request.onerror = function() {
            reject(request.error);
        };

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
   TXT 파일 분석
   입력 파일의 상태 숫자는 읽지 않고,
   단어 상태는 항상 0으로 초기화
================================= */
function parseTextFile(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

    const result = [];
    const errors = [];

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
            return;
        }

        let separatorIndex = -1;
        let usedSeparator = "";

        for (const separator of SEPARATORS) {
            const foundIndex = trimmedLine.indexOf(separator);

            if (foundIndex !== -1) {
                separatorIndex = foundIndex;
                usedSeparator = separator;
                break;
            }
        }

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
            korean: korean,
            status: 0
        });
    });

    return {
        words: result,
        errors: errors
    };
}

/* =================================
   단어 개수 및 버튼 상태 업데이트
================================= */
function updateWordCount() {
    wordCount.textContent = words.length;
    popupWordCount.textContent = words.length + "개";
    downloadButton.disabled = words.length === 0;
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
            "기존에 저장된 단어는 새로운 단어로 교체됩니다.\n" +
            "불러온 단어의 상태는 모두 0으로 초기화됩니다.";

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
        fileInput.value = "";
    }
});

/* =================================
   단어 상태 버튼 표시 업데이트
================================= */
function updateStatusButton(button, status) {
    if (status === 1) {
        button.classList.add("is-completed");
        button.textContent = "✓";
        button.title = "상태 1: 다시 누르면 0으로 변경";
        button.setAttribute("aria-label", "상태 1. 누르면 상태 0으로 변경");
        button.setAttribute("aria-pressed", "true");
    } else {
        button.classList.remove("is-completed");
        button.textContent = "○";
        button.title = "상태 0: 누르면 1로 변경";
        button.setAttribute("aria-label", "상태 0. 누르면 상태 1로 변경");
        button.setAttribute("aria-pressed", "false");
    }
}

/* =================================
   단어 상태 토글 버튼 생성
================================= */
function createStatusButton(word) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "word-status-button";

    updateStatusButton(button, word.status);

    button.addEventListener("click", async function() {
        const newStatus = word.status === 1 ? 0 : 1;

        button.disabled = true;

        try {
            await updateWordStatus(word.id, newStatus);

            word.status = newStatus;
            updateStatusButton(button, newStatus);

            statusMessage.textContent =
                "'" + word.english + "' 단어의 상태를 " +
                newStatus + "로 변경하고 저장했습니다.";
        } catch (error) {
            console.error(error);
            alert("단어 상태를 저장하지 못했습니다.");
        } finally {
            button.disabled = false;
        }
    });

    return button;
}

/* =================================
   단어 목록 표시
================================= */
function renderWords() {
    wordList.replaceChildren();

    if (words.length === 0) {
        const emptyMessage = document.createElement("div");

        emptyMessage.className = "empty-message";
        emptyMessage.textContent = "저장된 단어가 없습니다.";

        wordList.appendChild(emptyMessage);
        return;
    }

    const fragment = document.createDocumentFragment();

    words.forEach(word => {
        const item = document.createElement("article");
        item.className = "word-item";

        const content = document.createElement("div");
        content.className = "word-content";

        const english = document.createElement("div");
        english.className = "word-english";
        english.textContent = word.english;

        const korean = document.createElement("div");
        korean.className = "word-korean";
        korean.textContent = word.korean;

        const statusButton = createStatusButton(word);

        content.appendChild(english);
        content.appendChild(korean);

        item.appendChild(content);
        item.appendChild(statusButton);

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
    wordList.scrollTop = 0;
});

/* =================================
   TXT 파일 다운로드
   원본 형식:
   english<$#?상태!#$>korean
================================= */
function createTextBlob() {
    const lines = words.map(word => {
        const status = word.status === 1 ? 1 : 0;

        return (
            word.english +
            "<$#?" + status + "!#$>" +
            word.korean
        );
    });

    const text = "\uFEFF" + lines.join("\r\n");

    return new Blob(
        [text],
        { type: "text/plain;charset=utf-8" }
    );
}

function createDownloadFileName() {
    const date = new Date();

    const dateString =
        date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0");

    return "영어단어장_" + dateString + ".txt";
}

/*
 * File System Access API를 지원하는 브라우저에서는
 * 저장 대화상자를 열고 Downloads 폴더를 시작 위치로 요청한다.
 *
 * 지원하지 않는 브라우저에서는 일반 다운로드로 대체한다.
 * 일반 다운로드의 저장 위치는 브라우저 설정을 따른다.
 */
async function downloadWordsAsText() {
    if (words.length === 0) {
        alert("저장할 단어가 없습니다.");
        return;
    }

    const blob = createTextBlob();
    const fileName = createDownloadFileName();

    try {
        if ("showSaveFilePicker" in window) {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: fileName,
                startIn: "downloads",
                types: [
                    {
                        description: "텍스트 파일",
                        accept: {
                            "text/plain": [".txt"]
                        }
                    }
                ]
            });

            const writable = await fileHandle.createWritable();

            await writable.write(blob);
            await writable.close();

            statusMessage.textContent =
                "TXT 파일을 선택한 위치에 저장했습니다.";

            return;
        }

        // File System Access API 미지원 브라우저용 대체 방식
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        statusMessage.textContent =
            "TXT 파일 다운로드를 시작했습니다. 저장 위치는 브라우저의 다운로드 설정을 따릅니다.";

        alert(
            "현재 브라우저는 저장 위치 선택 기능을 지원하지 않습니다.\n" +
            "파일은 브라우저의 기본 다운로드 폴더에 저장됩니다."
        );
    } catch (error) {
        if (error.name === "AbortError") {
            statusMessage.textContent = "파일 저장을 취소했습니다.";
            return;
        }

        console.error(error);
        alert("TXT 파일을 저장하는 중 오류가 발생했습니다.");
    }
}

downloadButton.addEventListener("click", downloadWordsAsText);

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
