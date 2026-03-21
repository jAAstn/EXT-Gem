// Globale Variablen für den schnellen Zugriff (Cache)
let g_extensionToFolder = null;
let g_settings = { enabled: true, specialDomains: new Set() };

// Initialisierung beim Start des Service Workers
initialize();

async function initialize() {
  await loadSettings();
  await loadMapping();
  console.log("Service Worker initialisiert. Bereit für Downloads.");
}

// Einstellungen laden
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['enabled', 'specialDomains'], (data) => {
      g_settings.enabled = data.enabled !== false;
      g_settings.specialDomains = new Set(data.specialDomains || []);
      console.log("Settings geladen:", g_settings);
      resolve();
    });
  });
}

// Mapping laden
async function loadMapping() {
  try {
    const res = await fetch(chrome.runtime.getURL('mapping.json'));
    g_extensionToFolder = await res.json();
    console.log("Mapping geladen:", g_extensionToFolder);
  } catch (e) {
    console.error("Fehler beim Laden der mapping.json:", e);
    g_extensionToFolder = {}; // Fallback, damit es nicht crasht
  }
}

// Listener für Einstellungsänderungen (damit wir nicht neu starten müssen)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.enabled) g_settings.enabled = changes.enabled.newValue;
    if (changes.specialDomains) g_settings.specialDomains = new Set(changes.specialDomains.newValue || []);
    console.log("Einstellungen aktualisiert:", g_settings);
  }
});

// === HAUPTLOGIK ===
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // WICHTIG: Da suggest() asynchron aufgerufen wird, müssen wir den Prozess sofort starten
  // und 'true' zurückgeben.
  
  handleDownload(downloadItem, suggest);
  return true; // Sagt Chrome: "Warte auf meine asynchrone Antwort!"
});

async function handleDownload(downloadItem, suggest) {
  // 1. Sicherheitscheck: Sind Daten geladen? Wenn nein, schnell laden.
  if (!g_extensionToFolder) await loadMapping();
  
  // 2. Ist Extension aktiv?
  if (!g_settings.enabled) {
    console.log("Extension ist deaktiviert -> Standard Download.");
    suggest();
    return;
  }

  const url = downloadItem.finalUrl || downloadItem.url || '';
  console.log(`Prüfe Download: ${url}`);

  // 3. Domain Check
  if (!isSpecialDomain(url)) {
    console.log("Domain nicht in der Liste -> Standard Download.");
    suggest();
    return;
  }

  // 4. Dateiname und Extension ermitteln
  const originalFilename = downloadItem.filename; // Pfad/Name vom System
  // Wir nehmen nur den Dateinamen, entfernen Pfade, um Probleme zu vermeiden
  let baseFilename = originalFilename.replace(/\\/g, '/').split('/').pop();
  
  const folder = determineFolder(baseFilename);
  
  if (!folder) {
    console.log(`Kein Ordner für Datei '${baseFilename}' gefunden -> Standard Download.`);
    suggest();
    return;
  }

  // 5. Neuen Pfad bauen
  // WICHTIG: Chrome erwartet Forward Slashes /, auch auf Windows
  const newPath = `${folder}/${baseFilename}`;
  
  console.log(`Verschiebe '${baseFilename}' nach '${newPath}'`);
  
  // Konflikt-Handling: 'overwrite', 'uniquify' (umbenennen 1, 2) oder 'prompt'
  suggest({ 
    filename: newPath,
    conflictAction: 'uniquify' 
  });
}

function isSpecialDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // Prüfen ob einer der Domain-Teile im Set ist
    return [...g_settings.specialDomains].some(d => hostname.includes(d));
  } catch (e) {
    console.warn("URL Parsing Fehler:", e);
    return false;
  }
}

function determineFolder(filename) {
  if (!filename || !filename.includes('.')) return null;
  
  // Letzten Teil nach dem Punkt holen
  const ext = '.' + filename.split('.').pop().toLowerCase();
  
  // Debugging Hilfe
  const mappedFolder = g_extensionToFolder[ext];
  console.log(`Extrahierte Endung: '${ext}' -> Zielordner: '${mappedFolder}'`);
  
  return mappedFolder || null;
}

// Nachrichten vom Popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Muss 'true' zurückgeben, um eine asynchrone Antwort zu ermöglichen
  if (msg.action === "toggle") {
    chrome.storage.sync.set({ enabled: msg.value }, () => {
      sendResponse({ status: "ok" });
    });
    return true; 
  } else if (msg.action === "updateDomains") {
    // Stellen Sie sicher, dass der Callback nach chrome.storage.sync.set ausgeführt wird.
    chrome.storage.sync.set({ specialDomains: msg.value }, () => {
      // Wenn der Speichervorgang abgeschlossen ist, antworten wir.
      sendResponse({ status: "ok" });
    });
    return true; // Ermöglicht die asynchrone Antwort
  }
});