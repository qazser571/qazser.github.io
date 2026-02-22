document.addEventListener('DOMContentLoaded', () => {
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

    const groupedCodonBlocks = [
        ['U', 'U', [0, 1]], ['U', 'C', [2]], ['U', 'A', [3, 4]], ['U', 'G', [5, 6, 7]],
        ['C', 'U', [8]], ['C', 'C', [9]], ['C', 'A', [10, 11]], ['C', 'G', [12]],
        ['A', 'U', [13, 14]], ['A', 'C', [15]], ['A', 'A', [16, 17]], ['A', 'G', [18, 19]],
        ['G', 'U', [20]], ['G', 'C', [21]], ['G', 'A', [22, 23]], ['G', 'G', [24]]
    ];

    // #codon-table-area 대신 #codon-grid-container를 참조하도록 변경
    const codonGridContainer = document.getElementById('codon-grid-container'); 

    const quizMode1Btn = document.getElementById('quiz-mode1-btn');
    const quizMode2Btn = document.getElementById('quiz-mode2-btn');
    const quizSelectAllBtn = document.getElementById('quiz-select-all-btn');
    const quizStartBtn = document.getElementById('quiz-start-btn');
    const currentQuestionDisplay = document.getElementById('current-question');
    const nextBtn = document.getElementById('next-btn');
    const hideCodonBtn = document.getElementById('hide-codon-btn');
    const hideAminoBtn = document.getElementById('hide-amino-btn');
    const aminoModeBtn = document.getElementById('amino-mode-btn');

    const quizReportArea = document.getElementById('quiz-report-area');
    const controlAreaTitles = document.querySelectorAll('#control-area .control-area-title');
    const quizModeTitle = document.querySelector('#quiz-mode .setting-title');
    const quizSelectTitle = document.querySelector('#quiz-select .setting-title');
    const quizStartTitle = document.querySelector('#quiz-start .setting-title');

    let showCodons = true;
    let showAminoAcids = true;
    let aminoAcidDisplayMode = 0;
    let currentPhase = 'setup';

    let quizActive = false;
    let currentQuestionIndex = 0;
    let quizQuestions = [];
    let incorrectAnswers = [];
    let currentQuizMode = 'codonToAmino';

    function updateUI(phase) {
        currentPhase = phase; 
    }

    function setButtonState(buttonElement, state) {
        buttonElement.classList.remove('btn-active', 'btn-ready', 'btn-disabled', 'btn-working');
        buttonElement.classList.add(`btn-${state}`);
    }

    function generateQuizQuestions() {
        if (quizQuestions.length === 0) {
            quizQuestions = [...codonData];
        } else {
            quizQuestions = Array.from(quizQuestions).map(index => codonData[index]);
        }
        quizQuestions.sort(() => Math.random() - 0.5);
    }

    function displayQuestion() {
        if (currentQuestionIndex < quizQuestions.length) {
            const questionData = quizQuestions[currentQuestionIndex];
            let questionText = '';
            if (currentQuizMode === 'codonToAmino') {
                questionText = questionData[0][Math.floor(Math.random() * questionData[0].length)];
            } else {
                questionText = questionData[1];
            }
            currentQuestionDisplay.textContent = questionText;

            document.querySelectorAll('.codon-group-cell').forEach(cell => {
                cell.classList.remove('correct-answer-bg', 'incorrect-answer-bg');
            });
            codonGridContainer.style.pointerEvents = 'auto'; // codonTableArea -> codonGridContainer

        } else {
            let message = "모든 문제를 풀었습니다.";
            if (incorrectAnswers.length > 0) {
                message += `\n총 ${incorrectAnswers.length}개의 틀린 문제가 있습니다. 틀린 문제를 다시 보시겠습니까?`;
                if (confirm(message)) {
                    quizQuestions = [...incorrectAnswers];
                    incorrectAnswers = [];
                    currentQuestionIndex = 0;
                    displayQuestion();
                } else {
                    resetQuiz();
                }
            } else {
                message += "\n모든 문제를 맞췄습니다! 다시 시작하시겠습니까?";
                if (confirm(message)) {
                    resetQuiz();
                } else {
                    resetQuiz();
                }
            }
        }
    }

    function checkAnswer(selectedCell) {
        if (!quizActive) return;

        const selectedDataIndex = parseInt(selectedCell.dataset.index);
        const questionData = quizQuestions[currentQuestionIndex];
        let isCorrect = false;

        if (currentQuizMode === 'codonToAmino') {
            const currentQuestionCodon = currentQuestionDisplay.textContent;
            const correctAminoAcidName = questionData[1];
            const selectedAminoAcidName = codonData[selectedDataIndex][1];
            isCorrect = (correctAminoAcidName === selectedAminoAcidName && questionData[0].includes(currentQuestionCodon));
        } else {
            const currentQuestionAminoAcid = currentQuestionDisplay.textContent;
            const correctCodons = questionData[0];
            const selectedCodonGroupAminoAcid = codonData[selectedDataIndex][1];
            isCorrect = (currentQuestionAminoAcid === selectedCodonGroupAminoAcid);
        }

        if (isCorrect) {
            selectedCell.classList.add('correct-answer-bg');
        } else {
            selectedCell.classList.add('incorrect-answer-bg');
            if (!incorrectAnswers.includes(questionData)) {
                incorrectAnswers.push(questionData);
            }
        }
        codonGridContainer.style.pointerEvents = 'none'; // codonTableArea -> codonGridContainer
        setButtonState(nextBtn, 'ready');
    }

    function resetQuiz() {
        quizActive = false;
        currentQuestionIndex = 0;
        incorrectAnswers = [];
        quizQuestions = [];

        quizReportArea.style.display = 'none';
        currentQuestionDisplay.textContent = 'UGA';
        setButtonState(nextBtn, 'disabled');

        document.querySelectorAll('.codon-group-cell.selected-for-game').forEach(cell => {
            cell.classList.remove('selected-for-game');
        });
        codonGridContainer.classList.remove('selection-mode'); // codonTableArea -> codonGridContainer
        codonGridContainer.style.pointerEvents = 'auto'; // codonTableArea -> codonGridContainer

        updateHideButtonClasses(hideCodonBtn, !showCodons);
        updateHideButtonClasses(hideAminoBtn, !showAminoAcids);
        setButtonState(aminoModeBtn, 'active');
    }


    function updateCodonTable() {
        codonGridContainer.innerHTML = ''; // codonTableArea -> codonGridContainer
        const firstBases = ['U', 'C', 'A', 'G'];
        const secondBases = ['U', 'C', 'A', 'G'];

        for (let i = 0; i < firstBases.length; i++) {
            for (let j = 0; j < secondBases.length; j++) {
                const currentFirstBase = firstBases[i];
                const currentSecondBase = secondBases[j];

                const blockInfo = groupedCodonBlocks.find(block =>
                    block[0] === currentFirstBase && block[1] === currentSecondBase
                );

                const codonBlock = document.createElement('div');
                codonBlock.classList.add('codon-block');
                codonGridContainer.appendChild(codonBlock); // codonTableArea -> codonGridContainer

                if (blockInfo) {
                    const actualCodonBlockHeight = codonBlock.offsetHeight;

                    let totalCodonsInThisBlock = 0;
                    blockInfo[2].forEach(dataIndex => {
                        totalCodonsInThisBlock += codonData[dataIndex][0].length;
                    });

                    if (totalCodonsInThisBlock === 0) {
                        console.warn(`Warning: totalCodonsInThisBlock is 0 for block ${currentFirstBase}${currentSecondBase}`);
                        continue;
                    }

                    blockInfo[2].forEach(dataIndex => {
                        const group = codonData[dataIndex];
                        const [codons, aminoAcidName, aminoAcidAbbr] = group;
                        const numCodonsInGroup = codons.length;

                        const cell = document.createElement('div');
                        cell.classList.add('codon-group-cell');
                        cell.dataset.index = dataIndex;
                        cell.addEventListener('click', () => {
                            if (codonGridContainer.classList.contains('selection-mode')) { // codonTableArea -> codonGridContainer
                                toggleCellSelection(cell);
                            } else if (quizActive) {
                                checkAnswer(cell);
                            }
                        }); 

                        const proportionalHeight = (numCodonsInGroup / totalCodonsInThisBlock) * actualCodonBlockHeight;
                        cell.style.height = `${proportionalHeight}px`;


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
                        if (aminoAcidName === '종결코돈') {
                            displayText = '종결코돈';
                        } else {
                            if (aminoAcidDisplayMode === 0) {
                                displayText = `${aminoAcidName}(${aminoAcidAbbr})`;
                            } else if (aminoAcidDisplayMode === 1) {
                                displayText = aminoAcidName;
                            } else {
                                displayText = aminoAcidAbbr;
                            }
                        }
                        aminoAcidDiv.textContent = displayText;
                        cell.appendChild(aminoAcidDiv);

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
                        
                        // if (selectedCodonGroups.has(dataIndex)) { // setting-area 제어 코드 제거로 인해 사용되지 않음
                        //     cell.classList.add('selected-for-game');
                        // }
                    });
                }
            }
        }
        updateUI(currentPhase); 
        reapplyCurrentQuestionState();
    }

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
        reapplyCurrentQuestionState();
    }

    function reapplyCurrentQuestionState() {
    }

    function updateAminoAcidDisplayModeButtonText() {
        let buttonText = '';
        if (aminoAcidDisplayMode === 0) {
            buttonText = '메싸이오닌(M)';
        } else if (aminoAcidDisplayMode === 1) {
            buttonText = '메싸이오닌';
        } else {
            buttonText = 'M';
        }
        aminoModeBtn.textContent = buttonText;
    }

    function updateHideButtonClasses(buttonElement, isHidden) {
        buttonElement.classList.remove('btn-active', 'btn-ready');
        if (isHidden) {
            buttonElement.classList.add('btn-active');
        } else {
            buttonElement.classList.add('btn-ready');
        }
    }

    hideCodonBtn.addEventListener('click', () => {
        showCodons = !showCodons;
        updateHideButtonClasses(hideCodonBtn, !showCodons);
        updateCodonCellVisibility();
    });

    hideAminoBtn.addEventListener('click', () => {
        showAminoAcids = !showAminoAcids;
        updateHideButtonClasses(hideAminoBtn, !showAminoAcids);
        updateCodonCellVisibility();
    });

    aminoModeBtn.addEventListener('click', () => {
        aminoAcidDisplayMode = (aminoAcidDisplayMode + 1) % 3;
        updateAminoAcidDisplayModeButtonText();
        updateCodonTable();
    });

    nextBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        setButtonState(nextBtn, 'disabled');
        displayQuestion();
    });

    setTimeout(() => {
        requestAnimationFrame(() => {
            controlAreaTitles.forEach(title => {
                title.classList.add('control-area-title-active');
                void title.offsetWidth;
            });
            updateHideButtonClasses(hideCodonBtn, !showCodons);
            updateHideButtonClasses(hideAminoBtn, !showAminoAcids);
            setButtonState(aminoModeBtn, 'active');
        });
    }, 1000);

    updateAminoAcidDisplayModeButtonText();
    updateCodonTable();
    updateUI('setup');
});