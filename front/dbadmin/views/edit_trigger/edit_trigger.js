/*global view*/

// @ts-ignore
let editorFunc ;

// @ts-ignore
const FUNCTION_DELIMITER = "$function$" ;

//prepare data
view.loader = async ()=>{
    let funcName = "" ;
    let func = "" ;
    let funcBody = "" ;
    let language = "plv8" ;
    let metadata = null;

    let table = view.route.params.table;
    const tableMetadata = /** @type any*/ (await dbApi.mutations.dbadmin_get_table_metadata({ input: {p_schema: view.route.params.schema, p_table: view.route.params.table}})) ;
    let triggerDef = {
        code: "",
        beforeInsert: false,
        afterInsert: false,
        beforeUpdate: false,
        afterUpdate: false,
        beforeDelete: false,
        afterDelete: false,
    };
    if(view.route.params.func){
        func = view.route.params.func;
        let existingTrigger = tableMetadata.triggers.find(t=>t.function === func) ;
        if(existingTrigger){
            triggerDef.code = existingTrigger.trigger;
            triggerDef.beforeInsert = existingTrigger.events.some(e=>e.timing === "BEFORE" && e.action === "INSERT");
            triggerDef.afterInsert = existingTrigger.events.some(e=>e.timing === "AFTER" && e.action === "INSERT");
            triggerDef.beforeUpdate = existingTrigger.events.some(e=>e.timing === "BEFORE" && e.action === "UPDATE");
            triggerDef.afterUpdate = existingTrigger.events.some(e=>e.timing === "AFTER" && e.action === "UPDATE");
            triggerDef.beforeDelete = existingTrigger.events.some(e=>e.timing === "BEFORE" && e.action === "DELETE");
            triggerDef.afterDelete = existingTrigger.events.some(e=>e.timing === "AFTER" && e.action === "DELETE");
        }
        metadata = /** @type any */ (await dbApi.mutations.dbadmin_get_function_metadata({ input: {p_schema: view.route.params.schema, p_func: view.route.params.func}})) ;
        funcName = metadata.description;
        language = metadata.language;
        funcBody = metadata.definition ;
        const indexStartFunction = funcBody.indexOf(FUNCTION_DELIMITER) ;
        if(indexStartFunction!==-1){
            funcBody = funcBody.substring(indexStartFunction+FUNCTION_DELIMITER.length, funcBody.lastIndexOf(FUNCTION_DELIMITER)).trim() ;
        }
    }else{
        //new function
    }

    let data = {
        PG_TYPES: structuredClone(PG_TYPES),
        sqlToRun: "",
        funcBody: funcBody,
        metadata,
        table: table,
        schema: view.route.params.schema,
        funcName: funcName,
        func: func,
        language: language,
        isModify: !!view.route.params.func,
        triggerDef: triggerDef
    }

    return data;
};


function computeFuncCodeFromName(ev){
    if(view.data.isModify){ return ;}
    let oldName = ev.oldValue;
    let newName = ev.newValue;
    let oldCode = normalizeString(oldName) ;
    if(view.data.func === oldCode){
        view.data.func = normalizeString(newName) ;
    }
}


