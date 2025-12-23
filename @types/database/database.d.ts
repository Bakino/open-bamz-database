/** openbamz_plugins */
type openbamz_plugins = {
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: string;
  /** plugin_id */
  plugin_id: string;
  /** create_time */
  create_time?: Date;
}

/** A connection to a list of `openbamz_plugins` values. */
type openbamz_pluginsConnection = {
  /** A list of `openbamz_plugins` objects. */
  nodes: openbamz_plugins[];
  /** A list of edges which contains the `openbamz_plugins` and cursor to aid in pagination. */
  edges: openbamz_pluginsEdge[];
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `openbamz_plugins` you could get from the connection. */
  totalCount: number;
}

/** A `openbamz_plugins` edge in the connection. */
type openbamz_pluginsEdge = {
  /** A cursor for use in pagination. */
  cursor?: string;
  /** The `openbamz_plugins` at the end of the edge. */
  node?: openbamz_plugins;
}

/** Information about pagination in a connection. */
type PageInfo = {
  /** When paginating forwards, are there more items? */
  hasNextPage: boolean;
  /** When paginating backwards, are there more items? */
  hasPreviousPage: boolean;
  /** When paginating backwards, the cursor to continue. */
  startCursor?: string;
  /** When paginating forwards, the cursor to continue. */
  endCursor?: string;
}

/** A condition to be used against `openbamz_plugins` object types. All fields are
tested for equality and combined with a logical ‘and.’ */
type openbamz_plugins_condition = {
  /** Checks for equality with the object’s `plugin_id` field. */
  plugin_id?: string;
  /** Checks for equality with the object’s `create_time` field. */
  create_time?: Date;
}

/** A filter to be used against `openbamz_plugins` object types. All fields are combined with a logical ‘and.’ */
type openbamz_pluginsFilter = {
  /** Filter by the object’s `plugin_id` field. */
  plugin_id?: StringFilter;
  /** Filter by the object’s `create_time` field. */
  create_time?: DatetimeFilter;
  /** Checks for all expressions in this list. */
  and?: openbamz_pluginsFilter[];
  /** Checks for any expressions in this list. */
  or?: openbamz_pluginsFilter[];
  /** Negates the expression. */
  not?: openbamz_pluginsFilter;
}

/** A filter to be used against String fields. All fields are combined with a logical ‘and.’ */
type StringFilter = {
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean;
  /** Equal to the specified value. */
  equalTo?: string;
  /** Not equal to the specified value. */
  notEqualTo?: string;
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: string;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: string;
  /** Included in the specified list. */
  in?: string[];
  /** Not included in the specified list. */
  notIn?: string[];
  /** Less than the specified value. */
  lessThan?: string;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: string;
  /** Greater than the specified value. */
  greaterThan?: string;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: string;
  /** Contains the specified string (case-sensitive). */
  includes?: string;
  /** Does not contain the specified string (case-sensitive). */
  notIncludes?: string;
  /** Contains the specified string (case-insensitive). */
  includesInsensitive?: string;
  /** Does not contain the specified string (case-insensitive). */
  notIncludesInsensitive?: string;
  /** Starts with the specified string (case-sensitive). */
  startsWith?: string;
  /** Does not start with the specified string (case-sensitive). */
  notStartsWith?: string;
  /** Starts with the specified string (case-insensitive). */
  startsWithInsensitive?: string;
  /** Does not start with the specified string (case-insensitive). */
  notStartsWithInsensitive?: string;
  /** Ends with the specified string (case-sensitive). */
  endsWith?: string;
  /** Does not end with the specified string (case-sensitive). */
  notEndsWith?: string;
  /** Ends with the specified string (case-insensitive). */
  endsWithInsensitive?: string;
  /** Does not end with the specified string (case-insensitive). */
  notEndsWithInsensitive?: string;
  /** Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters. */
  like?: string;
  /** Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters. */
  notLike?: string;
  /** Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters. */
  likeInsensitive?: string;
  /** Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters. */
  notLikeInsensitive?: string;
  /** Equal to the specified value (case-insensitive). */
  equalToInsensitive?: string;
  /** Not equal to the specified value (case-insensitive). */
  notEqualToInsensitive?: string;
  /** Not equal to the specified value, treating null like an ordinary value (case-insensitive). */
  distinctFromInsensitive?: string;
  /** Equal to the specified value, treating null like an ordinary value (case-insensitive). */
  notDistinctFromInsensitive?: string;
  /** Included in the specified list (case-insensitive). */
  inInsensitive?: string[];
  /** Not included in the specified list (case-insensitive). */
  notInInsensitive?: string[];
  /** Less than the specified value (case-insensitive). */
  lessThanInsensitive?: string;
  /** Less than or equal to the specified value (case-insensitive). */
  lessThanOrEqualToInsensitive?: string;
  /** Greater than the specified value (case-insensitive). */
  greaterThanInsensitive?: string;
  /** Greater than or equal to the specified value (case-insensitive). */
  greaterThanOrEqualToInsensitive?: string;
}

