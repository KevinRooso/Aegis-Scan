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

    async def generate(self, prompt: str, **kwargs: Any) -> str:
        """
        Generate text using Gemini API.

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
        self._client = None

        if self.is_available():
            try:
                from groq import AsyncGroq

                self._client = AsyncGroq(api_key=settings.groq_api_key)
                logger.info("Groq LLM client initialized successfully")
            except ImportError:
                logger.error("groq library not installed")
                raise LLMError("groq library required but not installed")
            except Exception as exc:
                logger.error(f"Failed to initialize Groq client: {exc}")
                raise LLMError(f"Groq initialization failed: {exc}")

    def is_available(self) -> bool:
        """Check if Groq API key is configured."""
        return bool(self.settings.groq_api_key)

    async def generate(self, prompt: str, **kwargs: Any) -> str:
        """
        Generate text using Groq API.

        Args:
            prompt: The input prompt
            **kwargs: Additional parameters (temperature, max_tokens, etc.)

        Returns:
            Generated text response

        Raises:
            LLMError: If generation fails after retries
        """
        if not self.is_available():
            raise LLMError("Groq client not available - API key not configured")

        if not self._client:
            raise LLMError("Groq client not initialized")

        try:
            # Build messages array
            messages = [{"role": "user", "content": prompt}]

            print(f"[DEBUG] Groq: Generating with model={self.settings.groq_model}, max_tokens={kwargs.get('max_tokens', 2048)}")
            # Generate completion
            response = await self._client.chat.completions.create(
                model=self.settings.groq_model,
                messages=messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 2048),
                top_p=kwargs.get("top_p", 0.95),
            )

            print(f"[DEBUG] Groq: Got response, checking content...")
            if not response.choices or not response.choices[0].message.content:
                print(f"[DEBUG] Groq: EMPTY RESPONSE! choices={bool(response.choices)}, content={response.choices[0].message.content if response.choices else 'N/A'}")
                raise LLMError("Empty response from Groq API")

            result = response.choices[0].message.content
            print(f"[DEBUG] Groq: Success! Generated {len(result)} characters")
            return result

        except Exception as exc:
            print(f"[DEBUG] Groq: FAILED with exception: {exc}")
            logger.error(f"Groq generation failed: {exc}")
            raise LLMError(f"Failed to generate with Groq: {exc}")


class MultiLLMClient(LLMClient):
    """
    Multi-LLM client with automatic fallback.

    Tries primary LLM first, falls back to secondary on quota errors.
    """

    def __init__(self, settings: Any) -> None:
        """
        Initialize multi-LLM client with fallback.

        Args:
            settings: Application settings
        """
        self.settings = settings
        self.primary: LLMClient | None = None
        self.fallback: LLMClient | None = None

        # Initialize primary (Gemini)
        print(f"[DEBUG] Initializing MultiLLMClient - Gemini key present: {bool(settings.gemini_api_key)}, Groq key present: {bool(settings.groq_api_key)}")
        logger.info(f"Initializing MultiLLMClient - Gemini key present: {bool(settings.gemini_api_key)}, Groq key present: {bool(settings.groq_api_key)}")
        if settings.gemini_api_key:
            try:
                self.primary = GeminiClient(settings)
                logger.info("✓ Initialized Gemini as primary LLM")
            except Exception as exc:
                logger.warning(f"✗ Failed to initialize Gemini: {exc}")

        # Initialize fallback (Groq)
        if settings.groq_api_key:
            try:
                print(f"[DEBUG] Attempting to initialize Groq with model: {settings.groq_model}")
                logger.info(f"Attempting to initialize Groq with model: {settings.groq_model}")
                self.fallback = GroqClient(settings)
                print(f"[DEBUG] ✓ Initialized Groq as fallback LLM")
                logger.info("✓ Initialized Groq as fallback LLM")
            except Exception as exc:
                print(f"[DEBUG] ✗ Failed to initialize Groq: {exc}")
                logger.warning(f"✗ Failed to initialize Groq: {exc}", exc_info=True)

        logger.info(f"MultiLLMClient initialized - Primary: {type(self.primary).__name__ if self.primary else 'None'}, Fallback: {type(self.fallback).__name__ if self.fallback else 'None'}")

        if not self.primary and not self.fallback:
            raise LLMError("No LLM providers available")

    def is_available(self) -> bool:
        """Check if at least one LLM client is available."""
        return bool(self.primary or self.fallback)

    async def generate(self, prompt: str, **kwargs: Any) -> str:
        """
        Generate text with automatic fallback on quota errors.

        Args:
            prompt: The input prompt
            **kwargs: Additional parameters

        Returns:
            Generated text response

        Raises:
            LLMError: If all providers fail
        """
        if not self.is_available():
            raise LLMError("No LLM providers available")

        # Try primary first
        if self.primary:
            try:
                logger.debug("Attempting to use primary LLM (Gemini)")
                return await self.primary.generate(prompt, **kwargs)
            except Exception as exc:
                error_msg = str(exc).lower()
                # Check for quota/rate limit errors (broader match)
                is_quota_error = any(keyword in error_msg for keyword in [
                    'quota', 'rate limit', 'resource_exhausted', '429',
                    'rate_limit_exceeded', 'insufficient_quota', 'quota exceeded'
                ])

                if is_quota_error:
                    print(f"[DEBUG] QUOTA ERROR DETECTED!")
                    print(f"[DEBUG] Fallback available: {bool(self.fallback)} (type: {type(self.fallback).__name__ if self.fallback else 'None'})")
                    logger.warning(f"Primary LLM quota exceeded: {exc}")
                    logger.info(f"Fallback available: {bool(self.fallback)} (type: {type(self.fallback).__name__ if self.fallback else 'None'})")
                    if self.fallback:
                        print(f"[DEBUG] → Switching to fallback LLM (Groq)")
                        logger.info("→ Switching to fallback LLM (Groq)")
                    else:
                        print(f"[DEBUG] ERROR: No fallback LLM available!")
                        logger.error("No fallback LLM available!")
                        raise LLMError(f"Primary LLM quota exceeded and no fallback: {exc}")
                else:
                    # For other errors, also try fallback if available
                    logger.error(f"Primary LLM error: {exc}")
                    if not self.fallback:
                        raise LLMError(f"Primary LLM failed and no fallback: {exc}")

        # Try fallback
        if self.fallback:
            try:
                print(f"[DEBUG] USING FALLBACK LLM (Groq)")
                logger.info("→ Using fallback LLM (Groq)")
                return await self.fallback.generate(prompt, **kwargs)
            except Exception as exc:
                logger.error(f"Fallback LLM also failed: {exc}")
                raise LLMError(f"All LLM providers failed. Last error: {exc}")

        raise LLMError("All LLM providers failed")


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

    # Use mock for testing
    if provider == "mock":
        logger.info("Using mock LLM client for testing")
        return MockLLMClient()

    # Use MultiLLMClient for automatic fallback between Gemini and Groq
    if settings.gemini_api_key or settings.groq_api_key:
        try:
            return MultiLLMClient(settings)
        except LLMError as exc:
            logger.error(f"Failed to initialize LLM client: {exc}")
            return None

    logger.warning("No LLM API keys configured")
    return None
