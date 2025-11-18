# Web Agent Tester - Features Overview

## 1. Live Browser Preview (Like Manus AI)

### What It Does
Shows real-time preview of the AI agent's actions as they happen - you can watch the browser being controlled, elements being clicked, and forms being filled.

### Key Capabilities
- **Live Screenshot Streaming**: Real-time updates as the AI navigates
- **Visual Element Highlighting**: Red animated overlay shows what the AI is clicking/filling
- **Action Overlay**: Current action displayed on the preview
- **Split View**: Preview + step log side-by-side

### How It Works
1. Browser takes screenshots after each action
2. Screenshots streamed via IPC to UI in real-time
3. Elements highlighted with pulsing red overlay before interaction
4. 500ms delays between actions for visibility
5. Preview updates automatically as test progresses

### Technical Implementation
```typescript
// BrowserService - Element highlighting
await browserService.highlightElement(selector);
await browserService.screenshot(); // Streams to UI

// TestRunner - Screenshot callback
startTest(config, progressCallback, screenshotCallback);

// UI - Live preview
<img src={`data:image/png;base64,${liveScreenshot}`} />
```

### UI Components
- **Preview Panel**: Shows live browser state
- **Current Action Overlay**: Displays what AI is doing
- **Loading Spinner**: Shows while waiting for first screenshot

---

## 2. Autonomous Test Scheduler (Massa-Inspired)

### What It Does
Automatically runs tests at scheduled intervals without manual intervention - like Massa's autonomous smart contract execution.

### Key Capabilities
- **Start/Stop Bot**: Global control for all scheduled tests
- **Multiple Scheduling Types**:
  - **Interval**: Run every N minutes
  - **Continuous**: Run as fast as possible (5s between tests)
  - **Cron**: Support for cron expressions
- **Execution Limits**: Set max iterations per test
- **Concurrent Control**: Run up to 3 tests simultaneously
- **History Tracking**: Keep last 50 execution results per test
- **Pause/Resume**: Temporarily stop individual tests

### Use Cases

#### 1. CI/CD Integration
```javascript
Schedule: Every 30 minutes
Objective: Run smoke tests on production
Max Iterations: Unlimited
```

#### 2. Regression Monitoring
```javascript
Schedule: Every hour
Objective: Test critical user flows
Max Iterations: 24 (run for 1 day)
```

#### 3. Load Testing
```javascript
Schedule: Continuous
Objective: Stress test checkout flow
Max Iterations: 100
```

#### 4. Uptime Monitoring
```javascript
Schedule: Every 5 minutes
Objective: Verify homepage loads correctly
Max Iterations: Unlimited
```

### How It Works

#### Scheduler Service Architecture
```
┌─────────────────────────────────────┐
│      SchedulerService                │
│                                      │
│  ┌──────────────────────────────┐  │
│  │   Scheduled Tests Map        │  │
│  │   (id → ScheduledTest)       │  │
│  └──────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐  │
│  │   Timers Map                 │  │
│  │   (id → NodeJS.Timeout)      │  │
│  └──────────────────────────────┘  │
│                                      │
│       Bot Running: true/false        │
│       Current Executions: 0-3        │
└─────────────────────────────────────┘
```

#### Execution Flow
```
1. Start Bot
   ↓
2. For Each Active Test:
   ├→ Calculate next execution time
   ├→ Schedule timer
   └→ Wait for trigger
       ↓
3. Execute Test:
   ├→ Check concurrent limit
   ├→ Launch TestRunner
   ├→ Track progress
   ├→ Record results
   └→ Reschedule if active
```

### UI Features

#### Bot Status Card
- Shows running/stopped state
- Start/Stop controls
- Real-time status updates

#### Statistics Card
- Total scheduled tests
- Currently active tests
- Tests executing right now

#### Test Cards
Each scheduled test displays:
- Name and status badge
- Test configuration (URL, objective)
- Schedule type and frequency
- Execution count / max iterations
- Last execution time
- Next execution time (if active)
- Recent results (✓/✗ badges)
- Pause/Resume/Remove controls

#### Add Test Dialog
Configure new scheduled tests:
- Test name
- Website URL
- Test objective
- API key
- Schedule type
- Interval (minutes)
- Max iterations

### Technical Implementation

#### SchedulerService
```typescript
class SchedulerService {
  // Core methods
  start(): void                           // Start bot
  stop(): void                            // Stop bot
  addScheduledTest(test): void            // Add new test
  removeScheduledTest(id): void           // Remove test
  pauseScheduledTest(id): void            // Pause test
  resumeScheduledTest(id): void           // Resume test

  // Execution
  private scheduleTest(test): void        // Set timer
  private executeScheduledTest(test): void // Run test

  // Storage
  private saveScheduledTests(): void      // Persist
  private loadScheduledTests(): void      // Restore
}
```

#### Scheduled Test Structure
```typescript
interface ScheduledTest {
  id: string;
  name: string;
  config: TestConfig;
  schedule: {
    type: 'interval' | 'cron' | 'continuous';
    interval?: number;        // milliseconds
    maxIterations?: number;   // stop after N runs
  };
  status: 'active' | 'paused' | 'stopped';
  executionCount: number;
  lastExecutedTime?: number;
  nextExecutionTime?: number;
  results: ExecutionResult[]; // Last 50 results
}
```

