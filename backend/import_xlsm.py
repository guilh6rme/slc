import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.database import SessionLocal, engine, Base
from app.models import ContratoModel, ProcessoModel, HistoricoAlteracaoModel
from app.main import _ensure_contrato_columns

DEFAULT_XLSM = r"C:/Users/guilherme.pereira/.gemini/antigravity/brain/36b88611-ad7d-45d8-a1fd-9d9ec3793595/.user_uploaded/media_1793892475851_714b6e40.xlsm"

MODALIDADES_MAP = {
    "I": "Inexigibilidade (I)",
    "D": "Dispensa (D)",
    "P": "Pregão Eletrônico (P)",
    "p": "Pregão Eletrônico (P)",
    "RP": "Ata de Registro de Preços (RP)",
    "C": "Credenciamento (C)",
    "CO": "Concorrência (CO)",
    "CC": "Cessão / Convênio (CC)",
}

SETORES_MAP = {
    "GTI": "GTI — Gerência de Tecnologia da Informação",
    "SAG": "SAG — Subgerência Administrativa Geral",
    "SRH": "SRH — Subgerência de Recursos Humanos",
    "GJP": "GJP — Gerência Jurídica Previdenciária",
    "GAD": "GAD — Gerência Administrativa",
    "GPMS": "GPMS — Gerência de Perícia Médica e Social",
    "DIN": "DIN — Diretoria de Investimentos",
    "GFI": "GFI — Gerência Financeira",
    "GGA": "GGA — Gerência de Gestão Atuarial",
    "SCP": "SCP — Subgerência de Contabilidade / Compensação",
    "SSE": "SSE — Subgerência de Serviços Especiais",
    "UGP": "UGP — Unidade de Gestão de Projetos",
    "SLC": "SLC — Subgerência de Licitações e Contratos",
    "CPAD": "CPAD — Coord. de Protocolo e Acervo Documental",
    "DMS": "DMS — Diretoria / Concurso",
    "SAR": "SAR — Subgerência de Arrecadação",
}


def excel_serial_to_iso(val: str) -> str:
    if not val:
        return ""
    s = str(val).strip()
    if s in (".", "-", "*", "0", "#N/A", "#VALUE!"):
        return ""
    try:
        num = int(float(s))
        if 30000 <= num <= 80000:
            dt = datetime(1899, 12, 30) + timedelta(days=num)
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass
    return s


def parse_float(val: str) -> float:
    if not val:
        return 0.0
    s = str(val).strip()
    if s in (".", "-", "*", "#N/A", "#VALUE!", "#DIV/0!", "encerrado"):
        return 0.0
    try:
        return round(float(s), 2)
    except Exception:
        return 0.0


def clean_str(val: str) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    if s in ("0", ".", "#N/A", "#VALUE!", "None"):
        return ""
    return s


