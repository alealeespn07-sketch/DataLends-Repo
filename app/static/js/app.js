const state={
    datasets:[],
    dashboards:[],
    activeDataset:null,
    activeDashboard:null,
    chartInstances:new Map(),
    editingChartId:null
};
const $=s=>document.querySelector(s);

async function api(url,options={}){
    const headers={...(options.headers||{})};
    if(options.body&&!(options.body instanceof FormData)&&!headers["Content-Type"]){
        headers["Content-Type"]="application/json";
    }
    const response=await fetch(url,{...options,headers});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Ocurrió un error.");
    return data;
}
function status(message){$("#status").textContent=message}
function esc(v){
    return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function toast(message,error=false){
    const box=$("#toast");
    box.textContent=message;
    box.style.background=error?"#c43c48":"#111a2a";
    box.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>box.classList.add("hidden"),2800);
}
function closeSidebar(){$("#sidebar")?.classList.remove("open")}
function formatCell(v){
    if(v===null||v===undefined)return"—";
    if(typeof v==="number")return v.toLocaleString("es-DO",{maximumFractionDigits:2});
    return String(v);
}
function typeSymbol(t){return t==="number"?"#":t==="date"?"◷":"T"}
function defaultX(cols){return cols.find(c=>c.type==="text")||cols.find(c=>c.type==="date")||cols[0]||null}
function defaultY(cols){return cols.find(c=>c.type==="number")||null}

