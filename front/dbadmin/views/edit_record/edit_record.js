/*global view*/

//prepare data
view.loader = async ()=>{
    const metadata = /** @type any */ (await dbApi.mutations.dbadmin_get_table_metadata({ input: {p_schema: view.route.params.schema, p_table: view.route.params.table}}))
   
    let record = null;
    let pk = null;
    if(view.route.params.id){
        let colPk = metadata.columns.find(c=>c.code === metadata.primaryKey[0]) ;
        pk = view.route.params.id ;
        if(!["integer", "smallint", "bigint", "real", "double precision", "numeric"].includes(colPk.type)){
            pk = `"${pk}"`;
        }
        let query = `query FindRecord {
            ${metadata.graphqlQueryById}(${colPk.graphqlName}: ${pk}) {
                ${metadata.columns.map(col=>col.graphqlName).join("\n")}
            }
        }`

        const queryResult = /** @type any */ (await dbApi.queryGraphql(query)) ;
        record = queryResult.data[metadata.graphqlQueryById] ;
    }

    let data = {
       record: record,
       pk: pk,
       metadata: metadata,
       schema: view.route.params.schema,
       table: view.route.params.table,
       sqlEdit: "",
       modifiedfields: {}
    }

    return data;
};

function fieldChanged(ev){
    if(!view.data.metadata.columns.some(c=>c.code === ev.target.id)){ return ;}
    if(ev.target.type === "checkbox"){
        view.data.modifiedfields[ev.target.id] = ev.target.checked;
    }else{
        view.data.modifiedfields[ev.target.id] = ev.target.value;
    }

    const fields = Object.keys(view.data.modifiedfields).filter(f=>view.data.metadata.columns.some(c=>c.code === f)) ;
    let sql ;
    if(view.data.record){
        sql = `UPDATE "${view.data.schema}"."${view.data.table}" SET ${fields.map(f=>{
            let col = view.data.metadata.columns.find(c=>c.code === f) ;
            if(col.type === "integer" || col.type === "smallint" || col.type === "bigint" || col.type === "boolean" || col.type === "real" || col.type === "double precision" || col.type === "numeric"){
                return `${f}=${view.data.modifiedfields[f]}` ;
            }else{
                return `${f}='${view.data.modifiedfields[f].replaceAll("'", "''").replaceAll("\n", "\\n")}'` ;
            }
        }).join(",")} WHERE ${view.data.metadata.primaryKey[0]} = ${view.data.pk.replace(/^"/, "'").replace(/"$/, "'")}` ;
    }else{
        sql = `INSERT INTO "${view.data.schema}"."${view.data.table}"(${fields.map(f=>`"${f}"`).join(",")}) VALUES (${fields.map(f=>{
            let col = view.data.metadata.columns.find(c=>c.code === f) ;
            if(col.type === "integer" || col.type === "smallint" || col.type === "bigint" || col.type === "boolean" || col.type === "real" || col.type === "double precision" || col.type === "numeric"){
                return view.data.modifiedfields[f] ;
            }else{
                return `'${view.data.modifiedfields[f].replaceAll("'", "''").replaceAll("\n", "\\n")}'` ;
            }
        }).join(",")})` ;
    }
    view.data.sqlEdit = sql;
}

view.addEventListener("displayed", ()=>{
    let rowFields = view.getElementById("rowFields") ;
    for(let col of view.data.metadata.columns){
        let value = null ;
        if(view.data.record){
            value = view.data.record[col.graphqlName] ;
        }else{
            value = "" ;
        }
        let fieldCell = document.createElement("DIV") ;
        let type = "text" ;
        if(col.type?.startsWith("timestamp")){
            type = "datetime-local";   
        }else if(col.type?.startsWith("date")){
            type = "date";
        }else if(col.type?.startsWith("time")){
            type = "time";
        }else if(col.type === "integer" || col.type === "smallint" || col.type === "bigint"){
            type = "number";
        }else if(col.type === "real" || col.type === "double precision" || col.type === "numeric"){
            type = "number";   
        }else if(col.type.startsWith("json")){
            type = "textarea"; 
        }else if(col.type.startsWith("xml")){
            type = "textarea"; 
        }else if(col.type === "boolean"){
            type = "checkbox"; 
        }
        
        fieldCell.className = "col-12 col-lg-6" ;
        if(type === "textarea"){
            fieldCell.className = "col-12" ;
            fieldCell.innerHTML = `<div class="mb-3">
                <label for="${col.code}" class="form-label">${col.description}</label>
                <textarea id="${col.code}" class="form-control"></textarea>
            </div>` ;
            if(view.data.record){
                fieldCell.querySelector("textarea").value = value;
            }
        }else if(type === "checkbox"){
            fieldCell.innerHTML = `<div class="form-check mb-4" id="ilrcl">
  <input type="checkbox" id="${col.code}" class="form-check-input" />
  <label for="${col.code}" class="form-check-label">${col.description}</label>
</div>`;
            if(view.data.record){
                (/** @type {HTMLInputElement} */ (fieldCell.querySelector("input"))).checked = value;
            }
        }else{
            fieldCell.innerHTML = `<div class="mb-3">
                <label for="${col.code}" class="form-label">${col.description}</label>
                <input type="${type}"  id="${col.code}" class="form-control" />
            </div>` ;
            if(view.data.record){
                fieldCell.querySelector("input").value = value;
            }
        }


        rowFields.appendChild(fieldCell) ;
    }

    rowFields.addEventListener("change", fieldChanged)
}) ;