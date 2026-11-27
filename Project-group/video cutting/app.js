import { FFmpeg } from "./lib/ffmpeg/index.js";
import { toBlobURL } from "./lib/util/index.js";

const $ = (id) => document.getElementById(id);

const video = $("video");
const timeline = $("timeline");
const cutLayer = $("cutLayer");
const playhead = $("playhead");

const modal = $("selectionModal");
const modalSegmentLayer = $("modalSegmentLayer");
const modalPlayhead = $("modalPlayhead");

let sourceFile = null;
let sourceUrl = null;
let duration = 0;

let fps = 30;

let cutPoints = [];
let focusedCutId = null;
let timelineFocused = true;

let segments = [];
let selectedSegmentOrder = [];

let ffmpeg = null;
let exporting = false;

let previewing = false;
let previewSegment = null;

let currentMode = "edit";

/* 재생 위치 드래그 상태 */

let draggingPlayhead = false;
let wasPlayingBeforeDrag = false;
let ignoreNextTimelineClick = false;
let suppressNextCutMarkerClick = false;

/* --------------------------------------------------
   기본 유틸리티
-------------------------------------------------- */

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) seconds = 0;

    seconds = Math.max(0, seconds);

    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatTimeInput(seconds) {
    if (!Number.isFinite(seconds)) seconds = 0;

    seconds = Math.max(0, seconds);

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const wholeSeconds = Math.floor(remainingSeconds);
    const milliseconds = Math.round((remainingSeconds - wholeSeconds) * 1000);

    const secondText = String(wholeSeconds).padStart(2, "0");

    const formattedSeconds = milliseconds > 0
        ? `${secondText}.${String(milliseconds).padStart(3, "0")}`
        : secondText;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${formattedSeconds}`;
    }

    return `${String(minutes).padStart(2, "0")}:${formattedSeconds}`;
}

function parseTimeInput(value) {
    const parts = value.trim().split(":");

    if (parts.length !== 2 && parts.length !== 3) {
        return null;
    }

    const numbers = parts.map(Number);

    if (numbers.some((number) => !Number.isFinite(number) || number < 0)) {
        return null;
    }

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 2) {
        [minutes, seconds] = numbers;
    } else {
        [hours, minutes, seconds] = numbers;
    }

    if (minutes >= 60 || seconds >= 60) {
        return null;
    }

    return hours * 3600 + minutes * 60 + seconds;
}

function frameToTime(frame) {
    return frame / fps;
}

function timeToFrame(seconds) {
    return Math.max(0, Math.round(seconds * fps));
}

function frameStep(seconds) {
    return Math.max(1, Math.round(seconds * fps));
}

function toPercent(seconds) {
    if (!duration) return 0;

    return clamp((seconds / duration) * 100, 0, 100);
}

function getSortedCutPoints() {
    return [...cutPoints].sort((a, b) => a.frame - b.frame);
}

function getCurrentTimeDisplay() {
    return `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
}

/* --------------------------------------------------
   구간 재구성
-------------------------------------------------- */

function rebuildSegments() {
    const sortedCuts = getSortedCutPoints();

    const boundaries = [
        0,
        ...sortedCuts.map((cut) => frameToTime(cut.frame)),
        duration
    ];

    segments = [];

    for (let index = 0; index < boundaries.length - 1; index++) {
        const start = boundaries[index];
        const end = boundaries[index + 1];

        if (end > start) {
            segments.push({
                id: index,
                start,
                end
            });
        }
    }

    if (currentMode === "select") {
        renderSegments();
    }
}

/* --------------------------------------------------
   메인 타임라인
-------------------------------------------------- */

function renderTimeline() {
    if (!duration) return;

    playhead.style.left = `${toPercent(video.currentTime)}%`;

    $("timeDisplay").textContent = getCurrentTimeDisplay();

    renderCutPoints();
    renderPlayheadFocus();
}

function renderPlayheadFocus() {
    playhead.classList.toggle("focused", timelineFocused);
}

