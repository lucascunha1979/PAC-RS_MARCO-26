const CONFIG = {
  dataFile: "data/pac_rs_painel_detalhado.csv",
  defaultUpdateLabel: "março de 2026",
  chartFont: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
};

const APP = {
  raw: [],
  filters: {
    municipio: null,
    eixo: null,
    subeixo: null,
    modalidade: null,
    empreendimento: null,
    inclusao_novo_pac: null,
    tipo_executor: null,
    estagio: null,
    fontes_financiamento: null,
    classificacao: null,
    ano_prev_conclusao: null,
    ministerio: null          // ← novo
  }
};

const ELS = {};

document.addEventListener("DOMContentLoaded", () => {
  captureEls();
  bindUI();
  loadData();
});

function captureEls() {
  ELS.heroAtualizacao  = document.getElementById("heroAtualizacao");
  ELS.statusLine       = document.getElementById("statusLine");
  ELS.municipioSearch  = document.getElementById("municipioSearch");
  ELS.municipioSelect  = document.getElementById("municipioSelect");
  ELS.activeFilters    = document.getElementById("activeFilters");
  ELS.btnReset         = document.getElementById("btnReset");
  ELS.btnPdf           = document.getElementById("btnPdf");
  ELS.btnPdfSecondary  = document.getElementById("btnPdfSecondary");
  ELS.kpiValor         = document.getElementById("kpiValor");
  ELS.kpiExec          = document.getElementById("kpiExec");
  ELS.kpiEmp           = document.getElementById("kpiEmp");
  ELS.kpiMun           = document.getElementById("kpiMun");
  ELS.hierSummary      = document.getElementById("hierSummary");
  ELS.hierBreadcrumb   = document.getElementById("hierBreadcrumb");
  ELS.tables           = document.getElementById("tables");
  ELS.plots = {
    eixo:               document.getElementById("plotEixo"),
    subeixo:            document.getElementById("plotSubeixo"),
    modalidade:         document.getElementById("plotModalidade"),
    empreendimento:     document.getElementById("plotEmpreendimento"),
    inclusao_novo_pac:  document.getElementById("plotInclusao"),
    tipo_executor:      document.getElementById("plotExecutor"),
    estagio:            document.getElementById("plotEstagio"),
    fontes_financiamento: document.getElementById("plotFontes"),
    classificacao:      document.getElementById("plotClassificacao"),
    ano_prev_conclusao: document.getElementById("plotAno"),
    ministerio:         document.getElementById("plotMinisterio")   // ← novo
  };
}

function bindUI() {
  ELS.municipioSearch.addEventListener("input", () => populateMunicipioSelect(ELS.municipioSearch.value));
  ELS.municipioSelect.addEventListener("change", () => {
    APP.filters.municipio = ELS.municipioSelect.value === "__TODOS__" ? null : ELS.municipioSelect.value;
    renderAll();
  });
  ELS.btnReset.addEventListener("click", resetFilters);
  ELS.btnPdf.addEventListener("click", makePDF);
  ELS.btnPdfSecondary.addEventListener("click", makePDF);
}

function loadData() {
  Papa.parse(CONFIG.dataFile, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      APP.raw = data.map(normalizeRow).filter(r => r.municipio || r.empreendimento || r.eixo);
      if (!APP.raw.length) {
        setStatus("Nenhum dado encontrado no arquivo CSV.");
        return;
      }
      ELS.heroAtualizacao.textContent = CONFIG.defaultUpdateLabel;
      populateMunicipioSelect();
      renderAll();
    },
    error: (err) => {
      console.error(err);
      setStatus("Erro ao carregar a base. Verifique se o arquivo CSV está na pasta data/.");
    }
  });
}

