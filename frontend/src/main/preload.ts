import { ipcRenderer } from "electron";

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readdir: (path: any, config: any) =>
  {
    return ipcRenderer.invoke('readdir', path, config)
  },
  readFileSync: (path: any) =>
  {
    return ipcRenderer.invoke('readFileSync', path)
  }
}
);