function renderCutPoints() {
    cutLayer.innerHTML = "";

    getSortedCutPoints().forEach((cut, index) => {
        const marker = document.createElement("div");
        const label = document.createElement("span");

        marker.className = "cut-marker";

        if (focusedCutId === cut.id) {
            marker.classList.add("focused");
        }

        marker.style.left = `${toPercent(frameToTime(cut.frame))}%`;

        marker.title =
            `컷팅 지점 ${index + 1}: ${formatTimeInput(frameToTime(cut.frame))}`;

        label.textContent = formatTime(frameToTime(cut.frame));

        marker.append(label);

        marker.addEventListener("click", (event) => {
            event.stopPropagation();

            if (suppressNextCutMarkerClick) {
                suppressNextCutMarkerClick = false;
                return;
            }

            focusedCutId = cut.id;
            timelineFocused = false;

            video.pause();
            video.currentTime = frameToTime(cut.frame);

            renderTimeline();
        });

        cutLayer.append(marker);
    });

    updateCutEditor();
}

/* --------------------------------------------------
   컷팅 지점 편집 UI
-------------------------------------------------- */

function updateCutEditor() {
    const focusedCut = cutPoints.find((cut) => cut.id === focusedCutId);

    $("cutTimeInput").value = focusedCut
        ? formatTimeInput(frameToTime(focusedCut.frame))
        : "";

    $("cutSelectionInfo").textContent = focusedCut
        ? `선택 지점: ${formatTimeInput(frameToTime(focusedCut.frame))} · ${focusedCut.frame} frame`
        : "선택된 컷팅 지점 없음";

    $("cutList").innerHTML = "";

    getSortedCutPoints().forEach((cut, index) => {
        const button = document.createElement("button");

        button.className = "cut-chip";

        if (focusedCutId === cut.id) {
            button.classList.add("active");
        }

        button.textContent =
            `${index + 1} · ${formatTimeInput(frameToTime(cut.frame))}`;

        button.addEventListener("click", () => {
            focusedCutId = cut.id;
            timelineFocused = false;

            video.pause();
            video.currentTime = frameToTime(cut.frame);

            renderTimeline();
        });

        $("cutList").append(button);
    });
}

/* --------------------------------------------------
   컷팅 지점 추가 / 이동 / 삭제
-------------------------------------------------- */

function addCutPoint(time = video.currentTime) {
    if (!duration) return;

    const frame = timeToFrame(time);
    const lastFrame = timeToFrame(duration);

    if (frame <= 0 || frame >= lastFrame) {
        $("statusMessage").textContent =
            "동영상의 시작과 끝에는 컷팅 지점을 추가할 수 없습니다.";
        return;
    }

    if (cutPoints.some((cut) => cut.frame === frame)) {
        $("statusMessage").textContent =
            "이미 해당 프레임에 컷팅 지점이 있습니다.";
        return;
    }

    const id = crypto.randomUUID();

    cutPoints.push({ id, frame });

    focusedCutId = id;
    timelineFocused = false;

    rebuildSegments();
    renderTimeline();

    video.pause();

    $("statusMessage").textContent = "컷팅 지점을 추가했습니다.";
}

function moveCutPoint(cutId, newFrame) {
    const cut = cutPoints.find((item) => item.id === cutId);

    if (!cut) return;

    const lastFrame = Math.max(1, timeToFrame(duration) - 1);

    const targetFrame = clamp(newFrame, 1, lastFrame);

    const collision = cutPoints.find((item) =>
        item.id !== cutId && item.frame === targetFrame
    );

    if (collision) {
        $("statusMessage").textContent =
            "다른 컷팅 지점과 겹치는 위치로 이동할 수 없습니다.";
        return;
    }

    cut.frame = targetFrame;

    focusedCutId = cutId;
    timelineFocused = false;

    rebuildSegments();
    renderTimeline();
}

