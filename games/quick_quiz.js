/**
 * ============================================================================
 * quick_quiz.js - Quick-Quiz Spiellogik (Generic Refactor)
 * ============================================================================
 * 
 * ZWECK:
 * Zeitbasiertes Quiz-Spiel mit Score-Tracking und Highscore.
 * Erweitert GameBase für JSON-Loading.
 * Dynamisch konfigurierbar über JSON (Text, Labels, Zeit).
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    class QuickQuiz extends GameBase {
        constructor() {
            super({
                expectedGameType: 'quick_quiz',
                rootElementId: 'game-root'
            });

            // Spiel-Daten (aus JSON)
            this.answerLabels = [];         // Array von String (Button-Labels)
            this.questions = [];            // Array von {text, correct}
            this.timePerQuestion = 12;      // Sekunden pro Frage
            this.configData = {};           // Full JSON data

            // Spiel-State
            this.score = 0;
            this.highscore = 0;
            this.questionCount = 0;
            this.streak = 0;
            this.currentQuestion = null;
            this.remainingTime = this.timePerQuestion;
            this.timerId = null;
            this.locked = true;             // Buttons gesperrt
            this.hasStarted = false;        // Spiel wurde gestartet

            // DOM-Referenzen
            this.questionTextEl = null;
            this.sublineEl = null;
            this.optionsContainer = null;
            this.feedbackEl = null;
            this.scoreEl = null;
            this.highscoreEl = null;
            this.questionCountEl = null;
            this.streakEl = null;
            this.timerLabelEl = null;
            this.timerBarInnerEl = null;
            this.restartBtn = null;
            this.restartIconEl = null;
            this.restartLabelEl = null;
            this.sectionTitleEl = null;

            // Labels
            this.startLabel = "Start";
            this.restartLabel = "Start";
        }

        onDataLoaded(data) {
            this.configData = data;

            // DOM-Referenzen holen
            this.questionTextEl = document.getElementById('question-text');
            this.sublineEl = document.getElementById('subline');
            this.optionsContainer = document.getElementById('options');
            this.feedbackEl = document.getElementById('feedback');
            this.scoreEl = document.getElementById('score');
            this.highscoreEl = document.getElementById('highscore');
            this.questionCountEl = document.getElementById('question-count');
            this.streakEl = document.getElementById('streak');
            this.timerLabelEl = document.getElementById('timer-label');
            this.timerBarInnerEl = document.getElementById('timer-bar-inner');
            this.restartBtn = document.getElementById('restart-btn');
            this.restartIconEl = document.getElementById('restart-icon');
            this.restartLabelEl = document.getElementById('restart-label');
            this.sectionTitleEl = document.getElementById('question-section-title');

            // Apply Data
            if (Array.isArray(data.answerLabels)) {
                this.answerLabels = data.answerLabels;
            }
            if (Array.isArray(data.questions)) {
                this.questions = data.questions;
            }
            if (typeof data.timePerQuestionSeconds === 'number') {
                this.timePerQuestion = data.timePerQuestionSeconds;
                this.remainingTime = this.timePerQuestion;
            }

            // Apply UI Labels
            this.applyUiLabels(data);

            if (data.title) {
                const titleEl = document.querySelector('.game-title');
                if (titleEl) titleEl.textContent = data.title;
                document.title = data.title;
            }

            // Event-Listener
            this.restartBtn.addEventListener('click', () => this.handleRestartClick());

            // UI initialisieren
            this.renderOptions();
            this.setOptionsDisabled(true);
            this.updateStats();
            this.timerLabelEl.textContent = '– s';
            this.timerBarInnerEl.style.transform = 'scaleX(0)';
            this.updateRestartButton();
        }

        applyUiLabels(data) {
            const labels = data.uiLabels || {};

            // Intro text mapping
            const intro = labels.introText || data.introText || "Klick auf Start";
            if (this.questionTextEl) this.questionTextEl.textContent = intro;

            const sub = labels.sublineText || data.sublineText || "";
            if (this.sublineEl) this.sublineEl.textContent = sub;

            // Static labels
            if (labels.sectionTitle && this.sectionTitleEl) this.sectionTitleEl.textContent = labels.sectionTitle;

            if (labels.statScore) document.getElementById('label-score').textContent = labels.statScore;
            if (labels.statHighscore) document.getElementById('label-highscore').textContent = labels.statHighscore;
            if (labels.statQuestions) document.getElementById('label-questions').textContent = labels.statQuestions;
            if (labels.statStreak) document.getElementById('label-streak').textContent = labels.statStreak;
            if (labels.labelTimer) document.getElementById('label-timer').textContent = labels.labelTimer;

            this.startLabel = labels.btnStart || "Start";
            this.restartLabel = labels.btnRestart || "Neustart";
        }

        updateStats() {
            this.scoreEl.textContent = String(this.score);
            this.highscoreEl.textContent = String(this.highscore);
            this.questionCountEl.textContent = String(this.questionCount);
            this.streakEl.textContent = String(this.streak);
        }

        resetFeedback() {
            this.feedbackEl.textContent = '';
            this.feedbackEl.className = '';
        }

        stopTimer() {
            if (this.timerId !== null) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
        }

        updateTimerUI() {
            this.timerLabelEl.textContent = `${this.remainingTime.toFixed(1)} s`;
            const factor = Math.max(0, Math.min(1, this.remainingTime / this.timePerQuestion));
            this.timerBarInnerEl.style.transform = `scaleX(${factor})`;
        }

        startTimer() {
            this.stopTimer();
            this.remainingTime = this.timePerQuestion;
            this.updateTimerUI();

            this.timerId = setInterval(() => {
                this.remainingTime -= 0.1;
                if (this.remainingTime <= 0) {
                    this.remainingTime = 0;
                    this.updateTimerUI();
                    this.stopTimer();
                    this.handleTimeout();
                } else {
                    this.updateTimerUI();
                }
            }, 100);
        }

        renderOptions() {
            this.optionsContainer.innerHTML = '';
            // Shuffle labels for display to prevent patterns
            const labels = this.shuffleArray([...this.answerLabels]);
            labels.forEach(label => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = label;
                btn.dataset.value = label;
                btn.addEventListener('click', () => this.handleAnswer(label));
                this.optionsContainer.appendChild(btn);
            });
        }

        setOptionsDisabled(disabled) {
            const buttons = this.optionsContainer.querySelectorAll('.option-btn');
            buttons.forEach(btn => {
                if (disabled) {
                    btn.classList.add('disabled');
                    btn.disabled = true;
                } else {
                    btn.classList.remove('disabled');
                    btn.disabled = false;
                    btn.classList.remove('correct', 'wrong');
                }
            });
        }

        // Shuffle-Array Helper
        shuffleArray(arr) {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        pickRandomQuestion() {
            const shuffled = this.shuffleArray(this.questions);
            return shuffled[0];
        }

        nextQuestion() {
            if (!this.questions.length) {
                this.questionTextEl.textContent = 'Keine Fragen definiert.';
                return;
            }

            this.locked = false;
            this.resetFeedback();
            this.setOptionsDisabled(false);
            this.currentQuestion = this.pickRandomQuestion();
            this.questionTextEl.textContent = this.currentQuestion.text;
            this.questionCount++;
            this.updateStats();
            this.startTimer();
        }

        handleTimeout() {
            if (this.locked) return;
            this.locked = true;
            this.setOptionsDisabled(true);

            this.streak = 0;
            this.updateStats();

            // Richtige Antwort markieren
            const buttons = this.optionsContainer.querySelectorAll('.option-btn');
            buttons.forEach(btn => {
                if (btn.dataset.value === this.currentQuestion.correct) {
                    btn.classList.add('correct');
                }
            });

            const labels = this.configData.uiLabels?.feedback || {};
            const msg = labels.timeout || `Zeit abgelaufen! Richtig wäre: ${this.currentQuestion.correct}.`;
            this.feedbackEl.textContent = msg;
            this.feedbackEl.className = 'error';

            setTimeout(() => {
                this.nextQuestion();
            }, 900);
        }

        handleAnswer(selected) {
            if (this.locked) return;
            this.locked = true;
            this.stopTimer();
            this.setOptionsDisabled(true);

            const isCorrect = selected === this.currentQuestion.correct;

            const labels = this.configData.uiLabels?.feedback || {};

            // Buttons markieren
            const buttons = this.optionsContainer.querySelectorAll('.option-btn');
            buttons.forEach(btn => {
                const value = btn.dataset.value;
                if (value === this.currentQuestion.correct) {
                    btn.classList.add('correct');
                }
                if (value === selected && !isCorrect) {
                    btn.classList.add('wrong');
                }
            });

            if (isCorrect) {
                this.score++;
                this.streak++;
                if (this.score > this.highscore) {
                    this.highscore = this.score;
                }
                const msg = labels.correct || 'Korrekt – weiter!';
                this.feedbackEl.textContent = msg;
                this.feedbackEl.className = 'ok';
            } else {
                this.streak = 0;
                const msg = (labels.wrong || "Falsch. Richtig wäre: {correct}.").replace('{correct}', this.currentQuestion.correct);
                this.feedbackEl.textContent = msg;
                this.feedbackEl.className = 'error';
            }

            this.updateStats();

            setTimeout(() => {
                this.nextQuestion();
            }, 800);
        }

        restartGame() {
            this.score = 0;
            this.streak = 0;
            this.questionCount = 0;
            this.resetFeedback();
            this.updateStats();
            this.renderOptions();
            this.nextQuestion();
        }

        updateRestartButton() {
            if (!this.hasStarted) {
                this.restartBtn.classList.remove('running');
                this.restartIconEl.textContent = '▶';
                this.restartLabelEl.textContent = this.startLabel;
            } else {
                this.restartBtn.classList.add('running');
                this.restartIconEl.textContent = '↻';
                this.restartLabelEl.textContent = this.restartLabel;
            }
        }

        handleRestartClick() {
            if (!this.hasStarted) {
                this.hasStarted = true;
            }
            this.restartGame();
            this.updateRestartButton();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new QuickQuiz();
            game.init();
        });
    } else {
        const game = new QuickQuiz();
        game.init();
    }
})();
