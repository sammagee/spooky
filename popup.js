(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try { host = new URL(tab.url).hostname; } catch (e) {}
  document.getElementById('host').textContent = host || '(unsupported page)';
  const { hwDisabledHosts = [], hwGlobalOff = false } = await chrome.storage.sync.get(['hwDisabledHosts', 'hwGlobalOff']);
  const site = document.getElementById('site'), glob = document.getElementById('global');
  site.checked = !hwDisabledHosts.includes(host); glob.checked = !hwGlobalOff;
  site.onchange = async () => {
    const { hwDisabledHosts: list = [] } = await chrome.storage.sync.get('hwDisabledHosts');
    const s = new Set(list); site.checked ? s.delete(host) : s.add(host);
    await chrome.storage.sync.set({ hwDisabledHosts: [...s] });
  };
  glob.onchange = () => chrome.storage.sync.set({ hwGlobalOff: !glob.checked });
})();
