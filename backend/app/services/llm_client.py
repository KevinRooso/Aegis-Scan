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


class GroqClient(LLMClient):
    """Groq LLM client implementation."""

    def __init__(self, settings: Any) -> None:
        """
        Initialize Groq client.

        Args:
            settings: Application settings with groq_api_key
        """
        self.settings = settings
        self.api_key = settings.groq_api_key
        self.model = settings.llm_model or "llama-3.3-70b-versatile"
        self.base_url = "https://api.groq.com/openai/v1"

        if self.is_available():
            logger.info(f"Groq LLM client initialized with model: {self.model}")

    def is_available(self) -> bool:
        """Check if Groq API key is configured."""
        return bool(self.api_key)

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True,
    )
    async def generate(self, prompt: str, **kwargs: Any) -> str:
        """
        Generate text using Groq API.

        Args:
            prompt: The input prompt
            **kwargs: Additional parameters (temperature, max_tokens, etc.)

        Returns:
            Generated text response

        Raises:
            LLMError: If generation fails
        """
        if not self.is_available():
            raise LLMError("Groq client not available - API key not configured")

        try:
            import httpx

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": kwargs.get("temperature", 0.7),
                "max_tokens": kwargs.get("max_tokens", 2048),
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )

                if response.status_code != 200:
                    error_text = response.text
                    raise LLMError(f"Groq API error ({response.status_code}): {error_text}")

                result = response.json()
                content = result["choices"][0]["message"]["content"]

                if not content:
                    raise LLMError("Empty response from Groq API")

                return content

        except LLMError:
            raise
        except Exception as exc:
            logger.error(f"Groq generation failed: {exc}")
            raise LLMError(f"Failed to generate with Groq: {exc}")


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
    Factory function to create the appropriate LLM client with fallback support.

    Args:
        settings: Application settings

    Returns:
        LLMClient instance or None if LLM not configured
    """
    provider = settings.llm_provider.lower()

    # Try primary provider
    if provider == "groq":
        if settings.groq_api_key:
            logger.info("Using Groq as primary LLM provider")
            return GroqClient(settings)
        else:
            logger.warning("Groq selected but API key not configured, trying fallback")

    # Handle "gemini" or model names starting with "gemini-"
    if provider == "gemini" or provider.startswith("gemini-"):
        if settings.gemini_api_key:
            logger.info("Using Gemini as primary LLM provider")
            return GeminiClient(settings)
        else:
            logger.warning("Gemini selected but API key not configured, trying fallback")

    if provider == "mock":
        logger.info("Using mock LLM client for testing")
        return MockLLMClient()

    # Fallback chain: Try Groq -> Gemini
    if settings.groq_api_key and provider != "groq":
        logger.info("Using Groq as fallback LLM provider")
        return GroqClient(settings)

    if settings.gemini_api_key and provider != "gemini":
        logger.info("Using Gemini as fallback LLM provider")
        return GeminiClient(settings)

    logger.warning(f"No LLM provider available (requested: {provider})")
    return None
