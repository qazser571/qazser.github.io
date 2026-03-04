document.addEventListener("DOMContentLoaded", () => {

    const loadButton = document.getElementById("file-load");
    const saveButton = document.getElementById("file-save");
    const textField = document.querySelector("#contents textarea");

    const STORAGE_KEY = "txt-editor-content";

    /* ---------------- 로컬스토리지 불러오기 ---------------- */
    const savedContent = localStorage.getItem(STORAGE_KEY);
    if (savedContent !== null) {
        textField.value = savedContent;
    }

    /* ---------------- 입력할 때마다 자동 저장 ---------------- */
    textField.addEventListener("input", () => {
        localStorage.setItem(STORAGE_KEY, textField.value);
    });

    /* ---------------- 파일 업로드 ---------------- */
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".txt";

    loadButton.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            textField.value = e.target.result;

            // 파일 불러오면 로컬스토리지에도 저장
            localStorage.setItem(STORAGE_KEY, textField.value);
        };

        reader.readAsText(file);
    });

    /* ---------------- 다른 이름으로 저장 ---------------- */
    saveButton.addEventListener("click", async () => {

        const textContent = textField.value;
        const blob = new Blob([textContent], { type: "text/plain" });

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: "text-file.txt",
                    types: [
                        {
                            description: "Text Files",
                            accept: { "text/plain": [".txt"] }
                        }
                    ]
                });

                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();

            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error(err);
                }
            }
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "text-file.txt";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

    });

});