function deleteFocusedCutPoint() {
    if (!focusedCutId) return;

    cutPoints = cutPoints.filter((cut) => cut.id !== focusedCutId);

    focusedCutId = null;
    timelineFocused = true;

    rebuildSegments();
    renderTimeline();

    $("statusMessage").textContent = "선택한 컷팅 지점을 삭제했습니다.";
}

/* --------------------------------------------------
   타임라인 재생 위치 이동
-------------------------------------------------- */

function seekToPosition(clientX) {
    if (!duration) return;

    const rect = timeline.getBoundingClientRect();

    const ratio = clamp(
        (clientX - rect.left) / rect.width,
        0,
        1
    );

    video.currentTime = ratio * duration;

    renderTimeline();
    renderModalTimeline();
}

/* --------------------------------------------------
   재생 위치 드래그
-------------------------------------------------- */

function startPlayheadDrag(event) {
    if (!duration || currentMode !== "edit") return;

    if (event.button !== 0) return;

    event.preventDefault();

    draggingPlayhead = true;
    wasPlayingBeforeDrag = !video.paused;

    focusedCutId = null;
    timelineFocused = true;

    seekToPosition(event.clientX);

    if (event.target.closest(".cut-marker")) {
        suppressNextCutMarkerClick = true;
    } else {
        suppressNextCutMarkerClick = false;
    }

    timeline.setPointerCapture(event.pointerId);
}

function movePlayheadDrag(event) {
    if (!draggingPlayhead) return;

    event.preventDefault();

    seekToPosition(event.clientX);
}

function endPlayheadDrag(event) {
    if (!draggingPlayhead) return;

    draggingPlayhead = false;

    if (timeline.hasPointerCapture(event.pointerId)) {
        timeline.releasePointerCapture(event.pointerId);
    }

    ignoreNextTimelineClick = true;

    setTimeout(() => {
        ignoreNextTimelineClick = false;
    }, 0);

    setTimeout(() => {
        suppressNextCutMarkerClick = false;
    }, 0);

    if (wasPlayingBeforeDrag && video.paused) {
        video.play().catch(() => {
            $("statusMessage").textContent =
                "동영상 재생을 시작하지 못했습니다.";
        });
    }
}

/* --------------------------------------------------
   타임라인 클릭
-------------------------------------------------- */

function seekTimeline(event) {
    if (!duration || currentMode !== "edit") return;

    if (ignoreNextTimelineClick) {
        ignoreNextTimelineClick = false;
        return;
    }

    if (event.target.closest("#playhead")) {
        event.stopPropagation();

        focusedCutId = null;
        timelineFocused = true;

        renderTimeline();

        $("statusMessage").textContent =
            "재생 위치에 포커스되었습니다. 방향키로 이동할 수 있습니다.";

        return;
    }

    if (event.target.closest(".cut-marker")) {
        return;
    }

    const wasPlaying = !video.paused;

    focusedCutId = null;
    timelineFocused = true;

    seekToPosition(event.clientX);

    if (wasPlaying && video.paused) {
        video.play().catch(() => {
            $("statusMessage").textContent =
                "동영상 재생을 시작하지 못했습니다.";
        });
    }
}

/* --------------------------------------------------
   재생 및 정지
-------------------------------------------------- */

function togglePlayback() {
    if (!sourceFile || !duration) return;

    if (video.paused) {
        if (video.currentTime >= duration) {
            video.currentTime = 0;
        }

        video.play().catch(() => {
            $("statusMessage").textContent =
                "동영상 재생에 실패했습니다.";
        });
    } else {
        video.pause();
    }
}

function updatePlayButton() {
    $("playButton").textContent = video.paused ? "재생" : "정지";
}

/* --------------------------------------------------
   키보드 조작
-------------------------------------------------- */

