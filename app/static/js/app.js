const state={
    datasets:[],
    dashboards:[],
    activeDataset:null,
    activeDashboard:null,
    chart:null
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
    state.dashboards=await api("/api/dashboards");
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
    y.innerHTML='<option value="">— Contar registros —</option>'+
        numeric.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    x.value=columns.some(c=>c.name===config.x)?config.x:(defaultX(columns)?.name||"");
    y.value=numeric.some(c=>c.name===config.y)?config.y:(defaultY(columns)?.name||"");
    $("#aggregation").value=config.aggregation||(y.value?"sum":"count");
    $("#chart-type").value=config.chart_type||"bar";
    updateAggregationUI();
}
function currentConfig(){
    const aggregation=$("#aggregation").value;
    return {
        x:$("#x-field").value||null,
        y:aggregation==="count"?null:($("#y-field").value||null),
        aggregation,
        chart_type:$("#chart-type").value
    };
}
function updateAggregationUI(){
    $("#y-field").disabled=$("#aggregation").value==="count";
}
function clearChart(){
    if(state.chart){
        state.chart.destroy();
        state.chart=null;
    }
    $("#chart-empty").classList.remove("hidden");
    $("#chart-title").textContent="Visualización";
    $("#chart-meta").textContent="Configura el gráfico para comenzar.";
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
        renderSelectors(dataset.columns,dashboard.config||{});
        closeSidebar();
        status("Dashboard cargado");

        if(dashboard.config?.x){
            renderChart(await requestAnalysis(dashboard.config));
        }else{
            clearChart();
        }
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

        const x=defaultX(state.activeDataset.columns);
        const y=defaultY(state.activeDataset.columns);
        const config={
            x:x?.name||null,
            y:y?.name||null,
            aggregation:y?"sum":"count",
            chart_type:"bar"
        };
        const d=await api("/api/dashboards",{
            method:"POST",
            body:JSON.stringify({
                name:name.trim(),
                dataset_id:state.activeDataset.id,
                config
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
    return api("/api/analysis",{
        method:"POST",
        body:JSON.stringify({
            dataset_id:state.activeDataset.id,
            x:config.x,
            y:config.y,
            aggregation:config.aggregation,
            chart_type:config.chart_type
        })
    });
}
async function saveAndGenerate(){
    if(!state.activeDashboard||!state.activeDataset){
        toast("Selecciona o crea un dashboard.",true);
        return;
    }
    const config=currentConfig();
    if(!config.x){
        toast("Selecciona una columna para agrupar.",true);
        return;
    }
    if(["sum","average"].includes(config.aggregation)&&!config.y){
        toast("Selecciona una columna numérica.",true);
        return;
    }
    try{
        status("Guardando configuración...");
        state.activeDashboard=await api(
            `/api/dashboards/${state.activeDashboard.id}`,
            {
                method:"PUT",
                body:JSON.stringify({
                    name:state.activeDashboard.name,
                    config
                })
            }
        );
        renderDashboardList();
        renderDatasetList();
        renderChart(await requestAnalysis(config));
        status("Guardado");
        toast("Configuración guardada.");
    }catch(e){
        status("Error");
        toast(e.message,true);
    }
}
function renderChart(data){
    if(state.chart){
        state.chart.destroy();
        state.chart=null;
    }
    $("#chart-empty").classList.add("hidden");
    const labels={sum:"Suma",average:"Promedio",count:"Conteo"}[data.aggregation]||data.aggregation;
    $("#chart-title").textContent=`${labels} por ${data.x_label}`;
    $("#chart-meta").textContent=data.y_label;

    const pieColors=["#4777dd","#16a085","#e67e22","#8854d0","#e04f70","#36a2eb","#7cb342","#d7ac25"];
    state.chart=new Chart($("#main-chart"),{
        type:data.chart_type,
        data:{
            labels:data.labels,
            datasets:[{
                label:data.y_label,
                data:data.values,
                backgroundColor:data.chart_type==="pie"?pieColors:"#4777dd",
                borderColor:"#345fb8",
                borderWidth:2,
                tension:.25,
                fill:false
            }]
        },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            plugins:{legend:{display:data.chart_type==="pie"}},
            scales:data.chart_type==="pie"?{}:{
                x:{grid:{display:false}},
                y:{beginAtZero:true}
            }
        }
    });
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
$("#aggregation").addEventListener("change",updateAggregationUI);
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
    }
});
window.addEventListener("resize",()=>{
    if(window.innerWidth>800)closeSidebar();
});

boot();