import express from 'express';


/**
 * Called on each application startup (or when the plugin is enabled)
 * 
 * Use it to prepare the database and files needed by the plugin
 */
export const prepareDatabase = async ({options, client, grantSchemaAccess}) => {
    await client.query(`CREATE SCHEMA IF NOT EXISTS dbadmin`); 

    await client.query(`drop function if exists dbadmin.run_query`) ;

    // plain run query
    await client.query(`create or replace function dbadmin.run_query(
  query text
)
returns JSONB as
$$
    let currentDb = plv8.execute("SELECT current_database()")[0].current_database;
    plv8.execute("SET ROLE "+currentDb+"_admin");
    let result = plv8.execute(query);
    plv8.execute("RESET ROLE");
    return result;
$$
LANGUAGE "plv8"`) ;

    await client.query(`drop function if exists dbadmin.run_queries`) ;

    await client.query(`create function dbadmin.run_queries(
    queries text[]
  )
  returns JSONB as
  $$
      if (!Array.isArray(queries)) {
        throw new Error('parameter should be an array');
      }
      let results = [];
        plv8.subtransaction(function(){
            let currentDb = plv8.execute("SELECT current_database()")[0].current_database;
            plv8.execute("SET ROLE "+currentDb+"_admin");
            for(let q of queries){
                let result = plv8.execute(q);
                results.push({
                    query: q,
                    result: result
                })
            }
            plv8.execute("RESET ROLE");
        });
      
      return results;
  $$
  LANGUAGE "plv8"`) ;

    // get list of schemas and tables
    await client.query(`DROP FUNCTION IF EXISTS dbadmin.get_schemas_and_tables`) 
    await client.query(`CREATE FUNCTION dbadmin.get_schemas_and_tables()
RETURNS JSONB AS
$$
DECLARE
    result json;
BEGIN
    WITH 
        trigger_events AS (
            SELECT 
                t.trigger_schema,
                t.event_object_table,
                p.proname AS trigger_function_name,
                l.lanname AS language,
                COALESCE(d.description, p.proname) AS trigger_function_description,
                json_agg(
                    json_build_object(
                        'timing', t.action_timing,    -- BEFORE or AFTER
                        'action', t.event_manipulation -- INSERT, UPDATE, DELETE
                    )
                ) as event_list
            FROM 
                information_schema.triggers t
            JOIN 
                pg_trigger pg_trig ON pg_trig.tgname = t.trigger_name
            JOIN 
                pg_proc p ON p.oid = pg_trig.tgfoid
            JOIN 
                pg_namespace n ON n.oid = p.pronamespace
            JOIN pg_catalog.pg_language l ON 
                p.prolang = l.oid
            LEFT JOIN 
                pg_description d ON d.objoid = p.oid AND d.objsubid = 0
            GROUP BY 
                t.trigger_schema,
                t.event_object_table,
                p.proname,
                d.description,
                l.lanname
        ),
        schema_tables AS (
            SELECT 
                n.nspname as schema_name,
                json_agg(
                    json_build_object(
                        'table', c.relname,
                        'schema', n.nspname,
                        'type', 'table',
                        'description', COALESCE(
                            (
                                SELECT description 
                                FROM pg_description d 
                                WHERE d.objoid = c.oid 
                                AND d.objsubid = 0
                            ),
                            c.relname
                        ),
                        'triggers', COALESCE((SELECT 
                                json_agg(
                                    json_build_object(
                                        'schema', t.trigger_schema,
                                        'table', t.event_object_table,
                                        'function', t.trigger_function_name,
                                        'description', trigger_function_description,
                                        'language', t.language,
                                        'events', t.event_list
                                    )
                                    ORDER BY t.trigger_function_name
                                ) FILTER (WHERE t.trigger_function_name IS NOT NULL) as triggers
                            FROM trigger_events t
                            WHERE  t.trigger_schema = n.nspname AND t.event_object_table = c.relname
                        ), '[]'::json)
                    )
                    ORDER BY c.relname
                ) FILTER (WHERE c.relname IS NOT NULL) as tables
            FROM pg_catalog.pg_namespace n
            JOIN pg_catalog.pg_class c ON 
                c.relnamespace = n.oid AND 
                c.relkind = 'r' -- Only regular tables
            WHERE 
                n.nspname NOT IN ('pg_catalog', 'information_schema') -- Exclude system schemas
                AND n.nspname NOT LIKE 'pg_toast%'
            GROUP BY n.nspname
        ),
        schema_functions AS (
            SELECT 
                n.nspname as schema_name,
                json_agg(
                    json_build_object(
                        'function', p.proname,
                        'schema', n.nspname,
                        'type', 'function',
                        'language', l.lanname,
                        'arguments', pg_get_function_arguments(p.oid),
                        'definition', pg_get_functiondef(p.oid),
                        'result', pg_get_function_result(p.oid),
                        'description', COALESCE(
                            (
                                SELECT description 
                                FROM pg_description d 
                                WHERE d.objoid = p.oid 
                                AND d.objsubid = 0
                            ),
                            p.proname
                        )
                    )
                    ORDER BY p.proname
                ) FILTER (WHERE p.proname IS NOT NULL) as functions
            FROM pg_catalog.pg_namespace n
            JOIN pg_catalog.pg_proc p ON 
                p.pronamespace = n.oid AND
                p.oid NOT IN (
                    SELECT objid 
                    FROM pg_depend 
                    WHERE deptype = 'e'  -- 'e' means extension dependency
                )
            JOIN pg_catalog.pg_language l ON 
                p.prolang = l.oid
            WHERE 
                n.nspname NOT IN ('pg_catalog', 'information_schema') 
                AND n.nspname NOT LIKE 'pg_toast%'
            GROUP BY n.nspname
        )
    SELECT 
        json_agg(
            json_build_object(
                'schema', COALESCE(t.schema_name, f.schema_name),
                'tables', COALESCE(t.tables, '[]'::json),
                'functions', COALESCE(f.functions, '[]'::json)
            )
            ORDER BY COALESCE(t.schema_name, f.schema_name)
        )
    INTO result
    FROM schema_tables t
    FULL OUTER JOIN schema_functions f ON t.schema_name = f.schema_name ;

    -- If no results found, return an empty array instead of NULL
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql;
`) ;

    

    await client.query(`DROP FUNCTION IF EXISTS dbadmin.get_table_metadata`) 

    await client.query(`create function dbadmin.get_table_metadata(
    p_schema text,
    p_table text
  )
  returns JSONB as
  $$
    
    let graphqlName = (p_schema === "public"?"":p_schema+"_")+p_table ;
    let tableMeta = {
        schema: p_schema, table: p_table, graphqlName: graphqlName, graphqlQuery: "all_"+graphqlName
    } ;  



      let result = plv8.execute(\`SELECT c.oid,
  n.nspname,
  c.relname
FROM pg_catalog.pg_class c
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname OPERATOR(pg_catalog.~) '^(\${p_table})$' COLLATE pg_catalog.default
  AND n.nspname OPERATOR(pg_catalog.~) '^(\${p_schema})$' COLLATE pg_catalog.default
ORDER BY 2, 3\`);

    let tableOid = result[0].oid; //136241


    result = plv8.execute(\`SELECT description 
                                        FROM pg_description d 
                                        WHERE d.objoid = $1
                                        AND d.objsubid = 0
                                    \`, [tableOid]);
    tableMeta.description = p_table;
    tableMeta.options = {} ;
    if(result.length>0 && result[0].description){
        tableMeta.description = result[0].description;
        if(tableMeta.description.startsWith("{")){
            try{
                tableMeta.options = JSON.parse(tableMeta.description);
                tableMeta.description = tableMeta.options.description ;
            }catch(e){
                //malformatted JSON
            }
        }
    } 


      /*result = plv8.execute(\`SELECT c.relchecks, c.relkind, c.relhasindex, c.relhasrules, c.relhastriggers, c.relrowsecurity, c.relforcerowsecurity, false AS relhasoids, c.relispartition, pg_catalog.array_to_string(c.reloptions || array(select 'toast.' || x from pg_catalog.unnest(tc.reloptions) x), ', ')
, c.reltablespace, CASE WHEN c.reloftype = 0 THEN '' ELSE c.reloftype::pg_catalog.regtype::pg_catalog.text END, c.relpersistence, c.relreplident, am.amname
FROM pg_catalog.pg_class c
 LEFT JOIN pg_catalog.pg_class tc ON (c.reltoastrelid = tc.oid)
LEFT JOIN pg_catalog.pg_am am ON (c.relam = am.oid)
WHERE c.oid = $1\`, [tableOid]);*/

    result = plv8.execute(\`SELECT kc.column_name FROM
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kc ON kc.table_name = tc.table_name AND kc.table_schema = tc.table_schema
        AND kc.constraint_name = tc.constraint_name
        JOIN information_schema.tables t ON tc.table_name = t.table_name
    WHERE 
        tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2
    ORDER BY ordinal_position\`, [p_schema, p_table]);

    tableMeta.primaryKey = result.map(r=>r.column_name) ;
    if(tableMeta.primaryKey.length === 1){
        let by = tableMeta.primaryKey[0];
        tableMeta.graphqlQueryById = graphqlName +"_by_"+ by ;
    }

    

    result = plv8.execute(\`SELECT a.attname,
    CASE 
      WHEN t.typcategory = 'E' THEN
          'enum'
      ELSE pg_catalog.format_type(a.atttypid, a.atttypmod)
  END AS format_type,
  pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type,
  (SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid, true)
   FROM pg_catalog.pg_attrdef d
   WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum AND a.atthasdef),
  a.attnotnull,
  (SELECT c.collname FROM pg_catalog.pg_collation c, pg_catalog.pg_type t
   WHERE c.oid = a.attcollation AND t.oid = a.atttypid AND a.attcollation <> t.typcollation) AS attcollation,
  a.attidentity,
  a.attgenerated,
  a.attstorage,
  a.attcompression AS attcompression,
  CASE WHEN a.attstattarget=-1 THEN NULL ELSE a.attstattarget END AS attstattarget,
  pg_catalog.col_description(a.attrelid, a.attnum),
  (
      SELECT EXISTS (
          SELECT 1
          FROM pg_catalog.pg_constraint c
          WHERE c.conrelid = a.attrelid
          AND c.contype IN ('p', 'u')
          AND a.attnum = ANY(c.conkey)
      ) OR EXISTS (
          SELECT 1
          FROM pg_catalog.pg_index i
          WHERE i.indrelid = a.attrelid
          AND i.indisunique = true
          AND a.attnum = ANY(i.indkey)
      )
  ) AS unique,
  CASE 
      WHEN a.atthasdef THEN
          COALESCE(
              (SELECT pg_get_expr(adbin, adrelid)
               FROM pg_attrdef
               WHERE adrelid = a.attrelid AND adnum = a.attnum),
              'NULL'
          )
      ELSE NULL
  END AS default_value_expression,

  CASE 
      WHEN t.typcategory = 'E' THEN
          (SELECT array_agg(enumlabel)
           FROM pg_catalog.pg_enum e
           WHERE e.enumtypid = t.oid)
      ELSE NULL
  END AS enum_values,

  (SELECT description 
    FROM pg_description d 
    WHERE d.objoid = t.oid
    AND d.objsubid = 0) AS type_description
        
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum\`, [tableOid]);

    tableMeta.columns = result.map(r=>{
        let type = r.format_type;
        let enumValues = r.enum_values;
        let precision = null;
        let indexPrecision = type.indexOf("(") ;
        if(indexPrecision !== -1){
            precision = type.substring(indexPrecision+1, type.lastIndexOf(")")) ;
            type = type.substring(0, indexPrecision) ;
        }
        let enumOptions = {
            type: "select",
            values: []
        } ;
        if(type === "enum"){
            for(let e of enumValues){
                enumOptions.values.push({value: e, label: e}) ;
            }
            if(r.type_description){
                // The description of the type is a JSON with enum values '[{"label":"The label","value":"The value"}]'
                try{
                    const parsedDescription = JSON.parse(r.type_description) ;
                    if(Array.isArray(parsedDescription)){
                        enumOptions.values = parsedDescription ;
                    }else{
                        enumOptions = parsedDescription
                    }
                }catch(e){
                    //malformatted JSON
                }
            }
        }
        return {
            code: r.attname,
            type,
            pgType: r.full_type,
            enumValues,
            enumOptions,
            precision,
            notNull: r.attnotnull,
            defaultValue: r.default_value_expression,
            unique: r.unique,
            description: r.col_description,
            typeDescription: r.type_description,
            graphqlName: r.attname,
            primary: tableMeta.primaryKey.some(p=>p===r.attname)
        }
    }) ;


    result = plv8.execute(\`SELECT tc.constraint_name, kc.column_name, ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name  FROM
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kc ON kc.table_name = tc.table_name AND kc.table_schema = tc.table_schema
        AND kc.constraint_name = tc.constraint_name
        JOIN information_schema.tables t ON tc.table_name = t.table_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
    WHERE 
        tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1 AND tc.table_name = $2
    ORDER BY ordinal_position\`, [p_schema, p_table]);

    tableMeta.foreignKeys = result.map(r=>{
        return {
            name: r.constraint_name,
            column: r.column_name,
            foreignSchema: r.foreign_table_schema,
            foreignTable: r.foreign_table_name,
            foreignColumn: r.foreign_column_name
        }
    }) ;

    for(let fk of tableMeta.foreignKeys){
        let col = tableMeta.columns.find(c=>c.code === fk.column) ;
        if(col){
            col.referenced_column = fk.foreignColumn ;
            col.referenced_table = fk.foreignSchema+"."+fk.foreignTable ;
            col.referencedType = col.type ;
            col.type = "reference"
        }
    }

    result = plv8.execute(\`SELECT t.tgname as trigger, p.proname as function, json_agg(
                    json_build_object(
                        'timing', it.action_timing,    -- BEFORE or AFTER
                        'action', it.event_manipulation -- INSERT, UPDATE, DELETE
                    )
                ) as events
                FROM pg_trigger t JOIN 
                    pg_proc p ON p.oid = t.tgfoid 
                    JOIN information_schema.triggers it ON it.trigger_name = t.tgname
                WHERE t.tgrelid = $1
                GROUP BY t.tgname, p.proname\`, [tableOid]);

    
    tableMeta.triggers = result;

    

  /*  let resultTable = plv8.execute(\`SELECT c2.relname, i.indisprimary, i.indisunique, i.indisclustered, i.indisvalid, pg_catalog.pg_get_indexdef(i.indexrelid, 0, true),
  pg_catalog.pg_get_constraintdef(con.oid, true), contype, condeferrable, condeferred, i.indisreplident, c2.reltablespace
FROM pg_catalog.pg_class c, pg_catalog.pg_class c2, pg_catalog.pg_index i
  LEFT JOIN pg_catalog.pg_constraint con ON (conrelid = i.indrelid AND conindid = i.indexrelid AND contype IN ('p','u','x'))
WHERE c.oid = '136241' AND c.oid = i.indrelid AND i.indexrelid = c2.oid
ORDER BY i.indisprimary DESC, c2.relname\`);*/

 /*   let resultTable = plv8.execute(\`SELECT pol.polname, pol.polpermissive,
  CASE WHEN pol.polroles = '{0}' THEN NULL ELSE pg_catalog.array_to_string(array(select rolname from pg_catalog.pg_roles where oid = any (pol.polroles) order by 1),',') END,
  pg_catalog.pg_get_expr(pol.polqual, pol.polrelid),
  pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid),
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    END AS cmd
FROM pg_catalog.pg_policy pol
WHERE pol.polrelid = '136241' ORDER BY 1\`);*/

/*    let resultTable = plv8.execute(\`SELECT oid, stxrelid::pg_catalog.regclass, stxnamespace::pg_catalog.regnamespace::pg_catalog.text AS nsp, stxname,
pg_catalog.pg_get_statisticsobjdef_columns(oid) AS columns,
  'd' = any(stxkind) AS ndist_enabled,
  'f' = any(stxkind) AS deps_enabled,
  'm' = any(stxkind) AS mcv_enabled,
stxstattarget
FROM pg_catalog.pg_statistic_ext
WHERE stxrelid = '136241'
ORDER BY nsp, stxname;\`);*/


/*    let resultTable = plv8.execute(\`SELECT pubname
     , NULL
     , NULL
FROM pg_catalog.pg_publication p
     JOIN pg_catalog.pg_publication_namespace pn ON p.oid = pn.pnpubid
     JOIN pg_catalog.pg_class pc ON pc.relnamespace = pn.pnnspid
WHERE pc.oid ='136241' and pg_catalog.pg_relation_is_publishable('136241')
UNION
SELECT pubname
     , pg_get_expr(pr.prqual, c.oid)
     , (CASE WHEN pr.prattrs IS NOT NULL THEN
         (SELECT string_agg(attname, ', ')
           FROM pg_catalog.generate_series(0, pg_catalog.array_upper(pr.prattrs::pg_catalog.int2[], 1)) s,
                pg_catalog.pg_attribute
          WHERE attrelid = pr.prrelid AND attnum = prattrs[s])
        ELSE NULL END) FROM pg_catalog.pg_publication p
     JOIN pg_catalog.pg_publication_rel pr ON p.oid = pr.prpubid
     JOIN pg_catalog.pg_class c ON c.oid = pr.prrelid
WHERE pr.prrelid = '136241'
UNION
SELECT pubname
     , NULL
     , NULL
FROM pg_catalog.pg_publication p
WHERE p.puballtables AND pg_catalog.pg_relation_is_publishable('136241')
ORDER BY 1;\`);*/

/*
    let resultTable = plv8.execute(\`SELECT c.oid::pg_catalog.regclass
FROM pg_catalog.pg_class c, pg_catalog.pg_inherits i
WHERE c.oid = i.inhparent AND i.inhrelid = '136241'
  AND c.relkind != 'p' AND c.relkind != 'I'
ORDER BY inhseqno;\`);*/
/*
    let resultTable = plv8.execute(\`SELECT c.oid::pg_catalog.regclass, c.relkind, inhdetachpending, pg_catalog.pg_get_expr(c.relpartbound, c.oid)
FROM pg_catalog.pg_class c, pg_catalog.pg_inherits i
WHERE c.oid = i.inhrelid AND i.inhparent = '136241'
ORDER BY pg_catalog.pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT', c.oid::pg_catalog.regclass::pg_catalog.text;\`);
*/
      return tableMeta;
  $$
  LANGUAGE "plv8"`) ;




  
    await client.query(`DROP FUNCTION IF EXISTS dbadmin.get_function_metadata`) 

    await client.query(`create function dbadmin.get_function_metadata(
  p_schema text,
  p_func text
)
returns JSONB as
$$

  
    let graphqlName = (p_schema === "public"?"":p_schema+"_")+p_func ;
    let funcMeta = {
        schema: p_schema, function: p_func, graphqlName: graphqlName
    } ;  

    let sql = \`SELECT 
                (
                    SELECT description 
                    FROM pg_description d 
                    WHERE d.objoid = p.oid 
                    AND d.objsubid = 0
                ) description,
                l.lanname as language, 
                pg_get_function_arguments(p.oid) as full_arguments,
                pg_get_functiondef(p.oid) as definition,
                pg_get_function_identity_arguments(p.oid) as arguments,
                pg_get_function_result(p.oid) as result,
                p.proname 
            FROM pg_catalog.pg_namespace n
            JOIN pg_catalog.pg_proc p ON 
                p.pronamespace = n.oid AND
                -- Exclude extension functions
                p.oid NOT IN (
                    SELECT objid 
                    FROM pg_depend 
                    WHERE deptype = 'e'  -- 'e' means extension dependency
                )
            JOIN pg_catalog.pg_language l ON 
                p.prolang = l.oid
            WHERE 
                n.nspname  = '\${p_schema}' AND 
                p.proname = '\${p_func}'\` ;
    
    let result = plv8.execute(sql);

    funcMeta.description = result[0].description;
    funcMeta.language = result[0].language;
    if(result[0].arguments){
        funcMeta.arguments = result[0].arguments.split(",").map(a=>{
            a = a.trim() ;
            let indexName = a.indexOf(" ") ;
            return {
                name: a.substring(0, indexName),
                type: a.substring(indexName+1)
            }
        });
    }else{
        funcMeta.arguments = [] ;
    }
    funcMeta.args = result[0].arguments;
    funcMeta.full_arguments = result[0].full_arguments;
    funcMeta.result = result[0].result;
    funcMeta.definition = result[0].definition;

    return funcMeta;
$$
LANGUAGE "plv8"`) ;


    await grantSchemaAccess("dbadmin") ;

}

