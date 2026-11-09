import os
from pathlib import Path


def carregar_env_arquivo() -> None:
    """Carrega variáveis de um arquivo .env simples sem depender de pacotes externos."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


carregar_env_arquivo()

# URL padrão configurada para MySQL se informada em DATABASE_URL
MYSQL_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
SQLITE_FALLBACK_URL = (
    f"sqlite:///{(Path(__file__).resolve().parent.parent / 'slc_digital_local.db').as_posix()}"
)

