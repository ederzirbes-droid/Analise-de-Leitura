
export interface RouteData {
  rota: string;
  quantidade: number;
  codigoUc: string;
  consumidornome: string;
  consumidorNome: string;
  codigoRota: string;
  consumoMes: number;
  consumoMes1: number;
  injetadaAtual: number;
  injetadaAnterior: number;
  microGeracao: string; // 'S', 'N', 'P', 'X'
  tempConsumoMg?: number;
  varConsumo: number;
  varGD: number;
  descricaoNaoLeitura: string;
  statusLigado: string;
  endereco: string;
}

export interface ComparisonRow {
  rota: string;
  qtdAnterior: number;
  qtdAtual: number;
  diferenca: number;
  percentual: number;
  inconsistencia?: string;
}

export interface AnalysisResult {
  currentMonth: RouteData[];
  previousMonth: RouteData[];
  comparison: ComparisonRow[];
  inconsistencies: ComparisonRow[];
}

export enum FileType {
  CURRENT = '1',
  PREVIOUS = '2'
}
