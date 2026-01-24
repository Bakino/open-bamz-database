/*global view*/

// @ts-ignore
let gridApi ;

//prepare data
view.loader = async ()=>{

    let result = await dbApi.mutations.dbadmin_get_table_metadata({ input: {p_schema: view.route.params.schema, p_table: view.route.params.table}}) ;
    
    console.log(result) ;

    let data = {
       metadata: result,
       schema: view.route.params.schema,
       table: view.route.params.table
    }

    return data;
};

function addToFilter(queryFilter, field, ope, value){
    if(!queryFilter[field]){
        queryFilter[field] = {} ;
    }
    if(queryFilter[field][ope]){
        if(!queryFilter[field].and){
            queryFilter[field].and = [] ;
        }
        queryFilter[field].and.push({[ope]: value}) ;
    }else{
        queryFilter[field][ope] = value ;
    }
}

function addFilterCondition(queryFilter, field, filter){
    if(filter.operator === "AND" || filter.operator === "OR"){
        if(!queryFilter[filter.operator.toLowerCase()]){
            queryFilter[filter.operator.toLowerCase()] = [] ;
        }
        let subFilter = queryFilter[filter.operator.toLowerCase()];
        for(let cond of filter.conditions){
            let part = {};
            addFilterCondition(part, field, cond);
            subFilter.push(part) ;
        }
    }else{
        let filterType = filter.type||filter.filterType ;
        switch(filterType){
            case 'set':
                addToFilter(queryFilter, field, "in", filter.values) ;
                break;
            case 'contains':
            case 'text':
                addToFilter(queryFilter, field, "likeInsensitive", "%"+filter.filter+"%") ;
                break;
            case 'notContains':
                addToFilter(queryFilter, field, "notLikeInsensitive", "%"+filter.filter+"%") ;
                break;
            case 'equals':
                if(filter.filterType === "date"){
                    if(!queryFilter.and){
                        queryFilter.and = []
                    }
                    let fromPart = {} ;
                    addToFilter(fromPart, field, "greaterThanOrEqualTo", filter.dateFrom) ;
                    queryFilter.and.push(fromPart) ;
                    let toPart = {} ;
                    const date = new Date(filter.dateFrom);
                    date.setHours(23, 59, 59, 999);
                    addToFilter(toPart, field, "lessThanOrEqualTo", date.toISOString()) ;
                    queryFilter.and.push(toPart) ;
                }else{
                    addToFilter(queryFilter, field, "equalTo", filter.filter) ;
                }
                break;
            case 'notEqual':
                addToFilter(queryFilter, field, "notEqualTo", filter.filter) ;
                break;
            case 'startsWith':
                addToFilter(queryFilter, field, "likeInsensitive", filter.filter+"%") ;
                break;
            case 'endsWith':
                addToFilter(queryFilter, field, "likeInsensitive", "%"+filter.filter) ;
                break;
            case 'greaterThan':
                addToFilter(queryFilter, field, "greaterThan", filter.filter??filter.dateFrom) ;
                break;
            case 'greaterThanOrEqual':
                addToFilter(queryFilter, field, "greaterThanOrEqualTo", filter.filter??filter.dateFrom) ;
                break;
            case 'lessThan':
                addToFilter(queryFilter, field, "lessThan", filter.filter??filter.dateFrom) ;
                break;
            case 'lessThanOrEqual':
                addToFilter(queryFilter, field, "lessThanOrEqualTo", filter.filter??filter.dateFrom) ;
                break;
            case 'inRange':
                if(!queryFilter.and){
                    queryFilter.and = []
                }
                if(filter.filterType === "date"){
                    let fromPart = {} ;
                    addToFilter(fromPart, field, "greaterThanOrEqualTo", filter.dateFrom) ;
                    queryFilter.and.push(fromPart) ;
                    let toPart = {} ;
                    const date = new Date(filter.dateTo);
                    date.setHours(23, 59, 59, 999);
                    addToFilter(toPart, field, "lessThanOrEqualTo", date.toISOString()) ;
                    queryFilter.and.push(toPart) ;
                }else{
                    let fromPart = {} ;
                    addToFilter(fromPart, field, "greaterThanOrEqualTo", filter.filter) ;
                    queryFilter.and.push(fromPart) ;
                    let toPart = {} ;
                    addToFilter(toPart, field, "lessThanOrEqualTo", filter.filterTo) ;
                    queryFilter.and.push(toPart) ;
                }
                break;
            case 'blank':
                addToFilter(queryFilter, field, "isNull", true) ;
                break;
            case 'notBlank':
                addToFilter(queryFilter, field, "isNull", false) ;
                break;
            case 'checked':
                addToFilter(queryFilter, field, "equalTo", true) ;
                break;
            case 'unchecked':
                addToFilter(queryFilter, field, "equalTo", false) ;
                break;
            default:
                throw new Error("filter type "+filterType+" unexpected");
        } 
    }
}

