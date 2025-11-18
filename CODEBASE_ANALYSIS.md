# Web Agent Tester Codebase Analysis Report

## Executive Summary
Found **24 critical and high-severity issues** across the codebase, primarily related to memory leaks, race conditions, and resource cleanup. The most urgent issues are in BrowserService (event listener leaks), SchedulerService (race conditions), and IPC handlers (global state management).

---

## CRITICAL ISSUES (4)

### 1. BrowserService: Unremoved Event Listeners - Memory Leak
**File:** `/home/user/nkeruka/src/main/services/BrowserService.ts`
**Location:** Lines 43-86 (setupListeners)
**Severity:** CRITICAL

**Issue:**
Event listeners registered on the page object are never removed. When a BrowserService instance is closed, listeners persist in memory.

```typescript
// Line 47-55: Console listener never removed
this.page.on('console', (msg) => {
  // ... listener code
});

// Line 58-75: Network listener never removed
this.page.on('response', async (response) => {
  // ... listener code
});

// Line 78-85: Error listener never removed
this.page.on('pageerror', (error) => {
  // ... listener code
});
```

**Impact:** 
- Memory leaks grow with each test run
- Event handlers fire multiple times if page object is reused
- Cumulative performance degradation

**Recommendation:**
Store listener references and remove them in `close()` method:
```typescript
private listeners: Array<[string, Function]> = [];

private setupListeners(): void {
  if (!this.page) return;
  
  const consoleHandler = (msg) => { /* ... */ };
  this.page.on('console', consoleHandler);
  this.listeners.push(['console', consoleHandler]);
  
  // Add similar for 'response' and 'pageerror'
}

async close(): Promise<void> {
  if (this.page) {
    this.listeners.forEach(([event, handler]) => {
      this.page?.off(event as any, handler as any);
    });
    this.listeners = [];
  }
  // ... rest of close logic
}
```

---

### 2. SchedulerService: Race Condition in Concurrent Test Execution
**File:** `/home/user/nkeruka/src/main/services/SchedulerService.ts`
**Location:** Lines 183-190 (executeScheduledTest)
**Severity:** CRITICAL

**Issue:**
The `currentExecutions` counter is checked and incremented non-atomically, allowing multiple tests to exceed `maxConcurrentTests` limit:

```typescript
private async executeScheduledTest(test: ScheduledTest): Promise<void> {
  // Line 183: Check happens here
  if (this.currentExecutions >= this.maxConcurrentTests) {
    console.log(`[Scheduler] Max concurrent tests reached...`);
    setTimeout(() => this.scheduleTest(test), 5000);
    return;
  }

  // Line 190: But increment happens here - RACE WINDOW EXISTS
  this.currentExecutions++;
  
  // If two calls reach line 183 simultaneously with count=2 and maxConcurrentTests=3,
  // both will pass the check and increment to 3 and 4
}
```

**Impact:**
- Scheduler can exceed configured concurrent test limit
- Potential system overload with runaway browser instances
- Unpredictable resource consumption

**Recommendation:**
Use atomic increment pattern:
```typescript
private async executeScheduledTest(test: ScheduledTest): Promise<void> {
  // Atomically increment and check
  this.currentExecutions++;
  
  if (this.currentExecutions > this.maxConcurrentTests) {
    this.currentExecutions--;
    console.log(`[Scheduler] Max concurrent tests reached, rescheduling ${test.name}`);
    setTimeout(() => this.scheduleTest(test), 5000);
    return;
  }
  
  try {
    // ... test execution
  } finally {
    this.currentExecutions--;
    // ...
  }
}
```

---

### 3. IPC Handlers: Global TestRunner Instance Not Cleaned Up
**File:** `/home/user/nkeruka/src/main/ipc/handlers.ts`
**Location:** Lines 10, 23
**Severity:** CRITICAL

**Issue:**
Global `testRunner` is created for each test but never cleaned up, leaking browser resources:

