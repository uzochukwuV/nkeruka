/**
 * IPC Handlers for communication between renderer and main process
 */

import { ipcMain, BrowserWindow } from 'electron';
import { TestRunner } from '../services/TestRunner';
import { SchedulerService, ScheduledTest } from '../services/SchedulerService';
import { TestConfig, TestStep, TestResult } from '../types';

let testRunner: TestRunner | null = null;
let schedulerService: SchedulerService | null = null;

/**
 * Setup IPC handlers
 */
export function setupIPCHandlers(mainWindow: BrowserWindow) {
  /**
   * Start a new test
   */
  ipcMain.handle('test:start', async (_event, config: TestConfig) => {
    try {
      // Clean up previous test runner if it exists
      if (testRunner) {
        try {
          await testRunner.stopTest();
          console.log('[IPC] Stopped previous test before starting new one');
        } catch (e) {
          console.error('[IPC] Failed to stop previous test:', e);
        }
        testRunner = null;
      }

      // Create new test runner
      testRunner = new TestRunner();

      // Start test with progress and screenshot callbacks
      const result = await testRunner.startTest(
        config,
        (step: TestStep) => {
          // Send progress updates to renderer (with null check)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('test:progress', step);
          }
        },
        (screenshot: string) => {
          // Stream screenshots to renderer (with null check)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('test:screenshot', screenshot);
          }
        },
      );

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Clean up after test completes or fails
      const currentTest = testRunner?.getCurrentTest();
      if (currentTest && currentTest.status !== 'running') {
        testRunner = null;
      }
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
   * Initialize scheduler
   */
  if (!schedulerService) {
    schedulerService = new SchedulerService();
  }

  // ============================================================================
  // SCHEDULER HANDLERS - Autonomous Test Execution
  // ============================================================================

  /**
   * Start scheduler bot
   */
  ipcMain.handle('scheduler:start', async () => {
    try {
      if (!schedulerService) {
        schedulerService = new SchedulerService();
      }
      schedulerService.start();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Stop scheduler bot
   */
  ipcMain.handle('scheduler:stop', async () => {
    try {
      if (schedulerService) {
        schedulerService.stop();
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Add scheduled test
   */
  ipcMain.handle('scheduler:add-test', async (_event, test: ScheduledTest) => {
    try {
      if (!schedulerService) {
        schedulerService = new SchedulerService();
      }
      schedulerService.addScheduledTest(test);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Remove scheduled test
   */
  ipcMain.handle('scheduler:remove-test', async (_event, testId: string) => {
    try {
      if (schedulerService) {
        schedulerService.removeScheduledTest(testId);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Pause scheduled test
   */
  ipcMain.handle('scheduler:pause-test', async (_event, testId: string) => {
    try {
      if (schedulerService) {
        schedulerService.pauseScheduledTest(testId);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Resume scheduled test
   */
  ipcMain.handle('scheduler:resume-test', async (_event, testId: string) => {
    try {
      if (schedulerService) {
        schedulerService.resumeScheduledTest(testId);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get all scheduled tests
   */
  ipcMain.handle('scheduler:get-tests', async () => {
    try {
      if (!schedulerService) {
        return { success: true, tests: [] };
      }
      const tests = schedulerService.getScheduledTests();
      return { success: true, tests };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  /**
   * Get scheduler status
   */
  ipcMain.handle('scheduler:get-status', async () => {
    try {
      if (!schedulerService) {
        return {
          success: true,
          status: {
            isRunning: false,
            totalTests: 0,
            activeTests: 0,
            currentExecutions: 0,
          },
        };
      }
      const status = schedulerService.getStatus();
      return { success: true, status };
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
