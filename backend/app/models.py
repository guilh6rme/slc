from sqlalchemy import Boolean, Column, Index, Integer, Numeric, String, Text
from .database import Base


class ProcessoModel(Base):
    __tablename__ = "processos"

    id = Column(String(60), primary_key=True)
    codigo_interno = Column(String(40), nullable=False, index=True)
    numero_edocs = Column(String(60), nullable=False, index=True)
    assunto = Column(String(255), nullable=False)
    objeto_detalhado = Column(Text, nullable=False, default="")
    categoria = Column(String(100), nullable=False, index=True)
    setor_demandante = Column(String(120), nullable=False, index=True)
    responsavel = Column(String(120), nullable=False, index=True)
    data_entrada = Column(String(20), nullable=False)
    situacao = Column(String(80), nullable=False, index=True)
    prioridade = Column(String(30), nullable=False, default="Média")
    prazo = Column(String(20), nullable=True)
    atualizado_em = Column(String(40), nullable=False)
    observacoes_internas = Column(Text, nullable=False, default="")
    pendencia_atual = Column(String(255), nullable=True, default="")
    restrito_tv = Column(Boolean, nullable=False, default=False, index=True)
    link_edocs = Column(String(500), nullable=True, default="https://edocs.es.gov.br/")


class ContratoModel(Base):
    __tablename__ = "contratos"

    id = Column(String(60), primary_key=True)
    numero_contrato = Column(String(60), nullable=False, index=True)
    numero_edocs = Column(String(60), nullable=False, index=True)  # Processo Mãe (E-Docs)
    processo_pagamento = Column(String(60), nullable=True, default="")  # Processo Pagto (E-Docs 2026)
    id_tces = Column(String(80), nullable=True, default="")  # Código CidadES TCE-ES
    aba_planilha = Column(String(40), nullable=True, default="", index=True)  # Nome da aba na planilha XLSM
    grupo_planilha = Column(String(20), nullable=True, default="S", index=True)  # S, S2 (Peritos), S5, Z
    empresa_contratada = Column(String(220), nullable=False)
    razao_social = Column(String(255), nullable=True, default="")
    cnpj = Column(String(60), nullable=False, index=True)
    objeto = Column(Text, nullable=False)
    objeto_completo = Column(Text, nullable=True, default="")
    modalidade_contratacao = Column(String(60), nullable=True, default="")  # I, D, P, RP, C, CO, CC
    setor_demandante = Column(String(120), nullable=False, index=True)
    valor_global = Column(Numeric(15, 2, asdecimal=False), nullable=False, default=0.0)
    total_gasto = Column(Numeric(15, 2, asdecimal=False), nullable=True, default=0.0)
    saldo_disponivel = Column(Numeric(15, 2, asdecimal=False), nullable=False, default=0.0)
    media_mensal = Column(Numeric(15, 2, asdecimal=False), nullable=True, default=0.0)
    reforco_empenho = Column(String(60), nullable=True, default="")
    valor_rpps = Column(Numeric(15, 2, asdecimal=False), nullable=True, default=0.0)
    ne_rpps = Column(String(255), nullable=True, default="")
    valor_fps = Column(Numeric(15, 2, asdecimal=False), nullable=True, default=0.0)
    ne_fps = Column(String(255), nullable=True, default="")
    inicio_vigencia = Column(String(20), nullable=False)
    fim_vigencia = Column(String(20), nullable=False, index=True)
    duracao_mm_max = Column(String(30), nullable=True, default="")
    data_duracao_maxima = Column(String(20), nullable=True, default="")
    prorrogavel = Column(Boolean, nullable=False, default=True)
    optante_simples = Column(String(30), nullable=True, default="N")
    regra_pagamento = Column(String(30), nullable=True, default="")
    retencao_ir = Column(String(60), nullable=True, default="")
    status_garantia = Column(String(60), nullable=False, default="Vigente", index=True)
    modalidade_garantia = Column(String(40), nullable=True, default="")
    validade_garantia = Column(String(40), nullable=True, default="")
    gestor_contrato = Column(String(140), nullable=False)
    gestor_suplente = Column(String(140), nullable=True, default="")
    fiscal_titular = Column(String(140), nullable=False)
    fiscal_suplente = Column(String(140), nullable=False)
    fiscais_adicionais = Column(Text, nullable=True, default="")
    cnds_json = Column(Text, nullable=True, default="{}")
    sancao_ceis = Column(String(255), nullable=True, default="Nada Consta")
    execucao_mensal_json = Column(Text, nullable=True, default="[]")
    dados_2025_json = Column(Text, nullable=True, default="{}")
    preposto_contato = Column(String(255), nullable=True, default="")
    email_contratada = Column(String(180), nullable=True, default="")
    ultimo_termo = Column(String(180), nullable=False, default="Contrato Original")
    portaria_fiscalizacao = Column(String(120), nullable=False, default="")


class HistoricoAlteracaoModel(Base):
    __tablename__ = "historico_alteracoes"
    __table_args__ = (
        Index("ix_historico_proc_data", "processo_id", "data_hora"),
    )

    id = Column(String(80), primary_key=True)
    processo_id = Column(String(60), nullable=False, index=True)
    usuario = Column(String(120), nullable=False)
    data_hora = Column(String(40), nullable=False, index=True)
    campo = Column(String(80), nullable=False)
    valor_anterior = Column(Text, nullable=False)
    valor_novo = Column(Text, nullable=False)


class ConfiguracaoPainelModel(Base):
    __tablename__ = "configuracao_painel"

    id = Column(Integer, primary_key=True, default=1)
    intervalo_segundos = Column(Integer, nullable=False, default=20)
    exibir_responsavel_tv = Column(Boolean, nullable=False, default=True)
    dias_alerta_inatividade = Column(Integer, nullable=False, default=10)
    dias_alerta_prazo_proximo = Column(Integer, nullable=False, default=7)