```typescript
let testRunner: TestRunner | null = null;

ipcMain.handle('test:start', async (_event, config: TestConfig) => {
  try {
    // Line 23: Creates new TestRunner, old one is orphaned if test was running
    testRunner = new TestRunner();
    
    const result = await testRunner.startTest(config, ...callbacks);
    return { success: true, result };
    
    // testRunner is never set to null - browser resources leak
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**Impact:**
- Each test start without completing previous test leaks browser instance
- Multiple browser processes accumulate in memory
- System can run out of file descriptors/ports
- Tests may fail due to port conflicts

**Recommendation:**
Clean up previous test runner:
```typescript
ipcMain.handle('test:start', async (_event, config: TestConfig) => {
  try {
    // Clean up previous test runner if still running
    if (testRunner) {
      try {
        await testRunner.stopTest();
      } catch (e) {
        console.error('Failed to stop previous test:', e);
      }
    }
    
    testRunner = new TestRunner();
    const result = await testRunner.startTest(config, ...callbacks);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    // Clean up after test completes
    if (testRunner && testRunner.getCurrentTest()?.status !== 'running') {
      testRunner = null;
    }
  }
});
```

---

### 4. React TestRunner Component: IPC Listeners Not Cleaned Up
**File:** `/home/user/nkeruka/src/renderer/components/TestRunner.tsx`
**Location:** Lines 40-64 (useEffect)
**Severity:** CRITICAL

**Issue:**
Event listeners for test progress and screenshots are registered but never unregistered:

```typescript
useEffect(() => {
  // Line 42-63: Event listeners registered but no cleanup
  if (window.electron?.test) {
    window.electron.test.onProgress((step: TestStep) => {
      setSteps((prev) => { /* ... */ });
      if (step.status === 'running') {
        setCurrentStep(`${step.action} ${step.target || ''}`);
      }
    });

    window.electron.test.onScreenshot((screenshot: string) => {
      setLiveScreenshot(screenshot);
    });
  }
  // NO CLEANUP FUNCTION - CRITICAL!
}, []); // Runs once on mount, but listeners persist forever
```

**Impact:**
- Multiple listeners accumulate when component remounts
- Old listeners fire with stale component state
- Memory leak from uncleaned listener closures
- State update warnings on unmount

**Recommendation:**
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

  // Cleanup function
  return () => {
    if (typeof unsubscribeProgress === 'function') unsubscribeProgress();
    if (typeof unsubscribeScreenshot === 'function') unsubscribeScreenshot();
  };
}, []);
```

**Additional Issue in Preload:**
The preload's `onProgress` and `onScreenshot` methods need to return unsubscribe functions:
```typescript
// preload.ts needs modification
onProgress: (callback: (step: any) => void) => {
  ipcRenderer.on('test:progress', (_event, step) => callback(step));
  // Should return unsubscribe function
  return () => ipcRenderer.removeListener('test:progress', callback);
},
```

---

## HIGH SEVERITY ISSUES (7)

### 5. BrowserService: Unbounded Array Growth - Console Logs and Network Requests
**File:** `/home/user/nkeruka/src/main/services/BrowserService.ts`
**Location:** Lines 13-14, 54, 71
**Severity:** HIGH

**Issue:**
Console logs and network requests arrays grow indefinitely:

```typescript
private consoleLogs: ConsoleMessage[] = [];
private networkRequests: NetworkRequest[] = [];

// Every message appended without limits
this.page.on('console', (msg) => {
  const consoleMessage: ConsoleMessage = { /* ... */ };
  this.consoleLogs.push(consoleMessage); // No size limit
});

this.page.on('response', async (response) => {
  const networkRequest: NetworkRequest = { /* ... */ };
  this.networkRequests.push(networkRequest); // No size limit
});
```

**Impact:**
- Long-running tests accumulate GB of memory
- OOM (Out of Memory) crashes possible
- Especially problematic with scheduler continuously running tests

**Recommendation:**
Implement circular buffer or size limit:
```typescript
private readonly MAX_CONSOLE_LOGS = 1000;
private readonly MAX_NETWORK_REQUESTS = 5000;

private setupListeners(): void {
  if (!this.page) return;
  
  this.page.on('console', (msg) => {
    const consoleMessage: ConsoleMessage = {
      type: msg.type() as ConsoleMessage['type'],
      text: msg.text(),
      timestamp: Date.now(),
      location: msg.location().url,
    };
    this.consoleLogs.push(consoleMessage);
    
    // Keep only latest N items
    if (this.consoleLogs.length > this.MAX_CONSOLE_LOGS) {
      this.consoleLogs = this.consoleLogs.slice(-this.MAX_CONSOLE_LOGS);
    }
  });
  
  // Similar for networkRequests...
}
```

