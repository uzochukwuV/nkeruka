/**
 * Browser automation service using Playwright
 * Handles browser control, page interaction, and data collection
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { ConsoleMessage, NetworkRequest, TestStep } from '../types';
import { TEST_CONFIGURATION, BROWSER_CONFIG } from '../constants';

export class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private consoleLogs: ConsoleMessage[] = [];
  private networkRequests: NetworkRequest[] = [];
  private screenshotCallback: ((screenshot: string) => void) | null = null;
  private eventListeners: Array<{ event: string; handler: Function }> = [];
  private readonly MAX_LOGS = TEST_CONFIGURATION.MAX_CONSOLE_LOGS;
  private readonly MAX_REQUESTS = TEST_CONFIGURATION.MAX_NETWORK_REQUESTS;

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
        viewport: {
          width: BROWSER_CONFIG.DEFAULT_VIEWPORT_WIDTH,
          height: BROWSER_CONFIG.DEFAULT_VIEWPORT_HEIGHT
        },
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
    const consoleHandler = (msg: any) => {
      const consoleMessage: ConsoleMessage = {
        type: msg.type() as ConsoleMessage['type'],
        text: msg.text(),
        timestamp: Date.now(),
        location: msg.location().url,
      };
      this.consoleLogs.push(consoleMessage);

      // Prevent unbounded growth
      if (this.consoleLogs.length > this.MAX_LOGS) {
        this.consoleLogs = this.consoleLogs.slice(-this.MAX_LOGS);
      }
    };
    this.page.on('console', consoleHandler);
    this.eventListeners.push({ event: 'console', handler: consoleHandler });

    // Network request listener
    const responseHandler = async (response: any) => {
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

        // Prevent unbounded growth
        if (this.networkRequests.length > this.MAX_REQUESTS) {
          this.networkRequests = this.networkRequests.slice(-this.MAX_REQUESTS);
        }
      } catch (error) {
        // Ignore errors from detached frames
      }
    };
    this.page.on('response', responseHandler);
    this.eventListeners.push({ event: 'response', handler: responseHandler });

    // Page error listener
    const errorHandler = (error: Error) => {
      const consoleMessage: ConsoleMessage = {
        type: 'error',
        text: error.message,
        timestamp: Date.now(),
      };
      this.consoleLogs.push(consoleMessage);

      // Prevent unbounded growth
      if (this.consoleLogs.length > this.MAX_LOGS) {
        this.consoleLogs = this.consoleLogs.slice(-this.MAX_LOGS);
      }
    };
    this.page.on('pageerror', errorHandler);
    this.eventListeners.push({ event: 'pageerror', handler: errorHandler });
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
    const base64 = buffer.toString('base64');

    // Notify callback if set (for live streaming)
    if (this.screenshotCallback) {
      this.screenshotCallback(base64);
    }

    return base64;
  }

  /**
   * Set callback for screenshot streaming
   */
  setScreenshotCallback(callback: (screenshot: string) => void): void {
    this.screenshotCallback = callback;
  }

  /**
   * Highlight element on page (visual feedback)
   */
  async highlightElement(selector: string): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
          const overlay = document.createElement('div');
          overlay.id = 'playwright-highlight';
          overlay.style.cssText = `
            position: absolute;
            border: 3px solid #FF6B6B;
            background: rgba(255, 107, 107, 0.2);
            pointer-events: none;
            z-index: 999999;
            animation: pulse 1s infinite;
          `;

          // Add pulse animation
          const style = document.createElement('style');
          style.textContent = `
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `;
          document.head.appendChild(style);

          const rect = element.getBoundingClientRect();
          overlay.style.left = `${rect.left + window.scrollX}px`;
          overlay.style.top = `${rect.top + window.scrollY}px`;
          overlay.style.width = `${rect.width}px`;
          overlay.style.height = `${rect.height}px`;

          document.body.appendChild(overlay);

          // Remove after highlight duration
          setTimeout(() => overlay.remove(), BROWSER_CONFIG.HIGHLIGHT_DURATION_MS);
        }
      }, selector);
    } catch (error) {
      console.warn(`[BrowserService] Failed to highlight element ${selector}:`, error);
      // Continue - non-critical for test execution
    }
  }

  /**
   * Remove all highlights
   */
  async clearHighlights(): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.evaluate(() => {
        const highlights = document.querySelectorAll('#playwright-highlight');
        highlights.forEach(h => h.remove());
      });
    } catch (error) {
      console.warn('[BrowserService] Failed to clear highlights:', error);
      // Continue - non-critical for test execution
    }
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
    // Remove all event listeners to prevent memory leaks
    if (this.page) {
      this.eventListeners.forEach(({ event, handler }) => {
        try {
          this.page?.off(event as any, handler as any);
        } catch (error) {
          console.warn('[BrowserService] Failed to remove event listener:', error);
        }
      });
      this.eventListeners = [];
    }

    // Close resources with individual error handling to ensure all cleanup attempts are made
    const closePromises = [];

    if (this.page) {
      closePromises.push(
        this.page.close().catch(e => console.warn('[BrowserService] Failed to close page:', e))
      );
    }
    if (this.context) {
      closePromises.push(
        this.context.close().catch(e => console.warn('[BrowserService] Failed to close context:', e))
      );
    }
    if (this.browser) {
      closePromises.push(
        this.browser.close().catch(e => console.warn('[BrowserService] Failed to close browser:', e))
      );
    }

    // Wait for all close operations to complete (even if some fail)
    await Promise.all(closePromises);

    // Cleanup references
    this.page = null;
    this.context = null;
    this.browser = null;
    this.screenshotCallback = null;
    this.consoleLogs = [];
    this.networkRequests = [];
  }
}
