/**
 * Scheduler Service - Autonomous Test Execution
 * Manages recurring test schedules and autonomous execution
 */

import { TestRunner } from './TestRunner';
import { TestConfig, TestResult, TestStep } from '../types';

export interface ScheduledTest {
  id: string;
  name: string;
  config: TestConfig;
  schedule: {
    type: 'interval' | 'cron' | 'continuous';
    interval?: number; // milliseconds
    cronExpression?: string;
    maxIterations?: number;
  };
  status: 'active' | 'paused' | 'stopped';
  executionCount: number;
  lastExecutedTime?: number;
  nextExecutionTime?: number;
  results: Array<{
    timestamp: number;
    success: boolean;
    duration: number;
    summary?: string;
    errors: number;
  }>;
}

export class SchedulerService {
  private scheduledTests: Map<string, ScheduledTest> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;
  private maxConcurrentTests = 3;
  private currentExecutions = 0;

  constructor() {
    this.loadScheduledTests();
  }

  /**
   * Start the scheduler bot
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('[Scheduler] Bot started');

    // Resume all active scheduled tests
    this.scheduledTests.forEach((test) => {
      if (test.status === 'active') {
        this.scheduleTest(test);
      }
    });
  }

  /**
   * Stop the scheduler bot
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    console.log('[Scheduler] Bot stopped');

    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  /**
   * Add a scheduled test
   */
  addScheduledTest(test: ScheduledTest): void {
    this.scheduledTests.set(test.id, test);
    this.saveScheduledTests();

    if (this.isRunning && test.status === 'active') {
      this.scheduleTest(test);
    }
  }

  /**
   * Remove a scheduled test
   */
  removeScheduledTest(testId: string): void {
    const timer = this.timers.get(testId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(testId);
    }

    this.scheduledTests.delete(testId);
    this.saveScheduledTests();
  }

  /**
   * Pause a scheduled test
   */
  pauseScheduledTest(testId: string): void {
    const test = this.scheduledTests.get(testId);
    if (!test) return;

    test.status = 'paused';

    const timer = this.timers.get(testId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(testId);
    }

    this.saveScheduledTests();
  }

  /**
   * Resume a scheduled test
   */
  resumeScheduledTest(testId: string): void {
    const test = this.scheduledTests.get(testId);
    if (!test) return;

    test.status = 'active';

    if (this.isRunning) {
      this.scheduleTest(test);
    }

    this.saveScheduledTests();
  }

  /**
   * Schedule a test for execution
   */
  private scheduleTest(test: ScheduledTest): void {
    // Check if max iterations reached
    if (
      test.schedule.maxIterations &&
      test.executionCount >= test.schedule.maxIterations
    ) {
      test.status = 'stopped';
      this.saveScheduledTests();
      return;
    }

    let delay: number;

    switch (test.schedule.type) {
      case 'interval':
        delay = test.schedule.interval || 60000; // Default 1 minute
        break;

      case 'continuous':
        delay = 5000; // 5 seconds between tests
        break;

      case 'cron':
        delay = this.calculateCronDelay(test.schedule.cronExpression || '');
        break;

      default:
        delay = 60000;
    }

    // Calculate next execution time
    test.nextExecutionTime = Date.now() + delay;

    // Schedule execution
    const timer = setTimeout(() => {
      this.executeScheduledTest(test);
    }, delay);

    this.timers.set(test.id, timer);
  }

  /**
   * Execute a scheduled test
   */
  private async executeScheduledTest(test: ScheduledTest): Promise<void> {
    // Atomically increment and check (prevents race condition)
    this.currentExecutions++;

    if (this.currentExecutions > this.maxConcurrentTests) {
      // Over limit, decrement and reschedule
      this.currentExecutions--;
      console.log(`[Scheduler] Max concurrent tests reached (${this.maxConcurrentTests}), rescheduling ${test.name}`);
      setTimeout(() => this.scheduleTest(test), 5000);
      return;
    }

    const startTime = Date.now();
    console.log(`[Scheduler] Executing scheduled test: ${test.name} (${this.currentExecutions}/${this.maxConcurrentTests})`);

    try {
      const runner = new TestRunner();
      const result: TestResult = await runner.startTest(test.config);

      const duration = Date.now() - startTime;

      // Record execution result
      test.results.push({
        timestamp: Date.now(),
        success: result.status === 'completed',
        duration,
        summary: result.summary,
        errors: result.errors.length,
      });

      // Keep only last 50 results
      if (test.results.length > 50) {
        test.results = test.results.slice(-50);
      }

      test.executionCount++;
      test.lastExecutedTime = Date.now();

      console.log(`[Scheduler] Test "${test.name}" completed: ${result.status}`);
    } catch (error) {
      console.error(`[Scheduler] Test "${test.name}" failed:`, error);

      test.results.push({
        timestamp: Date.now(),
        success: false,
        duration: Date.now() - startTime,
        summary: `Error: ${error}`,
        errors: 1,
      });
    } finally {
      this.currentExecutions--;
      this.saveScheduledTests();

      // Schedule next execution if still active
      if (test.status === 'active' && this.isRunning) {
        this.scheduleTest(test);
      }
    }
  }

  /**
   * Calculate delay for cron expression (simplified)
   */
  private calculateCronDelay(expression: string): number {
    // Simplified cron parsing - implement full cron parser for production
    // For now, support simple patterns like "*/5 * * * *" (every 5 minutes)

    const parts = expression.split(' ');
    if (parts[0].startsWith('*/')) {
      const minutes = parseInt(parts[0].substring(2));
      return minutes * 60 * 1000;
    }

    // Default to 5 minutes
    return 5 * 60 * 1000;
  }

  /**
   * Get all scheduled tests
   */
  getScheduledTests(): ScheduledTest[] {
    return Array.from(this.scheduledTests.values());
  }

  /**
   * Get scheduled test by ID
   */
  getScheduledTest(testId: string): ScheduledTest | undefined {
    return this.scheduledTests.get(testId);
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    totalTests: number;
    activeTests: number;
    currentExecutions: number;
  } {
    return {
      isRunning: this.isRunning,
      totalTests: this.scheduledTests.size,
      activeTests: Array.from(this.scheduledTests.values()).filter(
        (t) => t.status === 'active',
      ).length,
      currentExecutions: this.currentExecutions,
    };
  }

  /**
   * Save scheduled tests to storage
   */
  private saveScheduledTests(): void {
    const tests = Array.from(this.scheduledTests.values());
    // In Electron, we'll use electron-store or localStorage
    // For now, store in memory
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('scheduledTests', JSON.stringify(tests));
    }
  }

  /**
   * Load scheduled tests from storage
   */
  private loadScheduledTests(): void {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('scheduledTests');
      if (stored) {
        try {
          const tests: ScheduledTest[] = JSON.parse(stored);
          tests.forEach((test) => {
            this.scheduledTests.set(test.id, test);
          });
        } catch (error) {
          console.error('[Scheduler] Failed to load scheduled tests:', error);
        }
      }
    }
  }
}
