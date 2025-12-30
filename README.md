# AegisScan

AI-powered application security platform with voice-guided vulnerability analysis.

## Overview

AegisScan is a comprehensive security scanning platform that combines enterprise-grade security tools with AI-powered analysis and an innovative voice-guided interface. Scan GitHub repositories and live applications for vulnerabilities with real-time insights.

## Key Features

- **Voice-Guided Security Reviews**: AI voice assistant (Aegis) that explains vulnerabilities conversationally with synchronized visual presentation
- **Multi-Agent Orchestration**: 9 specialized security agents working in parallel for comprehensive coverage
- **Dual Scanning Modes**: Static code analysis (SAST) and dynamic application testing (DAST)
- **Real-time Dashboard**: Live scan monitoring with WebSocket updates and interactive finding cards
- **GitHub Integration**: Clone and scan any public or private repository
- **AI Analysis**: Multi-LLM architecture with automatic fallback, persistent caching, and conversational explanations

## Security Tools

| Tool | Purpose |
|------|---------|
| Semgrep | Static application security testing (SAST) |
| Trivy | Dependency and container vulnerability scanning |
| Gitleaks | Secret and credential detection |
| OWASP ZAP | Dynamic application security testing (DAST) |
| ffuf | Endpoint fuzzing and discovery |
| Nuclei | Template-based vulnerability detection |
| Gemini/Groq AI | Intelligent threat analysis and conversational explanations |

## Tech Stack

**Backend**: Python 3.11+, FastAPI, SQLite, AsyncIO
**Frontend**: React 18, TypeScript, Vite, TailwindCSS, Framer Motion
**AI/Voice**: Google Gemini API, Groq API (auto-fallback), ElevenLabs Voice SDK
**Infrastructure**: Docker, Docker Compose

## Quick Start

### Prerequisites
- Docker & Docker Compose
- (Optional) Gemini API key for AI features (Groq as automatic fallback)
- (Optional) ElevenLabs API key for voice features

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/aegisscan.git
cd aegisscan

# Configure environment (optional for enhanced features)
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Start services
docker-compose up -d
```

**Access**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Usage

### Scan a GitHub Repository

1. Navigate to http://localhost:5173
2. Enter GitHub repository URL
3. (Optional) Provide branch and access token for private repos
4. (Optional) Add target URL for live application DAST scanning
5. Click "Start Scan"

### View Results

- Real-time scan progress with agent status
- Findings organized by severity (Critical, High, Medium, Low, Info)
- Detailed vulnerability information with remediation guidance
- AI-generated security insights and prioritization

### Voice-Guided Review

1. Navigate to Voice Agent page
2. Click "Start Voice Session"
3. Ask questions: "What are the critical findings?", "Show me high severity issues"
4. Aegis provides conversational explanations with synchronized visual cards

## Agent Selection

Agents run automatically based on your inputs:

- **GitHub URL** → Static analysis agents (Static, Dependency, Secret)
- **Target URL** → Dynamic testing agents (DAST, Fuzzer, Template)
- **Always Running** → Meta agents (Adaptive, Threat, Report)

## Documentation

For detailed documentation, architecture, and advanced features, see [README_FULL.md](README_FULL.md).

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Note**: This tool is designed for authorized security testing only. Always obtain proper authorization before scanning applications you don't own.
