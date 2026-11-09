from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import MYSQL_DATABASE_URL, SQLITE_FALLBACK_URL

Base = declarative_base()

modo_banco_ativo = "MySQL 8+ (Padrão GTI)"
url_ativa = MYSQL_DATABASE_URL

if MYSQL_DATABASE_URL:
    try:
        engine = create_engine(
            MYSQL_DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        print(
            f"[SLC Digital] Aviso: MySQL ({MYSQL_DATABASE_URL}) indisponível ({exc}). "
            "Ativando banco relacional local para demonstração."
        )
        url_ativa = SQLITE_FALLBACK_URL
        modo_banco_ativo = "SQLAlchemy Local (Contingência Demo · Schema MySQL Ready)"
        engine = create_engine(
            url_ativa, connect_args={"check_same_thread": False}
        )
else:
    url_ativa = SQLITE_FALLBACK_URL
    modo_banco_ativo = "SQLAlchemy Local (Pronto para MySQL via DATABASE_URL)"
    engine = create_engine(
        url_ativa, connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def obter_info_banco() -> dict:
    return {
        "sgbdPadraoGti": "MySQL 8+",
        "driverSqlAlchemy": "PyMySQL (mysql+pymysql)",
        "modoAtivo": modo_banco_ativo,
        "conectadoMySqlReal": url_ativa.startswith("mysql"),
    }

