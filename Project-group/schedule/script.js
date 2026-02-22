const ORDER_FILE_PATH = 'data/order.txt';
const DUTY_FOLDER_PATH = 'data/duty/';

const D_DAY_TARGET_DATE = new Date('2025-11-13T00:00:00');

const btnStart = document.querySelector('.btn-start');
const btnPause = document.querySelector('.btn-pause');
const btnComplete = document.querySelector('.btn-complete');

const timerStateDiv = document.querySelector('.timer-state');
const timerTimeDiv = document.querySelector('.timer-time');
const scheduleCategoryDiv = document.querySelector('.schedule-category');
const scheduleTaskDiv = document.querySelector('.schedule-task');

const ampmSpan = document.querySelector('.ampm');
const digitalTimeSpan = document.querySelector('.digital-time');
const currentDateDiv = document.querySelector('.current-date');
const ddayCountDiv = document.querySelector('.dday-count');

const taskListContainer = document.querySelector('.task-list-container');
const analysisGraphContainer = document.querySelector('.analysis-graph-container');
const totalTimeDisplay = document.querySelector('.total-time-display');

const exceptionInput = document.getElementById('exception-input');
const exceptionSaveBtn = document.getElementById('exception-save-btn');

let timerInterval = null;
let timerStartTime = null;
let timerElapsed = 0;
let timerRunning = false;
let selectedSchedule = null; // { category, task }
let selectingMode = false;
let isEditing = false;

let currentSelectedTaskItemElement = null; // 현재 선택된 task-item DOM 요소를 추적

const STORAGE_KEYS = {
    records: 'records',
    exceptionSchedules: 'exceptionSchedules',
    TIMER_STATE: 'timerState', // 타이머 상태 저장을 위한 키
    LAST_INITIALIZED_DAY: 'lastInitializedDay' // 마지막으로 초기화된 날짜 저장 키
};

let order = [];
let schedules = {};
let records = {};
let exceptionSchedules = [];


async function init() {
    records = JSON.parse(localStorage.getItem(STORAGE_KEYS.records)) || {};
    exceptionSchedules = JSON.parse(localStorage.getItem(STORAGE_KEYS.exceptionSchedules)) || {};

    checkAndInitializeDailyData(); // records 로드 후 바로 호출하여 일일 초기화 확인

    try {
        await loadOrder();

        if (order.includes('예외 스케줄')) {
            order = order.filter(cat => cat !== '예외 스케줄');
        }

        order.unshift('예외 스케줄');

        await loadSchedules();
        schedules['예외 스케줄'] = exceptionSchedules;

    } catch (error) {
        console.error("스케줄 파일을 불러오는 데 실패했습니다. 서버 환경에서 실행 중인지 확인해주세요.", error);
        alert("스케줄 파일을 불러오는 데 실패했습니다. 웹페이지에 스케줄이 표시되지 않을 수 있습니다.");
        order = ['예외 스케줄'];
        schedules['예외 스케줄'] = exceptionSchedules;
    }

    updateCurrentDateAndDDay();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);

    renderTaskList();
    renderAnalysisGraph();
    loadTimerState(); // 페이지 로드 시 저장된 타이머 상태 복원
    updateTimerUI();  // loadTimerState 후 UI 업데이트 및 init() 마지막에서 한 번 더 호출하여 최종 UI 상태 보장
    setupEventListeners();
}

async function loadOrder() {
    const response = await fetch(ORDER_FILE_PATH);

    if (!response.ok) {
        throw new Error(`order.txt 파일을 불러오는데 실패했습니다: ${response.statusText}`);
    }

    const text = await response.text();
    order = text.split(/\r?\n/).filter(line => line.trim() !== '');
}

