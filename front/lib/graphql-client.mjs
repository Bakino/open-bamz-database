function graphqlObjectToHierarchy(obj){
    let str = "" ;
    for(let [k, value] of Object.entries(obj)){
        str += k ;
        if(typeof(value) === "object"){
            str += graphqlObjectToHierarchy(value)
        }
        str += "\n" ;
    }
    return ` { 
        ${str}
    }`;
}

function getFinalType(type){
    let typeName = type;
    if(!typeName.name && type.ofType){
        return getFinalType(type.ofType)
    }
    return typeName;
}


function prepareQueryArgs(query, params, typesByName, cleanArgs){
    let input = [];
    let visitedArgs = [] ;
    for(let arg of query.args){
        visitedArgs.push(arg.name) ;
        let value = params[arg.name] ;
        if(!value && arg.name === "input"){
            value = {} ;
        }
        if(value === undefined){
            if(arg?.type?.kind === "NOT_NULL" || arg?.type?.kind === "NON_NULL"){
               throw `Param ${arg.name} is required for ${query.name}` ;
            }
            continue;
        }
        if(value === null){
            if(arg?.type?.kind === "NOT_NULL" || arg?.type?.kind === "NON_NULL"){
                throw `Param ${arg.name} is required for ${query.name}` ;
             }
            input.push(`${arg.name}: null`) ;
            continue;
        }
        let typeOfArg = getFinalType(arg.type);
        let formattedValue = ""+value;
        if(typeOfArg?.kind === "OBJECT" || typeOfArg?.kind === "INPUT_OBJECT" || (typeOfArg?.kind === "SCALAR" && typeOfArg?.name === "JSON")){
            const type = typesByName[typeOfArg.name] ; 
            if(type?.inputFields){
                if(arg?.type?.kind === "LIST" && Array.isArray(value)){
                    let formattedValues = [] ;
                    for(let v of value){
                        formattedValues.push(`{ ${prepareQueryArgs({name: query.name + " > "+type.name, args: type.inputFields}, v, typesByName).join(",")} }`);
                    }
                    formattedValue = `[${formattedValues.join(",")}]` ;
                }else{
                    formattedValue = `{ ${prepareQueryArgs({name: query.name + " > "+type.name, args: type.inputFields}, value, typesByName).join(",")} }`;
                }
            }else{
                formattedValue = JSON.stringify(value).replace(/"(\w+)":/g, '$1:') ;
            }
        }else if(arg?.type?.kind === "LIST"){
            if(typeOfArg?.kind === "ENUM"){
                if(!Array.isArray(value)){
                    value = [value] ;
                }
                formattedValue = `[${value.join(",")}]` ;
            }else{
                formattedValue = JSON.stringify(value) ;
            }
        }else if(typeOfArg?.kind === "ENUM" || ["Int", "Float",  "Boolean"].includes(typeOfArg?.name)){
            formattedValue = value ;
        }else{
            if(typeof(value) === "object"){
                //JSON
                formattedValue = JSON.stringify(value).replace(/"(\w+)":/g, '$1:') ;
            }else{
                if(value.includes("\n")){
                    formattedValue = `"""${value}"""` ;
                }else{
                    formattedValue = `"${value.replaceAll('"', '\\"')}"` ;
                }
            }
        }
        input.push(`${arg.name}: ${formattedValue}`)
    }
    if(cleanArgs){
        //called with clean argument, remove the arguments that are not in query params
        for(let k of Object.keys(params)){
            delete params[k] ;
        }
    }
    return input;
}

function prepareQueryOutput(output, outputTypeName,typesByName, depth){
    if(depth > 3){ return ;}
    if(outputTypeName){
        let outputType = typesByName[outputTypeName] ;
        for(let field of outputType.fields){
            if(field.name === "nodeId"){
                //don't add nodeId automatically
                continue;
            }
            if(field.args && field.args.length>0){
                //subquery, don't add automatically
                continue;
            }
            if(field?.type?.name === "Query"){
                continue;
            }
            let fieldType = getFinalType(field.type);
            if(fieldType.kind === "LIST"){
                //sublist, don't add automatically
                continue;
            }
            if(fieldType.kind === "OBJECT"){
                if(depth === 3){
                    //don't go deeper
                    continue;
                }
                if(field.description && field.description.startsWith('Reads ')){
                    //skip relational field that read other tables
                    continue;
                }
                output[field.name] = {};
                prepareQueryOutput(output[field.name], fieldType.name, typesByName, depth+1)
            }else{
                output[field.name] = true;
            }
        }
    }    
}

