from datetime import datetime
from typing import List, Optional
import uuid

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import Base, engine, get_db, obter_info_banco
from .models import (
    ConfiguracaoPainelModel,
    ContratoModel,
    HistoricoAlteracaoModel,
    ProcessoModel,
)
from .schemas import (
    ConfiguracaoTVSchema,
    ContratoBaseSchema,
    HistoricoAlteracaoSchema,
    MudancaSituacaoPayload,
    PainelTVResponseSchema,
    ProcessoBaseSchema,
    ProcessoPublicoTVSchema,
)
from .seed import (
    model_to_config_dict,
    model_to_contrato_dict,
    model_to_historico_dict,
    model_to_processo_dict,
)

def _ensure_contrato_columns():
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
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
        "execucao_mensal_json": "TEXT",
        "preposto_contato": "VARCHAR(255) DEFAULT ''",
        "email_contratada": "VARCHAR(180) DEFAULT ''",
    }
    with engine.begin() as conn:
        for col_name, col_def in new_cols.items():
            if col_name not in existing_cols:
                conn.execute(text(f"ALTER TABLE contratos ADD COLUMN {col_name} {col_def}"))


# Cria as tabelas no banco (MySQL ou banco local) e garante evolução de colunas
Base.metadata.create_all(bind=engine)
_ensure_contrato_columns()