function handleKeyboard(event) {
    if (
        event.target.matches("input, textarea, select") ||
        event.target.isContentEditable
    ) {
        return;
    }

    if (!modal.classList.contains("hidden")) {
        if (event.code === "Space" && !exporting) {
            event.preventDefault();
            togglePlayback();
        }

        return;
    }

    if (!sourceFile) return;

    if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
        return;
    }

    if (event.key === "Delete" && currentMode === "edit") {
        deleteFocusedCutPoint();
        return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
    }

    event.preventDefault();

    const direction = event.key === "ArrowRight" ? 1 : -1;

    let stepFrames;

    if (event.ctrlKey && event.shiftKey) {
        stepFrames = 1;
    } else if (event.shiftKey) {
        stepFrames = frameStep(0.1);
    } else {
        stepFrames = frameStep(1);
    }

    if (focusedCutId && currentMode === "edit") {
        const cut = cutPoints.find((item) => item.id === focusedCutId);

        if (cut) {
            moveCutPoint(
                cut.id,
                cut.frame + direction * stepFrames
            );
        }

        return;
    }

    if (timelineFocused) {
        video.pause();

        video.currentTime = clamp(
            video.currentTime + (direction * stepFrames) / fps,
            0,
            duration
        );
    }
}

/* --------------------------------------------------
   구간 선택 팝업
-------------------------------------------------- */

function openSelectionModal() {
    if (!sourceFile || !duration) return;

    video.pause();

    currentMode = "select";
    selectedSegmentOrder = [];

    rebuildSegments();

    modal.classList.remove("hidden");

    renderSegments();
    renderModalTimeline();

    $("exportProgress").value = 0;
    $("exportStatus").textContent = "저장할 구간을 선택하세요.";
    $("ffmpegLog").textContent = "";
}

function closeSelectionModal() {
    if (exporting) {
        $("exportStatus").textContent =
            "저장 작업이 진행 중입니다. 완료 후 팝업을 닫을 수 있습니다.";
        return;
    }

    stopPreview();

    modal.classList.add("hidden");

    currentMode = "edit";
    selectedSegmentOrder = [];

    focusedCutId = null;
    timelineFocused = true;

    renderTimeline();

    $("statusMessage").textContent = "컷팅 지점 편집 단계입니다.";
}

function renderSegments() {
    rebuildSegmentsWithoutRendering();

    modalSegmentLayer.innerHTML = "";
    $("segmentList").innerHTML = "";

    segments.forEach((segment) => {
        const selectedIndex = selectedSegmentOrder.indexOf(segment.id);

        const element = document.createElement("div");

        element.className = "segment";

        if (selectedIndex >= 0) {
            element.classList.add("selected");
        }

        element.style.left = `${toPercent(segment.start)}%`;

        element.style.width =
            `${Math.max(0, toPercent(segment.end) - toPercent(segment.start))}%`;

        element.textContent = selectedIndex >= 0
            ? String(selectedIndex + 1)
            : "";

        element.title =
            `${formatTime(segment.start)} ~ ${formatTime(segment.end)}`;

        element.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleSegmentSelection(segment.id);
        });

        modalSegmentLayer.append(element);

        const chip = document.createElement("button");

        chip.className = "segment-chip";

        if (selectedIndex >= 0) {
            chip.classList.add("selected");
        }

        chip.textContent =
            `${segment.id + 1}번 구간 ${formatTime(segment.start)} ~ ${formatTime(segment.end)}`;

        chip.addEventListener("click", () => {
            toggleSegmentSelection(segment.id);
        });

        $("segmentList").append(chip);
    });

    updateSelectionInformation();
}

function rebuildSegmentsWithoutRendering() {
    const sortedCuts = getSortedCutPoints();

    const boundaries = [
        0,
        ...sortedCuts.map((cut) => frameToTime(cut.frame)),
        duration
    ];

    segments = [];

    for (let index = 0; index < boundaries.length - 1; index++) {
        if (boundaries[index + 1] > boundaries[index]) {
            segments.push({
                id: index,
                start: boundaries[index],
                end: boundaries[index + 1]
            });
        }
    }
}