class GraphqlClient {
    constructor(appName){
        // @ts-ignore
        this.appName = appName??window.BAMZ_APP;
        this.cacheGraphqlSchema = null ;
        this.queries = {} ;
        this.mutations = {} ;
        this.db = {
            mutations: {},
            queries: {}
        } ;
    }

    cloneTransaction(){
        let clone = new GraphqlClient(this.appName) ;
        clone.cacheGraphqlSchema = this.cacheGraphqlSchema ;
        clone.db = {transactionRecords: [], mutations: {}, queries: {} } ;
        for(let [schemaOrTable, obj] of Object.entries(this.db)){
            clone.db[schemaOrTable] = {isTransaction: true, transactionRecords: clone.db.transactionRecords} ;
            for(let [k, f] of Object.entries(obj)){
                if(typeof(f) === "function"){
                    clone.db[schemaOrTable][k] = f.bind(clone.db[schemaOrTable]);
                }else{
                    clone.db[schemaOrTable][k] = {isTransaction: true, transactionRecords: clone.db.transactionRecords} ;
                    for(let [k2, f2] of Object.entries(f)){
                        clone.db[schemaOrTable][k][k2] = f2.bind(clone.db[schemaOrTable][k]);
                    }
                }
            }
        }
        return clone ;
    }

    async transaction(cb){
        const clone = this.cloneTransaction() ;
        await cb(clone) ;
        const originalRecordById = {} ;
        for(let params of clone.db.transactionRecords){
            if(params.record){
                originalRecordById [params.id] = params.record ;
                const [schemaName, tableName] = params.table_name.split(".") ;
                const cleanRecord = {} ;
                const schema = this.schemas.find(s=>s.schema === schemaName) ;
                if(schema){
                    const table = schema.tables.find(t=>t.table_name === tableName) ;
                    if(table){
                        for(let c of table.columns){
                            cleanRecord[c.column_name] = params.record[c.column_name] ;
                        }
                        params.record = cleanRecord;
                    }
                }
            }
        }
        const result = await this.queryGraphql(`mutation TransactionMutation {
  openbamz_run_transaction(
    input: {records: ${JSON.stringify(clone.db.transactionRecords).replace(/"(\w+)":/g, '$1:').replaceAll('action:"insert"', 'action:insert').replaceAll('action:"update"', 'action:update').replaceAll('action:"delete"', 'action:delete')} }
  ) {
    result {
      action
      key
      record
      table_name
      id
    }
  }
}`) ;
        const transactionResults = result?.data?.openbamz_run_transaction?.result ;
        if(transactionResults){
            for(let transactionRecord of transactionResults){
                if(transactionRecord.id){
                    const originalRecord =  originalRecordById[transactionRecord.id] ;
                    if(originalRecord){
                        for(let [key, value] of Object.entries(transactionRecord.record)){
                            originalRecord[key] = value ;
                        }
                    }
                }
            }
        }
        return result?.data?.openbamz_run_transaction?.result;
    }

