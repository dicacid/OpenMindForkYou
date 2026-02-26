"""LLM Integration - Supports OpenRouter and all major providers"""
import os
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

# Available models configuration
AVAILABLE_MODELS = {
    "openai": {
        "models": [
            "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-5-nano",
            "gpt-4", "gpt-4o", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
            "o3", "o3-pro", "o4-mini", "o1"
        ],
        "default": "gpt-5.1"
    },
    "anthropic": {
        "models": [
            "claude-opus-4-6", "claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001",
            "claude-opus-4-5-20251101", "claude-4-sonnet-20250514", "claude-4-opus-20250514",
            "claude-3-5-haiku-20241022"
        ],
        "default": "claude-4-sonnet-20250514"
    },
    "gemini": {
        "models": [
            "gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-2.5-pro",
            "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash",
            "gemini-2.0-flash-lite"
        ],
        "default": "gemini-2.5-pro"
    },
    "openrouter": {
        "models": [
            # Meta
            "meta-llama/llama-3.3-70b-instruct",
            "meta-llama/llama-3.2-90b-vision-instruct",
            # Mistral
            "mistralai/mistral-large-2411",
            "mistralai/mixtral-8x7b-instruct",
            # Google
            "google/gemini-pro-1.5",
            "google/gemini-flash-1.5",
            # Anthropic via OpenRouter
            "anthropic/claude-3.5-sonnet",
            "anthropic/claude-3-opus",
            # OpenAI via OpenRouter  
            "openai/gpt-4-turbo",
            "openai/gpt-4o",
            # Cohere
            "cohere/command-r-plus",
            # And many more...
        ],
        "default": "meta-llama/llama-3.3-70b-instruct"
    }
}


class OpenMindLLM:
    """Unified LLM interface supporting all providers including OpenRouter"""
    
    def __init__(self, provider: str = "openai", model: str = None, api_key: str = None):
        self.provider = provider
        self.model = model or AVAILABLE_MODELS.get(provider, {}).get("default", "gpt-5.1")
        self._env_var_name = "EMERGENT_LLM_KEY"
        
        # If explicitly provided, set it in the environment so it can be fetched dynamically.
        if api_key:
            os.environ[self._env_var_name] = api_key
        
        # Verify key exists in env
        if not os.getenv(self._env_var_name):
            raise ValueError("No API key provided and EMERGENT_LLM_KEY not set in environment")
            
    def _get_api_key(self) -> str:
        """Retrieve the API key from environment to avoid keeping it in instance memory."""
        key = os.getenv(self._env_var_name)
        if not key:
            raise ValueError("API key missing from environment")
        return key

    async def chat(self, message: str, session_id: str = "default", system_message: str = None):
        """Send a chat message and get response"""
        api_key = self._get_api_key()
        
        # For OpenRouter, we use a custom implementation
        if self.provider == "openrouter":
            return await self._chat_openrouter(message, session_id, system_message, api_key)
        
        # For other providers, use emergentintegrations
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_message or "You are OpenMind, a helpful AI assistant."
        )
        
        # Set the model and provider
        chat.with_model(self.provider, self.model)
        
        # Create user message
        user_message = UserMessage(text=message)
        
        # Send and get response
        response = await chat.send_message(user_message)
        
        # Ensure we don't accidentally keep a reference to the API key
        del api_key 
        
        return response
    
    async def _chat_openrouter(self, message: str, session_id: str, system_message: str, api_key: str):
        """Handle OpenRouter API calls"""
        import aiohttp
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://openmind.ai",
            "X-Title": "OpenMind"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": system_message or "You are OpenMind, a helpful AI assistant."
                },
                {
                    "role": "user",
                    "content": message
                }
            ]
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    error_text = await response.text()
                    raise Exception(f"OpenRouter API error: {error_text}")
    
    @staticmethod
    def get_available_models(provider: str = None):
        """Get list of available models for a provider"""
        if provider:
            return AVAILABLE_MODELS.get(provider, {}).get("models", [])
        return AVAILABLE_MODELS
    
    @staticmethod
    def get_all_providers():
        """Get list of all supported providers"""
        return list(AVAILABLE_MODELS.keys())
