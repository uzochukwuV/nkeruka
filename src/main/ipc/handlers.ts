/**
 * IPC Handlers for communication between renderer and main process
 */

import { ipcMain, BrowserWindow } from 'electron';
import { TestRunner } from '../services/TestRunner';
import { TestConfig, TestStep, TestResult } from '../types';

let testRunner: TestRunner | null = null;

/**
 * Setup IPC handlers
 */
export function setupIPCHandlers(mainWindow: BrowserWindow) {
  /**
   * Start a new test
   */
  ipcMain.handle('test:start', async (_event, config: TestConfig) => {
    try {
      // Create new test runner
      testRunner = new TestRunner();

      // Start test with progress and screenshot callbacks
      const result = await testRunner.startTest(
        config,
        (step: TestStep) => {
          // Send progress updates to renderer
          mainWindow.webContents.send('test:progress', step);
        },
        (screenshot: string) => {
          // Stream screenshots to renderer
          mainWindow.webContents.send('test:screenshot', screenshot);
        },
      );

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Stop current test
   */
  ipcMain.handle('test:stop', async () => {
    try {
      if (testRunner) {
        await testRunner.stopTest();
        return { success: true };
      }
      return { success: false, error: 'No test running' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get current test status
   */
  ipcMain.handle('test:status', async () => {
    try {
      if (testRunner) {
        const test = testRunner.getCurrentTest();
        return { success: true, test };
      }
      return { success: true, test: null };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Save test report
   */
  ipcMain.handle('test:save-report', async (_event, result: TestResult) => {
    try {
      const { dialog } = require('electron');
      const fs = require('fs').promises;

      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Test Report',
        defaultPath: `test-report-${Date.now()}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (filePath) {
        await fs.writeFile(filePath, JSON.stringify(result, null, 2));
        return { success: true, path: filePath };
      }

      return { success: false, error: 'Save cancelled' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