async function loadSchedules() {
    const categoriesToLoad = order.filter(category => category !== '예외 스케줄');

    for (const category of categoriesToLoad) {
        const filePath = `${DUTY_FOLDER_PATH}${category}.txt`;

        try {
            const response = await fetch(filePath);

            if (!response.ok) {
                console.warn(`${category}.txt 파일을 불러오는데 실패했습니다: ${response.statusText}. 빈 목록으로 처리합니다.`);
                schedules[category] = [];
                continue;
            }

            const text = await response.text();
            schedules[category] = text.split(/\r?\n/).filter(line => line.trim() !== '');

        } catch (err) {
            console.warn(`파일 "${filePath}" 로드 중 오류 발생:`, err.message);
            schedules[category] = [];
        }
    }
}

function updateCurrentDateAndDDay() {
    const today = new Date();

    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    };

    currentDateDiv.textContent = today.toLocaleDateString('ko-KR', options);

    const diffTime = D_DAY_TARGET_DATE.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    ddayCountDiv.textContent = `D-${diffDays}`;
}

function updateCurrentTime() {
    const now = new Date();

    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const ampm = hours >= 12 ? '오후' : '오전';

    if (hours === 0) {
        hours = 12;
    } else if (hours > 12) {
        hours -= 12;
    }

    ampmSpan.textContent = ampm;

    digitalTimeSpan.textContent =
        `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}

function padZero(num) {
    return num.toString().padStart(2, '0');
}

function updateTimerUI() {
    const rightSection = document.querySelector('.right');
    const timerStatusBox = document.querySelector('.timer-status-box');
    const editButtons = document.querySelectorAll('.edit-exception-schedule-btn');

    btnStart.classList.remove('inactive'); // 항상 먼저 inactive 클래스를 제거하여 버튼을 활성화 시킵니다.

    if (!timerRunning) {
        timerStateDiv.textContent = '쉬는중';
        timerTimeDiv.textContent = '00:00:00';
        scheduleCategoryDiv.textContent = '';
        scheduleTaskDiv.textContent = '';

        btnStart.textContent = selectingMode ? '일정 선택' : '시작';

        if (selectingMode) {
            btnStart.classList.add('selecting-mode');
        } else {
            btnStart.classList.remove('selecting-mode');
        }

        btnPause.classList.add('inactive');
        btnComplete.classList.add('inactive');

        selectedSchedule = null;

        if (!selectingMode) {
            rightSection.classList.remove('selecting');
        }

        timerStatusBox.classList.remove('running-highlight');

        editButtons.forEach(button => {
            button.style.display = 'inline-block';
        });

    } else { // 타이머가 진행중일 때
        timerStateDiv.textContent = '진행중';
        btnStart.textContent = '시작';
        btnStart.classList.add('inactive');
        btnStart.classList.remove('selecting-mode');

        btnPause.classList.remove('inactive');
        btnComplete.classList.remove('inactive');

        rightSection.classList.remove('selecting');
        timerStatusBox.classList.add('running-highlight');

        editButtons.forEach(button => {
            button.style.display = 'none';
        });
    }
}

function startTimerInterval() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        timerElapsed = Date.now() - timerStartTime.getTime();
        timerTimeDiv.textContent = formatDuration(timerElapsed);
    }, 1000);
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);

    const h = Math.floor((totalSeconds / 3600) % 24);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    return `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
}

function stopTimer(status) {
    if (!timerRunning) {
        return;
    }

    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    selectingMode = false;

    localStorage.removeItem(STORAGE_KEYS.TIMER_STATE);

    const endTime = new Date();
    const duration = endTime - timerStartTime;

    const currentCategory = selectedSchedule ? selectedSchedule.category : '알 수 없음';
    const currentTask = selectedSchedule ? selectedSchedule.task : '알 수 없음';

    if (!records[currentCategory]) {
        records[currentCategory] = {};
    }

    if (!records[currentCategory][currentTask]) {
        records[currentCategory][currentTask] = [];
    }

    records[currentCategory][currentTask].push({
        start: timerStartTime.toISOString(),
        end: endTime.toISOString(),
        duration,
        status
    });

    saveRecords();
    updateTimerUI();
    renderTaskList();
    renderAnalysisGraph();

    if (currentSelectedTaskItemElement) {
        currentSelectedTaskItemElement.classList.remove('selected');
        currentSelectedTaskItemElement = null;
    }
}

