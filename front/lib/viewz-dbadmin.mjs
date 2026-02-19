import { getGraphqlClient } from "./db-lib.mjs";

export default {
    globals: {
        dbApi: await getGraphqlClient()
    },
    extends: {
        dbApi: await getGraphqlClient()
    },
}
