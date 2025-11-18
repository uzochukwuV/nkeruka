/**
 * Scheduler Component - Autonomous Test Execution UI
 */

import React, { useState, useEffect } from 'react';
import './Scheduler.css';
import { v4 as uuidv4 } from 'uuid';

interface ScheduledTest {
  id: string;
  name: string;
  config: any;
  schedule: {
    type: 'interval' | 'cron' | 'continuous';
    interval?: number;
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

interface SchedulerStatus {
  isRunning: boolean;
  totalTests: number;
  activeTests: number;
  currentExecutions: number;
}

export default function Scheduler() {
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus>({
    isRunning: false,
    totalTests: 0,
    activeTests: 0,
    currentExecutions: 0,
  });

  const [scheduledTests, setScheduledTests] = useState<ScheduledTest[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [newTest, setNewTest] = useState({
    name: '',
    url: '',
    testObjective: '',
    anthropicApiKey: '',
    scheduleType: 'interval' as 'interval' | 'continuous' | 'cron',
    intervalMinutes: 5,
    maxIterations: 0,
  });

  useEffect(() => {
    loadSchedulerData();
    const interval = setInterval(loadSchedulerData, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadSchedulerData = async () => {
    const statusResult = await window.electron.scheduler.getStatus();
    if (statusResult.success) {
      setSchedulerStatus(statusResult.status);
    }

    const testsResult = await window.electron.scheduler.getTests();
    if (testsResult.success) {
      setScheduledTests(testsResult.tests);
    }
  };

  const handleStartBot = async () => {
    await window.electron.scheduler.start();
    loadSchedulerData();
  };

  const handleStopBot = async () => {
    await window.electron.scheduler.stop();
    loadSchedulerData();
  };

  const handleAddTest = async () => {
    if (!newTest.name || !newTest.url || !newTest.testObjective) {
      alert('Please fill in all required fields');
      return;
    }

    const scheduledTest: ScheduledTest = {
      id: uuidv4(),
      name: newTest.name,
      config: {
        url: newTest.url,
        testObjective: newTest.testObjective,
        anthropicApiKey: newTest.anthropicApiKey,
        headless: true,
      },
      schedule: {
        type: newTest.scheduleType,
        interval:
          newTest.scheduleType === 'interval'
            ? newTest.intervalMinutes * 60 * 1000
            : undefined,
        maxIterations: newTest.maxIterations > 0 ? newTest.maxIterations : undefined,
      },
      status: 'active',
      executionCount: 0,
      results: [],
    };

    await window.electron.scheduler.addTest(scheduledTest);
    setShowAddDialog(false);
    setNewTest({
      name: '',
      url: '',
      testObjective: '',
      anthropicApiKey: '',
      scheduleType: 'interval',
      intervalMinutes: 5,
      maxIterations: 0,
    });
    loadSchedulerData();
  };

  const handlePauseTest = async (testId: string) => {
    await window.electron.scheduler.pauseTest(testId);
    loadSchedulerData();
  };

  const handleResumeTest = async (testId: string) => {
    await window.electron.scheduler.resumeTest(testId);
    loadSchedulerData();
  };

  const handleRemoveTest = async (testId: string) => {
    if (confirm('Are you sure you want to remove this scheduled test?')) {
      await window.electron.scheduler.removeTest(testId);
      loadSchedulerData();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="scheduler">
      <div className="header">
        <h1>Autonomous Test Scheduler</h1>
        <p>Schedule and automate recurring tests</p>
      </div>

      {/* Scheduler Status */}
      <div className="scheduler-status">
        <div className="status-card">
          <h3>Bot Status</h3>
          <div className={`bot-status ${schedulerStatus.isRunning ? 'running' : 'stopped'}`}>
            {schedulerStatus.isRunning ? '● Running' : '○ Stopped'}
          </div>
          <div className="bot-controls">
            {!schedulerStatus.isRunning ? (
              <button onClick={handleStartBot} className="btn-success">
                Start Bot
              </button>
            ) : (
              <button onClick={handleStopBot} className="btn-danger">
                Stop Bot
              </button>
            )}
          </div>
        </div>

        <div className="status-card">
          <h3>Statistics</h3>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Total Tests:</span>
              <span className="stat-value">{schedulerStatus.totalTests}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Active:</span>
              <span className="stat-value">{schedulerStatus.activeTests}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Running Now:</span>
              <span className="stat-value">{schedulerStatus.currentExecutions}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Test Button */}
      <div className="add-test-section">
        <button onClick={() => setShowAddDialog(true)} className="btn-primary">
          + Add Scheduled Test
        </button>
      </div>

      {/* Scheduled Tests List */}
      <div className="scheduled-tests">
        <h2>Scheduled Tests</h2>
        {scheduledTests.length === 0 ? (
          <div className="empty-state">
            <p>No scheduled tests yet. Click "Add Scheduled Test" to create one.</p>
          </div>
        ) : (
          <div className="tests-grid">
            {scheduledTests.map((test) => (
              <div key={test.id} className={`test-card test-${test.status}`}>
                <div className="test-header">
                  <h3>{test.name}</h3>
                  <span className={`status-badge status-${test.status}`}>
                    {test.status}
                  </span>
                </div>

                <div className="test-details">
                  <div className="detail">
                    <strong>URL:</strong> {test.config.url}
                  </div>
                  <div className="detail">
                    <strong>Objective:</strong> {test.config.testObjective}
                  </div>
                  <div className="detail">
                    <strong>Schedule:</strong>{' '}
                    {test.schedule.type === 'interval'
                      ? `Every ${test.schedule.interval! / 60000} minutes`
                      : test.schedule.type === 'continuous'
                        ? 'Continuous'
                        : 'Cron'}
                  </div>
                  <div className="detail">
                    <strong>Executions:</strong> {test.executionCount}
                    {test.schedule.maxIterations && ` / ${test.schedule.maxIterations}`}
                  </div>
                  {test.lastExecutedTime && (
                    <div className="detail">
                      <strong>Last Run:</strong> {formatTime(test.lastExecutedTime)}
                    </div>
                  )}
                  {test.nextExecutionTime && test.status === 'active' && (
                    <div className="detail">
                      <strong>Next Run:</strong> {formatTime(test.nextExecutionTime)}
                    </div>
                  )}
                </div>

                {/* Recent Results */}
                {test.results.length > 0 && (
                  <div className="test-results">
                    <strong>Recent Results:</strong>
                    <div className="results-summary">
                      {test.results.slice(-5).map((result, idx) => (
                        <div
                          key={idx}
                          className={`result-badge ${result.success ? 'success' : 'failed'}`}
                          title={`${formatTime(result.timestamp)} - ${formatDuration(result.duration)}`}
                        >
                          {result.success ? '✓' : '✗'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="test-actions">
                  {test.status === 'active' ? (
                    <button
                      onClick={() => handlePauseTest(test.id)}
                      className="btn-warning"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResumeTest(test.id)}
                      className="btn-success"
                    >
                      Resume
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveTest(test.id)}
                    className="btn-danger"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Test Dialog */}
      {showAddDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add Scheduled Test</h2>

            <div className="form-group">
              <label>Test Name:</label>
              <input
                type="text"
                value={newTest.name}
                onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                placeholder="My Scheduled Test"
              />
            </div>

            <div className="form-group">
              <label>Website URL:</label>
              <input
                type="text"
                value={newTest.url}
                onChange={(e) => setNewTest({ ...newTest, url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>

            <div className="form-group">
              <label>Test Objective:</label>
              <textarea
                value={newTest.testObjective}
                onChange={(e) =>
                  setNewTest({ ...newTest, testObjective: e.target.value })
                }
                placeholder="What should the test do?"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Anthropic API Key:</label>
              <input
                type="password"
                value={newTest.anthropicApiKey}
                onChange={(e) =>
                  setNewTest({ ...newTest, anthropicApiKey: e.target.value })
                }
                placeholder="sk-ant-..."
              />
            </div>

            <div className="form-group">
              <label>Schedule Type:</label>
              <select
                value={newTest.scheduleType}
                onChange={(e) =>
                  setNewTest({
                    ...newTest,
                    scheduleType: e.target.value as 'interval' | 'continuous' | 'cron',
                  })
                }
              >
                <option value="interval">Interval</option>
                <option value="continuous">Continuous</option>
              </select>
            </div>

            {newTest.scheduleType === 'interval' && (
              <div className="form-group">
                <label>Interval (minutes):</label>
                <input
                  type="number"
                  value={newTest.intervalMinutes}
                  onChange={(e) =>
                    setNewTest({
                      ...newTest,
                      intervalMinutes: parseInt(e.target.value) || 5,
                    })
                  }
                  min="1"
                />
              </div>
            )}

            <div className="form-group">
              <label>Max Iterations (0 = unlimited):</label>
              <input
                type="number"
                value={newTest.maxIterations}
                onChange={(e) =>
                  setNewTest({
                    ...newTest,
                    maxIterations: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
              />
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAddDialog(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleAddTest} className="btn-primary">
                Add Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
