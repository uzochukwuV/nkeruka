/**
 * Main Test Runner Component
 */

import React, { useState, useEffect } from 'react';
import './TestRunner.css';

interface TestConfig {
  url: string;
  testObjective: string;
  anthropicApiKey: string;
  headless: boolean;
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
  endTime: number;
  status: 'running' | 'completed' | 'failed';
  summary?: string;
  errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
  }>;
}

export default function TestRunner() {
  const [config, setConfig] = useState<TestConfig>({
    url: '',
    testObjective: '',
    anthropicApiKey: '',
    headless: false,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [liveScreenshot, setLiveScreenshot] = useState<string>('');

  useEffect(() => {
    // Listen for test progress
    if (!window.electron?.test) return;

    const cleanupProgress = window.electron.test.onProgress((step: TestStep) => {
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

    // Listen for screenshot updates
    const cleanupScreenshot = window.electron.test.onScreenshot((screenshot: string) => {
      setLiveScreenshot(screenshot);
    });

    // Cleanup function to remove listeners on unmount
    return () => {
      cleanupProgress();
      cleanupScreenshot();
    };
  }, []);

  const handleStart = async () => {
    if (!config.url || !config.testObjective || !config.anthropicApiKey) {
      alert('Please fill in all required fields');
      return;
    }

    setIsRunning(true);
    setSteps([]);
    setTestResult(null);
    setLiveScreenshot('');
    setCurrentStep('Initializing test...');

    try {
      const result = await window.electron.test.start(config);

      if (result.success) {
        setTestResult(result.result);
        setCurrentStep('Test completed');
      } else {
        alert(`Test failed: ${result.error}`);
        setCurrentStep('Test failed');
      }
    } catch (error) {
      alert(`Error: ${error}`);
      setCurrentStep('Test error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    await window.electron.test.stop();
    setIsRunning(false);
    setCurrentStep('Test stopped');
  };

  const handleSaveReport = async () => {
    if (testResult) {
      const result = await window.electron.test.saveReport(testResult);
      if (result.success) {
        alert(`Report saved to ${result.path}`);
      } else {
        alert(`Failed to save report: ${result.error}`);
      }
    }
  };

  return (
    <div className="test-runner">
      <div className="header">
        <h1>Web Agent Tester</h1>
        <p>AI-Powered Frontend Testing Tool</p>
      </div>

      <div className="config-section">
        <h2>Test Configuration</h2>

        <div className="form-group">
          <label>Website URL:</label>
          <input
            type="text"
            placeholder="https://example.com"
            value={config.url}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            disabled={isRunning}
          />
        </div>

        <div className="form-group">
          <label>Test Objective:</label>
          <textarea
            placeholder="E.g., Fill out the contact form and submit it"
            value={config.testObjective}
            onChange={(e) =>
              setConfig({ ...config, testObjective: e.target.value })
            }
            disabled={isRunning}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Anthropic API Key:</label>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={config.anthropicApiKey}
            onChange={(e) =>
              setConfig({ ...config, anthropicApiKey: e.target.value })
            }
            disabled={isRunning}
          />
        </div>

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={config.headless}
              onChange={(e) =>
                setConfig({ ...config, headless: e.target.checked })
              }
              disabled={isRunning}
            />
            Run in headless mode
          </label>
        </div>

        <div className="actions">
          {!isRunning ? (
            <button onClick={handleStart} className="btn-primary">
              Start Test
            </button>
          ) : (
            <button onClick={handleStop} className="btn-danger">
              Stop Test
            </button>
          )}
        </div>
      </div>

      {(isRunning || steps.length > 0) && (
        <div className="progress-section">
          <h2>Test Progress</h2>

          <div className="preview-and-steps">
            {/* Live Browser Preview */}
            <div className="preview-panel">
              <h3>Live Preview</h3>
              {liveScreenshot ? (
                <div className="preview-container">
                  <img
                    src={`data:image/png;base64,${liveScreenshot}`}
                    alt="Live browser preview"
                    className="preview-image"
                  />
                  <div className="preview-overlay">
                    <div className="current-action">{currentStep}</div>
                  </div>
                </div>
              ) : (
                <div className="preview-placeholder">
                  <div className="spinner"></div>
                  <p>Loading preview...</p>
                </div>
              )}
            </div>

            {/* Steps List */}
            <div className="steps-panel">
              <h3>Test Steps</h3>
              <div className="current-step">
                <strong>Current:</strong> {currentStep}
              </div>

              <div className="steps-list">
            {steps.map((step, index) => (
              <div key={step.id} className={`step step-${step.status}`}>
                <span className="step-number">{index + 1}</span>
                <span className="step-action">{step.action}</span>
                <span className="step-target">{step.target}</span>
                <span className={`step-status status-${step.status}`}>
                  {step.status}
                </span>
                {step.result && (
                  <div className="step-result">{step.result}</div>
                )}
                {step.error && <div className="step-error">{step.error}</div>}
              </div>
            ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {testResult && (
        <div className="result-section">
          <h2>Test Results</h2>

          <div className="result-summary">
            <div className="result-item">
              <strong>Status:</strong>
              <span className={`status-${testResult.status}`}>
                {testResult.status}
              </span>
            </div>
            <div className="result-item">
              <strong>Duration:</strong>
              {Math.round(
                (testResult.endTime - testResult.startTime) / 1000,
              )}
              s
            </div>
            <div className="result-item">
              <strong>Steps:</strong> {testResult.steps.length}
            </div>
            <div className="result-item">
              <strong>Errors:</strong> {testResult.errors.length}
            </div>
          </div>

          {testResult.summary && (
            <div className="result-summary-text">
              <h3>Summary</h3>
              <p>{testResult.summary}</p>
            </div>
          )}

          {testResult.errors.length > 0 && (
            <div className="result-errors">
              <h3>Errors</h3>
              {testResult.errors.map((error: any, index: number) => (
                <div key={index} className="error-item">
                  <strong>{error.message}</strong>
                  {error.stack && <pre>{error.stack}</pre>}
                </div>
              ))}
            </div>
          )}

          {testResult.consoleLogs.length > 0 && (
            <div className="console-logs">
              <h3>Console Logs ({testResult.consoleLogs.length})</h3>
              <div className="logs-list">
                {testResult.consoleLogs.map((log: any, index: number) => (
                  <div key={index} className={`log-item log-${log.type}`}>
                    <span className="log-type">{log.type}</span>
                    <span className="log-text">{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="actions">
            <button onClick={handleSaveReport} className="btn-primary">
              Save Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