---

### 6. TestRunner: Multiple Race Conditions in Async Step Execution
**File:** `/home/user/nkeruka/src/main/services/TestRunner.ts`
**Location:** Lines 177-253 (executeStep)
**Severity:** HIGH

**Issue:**
Multiple hardcoded setTimeout calls can cause race conditions:

```typescript
case 'click':
  if (step.target) {
    await this.browserService.highlightElement(step.target);
    await new Promise(resolve => setTimeout(resolve, 500)); // Fixed delay 1
  }
  await this.browserService.click(step.target!);
  await new Promise(resolve => setTimeout(resolve, 500)); // Fixed delay 2
  await this.browserService.screenshot();
  break;

case 'fill':
  if (step.target) {
    await this.browserService.highlightElement(step.target);
    await new Promise(resolve => setTimeout(resolve, 500)); // Fixed delay 3
  }
  await this.browserService.fill(step.target!, step.value!);
  await new Promise(resolve => setTimeout(resolve, 500)); // Fixed delay 4
  await this.browserService.screenshot();
  break;
```

**Impact:**
- Fixed 500ms delays are inefficient (wait too long or not long enough)
- Network-dependent actions fail if server is slow
- Tests fail intermittently based on timing

**Additional Issue - Non-Atomic AI Service Check:**
```typescript
// Line 86: Non-null assertion without proper guarantee
const analysis = await this.aiService!.analyzePageAndDecideAction(
  // ...
);
// If aiService fails to initialize, crash at this point
```

**Recommendation:**
Implement proper wait strategies:
```typescript
private async waitForElement(selector: string, timeout = 5000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      await this.browserService.waitForSelector(selector, 100);
      return true;
    } catch (e) {
      if (Date.now() - startTime >= timeout) return false;
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return false;
}

private async executeStep(
  step: TestStep,
  progressCallback?: (step: TestStep) => void,
): Promise<void> {
  try {
    if (progressCallback) progressCallback(step);
    
    switch (step.action) {
      case 'click':
        if (step.target) {
          await this.browserService.highlightElement(step.target);
          // Wait for element to be ready, not fixed 500ms
          const ready = await this.waitForElement(step.target, 3000);
          if (!ready) {
            throw new Error(`Element not found: ${step.target}`);
          }
        }
        await this.browserService.click(step.target!);
        // Wait for page to stabilize
        await this.browserService.waitForNavigation(2000).catch(() => {});
        await this.browserService.screenshot();
        break;
      // ... similar for other actions
    }
    
    step.status = 'success';
  } catch (error) {
    step.status = 'failed';
    step.error = error instanceof Error ? error.message : String(error);
    // ... error handling
  }
}
```

---

### 7. SchedulerService: localStorage in Main Process - Will Not Work
**File:** `/home/user/nkeruka/src/main/services/SchedulerService.ts`
**Location:** Lines 297-319 (saveScheduledTests, loadScheduledTests)
**Severity:** HIGH

**Issue:**
localStorage is a browser API and won't exist in Node.js main process:

```typescript
private saveScheduledTests(): void {
  const tests = Array.from(this.scheduledTests.values());
  // Line 297: localStorage doesn't exist in main process (Node.js)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('scheduledTests', JSON.stringify(tests));
  }
}

private loadScheduledTests(): void {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('scheduledTests');
    // ...
  }
}
```

**Impact:**
- Scheduled tests are never persisted
- All schedules lost on app restart
- Configuration changes don't survive

