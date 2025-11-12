/**
 * Browser automation service using Playwright
 * Handles browser control, page interaction, and data collection
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { ConsoleMessage, NetworkRequest, TestStep } from '../types';

export class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private consoleLogs: ConsoleMessage[] = [];
  private networkRequests: NetworkRequest[] = [];

  /**
   * Launch browser instance
   */
  async launch(headless = false): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless,
        args: ['--disable-blink-features=AutomationControlled'],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      this.page = await this.context.newPage();
      this.setupListeners();
    } catch (error) {
      throw new Error(`Failed to launch browser: ${error}`);
    }
  }

  /**
   * Set up event listeners for console logs and network requests
   */
  private setupListeners(): void {
    if (!this.page) return;

    // Console message listener
    this.page.on('console', (msg) => {
      const consoleMessage: ConsoleMessage = {
        type: msg.type() as ConsoleMessage['type'],
        text: msg.text(),
        timestamp: Date.now(),
        location: msg.location().url,
      };
      this.consoleLogs.push(consoleMessage);
    });

    // Network request listener
    this.page.on('response', async (response) => {
      try {
        const request = response.request();
        const timing = response.timing();

        const networkRequest: NetworkRequest = {
          url: request.url(),
          method: request.method(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: Date.now(),
          duration: timing?.responseEnd || 0,
        };
        this.networkRequests.push(networkRequest);
      } catch (error) {
        // Ignore errors from detached frames
      }
    });

    // Page error listener
    this.page.on('pageerror', (error) => {
      const consoleMessage: ConsoleMessage = {
        type: 'error',
        text: error.message,
        timestamp: Date.now(),
      };
      this.consoleLogs.push(consoleMessage);
    });
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * Take screenshot
   */
  async screenshot(): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    const buffer = await this.page.screenshot({ fullPage: false });
    return buffer.toString('base64');
  }

  /**
   * Get page content/DOM
   */
  async getPageContent(): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    return await this.page.content();
  }

  /**
   * Get accessibility tree (better for AI understanding)
   */
  async getAccessibilityTree(): Promise<any> {
    if (!this.page) throw new Error('Browser not launched');
    const snapshot = await this.page.accessibility.snapshot();
    return snapshot;
  }

  /**
   * Click element
   */
  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.click(selector);
  }

  /**
   * Fill input field
   */
  async fill(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.fill(selector, value);
  }

  /**
   * Wait for selector
   */
  async waitForSelector(selector: string, timeout = 5000): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.waitForSelector(selector, { timeout });
  }

  /**
   * Execute custom JavaScript
   */
  async evaluate(script: string): Promise<any> {
    if (!this.page) throw new Error('Browser not launched');
    return await this.page.evaluate(script);
  }

  /**
   * Get all console logs
   */
  getConsoleLogs(): ConsoleMessage[] {
    return this.consoleLogs;
  }

  /**
   * Get all network requests
   */
  getNetworkRequests(): NetworkRequest[] {
    return this.networkRequests;
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.consoleLogs = [];
    this.networkRequests = [];
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}
