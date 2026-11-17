from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import (
    DB_CHARSET,
    DB_HOST,
    DB_NAME,
    DB_PORT,
    MYSQL_DATABASE_URL,
    MYSQL_SERVER_URL,
    SQLITE_FALLBACK_URL,
)

Base = declarative_base()

modo_banco_ativo = "MySQL 8+ (Homologação GTI)"
url_ativa = MYSQL_DATABASE_URL

if MYSQL_DATABASE_URL:
    try:
        # Tenta garantir a criação do schema caso o usuário MySQL tenha permissão CREATE DATABASE
        if MYSQL_SERVER_URL and DB_NAME:
            try:
                server_engine = create_engine(MYSQL_SERVER_URL, pool_pre_ping=True)
                with server_engine.begin() as conn:
                    conn.execute(
                        text(
                            f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                            f"CHARACTER SET {DB_CHARSET} COLLATE {DB_CHARSET}_unicode_ci;"
                        )
                    )
                server_engine.dispose()
            except Exception:
                # Se o banco já existir e o usuário tiver acesso apenas ao schema específico, segue normalmente
                pass

        engine = create_engine(
            MYSQL_DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        host_info = f"{DB_HOST}:{DB_PORT}/{DB_NAME}" if DB_HOST else "MySQL Conectado"
        modo_banco_ativo = f"MySQL Homologação ({host_info})"
    except Exception as exc:
        print(
            f"[SLC Digital] Aviso: MySQL indisponível ({exc}). "
            "Ativando banco relacional local para contingência."
        )
        url_ativa = SQLITE_FALLBACK_URL
        modo_banco_ativo = "SQLAlchemy Local (Contingência · Verifique credenciais MySQL no .env)"
        engine = create_engine(
            url_ativa, connect_args={"check_same_thread": False}
        )
else:
    url_ativa = SQLITE_FALLBACK_URL
    modo_banco_ativo = "SQLAlchemy Local (Aguardando configuração MySQL em backend/.env)"
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
