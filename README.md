# AegisScan

**Adaptive multi-agent security assistant** for automated vulnerability scanning and penetration testing. AegisScan orchestrates multiple security tools (Semgrep, Trivy, Gitleaks, ffuf, OWASP ZAP, Nuclei) through an AI-powered platform with a modern web dashboard.

## ✨ Key Features

- **🔗 GitHub Integration**: Clone and scan any GitHub repository (public or private)
- **🌐 Live Application Testing**: Dynamic analysis (DAST) on running web applications
- **🤖 Multi-Agent Architecture**: Specialized security agents working in parallel
- **📊 Real-time Dashboard**: WebSocket-powered progress monitoring
- **📝 Comprehensive Reports**: Detailed vulnerability reports with remediation guidance
- **🐳 Docker-First**: No tool installation needed - everything runs in containers

## 🚀 Quick Start

The easiest way to use AegisScan is through Docker Compose:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/aegisscan.git
cd aegisscan

# 2. Create environment file (optional - for private repos and AI features)
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys if needed

# 3. Start the application
docker-compose up

# 4. Open your browser
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:8000
```

That's it! No tool installation, no CLI setup required.

## 📋 Usage

### Web UI (Recommended)

1. Open `http://localhost:5173` in your browser
2. Enter scan configuration:
   - **GitHub URL**: `https://github.com/username/repository` (for static analysis)
   - **Branch**: `main` or any branch/tag
   - **GitHub Token**: (optional, for private repos - [create here](https://github.com/settings/tokens))
   - **Target URL**: `http://localhost:4000` or `https://myapp.com` (optional, for DAST)
   - **Scan Mode**: Adaptive, Standard, Fast, or Deep
3. Click "Start Scan"
4. Monitor real-time progress as agents execute
5. View findings and export reports

### Scan Types

**Static Code Analysis Only:**
- Provide: GitHub URL + Branch
- Agents run: Semgrep, Trivy, Gitleaks
- Use case: Pre-commit security checks, code review

**Dynamic Application Testing Only:**
- Provide: Target URL
- Agents run: OWASP ZAP, ffuf, Nuclei
- Use case: Penetration testing of live applications

**Hybrid Scan (Recommended):**
- Provide: Both GitHub URL and Target URL
- Agents run: All static + dynamic agents
- Use case: Comprehensive security assessment

## Structure

- `backend/` – FastAPI service exposing REST API, WebSocket updates, and orchestrator logic
- `frontend/` – React dashboard for configuring scans, monitoring progress, and viewing results
- `docker/` – Dockerfile with all security tools pre-installed
- `agentinfo.md` / `Updatedinfra.md` – Architecture and design documentation

## 🔧 Configuration (Optional)

AegisScan works out-of-the-box, but you can enhance it with optional integrations.

### Environment Variables

Create `backend/.env` for optional features:

```bash
# GitHub Access (for private repositories)
# GITHUB_TOKEN=ghp_your_github_personal_access_token

# AI/LLM Features (for adaptive agent)
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key

# Voice Integration (for spoken updates)
ELEVENLABS_API_KEY=your_eleven_key
ELEVENLABS_AGENT_ID=hal_voice_agent_id

# Tool Paths (already configured in Docker)
SEMGREP_BIN=semgrep
TRIVY_BIN=trivy
GITLEAKS_BIN=gitleaks
FFUF_BIN=ffuf
ZAP_BASELINE_BIN=zap-baseline.py
NUCLEI_BIN=nuclei

# Workspace Configuration
GIT_WORKSPACES_DIR=/tmp/aegis-workspaces
RESULTS_DIR=/output
```

### GitHub Personal Access Token

To scan private repositories:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (Full control of private repositories)
4. Copy the token (starts with `ghp_`)
5. Paste it in the "Token" field in the UI, or set `GITHUB_TOKEN` in `.env`

## 🛠️ Development Setup

### Backend Development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development

```bash
cd frontend
pnpm install  # or npm install
pnpm dev      # or npm run dev
```

The dev server will be available at `http://localhost:5173`

### CLI Usage (Advanced)

The CLI is optional and primarily for development:

```bash
# Install CLI
pip install -e backend

# Run scans via CLI (legacy mode - requires local tools)
aegisscan scan ./target-directory --mode adaptive
aegisscan report pentest_output/<scan_id>.json
aegisscan serve --port 8000
```

**Note**: CLI mode is deprecated in favor of the web UI with GitHub integration.

## 🐳 Docker Architecture

AegisScan uses a Docker-first architecture for zero-setup security scanning.

### Services

The `docker-compose.yml` defines three services:

1. **backend**: FastAPI application with all security tools (Semgrep, Trivy, Gitleaks, ffuf, ZAP, Nuclei)
2. **frontend**: React web UI for scan configuration and monitoring
3. **cli**: Helper container for advanced CLI usage (optional)

### Volumes

- `pentest_output/`: Scan results and reports (persisted to host)
- `git-workspaces`: Temporary storage for cloned GitHub repositories (ephemeral)

### How It Works

1. User submits GitHub URL via web UI
2. Backend clones repository into temporary workspace
3. Static analysis agents scan the cloned code
4. Dynamic agents test the live application (if URL provided)
5. Results streamed to UI via WebSocket
6. Workspace automatically cleaned up after scan
7. Reports saved to `pentest_output/`

### Manual Docker Build

Build the toolbox image manually:

```bash
docker build -t aegisscan-tools -f docker/Dockerfile .
```

Run backend standalone:

```bash
docker run --rm -it \
  -p 8000:8000 \
  -v $(pwd)/pentest_output:/output \
  -v aegis-workspaces:/tmp/aegis-workspaces \
  --env-file backend/.env \
  aegisscan-tools \
  aegisscan serve --host 0.0.0.0 --port 8000
```

## 🔒 Security Tools Included

AegisScan integrates the following industry-standard security tools:

| Tool | Purpose | Agent |
|------|---------|-------|
| [Semgrep](https://semgrep.dev/) | Static code analysis | Static Agent |
| [Trivy](https://aquasecurity.github.io/trivy/) | Dependency vulnerability scanning | Dependency Agent |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | Secret and credential detection | Secret Agent |
| [ffuf](https://github.com/ffuf/ffuf) | Web fuzzing and directory discovery | Fuzzer Agent |
| [OWASP ZAP](https://www.zaproxy.org/) | Dynamic application security testing | DAST Agent |
| [Nuclei](https://github.com/projectdiscovery/nuclei) | Template-based vulnerability scanning | Template Agent |

All tools are pre-installed in the Docker image - **no local installation required**.

## 📖 Examples

### Scan a Public GitHub Repository

```
GitHub URL: https://github.com/OWASP/NodeGoat
Branch: main
Target URL: (leave empty)
Mode: Standard
```

Result: Static analysis of vulnerable Node.js application

### Scan a Running Application

```
GitHub URL: (leave empty)
Target URL: http://localhost:3000
Mode: Deep
```

Result: DAST, fuzzing, and vulnerability template testing

### Full Hybrid Scan

```
GitHub URL: https://github.com/myorg/myapp
Branch: develop
GitHub Token: ghp_xxx (if private)
Target URL: https://staging.myapp.com
Mode: Adaptive
```

Result: Complete security assessment (static + dynamic)

## 🗺️ Roadmap

- [x] Docker-based tool execution
- [x] GitHub repository cloning and scanning
- [x] Live application DAST scanning
- [x] Real-time WebSocket progress updates
- [x] Multi-agent orchestration
- [ ] LLM adaptive agent (Gemini integration)
- [ ] Enhanced HTML/PDF report generation
- [ ] Voice notification integration (ElevenLabs)
- [ ] Database persistence (scan history)
- [ ] Multi-user authentication
- [ ] GitLab/Bitbucket support
- [ ] Scheduled/recurring scans
- [ ] CI/CD integrations (GitHub Actions, GitLab CI)
- [ ] Slack/Discord/Teams notifications

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[Add your license here]

## 🆘 Support

- Documentation: See `agentinfo.md` and `Updatedinfra.md` for architecture details
- Issues: [GitHub Issues](https://github.com/yourusername/aegisscan/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/aegisscan/discussions)
