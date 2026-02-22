const inputText = document.getElementById("inputText");
const previewText = document.getElementById("previewText");
const cleanOption = document.getElementById("cleanOption");
const copyButton = document.getElementById("copyButton");

let userModified = false;

function processText() {
    let text = inputText.value;

    if (cleanOption.checked) {
        text = text.replace(/\s+/g, " ");
        text = text.replace(/\n+/g, "\n");
    }

    text = text.split(".")
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 0)
        .join(".\n");

    if (text.length > 0 && !text.endsWith(".")) {
        text += "";
    }

    return text;
}

function updatePreview() {
    const processed = processText();
    previewText.value = processed;
}

inputText.addEventListener("input", () => {
    userModified = false;
    updatePreview();
});

previewText.addEventListener("input", () => {
    userModified = true;
});

cleanOption.addEventListener("change", () => {
    if (userModified) {
        const confirmReset = confirm("텍스트를 수정한 내역이 초기화되며 복구 불가능합니다. 진행하시겠습니까?");
        if (!confirmReset) {
            cleanOption.checked = !cleanOption.checked;
            return;
        }
        userModified = false;
    }
    updatePreview();
});

copyButton.addEventListener("click", () => {
    navigator.clipboard.writeText(previewText.value)
        .then(() => {
            alert("복사되었습니다.");
        })
        .catch(() => {
            alert("복사에 실패했습니다.");
        });
});