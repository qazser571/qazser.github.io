// [0] : "unit에 표시될 이름" | [1] : "자신폴더/이름.html"   // 단 모든 project는 Project group 폴더에 삽입
const unitsList = [
    ["words", "words/firlog/firlog.html"],
    ["스케줄", "schedule/main.html"],
    ["코돈추론", "codon/main.html"],
    ["코돈 test", "tempt/test.html"],
    ["일괄 줄바꿈 도구", "change line/change line.html"],
    ["Viewport 측정", "viewport measure/viewport.html"]
];
const ProjectGroupAbsolutePath = "/Project-group/"; //폴더명에 공백있으면 열때 404


const contentsInner = document.getElementById("contents-inner");
unitsList.forEach(([text, url]) => {
    const unit = document.createElement("button");
    unit.classList.add("unit");
    unit.textContent = text;
    unit.type = "button";
    unit.addEventListener("click", () => {
        window.open(ProjectGroupAbsolutePath+url, "_blank");
    });
    contentsInner.appendChild(unit);
});


const search = document.getElementById("search-txt");
const units = document.querySelectorAll(".unit");
search.addEventListener("input", function () {
    const value = search.value.toLowerCase();

    units.forEach(unit => {
        const unitName = unit.textContent.toLowerCase();

        if (unitName.includes(value)) {
            unit.classList.remove("hidden");
        } else {
            unit.classList.add("hidden");
        }
    });
});
