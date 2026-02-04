/**
 * ============================================================================
 * what_and_why.js - What & Why Spiellogik (Generic Refactor)
 * ============================================================================
 * 
 * ZWECK:
 * Zweistufiges Lernspiel: Erst "Was" auswählen (Radio), dann passende
 * "Warum"-Begründungen markieren (Checkboxen). Beide werden separat bewertet.
 * Dynamisch konfigurierbar über JSON.
 * 
 * SPIELPRINZIP:
 * 1. STEP 1-Phase: Spieler wählt eine Option aus (Radio-Buttons)
 * 2. STEP 2-Phase: Basierend auf Step 1-Wahl erscheinen passende Begründungen
 * 3. Evaluation: Step 1 (0-1 Punkt) + Step 2 (0-1 Punkt) = max 2 Punkte pro Fall
 * 4. Nächster Fall oder Final Summary
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    class WhatAndWhy extends GameBase {
        constructor() {
            super({
                expectedGameType: 'what_and_why',
                rootElementId: 'game-root'
            });

            // Spiel-Daten (aus JSON)
            this.cases = [];              // Array von Cases
            this.configData = {};

            // Spiel-State
            this.order = [];              // Shuffled indices
            this.currentIndex = 0;
            this.scoreWhat = 0;           // Punkte für richtige What-Wahl
            this.scoreWhy = 0;            // Punkte für richtige Why-Begründungen
            this.evaluated = false;       // Aktueller Fall bewertet?
            this.selectedWhatId = null;   // Aktuell gewählte What-Option

            // DOM-Referenzen
            this.roundLabelEl = null;
            this.scoreFormEl = null;
            this.scoreReasonEl = null;
            this.scoreTotalEl = null;
            this.caseTextEl = null;
            this.caseTagsEl = null;
            this.formOptionsEl = null;
            this.reasonOptionsEl = null;
            this.feedbackBoxEl = null;
            this.infoSectionEl = null;
            this.summaryBoxEl = null;
            this.whyGroupEl = null;
            this.checkBtn = null;
            this.restartBtn = null;

            // Labels
            this.whatLabel = "What";
            this.whyLabel = "Why";
            this.step1Title = "1 · Auswahl";
            this.step2Title = "2 · Begründung";
        }

        onDataLoaded(data) {
            this.configData = data;

            // DOM-Referenzen holen
            this.roundLabelEl = document.getElementById('round-label');
            this.scoreFormEl = document.getElementById('score-form');
            this.scoreReasonEl = document.getElementById('score-reason');
            this.scoreTotalEl = document.getElementById('score-total');
            this.caseTextEl = document.getElementById('case-text');
            this.caseTagsEl = document.getElementById('case-tags');
            this.formOptionsEl = document.getElementById('form-options');
            this.reasonOptionsEl = document.getElementById('reason-options');
            this.feedbackBoxEl = document.getElementById('feedback-box');
            this.infoSectionEl = document.getElementById('info-section');
            this.summaryBoxEl = document.getElementById('summary-box');
            this.whyGroupEl = document.getElementById('why-group');
            this.checkBtn = document.getElementById('check-btn');
            this.restartBtn = document.getElementById('restart-btn');

            // Apply Data
            if (Array.isArray(data.cases)) {
                this.cases = data.cases;
            }

            // UI Labels anwenden
            this.applyUiLabels(data);

            if (data.title) {
                const titleEl = document.querySelector('.game-title');
                if (titleEl) titleEl.textContent = data.title;
                document.title = data.title;
            }

            if (data.description) {
                const descEl = document.querySelector('.game-description');
                if (descEl) descEl.textContent = data.description;
            }

            // Event-Listener
            this.checkBtn.addEventListener('click', () => this.nextStep());
            this.restartBtn.addEventListener('click', () => this.restart());

            // Spiel initialisieren
            if (this.cases.length === 0) {
                this.feedbackBoxEl.className = 'feedback error';
                this.feedbackBoxEl.textContent = 'Keine Cases gefunden.';
                this.checkBtn.disabled = true;
                this.restartBtn.disabled = true;
                return;
            }

            this.initOrder();
            this.renderCase();
        }

        applyUiLabels(data) {
            const labels = data.uiLabels || {};

            // Configurable "Topic" (optional)
            const topic = data.topic || "Antwort";

            // Labels for Badges
            this.whatLabel = labels.whatLabel || "What";
            this.whyLabel = labels.whyLabel || "Why";

            // Section Titles
            this.step1Title = labels.step1Title || `1 · ${topic} wählen`;
            this.step2Title = labels.step2Title || `2 · Begründung`;

            // Stat Labels
            if (labels.statRound) document.querySelector('.label-round').textContent = labels.statRound;
            if (labels.statWhat) document.querySelector('.label-what').textContent = labels.statWhat;
            if (labels.statWhy) document.querySelector('.label-why').textContent = labels.statWhy;
            if (labels.statTotal) document.querySelector('.label-total').textContent = labels.statTotal;

            // Update DOM Static Text
            const wTitleId = document.getElementById('what-section-title');
            if (wTitleId) wTitleId.textContent = this.step1Title;

            const yTitleId = document.getElementById('why-section-title');
            if (yTitleId) yTitleId.textContent = this.step2Title;

            if (labels.howto) {
                const hEl = document.getElementById('howto-text');
                if (hEl) hEl.innerHTML = `<strong>How to:</strong> ${labels.howto}`;
            }
        }

        shuffleArray(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        initOrder() {
            this.order = this.shuffleArray(this.cases.map((c, idx) => idx));
        }

        getCurrentCase() {
            return this.cases[this.order[this.currentIndex]];
        }

        renderCase() {
            const c = this.getCurrentCase();
            if (!c) {
                this.feedbackBoxEl.className = 'feedback error';
                this.feedbackBoxEl.textContent = 'Keine Falldaten gefunden.';
                this.checkBtn.disabled = true;
                this.restartBtn.disabled = true;
                return;
            }

            this.selectedWhatId = null;
            this.evaluated = false;

            // Round Label
            this.roundLabelEl.textContent = `${this.currentIndex + 1} / ${this.cases.length}`;

            // Case Text
            this.caseTextEl.textContent = c.profile;

            // Case Tags
            this.caseTagsEl.innerHTML = '';
            if (Array.isArray(c.tags)) {
                c.tags.forEach(tag => {
                    const span = document.createElement('span');
                    span.className = 'case-tag';
                    span.textContent = tag;
                    this.caseTagsEl.appendChild(span);
                });
            }

            // Step 1 Optionen rendern
            this.formOptionsEl.innerHTML = '';
            this.shuffleArray(c.options).forEach(option => {
                const li = document.createElement('li');
                li.className = 'option';
                const id = `what-${c.id}-${option.id}`;
                li.innerHTML = `
                    <label class="option-label" for="${id}">
                        <input type="radio" name="what" id="${id}" value="${option.id}">
                        <div class="option-text">
                            ${option.label}
                            <div class="option-badge">${this.whatLabel}</div>
                        </div>
                    </label>
                `;
                this.formOptionsEl.appendChild(li);
            });

            // Event-Listener für Toggle
            this.formOptionsEl
                .querySelectorAll('input[name="what"]')
                .forEach(input => input.addEventListener('change', (e) => this.onWhatChanged(e)));

            // Step 2 verstecken
            this.whyGroupEl.style.display = 'none';
            this.reasonOptionsEl.innerHTML = '';

            // Feedback zurücksetzen
            this.feedbackBoxEl.className = 'feedback';
            // Generic Prompt
            const prompt = this.configData.uiLabels?.promptStart || `Wähle zuerst eine Option bei "${this.step1Title}".`;
            this.feedbackBoxEl.innerHTML = prompt;

            this.infoSectionEl.innerHTML = '';
            this.checkBtn.disabled = false;
            this.checkBtn.innerHTML = '<span>✔</span> Antwort prüfen';
        }

        onWhatChanged(event) {
            const c = this.getCurrentCase();
            this.selectedWhatId = event.target.value;
            const option = c.options.find(o => o.id === this.selectedWhatId);
            if (!option) return;

            // Step 2 (Checkboxen) aufbauen
            this.reasonOptionsEl.innerHTML = '';
            if (Array.isArray(option.whys)) {
                this.shuffleArray(option.whys).forEach(why => {
                    const li = document.createElement('li');
                    li.className = 'option';
                    const id = `why-${c.id}-${this.selectedWhatId}-${why.id}`;
                    li.innerHTML = `
                        <label class="option-label" for="${id}">
                            <input type="checkbox" id="${id}" value="${why.id}">
                            <div class="option-text">
                                ${why.text}
                                <div class="option-badge">${this.whyLabel}</div>
                            </div>
                        </label>
                    `;
                    this.reasonOptionsEl.appendChild(li);
                });
            }

            // Enable Checkboxes
            this.reasonOptionsEl
                .querySelectorAll('input[type="checkbox"]')
                .forEach(cb => cb.disabled = false);

            // Anzeigen
            this.whyGroupEl.style.display = '';
            this.feedbackBoxEl.className = 'feedback';

            const promptStep2 = this.configData.uiLabels?.promptStep2 || `Jetzt passende Begründungen wählen und prüfen.`;
            this.feedbackBoxEl.innerHTML = promptStep2;
        }

        getSelectedReasons() {
            const checked = Array.from(this.reasonOptionsEl.querySelectorAll('input[type="checkbox"]:checked'));
            return checked.map(cb => cb.value);
        }

        evaluate() {
            if (this.evaluated) return;

            const c = this.getCurrentCase();
            if (!c) return;

            if (!this.selectedWhatId) {
                this.feedbackBoxEl.className = 'feedback error';
                this.feedbackBoxEl.textContent = 'Bitte zuerst eine Auswahl treffen.';
                return;
            }

            const option = c.options.find(o => o.id === this.selectedWhatId);
            if (!option) return;

            const selectedReasons = this.getSelectedReasons();

            // Sperren
            this.formOptionsEl.querySelectorAll('input').forEach(i => i.disabled = true);
            this.reasonOptionsEl.querySelectorAll('input').forEach(i => i.disabled = true);

            let whatPoints = 0;
            let whyPoints = 0;

            // Step 1 Bewertung
            const formLabels = this.formOptionsEl.querySelectorAll('.option-label');
            formLabels.forEach(lbl => {
                const input = lbl.querySelector('input');
                const optId = input.value;
                const opt = c.options.find(o => o.id === optId);

                if (opt && opt.isCorrect) {
                    lbl.classList.add('correct');
                }
                if (input.checked && (!opt || !opt.isCorrect)) {
                    lbl.classList.add('wrong');
                }
                lbl.classList.add('disabled');
            });

            if (option.isCorrect) {
                whatPoints = 1;
                this.scoreWhat += 1;
            }

            // Step 2 Bewertung
            const correctWhyIds = option.whys.filter(w => w.correct).map(w => w.id);
            const selectedSet = new Set(selectedReasons);
            const correctSet = new Set(correctWhyIds);

            const allMatch =
                correctSet.size === selectedSet.size &&
                [...correctSet].every(id => selectedSet.has(id));

            const reasonLabels = this.reasonOptionsEl.querySelectorAll('.option-label');
            reasonLabels.forEach(lbl => {
                const input = lbl.querySelector('input');
                const id = input.value;
                const isCorrect = correctSet.has(id);

                if (isCorrect) {
                    lbl.classList.add('correct');
                }
                if (input.checked && !isCorrect) {
                    lbl.classList.add('wrong');
                }
                lbl.classList.add('disabled');
            });

            if (allMatch && correctWhyIds.length > 0) {
                whyPoints = 1;
                this.scoreWhy += 1;
            }

            // Score aktualisieren
            const gained = whatPoints + whyPoints;
            this.scoreFormEl.textContent = this.scoreWhat;
            this.scoreReasonEl.textContent = this.scoreWhy;
            this.scoreTotalEl.textContent = this.scoreWhat + this.scoreWhy;

            // Feedback (Uses Generic Labels if possible)
            const feedbackLabels = this.configData.uiLabels?.feedback || {
                perfect: "Perfekt! Deine Wahl und Begründung sind korrekt. (+2)",
                p1_step1: "Auswahl korrekt (+1), aber Begründung nicht ganz.",
                p1_step2: "Begründung logisch (+1), aber falsche Grundauswahl.",
                fail: "Das war noch nicht richtig. (0)"
            };

            if (gained === 2) {
                this.feedbackBoxEl.className = 'feedback success';
                this.feedbackBoxEl.innerHTML = feedbackLabels.perfect;
            } else if (whatPoints === 1 && whyPoints === 0) {
                this.feedbackBoxEl.className = 'feedback';
                this.feedbackBoxEl.innerHTML = feedbackLabels.p1_step1;
            } else if (whatPoints === 0 && whyPoints === 1) {
                this.feedbackBoxEl.className = 'feedback';
                this.feedbackBoxEl.innerHTML = feedbackLabels.p1_step2;
            } else {
                this.feedbackBoxEl.className = 'feedback error';
                this.feedbackBoxEl.innerHTML = feedbackLabels.fail;
            }

            // Lösungshinweis
            if (c.solution) {
                this.infoSectionEl.innerHTML = `<strong>Lösungshinweis:</strong> ${c.solution}`;
            }

            this.evaluated = true;
            this.checkBtn.innerHTML =
                this.currentIndex < this.cases.length - 1
                    ? '<span>➡</span> Nächster Fall'
                    : '<span>📊</span> Auswertung';
        }

        showFinalSummary() {
            const maxWhat = this.cases.length;
            const maxWhy = this.cases.length;
            const total = this.scoreWhat + this.scoreWhy;
            const maxTotal = maxWhat + maxWhy;

            this.summaryBoxEl.innerHTML = `
                <strong>Auswertung:</strong><br>
                ${this.whatLabel}-Punkte: ${this.scoreWhat} / ${maxWhat}<br>
                ${this.whyLabel}-Punkte: ${this.scoreWhy} / ${maxWhy}<br>
                Gesamt: ${total} / ${maxTotal}<br><br>
            `;
            this.feedbackBoxEl.className = 'feedback';
            this.feedbackBoxEl.textContent = 'Spiel beendet.';
            this.checkBtn.disabled = true;
        }

        nextStep() {
            if (!this.evaluated) {
                this.evaluate();
            } else {
                if (this.currentIndex < this.cases.length - 1) {
                    this.currentIndex += 1;
                    this.renderCase();
                } else {
                    this.showFinalSummary();
                }
            }
        }

        restart() {
            this.scoreWhat = 0;
            this.scoreWhy = 0;
            this.currentIndex = 0;
            this.scoreFormEl.textContent = '0';
            this.scoreReasonEl.textContent = '0';
            this.scoreTotalEl.textContent = '0';
            this.summaryBoxEl.innerHTML = '';
            this.initOrder();
            this.renderCase();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new WhatAndWhy();
            game.init();
        });
    } else {
        const game = new WhatAndWhy();
        game.init();
    }
})();
