export default {
    prefix: "DBFORMAT",
    /*
      possible format : 
        ${DBFORMAT|schema.table.column|bindpath}
        ${DBFORMAT|table.column|bindpath}
        ${DBFORMAT|bindpath}
    */
    createElement: (innerText)=>{
        let el = document.createElement("db-value") ;
        let [, defPath, bindPath] = innerText.split("|") ;
        if(!bindPath){
            [, bindPath] = innerText.split("|") ;
            defPath = bindPath ;
        }
        let [schema, table, column] = defPath.split(".") ;
        if(!table){
            schema = "public" ;
            [table, column] = defPath.split(".") ;
        }
        el.setAttribute("db-schema", schema) ;
        el.setAttribute("db-table", table) ;
        el.setAttribute("db-column", column) ;
        el.setAttribute("z-bind", bindPath) ;
        return el ;
    }
}