function normalizeRow(r) {
  const row = {
    municipio:           cleanText(pick(r, ["municipio", "Município", "Municipio"])),
    empreendimento:      cleanText(pick(r, ["empreendimento", "Empreendimento"])),
    eixo:                cleanText(pick(r, ["eixo", "Eixo"])),
    subeixo:             cleanText(pick(r, ["subeixo", "Subeixo"])),
    modalidade:          cleanText(pick(r, ["modalidade", "Modalidade"])),
    classificacao:       cleanText(pick(r, ["classificacao", "Classificação", "Classificacao"])),
    estagio:             cleanText(pick(r, ["estagio", "Estágio", "Estagio"])),
    tipo_executor:       cleanText(pick(r, ["tipo_executor", "Tipo de Executor"])),
    inclusao_novo_pac:   cleanText(pick(r, ["inclusao_novo_pac", "Inclusão no Novo PAC", "Inclusao no Novo PAC"])),
    fontes_financiamento:cleanText(pick(r, ["fontes_financiamento", "Fontes de financiamento"])),
    ano_prev_conclusao:  cleanText(pick(r, ["ano_prev_conclusao", "Ano de previsão de conclusão"])),
    valor_total_rs:      toNumber(pick(r, ["valor_total_rs", "Estimativa de valor total do empreendimento (2023-2030), R$"])),
    execucao_fisica_pct: normalizeExecPct(toNumber(pick(r, ["execucao_fisica_pct", "Execução física (%)", "Percentual de execução do empreendimento (%)"]))),
    ministerio:          cleanText(pick(r, ["ministerio", "Ministério", "Ministerio"])),     // ← novo
    link:                cleanLink(pick(r, ["link", "Link"])),                                // ← novo
    uf:                  cleanText(pick(r, ["uf", "UF"]))                                    // ← novo
  };
  row.ano_prev_conclusao = row.ano_prev_conclusao || "Não informado";
  row.valor_total_rs = Number.isFinite(row.valor_total_rs) ? row.valor_total_rs : 0;
  row._empreendimento_uid = `${row.empreendimento}__${row.municipio}`;
  return row;
}

function pick(obj, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") return obj[key];
  }
  return "";
}

function cleanText(value) {
  if (value === null || value === undefined) return "Não informado";
  const txt = String(value).replace(/\s+/g, " ").trim();
  return txt || "Não informado";
}

// ← nova função: preserva URL, devolve string vazia se ausente
function cleanLink(value) {
  if (value === null || value === undefined) return "";
  const txt = String(value).trim();
  if (!txt || txt === "Não informado" || txt.toLowerCase() === "nan") return "";
  return txt;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return value;
  const raw = String(value).trim();
  if (!raw) return NaN;
  const cleaned = raw.replace(/R\$|%|\s/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(/,/g, ".") : cleaned.replace(/,/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : NaN;
}

function normalizeExecPct(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  let v = value;
  if (v > 1000) return null;
  while (v > 100) v = v / 10;
  return round2(v);
}

function populateMunicipioSelect(term = "") {
  const search = String(term).toLocaleLowerCase("pt-BR").trim();
  const options = [...new Set(APP.raw.map(d => d.municipio))].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const filtered = search ? options.filter(v => v.toLocaleLowerCase("pt-BR").includes(search)) : options;
  ELS.municipioSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "__TODOS__";
  allOpt.textContent = "Todos os municípios";
  ELS.municipioSelect.appendChild(allOpt);
  filtered.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    ELS.municipioSelect.appendChild(opt);
  });
  ELS.municipioSelect.value = APP.filters.municipio || "__TODOS__";
}

function resetFilters() {
  Object.keys(APP.filters).forEach(k => APP.filters[k] = null);
  ELS.municipioSearch.value = "";
  populateMunicipioSelect();
  renderAll();
}

function getFilteredRows() {
  return APP.raw.filter(row => Object.entries(APP.filters).every(([k,v]) => !v || row[k] === v));
}

function getRowsExcluding(targetKey) {
  return APP.raw.filter(row => Object.entries(APP.filters).every(([k,v]) => k === targetKey || !v || row[k] === v));
}

