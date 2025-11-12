/**
 * Core types for Web Agent Tester
 */

export interface TestConfig {
  url: string;
  testObjective: string;
  anthropicApiKey: string;
  headless?: boolean;
  timeout?: number;
}

export interface TestStep {
  id: string;
  action: 'navigate' | 'click' | 'fill' | 'wait' | 'validate' | 'screenshot';
  target?: string;
  value?: string;
  timestamp: number;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: string;
  error?: string;
  screenshot?: string;
}

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info';
  text: string;
  timestamp: number;
  location?: string;
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  timestamp: number;
  duration: number;
}

export interface TestResult {
  id: string;
  config: TestConfig;
  steps: TestStep[];
  consoleLogs: ConsoleMessage[];
  networkRequests: NetworkRequest[];
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

export interface AIAnalysis {
  nextAction?: {
    type: string;
    target?: string;
    value?: string;
    reasoning: string;
  };
  validation?: {
    passed: boolean;
    issues: string[];
  };
  summary?: string;
}
