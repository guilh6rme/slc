import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import (
    ALLOW_SQLITE_FALLBACK,
    DB_CHARSET,
    DB_HOST,
    DB_NAME,
    DB_PORT,
    MYSQL_DATABASE_URL,
    MYSQL_SERVER_URL,
    SQLITE_FALLBACK_URL,
)

logger = logging.getLogger("slc_digital")

Base = declarative_base()

modo_banco_ativo = "MySQL (Homologação GTI)"
versao_sgbd_ativa = "MySQL"
url_ativa = MYSQL_DATABASE_URL

if MYSQL_DATABASE_URL:
    try:
        if MYSQL_SERVER_URL and DB_NAME:
            try:
                server_engine = create_engine(
                    MYSQL_SERVER_URL,
                    pool_pre_ping=True,
                    connect_args={"connect_timeout": 5},
                )
                with server_engine.begin() as conn:
                    conn.execute(
                        text(
                            f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                            f"CHARACTER SET {DB_CHARSET} COLLATE {DB_CHARSET}_unicode_ci;"
                        )
                    )
                server_engine.dispose()
            except Exception:
                pass

        engine = create_engine(
            MYSQL_DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=1800,
            pool_size=10,
            max_overflow=10,
            pool_timeout=15,
            pool_use_lifo=True,
            connect_args={
                "connect_timeout": 5,
                "read_timeout": 30,
                "write_timeout": 30,
                "charset": DB_CHARSET,
            },
        )
        with engine.connect() as conn:
            v_str = conn.execute(text("SELECT VERSION()")).scalar()
            if v_str:
                versao_sgbd_ativa = f"MySQL {v_str}"
        host_info = f"{DB_HOST}:{DB_PORT}/{DB_NAME}" if DB_HOST else "MySQL Conectado"
        modo_banco_ativo = f"MySQL Homologação ({host_info})"
    except Exception as exc:
        if "engine" in locals():
            try:
                engine.dispose()
            except Exception:
                pass
        if not ALLOW_SQLITE_FALLBACK:
            raise RuntimeError(
                f"Falha crítica ao conectar ao SGBD MySQL ({DB_HOST}:{DB_PORT}/{DB_NAME}) "
                "e ALLOW_SQLITE_FALLBACK=false."
            ) from exc
        logger.warning(
            "[SLC Digital] MySQL indisponível (%s). Ativando banco local de contingência.",
            type(exc).__name__,
        )
        url_ativa = SQLITE_FALLBACK_URL
        versao_sgbd_ativa = "SQLite 3 (Contingência Local)"
        modo_banco_ativo = "SQLAlchemy Local (Contingência · Verifique conexão MySQL)"
        engine = create_engine(
            url_ativa, connect_args={"check_same_thread": False}
        )
else:
    url_ativa = SQLITE_FALLBACK_URL
    versao_sgbd_ativa = "SQLite 3 (Local)"
    modo_banco_ativo = "SQLAlchemy Local (Aguardando configuração MySQL em backend/.env)"
    engine = create_engine(
        url_ativa, connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def obter_info_banco() -> dict:
    return {
        "sgbdPadraoGti": versao_sgbd_ativa,
        "driverSqlAlchemy": "PyMySQL (mysql+pymysql)" if url_ativa.startswith("mysql") else "SQLite",
        "modoAtivo": modo_banco_ativo,
        "conectadoMySqlReal": url_ativa.startswith("mysql"),
    }