/** A filter to be used against Datetime fields. All fields are combined with a logical ‘and.’ */
type DatetimeFilter = {
  /** Is null (if `true` is specified) or is not null (if `false` is specified). */
  isNull?: boolean;
  /** Equal to the specified value. */
  equalTo?: Date;
  /** Not equal to the specified value. */
  notEqualTo?: Date;
  /** Not equal to the specified value, treating null like an ordinary value. */
  distinctFrom?: Date;
  /** Equal to the specified value, treating null like an ordinary value. */
  notDistinctFrom?: Date;
  /** Included in the specified list. */
  in?: Date[];
  /** Not included in the specified list. */
  notIn?: Date[];
  /** Less than the specified value. */
  lessThan?: Date;
  /** Less than or equal to the specified value. */
  lessThanOrEqualTo?: Date;
  /** Greater than the specified value. */
  greaterThan?: Date;
  /** Greater than or equal to the specified value. */
  greaterThanOrEqualTo?: Date;
}

/** Methods to use when ordering `openbamz_plugins`. */
type openbamz_plugins_order_by = "NATURAL"|"PRIMARY_KEY_ASC"|"PRIMARY_KEY_DESC"|"PLUGIN_ID_ASC"|"PLUGIN_ID_DESC"|"CREATE_TIME_ASC"|"CREATE_TIME_DESC"; 

/** The output of our `openbamz_list_schema_and_tables` mutation. */
type openbamz_list_schema_and_tables_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** result */
  result?: JSON;
}

/** All input for the `openbamz_list_schema_and_tables` mutation. */
type openbamz_list_schema_and_tablesInput = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
}

/** The output of our `dbadmin_get_schemas_and_tables` mutation. */
type dbadmin_get_schemas_and_tables_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** result */
  result?: JSON;
}

/** All input for the `dbadmin_get_schemas_and_tables` mutation. */
type dbadmin_get_schemas_and_tablesInput = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
}

/** The output of our `dbadmin_run_query` mutation. */
type dbadmin_run_query_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** result */
  result?: JSON;
}

/** All input for the `dbadmin_run_query` mutation. */
type dbadmin_run_queryInput = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** query */
  query?: string;
}

/** The output of our `dbadmin_get_function_metadata` mutation. */
type dbadmin_get_function_metadata_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** result */
  result?: JSON;
}

/** All input for the `dbadmin_get_function_metadata` mutation. */
type dbadmin_get_function_metadataInput = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** p_schema */
  p_schema?: string;
  /** p_func */
  p_func?: string;
}

/** The output of our `dbadmin_get_table_metadata` mutation. */
type dbadmin_get_table_metadata_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** result */
  result?: JSON;
}

/** All input for the `dbadmin_get_table_metadata` mutation. */
type dbadmin_get_table_metadataInput = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** p_schema */
  p_schema?: string;
  /** p_table */
  p_table?: string;
}

/** The output of our `dbadmin_run_queries` mutation. */
type dbadmin_run_queries_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** result */
  result?: JSON;
}

/** All input for the `dbadmin_run_queries` mutation. */
type dbadmin_run_queriesInput = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** queries */
  queries?: string[];
}

/** The output of our `openbamz_run_transaction` mutation. */
type openbamz_run_transaction_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** result */
  result?: openbamz_transaction_record_type[];
}

