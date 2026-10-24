const { contextBridge, ipcRenderer } = require("electron");

// Extract pre-computed hardware machine ID passed synchronously via additionalArguments
const hwArg = (process.argv || []).find((arg) => arg.startsWith("--penrx-hw-id="));
const initialHardwareId = hwArg ? hwArg.split("=")[1] : null;

contextBridge.exposeInMainWorld("penrxDesktop", {
  isElectron: true,
  platform: process.platform,
  hardwareMachineId: initialHardwareId,
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getHardwareMachineId: () =>
    initialHardwareId
      ? Promise.resolve(initialHardwareId)
      : ipcRenderer.invoke("get-hardware-machine-id"),
  downloadAndInstallUpdate: (url) => ipcRenderer.invoke("download-and-install-update", url),
  onUpdateProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("update-download-progress", listener);
    return () => ipcRenderer.removeListener("update-download-progress", listener);
  },
  onUpdateAvailable: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("update_available", listener);
    return () => ipcRenderer.removeListener("update_available", listener);
  },
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  /**
   * Native Desktop WhatsApp Direct File Share (Image or PDF):
   * Copies the image or PDF file directly into the OS clipboard, opens the patient's WhatsApp chat,
   * and triggers automatic paste into WhatsApp Desktop/Web.
   */
  shareWhatsAppDesktop: (payload) => ipcRenderer.invoke("share-whatsapp-desktop", payload),
  toggleFullScreen: () => ipcRenderer.invoke("toggle-fullscreen"),
  isFullScreen: () => ipcRenderer.invoke("is-fullscreen"),
  maximizeWindow: (force) => ipcRenderer.invoke("maximize-window", force),
  ensureMaximized: () => ipcRenderer.invoke("ensure-maximized"),
  restartApp: () => ipcRenderer.send("restart_app"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("quit-and-install-update"),
  checkDifferentialUpdate: () => ipcRenderer.invoke("check-differential-update"),
  downloadDifferentialUpdate: () => ipcRenderer.invoke("download-differential-update"),
  signalReady: () => ipcRenderer.send("app-ready"),
});