function camelToSnakeCase(str, uppercase = true) {
    if (!str) return str;
    
    const startsWithUnderscore = str.startsWith('_');
    
    const converted = str
        .replace(/^_/, '')
        // Look for capital letters that are followed by lowercase letters
        // OR look for groups of capital letters that come before a lowercase letter
        // OR look for capital letters that come at the end of the string
        .replace(/([A-Z])(?=[a-z])|([A-Z]+)(?=[A-Z][a-z])|([A-Z]+)$/g, function(match, single, group, end) {
            if (single) return '_' + single;        // Single capital before lowercase
            if (group) return '_' + group;          // Group of capitals before a capital-lowercase sequence
            if (end) return '_' + end;              // Group of capitals at the end
        })
        .replace(/^_/, '') // Remove leading underscore if added
        [uppercase ? 'toUpperCase' : 'toLowerCase']();
    
    return startsWithUnderscore ? '_' + converted : converted;
}


const ICON_COPY = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16">
    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
    </svg>` ;
const ICON_COPIED = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard-check" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0"/>
  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
</svg>` ;
class CopyRenderer {
    constructor() { }
   
    init(params) {
        this.params = params;
        if(!this.elCell){
            this.elCell = document.createElement('div');
            this.elCell.className = "h-100 w-100 d-flex align-items-center" ;
            this.elValue = document.createElement('div');
            this.elValue.className = "flex-grow-1 overflow-hidden" ;
            this.elCell.appendChild(this.elValue) ;
            if(navigator.clipboard){
                this.buttonCopy = document.createElement('button');
                this.buttonCopy.type = "button" ;
                this.buttonCopy.className = "ms-auto btn btn-sm btn-light btn-copy" ;
                this.buttonCopy.title = "Copy to clipboard" ;
                this.buttonCopy.innerHTML = ICON_COPY ;
                this.buttonCopy.addEventListener("click", async ()=>{
                    let str = this.params.value ;
                    if(params.getDataToCopy){
                        str = params.getDataToCopy(this.params) ;
                    }
                    await navigator.clipboard.writeText(str) ;
                    this.buttonCopy.innerHTML = ICON_COPIED;
                    this.buttonCopy.classList.add("text-success") ;
                    setTimeout(()=>{
                        this.buttonCopy.innerHTML = ICON_COPY;
                        this.buttonCopy.classList.remove("text-success") ;
                    }, 1000)
                }) ;
                this.elCell.appendChild(this.buttonCopy) ;
            }

        }

        const renderedValue = params.cellRenderer(params) ;
        if(typeof(renderedValue) === "string"){
            //it is raw HTML
            this.elValue.innerHTML = renderedValue ;
        }else if(renderedValue){
            //it is an HTML element
            this.elValue.innerHTML = "" ;
            this.elValue.appendChild(renderedValue) ;
        }else{
            //it is null
            this.elValue.innerHTML = "" ;
        }
        
    }
    getGui() {
        return this.elCell;
    }
    refresh(params) {
        this.params = params;
        const renderedValue = params.cellRenderer(params) ;
        if(typeof(renderedValue) === "string"){
            //it is raw HTML
            this.elValue.innerHTML = renderedValue ;
        }else if(renderedValue){
            //it is an HTML element
            this.elValue.innerHTML = "" ;
            this.elValue.appendChild(renderedValue) ;
        }else{
            //it is null
            this.elValue.innerHTML = "" ;
        }
        return true;
    }
    destroy() {
    }
}