/** openbamz_transaction_record_type */
type openbamz_transaction_record_type = {
  /** action */
  action?: openbamz_transaction_action_type;
  /** table_name */
  table_name?: string;
  /** id */
  id?: string;
  /** record */
  record?: JSON;
  /** key */
  key?: JSON;
}

/** openbamz_transaction_action_type */
type openbamz_transaction_action_type = "insert"|"update"|"delete"; 

/** All input for the `openbamz_run_transaction` mutation. */
type openbamz_run_transactionInput = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** records */
  records?: openbamz_transaction_record_typeInput[];
}

/** An input for mutations affecting `openbamz_transaction_record_type` */
type openbamz_transaction_record_typeInput = {
  /** action */
  action?: openbamz_transaction_action_type;
  /** table_name */
  table_name?: string;
  /** id */
  id?: string;
  /** record */
  record?: JSON;
  /** key */
  key?: JSON;
}

/** The output of our create `openbamz_plugins` mutation. */
type create_openbamz_plugins_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** The `openbamz_plugins` that was created by this mutation. */
  openbamz_plugins?: openbamz_plugins;
  /** An edge for our `openbamz_plugins`. May be used by Relay 1. */
  openbamz_pluginsEdge?: openbamz_pluginsEdge;
}

/** All input for the create `openbamz_plugins` mutation. */
type create_openbamz_plugins_input = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** The `openbamz_plugins` to be created by this mutation. */
  openbamz_plugins: openbamz_pluginsInput;
}

/** An input for mutations affecting `openbamz_plugins` */
type openbamz_pluginsInput = {
  /** plugin_id */
  plugin_id: string;
  /** create_time */
  create_time?: Date;
}

/** The output of our update `openbamz_plugins` mutation. */
type update_openbamz_plugins_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** The `openbamz_plugins` that was updated by this mutation. */
  openbamz_plugins?: openbamz_plugins;
  /** An edge for our `openbamz_plugins`. May be used by Relay 1. */
  openbamz_pluginsEdge?: openbamz_pluginsEdge;
}

/** All input for the `update_openbamz_plugins` mutation. */
type update_openbamz_plugins_input = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** The globally unique `ID` which will identify a single `openbamz_plugins` to be updated. */
  nodeId: string;
  /** An object where the defined keys will be set on the `openbamz_plugins` being updated. */
  openbamz_plugins_patch: openbamz_plugins_patch;
}

/** Represents an update to a `openbamz_plugins`. Fields that are set will be updated. */
type openbamz_plugins_patch = {
  /** plugin_id */
  plugin_id?: string;
  /** create_time */
  create_time?: Date;
}

/** All input for the `update_openbamz_plugins_by_plugin_id` mutation. */
type update_openbamz_plugins_by_plugin_id_input = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** plugin_id */
  plugin_id: string;
  /** An object where the defined keys will be set on the `openbamz_plugins` being updated. */
  openbamz_plugins_patch: openbamz_plugins_patch;
}

/** The output of our delete `openbamz_plugins` mutation. */
type delete_openbamz_plugins_payload = {
  /** The exact same `clientMutationId` that was provided in the mutation input,
unchanged and unused. May be used by a client to track mutations. */
  clientMutationId?: string;
  /** The `openbamz_plugins` that was deleted by this mutation. */
  openbamz_plugins?: openbamz_plugins;
  /** deleted_openbamz_plugins_nodeId */
  deleted_openbamz_plugins_nodeId?: string;
  /** An edge for our `openbamz_plugins`. May be used by Relay 1. */
  openbamz_pluginsEdge?: openbamz_pluginsEdge;
}

/** All input for the `delete_openbamz_plugins` mutation. */
type delete_openbamz_plugins_input = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** The globally unique `ID` which will identify a single `openbamz_plugins` to be deleted. */
  nodeId: string;
}

/** All input for the `delete_openbamz_plugins_by_plugin_id` mutation. */
type delete_openbamz_plugins_by_plugin_id_input = {
  /** An arbitrary string value with no semantic meaning. Will be included in the
payload verbatim. May be used to track mutations by the client. */
  clientMutationId?: string;
  /** plugin_id */
  plugin_id: string;
}