function renderAll() {
  const rows = getFilteredRows();
  setStatus(`${rows.length.toLocaleString("pt-BR")} registros no recorte atual.`);
  renderActiveFilters();
  renderKpis(rows);
  renderHierarchySummary(rows);
  renderBreadcrumb();
  // ── hierarquia ──────────────────────────────────────────────────────────
  renderBarChart({ key:"eixo",           rows:getRowsExcluding("eixo"),           element:ELS.plots.eixo,           color:"#0f4c81", sort:"asc",  clearChildren:["subeixo","modalidade","empreendimento"] });
  renderBarChart({ key:"subeixo",        rows:getRowsExcluding("subeixo"),        element:ELS.plots.subeixo,        color:"#146c94", sort:"asc",  clearChildren:["modalidade","empreendimento"] });
  renderBarChart({ key:"modalidade",     rows:getRowsExcluding("modalidade"),     element:ELS.plots.modalidade,     color:"#198f9b", sort:"asc",  clearChildren:["empreendimento"] });
  renderBarChart({ key:"empreendimento", rows:getRowsExcluding("empreendimento"), element:ELS.plots.empreendimento, color:"#0a7f61", sort:"desc", uniqueField:"_empreendimento_uid",
    labeler:(d) => APP.filters.municipio ? d.categoria : `${d.categoria} — ${d.municipio_ref}`,
    showLink: true  // ← ativa link no hover
  });
  // ── perfil do recorte ────────────────────────────────────────────────────
  renderPieChart({ key:"inclusao_novo_pac",   rows:getRowsExcluding("inclusao_novo_pac"),   element:ELS.plots.inclusao_novo_pac,   colors:["#0f4c81","#0a7f61","#d03b2d","#7b8aa0","#a855f7"] });
  renderPieChart({ key:"tipo_executor",       rows:getRowsExcluding("tipo_executor"),       element:ELS.plots.tipo_executor,       colors:["#0f4c81","#0a7f61","#d03b2d","#f59e0b","#7b8aa0"] });
  renderPieChart({ key:"estagio",             rows:getRowsExcluding("estagio"),             element:ELS.plots.estagio,             colors:["#0f4c81","#0a7f61","#d03b2d","#f59e0b"] });
  renderPieChart({ key:"fontes_financiamento",rows:getRowsExcluding("fontes_financiamento"),element:ELS.plots.fontes_financiamento,colors:["#0f4c81","#0a7f61","#d03b2d","#7b8aa0","#a855f7","#f59e0b"] });
  // ── leituras complementares ──────────────────────────────────────────────
  renderBarChart({ key:"classificacao", rows:getRowsExcluding("classificacao"), element:ELS.plots.classificacao, color:"#d03b2d", sort:"asc" });
  renderBarChart({ key:"ministerio",    rows:getRowsExcluding("ministerio"),    element:ELS.plots.ministerio,    color:"#7c3aed", sort:"asc" });  // ← novo
  renderYearChart(getRowsExcluding("ano_prev_conclusao"));
  buildTablesForPDF();
}

function renderActiveFilters() {
  const labels = {
    municipio:"Município", eixo:"Eixo", subeixo:"Subeixo", modalidade:"Modalidade",
    empreendimento:"Empreendimento", inclusao_novo_pac:"Inclusão no Novo PAC",
    tipo_executor:"Tipo de Executor", estagio:"Estágio",
    fontes_financiamento:"Fontes de financiamento", classificacao:"Classificação",
    ano_prev_conclusao:"Ano de previsão de conclusão",
    ministerio:"Ministério"   // ← novo
  };
  const active = Object.entries(APP.filters).filter(([,v])=>Boolean(v));
  if (!active.length) {
    ELS.activeFilters.className = "chip-wrap empty-state small-empty";
    ELS.activeFilters.textContent = "Nenhum filtro ativo além do recorte geral.";
    return;
  }
  ELS.activeFilters.className = "chip-wrap";
  ELS.activeFilters.innerHTML = active.map(([k,v]) => `<span class="chip">${labels[k]}: ${escapeHtml(v)} <button data-filter="${k}">×</button></span>`).join("");
  ELS.activeFilters.querySelectorAll("button").forEach(btn => btn.addEventListener("click", ()=> clearFilter(btn.dataset.filter)));
}

function clearFilter(key) {
  APP.filters[key] = null;
  if (key === "eixo")    APP.filters.subeixo = APP.filters.modalidade = APP.filters.empreendimento = null;
  if (key === "subeixo") APP.filters.modalidade = APP.filters.empreendimento = null;
  if (key === "modalidade") APP.filters.empreendimento = null;
  // ministerio é independente — sem cascade necessário
  renderAll();
}

function renderKpis(rows) {
  ELS.kpiValor.textContent = fmtMoney(sum(rows.map(d=>d.valor_total_rs)));
  ELS.kpiExec.textContent  = fmtPct(average(rows.map(d=>d.execucao_fisica_pct)));
  ELS.kpiEmp.textContent   = uniqueCount(rows, "empreendimento").toLocaleString("pt-BR");
  ELS.kpiMun.textContent   = uniqueCount(rows, "municipio").toLocaleString("pt-BR");
}

