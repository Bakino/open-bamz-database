import { prepareFormatFunction } from "./db-helpers.mjs";
import { getGraphqlClient } from "./db-lib.mjs";

function addToFilter(queryFilter, dbApi, schema, table, field, ope, value){
    const schemaDef = dbApi.schemas.find(s=>s.schema === (schema??"public")) ;
    
    if(!schemaDef){
        throw new Error(`Can't find schema ${schema}`) ;
    }

    const tableDef = schemaDef.tables.find(t=>t.table_name === table) ;
    if(!tableDef){
        throw new Error(`Can't find table ${schema}.${table}`) ;
    }

    const columnDef = tableDef.columns.find(t=>t.column_name === field) ;
    if(!columnDef){
        throw new Error(`Can't find column ${schema}.${table}.${field}`) ;
    }

    if(columnDef.reference && ope !== "isNull"){
        // the column reference an other table, the search must be added on the other table
        const referencedTable = schemaDef.tables.find(t=>t.table_name === columnDef.reference.referenced_table);
        if(!referencedTable){
            throw new Error(`Can't find referenced table ${schema}.${table}.${field} : ${columnDef.reference.referenced_table}`) ;
        }

        if(!referencedTable.options?.formatRecord){
            prepareFormatFunction({table: referencedTable}) ;
        }

        if(!queryFilter[referencedTable.table_name+"_by_"+field]){
            queryFilter[referencedTable.table_name+"_by_"+field] = {} ;
        }
        const orSearch = {} ;
        for(let key of referencedTable.options.formatKeys){
            orSearch[key] = {[ope]: value} ;
        }
        queryFilter[referencedTable.table_name+"_by_"+field].or = orSearch ;
    }else{
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

}

function addFilterCondition(queryFilter, dbApi, schema, table, field, filter){



    if(filter.operator === "AND" || filter.operator === "OR"){
        if(!queryFilter[filter.operator.toLowerCase()]){
            queryFilter[filter.operator.toLowerCase()] = [] ;
        }
        let subFilter = queryFilter[filter.operator.toLowerCase()];
        for(let cond of filter.conditions){
            let part = {};
            addFilterCondition(part, dbApi, schema, table, field, cond);
            subFilter.push(part) ;
        }
    }else{
        let filterType = filter.type||filter.filterType ;
        switch(filterType){
            case 'set':
                addToFilter(queryFilter, dbApi, schema, table,field, "in", filter.values) ;
                break;
            case 'contains':
            case 'text':
                addToFilter(queryFilter, dbApi, schema, table,field, "likeInsensitive", "%"+filter.filter+"%") ;
                break;
            case 'notContains':
                addToFilter(queryFilter, dbApi, schema, table,field, "notLikeInsensitive", "%"+filter.filter+"%") ;
                break;
            case 'equals':
                if(filter.filterType === "date"){
                    if(!queryFilter.and){
                        queryFilter.and = []
                    }
                    let fromPart = {} ;
                    addToFilter(fromPart, dbApi, schema, table,field, "greaterThanOrEqualTo", filter.dateFrom) ;
                    queryFilter.and.push(fromPart) ;
                    let toPart = {} ;
                    const date = new Date(filter.dateFrom);
                    date.setHours(23, 59, 59, 999);
                    addToFilter(toPart, dbApi, schema, table,field, "lessThanOrEqualTo", date.toISOString()) ;
                    queryFilter.and.push(toPart) ;
                }else{
                    addToFilter(queryFilter, dbApi, schema, table,field, "equalTo", filter.filter) ;
                }
                break;
            case 'notEqual':
                addToFilter(queryFilter, dbApi, schema, table,field, "notEqualTo", filter.filter) ;
                break;
            case 'startsWith':
                addToFilter(queryFilter, dbApi, schema, table,field, "likeInsensitive", filter.filter+"%") ;
                break;
            case 'endsWith':
                addToFilter(queryFilter, dbApi, schema, table,field, "likeInsensitive", "%"+filter.filter) ;
                break;
            case 'greaterThan':
                addToFilter(queryFilter, dbApi, schema, table,field, "greaterThan", filter.filter??filter.dateFrom) ;
                break;
            case 'greaterThanOrEqual':
                addToFilter(queryFilter, dbApi, schema, table,field, "greaterThanOrEqualTo", filter.filter??filter.dateFrom) ;
                break;
            case 'lessThan':
                addToFilter(queryFilter, dbApi, schema, table,field, "lessThan", filter.filter??filter.dateFrom) ;
                break;
            case 'lessThanOrEqual':
                addToFilter(queryFilter, dbApi, schema, table,field, "lessThanOrEqualTo", filter.filter??filter.dateFrom) ;
                break;
            case 'inRange':
                if(!queryFilter.and){
                    queryFilter.and = []
                }
                if(filter.filterType === "date"){
                    let fromPart = {} ;
                    addToFilter(fromPart, dbApi, schema, table,field, "greaterThanOrEqualTo", filter.dateFrom) ;
                    queryFilter.and.push(fromPart) ;
                    let toPart = {} ;
                    const date = new Date(filter.dateTo);
                    date.setHours(23, 59, 59, 999);
                    addToFilter(toPart, dbApi, schema, table,field, "lessThanOrEqualTo", date.toISOString()) ;
                    queryFilter.and.push(toPart) ;
                }else{
                    let fromPart = {} ;
                    addToFilter(fromPart, dbApi, schema, table,field, "greaterThanOrEqualTo", filter.filter) ;
                    queryFilter.and.push(fromPart) ;
                    let toPart = {} ;
                    addToFilter(toPart, dbApi, schema, table,field, "lessThanOrEqualTo", filter.filterTo) ;
                    queryFilter.and.push(toPart) ;
                }
                break;
            case 'blank':
                addToFilter(queryFilter, dbApi, schema, table,field, "isNull", true) ;
                break;
            case 'notBlank':
                addToFilter(queryFilter, dbApi, schema, table,field, "isNull", false) ;
                break;
            case 'checked':
                addToFilter(queryFilter, dbApi, schema, table,field, "equalTo", true) ;
                break;
            case 'unchecked':
                addToFilter(queryFilter, dbApi, schema, table,field, "equalTo", false) ;
                break;
            default:
                throw new Error("filter type "+filterType+" unexpected");
        } 
    }
}

export class DbFieldCellEditor {
    init(params) {
        this.params = params;
        if(!this.elCell){
            // @ts-ignore
            this.elCell = /**@type {DbField}*/ (document.createElement('db-field'));
            if(params.isPopup){
                this.elCell.style.display = "block" ;
                this.elCell.style.width = params.eGridCell.clientWidth+"px" ;
            }
            this.elCell.noMargin = true ;
            this.elCell.noLabel = true ;
            if(params.app){
                this.elCell.app = params.app ;
            }
            if(params.schema){
                this.elCell.schema = params.schema ;
            }
            if(params.table){
                this.elCell.table = params.table ;
            }
            if(params.column){
                this.elCell.column = params.column ;
            }
            if(params.type){
                this.elCell.type = params.type ;
            }
        }

        this.elCell.value = params.value ;
    }
    afterGuiAttached(){
        if(this.params.api.getGridOption("editType") !== "fullRow"){
            this.elCell.focus() ;
        }
    }
    focusIn(){
        this.elCell.focus() ;
    }
    getGui() {
        return this.elCell;
    }
    getValue(){
        return this.elCell.value ;
    }
    destroy() {
    }
    isPopup() {
        return this.params.isPopup ;
    }
}

export default {
    /**
     * This function receive a column options (https://www.ag-grid.com/javascript-data-grid/column-definitions/)
     * and add option automatically from 
     * a database column definition
     * 
     * It use the following options (name in options / name on <ag-grid>) : 
     *   - dbApp / db-app (optional, use current app if not given) 
     *   - dbSchema / db-schema (optional, use "public" if not given)
     *   - dbTable / db-table : the table name (required)
     *   - dbColumn / db-column : the column name (required)
     */
    columnOptionsTransformer: async function({ options, agGridBamzComponents }){
        if(options.dbColumn){
            const appName = options.dbApp ;
            const schemaName = options.dbSchema ;
            const tableName = options.dbTable ;
            const columnName = options.dbColumn ;

            if(!tableName){
                throw new Error("db-table option is required") ;
            }

            const dbApi = await getGraphqlClient(appName) ;

            const schema = dbApi.schemas.find(s=>s.schema === (schemaName??"public")) ;
    
            if(!schema){
                throw new Error(`Can't find schema ${schemaName}`) ;
            }

            const table = schema.tables.find(t=>t.table_name === tableName) ;
            if(!table){
                throw new Error(`Can't find table ${schemaName}.${tableName}`) ;
            }

            const column = table.columns.find(t=>t.column_name === columnName) ;
            if(!column){
                throw new Error(`Can't find column ${schemaName}.${tableName}.${columnName}`) ;
            }

            const columnOptions = { ...options } ;
            delete columnOptions.dbApp;
            delete columnOptions.dbSchema;
            delete columnOptions.dbTable;
            delete columnOptions.dbColumn;

            if(!columnOptions.headerName){
                // @ts-ignore
                columnOptions.headerName = await window.DbField.getFieldLabel({schema, table, column}) ;
            }

            //https://www.ag-grid.com/javascript-data-grid/value-formatters/
            let valueFormatter = undefined;
            // @ts-ignore
            const cellRenderer = agGridBamzComponents.CopyRenderer ;
            const cellRendererParams=  {
                cellRenderer : params => {
                    const elValue = document.createElement("SPAN") ;
                    // @ts-ignore
                    window.DbValue.renderDbValue({app: appName, schema: schemaName, table: tableName, column: columnName, value: params.value, elValue}) ;
                    return elValue;
                }
            }
            let filter = "agTextColumnFilter";
            let filterParams = {
                buttons : ['reset', 'apply'],
            };
            if(column.reference){
                const referencedTable = schema.tables.find(t=>t.table_name === column.reference.referenced_table);
                if(referencedTable){
                    // if referenced table, use normal text filter
                    filter = "agTextColumnFilter";
                }else{
                    filter = null;
                }
            }else if(column.data_type === "uuid"){
                filterParams.filterOptions = ["equals", "notEqual", "blank", "notBlank"];
                filterParams.defaultOption = "equals";
            }else if(column.data_type?.startsWith("timestamp")){
                filter = "agDateColumnFilter";
            }else if(column.data_type?.startsWith("date")){
                filter = "agDateColumnFilter";
            }else if(column.data_type?.startsWith("time")){
                filter = "agTextColumnFilter";
                filterParams.filterOptions = ["equals", "notEqual", "inRange", "blank", "notBlank", "lessThan", "lessThanOrEqual","greaterThan", "greaterThanOrEqual"];
                filterParams.defaultOption = "equals";
            }else if(column.data_type === "integer" || column.data_type === "smallint" || column.data_type === "bigint"){
                filter = "agNumberColumnFilter";
                filterParams.filterOptions = ["equals", "notEqual", "inRange", "blank", "notBlank", "lessThan", "lessThanOrEqual","greaterThan", "greaterThanOrEqual"];
                filterParams.defaultOption = "equals";
            }else if(column.data_type === "real" || column.data_type === "double precision" || column.data_type === "numeric"){
                filter = "agNumberColumnFilter";
                if(column.data_type === "numeric"){
                    filter = "agTextColumnFilter";
                    filterParams.filterOptions = ["equals", "notEqual", "inRange", "blank", "notBlank", "lessThan", "lessThanOrEqual","greaterThan", "greaterThanOrEqual"];
                    filterParams.defaultOption = "equals";
                }
            }else if(column.data_type === "text" || column.data_type === "character varying" || column.data_type === "bpchar"){
                //no special parameters
            }else if(column.data_type.startsWith("json")){
                //no special parameters
            }else if(column.data_type.startsWith("xml")){
                //no special parameters
            }else if(column.data_type === "boolean"){
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
            }else if(column.data_type === "bytea"){
                //no special parameters
            }

            columnOptions.field = columnName;
            columnOptions.valueFormatter = valueFormatter;
            columnOptions.cellRenderer = cellRenderer;
            columnOptions.cellRendererParams = cellRendererParams;
            columnOptions.filter = filter;
            columnOptions.filterParams = filterParams;

            if(options.editable){
                columnOptions.editable = true ;
                columnOptions.cellEditor = DbFieldCellEditor ;
                columnOptions.cellEditorParams = {
                    app: appName,
                    schema: schemaName,
                    table: tableName,
                    column: columnName,
                    isPopup: !!column.reference
                }
            }

            return columnOptions ;
        }
    },

    components: {
        // a data source using database
        dbDatasource: function({app, schema, table, filter}){
            const gridElm = this;
            return {
                async getRows(params) {

                    if(!table){
                        throw new Error("table option is required") ;
                    }
                    
                    const dbApi = await getGraphqlClient(app) ;
 
                    let startRow = params.startRow;
                    let endRow = params.endRow;
                    

                    let limit = endRow - startRow + 1 ;
                    let offset = startRow ; 

                    let sortModel = params.sortModel;
                    let filterModel = params.filterModel;
                
                    let queryFilters = { } ;

                    Object.keys(filterModel).forEach(field => {
                        addFilterCondition(queryFilters, dbApi, schema, table, field, filterModel[field]) ;
                    });

                    //add base filter
                    let filterCopy = {...filter} ;
                    if(this.filter){
                        //filter given after init, use it instead
                        filterCopy = {...this.filter} ;
                    }
                    for(let k of Object.keys(queryFilters)){
                        if(filter && Object.keys(filterCopy).includes(k)){
                            queryFilters[k].and = filterCopy[k] ; //add the base condition
                            delete filterCopy[k];
                        }
                    }
                    queryFilters = {...queryFilters, ...filterCopy} ;

                    if(this.quickFilter){
                        const grid = await gridElm.getGrid() ;
                        let queryQuick = [] ;
                        for(let colDef of grid.getColumnDefs()){
                            let cond = {} ;
                            cond[colDef.field] = { likeInsensitive: "%"+this.quickFilter+"%" } ;
                            queryQuick.push(cond) ;
                        }
                        // @ts-ignore
                        queryQuick = { or: queryQuick } ;
                        if(Object.keys(queryFilters).length > 0){
                            queryFilters = { and : [
                                queryFilters,
                                queryQuick
                            ]}
                        }else{
                            queryFilters = queryQuick ;
                        }
                    }

                    
                    try{
                        const searchOptions = {
                            first: limit, 
                            offset: offset,
                        }
                        if(sortModel && sortModel.length > 0){
                            searchOptions.orderBy = sortModel.map(s=>(s.colId+"_"+s.sort).toUpperCase()) ;
                        }
                        let db = dbApi.db;
                        if(schema && schema !== "public"){
                            db = db[schema] ;
                        }
                        if(!db[table]){
                            throw `The table ${table} is unknown` ;
                        }
                        const result = await db[table].searchPagination(queryFilters,
                            searchOptions
                        ) ;                        
                        params.successCallback(result.results, result.totalCount);
                    }catch(err){
                        console.error("Error getting data", err);
                        //window.alert(err.message||err) ;
                        params.failCallback(err) ;
                    }
                }
            }
        }, 
        DbFieldCellEditor
    },
    extends: (AgGridElement)=>{

        /**********  override rowData to listen to modification and autorefresh  ***********/
        // const descriptor = Object.getOwnPropertyDescriptor(AgGridElement.prototype, 'filter');

        // descriptor.set = function(filter) {
        //     this._filter = filter ;
        //     this.getGrid().then(()=>{
        //         this.grid.getGridOption("datasource").filter = filter ;
        //     });
        // };

        // descriptor.get = function() {
        //     if(!this.grid){
        //         return this._filter  ;
        //     }
        //     return this.grid.getGridOption("datasource").filter;
        // };

        Object.defineProperty(AgGridElement.prototype, 'filter', {
            set(filter) {
                this._filter = filter ;
                this.getGrid().then(()=>{
                    this.grid.getGridOption("datasource").filter = filter ;
                    this.grid.refreshInfiniteCache() ;
                });
            },
            get(){
                if(!this.grid){
                    return this._filter  ;
                }
                return this.grid.getGridOption("datasource").filter;
            }
        });

        Object.defineProperty(AgGridElement.prototype, 'quickFilter', {
            set(quickFilter) {
                this._quickFilter = quickFilter ;
                this.getGrid().then(()=>{
                    this.grid.getGridOption("datasource").quickFilter = quickFilter ;
                    this.grid.refreshInfiniteCache() ;
                });
            },
            get(){
                if(!this.grid){
                    return this._quickFilter  ;
                }
                return this.grid.getGridOption("datasource").quickFilter;
            }
        });

    }
    
}
