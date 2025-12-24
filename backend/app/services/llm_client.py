"""LLM client abstraction for AI-powered security analysis."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class LLMClient(ABC):
    """Abstract base class for LLM integrations."""

    @abstractmethod
    async def generate(self, prompt: str, **kwargs: Any) -> str:
        """
        Generate text completion from the LLM.

        Args:
            prompt: The input prompt for the LLM
            **kwargs: Additional provider-specific parameters

        Returns:
            Generated text response

        Raises:
            LLMError: If generation fails
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the LLM client is properly configured."""
        pass


class LLMError(Exception):
    """Raised when LLM operations fail."""

    pass


class GeminiClient(LLMClient):
    """Google Gemini LLM client implementation."""

    def __init__(self, settings: Any) -> None:
        """
        Initialize Gemini client.

        Args:
            settings: Application settings with gemini_api_key
        """
        self.settings = settings
        self._model = None

        if self.is_available():
            try:
                import google.generativeai as genai

                genai.configure(api_key=settings.gemini_api_key)
                self._model = genai.GenerativeModel(model_name=settings.llm_model)
                logger.info("Gemini LLM client initialized successfully")
            except ImportError:
                logger.error("google-generativeai library not installed")
                raise LLMError(
                    "google-generativeai library required but not installed"
                )
            except Exception as exc:
                logger.error(f"Failed to initialize Gemini client: {exc}")
                raise LLMError(f"Gemini initialization failed: {exc}")

    def is_available(self) -> bool:
        """Check if Gemini API key is configured."""
        return bool(self.settings.gemini_api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def generate(self, prompt: str, **kwargs: Any) -> str:
        """
        Generate text using Gemini API with retry logic.

        Args:
            prompt: The input prompt
            **kwargs: Additional parameters (temperature, max_tokens, etc.)

        Returns:
            Generated text response

        Raises:
            LLMError: If generation fails after retries
        """
        if not self.is_available():
            raise LLMError("Gemini client not available - API key not configured")

        if not self._model:
            raise LLMError("Gemini model not initialized")

        try:
            # Extract generation config from kwargs
            generation_config = {
                "temperature": kwargs.get("temperature", 0.7),
                "top_p": kwargs.get("top_p", 0.95),
                "top_k": kwargs.get("top_k", 40),
                "max_output_tokens": kwargs.get("max_tokens", 2048),
            }

            # Generate content
            response = await self._model.generate_content_async(
                prompt, generation_config=generation_config
            )

            if not response.text:
                raise LLMError("Empty response from Gemini API")

            return response.text

        except Exception as exc:
            logger.error(f"Gemini generation failed: {exc}")
            raise LLMError(f"Failed to generate with Gemini: {exc}")


class MockLLMClient(LLMClient):
    """Mock LLM client for testing without API calls."""

    def __init__(self) -> None:
        """Initialize mock client."""
        self._available = True

    def is_available(self) -> bool:
        """Always available for testing."""
        return self._available

    async def generate(self, prompt: str, **kwargs: Any) -> str:
        """Return a mock response."""
        return "Mock LLM response for testing purposes."


def create_llm_client(settings: Any) -> LLMClient | None:
    """
    Factory function to create the appropriate LLM client.

    Args:
        settings: Application settings

    Returns:
        LLMClient instance or None if LLM not configured
    """
    provider = settings.llm_provider.lower()

    # Handle "gemini" or model names starting with "gemini-"
    if provider == "gemini" or provider.startswith("gemini-"):
        if not settings.gemini_api_key:
            logger.warning("Gemini selected but API key not configured")
            return None
        return GeminiClient(settings)
    elif provider == "mock":
        logger.info("Using mock LLM client for testing")
        return MockLLMClient()
    else:
        logger.warning(f"Unknown LLM provider: {provider}")
        return None
