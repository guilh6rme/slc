import os
import re
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
            valor = v.strip()
            if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in ('"', "'"):
                valor = valor[1:-1]
            os.environ.setdefault(k.strip(), valor)


carregar_env_arquivo()

_IDENT_RE = re.compile(r"^[A-Za-z0-9_]+$")

# Parâmetros individuais do servidor MySQL de Homologação / Produção (GTI)
DB_HOST = os.getenv("DB_HOST", "").strip()
DB_PORT = os.getenv("DB_PORT", "3306").strip() or "3306"
DB_USER = os.getenv("DB_USER", "").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

_raw_db_name = os.getenv("DB_NAME", "slc_digital").strip() or "slc_digital"
DB_NAME = _raw_db_name if _IDENT_RE.match(_raw_db_name) else "slc_digital"

_raw_charset = os.getenv("DB_CHARSET", "utf8mb4").strip() or "utf8mb4"
DB_CHARSET = _raw_charset if _IDENT_RE.match(_raw_charset) else "utf8mb4"

# Controle de fallback para SQLite local e origens CORS permitidas
ALLOW_SQLITE_FALLBACK = (
    os.getenv("ALLOW_SQLITE_FALLBACK", "true").strip().lower() in ("1", "true", "yes", "sim")
)

_raw_cors = os.getenv("CORS_ORIGINS", "").strip()
if _raw_cors and _raw_cors != "*":
    CORS_ORIGINS = [orig.strip() for orig in _raw_cors.split(",") if orig.strip()]
    # Inclui acesso via rede local corporativa se necessário
    if "*" not in CORS_ORIGINS:
        CORS_ALLOW_ALL = False
    else:
        CORS_ALLOW_ALL = True
else:
    CORS_ORIGINS = ["*"]
    CORS_ALLOW_ALL = True

# Permite informar DATABASE_URL diretamente ou montar automaticamente via DB_HOST/DB_USER/DB_PASSWORD/DB_NAME
_database_url_direta = os.getenv("DATABASE_URL", "").strip()

if _database_url_direta:
    MYSQL_DATABASE_URL = _database_url_direta
    MYSQL_SERVER_URL = ""
elif DB_HOST and DB_USER:
    senha_encoded = quote_plus(DB_PASSWORD)
    credenciais = (
        f"{quote_plus(DB_USER)}:{senha_encoded}"
        if DB_PASSWORD
        else quote_plus(DB_USER)
    )
    MYSQL_DATABASE_URL = (
        f"mysql+pymysql://{credenciais}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset={DB_CHARSET}"
    )
    MYSQL_SERVER_URL = (
        f"mysql+pymysql://{credenciais}@{DB_HOST}:{DB_PORT}/?charset={DB_CHARSET}"
    )
else:
    MYSQL_DATABASE_URL = ""
    MYSQL_SERVER_URL = ""

SQLITE_FALLBACK_URL = (
    f"sqlite:///{(Path(__file__).resolve().parent.parent / 'slc_digital_local.db').as_posix()}"
)