view.runSQL = async()=>{
    let sql = `` ;

    if(view.data.triggerDef.code){
        sql += `DROP TRIGGER ${view.data.triggerDef.code} ON ${view.data.table};\n` ;
    }else{
        view.data.triggerDef.code = `${view.data.table}_${view.data.func}`
    }

    let events = "";
    if(view.data.triggerDef.beforeInsert && view.data.triggerDef.beforeUpdate && view.data.triggerDef.beforeDelete){
        events = "BEFORE INSERT OR UPDATE OR DELETE" ;
    }else if(view.data.triggerDef.beforeInsert && view.data.triggerDef.beforeUpdate){
        events = "BEFORE INSERT OR UPDATE" ;
    }else if(view.data.triggerDef.beforeUpdate && view.data.triggerDef.beforeDelete){
        events = "BEFORE UPDATE OR DELETE" ;
    }else if(view.data.triggerDef.beforeInsert){
        events = "BEFORE INSERT" ;
    }else if(view.data.triggerDef.beforeUpdate){
        events = "BEFORE UPDATE" ;
    }else if(view.data.triggerDef.beforeDelete){
        events = "BEFORE DELETE" ;
    }else if(view.data.triggerDef.afterInsert && view.data.triggerDef.afterUpdate && view.data.triggerDef.afterDelete){
        events = "AFTER INSERT OR UPDATE OR DELETE" ;
    }else if(view.data.triggerDef.afterInsert && view.data.triggerDef.afterUpdate){
        events = "AFTER INSERT OR UPDATE" ;
    }else if(view.data.triggerDef.afterUpdate && view.data.triggerDef.afterDelete){
        events = "AFTER UPDATE OR DELETE" ;
    }else if(view.data.triggerDef.afterInsert){
        events = "AFTER INSERT" ;
    }else if(view.data.triggerDef.afterUpdate){
        events = "AFTER UPDATE" ;
    }else if(view.data.triggerDef.afterDelete){
        events = "AFTER DELETE" ;
    }

    sql += `DROP FUNCTION IF EXISTS "${view.data.schema}"."${view.data.func}" ;

CREATE FUNCTION "${view.data.schema}"."${view.data.func}"()
RETURNS TRIGGER AS
${FUNCTION_DELIMITER}
${view.data.funcBody}
${FUNCTION_DELIMITER}
LANGUAGE "${view.data.language}";

COMMENT ON FUNCTION "${view.data.schema}"."${view.data.func}" IS '${(view.data.funcName??"").replaceAll("'", "''")}';

CREATE TRIGGER ${view.data.triggerDef.code}
   ${events}
   ON "${view.data.schema}"."${view.data.table}"
   FOR EACH  ROW 
       EXECUTE PROCEDURE "${view.data.schema}"."${view.data.func}"() ;
`

    let {modal, element} = bootstrap.dialogs.modal({ title: "Run SQL", size: "lg"});

    element.addEventListener('shown.bs.modal', ()=>{
        element.querySelector(".modal-body").innerHTML = `<z-view z-path="/run_sql/${encodeURIComponent(sql)}" style="height: 500px; display: block"></z-view>` ;
    }) ;

    element.addEventListener("runDone", (ev)=>{
        // @ts-ignore
        modal.hide() ;
        document.dispatchEvent(new CustomEvent("schemaChanged"));
        if(view.route.params.func){
            view.refresh() ;
        }else{
            document.dispatchEvent(new CustomEvent("changeView", { detail: `/edit_trigger/${view.data.schema}/${view.data.table}/${view.data.func}`}))
        }
    }) ;
    
}


view.deleteTrigger = async()=>{
     let sql = `DROP TRIGGER ${view.data.triggerDef.code} ON ${view.data.table};
DROP FUNCTION IF EXISTS "${view.data.schema}"."${view.data.func}" ;`

    let {modal, element} = bootstrap.dialogs.modal({ title: "Run SQL", size: "lg"});

    element.addEventListener('shown.bs.modal', ()=>{
        element.querySelector(".modal-body").innerHTML = `<z-view z-path="/run_sql/${encodeURIComponent(sql)}" style="height: 500px; display: block"></z-view>` ;
    }) ;

    element.addEventListener("runDone", (ev)=>{
        // @ts-ignore
        modal.hide() ;
        document.dispatchEvent(new CustomEvent("schemaChanged"));
        document.dispatchEvent(new CustomEvent("changeView", { detail: ""}))
    }) ;
    
}

view.addEventListener("displayed", ()=>{
    let updateFromGrid = false;

    view.data.addListener("funcName", computeFuncCodeFromName);
    view.data.addListener("language",  ()=>{
        if(editorFunc){
            editorFunc.setModelLanguage(editorFunc.getModel(), view.data.language==="plv8"?"javascript":"sql");
        }
    });
    


    // @ts-ignore
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' }});
    // @ts-ignore
    require(['vs/editor/editor.main'], function () {
        // @ts-ignore
        editorFunc = monaco.editor.create(view.getElementById('funcEditor'), {
            value: '',
            language: view.data.language==="plv8"?"javascript":"sql",
            theme: 'vs-dark',
            //automaticLayout: true
        });
        editorFunc.setValue(view.data.funcBody);
        editorFunc.onDidChangeModelContent(() => {
            view.data.funcBody = editorFunc.getValue()
        });
    });


    if(!view.data.isModify){
        view.getElementById("funcName").focus() ;
    }
    
});