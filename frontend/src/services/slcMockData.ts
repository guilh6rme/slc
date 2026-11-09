import {
  ConfiguracaoTV,
  ContratoSLC,
  HistoricoAlteracao,
  ProcessoSLC,
} from '../types/slc';

export function gerarProcessosIniciais(): ProcessoSLC[] {
  return [];
}

export function gerarHistoricoInicial(): HistoricoAlteracao[] {
  return [];
}

export function gerarContratosIniciais(): ContratoSLC[] {
  return [];
}

export const CONFIG_TV_INICIAL: ConfiguracaoTV = {
  intervaloSegundos: 20,
  exibirResponsavelTv: true,
  diasAlertaInatividade: 10,
  diasAlertaPrazoProximo: 7,
};
