/**
 * ============================================================================
 * game_base.js - Basis-Klasse für alle Spiele
 * ============================================================================
 * 
 * ZWECK:
 * ------
 * Diese Datei stellt eine wiederverwendbare Basis-Klasse für alle Spiele bereit.
 * Sie übernimmt die technischen Details wie:
 * - Laden des JSON-Payloads aus sessionStorage oder Drive
 * - Theme-Verwaltung (Dark/Light Mode)
 * - Validierung der Spiel-Daten
 * - Fehlerbehandlung
 * 
 * VERWENDUNG IN EINEM SPIEL:
 * ---------------------------
 * 1. Binde diese Datei in dein Spiel-HTML ein:
 *    <script src="game_base.js"></script>
 * 
 * 2. Erstelle eine Subklasse von GameBase:
 *    class MeinSpiel extends GameBase {
 *        constructor() {
 *            super({ expectedGameType: 'mein_spiel_typ' });
 *        }
 * 
 *        onDataLoaded(data) {
 *            // Hier kommt deine Spiel-Logik
 *            console.log('Spiel-Daten:', data);
 *        }
 *    }
 * 
 * 3. Initialisiere dein Spiel:
 *    const game = new MeinSpiel();
 *    game.init();
 * 
 * DATENFLUSS:
 * -----------
 * 1. GameBase.init() wird aufgerufen
 * 2. URL-Parameter werden gelesen (fileId)
 * 3. Payload wird aus sessionStorage geladen (oder von Drive)
 * 4. Payload wird validiert (game_type prüfen)
 * 5. onDataLoaded() der Subklasse wird mit validen Daten aufgerufen
 * 
 * ERWARTETE URL-PARAMETER:
 * ------------------------
 * - fileId: Die Google Drive File-ID des JSON-Payloads (PFLICHT)
 * - game_type: Optional, für zusätzliche Validierung
 * 
 * BEISPIEL:
 * ---------
 * Escape-Game.html?fileId=1abc...xyz
 * 
 * JSON-FORMAT:
 * ------------
 * Das JSON muss mindestens folgende Felder enthalten:
 * {
 *     "game_type": "escape_game",  // Identifiziert den Spieltyp
 *     "title": "Mein Spiel",       // Optional: Titel für den Browser-Tab
 *     "schema_version": "1.0",     // Optional: Schema-Version
 *     ... // Weitere spiel-spezifische Daten
 * }
 * 
 * SESSION STORAGE:
 * ----------------
 * Der drive_interpreter.js speichert das Payload:
 * - Key: 'game_payload_' + fileId
 * - Value: JSON.stringify(payload)
 * 
 * Falls sessionStorage leer ist, lädt GameBase direkt von Drive nach.
 * 
 * THEME-SYSTEM:
 * -------------
 * GameBase verwaltet automatisch das Dark/Light Theme:
 * - Liest Theme aus localStorage ('globalTheme_v1')
 * - Setzt die Klasse 'theme-light' am <html>-Element
 * - Bindet einen Theme-Toggle-Button (ID: 'theme-toggle')
 * 
 * FEHLERBEHANDLUNG:
 * -----------------
 * Bei kritischen Fehlern zeigt GameBase eine formatierte Fehlermeldung an
 * und verhindert das Laden des Spiels. Fehler werden in die Console geloggt.
 * 
 * ENTWICKLER-HINWEISE:
 * --------------------
 * - Überschreibe IMMER onDataLoaded() in deiner Subklasse
 * - Nutze this.payload für Zugriff auf die Spiel-Daten
 * - Nutze this.fileId für die Drive File-ID
 * - Nutze this._fatal(msg) für kritische Fehler
 * 
 * ============================================================================
 */

