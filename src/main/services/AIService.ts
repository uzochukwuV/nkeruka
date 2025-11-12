/**
 * AI Service using Anthropic's Claude
 * Handles AI-powered test planning and decision making
 */

import Anthropic from '@anthropic-ai/sdk';
import { AIAnalysis } from '../types';

export class AIService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    });
  }

  /**
   * Analyze page and determine next action
   */
  async analyzePageAndDecideAction(
    pageContent: string,
    accessibilityTree: any,
    testObjective: string,
    previousSteps: string[],
    screenshot?: string,
  ): Promise<AIAnalysis> {
    try {
      const prompt = this.buildAnalysisPrompt(
        pageContent,
        accessibilityTree,
        testObjective,
        previousSteps,
      );

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: screenshot
              ? [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/png',
                      data: screenshot,
                    },
                  },
                  {
                    type: 'text',
                    text: prompt,
                  },
                ]
              : prompt,
          },
        ],
      });

      // Parse Claude's response
      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';
      return this.parseAIResponse(responseText);
    } catch (error) {
      throw new Error(`AI analysis failed: ${error}`);
    }
  }

  /**
   * Validate test results
   */
  async validateResults(
    testObjective: string,
    steps: string[],
    consoleLogs: string[],
    finalScreenshot?: string,
  ): Promise<AIAnalysis> {
    try {
      const prompt = `
You are analyzing a web application test.

Test Objective: ${testObjective}

Steps Executed:
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Console Logs:
${consoleLogs.join('\n')}

Based on this information, evaluate:
1. Did the test achieve its objective?
2. Were there any errors or issues?
3. What is your overall assessment?

Respond in JSON format:
{
  "validation": {
    "passed": true/false,
    "issues": ["list", "of", "issues"]
  },
  "summary": "overall assessment"
}
`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: finalScreenshot
              ? [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/png',
                      data: finalScreenshot,
                    },
                  },
                  {
                    type: 'text',
                    text: prompt,
                  },
                ]
              : prompt,
          },
        ],
      });

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';
      return this.parseAIResponse(responseText);
    } catch (error) {
      throw new Error(`Validation failed: ${error}`);
    }
  }

  /**
   * Generate test report summary
   */
  async generateSummary(
    testObjective: string,
    steps: string[],
    errors: string[],
    duration: number,
  ): Promise<string> {
    try {
      const prompt = `
Generate a concise test report summary.

Test Objective: ${testObjective}
Duration: ${duration}ms
Steps Completed: ${steps.length}
Errors: ${errors.length}

Steps:
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${errors.length > 0 ? `\nErrors:\n${errors.join('\n')}` : ''}

Provide a clear, professional summary of what was tested and the outcome.
`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      return message.content[0].type === 'text'
        ? message.content[0].text
        : 'Summary generation failed';
    } catch (error) {
      throw new Error(`Summary generation failed: ${error}`);
    }
  }

  /**
   * Build analysis prompt for AI
   */
  private buildAnalysisPrompt(
    pageContent: string,
    accessibilityTree: any,
    testObjective: string,
    previousSteps: string[],
  ): string {
    return `
You are a web testing agent. Your goal: ${testObjective}

Previous steps taken:
${previousSteps.length > 0 ? previousSteps.map((step, i) => `${i + 1}. ${step}`).join('\n') : 'None yet'}

Current page accessibility tree:
${JSON.stringify(accessibilityTree, null, 2).substring(0, 3000)}

Based on the current page state and test objective, decide the next action.

Respond in JSON format:
{
  "nextAction": {
    "type": "click|fill|navigate|validate|wait",
    "target": "CSS selector or element description",
    "value": "value if filling a field",
    "reasoning": "why you chose this action"
  }
}

If the test objective is complete, respond with:
{
  "nextAction": null,
  "validation": {
    "passed": true/false,
    "issues": []
  },
  "summary": "test completion summary"
}
`;
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(responseText: string): AIAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed as AIAnalysis;
      }

      // Fallback: return raw text
      return {
        summary: responseText,
      };
    } catch (error) {
      return {
        summary: responseText,
      };
    }
  }
}