function renderHierarchySummary(rows) {
  ELS.hierSummary.innerHTML = [
    `<span class="summary-pill"><b>${uniqueCount(rows,"eixo").toLocaleString("pt-BR")}</b> eixos</span>`,
    `<span class="summary-pill"><b>${uniqueCount(rows,"subeixo").toLocaleString("pt-BR")}</b> subeixos</span>`,
    `<span class="summary-pill"><b>${uniqueCount(rows,"modalidade").toLocaleString("pt-BR")}</b> modalidades</span>`,
    `<span class="summary-pill"><b>${uniqueCount(rows,"empreendimento").toLocaleString("pt-BR")}</b> empreendimentos</span>`
  ].join("");
}

function renderBreadcrumb() {
  const parts = ["Todos"];
  if (APP.filters.eixo)          parts.push(APP.filters.eixo);
  if (APP.filters.subeixo)       parts.push(APP.filters.subeixo);
  if (APP.filters.modalidade)    parts.push(APP.filters.modalidade);
  if (APP.filters.empreendimento)parts.push(APP.filters.empreendimento);

  let html = escapeHtml(parts.join(" › "));

  // Botão "Ver detalhes" quando o empreendimento selecionado tem link
  if (APP.filters.empreendimento) {
    const row = APP.raw.find(r => r.empreendimento === APP.filters.empreendimento && r.link);
    if (row && row.link) {
      html += ` <a href="${escapeHtml(row.link)}" target="_blank" rel="noopener noreferrer"
                  class="btn btn-secondary"
                  style="font-size:0.8rem;min-height:28px;padding:0 10px;margin-left:10px;display:inline-flex;">
                  Ver detalhes ↗
                </a>`;
    }
  }

  ELS.hierBreadcrumb.innerHTML = html;
}

function summarizeBy(rows, key, uniqueField = null, labeler = null) {
  const groups = new Map();
  rows.forEach(row => {
    const groupKey = uniqueField ? row[uniqueField] : (row[key] || "Não informado");
    const label = row[key] || "Não informado";
    if (!groups.has(groupKey)) groups.set(groupKey, {
      categoria: label,
      municipio_ref: row.municipio,
      link_ref: row.link || "",          // ← novo: preserva link do primeiro registro do grupo
      valor_total_rs: 0,
      execValues: [],
      empreendimentos: new Set(),
      municipios: new Set(),
      registros: 0
    });
    const item = groups.get(groupKey);
    item.valor_total_rs += row.valor_total_rs || 0;
    if (Number.isFinite(row.execucao_fisica_pct)) item.execValues.push(row.execucao_fisica_pct);
    item.empreendimentos.add(row.empreendimento);
    item.municipios.add(row.municipio);
    item.registros += 1;
    // atualiza link se ainda não tinha um
    if (!item.link_ref && row.link) item.link_ref = row.link;
  });
  return [...groups.values()].map(item => ({
    categoria:          labeler ? labeler(item) : item.categoria,
    categoria_raw:      item.categoria,
    municipio_ref:      item.municipio_ref,
    link_ref:           item.link_ref,                // ← novo
    valor_total_rs:     item.valor_total_rs,
    execucao_media:     average(item.execValues),
    qtd_empreendimentos:item.empreendimentos.size,
    qtd_municipios:     item.municipios.size,
    registros:          item.registros
  }));
}

