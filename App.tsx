
import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileCheck, BarChart3, AlertCircle, FileText, RefreshCw, FolderOpen, Mail, Copyright } from 'lucide-react';
import { AnalysisResult, RouteData, ComparisonRow } from './types';
import Dashboard from './components/Dashboard';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [previousFile, setPreviousFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('');
  
  const folderInputRef = useRef<HTMLInputElement>(null);

  const calculateVar = (atual: number, anterior: number) => {
    if (anterior <= 0) return (atual || 0) > 0 ? 100 : 0;
    return (((atual || 0) - anterior) / anterior) * 100;
  };

  const parseCSV = (text: string): RouteData[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) throw new Error("Arquivo CSV vazio ou mal formatado.");
    
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const headers = firstLine.toLowerCase().split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    const ucIdx = headers.findIndex(h => h === 'codigouc' || h.includes('uc'));
    const nomeIdx = headers.findIndex(h => h === 'consumidornome' || h.includes('consumidor'));
    const codRotaIdx = headers.findIndex(h => h === 'codigorota' || h === 'codigo rota' || (h.includes('rota') && h.includes('cod')));
    const rotaIdx = headers.findIndex(h => h === 'rota' || (h.includes('rota') && !h.includes('cod')));
    const qtdIdx = headers.findIndex(h => h.includes('quant') || h.includes('qtd') || h === 'valor');
    const consumoMesIdx = headers.findIndex(h => h === 'consumomes' || h.includes('consumo atual'));
    const consumoMes1Idx = headers.findIndex(h => h === 'consumomes1' || h.includes('consumo anterior'));
    const consumoMgIdx = headers.findIndex(h => h === 'consumomg' || h.includes('injetada'));
    const mgIdx = headers.findIndex(h => h === 'microgeracao' || h === 'gd' || h.includes('microger'));
    const naoLeituraIdx = headers.findIndex(h => h === 'descricaonaoleitura' || h.includes('nao leitura') || h.includes('não leitura'));
    const ligadoIdx = headers.findIndex(h => h === 'ligado' || h === 'status' || h.includes('ligado') || h.includes('situação'));
    const enderecoIdx = headers.findIndex(h => h === 'endereco' || h === 'endereço' || h.includes('logradouro'));

    if (qtdIdx === -1) throw new Error("Coluna de quantidade/valor não encontrada.");

    return lines.slice(1)
      .filter(line => line.trim().length > 0)
      .map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const routeLabel = values[rotaIdx !== -1 ? rotaIdx : (codRotaIdx !== -1 ? codRotaIdx : 0)] || 'N/A';
        const parseNum = (val: string) => parseFloat(val?.replace(',', '.') || '0') || 0;

        return {
          rota: routeLabel,
          quantidade: parseInt(values[qtdIdx]?.replace(/\D/g, '')) || 0,
          codigoUc: values[ucIdx] || '-',
          consumidorNome: values[nomeIdx] || '-',
          consumidornome: values[nomeIdx] || '-',
          codigoRota: values[codRotaIdx] || routeLabel,
          consumoMes: parseNum(values[consumoMesIdx]),
          consumoMes1: parseNum(values[consumoMes1Idx]),
          tempConsumoMg: parseNum(values[consumoMgIdx]),
          microGeracao: values[mgIdx]?.toUpperCase() || 'N',
          injetadaAtual: 0,
          injetadaAnterior: 0,
          varConsumo: 0,
          varGD: 0,
          descricaoNaoLeitura: values[naoLeituraIdx] || 'Leitura Realizada',
          statusLigado: ligadoIdx !== -1 ? values[ligadoIdx] : 'N/I',
          endereco: enderecoIdx !== -1 ? values[enderecoIdx] : 'N/I'
        };
      });
  };

  const aggregateByRoute = (data: RouteData[]): { [key: string]: number } => {
    return data.reduce((acc: { [key: string]: number }, curr) => {
      const key = curr.rota.toLowerCase();
      acc[key] = (acc[key] || 0) + curr.quantidade;
      return acc;
    }, {});
  };

  const getAIInsights = async (result: AnalysisResult) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const totalConsumoAtual = result.currentMonth.reduce((acc, curr) => acc + curr.consumoMes, 0);
      const totalConsumoAnterior = result.currentMonth.reduce((acc, curr) => acc + curr.consumoMes1, 0);
      const totalInjetadaAtual = result.currentMonth.reduce((acc, curr) => acc + curr.injetadaAtual, 0);
      const totalInjetadaAnterior = result.currentMonth.reduce((acc, curr) => acc + curr.injetadaAnterior, 0);

      const activeRouteAnomalies = result.comparison
        .filter(r => r.qtdAtual > 0 && Math.abs(r.percentual) > 15)
        .slice(0, 10)
        .map(r => `Rota ${r.rota}: ${r.qtdAtual} UCs faturadas (variação de ${r.percentual}% vs histórico)`)
        .join('; ');
      
      const prompt = `
        Você é um auditor sênior de faturamento de energia elétrica. 
        Elabore um LAUDO DE CONSUMO E GD focado EXCLUSIVAMENTE nas leituras realizadas no MÊS ATUAL (P1).
        O objetivo é comparar o desempenho e o cadastro das rotas ativas neste mês contra o histórico dessas mesmas unidades no Mês Anterior (P2).
        
        CONTEXTO DAS LEITURAS DESTE MÊS:
        - Total de Consumo Faturado (P1): ${totalConsumoAtual.toLocaleString('pt-BR')} kWh
        - Consumo Histórico das mesmas UCs (P2): ${totalConsumoAnterior.toLocaleString('pt-BR')} kWh
        - Injeção GD Faturada (P1): ${totalInjetadaAtual.toLocaleString('pt-BR')} kWh
        - Injeção GD Histórica (P2): ${totalInjetadaAnterior.toLocaleString('pt-BR')} kWh
        
        VARIAÇÕES NAS ROTAS ATIVAS (Top 10):
        ${activeRouteAnomalies || "Sem variações críticas detectadas nas rotas atuais."}

        O laudo deve ser profissional, direto e em Português, estruturado em:
        1. SÍNTESE DO FATURAMENTO ATUAL (Comparação direta dos totais do mês)
        2. ANÁLISE DE GD (Comportamento das unidades com microgeração neste faturamento)
        3. PONTOS DE ATENÇÃO (Inconsistências detectadas nas rotas que estão sendo lidas agora)
        4. CONCLUSÃO TÉCNICA
        
        Importante: Ignore rotas que existiam no mês anterior mas não possuem leituras neste mês. O foco é a auditoria do que está sendo faturado HOJE.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: "Você é um especialista em auditoria energética. Seu foco é validar as leituras do mês atual comparando-as com o histórico, identificando erros de faturamento ou perdas técnicas."
        }
      });
      setAiInsight(response.text || "");
    } catch (error) {
      console.error(error);
      setAiInsight("Não foi possível gerar o laudo automático no momento.");
    }
  };

  const processFiles = async () => {
    if (!currentFile || !previousFile) return;
    setLoading(true);
    try {
      const [currText, prevText] = await Promise.all([currentFile.text(), previousFile.text()]);
      const currentMonthRaw = parseCSV(currText);
      const previousMonthRaw = parseCSV(prevText);

      const prevMap = new Map();
      previousMonthRaw.forEach(item => prevMap.set(item.codigoUc, item));

      const mergedCurrentMonth = currentMonthRaw.map(item => {
        const prevItem = prevMap.get(item.codigoUc);
        const injetadaAtual = item.tempConsumoMg || 0;
        const injetadaAnterior = prevItem ? (prevItem.tempConsumoMg || 0) : 0;
        const consumoMes1 = item.consumoMes1 || (prevItem ? prevItem.consumoMes : 0);
        
        return {
          ...item,
          injetadaAtual,
          injetadaAnterior,
          consumoMes1,
          varConsumo: calculateVar(item.consumoMes, consumoMes1),
          varGD: calculateVar(injetadaAtual, injetadaAnterior)
        };
      });

      const currentAgg = aggregateByRoute(mergedCurrentMonth);
      const previousAgg = aggregateByRoute(previousMonthRaw);
      const allRouteKeys = Array.from(new Set([...Object.keys(currentAgg), ...Object.keys(previousAgg)]));

      const comparison: ComparisonRow[] = allRouteKeys.map(key => {
        const curr = currentAgg[key] || 0;
        const prev = previousAgg[key] || 0;
        const diff = curr - prev;
        const percent = calculateVar(curr, prev);
        const originalName = mergedCurrentMonth.find(r => r.rota.toLowerCase() === key)?.rota 
                          || previousMonthRaw.find(r => r.rota.toLowerCase() === key)?.rota 
                          || key;

        let inconsistencia = undefined;
        if (prev === 0 && curr > 0) inconsistencia = "Rota Nova";
        else if (curr === 0 && prev > 0) inconsistencia = "Rota Descontinuada";
        else if (Math.abs(percent) > 50) inconsistencia = "Variação Crítica (>50%)";

        return {
          rota: originalName,
          qtdAnterior: prev,
          qtdAtual: curr,
          diferenca: diff,
          percentual: parseFloat(percent.toFixed(2)),
          inconsistencia
        };
      }).sort((a, b) => b.qtdAtual - a.qtdAtual);

      const result: AnalysisResult = {
        currentMonth: mergedCurrentMonth,
        previousMonth: previousMonthRaw,
        comparison,
        inconsistencies: comparison.filter(c => c.inconsistencia)
      };

      setAnalysisResult(result);
      getAIInsights(result);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.startsWith('1')) setCurrentFile(file);
    else if (file.name.startsWith('2')) setPreviousFile(file);
    else alert("O nome do arquivo deve começar com '1' ou '2'.");
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    let f1: File | null = null, f2: File | null = null;
    (Array.from(files) as File[]).forEach(f => {
      if (f.name.startsWith('1')) f1 = f;
      if (f.name.startsWith('2')) f2 = f;
    });
    if (f1) setCurrentFile(f1);
    if (f2) setPreviousFile(f2);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-indigo-700 text-white py-6 px-8 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Análise de Leitura</h1>
              <p className="text-indigo-100 text-sm">Controle de Consumo e GD</p>
            </div>
          </div>
          {analysisResult && (
            <button onClick={() => {setAnalysisResult(null); setCurrentFile(null); setPreviousFile(null); setAiInsight('');}} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md transition-colors">
              <RefreshCw className="w-4 h-4" /> Novo Relatório
            </button>
          )}
        </div>
      </header>
      
      {/* AVISO DE DIREITOS E CRÉDITOS */}
      <div className="bg-slate-100 border-b border-slate-200 py-3 px-8 mb-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <Copyright className="w-3.5 h-3.5" />
            <span>Todos Direitos Reservados.</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6">
            <span>Desenvolvido por <strong className="text-slate-700">Éder Derli Zirbes</strong></span>
            <div className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-default">
              <Mail className="w-3.5 h-3.5" />
              <span>ederzirbes@gmail.com</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!analysisResult ? (
          <div className="max-w-3xl mx-auto mt-12">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold text-slate-800">Upload de Documentos</h2>
                <div className="relative">
                  <input type="file" ref={folderInputRef} onChange={handleFolderUpload} webkitdirectory="" directory="" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold border border-indigo-200"><FolderOpen className="w-4 h-4" />Selecionar Pasta</button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${previousFile ? 'border-green-300 bg-green-50' : 'border-slate-300'}`}>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 mb-3 flex items-center justify-center rounded-full bg-slate-100">{previousFile ? <FileCheck className="text-green-600" /> : <Upload />}</div>
                    <p className="text-sm font-medium">Anterior (Começa c/ 2)</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">{previousFile?.name || 'Clique aqui'}</p>
                  </div>
                </div>
                <div className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${currentFile ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300'}`}>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 mb-3 flex items-center justify-center rounded-full bg-slate-100">{currentFile ? <FileCheck className="text-indigo-600" /> : <Upload />}</div>
                    <p className="text-sm font-medium">Atual (Começa c/ 1)</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">{currentFile?.name || 'Clique aqui'}</p>
                  </div>
                </div>
              </div>
              <button disabled={!currentFile || !previousFile || loading} onClick={processFiles} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg shadow-md flex items-center justify-center gap-2">
                {loading ? <RefreshCw className="animate-spin" /> : <BarChart3 />} {loading ? "Processando..." : "Gerar Análise"}
              </button>
            </div>
          </div>
        ) : (
          <Dashboard data={analysisResult} aiInsight={aiInsight} />
        )}
      </main>
    </div>
  );
};

export default App;