/** Input params of mutation openbamz_list_schema_and_tables */
type mutation_openbamz_list_schema_and_tables_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: openbamz_list_schema_and_tablesInput;
}

/** Input params of mutation dbadmin_get_schemas_and_tables */
type mutation_dbadmin_get_schemas_and_tables_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: dbadmin_get_schemas_and_tablesInput;
}

/** Input params of mutation dbadmin_run_query */
type mutation_dbadmin_run_query_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: dbadmin_run_queryInput;
}

/** Input params of mutation dbadmin_get_function_metadata */
type mutation_dbadmin_get_function_metadata_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: dbadmin_get_function_metadataInput;
}

/** Input params of mutation dbadmin_get_table_metadata */
type mutation_dbadmin_get_table_metadata_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: dbadmin_get_table_metadataInput;
}

/** Input params of mutation dbadmin_run_queries */
type mutation_dbadmin_run_queries_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: dbadmin_run_queriesInput;
}

/** Input params of mutation openbamz_run_transaction */
type mutation_openbamz_run_transaction_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: openbamz_run_transactionInput;
}

/** Input params of mutation create_openbamz_plugins */
type mutation_create_openbamz_plugins_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: create_openbamz_plugins_input;
}

/** Input params of mutation update_openbamz_plugins */
type mutation_update_openbamz_plugins_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: update_openbamz_plugins_input;
}

/** Input params of mutation update_openbamz_plugins_by_plugin_id */
type mutation_update_openbamz_plugins_by_plugin_id_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: update_openbamz_plugins_by_plugin_id_input;
}

/** Input params of mutation delete_openbamz_plugins */
type mutation_delete_openbamz_plugins_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: delete_openbamz_plugins_input;
}

/** Input params of mutation delete_openbamz_plugins_by_plugin_id */
type mutation_delete_openbamz_plugins_by_plugin_id_input = {
  /** The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields. */
  input: delete_openbamz_plugins_by_plugin_id_input;
}

/** Input params of query query */
type query_query_input = {
}

/** Input params of query nodeId */
type query_nodeId_input = {
}

/** Input params of query node */
type query_node_input = {
  /** The globally unique `ID`. */
  nodeId: string;
}

/** Input params of query openbamz_plugins_by_plugin_id */
type query_openbamz_plugins_by_plugin_id_input = {
  /** plugin_id */
  plugin_id: string;
}

/** Input params of query openbamz_plugins */
type query_openbamz_plugins_input = {
  /** The globally unique `ID` to be used in selecting a single `openbamz_plugins`. */
  nodeId: string;
}

/** Input params of query all_openbamz_plugins */
type query_all_openbamz_plugins_input = {
  /** Only read the first `n` values of the set. */
  first?: number;
  /** Only read the last `n` values of the set. */
  last?: number;
  /** Skip the first `n` values from our `after` cursor, an alternative to cursor
based pagination. May not be used with `last`. */
  offset?: number;
  /** Read all values in the set before (above) this cursor. */
  before?: string;
  /** Read all values in the set after (below) this cursor. */
  after?: string;
  /** A condition to be used in determining which values should be returned by the collection. */
  condition?: openbamz_plugins_condition;
  /** A filter to be used in determining which values should be returned by the collection. */
  filter?: openbamz_pluginsFilter;
  /** The method to use when ordering `openbamz_plugins`. */
  orderBy?: openbamz_plugins_order_by[];
}

/** Search params */
interface standard_search_params {
  /** Only read the first N values of the set. */
  first?: number;
  /** Only read the last N values of the set. */
  last?: number;
  /** Skip the first N values. May not be used with last. */
  offset?: number;
}

declare class GraphqlClientQueries {

