const state={datasets:[],activeDataset:null};
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

function toast(message,error=false){
    const box=$("#toast");
    box.textContent=message;
    box.style.background=error?"#c43c48":"#111a2a";
    box.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>box.classList.add("hidden"),2800);
}

function escapeHtml(value){
    return String(value??"")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

function formatCell(value){
    if(value===null||value===undefined)return"—";
    if(typeof value==="number")return value.toLocaleString("es-DO",{maximumFractionDigits:2});
    return String(value);
}

function closeSidebar(){
    $("#sidebar")?.classList.remove("open");
}

async function boot(){
    try{
        status("Conectando...");
        await loadSystemInfo();
        state.datasets=await api("/api/datasets");
        renderDatasetList();

        if(state.datasets.length){
            await selectDataset(state.datasets[0].id);
        }else{
            showEmpty("Carga un archivo CSV o Excel para comenzar.");
            status("Sin datos");
        }
    }catch(error){
        status("Error");
        toast(error.message,true);
    }
}

function showEmpty(message){
    state.activeDataset=null;
    $("#empty-state").innerHTML=`
        <div class="empty-icon">DL</div>
        <h2>No hay datasets cargados</h2>
        <p>${escapeHtml(message)}</p>`;
    $("#empty-state").classList.remove("hidden");
    $("#workspace-content").classList.add("hidden");
    $("#page-title").textContent="Gestión de datos";
}

function renderDatasetList(){
    const box=$("#dataset-list");

    if(!state.datasets.length){
        box.innerHTML='<div class="sidebar-footer">No hay datasets cargados.</div>';
        return;
    }

    box.innerHTML=state.datasets.map(dataset=>`
        <button class="dataset-item ${state.activeDataset?.id===dataset.id?"active":""}" data-dataset-id="${dataset.id}">
            <strong>${escapeHtml(dataset.name)}</strong>
            <span>${Number(dataset.row_count).toLocaleString("es-DO")} registros · ${dataset.column_count} columnas</span>
        </button>
    `).join("");
}

async function selectDataset(id){
    try{
        status("Cargando dataset...");
        const dataset=await api(`/api/datasets/${id}`);
        state.activeDataset=dataset;

        $("#empty-state").classList.add("hidden");
        $("#workspace-content").classList.remove("hidden");
        $("#page-title").textContent="Gestión de datos";
        $("#dataset-name").textContent=dataset.name;
        $("#dataset-file").textContent=`Archivo original: ${dataset.file_name}`;

        $("#stat-rows").textContent=Number(dataset.row_count).toLocaleString("es-DO");
        $("#stat-columns").textContent=dataset.column_count;
        $("#stat-numeric").textContent=dataset.columns.filter(c=>c.type==="number").length;

        renderColumns(dataset.columns);
        renderPreview(dataset.preview);
        renderDatasetList();
        closeSidebar();
        status("Dataset seleccionado");
    }catch(error){
        status("Error");
        toast(error.message,true);
    }
}

function renderColumns(columns){
    $("#column-list").innerHTML=columns.map(column=>{
        const symbol=column.type==="number"?"#":column.type==="date"?"◷":"T";
        const type=column.type==="number"?"Numérico":column.type==="date"?"Fecha":"Texto";
        return `<span class="column-chip"><strong>${symbol}</strong>${escapeHtml(column.name)} · ${type}</span>`;
    }).join("");
}

function renderPreview(rows){
    const box=$("#preview-container");

    if(!rows?.length){
        box.innerHTML='<div class="system-info">No hay registros para mostrar.</div>';
        return;
    }

    const columns=Object.keys(rows[0]);

    box.innerHTML=`
        <table>
            <thead><tr>${columns.map(c=>`<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
            <tbody>
                ${rows.map(row=>`
                    <tr>${columns.map(c=>`<td>${escapeHtml(formatCell(row[c]))}</td>`).join("")}</tr>
                `).join("")}
            </tbody>
        </table>`;
}

async function loadSystemInfo(){
    try{
        const info=await api("/api/info");
        $("#system-info").innerHTML=`
            <div><strong>Aplicación:</strong> ${escapeHtml(info.application)}</div>
            <div><strong>Backend:</strong> ${escapeHtml(info.backend)}</div>
            <div><strong>Base de datos:</strong> ${escapeHtml(info.database)}</div>
            <div><strong>Conexión:</strong> ${info.database_connected?"Activa":"Inactiva"}</div>
            <div><strong>Versión:</strong> ${escapeHtml(info.version)}</div>`;
    }catch(error){
        $("#system-info").textContent="No se pudo consultar el sistema.";
    }
}

async function refreshDatasets(){
    state.datasets=await api("/api/datasets");
    renderDatasetList();
}

async function uploadFile(file){
    const form=new FormData();
    form.append("file",file);

    try{
        status("Procesando archivo...");
        const result=await api("/api/upload",{method:"POST",body:form});
        await refreshDatasets();
        await selectDataset(result.dataset.id);
        toast("Dataset cargado correctamente.");
    }catch(error){
        status("Error");
        toast(error.message,true);
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
        await refreshDatasets();
        await selectDataset(id);
        toast("Dataset renombrado.");
    }catch(error){
        toast(error.message,true);
    }
}

async function deleteDataset(){
    if(!state.activeDataset)return;

    const dataset=state.activeDataset;
    if(!confirm(`¿Eliminar "${dataset.name}"? Esta acción no se puede deshacer.`))return;

    try{
        await api(`/api/datasets/${dataset.id}`,{method:"DELETE"});
        state.activeDataset=null;
        await refreshDatasets();

        if(state.datasets.length){
            await selectDataset(state.datasets[0].id);
        }else{
            showEmpty("El dataset se eliminó. Carga otro archivo para continuar.");
            status("Sin datos");
        }

        toast("Dataset eliminado.");
    }catch(error){
        toast(error.message,true);
    }
}

$("#file-input").addEventListener("change",async event=>{
    const file=event.target.files?.[0];
    if(file)await uploadFile(file);
    event.target.value="";
});

$("#rename-button").addEventListener("click",renameDataset);
$("#delete-button").addEventListener("click",deleteDataset);

$("#menu-toggle").addEventListener("click",()=>{
    $("#sidebar").classList.toggle("open");
});

document.addEventListener("click",async event=>{
    const sidebar=$("#sidebar");
    const menu=$("#menu-toggle");

    if(
        window.innerWidth<=900&&
        sidebar.classList.contains("open")&&
        !sidebar.contains(event.target)&&
        !menu.contains(event.target)
    ){
        closeSidebar();
    }

    const datasetButton=event.target.closest("[data-dataset-id]");
    if(datasetButton){
        await selectDataset(Number(datasetButton.dataset.datasetId));
    }
});

window.addEventListener("resize",()=>{
    if(window.innerWidth>900)closeSidebar();
});

boot();