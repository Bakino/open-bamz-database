import { getGraphqlClient } from "./graphql-client.mjs"

import { DbFieldExtensions, DbValueExtensions } from "./db-components.mjs" ;

// register extension from other plugins
DbFieldExtensions.loadExtension({
    url: `/open-bamz-database/db-fields-extensions`,
}) ;

// register extension from other plugins
DbValueExtensions.loadExtension({
    url: `/open-bamz-database/db-values-extensions`,
}) ;

export { getGraphqlClient };