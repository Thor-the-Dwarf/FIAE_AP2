/**
 * ============================================================================
 * wer_bin_ich.js - Wer-bin-ich? Spiellogik (Generic Refactor)
 * ============================================================================
 * 
 * ZWECK:
 * Hauptlogik für das "Wer bin ich?"-Ratespiel. Erweitert GameBase.
 * Dynamisch konfigurierbar über JSON für verschiedene Themen (Rechtsformen, Tiere, etc.).
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    class WerBinIch extends GameBase {
        constructor() {
            super({
                expectedGameType: 'wer_bin_ich',
                rootElementId: 'game-root'
            });

            // Spiel-Daten (aus JSON)
            this.legalForms = [];     // Array von {id, name, attributes: {...}}
            this.questions = [];      // Array von {id, text, hotkey, attributeKey}
            this.configData = {};     // Full JSON data

            // Spiel-State
            this.secretForm = null;   // Aktuell geheimes Item
            this.questionCount = 0;   // Anzahl gestellter Fragen
            this.gameOver = false;    // Spiel gewonnen?

            // DOM-Referenzen
            this.questionListEl = null;
            this.questionCountEl = null;
            this.answerTextEl = null;
            this.historyListEl = null;
            this.answerButtons = null;
            this.newGameBtn = null;
            this.guessInput = null;
            this.guessBtn = null;
            this.guessFeedbackEl = null;

            // Generic UI Elements
            this.secretHintEl = null;
            this.poolListEl = null;
            this.answerSectionTitleEl = null;
            this.guessSectionTitleEl = null;
            this.poolSectionTitleEl = null;

        }

        onDataLoaded(data) {
            this.configData = data;

            // 1. DOM Referenzen
            this.questionListEl = document.getElementById('question-list');
            this.questionCountEl = document.getElementById('question-count');
            this.answerTextEl = document.getElementById('answer-text');
            this.historyListEl = document.getElementById('history-list');
            this.answerButtons = document.querySelectorAll('.answer-btn');
            this.newGameBtn = document.getElementById('new-game-btn');
            this.guessInput = document.getElementById('guess-input');
            this.guessBtn = document.getElementById('guess-btn');
            this.guessFeedbackEl = document.getElementById('guess-feedback');

            this.secretHintEl = document.getElementById('secret-hint');
            this.poolListEl = document.getElementById('pool-list');
            this.answerSectionTitleEl = document.getElementById('answer-section-title');
            this.guessSectionTitleEl = document.getElementById('guess-section-title');
            this.poolSectionTitleEl = document.getElementById('pool-section-title');

            // 2. Daten laden (Legal Forms = Generic Items)
            if (Array.isArray(data.legalForms)) {
                this.legalForms = data.legalForms;
            }
            if (Array.isArray(data.questions)) {
                this.questions = data.questions;
            }

            // 3. UI-Texte anwenden
            this.applyUiLabels(data);

            // 4. Titel setzen
            if (data.title) {
                const titleEl = document.querySelector('.game-title');
                if (titleEl) titleEl.textContent = data.title;
                document.title = data.title;
            }

            // 5. Pool Liste rendern
            this.renderPoolList();

            // 6. Event-Listener
            this.newGameBtn.addEventListener('click', () => this.startNewGame());
            this.guessBtn.addEventListener('click', () => this.handleGuess());
            this.guessInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    this.handleGuess();
                }
            });

            // 7. Spiel initialisieren
            this.initQuestionButtons();
            this.startNewGame();
        }

        /**
         * Wendet konfigurierbare UI-Labels an
         */
        applyUiLabels(data) {
            const labels = data.uiLabels || {};
            // "Topic" shortcut (e.g. "Rechtsform", "Tier", "Element")
            const topic = data.topic || labels.topic || "Element";

            // Default Fallbacks using Topic
            const secretHint = labels.secretHint || `Das System hat heimlich eine {item} gewählt.`;
            const poolTitle = labels.poolTitle || `Im Pool (${topic})`;
            const guessTitle = labels.guessTitle || `${topic} raten`;
            const answerTitle = labels.answerTitle || `Antwort (${topic})`;
            const placeholder = labels.placeholder || "...";

            // Subtitles
            const questionSubtitle = labels.questionSubtitle || "Klicke auf eine Frage, um sie zu stellen.";
            const guessSubtitle = labels.guessSubtitle || "Nutze deine Hinweise, um die Lösung zu finden.";

            // Apply
            if (this.secretHintEl) {
                this.secretHintEl.innerHTML = secretHint.replace('{item}', '<span class="secret-name">???</span>');
            }
            if (this.poolSectionTitleEl) this.poolSectionTitleEl.textContent = poolTitle;
            if (this.guessSectionTitleEl) this.guessSectionTitleEl.textContent = guessTitle;
            if (this.answerSectionTitleEl) this.answerSectionTitleEl.textContent = answerTitle;
            if (this.guessInput) this.guessInput.placeholder = placeholder;

            // Subtitles (need selector)
            const qSubEl = document.querySelector('#question-list')?.previousElementSibling;
            if (qSubEl && qSubEl.classList.contains('section-subtitle')) qSubEl.textContent = questionSubtitle;

            const gSubEl = document.querySelector('#guess-section-title')?.nextElementSibling;
            if (gSubEl && gSubEl.classList.contains('section-subtitle')) gSubEl.textContent = guessSubtitle;
        }

        renderPoolList() {
            if (!this.poolListEl) return;
            // Config override?
            if (this.configData.poolListHtml) {
                this.poolListEl.innerHTML = this.configData.poolListHtml;
            } else {
                this.poolListEl.innerHTML = this.legalForms
                    .map(form => `<li>${form.name}</li>`)
                    .join('');
            }
        }

        pickRandomForm() {
            const idx = Math.floor(Math.random() * this.legalForms.length);
            return this.legalForms[idx];
        }

        resetAnswerButtons() {
            this.answerButtons.forEach(btn => btn.classList.remove('active'));
        }

        setActiveAnswerButton(type) {
            this.resetAnswerButtons();
            const btn = document.querySelector(`.answer-btn[data-type="${type}"]`);
            if (btn) btn.classList.add('active');
        }

        updateQuestionCount() {
            this.questionCountEl.textContent = String(this.questionCount);
        }

        addHistoryEntry(question, answerIsYes) {
            const li = document.createElement('li');
            li.className = 'history-item';

            const qSpan = document.createElement('span');
            qSpan.className = 'history-question';
            qSpan.textContent = question.text;

            const pill = document.createElement('span');
            pill.className = 'pill ' + (answerIsYes ? 'pill-yes' : 'pill-no');
            pill.textContent = answerIsYes ? 'Ja' : 'Nein';

            li.appendChild(qSpan);
            li.appendChild(pill);
            this.historyListEl.prepend(li);
        }

        askQuestion(question, btnEl) {
            if (!this.secretForm || this.gameOver) return;

            if (btnEl) btnEl.classList.add('used');

            this.questionCount++;
            this.updateQuestionCount();

            const answerIsYes = this.evaluateQuestion(question, this.secretForm);
            this.setActiveAnswerButton(answerIsYes ? 'yes' : 'no');

            this.answerTextEl.textContent =
                (answerIsYes ? 'Ja' : 'Nein') + ' – ' + question.text;

            this.addHistoryEntry(question, answerIsYes);
        }

        evaluateQuestion(question, form) {
            // Json-based attribute check
            if (question.attributeKey && form.attributes) {
                return !!form.attributes[question.attributeKey];
            }
            // Fallback function (if data is JS-based)
            if (typeof question.evaluate === 'function') {
                return !!question.evaluate(form);
            }
            return false;
        }

        shuffleArray(arr) {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        initQuestionButtons() {
            this.questionListEl.innerHTML = '';
            const shuffledInputs = this.shuffleArray(this.questions);
            shuffledInputs.forEach(q => {
                const btn = document.createElement('button');
                btn.className = 'question-btn';
                btn.type = 'button';

                const spanText = document.createElement('span');
                spanText.className = 'text';
                spanText.textContent = q.text;

                const spanHotkey = document.createElement('span');
                spanHotkey.className = 'hotkey';
                spanHotkey.textContent = 'Frage #' + (q.hotkey || '');

                btn.appendChild(spanText);
                btn.appendChild(spanHotkey);
                btn.addEventListener('click', (e) => this.askQuestion(q, e.currentTarget));
                this.questionListEl.appendChild(btn);
            });
        }

        sanitizeGuess(value) {
            return value.toLowerCase().replace(/\s+/g, '').replace(/[().-]/g, '');
        }

        findFormByGuess(value) {
            const sanitized = this.sanitizeGuess(value);
            if (!sanitized) return null;
            return this.legalForms.find(form => {
                const formNameSanitized = this.sanitizeGuess(form.name);
                return formNameSanitized === sanitized;
            }) || null;
        }

        handleGuess() {
            if (!this.secretForm) return;

            const guess = this.guessInput.value.trim();
            if (!guess) {
                this.guessFeedbackEl.textContent = 'Gib etwas ein, bevor du rätst.';
                this.guessFeedbackEl.className = 'error';
                return;
            }

            const guessedForm = this.findFormByGuess(guess);

            if (!guessedForm) {
                this.guessFeedbackEl.textContent = 'Dies ist nicht im Pool der Möglichkeiten.';
                this.guessFeedbackEl.className = 'error';
                return;
            }

            if (guessedForm.id === this.secretForm.id) {
                // WIN
                this.gameOver = true;
                this.guessFeedbackEl.textContent = `Richtig! Es war: ${this.secretForm.name}. Starte eine neue Runde.`;
                this.guessFeedbackEl.className = 'success';

                // Reveal in hint
                this.updateSecretHint(true);

            } else {
                // LOSE
                this.guessFeedbackEl.textContent = 'Leider falsch. Versuche es weiter.';
                this.guessFeedbackEl.className = 'error';
            }
        }

        updateSecretHint(reveal) {
            if (!this.secretHintEl) return;
            const labels = this.configData.uiLabels || {};
            const secretHintTemplate = labels.secretHint || "Das System hat heimlich eine {item} gewählt.";

            const topic = this.configData.topic || this.configData.uiLabels?.topic || "Rechtsform";
            const name = reveal ? this.secretForm.name : (labels.secretPlaceholder || topic);

            // If strictly generic, we might want a generic placeholder from JSON like "Entity"
            // For now, let's look for a specific 'secretItemName' in uiLabels
            const secretItemName = labels.secretItemName || topic;

            const display = reveal ? `<span class="secret-name highlight">${name}</span>` : `<span class="secret-name">${secretItemName}</span>`;

            this.secretHintEl.innerHTML = secretHintTemplate.replace('{item}', display);
        }

        setQuestionButtonsDisabled(disabled) {
            const buttons = document.querySelectorAll('.question-btn');
            buttons.forEach(btn => {
                if (disabled) btn.classList.add('disabled');
                else btn.classList.remove('disabled');
            });
        }

        startNewGame() {
            if (this.legalForms.length === 0) {
                this.answerTextEl.textContent = 'Keine Daten verfügbar.';
                return;
            }

            this.secretForm = this.pickRandomForm();
            this.questionCount = 0;
            this.gameOver = false;

            this.updateQuestionCount();
            this.resetAnswerButtons();

            this.historyListEl.innerHTML = '';

            // Generic restart message
            const restartMsg = this.configData.uiLabels?.startMessage || 'Neue Runde gestartet. Stelle eine Frage.';
            this.answerTextEl.textContent = restartMsg;

            this.guessInput.value = '';
            this.guessFeedbackEl.textContent = '';
            this.guessFeedbackEl.className = '';

            // Reset Hint (Hide Secret)
            this.updateSecretHint(false);

            this.setQuestionButtonsDisabled(false);
            const usedButtons = document.querySelectorAll('.question-btn.used');
            usedButtons.forEach(btn => btn.classList.remove('used'));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new WerBinIch();
            game.init();
        });
    } else {
        const game = new WerBinIch();
        game.init();
    }
})();
