"""
Script de validação dos dados importados no servidor SGBD MySQL (10.177.10.161:3306/slc).
"""

import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import create_engine, text
from app.config import DB_HOST, DB_NAME, DB_PORT, MYSQL_DATABASE_URL


def validar_dados_mysql():
    engine = create_engine(MYSQL_DATABASE_URL, pool_pre_ping=True)
    with engine.connect() as conn:
        versao = conn.execute(text("SELECT VERSION()")).scalar()
        banco = conn.execute(text("SELECT DATABASE()")).scalar()

        qtd_contratos = conn.execute(text("SELECT COUNT(*) FROM contratos")).scalar()
        qtd_processos = conn.execute(text("SELECT COUNT(*) FROM processos")).scalar()
        qtd_config = conn.execute(text("SELECT COUNT(*) FROM configuracao_painel")).scalar()

        soma_empenhado_26 = conn.execute(
            text("SELECT ROUND(SUM(valor_global), 2) FROM contratos")
        ).scalar() or 0.0
        soma_gasto_26 = conn.execute(
            text("SELECT ROUND(SUM(total_gasto), 2) FROM contratos")
        ).scalar() or 0.0
        soma_saldo_26 = conn.execute(
            text("SELECT ROUND(SUM(saldo_disponivel), 2) FROM contratos")
        ).scalar() or 0.0

        rows_2025 = conn.execute(
            text("SELECT aba_planilha, empresa_contratada, dados_2025_json FROM contratos")
        ).fetchall()

        com_2025 = 0
        soma_gasto_25 = 0.0
        for r in rows_2025:
            try:
                d25 = json.loads(r[2] or "{}")
                if d25.get("possuiHistorico2025"):
                    com_2025 += 1
                    soma_gasto_25 += float(d25.get("totalGasto2025") or 0.0)
            except Exception:
                pass

        todos_2026 = conn.execute(
            text(
                "SELECT aba_planilha, numero_contrato, numero_edocs, processo_pagamento, "
                "empresa_contratada, valor_global, total_gasto, saldo_disponivel, ne_rpps "
                "FROM contratos ORDER BY aba_planilha"
            )
        ).fetchall()

        print("=" * 72)
        print(f" VALIDAÇÃO DO BANCO MYSQL DE HOMOLOGAÇÃO ({DB_HOST}:{DB_PORT}/{banco})")
        print("=" * 72)
        print(f" Versão MySQL            : {versao}")
        print(f" Total de Contratos      : {qtd_contratos} (Esperado: 55)")
        print(f" Total de Processos      : {qtd_processos} (Esperado: 55)")
        print(f" Contratos c/ Hist. 2025 : {com_2025} (Esperado: 42)")
        print(f" Config. Modo TV         : {qtd_config} (Esperado: 1)")
        print("-" * 72)
        print(f" Soma Empenhado (2026)   : R$ {soma_empenhado_26:,.2f}")
        print(f" Soma Gasto (2026)       : R$ {soma_gasto_26:,.2f}")
        print(f" Soma Saldo NE (2026)    : R$ {soma_saldo_26:,.2f}")
        print(f" Soma Executado (2025)   : R$ {soma_gasto_25:,.2f}")
        print("-" * 72)
        print(" Metadados de 2026 (Todos os 55 Contratos Vigentes no MySQL):")
        print(
            f"  {'ABA 26':10s} | {'CONTRATO 2026':21s} | {'PROC. PAGTO 26':15s} | {'EMPENHO 2026':>14s} | {'GASTO 2026':>14s} | {'SALDO 2026':>14s}"
        )
        print("  " + "-" * 98)
        for c26 in todos_2026:
            aba26 = str(c26[0] or "")[:10]
            cont26 = str(c26[1] or "")[:21]
            pag26 = str(c26[3] or "—")[:15]
            emp26 = float(c26[5] or 0.0)
            gst26 = float(c26[6] or 0.0)
            sld26 = float(c26[7] or 0.0)
            print(
                f"  {aba26:10s} | {cont26:21s} | {pag26:15s} | R$ {emp26:11,.2f} | R$ {gst26:11,.2f} | R$ {sld26:11,.2f}"
            )
        print("-" * 72)
        print(" Metadados de Continuidade 2025 (Extraídos do MySQL):")
        print(
            f"  {'ABA 25':10s} | {'CONTRATO 2025':21s} | {'PROC. PAGTO 25':15s} | {'EMPENHO 2025':>14s} | {'GASTO 2025':>14s} | {'NE RPPS 2025'}"
        )
        print("  " + "-" * 95)
        for r in sorted(rows_2025, key=lambda x: x[0] or ""):
            try:
                d25 = json.loads(r[2] or "{}")
                if not d25.get("possuiHistorico2025"):
                    continue
                aba25 = str(d25.get("aba2025") or r[0] or "")[:10]
                cont25 = str(d25.get("numeroContrato2025") or "")[:21]
                pag25 = str(d25.get("processoPagamento2025") or "—")[:15]
                emp25 = float(d25.get("valorEmpenhado2025") or 0.0)
                gst25 = float(d25.get("totalGasto2025") or 0.0)
                ne25 = str(d25.get("neRpps2025") or "—")[:25]
                print(
                    f"  {aba25:10s} | {cont25:21s} | {pag25:15s} | R$ {emp25:11,.2f} | R$ {gst25:11,.2f} | {ne25}"
                )
            except Exception:
                pass
        print("=" * 72)


if __name__ == "__main__":
    validar_dados_mysql()
