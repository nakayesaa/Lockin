const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lockInSpike", {
  getSites: () => ipcRenderer.invoke("spike:get-sites"),
  openSite: (siteId) => ipcRenderer.invoke("spike:open-site", siteId),
  closeSite: () => ipcRenderer.invoke("spike:close-site"),
  runCookieCheck: () => ipcRenderer.invoke("spike:cookie-check"),
  getMetrics: () => ipcRenderer.invoke("spike:get-metrics"),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("spike:status", listener);
    return () => ipcRenderer.removeListener("spike:status", listener);
  }
});
