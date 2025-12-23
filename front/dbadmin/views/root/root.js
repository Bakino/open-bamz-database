//Script goes here

const EXCLUDE_SCHEMAS = ["graphile_worker", "openbamz", "postgraphile_watch", "dbadmin"]

view.loader = async ()=>{

    const resultSchemas = /** @type any */ (await dbApi.mutations.dbadmin_get_schemas_and_tables()) ;

    let schemas = resultSchemas.filter(s=>!EXCLUDE_SCHEMAS.includes(s.schema)) ; 

    for(let schema of schemas){
        for(let table of schema.tables){
            let description = table.description;
            if(description && description[0]==="{"){
                try{
                    table.description = JSON.parse(description).description;
                }catch(e){}
            }
        }
    }

    return {
        schemas: schemas,
    }
};

function initSidebar(){
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleBtn');
    const mainContent = document.getElementById('mainContent');

    // Par défaut, ouvert
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('closed');
        mainContent.classList.toggle('sidebar-closed');
        
        // Changement de la flèche
        toggleBtn.textContent = sidebar.classList.contains('closed') ? '→' : '←';
    });
}

view.addEventListener("displayed", ()=>{
    initSidebar() ;
    document.addEventListener("changeView", (/** @type CustomEvent */ev)=>{
        //view.data.currentView = ev.detail ;
        window.location.hash = "#"+ev.detail;
    })
    document.addEventListener("schemaChanged", ()=>{
        view.refresh() ;
    })
});

view.selectTable = async (table)=>{
    //view.data.currentView = `/view_table/${table.schema}/${table.table}` ;
    window.location.hash = `#/view_table/${table.schema}/${table.table}` ;
}

view.newTable = async ()=>{
    //view.data.currentView = `/edit_table/public` ;
    window.location.hash = `#/edit_table/public` ;
}

view.selectFunc = async (func)=>{
    //view.data.currentView = `/edit_func/${func.schema}/${func.function}` ;
    window.location.hash = `#/edit_func/${func.schema}/${func.function}` ;
}
view.newFunc = async ()=>{
    //view.data.currentView = `/edit_func/public` ;
    window.location.hash = `#/edit_func/public` ;
}
view.selectTrigger = async (trigger)=>{
    //view.data.currentView = `/edit_trigger/${trigger.schema}/${trigger.table}/${trigger.function}` ;
    window.location.hash = `#/edit_trigger/${trigger.schema}/${trigger.table}/${trigger.function}` ;
}


view.runSQL = async ()=>{
    //view.data.currentView = `/run_sql` ;
    window.location.hash = `#/run_sql` ;
}