/**
 * ============================================================================
 * sortier_spiel.js - Sortier-Spiel Spiellogik
 * ============================================================================
 * 
 * ZWECK:
 * Drag & Drop Sortier-Spiel mit Pool und Sort-Spalten.
 * Karten können in mehrere Spalten gezogen werden (1:n).
 * 
 * SPIELPRINZIP:
 * - Pool -> Spalte: MOVE (Karte verschwindet aus Pool)
 * - Spalte -> Spalte: CLONE (Karte wird dupliziert)
 * - Spalte -> Pool: DELETE (Karte wird gelöscht, erscheint im Pool wenn letzte Kopie weg)
 * - Evaluation prüft alle Platzierungen
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    /**
     * Sortier-Spiel Klasse
     * Erweitert GameBase für JSON-Loading und Theme-Support
     */
    class SortierSpiel extends GameBase {
        constructor() {
            super({
                expectedGameType: 'sortier_spiel',
                rootElementId: 'game-root'
            });

            // Spiel-Daten (aus JSON)
            this.columns = [];        // Array von {id, title, subtitle}
            this.cards = [];          // Array von {id, text, correctForms: [...]}

            // Spiel-State
            this.dragCardId = null;   // Aktuelle Karten-ID
            this.draggedElement = null; // Aktuell gedragtes Element (für Clones wichtig)

            // DOM-Referenzen
            this.poolEl = null;
            this.columnsGridEl = null;
            this.feedbackEl = null;
            this.statTotalEl = null;
            this.statCorrectEl = null;
            this.checkBtn = null;
            this.resetBtn = null;
        }

        /**
         * Wird von GameBase aufgerufen, nachdem JSON geladen wurde
         */
        onDataLoaded(data) {
            // DOM-Referenzen holen
            this.poolEl = document.getElementById('pool');
            this.columnsGridEl = document.getElementById('columns-grid');
            this.feedbackEl = document.getElementById('feedback');
            this.statTotalEl = document.getElementById('stat-total');
            this.statCorrectEl = document.getElementById('stat-correct');
            this.checkBtn = document.getElementById('check-btn');
            this.resetBtn = document.getElementById('reset-btn');

            // Payload-Daten anwenden
            if (window.SortierSpielPayload) {
                window.SortierSpielPayload.applyPayloadToGame(this, data);
            }

            // Columns rendern
            this.renderColumns();

            // Event-Listener
            this.setupDragAndDrop();
            this.checkBtn.addEventListener('click', () => this.evaluate());
            this.resetBtn.addEventListener('click', () => this.resetBoard());

            // Cards initialisieren
            this.initCards();
        }

        /**
         * Shuffle-Funktion
         */
        shuffle(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        /**
         * Rendert die Spalten
         */
        renderColumns() {
            this.columnsGridEl.innerHTML = '';
            // Shuffle columns to avoid fixed positions
            const shuffledCols = this.shuffle(this.columns);
            shuffledCols.forEach(col => {
                const colDiv = document.createElement('div');
                colDiv.className = 'sort-column';
                colDiv.dataset.form = col.id;

                colDiv.innerHTML = `
                    <div class="column-header">
                        <span class="column-title">${col.title}</span>
                        <span class="column-sub">${col.subtitle || ''}</span>
                    </div>
                    <div class="sort-dropzone" data-dropzone="column" data-form="${col.id}"></div>
                `;

                this.columnsGridEl.appendChild(colDiv);
            });
        }

        /**
         * Erstellt eine Karte
         */
        createCard(card) {
            const el = document.createElement('div');
            el.className = 'sort-card';
            el.draggable = true;
            el.dataset.cardId = card.id;

            const textSpan = document.createElement('span');
            textSpan.className = 'sort-card-text';
            textSpan.textContent = card.text;

            const tagSpan = document.createElement('span');
            tagSpan.className = 'sort-card-tag';
            tagSpan.textContent = 'Eigenschaft';

            el.appendChild(textSpan);
            el.appendChild(tagSpan);

            el.addEventListener('dragstart', (e) => this.onDragStart(e));
            el.addEventListener('dragend', (e) => this.onDragEnd(e));

            return el;
        }

        /**
         * Initialisiert Karten im Pool
         */
        initCards() {
            this.poolEl.innerHTML = '';
            this.poolEl.classList.remove('empty');
            const shuffled = this.shuffle(this.cards);
            shuffled.forEach(card => {
                const el = this.createCard(card);
                this.poolEl.appendChild(el);
            });
            this.statTotalEl.textContent = this.cards.length;
            this.statCorrectEl.textContent = '0';
        }

        /**
         * Setup Drag & Drop Event-Listener
         */
        setupDragAndDrop() {
            const dropzones = document.querySelectorAll('[data-dropzone]');
            dropzones.forEach(zone => {
                zone.addEventListener('dragover', (e) => this.onDragOverZone(e));
                zone.addEventListener('dragleave', (e) => this.onDragLeaveZone(e));
                zone.addEventListener('drop', (e) => this.onDropZone(e));
            });
        }

        /**
         * Drag Start Handler
         */
        onDragStart(e) {
            const el = e.currentTarget;
            this.dragCardId = el.dataset.cardId;
            this.draggedElement = el; // Speichere genaue Element-Referenz
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dragCardId);
        }

        /**
         * Drag End Handler
         */
        onDragEnd(e) {
            e.currentTarget.classList.remove('dragging');
            this.dragCardId = null;
            this.draggedElement = null;
        }

        /**
         * Drag Over Zone Handler
         */
        onDragOverZone(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            e.currentTarget.classList.add('is-over');
        }

        /**
         * Drag Leave Zone Handler
         */
        onDragLeaveZone(e) {
            e.currentTarget.classList.remove('is-over');
        }

        /**
         * Prüft ob Karte noch im Spiel ist, sonst zurück in Pool
         */
        checkAndRestoreToPool(cardId) {
            // Suche ob diese Karte noch irgendwo existiert
            const remaining = document.querySelectorAll(`.sort-card[data-card-id="${cardId}"]`);
            if (remaining.length === 0) {
                // Keine Instanz mehr da -> Wiederherstellen im Pool
                const cardData = this.cards.find(c => c.id === cardId);
                if (cardData) {
                    const newCard = this.createCard(cardData);
                    this.poolEl.appendChild(newCard);
                }
            }
        }

        /**
         * Drop Zone Handler - Move aus Pool, Clone aus Container
         */
        onDropZone(e) {
            e.preventDefault();
            const zone = e.currentTarget;
            zone.classList.remove('is-over');

            const cardId = e.dataTransfer.getData('text/plain') || this.dragCardId;
            const sourceEl = this.draggedElement;

            if (!cardId || !sourceEl) return;

            const isPoolDrop = zone.dataset.dropzone === 'pool';
            // Prüfe ob Source im Pool war (direktes Kind von poolEl)
            const isSourceInPool = sourceEl.parentElement && sourceEl.parentElement.id === 'pool';

            // FALL 1: Drop in POOL
            if (isPoolDrop) {
                if (isSourceInPool) return; // Schon im Pool -> nichts tun

                // Karte kommt aus Container -> Löschen
                sourceEl.remove();

                // Checken ob es die letzte war -> Wenn ja, im Pool wiederherstellen
                this.checkAndRestoreToPool(cardId);
                return;
            }

            // FALL 2: Drop in CONTAINER
            const targetForm = zone.dataset.form;

            // Duplikat-Check: Ist Karte schon in DIESEM Container?
            const duplicate = zone.querySelector(`.sort-card[data-card-id="${cardId}"]`);
            if (duplicate) return; // Karte ist hier schon vorhanden

            // Unterscheidung: Move oder Clone?
            if (isSourceInPool) {
                // MOVE: Aus Pool verschieben (ist dann weg aus Pool)
                sourceEl.dataset.form = targetForm;
                sourceEl.classList.remove('correct', 'wrong');
                // Entferne is-clone Marker falls vorhanden (sollte nicht, aber sicherheitshalber)
                delete sourceEl.dataset.isClone;
                delete sourceEl.dataset.originalId;

                zone.appendChild(sourceEl);
            } else {
                // CLONE: Aus anderem Container kopieren
                const cardData = this.cards.find(c => c.id === cardId);
                if (!cardData) return;

                const clone = this.createCard(cardData);
                clone.dataset.form = targetForm;
                // Wir brauchen keine speziellen Marker mehr, jede Karte ist gleichwertig
                zone.appendChild(clone);
            }
        }



        /**
         * Löscht Card States
         */
        clearCardStates() {
            document.querySelectorAll('.sort-card').forEach(card => {
                card.classList.remove('correct', 'wrong');
            });
        }

        /**
         * Evaluiert die Sortierung - prüft alle Platzierungen
         */
        evaluate() {
            this.clearCardStates();
            let correctPlacements = 0;
            let totalPlacements = 0;

            this.cards.forEach(cardData => {
                // Finde alle Instanzen dieser Karte
                const instances = document.querySelectorAll(`.sort-card[data-card-id="${cardData.id}"]`);

                instances.forEach(cardEl => {
                    // Ignoriere Karten im Pool
                    const parentZone = cardEl.closest('[data-dropzone="column"]');
                    if (!parentZone) return;

                    totalPlacements++;
                    const assignedForm = parentZone.dataset.form || null;

                    const isCorrect =
                        assignedForm &&
                        cardData.correctForms.includes(assignedForm);

                    if (isCorrect) {
                        cardEl.classList.add('correct');
                        correctPlacements++;
                    } else {
                        cardEl.classList.add('wrong');
                    }
                });
            });

            this.statCorrectEl.textContent = correctPlacements.toString();

            // Feedback basierend auf Placements
            if (totalPlacements === 0) {
                this.feedbackEl.className = 'feedback';
                this.feedbackEl.innerHTML = 'Ziehe die Eigenschaften in passende Spalten. Eine Eigenschaft kann in mehrere Spalten passen.';
            } else if (correctPlacements === totalPlacements && totalPlacements > 0) {
                this.feedbackEl.className = 'feedback success';
                this.feedbackEl.innerHTML = 'Perfekt sortiert – alle Zuordnungen sind korrekt. <strong>Prüfungsreif.</strong>';
            } else if (correctPlacements === 0) {
                this.feedbackEl.className = 'feedback error';
                this.feedbackEl.innerHTML = 'Hier passt fast nichts – überprüfe die Zuordnungen.';
            } else {
                this.feedbackEl.className = 'feedback';
                this.feedbackEl.innerHTML = `Du hast <strong>${correctPlacements} von ${totalPlacements}</strong> Zuordnungen richtig gemacht. Rote Karten kannst du entfernen oder verschieben.`;
            }
        }

        /**
         * Setzt Board zurück
         */
        resetBoard() {
            this.clearCardStates();

            // Lösche alle Karten aus den Spalten
            const cols = document.querySelectorAll('.sort-dropzone .sort-card');
            cols.forEach(el => el.remove());

            // Pool neu befüllen
            this.initCards();

            this.feedbackEl.className = 'feedback';
            this.feedbackEl.textContent = 'Ziehe jede Eigenschaft in passende Spalten. Eine Eigenschaft kann zu mehreren Rechtsformen passen.';
        }
    }

    // Spiel initialisieren, wenn DOM geladen
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const game = new SortierSpiel();
            game.init();
        });
    } else {
        const game = new SortierSpiel();
        game.init();
    }
})();