let numberFormat = new Intl.NumberFormat();
let decimalFormat = new Intl.NumberFormat(undefined,{ maximumFractionDigits: 30 });
let decimalDisplayFormat = new Intl.NumberFormat(undefined,{ minimumFractionDigits: 2, maximumFractionDigits: 2 });
let grid = null;
async function createGrid(){
    const gridOptions = {
        rowModelType: "infinite",
        defaultColDef: {
            floatingFilter: true,
            
            resizable: true
        },
        rowSelection: {
            mode: 'multiRow',
        },
        datasource: agGridBamzComponents.dbDatasource({ schema: view.data.schema, table: view.data.table }),
        // datasource: {
        //         async getRows(params) {

        //             let startRow = params.startRow;
        //             let endRow = params.endRow;
                    

        //             let limit = endRow - startRow + 1 ;
        //             let offset = startRow ; 

        //             let sortModel = params.sortModel;
        //             let filterModel = params.filterModel;
                   

        //             let queryFilters = {} ;

        //             Object.keys(filterModel).forEach(field => {
        //                 addFilterCondition(queryFilters, field, filterModel[field]) ;
                        
        //             });
                    
        //             let query = `query GridQuery {
        //                 ${view.data.metadata.graphqlQuery}(
        //                     offset: ${offset}
        //                     first:  ${limit}
        //                     ${sortModel.length>0?`orderBy: [${sortModel.map(s=>camelToSnakeCase(s.colId)+"_"+s.sort.toUpperCase()).join(",")}]`:""}
        //                     ${Object.keys(queryFilters).length>0?`filter: ${JSON.stringify(queryFilters).replace(/"([^"]+)":/g, '$1:')}`:""}
        //                 ) {
        //                     totalCount
        //                     nodes {
        //                         ${view.data.metadata.columns.map(col=>col.graphqlName).join("\n")}
        //                     }
        //                 }
        //             }`

        //             try{
        //                 let result = (await window.openbamz.queryGraphql(query)).data[view.data.metadata.graphqlQuery] ;
        //                 view.data.totalCount = numberFormat.format(result.totalCount);
        //                 params.successCallback(result.nodes, result.totalCount);
        //             }catch(err){
        //                 console.error("Error getting data", err)
        //                 params.failCallback() ;
        //             }
                   


        //         }
        // },
        // Column Definitions: Defines the columns to be displayed.

        
        columnDefs: [
            {
                field: "actions",
                width: 60,
                headerName: "Actions",
                cellRenderer: agGridBamzComponents.CellViewZRenderer,
                cellRendererParams: {
                    html: `<button type="button" title="Modify" class="btn btn-sm btn-outline-primary mt-1" z-on-click="view.modifyRow(data)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16">
                        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/>
                        </svg>
                    </button>`,
                },
            },
        ].concat(view.data.metadata.columns.map(col=>{
            //https://www.ag-grid.com/javascript-data-grid/value-formatters/
            let valueFormatter = undefined;
            const cellRenderer = agGridBamzComponents.CopyRenderer
            const cellRendererParams=  {
                //cellRenderer : params => `<db-value db-schema="${view.data.schema}" db-table="${view.data.table}" db-column="${col.graphqlName}" value="${params.value}" />`
                cellRenderer : params => {
                    const elValue = document.createElement("SPAN") ;
                    // @ts-ignore
                    DbValue.renderDbValue({schema: view.data.schema, table: view.data.table, column: col.graphqlName, value: params.value, elValue}) ;
                    return elValue;
                }
            }
            let filter = "agTextColumnFilter";
            let filterParams = {
                buttons : ['reset', 'apply'],
            };
            if(col.type === "uuid"){
                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    cellRenderer : params => params.value ? `<span class="badge text-bg-light border text-secondary border-secondary" title="${params.value}">${params.value.split("-")[0]}</span>`:""
                }*/
                filterParams.filterOptions = ["equals", "notEqual", "blank", "notBlank"];
                filterParams.defaultOption = "equals";
            }else if(col.type?.startsWith("timestamp")){
                filter = "agDateColumnFilter";
                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    cellRenderer : params => {
                        if(!params.value){ return "" ; }
                        let dt = new Date(params.value) ;
                        return dt.toLocaleDateString()+' <span class="text-secondary">'+dt.toLocaleTimeString()+"</span>"
                    }
                }*/
            }else if(col.type?.startsWith("date")){
                filter = "agDateColumnFilter";
                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    cellRenderer : params => {
                        if(!params.value){ return "" ; }
                        let dt = new Date(params.value) ;
                        return dt.toLocaleDateString()
                    }
                }*/
            }else if(col.type?.startsWith("time")){
                filter = "agTextColumnFilter";
                filterParams.filterOptions = ["equals", "notEqual", "inRange", "blank", "notBlank", "lessThan", "lessThanOrEqual","greaterThan", "greaterThanOrEqual"];
                filterParams.defaultOption = "equals";
                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    cellRenderer : params => {
                        if(!params.value){ return "" ; }
                        let dt = new Date(new Date().toISOString().substring(0,10)+"T"+params.value) ;
                        return dt.toLocaleTimeString()
                    }
                }*/
            }else if(col.type === "integer" || col.type === "smallint" || col.type === "bigint"){
                filter = "agNumberColumnFilter";
                filterParams.filterOptions = ["equals", "notEqual", "inRange", "blank", "notBlank", "lessThan", "lessThanOrEqual","greaterThan", "greaterThanOrEqual"];
                filterParams.defaultOption = "equals";

                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    cellRenderer : params => params.value ? `<div class="text-end me-1 overflow-hidden text-truncate">${numberFormat.format(params.value)}</div>`:""

                }*/
            }else if(col.type === "real" || col.type === "double precision" || col.type === "numeric"){
                filter = "agNumberColumnFilter";
                if(col.type === "numeric"){
                    filter = "agTextColumnFilter";
                    filterParams.filterOptions = ["equals", "notEqual", "inRange", "blank", "notBlank", "lessThan", "lessThanOrEqual","greaterThan", "greaterThanOrEqual"];
                    filterParams.defaultOption = "equals";
                }
                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    cellRenderer : params => params.value ? `<div class="text-end me-1 overflow-hidden text-truncate" title="${decimalFormat.format(params.value)}">${decimalDisplayFormat.format(params.value)}</div>`:""

                }*/
            }else if(col.type === "text" || col.type === "character varying" || col.type === "bpchar"){
                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    cellRenderer : params => params.value ? `<div class="me-1 overflow-hidden text-truncate" title="${params.value}">${params.value}</div>`:""

                }*/
            }else if(col.type.startsWith("json")){
                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    getDataToCopy: params => JSON.stringify(params.value),
                    cellRenderer : params => {
                        if(!params.value){ return "" ; }
                        let jsonStr = JSON.stringify(params.value) ;
                        let preview = jsonStr.replace(/"([^"]+)":/g, '$1:').replace(/,/g, ', ').replace(/:/g, ': ');
                        return `<div class="me-1 overflow-hidden text-truncate" title="${jsonStr}">${preview}</div>`
                    }

                }*/
            }else if(col.type.startsWith("xml")){
                /*cellRenderer = CopyRenderer
                cellRendererParams=  {
                    cellRenderer : params => {
                        if(!params.value){ return "" ; }
                        let str = params.value.replaceAll("<", "&lt;").replaceAll(">", "&gt;") ;
                        return `<div class="me-1 overflow-hidden text-truncate" title="${str.replaceAll('"', '')}">${str}</div>`
                    }

                }*/
            }else if(col.type === "boolean"){
                //cellRenderer = "agCheckboxCellRenderer";
                filterParams = {
                    buttons : ['reset', 'apply'],
                    filterOptions: [
                        'empty',
                        {
                            displayKey: 'checked',
                            displayName: "Checked",
                            test: function (filterValue, cellValue) {
                            return cellValue != null && ""+cellValue === "true";
                            },
                            numberOfInputs: 0,
                        },
                        {
                            displayKey: 'unchecked',
                            displayName: "Unchecked",
                            test: function (filterValue, cellValue) {
                            return !cellValue || ""+cellValue === "false";
                            },
                            numberOfInputs: 0,
                        },
                    ]
                };
            }else if(col.type === "bytea"){
                /*cellRenderer = class ByteaRenderer {
                    download(){
                        const resumeData = JSON.parse(this.params.value);
                        let resumeByteA = Object.keys(resumeData).map((key) => resumeData[key]);
                        uint8Array = new Uint8Array(resumeByteA);
                        const blob = new Blob([uint8Array], { type: "application/octet-stream" });
        
                        // Créer une URL pour le Blob
                        const url = window.URL.createObjectURL(blob);
                        
                        // Créer un lien de téléchargement
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = filename;
                        
                        // Ajouter temporairement le lien au document
                        document.body.appendChild(link);
                        
                        // Déclencher le téléchargement
                        link.click();
                        
                        // Nettoyer
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        
                        return true;
                    }
                    init(params) {
                        this.params = params;
                        if(!this.elCell){
                            this.elCell = document.createElement('button');
                            this.elCell.className = "btn btn-link btn-sm" ;
                            this.elCell.type="button" ;
                            this.elCell.innerHTML = "download";
                            this.elCell.addEventListener("click", ()=>{
                                this.download()
                            })

                        }
                        
                    }
                    getGui() {
                        return this.elCell;
                    }
                }*/
            }
            return {
                field: col.graphqlName,
                headerName: col.description,
                valueFormatter,
                cellRenderer,
                cellRendererParams,
                filter,
                filterParams,
            }
        }))
    };

    agGrid.ModuleRegistry.registerModules([
        agGrid.AllCommunityModule, 
    ]);
    const gridElement = /** @type HTMLElement */ (view.querySelector('#grid'));
    // @ts-ignore
    grid = agGrid.createGrid(gridElement, gridOptions);
}

