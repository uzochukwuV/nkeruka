// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example' | 'test:progress' | 'test:screenshot';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  test: {
    start: (config: any) => ipcRenderer.invoke('test:start', config),
    stop: () => ipcRenderer.invoke('test:stop'),
    getStatus: () => ipcRenderer.invoke('test:status'),
    saveReport: (result: any) => ipcRenderer.invoke('test:save-report', result),
    onProgress: (callback: (step: any) => void) => {
      ipcRenderer.on('test:progress', (_event, step) => callback(step));
    },
    onScreenshot: (callback: (screenshot: string) => void) => {
      ipcRenderer.on('test:screenshot', (_event, screenshot) => callback(screenshot));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
