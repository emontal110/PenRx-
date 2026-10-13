const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("penrxDesktop", {
  isElectron: true,
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  /**
   * Requests the real hardware machine ID from the main process.
   * Uses Motherboard Serial → Windows GUID → MAC Address → Hostname fallback.
   * Returns a stable PRX-XXXX-XXXX-XXXX formatted ID.
   */
  getHardwareMachineId: () => ipcRenderer.invoke("get-hardware-machine-id"),
  /**
   * Triggers native desktop auto-update download and installation
   */
  downloadAndInstallUpdate: (url) => ipcRenderer.invoke("download-and-install-update", url),
  /**
   * Subscribes to native download progress events
   */
  onUpdateProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("update-download-progress", listener);
    return () => ipcRenderer.removeListener("update-download-progress", listener);
  },
  /**
   * Opens link directly in the default OS browser
   */
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  /**
   * Window size & Fullscreen controls
   */
  toggleFullScreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  isFullScreen: () => ipcRenderer.invoke("is-fullscreen"),
  maximizeWindow: (force) => ipcRenderer.invoke("maximize-window", force),
  ensureMaximized: () => ipcRenderer.invoke("ensure-maximized"),
  /**
   * Differential auto-updater methods (Classico parity)
   */
  restartApp: () => ipcRenderer.send("restart_app"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("quit-and-install-update"),
  checkDifferentialUpdate: () => ipcRenderer.invoke("check-differential-update"),
  downloadDifferentialUpdate: () => ipcRenderer.invoke("download-differential-update"),
});

