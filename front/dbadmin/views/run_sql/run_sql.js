/*global view*/

//prepare data
view.loader = async ()=>{
    let data = {
        results : [],
        sqlToRun: view.route.params.sql??"-- write SQL code here",
    }
    return data;
};

function splitSqlQueries(sqlString) {
    const queries = [];
    let currentQuery = '';
    let inString = false;
    let stringChar = '';
    let escaped = false;
    let functionDelimiter = null;
    let inFunctionBody = false;
    
    for (let i = 0; i < sqlString.length; i++) {
        const char = sqlString[i];
        
        // Check for the end of the function body
        if (inFunctionBody && functionDelimiter) {
            if (currentQuery.endsWith(functionDelimiter)) {
                console.log("OUT BODY", currentQuery)
                inFunctionBody = false;
                functionDelimiter = null;
            }
        }
        
        // Detect the start of the function body
        if (!inFunctionBody && currentQuery.toUpperCase().includes('AS')) {
            // @ts-ignore
            const asMatch = currentQuery.match(/^\s*CREATE.*FUNCTION.*\s+AS\s+([^\s]+)\s+$/is);
            console.log("IN BODY ??", currentQuery, asMatch)
            if (asMatch) {
                functionDelimiter = asMatch[1];
                inFunctionBody = true;
                console.log("IN BODY", functionDelimiter, currentQuery)
            }
        }
        
        // Handle escape characters
        if (char === '\\' && !escaped) {
            escaped = true;
            currentQuery += char;
            continue;
        }
        
        // Handle string characters
        if ((char === "'" || char === '"') && !escaped) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
                stringChar = '';
            }
        }
        
        // Detect semicolons outside of strings and function bodies
        if (char === ';' && !inString && !escaped && !inFunctionBody) {
            const trimmedQuery = currentQuery.trim();
            if (trimmedQuery) {
                queries.push(trimmedQuery);
            }
            currentQuery = '';
        } else {
            currentQuery += char;
        }
        
        escaped = false;
    }
    
    // Add the last query if it exists
    const trimmedQuery = currentQuery.trim();
    if (trimmedQuery) {
        queries.push(trimmedQuery);
    }
    
    return queries;
}

let grids = [];
view.runSql = async()=>{
    waiter(async ()=>{
        let queries = splitSqlQueries(view.data.sqlToRun) ;
        let firstRun = view.data.results.length === 0;

        const result = await dbApi.mutations.dbadmin_run_queries({ input: { queries: queries }}) ;

        view.dispatchEvent(new CustomEvent("runDone", {detail: result, bubbles: true})) ;
        document.dispatchEvent(new CustomEvent("schemaChanged"));
        view.data.results = result ;

        for(let grid of grids){
            grid.destroy();
        }
        grids = [] ;

        for(let i=0; i<view.data.results.length; i++){
            let res = view.data.results[i];

            if(res.result.length>0){
                
                const gridOptions = {
                    defaultColDef: {
                        //flex: 1,
                        filter: true,
                        floatingFilter: true,
                        resizable: true,
                        autoHeight: true,
                    },
                    columnDefs: Object.keys(result[i].result[0]).map(k=>{
                        return {
                            field : k,
                            headerName: k,
                            valueFormatter: params => {
                                if(typeof(params.value) === "object"){
                                    return JSON.stringify(params.value, (k, value)=>k.startsWith("__")?undefined:value) ;
                                }
                                return params.value;
                            }
                        }
                    }),
                    autoSizeStrategy: {
                        type: "fitCellContents",
                        defaultMinWidth: 100
                    },
                    rowData: res.result
                };

                agGrid.ModuleRegistry.registerModules([
                    agGrid.AllCommunityModule, 
                ]);
                
                const gridElement = /** @type HTMLElement */ (view.querySelectorAll('.grid-result')[i]);
                // @ts-ignore
                let grid = agGrid.createGrid(gridElement, gridOptions);

                
                grids.push(grid) ;
            }else if(res.result.length === 0){
                res.noResult = true;
            }else{
                res.countResult = true;
            }
        }

        if(firstRun){

            setTimeout(()=>{
                //editor.layout({height : editor.getScrollHeight()-480}) ;
                editor.layout({height :100}) ;
                window.dispatchEvent(new Event("resize")) ;
            }, 100);
        }
    });
}

// @ts-ignore
let editor;
view.displayed = async ()=>{
    // @ts-ignore
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' }});
    // @ts-ignore
    require(['vs/editor/editor.main'], function () {

        // @ts-ignore
        editor = monaco.editor.create(view.getElementById('sqlEditor'), {
            value: '',
            language: 'sql',
            theme: 'vs-dark',
            wordWrap: "on",
            minimap: {
                enabled: false
            },
            automaticLayout: true
        });
        editor.setValue(view.data.sqlToRun);
        editor.getAction('editor.action.formatDocument').run() ;
        editor.onDidChangeModelContent(() => {
            view.data.sqlToRun = editor.getValue()
        });
    });
}