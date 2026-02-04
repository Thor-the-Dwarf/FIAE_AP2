const fs = require('fs');
const path = require('path');

/**
 * ZWECK:
 * Durchsucht den 'database'-Ordner und generiert eine 'app_index.js',
 * damit alle Spiele und Dokumente im Baum des Pauker-Tools angezeigt werden.
 */

const DATABASE_ROOT = path.join(__dirname, '../database');
const OUTPUT_FILE = path.join(__dirname, '../app_index.js');

function scanDir(dirPath, relativeRoot = 'database') {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = [];

    // Sortieren: Ordner zuerst, dann alphabetisch
    const sortedItems = items.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    for (const item of sortedItems) {
        if (item.name.startsWith('.')) continue; // Versteckte Dateien ignorieren

        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(path.join(__dirname, '..'), fullPath);

        const node = {
            id: relativePath.replace(/\\/g, '/'), // Windows-Pfadkompatibilität
            name: item.name,
            isFolder: item.isDirectory()
        };

        if (item.isDirectory()) {
            const children = scanDir(fullPath, relativeRoot);
            if (children.length > 0) {
                node.children = children;
                result.push(node);
            }
        } else {
            const ext = path.extname(item.name).toLowerCase();
            if (ext === '.json') {
                node.kind = 'json';
                try {
                    // Inhalt puffern für GitHub Pages / Offline-Support
                    const content = fs.readFileSync(fullPath, 'utf8');
                    node.data = JSON.parse(content);
                } catch (err) {
                    console.warn(`Fehler beim Lesen von ${item.name}:`, err.message);
                }
                result.push(node);
            } else if (ext === '.pdf') {
                node.kind = 'pdf';
                result.push(node);
            } else if (ext === '.pptx' || ext === '.ppt') {
                node.kind = 'pptx';
                result.push(node);
            }
        }
    }

    return result;
}

console.log('Scanne Datenbank...');
const tree = scanDir(DATABASE_ROOT);

const outputContent = `/** 
 * AUTOMATISCH GENERIERT am ${new Date().toLocaleString()}
 * Nicht manuell ändern! Nutze node tools/update_index.js
 */
window.DATABASE_INDEX = ${JSON.stringify(tree, null, 2)};
`;

fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
console.log('Erfolg: app_index.js wurde aktualisiert!');
