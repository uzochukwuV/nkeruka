# Web Agent Tester - Quick Fix Guide

## Critical Issues - Fix First (Do Today)

### Issue #1: BrowserService Event Listener Leak
**File:** `src/main/services/BrowserService.ts`
**Lines:** 43-86, 257-264

**Problem:** Event listeners (`page.on('console')`, `page.on('response')`, `page.on('pageerror')`) are never removed, causing memory leaks.

**Quick Fix:**
```typescript
// Add to class:
private listeners: Array<[string, Function]> = [];

// Modify setupListeners():
private setupListeners(): void {
  if (!this.page) return;

  const consoleHandler = (msg) => { /* existing code */ };
  this.page.on('console', consoleHandler);
  this.listeners.push(['console', consoleHandler]);
  
  // Repeat for response and pageerror...
}

// Modify close():
async close(): Promise<void> {
  // Add this:
  if (this.page) {
    this.listeners.forEach(([event, handler]) => {
      this.page?.off(event as any, handler as any);
    });
    this.listeners = [];
  }
  
  // ... rest of existing code ...
}
```

---

### Issue #2: SchedulerService Race Condition
**File:** `src/main/services/SchedulerService.ts`
**Lines:** 183-190

**Problem:** Non-atomic check-then-increment allows exceeding `maxConcurrentTests`.

**Quick Fix:**
```typescript
private async executeScheduledTest(test: ScheduledTest): Promise<void> {
  // Increment FIRST
  this.currentExecutions++;
  
  // Then check
  if (this.currentExecutions > this.maxConcurrentTests) {
    this.currentExecutions--; // Roll back
    console.log(`[Scheduler] Max concurrent tests reached, rescheduling ${test.name}`);
    setTimeout(() => {
      if (this.isRunning) this.scheduleTest(test);
    }, 5000);
    return;
  }
  
  try {
    // ... existing test execution code ...
  } finally {
    this.currentExecutions--;
    // ... rest of finally block ...
  }
}
```

---

### Issue #3: IPC Global TestRunner Not Cleaned Up
**File:** `src/main/ipc/handlers.ts`
**Lines:** 10, 23

**Problem:** Global `testRunner` is overwritten without cleanup, leaking browser resources.

**Quick Fix:**
```typescript
ipcMain.handle('test:start', async (_event, config: TestConfig) => {
  try {
    // Clean up previous test runner
    if (testRunner) {
      try {
        await testRunner.stopTest();
      } catch (e) {
        console.error('Failed to stop previous test:', e);
      }
      testRunner = null;
    }
    
    testRunner = new TestRunner();
    const result = await testRunner.startTest(config, ...callbacks);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});
```

---

### Issue #4: React TestRunner Component - Missing Listener Cleanup
**File:** `src/renderer/components/TestRunner.tsx`
**Lines:** 40-64

**Problem:** IPC listeners are registered but never cleaned up on unmount.

**Quick Fix:**
```typescript
useEffect(() => {
  if (!window.electron?.test) return;
  
  // Store unsubscribe functions
  const unsubscribeProgress = window.electron.test.onProgress((step: TestStep) => {
    setSteps((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === step.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = step;
        return updated;
      }
      return [...prev, step];
    });
    
    if (step.status === 'running') {
      setCurrentStep(`${step.action} ${step.target || ''}`);
    }
  });

  const unsubscribeScreenshot = window.electron.test.onScreenshot((screenshot: string) => {
    setLiveScreenshot(screenshot);
  });

  // IMPORTANT: Return cleanup function
  return () => {
    if (typeof unsubscribeProgress === 'function') unsubscribeProgress();
    if (typeof unsubscribeScreenshot === 'function') unsubscribeScreenshot();
  };
}, []);
```

**Also update preload.ts:**
```typescript
onProgress: (callback: (step: any) => void) => {
  const handler = (_event: IpcRendererEvent, step: any) => callback(step);
  ipcRenderer.on('test:progress', handler);
  return () => ipcRenderer.removeListener('test:progress', handler); // Return unsubscribe
},
onScreenshot: (callback: (screenshot: string) => void) => {
  const handler = (_event: IpcRendererEvent, screenshot: string) => callback(screenshot);
  ipcRenderer.on('test:screenshot', handler);
  return () => ipcRenderer.removeListener('test:screenshot', handler); // Return unsubscribe
},
```

---

## High Priority Issues - Fix Next

### Issue #5: Unbounded Console Logs and Network Requests
**File:** `src/main/services/BrowserService.ts`
**Lines:** 13-14, 54, 71