function saveRecords() {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
}

function saveTimerState() {
    const state = {
        timerRunning: timerRunning,
        timerStartTime: timerStartTime ? timerStartTime.toISOString() : null,
        selectedSchedule: selectedSchedule
    };

    localStorage.setItem(STORAGE_KEYS.TIMER_STATE, JSON.stringify(state));
}

function loadTimerState() {
    const savedState = localStorage.getItem(STORAGE_KEYS.TIMER_STATE);

    if (savedState) {
        const state = JSON.parse(savedState);

        timerRunning = state.timerRunning;
        timerStartTime = state.timerStartTime ? new Date(state.timerStartTime) : null;
        selectedSchedule = state.selectedSchedule;

        if (timerRunning && timerStartTime && selectedSchedule) {
            timerElapsed = Date.now() - timerStartTime.getTime();
            timerTimeDiv.textContent = formatDuration(timerElapsed);

            const allTaskItems = document.querySelectorAll('.task-item');

            allTaskItems.forEach(item => {
                if (
                    item.dataset.category === selectedSchedule.category &&
                    item.dataset.task === selectedSchedule.task
                ) {
                    item.classList.add('selected');
                    currentSelectedTaskItemElement = item;
                }
            });

            startTimerInterval();

        } else {
            localStorage.removeItem(STORAGE_KEYS.TIMER_STATE);
        }
    }
}

/**
 * 현재 "하루"의 시작 시간 (오전 5시 기준)을 반환합니다.
 */
function getStartOfCurrentDay() {
    const now = new Date();
    const startOfToday5AM = new Date(now);

    startOfToday5AM.setHours(5, 0, 0, 0);

    if (now.getHours() < 5) {
        const startOfYesterday5AM = new Date(startOfToday5AM);
        startOfYesterday5AM.setDate(startOfYesterday5AM.getDate() - 1);
        return startOfYesterday5AM;
    } else {
        return startOfToday5AM;
    }
}

// 일일 데이터 초기화를 확인하고 수행하는 함수
function checkAndInitializeDailyData() {
    const currentDayStart = getStartOfCurrentDay();
    const lastInitializedDay = localStorage.getItem(STORAGE_KEYS.LAST_INITIALIZED_DAY);

    if (!lastInitializedDay || new Date(lastInitializedDay).getTime() !== currentDayStart.getTime()) {
        console.log("새로운 날이 시작되었습니다. 기록을 초기화합니다.");

        for (const category in records) {
            for (const task in records[category]) {
                records[category][task] = records[category][task].filter(record => {
                    const recordStartTime = new Date(record.start);
                    return recordStartTime.getTime() >= currentDayStart.getTime();
                });

                if (records[category][task].length === 0) {
                    delete records[category][task];
                }
            }

            if (Object.keys(records[category]).length === 0) {
                delete records[category];
            }
        }

        saveRecords();
        localStorage.setItem(STORAGE_KEYS.LAST_INITIALIZED_DAY, currentDayStart.toISOString());

        if (currentSelectedTaskItemElement) {
            currentSelectedTaskItemElement.classList.remove('selected');
            currentSelectedTaskItemElement = null;
        }

        localStorage.removeItem(STORAGE_KEYS.TIMER_STATE);
    }
}

function saveExceptionSchedule(text) {
    exceptionSchedules.push(text);
    schedules['예외 스케줄'] = exceptionSchedules;
    localStorage.setItem(STORAGE_KEYS.exceptionSchedules, JSON.stringify(exceptionSchedules));
    renderTaskList();
}

