const toggle = document.getElementById('toggle');
const textarea = document.getElementById('domains');
const saveBtn = document.getElementById('saveBtn');

// Initialer Status laden
chrome.storage.sync.get(['enabled', 'specialDomains'], (data) => {
  toggle.checked = data.enabled !== false;
  // Zeige die gespeicherten Domains an
  textarea.value = (data.specialDomains || []).join(', '); 
});

toggle.addEventListener('change', () => {
  chrome.runtime.sendMessage({ action: "toggle", value: toggle.checked }, (res) => {
    if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
  });
});

saveBtn.addEventListener('click', () => {
  const domains = textarea.value
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean); // Leere Einträge entfernen

  // Sende die aktualisierten Domains an den Service Worker
  chrome.runtime.sendMessage({ action: "updateDomains", value: domains }, (res) => {
    // WICHTIG: Warte auf die Antwort vom Service Worker.
    if (chrome.runtime.lastError) {
        console.error("Fehler beim Senden/Speichern:", chrome.runtime.lastError);
        saveBtn.innerText = "Fehler!";
        return;
    }
    
    // VISUELLE BESTÄTIGUNG und warten (hält das Popup offen, bis die Änderung verarbeitet ist)
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "Gespeichert!";
    
    // Optional: Lese die Daten sofort nach dem Speichern erneut, um die Anzeige zu bestätigen
    chrome.storage.sync.get(['specialDomains'], (data) => {
        textarea.value = (data.specialDomains || []).join(', ');
        setTimeout(() => saveBtn.innerText = originalText, 1500);
    });
  });
});