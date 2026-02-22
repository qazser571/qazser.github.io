document.addEventListener('DOMContentLoaded', () => {
    // 1. 코돈 데이터 정의 (이전과 동일)
    const codonData = [
        [['UUU', 'UUC'], '페닐알라닌', 'F'],
        [['UUA', 'UUG'], '류신', 'L'],
        [['UCU', 'UCC', 'UCA', 'UCG'], '세린', 'S'],
        [['UAU', 'UAC'], '타이로신', 'Y'],
        [['UAA', 'UAG'], '종결코돈', 'STOP'],
        [['UGU', 'UGC'], '시스테인', 'C'],
        [['UGA'], '종결코돈', 'STOP'],
        [['UGG'], '트립토판', 'W'],

        [['CUU', 'CUC', 'CUA', 'CUG'], '류신', 'L'],
        [['CCU', 'CCC', 'CCA', 'CCG'], '프롤린', 'P'],
        [['CAU', 'CAC'], '히스티딘', 'H'],
        [['CAA', 'CAG'], '글루타민', 'Q'],
        [['CGU', 'CGC', 'CGA', 'CGG'], '아르지닌', 'R'],

        [['AUU', 'AUC', 'AUA'], '아이소류신', 'I'],
        [['AUG'], '메싸이오닌', 'M'],
        [['ACU', 'ACC', 'ACA', 'ACG'], '트레오닌', 'T'],
        [['AAU', 'AAC'], '아스파라진', 'N'],
        [['AAA', 'AAG'], '라이신', 'K'], 
        [['AGU', 'AGC'], '세린', 'S'],
        [['AGA', 'AGG'], '아르지닌', 'R'],

        [['GUU', 'GUC', 'GUA', 'GUG'], '발린', 'V'],
        [['GCU', 'GCC', 'GCA', 'GCG'], '알라닌', 'A'],
        [['GAU', 'GAC'], '아스파트산', 'D'],
        [['GAA', 'GAG'], '글루탐산', 'E'],
        [['GGU', 'GGC', 'GGA', 'GGG'], '글리신', 'G']
    ];

    // 코돈 데이터를 앞 두 글자 기준으로 그룹화 (이전과 동일)
    const groupedCodonBlocks = [
        ['U', 'U', [0, 1]], ['U', 'C', [2]], ['U', 'A', [3, 4]], ['U', 'G', [5, 6, 7]],
        ['C', 'U', [8]], ['C', 'C', [9]], ['C', 'A', [10, 11]], ['C', 'G', [12]],
        ['A', 'U', [13, 14]], ['A', 'C', [15]], ['A', 'A', [16, 17]], ['A', 'G', [18, 19]],
        ['G', 'U', [20]], ['G', 'C', [21]], ['G', 'A', [22, 23]], ['G', 'G', [24]]
    ];

    // 2. DOM 요소 참조
    const codonTableContainer = document.getElementById('codon-table-container');
    const modeSelectionButtons = document.getElementById('mode-selection-buttons');
    const mode1Btn = document.getElementById('mode1-btn');
    const mode2Btn = document.getElementById('mode2-btn');
    const selectionArea = document.getElementById('selection-area');
    const selectAllBtn = document.getElementById('select-all-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    const currentQuestionDisplay = document.getElementById('current-question');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const gameEndArea = document.getElementById('game-end-area');
    const scoreDisplay = document.getElementById('score-display');
    const retryWrongBtn = document.getElementById('retry-wrong-btn');
    const startOverBtn = document.getElementById('start-over-btn');
    const toggleCodonsBtn = document.getElementById('toggle-codons');
    const toggleAminoAcidsBtn = document.getElementById('toggle-amino-acids');
    const toggleAminoAcidDisplayModeBtn = document.getElementById('toggle-amino-acid-display-mode');
    const mainGameContent = document.getElementById('main-game-content');
    const setupView = document.getElementById('setup-view');
    const gameView = document.getElementById('game-view');


    // 3. 게임 상태 변수
    let currentPhase = 'setup';
    let selectedGameMode = null;
    let selectedCodonGroupIndices = new Set(); // 선택된 아미노산 그룹의 인덱스 (codonData의 인덱스)
    let questionQueue = []; // 실제 문제 큐 (Game 1에서는 개별 코돈, Game 2에서는 아미노산 그룹 인덱스)
    let wrongAnswers = []; // 틀린 문제들을 저장 (Game 1: {dataIndex, codon}, Game 2: 아미노산 이름)
    let currentQuestion = null; // Game 1: {dataIndex: ..., codon: 'UUU'}, Game 2: dataIndex X
    let currentCorrectCells = []; // 현재 문제의 정답 셀 (DOM 요소)
    let correctClicksCount = 0; // Game 2에서 사용 (클릭된 정답 코돈 수)
    let totalQuestions = 0;
    let correctAnswersCount = 0;

    let showCodons = true;
    let showAminoAcids = true;
    let aminoAcidDisplayMode = 0;
    let isWaitingForNextQuestion = false; // 다음 문제로 넘어갈 준비가 되었는지 (버튼 표시 여부 결정)
    let isGameRunning = false; // 게임 진행 상태 추가

    // 4. UI 상태 관리 함수
    function updateUI(phase) {
        // 모든 뷰 숨김 처리
        setupView.classList.add('hidden');
        gameView.classList.add('hidden');
        gameEndArea.classList.add('hidden');
        
        // 버튼들도 초기화 시 모두 숨김
        startGameBtn.classList.add('hidden');
        nextQuestionBtn.classList.add('hidden'); 

        mode1Btn.classList.remove('active');
        mode2Btn.classList.remove('active');

        // 셀 클릭 이벤트 리스너는 updateUI 진입 시 모두 제거 후, 해당 phase에서 필요한 리스너만 다시 추가
        document.querySelectorAll('.codon-group-cell').forEach(cell => {
            cell.removeEventListener('click', handleSelectionClick);
            cell.removeEventListener('click', handleCellClick);
            cell.classList.remove('selected-for-game'); // 선택 상태 초기화
            cell.classList.remove('correct-answer-bg'); // 정답 배경색 초기화
            cell.classList.remove('incorrect-answer-bg'); // 오답 배경색 초기화
            cell.classList.remove('correct-answer-highlight'); // 하이라이트 클래스 초기화
            cell.style.backgroundColor = ''; // 배경색 직접 설정된 경우 초기화
        });

        currentPhase = phase;

        switch (currentPhase) {
            case 'setup':
                setupView.classList.remove('hidden'); // 설정 뷰 표시
                startGameBtn.classList.remove('hidden'); // 게임 시작 버튼 표시
                nextQuestionBtn.classList.add('hidden'); // 설정 화면에서는 다음 문제 버튼 숨김
                startGameBtn.textContent = '학습 시작'; // 텍스트 수정: '게임 시작' -> '학습 시작'
                startGameBtn.classList.remove('stop-game-btn'); // CSS 클래스 제거 (선택 사항)
                isGameRunning = false; // 게임 상태 초기화
                
                // 모드가 선택되었을 때만 학습 범위 선택 영역 표시
                if (selectedGameMode !== null) {
                    selectionArea.classList.remove('hidden');
                } else {
                    selectionArea.classList.add('hidden'); // 초기 로드 시 숨김
                }

                if (selectedGameMode === 'game1') {
                    mode1Btn.classList.add('active');
                }
                if (selectedGameMode === 'game2') {
                    mode2Btn.classList.add('active');
                }

                // setup 단계에서는 코돈 셀에 handleSelectionClick 이벤트 리스너를 다시 연결
                document.querySelectorAll('.codon-group-cell').forEach(cell => {
                    cell.addEventListener('click', handleSelectionClick);
                    // 현재 선택된 코돈 그룹에 따라 UI 업데이트
                    if (selectedCodonGroupIndices.has(parseInt(cell.dataset.index))) {
                        cell.classList.add('selected-for-game');
                    }
                });
                updateSelectAllButtonState();
                break;
            case 'game_active':
                gameView.classList.remove('hidden'); // 게임 뷰 표시
                startGameBtn.classList.remove('hidden'); // 게임 중지 버튼 표시
                // nextQuestionBtn은 nextQuestion 함수 내에서 필요시 표시
                startGameBtn.textContent = '학습 중지'; // 텍스트 수정: '게임 중지' -> '학습 중지'
                startGameBtn.classList.add('stop-game-btn'); // CSS 클래스 추가 (선택 사항)
                isGameRunning = true; // 게임 상태 활성화

                document.querySelectorAll('.codon-group-cell').forEach(cell => {
                    cell.addEventListener('click', handleCellClick);
                });
                break;
            case 'game_end':
                gameEndArea.classList.remove('hidden'); // 게임 종료 영역 표시
                startGameBtn.classList.add('hidden'); // 학습 종료 단계에서 학습 시작 버튼 숨김
                nextQuestionBtn.classList.add('hidden'); // 게임 종료 화면에서는 다음 문제 버튼 숨김
                startGameBtn.textContent = '학습 시작'; // 텍스트 수정: '게임 시작' -> '학습 시작'
                startGameBtn.classList.remove('stop-game-btn'); // CSS 클래스 제거
                isGameRunning = false; // 게임 상태 초기화

                // 게임 종료 시 셀 클릭 이벤트 리스너 제거는 updateUI 초입에서 이미 처리됨
                break;
        }
    }

    // 5. 코돈표 동적 생성 및 업데이트 함수
    function updateCodonTable() {
        codonTableContainer.innerHTML = ''; // 기존 테이블 내용 삭제
        const firstBases = ['U', 'C', 'A', 'G'];
        const secondBases = ['U', 'C', 'A', 'G'];

        const baseBlockHeight = 530 / 4;

        for (let i = 0; i < firstBases.length; i++) {
            for (let j = 0; j < secondBases.length; j++) {
                const currentFirstBase = firstBases[i];
                const currentSecondBase = secondBases[j];

                const blockInfo = groupedCodonBlocks.find(block =>
                    block[0] === currentFirstBase && block[1] === currentSecondBase
                );

                const codonBlock = document.createElement('div');
                codonBlock.classList.add('codon-block');

                if (blockInfo) {
                    blockInfo[2].forEach(dataIndex => {
                        const group = codonData[dataIndex];
                        const [codons, aminoAcidName, aminoAcidAbbr] = group;
                        const numCodonsInGroup = codons.length;

                        const cell = document.createElement('div');
                        cell.classList.add('codon-group-cell');
                        cell.dataset.index = dataIndex;

                        const heightPerCodon = baseBlockHeight / 4;
                        cell.style.height = `${numCodonsInGroup * heightPerCodon}px`;


                        const codonsDiv = document.createElement('div');
                        codonsDiv.classList.add('codons');
                        codons.forEach(codon => {
                            const codonItem = document.createElement('span');
                            codonItem.classList.add('codon-item');
                            codonItem.textContent = codon;
                            codonsDiv.appendChild(codonItem);
                        });
                        cell.appendChild(codonsDiv);

                        const aminoAcidDiv = document.createElement('div');
                        aminoAcidDiv.classList.add('amino-acid');

                        let displayText = '';
                        // 종결코돈 예외 처리
                        if (aminoAcidName === '종결코돈') {
                            displayText = '종결코돈'; // 항상 "종결코돈"으로 표기
                        } else {
                            if (aminoAcidDisplayMode === 0) { // 표시 모드 : 1
                                displayText = `${aminoAcidName}(${aminoAcidAbbr})`;
                            } else if (aminoAcidDisplayMode === 1) { // 표시 모드 : 2
                                displayText = aminoAcidName;
                            } else { // 표시 모드 : 3
                                displayText = aminoAcidAbbr;
                            }
                        }
                        aminoAcidDiv.textContent = displayText;
                        cell.appendChild(aminoAcidDiv);

                        // 숨기기 클래스 적용 (새로 생성할 때도 적용)
                        if (!showCodons) {
                            cell.classList.add('hidden-codon');
                        } else {
                            cell.classList.remove('hidden-codon');
                        }

                        if (!showAminoAcids) {
                            cell.classList.add('hidden-amino-acid');
                        } else {
                            cell.classList.remove('hidden-amino-acid');
                        }
                        codonBlock.appendChild(cell);
                    });
                }
                codonTableContainer.appendChild(codonBlock);
            }
        }
        // 코돈표 업데이트 후 UI 상태를 재부착 (이벤트 리스너 등)
        updateUI(currentPhase); 
        // 코돈표가 재생성된 후 현재 게임 상태의 시각적 피드백을 다시 적용
        reapplyCurrentQuestionState();
    }

    // 코돈/아미노산 셀의 가시성만 업데이트하는 함수
    function updateCodonCellVisibility() {
        document.querySelectorAll('.codon-group-cell').forEach(cell => {
            if (!showCodons) {
                cell.classList.add('hidden-codon');
            } else {
                cell.classList.remove('hidden-codon');
            }

            if (!showAminoAcids) {
                cell.classList.add('hidden-amino-acid');
            } else {
                cell.classList.remove('hidden-amino-acid');
            }
        });
        // 이 함수는 가시성만 변경하므로, 하이라이트나 버튼 상태를 건드리지 않음.
        // 하이라이트는 checkAnswer/nextQuestion에서 직접 관리
        reapplyCurrentQuestionState(); // 가시성 변경 후에도 현재 상태를 다시 적용
    }

    // 현재 게임 상태의 하이라이트 및 버튼 가시성을 다시 적용하는 함수
    function reapplyCurrentQuestionState() {
        // 모든 셀에서 이전 정답/오답 표시 클래스 제거 (안전하게 초기화)
        document.querySelectorAll('.codon-group-cell').forEach(cell => {
            cell.classList.remove('correct-answer-bg', 'incorrect-answer-bg', 'correct-answer-highlight');
        });

        // isWaitingForNextQuestion이 true일 때만 정답/오답 표시 및 다음 문제 버튼 표시
        if (isGameRunning && isWaitingForNextQuestion) { // **수정: isWaitingForNextQuestion 조건 추가**
            // 현재 문제의 정답 셀에 correct-answer-bg 다시 적용
            currentCorrectCells.forEach(correctCellData => {
                const dataIndex = parseInt(correctCellData.dataset.index);
                const newCell = document.querySelector(`.codon-group-cell[data-index="${dataIndex}"]`);
                if (newCell) {
                    newCell.classList.add('correct-answer-bg');
                }
            });

            // 정답인 경우에만 하이라이트 적용 (오답인 경우는 incorrect-answer-bg가 이미 적용됨)
            // currentQuestion이 wrongAnswers에 포함되어 있지 않은 경우 (즉, 정답인 경우)
            const isCurrentQuestionCorrectlyAnswered = 
                (selectedGameMode === 'game1' && wrongAnswers.indexOf(currentQuestion) === -1) ||
                (selectedGameMode === 'game2' && wrongAnswers.indexOf(codonData[currentQuestion][1]) === -1);

            if (isCurrentQuestionCorrectlyAnswered) {
                currentCorrectCells.forEach(cellData => {
                    const newCell = document.querySelector(`.codon-group-cell[data-index="${cellData.dataset.index}"]`);
                    if (newCell) {
                        newCell.classList.add('correct-answer-highlight');
                    }
                });
            } else { // 오답인 경우, 클릭된 셀에 incorrect-answer-bg 재적용 (checkAnswer에서 이미 처리됨)
                // 오답으로 클릭된 셀을 찾아 incorrect-answer-bg를 다시 적용
                // 이 부분은 checkAnswer에서 직접 처리되므로, reapplyCurrentQuestionState에서는 모든 정답 셀에 correct-answer-bg와 highlight만 다시 적용하는 것이 일관성 있음.
                // 만약 오답 셀까지 정확히 복원하려면, 오답 셀의 dataIndex를 어딘가에 저장해야 함.
                // 현재는 오답이 발생하면 모든 정답 셀이 하이라이트되고, 클릭된 오답 셀만 빨간색으로 표시되므로, 이 상태를 재현하기 위해
                // 오답 시에도 정답 셀에 correct-answer-highlight를 적용하는 로직을 유지.
            }
            nextQuestionBtn.classList.remove('hidden'); // '다음 문제' 버튼 표시
        } else {
            nextQuestionBtn.classList.add('hidden'); // 게임 중이 아니거나 아직 문제가 해결되지 않았으면 버튼 숨김
        }
    }


    // 6. 게임 로직 함수
    function startGame() {
        if (selectedGameMode === null) {
            alert('게임을 시작하려면 먼저 모드를 선택해주세요.');
            return;
        }
        if (selectedCodonGroupIndices.size === 0) {
            alert('게임을 시작하려면 최소 하나 이상의 코돈 그룹을 선택해야 합니다.');
            return;
        }

        totalQuestions = 0;
        correctAnswersCount = 0;
        wrongAnswers = [];
        questionQueue = []; // 문제 큐 초기화

        // Game 1 (코돈 -> 아미노산) 문제 생성: 개별 코돈을 문제로 만듦
        if (selectedGameMode === 'game1') {
            selectedCodonGroupIndices.forEach(dataIndex => {
                const codonsInGroup = codonData[dataIndex][0]; // 해당 아미노산에 속한 모든 코돈
                codonsInGroup.forEach(codon => {
                    questionQueue.push({ dataIndex: dataIndex, codon: codon }); // {아미노산 그룹 인덱스, 개별 코돈 문자열}
                });
            });
        } 
        // Game 2 (아미노산 -> 코돈) 문제 생성: 아미노산 그룹 인덱스를 문제로 만듦 (중복 제거)
        else if (selectedGameMode === 'game2') {
            const uniqueAminoAcidNames = new Set();
            selectedCodonGroupIndices.forEach(dataIndex => {
                uniqueAminoAcidNames.add(codonData[dataIndex][1]); // 선택된 그룹의 아미노산 이름을 Set에 추가 (중복 제거)
            });

            // 각 고유한 아미노산 이름에 대해 해당 아미노산을 대표하는 하나의 dataIndex만 큐에 추가
            uniqueAminoAcidNames.forEach(aminoAcidName => {
                const representativeDataIndex = codonData.findIndex((group, idx) => 
                    group[1] === aminoAcidName && selectedCodonGroupIndices.has(idx)
                );
                if (representativeDataIndex !== -1) {
                    questionQueue.push(representativeDataIndex);
                }
            });
        }

        shuffleArray(questionQueue); // 문제 큐 섞기
        
        updateUI('game_active');
        isWaitingForNextQuestion = false; // 게임 시작 시 다음 문제 대기 상태 초기화
        nextQuestion();
    }

    // 게임 중지 함수 추가
    function stopGame() {
        selectedCodonGroupIndices.clear(); // 선택된 학습 범위 초기화
        selectedGameMode = null; // 선택된 게임 모드 초기화
        updateUI('setup'); // 게임을 설정 단계로 되돌림
        currentQuestionDisplay.textContent = ''; // 문제 표시 초기화
        isWaitingForNextQuestion = false; // 다음 문제 대기 상태 초기화
    }

    function nextQuestion() {
        // 모든 셀에서 이전 정답/오답 표시 클래스 제거
        document.querySelectorAll('.codon-group-cell').forEach(cell => {
            cell.classList.remove('correct-answer-bg', 'incorrect-answer-bg', 'correct-answer-highlight');
            cell.style.backgroundColor = '';
        });
        nextQuestionBtn.classList.add('hidden'); // 다음 문제 버튼 숨김 (새 문제 시작 시)
        isWaitingForNextQuestion = false; // 다음 문제 대기 상태 초기화

        if (questionQueue.length === 0) {
            endGame();
            return;
        }

        totalQuestions++;
        currentCorrectCells = [];
        correctClicksCount = 0; // 새 문제 시작 시 correctClicksCount 초기화

        const questionItem = questionQueue.shift(); // Game 1: {dataIndex, codon}, Game 2: dataIndex
        currentQuestion = questionItem; // currentQuestion은 이제 객체 또는 인덱스

        if (selectedGameMode === 'game1') {
            // Game 1: 코돈 -> 아미노산 모드. 개별 코돈을 문제로 제시
            currentQuestionDisplay.textContent = currentQuestion.codon; // currentQuestion.codon 사용
            
            // Game 1의 정답 셀은 문제로 제시된 코돈이 속한 아미노산 그룹 전체
            currentCorrectCells = Array.from(document.querySelectorAll('.codon-group-cell')).filter(cell => {
                return parseInt(cell.dataset.index) === currentQuestion.dataIndex;
            });

        } else if (selectedGameMode === 'game2') {
            // Game 2: 아미노산 -> 코돈 모드. 아미노산 이름만 문제로 제시
            const aminoAcidName = codonData[currentQuestion][1]; // currentQuestion은 dataIndex
            currentQuestionDisplay.textContent = aminoAcidName;
            
            // Game 2의 정답 셀은 현재 문제의 아미노산 이름과 일치하는 모든 코돈 셀
            currentCorrectCells = Array.from(document.querySelectorAll('.codon-group-cell')).filter(cell => {
                return codonData[parseInt(cell.dataset.index)][1] === aminoAcidName;
            });
        }
        currentQuestionDisplay.classList.remove('hidden');
    }

    function checkAnswer(clickedCell) {
        // 이미 다음 문제로 넘어갈 준비가 된 상태라면, 더 이상 클릭 처리하지 않음
        if (isWaitingForNextQuestion) {
            return;
        }

        const clickedIndex = parseInt(clickedCell.dataset.index);
        let questionResolved = false; // 현재 문제가 완전히 해결되었는지를 나타내는 플래그

        if (selectedGameMode === 'game1') {
            // Game 1: 코돈 -> 아미노산 모드 (클릭한 셀이 문제로 제시된 코돈의 아미노산 그룹에 해당하는지)
            const questionDataIndex = currentQuestion.dataIndex; // 문제로 제시된 코돈의 아미노산 그룹 인덱스
            
            if (clickedIndex === questionDataIndex) {
                correctAnswersCount++; // 정답 처리
                clickedCell.classList.add('correct-answer-bg');
                clickedCell.classList.add('correct-answer-highlight'); // 하이라이트 적용
            } else {
                wrongAnswers.push(currentQuestion); // 오답 처리 (문제 객체 전체 저장)
                clickedCell.classList.add('incorrect-answer-bg');
                // 정답 셀도 표시
                currentCorrectCells.forEach(cell => { 
                    cell.classList.add('correct-answer-bg');
                    cell.classList.add('correct-answer-highlight'); // 오답 시 정답도 하이라이트
                });
            }
            questionResolved = true; // game1은 한 번의 클릭으로 문제 해결
        } else if (selectedGameMode === 'game2') {
            // Game 2: 아미노산 -> 코돈 모드 (클릭한 셀이 정답 코돈 중 하나인지)
            const isClickedCellCorrectForQuestion = currentCorrectCells.some(cell => parseInt(cell.dataset.index) === clickedIndex);

            if (isClickedCellCorrectForQuestion) {
                // 클릭한 셀이 정답 코돈 중 하나이고, 아직 클릭되지 않은 경우
                if (!clickedCell.classList.contains('correct-answer-bg')) { // 이미 클릭된 정답 셀이 아니면
                    clickedCell.classList.add('correct-answer-bg');
                    correctClicksCount++; // 클릭된 정답 코돈 수 증가
                }
                
                // 모든 정답 코돈을 클릭했는지 확인
                if (correctClicksCount === currentCorrectCells.length) {
                    correctAnswersCount++; // 모든 정답을 맞췄으므로 총 정답 수 증가
                    questionResolved = true; // 모든 정답을 클릭하여 문제 해결
                    // 모든 정답 셀에 하이라이트 적용
                    currentCorrectCells.forEach(cell => {
                        cell.classList.add('correct-answer-highlight'); // 하이라이트 적용
                    });
                } else {
                    // 아직 모든 정답을 클릭하지 않았으므로, 다음 클릭을 기다림
                    questionResolved = false; // 명시적으로 false 유지
                }
            } else { // 오답 코돈을 클릭한 경우
                wrongAnswers.push(codonData[currentQuestion][1]); // Game 2: 틀린 문제로 아미노산 이름 저장
                clickedCell.classList.add('incorrect-answer-bg');
                currentCorrectCells.forEach(cell => { // 모든 정답 셀 표시
                    cell.classList.add('correct-answer-bg');
                    cell.classList.add('correct-answer-highlight'); // 오답 시 정답도 하이라이트
                });
                questionResolved = true; // 오답을 클릭했으므로 문제 해결
            }
        }

        // 문제가 완전히 해결되었을 때만 다음 문제 버튼을 표시하고 추가 클릭을 막음
        if (questionResolved) {
            isWaitingForNextQuestion = true; // 다음 문제로 넘어갈 준비 완료
            nextQuestionBtn.classList.remove('hidden'); // '다음 문제' 버튼 표시
        }
    }

    function endGame() {
        updateUI('game_end');
        scoreDisplay.textContent = `총 ${totalQuestions}문제 중 ${correctAnswersCount}문제 정답!`;
        if (wrongAnswers.length > 0) {
            retryWrongBtn.style.display = 'block';
        } else {
            retryWrongBtn.style.display = 'none';
        }
    }

    // 7. 이벤트 핸들러
    mode1Btn.addEventListener('click', () => {
        selectedGameMode = 'game1';
        selectedCodonGroupIndices.clear(); // 모드 변경 시 학습 범위 초기화
        updateUI('setup');
    });

    mode2Btn.addEventListener('click', () => {
        selectedGameMode = 'game2';
        selectedCodonGroupIndices.clear(); // 모드 변경 시 학습 범위 초기화
        updateUI('setup');
    });

    function handleSelectionClick(event) {
        // 모드가 선택되지 않았다면 코돈표 클릭 불가능
        if (selectedGameMode === null) {
            alert('먼저 학습 모드를 선택해주세요.');
            return;
        }

        const cell = event.currentTarget;
        const index = parseInt(cell.dataset.index); // 클릭된 셀의 data-index (codonData의 인덱스)

        if (selectedGameMode === 'game2') {
            // Game 2 모드에서는 동일 아미노산 그룹 전체를 선택/해제
            const clickedAminoAcidName = codonData[index][1]; // 클릭된 셀의 아미노산 이름
            const relatedCells = Array.from(document.querySelectorAll('.codon-group-cell')).filter(c => {
                return codonData[parseInt(c.dataset.index)][1] === clickedAminoAcidName;
            });

            // 현재 클릭된 아미노산 그룹이 이미 모두 선택되어 있는지 확인
            const isAllRelatedSelected = relatedCells.every(c => selectedCodonGroupIndices.has(parseInt(c.dataset.index)));

            if (isAllRelatedSelected) {
                // 이미 모두 선택되어 있다면 모두 해제
                relatedCells.forEach(c => {
                    selectedCodonGroupIndices.delete(parseInt(c.dataset.index));
                    c.classList.remove('selected-for-game');
                });
            } else {
                // 하나라도 선택 안 되어 있다면 모두 선택
                relatedCells.forEach(c => {
                    selectedCodonGroupIndices.add(parseInt(c.dataset.index));
                    c.classList.add('selected-for-game');
                });
            }
        } else { // Game 1 모드
            // Game 1 모드에서는 개별 셀 선택/해제
            if (selectedCodonGroupIndices.has(index)) {
                selectedCodonGroupIndices.delete(index);
                cell.classList.remove('selected-for-game');
            } else {
                selectedCodonGroupIndices.add(index);
                cell.classList.add('selected-for-game');
            }
        }
        updateSelectAllButtonState();
    }

    function updateSelectAllButtonState() {
        const totalCodonGroups = codonData.length;
        const selectedCount = selectedCodonGroupIndices.size;

        if (selectedCount === totalCodonGroups) {
            selectAllBtn.textContent = '전체 선택됨';
            selectAllBtn.dataset.toggleAction = 'deselect-all';
        } else if (selectedCount === 0) {
            selectAllBtn.textContent = '전체 선택 해제됨';
            selectAllBtn.dataset.toggleAction = 'select-all';
        } else {
            selectAllBtn.textContent = '전체 선택 해제하기'; // 일부 선택된 상태
            selectAllBtn.dataset.toggleAction = 'deselect-all';
        }
    }

    selectAllBtn.addEventListener('click', () => {
        // 모드가 선택되지 않았다면 전체 선택/해제 불가능
        if (selectedGameMode === null) {
            alert('먼저 학습 모드를 선택해주세요.');
            return;
        }

        const action = selectAllBtn.dataset.toggleAction;

        if (action === 'select-all') {
            selectedCodonGroupIndices.clear();
            // 모든 그룹을 선택할 때 Game 2 모드에서는 아미노산 그룹 단위로 선택
            if (selectedGameMode === 'game2') {
                const uniqueAminoAcidNames = new Set();
                codonData.forEach((group, index) => {
                    uniqueAminoAcidNames.add(group[1]);
                });
                uniqueAminoAcidNames.forEach(aminoAcidName => {
                    // 해당 아미노산 이름을 가진 모든 dataIndex를 찾아서 추가
                    codonData.forEach((group, index) => {
                        if (group[1] === aminoAcidName) {
                            selectedCodonGroupIndices.add(index);
                        }
                    });
                });
            } else {
                // Game 1 모드에서는 모든 개별 그룹 선택
                for (let i = 0; i < codonData.length; i++) {
                    selectedCodonGroupIndices.add(i);
                }
            }
        } else { // 'deselect-all'
            selectedCodonGroupIndices.clear();
        }
        
        document.querySelectorAll('.codon-group-cell').forEach(cell => {
            const index = parseInt(cell.dataset.index);
            if (selectedCodonGroupIndices.has(index)) {
                cell.classList.add('selected-for-game');
            } else {
                cell.classList.remove('selected-for-game');
            }
        });
        updateSelectAllButtonState();
    });

    function handleCellClick(event) {
        const clickedCell = event.currentTarget;
        checkAnswer(clickedCell);
    }

    // startGameBtn 클릭 이벤트 리스너 수정
    startGameBtn.addEventListener('click', () => {
        if (isGameRunning) {
            stopGame(); // 게임 중이면 중지
        } else {
            startGame(); // 게임 중이 아니면 시작
        }
    });

    nextQuestionBtn.addEventListener('click', nextQuestion);

    retryWrongBtn.addEventListener('click', () => {
        // 재시험 시에는 새로운 문제 큐를 생성하므로, 기존 questionQueue를 비움
        questionQueue = []; 

        if (selectedGameMode === 'game1') {
             // Game 1에서는 틀린 문제 객체 {dataIndex, codon}들을 그대로 사용
             questionQueue = [...wrongAnswers];
        } else if (selectedGameMode === 'game2') {
            // Game 2에서는 틀린 아미노산 이름(문자열)을 Set으로 변환하여 고유한 아미노산만 재시험 대상으로 함
            const uniqueWrongAminoAcids = Array.from(new Set(wrongAnswers));
            
            // 각 고유한 틀린 아미노산 이름에 대해 해당 아미노산을 대표하는 dataIndex를 찾아 questionQueue에 추가
            uniqueWrongAminoAcids.forEach(aminoAcidName => {
                // 이전에 선택된 학습 범위 내에서 해당 아미노산 이름을 가진 첫 번째 dataIndex를 찾음
                // 이렇게 해야 재시험 문제도 원래 학습 범위에 속했던 것만 출제됨
                const representativeDataIndex = codonData.findIndex((group, idx) => 
                    group[1] === aminoAcidName && selectedCodonGroupIndices.has(idx)
                );
                if (representativeDataIndex !== -1) {
                    questionQueue.push(representativeDataIndex);
                }
            });
        }
        wrongAnswers = []; // 틀린 문제 목록 초기화
        shuffleArray(questionQueue); // 재시험 문제 큐 섞기
        
        // 재시험 시작
        totalQuestions = 0; // 총 문제 수 초기화
        correctAnswersCount = 0; // 정답 수 초기화
        updateUI('game_active'); // UI를 게임 활성 상태로 전환
        isWaitingForNextQuestion = false; // 다음 문제 대기 상태 초기화
        nextQuestion(); // 첫 재시험 문제 시작
    });

    startOverBtn.addEventListener('click', () => {
        selectedCodonGroupIndices.clear();
        selectedGameMode = null;
        updateCodonTable();
        updateUI('setup');
    });

    // 코돈/아미노산 숨기기 버튼 (스위치 토글)
    toggleCodonsBtn.addEventListener('click', () => {
        showCodons = !showCodons;
        toggleCodonsBtn.classList.toggle('active', !showCodons);
        updateCodonCellVisibility(); // updateCodonTable 대신 호출
    });

    toggleAminoAcidsBtn.addEventListener('click', () => {
        showAminoAcids = !showAminoAcids;
        toggleAminoAcidsBtn.classList.toggle('active', !showAminoAcids);
        updateCodonCellVisibility(); // updateCodonTable 대신 호출
    });

    // 아미노산 표시 모드 토글 버튼 (배경색 변경 없음, 텍스트 변경)
    toggleAminoAcidDisplayModeBtn.addEventListener('click', () => {
        aminoAcidDisplayMode = (aminoAcidDisplayMode + 1) % 3;
        updateAminoAcidDisplayModeButtonText();
        updateCodonTable(); // 이 버튼은 코돈표를 재생성해야 함
    });

    // 표시 모드 버튼 텍스트를 업데이트하는 함수
    function updateAminoAcidDisplayModeButtonText() {
        let buttonText = '';
        if (aminoAcidDisplayMode === 0) {
            buttonText = '표시 모드 : 1';
        } else if (aminoAcidDisplayMode === 1) {
            buttonText = '표시 모드 : 2';
        } else { // aminoAcidDisplayMode === 2
            buttonText = '표시 모드 : 3';
        }
        toggleAminoAcidDisplayModeBtn.textContent = buttonText;
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // 초기화: 페이지 로드 시 코돈표 생성 및 UI 설정
    updateAminoAcidDisplayModeButtonText();
    updateCodonTable();
    updateUI('setup');
});