function renderBarChart({ key, rows, element, color, sort="asc", clearChildren=[], uniqueField=null, labeler=null, showLink=false }) {
  const summary = summarizeBy(rows, key, uniqueField, labeler).sort((a,b)=> sort==="asc" ? a.valor_total_rs-b.valor_total_rs : b.valor_total_rs-a.valor_total_rs);
  if (!summary.length) return renderEmptyPlot(element, "Sem dados para este recorte.");
  const cats   = summary.map(d=>trimLabel(d.categoria, key==="empreendimento"?72:42));
  const vals   = summary.map(d=>d.valor_total_rs);
  // customdata[6] = link (apenas para empreendimento)
  const custom = summary.map(d=>[
    d.categoria_raw,
    fmtMoney(d.valor_total_rs),
    fmtPct(d.execucao_media),
    d.qtd_empreendimentos.toLocaleString("pt-BR"),
    d.qtd_municipios.toLocaleString("pt-BR"),
    d.registros.toLocaleString("pt-BR"),
    d.link_ref || ""
  ]);
  // hover extra para empreendimento: mostra link se houver
  const linkLine = showLink
    ? "<br>%{customdata[6]}<extra></extra>"
    : "<extra></extra>";
  const hovertemplate = `<b>%{customdata[0]}</b><br>Valor total: %{customdata[1]}<br>Execução média: %{customdata[2]}<br>Empreendimentos: %{customdata[3]}<br>Municípios: %{customdata[4]}<br>Registros: %{customdata[5]}${linkLine}`;

  const trace = {
    type:"bar", orientation:"h", x:vals, y:cats,
    marker:{color,line:{color:"rgba(255,255,255,0.85)",width:1.1}},
    customdata:custom, hovertemplate
  };
  const layout = baseLayout({height:Math.max(360, summary.length*26+120), margin:{l:key==="empreendimento"?420:250,r:26,t:18,b:56}});
  layout.xaxis = { title:{text:"Valor total (R$)",standoff:16}, tickmode:"array", ...buildCurrencyTicks(vals), gridcolor:"rgba(15,76,129,0.09)", zerolinecolor:"rgba(15,76,129,0.15)", automargin:true, tickfont:{size:11} };
  layout.yaxis = { automargin:true, autorange:"reversed", categoryorder:"array", categoryarray:cats, tickfont:{size:11} };
  if (typeof element.removeAllListeners === "function") element.removeAllListeners("plotly_click");
  Plotly.react(element, [trace], layout, plotConfig()).then(()=>{
    element.on("plotly_click", (ev)=>{
      const label = ev.points?.[0]?.customdata?.[0]; if (!label) return;
      APP.filters[key] = APP.filters[key] === label ? null : label;
      clearChildren.forEach(child => APP.filters[child] = null);
      renderAll();
    });
  });
}

function renderPieChart({ key, rows, element, colors }) {
  const summary = summarizeBy(rows, key).sort((a,b)=>a.valor_total_rs-b.valor_total_rs);
  if (!summary.length) return renderEmptyPlot(element, "Sem dados para este recorte.");
  const total = sum(summary.map(d=>d.valor_total_rs));
  const trace = {
    type:"pie", labels:summary.map(d=>d.categoria_raw), values:summary.map(d=>d.valor_total_rs),
    textinfo:"label+percent", textposition:"inside", sort:false, hole:0.34,
    marker:{colors,line:{color:"#fff",width:2}},
    customdata:summary.map(d=>[fmtMoney(d.valor_total_rs),fmtPct(d.execucao_media),d.qtd_empreendimentos.toLocaleString("pt-BR"),d.qtd_municipios.toLocaleString("pt-BR"),pctValue(d.valor_total_rs,total)]),
    hovertemplate:"<b>%{label}</b><br>Valor total: %{customdata[0]}<br>Participação: %{customdata[4]}<br>Execução média: %{customdata[1]}<br>Empreendimentos: %{customdata[2]}<br>Municípios: %{customdata[3]}<extra></extra>"
  };
  const layout = baseLayout({height:420, margin:{l:10,r:10,t:10,b:10}, showlegend:true, legend:{orientation:"v",x:1.02,xanchor:"left",y:0.5,font:{size:11}}});
  if (typeof element.removeAllListeners === "function") element.removeAllListeners("plotly_click");
  Plotly.react(element, [trace], layout, plotConfig()).then(()=>
    element.on("plotly_click", ev => { const label=ev.points?.[0]?.label; if(!label) return; APP.filters[key]=APP.filters[key]===label?null:label; renderAll(); })
  );
}