**Quick Fix:**
```typescript
// Add constants:
private readonly MAX_CONSOLE_LOGS = 1000;
private readonly MAX_NETWORK_REQUESTS = 5000;

// In setupListeners():
this.page.on('console', (msg) => {
  const consoleMessage: ConsoleMessage = { /* ... */ };
  this.consoleLogs.push(consoleMessage);
  
  // Keep only latest N
  if (this.consoleLogs.length > this.MAX_CONSOLE_LOGS) {
    this.consoleLogs = this.consoleLogs.slice(-this.MAX_CONSOLE_LOGS);
  }
});

this.page.on('response', async (response) => {
  // ... same pattern for networkRequests
  if (this.networkRequests.length > this.MAX_NETWORK_REQUESTS) {
    this.networkRequests = this.networkRequests.slice(-this.MAX_NETWORK_REQUESTS);
  }
});
```

---

### Issue #6: IPC Window Null Checks
**File:** `src/main/ipc/handlers.ts`
**Lines:** 30, 34

**Quick Fix:**
```typescript
const result = await testRunner.startTest(
  config,
  (step: TestStep) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('test:progress', step);
    }
  },
  (screenshot: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('test:screenshot', screenshot);
    }
  },
);
```

---

### Issue #7: SchedulerService localStorage Fix
**File:** `src/main/services/SchedulerService.ts`
**Lines:** 293-319

**Quick Fix:**
```typescript
// Add at top:
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

// Add method:
private getScheduleStoragePath(): string {
  return path.join(app.getPath('userData'), 'scheduled-tests.json');
}

// Replace saveScheduledTests():
private async saveScheduledTests(): Promise<void> {
  try {
    const tests = Array.from(this.scheduledTests.values());
    const storePath = this.getScheduleStoragePath();
    await fs.writeFile(storePath, JSON.stringify(tests, null, 2));
  } catch (error) {
    console.error('[Scheduler] Failed to save scheduled tests:', error);
  }
}

// Replace loadScheduledTests():
private async loadScheduledTests(): Promise<void> {
  try {
    const storePath = this.getScheduleStoragePath();
    const data = await fs.readFile(storePath, 'utf-8');
    const tests: ScheduledTest[] = JSON.parse(data);
    tests.forEach((test) => {
      this.scheduledTests.set(test.id, test);
    });
  } catch (error) {
    if ((error as any).code !== 'ENOENT') {
      console.error('[Scheduler] Failed to load scheduled tests:', error);
    }
  }
}
```

**Update constructor:**
```typescript
constructor() {
  this.loadScheduledTests(); // Remove await, call async internally
}
```

---

### Issue #8: TestRunner Screenshots Limit
**File:** `src/main/services/TestRunner.ts`
**Line:** 74

**Quick Fix:**
```typescript
private readonly MAX_SCREENSHOTS = 5;

// In startTest loop (around line 73-74):
const screenshot = await this.browserService.screenshot();
this.currentTest.screenshots.push(screenshot);

if (this.currentTest.screenshots.length > this.MAX_SCREENSHOTS) {
  this.currentTest.screenshots = this.currentTest.screenshots.slice(-this.MAX_SCREENSHOTS);
}
```

---

### Issue #9: Clear Screenshot Callback on Close
**File:** `src/main/services/BrowserService.ts`
**Location:** close() method

**Quick Fix:**
```typescript
async close(): Promise<void> {
  this.screenshotCallback = null; // Add this line
  
  if (this.page) await this.page.close();
  if (this.context) await this.context.close();
  if (this.browser) await this.browser.close();
  this.page = null;
  this.context = null;
  this.browser = null;
}
```

---

## Testing After Fixes

```bash
# Run these checks after implementing fixes:

1. Memory Test:
   - Run 10 consecutive tests
   - Check memory usage (should not grow beyond 500MB)
   - Check for process leaks: lsof -p <pid> | wc -l

2. Concurrency Test:
   - Set maxConcurrentTests = 2
   - Schedule 5 tests to run immediately
   - Verify only 2 run concurrently

3. Listener Test:
   - Mount/unmount TestRunner component 10 times
   - Check DevTools Memory tab for leaks

4. Persistence Test:
   - Schedule a test
   - Kill and restart app
   - Verify scheduled test still exists
```

---

## File Priority Order

Fix in this order for minimum disruption:

1. **BrowserService.ts** (5 issues)
   - Event listeners ← CRITICAL
   - Console logs limit
   - Network requests limit
   - Screenshot callback
   - Error logging

2. **SchedulerService.ts** (4 issues)
   - Race condition ← CRITICAL
   - localStorage → Electron storage
   - Untracked timers
   - Config hardcoding

3. **IPC handlers.ts** (3 issues)
   - Global cleanup ← CRITICAL
   - Window null checks
   - Config validation

4. **TestRunner.tsx** (Listener cleanup) ← CRITICAL

5. **TestRunner.ts** (Screenshots limit, delays)

6. **Preload.ts** (Update listener methods)

7. **Other components** (Error handling, types)

---

## Estimated Timeline

- **Critical Issues (1-4):** 2 hours
- **High Issues (5-11):** 3 hours  
- **Medium Issues (12-19):** 2 hours
- **Low Issues (20-24):** 1 hour

**Total: 8 hours** (can be parallelized with team)

