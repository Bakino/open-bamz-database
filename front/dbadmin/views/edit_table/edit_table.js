/*global view*/

// @ts-ignore
let gridApi, editor ;

//prepare data
view.loader = async ()=>{
    let tableName = "" ;
    let table = "" ;
    let columns = [] ;
    let options = {} ;
    let metadata = null;

    
    if(view.route.params.table){
        table = view.route.params.table;
        metadata = /** @type any */ (await dbApi.mutations.dbadmin_get_table_metadata({input: {p_schema: view.route.params.schema, p_table: view.route.params.table}})) ;
        tableName = metadata.description;
        columns = JSON.parse(JSON.stringify(metadata.columns)) ;
        options = JSON.parse(JSON.stringify(metadata.options)) ;
    }else{
        //new table
        columns.push({
            description: "Unique ID", code: "_id", type: "uuid", primary: true, defaultValue: "gen_random_uuid()", notNull: false, 
        });
        columns.push({
            description: "Create time", code: "_create_time", type: "timestamp without time zone", defaultValue: "now()", notNull: false, primary: false
        });
    }


    let data = {
        columns: columns,
        newColumn: {isNewLine: true, notNull: false,  primary: false, type: null, precision: null},
        sqlToRun: "",
        metadata,
        options,
        schema: view.route.params.schema,
        tableName: tableName,
        table: table,
        isModify: !!view.route.params.table
    }

    computeSql(data) ;

    return data;
};

//add new column
view.addRow = ()=>{
    if(!view.data.newColumn.code || !view.data.newColumn.type){
        return bootstrap.dialogs.error({message: "You must give at least one code and type"}) ;
    }
    if(view.data.columns.some(c=>c.code === view.data.newColumn.code)){
        return bootstrap.dialogs.error({message: "This code is already used"}) ;
    }
    delete view.data.newColumn.isNewLine
    let newRow = view.data.newColumn ;
    view.data.columns.push(newRow) ;
    view.data.newColumn = {isNewLine: true, notNull: false, primary: false}
    gridApi.setGridOption("pinnedBottomRowData", [view.data.newColumn]);
}
//remove a column
view.removeRow = (column)=>{
    const index = view.data.columns.findIndex(c=>c.code === column.code)
    view.data.columns.splice(index, 1) ;
}

view.editEnum = async (column)=>{
    let enumOptions = await dialogs.routeModal({route: "/popup/edit_enum/", openParams: {column}});
    if(enumOptions){
        column.enumOptions = enumOptions ;
        //gridApi.refreshCells({force: true}) ;
    }
}

view.changeReferencedTable = async (column, el)=>{
    console.log(column, el) ;
    let selectedTableAndSchema = el.value ;
    let selectColumn = el.parentElement.querySelector(".select-column") ;
    selectColumn.innerHTML = `<option value="">Choose column</option>`
    if(selectedTableAndSchema){
        let [schema, table] = selectedTableAndSchema.split(".") ;
        let columns = dbApi.schemas.find(s=>s.schema === schema)?.tables.find(t=>t.table_name === table).columns;
        selectColumn.innerHTML += `${columns.map(c=>`<option value="${c.column_name}">${c.column_name}</option>`).join("")}`
        if(column){
            if(column.referenced_column){
                selectColumn.value = column.referenced_column ;
            }else if(columns.length>0){
                selectColumn.value = columns[0].column_name ;
                column.referenced_column = columns[0].column_name ;
            }
        }
    }
}

function normalizeString(str){
    if(!str){ return str ; }
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]/, "") ;
}

// compute the column code automatically from the name
function computeCodeFromName(ev){
    let oldName = ev.oldValue;
    let newName = ev.newValue;
    let oldCode = normalizeString(oldName) ;
    let column = ev.target ;
    if(column.code === oldCode){
        column.code = normalizeString(newName) ;
    }
}

function computeTableCodeFromName(ev){
    if(view.data.isModify){ return ;}
    let oldName = ev.oldValue;
    let newName = ev.newValue;
    let oldCode = normalizeString(oldName) ;
    if(view.data.table === oldCode){
        view.data.table = normalizeString(newName) ;
    }
}