function renderYearChart(rows) {
  const element = ELS.plots.ano_prev_conclusao;
  const summary = summarizeBy(rows, "ano_prev_conclusao").sort((a,b)=>Number(a.categoria_raw)-Number(b.categoria_raw));
  if (!summary.length) return renderEmptyPlot(element, "Sem dados para este recorte.");
  const vals = summary.map(d=>d.valor_total_rs);
  const trace = {
    type:"bar", x:summary.map(d=>d.categoria_raw), y:vals,
    marker:{color:"#7b8aa0",line:{color:"rgba(255,255,255,0.85)",width:1.1}},
    customdata:summary.map(d=>[fmtMoney(d.valor_total_rs),fmtPct(d.execucao_media),d.qtd_empreendimentos.toLocaleString("pt-BR"),d.qtd_municipios.toLocaleString("pt-BR")]),
    hovertemplate:"<b>Ano %{x}</b><br>Valor total: %{customdata[0]}<br>Execução média: %{customdata[1]}<br>Empreendimentos: %{customdata[2]}<br>Municípios: %{customdata[3]}<extra></extra>"
  };
  const layout = baseLayout({height:420, margin:{l:70,r:20,t:18,b:54}});
  layout.xaxis = { title:"Ano de previsão de conclusão", type:"category", automargin:true };
  layout.yaxis = { title:"Valor total (R$)", tickmode:"array", ...buildCurrencyTicks(vals), gridcolor:"rgba(15,76,129,0.09)" };
  if (typeof element.removeAllListeners === "function") element.removeAllListeners("plotly_click");
  Plotly.react(element, [trace], layout, plotConfig()).then(()=>
    element.on("plotly_click", ev => { const label=ev.points?.[0]?.x; if(!label) return; APP.filters.ano_prev_conclusao=APP.filters.ano_prev_conclusao===String(label)?null:String(label); renderAll(); })
  );
}

