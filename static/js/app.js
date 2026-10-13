const $=selector=>document.querySelector(selector);

function closeSidebar(){
$("#sidebar")?.classList.remove("open");
}

async function testBackend(){

const result=$("#result");
const status=$("#status");

result.textContent="Probando conexión...";
status.textContent="Comprobando...";

try{

const response=await fetch("/api/health");

const data=await response.json();

if(!response.ok){
throw new Error("Error del servidor");
}

result.textContent=
`${data.status.toUpperCase()}: ${data.message}`;

status.textContent="Backend conectado";

}catch(error){

result.textContent=
"Error al conectar con el backend.";

status.textContent="Error";

}

}

$("#test-button")?.addEventListener(
"click",
testBackend
);

$("#menu-toggle")?.addEventListener(
"click",
()=>{
$("#sidebar")?.classList.toggle("open");
}
);

document.addEventListener(
"click",
event=>{

const sidebar=$("#sidebar");
const menu=$("#menu-toggle");

if(
window.innerWidth<=800&&
sidebar?.classList.contains("open")&&
!sidebar.contains(event.target)&&
!menu?.contains(event.target)
){
closeSidebar();
}

}
);