function computeSql(data){
    if(!data){
        data = view.data;
    }

    let sql = "";

    //prepare columns types
    for(let col of data.columns){
        if(col.type === "reference"){
            if(col.referenced_table && col.referenced_column){
                let [schema, table] = col.referenced_table.split(".") ;
                let column = dbApi.schemas.find(s=>s.schema === schema)?.tables.find(t=>t.table_name === table).columns.find(c=>c.column_name === col.referenced_column);
                col.referencedType = column.data_type;
            }
        }

        if(col.type === "enum"){
            let enumName = `${data.metadata.table}_${col.code}_${new Date().toISOString().substring(0,19).replaceAll("-", "_").replaceAll("T", "_").replaceAll(":", "_")}`
            let enumValuesList = col.enumOptions.values.map(e=>`'${e.value}'`).join(",") ;
            let enumComment = JSON.stringify(col.enumOptions).replaceAll("'", "''") ;
            let enumCreateSql = `CREATE TYPE "${data.schema}"."${enumName}" AS ENUM (${enumValuesList}) ;`
            let enumCommentSql = `COMMENT ON TYPE "${data.schema}"."${enumName}" IS '${enumComment}' ;`

            let isModification = false;
            if(data.isModify){
                let originalCol = data.metadata.columns.find(oc=>oc.code===col.code) ;
                if(originalCol && originalCol.type === "enum"){
                    isModification = true;
                    let hasEnumDiff = !originalCol.enumOptions.values.every(e=>col.enumOptions.values.some(ce=>ce.value === e.value)) ;
                    if(!hasEnumDiff){
                        hasEnumDiff = !col.enumOptions.values.every(e=>originalCol.enumOptions.values.some(ce=>ce.value === e.value))
                    }
                    if(hasEnumDiff){
                        // the values of the enum has been changed, we create a new enum
                        sql += "-- As the enum values has changed, we create a new enum\n"+enumCreateSql+"\n"+enumCommentSql +"\n";
                        // transform column to use new enum
                        sql += `-- Transform the colum to use the new enum
ALTER TABLE "${data.schema}"."${data.metadata.table}" 
ALTER COLUMN "${col.code}" TYPE "${data.schema}"."${enumName}"
USING CASE 
    -- if the existing value is in the new enum, it is kept
    WHEN "${col.code}"::varchar IN (${enumValuesList}) THEN "${col.code}"::varchar::"${data.schema}"."${enumName}"
    -- if it is not in the new enum, it is set to NULL
    ELSE NULL
END;
-- remove previous enum definition
DROP TYPE "${data.schema}"."${originalCol.pgType}";\n`
                    }else{
                        //no difference in values, check if labels changed
                        if(JSON.stringify(originalCol.enumOptions) !== JSON.stringify(col.enumOptions)){
                            sql += `COMMENT ON TYPE "${data.schema}"."${originalCol.pgType}" IS '${enumComment}' ;\n`
                        }
                    }
                }
            }

            if(!isModification){
                // create the type
                sql += enumCreateSql+"\n"+enumCommentSql +"\n";
                col.enumType = enumName ;
            }
        }
    }


    if(data.isModify){
        if(data.table !== data.metadata.table){
            sql += `ALTER TABLE "${data.schema}"."${data.metadata.table}" RENAME TO "${data.table}" ;\n` ;
        }

        let newColumns = [] ;
        let changedColumns = [] ;
        let renamedColumns = [] ;
        let changedColDescriptions = [] ;
        for(let col of data.columns){
            let originalCol = data.metadata.columns.find(oc=>oc.code===col.code) ;
            if(!originalCol){
                newColumns.push(col) ;
                continue;
            }
            let change = "";
            if(originalCol.type !== col.type || originalCol.precision !== col.precision){
                let typeOfCol = col.type;
                if(col.type === "enum"){
                    typeOfCol = col.enumType ;
                }else if(col.type === "reference"){
                    typeOfCol = col.referencedType ;
                }
                change+=` TYPE ${typeOfCol}${col.precision?`(${col.precision})`:""}`;
            }
            if(col.type === "reference"){
                if(originalCol.referenced_table && (originalCol.referenced_table !== col.referenced_table || originalCol.referenced_column !== col.referenced_column)){
                    change+=` TYPE ${col.referencedType}`;
                }
            }

            if(originalCol.defaultValue !== col.defaultValue){
                if(col.defaultValue){
                    change+=` SET DEFAULT ${col.defaultValue}`;
                }else{
                    change+=` DROP DEFAULT`;
                }
            }

            if(originalCol.notNull !== col.notNull){
                if(col.notNull){
                    change+=` SET NOT NULL`;
                }else{
                    change+=` DROP NOT NULL`;
                }
            }
            if(change){
                changedColumns.push({ col: col, change: `${'"'+col.code+'"'} ${change}`}) ;
            }

            if(originalCol.description !== col.description){
                changedColDescriptions.push(`COMMENT ON COLUMN  "${data.schema}"."${data.table}"."${col.code}" IS '${(col.description??"").replaceAll("'", "''")}' ;`)
            }
            if(originalCol.code !== col.code){
                renamedColumns.push(`ALTER TABLE "${data.schema}"."${data.table}" RENAME COLUMN  "${originalCol.code}" TO "${col.code}" ;`)
            }
        }
        let removedColumns = data.metadata.columns.filter(oc=>!data.columns.some(c=>oc.code===c.code)) ; 
        for(let col of newColumns){
            let typeOfCol = col.type;
            if(col.type === "enum"){
                typeOfCol = col.enumType ;
            }else if(col.type === "reference"){
                typeOfCol = col.referencedType ;
            }
            sql += `ALTER TABLE "${data.schema}"."${data.table}" ADD COLUMN ${'"'+col.code+'"'} ${typeOfCol}${col.precision?`(${col.precision})`:""}${col.notNull
    ?" NOT NULL":""}${col.defaultValue?" DEFAULT "+col.defaultValue:""};\n` ;

            if(col.type === "reference"){
                sql += `ALTER TABLE "${data.schema}"."${data.table}" ADD CONSTRAINT "fk_${data.table}_${col.code}" 
                    FOREIGN KEY ("${col.code}") REFERENCES "${col.referenced_table}" ("${col.referenced_column}");\n`;
            }

            changedColDescriptions.push(`COMMENT ON COLUMN  "${data.schema}"."${data.table}"."${col.code}" IS '${(col.description??"").replaceAll("'", "''")}' ;`)
        }
        for(let change of changedColumns){
            const col = change.col ;
            if(col.type === "reference"){
                let originalCol = data.metadata.columns.find(oc=>oc.code===col.code) ;
                if(originalCol.referenced_table && (originalCol.referenced_table !== col.referenced_table || originalCol.referenced_column !== col.referenced_column)){
                    sql += `ALTER TABLE "${data.schema}"."${data.table}" DROP CONSTRAINT "fk_${data.table}_${col.code}" ;\n`;
                }
            }
            sql += `ALTER TABLE "${data.schema}"."${data.table}" ALTER COLUMN ${change.change};\n` ;
            if(col.type === "reference"){
                sql += `ALTER TABLE "${data.schema}"."${data.table}" ADD CONSTRAINT "fk_${data.table}_${col.code}" 
                    FOREIGN KEY ("${col.code}") REFERENCES "${col.referenced_table}" ("${col.referenced_column}");\n`;
            }
        }
        for(let col of removedColumns){
            if(col.type === "reference"){
                sql += `ALTER TABLE "${data.schema}"."${data.table}" DROP CONSTRAINT "fk_${data.table}_${col.code}" ;\n`;
            }
            sql += `ALTER TABLE "${data.schema}"."${data.table}" DROP COLUMN ${'"'+col.code+'"'};\n` ;
        }

       
        sql += changedColDescriptions.join("\n") ;
        sql += renamedColumns.join("\n") ;

        if(!sql){
            sql = "-- No modifications"
        }
    }else{

        sql = `CREATE TABLE "${data.schema}"."${data.table}" (
${data.columns.map(col=>`\t${('"'+col.code+'"').padEnd(20," ")} ${col.enumType||col.referencedType||col.type}${col.precision?`(${col.precision})`:""}${col.notNull
    ?" NOT NULL":""}${col.primary?" PRIMARY KEY":""}${col.defaultValue?" DEFAULT "+col.defaultValue:""}`).join(",\n")}
);

${data.columns.map(col=>`COMMENT ON COLUMN  "${data.schema}"."${data.table}"."${col.code}" IS '${(col.description??"").replaceAll("'", "''")}';\n`).join("")}
        
        ` ;

        for(let col of data.columns){
            if(col.type === "reference"){
                sql += `\nALTER TABLE "${data.schema}"."${data.table}" ADD CONSTRAINT "fk_${data.table}_${col.code}" 
                    FOREIGN KEY ("${col.code}") REFERENCES "${col.referenced_table}" ("${col.referenced_column}");\n`;
            }
        }
    }

    let modifyTableComment = !data.isModify || data.tableName !== data.metadata.description || JSON.stringify(data.options) !== JSON.stringify(data.metadata.options) ;

    if(modifyTableComment){
        let tableComment = {
            ...data.options,
            description: data.tableName||data.table
        }

        sql += `\nCOMMENT ON TABLE "${data.schema}"."${data.table}" IS '${JSON.stringify(tableComment).replaceAll("'", "''")}';` ;

    }



    data.sqlToRun = sql ;
    if(editor){
        editor.setValue(data.sqlToRun);
        editor.getAction('editor.action.formatDocument').run()
    }
}

