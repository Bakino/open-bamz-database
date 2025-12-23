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
    let result = null;
    let args = [] ;
    let metadata = null;

    if(view.route.params.func){
        func = view.route.params.func;
        metadata = /** @type any */ (await dbApi.mutations.dbadmin_get_function_metadata({ input: {p_schema: view.route.params.schema, p_func: view.route.params.func}}))
        funcName = metadata.description;
        result = metadata.result;
        language = metadata.language;
        funcBody = metadata.definition ;
        const indexStartFunction = funcBody.indexOf(FUNCTION_DELIMITER) ;
        if(indexStartFunction!==-1){
            funcBody = funcBody.substring(indexStartFunction+FUNCTION_DELIMITER.length, funcBody.lastIndexOf(FUNCTION_DELIMITER)).trim() ;
        }
        args = metadata.arguments
    }else{
        //new function
    }

    let data = {
        PG_TYPES: structuredClone(PG_TYPES),
        args: args,
        sqlToRun: "",
        funcBody: funcBody,
        metadata,
        schema: view.route.params.schema,
        funcName: funcName,
        func: func,
        language: language,
        result: result,
        isModify: !!view.route.params.func
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

view.addParam = ()=>{
    view.data.args.push({}) ;
}

view.removeParam = async (param)=>{
    if(await bootstrap.dialogs.confirm("Are you sure to remove this param ?")){
        view.data.args.splice(view.data.args.indexOf(param), 1) ;
    }
}

view.runSQL = async()=>{
    let sql = `DROP FUNCTION IF EXISTS "${view.data.schema}"."${view.data.func}" ;

CREATE FUNCTION "${view.data.schema}"."${view.data.func}"(${view.data.args.map(p=>`"${p.name}" ${p.type}`).join(",")})
RETURNS ${view.data.result} AS
${FUNCTION_DELIMITER}
${view.data.funcBody}
${FUNCTION_DELIMITER}
LANGUAGE "${view.data.language}";

COMMENT ON FUNCTION "${view.data.schema}"."${view.data.func}" IS '${(view.data.funcName??"").replaceAll("'", "''")}';

`

    let {modal, element} = bootstrap.dialogs.modal({ title: "Run SQL", size: "lg"});

    element.addEventListener('shown.bs.modal', ()=>{
        element.querySelector(".modal-body").innerHTML = `<z-view z-path="/run_sql/${encodeURIComponent(sql)}" style="height: 500px; display: block"></z-view>` ;
    }) ;

    element.addEventListener("runDone", (ev)=>{
        // @ts-ignore
        modal.hide() ;
        view.refresh() ;
        document.dispatchEvent(new CustomEvent("schemaChanged"))
        if(view.route.params.func){
            view.refresh() ;
        }else{
            document.dispatchEvent(new CustomEvent("changeView", { detail: `/edit_func/${view.data.schema}/${view.data.func}`}))
        }
    }) ;
    
}

view.deleteFunc = async()=>{
     let sql = `DROP FUNCTION IF EXISTS "${view.data.schema}"."${view.data.func}" ;`

    let {modal, element} = bootstrap.dialogs.modal({ title: "Run SQL", size: "lg"});

    element.addEventListener('shown.bs.modal', ()=>{
        element.querySelector(".modal-body").innerHTML = `<z-view z-path="/run_sql/${encodeURIComponent(sql)}" style="height: 500px; display: block"></z-view>` ;
    }) ;

    element.addEventListener("runDone", (ev)=>{
        // @ts-ignore
        modal.hide() ;
        document.dispatchEvent(new CustomEvent("schemaChanged"))
        document.dispatchEvent(new CustomEvent("changeView", { detail: ""}))
    }) ;
    
}

view.addEventListener("displayed", ()=>{
    let updateFromGrid = false;

    view.addDataListener("funcName", computeFuncCodeFromName);
    view.addDataListener("language",  ()=>{
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