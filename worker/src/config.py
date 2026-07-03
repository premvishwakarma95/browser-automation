"""Loads environment variables into a typed config object."""

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes")


@dataclass
class Config:
    # Supabase (this project's OWN, separate database)
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_service_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # MiniMax (OpenAI-compatible)
    minimax_api_key: str = os.getenv("MINIMAX_API_KEY", "")
    minimax_base_url: str = os.getenv("MINIMAX_BASE_URL", "https://api.minimax.io/v1")
    minimax_model: str = os.getenv("MINIMAX_MODEL", "")

    # cloakbrowser
    cloak_license_key: str = os.getenv("CLOAK_LICENSE_KEY", "")
    cloak_humanize: bool = _bool("CLOAK_HUMANIZE", True)
    cloak_geoip: bool = _bool("CLOAK_GEOIP", True)
    proxy_url: str = os.getenv("PROXY_URL", "")

    # Runtime
    headless: bool = _bool("HEADLESS", False)
    screenshot_dir: str = os.getenv("SCREENSHOT_DIR", "./screenshots")
    poll_interval: int = int(os.getenv("POLL_INTERVAL_SECONDS", "5"))
    # When true, skip the real browser agent and return a canned draft.
    # Lets us test the DB job loop without driving a real portal.
    mock_agent: bool = _bool("MOCK_AGENT", False)

    def missing(self) -> list[str]:
        """Return the names of required-but-empty settings."""
        required = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_key,
            "MINIMAX_API_KEY": self.minimax_api_key,
            "MINIMAX_MODEL": self.minimax_model,
        }
        return [k for k, v in required.items() if not v]


config = Config()
