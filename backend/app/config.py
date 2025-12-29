from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    llm_provider: str = Field(default="groq", validation_alias="LLM_PROVIDER")
    llm_model: str = Field(default="llama-3.3-70b-versatile", validation_alias="LLM_MODEL")

    # LLM API Keys
    groq_api_key: str | None = Field(default=None, validation_alias="GROQ_API_KEY")
    gemini_api_key: str | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")

    elevenlabs_api_key: str | None = Field(
        default=None, validation_alias="ELEVENLABS_API_KEY"
    )
    elevenlabs_agent_id: str | None = Field(
        default=None, validation_alias="ELEVENLABS_AGENT_ID"
    )
    elevenlabs_base_url: str = Field(
        default="https://api.elevenlabs.io", validation_alias="ELEVENLABS_BASE_URL"
    )
    semgrep_bin: str = Field(default="semgrep", validation_alias="SEMGREP_BIN")
    semgrep_config: str = Field(default="auto", validation_alias="SEMGREP_CONFIG")
    trivy_bin: str = Field(default="trivy", validation_alias="TRIVY_BIN")
    gitleaks_bin: str = Field(default="gitleaks", validation_alias="GITLEAKS_BIN")
    ffuf_bin: str = Field(default="ffuf", validation_alias="FFUF_BIN")
    ffuf_wordlist: str = Field(
        default="/usr/share/wordlists/dirb/common.txt", validation_alias="FFUF_WORDLIST"
    )
    nuclei_bin: str = Field(default="nuclei", validation_alias="NUCLEI_BIN")
    zap_baseline_bin: str = Field(
        default="zap-baseline.py", validation_alias="ZAP_BASELINE_BIN"
    )
    results_dir: Path = Field(default=Path("pentest_output"), validation_alias="RESULTS_DIR")
    git_workspaces_dir: Path = Field(
        default=Path("/tmp/aegis-workspaces"), validation_alias="GIT_WORKSPACES_DIR"
    )
    docker_network: str = Field(default="aegisscan-net", validation_alias="DOCKER_NETWORK")
    enabled_agents: List[str] = Field(
        default_factory=lambda: [
            "static",
            "dependency",
            "secret",
            "fuzzer",
            "dast",
            "template",
            "adaptive",
            "threat",
            "report",
        ]
    )
    websocket_broadcast_interval: float = Field(default=0.5)
    max_concurrency: int = Field(default=2)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


def get_settings() -> Settings:
    return Settings()
