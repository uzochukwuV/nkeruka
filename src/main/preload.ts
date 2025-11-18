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
      const handler = (_event: any, step: any) => callback(step);
      ipcRenderer.on('test:progress', handler);
      // Return cleanup function
      return () => ipcRenderer.removeListener('test:progress', handler);
    },
    onScreenshot: (callback: (screenshot: string) => void) => {
      const handler = (_event: any, screenshot: string) => callback(screenshot);
      ipcRenderer.on('test:screenshot', handler);
      // Return cleanup function
      return () => ipcRenderer.removeListener('test:screenshot', handler);
    },
  },
  scheduler: {
    start: () => ipcRenderer.invoke('scheduler:start'),
    stop: () => ipcRenderer.invoke('scheduler:stop'),
    addTest: (test: any) => ipcRenderer.invoke('scheduler:add-test', test),
    removeTest: (testId: string) => ipcRenderer.invoke('scheduler:remove-test', testId),
    pauseTest: (testId: string) => ipcRenderer.invoke('scheduler:pause-test', testId),
    resumeTest: (testId: string) => ipcRenderer.invoke('scheduler:resume-test', testId),
    getTests: () => ipcRenderer.invoke('scheduler:get-tests'),
    getStatus: () => ipcRenderer.invoke('scheduler:get-status'),
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