    async init(){
        let schemas = [] ;
        try{
            let resultsSchema = await this.queryGraphql(`mutation MyMutation {
                openbamz_list_schema_and_tables(input: {}) {
                    result
                }
            }`) ;
    
            schemas = resultsSchema.data.openbamz_list_schema_and_tables.result ;
        }catch(err){
            console.warn("Error while fetching schema", err) ;
            schemas = [] ;
        }

        this.schemas = schemas;

        let results = await this.queryGraphql(`query IntrospectionQuery {
      __schema {
        description
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          ...FullType
        }
        directives {
          name
          description
          
          locations
          args(includeDeprecated: true) {
            ...InputValue
          }
        }
      }
    }

    fragment FullType on __Type {
      kind
      name
      description
      
      fields(includeDeprecated: true) {
        name
        description
        args(includeDeprecated: true) {
          ...InputValue
        }
        type {
          ...TypeRef
        }
        isDeprecated
        deprecationReason
      }
      inputFields(includeDeprecated: true) {
        ...InputValue
      }
      interfaces {
        ...TypeRef
      }
      enumValues(includeDeprecated: true) {
        name
        description
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        ...TypeRef
      }
    }

    fragment InputValue on __InputValue {
      name
      description
      type { ...TypeRef }
      defaultValue
      isDeprecated
      deprecationReason
    }

    fragment TypeRef on __Type {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
        `) ;
        let typesByName = {} ;
        //let tableList = [] ;
        for(let type of results.data.__schema.types){
            typesByName[type.name] = type;
            // if(type.kind === "OBJECT" && type.fields[0]?.name === "nodeId"){
            //     tableList.push(type.name) ;
            // }
        }
        let queries = typesByName["Query"].fields ;
        let self = this;
        for(let query of queries){
            if(query.name === "query" || query.name === "nodeId" || query.name === "node"){
                continue;
            }
            this.queries[query.name] = async function(params={}, output=null){
                const input = prepareQueryArgs(query, params, typesByName) ;

                if(!output){
                    output = {} ;
                    prepareQueryOutput(output, query.type.name,typesByName, 0)
                }


                let strInput = "";
                if(input.length>0){
                    strInput = `(${input.join(", ")})` ;
                }
                let strQuery = `query ${query.name} {
                    ${query.name}${strInput}${graphqlObjectToHierarchy(output)}
                }`;
                let result = await self.queryGraphql(strQuery) ;
                return result.data[query.name] ;
            }
        }

        let mutations = typesByName["Mutation"].fields ;
        for(let mutation of mutations){
            this.mutations[mutation.name] = async function(params={}, output=null){
                const input = prepareQueryArgs(mutation, params, typesByName) ;

                let isResultOnly = false;
                if(!output){
                    output = {} ;
                    prepareQueryOutput(output, mutation.type.name,typesByName, 0) ;
                    if(Object.keys(output).length === 2 && output.clientMutationId && output.result){
                        isResultOnly = true;
                        output = { result: output.result } ; 
                    }
                }


                let strInput = "";
                if(input.length>0){
                    strInput = `(${input.join(", ")})` ;
                }
                let strQuery = `mutation ${mutation.name} {
                    ${mutation.name}${strInput}${graphqlObjectToHierarchy(output)}
                }`;
                let result = await self.queryGraphql(strQuery) ;
                if(isResultOnly){
                    return result.data[mutation.name]?.result ;
                }else{
                    return result.data[mutation.name] ;
                }
            }
        }

        for(let schema of schemas){
            if( schema.tables.length === 0){ continue; }

            let dbObject;
            if(schema.schema === "public"){
                dbObject = this.db ;
            }else{
                this.db[schema.schema] = {
                    mutations: {},
                    queries: {}
                } ;
                dbObject = this.db[schema.schema];
            }

            const standardQueries = []; 
            const standardMutations = []; 

            for(let tableOfSchema of schema.tables){
                const table = tableOfSchema.table_name ;
                let fullTable = schema.schema+"_"+table ;
                if(schema.schema === "public"){
                    fullTable = table ;
                }
                dbObject[table] = {} ;

                if(this.queries["all_"+fullTable]){
                    standardQueries.push("all_"+fullTable) ;
                    dbObject[table].searchPagination = async function(filter={}, searchParams={}){
                        if(this.isTransaction){ throw "Search is not supported in transaction" ; }
                        let params = { filter: structuredClone(filter)} ;
                        for(let [key, value] of Object.entries(searchParams)){
                            if(key !== "output"){
                                params[key] = value ;
                            }
                        }
                        for(let [key, value] of Object.entries(params.filter)){
                            if(typeof(value) !== "object"){
                                if(value === null){
                                    params.filter[key] = {isNull: true} ;
                                }else if(typeof(value) === "string" && value.includes("*")){
                                    params.filter[key] = {likeInsensitive: value.replaceAll("*", "%")} ;
                                }else{
                                    params.filter[key] = {equalTo: value} ;
                                }
                            }
                        }
                        if(Object.keys(params.filter).length === 0){
                            delete params.filter ;
                        }
                        let result = await self.queries["all_"+fullTable](params, searchParams.output) ;
                        return { results: result.nodes, totalCount: result.totalCount} ;
                    }

                    dbObject[table].search = async function(filter={}, searchParams={}){
                        let result = await this.searchPagination(filter, searchParams) ;
                        return result.results ;
                    }

                    dbObject[table].searchFirst = async function(filter={}, searchParams={}){
                        searchParams.first = 1 ;
                        let results = await this.search(filter, searchParams) ;
                        return results[0] ;
                    }
                }
                let getQueries = Object.keys(this.queries).filter(q=>q.startsWith(fullTable+"_by_")) ;
                for(let q of getQueries){
                    let fields = q.replace(fullTable+"_by_", "").split("_and_") ;
                    let funcName = "getBy"+fields.map(f=>f[0].toUpperCase() + f.slice(1)).join("And") ;
                    standardQueries.push(funcName) ;
                    dbObject[table][funcName] = function(/*fieldValue, field2Value..., output=null*/){
                        if(this.isTransaction){ throw "Read is not supported in transaction" ; }
                        const params = {} ;
                        for(let i=0; i<fields.length; i++){
                            params[fields[i]] = arguments[i] ;
                        }
                        const output = arguments.length>fields.length?arguments[arguments.length-1]:null ;
                        return self.queries[q](params, output) ;
                    }
                }
                if(this.mutations["create_"+fullTable]){
                    standardMutations.push("create_"+fullTable) ;
                    dbObject[table].create = async function(record, output=null){

                        const params = { input: {[fullTable] : record }}

                        if(this.isTransaction){ 
                            const recordId = schema.schema+"_"+table+"_"+this.transactionRecords.length ;
                            const transactionRecord = {action: "insert", table_name: schema.schema+"."+table, record: record, id: recordId}
                            this.transactionRecords.push(transactionRecord) ;
                            //prepare a placeholder object that can be use to reference value of the final record. the actual value will be replaced on server side
                            const objPlaceholder = {} ;
                            for(let col of tableOfSchema.columns){
                                objPlaceholder[col] = "${"+recordId+"."+col.column_name+"}" ;
                            }
                            return objPlaceholder ;
                        }
                        
                        let result = await self.mutations["create_"+fullTable](params, output) ;

                        for(let [key, value] of Object.entries(result)){
                            //update the received record with values after insert
                            record[key] = value ;
                        }
                        return result[fullTable] ;
                    }
                }
                let deleteMutations = Object.keys(this.mutations).filter(q=>q.startsWith("delete_"+fullTable+"_by_")) ;
                for(let m of deleteMutations){
                    let fields = m.replace("delete_"+fullTable+"_by_", "").split("_and_") ;
                    let funcName = "deleteBy"+fields.map(f=>f[0].toUpperCase() + f.slice(1)).join("And") ;
                    standardMutations.push(funcName) ;
                    dbObject[table][funcName] = function(/*fieldValue, field2Value..., output=null*/){
                        const params = {input: {}} ;
                        for(let i=0; i<fields.length; i++){
                            params.input[fields[i]] = arguments[i] ;
                        }
                        if(this.isTransaction){ 
                            const recordId = schema.schema+"_"+table+"_"+this.transactionRecords.length ;
                            let transactionRecord = {action: "delete", table_name: schema.schema+"."+table, key: params.input, id: recordId}
                            this.transactionRecords.push(transactionRecord) ;
                            //prepare a placeholder object that can be use to reference value of the final record. the actual value will be replaced on server side
                            const objPlaceholder = {} ;
                            for(let col of tableOfSchema.columns){
                                objPlaceholder[col] = "${"+recordId+"."+col+"}" ;
                            }
                            return objPlaceholder ;
                        }
                        const output = arguments.length>fields.length?arguments[arguments.length-1]:null ;
                        return self.mutations[m](params, output).then(result=>{
                            return result[fullTable] ;
                        }) ;
                    }
                }
                let updateMutations = Object.keys(this.mutations).filter(q=>q.startsWith("update_"+fullTable+"_by_")) ;
                for(let m of updateMutations){
                    let fields = m.replace("update_"+fullTable+"_by_", "").split("_and_") ;
                    let funcName = "updateBy"+fields.map(f=>f[0].toUpperCase() + f.slice(1)).join("And") ;
                    standardMutations.push(funcName) ;
                    dbObject[table][funcName] = function(/*fieldValue, field2Value..., update, output=null*/){
                        const params = {input: {}} ;
                        for(let i=0; i<fields.length; i++){
                            params.input[fields[i]] = arguments[i] ;
                        }
                        const patch = arguments[fields.length] ;
                        
                        if(this.isTransaction){ 
                            const recordId = schema.schema+"_"+table+"_"+this.transactionRecords.length ;
                            let transactionRecord = {action: "update", table_name: schema.schema+"."+table, key: params.input, record: patch, id: recordId}
                            this.transactionRecords.push(transactionRecord) ;
                            //prepare a placeholder object that can be use to reference value of the final record. the actual value will be replaced on server side
                            const objPlaceholder = {} ;
                            for(let col of tableOfSchema.columns){
                                objPlaceholder[col] = "${"+recordId+"."+col+"}" ;
                            }
                            return objPlaceholder ;
                        }
                        
                        params.input[fullTable+"_patch"] = patch ;
                        const output = (arguments.length>fields.length+1)?arguments[arguments.length-1]:null ;
                        return self.mutations[m](params, output).then(result=>{
                            for(let [key, value] of Object.entries(result)){
                                //update the received record with values after insert
                                patch[key] = value ;
                            }
                            return result[fullTable] ;
                        }) ;
                    }
                }
            }

            for(let queryName of Object.keys(self.queries)){
                if(queryName.startsWith(schema.schema+"_") && !standardQueries.includes(queryName)){
                    dbObject.queries[queryName.replace(schema.schema+"_", "")] = self.queries[queryName].bind(self) ;
                }
            }

            for(let mutationName of Object.keys(self.mutations)){
                if(mutationName.startsWith(schema.schema+"_") && !standardMutations.includes(mutationName)){
                    dbObject.mutations[mutationName.replace(schema.schema+"_", "")] = self.mutations[mutationName].bind(self) ;
                }
            }
        }
        return this;
    }