view.displayed = async ()=>{
    await createGrid() ;
}

function formatValue(colName, value){
    let col = view.data.metadata.columns.find(c=>c.code === colName) ;

    if(col.type === "integer" || col.type === "smallint" || col.type === "bigint" || col.type === "real" || col.type === "double precision" || col.type === "numeric"){
        return value;
    }else{
        return "'"+value.replaceAll("'", "''")+"'" ;
    }
}

view.refreshed = async ()=>{
    grid.destroy() ;
    await createGrid() ;
}

view.deleteRows = async ()=>{
    let rowsToDelete = grid.getSelectedRows() ;
    if(rowsToDelete.length === 0){ return bootstrap.dialogs.error({message: "Please select at least one row"}) ; }
    let sqlDelete = rowsToDelete.map(r=>`DELETE FROM "${view.data.schema}"."${view.data.table}" WHERE ${
        view.data.metadata.primaryKey.map(k=>`${k} = ${formatValue(k, r[k])}`).join(" AND ")} ;\n`).join("") ;
    let {modal, element} = bootstrap.dialogs.modal({ title: "Run SQL", size: "lg"});

    element.addEventListener('shown.bs.modal', ()=>{
        element.querySelector(".modal-body").innerHTML = `<z-view z-path="/run_sql/${encodeURIComponent(sqlDelete)}" style="height: 500px; display: block"></z-view>` ;
    }) ;

    element.addEventListener("runDone", (ev)=>{
        // @ts-ignore
        modal.hide() ;
        grid.deselectAll() ;
        grid.refreshInfiniteCache() ;
    }) ;
}