function renderTaskList() {
    taskListContainer.innerHTML = '';

    const todayScheduleTitle = document.querySelector('.today-schedule-title-text');

    if (order.length === 0) {
        const noDataMessage = document.createElement('div');
        noDataMessage.textContent = '스케줄 데이터를 불러올 수 없습니다.';
        noDataMessage.style.textAlign = 'center';
        noDataMessage.style.padding = '20px';
        noDataMessage.style.color = '#888';
        taskListContainer.appendChild(noDataMessage);
        return;
    }

    order.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('task-category');

        const titleDiv = document.createElement('div');
        titleDiv.classList.add('category-title');
        categoryDiv.appendChild(titleDiv);

        const categoryNameSpan = document.createElement('span');
        categoryNameSpan.textContent = category;
        titleDiv.appendChild(categoryNameSpan);

        if (category === '예외 스케줄') {
            const editExceptionBtn = document.createElement('button');
            editExceptionBtn.classList.add('edit-exception-schedule-btn');
            editExceptionBtn.textContent = isEditing ? '완료' : '편집';
            editExceptionBtn.addEventListener('click', () => {
                isEditing = !isEditing;
                renderTaskList();
            });
            titleDiv.appendChild(editExceptionBtn);
        }

        const tasks = schedules[category] || [];

        if (tasks.length === 0) {
            const noDataMessage = document.createElement('div');
            noDataMessage.style.textAlign = 'center';
            noDataMessage.style.padding = '5px';
            noDataMessage.style.color = '#aaa';

            if (category === '예외 스케줄') {
                noDataMessage.textContent = '등록된 예외 스케줄이 없습니다.';
            } else {
                noDataMessage.textContent = '일정 없음';
            }

            categoryDiv.appendChild(noTaskMessage);
        }

        tasks.forEach((task, index) => {
            const taskDiv = document.createElement('div');
            taskDiv.classList.add('task-item');
            taskDiv.dataset.category = category;
            taskDiv.dataset.task = task;
            taskDiv.dataset.index = index;

            const taskItemHeader = document.createElement('div');
            taskItemHeader.classList.add('task-item-header');
            taskDiv.appendChild(taskItemHeader);

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('task-name');
            nameSpan.textContent = task;
            taskItemHeader.appendChild(nameSpan);

            const taskActionsDiv = document.createElement('div');
            taskActionsDiv.classList.add('task-actions');
            taskItemHeader.appendChild(taskActionsDiv);

            if (category === '예외 스케줄') {
                const deleteBtn = document.createElement('button');
                deleteBtn.classList.add('delete-item-btn');
                deleteBtn.textContent = '삭제';
                deleteBtn.style.display = isEditing ? 'inline-block' : 'none';

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const confirmDelete = confirm(`"${task}" 일정을 정말 삭제하시겠습니까?`);

                    if (confirmDelete) {
                        const taskToDelete = e.target.closest('.task-item').dataset.task;
                        const taskIndexToDelete = parseInt(e.target.closest('.task-item').dataset.index);

                        if (exceptionSchedules[taskIndexToDelete] === taskToDelete) {
                            exceptionSchedules.splice(taskIndexToDelete, 1);
                            schedules['예외 스케줄'] = exceptionSchedules;
                            localStorage.setItem(
                                STORAGE_KEYS.exceptionSchedules,
                                JSON.stringify(exceptionSchedules)
                            );
                            renderTaskList();
                        }
                    }
                });

                taskActionsDiv.appendChild(deleteBtn);
            }

            const statusBox = document.createElement('div');
            statusBox.classList.add('status-box');

            const recs = records[category]?.[task] || [];

            if (recs.length > 0) {
                const lastRecord = recs[recs.length - 1];

                if (lastRecord.status === 'completed') {
                    statusBox.classList.add('completed');
                } else if (lastRecord.status === 'paused') {
                    statusBox.classList.add('paused');
                }
            }

            taskActionsDiv.appendChild(statusBox);

            const timerRecordDiv = document.createElement('div');
            timerRecordDiv.classList.add('task-timer-record');

            if (recs.length > 0) {
                recs.forEach(r => {
                    const start = new Date(r.start);
                    const end = new Date(r.end);
                    const durationStr = formatDuration(r.duration);

                    const recordText =
                        `${padZero(start.getHours())}:${padZero(start.getMinutes())} - ` +
                        `${padZero(end.getHours())}:${padZero(end.getMinutes())} | ${durationStr}`;

                    const p = document.createElement('p');
                    p.textContent = recordText;
                    timerRecordDiv.appendChild(p);
                });
            } else {
                timerRecordDiv.textContent = '기록 없음';
            }

            taskDiv.appendChild(timerRecordDiv);
            categoryDiv.appendChild(taskDiv);

            taskDiv.addEventListener('click', (event) => {
                event.stopPropagation();

                if (timerRunning || isEditing) {
                    document.querySelectorAll('.task-timer-record').forEach(div => {
                        if (div !== timerRecordDiv) {
                            div.style.display = 'none';
                        }
                    });

                    if (timerRecordDiv.style.display === 'block') {
                        timerRecordDiv.style.display = 'none';
                    } else {
                        timerRecordDiv.style.display = 'block';
                    }

                    return;
                }

                if (selectingMode) {
                    if (currentSelectedTaskItemElement) {
                        currentSelectedTaskItemElement.classList.remove('selected');
                    }

                    taskDiv.classList.add('selected');
                    currentSelectedTaskItemElement = taskDiv;

                    selectedSchedule = { category, task };
                    selectingMode = false;

                    timerRunning = true;
                    timerStartTime = new Date();
                    saveTimerState();

                    timerElapsed = 0;
                    updateTimerUI();
                    startTimerInterval();
                } else {
                    document.querySelectorAll('.task-timer-record').forEach(div => {
                        if (div !== timerRecordDiv) {
                            div.style.display = 'none';
                        }
                    });

                    if (timerRecordDiv.style.display === 'block') {
                        timerRecordDiv.style.display = 'none';
                    } else {
                        timerRecordDiv.style.display = 'block';
                    }
                }
            });
        });

        taskListContainer.appendChild(categoryDiv);
    });
}