function toggleSegmentSelection(segmentId) {
    if (exporting) return;

    const existingIndex = selectedSegmentOrder.indexOf(segmentId);

    if (existingIndex >= 0) {
        selectedSegmentOrder.splice(existingIndex, 1);
    } else {
        selectedSegmentOrder.push(segmentId);
    }

    renderSegments();
}

function updateSelectionInformation() {
    const count = selectedSegmentOrder.length;

    $("selectionInfo").textContent =
        `${count}개 구간 선택 · 선택 순서대로 연결`;

    $("selectedCount").textContent =
        count > 0 ? `${count}개 구간 선택됨` : "선택된 구간 없음";
}

function renderModalTimeline() {
    if (!duration) return;

    $("modalTimeDisplay").textContent = getCurrentTimeDisplay();

    modalPlayhead.style.left = `${toPercent(video.currentTime)}%`;
}

/* --------------------------------------------------
   전체 선택 및 해제
-------------------------------------------------- */

function selectAllSegments() {
    if (exporting) return;

    selectedSegmentOrder = segments.map((segment) => segment.id);

    renderSegments();
}

function deselectAllSegments() {
    if (exporting) return;

    selectedSegmentOrder = [];

    renderSegments();
}

/* --------------------------------------------------
   미리보기
-------------------------------------------------- */

function stopPreview() {
    previewing = false;
    previewSegment = null;

    video.pause();
}

async function previewSelectedSegment() {
    if (exporting) return;

    if (selectedSegmentOrder.length === 0) {
        $("exportStatus").textContent =
            "먼저 미리보기할 구간을 선택하세요.";
        return;
    }

    const segmentId = selectedSegmentOrder[0];

    const segment = segments.find((item) => item.id === segmentId);

    if (!segment) return;

    stopPreview();

    previewSegment = segment;
    previewing = true;

    video.currentTime = segment.start;

    try {
        await video.play();

        $("exportStatus").textContent =
            `${segmentId + 1}번 구간을 미리 보는 중입니다.`;
    } catch {
        stopPreview();

        $("exportStatus").textContent =
            "동영상 재생을 시작하지 못했습니다.";
    }
}

/* --------------------------------------------------
   파일 불러오기
-------------------------------------------------- */

