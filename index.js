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
        loadAppState();
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

        // Falls wir eine Backend-URL haben, erzwingen wir ein frisches Laden (kein lokaler Cache)
        if (backendUrl) {
            console.log("Erzwinge frisches Laden vom Backend:", backendUrl);
            try {
                // Wir laden app_index.js dynamisch als Script mit Cache-Buster
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    // Cache-Buster hinzufügen (?t=...)
                    const cacheBuster = 't=' + new Date().getTime();
                    script.src = getRemoteUrl('app_index.js') + (getRemoteUrl('app_index.js').includes('?') ? '&' : '?') + cacheBuster;
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                rootTree = window.DATABASE_INDEX || [];

                // Optional: Den Cache für Offline-Modus aktualisieren
                localStorage.setItem('pauker_remote_index_v1', JSON.stringify(rootTree));
            } catch (e) {
                console.error("Fehler beim Laden des Remote-Index:", e);

                // Fallback: Wenn Netzwerk fehlschlägt, doch den Cache probieren
                const cachedIndex = localStorage.getItem('pauker_remote_index_v1');
                if (cachedIndex) {
                    try {
                        rootTree = JSON.parse(cachedIndex);
                        console.log("Nutze Cache-Fallback nach Netzwerkfehler.");
                    } catch (_) { }
                }

                if (!rootTree || rootTree.length === 0) {
                    viewBodyEl.innerHTML = `<div style="padding:2rem; color:hsl(var(--error))">
                        <h3>Netzwerk-Fehler</h3>
                        <p>Der Index konnte nicht vom Backend geladen werden (${backendUrl}).</p>
                    </div>`;
                }
            }
        } else {
            // Klassischer Modus: Versuche Cache, dann lokaler Index
            const cachedIndex = localStorage.getItem('pauker_remote_index_v1');
            if (cachedIndex) {
                try {
                    rootTree = JSON.parse(cachedIndex);
                } catch (e) {
                    rootTree = window.DATABASE_INDEX || [];
                }
            } else {
                rootTree = window.DATABASE_INDEX || [];
            }
        }

        drawerTitleEl.textContent = backendUrl ? "🌍 Netzwerk" : rootName;

        treeRootEl.innerHTML = '';
        buildTreeHelper(treeRootEl, rootTree, 0);

        // Initial View
        viewTitleEl.textContent = 'Bereit';
        viewPathEl.textContent = rootName;
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
            } else {
                const sp = document.createElement('span');
                sp.className = 'tree-spacer';
                row.appendChild(sp);
            }

            const icon = document.createElement('span');
            icon.className = 'tree-icon';
            const isOpen = appState.openedIds.includes(node.id);
            icon.textContent = node.isFolder ? (isOpen ? "📂" : "📁") : (node.kind !== "json" ? "👁" : "🏋");
            row.appendChild(icon);

            const label = document.createElement('button');
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
            window.open(getRemoteUrl(node.id), '_blank');
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

                // Falls die Daten fehlen (dynamischer Index), müssen wir sie nachladen
                if (!node.data) {
                    viewBodyEl.innerHTML = '<div style="padding:2rem; text-align:center;">Lade Spieldaten...</div>';
                    try {
                        const cacheBuster = 't=' + new Date().getTime();
                        const fetchUrl = getRemoteUrl(node.id) + (getRemoteUrl(node.id).includes('?') ? '&' : '?') + cacheBuster;
                        const resp = await fetch(fetchUrl);
                        if (!resp.ok) throw new Error("Datei nicht gefunden.");
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
                        <button class="btn primary" onclick="window.open(getRemoteUrl('${node.id}'), '_blank')">
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
                        <button class="btn primary" onclick="window.open(getRemoteUrl('${node.id}'), '_blank')">
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
        // Wir übergeben die absolute URL an den Game-Loader
        iframe.src = `games/game_loader.html?file=${encodeURIComponent(getRemoteUrl(node.id))}`;
        viewBodyEl.appendChild(iframe);

        iframe.onload = () => {
            const isLight = document.documentElement.classList.contains('theme-light');
            if (isLight) iframe.contentDocument.documentElement.classList.add('theme-light');
        };
    }

    // --- 4. Globale Hilfsfunktionen & Remote Indexing ---

    /**
     * ZWECK: Erstellt eine absolute URL basierend auf der backendUrl in config.js
     */
    function getRemoteUrl(path) {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const base = window.AppConfig.backendUrl || '';
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

    // Initialize
    init();

})();
