const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("penrxDesktop", {
  isElectron: true,
  platform: process.platform,
  version: "1.0.0",
  /**
   * Requests the real hardware machine ID from the main process.
   * Uses Motherboard Serial → Windows GUID → MAC Address → Hostname fallback.
   * Returns a stable PRX-XXXX-XXXX-XXXX formatted ID.
   */
  getHardwareMachineId: () => ipcRenderer.invoke("get-hardware-machine-id"),
});