**Recommendation:**
Use Electron's `userData` directory:
```typescript
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

private getScheduleStoragePath(): string {
  return path.join(app.getPath('userData'), 'scheduled-tests.json');
}

private async saveScheduledTests(): Promise<void> {
  try {
    const tests = Array.from(this.scheduledTests.values());
    const storePath = this.getScheduleStoragePath();
    await fs.writeFile(storePath, JSON.stringify(tests, null, 2));
  } catch (error) {
    console.error('[Scheduler] Failed to save scheduled tests:', error);
  }
}

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

---

### 8. IPC Handlers: Missing Window Null Checks in Callbacks
**File:** `/home/user/nkeruka/src/main/ipc/handlers.ts`
**Location:** Lines 30, 34
**Severity:** HIGH

**Issue:**
Window is referenced in callbacks without null checks:

```typescript
const result = await testRunner.startTest(
  config,
  (step: TestStep) => {
    // Line 30: No check if mainWindow still exists
    mainWindow.webContents.send('test:progress', step);
  },
  (screenshot: string) => {
    // Line 34: No check if mainWindow still exists
    mainWindow.webContents.send('test:screenshot', screenshot);
  },
);
```

**Impact:**
- Crash if window closes during test execution
- Unhandled exceptions kill process
- Tests cannot be gracefully interrupted

**Recommendation:**
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

### 9. TestRunner: Screenshots Array Unbounded Growth
**File:** `/home/user/nkeruka/src/main/services/TestRunner.ts`
**Location:** Line 74
**Severity:** HIGH

**Issue:**
Screenshots are stored without limits:

```typescript
while (stepCount < this.maxSteps && !testComplete) {
  // ...
  const screenshot = await this.browserService.screenshot();
  this.currentTest.screenshots.push(screenshot); // No limit!
}
```

**Impact:**
- Each screenshot is ~500KB base64 encoded
- 20 steps × 500KB = 10MB per test
- Multiple concurrent tests cause OOM

**Recommendation:**
Limit screenshot history:
```typescript
private readonly MAX_SCREENSHOTS = 5;

// In startTest loop:
const screenshot = await this.browserService.screenshot();
this.currentTest.screenshots.push(screenshot);

// Keep only last N screenshots
if (this.currentTest.screenshots.length > this.MAX_SCREENSHOTS) {
  this.currentTest.screenshots = this.currentTest.screenshots.slice(-this.MAX_SCREENSHOTS);
}
```

---

### 10. BrowserService: Screenshot Callback Never Cleared
**File:** `/home/user/nkeruka/src/main/services/BrowserService.ts`
**Location:** Lines 115-117
**Severity:** HIGH

**Issue:**
The screenshot callback can accumulate across multiple test instances:

```typescript
private screenshotCallback: ((screenshot: string) => void) | null = null;

setScreenshotCallback(callback: (screenshot: string) => void): void {
  this.screenshotCallback = callback; // Old callback is overwritten but not cleared
}

async screenshot(): Promise<string> {
  const buffer = await this.page.screenshot({ fullPage: false });
  const base64 = buffer.toString('base64');
  
  if (this.screenshotCallback) {
    this.screenshotCallback(base64); // Old callback from previous test could fire
  }
  return base64;
}
```

**Impact:**
- Callbacks fire with stale context
- Memory leak from callback closures
- Data sent to wrong listeners

**Recommendation:**
```typescript
async close(): Promise<void> {
  this.screenshotCallback = null; // Clear callback
  // ... rest of close logic
}
```

---

### 11. SchedulerService: Untracked Rescheduling Timer
**File:** `/home/user/nkeruka/src/main/services/SchedulerService.ts`
**Location:** Line 186
**Severity:** HIGH

**Issue:**
When max concurrent tests is reached, a rescheduling setTimeout is created but not tracked:

```typescript
if (this.currentExecutions >= this.maxConcurrentTests) {
  console.log(`[Scheduler] Max concurrent tests reached...`);
  // Line 186: This timer is NOT stored in this.timers map
  setTimeout(() => this.scheduleTest(test), 5000);
  return;
}
```

**Impact:**
- Timers persist even after `stop()` is called
- Tests may execute after scheduler stops
- Memory leak from orphaned timers

**Recommendation:**
```typescript
private async executeScheduledTest(test: ScheduledTest): Promise<void> {
  if (this.currentExecutions >= this.maxConcurrentTests) {
    console.log(`[Scheduler] Max concurrent tests reached, rescheduling ${test.name}`);
    
    // Store timer so it can be cleaned up
    const timer = setTimeout(() => {
      if (this.isRunning) {
        this.scheduleTest(test);
      }
    }, 5000);
    
    // Track with a unique key
    this.timers.set(`reschedule-${test.id}-${Date.now()}`, timer);
    return;
  }
  // ... rest of method
}
```

---

## MEDIUM SEVERITY ISSUES (8)

### 12. Type Safety: Incomplete Channel Types in Preload
**File:** `/home/user/nkeruka/src/main/preload.ts`
**Location:** Line 5
**Severity:** MEDIUM

**Issue:**
Channel type definition is incomplete:

```typescript
export type Channels = 'ipc-example' | 'test:progress' | 'test:screenshot';
// Missing many other channels like 'test:status', 'scheduler:*', etc.