function loadVideo(file) {
    if (!file || !file.type.startsWith("video/")) {
        $("fileError").textContent =
            "올바른 동영상 파일을 선택하세요.";
        return;
    }

    if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
    }

    sourceFile = file;
    sourceUrl = URL.createObjectURL(file);

    video.src = sourceUrl;
    video.load();

    cutPoints = [];
    focusedCutId = null;
    timelineFocused = true;

    selectedSegmentOrder = [];
    segments = [];

    duration = 0;
    currentMode = "edit";

    $("fileScreen").classList.add("hidden");
    $("editorScreen").classList.remove("hidden");

    $("fileInfo").textContent =
        `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;

    $("statusMessage").textContent = "동영상 정보를 분석 중입니다.";

    $("fileError").textContent = "";

    $("cutList").innerHTML = "";

    $("cutSelectionInfo").textContent =
        "선택된 컷팅 지점 없음";

    $("playButton").textContent = "재생";
}

function closeVideo() {
    if (exporting) return;

    stopPreview();

    video.pause();
    video.removeAttribute("src");
    video.load();

    if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
    }

    sourceUrl = null;
    sourceFile = null;

    duration = 0;

    cutPoints = [];
    focusedCutId = null;
    timelineFocused = true;

    selectedSegmentOrder = [];
    segments = [];

    currentMode = "edit";

    draggingPlayhead = false;
    wasPlayingBeforeDrag = false;
    ignoreNextTimelineClick = false;
    suppressNextCutMarkerClick = false;

    modal.classList.add("hidden");

    cutLayer.innerHTML = "";

    $("cutList").innerHTML = "";
    $("segmentList").innerHTML = "";

    playhead.style.left = "0%";

    $("timeDisplay").textContent = "00:00 / 00:00";

    $("fileInfo").textContent = "";
    $("statusMessage").textContent = "파일을 불러오세요.";

    $("cutTimeInput").value = "";

    $("fileScreen").classList.remove("hidden");
    $("editorScreen").classList.add("hidden");

    $("videoFile").value = "";
    $("fileError").textContent = "";
}

function resetEditing() {
    stopPreview();

    cutPoints = [];
    focusedCutId = null;
    timelineFocused = true;

    selectedSegmentOrder = [];

    currentMode = "edit";

    video.pause();
    video.currentTime = 0;

    rebuildSegments();
    renderTimeline();

    $("statusMessage").textContent =
        "편집 내용을 초기화했습니다. 원본 동영상은 유지됩니다.";
}

/* --------------------------------------------------
   FFmpeg 초기화
-------------------------------------------------- */

function getFileExtension(file) {
    const match = file.name.match(/\.([^.]+)$/);

    return match ? match[1].toLowerCase() : "mp4";
}

function setExportStatus(message) {
    $("exportStatus").textContent = message;
}

async function loadFFmpeg() {
    if (ffmpeg && ffmpeg.loaded) return;

    if (!ffmpeg) {
        ffmpeg = new FFmpeg();

        ffmpeg.on("progress", ({ progress }) => {
            $("exportProgress").value = Math.round(progress * 100);
        });

        ffmpeg.on("log", ({ message }) => {
            $("ffmpegLog").textContent = message;
        });
    }

    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
    });
}

/* --------------------------------------------------
   FFmpeg 파일 정리
-------------------------------------------------- */

async function deleteFFmpegFile(filename) {
    if (!ffmpeg || !filename) return;

    try {
        await ffmpeg.deleteFile(filename);
    } catch {
        // 존재하지 않는 파일은 무시합니다.
    }
}

/* --------------------------------------------------
   동영상 저장
-------------------------------------------------- */

async function exportSelectedSegments() {
    if (exporting) return;

    if (!sourceFile) {
        setExportStatus("먼저 동영상 파일을 불러오세요.");
        return;
    }

    if (selectedSegmentOrder.length === 0) {
        setExportStatus("저장할 구간을 선택하세요.");
        return;
    }

    exporting = true;

    $("exportButton").disabled = true;
    $("selectAllButton").disabled = true;
    $("deselectAllButton").disabled = true;
    $("closeModalButton").disabled = true;

    $("exportProgress").value = 0;

    let inputName = "";
    let outputParts = [];

    try {
        /*
            중요:
            FFmpeg 작업을 시작하기 전에 저장 위치를 선택합니다.
            showSaveFilePicker()는 사용자 버튼 클릭 직후 호출해야 합니다.
        */

        const suggestedName =
            sourceFile.name.replace(/\.[^.]+$/, "") + "_edited.mp4";

        let fileHandle = null;

        if (window.showSaveFilePicker) {
            setExportStatus("저장할 위치와 파일명을 선택하세요.");

            fileHandle = await window.showSaveFilePicker({
                suggestedName,
                types: [{
                    description: "MP4 동영상",
                    accept: {
                        "video/mp4": [".mp4"]
                    }
                }]
            });
        }

        /*
            저장 위치 선택이 완료된 다음 FFmpeg 작업을 시작합니다.
            파일 저장 창에서 취소하면 AbortError가 발생하여
            아래 FFmpeg 작업은 실행되지 않습니다.
        */

        setExportStatus("FFmpeg 엔진을 준비하고 있습니다.");

        await loadFFmpeg();

        inputName = `input.${getFileExtension(sourceFile)}`;

        setExportStatus(
            "원본 동영상을 처리 엔진으로 복사하고 있습니다."
        );

        const fileBuffer = new Uint8Array(
            await sourceFile.arrayBuffer()
        );

        await ffmpeg.writeFile(inputName, fileBuffer);

        for (let index = 0; index < selectedSegmentOrder.length; index++) {
            const segmentId = selectedSegmentOrder[index];

            const segment = segments.find(
                (item) => item.id === segmentId
            );

            if (!segment) continue;

            const outputName = `part${index}.mp4`;

            const segmentDuration = segment.end - segment.start;

            setExportStatus(
                `선택 구간 ${index + 1}/${selectedSegmentOrder.length} 추출 중입니다.`
            );

            await ffmpeg.exec([
                "-ss", segment.start.toFixed(6),
                "-i", inputName,
                "-t", segmentDuration.toFixed(6),
                "-map", "0",
                "-c", "copy",
                "-avoid_negative_ts", "make_zero",
                outputName
            ]);

            outputParts.push(outputName);
        }

        if (outputParts.length === 0) {
            throw new Error("추출할 수 있는 구간이 없습니다.");
        }

        const concatText = outputParts
            .map((name) => `file '${name}'`)
            .join("\n");

        await ffmpeg.writeFile(
            "concat.txt",
            new TextEncoder().encode(concatText)
        );

        setExportStatus(
            "선택한 구간을 하나의 동영상으로 연결하고 있습니다."
        );

        await ffmpeg.exec([
            "-f", "concat",
            "-safe", "0",
            "-i", "concat.txt",
            "-map", "0",
            "-c", "copy",
            "joined.mp4"
        ]);

        setExportStatus("완성된 동영상을 준비하고 있습니다.");

        const outputData = await ffmpeg.readFile("joined.mp4");

        const outputBlob = new Blob(
            [outputData],
            { type: "video/mp4" }
        );

        /*
            사용자가 앞서 선택한 저장 위치에 파일을 기록합니다.
        */

        if (fileHandle) {
            setExportStatus("선택한 위치에 동영상을 저장하고 있습니다.");

            const writable = await fileHandle.createWritable();

            await writable.write(outputBlob);
            await writable.close();
        } else {
            /*
                showSaveFilePicker를 지원하지 않는 브라우저에서는
                기존 다운로드 방식을 사용합니다.
            */

            const downloadURL = URL.createObjectURL(outputBlob);

            const link = document.createElement("a");

            link.href = downloadURL;
            link.download = suggestedName;

            document.body.append(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(downloadURL);
            }, 60000);
        }

        $("exportProgress").value = 100;

        setExportStatus("동영상 저장이 완료되었습니다.");

    } catch (error) {
        const message = error.message || String(error);

        setExportStatus(
            error.name === "AbortError"
                ? "저장이 취소되었습니다."
                : `저장 실패: ${message}`
        );

        if (error.name !== "AbortError") {
            $("ffmpegLog").textContent =
                "파일 크기, 브라우저 메모리, 코덱 또는 컨테이너 호환성을 확인하세요.";

            console.error("동영상 저장 오류:", error);
        }

    } finally {
        exporting = false;

        $("exportButton").disabled = false;
        $("selectAllButton").disabled = false;
        $("deselectAllButton").disabled = false;
        $("closeModalButton").disabled = false;

        await deleteFFmpegFile(inputName);
        await deleteFFmpegFile("concat.txt");
        await deleteFFmpegFile("joined.mp4");

        for (const name of outputParts) {
            await deleteFFmpegFile(name);
        }
    }
}

/* --------------------------------------------------
   이벤트 연결
-------------------------------------------------- */

/* 파일 선택 */

$("videoFile").addEventListener("change", (event) => {
    const file = event.target.files?.[0];

    if (file) {
        loadVideo(file);
    }
});

/* 동영상 메타데이터 */

video.addEventListener("loadedmetadata", () => {
    duration = video.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
        $("statusMessage").textContent =
            "동영상 재생 시간을 확인할 수 없습니다.";
        return;
    }

    rebuildSegments();
    renderTimeline();

    $("statusMessage").textContent =
        "동영상 준비 완료 · 컷팅 지점을 설정하세요.";
});

video.addEventListener("error", () => {
    if (!sourceFile) return;

    $("statusMessage").textContent =
        "동영상을 불러오지 못했습니다. 파일 형식을 확인하세요.";
});

/* 재생 상태 */

video.addEventListener("play", updatePlayButton);
video.addEventListener("pause", updatePlayButton);
video.addEventListener("ended", updatePlayButton);

/* 동영상 화면 클릭으로 재생 / 정지 */

video.style.pointerEvents = "auto";

video.addEventListener("click", (event) => {
    event.preventDefault();

    if (!sourceFile || currentMode !== "edit") return;

    togglePlayback();
});

/* 재생 시간 변경 */

video.addEventListener("timeupdate", () => {
    renderTimeline();
    renderModalTimeline();

    if (
        previewing &&
        previewSegment &&
        video.currentTime >= previewSegment.end - 0.015
    ) {
        stopPreview();

        $("exportStatus").textContent = "미리보기가 끝났습니다.";
    }
});

/* 메인 편집 버튼 */

$("playButton").addEventListener("click", togglePlayback);

$("addCutButton").addEventListener("click", () => {
    video.pause();
    addCutPoint();
});

$("deleteCutButton").addEventListener("click", deleteFocusedCutPoint);

$("resetButton").addEventListener("click", resetEditing);

$("closeButton").addEventListener("click", closeVideo);

/* 타임라인 클릭 및 재생 위치 드래그 */

timeline.addEventListener("pointerdown", startPlayheadDrag);
timeline.addEventListener("pointermove", movePlayheadDrag);
timeline.addEventListener("pointerup", endPlayheadDrag);
timeline.addEventListener("pointercancel", endPlayheadDrag);

timeline.addEventListener("click", seekTimeline);

/* 컷팅 시간 직접 입력 */

$("applyCutTimeButton").addEventListener("click", () => {
    if (!focusedCutId) {
        $("statusMessage").textContent =
            "먼저 수정할 컷팅 지점을 선택하세요.";
        return;
    }

    const value = parseTimeInput($("cutTimeInput").value);

    if (value === null) {
        $("statusMessage").textContent =
            "시간을 MM:SS 또는 HH:MM:SS 형식으로 입력하세요.";
        return;
    }

    if (value <= 0 || value >= duration) {
        $("statusMessage").textContent =
            "컷팅 지점은 동영상 시작과 끝 사이에 있어야 합니다.";
        return;
    }

    const targetFrame = timeToFrame(value);

    const collision = cutPoints.find((cut) =>
        cut.id !== focusedCutId && cut.frame === targetFrame
    );

    if (collision) {
        $("statusMessage").textContent =
            "이미 다른 컷팅 지점이 해당 프레임에 있습니다.";
        return;
    }

    video.pause();

    moveCutPoint(focusedCutId, targetFrame);

    video.currentTime = frameToTime(targetFrame);

    $("statusMessage").textContent =
        "컷팅 지점 시간을 변경했습니다.";
});

/* 다음 단계 */

$("nextStepButton").addEventListener("click", openSelectionModal);

/* 팝업 닫기 */

$("closeModalButton").addEventListener("click", closeSelectionModal);

/* 전체 선택 및 해제 */

$("selectAllButton").addEventListener("click", selectAllSegments);

$("deselectAllButton").addEventListener("click", deselectAllSegments);

/* 미리보기 */

$("previewButton").addEventListener("click", previewSelectedSegment);

$("stopPreviewButton").addEventListener("click", stopPreview);

/* 저장 */

$("exportButton").addEventListener("click", exportSelectedSegments);

/* 키보드 */

window.addEventListener("keydown", handleKeyboard);

/* 팝업 외부 클릭으로 닫히지 않도록 처리 */

modal.addEventListener("click", (event) => {
    if (event.target === modal) {
        event.stopPropagation();
    }
});