view.deleteTable = async ()=>{
    let sqlDelete = `DROP TABLE "${view.data.schema}"."${view.data.table}"` ;
    
    let {modal, element} = bootstrap.dialogs.modal({ title: "Run SQL", size: "lg"});

    element.addEventListener('shown.bs.modal', ()=>{
        element.querySelector(".modal-body").innerHTML = `<z-view z-path="/run_sql/${encodeURIComponent(sqlDelete)}" style="height: 100px; display: block"></z-view>` ;
    }) ;

    element.addEventListener("runDone", (ev)=>{
        // @ts-ignore
        modal.hide() ;
        view.router.navigateTo("/")
    }) ;
}

async function openEditPopup(row){
    // @ts-ignore
    const viewPopup = new ViewZ({ title: "Modify row", html: `<form>
    <div class="container-fluid">
        <div class="row">
            ${view.data.metadata.columns.map(col=>`<div class="col-12">
            <db-field 
                z-bind="${col.code}"
                db-schema="${view.data.schema}" 
                db-table="${view.data.table}" db-column="${col.code}" />
            </div>`).join("")}
        </div>
        <div class="row mt-2">
            <div class="col-6">
                <button class="btn btn-outline-secondary" z-on-click="view.closePopup()" type="button">Cancel</button>
            </div>
            <div class="col-6 text-end">
                <button class="btn btn-success" z-on-click="view.validate()" type="button">Validate</button>
            </div>
        </div>
    </div>
    </form>`}) ;

    viewPopup.loader = ()=>{
        // @ts-ignore
        return viewPopup.route.params.row ;
    }

    viewPopup.validate = ()=>{
        if(bootstrap.validateForm(/** @type HTMLFormElement */(viewPopup.querySelector("form"))) ){
            viewPopup.closePopup(viewPopup.data) ;
        }
    }

    let modifiedRow = await dialogs.viewModal({ view: viewPopup, openParams: { row } }) ;
    return modifiedRow ;
}


