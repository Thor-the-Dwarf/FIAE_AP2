/**
 * ============================================================================
 * matching_puzzle.js - Matching-Puzzle Spiellogik (Generic Refactor)
 * ============================================================================
 * 
 * ZWECK:
 * Hauptlogik für das Matching-Puzzle-Spiel. Erweitert GameBase.
 * Dynamisch generiert für beliebig viele Spalten (aktuell auf 3 ausgelegt via CSS/JSON),
 * basierend auf JSON-Konfiguration.
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    class MatchingPuzzle extends GameBase {
        constructor() {
            super({
                expectedGameType: 'matching_puzzle',
                rootElementId: 'game-root'
            });

            // Spiel-State
            this.sets = [];           // Array of objects {id, col1, col2, col3, ...}
            this.columnKeys = ['col1', 'col2', 'col3']; // Die Schlüssel für die Spalten
            this.selection = {};      // { col1: null, col2: null, col3: null }

            this.batches = [];        // Array of arrays (rounds)
            this.currentRoundIndex = 0;
            this.roundFoundSets = 0;  // Found within current round

            // DOM-Referenzen
            this.columnsContainer = null;
            this.foundSetsEl = null;
            this.attemptsEl = null;
            this.feedbackEl = null;
            this.nextRoundBtn = null;

            // Config-Cache
            this.configData = null;
        }

        onDataLoaded(data) {
            // Backward Compatibility: Normalize data if using old schema
            if (data.sets && data.sets.length > 0) {
                const first = data.sets[0];
                if (!first.col1 && first.name) {
                    data.sets = data.sets.map(s => ({
                        ...s,
                        col1: s.name,
                        col2: s.description,
                        col3: s.example
                    }));
                }
            }
            // Backward Compatibility: Normalize titles/hints if using old schema and not new
            if (!data.columnTitles && data.columnTitles !== {}) { // Ensure it exists
                // If undefined, maybe init? But JSON usually has it.
            }
            if (data.columnTitles) {
                if (data.columnTitles.column1 && !data.columnTitles.col1) data.columnTitles.col1 = data.columnTitles.column1;
                if (data.columnTitles.column2 && !data.columnTitles.col2) data.columnTitles.col2 = data.columnTitles.column2;
                if (data.columnTitles.column3 && !data.columnTitles.col3) data.columnTitles.col3 = data.columnTitles.column3;
            }
            if (data.columnHints) {
                if (data.columnHints.column1 && !data.columnHints.col1) data.columnHints.col1 = data.columnHints.column1;
                if (data.columnHints.column2 && !data.columnHints.col2) data.columnHints.col2 = data.columnHints.column2;
                if (data.columnHints.column3 && !data.columnHints.col3) data.columnHints.col3 = data.columnHints.column3;
            }

            this.configData = data;

            // 1. DOM Referenzen
            this.columnsContainer = document.getElementById('columns-container');
            this.foundSetsEl = document.getElementById('found-sets');
            this.attemptsEl = document.getElementById('attempts');
            this.feedbackEl = document.getElementById('feedback');
            this.nextRoundBtn = document.getElementById('next-round-btn');

            if (data.sets && Array.isArray(data.sets)) {
                this.sets = data.sets;
                this.totalSets = data.sets.length;
            }

            // 2. Titel setzen
            if (data.title) {
                const titleEl = document.querySelector('.game-title');
                if (titleEl) titleEl.textContent = data.title;
                document.title = data.title;
            }
            if (data.subtitle) {
                const subEl = document.querySelector('.subtitle');
                if (subEl) subEl.textContent = data.subtitle;
            }

            // 3. Event Listener
            if (this.nextRoundBtn) {
                this.nextRoundBtn.addEventListener('click', () => this.nextRound());
            }

            // 4. Start
            this.resetGame();
        }

        shuffle(array) {
            const copy = [...array];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        }

        updateStats() {
            if (this.foundSetsEl) this.foundSetsEl.textContent = `${this.foundSets}/${this.totalSets}`;
            if (this.attemptsEl) this.attemptsEl.textContent = String(this.attempts);
        }

        /**
         * Clears all selection references and removes visual 'selected' class.
         */
        clearAllSelections() {
            this.columnKeys.forEach(key => {
                if (this.selection[key]) {
                    this.selection[key].classList.remove('selected');
                    this.selection[key] = null;
                }
            });
        }

        prepareBatches(sets) {
            const copy = this.shuffle(sets);
            const total = copy.length;
            const batches = [];

            // Partition Logic (Balancing)
            // If total % 3 == 1 (and > 1), last two rounds should be 2, 2

            let i = 0;
            const chunkSize = 3;

            while (i < total) {
                const remaining = total - i;

                // If we exactly have 4 items left, split into 2 and 2
                // Example: N=4. i=0, rem=4. -> [0,1], next loop rem=2 -> [2,3]
                // Example: N=7. i=0->3, i=3->6 (rem=4) -> 2, s.o.
                if (remaining === 4) {
                    batches.push(copy.slice(i, i + 2));
                    i += 2;
                    batches.push(copy.slice(i, i + 2));
                    i += 2;
                    break;
                } else if (remaining < 3) {
                    // Should only happen if total < 3 initially or perfectly divisible
                    // If remaining 1 or 2, just take them
                    batches.push(copy.slice(i, total));
                    i = total;
                } else {
                    // Standard case
                    batches.push(copy.slice(i, i + 3));
                    i += 3;
                }
            }
            return batches;
        }

        clearWrongHighlight() {
            const wrongCards = document.querySelectorAll('.card.wrong');
            wrongCards.forEach(card => card.classList.remove('wrong'));
        }

        setCardsDisabled(disabled) {
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                if (disabled) {
                    card.classList.add('disabled');
                    card.disabled = true;
                } else if (!card.classList.contains('matched')) {
                    card.classList.remove('disabled');
                    card.disabled = false;
                }
            });
        }

        makeCard(text, colKey, setId) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card';
            btn.textContent = text;
            btn.dataset.colKey = colKey;
            btn.dataset.setId = setId;
            btn.addEventListener('click', (e) => this.onCardClick(e));
            return btn;
        }

        /**
         * Renders the columns dynamically based on this.columnKeys and this.batches[currentRoundIndex]
         */
        renderGrid() {
            this.columnsContainer.innerHTML = '';

            const currentBatch = this.batches[this.currentRoundIndex] || [];

            // Prepare shuffled data for each column (within the batch)
            const columnsData = {};
            this.columnKeys.forEach(key => {
                columnsData[key] = this.shuffle(currentBatch);
            });

            // Hints / Titles from JSON
            const colTitles = this.configData.columnTitles || {};
            const colHints = this.configData.columnHints || {};

            // Render DOM for each column
            this.columnKeys.forEach((key, index) => {
                const colDiv = document.createElement('div');
                colDiv.className = 'column';

                // Display Title (1-based index for aesthetics)
                // e.g. "1 · Rechtsform"
                const displayNum = index + 1;
                const titleText = colTitles[key] ? `${displayNum} · ${colTitles[key]}` : `Spalte ${displayNum}`;

                const titleP = document.createElement('p');
                titleP.className = 'column-title';
                titleP.textContent = titleText;
                colDiv.appendChild(titleP);

                // Hint
                const hintText = colHints[key] || "";
                const hintP = document.createElement('p');
                hintP.className = 'column-hint';
                hintP.textContent = hintText;
                colDiv.appendChild(hintP);

                // Card List Container
                const listDiv = document.createElement('div');
                listDiv.className = 'card-list';
                listDiv.id = `list-${key}`;

                // Append Shuffled Cards
                columnsData[key].forEach(setItem => {
                    const card = this.makeCard(setItem[key], key, setItem.id);
                    listDiv.appendChild(card);
                });

                colDiv.appendChild(listDiv);
                this.columnsContainer.appendChild(colDiv);
            });
        }

        evaluateSelection() {
            // Check if all columns have a selection
            const allSelected = this.columnKeys.every(key => !!this.selection[key]);

            if (!allSelected) return;

            this.evaluationLock = true;
            this.attempts++;
            this.clearWrongHighlight();

            // Check if all selected cards have same setId
            const firstKey = this.columnKeys[0];
            const refId = this.selection[firstKey].dataset.setId;

            const isMatch = this.columnKeys.every(key => this.selection[key].dataset.setId === refId);

            const selectedCards = this.columnKeys.map(key => this.selection[key]);

            if (isMatch) {
                // MATCH
                selectedCards.forEach(card => {
                    card.classList.remove('selected');
                    card.classList.add('matched', 'disabled');
                    card.disabled = true;
                });

                this.foundSets++;
                if (this.feedbackEl) {
                    this.feedbackEl.textContent = 'Korrektes Set gefunden!';
                    this.feedbackEl.className = 'ok';
                }

                // Clear selection state
                this.columnKeys.forEach(key => this.selection[key] = null);

                this.evaluationLock = false;
                this.setCardsDisabled(false);
                this.updateStats();

                this.checkRoundCompletion();
            } else {
                // NO MATCH
                selectedCards.forEach(card => card.classList.add('wrong'));

                if (this.feedbackEl) {
                    this.feedbackEl.textContent = 'Das passt noch nicht zusammen. Versuch es erneut.';
                    this.feedbackEl.className = 'error';
                }

                this.setCardsDisabled(true);

                setTimeout(() => {
                    selectedCards.forEach(card => {
                        card.classList.remove('selected', 'wrong');
                    });
                    this.columnKeys.forEach(key => this.selection[key] = null);

                    this.setCardsDisabled(false);
                    this.evaluationLock = false;
                    this.updateStats();
                }, 900);
            }
        }

        onCardClick(event) {
            if (this.evaluationLock) return;
            const card = event.currentTarget;
            if (card.classList.contains('matched')) return;

            const colKey = card.dataset.colKey;

            // Toggle off if same card clicked
            if (this.selection[colKey] === card) {
                card.classList.remove('selected');
                this.selection[colKey] = null;
                return;
            }

            // Deselect previous in this column
            if (this.selection[colKey]) {
                this.selection[colKey].classList.remove('selected');
            }

            // Select new
            card.classList.add('selected');
            this.selection[colKey] = card;

            // Check if full set selected
            const countSelected = this.columnKeys.filter(k => !!this.selection[k]).length;

            if (countSelected === this.columnKeys.length) {
                this.evaluateSelection();
            } else {
                if (this.feedbackEl) {
                    this.feedbackEl.textContent = 'Wähle noch aus den anderen Spalten, um ein Set zu bilden.';
                    this.feedbackEl.className = 'info';
                }
            }
        }

        checkRoundCompletion() {
            // Check if all Sets in current batch are found
            const currentBatchSize = (this.batches[this.currentRoundIndex] || []).length;
            this.roundFoundSets++;

            if (this.roundFoundSets >= currentBatchSize) {
                // Round Complete
                if (this.feedbackEl) {
                    this.feedbackEl.textContent = 'Runde geschafft! Weiter geht\'s.';
                }

                // Show Next Button if more rounds exist
                if (this.currentRoundIndex < this.batches.length - 1) {
                    if (this.nextRoundBtn) {
                        this.nextRoundBtn.style.display = 'inline-flex';
                    }
                } else {
                    // Game Complete
                    if (this.feedbackEl) {
                        this.feedbackEl.textContent = 'Alle Runden gelöst – Glückwunsch!';
                    }
                }
            }
        }

        nextRound() {
            if (this.currentRoundIndex >= this.batches.length - 1) return;

            this.currentRoundIndex++;
            this.roundFoundSets = 0;

            this.renderGrid();
            this.updateStats();

            // Hide button again until round done
            if (this.nextRoundBtn) {
                this.nextRoundBtn.style.display = 'none';
            }

            if (this.feedbackEl) {
                this.feedbackEl.textContent = 'Finde die passenden Sets!';
                this.feedbackEl.className = 'info';
            }
        }

        resetGame() {
            // Re-init Logic
            // Make sure to shuffle all and rebuild batches
            if (this.sets && this.sets.length > 0) {
                this.batches = this.prepareBatches(this.sets);
            } else {
                this.batches = [];
            }

            this.currentRoundIndex = 0;
            this.foundSets = 0;
            this.roundFoundSets = 0;
            this.attempts = 0;

            // Clear selection object
            this.columnKeys.forEach(key => this.selection[key] = null);
            this.evaluationLock = false;

            if (this.feedbackEl) {
                this.feedbackEl.textContent = 'Wähle je eine Karte aus jeder Spalte, um passende Dreier-Sets zu finden.';
                this.feedbackEl.className = 'info';
            }

            if (this.nextRoundBtn) {
                this.nextRoundBtn.style.display = 'none';
            }

            this.renderGrid();
            this.setCardsDisabled(false);
            this.updateStats();
        }
    }

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new MatchingPuzzle();
            game.init();
        });
    } else {
        const game = new MatchingPuzzle();
        game.init();
    }
})();