app = FastAPI(
    title="SLC Digital API — IPAJM (GTI / SLC)",
    description=(
        "API RESTful de gestão e monitoramento de processos e contratos da "
        "Subgerência de Licitações e Contratos (SLC) do IPAJM. "
        "Camada operacional complementar ao E-Docs, projetada para o padrão MySQL 8+ da GTI."
    ),
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Infraestrutura e Diagnóstico GTI"])
def health_check(db: Session = Depends(get_db)):
    total_processos = db.query(ProcessoModel).count()
    total_contratos = db.query(ContratoModel).count()
    return {
        "status": "ok",
        "servico": "SLC Digital API — IPAJM",
        "versao": "0.4.0",
        "banco": obter_info_banco(),
        "totais": {
            "processos": total_processos,
            "contratos": total_contratos,
        },
        "timestamp": datetime.now().isoformat(),
    }


# =============================================================================
# M2 & M3: Processos e Fluxo Kanban (com geração automática de Auditoria)
# =============================================================================


@app.get(
    "/api/processos",
    response_model=List[ProcessoBaseSchema],
    tags=["M2 · Processos Administrativos"],
)
def listar_processos(
    categoria: Optional[str] = Query(None),
    situacao: Optional[str] = Query(None),
    responsavel: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(ProcessoModel)
    if categoria and categoria != "TODAS":
        query = query.filter(ProcessoModel.categoria == categoria)
    if situacao and situacao != "TODAS":
        query = query.filter(ProcessoModel.situacao == situacao)
    if responsavel and responsavel != "TODOS":
        query = query.filter(ProcessoModel.responsavel == responsavel)

    itens = query.all()
    return [model_to_processo_dict(p) for p in itens]


@app.post(
    "/api/processos",
    response_model=ProcessoBaseSchema,
    tags=["M2 · Processos Administrativos"],
)
def criar_processo(
    payload: ProcessoBaseSchema,
    usuario_autor: str = Query("Gestão SLC"),
    db: Session = Depends(get_db),
):
    agora = datetime.now().isoformat()
    novo = ProcessoModel(
        id=payload.id or f"proc-{uuid.uuid4().hex[:8]}",
        codigo_interno=payload.codigoInterno,
        numero_edocs=payload.numeroEdocs,
        assunto=payload.assunto,
        objeto_detalhado=payload.objetoDetalhado,
        categoria=payload.categoria,
        setor_demandante=payload.setorDemandante,
        responsavel=payload.responsavel,
        data_entrada=payload.dataEntrada,
        situacao=payload.situacao,
        prioridade=payload.prioridade,
        prazo=payload.prazo,
        atualizado_em=agora,
        observacoes_internas=payload.observacoesInternas,
        pendencia_atual=payload.pendenciaAtual or "",
        restrito_tv=payload.restritoTv,
        link_edocs=payload.linkEdocs or "https://edocs.es.gov.br/",
    )
    db.add(novo)

    hist = HistoricoAlteracaoModel(
        id=f"hist-{uuid.uuid4().hex[:10]}",
        processo_id=novo.id,
        usuario=usuario_autor,
        data_hora=agora,
        campo="Cadastro Inicial",
        valor_anterior="—",
        valor_novo=f"Processo {novo.numero_edocs} registrado ({novo.situacao})",
    )
    db.add(hist)
    db.commit()
    db.refresh(novo)
    return model_to_processo_dict(novo)


@app.put(
    "/api/processos/{processo_id}",
    response_model=ProcessoBaseSchema,
    tags=["M2 · Processos Administrativos"],
)
def atualizar_processo(
    processo_id: str,
    payload: ProcessoBaseSchema,
    usuario_autor: str = Query("Gestão SLC"),
    db: Session = Depends(get_db),
):
    existente = (
        db.query(ProcessoModel).filter(ProcessoModel.id == processo_id).first()
    )
    if not existente:
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    agora = datetime.now().isoformat()
    comparacoes = [
        ("Situação / Etapa", existente.situacao, payload.situacao),
        ("Responsável", existente.responsavel, payload.responsavel),
        ("Prioridade", existente.prioridade, payload.prioridade),
        ("Prazo", existente.prazo or "—", payload.prazo or "—"),
        ("Categoria", existente.categoria, payload.categoria),
        ("Assunto", existente.assunto, payload.assunto),
        (
            "Visibilidade na TV",
            "Oculto na TV" if existente.restrito_tv else "Visível na TV",
            "Oculto na TV" if payload.restritoTv else "Visível na TV",
        ),
    ]

    for rotulo, val_antigo, val_novo in comparacoes:
        if str(val_antigo) != str(val_novo):
            db.add(
                HistoricoAlteracaoModel(
                    id=f"hist-{uuid.uuid4().hex[:10]}",
                    processo_id=processo_id,
                    usuario=usuario_autor,
                    data_hora=agora,
                    campo=rotulo,
                    valor_anterior=str(val_antigo),
                    valor_novo=str(val_novo),
                )
            )

    existente.codigo_interno = payload.codigoInterno
    existente.numero_edocs = payload.numeroEdocs
    existente.assunto = payload.assunto
    existente.objeto_detalhado = payload.objetoDetalhado
    existente.categoria = payload.categoria
    existente.setor_demandante = payload.setorDemandante
    existente.responsavel = payload.responsavel
    existente.data_entrada = payload.dataEntrada
    existente.situacao = payload.situacao
    existente.prioridade = payload.prioridade
    existente.prazo = payload.prazo
    existente.atualizado_em = agora
    existente.observacoes_internas = payload.observacoesInternas
    existente.pendencia_atual = payload.pendenciaAtual or ""
    existente.restrito_tv = payload.restritoTv
    existente.link_edocs = payload.linkEdocs or "https://edocs.es.gov.br/"

    db.commit()
    db.refresh(existente)
    return model_to_processo_dict(existente)


@app.delete(
    "/api/processos/{processo_id}",
    tags=["M2 · Processos Administrativos"],
)
def excluir_processo(processo_id: str, db: Session = Depends(get_db)):
    existente = (
        db.query(ProcessoModel).filter(ProcessoModel.id == processo_id).first()
    )
    if not existente:
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    db.query(HistoricoAlteracaoModel).filter(
        HistoricoAlteracaoModel.processo_id == processo_id
    ).delete()
    db.delete(existente)
    db.commit()
    return {"status": "ok"}


@app.patch(
    "/api/processos/{processo_id}/situacao",
    response_model=ProcessoBaseSchema,
    tags=["M3 · Quadro Kanban Operacional"],
)
def atualizar_situacao_kanban(
    processo_id: str,
    payload: MudancaSituacaoPayload,
    db: Session = Depends(get_db),
):
    existente = (
        db.query(ProcessoModel).filter(ProcessoModel.id == processo_id).first()
    )
    if not existente:
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    if existente.situacao != payload.novaSituacao:
        agora = datetime.now().isoformat()
        db.add(
            HistoricoAlteracaoModel(
                id=f"hist-{uuid.uuid4().hex[:10]}",
                processo_id=processo_id,
                usuario=payload.usuarioAutor,
                data_hora=agora,
                campo="Situação / Etapa",
                valor_anterior=existente.situacao,
                valor_novo=payload.novaSituacao,
            )
        )
        existente.situacao = payload.novaSituacao
        existente.atualizado_em = agora
        db.commit()
        db.refresh(existente)

    return model_to_processo_dict(existente)


# =============================================================================
# M5: Gestão de Contratos, Vigências, Saldos e Fiscais
# =============================================================================


@app.get(
    "/api/contratos",
    response_model=List[ContratoBaseSchema],
    tags=["M5 · Contratos e Vigências"],
)
def listar_contratos(db: Session = Depends(get_db)):
    itens = db.query(ContratoModel).order_by(ContratoModel.fim_vigencia.asc()).all()
    return [model_to_contrato_dict(c) for c in itens]


@app.post(
    "/api/contratos",
    response_model=ContratoBaseSchema,
    tags=["M5 · Contratos e Vigências"],
)
def salvar_ou_atualizar_contrato(
    payload: ContratoBaseSchema,
    db: Session = Depends(get_db),
):
    existente = (
        db.query(ContratoModel).filter(ContratoModel.id == payload.id).first()
    )
    if existente:
        existente.numero_contrato = payload.numeroContrato
        existente.numero_edocs = payload.numeroEdocs
        existente.processo_pagamento = payload.processoPagamento or ""
        existente.id_tces = payload.idTces or ""
        existente.aba_planilha = payload.abaPlanilha or ""
        existente.grupo_planilha = payload.grupoPlanilha or "S"
        existente.empresa_contratada = payload.empresaContratada
        existente.razao_social = payload.razaoSocial or ""
        existente.cnpj = payload.cnpj
        existente.objeto = payload.objeto
        existente.objeto_completo = payload.objetoCompleto or ""
        existente.modalidade_contratacao = payload.modalidadeContratacao or ""
        existente.setor_demandante = payload.setorDemandante
        existente.valor_global = payload.valorGlobal
        existente.total_gasto = payload.totalGasto or 0.0
        existente.saldo_disponivel = payload.saldoDisponivel
        existente.media_mensal = payload.mediaMensal or 0.0
        existente.reforco_empenho = payload.reforcoEmpenho or ""
        existente.valor_rpps = payload.valorRpps or 0.0
        existente.ne_rpps = payload.neRpps or ""
        existente.valor_fps = payload.valorFps or 0.0
        existente.ne_fps = payload.neFps or ""
        existente.inicio_vigencia = payload.inicioVigencia
        existente.fim_vigencia = payload.fimVigencia
        existente.duracao_mm_max = payload.duracaoMmMax or ""
        existente.data_duracao_maxima = payload.dataDuracaoMaxima or ""
        existente.prorrogavel = payload.prorrogavel
        existente.optante_simples = payload.optanteSimples or "N"
        existente.regra_pagamento = payload.regraPagamento or ""
        existente.retencao_ir = payload.retencaoIr or ""
        existente.status_garantia = payload.statusGarantia
        existente.modalidade_garantia = payload.modalidadeGarantia or ""
        existente.validade_garantia = payload.validadeGarantia or ""
        existente.gestor_contrato = payload.gestorContrato
        existente.gestor_suplente = payload.gestorSuplente or ""
        existente.fiscal_titular = payload.fiscalTitular
        existente.fiscal_suplente = payload.fiscalSuplente
        existente.fiscais_adicionais = payload.fiscaisAdicionais or ""
        existente.cnds_json = payload.cndsJson or "{}"
        existente.sancao_ceis = payload.sancaoCeis or "Nada Consta"
        existente.execucao_mensal_json = payload.execucaoMensalJson or "[]"
        existente.preposto_contato = payload.prepostoContato or ""
        existente.email_contratada = payload.emailContratada or ""
        existente.ultimo_termo = payload.ultimoTermo
        existente.portaria_fiscalizacao = payload.portariaFiscalizacao
        db.commit()
        db.refresh(existente)
        return model_to_contrato_dict(existente)

    novo = ContratoModel(
        id=payload.id or f"cont-{uuid.uuid4().hex[:8]}",
        numero_contrato=payload.numeroContrato,
        numero_edocs=payload.numeroEdocs,
        processo_pagamento=payload.processoPagamento or "",
        id_tces=payload.idTces or "",
        aba_planilha=payload.abaPlanilha or "",
        grupo_planilha=payload.grupoPlanilha or "S",
        empresa_contratada=payload.empresaContratada,
        razao_social=payload.razaoSocial or "",
        cnpj=payload.cnpj,
        objeto=payload.objeto,
        objeto_completo=payload.objetoCompleto or "",
        modalidade_contratacao=payload.modalidadeContratacao or "",
        setor_demandante=payload.setorDemandante,
        valor_global=payload.valorGlobal,
        total_gasto=payload.totalGasto or 0.0,
        saldo_disponivel=payload.saldoDisponivel,
        media_mensal=payload.mediaMensal or 0.0,
        reforco_empenho=payload.reforcoEmpenho or "",
        valor_rpps=payload.valorRpps or 0.0,
        ne_rpps=payload.neRpps or "",
        valor_fps=payload.valorFps or 0.0,
        ne_fps=payload.neFps or "",
        inicio_vigencia=payload.inicioVigencia,
        fim_vigencia=payload.fimVigencia,
        duracao_mm_max=payload.duracaoMmMax or "",
        data_duracao_maxima=payload.dataDuracaoMaxima or "",
        prorrogavel=payload.prorrogavel,
        optante_simples=payload.optanteSimples or "N",
        regra_pagamento=payload.regraPagamento or "",
        retencao_ir=payload.retencaoIr or "",
        status_garantia=payload.statusGarantia,
        modalidade_garantia=payload.modalidadeGarantia or "",
        validade_garantia=payload.validadeGarantia or "",
        gestor_contrato=payload.gestorContrato,
        gestor_suplente=payload.gestorSuplente or "",
        fiscal_titular=payload.fiscalTitular,
        fiscal_suplente=payload.fiscalSuplente,
        fiscais_adicionais=payload.fiscaisAdicionais or "",
        cnds_json=payload.cndsJson or "{}",
        sancao_ceis=payload.sancaoCeis or "Nada Consta",
        execucao_mensal_json=payload.execucaoMensalJson or "[]",
        preposto_contato=payload.prepostoContato or "",
        email_contratada=payload.emailContratada or "",
        ultimo_termo=payload.ultimoTermo,
        portaria_fiscalizacao=payload.portariaFiscalizacao,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return model_to_contrato_dict(novo)


@app.delete(
    "/api/contratos/{contrato_id}",
    tags=["M5 · Contratos e Vigências"],
)
def excluir_contrato(contrato_id: str, db: Session = Depends(get_db)):
    existente = (
        db.query(ContratoModel).filter(ContratoModel.id == contrato_id).first()
    )
    if not existente:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    db.delete(existente)
    db.commit()
    return {"status": "ok"}


# =============================================================================
# Auditoria (RF-07 / RNF-02)
# =============================================================================


@app.get(
    "/api/historico",
    response_model=List[HistoricoAlteracaoSchema],
    tags=["Auditoria e Rastreabilidade"],
)
def listar_historico(
    processo_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(HistoricoAlteracaoModel).order_by(
        HistoricoAlteracaoModel.data_hora.desc()
    )
    if processo_id:
        query = query.filter(HistoricoAlteracaoModel.processo_id == processo_id)
    return [model_to_historico_dict(h) for h in query.all()]


# =============================================================================
# M7: Modo TV — Endpoint Exclusivo de Leitura Sanitizada (1 Única TV)
# =============================================================================


@app.get(
    "/api/tv/painel",
    response_model=PainelTVResponseSchema,
    tags=["M7 · Modo TV (Leitura Sanitizada)"],
)
def obter_painel_tv(db: Session = Depends(get_db)):
    cfg = db.query(ConfiguracaoPainelModel).first()
    if not cfg:
        cfg = ConfiguracaoPainelModel(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)

    todos = db.query(ProcessoModel).all()
    restritos_count = sum(1 for p in todos if p.restrito_tv)
    publicos = [
        ProcessoPublicoTVSchema(
            id=p.id,
            codigoInterno=p.codigo_interno,
            numeroEdocs=p.numero_edocs,
            assunto=p.assunto,
            categoria=p.categoria,
            setorDemandante=p.setor_demandante,
            responsavel=p.responsavel if cfg.exibir_responsavel_tv else None,
            situacao=p.situacao,
            prioridade=p.prioridade,
            prazo=p.prazo,
            atualizadoEm=p.atualizado_em,
            pendenciaAtual=p.pendencia_atual or "",
        )
        for p in todos
        if not p.restrito_tv
    ]

    return PainelTVResponseSchema(
        sincronizadoEm=datetime.now().isoformat(),
        configTv=ConfiguracaoTVSchema(**model_to_config_dict(cfg)),
        totalProcessosRestritosOcultos=restritos_count,
        processosPublicos=publicos,
    )


@app.put(
    "/api/tv/config",
    response_model=ConfiguracaoTVSchema,
    tags=["M7 · Modo TV (Leitura Sanitizada)"],
)
def atualizar_config_tv(
    payload: ConfiguracaoTVSchema,
    db: Session = Depends(get_db),
):
    cfg = db.query(ConfiguracaoPainelModel).first()
    if not cfg:
        cfg = ConfiguracaoPainelModel(id=1)
        db.add(cfg)
    cfg.intervalo_segundos = payload.intervaloSegundos
    cfg.exibir_responsavel_tv = payload.exibirResponsavelTv
    cfg.dias_alerta_inatividade = payload.diasAlertaInatividade
    cfg.dias_alerta_prazo_proximo = payload.diasAlertaPrazoProximo
    db.commit()
    db.refresh(cfg)
    return ConfiguracaoTVSchema(**model_to_config_dict(cfg))