(function () {
    'use strict';

    // Fallback auf globales AppConfig, falls vorhanden
    const GLOBAL_CONFIG = window.AppConfig || {};
    const DEFAULT_API_KEY = GLOBAL_CONFIG.apiKey || '';
    const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
    const THEME_KEY = 'globalTheme_v1';
    const JSON_SESSION_PREFIX = 'game_payload_';

    class GameBase {
        /**
         * @param {Object} options
         * @param {string} options.expectedGameType  erwarteter game_type (z. B. "what_and_why")
         * @param {string} [options.rootElementId]   ID des Containers für das Spiel
         * @param {string} [options.apiKey]          Google API-Key (Fallback: DEFAULT_API_KEY)
         */
        constructor(options) {
            const opts = options || {};
            this.expectedGameType = opts.expectedGameType || null;
            this.rootElementId = opts.rootElementId || 'game-root';
            this.apiKey = opts.apiKey || DEFAULT_API_KEY;

            this.fileId = null;
            this.gameTypeFromQuery = null;
            this.payload = null;

            this.rootEl = null;
            this.themeToggleBtn = null;
        }

        // ================================================================
        // Öffentlicher Einstiegspunkt
        // ================================================================
        async init() {
            this.rootEl = document.getElementById(this.rootElementId) || document.body;
            // Theme-Toggle (optional - AppBar hat bereits einen)
            this.themeToggleBtn = document.getElementById('theme-toggle');

            this._initTheme();
            this._wireThemeToggle();

            const params = new URLSearchParams(window.location.search);
            this.fileId = params.get('fileId') || params.get('id');

            // Fallback auf globale Session-ID (vom game_loader.html)
            if (!this.fileId) {
                this.fileId = sessionStorage.getItem('game_payload_id');
            }

            this.gameTypeFromQuery = params.get('game_type');

            if (!this.fileId) {
                this._fatal('In der URL fehlt der Parameter "fileId" und es wurde keine Session-ID gefunden.');
                return;
            }

            try {
                this.payload = await this._loadPayload();
            } catch (err) {
                console.error(err);
                this._fatal('Die Spieldaten konnten nicht geladen werden:\n' + String(err && err.message ? err.message : err));
                return;
            }

            const headerOk = this._validateHeader();
            if (!headerOk) {
                return;
            }

            // Option: Seitentitel aus JSON-Header setzen
            if (this.payload && typeof this.payload.title === 'string' && this.payload.title.trim() !== '') {
                document.title = 'Pauker - ' + this.payload.title;
            }

            // An Subklasse übergeben
            try {
                this.onDataLoaded(this.payload);
            } catch (err) {
                console.error(err);
                this._fatal('Fehler beim Initialisieren des Spiels:\n' + String(err && err.message ? err.message : err));
            }
        }

        /**
         * Muss von der Subklasse überschrieben werden.
         * @param {Object} data - Vollständiges JSON-Payload (inkl. Header)
         */
        // eslint-disable-next-line no-unused-vars
        onDataLoaded(data) {
            this._fatal('onDataLoaded(data) ist in der Subklasse nicht implementiert.');
        }

        // ================================================================
        // Theme / Layout
        // ================================================================
        _initTheme() {
            let stored = null;
            try {
                stored = localStorage.getItem(THEME_KEY);
            } catch (_) { }

            const initial = stored === 'light' || stored === 'dark' ? stored : 'dark';

            this._applyTheme(initial);
        }

        _applyTheme(theme) {
            const rootEl = document.documentElement;
            if (theme === 'light') {
                rootEl.classList.add('theme-light');
            } else {
                rootEl.classList.remove('theme-light');
            }

            if (this.themeToggleBtn) {
                this.themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
            }
        }

        _toggleTheme() {
            const isLight = document.documentElement.classList.contains('theme-light');
            const next = isLight ? 'dark' : 'light';
            this._applyTheme(next);
            try {
                localStorage.setItem(THEME_KEY, next);
            } catch (_) { }
        }

        _wireThemeToggle() {
            if (!this.themeToggleBtn) return;
            this.themeToggleBtn.addEventListener('click', () => {
                this._toggleTheme();
            });
        }

        // ================================================================
        // Payload laden (sessionStorage → Fallback Drive)
        // ================================================================
        async _loadPayload() {
            const storageKey = JSON_SESSION_PREFIX + this.fileId;

            // 1) Versuch: aus sessionStorage
            try {
                const raw = sessionStorage.getItem(storageKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        return this._randomizePayload(parsed);
                    }
                }
            } catch (e) {
                console.warn('Konnte Payload nicht aus sessionStorage lesen:', e);
            }

            // 2) Fallback: Lokal laden
            // Wenn fileId ein Pfad wie 'database/...' ist und wir in 'games/' sind, brauchen wir '../'
            const fetchUrl = this.fileId.startsWith('http') ? this.fileId : '../' + this.fileId;
            const res = await fetch(fetchUrl);
            if (!res.ok) {
                throw new Error(`Fehler beim Laden (${res.status}) von ${fetchUrl}: ${res.statusText}`);
            }

            const data = await res.json();
            const randomized = this._randomizePayload(data);
            try {
                sessionStorage.setItem(storageKey, JSON.stringify(randomized));
            } catch (e) {
                console.warn('Konnte Payload nicht im sessionStorage speichern:', e);
            }

            return randomized;
        }

        /**
         * Shuffles specific arrays in the payload to ensure variety.
         */
        _randomizePayload(data) {
            if (!data || typeof data !== 'object') return data;

            const shuffle = (arr) => {
                if (!Array.isArray(arr)) return arr;
                const copy = [...arr];
                for (let i = copy.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [copy[i], copy[j]] = [copy[j], copy[i]];
                }
                return copy;
            };

            // Deep clone to avoid mutating original source if cached
            const result = JSON.parse(JSON.stringify(data));

            // Randomize by game type
            const type = result.game_type || result.gameType;

            if (type === 'escape_game' && Array.isArray(result.sections)) {
                result.sections = shuffle(result.sections).map(s => {
                    if (s.type === 'quiz' && Array.isArray(s.questions)) {
                        s.questions = shuffle(s.questions).map(q => {
                            if (Array.isArray(q.options)) q.options = shuffle(q.options);
                            return q;
                        });
                    }
                    if (s.type === 'sort' && Array.isArray(s.sortCards)) s.sortCards = shuffle(s.sortCards);
                    if (s.type === 'capital' && Array.isArray(s.rows)) {
                        s.rows = shuffle(s.rows).map(r => {
                            if (Array.isArray(r.options)) r.options = shuffle(r.options);
                            return r;
                        });
                    }
                    return s;
                });
            } else if (type === 'matching_puzzle' && Array.isArray(result.sets)) {
                result.sets = shuffle(result.sets);
            } else if (type === 'sortier_spiel' && Array.isArray(result.cards)) {
                result.cards = shuffle(result.cards);
                if (Array.isArray(result.columns)) result.columns = shuffle(result.columns);
            } else if (type === 'quick_quiz' && Array.isArray(result.questions)) {
                result.questions = shuffle(result.questions);
                if (Array.isArray(result.answerLabels)) result.answerLabels = shuffle(result.answerLabels);
            } else if (type === 'wer_bin_ich') {
                if (Array.isArray(result.legalForms)) result.legalForms = shuffle(result.legalForms);
                if (Array.isArray(result.questions)) result.questions = shuffle(result.questions);
            } else if (type === 'what_and_why' && Array.isArray(result.cases)) {
                result.cases = shuffle(result.cases).map(c => {
                    if (Array.isArray(c.options)) {
                        c.options = shuffle(c.options).map(o => {
                            if (Array.isArray(o.whys)) o.whys = shuffle(o.whys);
                            return o;
                        });
                    }
                    return c;
                });
            }

            return result;
        }

        // ================================================================
        // Header-Validierung
        // ================================================================
        _validateHeader() {
            const data = this.payload;
            if (!data || typeof data !== 'object') {
                this._fatal('Ungültige Spieldaten: JSON ist leer oder kein Objekt.');
                return false;
            }

            const actualType = data.game_type || data.gameType || null;
            if (!actualType) {
                this._fatal('Im JSON fehlt das Feld "game_type".');
                return false;
            }

            if (this.expectedGameType && actualType !== this.expectedGameType) {
                const msg = [
                    'Unerwarteter game_type im JSON.',
                    `Erwartet: "${this.expectedGameType}"`,
                    `Gefunden: "${actualType}"`,
                    `Geladenes HTML: ${window.location.pathname.split('/').pop()}`
                ].join('\n');
                this._fatal(msg);
                return false;
            }

            // Optionale Schema-Prüfung
            if (data.schema_version && typeof data.schema_version !== 'string') {
                console.warn('schema_version ist vorhanden, aber kein String:', data.schema_version);
            }

            return true;
        }

        // ================================================================
        // Helpers
        // ================================================================
        _fatal(message) {
            console.error('[GameBase FATAL]', message);
            if (!this.rootEl) return;
            this.rootEl.innerHTML = `
        <div style="
          max-width: 720px;
          margin: 2rem auto;
          padding: 1.2rem 1.4rem;
          border-radius: 0.8rem;
          border: 1px solid rgba(248, 113, 113, 0.6);
          background: rgba(30, 64, 175, 0.1);
          color: #fecaca;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          white-space: pre-wrap;
          font-size: 0.9rem;
        ">
          <h2 style="margin-top:0;margin-bottom:0.5rem;font-size:1.05rem;color:#fecaca;">
            Spiel konnte nicht gestartet werden
          </h2>
          <p style="margin:0;">${this._escapeHtml(String(message))}</p>
        </div>
      `;
        }

        _escapeHtml(str) {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
    }

    // global verfügbar machen
    window.GameBase = GameBase;
})();
