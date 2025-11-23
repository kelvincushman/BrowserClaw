# 🤖 AigentisBrowser - AI-Powered Social Media Automation

> **Automated social media management with intelligent browser automation**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

---

## 🤖 What is AigentisBrowser?

AigentisBrowser is a powerful Chrome extension that transforms your browser into an intelligent automation platform for social media management. Using **natural language commands** and **AI-driven intelligence**, AigentisBrowser can automate social media tasks, content posting, engagement, and analytics - making social media management effortless.

## 🚀 Key Features

- ✅ **AI-Powered Automation** - Control your browser with natural language
- ✅ **Social Media Management** - Automate posting, scheduling, and engagement
- ✅ **Tab & Window Management** - Intelligent organization of browser tabs
- ✅ **Content Automation** - Streamline content creation and posting workflows
- ✅ **Privacy-First** - All processing happens locally
- ✅ **Open Source** - Free and transparent codebase
- ✅ **Bring Your Own Key (BYOK)** - Use your own AI API keys

## 📦 Installation

### From Source

1. Clone this repository:
```bash
git clone https://github.com/kelvincushman/AIPex.git
cd AIPex
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-prod` directory

## 🎯 Usage

1. Press `Ctrl+M` (Windows/Linux) or `Cmd+M` (Mac) to open AigentisBrowser
2. Configure your AI API settings (OpenAI, Claude, or DeepSeek)
3. Start automating with natural language commands

### Example Commands

- "Organize my tabs by topic"
- "Summarize this page and save key points"
- "Extract all links from this page"
- "Fill out this form with the provided data"
- "Take a screenshot of this element"

## 🛠️ Development

```bash
# Start development server
npm run dev

# Build for production
npm run build
```

## 🔧 Configuration

The extension requires an AI API key to function. Supported providers:

- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic Claude**
- **DeepSeek**
- Any OpenAI-compatible endpoint

Configure your API settings in the extension's settings panel after installation.

## 🏗️ Architecture

AigentisBrowser is built with:
- **React 19** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tooling
- **Chrome Extension Manifest V3** - Latest extension standards
- **Model Context Protocol (MCP)** - Standardized AI tool integration

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/kelvincushman/AIPex/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kelvincushman/AIPex/discussions)

## 🙏 Acknowledgments

This project builds upon modern web technologies and the open-source community's contributions to browser automation and AI integration.

---

**Made with ❤️ for social media automation**