### Massa Blockchain Inspiration

The scheduler is inspired by Massa's autonomous smart contract execution:

**Massa Pattern:**
```typescript
// Massa uses callNextSlot for autonomous execution
function advance() {
  // Do work...

  // Schedule next execution
  callNextSlot(contractAddress, 'advance', gasBudget);
}
```

**Our Pattern:**
```typescript
// We use setTimeout for autonomous execution
async function executeScheduledTest(test) {
  // Do work...
  await testRunner.startTest(test.config);

  // Schedule next execution
  if (test.status === 'active') {
    scheduleTest(test);
  }
}
```

Both patterns enable **autonomous recurring execution** without external triggers.

---

## Usage Examples

### Example 1: Watch AI Test Your Site
```
1. Go to "Manual Testing" tab
2. Enter URL: https://your-app.com
3. Set objective: "Fill contact form and submit"
4. Click "Start Test"
5. Watch the live preview as AI:
   - Opens your site
   - Finds form fields (highlighted in red)
   - Fills in data
   - Clicks submit
   - Validates result
```

### Example 2: Schedule Automated Tests
```
1. Go to "Automated Scheduler" tab
2. Click "Start Bot"
3. Click "Add Scheduled Test"
4. Configure:
   - Name: "Daily Smoke Test"
   - URL: https://your-app.com
   - Objective: "Test login and dashboard"
   - Schedule: Interval - every 60 minutes
   - Max Iterations: 24 (run for 1 day)
5. Test runs automatically every hour
6. View results in real-time
```

### Example 3: Continuous Integration
```
// Run after each deployment
Schedule: Continuous mode
Max Iterations: 5
Objective: "Test all critical user flows"

Bot automatically:
1. Runs test immediately
2. Waits 5 seconds
3. Runs test again
4. Repeats 5 times
5. Stops automatically
```

---

## Comparison with Other Tools

### vs Traditional Selenium
| Feature | Web Agent Tester | Selenium |
|---------|-----------------|----------|
| Script Writing | Natural language | Code required |
| Self-Healing | AI adapts to changes | Brittle selectors |
| Live Preview | ✓ Real-time | ✗ No preview |
| Scheduling | ✓ Built-in bot | External scheduler |
| Setup | Desktop app | Framework setup |

### vs Manus AI
| Feature | Web Agent Tester | Manus AI |
|---------|-----------------|----------|
| Live Preview | ✓ | ✓ |
| Desktop App | ✓ | ✗ (Web-based) |
| Scheduling | ✓ Autonomous bot | Manual triggers |
| Offline | ✓ | ✗ |
| Self-Hosted | ✓ | ✗ |

---

## Performance Considerations

### Live Preview
- Screenshots: ~100KB per capture
- Update frequency: After each action (~2-3s)
- Memory: Minimal (only latest screenshot stored)
- Network: None (local IPC)

### Scheduler
- Max concurrent tests: 3 (configurable)
- History retention: Last 50 results per test
- Storage: LocalStorage (~1MB for 20 tests)
- CPU: Minimal when idle (timers only)

---

## Security Notes

### API Keys
- Never stored permanently
- Required for each scheduled test
- Stored in memory only during execution
- App restart clears all keys

### Browser Automation
- Runs in sandboxed browser process
- No access to system resources
- Console logs isolated
- Network requests logged but not intercepted

---

## Future Enhancements

### Planned Features
- [ ] Visual regression testing (screenshot comparison)
- [ ] Test result notifications (email/Slack)
- [ ] Cloud sync for scheduled tests
- [ ] Performance metrics (page load times)
- [ ] Custom assertions and validations
- [ ] Test script recording
- [ ] Multi-browser support (Firefox, Safari)
- [ ] Headless vs headed toggle per test
- [ ] Screenshot history browser
- [ ] Test result analytics dashboard

### Integration Ideas
- GitHub Actions integration
- Webhook triggers
- API endpoint for external triggering
- Test result export to CI/CD tools
- Slack/Discord notifications

---

## Troubleshooting

### Live Preview Not Updating
- Check if test is running
- Verify browser launched successfully
- Look for errors in console logs

### Scheduler Not Executing
- Ensure bot is started
- Check test status (active vs paused)
- Verify API key is set
- Check max iterations not reached

### Tests Failing
- Review console logs in results
- Check network requests
- Verify site is accessible
- Ensure test objective is clear

---

## Technical Stack

### Backend (Main Process)
- **SchedulerService**: Test scheduling and execution
- **BrowserService**: Playwright browser control
- **AIService**: Claude AI integration
- **TestRunner**: Test orchestration

### Frontend (Renderer Process)
- **TestRunner Component**: Manual testing UI
- **Scheduler Component**: Autonomous scheduling UI
- **Navigation**: Tab-based routing

### Communication
- **IPC Channels**: Main ↔ Renderer communication
- **Screenshot Streaming**: Real-time updates
- **Progress Events**: Step-by-step tracking

---

## Credits

- **Inspired by**: Massa blockchain autonomous execution
- **UI Inspiration**: Manus AI live preview
- **Built with**: Electron, React, Playwright, Claude AI
