(function () {
    'use strict';

    class EscapeGame extends window.GameBase {
        constructor() {
            super({
                expectedGameType: 'escape_game',
                rootElementId: 'game-root'
            });

            // Game State
            this.START_SECONDS = 900;
            this.remainingSeconds = this.START_SECONDS;
            this.timerId = null;
            this.gameLocked = false;

            // Generic section tracking
            // We store solution data by section ID
            this.sectionData = {};
            this.solvedSections = new Set();
            this.totalSections = 0;

            this.draggingCardId = null;

            // DOM Elements
            this.statTimerEl = null;
            this.statSolvedEl = null;
            this.doorEl = null;
            this.doorSignEl = null;
            this.doorGlowEl = null;
            this.puzzleContainer = null;
        }

        onDataLoaded(data) {
            // 1. Setup global stats
            this.statTimerEl = document.getElementById("stat-timer");
            this.statSolvedEl = document.getElementById("stat-solved");

            this.doorEl = document.getElementById("door");
            this.doorSignEl = document.getElementById("door-sign");
            this.doorGlowEl = document.getElementById("door-glow");

            this.puzzleContainer = document.getElementById("puzzle-container");

            // Buttons
            const restartBtn = document.getElementById("restart-btn");
            if (restartBtn) restartBtn.addEventListener("click", () => this.resetGame());

            // 2. Render Sections
            this.renderSections(data.sections || []);

            // 3. Start
            this.resetGame();
        }

        renderSections(sections) {
            this.puzzleContainer.innerHTML = "";
            this.sectionData = {};
            this.totalSections = sections.length;
            this.solvedSections.clear();

            // Randomize Sections Order if desired? Maybe better to keep section order for narrative?
            // User said "sämtliche positionen". But sections usually follow a path.
            // If sections are independent, we could shuffle them. But usually escape game is linear or parallel.
            // I'll leave sections order but shuffle content.

            sections.forEach(section => {
                // Determine container
                const sectionEl = document.createElement("section");
                sectionEl.className = "section-card";
                sectionEl.id = `section-${section.id}`; // consistent ID for styling if needed

                // Header
                const header = document.createElement("div");
                header.className = "section-header";
                header.innerHTML = `
                    <div>
                        <div class="section-title">${section.title || 'Rätsel'}</div>
                        <div class="section-sub">${section.subtitle || ''}</div>
                    </div>
                    <div class="section-status" id="status-${section.id}">offen</div>
                `;
                sectionEl.appendChild(header);

                // Body container
                const body = document.createElement("div");
                body.className = "section-body";
                sectionEl.appendChild(body);

                // Footer container
                const footer = document.createElement("div");
                footer.className = "section-footer";
                sectionEl.appendChild(footer);

                // Check button
                const checkBtn = document.createElement("button");
                checkBtn.className = "btn";
                checkBtn.type = "button";
                checkBtn.innerHTML = `<span>✔</span> Prüfen`;
                checkBtn.addEventListener("click", () => this.checkSection(section.id));
                footer.appendChild(checkBtn);

                // Render specific type
                if (section.type === "sort") {
                    this.renderSort(section, body);
                } else if (section.type === "quiz") {
                    this.renderQuiz(section, body);
                } else if (section.type === "capital") {
                    this.renderCapital(section, body);
                } else {
                    body.textContent = "Unknown Type: " + section.type;
                }

                // Store data for validation
                this.sectionData[section.id] = section;
                this.puzzleContainer.appendChild(sectionEl);
            });
        }

        // --- Renderers ---

        shuffleArray(arr) {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        renderSort(section, container) {
            // Pool
            const pool = document.createElement("div");
            pool.className = "sort-pool";
            pool.id = `pool-${section.id}`;
            container.appendChild(pool);

            // Board
            const board = document.createElement("div");
            board.className = "sort-board";
            container.appendChild(board);

            // Create Zones
            this.shuffleArray(section.sortColumns || []).forEach(col => {
                const zone = document.createElement("div");
                zone.className = "escape-dropzone";
                zone.dataset.zone = col.zone;

                // Drag Events
                zone.addEventListener("dragover", (e) => this.handleDragOverZone(e));
                zone.addEventListener("dragleave", (e) => this.handleDragLeaveZone(e));
                zone.addEventListener("drop", (e) => this.handleDropZone(e));

                const label = document.createElement("div");
                label.className = "escape-dropzone-label";
                label.innerHTML = `${col.label}<br><span style="font-size:10px;color:hsl(var(--txt-muted));">${col.hint || ''}</span>`;
                zone.appendChild(label);
                board.appendChild(zone);
            });

            // Populate Cards (Initial) in resetGame usually, but can do here if we just reset later
            // We just store cards data in sectionData and let resetGame handle filling the pool? 
            // Better: Render them now, resetGame essentially just moves them back.
            // Actually resetGame triggers "resetSortBoard" for all sort sections.
        }

        renderQuiz(section, container) {
            (section.questions || []).forEach(q => {
                const qDiv = document.createElement("div");
                qDiv.className = "quiz-question";
                qDiv.dataset.quizId = q.id;

                const text = document.createElement("div");
                text.className = "quiz-text";
                text.textContent = q.text;
                qDiv.appendChild(text);

                const ul = document.createElement("ul");
                ul.className = "quiz-options";
                this.shuffleArray(q.options || []).forEach(opt => {
                    const li = document.createElement("li");
                    li.innerHTML = `<label><input type="radio" name="${section.id}_${q.id}" value="${opt.value}"> ${opt.text}</label>`;
                    ul.appendChild(li);
                });
                qDiv.appendChild(ul);
                container.appendChild(qDiv);
            });
            const feedback = document.createElement("div");
            feedback.className = "quiz-feedback";
            feedback.id = `feedback-${section.id}`;
            feedback.textContent = section.hintDefault || "Wähle je Frage eine Antwort";
            container.appendChild(feedback);
        }

        renderCapital(section, container) {
            // Table structure
            const table = document.createElement("table");
            table.className = "capital-table";
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>${section.col1Title || 'Item'}</th>
                        <th>${section.col2Title || 'Zuordnung'}</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector("tbody");

            this.shuffleArray(section.rows || []).forEach(row => {
                const tr = document.createElement("tr");
                const tdLabel = document.createElement("td");
                tdLabel.textContent = row.label;
                const tdInput = document.createElement("td");

                const select = document.createElement("select");
                select.dataset.rowKey = row.key;
                select.dataset.sectionId = section.id;

                // Options
                this.shuffleArray(row.options || []).forEach(opt => {
                    const option = document.createElement("option");
                    option.value = opt.value;
                    option.textContent = opt.text;
                    select.appendChild(option);
                });

                tdInput.appendChild(select);
                tr.appendChild(tdLabel);
                tr.appendChild(tdInput);
                tbody.appendChild(tr);
            });
            container.appendChild(table);
        }

        // --- Timer logic (mostly same) ---
        startTimer() {
            if (this.timerId) clearInterval(this.timerId);
            this.timerId = setInterval(() => this.tickTimer(), 1000);
        }

        tickTimer() {
            if (this.gameLocked) return;
            this.remainingSeconds -= 1;
            if (this.remainingSeconds <= 0) {
                this.remainingSeconds = 0;
                this.updateTimerDisplay();
                this.handleTimeUp();
                return;
            }
            this.updateTimerDisplay();
        }

        updateTimerDisplay() {
            if (!this.statTimerEl) return;
            this.statTimerEl.textContent = this.formatTime(this.remainingSeconds);
            this.statTimerEl.style.color = this.remainingSeconds <= 10 ? 'hsl(var(--error))' : 'var(--text)';
        }

        formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
        }

        handleTimeUp() {
            if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
            this.gameLocked = true;
            this.doorSignEl.textContent = "ZU SPÄT";
            this.doorSignEl.classList.remove("door-sign--open");
            this.doorSignEl.classList.add("door-sign--closed");
            this.doorEl.classList.remove("door--open");
            this.doorGlowEl.classList.remove("door-glow--active");
            this._disableAllButtons();
        }

        _disableAllButtons() {
            document.querySelectorAll(".section-footer .btn").forEach(b => b.disabled = true);
        }

        _enableAllButtons() {
            document.querySelectorAll(".section-footer .btn").forEach(b => b.disabled = false);
        }

        // --- Game Logic ---

        updateSolvedStatus() {
            const count = this.solvedSections.size;
            this.statSolvedEl.textContent = `${count} / ${this.totalSections}`;

            if (count === this.totalSections && !this.gameLocked && this.remainingSeconds > 0) {
                this.openDoor();
            }
        }

        openDoor() {
            this.gameLocked = true;
            if (this.timerId) clearInterval(this.timerId);
            this.doorEl.classList.add("door--open");
            this.doorGlowEl.classList.add("door-glow--active");
            this.doorSignEl.textContent = "OFFEN";
            this.doorSignEl.classList.remove("door-sign--closed");
            this.doorSignEl.classList.add("door-sign--open");
            this._disableAllButtons();
        }

        resetGame() {
            if (this.timerId) clearInterval(this.timerId);
            this.remainingSeconds = this.START_SECONDS;
            this.gameLocked = false;
            this.solvedSections.clear();

            // UI Reset
            this.updateTimerDisplay();
            this.statSolvedEl.textContent = `0 / ${this.totalSections}`;

            this.doorEl.classList.remove("door--open");
            this.doorGlowEl.classList.remove("door-glow--active");
            this.doorSignEl.textContent = "GESCHLOSSEN";
            this.doorSignEl.classList.add("door-sign--closed");
            this.doorSignEl.classList.remove("door-sign--open");

            // Reset each section
            Object.values(this.sectionData).forEach(section => {
                const statusEl = document.getElementById(`status-${section.id}`);
                if (statusEl) {
                    statusEl.textContent = "offen";
                    statusEl.className = "section-status";
                }

                if (section.type === "sort") {
                    this.resetSortBoard(section);
                } else if (section.type === "quiz") {
                    // Uncheck radios
                    document.querySelectorAll(`input[name^="${section.id}_"]`).forEach(i => i.checked = false);
                    const fb = document.getElementById(`feedback-${section.id}`);
                    if (fb) fb.textContent = section.hintDefault || "";
                } else if (section.type === "capital") {
                    // Reset selects
                    const table = document.querySelector(`#section-${section.id} table`);
                    if (table) {
                        table.querySelectorAll("select").forEach(sel => {
                            sel.value = "";
                            sel.classList.remove("correct", "wrong");
                        });
                    }
                }
            });

            this._enableAllButtons();
            this.startTimer();
        }

        checkSection(sectionId) {
            if (this.gameLocked) return;

            const section = this.sectionData[sectionId];
            if (!section) return;

            let solved = false;
            if (section.type === "sort") solved = this.checkSort(section);
            else if (section.type === "quiz") solved = this.checkQuiz(section);
            else if (section.type === "capital") solved = this.checkCapital(section);

            const statusEl = document.getElementById(`status-${sectionId}`);
            if (solved) {
                this.solvedSections.add(sectionId);
                statusEl.textContent = "gelöst";
                statusEl.className = "section-status section-status--done";
            } else {
                this.solvedSections.delete(sectionId);
                statusEl.textContent = "noch Fehler";
                statusEl.className = "section-status section-status--fail";
            }
            this.updateSolvedStatus();
        }

        // --- Specific Checks ---

        checkSort(section) {
            let correctCount = 0;
            const cardData = section.sortCards || [];
            const total = cardData.length;

            // Reset visual state
            // Find all cards for this section? Actually cards have unique IDs. 
            // But we need to make sure we only target cards belonging to this section if we had multiple sort puzzles.
            // Currently IDs are global in JSON. Assuming IDs unique. To be safe, scope search.
            const sectionEl = document.getElementById(`section-${section.id}`);
            const cards = sectionEl.querySelectorAll(".drag-card");
            cards.forEach(c => c.classList.remove("correct", "wrong"));

            let allCorrect = true;

            // Loop through DATA to check where each card is
            cardData.forEach(card => {
                const el = sectionEl.querySelector(`.drag-card[data-card-id="${card.id}"]`);
                if (!el) {
                    allCorrect = false;
                    return;
                }

                const parentZone = el.closest(".escape-dropzone");
                if (!parentZone) {
                    el.classList.add("wrong");
                    allCorrect = false;
                    return;
                }

                const zoneName = parentZone.dataset.zone;
                if (zoneName === card.correctZone) {
                    el.classList.add("correct");
                } else {
                    el.classList.add("wrong");
                    allCorrect = false;
                }
            });

            return allCorrect;
        }

        checkQuiz(section) {
            const questions = section.questions || [];
            let allCorrect = true;

            questions.forEach(q => {
                const selected = document.querySelector(`input[name="${section.id}_${q.id}"]:checked`);
                const userVal = selected ? selected.value : null;
                if (userVal !== q.correct) {
                    allCorrect = false;
                }
            });

            const fb = document.getElementById(`feedback-${section.id}`);
            if (fb) {
                fb.textContent = allCorrect ? "Alles richtig!" : "Mindestens eine Antwort ist falsch/fehlt.";
            }
            return allCorrect;
        }

        checkCapital(section) {
            const rows = section.rows || [];
            let allCorrect = true;
            const sectionEl = document.getElementById(`section-${section.id}`);
            const selects = sectionEl.querySelectorAll("select");

            selects.forEach(sel => sel.classList.remove("correct", "wrong"));

            rows.forEach(row => {
                const sel = sectionEl.querySelector(`select[data-row-key="${row.key}"]`);
                if (!sel) return;

                if (sel.value === row.correct) {
                    sel.classList.add("correct");
                } else {
                    sel.classList.add("wrong");
                    allCorrect = false;
                }
            });
            return allCorrect;
        }

        // --- Drag & Drop Helpers ---

        resetSortBoard(section) {
            const pool = document.getElementById(`pool-${section.id}`);
            if (!pool) return;
            pool.innerHTML = "";

            const sectionEl = document.getElementById(`section-${section.id}`);
            // Clear dropzones
            sectionEl.querySelectorAll(".escape-dropzone").forEach(z => {
                z.classList.remove("is-over");
                // Remove drag cards only
                const cards = z.querySelectorAll(".drag-card");
                cards.forEach(c => c.remove());
            });

            // Re-create cards in pool
            this.shuffleArray(section.sortCards || []).forEach(cardData => {
                const el = this.createSortCard(cardData);
                pool.appendChild(el);
            });
        }

        createSortCard(cardData) {
            const el = document.createElement("div");
            el.className = "drag-card";
            el.draggable = true;
            el.dataset.cardId = cardData.id;

            const span = document.createElement("span");
            span.className = "drag-card-text";
            span.textContent = cardData.text;
            el.appendChild(span);

            el.addEventListener("dragstart", (e) => {
                if (this.gameLocked) { e.preventDefault(); return; }
                this.draggingCardId = cardData.id;
                el.classList.add("dragging");
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", cardData.id);
            });

            el.addEventListener("dragend", () => {
                this.draggingCardId = null;
                el.classList.remove("dragging");
            });
            return el;
        }

        handleDragOverZone(e) {
            if (this.gameLocked) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            e.currentTarget.classList.add("is-over");
        }

        handleDragLeaveZone(e) {
            e.currentTarget.classList.remove("is-over");
        }

        handleDropZone(e) {
            if (this.gameLocked) return;
            e.preventDefault();
            const zone = e.currentTarget;
            zone.classList.remove("is-over");

            const cardId = e.dataTransfer.getData("text/plain") || this.draggingCardId;
            if (!cardId) return;

            // Find card anywhere in document (or better, scoped to current puzzle?)
            // Since we know drag started and stored draggingCardId, and ID is unique:
            const cardEl = document.querySelector(`.drag-card[data-card-id="${cardId}"]`);
            if (!cardEl) return;

            cardEl.classList.remove("correct", "wrong");
            zone.appendChild(cardEl);
        }
    }

    const game = new EscapeGame();
    game.init();

})();
