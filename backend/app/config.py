import os
from pathlib import Path
from urllib.parse import quote_plus


def carregar_env_arquivo() -> None:
    """Carrega variáveis do arquivo backend/.env (ou .env na raiz) sem depender de pacotes externos."""
    caminhos = [
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parent.parent.parent / ".env",
    ]
    for env_path in caminhos:
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            valor = v.strip().strip('"').strip("'")
            os.environ.setdefault(k.strip(), valor)


carregar_env_arquivo()

# Parâmetros individuais do servidor MySQL de Homologação / Produção (GTI)
DB_HOST = os.getenv("DB_HOST", "").strip()
DB_PORT = os.getenv("DB_PORT", "3306").strip() or "3306"
DB_USER = os.getenv("DB_USER", "").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "slc_digital").strip() or "slc_digital"
DB_CHARSET = os.getenv("DB_CHARSET", "utf8mb4").strip() or "utf8mb4"

# Permite informar DATABASE_URL diretamente ou montar automaticamente via DB_HOST/DB_USER/DB_PASSWORD/DB_NAME
_database_url_direta = os.getenv("DATABASE_URL", "").strip()

if _database_url_direta:
    MYSQL_DATABASE_URL = _database_url_direta
elif DB_HOST and DB_USER:
    senha_encoded = quote_plus(DB_PASSWORD)
    credenciais = f"{quote_plus(DB_USER)}:{senha_encoded}" if DB_PASSWORD else quote_plus(DB_USER)
    MYSQL_DATABASE_URL = (
        f"mysql+pymysql://{credenciais}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset={DB_CHARSET}"
    )
    # URL administrativa sem o nome do banco para permitir CREATE DATABASE IF NOT EXISTS se necessário
    MYSQL_SERVER_URL = (
        f"mysql+pymysql://{credenciais}@{DB_HOST}:{DB_PORT}/?charset={DB_CHARSET}"
    )
else:
    MYSQL_DATABASE_URL = ""
    MYSQL_SERVER_URL = ""

if _database_url_direta and "MYSQL_SERVER_URL" not in globals():
    MYSQL_SERVER_URL = ""

SQLITE_FALLBACK_URL = (
    f"sqlite:///{(Path(__file__).resolve().parent.parent / 'slc_digital_local.db').as_posix()}"
)
