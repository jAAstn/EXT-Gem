let extensionToFolder = {};
let ENABLED = true;
// Wir speichern die rohen Strings für die Settings, aber kompilierte Regex für den Check
let SPECIAL_DOMAINS_PATTERNS = []; 

chrome.storage.sync.get(['enabled', 'specialDomains'], (data) => {
  ENABLED = data.enabled !== false;
  // Beim Start: Patterns laden und in Regex umwandeln
  updateDomainPatterns(data.specialDomains || []);
});

fetch(chrome.runtime.getURL('mapping.json'))
  .then(res => res.json())
  .then(data => {
    extensionToFolder = data;
    console.log("Mappings geladen:", extensionToFolder);
  });

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  if (!ENABLED) return suggest();

  const url = downloadItem.finalUrl || downloadItem.url || '';
  if (!isSpecialDomain(url)) return suggest();

  const baseFilename = (downloadItem.filename || '').split('/').pop();
  if (!baseFilename) {
    console.warn("Download blockiert: Kein Dateiname erkannt.");
    return suggest({ cancel: true });
  }

  const folder = determineFolder(baseFilename);
  if (!folder) {
    console.warn("Download blockiert: Kein Zielordner für Dateityp.");
    return suggest({ cancel: true });
  }

  const newPath = `${folder}/${baseFilename}`;
  if (!newPath) return suggest(); // Sicherheit

  suggest({ filename: newPath });
});

/**
 * Wandelt die Domain-Liste in Regex-Objekte um und speichert sie global.
 */
function updateDomainPatterns(domainList) {
  SPECIAL_DOMAINS_PATTERNS = domainList.map(pattern => {
    try {
      return globToRegex(pattern);
    } catch (e) {
      console.error("Ungültiges Pattern:", pattern, e);
      return null;
    }
  }).filter(Boolean); // Entfernt ungültige Einträge
}

/**
 * Wandelt User-Eingaben (Globs) in echte Regex um.
 * Unterstützt: 
 * * -> Wildcard (z.B. *.redd.it)
 * [1-9] -> Ranges (z.B. jpg[1-9])
 */
function globToRegex(pattern) {
  // 1. Escape spezielle Regex-Zeichen, ABER behalte *, [, ], - für Ranges/Wildcards
  // Wir escapen: . + ? ^ $ { } ( ) | \
  let escaped = pattern.replace(/[.+?^${}()|\\]/g, "\\$&");

  // 2. Ersetze den Wildcard-Stern * durch den Regex-Ausdruck .* (beliebig viele Zeichen)
  escaped = escaped.replace(/\*/g, ".*");

  // 3. Da wir [ und ] nicht escaped haben, funktionieren Ranges wie [1-9] automatisch.
  
  // 'i' flag sorgt dafür, dass Groß-/Kleinschreibung egal ist
  return new RegExp(escaped, 'i');
}

function isSpecialDomain(url) {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    
    // Prüfen, ob irgendein Pattern auf die Domain passt
    return SPECIAL_DOMAINS_PATTERNS.some(regex => regex.test(domain));
  } catch {
    return false;
  }
}

function determineFolder(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return extensionToFolder[ext] || null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "toggle") {
    ENABLED = msg.value;
    chrome.storage.sync.set({ enabled: ENABLED }, () => {
      sendResponse({ status: "ok" });
    });
    return true;
  } else if (msg.action === "updateDomains") {
    const newDomains = msg.value || [];
    
    // Sofort die Patterns im laufenden Skript aktualisieren
    updateDomainPatterns(newDomains);

    // Und speichern
    chrome.storage.sync.set({ specialDomains: newDomains }, () => {
      sendResponse({ status: "ok" });
    });
    return true;
  }
});