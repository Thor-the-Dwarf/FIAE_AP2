/**
 * ============================================================================
 * config.js - Globale Konfiguration für Skill-Station
 * ============================================================================
 * 
 * ZWECK:
 * Diese Datei enthält die globale Konfiguration für die Skill-Station-Anwendung,
 * insbesondere den Google Drive API-Schlüssel.
 * 
 * WICHTIGE HINWEISE FÜR ENTWICKLER:
 * ----------------------------------
 * 
 * 1. SICHERHEIT:
 *    - Diese Datei enthält den API-Schlüssel für Google Drive
 *    - Für GitHub Pages: Diese Datei MUSS eingecheckt werden
 *    - Der API-Key sollte in der Google Cloud Console auf deine Domain 
 *      beschränkt werden (HTTP-Referrer-Einschränkung)
 * 
 * 2. SETUP FÜR LOKALE ENTWICKLUNG:
 *    - Kopiere diese Datei bei Bedarf
 *    - Ersetze den apiKey mit deinem eigenen Google Drive API Key
 *    - Stelle sicher, dass localhost als erlaubte Domain eingetragen ist
 * 
 * 3. GOOGLE DRIVE API EINRICHTEN:
 *    a) Gehe zu: https://console.cloud.google.com/
 *    b) Erstelle ein neues Projekt oder wähle ein bestehendes
 *    c) Aktiviere die "Google Drive API"
 *    d) Erstelle einen API-Schlüssel unter "Anmeldedaten"
 *    e) Beschränke den Schlüssel auf:
 *       - API: Google Drive API
 *       - HTTP-Referrer: Deine Domain (z.B. https://USERNAME.github.io/*)
 * 
 * 4. DEPLOYMENT:
 *    - Für GitHub Pages: Diese Datei muss im Repository sein
 *    - Der API-Key muss für deine GitHub Pages URL freigeschaltet sein
 *    - Beispiel: https://thor-the-dwarf.github.io/*
 * 
 * VERWENDUNG IM CODE:
 * -------------------
 * Der API-Key wird an verschiedenen Stellen verwendet:
 * - index.html: Für die SPA-Version beim Laden der Drive-Struktur
 * - index.js: Für debugg.html beim API-Zugriff
 * - drive_interpreter.js: Beim Laden von JSON-Payloads aus Drive
 * 
 * ZUGRIFF AUF DIE KONFIGURATION:
 * ------------------------------
 * Im JavaScript-Code kann auf die Konfiguration zugegriffen werden:
 *   const apiKey = window.AppConfig.apiKey;
 * 
 * ============================================================================
 */

/**
 * Globales Konfigurationsobjekt
 * @type {Object}
 * @property {string} apiKey - Google Drive API-Schlüssel (v3)
 * @property {string} [clientId] - Optional: OAuth Client-ID (falls OAuth benötigt wird)
 */
window.AppConfig = {
    /**
     * Google Drive API-Schlüssel
     * Dieser Key wird für alle Drive-API-Anfragen verwendet.
     * WICHTIG: Muss in der Google Cloud Console auf die richtige Domain beschränkt werden!
     */
    apiKey: 'AIzaSyAEywwkO3vwjIEvxUc1Ewe6E0_-Y5V5rm0',
    
    /**
     * Optional: OAuth Client-ID
     * Wird benötigt, falls du OAuth 2.0 für erweiterte Berechtigungen verwenden möchtest.
     * Aktuell verwendet die Anwendung nur öffentlich freigegebene Drive-Ordner,
     * daher ist dies nicht erforderlich.
     */
    // clientId: 'DEINE-CLIENT-ID.apps.googleusercontent.com',

    /**
     * Backend-URL für das "Netzwerk"
     * Hier werden der app_index.js und die Datenbank-Dateien geladen.
     */
    backendUrl: 'https://thor-the-dwarf.github.io/pauker-tool01/',
};
