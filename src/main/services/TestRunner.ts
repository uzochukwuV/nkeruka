/**
 * Test Runner - Orchestrates browser automation and AI decision making
 */

import { BrowserService } from './BrowserService';
import { AIService } from './AIService';
import { TestConfig, TestResult, TestStep } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class TestRunner {
  private browserService: BrowserService;
  private aiService: AIService | null = null;
  private currentTest: TestResult | null = null;
  private maxSteps = 20; // Prevent infinite loops

  constructor() {
    this.browserService = new BrowserService();
  }

  /**
   * Start a new test
   */
  async startTest(
    config: TestConfig,
    progressCallback?: (step: TestStep) => void,
  ): Promise<TestResult> {
    try {
      // Initialize AI service
      this.aiService = new AIService(config.anthropicApiKey);

      // Initialize test result
      this.currentTest = {
        id: uuidv4(),
        config,
        steps: [],
        consoleLogs: [],
        networkRequests: [],
        screenshots: [],
        startTime: Date.now(),
        status: 'running',
        errors: [],
      };

      // Launch browser
      await this.browserService.launch(config.headless || false);

      // Navigate to URL
      await this.executeStep(
        {
          id: uuidv4(),
          action: 'navigate',
          target: config.url,
          timestamp: Date.now(),
          status: 'running',
        },
        progressCallback,
      );

      // Main test loop - AI decides actions
      let stepCount = 0;
      let testComplete = false;

      while (stepCount < this.maxSteps && !testComplete) {
        stepCount++;

        // Take screenshot
        const screenshot = await this.browserService.screenshot();
        this.currentTest.screenshots.push(screenshot);

        // Get page state
        const accessibilityTree =
          await this.browserService.getAccessibilityTree();

        // Get previous steps description
        const previousSteps = this.currentTest.steps.map(
          (s) => `${s.action} ${s.target || ''} ${s.value || ''}`.trim(),
        );

        // Ask AI for next action
        const analysis = await this.aiService!.analyzePageAndDecideAction(
          '', // We can pass page content if needed
          accessibilityTree,
          config.testObjective,
          previousSteps,
          screenshot,
        );

        // Check if test is complete
        if (!analysis.nextAction || analysis.validation) {
          testComplete = true;
          this.currentTest.summary =
            analysis.summary || 'Test completed successfully';

          if (analysis.validation) {
            this.currentTest.status = analysis.validation.passed
              ? 'completed'
              : 'failed';
            if (analysis.validation.issues.length > 0) {
              analysis.validation.issues.forEach((issue) => {
                this.currentTest!.errors.push({
                  message: issue,
                  timestamp: Date.now(),
                });
              });
            }
          }
          break;
        }

        // Execute the AI's decided action
        const step: TestStep = {
          id: uuidv4(),
          action: analysis.nextAction.type as TestStep['action'],
          target: analysis.nextAction.target,
          value: analysis.nextAction.value,
          timestamp: Date.now(),
          status: 'running',
          result: analysis.nextAction.reasoning,
        };

        await this.executeStep(step, progressCallback);
      }

      // Collect final data
      this.currentTest.consoleLogs = this.browserService.getConsoleLogs();
      this.currentTest.networkRequests =
        this.browserService.getNetworkRequests();
      this.currentTest.endTime = Date.now();

      // Generate AI summary if not already set
      if (!this.currentTest.summary) {
        const steps = this.currentTest.steps.map(
          (s) => `${s.action} ${s.target || ''}`,
        );
        const errors = this.currentTest.errors.map((e) => e.message);
        const duration = this.currentTest.endTime - this.currentTest.startTime;

        this.currentTest.summary = await this.aiService.generateSummary(
          config.testObjective,
          steps,
          errors,
          duration,
        );
      }

      // Close browser
      await this.browserService.close();

      return this.currentTest;
    } catch (error) {
      // Handle errors
      if (this.currentTest) {
        this.currentTest.status = 'failed';
        this.currentTest.endTime = Date.now();
        this.currentTest.errors.push({
          message: `Test failed: ${error}`,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
        });
      }

      await this.browserService.close();

      throw error;
    }
  }

  /**
   * Execute a single test step
   */
  private async executeStep(
    step: TestStep,
    progressCallback?: (step: TestStep) => void,
  ): Promise<void> {
    try {
      if (progressCallback) {
        progressCallback(step);
      }

      switch (step.action) {
        case 'navigate':
          await this.browserService.navigate(step.target!);
          break;

        case 'click':
          await this.browserService.click(step.target!);
          break;

        case 'fill':
          await this.browserService.fill(step.target!, step.value!);
          break;

        case 'wait':
          await new Promise((resolve) =>
            setTimeout(resolve, parseInt(step.value || '1000')),
          );
          break;

        case 'screenshot':
          const screenshot = await this.browserService.screenshot();
          step.screenshot = screenshot;
          break;

        default:
          break;
      }

      step.status = 'success';
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);

      if (this.currentTest) {
        this.currentTest.errors.push({
          message: `Step failed: ${step.action} ${step.target || ''}`,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
        });
      }
    }

    if (this.currentTest) {
      this.currentTest.steps.push(step);
    }

    if (progressCallback) {
      progressCallback(step);
    }
  }

  /**
   * Stop current test
   */
  async stopTest(): Promise<void> {
    if (this.currentTest) {
      this.currentTest.status = 'failed';
      this.currentTest.endTime = Date.now();
      this.currentTest.errors.push({
        message: 'Test stopped by user',
        timestamp: Date.now(),
      });
    }
    await this.browserService.close();
  }

  /**
   * Get current test status
   */
  getCurrentTest(): TestResult | null {
    return this.currentTest;
  }
}
