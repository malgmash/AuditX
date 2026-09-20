"""Settings, read from the environment or analysis/.env."""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


PRISMA_ONLY_PARAMS = {"schema", "connection_limit", "pool_timeout", "pgbouncer", "connect_timeout"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The same variable the web service uses, so both services read one database.
    database_url: str = "postgresql://auditx:auditx@localhost:5432/auditx?schema=public"
    # Shared secret the web service sends to the internal endpoints.
    internal_token: str = "dev-internal-token"
    org_id: str = "org_auditx_demo"

    s3_endpoint: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key: str = "auditx"
    s3_secret_key: str = "auditx-dev-secret"
    s3_bucket: str = "receipts"

    # Models. The hosted NIM API is OpenAI wire compatible, so one client serves both.
    # With no key set, the offline providers in app/llm take over: the demo runs with the
    # network unplugged, which is also how the tests run.
    nvidia_api_key: str = ""
    nim_base_url: str = "https://integrate.api.nvidia.com/v1"
    embedding_model: str = "nvidia/nv-embedqa-e5-v5"
    answer_model: str = "nvidia/nemotron-3-super-120b-a12b"
    answer_temperature: float = 0.3
    # nv-embedqa-e5-v5 returns 1024 dimensions. Changing the model means changing this and
    # the vector(N) column in web/prisma/schema.prisma together, then reindexing.
    embedding_dim: int = 1024
    model_timeout_seconds: float = 20.0

    # Retrieval. Four passages, and nothing below the similarity floor: an answer with no
    # passage says the material does not cover the question, which is the honest answer.
    retrieval_top_k: int = 4
    retrieval_min_similarity: float = 0.30
    # A question is one turn and no conversation is kept, so a long one is either an essay
    # or an injection attempt.
    ask_max_question_chars: int = 500
    ask_rate_limit_per_minute: int = 10
    ask_cache_size: int = 512

    @property
    def sqlalchemy_url(self) -> str:
        """Prisma URLs carry Prisma-only parameters (?schema=, ?connection_limit=, ?pgbouncer=) and a
        bare postgresql:// scheme. SQLAlchemy needs the driver named and the driver rejects those
        parameters, so drop them."""
        parts = urlsplit(self.database_url)
        query = [(k, v) for k, v in parse_qsl(parts.query) if k not in PRISMA_ONLY_PARAMS]
        scheme = "postgresql+psycopg" if parts.scheme in ("postgresql", "postgres") else parts.scheme
        return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), ""))


settings = Settings()
