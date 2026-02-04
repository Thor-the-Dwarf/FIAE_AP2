(function () {
    'use strict';

    /**
     * ZWECK:
     * Hauptlogik für das Pauker-Tool im lokalen Offline-Modus.
     * Nutzt die 'app_index.js' für die Struktur und lädt JSONs direkt.
     */

    // --- 1. Global Setup & State ---
    const THEME_KEY = 'globalTheme_v1';
    const STATE_KEY = 'paukerAppState_v1';

    // UI References
    const themeToggleApp = document.getElementById('theme-toggle-app');
    const menuBtn = document.getElementById('menu-tree-btn');
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const viewTitleEl = document.getElementById('view-title');
    const viewPathEl = document.getElementById('view-path');
    const viewBodyEl = document.getElementById('view-body');
    const contentEl = document.querySelector('.content');
    const contentHeader = document.getElementById('content-header');
    const treeRootEl = document.getElementById('tree-root');
    const drawerTitleEl = document.getElementById('drawer-title');
    const drawerResizer = document.getElementById('drawer-resizer');
    const treeDrawer = document.getElementById('tree-drawer');

    // App State
    let appState = {
        selectedId: null,
        openedIds: [],
        drawerOpen: false,
        drawerWidth: 320
    };
    let rootTree = [];
    let rootName = 'Database';

    // --- 2. Theme Logic ---
    function applyTheme(theme) {
        const rootEl = document.documentElement;
        if (theme === 'light') {
            rootEl.classList.add('theme-light');
            themeToggleApp.textContent = '☀️';
        } else {
            rootEl.classList.remove('theme-light');
            themeToggleApp.textContent = '🌙';
        }

        // Update iframe if exists
        const iframe = document.querySelector('iframe.game-iframe');
        if (iframe && iframe.contentDocument) {
            if (theme === 'light') iframe.contentDocument.documentElement.classList.add('theme-light');
            else iframe.contentDocument.documentElement.classList.remove('theme-light');
        }
    }

    function initTheme() {
        let stored = localStorage.getItem(THEME_KEY);
        const initial = (stored === 'light' || stored === 'dark') ? stored : 'dark';
        applyTheme(initial);
    }

    function toggleTheme() {
        const isLight = document.documentElement.classList.contains('theme-light');
        const next = isLight ? 'dark' : 'light';
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
    }

    // --- 3. App Logic ---
    function init() {
        // "Cache leeren" Logik bei jedem Start:
        localStorage.removeItem(STATE_KEY);
        sessionStorage.clear();
        // Wir laden den gespeicherten State NICHT mehr (kein loadAppState mehr)
        // appState bleibt auf Default (geschlossene Ordner)

        // Listener für Fortschritts-Updates aus den Spielen (iframe)
        window.addEventListener('storage', (e) => {
            if (e.key === 'pauker_progress') {
                updateTreeProgress();
            }
        });

        initTheme();

        // Event Listeners
        themeToggleApp.addEventListener('click', toggleTheme);
        menuBtn.onclick = toggleDrawer;
        drawerBackdrop.onclick = () => setDrawer(false);

        initResizer();
        applyDrawerState();
        initLocalApp();
    }

    function loadAppState() {
        try {
            const raw = localStorage.getItem(STATE_KEY);
            if (raw) Object.assign(appState, JSON.parse(raw));
        } catch (_) { }
    }

    function saveAppState() {
        localStorage.setItem(STATE_KEY, JSON.stringify(appState));
    }

    function toggleDrawer() {
        setDrawer(!appState.drawerOpen);
    }

    function setDrawer(isOpen) {
        appState.drawerOpen = isOpen;
        saveAppState();
        applyDrawerState();
    }

    function applyDrawerState() {
        if (appState.drawerWidth) {
            treeDrawer.style.setProperty('--drawer-width', appState.drawerWidth + 'px');
        }

        if (appState.drawerOpen) {
            document.getElementById('app-view').classList.add('tree-open');
            menuBtn.classList.add('active');
            drawerBackdrop.classList.add('active');
        } else {
            document.getElementById('app-view').classList.remove('tree-open');
            menuBtn.classList.remove('active');
            drawerBackdrop.classList.remove('active');
        }
    }

    function initResizer() {
        if (!drawerResizer) return;
        let isResizing = false;

        drawerResizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            drawerResizer.classList.add('resizing');
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 200) newWidth = 200;
            if (newWidth > window.innerWidth * 0.8) newWidth = window.innerWidth * 0.8;
            appState.drawerWidth = newWidth;
            treeDrawer.style.setProperty('--drawer-width', newWidth + 'px');
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                drawerResizer.classList.remove('resizing');
                saveAppState();
            }
        });
    }

    async function initLocalApp() {
        const backendUrl = window.AppConfig.backendUrl || '';
        let loadedRemote = false;

        // 1. Versuch: Remote laden, falls URL konfiguriert
        if (backendUrl) {
            console.log("Versuche Netzwerk-Verbindung zu:", backendUrl);
            try {
                const cacheBuster = '?t=' + Date.now();
                const targetUrl = getRemoteUrl('app_index.js') + cacheBuster;

                const response = await fetch(targetUrl);
                if (response.ok) {
                    const textContent = await response.text();
                    // Wir extrahieren das JSON aus: window.DATABASE_INDEX = [...];
                    // Regex sucht nach dem Array-Start "[" und dem Ende "];" oder "]"
                    const jsonMatch = textContent.match(/window\.DATABASE_INDEX\s*=\s*(\[[\s\S]*\]);?/);

                    if (jsonMatch && jsonMatch[1]) {
                        rootTree = JSON.parse(jsonMatch[1]);
                        loadedRemote = true;
                        console.log("Erfolgreich vom Netzwerk geladen:", rootTree.length, "Einträge");
                    } else {
                        throw new Error("Konnte JSON-Struktur in app_index.js nicht parsen.");
                    }
                } else {
                    console.warn("Netzwerk-Antwort nicht OK:", response.status);
                }
            } catch (e) {
                console.warn("Netzwerk-Verbindung fehlgeschlagen, nutze lokalen Fallback.", e);
            }
        }

        // 2. Fallback: Lokal (window.DATABASE_INDEX wurde durch <script> geladen)
        if (!loadedRemote) {
            if (typeof window.DATABASE_INDEX !== 'undefined') {
                rootTree = window.DATABASE_INDEX;
                console.log("Lokal geladen:", rootTree.length, "Einträge");
            } else {
                rootTree = [];
                console.error("Kein Index verfügbar (weder Remote noch Lokal).");
            }
        }

        // GUI-Feedback
        drawerTitleEl.textContent = "FIAE AP2";

        treeRootEl.innerHTML = '';
        buildTreeHelper(treeRootEl, rootTree, 0);

        // Initial View - Clean State
        viewTitleEl.textContent = '';
        viewPathEl.textContent = '';
        contentHeader.classList.add('hidden'); // Header ausblenden (Buttons/Titel weg)

        viewBodyEl.innerHTML = '<p style="padding:2rem; color:hsl(var(--txt-muted))">Bitte wähle eine Datei aus dem Menü.</p>';
        contentEl.classList.remove('full-screen');
        viewBodyEl.classList.remove('iframe-container');
        viewBodyEl.classList.add('card');

        applySelectedCss();

        // Restore last selected
        if (appState.selectedId) {
            const node = findNode(rootTree, appState.selectedId);
            if (node) selectNode(node.id);
        }
    }

    function buildTreeHelper(container, nodes, level) {
        nodes.forEach(node => {
            const div = document.createElement('div');
            div.className = 'tree-node';
            div.dataset.id = node.id;

            const isCollapsed = !appState.openedIds.includes(node.id);
            if (isCollapsed) div.classList.add('tree-node--collapsed');

            const row = document.createElement('div');
            row.className = 'tree-row';
            row.style.setProperty('--level', level);
            row.onclick = (e) => onNodeClick(e, node);

            if (node.isFolder) {
                const btn = document.createElement('button');
                btn.className = 'tree-toggle';
                btn.textContent = isCollapsed ? '▸' : '▾';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    toggleNode(div, node.id, btn);
                };
                row.appendChild(btn);

                const icon = document.createElement('span');
                icon.className = 'tree-icon';
                icon.textContent = '📁';
                row.appendChild(icon);
            } else {
                const sp = document.createElement('span');
                sp.className = 'tree-spacer';
                row.appendChild(sp);

                const icon = document.createElement('span');
                icon.className = 'tree-icon';
                // Icon Logik
                if (node.kind === 'pdf') icon.textContent = '📄';
                else if (node.kind === 'pptx') icon.textContent = '📊';
                else icon.textContent = '🎮';
                row.appendChild(icon);

                // --- FORTSCHRITTS-ANZEIGE ---
                // Nur bei Dateien (Spielen/Docs), nicht Ordnern (oder aggregiert?)
                // User will "hinter den Dateinamen". Also als Hintergrund.
                const progress = getProgress(node.id);
                if (progress > 0) {
                    const pct = Math.round(progress * 100);
                    // Dunkelgrüner Balken von links nach rechts
                    // Wir nutzen linear-gradient auf dem 'row' Element.
                    // Farbe: Dunkelgrün/Waldgrün, transparent
                    const color = 'rgba(20, 100, 40, 0.25)';
                    row.style.background = `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`;
                    row.setAttribute('title', `Fortschritt: ${pct}%`);
                }
            }

            const label = document.createElement('span');
            label.className = 'tree-label';
            label.textContent = node.name.replace(/\.[^.]+$/, '');
            row.appendChild(label);

            div.appendChild(row);

            const childCont = document.createElement('div');
            childCont.className = 'tree-children';
            if (node.isFolder && node.children) {
                buildTreeHelper(childCont, node.children, level + 1);
            }
            div.appendChild(childCont);
            container.appendChild(div);
        });
    }

    function toggleNode(div, id, btn) {
        const idx = appState.openedIds.indexOf(id);
        if (idx >= 0) {
            appState.openedIds.splice(idx, 1);
            div.classList.add('tree-node--collapsed');
            btn.textContent = '▸';
        } else {
            appState.openedIds.push(id);
            div.classList.remove('tree-node--collapsed');
            btn.textContent = '▾';
        }
        saveAppState();
        const icon = div.querySelector('.tree-icon');
        const node = findNode(rootTree, id);
        if (icon && node && node.isFolder) {
            icon.textContent = appState.openedIds.includes(id) ? '📂' : '📁';
        }
    }

    function onNodeClick(e, node) {
        if (node.isFolder) {
            const div = document.querySelector(`.tree-node[data-id="${node.id}"]`);
            if (div) {
                const btn = div.querySelector('.tree-toggle');
                toggleNode(div, node.id, btn);
            }
            return;
        }

        // Dateien auswählen
        selectNode(node.id);

        // PDFs und Dokumente zusätzlich direkt im neuen Tab öffnen
        if (node.kind === 'pdf' || node.kind === 'pptx') {
            // Bei Remote-Modus müssen wir die URL anpassen
            const url = isRemoteMode() ? getRemoteUrl(node.id) : node.id;
            window.open(url, '_blank');
        }
    }

    function selectNode(id) {
        appState.selectedId = id;
        saveAppState();
        applySelectedCss();
        renderViewForId(id);
    }

    function applySelectedCss() {
        document.querySelectorAll('.tree-node').forEach(n => {
            if (n.dataset.id === appState.selectedId) n.classList.add('tree-node--selected');
            else n.classList.remove('tree-node--selected');
        });
    }

    function findNode(nodes, id) {
        for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) {
                const f = findNode(n.children, id);
                if (f) return f;
            }
        }
        return null;
    }

    function findPath(nodes, id, path = []) {
        for (const n of nodes) {
            const sub = [...path, n.name];
            if (n.id === id) return sub;
            if (n.children) {
                const f = findPath(n.children, id, sub);
                if (f) return f;
            }
        }
        return null;
    }

    async function renderViewForId(id) {
        const node = findNode(rootTree, id);
        if (!node) return;

        viewTitleEl.textContent = node.name;
        const p = findPath(rootTree, id) || [node.name];
        viewPathEl.textContent = p.join(' / ');

        if (node.isFolder) {
            contentHeader.classList.remove('hidden');
            contentEl.classList.remove('full-screen');
            viewBodyEl.classList.remove('iframe-container');
            viewBodyEl.classList.add('card');
            const list = (node.children || []).map(c => `<li>${c.name}</li>`).join('');
            viewBodyEl.innerHTML = `<h3>Inhalt:</h3><ul>${list || '<li>Leer</li>'}</ul>`;
        } else {
            if (node.kind === 'json') {
                contentHeader.classList.add('hidden');
                contentEl.classList.add('full-screen');
                viewBodyEl.innerHTML = '';
                viewBodyEl.classList.remove('card');
                viewBodyEl.classList.add('iframe-container');

                // Laden der Daten (Lokal oder Remote)
                if (!node.data) {
                    viewBodyEl.innerHTML = '<div style="padding:2rem; text-align:center;">Lade Spieldaten...</div>';
                    try {
                        let fetchUrl = node.id;

                        // Wenn wir im Netzwerk-Modus sind oder eine URL erzwingen wollen
                        if (isRemoteMode()) {
                            fetchUrl = getRemoteUrl(node.id);
                            // Cache-Buster für Daten anhängen
                            fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
                        }

                        const resp = await fetch(fetchUrl);
                        if (!resp.ok) throw new Error("Datei nicht gefunden: " + resp.status);
                        node.data = await resp.json();
                    } catch (e) {
                        viewBodyEl.innerHTML = `<div style="padding:2rem; color:hsl(var(--error))">Fehler beim Laden: ${e.message}</div>`;
                        return;
                    }
                }

                if (node.data) {
                    sessionStorage.setItem('game_payload_' + node.id, JSON.stringify(node.data));
                }
                loadGame(node);
            } else if (node.kind === 'pdf') {
                contentHeader.classList.remove('hidden');
                contentEl.classList.remove('full-screen');
                viewBodyEl.classList.remove('iframe-container');
                viewBodyEl.classList.add('card');
                viewBodyEl.innerHTML = `
                    <div style="padding: 2rem; text-align: center;">
                        <div style="font-size: 4rem; margin-bottom: 1rem;">📄</div>
                        <h2>PDF Dokument</h2>
                        <p style="color: hsl(var(--txt-muted)); margin-bottom: 2rem;">
                            Die Datei <strong>${node.name}</strong> wurde in einem neuen Tab geöffnet.
                        </p>
                        <button class="btn primary" onclick="window.open('${isRemoteMode() ? getRemoteUrl(node.id) : node.id}', '_blank')">
                            Datei erneut öffnen
                        </button>
                    </div>
                `;
            } else {
                contentHeader.classList.remove('hidden');
                contentEl.classList.remove('full-screen');
                viewBodyEl.classList.remove('iframe-container');
                viewBodyEl.classList.add('card');
                viewBodyEl.innerHTML = `
                    <div style="padding: 2rem; text-align: center;">
                        <div style="font-size: 4rem; margin-bottom: 1rem;">📂</div>
                        <h2>Dokument</h2>
                        <p style="color: hsl(var(--txt-muted)); margin-bottom: 2rem;">
                            Datei: <strong>${node.name}</strong>
                        </p>
                        <button class="btn primary" onclick="window.open('${isRemoteMode() ? getRemoteUrl(node.id) : node.id}', '_blank')">
                            Herunterladen / Öffnen
                        </button>
                    </div>
                `;
            }
        }
    }

    function loadGame(node) {
        const iframe = document.createElement('iframe');
        iframe.className = 'game-iframe';

        let fileParam = node.id;
        if (isRemoteMode()) {
            fileParam = getRemoteUrl(node.id); // Absolute URL
        }

        iframe.src = `games/game_loader.html?file=${encodeURIComponent(fileParam)}`;
        viewBodyEl.appendChild(iframe);

        iframe.onload = () => {
            const isLight = document.documentElement.classList.contains('theme-light');
            if (isLight) iframe.contentDocument.documentElement.classList.add('theme-light');
        };
    }

    // --- 4. Globale Hilfsfunktionen & Remote Indexing ---

    /**
     * Prüft, ob wir aktuell im Netzwerk-Modus sind.
     * Wir erkennen das daran, ob der Drawer-Titel "Netzwerk" enthält (einfacher State-Check).
     * Sauberer wäre eine globale Variable, aber initLocalApp setzt den Title.
     */
    function isRemoteMode() {
        return drawerTitleEl.textContent.includes("Netzwerk");
    }

    /**
     * Erstellt eine absolute URL basierend auf der backendUrl in config.js
     */
    function getRemoteUrl(path) {
        if (!path) return '';
        if (path.startsWith('http')) return path; // Schon absolut
        const base = window.AppConfig.backendUrl || '';
        // Sicherstellen, dass base mit / endet und path nicht mit / beginnt (oder umgekehrt handeln)
        const cleanBase = base.endsWith('/') ? base : base + '/';
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        return cleanBase + cleanPath;
    }


    // Wird vom "Cache leeren" Button aufgerufen
    window.clearDriveCache = async function () {
        const isGithub = window.location.href.includes('github.io');

        let msg = 'Möchtest du den Cache leeren?';
        if (isGithub) msg += '\n\nHINWEIS: Auf GitHub Pages wird zusätzlich versucht, neue Dateien im "database"-Ordner direkt zu finden.';

        if (!confirm(msg)) return;

        localStorage.removeItem(STATE_KEY);
        sessionStorage.clear();

        if (isGithub) {
            await rebuildIndexFromGithub();
        } else {
            localStorage.removeItem('pauker_remote_index_v1');
            window.location.reload();
        }
    };

    /**
     * ZWECK: Scannt den 'database'-Ordner direkt über die GitHub API,
     * damit neue Dateien ohne 'update_index.js' sofort erscheinen.
     */
    async function rebuildIndexFromGithub() {
        const url = window.location.href;
        // Erwarte: https://owner.github.io/repo/
        const match = url.match(/https?:\/\/([^.]+)\.github\.io\/([^/?#]+)/);
        if (!match) {
            alert("URL-Format nicht erkannt. Nutze manuelles Update.");
            window.location.reload();
            return;
        }

        const owner = match[1];
        const repo = match[2];

        try {
            console.log(`Starte Remote-Indexierung für ${owner}/${repo}...`);
            const api = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
            const resp = await fetch(api);
            if (!resp.ok) throw new Error(`GitHub API Fehler: ${resp.status}`);

            const data = await resp.json();
            if (!data.tree) throw new Error("Keine Baum-Daten erhalten.");

            // Filtere alles in 'database/'
            const rawNodes = data.tree.filter(n => n.path.startsWith('database/') && n.path !== 'database');
            const tree = buildTreeFromFlatList(rawNodes);

            localStorage.setItem('pauker_remote_index_v1', JSON.stringify(tree));
            alert("Index erfolgreich von GitHub aktualisiert!");
            window.location.reload();
        } catch (err) {
            alert("Remote-Update fehlgeschlagen (evtl. API-Limit überschritten?): " + err.message);
            window.location.reload();
        }
    }

    /**
     * Hilfsfunktion: Baut aus der flachen Git-Liste einen hierarchischen Baum
     */
    function buildTreeFromFlatList(list) {
        const root = [];
        const map = { 'database': { children: root } };

        list.forEach(n => {
            const parts = n.path.split('/');
            let currentPath = '';

            parts.forEach((part, i) => {
                const parentPath = currentPath;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (!map[currentPath]) {
                    const isFolder = (n.type === 'tree') || (i < parts.length - 1);
                    const node = {
                        id: currentPath,
                        name: part,
                        isFolder: isFolder
                    };

                    if (isFolder) {
                        node.children = [];
                    } else {
                        const ext = part.split('.').pop().toLowerCase();
                        if (ext === 'json') node.kind = 'json';
                        else if (ext === 'pdf') node.kind = 'pdf';
                        else if (ext === 'pptx' || ext === 'ppt') node.kind = 'pptx';
                    }

                    map[currentPath] = node;
                    if (map[parentPath]) {
                        map[parentPath].children.push(node);
                    }
                }
            });
        });
        return root;
    }

    // --- 5. Fortschritts-System ---
    const PROGRESS_KEY = 'pauker_progress';

    function getProgress(fileId) {
        try {
            const raw = localStorage.getItem(PROGRESS_KEY);
            if (!raw) return 0;
            const data = JSON.parse(raw);
            return data[fileId] || 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Aktualisiert die visuelle Anzeige aller sichtbaren Tree-Items
     * ohne den Baum neu zu bauen (Performance/State-Erhalt).
     */
    function updateTreeProgress() {
        const rows = document.querySelectorAll('.tree-row');
        rows.forEach(row => {
            // Wir müssen die ID finden. Der Parent .tree-node hat data-id.
            const nodeDiv = row.parentElement;
            if (!nodeDiv || !nodeDiv.dataset.id) return;

            const id = nodeDiv.dataset.id;
            const progress = getProgress(id);

            if (progress > 0) {
                const pct = Math.round(progress * 100);
                const color = 'rgba(20, 100, 40, 0.25)';
                row.style.background = `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`;
                row.setAttribute('title', `Fortschritt: ${pct}%`);
            } else {
                row.style.background = '';
                row.removeAttribute('title');
            }
        });
    }

    // Initialize
    init();

})();
