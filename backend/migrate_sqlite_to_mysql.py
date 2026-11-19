"""
Script de migração / transferência completa do banco local (slc_digital_local.db)
para o servidor SGBD MySQL de Homologação (configurado em backend/.env).
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.config import (
    DB_CHARSET,
    DB_HOST,
    DB_NAME,
    DB_PORT,
    MYSQL_DATABASE_URL,
    MYSQL_SERVER_URL,
    SQLITE_FALLBACK_URL,
)
from app.database import Base
from app.models import (
    ConfiguracaoPainelModel,
    ContratoModel,
    HistoricoAlteracaoModel,
    ProcessoModel,
)


def garantir_colunas_mysql(mysql_engine):
    inspector = inspect(mysql_engine)
    if "contratos" not in inspector.get_table_names():
        return
    existing_cols = {c["name"] for c in inspector.get_columns("contratos")}
    new_cols = {
        "processo_pagamento": "VARCHAR(60) DEFAULT ''",
        "id_tces": "VARCHAR(80) DEFAULT ''",
        "aba_planilha": "VARCHAR(40) DEFAULT ''",
        "grupo_planilha": "VARCHAR(20) DEFAULT 'S'",
        "razao_social": "VARCHAR(255) DEFAULT ''",
        "objeto_completo": "TEXT",
        "modalidade_contratacao": "VARCHAR(40) DEFAULT ''",
        "total_gasto": "FLOAT DEFAULT 0.0",
        "media_mensal": "FLOAT DEFAULT 0.0",
        "reforco_empenho": "VARCHAR(60) DEFAULT ''",
        "valor_rpps": "FLOAT DEFAULT 0.0",
        "ne_rpps": "VARCHAR(120) DEFAULT ''",
        "valor_fps": "FLOAT DEFAULT 0.0",
        "ne_fps": "VARCHAR(120) DEFAULT ''",
        "duracao_mm_max": "VARCHAR(30) DEFAULT ''",
        "data_duracao_maxima": "VARCHAR(20) DEFAULT ''",
        "optante_simples": "VARCHAR(10) DEFAULT 'N'",
        "regra_pagamento": "VARCHAR(30) DEFAULT ''",
        "retencao_ir": "VARCHAR(15) DEFAULT ''",
        "modalidade_garantia": "VARCHAR(40) DEFAULT ''",
        "validade_garantia": "VARCHAR(40) DEFAULT ''",
        "gestor_suplente": "VARCHAR(140) DEFAULT ''",
        "fiscais_adicionais": "TEXT",
        "cnds_json": "TEXT",
        "sancao_ceis": "VARCHAR(255) DEFAULT 'Nada Consta'",
        "execucao_mensal_json": "MEDIUMTEXT",
        "dados_2025_json": "MEDIUMTEXT",
        "preposto_contato": "VARCHAR(255) DEFAULT ''",
        "email_contratada": "VARCHAR(180) DEFAULT ''",
    }
    with mysql_engine.begin() as conn:
        for col_name, col_def in new_cols.items():
            if col_name not in existing_cols:
                conn.execute(
                    text(f"ALTER TABLE contratos ADD COLUMN {col_name} {col_def}")
                )
        try:
            conn.execute(
                text(
                    "ALTER TABLE contratos "
                    "MODIFY COLUMN numero_contrato VARCHAR(60) NOT NULL, "
                    "MODIFY COLUMN numero_edocs VARCHAR(60) NOT NULL, "
                    "MODIFY COLUMN empresa_contratada VARCHAR(220) NOT NULL, "
                    "MODIFY COLUMN cnpj VARCHAR(60) NOT NULL, "
                    "MODIFY COLUMN modalidade_contratacao VARCHAR(60) DEFAULT '', "
                    "MODIFY COLUMN valor_global DECIMAL(15, 2) NOT NULL DEFAULT 0.00, "
                    "MODIFY COLUMN total_gasto DECIMAL(15, 2) DEFAULT 0.00, "
                    "MODIFY COLUMN saldo_disponivel DECIMAL(15, 2) NOT NULL DEFAULT 0.00, "
                    "MODIFY COLUMN media_mensal DECIMAL(15, 2) DEFAULT 0.00, "
                    "MODIFY COLUMN valor_rpps DECIMAL(15, 2) DEFAULT 0.00, "
                    "MODIFY COLUMN ne_rpps VARCHAR(255) DEFAULT '', "
                    "MODIFY COLUMN valor_fps DECIMAL(15, 2) DEFAULT 0.00, "
                    "MODIFY COLUMN ne_fps VARCHAR(255) DEFAULT '', "
                    "MODIFY COLUMN optante_simples VARCHAR(30) DEFAULT 'N', "
                    "MODIFY COLUMN retencao_ir VARCHAR(60) DEFAULT '', "
                    "MODIFY COLUMN gestor_contrato VARCHAR(140) NOT NULL, "
                    "MODIFY COLUMN fiscal_titular VARCHAR(140) NOT NULL, "
                    "MODIFY COLUMN fiscal_suplente VARCHAR(140) NOT NULL, "
                    "MODIFY COLUMN cnds_json MEDIUMTEXT, "
                    "MODIFY COLUMN execucao_mensal_json MEDIUMTEXT, "
                    "MODIFY COLUMN dados_2025_json MEDIUMTEXT"
                )
            )
            if "processos" in inspector.get_table_names():
                conn.execute(
                    text(
                        "ALTER TABLE processos "
                        "MODIFY COLUMN numero_edocs VARCHAR(60) NOT NULL"
                    )
                )
        except Exception:
            pass


def migrar_sqlite_para_mysql():
    if not MYSQL_DATABASE_URL:
        raise RuntimeError(
            "MYSQL_DATABASE_URL não configurada. Verifique o arquivo backend/.env."
        )

    print(f"[1/4] Conectando ao banco local de origem: {SQLITE_FALLBACK_URL}")
    sqlite_engine = create_engine(
        SQLITE_FALLBACK_URL, connect_args={"check_same_thread": False}
    )
    SqliteSession = sessionmaker(bind=sqlite_engine)

    print(
        f"[2/4] Conectando ao SGBD MySQL de destino: {DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    if MYSQL_SERVER_URL and DB_NAME:
        try:
            srv_engine = create_engine(MYSQL_SERVER_URL, pool_pre_ping=True)
            with srv_engine.begin() as conn:
                conn.execute(
                    text(
                        f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                        f"CHARACTER SET {DB_CHARSET} COLLATE {DB_CHARSET}_unicode_ci;"
                    )
                )
            srv_engine.dispose()
        except Exception as exc:
            print(f"      (Aviso ao verificar CREATE DATABASE: {exc})")

    mysql_engine = create_engine(MYSQL_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.create_all(bind=mysql_engine)
    garantir_colunas_mysql(mysql_engine)
    MysqlSession = sessionmaker(bind=mysql_engine)

    sqlite_db = SqliteSession()
    mysql_db = MysqlSession()

    try:
        print("[3/4] Lendo registros do banco local e transferindo para o MySQL...")

        # 1. Contratos
        contratos_locais = sqlite_db.query(ContratoModel).all()
        cols_contrato = [c.name for c in ContratoModel.__table__.columns]
        for c_loc in contratos_locais:
            dados = {col: getattr(c_loc, col, None) for col in cols_contrato}
            mysql_db.merge(ContratoModel(**dados))

        # 2. Processos
        processos_locais = sqlite_db.query(ProcessoModel).all()
        cols_processo = [c.name for c in ProcessoModel.__table__.columns]
        for p_loc in processos_locais:
            dados = {col: getattr(p_loc, col, None) for col in cols_processo}
            mysql_db.merge(ProcessoModel(**dados))

        # 3. Histórico de Alterações
        historicos_locais = sqlite_db.query(HistoricoAlteracaoModel).all()
        cols_hist = [c.name for c in HistoricoAlteracaoModel.__table__.columns]
        for h_loc in historicos_locais:
            dados = {col: getattr(h_loc, col, None) for col in cols_hist}
            mysql_db.merge(HistoricoAlteracaoModel(**dados))

        # 4. Configuração do Painel / Modo TV
        configs_locais = sqlite_db.query(ConfiguracaoPainelModel).all()
        cols_cfg = [c.name for c in ConfiguracaoPainelModel.__table__.columns]
        if configs_locais:
            for cfg_loc in configs_locais:
                dados = {col: getattr(cfg_loc, col, None) for col in cols_cfg}
                mysql_db.merge(ConfiguracaoPainelModel(**dados))
        else:
            mysql_db.merge(ConfiguracaoPainelModel(id=1))

        mysql_db.commit()

        # 5. Verificação final direto no MySQL
        total_c = mysql_db.query(ContratoModel).count()
        total_p = mysql_db.query(ProcessoModel).count()
        total_h = mysql_db.query(HistoricoAlteracaoModel).count()
        total_cfg = mysql_db.query(ConfiguracaoPainelModel).count()

        with mysql_engine.connect() as conn:
            versao_mysql = conn.execute(text("SELECT VERSION()")).scalar()
            db_atual = conn.execute(text("SELECT DATABASE()")).scalar()

        print("[4/4] Transferência concluída com sucesso!")
        print("=" * 65)
        print(f"  Servidor MySQL : {DB_HOST}:{DB_PORT} (Versão: {versao_mysql})")
        print(f"  Banco Ativo    : {db_atual}")
        print(f"  -> contratos             : {total_c} registros no MySQL")
        print(f"  -> processos             : {total_p} registros no MySQL")
        print(f"  -> historico_alteracoes  : {total_h} registros no MySQL")
        print(f"  -> configuracao_painel   : {total_cfg} registro(s) no MySQL")
        print("=" * 65)
    finally:
        sqlite_db.close()
        mysql_db.close()


if __name__ == "__main__":
    migrar_sqlite_para_mysql()