view.runSql = async()=>{
    await dbApi.mutations.dbadmin_run_query({input: {query: view.data.sqlToRun}}) ;
    document.dispatchEvent(new CustomEvent("schemaChanged"))
    await dialogs.info("SQL executed successfully") ;
    view.refresh() ;
}

view.displayed = async ()=>{
    let updateFromGrid = false;

    //prepare grid of all columns
    const gridOptions = {
        rowData: view.data.columns, //columns
        pinnedBottomRowData: [view.data.newColumn], //new line at the bottom
        singleClickEdit: true,
        domLayout: 'autoHeight',
        suppressNoRowsOverlay: true,
        defaultColDef: {
            resizable: true
        },
        getRowId: (params) => String(params.data.code),
        columnDefs: [
            { field: "description", flex: 3, editable: true, cellRenderer: (params) => params.value || `<span class="text-muted">Name of the column</span>` },
            { field: "code", flex: 2, editable: true, cellRenderer: (params) => params.value || `<span class="text-muted">Technical code of the column</span>` },
            { field: "type", flex: 3, editable: true,
                cellEditor: agGridBamzComponents.CellViewZEditor,
                cellEditorParams: {
                    html: `<select z-bind="type" class="form-control">
                        ${PG_TYPES.map(group=>`<optgroup label="${group.group}">
                            ${group.types.map(type=>
                                `<option value="${type.value}">${type.label}</option>`
                            ).join("")}
                        </optgroup>
                        `).join("")}
                    </select>
                    `,
                },
                cellRenderer: agGridBamzComponents.CellViewZRenderer,
                cellRendererParams: {
                    html: `${PG_TYPES.map(group=>group.types.map(type=>
                        `<span z-show-if="data.type=='${type.value}'">${type.label} <a href="${type.link}" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-question-circle" viewBox="0 0 16 16">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                        <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286m1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94"/>
                        </svg></a></span>`
                    ).join("")).join("")}
                    <span class="text-muted" z-hide-if="data.type">Type of the column</span>`
                }
            },
            { field: "Options", flex: 2, editable: true,
                cellEditor: agGridBamzComponents.CellViewZEditor,
                cellEditorParams: {
                    html: `${PG_TYPES.map(group=>group.types.map(type=>
                        `<div class="d-flex" z-show-if="data.type=='${type.value}'">
                            ${type.precision?`<input type="text" z-bind="precision" class="form-control" placeholder="${type.precision.join(", ")}"/>`: ``}
                        </div>
                        `
                    ).join("")).join("")}
                    <div z-show-if="data.type=='enum'">
                        <button type="button" title="Edit values" class="btn btn-sm btn-outline-primary mb-1 mt-1 ms-1" z-on-click="view.editEnum(data)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-fill" viewBox="0 0 16 16">
                                <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"/>
                            </svg>
                        </button>
                        <span z-bind="entry of enumOptions.values">
                            <span>\${entry.label}</span>
                            <code>\${entry.value}</code>
                        </span>
                    </div>
                    <div z-show-if="data.type=='reference'" class="d-flex">
                        <select class="form-control select-table" z-bind="referenced_table" 
                            z-on-change="view.changeReferencedTable(data, this)"
                            z-on-bound="view.changeReferencedTable(data, this)">
                            <option value="">Choose table</option>
                            ${dbApi.schemas.map(schema=>
                                schema.tables.map(table=>
                                    `<option value="${schema.schema}.${table.table_name}">${schema.schema==="public"?"":`[${schema.schema}] `}${table.description||table.table_name}</option>`
                                ).join("")
                            ).join("")}
                        </select>
                        <select class="form-control select-column" z-bind="referenced_column">
                           <option value="">Choose column</option>
                        </select>
                    </div>
                    `,
                },
                cellRenderer: agGridBamzComponents.CellViewZRenderer,
                cellRendererParams: {
                    html: `<span z-show-if="data.precision">(\${precision})</span><span class="text-muted" z-hide-if="data.type">Options</span>
                    <div z-show-if="data.type=='enum'">
                        <span z-bind="entry of enumOptions.values">
                            <span>\${entry.label}</span>
                            <code>\${entry.value}</code>
                        </span>
                    </div>
                    <div z-show-if="data.type=='reference'">
                        \${referenced_table.replace('public.', '')}.\${referenced_column}
                    </div>`
                }
            },
            { field: "notNull", flex: 1, editable: true, 
                cellRenderer: 'agCheckboxCellRenderer',
                cellEditor: 'agCheckboxCellEditor',
            },
            { field: "primary", flex: 1, editable: true, 
                cellRenderer: 'agCheckboxCellRenderer',
                cellEditor: 'agCheckboxCellEditor',
            },
            { field: "defaultValue", flex: 3, editable: true, cellRenderer: (params) => params.value || `<span class="text-muted">Default value</span>` },
            {
                field: "actions",
                flex: 1,
                headerName: "Actions",
                cellRenderer: agGridBamzComponents.CellViewZRenderer,
                cellRendererParams: {
                    html: `<button z-show-if="data.isNewLine" type="button" title="Add the column" class="btn btn-sm btn-primary mt-1" z-on-click="view.addRow()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle" viewBox="0 0 16 16">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
                        </svg> 
                    </button>
                    
                    <button z-hide-if="data.isNewLine" type="button" title="Remove the column" class="btn btn-sm btn-outline-danger mt-1" z-on-click="view.removeRow(data)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash-circle" viewBox="0 0 16 16">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                        <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8"/>
                        </svg>
                    </button>`,
                },
            },
        ],
        onCellValueChanged: params => {
            updateFromGrid = true;
        }
    };

    agGrid.ModuleRegistry.registerModules([
        agGrid.AllCommunityModule, 
    ]);
    const gridElement = /** @type HTMLElement */ (view.querySelector('#grid'));
    // @ts-ignore
    gridApi = agGrid.createGrid(gridElement, gridOptions);

    //auto refresh grid contents
    function onColumnsChange(){
        if(updateFromGrid){
            updateFromGrid = false;
        }else{
            gridApi.setGridOption("rowData", view.data.columns);
        }
        computeSql() ;
    }
    view.addDataListener("columns.*.*", onColumnsChange);
    view.addDataListener("columns.*.*.*", onColumnsChange);
    view.addDataListener("columns.*.*.*.*", onColumnsChange);
    view.addDataListener("columns.*.*.*.*.*", onColumnsChange);
    view.addDataListener("columns.length", ()=>{
        gridApi.setGridOption("rowData", view.data.columns);
        computeSql() ;
    });
    view.addDataListener("columns", ()=>{
        // all columns has been reloaded, refresh table
        gridApi.setGridOption("rowData", view.data.columns);
    });

    //auto compute code from name
    view.addDataListener("newColumn.description", computeCodeFromName);

    view.addDataListener("tableName", computeTableCodeFromName);
    view.addDataListener("tableName", ()=>computeSql());
    view.addDataListener("table",  ()=>computeSql());
    view.addDataListener("options.*",  ()=>computeSql());
    


    // @ts-ignore
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs' }});
    // @ts-ignore
    require(['vs/editor/editor.main'], function () {

        // @ts-ignore
        editor = monaco.editor.create(view.getElementById('sqlEditor'), {
            value: '',
            language: 'sql',
            theme: 'vs-dark',
            //automaticLayout: true
        });
        editor.setValue(view.data.sqlToRun);
        editor.getAction('editor.action.formatDocument').run() ;
        editor.onDidChangeModelContent(() => {
            view.data.sqlToRun = editor.getValue()
        });
    });


    if(!view.data.isModify){
        view.getElementById("tableName").focus() ;
    }

    view.addEventListener("viewz-cell-rendered", (ev)=>{
        // @ts-ignore
        if(ev.detail?.data?.type === "reference"){
            // @ts-ignore
            const selectElm = ev.detail.element.querySelector(".select-table") ;
            if(selectElm){
                // @ts-ignore
                view.changeReferencedTable(ev.detail.data, ev.detail.element.querySelector(".select-table")) ;
            }
        }
        console.log("viewz-cell-rendered", ev) ;
    }) ;
    
}