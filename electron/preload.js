const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("penrxDesktop", {
  isElectron: true,
  platform: process.platform,
  version: "1.0.0",
});
