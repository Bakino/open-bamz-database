import { getGraphqlClient } from "./db-lib.mjs";

// The `dbApi` global is read by viewz on every view render (Object.values on
// ext.globals), so exposing it through a getter lets us swap the underlying
// client at runtime without freezing a broken reference for the whole session.
//
// When the GraphQL client cannot be initialized (offline at boot), getGraphqlClient()
// returns a not-ready client and drops it from its cache. In that state we serve a
// stub whose every db / mutations / queries / transaction call rejects with
// NETWORK_ERROR, which window.viewzErrorHandler turns into the connection-error
// screen. Meanwhile we re-acquire the client in the background, so the next render
// (or after the connection comes back) uses a working client.
// (A connection lost mid-session is handled separately: queryGraphql() throws
// NETWORK_ERROR on a failed fetch, on an already-ready client.)

function makeNetworkErrorStub(){
    const reject = () => Promise.reject(new Error("NETWORK_ERROR")) ;
    // db.<table>.<op>() / mutations.<x>() / queries.<x>()
    const tableProxy = new Proxy({}, { get: () => reject }) ;
    // db.<table> -> tableProxy
    const groupProxy = new Proxy({}, { get: () => tableProxy }) ;
    return new Proxy({}, {
        get(_target, prop){
            if(prop === "db"){ return groupProxy ; }
            if(prop === "mutations" || prop === "queries"){ return tableProxy ; }
            // any other direct call (e.g. dbApi.transaction(...)) -> network error
            return reject ;
        }
    }) ;
}

const NETWORK_ERROR_STUB = makeNetworkErrorStub() ;

let _client = null ;
let _acquiring = null ;

async function acquire(){
    try{
        const cli = await getGraphqlClient() ;
        // Only adopt a fully initialized client; otherwise stay on the stub.
        // getGraphqlClient already dropped a not-ready client from its cache,
        // so the next acquire() recreates it from scratch.
        _client = (cli && cli.ready) ? cli : null ;
    }catch(err){
        _client = null ;
    }finally{
        _acquiring = null ;
    }
    return _client ;
}

// Initial attempt at boot. Never throws, so the plugin always registers the
// `dbApi` global even when the device is offline at startup.
await acquire() ;

function currentDbApi(){
    if(_client){
        return _client ;
    }
    // Not ready: trigger a single background re-acquisition and serve the stub.
    if(!_acquiring){
        _acquiring = acquire() ;
    }
    return NETWORK_ERROR_STUB ;
}

export default {
    globals: {
        get dbApi(){ return currentDbApi() ; }
    },
    extends: {
        get dbApi(){ return currentDbApi() ; }
    },
}
