export async function formatRecord({table, record}){
    if(!table){ throw "No table given" ; }
    if(!table.columns){ throw "No columns in table" ; }
    if(!record){ return " - " ; }

    if(!table.options?.formatRecord){
        prepareFormatFunction({table}) ;
    }
    
    return await table.options.formatRecord(record) ;
}

export async function getReferencedRecord({dbApi, column, value}){
    if(!column){ throw "No column given" ; }
    if(!value){ return null ; }

    const result = await dbApi.db[column.reference.referenced_table].searchFirst({ [column.reference.referenced_column] : value }) ;
    return result  ;
}

export function prepareFormatFunction({table}){
    // by default use the first column
    let labelExpression =  '${'+table.columns[0].column_name+'}' ;
    if(table.options?.label_expression){
        //a label expression is defined, use it
        labelExpression = table.options?.label_expression ;
    }
    
    // Regular expression pattern to match ${variable_name}
    const pattern = /\$\{([^}]+)\}/g;
    
    const keys = [];
    
    // Find all matches in the template string
    let match;
    while ((match = pattern.exec(labelExpression)) !== null) {
        let colName = match[1] ;
        let column = table.columns.find(c=>c.column_name === colName) ;
        if(column && ["text", "multiline", "html",  "email",  "phone",  "color",  "bpchar",  "character varying"].includes(column.data_type)){
            keys.push(colName);
        }
    }

    const functionFormat = new Function("record", "return `"+labelExpression.replaceAll("${", "${record.")+"`") ;
    if(!table.options){
        table.options = {} ;
    }
    table.options.formatRecord = functionFormat ;
    table.options.formatKeys = keys ;
}