async function boot(){
    try{
        status("Conectando...");
        await loadSystemInfo();
        await refreshLists();
        if(state.dashboards.length){
            await selectDashboard(state.dashboards[0].id);
        }else if(state.datasets.length){
            await selectDataset(state.datasets[0].id);
        }else{
            showEmpty();
            status("Sin datos");
        }
    }catch(e){
        status("Error");
        toast(e.message,true);
    }
}
async function refreshLists(){
    state.datasets=await api("/api/datasets");
    state.dashboards=(await api("/api/dashboards")).map(d=>({...d,config:normalizeDashboardConfig(d.config||{})}));
    renderDatasetList();
    renderDashboardList();
}
async function loadSystemInfo(){
    try{
        const d=await api("/api/info");
        $("#system-info").innerHTML=`
            <div><strong>Aplicación:</strong> ${esc(d.application)}</div>
            <div><strong>Backend:</strong> ${esc(d.backend)}</div>
            <div><strong>Base de datos:</strong> ${esc(d.database)}</div>
            <div><strong>Conexión:</strong> ${d.database_connected?"Activa":"Inactiva"}</div>
            <div><strong>Versión:</strong> ${esc(d.version)}</div>`;
    }catch(e){
        $("#system-info").textContent="No se pudo consultar el sistema.";
    }
}
function showEmpty(){
    state.activeDataset=null;
    state.activeDashboard=null;
    $("#empty-state").classList.remove("hidden");
    $("#workspace-content").classList.add("hidden");
    $("#dashboard-actions").classList.add("hidden");
    $("#page-title").textContent="DataLends";
    clearChart();
}
function renderDatasetList(){
    const box=$("#dataset-list");
    if(!state.datasets.length){
        box.innerHTML='<div class="sidebar-footer">No hay datasets cargados.</div>';
        return;
    }
    box.innerHTML=state.datasets.map(d=>`
        <button class="dataset-item ${state.activeDataset?.id===d.id&&!state.activeDashboard?"active":""}" data-dataset-id="${d.id}">
            <strong>${esc(d.name)}</strong>
            <span>${Number(d.row_count).toLocaleString("es-DO")} registros</span>
        </button>`).join("");
}
function renderDashboardList(){
    const box=$("#dashboard-list");
    if(!state.dashboards.length){
        box.innerHTML='<div class="sidebar-footer">No hay dashboards guardados.</div>';
        return;
    }
    box.innerHTML=state.dashboards.map(d=>`
        <button class="dataset-item ${state.activeDashboard?.id===d.id?"active":""}" data-dashboard-id="${d.id}">
            <strong>${esc(d.name)}</strong>
            <span>Dashboard guardado</span>
        </button>`).join("");
}
function renderDatasetInfo(d){
    $("#dataset-name").textContent=d.name;
    $("#dataset-file").textContent=`Archivo original: ${d.file_name}`;
    $("#stat-rows").textContent=Number(d.row_count).toLocaleString("es-DO");
    $("#stat-columns").textContent=d.column_count;
    $("#stat-numeric").textContent=d.columns.filter(c=>c.type==="number").length;
    $("#column-list").innerHTML=d.columns.map(c=>`
        <span class="column-chip"><strong>${typeSymbol(c.type)}</strong>${esc(c.name)} · ${esc(c.type)}</span>
    `).join("");

    const rows=d.preview||[];
    const box=$("#preview-container");
    if(!rows.length){
        box.innerHTML='<div class="system-info">No hay registros que mostrar.</div>';
        return;
    }
    const columns=Object.keys(rows[0]);
    box.innerHTML=`
        <table>
            <thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead>
            <tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(formatCell(r[c]))}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>`;
}
function renderSelectors(columns,config={}){
    const x=$("#x-field"),y=$("#y-field");
    x.innerHTML=columns.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    const numeric=columns.filter(c=>c.type==="number");
    y.innerHTML='<option value="">— Contar registros —</option>'+numeric.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    x.value=columns.some(c=>c.name===config.x)?config.x:(defaultX(columns)?.name||"");
    y.value=numeric.some(c=>c.name===config.y)?config.y:(defaultY(columns)?.name||"");
    $("#aggregation").value=config.aggregation||(y.value?"sum":"count");
    $("#chart-type").value=config.chart_type&&config.chart_type!=="pivot"?config.chart_type:"bar";
    fillMultiSelect("#pivot-rows",columns,config.rows||[]);
    fillMultiSelect("#pivot-columns",columns,config.columns||[]);
    fillMultiSelect("#pivot-values",columns,(config.values||[]).map(v=>typeof v==="string"?v:v.field));
    renderPivotOperations(config.values||[]);
    updateAggregationUI();
    updateVisualTypeUI();
}
function fillMultiSelect(selector,columns,selected=[]){
    const select=$(selector);
    select.innerHTML=columns.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    [...select.options].forEach(option=>option.selected=selected.includes(option.value));
}
function selectedOptions(selector){return [...$(selector).selectedOptions].map(option=>option.value)}
function renderPivotOperations(values=null){
    const container=$("#pivot-operations");
    const selected=selectedOptions("#pivot-values");
    const current=new Map();
    (values||[]).forEach(v=>current.set(typeof v==="string"?v:v.field,typeof v==="string"?"sum":(v.aggregation||"sum")));
    document.querySelectorAll("[data-pivot-aggregation]").forEach(select=>{
        if(!current.has(select.dataset.pivotAggregation))current.set(select.dataset.pivotAggregation,select.value);
    });
    container.innerHTML=selected.map(field=>{
        const column=state.activeDataset?.columns?.find(item=>item.name===field);
        const defaultAggregation=column?.type==="number"?"sum":"count";
        const aggregation=current.get(field)||defaultAggregation;
        return `<label class="pivot-operation"><span>${esc(field)}</span>
            <select data-pivot-aggregation="${esc(field)}">
                <option value="sum" ${aggregation==="sum"?"selected":""}>Suma</option>
                <option value="average" ${aggregation==="average"?"selected":""}>Promedio</option>
                <option value="count" ${aggregation==="count"?"selected":""}>Conteo</option>
            </select>
        </label>`;
    }).join("");
    container.classList.toggle("hidden",!selected.length||$("#chart-type").value!=="pivot");
}
function pivotValues(){
    return [...document.querySelectorAll("[data-pivot-aggregation]")].map(select=>({
        field:select.dataset.pivotAggregation,
        aggregation:select.value
    }));
}
function currentConfig(){
    const chart_type=$("#chart-type").value;
    const title=$("#visual-title").value.trim();
    if(chart_type==="pivot"){
        return {title,chart_type,rows:selectedOptions("#pivot-rows"),columns:selectedOptions("#pivot-columns"),values:pivotValues()};
    }
    const aggregation=$("#aggregation").value;
    return {
        title,
        chart_type,
        x:$("#x-field").value||null,
        y:aggregation==="count"?null:($("#y-field").value||null),
        aggregation
    };
}
function updateAggregationUI(){
    $("#y-field").disabled=$("#aggregation").value==="count";
}
function updateVisualTypeUI(){
    const pivot=$("#chart-type").value==="pivot";
    document.querySelectorAll(".chart-field").forEach(field=>field.classList.toggle("hidden",pivot));
    $("#pivot-fields").classList.toggle("hidden",!pivot);
    renderPivotOperations();
}
function resetVisualEditor(){
    state.editingChartId=null;
    if(state.activeDataset)renderSelectors(state.activeDataset.columns,{});
    $("#visual-title").value="";
    $("#chart-type").value="bar";
    updateVisualTypeUI();
    $("#editor-heading").textContent="Nueva visualización";
    $("#editor-help").textContent="Configura un gráfico o una tabla dinámica.";
    $("#editor-message").textContent="Cada visualización se guarda por separado.";
    $("#save-generate").textContent="Agregar visualización";
    $("#cancel-edit").classList.add("hidden");
    $("#editor-error").classList.add("hidden");
}
function clearChart(){
    state.chartInstances.forEach(chart=>chart.destroy());
    state.chartInstances.clear();
    const grid=$("#chart-grid");
    if(grid)grid.innerHTML='<div id="chart-empty" class="chart-empty">Agrega una visualización para comenzar.</div>';
}
async function selectDataset(id){
    try{
        status("Cargando dataset...");
        const d=await api(`/api/datasets/${id}`);
        state.activeDataset=d;
        state.activeDashboard=null;
        renderDatasetInfo(d);
        renderDatasetList();
        renderDashboardList();
        $("#empty-state").classList.add("hidden");
        $("#workspace-content").classList.remove("hidden");
        $("#dashboard-content").classList.add("hidden");
        $("#dashboard-actions").classList.add("hidden");
        $("#page-title").textContent="Gestión de datos";
        clearChart();
        closeSidebar();
        status("Dataset seleccionado");
    }catch(e){
        toast(e.message,true);
        status("Error");
    }
}
async function selectDashboard(id){
    try{
        status("Cargando dashboard...");
        const dashboard=await api(`/api/dashboards/${id}`);
        const dataset=await api(`/api/datasets/${dashboard.dataset_id}`);
        dashboard.config=normalizeDashboardConfig(dashboard.config||{});
        state.activeDashboard=dashboard;
        state.activeDataset=dataset;
        renderDatasetInfo(dataset);
        renderDatasetList();
        renderDashboardList();
        $("#empty-state").classList.add("hidden");
        $("#workspace-content").classList.remove("hidden");
        $("#dashboard-content").classList.remove("hidden");
        $("#dashboard-actions").classList.remove("hidden");
        $("#dashboard-name").textContent=dashboard.name;
        $("#page-title").textContent=dashboard.name;
        resetVisualEditor();
        closeSidebar();
        await renderCharts();
        status("Dashboard cargado");
    }catch(e){
        clearChart();
        toast(e.message,true);
        status("Error");
    }
}
async function createDashboard(){
    try{
        if(!state.activeDataset){
            if(!state.datasets.length){
                toast("Primero carga un archivo.",true);
                return;
            }
            await selectDataset(state.datasets[0].id);
        }
        if(!state.activeDataset)return;

        const name=prompt("Nombre del dashboard:","Mi dashboard");
        if(name===null)return;
        if(!name.trim()){
            toast("Escribe un nombre.",true);
            return;
        }

        const d=await api("/api/dashboards",{
            method:"POST",
            body:JSON.stringify({
                name:name.trim(),
                dataset_id:state.activeDataset.id,
                config:{charts:[]}
            })
        });
        await refreshLists();
        await selectDashboard(d.id);
        toast("Dashboard creado y guardado.");
    }catch(e){
        toast(e.message,true);
    }
}
async function requestAnalysis(config){
    const payload={dataset_id:state.activeDataset.id,...config};
    return api("/api/analysis",{
        method:"POST",
        body:JSON.stringify(payload)
    });
}
async function saveAndGenerate(){
    if(!state.activeDashboard||!state.activeDataset){
        toast("Selecciona o crea un dashboard.",true);
        return;
    }

    const config=currentConfig();
    if(!config.title){
        showEditorError("Escribe un nombre para la visualización.");
        return;
    }
    if(config.chart_type==="pivot"){
        if(!config.rows.length){
            showEditorError("Selecciona al menos una fila para la tabla dinámica.");
            return;
        }
        if(!config.values.length){
            showEditorError("Selecciona al menos un valor para la tabla dinámica.");
            return;
        }
    }else{
        if(!config.x){
            showEditorError("Selecciona una columna para agrupar.");
            return;
        }
        if(["sum","average"].includes(config.aggregation)&&!config.y){
            showEditorError("Selecciona una columna numérica.");
            return;
        }
    }

    const charts=[...(state.activeDashboard.config?.charts||[])];
    const visual={...config,id:state.editingChartId||makeVisualId()};
    const index=charts.findIndex(item=>item.id===visual.id);
    if(index>=0)charts[index]=visual;
    else charts.push(visual);

    try{
        status("Guardando visualización...");
        state.activeDashboard=await api(`/api/dashboards/${state.activeDashboard.id}`,{
            method:"PUT",
            body:JSON.stringify({
                name:state.activeDashboard.name,
                config:{...state.activeDashboard.config,charts}
            })
        });
        state.activeDashboard.config=normalizeDashboardConfig(state.activeDashboard.config||{});
        renderDashboardList();
        renderDatasetList();
        await renderCharts();
        resetVisualEditor();
        status("Guardado");
        toast(index>=0?"Visualización actualizada.":"Visualización agregada y guardada.");
    }catch(e){
        status("Error");
        showEditorError(e.message);
        toast(e.message,true);
    }
}
function showEditorError(message){
    const error=$("#editor-error");
    error.textContent=message;
    error.classList.remove("hidden");
}
function makeVisualId(){
    return window.crypto?.randomUUID?window.crypto.randomUUID():`visual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function normalizeDashboardConfig(config){
    if(Array.isArray(config.charts))return config;
    if(config.x||config.chart_type){
        return {...config,charts:[{
            id:"legacy-chart",
            title:"Visualización 1",
            chart_type:config.chart_type||"bar",
            x:config.x,
            y:config.y,
            aggregation:config.aggregation||"sum"
        }]};
    }
    return {...config,charts:[]};
}
function visualDescription(config){
    if(config.chart_type==="pivot"){
        return `Tabla dinámica · Filas: ${config.rows.join(", ")} · Columnas: ${config.columns.join(", ")||"Sin columnas"}`;
    }
    const aggregation={sum:"Suma",average:"Promedio",count:"Conteo"}[config.aggregation]||config.aggregation;
    return `${aggregation} por ${config.x}${config.y?` · ${config.y}`:""} · ${config.chart_type}`;
}
function visualCardHtml(config){
    const id=esc(config.id);
    const pivot=config.chart_type==="pivot";
    const content=pivot
        ? `<div id="pivot-result-${id}" class="pivot-result table-scroll">Procesando tabla...</div>`
        : `<div class="chart-area"><canvas id="visual-chart-${id}"></canvas></div>`;
    return `<div class="panel visual-card ${pivot?"visual-card-wide":""}" data-visual-id="${id}">
        <div class="panel-head visual-card-head">
            <div><h3>${esc(config.title||"Visualización")}</h3><span>${esc(visualDescription(config))}</span></div>
            <div class="visual-actions">
                <button class="button secondary" data-edit-visual="${id}">Editar</button>
                <button class="button danger" data-delete-visual="${id}">Eliminar</button>
            </div>
        </div>${content}</div>`;
}
function tableHtml(columns,rows){
    if(!rows||!rows.length)return '<div class="chart-empty">No hay resultados para mostrar.</div>';
    return `<table><thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(c=>`<td>${esc(formatCell(row[c]))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
async function renderVisualization(config){
    try{
        const data=await requestAnalysis(config);
        if(config.chart_type==="pivot"){
            const box=document.getElementById(`pivot-result-${config.id}`);
            if(box)box.innerHTML=tableHtml(data.columns,data.rows);
            return;
        }
        const canvas=document.getElementById(`visual-chart-${config.id}`);
        if(!canvas)return;
        const labels={sum:"Suma",average:"Promedio",count:"Conteo"}[data.aggregation]||data.aggregation;
        const pieColors=["#4777dd","#16a085","#e67e22","#8854d0","#e04f70","#36a2eb","#7cb342","#d7ac25"];
        const chart=new Chart(canvas,{
            type:data.chart_type,
            data:{labels:data.labels,datasets:[{
                label:`${labels} de ${data.y_label}`,
                data:data.values,
                backgroundColor:data.chart_type==="pie"?pieColors:"#4777dd",
                borderColor:"#345fb8",
                borderWidth:2,
                tension:.25,
                fill:false
            }]},
            options:{
                responsive:true,
                maintainAspectRatio:false,
                plugins:{legend:{display:data.chart_type==="pie"}},
                scales:data.chart_type==="pie"?{}:{x:{grid:{display:false}},y:{beginAtZero:true}}
            }
        });
        state.chartInstances.set(config.id,chart);
    }catch(e){
        const box=config.chart_type==="pivot"
            ? document.getElementById(`pivot-result-${config.id}`)
            : document.querySelector(`[data-visual-id="${CSS.escape(config.id)}"]`);
        if(box)box.innerHTML=`<div class="chart-error">${esc(e.message)}</div>`;
    }
}
async function renderCharts(){
    state.chartInstances.forEach(chart=>chart.destroy());
    state.chartInstances.clear();
    const grid=$("#chart-grid");
    const charts=state.activeDashboard?.config?.charts||[];
    if(!charts.length){
        grid.innerHTML='<div id="chart-empty" class="chart-empty">Este dashboard todavía no tiene visualizaciones. Utiliza el formulario para agregar una.</div>';
        return;
    }
    grid.innerHTML=charts.map(visualCardHtml).join("");
    await Promise.all(charts.map(renderVisualization));
}
function setMultiSelected(selector,values){
    const select=$(selector);
    [...select.options].forEach(option=>option.selected=(values||[]).includes(option.value));
}
function editVisualization(id){
    const visual=state.activeDashboard?.config?.charts?.find(item=>item.id===id);
    if(!visual)return;
    state.editingChartId=id;
    $("#visual-title").value=visual.title||"";
    $("#chart-type").value=visual.chart_type||"bar";
    if(visual.chart_type==="pivot"){
        setMultiSelected("#pivot-rows",visual.rows||[]);
        setMultiSelected("#pivot-columns",visual.columns||[]);
        setMultiSelected("#pivot-values",(visual.values||[]).map(v=>typeof v==="string"?v:v.field));
        renderPivotOperations(visual.values||[]);
    }else{
        $("#x-field").value=visual.x||"";
        $("#y-field").value=visual.y||"";
        $("#aggregation").value=visual.aggregation||"sum";
        updateAggregationUI();
    }
    updateVisualTypeUI();
    if(visual.chart_type==="pivot")renderPivotOperations(visual.values||[]);
    $("#editor-heading").textContent="Editar visualización";
    $("#editor-help").textContent="Los cambios solo afectarán a esta visualización.";
    $("#editor-message").textContent="Estás editando una visualización existente.";
    $("#save-generate").textContent="Guardar cambios";
    $("#cancel-edit").classList.remove("hidden");
    $("#editor-error").classList.add("hidden");
    $("#visual-title").scrollIntoView({behavior:"smooth",block:"center"});
}
async function deleteVisualization(id){
    const charts=state.activeDashboard?.config?.charts||[];
    const visual=charts.find(item=>item.id===id);
    if(!visual||!confirm(`¿Eliminar "${visual.title}"?`))return;
    try{
        const updated=charts.filter(item=>item.id!==id);
        state.activeDashboard=await api(`/api/dashboards/${state.activeDashboard.id}`,{
            method:"PUT",
            body:JSON.stringify({name:state.activeDashboard.name,config:{...state.activeDashboard.config,charts:updated}})
        });
        state.activeDashboard.config=normalizeDashboardConfig(state.activeDashboard.config||{});
        if(state.editingChartId===id)resetVisualEditor();
        await renderCharts();
        toast("Visualización eliminada.");
        status("Guardado");
    }catch(e){toast(e.message,true);status("Error")}
}
async function uploadFile(file){
    const form=new FormData();
    form.append("file",file);
    try{
        status("Procesando archivo...");
        const result=await api("/api/upload",{method:"POST",body:form});
        await refreshLists();
        await selectDataset(result.dataset.id);
        toast("Dataset cargado correctamente.");
    }catch(e){
        status("Error");
        toast(e.message,true);
    }
}
async function renameDataset(){
    if(!state.activeDataset)return;
    const id=state.activeDataset.id;
    const name=prompt("Nuevo nombre del dataset:",state.activeDataset.name);
    if(name===null)return;
    if(!name.trim()){
        toast("Escribe un nombre.",true);
        return;
    }
    try{
        await api(`/api/datasets/${id}`,{
            method:"PUT",
            body:JSON.stringify({name:name.trim()})
        });
        await refreshLists();
        if(state.activeDashboard)await selectDashboard(state.activeDashboard.id);
        else await selectDataset(id);
        toast("Dataset renombrado.");
    }catch(e){
        toast(e.message,true);
    }
}
async function deleteDataset(){
    if(!state.activeDataset)return;
    if(!confirm(`¿Eliminar "${state.activeDataset.name}"? Sus dashboards asociados también se eliminarán.`))return;
    try{
        await api(`/api/datasets/${state.activeDataset.id}`,{method:"DELETE"});
        state.activeDataset=null;
        state.activeDashboard=null;
        await refreshLists();
        if(state.dashboards.length)await selectDashboard(state.dashboards[0].id);
        else if(state.datasets.length)await selectDataset(state.datasets[0].id);
        else showEmpty();
        toast("Dataset eliminado.");
    }catch(e){
        toast(e.message,true);
    }
}
async function renameDashboard(){
    if(!state.activeDashboard)return;
    const name=prompt("Nuevo nombre del dashboard:",state.activeDashboard.name);
    if(name===null)return;
    if(!name.trim()){
        toast("Escribe un nombre.",true);
        return;
    }
    try{
        await api(`/api/dashboards/${state.activeDashboard.id}`,{
            method:"PUT",
            body:JSON.stringify({
                name:name.trim(),
                config:state.activeDashboard.config
            })
        });
        await refreshLists();
        await selectDashboard(state.activeDashboard.id);
        toast("Dashboard renombrado.");
    }catch(e){
        toast(e.message,true);
    }
}
async function deleteDashboard(){
    if(!state.activeDashboard)return;
    if(!confirm(`¿Eliminar "${state.activeDashboard.name}"?`))return;
    try{
        await api(`/api/dashboards/${state.activeDashboard.id}`,{method:"DELETE"});
        state.activeDashboard=null;
        await refreshLists();
        if(state.dashboards.length)await selectDashboard(state.dashboards[0].id);
        else if(state.datasets.length)await selectDataset(state.datasets[0].id);
        else showEmpty();
        toast("Dashboard eliminado.");
    }catch(e){
        toast(e.message,true);
    }
}

$("#file-input").addEventListener("change",async e=>{
    const file=e.target.files?.[0];
    if(file)await uploadFile(file);
    e.target.value="";
});
$("#create-dashboard").addEventListener("click",createDashboard);
$("#create-dashboard-main").addEventListener("click",createDashboard);
$("#rename-dataset").addEventListener("click",renameDataset);
$("#delete-dataset").addEventListener("click",deleteDataset);
$("#rename-dashboard").addEventListener("click",renameDashboard);
$("#delete-dashboard").addEventListener("click",deleteDashboard);
$("#save-generate").addEventListener("click",saveAndGenerate);
$("#cancel-edit").addEventListener("click",resetVisualEditor);
$("#aggregation").addEventListener("change",updateAggregationUI);
$("#chart-type").addEventListener("change",updateVisualTypeUI);
$("#pivot-values").addEventListener("change",()=>renderPivotOperations());
$("#menu-toggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));

document.addEventListener("click",async e=>{
    const sidebar=$("#sidebar");
    const menu=$("#menu-toggle");
    if(window.innerWidth<=800&&sidebar.classList.contains("open")&&!sidebar.contains(e.target)&&!menu.contains(e.target)){
        closeSidebar();
    }
    const db=e.target.closest("[data-dashboard-id]");
    if(db){
        await selectDashboard(Number(db.dataset.dashboardId));
        return;
    }
    const dataset=e.target.closest("[data-dataset-id]");
    if(dataset){
        await selectDataset(Number(dataset.dataset.datasetId));
        return;
    }
    const edit=e.target.closest("[data-edit-visual]");
    if(edit){editVisualization(edit.dataset.editVisual);return;}
    const remove=e.target.closest("[data-delete-visual]");
    if(remove){await deleteVisualization(remove.dataset.deleteVisual);}
});
window.addEventListener("resize",()=>{
    if(window.innerWidth>800)closeSidebar();
});

boot();