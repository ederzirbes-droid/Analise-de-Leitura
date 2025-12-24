
import React, { useState, useMemo } from 'react';
import { AnalysisResult, RouteData } from '../types';
import { Info, Users, TrendingUp, TrendingDown, ChevronUp, ChevronDown, ArrowUpDown, Filter, MapPin, Ban, History, BarChart2, Minus, AlertTriangle, UserPlus, UserMinus, Power, Layers, Hash, FileText, AlertCircle } from 'lucide-react';

interface DashboardProps {
  data: AnalysisResult;
  aiInsight?: string;
}

type SortConfig<T> = {
  key: keyof T | null;
  direction: 'asc' | 'desc';
};

type GDFilter = 'all' | 'gd' | 'normal';

const Dashboard: React.FC<DashboardProps> = ({ data, aiInsight }) => {
  const [ucSort, setUcSort] = useState<SortConfig<RouteData>>({ key: null, direction: 'desc' });
  const [gdFilter, setGdFilter] = useState<GDFilter>('all');
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [nonReadFilter, setNonReadFilter] = useState<string>('all');
  
  // Estados para os filtros específicos da seção de divergências
  const [divergenceRouteFilter, setDivergenceRouteFilter] = useState<string>('all');
  const [divergenceMgFilter, setDivergenceMgFilter] = useState<string>('all');

  // Estado para o filtro de ocorrências recorrentes
  const [recurringOccFilter, setRecurringOccFilter] = useState<string>('all');

  // Cálculo do resumo comparativo por rota (Focado apenas nas rotas do Mês Atual)
  const routeComparisonSummary = useMemo(() => {
    const summaryMap = new Map<string, { anterior: number, atual: number }>();
    
    data.currentMonth.forEach(item => {
      const rota = item.codigoRota || item.rota || 'Não Informada';
      if (!summaryMap.has(rota)) {
        summaryMap.set(rota, { anterior: 0, atual: 0 });
      }
      const stats = summaryMap.get(rota)!;
      stats.atual += 1;
    });

    data.previousMonth.forEach(item => {
      const rota = item.codigoRota || item.rota || 'Não Informada';
      if (summaryMap.has(rota)) {
        const stats = summaryMap.get(rota)!;
        stats.anterior += 1;
      }
    });

    return Array.from(summaryMap.entries())
      .map(([rota, stats]) => ({ 
        rota, 
        totalAnterior: stats.anterior,
        totalAtual: stats.atual,
        diff: stats.atual - stats.anterior
      }))
      .sort((a, b) => b.totalAtual - a.totalAtual);
  }, [data.previousMonth, data.currentMonth]);

  // Identificação das UCs específicas que geram a diferença
  const divergenceDetails = useMemo(() => {
    const activeRoutes = new Set<string>(data.currentMonth.map((u: RouteData) => u.codigoRota || u.rota || 'Não Informada'));
    
    const prevUCsByRoute = new Map<string, Map<string, RouteData>>();
    data.previousMonth.forEach((u: RouteData) => {
      const rota: string = u.codigoRota || u.rota || 'Não Informada';
      if (activeRoutes.has(rota)) {
        if (!prevUCsByRoute.has(rota)) prevUCsByRoute.set(rota, new Map<string, RouteData>());
        prevUCsByRoute.get(rota)!.set(u.codigoUc, u);
      }
    });

    const currUCsByRoute = new Map<string, Map<string, RouteData>>();
    data.currentMonth.forEach((u: RouteData) => {
      const rota: string = u.codigoRota || u.rota || 'Não Informada';
      if (!currUCsByRoute.has(rota)) currUCsByRoute.set(rota, new Map<string, RouteData>());
      currUCsByRoute.get(rota)!.set(u.codigoUc, u);
    });

    const results: { uc: string, nome: string, endereco: string, rota: string, ligado: string, microGeracao: string, status: 'Faltante' | 'Nova' }[] = [];

    activeRoutes.forEach((rota: string) => {
      const prevMap = prevUCsByRoute.get(rota) || new Map<string, RouteData>();
      const currMap = currUCsByRoute.get(rota) || new Map<string, RouteData>();

      prevMap.forEach((u, code) => {
        if (!currMap.has(code)) {
          results.push({ 
            uc: code, 
            nome: u.consumidorNome, 
            endereco: u.endereco || 'N/I',
            rota, 
            ligado: u.statusLigado || 'N/A', 
            microGeracao: u.microGeracao, 
            status: 'Faltante' 
          });
        }
      });

      currMap.forEach((u, code) => {
        if (!prevMap.has(code)) {
          results.push({ 
            uc: code, 
            nome: u.consumidorNome, 
            endereco: u.endereco || 'N/I',
            rota, 
            ligado: u.statusLigado || 'N/A', 
            microGeracao: u.microGeracao, 
            status: 'Nova' 
          });
        }
      });
    });

    return results.sort((a, b) => a.rota.localeCompare(b.rota, undefined, { numeric: true }));
  }, [data.currentMonth, data.previousMonth]);

  // RELATÓRIO DE OCORRÊNCIAS RECORRENTES (Sem exclusões fixas)
  const allRecurringOccurrences = useMemo(() => {
    const prevMap = new Map<string, string>();
    data.previousMonth.forEach(u => prevMap.set(u.codigoUc, u.descricaoNaoLeitura?.trim().toUpperCase()));

    return data.currentMonth
      .filter(u => {
        const currentOcc = u.descricaoNaoLeitura?.trim().toUpperCase();
        const prevOcc = prevMap.get(u.codigoUc);
        
        // Verifica se a ocorrência existe e é igual à do mês passado
        return currentOcc && currentOcc === prevOcc;
      })
      .map(u => ({
        uc: u.codigoUc,
        nome: u.consumidorNome,
        rota: u.codigoRota,
        ocorrencia: u.descricaoNaoLeitura
      }));
  }, [data.currentMonth, data.previousMonth]);

  // Lista única de ocorrências que são recorrentes para o filtro
  const uniqueRecurringOptions = useMemo(() => {
    const options = Array.from(new Set(allRecurringOccurrences.map(o => o.ocorrencia)))
      .sort((a, b) => a.localeCompare(b));
    return options;
  }, [allRecurringOccurrences]);

  // Aplicação do filtro de ocorrência selecionada
  const filteredRecurringOccurrences = useMemo(() => {
    if (recurringOccFilter === 'all') return allRecurringOccurrences;
    return allRecurringOccurrences.filter(o => o.ocorrencia === recurringOccFilter);
  }, [allRecurringOccurrences, recurringOccFilter]);

  const handleSort = <T,>(
    key: keyof T, 
    currentConfig: SortConfig<T>, 
    setConfig: React.Dispatch<React.SetStateAction<SortConfig<T>>>
  ) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (currentConfig.key === key && currentConfig.direction === 'asc') {
      direction = 'desc';
    }
    setConfig({ key, direction });
  };

  const uniqueRoutes = useMemo(() => {
    const routes = Array.from(new Set(data.currentMonth.map(i => i.codigoRota)))
      .filter((r): r is string => Boolean(r))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return routes;
  }, [data.currentMonth]);

  const uniqueNonReads = useMemo(() => {
    let itemsForReasons = data.currentMonth;
    if (routeFilter !== 'all') {
      itemsForReasons = itemsForReasons.filter(i => i.codigoRota === routeFilter);
    }
    const reasons = Array.from(new Set(itemsForReasons.map(i => i.descricaoNaoLeitura)))
      .filter((r): r is string => Boolean(r))
      .sort((a, b) => a.localeCompare(b));
    return reasons;
  }, [data.currentMonth, routeFilter]);

  const filteredAndSortedUCs = useMemo(() => {
    let items = [...data.currentMonth];
    if (gdFilter === 'gd') items = items.filter(i => i.microGeracao === 'S');
    else if (gdFilter === 'normal') items = items.filter(i => i.microGeracao !== 'S');
    if (routeFilter !== 'all') items = items.filter(i => i.codigoRota === routeFilter);
    if (nonReadFilter !== 'all') items = items.filter(i => i.descricaoNaoLeitura === nonReadFilter);

    if (!ucSort.key) return items;
    return items.sort((a, b) => {
      // Fix: cast the dynamic indexed property access to 'any' to avoid the 'unknown' type error during comparison.
      // TypeScript sometimes struggles to narrow types when indexing generic objects without a fixed schema at runtime.
      const aVal = (a[ucSort.key!] as any) ?? 0;
      const bVal = (b[ucSort.key!] as any) ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') return ucSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return ucSort.direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data.currentMonth, ucSort, gdFilter, routeFilter, nonReadFilter]);

  const filteredDivergences = useMemo(() => {
    let results = [...divergenceDetails];
    if (divergenceRouteFilter !== 'all') {
      results = results.filter(d => d.rota === divergenceRouteFilter);
    }
    if (divergenceMgFilter !== 'all') {
      results = results.filter(d => d.microGeracao === divergenceMgFilter);
    }
    return results;
  }, [divergenceDetails, divergenceRouteFilter, divergenceMgFilter]);

  // Totalizadores separados para Faltantes e Novas
  const missingCount = useMemo(() => filteredDivergences.filter(d => d.status === 'Faltante').length, [filteredDivergences]);
  const newCount = useMemo(() => filteredDivergences.filter(d => d.status === 'Nova').length, [filteredDivergences]);

  const formatPercent = (val: number) => {
    const safeVal = val || 0;
    return (
      <div className={`inline-flex items-center gap-1 font-bold ${safeVal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {safeVal >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {safeVal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      </div>
    );
  };

  const SortIcon = <T,>({ columnKey, config }: { columnKey: keyof T, config: SortConfig<T> }) => {
    if (config.key !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return config.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-600" /> : <ChevronDown className="w-3 h-3 text-indigo-600" />;
  };

  const getMicroGeracaoLabel = (code: string) => {
    switch (code) {
      case 'S': return { text: 'GD', class: 'bg-green-100 text-green-700 border-green-200' };
      case 'P': return { text: 'Participante', class: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'X': return { text: 'Vinculada', class: 'bg-purple-100 text-purple-700 border-purple-200' };
      default: return { text: 'Normal', class: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  };

  const ucColumns = [
    { label: 'Código UC', key: 'codigoUc', align: 'left' },
    { label: 'Consumidor', key: 'consumidorNome', align: 'left' },
    { label: 'Rota', key: 'codigoRota', align: 'center' },
    { label: 'Var. Consumo %', key: 'varConsumo', align: 'right' },
    { label: 'Var. GD %', key: 'varGD', align: 'right', isGd: true },
    { label: 'Consumo Atual', key: 'consumoMes', align: 'right' },
    { label: 'Consumo Anterior', key: 'consumoMes1', align: 'right' },
    { label: 'Injetada Atual', key: 'injetadaAtual', align: 'right', isGd: true },
    { label: 'Injetada Anterior', key: 'injetadaAnterior', align: 'right', isGd: true },
  ].filter(col => gdFilter !== 'normal' || !col.isGd);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Detalhamento por Rota (Unidades Consumidoras) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800 text-lg">Análise Detalhada por UC</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm min-w-[150px]">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase">Rota:</span>
              <select 
                value={routeFilter} 
                onChange={(e) => {
                  setRouteFilter(e.target.value);
                  setNonReadFilter('all'); 
                }} 
                className="text-sm font-medium text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer outline-none flex-1 truncate"
              >
                <option value="all">Todas</option>
                {uniqueRoutes.map(route => <option key={route} value={route}>{route}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm min-w-[180px]">
              <Ban className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase text-nowrap">Ocorrência:</span>
              <select 
                value={nonReadFilter} 
                onChange={(e) => setNonReadFilter(e.target.value)} 
                className="text-sm font-medium text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer outline-none flex-1 truncate"
              >
                <option value="all">Todas as Ocorrências</option>
                {uniqueNonReads.map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase">Tipo:</span>
              <select value={gdFilter} onChange={(e) => setGdFilter(e.target.value as GDFilter)} className="text-sm font-medium text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer outline-none">
                <option value="all">Todos</option>
                <option value="gd">UC com GD</option>
                <option value="normal">UC Normal</option>
              </select>
            </div>
            <span className="hidden lg:block text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">
              {filteredAndSortedUCs.length} registros
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
              <tr>
                {ucColumns.map((col) => (
                  <th key={col.label} onClick={() => handleSort(col.key as keyof RouteData, ucSort, setUcSort)} className={`px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-50 transition-colors group ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                      {col.label}
                      <SortIcon columnKey={col.key as keyof RouteData} config={ucSort} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedUCs.map((row, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-4 py-4 text-sm font-mono text-slate-600 group-hover:text-indigo-700">
                    <div className="flex items-center gap-2">
                      {row.codigoUc}
                      {row.microGeracao === 'S' && <span className="bg-green-100 text-green-600 text-[9px] font-bold px-1.5 py-0.5 rounded" title="Unidade com GD">GD</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-slate-700 truncate max-w-[200px]">
                    <div className="flex flex-col">
                      <span>{row.consumidorNome}</span>
                      {row.descricaoNaoLeitura && row.descricaoNaoLeitura !== 'Leitura Realizada' && <span className="text-[10px] text-amber-600 font-semibold">{row.descricaoNaoLeitura}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 text-center">{row.codigoRota}</td>
                  <td className="px-4 py-4 text-sm text-right">{formatPercent(row.varConsumo)}</td>
                  {gdFilter !== 'normal' && <td className="px-4 py-4 text-sm text-right">{formatPercent(row.varGD)}</td>}
                  <td className="px-4 py-4 text-sm text-right font-medium text-slate-800">{(row.consumoMes || 0).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-4 text-sm text-right text-slate-500">{(row.consumoMes1 || 0).toLocaleString('pt-BR')}</td>
                  {gdFilter !== 'normal' && (
                    <>
                      <td className="px-4 py-4 text-sm text-right font-medium text-indigo-600">{(row.injetadaAtual || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-4 text-sm text-right text-slate-500">{(row.injetadaAnterior || 0).toLocaleString('pt-BR')}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RELATÓRIO: Comparativo de UCs por Rota */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800 text-lg">Comparativo de Rotas em Andamento (P1 vs P2)</h3>
          </div>
          <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded">Apenas Rotas Atuais</span>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rota Ativa</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Anterior (P2)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right bg-indigo-50/30">Atual (P1)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Variação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routeComparisonSummary.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700">{item.rota}</td>
                  <td className="px-6 py-4 text-sm text-right font-mono text-slate-500">{item.totalAnterior.toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-4 text-sm text-right font-mono text-indigo-600 font-bold bg-indigo-50/10">{item.totalAtual.toLocaleString('pt-BR')}</td>
                  <td className={`px-6 py-4 text-sm text-right font-mono font-bold ${item.diff > 0 ? 'text-green-600' : item.diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {item.diff > 0 ? <TrendingUp className="w-3 h-3" /> : item.diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString('pt-BR')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RELATÓRIO: Detalhamento de Divergências de Cadastro */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-amber-50/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-800 text-lg">Detalhamento de Divergências</h3>
            </div>
            {/* TOTALIZADORES SEPARADOS */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-red-100 text-red-800 px-3 py-1 rounded-lg border border-red-200 shadow-sm animate-in zoom-in-95 duration-300">
                <UserMinus className="w-3.5 h-3.5" />
                <span className="text-sm font-bold">{missingCount}</span>
                <span className="text-[10px] font-bold uppercase tracking-tight opacity-70">Ausentes</span>
              </div>
              <div className="flex items-center gap-1.5 bg-green-100 text-green-800 px-3 py-1 rounded-lg border border-green-200 shadow-sm animate-in zoom-in-95 duration-300">
                <UserPlus className="w-3.5 h-3.5" />
                <span className="text-sm font-bold">{newCount}</span>
                <span className="text-[10px] font-bold uppercase tracking-tight opacity-70">Novas</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 shadow-sm min-w-[150px]">
              <MapPin className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 uppercase">Filtrar Rota:</span>
              <select 
                value={divergenceRouteFilter} 
                onChange={(e) => setDivergenceRouteFilter(e.target.value)} 
                className="text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer outline-none flex-1 truncate"
              >
                <option value="all">Todas as Rotas</option>
                {uniqueRoutes.map(route => <option key={route} value={route}>{route}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 shadow-sm min-w-[150px]">
              <Layers className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 uppercase">Tipo Consumidor:</span>
              <select 
                value={divergenceMgFilter} 
                onChange={(e) => setDivergenceMgFilter(e.target.value)} 
                className="text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer outline-none flex-1"
              >
                <option value="all">Todos os Tipos</option>
                <option value="N">Normal</option>
                <option value="P">Participante</option>
                <option value="S">GD</option>
                <option value="X">Vinculada</option>
              </select>
            </div>

            <span className="hidden md:inline-block text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-100 px-2 py-1 rounded">Análise de Diferença</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Código UC</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Consumidor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Endereço</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Rota</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Ligado (P1)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status da Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDivergences.map((item, idx) => {
                const tipoInfo = getMicroGeracaoLabel(item.microGeracao);
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">{item.uc}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-700">{item.nome}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase w-fit ${tipoInfo.class}`}>
                          {tipoInfo.text}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-[250px] truncate" title={item.endereco}>
                      {item.endereco}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 text-center">{item.rota}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-600 bg-slate-100/50 px-2 py-1 rounded w-fit mx-auto">
                        <Power className="w-3 h-3" />
                        {item.ligado}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.status === 'Faltante' ? (
                        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-xs font-bold">
                          <UserMinus className="w-3 h-3" /> Ausente no Mês Atual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 px-2.5 py-1 rounded-full text-xs font-bold">
                          <UserPlus className="w-3 h-3" /> Nova UC Detectada
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredDivergences.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhuma divergência de cadastro encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RELATÓRIO: Ocorrências Recorrentes (COM FILTRO) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-red-50/20">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Detalhamento de Ocorrências Recorrentes</h3>
              <p className="text-xs text-slate-500">Filtragem dinâmica de impedimentos crônicos de leitura</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-red-200 rounded-lg px-3 py-1.5 shadow-sm min-w-[200px]">
              <Ban className="w-4 h-4 text-red-500" />
              <span className="text-[10px] font-bold text-red-600 uppercase">Ocorrência:</span>
              <select 
                value={recurringOccFilter} 
                onChange={(e) => setRecurringOccFilter(e.target.value)} 
                className="text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer outline-none flex-1 truncate"
              >
                <option value="all">Todas as Recorrentes</option>
                {uniqueRecurringOptions.map(occ => <option key={occ} value={occ}>{occ}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-white border border-red-200 rounded-lg px-3 py-1.5 shadow-sm">
               <Hash className="w-3.5 h-3.5 text-red-400" />
               <span className="text-sm font-bold text-red-700">{filteredRecurringOccurrences.length}</span>
               <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Casos</span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Código UC</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Consumidor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Rota</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ocorrência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecurringOccurrences.map((item, idx) => (
                <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">{item.uc}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{item.nome}</td>
                  <td className="px-6 py-4 text-sm text-center text-slate-500">{item.rota}</td>
                  <td className="px-6 py-4 text-sm font-bold text-red-600">
                    <span className="inline-block bg-red-100/50 px-2 py-1 rounded">
                      {item.ocorrencia}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRecurringOccurrences.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhuma ocorrência recorrente detectada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100">
           <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed">
             * Este relatório identifica unidades que apresentaram o mesmo status de leitura em ambos os meses. 
             Use o filtro acima para isolar impedimentos específicos (como impedimentos de acesso ou desvios) que persistem no faturamento.
           </p>
        </div>
      </div>

      {aiInsight && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 shadow-inner">
          <div className="flex items-start gap-4">
            <div className="bg-white p-2 rounded-lg shadow-sm">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-indigo-900 font-bold mb-1">Laudo de Consumo e GD</h3>
              <p className="text-indigo-800/80 text-sm leading-relaxed whitespace-pre-wrap font-medium">{aiInsight}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
