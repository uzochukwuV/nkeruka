/**
 * Application Constants
 * Centralized configuration values for the Web Agent Tester
 */

/**
 * Test execution configuration
 */
export const TEST_CONFIGURATION = {
  MAX_TEST_STEPS: 20,              // Prevent infinite loops
  SCREENSHOT_DELAY_MS: 300,        // Visual feedback delay
  ELEMENT_WAIT_TIMEOUT_MS: 5000,   // Element wait timeout
  MAX_SCREENSHOTS: 10,             // Maximum screenshots to keep in memory
  MAX_CONSOLE_LOGS: 1000,          // Maximum console logs to keep
  MAX_NETWORK_REQUESTS: 1000,      // Maximum network requests to keep
};

/**
 * AI service configuration
 */
export const AI_CONFIG = {
  MODEL: 'claude-3-5-sonnet-20241022',  // Claude AI model
  MAX_TOKENS_ANALYSIS: 2000,            // Token limit for page analysis
  MAX_TOKENS_VALIDATION: 1500,          // Token limit for test validation
  MAX_TOKENS_SUMMARY: 1000,             // Token limit for summary generation
  MAX_ACCESSIBILITY_TREE_SIZE: 8000,    // Max characters for accessibility tree
};

/**
 * Scheduler configuration
 */
export const SCHEDULER_CONFIG = {
  MAX_CONCURRENT_TESTS: 3,              // Maximum tests running simultaneously
  STATUS_UPDATE_INTERVAL_MS: 2000,      // UI update frequency
  CONTINUOUS_MODE_DELAY_MS: 5000,       // Delay between continuous tests
  MAX_EXECUTION_HISTORY: 50,            // Maximum execution results to keep per test
};

/**
 * Browser configuration
 */
export const BROWSER_CONFIG = {
  DEFAULT_VIEWPORT_WIDTH: 1280,
  DEFAULT_VIEWPORT_HEIGHT: 720,
  HIGHLIGHT_DURATION_MS: 2000,          // Element highlight duration
};