view.modifyRow = noWaiter(async (row)=>{
    if(view.data.metadata.primaryKey.length === 0){ return bootstrap.dialogs.error("No primary key") ; }

    let modifiedRow = await openEditPopup(row) ;

    if(modifiedRow){
        delete modifiedRow._globals;
        const updateRecord = {...modifiedRow} ;
        for(let pk of view.data.metadata.primaryKey){
            delete updateRecord[pk] ;
        }
        waiter(async ()=>{
            await dbApi.db[view.data.table]["updateBy"+view.data.metadata.primaryKey.map(f=>f[0].toUpperCase() + f.slice(1)).join("And")].apply( 
                dbApi.db[view.data.table], view.data.metadata.primaryKey.map(f=>modifiedRow[f]).concat(updateRecord)) ;

            grid.deselectAll() ;
            grid.refreshInfiniteCache() ;
        });
    }
});

view.addRow = async ()=>{
    let modifiedRow = await openEditPopup({}) ;

    if(modifiedRow){
        delete modifiedRow._globals;

        waiter(async ()=>{
            await dbApi.db[view.data.table]["create"](modifiedRow) ;
            grid.deselectAll() ;
            grid.refreshInfiniteCache() ;
        })

    }
}

view.modifyTable = ()=>{
    document.dispatchEvent(new CustomEvent("changeView", { detail: `/edit_table/${view.data.schema}/${view.data.table}`}))
}

view.createTrigger = ()=>{
    document.dispatchEvent(new CustomEvent("changeView", { detail: `/edit_trigger/${view.data.schema}/${view.data.table}`}))
}