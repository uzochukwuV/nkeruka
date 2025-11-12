/**
 * Type definitions for window.electron
 */

interface TestConfig {
  url: string;
  testObjective: string;
  anthropicApiKey: string;
  headless?: boolean;
}

interface TestStep {
  id: string;
  action: string;
  target?: string;
  value?: string;
  timestamp: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: string;
  error?: string;
}

interface TestResult {
  id: string;
  config: TestConfig;
  steps: TestStep[];
  consoleLogs: any[];
  networkRequests: any[];
  screenshots: string[];
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed';
  summary?: string;
  errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
  }>;
}

interface Window {
  electron: {
    ipcRenderer: {
      sendMessage(channel: string, ...args: unknown[]): void;
      on(
        channel: string,
        func: (...args: unknown[]) => void,
      ): () => void;
      once(channel: string, func: (...args: unknown[]) => void): void;
    };
    test: {
      start: (config: TestConfig) => Promise<{
        success: boolean;
        result?: TestResult;
        error?: string;
      }>;
      stop: () => Promise<{ success: boolean; error?: string }>;
      getStatus: () => Promise<{
        success: boolean;
        test?: TestResult | null;
        error?: string;
      }>;
      saveReport: (result: TestResult) => Promise<{
        success: boolean;
        path?: string;
        error?: string;
      }>;
      onProgress: (callback: (step: TestStep) => void) => void;
    };
  };
}