def importar_planilha_xlsm(xlsm_path: str = DEFAULT_XLSM):
    if not os.path.exists(xlsm_path):
        raise FileNotFoundError(f"Arquivo XLSM não encontrado: {xlsm_path}")

    Base.metadata.create_all(bind=engine)
    _ensure_contrato_columns()

    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
          "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

    with zipfile.ZipFile(xlsm_path, "r") as z:
        ss_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        shared_strings = []
        for si in ss_root.findall("main:si", ns):
            texts = [t.text for t in si.findall(".//main:t", ns) if t.text]
            shared_strings.append("".join(texts))

        wb_root = ET.fromstring(z.read("xl/workbook.xml"))
        rels_root = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels_root}

        sheet_files = {}
        for sh in wb_root.findall(".//main:sheets/main:sheet", ns):
            name = sh.attrib.get("name")
            rid = sh.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rel_map.get(rid, "")
            if not target.startswith("xl/"):
                target = "xl/" + target
            sheet_files[name] = target

        def read_sheet_dict(sheet_name):
            target = sheet_files.get(sheet_name)
            if not target or target not in z.namelist():
                return {}, {}
            root = ET.fromstring(z.read(target))
            rows_val = {}
            rows_form = {}
            for r in root.findall(".//main:sheetData/main:row", ns):
                r_idx = int(r.attrib.get("r", 0))
                c_vals = {}
                c_forms = {}
                for c in r.findall("main:c", ns):
                    col = "".join([ch for ch in c.attrib.get("r", "") if ch.isalpha()])
                    c_type = c.attrib.get("t")
                    v_el = c.find("main:v", ns)
                    f_el = c.find("main:f", ns)
                    val = v_el.text if v_el is not None else ""
                    if c_type == "s" and val.isdigit():
                        val = shared_strings[int(val)]
                    if val != "":
                        c_vals[col] = val
                    if f_el is not None and f_el.text:
                        c_forms[col] = f_el.text
                rows_val[r_idx] = c_vals
                rows_form[r_idx] = c_forms
            return rows_val, rows_form

        geral_vals, geral_forms = read_sheet_dict("geral")
        vigentes_vals, _ = read_sheet_dict("vigentes")

        # Mapear ordem da aba 'vigentes' por (Empresa, Contrato)
        ordem_vigentes = {}
        for r_idx in range(3, 58):
            row = vigentes_vals.get(r_idx, {})
            emp = clean_str(row.get("D", ""))
            cont = clean_str(row.get("E", ""))
            seq = clean_str(row.get("A", ""))
            if emp:
                ordem_vigentes[(emp, cont)] = int(seq) if seq.isdigit() else r_idx

        db = SessionLocal()
        try:
            # Limpa contratos e processos anteriores para sincronizar com a planilha real
            db.query(ContratoModel).delete()
            db.query(HistoricoAlteracaoModel).delete()
            db.query(ProcessoModel).delete()
            db.commit()

            contratos_importados = []
            processos_importados = []

            for r_idx in range(2, 69):
                g_row = geral_vals.get(r_idx, {})
                g_form = geral_forms.get(r_idx, {})
                if not g_row:
                    continue

                grupo = clean_str(g_row.get("DO", ""))  # S, S2, S5, Z
                empresa_curta = clean_str(g_row.get("C", ""))
                # Descobrir o nome da aba individual a partir da fórmula da coluna A (ex: 'DIO25'!$B$8 ou ABC!$B$8)
                form_a = g_form.get("A", "")
                aba_nome = ""
                if "!" in form_a:
                    aba_nome = form_a.split("!")[0].strip("'")

                # Pular slots reserva vazios (MED4, MED5, Z23..Z27)
                if aba_nome in ("MED4", "MED5", "Z23", "Z24", "Z25", "Z26", "Z27"):
                    continue
                if grupo == "Z":
                    # Só importamos os contratos vigentes (S, S2, S5) conforme aba principal 'vigentes'
                    continue

                # Ler aba individual do contrato para pegar RPPS/FPS, portarias e detalhes extras
                ind_vals, _ = read_sheet_dict(aba_nome) if aba_nome else ({}, {})

                num_contrato = clean_str(g_row.get("B", "")) or "S/N"
                proc_pagto = clean_str(g_row.get("A", ""))
                proc_mae = clean_str(g_row.get("AA", "")) or proc_pagto or "S/N"
                id_tces = clean_str(g_row.get("DD", ""))
                razao_social = clean_str(g_row.get("DS", "")) or empresa_curta
                cnpj_raw = clean_str(g_row.get("AC", "")) or "Não informado"
                objeto_resumo = clean_str(g_row.get("AP", "")) or empresa_curta
                objeto_completo = clean_str(g_row.get("DT", "")) or objeto_resumo

                mod_sigla = clean_str(g_row.get("AS", "")).upper()
                modalidade_txt = MODALIDADES_MAP.get(mod_sigla, mod_sigla or "Não informada")

                setor_sigla = clean_str(g_row.get("DA", "")) or "SLC"
                setor_nome = SETORES_MAP.get(setor_sigla, f"{setor_sigla} — IPAJM")

                empenho_total = parse_float(g_row.get("D", "0"))
                total_gasto = parse_float(g_row.get("E", "0"))
                saldo_empenho = parse_float(g_row.get("F", "0"))
                media_mensal = parse_float(g_row.get("V", "0"))

                ref_raw = g_row.get("G", "")
                if clean_str(ref_raw) == "encerrado":
                    reforco_str = "Encerrado"
                else:
                    ref_val = parse_float(ref_raw)
                    reforco_str = f"R$ {ref_val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

                # Extrair RPPS e FPS da aba individual (linhas 9, 10, 11, 12)
                row9 = ind_vals.get(9, {})
                row10 = ind_vals.get(10, {})
                row11 = ind_vals.get(11, {})
                row12 = ind_vals.get(12, {})
                vlr_rpps = round(sum(parse_float(row9.get(col, "0")) for col in ("B", "C", "D", "E", "F")), 2)
                ne_rpps_list = [clean_str(row10.get(col, "")) for col in ("B", "C", "D", "E", "F") if clean_str(row10.get(col, ""))]
                ne_rpps = " / ".join(ne_rpps_list)

                vlr_fps = round(sum(parse_float(row11.get(col, "0")) for col in ("B", "C", "D", "E", "F")), 2)
                ne_fps_list = [clean_str(row12.get(col, "")) for col in ("B", "C", "D", "E", "F") if clean_str(row12.get(col, ""))]
                ne_fps = " / ".join(ne_fps_list)

                inicio_iso = excel_serial_to_iso(g_row.get("H", "")) or "2025-01-01"
                termino_iso = excel_serial_to_iso(g_row.get("I", "")) or "2026-12-31"
                duracao_mm = clean_str(g_row.get("AT", ""))
                dur_max_iso = excel_serial_to_iso(g_row.get("AU", ""))

                prorrogavel_flag = clean_str(g_row.get("DQ", "P")) == "P"
                opt_simples = clean_str(g_row.get("DP", "N")) or "N"
                regra_pagto = clean_str(g_row.get("DB", ""))
                retencao_ir = clean_str(g_row.get("DC", ""))

                # Garantia
                garantia_raw = clean_str(g_row.get("AQ", ""))
                mod_garantia = clean_str(g_row.get("AR", ""))
                validade_garantia_iso = excel_serial_to_iso(garantia_raw)

                if mod_garantia == "NASC":
                    status_garantia = "Isento / Não Exigida"
                    validade_garantia_str = f"CRM {garantia_raw}" if garantia_raw and garantia_raw != "*" else "Credenciado PF/PJ"
                elif not garantia_raw or garantia_raw in ("-", "*") and not mod_garantia:
                    status_garantia = "Isento / Não Exigida"
                    validade_garantia_str = "Não exigida"
                else:
                    validade_garantia_str = validade_garantia_iso or garantia_raw
                    # Verifica se garantia já venceu ou vence em <= 60 dias
                    status_garantia = "Vigente"
                    if validade_garantia_iso and len(validade_garantia_iso) == 10:
                        try:
                            dt_gar = datetime.strptime(validade_garantia_iso, "%Y-%m-%d")
                            if (dt_gar - datetime.now()).days <= 45:
                                status_garantia = "Pendente de Renovação"
                        except Exception:
                            pass

                gestor = clean_str(g_row.get("X", "")) or "Não designado"
                gestor_sup = clean_str(g_row.get("Y", "")) or "—"
                fiscal_tit = clean_str(g_row.get("W", "")) or "Não designado"
                fiscal_sup = clean_str(g_row.get("DE", "")) or "—"

                fiscais_extras = []
                for col_f in ("DF", "DG", "DH", "DI", "DJ", "DK", "DL", "DM"):
                    f_nome = clean_str(g_row.get(col_f, ""))
                    if f_nome:
                        fiscais_extras.append(f_nome)
                fiscais_adicionais_str = "; ".join(fiscais_extras)

                # 6 CNDs (Municipal, Estadual ES, Estadual, Federal, Trabalhista, FGTS)
                cnds_dict = {
                    "municipal": {"validade": excel_serial_to_iso(g_row.get("AD", "")), "pecaEdocs": clean_str(g_row.get("AE", ""))},
                    "estadual_es": {"validade": excel_serial_to_iso(g_row.get("AF", "")), "pecaEdocs": clean_str(g_row.get("AG", ""))},
                    "estadual": {"validade": excel_serial_to_iso(g_row.get("AH", "")), "pecaEdocs": clean_str(g_row.get("AI", ""))},
                    "federal": {"validade": excel_serial_to_iso(g_row.get("AJ", "")), "pecaEdocs": clean_str(g_row.get("AK", ""))},
                    "trabalhista": {"validade": excel_serial_to_iso(g_row.get("AL", "")), "pecaEdocs": clean_str(g_row.get("AM", ""))},
                    "fgts": {"validade": excel_serial_to_iso(g_row.get("AN", "")), "pecaEdocs": clean_str(g_row.get("AO", ""))},
                }

                # CEIS
                cat_sancao = clean_str(g_row.get("CV", ""))
                abr_sancao = clean_str(g_row.get("CW", ""))
                dt_sancao = excel_serial_to_iso(g_row.get("CX", ""))
                if cat_sancao:
                    sancao_ceis_str = f"ALERTA CEIS: {cat_sancao} ({abr_sancao}) até {dt_sancao}"
                else:
                    sancao_ceis_str = "Nada Consta (CEIS/CGU Regular)"

                # Execução mensal Jan..Dez
                meses_cols = [
                    ("Jan", "J", "AV", "AW"),
                    ("Fev", "K", "AZ", "BA"),
                    ("Mar", "L", "BD", "BE"),
                    ("Abr", "M", "BH", "BI"),
                    ("Mai", "N", "BL", "BM"),
                    ("Jun", "O", "BP", "BQ"),
                    ("Jul", "P", "BT", "BU"),
                    ("Ago", "Q", "BX", "BY"),
                    ("Set", "R", "CB", "CC"),
                    ("Out", "S", "CF", "CG"),
                    ("Nov", "T", "CJ", "CK"),
                    ("Dez", "U", "CN", "CO"),
                ]
                execucao_mensal = []
                for m_nome, col_vlr, col_nf, col_obs in meses_cols:
                    vlr_m = parse_float(g_row.get(col_vlr, "0"))
                    nf_m = clean_str(g_row.get(col_nf, ""))
                    obs_m = clean_str(g_row.get(col_obs, ""))
                    execucao_mensal.append({
                        "mes": m_nome,
                        "valor": vlr_m,
                        "nf": nf_m,
                        "medicao": obs_m,
                    })

                ta_str = clean_str(g_row.get("CY", ""))
                apo_str = clean_str(g_row.get("CZ", ""))
                termos = []
                if ta_str:
                    termos.append(f"Termo Aditivo: {ta_str}")
                if apo_str:
                    termos.append(f"Apostilamento: {apo_str}")
                ultimo_termo_str = " | ".join(termos) if termos else "Contrato Original"

                row64 = ind_vals.get(64, {})
                peca_desig = clean_str(row64.get("C", ""))
                dt_desig = excel_serial_to_iso(row64.get("B", ""))
                portaria_str = f"Peça E-Docs #{peca_desig}" if peca_desig else (f"Desig. {dt_desig}" if dt_desig else "Designação no Processo")

                preposto = clean_str(g_row.get("CU", ""))
                telefones = clean_str(g_row.get("CS", ""))
                preposto_full = f"{preposto} ({telefones})" if preposto and telefones else (preposto or telefones)
                email_emp = clean_str(g_row.get("CT", ""))

                contrato_id = f"cont-{aba_nome.lower() if aba_nome else r_idx}"
                modelo = ContratoModel(
                    id=contrato_id,
                    numero_contrato=num_contrato,
                    numero_edocs=proc_mae,
                    processo_pagamento=proc_pagto,
                    id_tces=id_tces,
                    aba_planilha=aba_nome,
                    grupo_planilha=grupo or "S",
                    empresa_contratada=empresa_curta,
                    razao_social=razao_social,
                    cnpj=cnpj_raw,
                    objeto=objeto_resumo,
                    objeto_completo=objeto_completo,
                    modalidade_contratacao=modalidade_txt,
                    setor_demandante=setor_nome,
                    valor_global=empenho_total,
                    total_gasto=total_gasto,
                    saldo_disponivel=saldo_empenho,
                    media_mensal=media_mensal,
                    reforco_empenho=reforco_str,
                    valor_rpps=vlr_rpps,
                    ne_rpps=ne_rpps,
                    valor_fps=vlr_fps,
                    ne_fps=ne_fps,
                    inicio_vigencia=inicio_iso,
                    fim_vigencia=termino_iso,
                    duracao_mm_max=duracao_mm,
                    data_duracao_maxima=dur_max_iso,
                    prorrogavel=prorrogavel_flag,
                    optante_simples=opt_simples,
                    regra_pagamento=regra_pagto,
                    retencao_ir=retencao_ir,
                    status_garantia=status_garantia,
                    modalidade_garantia=mod_garantia or "—",
                    validade_garantia=validade_garantia_str,
                    gestor_contrato=gestor,
                    gestor_suplente=gestor_sup,
                    fiscal_titular=fiscal_tit,
                    fiscal_suplente=fiscal_sup,
                    fiscais_adicionais=fiscais_adicionais_str,
                    cnds_json=json.dumps(cnds_dict, ensure_ascii=False),
                    sancao_ceis=sancao_ceis_str,
                    execucao_mensal_json=json.dumps(execucao_mensal, ensure_ascii=False),
                    preposto_contato=preposto_full,
                    email_contratada=email_emp,
                    ultimo_termo=ultimo_termo_str,
                    portaria_fiscalizacao=portaria_str,
                )
                db.add(modelo)
                contratos_importados.append(modelo)

                # Como a SLC controla todos os processos E-Docs diretamente por esta planilha,
                # sincronizamos cada contrato vigente como um Processo acompanhado em M2 / Kanban / Prazos:
                try:
                    dias_fim = int(float(g_row.get("DN", "999")))
                except Exception:
                    dias_fim = 999

                # Verificar se alguma CND está vencida
                cnd_vencida = False
                for c_info in cnds_dict.values():
                    v_dt = c_info.get("validade", "")
                    if len(v_dt) == 10 and v_dt < datetime.now().strftime("%Y-%m-%d"):
                        cnd_vencida = True

                if dias_fim <= 45:
                    prioridade = "Crítica"
                    situacao = "Em elaboração"
                    pendencia = f"Vencimento crítico em {dias_fim} dias ({'Prorrogável - instruir Aditivo' if prorrogavel_flag else 'Não Prorrogável - Nova Contratação'})"
                elif dias_fim <= 90:
                    prioridade = "Alta"
                    situacao = "Em análise"
                    pendencia = f"Janela de 90 dias ({dias_fim}d restantes) — consultar setor {setor_sigla} ({'Prorrogação' if prorrogavel_flag else 'Nova Licitação'})"
                elif dias_fim <= 180:
                    prioridade = "Média"
                    situacao = "Recebido pela SLC"
                    pendencia = f"Janela preventiva de 180 dias ({dias_fim}d restantes)"
                elif cnd_vencida or status_garantia == "Pendente de Renovação":
                    prioridade = "Alta"
                    situacao = "Aguardando documentação"
                    pendencia = "Atualizar Certidão Negativa (CND) / endosso de garantia no E-Docs"
                elif proc_pagto and total_gasto > 0:
                    prioridade = "Baixa"
                    situacao = "Em andamento externo"
                    pendencia = f"Execução mensal 2026 ativa (Proc. Pagto {proc_pagto} · Saldo R$ {saldo_empenho:,.2f})"
                else:
                    prioridade = "Baixa"
                    situacao = "Concluído"
                    pendencia = f"Contrato vigente regular ({dias_fim}d restantes)"

                if dias_fim <= 180:
                    cat_proc = (
                        "Aditivo / Prorrogação / Apostilamento"
                        if prorrogavel_flag
                        else ("Contratação Direta (Dispensa/Inexig.)" if mod_sigla in ("I", "D") else "Licitação (Pregão/Concorrência)")
                    )
                elif mod_sigla in ("I", "D"):
                    cat_proc = "Contratação Direta (Dispensa/Inexig.)"
                elif mod_sigla in ("P", "CO", "RP"):
                    cat_proc = "Licitação (Pregão/Concorrência)"
                else:
                    cat_proc = "Formalização de Contrato"

                proc_id = f"proc-{aba_nome.lower() if aba_nome else r_idx}"
                proc = ProcessoModel(
                    id=proc_id,
                    codigo_interno=f"SLC-2026-{len(processos_importados)+1:03d}",
                    numero_edocs=proc_pagto if proc_pagto else proc_mae,
                    assunto=f"{empresa_curta} — {objeto_resumo} (Contrato {num_contrato})",
                    objeto_detalhado=f"{objeto_completo} | Processo Mãe: {proc_mae} | Processo Pagto: {proc_pagto or '—'} | ID TCES: {id_tces or 'N/A'}",
                    categoria=cat_proc,
                    setor_demandante=setor_nome,
                    responsavel=fiscal_tit if fiscal_tit != "Não designado" else gestor,
                    data_entrada=inicio_iso,
                    situacao=situacao,
                    prioridade=prioridade,
                    prazo=termino_iso,
                    atualizado_em=datetime.now().isoformat(),
                    observacoes_internas=f"Aba '{aba_nome}' (CONTROLE_CONTRATOS-2026_B.xlsm). Gestor: {gestor} | Fiscal: {fiscal_tit}. Empenho: R$ {empenho_total:,.2f} | Gasto: R$ {total_gasto:,.2f} | Saldo: R$ {saldo_empenho:,.2f}.",
                    pendencia_atual=pendencia,
                    restrito_tv=False,
                    link_edocs="https://edocs.es.gov.br/",
                )
                db.add(proc)
                processos_importados.append(proc)

            db.commit()
            print(f"Sucesso! {len(contratos_importados)} contratos vigentes e {len(processos_importados)} processos críticos/em janela de renovação importados da planilha XLSM.")
            return {
                "contratosImportados": len(contratos_importados),
                "processosGerados": len(processos_importados),
            }
        finally:
            db.close()


if __name__ == "__main__":
    path_arg = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSM
    importar_planilha_xlsm(path_arg)