    async queryGraphql(query){
        let headers = {
            "Content-Type": "application/json",
            Accept: "application/json",
        } ;
        let result = await fetch("/graphql/"+this.appName, {
            method: "POST",
            headers: headers,
            credentials: "include",
            body: JSON.stringify({ query: query }),
        }) ;
        /** @type {any} */
        let jsonResult = await result.json() ;
        if(jsonResult.errors){
            console.warn("Error while call query "+query, jsonResult) ;
            throw jsonResult.errors.map(e=>e.message).join(",")
        }
        return jsonResult ;
    }

    async getGraphqlSchema(){
        if(!this.cacheGraphqlSchema){
            let results = await this.queryGraphql(`query schema {
                __schema {
                    types {
                    name
                    fields {
                        name
                        type {
                        name
                        kind
                        }
                    }
                    }
                }
            }`) ;
            this.cacheGraphqlSchema = results.data.__schema ;
        }
        return this.cacheGraphqlSchema ;
    }
}

const GRAPHQL_CLIENTS = {} ;

export async function getGraphqlClient(appName=""){
    if(!appName){
        // @ts-ignore
        appName = window.BAMZ_APP ;
    }
    let cli = GRAPHQL_CLIENTS[appName];
    if(!cli){
        cli = new GraphqlClient(appName);

        const initPromise = cli.init() ;
        GRAPHQL_CLIENTS[appName] = initPromise ;
        await initPromise;
        GRAPHQL_CLIENTS[appName] = cli ;
    }

    if(cli.constructor === Promise){
        return await cli ;
    }
    
    return cli ;
}