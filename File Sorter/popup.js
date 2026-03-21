
const toggle = document.getElementById('toggle');
const textarea = document.getElementById('domains');
const saveBtn = document.getElementById('saveBtn');

chrome.storage.sync.get(['enabled', 'specialDomains'], (data) => {
  toggle.checked = data.enabled !== false;
  textarea.value = (data.specialDomains || []).join(', ');
});

toggle.addEventListener('change', () => {
  chrome.runtime.sendMessage({ action: "toggle", value: toggle.checked }, (res) => {
    console.log("Status geändert:", res);
  });
});

saveBtn.addEventListener('click', () => {
  const domains = textarea.value
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);
  chrome.runtime.sendMessage({ action: "updateDomains", value: domains }, (res) => {
    console.log("Domains aktualisiert:", res);
  });
});
