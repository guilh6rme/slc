from .models import (
    ConfiguracaoPainelModel,
    ContratoModel,
    HistoricoAlteracaoModel,
    ProcessoModel,
)


def model_to_processo_dict(m: ProcessoModel) -> dict:
    return {
        "id": m.id,
        "codigoInterno": m.codigo_interno,
        "numeroEdocs": m.numero_edocs,
        "assunto": m.assunto,
        "objetoDetalhado": m.objeto_detalhado or "",
        "categoria": m.categoria,
        "setorDemandante": m.setor_demandante,
        "responsavel": m.responsavel,
        "dataEntrada": m.data_entrada,
        "situacao": m.situacao,
        "prioridade": m.prioridade,
        "prazo": m.prazo,
        "atualizadoEm": m.atualizado_em,
        "observacoesInternas": m.observacoes_internas or "",
        "pendenciaAtual": m.pendencia_atual or "",
        "restritoTv": bool(m.restrito_tv),
        "linkEdocs": m.link_edocs or "https://edocs.es.gov.br/",
    }


def model_to_contrato_dict(c: ContratoModel) -> dict:
    return {
        "id": c.id,
        "numeroContrato": c.numero_contrato,
        "numeroEdocs": c.numero_edocs,
        "processoPagamento": getattr(c, "processo_pagamento", "") or "",
        "idTces": getattr(c, "id_tces", "") or "",
        "abaPlanilha": getattr(c, "aba_planilha", "") or "",
        "grupoPlanilha": getattr(c, "grupo_planilha", "S") or "S",
        "empresaContratada": c.empresa_contratada,
        "razaoSocial": getattr(c, "razao_social", "") or "",
        "cnpj": c.cnpj,
        "objeto": c.objeto,
        "objetoCompleto": getattr(c, "objeto_completo", "") or "",
        "modalidadeContratacao": getattr(c, "modalidade_contratacao", "") or "",
        "setorDemandante": c.setor_demandante,
        "valorGlobal": float(c.valor_global or 0.0),
        "totalGasto": float(getattr(c, "total_gasto", 0.0) or 0.0),
        "saldoDisponivel": float(c.saldo_disponivel or 0.0),
        "mediaMensal": float(getattr(c, "media_mensal", 0.0) or 0.0),
        "reforcoEmpenho": getattr(c, "reforco_empenho", "") or "",
        "valorRpps": float(getattr(c, "valor_rpps", 0.0) or 0.0),
        "neRpps": getattr(c, "ne_rpps", "") or "",
        "valorFps": float(getattr(c, "valor_fps", 0.0) or 0.0),
        "neFps": getattr(c, "ne_fps", "") or "",
        "inicioVigencia": c.inicio_vigencia,
        "fimVigencia": c.fim_vigencia,
        "duracaoMmMax": getattr(c, "duracao_mm_max", "") or "",
        "dataDuracaoMaxima": getattr(c, "data_duracao_maxima", "") or "",
        "prorrogavel": bool(c.prorrogavel),
        "optanteSimples": getattr(c, "optante_simples", "N") or "N",
        "regraPagamento": getattr(c, "regra_pagamento", "") or "",
        "retencaoIr": getattr(c, "retencao_ir", "") or "",
        "statusGarantia": c.status_garantia,
        "modalidadeGarantia": getattr(c, "modalidade_garantia", "") or "",
        "validadeGarantia": getattr(c, "validade_garantia", "") or "",
        "gestorContrato": c.gestor_contrato,
        "gestorSuplente": getattr(c, "gestor_suplente", "") or "",
        "fiscalTitular": c.fiscal_titular,
        "fiscalSuplente": c.fiscal_suplente,
        "fiscaisAdicionais": getattr(c, "fiscais_adicionais", "") or "",
        "cndsJson": getattr(c, "cnds_json", "{}") or "{}",
        "sancaoCeis": getattr(c, "sancao_ceis", "Nada Consta") or "Nada Consta",
        "execucaoMensalJson": getattr(c, "execucao_mensal_json", "[]") or "[]",
        "prepostoContato": getattr(c, "preposto_contato", "") or "",
        "emailContratada": getattr(c, "email_contratada", "") or "",
        "ultimoTermo": c.ultimo_termo,
        "portariaFiscalizacao": c.portaria_fiscalizacao,
    }


def model_to_historico_dict(h: HistoricoAlteracaoModel) -> dict:
    return {
        "id": h.id,
        "processoId": h.processo_id,
        "usuario": h.usuario,
        "dataHora": h.data_hora,
        "campo": h.campo,
        "valorAnterior": h.valor_anterior,
        "valorNovo": h.valor_novo,
    }


def model_to_config_dict(cfg: ConfiguracaoPainelModel) -> dict:
    return {
        "intervaloSegundos": cfg.intervalo_segundos,
        "exibirResponsavelTv": bool(cfg.exibir_responsavel_tv),
        "diasAlertaInatividade": cfg.dias_alerta_inatividade,
        "diasAlertaPrazoProximo": cfg.dias_alerta_prazo_proximo,
    }