function renderEmptyPlot(element, message) {
  Plotly.react(element, [], {height:240,paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",margin:{l:20,r:20,t:20,b:20},xaxis:{visible:false},yaxis:{visible:false},annotations:[{text:message,showarrow:false,font:{family:CONFIG.chartFont,size:14,color:"#56657a"}}]}, plotConfig());
}

function buildTablesForPDF() {
  const rows = getFilteredRows();
  const sections = [
    ["Inclusão no Novo PAC",        "inclusao_novo_pac"],
    ["Tipo de Executor",            "tipo_executor"],
    ["Estágio",                     "estagio"],
    ["Fontes de financiamento",     "fontes_financiamento"],
    ["Ministério",                  "ministerio"],        // ← novo
    ["Classificação",               "classificacao"],
    ["Eixo",                        "eixo"],
    ["Subeixo",                     "subeixo"],
    ["Modalidade",                  "modalidade"],
    ["Empreendimento",              "empreendimento"],
    ["Ano de previsão de conclusão","ano_prev_conclusao"]
  ];
  const totalValor = sum(rows.map(r=>r.valor_total_rs));
  const execMedia  = average(rows.map(r=>r.execucao_fisica_pct));
  const html = [
    `<div class="pdf-head"><h1>Novo PAC (2023–2030) – Rio Grande do Sul</h1><div class="pdf-meta">Casa Civil – Governo Federal – Brasil</div><div class="pdf-meta">Atualização da base: ${CONFIG.defaultUpdateLabel}</div></div>`,
    `<div class="pdf-grid"><div class="pdf-kpi"><div class="lbl">Valor total</div><div class="val">${fmtMoney(totalValor)}</div></div><div class="pdf-kpi"><div class="lbl">Execução média</div><div class="val">${fmtPct(execMedia)}</div></div><div class="pdf-kpi"><div class="lbl">Empreendimentos</div><div class="val">${uniqueCount(rows,"empreendimento").toLocaleString("pt-BR")}</div></div><div class="pdf-kpi"><div class="lbl">Municípios</div><div class="val">${uniqueCount(rows,"municipio").toLocaleString("pt-BR")}</div></div></div>`,
    `<div class="pdf-meta"><strong>Filtros ativos:</strong> ${buildFilterText()}</div>`
  ];
  sections.forEach(([title,key])=> html.push(buildOnePdfTable(title, rows, key)));
  html.push(`<div class="source">Fonte: Novo PAC (2023–2030) – Casa Civil – Governo Federal – Brasil. Atualização da base: ${CONFIG.defaultUpdateLabel}.</div>`);
  ELS.tables.innerHTML = html.join("");
}

function buildOnePdfTable(title, rows, key) {
  const grouped    = summarizeBy(rows, key).sort((a,b)=>b.valor_total_rs-a.valor_total_rs);
  const totalValor = sum(grouped.map(d=>d.valor_total_rs));
  const body       = grouped.map(d => `<tr><td>${escapeHtml(d.categoria_raw)}</td><td>${d.registros.toLocaleString("pt-BR")}</td><td>${fmtPct(d.execucao_media)}</td><td>${fmtMoney(d.valor_total_rs)}</td><td>${pctValue(d.valor_total_rs,totalValor)}</td></tr>`).join("");
  return `<div class="pdf-section"><h2>${title}</h2><table class="report"><thead><tr><th>Categoria</th><th>Registros</th><th>Execução média (%)</th><th>Soma do valor (R$)</th><th>% do total (valor)</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td><b>TOTAL</b></td><td><b>${rows.length.toLocaleString("pt-BR")}</b></td><td><b>${fmtPct(average(rows.map(r=>r.execucao_fisica_pct)))}</b></td><td><b>${fmtMoney(sum(rows.map(r=>r.valor_total_rs)))}</b></td><td><b>100,00%</b></td></tr></tfoot></table></div>`;
}

function makePDF() {
  buildTablesForPDF();
  ELS.tables.classList.add("show");
  const opt = {
    margin: [10,10,10,10],
    filename: "relatorio_pac_tabelas.pdf",
    image: { type:"jpeg", quality:0.98 },
    html2canvas: { scale:2, useCORS:true, backgroundColor:"#ffffff" },
    jsPDF: { unit:"pt", format:"a4", orientation:"landscape" },
    pagebreak: { mode:["css","legacy"] }
  };
  html2pdf().set(opt).from(ELS.tables).save().then(()=>{
    ELS.tables.classList.remove("show");
  }).catch((err)=>{
    ELS.tables.classList.remove("show");
    console.error(err);
    alert("Ocorreu um erro ao gerar o PDF.");
  });
}

function buildFilterText() {
  const labels = {
    municipio:"Município", eixo:"Eixo", subeixo:"Subeixo", modalidade:"Modalidade",
    empreendimento:"Empreendimento", inclusao_novo_pac:"Inclusão no Novo PAC",
    tipo_executor:"Tipo de Executor", estagio:"Estágio",
    fontes_financiamento:"Fontes de financiamento", classificacao:"Classificação",
    ano_prev_conclusao:"Ano de previsão de conclusão",
    ministerio:"Ministério"   // ← novo
  };
  const active = Object.entries(APP.filters).filter(([,v])=>Boolean(v));
  return active.length ? active.map(([k,v])=>`${labels[k]}: ${v}`).join(" | ") : "Nenhum filtro ativo além do recorte geral.";
}

// ── Utilitários ──────────────────────────────────────────────────────────────
function setStatus(message) { ELS.statusLine.textContent = message; }
function sum(values)        { return values.reduce((a,v)=>a + Number(v || 0), 0); }
function average(values)    { const valid = values.filter(v => Number.isFinite(v)); return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : 0; }
function uniqueCount(rows,key){ return new Set(rows.map(d=>d[key]).filter(v => v && v !== "Não informado")).size; }
function round2(v)          { return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100; }
function fmtMoney(value)    { return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value || 0)); }
function fmtPct(value)      { const v = Number.isFinite(value) ? value : 0; return `${v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%`; }
function pctValue(value,total){ if(!total) return "0,00%"; return `${((value/total)*100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%`; }
function trimLabel(text,max=42){ const s=String(text||""); return s.length>max ? `${s.slice(0,max-1)}…` : s; }
function escapeHtml(value)  { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function buildCurrencyTicks(values){ const max=Math.max(...values,0); const steps=max>=1e9?[0,max/3,2*max/3,max]:max>=1e6?[0,max/2,max]:[0,max]; return {tickvals:steps,ticktext:steps.map(shortMoney)}; }
function shortMoney(v)      { const abs=Math.abs(v); if(abs>=1e9) return `R$ ${(v/1e9).toLocaleString("pt-BR",{maximumFractionDigits:1})} bi`; if(abs>=1e6) return `R$ ${(v/1e6).toLocaleString("pt-BR",{maximumFractionDigits:1})} mi`; if(abs>=1e3) return `R$ ${(v/1e3).toLocaleString("pt-BR",{maximumFractionDigits:1})} mil`; return `R$ ${Number(v).toLocaleString("pt-BR",{maximumFractionDigits:0})}`; }
function baseLayout({height=420,margin={l:64,r:24,t:18,b:48},showlegend=false,legend={}}={}){ return {height,margin,showlegend,legend,paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",hoverlabel:{font:{family:CONFIG.chartFont,size:12}},font:{family:CONFIG.chartFont,color:"#122033",size:12}}; }
function plotConfig(){ return {displayModeBar:true,responsive:true,locale:"pt-BR",displaylogo:false,modeBarButtonsToRemove:["select2d","lasso2d","autoScale2d","hoverClosestCartesian","hoverCompareCartesian","toggleSpikelines"]}; }