/**
 * 현재 "하루"의 시작 시간 (오전 5시 기준)을 반환합니다.
 * 예: 현재 시간이 7/15 03:00 이면 7/14 05:00 반환
 *     현재 시간이 7/15 06:00 이면 7/15 05:00 반환
 * @returns {Date} 현재 "하루"의 시작 시간
 */
function getStartOfCurrentDay() {
    const now = new Date();
    const startOfToday5AM = new Date(now);
    startOfToday5AM.setHours(5, 0, 0, 0);

    if (now.getHours() < 5) {
        const startOfYesterday5AM = new Date(startOfToday5AM);
        startOfYesterday5AM.setDate(startOfYesterday5AM.getDate() - 1);
        return startOfYesterday5AM;
    } else {
        return startOfToday5AM;
    }
}

function renderAnalysisGraph() {
    analysisGraphContainer.innerHTML = '';

    const startOfCurrentDay = getStartOfCurrentDay();
    const endOfCurrentDay = new Date(startOfCurrentDay);
    endOfCurrentDay.setDate(endOfCurrentDay.getDate() + 1);

    const dailyTotalTimes = {};
    order.forEach(category => {
        dailyTotalTimes[category] = 0;
    });

    for (const category in records) {
        for (const task in records[category]) {
            records[category][task].forEach(r => {
                const recordStartTime = new Date(r.start);

                if (
                    recordStartTime.getTime() >= startOfCurrentDay.getTime() &&
                    recordStartTime.getTime() < endOfCurrentDay.getTime()
                ) {
                    if (dailyTotalTimes[category] !== undefined) {
                        dailyTotalTimes[category] += r.duration;
                    }
                }
            });
        }
    }

    const totalAllDaily = Object.values(dailyTotalTimes).reduce((a, b) => a + b, 0);

    totalTimeDisplay.innerHTML = '';

    const totalTimeLabel = document.createElement('span');
    totalTimeLabel.classList.add('total-time-label');
    totalTimeLabel.textContent = '합계:';

    const totalTimeValue = document.createElement('span');
    totalTimeValue.classList.add('total-time-value');
    totalTimeValue.textContent = formatDuration(totalAllDaily);

    totalTimeDisplay.appendChild(totalTimeLabel);
    totalTimeDisplay.appendChild(totalTimeValue);

    let categoriesForColorRanking = order.map(category => ({
        category,
        time: dailyTotalTimes[category] || 0
    }));

    categoriesForColorRanking.sort((a, b) => b.time - a.time);

    const rankColors = ['#d33', '#FF8C00', '#FFD700', '#B0B0B0'];
    const categoryColorMap = new Map();

    categoriesForColorRanking.forEach((item, idx) => {
        categoryColorMap.set(
            item.category,
            idx < 3 ? rankColors[idx] : rankColors[3]
        );
    });

    if (order.length === 0) {
        const noDataMessage = document.createElement('div');
        noDataMessage.textContent = '분석 데이터를 불러올 수 없습니다.';
        noDataMessage.style.textAlign = 'center';
        noDataMessage.style.padding = '20px';
        noDataMessage.style.color = '#888';
        analysisGraphContainer.appendChild(noDataMessage);
        return;
    }

    const analysisGraphInner = document.createElement('div');
    analysisGraphInner.classList.add('analysis-graph-inner');
    analysisGraphContainer.appendChild(analysisGraphInner);

    const labelsColumn = document.createElement('div');
    labelsColumn.classList.add('analysis-labels-column');
    analysisGraphInner.appendChild(labelsColumn);

    const barsColumn = document.createElement('div');
    barsColumn.classList.add('analysis-bars-column');
    analysisGraphInner.appendChild(barsColumn);

    let graphDisplayOrder = order.filter(category => category !== '예외 스케줄');
    const exceptionScheduleCategory = order.find(
        category => category === '예외 스케줄'
    );

    if (exceptionScheduleCategory) {
        graphDisplayOrder.push(exceptionScheduleCategory);
    }

    graphDisplayOrder.forEach(category => {
        const time = dailyTotalTimes[category] || 0;
        const barColor = categoryColorMap.get(category) || rankColors[3];

        const labelSpan = document.createElement('span');
        labelSpan.classList.add('analysis-label-item');
        labelSpan.textContent = category;
        labelsColumn.appendChild(labelSpan);

        const barOuter = document.createElement('div');
        barOuter.classList.add('analysis-bar-outer');

        const barInner = document.createElement('div');
        barInner.classList.add('analysis-bar-inner');
        barInner.style.width =
            totalAllDaily > 0
                ? `${(time / totalAllDaily) * 100}%`
                : '0%';
        barInner.style.backgroundColor = barColor;
        barInner.style.transition = 'width 0.5s ease-out';

        barOuter.appendChild(barInner);
        barsColumn.appendChild(barOuter);
    });
}

function setupEventListeners() {
    const rightSection = document.querySelector('.right');

    btnStart.addEventListener('click', () => {
        if (!timerRunning) {
            if (!selectingMode) {
                selectingMode = true;
                btnStart.textContent = '일정 선택';
                btnStart.classList.add('selecting-mode');
                rightSection.classList.add('selecting');
                updateTimerUI();
            } else {
                selectingMode = false;
                selectedSchedule = null;

                if (currentSelectedTaskItemElement) {
                    currentSelectedTaskItemElement.classList.remove('selected');
                    currentSelectedTaskItemElement = null;
                }

                btnStart.textContent = '시작';
                btnStart.classList.remove('selecting-mode');
                rightSection.classList.remove('selecting');
                updateTimerUI();
            }
        }
    });

    btnPause.addEventListener('click', () => {
        if (timerRunning) {
            stopTimer('paused');
        }
    });

    btnComplete.addEventListener('click', () => {
        if (timerRunning) {
            stopTimer('completed');
        }
    });

    exceptionSaveBtn.addEventListener('click', () => {
        const val = exceptionInput.value.trim();

        if (val) {
            saveExceptionSchedule(val);
            exceptionInput.value = '';
        }
    });
}

window.addEventListener('DOMContentLoaded', init);