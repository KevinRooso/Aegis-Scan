"""
Git service for cloning and managing remote repositories.
"""

import asyncio
import logging
import re
import shutil
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class GitCloneError(Exception):
    """Raised when git clone operation fails."""
    pass


class GitService:
    """Service for cloning and managing git repositories."""

    def __init__(self, base_workspace_dir: Path):
        """
        Initialize GitService.

        Args:
            base_workspace_dir: Base directory for cloning repositories
        """
        self.base_workspace_dir = base_workspace_dir
        self.base_workspace_dir.mkdir(parents=True, exist_ok=True)

    def _validate_github_url(self, repo_url: str) -> bool:
        """
        Validate that the URL is a valid GitHub repository URL.

        Args:
            repo_url: Repository URL to validate

        Returns:
            True if valid, False otherwise
        """
        try:
            parsed = urlparse(repo_url)
            # Support both https://github.com/user/repo and git@github.com:user/repo
            if parsed.scheme == "https" and "github.com" in parsed.netloc:
                return True
            if parsed.scheme == "" and repo_url.startswith("git@github.com:"):
                return True
            return False
        except Exception:
            return False

    def _sanitize_repo_name(self, repo_url: str) -> str:
        """
        Extract a safe directory name from repository URL.

        Args:
            repo_url: Repository URL

        Returns:
            Sanitized directory name
        """
        # Extract repo name from URL
        # https://github.com/user/repo.git -> user-repo
        # git@github.com:user/repo.git -> user-repo
        match = re.search(r"github\.com[:/](.+?)(?:\.git)?$", repo_url)
        if match:
            repo_path = match.group(1)
            # Replace / with - and remove any non-alphanumeric chars except -
            sanitized = re.sub(r"[^a-zA-Z0-9-]", "-", repo_path.replace("/", "-"))
            return sanitized.lower()
        return "repo"

    async def clone_repo(
        self,
        repo_url: str,
        branch: str = "main",
        auth_token: Optional[str] = None,
        scan_id: Optional[str] = None,
    ) -> Path:
        """
        Clone a GitHub repository to a temporary workspace.

        Args:
            repo_url: GitHub repository URL (https or git)
            branch: Branch name to clone (default: main)
            auth_token: GitHub personal access token for private repos
            scan_id: Unique scan identifier for workspace isolation

        Returns:
            Path to cloned repository

        Raises:
            GitCloneError: If clone operation fails
        """
        # Validate URL
        if not self._validate_github_url(repo_url):
            raise GitCloneError(f"Invalid GitHub URL: {repo_url}")

        # Create unique workspace directory
        repo_name = self._sanitize_repo_name(repo_url)
        if scan_id:
            workspace_name = f"{scan_id}-{repo_name}"
        else:
            workspace_name = repo_name

        workspace_path = self.base_workspace_dir / workspace_name

        # Clean up if already exists
        if workspace_path.exists():
            logger.warning(f"Workspace {workspace_path} already exists, removing...")
            shutil.rmtree(workspace_path)

        workspace_path.mkdir(parents=True, exist_ok=True)

        # Prepare clone URL with authentication if provided
        clone_url = repo_url
        if auth_token and repo_url.startswith("https://"):
            # Insert token into URL: https://TOKEN@github.com/user/repo.git
            clone_url = repo_url.replace("https://", f"https://{auth_token}@")

        # Build git clone command
        # Use shallow clone for speed (--depth 1)
        cmd = [
            "git",
            "clone",
            "--depth", "1",
            "--branch", branch,
            "--single-branch",
            clone_url,
            str(workspace_path),
        ]

        logger.info(f"Cloning repository: {repo_url} (branch: {branch})")

        try:
            # Run git clone command
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                logger.error(f"Git clone failed: {error_msg}")
                # Clean up failed workspace
                if workspace_path.exists():
                    shutil.rmtree(workspace_path)
                raise GitCloneError(f"Failed to clone repository: {error_msg}")

            logger.info(f"Successfully cloned repository to {workspace_path}")
            return workspace_path

        except FileNotFoundError:
            raise GitCloneError(
                "Git command not found. Ensure git is installed and in PATH."
            )
        except Exception as e:
            logger.error(f"Error during git clone: {e}")
            # Clean up on error
            if workspace_path.exists():
                shutil.rmtree(workspace_path)
            raise GitCloneError(f"Failed to clone repository: {str(e)}")

    async def cleanup_workspace(self, workspace_path: Path) -> bool:
        """
        Remove a cloned repository workspace.

        Args:
            workspace_path: Path to workspace to remove

        Returns:
            True if cleanup successful, False otherwise
        """
        try:
            if workspace_path.exists() and workspace_path.is_dir():
                logger.info(f"Cleaning up workspace: {workspace_path}")
                shutil.rmtree(workspace_path)
                logger.info(f"Successfully removed workspace: {workspace_path}")
                return True
            else:
                logger.warning(f"Workspace does not exist: {workspace_path}")
                return False
        except Exception as e:
            logger.error(f"Error cleaning up workspace {workspace_path}: {e}")
            return False

    async def get_repo_info(self, workspace_path: Path) -> dict:
        """
        Get information about a cloned repository.

        Args:
            workspace_path: Path to cloned repository

        Returns:
            Dictionary with repo information (branch, commit hash, etc.)
        """
        info = {
            "branch": "unknown",
            "commit": "unknown",
            "remote_url": "unknown",
        }

        try:
            # Get current branch
            process = await asyncio.create_subprocess_exec(
                "git", "-C", str(workspace_path), "rev-parse", "--abbrev-ref", "HEAD",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await process.communicate()
            if process.returncode == 0:
                info["branch"] = stdout.decode().strip()

            # Get current commit hash
            process = await asyncio.create_subprocess_exec(
                "git", "-C", str(workspace_path), "rev-parse", "HEAD",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await process.communicate()
            if process.returncode == 0:
                info["commit"] = stdout.decode().strip()[:8]  # Short hash

            # Get remote URL
            process = await asyncio.create_subprocess_exec(
                "git", "-C", str(workspace_path), "config", "--get", "remote.origin.url",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await process.communicate()
            if process.returncode == 0:
                remote_url = stdout.decode().strip()
                # Remove token from URL if present
                remote_url = re.sub(r"https://[^@]+@", "https://", remote_url)
                info["remote_url"] = remote_url

        except Exception as e:
            logger.error(f"Error getting repo info: {e}")

        return info
