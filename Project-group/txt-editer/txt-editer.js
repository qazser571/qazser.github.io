document.addEventListener("DOMContentLoaded", () => {

    const loadButton = document.getElementById("file-load");
    const saveButton = document.getElementById("file-save");
    const inputField = document.querySelector("#contents input");

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
            inputField.value = e.target.result;
        };

        reader.readAsText(file);
    });

    saveButton.addEventListener("click", async () => {

        const textContent = inputField.value;
        const blob = new Blob([textContent], { type: "text/plain" });

        // 최신 브라우저: 실제 "다른 이름으로 저장" 창
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
            // 지원 안하는 브라우저 fallback
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