/**
 * Called when the plugin is disabled
 * 
 * Use it to eventually clean the database and files created by the plugin
 */
export const cleanDatabase = async ({client}) => {
    await client.query(`DROP SCHEMA IF EXISTS dbadmin CASCADE`);
}


/**
 * Init plugin when Open BamZ platform start
 */
export const initPlugin = async ({ loadPluginData, graphql, hasCurrentPlugin, contextOfApp, logger }) => {
        const router = express.Router();

    function getFinalType(type, {nonNull=false, list=false}={}){
        let typeName = type;
        if(!typeName.name && type.ofType){
            return getFinalType(type.ofType, {
                nonNull:nonNull||type.kind==="NON_NULL", 
                list:list||type.kind==="LIST", 
            })
        }
        typeName.nonNull = nonNull ;
        typeName.list = list ;
        return typeName;
    }

    function getType(type){
        let finalType = getFinalType(type) ;
        let typeName = finalType.name ;
        if(finalType.name === "ID"){ typeName = "string" ; }
        if(finalType.name === "String"){ typeName = "string" ; }
        if(finalType.name === "Cursor"){ typeName = "string" ; }
        if(finalType.name === "Int"){ typeName = "number" ; }
        if(finalType.name === "Boolean"){ typeName = "boolean" ; }
        if(finalType.name === "Datetime"){ typeName = "Date" ; }
        if(finalType.list){
            typeName += "[]" ;
        }
        return typeName ;
    }

    router.get("/definitions/db-lib.d.ts", async (req, res)=>{
        let appName = req.appName ;

        try{
            let resultsSchema = await graphql.runDbGraphql(appName, `mutation MyMutation {
                openbamz_list_schema_and_tables(input: {}) {
                    result
                }
            }`) ;
    
            let schemas = resultsSchema.openbamz_list_schema_and_tables.result ;

            let results = await graphql.runDbGraphql(appName, `query IntrospectionQuery {
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
    
            let source = "";

            //let enums = {} ;
            let typesByName = {} ;
            for(let type of results.__schema.types){
                typesByName[type.name] = type;
                if(type.kind === "ENUM"){
                    //enums[type.name] = type.enumValues.map(v=>`"${v.name}"`).join("|") ;
                }
            }

            for(let type of results.__schema.types){
                if(type.name === "Query" || type.name === "Node" || type.name === "Mutation" 
                        || type.name === "ID" || type.name.startsWith("__")){ continue ; }
                if(type.kind === "ENUM"){
                    source += `/** ${type.description??type.name} */\n`;
                    source += `type ${type.name} = ${type.enumValues.map(v=>`"${v.name}"`).join("|")}; \n\n`
                }
                let fields = type.fields ?? type.inputFields ; 
                if(!fields){ continue ; }
                source += `/** ${type.description??type.name} */
type ${type.name} = {\n`;
                for(let f of fields){
                    let fieldType = getType(f.type) ;
                    if(fieldType === "Query"){ continue ; }
                    // if(enums[fieldType]){
                    //     fieldType = enums[fieldType] ;
                    // }
                    source += `  /** ${f.description??f.name} */
  ${f.name}${f.type.kind!=="NON_NULL"?"?":""}: ${fieldType};\n` ;
                }
                source += `}\n\n`;
            }

            let queries = typesByName["Query"].fields ;
            let mutations = typesByName["Mutation"].fields ;

            for(let mutation of mutations){
                source += `/** Input params of mutation ${mutation.name} */
type mutation_${mutation.name}_input = {\n` ;
                for(let f of mutation.args){
                    let fieldType = getType(f.type) ;
                    if(fieldType === "Query"){ continue ; }
                    /*if(enums[fieldType]){
                        fieldType = enums[fieldType] ;
                    }*/
                    source += `  /** ${f.description??f.name} */
  ${f.name}${f.type.kind!=="NON_NULL"?"?":""}: ${fieldType};\n` ;
                }
                source += `}\n\n`;
            }

            for(let query of queries){
                source += `/** Input params of query ${query.name} */
type query_${query.name}_input = {\n` ;
                for(let f of query.args){
                    let fieldType = getType(f.type) ;
                    if(fieldType === "Query"){ continue ; }
                    /*if(enums[fieldType]){
                        fieldType = enums[fieldType] ;
                    }*/
                    source += `  /** ${f.description??f.name} */
  ${f.name}${f.type.kind!=="NON_NULL"?"?":""}: ${fieldType};\n` ;
                }
                source += `}\n\n`;
            }

            source += `/** Search params */
interface standard_search_params {
  /** Only read the first N values of the set. */
  first?: number;
  /** Only read the last N values of the set. */
  last?: number;
  /** Skip the first N values. May not be used with last. */
  offset?: number;
}\n\n`;

            let allQueries = {} ;
            let allMutations = {} ;

            source += `declare class GraphqlClientQueries {\n\n`;

            for(let query of queries){
                if(query.name === "query" || query.name === "nodeId" || query.name === "node"){
                    continue;
                }
                allQueries[query.name] = query ;
                let typeName = getType(query.type) ;

                source += `  /** 
   * ${query.description??query.name} 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */\n`;
                source += `  ${query.name}(params?: query_${query.name}_input, output?: ${typeName}): Promise<${typeName}>;\n`;
            }

            source += `}\n\n`;

            source += `declare class GraphqlClientMutations {\n\n`;

            for(let mutation of mutations){
                if(mutation.name === "query" || mutation.name === "nodeId" || mutation.name === "node"){
                    continue;
                }
                allMutations[mutation.name] = mutation ;
                let typeName = getType(mutation.type) ;
                source += `  /** 
   * ${mutation.description??mutation.name} 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */\n`;
                source += `  ${mutation.name}(params?: mutation_${mutation.name}_input , output?: ${typeName}): Promise<${typeName}>;\n`;
            }

            source += `}\n\n`;
            
            let sourcesDb = { public: {} } ;
            
            for(let schema of schemas){
                if( schema.tables.length === 0){ continue; }
    
                if(!sourcesDb[schema.schema]){
                    sourcesDb[schema.schema] = {} ;
                }

                const standardQueries = []; 
                const standardMutations = []; 
    
                for(let tableOfSchema of schema.tables){
                    const table = tableOfSchema.table_name ;

                    if(!sourcesDb[schema.schema][table]){
                        sourcesDb[schema.schema][table] = "" ;
                    }

                    let fullTable = schema.schema+"_"+table ;
                    if(schema.schema === "public"){
                        fullTable = table ;
                    }
    
                    if(allQueries["all_"+fullTable]){
                        standardQueries.push("all_"+fullTable) ;
                        source += `/** Search params of ${fullTable} */
interface search_params_${fullTable} extends standard_search_params {
  /** The method to use when ordering \`${fullTable}\`. */
  orderBy?: ${fullTable}_order_by[];
}\n\n`;
                        source += `/** Search results of ${fullTable} */
type pagination_result_${fullTable} = {
  /** The list of results. */
  results: ${fullTable}[];
  /** The total count matching the search. */
  totalCount: number;
}\n\n`;

                        sourcesDb[schema.schema][table] += `  /** 
   * Search in ${table}${schema.schema !== "public"?" ("+schema.schema+")":""} with pagination informations
   * @param filter filter to apply on the search.
   * @param searchParams search params like first, last, orderBy, output
   */\n`;
                        sourcesDb[schema.schema][table] += `  searchPagination(filter?: ${fullTable}Filter , searchParams?: search_params_${fullTable}): Promise<pagination_result_${fullTable}>;\n`;

                        sourcesDb[schema.schema][table] += `  /** 
   * Search in ${table}${schema.schema !== "public"?" ("+schema.schema+")":""}
   * @param filter filter to apply on the search.
   * @param searchParams search params like first, last, orderBy, output
   */\n`;
                        sourcesDb[schema.schema][table] += `  search(filter?: ${fullTable}Filter , searchParams?: search_params_${fullTable}): Promise<${fullTable}[]>;\n`;

                            
                        sourcesDb[schema.schema][table] += `  /** 
   * Search first result in ${table}${schema.schema !== "public"?" ("+schema.schema+")":""}
   * @param filter filter to apply on the search.
   * @param searchParams search params like orderBy, output
   */\n`;
                        sourcesDb[schema.schema][table] += `  searchFirst(filter?: ${fullTable}Filter , searchParams?: search_params_${fullTable}): Promise<${fullTable}>;\n`;
                    }
                    let getQueries = Object.values(allQueries).filter(q=>q.name.startsWith(fullTable+"_by_")) ;
                    for(let q of getQueries){
                        let fields = q.name.replace(fullTable+"_by_", "").split("_and_") ;
                        let funcName = "getBy"+fields.map(f=>f[0].toUpperCase() + f.slice(1)).join("And") ;
                        standardQueries.push(funcName) ;

                        sourcesDb[schema.schema][table] += `  /** 
   * Read in ${table}${schema.schema !== "public"?" ("+schema.schema+")":""} by ${fields.join(" and ")}
${fields.map(f=>`   * @param ${f}`).join("\n")}
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */\n`;
   
                        sourcesDb[schema.schema][table] += `  ${funcName}(${fields.map(f=>`${f}:${getType(q.args.find(a=>a.name===f).type)}`).join(", ")}, output?: ${fullTable}): Promise<${fullTable}>;\n`;
                    }

                    if(allMutations["create_"+fullTable]){
                        standardMutations.push("create_"+fullTable) ;
                        sourcesDb[schema.schema][table] += `  /** 
   * Create in ${table}${schema.schema !== "public"?" ("+schema.schema+")":""}
   * @param record the record to insert
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */\n`;
                        sourcesDb[schema.schema][table] += `  create(record: ${fullTable} , output?: ${fullTable}): Promise<${fullTable}>;\n`;
                    }
                    let deleteMutations = Object.values(allMutations).filter(q=>q.name.startsWith("delete_"+fullTable+"_by_")) ;
                    for(let m of deleteMutations){
                        let fields = m.name.replace("delete_"+fullTable+"_by_", "").split("_and_") ;
                        let funcName = "deleteBy"+fields.map(f=>f[0].toUpperCase() + f.slice(1)).join("And") ;
                        standardMutations.push(funcName) ;
                        sourcesDb[schema.schema][table] += `  /** 
   * Delete in ${table}${schema.schema !== "public"?" ("+schema.schema+")":""} by ${fields.join(" and ")}
${fields.map(f=>`   * @param ${f}`).join("\n")}
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */\n`;
                        
                        sourcesDb[schema.schema][table] += `  ${funcName}(${fields.map(f=>`${f}:${getType(typesByName[m.name+"_input"].inputFields.find(a=>a.name===f).type)}`).join(", ")}, output?: ${fullTable}): Promise<${fullTable}>;\n`;
                    }

                    let updateMutations = Object.values(allMutations).filter(q=>q.name.startsWith("update_"+fullTable+"_by_")) ;
                    for(let m of updateMutations){
                        let fields = m.name.replace("update_"+fullTable+"_by_", "").split("_and_") ;
                        let funcName = "updateBy"+fields.map(f=>f[0].toUpperCase() + f.slice(1)).join("And") ;
                        standardMutations.push(funcName) ;

                        sourcesDb[schema.schema][table] += `  /** 
   * Delete in ${table}${schema.schema !== "public"?" ("+schema.schema+")":""} by ${fields.join(" and ")}
${fields.map(f=>`   * @param ${f}`).join("\n")}
   * @param update the fields to update
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */\n`;
                        sourcesDb[schema.schema][table] += `  ${funcName}(${fields.map(f=>`${f}:${getType(typesByName[m.name+"_input"].inputFields.find(a=>a.name===f).type)}`).join(", ")}, update: ${fullTable}, output?: ${fullTable}): Promise<${fullTable}>;\n`;
                    }
                }

                source += `declare class GraphqlClientQueries_${schema.schema} {\n\n`;

                for(let query of queries){
                    if(query.name === "query" || query.name === "nodeId" || query.name === "node"){
                        continue;
                    }
                    if(query.name.startsWith(schema.schema+"_") && !standardMutations.includes(query.name)){

                        let typeName = getType(query.type) ;
        
                        source += `  /** 
        * ${query.description??query.name} 
        * @param params input params
        * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
        */\n`;
                        source += `  ${query.name.replace(schema.schema+"_", "")}(params?: query_${query.name}_input, output?: ${typeName}): Promise<${typeName}>;\n`;
                    }
                }
    
                source += `}\n\n`;
    
                source += `declare class GraphqlClientMutations_${schema.schema} {\n\n`;

                for(let mutation of mutations){
                    
                    if(mutation.name === "query" || mutation.name === "nodeId" || mutation.name === "node"){
                        continue;
                    }
                    if(mutation.name.startsWith(schema.schema+"_") && !standardMutations.includes(mutation.name)){
                        let typeName = getType(mutation.type) ;
                        source += `  /** 
           * ${mutation.description??mutation.name} 
           * @param params input params
           * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
           */\n`;
                        source += `  ${mutation.name.replace(schema.schema+"_", "")}(params?: mutation_${mutation.name}_input , output?: ${typeName}): Promise<${typeName}>;\n`;
                    }
                }
    
                source += `}\n\n`;
            }

            let sourceClassDb = `declare class GraphqlClientDb {\n\n` ;

            for(let [schema, tableDef] of Object.entries(sourcesDb)){
                for(let [table, sourceTable] of Object.entries(tableDef)){
                    source += `declare class GraphqlClientDbTable_${table} {\n\n` ;
                    source += sourceTable ;
                    source += `}\n\n`;
                    
                    if(schema === "public"){
                        sourceClassDb += `  ${table}: GraphqlClientDbTable_${table};\n\n` ;
                    }
                }
                if(schema !== "public"){
                    source += `declare class GraphqlClientDbSchema_${schema} {\n\n` ;
                    for(let table of Object.keys(tableDef)){
                        source += `  ${table}: GraphqlClientDbTable_${table};\n\n` ;
                    }
                    source += `  queries: GraphqlClientQueries_${schema};\n\n` ;
                    source += `  mutations: GraphqlClientMutations_${schema};\n\n` ;

                    source += `}\n\n`;

                    sourceClassDb += `  ${schema}: GraphqlClientDbSchema_${schema};\n\n` ;
                }else{
                    source += `  queries: GraphqlClientQueries_${schema};\n\n` ;
                    source += `  mutations: GraphqlClientMutations_${schema};\n\n` ;
                }

            }

            sourceClassDb += `}\n\n`;

            
            source += sourceClassDb;

            source += `declare class GraphqlClientTransaction {\n\n` ;
            source += `  /** Simplified access to your database */\n` ;
            source += `  db: GraphqlClientDb;\n` ;
            source += `}\n\n`;

            source += `declare class GraphqlClient {\n\n` ;
            source += `  /** Simplified access to your database */\n` ;
            source += `  db: GraphqlClientDb;\n` ;
            source += `  /** Simplified access all graphql queries */\n` ;
            source += `  queries: GraphqlClientQueries;\n` ;
            source += `  /** Simplified access all graphql mutations */\n` ;
            source += `  mutations: GraphqlClientMutations;\n` ;
            source += `  /** Run a plain graphql query */\n` ;
            source += `  queryGraphql(query: string): Promise<object>;\n` ;
            source += `  /** 
   * Run a transaction. Only the creation / udpate / delete operations in the db access are supported
   * @example 
   * const results = await client.transaction(async (tr)=>{
   *    const todoList = await tr.db.todo_list.create({ name: "My todo list" }) ;
   *    await tr.db.todo_item.create({list_id: todoList.id, description: "First item to do"}) ;
   *    await tr.db.todo_item.create({list_id: todoList.id, description: "Second item to do"}) ;
   * }) ;
   */\n` ;
            source += `  transaction(cb: (tr: GraphqlClientTransaction) => Promise<any>): Promise<object[]> ;\n` ;
            source += `}\n\n`;
    
            return res.end(source) ;
        }catch(err){
            logger.warn("Can't generate definitions %o", err) ;
            return res.end("") ;
        }
    })

    router.get('/db-fields-extensions', (req, res, next) => {
        (async ()=>{

            let appName = req.appName ;
            if(await hasCurrentPlugin(appName)){
            
                let appContext = await contextOfApp(appName) ;
                let allowedExtensions = appContext.pluginsData["dbadmin"]?.pluginSlots?.dbFieldsExtensions??[] ;
                let js = `let extensions = [];`;
                for(let i=0; i<allowedExtensions.length; i++){
                    let ext = allowedExtensions[i];
                    js += `
                    import ext${i} from "${ext.extensionPath}" ;
                    extensions.push({ plugin: "${ext.plugin}", ...ext${i}}) ;
                    `
                }
                js += `export default extensions`;
                res.setHeader("Content-Type", "application/javascript");
                res.end(js);
            }else{
                next() ;
            }
        })();
    });
    router.get('/db-values-extensions', (req, res, next) => {
        (async ()=>{

            let appName = req.appName ;
            if(await hasCurrentPlugin(appName)){
            
                let appContext = await contextOfApp(appName) ;
                let allowedExtensions = appContext.pluginsData["dbadmin"]?.pluginSlots?.dbValuesExtensions??[] ;
                let js = `let extensions = [];`;
                for(let i=0; i<allowedExtensions.length; i++){
                    let ext = allowedExtensions[i];
                    js += `
                    import ext${i} from "${ext.extensionPath}" ;
                    extensions.push({ plugin: "${ext.plugin}", ...ext${i}}) ;
                    `
                }
                js += `export default extensions`;
                res.setHeader("Content-Type", "application/javascript");
                res.end(js);
            }else{
                next() ;
            }
        })();
    });


    loadPluginData(async ({pluginsData})=>{
        if(pluginsData?.["viewz"]?.pluginSlots?.bindzFormatters){
            pluginsData?.["viewz"]?.pluginSlots?.bindzFormatters.push( {
                plugin: "dbadmin",
                formatterPath: "/plugin/dbadmin/lib/bindz-formatter-db-value.mjs",
                "d.ts": `declare const dbApi: GraphqlClient;`
            })
        }
        if(pluginsData?.["viewz"]?.pluginSlots?.viewzExtensions){
            pluginsData?.["viewz"]?.pluginSlots?.viewzExtensions.push( {
                plugin: "dbadmin",
                extensionPath: "/plugin/dbadmin/lib/viewz-dbadmin.mjs",
                "d.ts": `declare const dbApi: GraphqlClient;`
            })
        }
        if(pluginsData?.["code-editor"]?.pluginSlots?.javascriptApiDef){
            pluginsData?.["code-editor"]?.pluginSlots?.javascriptApiDef.push( {
                plugin: "dbadmin",
                url: "/dbadmin/definitions/db-lib.d.ts"
            })
        }
        if(pluginsData?.["grapesjs-editor"]?.pluginSlots?.grapesJsEditor){
            pluginsData?.["grapesjs-editor"]?.pluginSlots?.grapesJsEditor.push( {
                plugin: "dbfield",
                depends: ["ag-grid"],
                extensionPath: "/plugin/dbadmin/editor/grapesjs-dbfield-extension.mjs"
            })
        }
        if(pluginsData?.["ag-grid"]?.pluginSlots?.agGridExtensions){
            pluginsData?.["ag-grid"]?.pluginSlots?.agGridExtensions.push( {
                plugin: "dbadmin",
                extensionPath: "/plugin/dbadmin/lib/ag-grid-dbadmin.mjs"
            })
        }
    })

    return {
        // path in which the plugin provide its front end files
        frontEndPath: "front",
        //lib that will be automatically load in frontend
        frontEndLib: "lib/db-loader.mjs",
        router: router,
        menu: [
            { name: "admin", entries: [
                { name: "Database admin", link: "/plugin/dbadmin/" }
            ]}
        ],
        pluginSlots: {
            dbFieldsExtensions: [],
            dbValuesExtensions: [],
        }
    }
}