  /** 
   * Get a single `openbamz_plugins`. 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  openbamz_plugins_by_plugin_id(params?: query_openbamz_plugins_by_plugin_id_input, output?: openbamz_plugins): Promise<openbamz_plugins>;
  /** 
   * Reads a single `openbamz_plugins` using its globally unique `ID`. 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  openbamz_plugins(params?: query_openbamz_plugins_input, output?: openbamz_plugins): Promise<openbamz_plugins>;
  /** 
   * Reads and enables pagination through a set of `openbamz_plugins`. 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  all_openbamz_plugins(params?: query_all_openbamz_plugins_input, output?: openbamz_pluginsConnection): Promise<openbamz_pluginsConnection>;
}

declare class GraphqlClientMutations {

  /** 
   * openbamz_list_schema_and_tables 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  openbamz_list_schema_and_tables(params?: mutation_openbamz_list_schema_and_tables_input , output?: openbamz_list_schema_and_tables_payload): Promise<openbamz_list_schema_and_tables_payload>;
  /** 
   * dbadmin_get_schemas_and_tables 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  dbadmin_get_schemas_and_tables(params?: mutation_dbadmin_get_schemas_and_tables_input , output?: dbadmin_get_schemas_and_tables_payload): Promise<dbadmin_get_schemas_and_tables_payload>;
  /** 
   * dbadmin_run_query 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  dbadmin_run_query(params?: mutation_dbadmin_run_query_input , output?: dbadmin_run_query_payload): Promise<dbadmin_run_query_payload>;
  /** 
   * dbadmin_get_function_metadata 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  dbadmin_get_function_metadata(params?: mutation_dbadmin_get_function_metadata_input , output?: dbadmin_get_function_metadata_payload): Promise<dbadmin_get_function_metadata_payload>;
  /** 
   * dbadmin_get_table_metadata 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  dbadmin_get_table_metadata(params?: mutation_dbadmin_get_table_metadata_input , output?: dbadmin_get_table_metadata_payload): Promise<dbadmin_get_table_metadata_payload>;
  /** 
   * dbadmin_run_queries 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  dbadmin_run_queries(params?: mutation_dbadmin_run_queries_input , output?: dbadmin_run_queries_payload): Promise<dbadmin_run_queries_payload>;
  /** 
   * openbamz_run_transaction 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  openbamz_run_transaction(params?: mutation_openbamz_run_transaction_input , output?: openbamz_run_transaction_payload): Promise<openbamz_run_transaction_payload>;
  /** 
   * Creates a single `openbamz_plugins`. 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  create_openbamz_plugins(params?: mutation_create_openbamz_plugins_input , output?: create_openbamz_plugins_payload): Promise<create_openbamz_plugins_payload>;
  /** 
   * Updates a single `openbamz_plugins` using its globally unique id and a patch. 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  update_openbamz_plugins(params?: mutation_update_openbamz_plugins_input , output?: update_openbamz_plugins_payload): Promise<update_openbamz_plugins_payload>;
  /** 
   * Updates a single `openbamz_plugins` using a unique key and a patch. 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  update_openbamz_plugins_by_plugin_id(params?: mutation_update_openbamz_plugins_by_plugin_id_input , output?: update_openbamz_plugins_payload): Promise<update_openbamz_plugins_payload>;
  /** 
   * Deletes a single `openbamz_plugins` using its globally unique id. 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  delete_openbamz_plugins(params?: mutation_delete_openbamz_plugins_input , output?: delete_openbamz_plugins_payload): Promise<delete_openbamz_plugins_payload>;
  /** 
   * Deletes a single `openbamz_plugins` using a unique key. 
   * @param params input params
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  delete_openbamz_plugins_by_plugin_id(params?: mutation_delete_openbamz_plugins_by_plugin_id_input , output?: delete_openbamz_plugins_payload): Promise<delete_openbamz_plugins_payload>;
}

/** Search params of openbamz_plugins */
interface search_params_openbamz_plugins extends standard_search_params {
  /** The method to use when ordering `openbamz_plugins`. */
  orderBy?: openbamz_plugins_order_by[];
}

/** Search results of openbamz_plugins */
type pagination_result_openbamz_plugins = {
  /** The list of results. */
  results: openbamz_plugins[];
  /** The total count matching the search. */
  totalCount: number;
}

declare class GraphqlClientQueries_openbamz {

  /** 
        * Get a single `openbamz_plugins`. 
        * @param params input params
        * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
        */
  plugins_by_plugin_id(params?: query_openbamz_plugins_by_plugin_id_input, output?: openbamz_plugins): Promise<openbamz_plugins>;
  /** 
        * Reads a single `openbamz_plugins` using its globally unique `ID`. 
        * @param params input params
        * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
        */
  plugins(params?: query_openbamz_plugins_input, output?: openbamz_plugins): Promise<openbamz_plugins>;
}

declare class GraphqlClientMutations_openbamz {

