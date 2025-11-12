# Web Agent Tester

An AI-powered desktop application for automated frontend testing. Let AI agents explore your website, interact with forms, and validate functionality - then get detailed reports with console logs, network activity, and screenshots.

![Web Agent Tester](assets/icon.png)

## Features

- **AI-Powered Testing**: Uses Claude (Anthropic) to intelligently navigate and test web applications
- **Autonomous Navigation**: AI decides what to click, fill, and validate based on your test objectives
- **Comprehensive Reporting**:
  - Step-by-step execution logs
  - Console error detection
  - Network request monitoring
  - Screenshots at each step
- **Developer Console Integration**: Automatically captures and displays browser console errors
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Headless Mode**: Run tests in the background without opening browser windows

## Architecture

### Technology Stack

- **Electron**: Desktop application framework
- **React + TypeScript**: Modern UI with type safety
- **Playwright**: Browser automation engine
- **Anthropic Claude API**: AI decision-making and test planning
- **Node.js**: Backend services

### Project Structure

```
src/
├── main/                      # Electron main process
│   ├── services/
│   │   ├── BrowserService.ts  # Playwright browser control
│   │   ├── AIService.ts       # Claude AI integration
│   │   └── TestRunner.ts      # Test orchestration
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   └── ipc/
│       └── handlers.ts       # IPC communication handlers
└── renderer/                  # React UI
    ├── components/
    │   ├── TestRunner.tsx    # Main UI component
    │   └── TestRunner.css    # Styling
    └── App.tsx              # Application root
```

## Installation

### Prerequisites

- Node.js 14.x or higher
- npm 7.x or higher

### Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd nkeruka
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install chromium
```

## Usage

### Development Mode

Start the app in development mode with hot-reload:

```bash
npm start
```

### Using the Application

1. **Configure Your Test**:
   - Enter the website URL you want to test
   - Describe your test objective (e.g., "Fill out the contact form and submit")
   - Enter your Anthropic API key
   - Optionally enable headless mode

2. **Run the Test**:
   - Click "Start Test"
   - Watch as the AI agent navigates your site
   - See real-time progress updates

3. **Review Results**:
   - View the test summary
   - Check console logs for errors
   - Review network activity
   - Examine screenshots
   - Save the report as JSON

### Example Test Objectives

- "Navigate to the login page and attempt to log in with test credentials"
- "Find the pricing page and verify all plan options are visible"
- "Add a product to cart and proceed to checkout"
- "Fill out the contact form with test data and submit"
- "Search for 'example' and verify results are displayed"

## Building for Production

### Package for All Platforms

```bash
npm run package
```

This creates distributable packages in the `release/build` directory.

### Platform-Specific Builds

The application uses `electron-builder` and is configured to build:
- **Windows**: NSIS installer (.exe)
- **macOS**: DMG and App Bundle
- **Linux**: AppImage

## Configuration

### Anthropic API Key

You need an Anthropic API key to use the AI features:

1. Sign up at [Anthropic](https://www.anthropic.com)
2. Generate an API key
3. Enter it in the application settings

**Note**: The API key is not stored permanently and must be entered each session for security.

## How It Works

### Test Execution Flow

1. **Initialization**:
   - Launches Playwright browser
   - Sets up console and network listeners
   - Navigates to target URL

2. **AI Loop**:
   - Takes screenshot of current page
   - Analyzes page accessibility tree
   - Claude decides next action based on test objective
   - Executes action (click, fill, navigate, etc.)
   - Repeats until objective is complete or max steps reached

3. **Result Collection**:
   - Gathers all console logs
   - Collects network requests
   - Takes final screenshots
   - Generates AI-powered summary

4. **Report Generation**:
   - Compiles all test data
   - Creates structured JSON report
   - Displays results in UI

### AI Decision Making

The AI service uses Claude's vision capabilities to:
- Understand page layout from screenshots
- Parse accessibility trees for element selection
- Reason about next actions based on test objectives
- Validate whether test goals were achieved

## API Reference

### Window API (Renderer Process)

```typescript
window.electron.test.start(config: TestConfig): Promise<TestResult>
window.electron.test.stop(): Promise<void>
window.electron.test.getStatus(): Promise<TestResult | null>
window.electron.test.saveReport(result: TestResult): Promise<string>
window.electron.test.onProgress(callback: (step: TestStep) => void): void
```

### Main Process Services

**BrowserService**: Playwright browser automation
- `launch()`: Start browser
- `navigate(url)`: Go to URL
- `click(selector)`: Click element
- `fill(selector, value)`: Fill input
- `screenshot()`: Capture screenshot
- `getConsoleLogs()`: Get console messages

**AIService**: Claude AI integration
- `analyzePageAndDecideAction()`: Get next action from AI
- `validateResults()`: Check test completion
- `generateSummary()`: Create test report

**TestRunner**: Orchestration
- `startTest(config)`: Execute full test
- `stopTest()`: Cancel running test

## Troubleshooting

### Common Issues

**"Failed to launch browser"**
- Ensure Playwright browsers are installed: `npx playwright install`
- Check that you have sufficient disk space

**"AI analysis failed"**
- Verify your Anthropic API key is correct
- Check your internet connection
- Ensure you have API credits

**"Test stuck in running state"**
- The AI may be analyzing a complex page
- Max steps limit is 20 - test will auto-stop
- Use "Stop Test" button to manually cancel

### Debug Mode

Enable detailed logging by setting environment variable:
```bash
DEBUG=* npm start
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Security Considerations

- **API Keys**: Never commit API keys to version control
- **Sensitive Data**: Be careful when testing sites with real user data
- **Network**: Test execution requires internet for AI API calls
- **Permissions**: Browser runs with standard permissions

## License

MIT License - see LICENSE file for details

## Roadmap

- [ ] Support for multiple AI providers (OpenAI, local models)
- [ ] Visual regression testing
- [ ] Test script recording and playback
- [ ] Integration with CI/CD pipelines
- [ ] Scheduled test execution
- [ ] Multi-page test flows
- [ ] Custom assertions and validations
- [ ] Team collaboration features

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Documentation: See `/docs` folder

## Acknowledgments

Built with:
- [Electron React Boilerplate](https://github.com/electron-react-boilerplate/electron-react-boilerplate)
- [Playwright](https://playwright.dev/)
- [Anthropic Claude](https://www.anthropic.com/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
