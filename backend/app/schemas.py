from typing import Optional, List
from pydantic import BaseModel, Field


class ProcessoBaseSchema(BaseModel):
    id: str
    codigoInterno: str
    numeroEdocs: str
    assunto: str
    objetoDetalhado: str = ""
    categoria: str
    setorDemandante: str
    responsavel: str
    dataEntrada: str
    situacao: str
    prioridade: str
    prazo: Optional[str] = None
    atualizadoEm: str
    observacoesInternas: str = ""
    pendenciaAtual: Optional[str] = ""
    restritoTv: bool = False
    linkEdocs: Optional[str] = "https://edocs.es.gov.br/"


class ProcessoPublicoTVSchema(BaseModel):
    """
    Schema estritamente sanitizado para o Modo TV (RF-13 / Segurança).
    NUNCA inclui `observacoesInternas` nem processos marcados com `restritoTv = True`.
    """

    id: str
    codigoInterno: str
    numeroEdocs: str
    assunto: str
    categoria: str
    setorDemandante: str
    responsavel: Optional[str] = None
    situacao: str
    prioridade: str
    prazo: Optional[str] = None
    atualizadoEm: str
    pendenciaAtual: Optional[str] = ""


class MudancaSituacaoPayload(BaseModel):
    novaSituacao: str
    usuarioAutor: str = Field(default="Chefia SLC (Coordenação)")


class ContratoBaseSchema(BaseModel):
    id: str
    numeroContrato: str
    numeroEdocs: str
    processoPagamento: Optional[str] = ""
    idTces: Optional[str] = ""
    abaPlanilha: Optional[str] = ""
    grupoPlanilha: Optional[str] = "S"
    empresaContratada: str
    razaoSocial: Optional[str] = ""
    cnpj: str
    objeto: str
    objetoCompleto: Optional[str] = ""
    modalidadeContratacao: Optional[str] = ""
    setorDemandante: str
    valorGlobal: float
    totalGasto: Optional[float] = 0.0
    saldoDisponivel: float
    mediaMensal: Optional[float] = 0.0
    reforcoEmpenho: Optional[str] = ""
    valorRpps: Optional[float] = 0.0
    neRpps: Optional[str] = ""
    valorFps: Optional[float] = 0.0
    neFps: Optional[str] = ""
    inicioVigencia: str
    fimVigencia: str
    duracaoMmMax: Optional[str] = ""
    dataDuracaoMaxima: Optional[str] = ""
    prorrogavel: bool = True
    optanteSimples: Optional[str] = "N"
    regraPagamento: Optional[str] = ""
    retencaoIr: Optional[str] = ""
    statusGarantia: str
    modalidadeGarantia: Optional[str] = ""
    validadeGarantia: Optional[str] = ""
    gestorContrato: str
    gestorSuplente: Optional[str] = ""
    fiscalTitular: str
    fiscalSuplente: str
    fiscaisAdicionais: Optional[str] = ""
    cndsJson: Optional[str] = "{}"
    sancaoCeis: Optional[str] = "Nada Consta"
    execucaoMensalJson: Optional[str] = "[]"
    prepostoContato: Optional[str] = ""
    emailContratada: Optional[str] = ""
    ultimoTermo: str
    portariaFiscalizacao: str


class HistoricoAlteracaoSchema(BaseModel):
    id: str
    processoId: str
    usuario: str
    dataHora: str
    campo: str
    valorAnterior: str
    valorNovo: str


class ConfiguracaoTVSchema(BaseModel):
    intervaloSegundos: int = 20
    exibirResponsavelTv: bool = True
    diasAlertaInatividade: int = 10
    diasAlertaPrazoProximo: int = 7


class PainelTVResponseSchema(BaseModel):
    sincronizadoEm: str
    configTv: ConfiguracaoTVSchema
    totalProcessosRestritosOcultos: int
    processosPublicos: List[ProcessoPublicoTVSchema]