  /** 
           * openbamz_list_schema_and_tables 
           * @param params input params
           * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
           */
  list_schema_and_tables(params?: mutation_openbamz_list_schema_and_tables_input , output?: openbamz_list_schema_and_tables_payload): Promise<openbamz_list_schema_and_tables_payload>;
  /** 
           * openbamz_run_transaction 
           * @param params input params
           * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
           */
  run_transaction(params?: mutation_openbamz_run_transaction_input , output?: openbamz_run_transaction_payload): Promise<openbamz_run_transaction_payload>;
}

declare class GraphqlClientDbTable_plugins {

  /** 
   * Search in plugins (openbamz) with pagination informations
   * @param filter filter to apply on the search.
   * @param searchParams search params like first, last, orderBy, output
   */
  searchPagination(filter?: openbamz_pluginsFilter , searchParams?: search_params_openbamz_plugins): Promise<pagination_result_openbamz_plugins>;
  /** 
   * Search in plugins (openbamz)
   * @param filter filter to apply on the search.
   * @param searchParams search params like first, last, orderBy, output
   */
  search(filter?: openbamz_pluginsFilter , searchParams?: search_params_openbamz_plugins): Promise<openbamz_plugins[]>;
  /** 
   * Search first result in plugins (openbamz)
   * @param filter filter to apply on the search.
   * @param searchParams search params like orderBy, output
   */
  searchFirst(filter?: openbamz_pluginsFilter , searchParams?: search_params_openbamz_plugins): Promise<openbamz_plugins>;
  /** 
   * Read in plugins (openbamz) by plugin_id
   * @param plugin_id
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  getByPlugin_id(plugin_id:string, output?: openbamz_plugins): Promise<openbamz_plugins>;
  /** 
   * Create in plugins (openbamz)
   * @param record the record to insert
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  create(record: openbamz_plugins , output?: openbamz_plugins): Promise<openbamz_plugins>;
  /** 
   * Delete in plugins (openbamz) by plugin_id
   * @param plugin_id
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  deleteByPlugin_id(plugin_id:string, output?: openbamz_plugins): Promise<openbamz_plugins>;
  /** 
   * Delete in plugins (openbamz) by plugin_id
   * @param plugin_id
   * @param update the fields to update
   * @param output desired fields in the output. Give it as a JSON object like { field1: true, field2: true }. If not provided, all fields will be returned.
   */
  updateByPlugin_id(plugin_id:string, update: openbamz_plugins, output?: openbamz_plugins): Promise<openbamz_plugins>;
}

declare class GraphqlClientDbSchema_openbamz {

  plugins: GraphqlClientDbTable_plugins;

  queries: GraphqlClientQueries_openbamz;

  mutations: GraphqlClientMutations_openbamz;

}

declare class GraphqlClientDb {

  openbamz: GraphqlClientDbSchema_openbamz;

}

declare class GraphqlClientTransaction {

  /** Simplified access to your database */
  db: GraphqlClientDb;
}

declare class GraphqlClient {

  /** Simplified access to your database */
  db: GraphqlClientDb;
  /** Simplified access all graphql queries */
  queries: GraphqlClientQueries;
  /** Simplified access all graphql mutations */
  mutations: GraphqlClientMutations;

  schemas: any[] ;

  /** Run a plain graphql query */
  queryGraphql(query: string): Promise<object>;
  /** 
   * Run a transaction. Only the creation / udpate / delete operations in the db access are supported
   * @example 
   * const results = await client.transaction(async (tr)=>{
   *    const todoList = await tr.db.todo_list.create({ name: "My todo list" }) ;
   *    await tr.db.todo_item.create({list_id: todoList.id, description: "First item to do"}) ;
   *    await tr.db.todo_item.create({list_id: todoList.id, description: "Second item to do"}) ;
   * }) ;
   */
  transaction(cb: (tr: GraphqlClientTransaction) => Promise<any>): Promise<object[]> ;
}