// Then used with 'any':
sendMessage(channel: Channels, ...args: unknown[]) {
  ipcRenderer.send(channel, ...args);
},
```

**Recommendation:**
```typescript
export type TestChannels = 'test:progress' | 'test:screenshot' | 'test:status';
export type SchedulerChannels = 
  | 'scheduler:status'
  | 'scheduler:test-added'
  | 'scheduler:test-updated';

export type Channels = 
  | 'ipc-example'
  | TestChannels
  | SchedulerChannels;
```

---

### 13. Error Handling: Silent Failures in BrowserService
**File:** `/home/user/nkeruka/src/main/services/BrowserService.ts`
**Location:** Lines 162-164, 178-180
**Severity:** MEDIUM

**Issue:**
Errors are caught but not logged:

```typescript
async highlightElement(selector: string): Promise<void> {
  if (!this.page) return;
  
  try {
    await this.page.evaluate((sel) => {
      // ... highlight code
    }, selector);
  } catch (error) {
    // Line 162-164: Silent catch - no logging
  }
}

async clearHighlights(): Promise<void> {
  if (!this.page) return;
  
  try {
    await this.page.evaluate(() => {
      // ... clear code
    });
  } catch (error) {
    // Line 178-180: Silent catch - no logging
  }
}
```

**Impact:**
- Difficult to debug test failures
- No visibility into what went wrong
- No metrics on failure rates

**Recommendation:**
```typescript
async highlightElement(selector: string): Promise<void> {
  if (!this.page) return;
  
  try {
    await this.page.evaluate((sel) => {
      // ... code
    }, selector);
  } catch (error) {
    console.warn(`[BrowserService] Failed to highlight element ${selector}:`, error);
    // Could also track metrics here
  }
}
```

---

### 14. AIService: Arbitrary Data Truncation
**File:** `/home/user/nkeruka/src/main/services/AIService.ts`
**Location:** Line 202
**Severity:** MEDIUM

**Issue:**
Accessibility tree is truncated to arbitrary 3000 characters:

```typescript
private buildAnalysisPrompt(
  pageContent: string,
  accessibilityTree: any,
  testObjective: string,
  previousSteps: string[],
): string {
  return `
You are a web testing agent. Your goal: ${testObjective}

Previous steps taken:
${previousSteps.length > 0 ? previousSteps.map((step, i) => `${i + 1}. ${step}`).join('\n') : 'None yet'}

Current page accessibility tree:
${JSON.stringify(accessibilityTree, null, 2).substring(0, 3000)}
// Line 202: Arbitrary 3000 character limit
```

**Impact:**
- Large pages have truncated information
- AI makes decisions on incomplete data
- Complex pages may not work well

**Recommendation:**
```typescript
private buildAnalysisPrompt(...): string {
  const treeStr = JSON.stringify(accessibilityTree, null, 2);
  const MAX_TREE_SIZE = 8000; // Configurable limit
  
  const truncatedTree = treeStr.length > MAX_TREE_SIZE 
    ? treeStr.substring(0, MAX_TREE_SIZE) + '\n... (truncated)'
    : treeStr;
    
  return `
You are a web testing agent. Your goal: ${testObjective}
...
Current page accessibility tree:
${truncatedTree}`;
}
```

---

### 15. AIService: Unsafe JSON Parsing
**File:** `/home/user/nkeruka/src/main/services/AIService.ts`
**Location:** Lines 231-249 (parseAIResponse)
**Severity:** MEDIUM

**Issue:**
Regex-based JSON extraction and parsing without validation:

```typescript
private parseAIResponse(responseText: string): AIAnalysis {
  try {
    // Line 234: Naive regex - could match wrong braces
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // No validation of expected structure
      return parsed as AIAnalysis;
    }
    
    // Fallback to raw text
    return {
      summary: responseText,
    };
  } catch (error) {
    return {
      summary: responseText,
    };
  }
}
```

**Impact:**
- Could parse unintended JSON from markdown examples
- No validation of required fields
- Crashes if response format unexpected

**Recommendation:**
```typescript
private parseAIResponse(responseText: string): AIAnalysis {
  try {
    // More specific extraction
    const jsonMatch = responseText.match(/\{[\s\S]*?\n\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required structure
      if ('nextAction' in parsed || 'validation' in parsed || 'summary' in parsed) {
        return parsed as AIAnalysis;
      }
    }
    
    return { summary: responseText };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return { summary: responseText };
  }
}
```

---

### 16. React Scheduler: Missing Error Handling
**File:** `/home/user/nkeruka/src/renderer/components/Scheduler.tsx`
**Location:** Lines 66-76, 78-86
**Severity:** MEDIUM

**Issue:**
Async IPC calls have no error handling:

```typescript
const loadSchedulerData = async () => {
  const statusResult = await window.electron.scheduler.getStatus();
  if (statusResult.success) {
    setSchedulerStatus(statusResult.status);
  }
  // No error handling

  const testsResult = await window.electron.scheduler.getTests();
  if (testsResult.success) {
    setScheduledTests(testsResult.tests);
  }
  // No error handling
};

const handleStartBot = async () => {
  await window.electron.scheduler.start();
  loadSchedulerData();
  // Possible error from start() ignored
};
```

**Impact:**
- Silent failures in scheduler
- Stale UI state
- No user feedback on errors

**Recommendation:**
```typescript
const loadSchedulerData = async () => {
  try {
    const statusResult = await window.electron.scheduler.getStatus();
    if (statusResult.success) {
      setSchedulerStatus(statusResult.status);
    } else {
      console.error('Failed to get scheduler status:', statusResult.error);
    }

    const testsResult = await window.electron.scheduler.getTests();
    if (testsResult.success) {
      setScheduledTests(testsResult.tests);
    } else {
      console.error('Failed to get scheduled tests:', testsResult.error);
    }
  } catch (error) {
    console.error('Error loading scheduler data:', error);
    // Could show toast notification to user
  }
};
```

---

### 17. TestRunner: Browser Close Error Not Handled
**File:** `/home/user/nkeruka/src/main/services/TestRunner.ts`
**Location:** Lines 153, 168
**Severity:** MEDIUM

**Issue:**
Browser close can fail but error is not caught:

```typescript
try {
  // ... test execution
  
  // Line 153: close() could fail
  await this.browserService.close();
  return this.currentTest;
} catch (error) {
  // ... error handling
  
  // Line 168: close() could also fail here
  await this.browserService.close();
  throw error;
}
```

**Impact:**
- Browser processes left hanging
- Subsequent tests may fail due to port conflicts
- File descriptor leaks

**Recommendation:**
```typescript
async close(): Promise<void> {
  const closePromises = [];
  
  if (this.page) {
    closePromises.push(
      this.page.close().catch(e => console.warn('Failed to close page:', e))
    );
  }
  if (this.context) {
    closePromises.push(
      this.context.close().catch(e => console.warn('Failed to close context:', e))
    );
  }
  if (this.browser) {
    closePromises.push(
      this.browser.close().catch(e => console.warn('Failed to close browser:', e))
    );
  }
  
  await Promise.all(closePromises);
  
  this.page = null;
  this.context = null;
  this.browser = null;
}
```

---

### 18. IPC Handlers: No Validation of Config Parameters
**File:** `/home/user/nkeruka/src/main/ipc/handlers.ts`
**Location:** Lines 20-45
**Severity:** MEDIUM

**Issue:**
TestConfig is not validated before use:

```typescript
ipcMain.handle('test:start', async (_event, config: TestConfig) => {
  try {
    testRunner = new TestRunner();
    
    // Config could be invalid:
    // - url could be empty or malformed
    // - apiKey could be missing or invalid format
    // - testObjective could be empty
    const result = await testRunner.startTest(config, ...callbacks);
    return { success: true, result };
  } catch (error) {
    // Will only catch runtime errors, not validation errors
    return { success: false, error: error.message };
  }
});
```

**Impact:**
- Tests fail with unclear error messages
- No early validation of user input
- Bad data corrupts test results

**Recommendation:**
```typescript
function validateTestConfig(config: TestConfig): { valid: boolean; error?: string } {
  if (!config.url || typeof config.url !== 'string') {
    return { valid: false, error: 'Invalid URL' };
  }
  
  try {
    new URL(config.url);
  } catch {
    return { valid: false, error: 'URL is not a valid URL' };
  }
  
  if (!config.testObjective || typeof config.testObjective !== 'string') {
    return { valid: false, error: 'Test objective is required' };
  }
  
  if (!config.anthropicApiKey || !config.anthropicApiKey.startsWith('sk-ant-')) {
    return { valid: false, error: 'Invalid Anthropic API key format' };
  }
  
  return { valid: true };
}

ipcMain.handle('test:start', async (_event, config: TestConfig) => {
  const validation = validateTestConfig(config);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  // ... rest of handler
});
```

---

### 19. Scheduler Component: Missing Dependency in useEffect
**File:** `/home/user/nkeruka/src/renderer/components/Scheduler.tsx`
**Location:** Lines 60-64
**Severity:** MEDIUM

**Issue:**
Interval depends on function that's not in dependency array:

```typescript
useEffect(() => {
  loadSchedulerData(); // Called immediately
  const interval = setInterval(loadSchedulerData, 2000); // And every 2 seconds
  return () => clearInterval(interval);
}, []); // Empty dependency array
```

**Impact:**
- `loadSchedulerData` is recreated on every render
- Interval might be set up multiple times if effect re-runs
- Stale closure issues

**Recommendation:**
```typescript
useEffect(() => {
  const loadSchedulerData = async () => {
    // ... load logic
  };
  
  loadSchedulerData();
  const interval = setInterval(loadSchedulerData, 2000);
  
  return () => clearInterval(interval);
}, []); // Still empty is OK here since loadSchedulerData is defined inside

// Or better, extract function:
const loadSchedulerData = useCallback(async () => {
  // ... load logic
}, []);

useEffect(() => {
  loadSchedulerData();
  const interval = setInterval(loadSchedulerData, 2000);
  return () => clearInterval(interval);
}, [loadSchedulerData]);
```

---

## LOW SEVERITY ISSUES (5)

### 20. Performance: TestRunner Component Re-renders
**File:** `/home/user/nkeruka/src/renderer/components/TestRunner.tsx`
**Location:** Lines 26-39
**Severity:** LOW

**Issue:**
Component could benefit from memoization:

```typescript
export default function TestRunner() {
  const [config, setConfig] = useState<TestConfig>({
    url: '',
    testObjective: '',
    anthropicApiKey: '',
    headless: false,
  });
  
  // Multiple state updates could cause unnecessary renders
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);
  const [liveScreenshot, setLiveScreenshot] = useState<string>('');
}
```

**Recommendation:**
Memoize expensive sub-components and use useMemo:

```typescript
const TestResult = React.memo(({ result, onSave }: TestResultProps) => {
  // Only re-render if result changes
});

const PreviewPanel = React.memo(({ screenshot, currentStep }: PreviewProps) => {
  // Only re-render if screenshot/currentStep changes
});
```

---

### 21. Performance: Large Base64 Images in DOM
**File:** `/home/user/nkeruka/src/renderer/components/TestRunner.tsx`
**Location:** Lines 196-201
**Severity:** LOW

**Issue:**
Large base64 screenshot data kept in state:

```typescript
{liveScreenshot ? (
  <div className="preview-container">
    <img
      src={`data:image/png;base64,${liveScreenshot}`}
      alt="Live browser preview"
      className="preview-image"
    />
```

**Recommendation:**
Consider streaming or limiting screenshots shown:

```typescript
const MAX_KEPT_SCREENSHOTS = 2;

useEffect(() => {
  const unsubscribe = window.electron.test.onScreenshot((screenshot: string) => {
    setLiveScreenshot(screenshot);
    
    // Only keep most recent screenshots
    setScreenshotHistory(prev => {
      const updated = [screenshot, ...prev].slice(0, MAX_KEPT_SCREENSHOTS);
      return updated;
    });
  });
  
  return () => unsubscribe?.();
}, []);
```

---

### 22. Code Organization: Hardcoded Configuration Values
**File:** `/home/user/nkeruka/src/main/services/TestRunner.ts`
**Location:** Line 14
**Severity:** LOW

**Issue:**
Magic number without explanation:

```typescript
private maxSteps = 20; // Prevent infinite loops
```

**Recommendation:**
Create constants file:

```typescript
// src/main/constants.ts
export const TEST_CONFIGURATION = {
  MAX_TEST_STEPS: 20,
  SCREENSHOT_DELAY_MS: 500,
  ELEMENT_WAIT_TIMEOUT_MS: 5000,
};

// In TestRunner.ts
import { TEST_CONFIGURATION } from '../constants';

private maxSteps = TEST_CONFIGURATION.MAX_TEST_STEPS;
```

---

### 23. Code Organization: Hardcoded API Model
**File:** `/home/user/nkeruka/src/main/services/AIService.ts`
**Location:** Lines 37, 108, 168
**Severity:** LOW

**Issue:**
Model name hardcoded in multiple places:

```typescript
const message = await this.client.messages.create({
  model: 'claude-3-5-sonnet-20241022', // Hardcoded in 3 places
  max_tokens: 2000,
  messages: [...]
});
```

**Recommendation:**
```typescript
// src/main/constants.ts
export const AI_CONFIG = {
  MODEL: 'claude-3-5-sonnet-20241022',
  MAX_TOKENS_ANALYSIS: 2000,
  MAX_TOKENS_VALIDATION: 1500,
  MAX_TOKENS_SUMMARY: 1000,
};

// In AIService.ts
import { AI_CONFIG } from '../constants';

const message = await this.client.messages.create({
  model: AI_CONFIG.MODEL,
  max_tokens: AI_CONFIG.MAX_TOKENS_ANALYSIS,
  // ...
});
```

---

### 24. Type Safety: Using 'any' Type
**File:** `/home/user/nkeruka/src/renderer/components/TestRunner.tsx`
**Location:** Line 37
**Severity:** LOW

**Issue:**
Test result is typed as 'any':

```typescript
const [testResult, setTestResult] = useState<any>(null);
```

**Recommendation:**
```typescript
import { TestResult } from '../../../main/types';

const [testResult, setTestResult] = useState<TestResult | null>(null);
```

---

## SUMMARY TABLE

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 4 | Memory leaks, race conditions in scheduler, IPC cleanup |
| HIGH | 7 | Unbounded arrays, race conditions, localStorage in Node.js, callbacks |
| MEDIUM | 8 | Type safety, error handling, validation, dependencies |
| LOW | 5 | Performance, constants, type safety |
| **TOTAL** | **24** | |

---

## IMMEDIATE ACTION ITEMS

### Priority 1 (Do First):
1. Fix unremoved event listeners in BrowserService
2. Fix TestRunner React component listener cleanup
3. Fix race condition in SchedulerService concurrent execution counter
4. Fix global testRunner cleanup in IPC handlers

### Priority 2 (Do Next):
5. Fix unbounded console logs and network requests arrays
6. Fix localStorage in Node.js main process
7. Add window null checks in IPC callbacks
8. Limit screenshots array growth

### Priority 3 (Do Before Production):
9. Fix error handling in BrowserService
10. Fix race conditions in TestRunner executeStep
11. Add config validation in IPC handlers
12. Add error handling in React components

---

## TESTING RECOMMENDATIONS

After fixes, test:
1. **Memory**: Run long test sequences, check memory growth with DevTools
2. **Concurrency**: Run multiple tests simultaneously, verify max concurrent limit
3. **Recovery**: Kill browser, verify graceful cleanup
4. **Persistence**: Restart app, verify scheduled tests still exist
5. **IPC**: Close window during test, verify no crashes
6. **Listeners**: Run component mount/unmount cycles, check for memory leaks

