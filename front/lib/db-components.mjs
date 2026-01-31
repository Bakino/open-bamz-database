import { formatRecord, getReferencedRecord, prepareFormatFunction } from "./db-helpers.mjs";
import { getGraphqlClient } from "./graphql-client.mjs";

export async function loadCss (url){
    let head = document.head;
    if(head.querySelector(`link[href="${url}"]`)){
        return ;
    }
    return new Promise((resolve)=>{
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.crossOrigin = "anonymous" ;
        link.href = url;
        
        
        head.appendChild(link);
        resolve() ;
    }) ;
}
function attrNameToPropertyName(att){
    return att.split("-").map((v, i)=>{
        if(i>0){
            return v.substring(0,1).toUpperCase()+v.substring(1) ;
        }else{
            return v ;
        }
    }).join("") ;
}

function attributesToOptions(element, options, prefix){
    for(let attr of element.attributes){
        if(!attr.name.startsWith(prefix)){ continue; }
        const propertyName = attrNameToPropertyName(attr.name.substring(prefix.length));
        let attrValue = element[propertyName];
        if(attrValue == null){
            attrValue = element.getAttribute(attr.name);
        }
        if(typeof(attrValue) === "string"){
            // the attribute value is a string, check if it is a component name
            let componentName = attrValue ;
            let componentParams = null;
            if(attrValue.includes("(")){
                //component can have parameters like this MyComponent({param1: "value1", param2: "value2"})
                componentName = componentName.substring(0, attrValue.indexOf("("));
            }
        }
        if(attrValue === ""){
            // if the attribute value is empty, set it to true
            attrValue = true ;
        }
        if(attrValue === "true"){
            attrValue = true;
        }else if(attrValue === "false"){
            attrValue = false;
        }else if(attrValue && 
            (
                (attrValue.startsWith("{") && attrValue.endsWith("}")) ||
                (attrValue.startsWith("[") && attrValue.endsWith("]"))
            )
        ){
            //try to parse JSON
            try{
                attrValue = JSON.parse(attrValue) ;
            }catch(e){
                //malformatted JSON, keep the string value
            }
        }

        const optPath = propertyName.split(".") ;
        let optObject = options;
        while(optPath.length>1){
            const p = optPath.shift() ;
            if(!optObject[p]){
                optObject[p] = {} ;
            }
            optObject = optObject[p] ;
        }
        optObject[optPath.shift()] = attrValue ;
    }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    // @ts-ignore
    reader.onload = () => resolve(reader.result.substring(reader.result.indexOf("base64,")+"base64,".length));
    reader.onerror = reject;
});

export const DbFieldExtensions = {
    extensions: [],
    loadExtension(extension){
        this.extensions.push(extension) ;
    }
}
export const DbValueExtensions = {
    extensions: [],
    loadExtension(extension){
        this.extensions.push(extension) ;
    }
}

if(!customElements.get("db-field")){
    const convertToDateTimeLocalString = (date) => {
        if(!date){ return null; }
        if(date.constructor !== Date){
            date = new Date(date) ;
        }
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
      
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    const DEFAULT_EXTENSION = {
        generateLabelString: async function ({schema, table, column, el=null, defaultExtension, dbApi}){
            return column.description ?? column.column_name ;
        },

        generateEnumLabel: async function ({type, schema, table, column, value, defaultLabel}){
            return defaultLabel ;
        },
        
        generateInputElement: async function({label, type, schema, table, column, el, placeholder, defaultExtension, dbApi}){
            if(type === "enum"){
                if(column.enum_values){
                    let enumOptions = {
                        type: "select",
                        values: []
                    } ;
                    if(column.type_description){
                        try{
                            let parsedDescription = column.type_description ;
                            if(typeof(parsedDescription) === "string"){
                                parsedDescription = JSON.parse(parsedDescription) ;
                            }
                            if(Array.isArray(parsedDescription)){
                                enumOptions.values = parsedDescription ;
                            }else{
                                enumOptions = parsedDescription
                            }
                        // eslint-disable-next-line no-unused-vars
                        }catch(e){
                            //malformatted JSON
                        }
                    }

                    if(enumOptions.type === "radio"){
                        const elDiv = document.createElement("DIV") ;
                        const elInputHidden = /** @type {HTMLInputElement} */ (document.createElement("INPUT")) ;
                        elInputHidden.type = "hidden" ;
                        elInputHidden.id = el.id+"_input" ;
                        for(let val of column.enum_values){
                            const elRadio = /** @type {HTMLInputElement} */ (document.createElement("INPUT")) ;
                            elRadio.type = "radio" ;
                            elRadio.name = el.id+"_input" ;
                            elRadio.value = val ;
                            elRadio.id = el.id+"_input_"+val ;
                            const elLabel = document.createElement("LABEL") ;
                            elLabel.setAttribute("for", elRadio.id);
                            elLabel.innerHTML = enumOptions.values.find(l=>l.value === val)?.label ?? val ;
                            elDiv.appendChild(elRadio) ;
                            elDiv.appendChild(elLabel) ;
                            elRadio.addEventListener("change", ()=>{
                                if(elRadio.checked){
                                    elInputHidden.value = elRadio.value ;
                                    elDiv.dispatchEvent(new Event("change", { bubbles: true })) ;
                                }
                            }) ;
                        }
                        elInputHidden.addEventListener("change", ()=>{
                            const elRadio = /** @type {HTMLInputElement} */ (elDiv.querySelector(`input[type="radio"][value="${elInputHidden.value}"]`)) ;
                            if(elRadio){
                                elRadio.checked = true ;
                            }
                        });
                        
                        elDiv.appendChild(elInputHidden) ;
                        return elDiv;
                    }else{
                        const elSelect = document.createElement("SELECT") ;    
                        const elOption = /** @type {HTMLOptionElement} */ (document.createElement("OPTION")) ;
                        elOption.value = "" ;
                        elOption.innerHTML = "" ;
                        elSelect.appendChild(elOption) ;
            
                        elSelect.id = el.id+"_input" ;

                        for(let val of column.enum_values){
                            const elOption = /** @type {HTMLOptionElement} */ (document.createElement("OPTION")) ;
                            elOption.value = val ;
                            elOption.innerHTML = await this.generateEnumLabel({
                                type: "select", schema, table, column,
                                value: val, 
                                defaultLabel: enumOptions.values.find(l=>l.value === val)?.label ?? val
                            }) ;
                            elSelect.appendChild(elOption) ;
                        }
                        return elSelect ;
                    }
                }else{
                    const elError = document.createElement("SPAN") ;
                    elError.innerHTML = "No enum_values found" ;
                    return elError ;
                }
            }else if (type==="reference"){
                const elSelect = document.createElement("SELECT") ;    
                const elOption = /** @type {HTMLOptionElement} */ (document.createElement("OPTION")) ;
                elOption.value = "" ;
                elOption.innerHTML = "" ;
                elSelect.appendChild(elOption) ;
    
                elSelect.id = el.id+"_input" ;
                
                return elSelect ;
            }else if (type==="multiline"){
                const elTextarea = /** @type {HTMLTextAreaElement} */ (document.createElement("TEXTAREA")) ;
                elTextarea.id = el.id+"_input" ;
                elTextarea.placeholder = placeholder||label||"" ;
                return elTextarea ;
            }else if (type==="html"){
                const elHtmlEditor = document.createElement("DIV") ;
                elHtmlEditor.id = el.id+"_input" ;
                return elHtmlEditor ;
            }else if (type==="bytea"){
                const elBinary = /** @type {HTMLDivElement} */ (document.createElement("DIV")) ;
                elBinary.style.display = "flex" ;
                const elInfos = /** @type {HTMLDivElement} */ (document.createElement("DIV")) ;
                elInfos.className = "bamz-binary-infos"
                const elInput = /** @type {HTMLInputElement} */ (document.createElement("INPUT")) ;
                elInput.id = el.id+"_input" ;
                elInput.type = "file" ;
                elInput.addEventListener("change", async ()=>{
                    elInfos.innerHTML = "..."
                    elInput.setCustomValidity("File is loading") ;
                    try{
                        const file = elInput.files[0];
                        // @ts-ignore
                        if(elInput.currentFile !== file){
                            // @ts-ignore
                            elInput.currentFile = file ;
                            if(!file){
                                elInfos.innerHTML = ""
                                elInput.value = "" ;
                            }else{
                                elInfos.innerHTML = file.name+" ("+file.type+")" ;
                                const base64 = await toBase64(file);
                                // @ts-ignore
                                elBinary.value = base64 ;
                                elBinary.dispatchEvent(new Event("change", { bubbles: true })) ;
                            }
                        }
                    }finally{
                        elInput.setCustomValidity("") ;
                    }
                });

                elBinary.appendChild(elInfos) ;
                elBinary.appendChild(elInput) ;
                return elBinary ;
            }else{
                const elInput = /** @type {HTMLInputElement} */ (document.createElement("INPUT")) ;
                elInput.id = el.id+"_input" ;
                if(type === "date"){
                    elInput.type = "date" ;
                }else if(type === "boolean"){
                    elInput.type = "checkbox" ;
                }else if(type === "datetime"){
                    elInput.type = "datetime-local" ;
                }else if(type === "decimal"){
                    elInput.type = "number" ;
                    elInput.step = "0.01" ;
                }else if(type === "integer"){
                    elInput.type = "number" ;
                }else if(type === "email"){
                    elInput.type = "email" ;
                }else if(type === "phone"){
                    elInput.type = "tel" ;
                }else if(type === "color"){
                    elInput.type = "color" ;
                }else{
                    elInput.type = "text" ;
                    elInput.placeholder = placeholder||label||"" ;
                }
                return elInput ;
            }
        },
      
        generateLabelElement: async function({label, type, schema, table, column, el, defaultExtension}){
            const elLabel = document.createElement("LABEL") ;
            elLabel.setAttribute("for", el.id+"_input");
            elLabel.innerHTML = label;
            return elLabel;
        },
        
        appendElements: async function({label, type, schema, table, column, el, elLabel, elInput, defaultExtension, dbApi}){
            if(elLabel){
                el.appendChild(elLabel) ;
            }
            if(elInput){
                el.appendChild(elInput) ;
            }
        },
    
        getValue: function({el, type, elInput, defaultExtension/*label, type, /*schema, table, column, el, elLabel, elInput*/}){
            if(elInput){
                if(type === "enum" && elInput.tagName === "DIV"){
                    //enum radio
                    return elInput.querySelector("input[type='hidden']").value ;
                }
                if(type === "bytea"){
                    if(elInput.value){
                        return elInput.value ; 
                    }else{
                        return null;
                    }
                }
                if(elInput.type === "checkbox"){
                    return elInput.checked ;
                }else{
                    return elInput.value ;
                }
            }
        },
    
        setValue: function({el, type, elInput, value, defaultExtension /*label, type, schema, table,column, el, elLabel, elInput, value*/}){
            if(elInput){
                if(value===null || value===undefined){
                    value = "" ;
                }
                if(type === "enum" && elInput.tagName === "DIV"){
                    //enum radio
                    const elInputHidden = elInput.querySelector("input[type='hidden']");
                    elInputHidden.value = value;
                    elInputHidden.dispatchEvent(new Event("change", { bubbles: true })) ;
                }
                if(elInput.type === "checkbox"){
                    elInput.checked = value ;
                }else if(elInput.type === "datetime-local"){
                    elInput.value = convertToDateTimeLocalString(value) ;
                }else if(elInput.type === "date"){
                    if(!value){
                        elInput.value = "" ;
                    }else{
                        elInput.value = convertToDateTimeLocalString(value).substring(0, 10) ;
                    }
                }else{
                    elInput.value = value ;
                }
            }
        }, 
   
        setPlaceholder: function({el, elInput, type, placeholder, defaultExtension}){
            if(elInput){
                elInput.placeholder = placeholder??"";
            }
        },
        setRequired: function({el, type, elInput, required, defaultExtension /*label, type, schema, table,column, el, elLabel, elInput, value*/}){
            if(elInput){
                if(type === "enum" && elInput.tagName === "DIV"){
                    //enum radio, the required attribute is on the first radio
                    const firstRadio = elInput.querySelector("input[type='radio']") ;
                    if(firstRadio){
                        firstRadio.required = required;
                    }
                }
                elInput.required = required;
            }
        },

        setReadOnly: function({el, type, elInput, readOnly, defaultExtension /*label, type, schema, table,column, el, elLabel, elInput, value*/}){
            if(elInput){
                if(type === "enum" && elInput.tagName === "DIV"){
                    //enum radio, the required attribute is on the first radio
                    const allRadios = Array.prototype.slice.apply(elInput.querySelectorAll("input[type='radio']")) ;
                    for(let r of allRadios){
                        r.readOnly = readOnly;
                    }
                }
                if(elInput.choice){
                    if(readOnly){
                        elInput.choice.disable() ;
                    }else{
                        elInput.choice.enable() ;
                    }
                }else if(elInput.quill){
                    if(readOnly){
                        elInput.quill.disable() ;
                        const toolbar = elInput.quill.getModule('toolbar');
                        if (toolbar?.container) {
                            toolbar.container.style.display = 'none';
                        }
                    }else{
                        elInput.quill.enable() ;
                        const toolbar = elInput.quill.getModule('toolbar');
                        if (toolbar?.container) {
                            toolbar.container.style.display = '';
                        }
                    }
                }else if(elInput.tagName === "SELECT"){
                    elInput.disabled = readOnly;
                }else if(elInput.tagName === "INPUT" && (elInput.type === "radio" || elInput.type === "checkbox")){
                    elInput.disabled = readOnly;
                }else{
                    elInput.readOnly = readOnly;
                }
            }
        },
        focus: function({el, type, elInput, defaultExtension /*label, type, schema, table,column, el, elLabel, elInput, value*/}){
            if (type==="reference"){
                elInput.choice.showDropdown();
            }else if(type==="html"){
                elInput.quill.focus() ;
            }else{
                elInput.focus() ;
            }
        },
    
       
        setCustomValidity: function({el, elInput, message, type, defaultExtension /*label, type, schema, table,column, el, elLabel, elInput, value*/}){
            if(elInput && elInput.setCustomValidity){
                elInput.setCustomValidity(message) ;
            }
        },
    
        postProcesses: [
            async function({type, el, elLabel, elInput, dbApi, schema, column, placeholder=null, label, defaultExtension}){
                if (type==="reference"){
                    const referencedTable = schema.tables.find(t=>t.table_name === column.reference.referenced_table);

                    if(referencedTable){

                        if(!referencedTable.options?.formatRecord){
                            prepareFormatFunction({table: referencedTable}) ;
                        }
                       
                        // @ts-ignore
                        const Choices = (await import("https://cdn.jsdelivr.net/npm/choices-esm@10.0.0-1/esm/choices-esm.min.js")).default ;
                        await loadCss("https://cdn.jsdelivr.net/npm/choices-esm@10.0.0-1/styles/choices.min.css");
    
                        const doSearch = async (query) => {
                            const orSearch = {} ;
                            for(let key of referencedTable.options.formatKeys){
                                orSearch[key] = {likeInsensitive: `%${query}%`} ;
                            }
                            const result = await dbApi.db[column.reference.referenced_table].search(
                                {or: orSearch},
                                {first:100}
                            )

                            const formattedResults = [] ;
                            for(let record of result){
                                const formattedRecord = await referencedTable.options.formatRecord(record) ;
                                formattedResults.push({ id: record[column.reference.referenced_column], value: record[column.reference.referenced_column], label: formattedRecord }) ;
                            }

                            return formattedResults;
                        }
    
                        //let lastValue = null ;
                        let choice = new Choices(elInput, {
                            searchChoices: true,
                            searchFloor: 1,
                            searchFields: ["label"],
                            fuseOptions: {
                                includeScore: true,
                                threshold: 0,
                                ignoreLocation: true,
                            },
                        });

                        elInput.choice = choice;
    
                        
                        const addChoices = (data)=>{
                            const dataToAdd = data.filter(d=>!choice._store.choices.some(c=>c.value === d.value)) ;
                            if(dataToAdd.length>0){
                                choice.setChoices(dataToAdd, 'value', 'label', false);
                            }
                        }
    
    
                        
                        let searchId = 0 ;
                        elInput.addEventListener('showDropdown', async () => {
                            let currentSearchId = ++searchId ;
                            const data = await doSearch("") ;
                            
                            if(currentSearchId === searchId){
                                addChoices(data);
                            }
                        });
                        elInput.addEventListener('search', async (e) => {
                            let currentSearchId = ++searchId ;
                            const query = e.detail.value ;
    
                            const data = await doSearch(query) ;
                            if(currentSearchId === searchId){
                                addChoices(data);
                            }
                        });
                        /*elInput.addEventListener('change', () => {
                            lastValue = choice.getValue(true);
                            console.log("choice change ???", choice.getValue(true));
                        });*/
    
                        Object.defineProperty(elInput, 'value', {
                            get() {
                                //console.log("get value", lastValue, choice.getValue(true)) ;
                                return choice.getValue(true);
                            },
                            set(value) {
                                //console.log("set value", value) ;
                                //lastValue = value;
                                choice.setChoiceByValue(value);
                                if(choice.getValue(true) !== value){
                                    //not yet in choices, search for it
                                    getReferencedRecord({dbApi, column, value}).then(result=>{
                                        formatRecord({table: referencedTable, record: result}).then(formattedRecord=>{
                                            if(result){
                                                addChoices([{id: value, value, label: formattedRecord}]);
                                            }else{
                                                addChoices([{id: value, value, label: value}]);
                                            }
                                            choice.setChoiceByValue(value);
                                        });
                                    });
                                }
                            },
                            configurable: true // Make sure the property can be redefined or deleted
                        });
                    }

                }else if(type === "html"){
                    // @ts-ignore
                    const Quill = (await import("https://cdn.jsdelivr.net/npm/quill@2.0.3/+esm")).default ;
                    await loadCss("https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css");
                    const optionsQuill = {
                        theme: 'snow',
                        placeholder: placeholder||label||""
                    } ;
                    attributesToOptions(el, optionsQuill, "quill-") ;
                    const quill = new Quill(elInput, optionsQuill);
                    elInput.quill = quill ;

                    quill.on('text-change', (delta, oldDelta, source) => {
                        if(source === "api"){ return ; }
                        elInput.dispatchEvent(new Event("change", { bubbles: true }) );
                    });
                    Object.defineProperty(elInput, 'value', {
                        get() {
                            const htmlContents = quill.getSemanticHTML();
                            if(htmlContents === "<p></p>"){
                                return "" ;
                            }
                            return htmlContents ;
                        },
                        set(value) {
                            const delta = quill.clipboard.convert({ html: value??"" });
                            quill.setContents(delta);
                        },
                        configurable: true // Make sure the property can be redefined or deleted
                    });
                }
            }
        ]
    }
    
    
    let loadingDbFieldExtensions = false ;
    const loadDbFieldExtensions = async function(){
        try{
            if(loadingDbFieldExtensions){
                await new Promise((resolve)=>{ setTimeout(resolve, 100) ; }) ;
                return await loadDbFieldExtensions() ;
            }
            loadingDbFieldExtensions = true ;
            //console.log("start load db components extension")
            for(let ext of DbFieldExtensions.extensions){
                if(ext.isLoaded){ continue ; }
                ext.isLoaded = true ;
                if(ext.url){
                    const impEx = await import(ext.url) ;
                    let extensions = impEx.default ;
                    if(!Array.isArray(extensions)){
                        extensions = [extensions] ;     
                    }
                    for(let ext of extensions){
                        DbField.loadExtension(ext) ;
                        //console.log("load extension", ext)
                        if(ext.customCss){
                            await loadCss(ext.customCss) ;
                        }
                    }
                }else{
                    DbField.loadExtension(ext) ;
                    //console.log("load extension", ext)
                    if(ext.customCss){
                        await loadCss(ext.customCss) ;
                    }
                }
            }
        }finally{
            loadingDbFieldExtensions = false ;
        }
    }

    
    
    class DbField extends HTMLElement {
        static extension = DEFAULT_EXTENSION ;
        static loadExtension(extension){
            //console.log("Load db field extension", extension) ;
            let postProcess = extension.postProcess ;
            if(postProcess){
                DbField.extension.postProcesses.push(postProcess) ;
                delete extension.postProcess ;
            }
            DbField.extension = {
                ...DbField.extension,
                ...extension,
                defaultExtension: {
                    ...DbField.extension
                }
            }
        }

        static async getFieldLabel({schema, table, column}){
            return await DbField.extension.generateLabelString({schema, table, column, defaultExtension: DEFAULT_EXTENSION, dbApi: null}) ;
        }

     
    
        constructor() {
            super();
            this._value = this.getAttribute("value");
            this._initDone = false;
            this._connected = false;
        }
        
        connectedCallback() {
            this._connected = true;
            //console.log("Custom element added to page.");
            this.init() ;
        }
    
        get app(){
            return this.getAttribute("db-app");
        }
        set app(app){
            this.setAttribute("db-app", app);
        }
        get schema(){
            return this.getAttribute("db-schema");
        }
        set schema(schema){
            this.setAttribute("db-schema", schema);
        }
        get table(){
            return this.getAttribute("db-table");
        }
        set table(table){
            this.setAttribute("db-table", table);
        }
        get column(){
            return this.getAttribute("db-column");
        }
        set column(column){
            this.setAttribute("db-column", column);
        }
        get columnDef(){
            if(this.hasAttribute("db-column-def")){
                try{
                    const columnDef = this.getAttribute("db-column-def") ;
                    if(!columnDef.startsWith("${")){ // if starts by ${, it is a template string, we don't want to run it}
                        return new Function(`return ${this.getAttribute("db-column-def")}`)() ;
                    }
                }catch(err){
                    console.error(`Can't run expression ${this.getAttribute("db-column-def")}`, err) ;
                }
            }
            return {}
        }
        set columnDef(columnDef){
            let strDef = columnDef;
            if(typeof(strDef) !== "string"){
                strDef = JSON.stringify(strDef) ;
            }
            this.setAttribute("db-column-def", strDef);
        }
        get type(){
            return this.getAttribute("db-type");
        }
        set type(type){
            this.setAttribute("db-type", type);
        }
        get label(){
            return this.getAttribute("db-label");
        }
        set label(label){
            this.setAttribute("db-label", label);
        }
        get noLabel(){
            return this.hasAttribute("db-no-label");
        }
        set noLabel(noLabel){
            if(noLabel){
                this.setAttribute("db-no-label", "true");
            }else{
                this.removeAttribute("db-no-label") ;
            }
        }
        get noMargin(){
            return this.hasAttribute("db-no-margin");
        }
        set noMargin(noMargin){
            if(noMargin){
                this.setAttribute("db-no-margin", "true");
            }else{
                this.removeAttribute("db-no-margin") ;
            }
        }
        get placeholder(){
            return this.getAttribute("placeholder");
        }
        set placeholder(placeholder){
            if(this.getAttribute("placeholder") != placeholder){
                this.setAttribute("placeholder", placeholder);
            }
            if(this._initDone){
                DbField.extension.setPlaceholder({el: this, elInput: this.elInput, placeholder,  type: this._fieldType, defaultExtension: DEFAULT_EXTENSION}) ;
            }
        }
        get value(){
            if(this._initDone){
                return DbField.extension.getValue({el: this, elInput: this.elInput, type: this._fieldType, defaultExtension: DEFAULT_EXTENSION}) ;
            }else{
                return this._value ;
            }
        }
        set value(value){
            this._value = value ;
            if(this._initDone){
                DbField.extension.setValue({el: this, type: this._fieldType, elInput: this.elInput, value, defaultExtension: DEFAULT_EXTENSION}) ;
            }
        }
        get required(){
            return this.hasAttribute("required");
        }
        set required(required){
            if(required){
                if(!this.hasAttribute("required")){
                    this.setAttribute("required", "true");
                }
            }else{
                this.removeAttribute("required") ;
            }
            if(this._initDone){
                DbField.extension.setRequired({el: this, elInput: this.elInput, required,  type: this._fieldType, defaultExtension: DEFAULT_EXTENSION}) ;
            }
        }
        get readOnly(){
            return this.hasAttribute("readonly");
        }
        set readOnly(readOnly){
            if(readOnly){
                if(!this.hasAttribute("readonly")){
                    this.setAttribute("readonly", "true");
                }
            }else{
                this.removeAttribute("readonly") ;
            }
            if(this._initDone){
                DbField.extension.setReadOnly({el: this, elInput: this.elInput, readOnly, type: this._fieldType, defaultExtension: DEFAULT_EXTENSION}) ;
            }
        }

        focus(){
            if(this._initDone){
                DbField.extension.focus({el: this, elInput: this.elInput, type: this._fieldType, defaultExtension: DEFAULT_EXTENSION}) ;
            }else{
                this._hasFocus = true
            }
        }

        setCustomValidity(message){
            this._customValidityMessage = message ;
            if(this._initDone){
                DbField.extension.setCustomValidity({el: this, elInput: this.elInput, message, type: this._fieldType, defaultExtension: DEFAULT_EXTENSION}) ;
            }
        }
    
        async init(){
            if(this.initDone){ return; }
            this.initDone = true ;
    
            //console.log("init field", this.getAttribute("db-app"), this.getAttribute("db-schema"), this.getAttribute("db-table"), this.getAttribute("db-column")) ;
            
            //console.log("wait for extension start", waitForExtensionsLoaded) ;
            await loadDbFieldExtensions() ;
            
            //console.log("wait for extension done") ;
    
    
            let type = this.type ;
            let label = this.label;
    
            let schema, table, column;
    
            if(!type){
                if(!this.table){ return ; }
                if(!this.column){ return ; }
        
                this.dbApi = await getGraphqlClient(this.app) ;
    
                schema = this.dbApi.schemas.find(s=>s.schema === (this.schema??"public")) ;
    
                if(!schema){
                    this.innerHTML = `<span style="color: red">Can't find schema ${this.schema}` ;
                    return;
                }
    
                table = schema.tables.find(t=>t.table_name === this.table) ;
                if(!table){
                    this.innerHTML = `<span style="color: red">Can't find table ${this.schema}.${this.table}` ;
                    return;
                }
    
                column = table.columns.find(t=>t.column_name === this.column) ;
                if(!column){
                    this.innerHTML = `<span style="color: red">Can't find column ${this.schema}.${this.table}.${this.column}` ;
                    return;
                }
    
                if(!label){
                    label = await DbField.extension.generateLabelString({schema, table, column, el: this, defaultExtension: DEFAULT_EXTENSION, dbApi: this.dbApi}) ;
                }
                
                if(column.reference){
                    type = "reference" ; 
                } else if(column.data_type === "character varying" || column.data_type === "character" || column.data_type === "text"){
                    type = "text" ;
                } else if(column.data_type === "boolean"){
                    type = "boolean" ;
                } else if(column.data_type === "timestamp without time zone" || column.data_type === "timestamp with time zone" || column.data_type === "timestamp"){
                    type = "datetime" ;
                } else if(column.data_type === "date"){
                    type = "date" ;
                } else if(column.data_type === "smallint" || column.data_type === "integer" || column.data_type === "bigint"){
                    type = "integer" ; 
                } else if(column.data_type === "decimal"  || column.data_type === "numeric" || column.data_type === "real" || column.data_type === "double precision" || column.data_type === "money"){
                    type = "decimal" ; 
                } else{
                    type =column.data_type ; 
                }
            }
            this._fieldType = type;

            if(!column){
                column = this.columnDef ;
            }
    
            let elLabel ;
            if(!this.noLabel){
                elLabel = await DbField.extension.generateLabelElement({label, type, schema, table, column, el: this, defaultExtension: DEFAULT_EXTENSION/*, dbApi: this.dbApi*/}) ;
            }
            const elInput = await DbField.extension.generateInputElement({label, placeholder: this.placeholder, type, schema, table, column, el: this, defaultExtension: DEFAULT_EXTENSION, dbApi: this.dbApi }) ;
            this.elInput = elInput ;
            this.elLabel = elLabel ;
            this.innerHTML = "" ;
            await DbField.extension.appendElements({label, type, schema, table, column, el: this, elLabel, elInput, defaultExtension: DEFAULT_EXTENSION, dbApi: this.dbApi}) ;
    
            for(let postProcess of DbField.extension.postProcesses){
                await postProcess({label, type, schema, column, el: this, elLabel, elInput, defaultExtension: DEFAULT_EXTENSION, dbApi: this.dbApi}) ;
            }
    
            this._initDone = true;
    
            //apply attribute after init
            this.value = this._value ;
            this.required = !!this.required ;
            this.readOnly = !!this.readOnly ;
            if(this._hasFocus){
                this._hasFocus = false ;
                this.focus() ;
            }
        }
    
        static get observedAttributes() {
            return [
                "db-app", "db-schema", "db-table", "db-column", 
                "db-type", "db-label", "db-no-label",
                "value", "required", "readonly", "placeholder",
                "db-column-def"
            ];
        }
        
        attributeChangedCallback(name, oldValue, newValue) {
            switch (name) {
                case "db-app":
                case "db-schema":
                case "db-table": 
                case "db-column": 
                case "db-type": 
                case "db-label": 
                case "db-no-label":
                    if(oldValue !== newValue){
                        //console.log("attr changed", oldValue, newValue) ;
                        if(this._connected){
                            this.init();
                        }
                    }
                break;
                case "value":
                case "placeholder":
                    this[name] = this.getAttribute(name);
                break;
                case "required":
                    this[name] = this.hasAttribute(name);
                break;
                case "readonly":
                    this.readOnly = this.hasAttribute(name);
                    break;
                case "db-column-def":
                    if(this.initDone && this.columnDef !== this.columnDef){
                        this.initDone = false;
                        this.init();
                    }
                break;
    
            }
        }
    }
    customElements.define("db-field", DbField);
    // @ts-ignore
    window.DbField = DbField ;
}

if(!customElements.get("db-value")){

    let numberFormat = new Intl.NumberFormat();
    let decimalFormat = new Intl.NumberFormat(undefined,{ maximumFractionDigits: 30 });
    //let decimalDisplayFormat = new Intl.NumberFormat(undefined,{ minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const DEFAULT_VALUE_EXTENSION_VALUE = {       
        generateValueElement: async function({type, defaultExtension, dbApi}){
            const elValue = document.createElement("SPAN") ;
            elValue.className = "db-value-"+type ;
            return elValue ;
        },

        getSpinner: async function(){
            let head = document.head;
            if(!head.querySelector(`style[data-db-spinner]`)){
                const style = document.createElement("STYLE");
                style.dataset.dbSpinner = "true" ;
                style.innerHTML = `.bamz-db-spinner {
                    width: 1rem;
                    height: 1rem;
                    border: 2px solid #FFF;
                    border-bottom-color: #98989882;
                    border-radius: 50%;
                    display: inline-block;
                    box-sizing: border-box;
                    animation: bamz-spinner-rotation 1s linear infinite;
                    }

                    @keyframes bamz-spinner-rotation {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                } ` ;
                head.appendChild(style);
            }

            const elSpinner = document.createElement("SPAN") ;
            elSpinner.className = "bamz-db-spinner" ;
            return elSpinner ;
        },
              
        appendElements: async function({label, type, schema, table, column, el, elValue, defaultExtension, dbApi}){
            el.appendChild(elValue) ;
        },

        formatValue: async function({type, value, dbApi, schema, column,  defaultExtension}){
            if(type === "uuid"){
                return value??"" ;
            }else if(type.startsWith("timestamp") || type === "datetime"){
                if(!value){ 
                    return "" ; 
                }
                let dt = new Date(value) ;
                return dt.toLocaleDateString() +" "+dt.toLocaleTimeString() ;
            }else if(type.startsWith("date")){
                if(!value){ 
                    return "" ; 
                }
                let dt = new Date(value) ;
                return dt.toLocaleDateString() ;
            }else if(type?.startsWith("time")){
                if(!value){ 
                    return "" ; 
                }
                let dt = new Date(new Date().toISOString().substring(0,10)+"T"+value) ;
                return dt.toLocaleTimeString() ;
            }else if(type === "integer" || type === "smallint" || type === "bigint"){
                return numberFormat.format(value) ;
            }else if(type === "real" || type === "double precision" || type === "numeric" || type === "decimal"){
                return decimalFormat.format(value) ;
            }else if(type === "text" || type === "character varying" || type === "bpchar"){
                return value??"" ;
            }else if(type === "enum"){
                if(column.enum_values){
                    let enumOptions = {
                        type: "select",
                        values: []
                    } ;
                    if(column.type_description){
                        try{
                            let parsedDescription = column.type_description ;
                            if(typeof(parsedDescription) === "string"){
                                parsedDescription = JSON.parse(parsedDescription) ;
                            }
                            if(Array.isArray(parsedDescription)){
                                enumOptions.values = parsedDescription ;
                            }else{
                                enumOptions = parsedDescription
                            }
                        // eslint-disable-next-line no-unused-vars
                        }catch(e){
                            //malformatted JSON
                        }
                    }

                    return enumOptions.values.find(l=>l.value === value)?.label ?? value ;
                }else{
                    return "No enum_values found" ;
                }
            }else if(type.startsWith("json")){
                if(!value){ 
                    return "" ; 
                }
                let jsonStr = JSON.stringify(value) ;
                return jsonStr ;
            }else if(type.startsWith("xml")){
                if(!value){ 
                    return ""; 
                }
                let str = value.replaceAll("<", "&lt;").replaceAll(">", "&gt;") ;
                return str ;
            }else if(type === "boolean"){
                if(value){
                    return "☑";
                }else{
                    return "☐";
                } ;
            }else if(type === "bytea"){
                return "";
            }else if(type === "reference"){
                const referencedTable = schema.tables.find(t=>t.table_name === column.reference.referenced_table);
                const result = await getReferencedRecord({dbApi, column, value}) ;
                const formattedRecord = await formatRecord({table: referencedTable, record: result}) ;
                return formattedRecord ;
            }else{
                return value??"" ;
            }
        },
       
        setValue: function({type, elValue, value, formattedValue, defaultExtension}){
            if(elValue){
                if(type === "bytea"){

                    const button = document.createElement('button');
                    button.type="button" ;
                    button.innerHTML = "download";
                    button.addEventListener("click", ()=>{
                        const resumeData = JSON.parse(value);
                        let resumeByteA = Object.keys(resumeData).map((key) => resumeData[key]);
                        let uint8Array = new Uint8Array(resumeByteA);
                        const blob = new Blob([uint8Array], { type: "application/octet-stream" });
        
                        // Créer une URL pour le Blob
                        const url = window.URL.createObjectURL(blob);
                        
                        // Créer un lien de téléchargement
                        const link = document.createElement('a');
                        link.href = url;
                        //link.download = filename;
                        
                        // Ajouter temporairement le lien au document
                        document.body.appendChild(link);
                        
                        // Déclencher le téléchargement
                        link.click();
                        
                        // Nettoyer
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        
                        return true;
                    }) ;
                    elValue.innerHTML = "" ;
                    elValue.appendChild(button) ;
                }else{
                    elValue.innerText = formattedValue ;
                }
            }
        }, 
    
        postProcesses: [
            async function({label, type, schema, table, column, el, elValue, defaultExtension, dbApi}){
            }
        ]
    }

    let loadingValueExtensions = false ;
    const loadValueExtensions = async function(){
        try{
            if(loadingValueExtensions){
                await new Promise((resolve)=>{ setTimeout(resolve, 100) ; }) ;
                return await loadValueExtensions() ;
            }
            loadingValueExtensions = true ;
            for(let ext of DbValueExtensions.extensions){
                if(ext.isLoaded){ continue ; }
                ext.isLoaded = true ;
                if(ext.url){
                    const impEx = await import(ext.url) ;
                    let extensions = impEx.default ;
                    if(!Array.isArray(extensions)){
                        extensions = [extensions] ;     
                    }
                    for(let ext of extensions){
                        DbValue.loadExtension(ext) ;
                        //console.log("load extension", ext)
                        if(ext.customCss){
                            await loadCss(ext.customCss) ;
                        }
                    }
                }else{
                    DbValue.loadExtension(ext) ;
                    //console.log("load extension", ext)
                    if(ext.customCss){
                        // @ts-ignore
                        await loadCss(ext.customCss) ;
                    }
                }
            }
        }finally{
            loadingValueExtensions = false ;
        }
    }

    class DbValue extends HTMLElement {
        static extension = DEFAULT_VALUE_EXTENSION_VALUE ;
        static loadExtension(extension){
            //console.log("Load db field extension", extension) ;
            let postProcess = extension.postProcess ;
            if(postProcess){
                DbValue.extension.postProcesses.push(postProcess) ;
                delete extension.postProcess ;
            }
            DbValue.extension = {
                ...DbValue.extension,
                ...extension,
                defaultExtension: {
                    ...DbValue.extension
                }
            }
        }

        static CACHE_FORMATTED_VALUES = {} ;

        static async getFormattedValue({type, dbApi, app, schema, table, column, value}){
            await loadValueExtensions() ;
            const cacheKey = JSON.stringify({app, schema: schema.schema_name, table: table.table_name, column: column.column_name, value}) ;
            let cacheEntry = DbValue.CACHE_FORMATTED_VALUES[cacheKey] ;
            if(cacheEntry && cacheEntry.cacheTime > Date.now()-5000){
                //cache is valid (5s)
                if(cacheEntry.formattedValue instanceof Promise){
                    return await cacheEntry.formattedValue ;
                }else{
                    return cacheEntry.formattedValue ;
                }
            }else{
                //not in cache or cache is too old

                //prepare cache entry before starting formatting
                const cachePromise = DbValue.extension.formatValue({type, dbApi, schema, column, value, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE}) ; 
                cacheEntry = {
                    formattedValue: cachePromise, //formatted is a promise, subsequent call will wait for it
                    cacheTime: Date.now()
                } ;
                DbValue.CACHE_FORMATTED_VALUES[cacheKey] = cacheEntry ;

                //wait formatting is finished
                const formattedValue = await cachePromise ;

                //update the cache entry with the formatted value
                cacheEntry.formattedValue = formattedValue ;

                return formattedValue ;
            }
        }

        static async renderDbValue({app, schema, table, column, value, elValue}){
            try{
                await loadValueExtensions() ;
                const dbApi = await getGraphqlClient(app) ;
    
                const schemaObj = dbApi.schemas.find(s=>s.schema === (schema??"public")) ;

                if(!schemaObj){
                    throw `Can't find schema ${schema}` ;
                }

                const tableObj = schemaObj.tables.find(t=>t.table_name === table) ;        
                if(!tableObj){
                    throw `Can't find table ${schema}.${table}` ;
                }

                const columnObj = tableObj.columns.find(t=>t.column_name === column) ;
                if(!columnObj){
                    throw `Can't find column ${schema}.${table}.${column}` ;
                }
                
                let type = await DbValue.computeType({column: columnObj}) ;
                if(!type){
                    throw "Can't determine type of "+JSON.stringify({app, schema, table, column}) ;
                }

                
                if(!elValue){
                    elValue = await DbValue.extension.generateValueElement({type, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE, dbApi }) ;
                }
                elValue.innerHTML = "" ;
                elValue.appendChild(await DbValue.extension.getSpinner()) ;

                const formattedValue = await DbValue.getFormattedValue({type, dbApi, app, schema: schemaObj, table: tableObj, column: columnObj, value}) ;

                DbValue.extension.setValue({type, elValue: elValue, value, formattedValue, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE}) ;
            }catch(err){
                console.error("Error rendering db value", {app, schema, table, column, value, elValue}, err) ;
                if(!elValue){
                    elValue = document.createElement("SPAN") ;
                }
                elValue.innerHTML = `<span style="color: red">Error: ${err}</span>` ;
            }
            return elValue ;
        }

        static async computeType({column}){
            let type;

            if(column.data_type === "character varying" || column.data_type === "character" || column.data_type === "text"){
                type = "text" ;
            } else if(column.data_type === "boolean"){
                type = "boolean" ;
            } else if(column.data_type === "timestamp without time zone" || column.data_type === "timestamp with time zone" || column.data_type === "timestamp"){
                type = "datetime" ;
            } else if(column.data_type === "date"){
                type = "date" ;
            } else if(column.data_type === "smallint" || column.data_type === "integer" || column.data_type === "bigint"){
                type = "integer" ; 
            } else if(column.data_type === "decimal"  || column.data_type === "numeric" || column.data_type === "real" || column.data_type === "double precision" || column.data_type === "money"){
                type = "decimal" ; 
            } else if(column.reference){
                type = "reference" ; 
            } else{
                type = column.data_type ;
            }
            return type;


        }
    

        constructor() {
            super();
            this._value = this.getAttribute("value");
            this._initDone = false;
            this._connected = false;
            this.label = null ;
        }
        
        connectedCallback() {
            this._connected = true;
            //console.log("Custom element added to page.");
            this.init() ;
        }
    
        get app(){
            return this.getAttribute("db-app");
        }
        set app(app){
            this.setAttribute("db-app", app);
        }
        get schema(){
            return this.getAttribute("db-schema");
        }
        set schema(schema){
            this.setAttribute("db-schema", schema);
        }
        get table(){
            return this.getAttribute("db-table");
        }
        set table(table){
            this.setAttribute("db-table", table);
        }
        get column(){
            return this.getAttribute("db-column");
        }
        set column(column){
            this.setAttribute("db-column", column);
        }
        get type(){
            return this.getAttribute("db-type");
        }
        set type(type){
            this.setAttribute("db-type", type);
        }
        
        get value(){
            return this._value ;
        }
        set value(value){
            this._value = value ;
            if(this._initDone){
                let formattedValue = DbValue.extension.formatValue({
                    dbApi: this.dbApi, schema: this._schema, column: this._column,
                    type: this._fieldType, value, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE}) ;
                if(formattedValue instanceof Promise){
                    formattedValue.then(formattedValue=>{
                        DbValue.extension.setValue({type: this._fieldType, elValue: this.elValue, value, formattedValue, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE}) ;
                    }) ;
                }else{
                    DbValue.extension.setValue({type: this._fieldType, elValue: this.elValue, value, formattedValue, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE}) ;
                }
            }
        }

        
    
        async init(){

            await loadValueExtensions() ;
    
            let type = this.type ;
            let label = this.label;
    
            let schema, table, column;
    
            if(!type){
                if(!this.table){ return ; }
                if(!this.column){ return ; }
        
                this.dbApi = await getGraphqlClient(this.app) ;
    
                schema = this.dbApi.schemas.find(s=>s.schema === (this.schema??"public")) ;
    
                if(!schema){
                    this.innerHTML = `<span style="color: red">Can't find schema ${this.schema}` ;
                    return;
                }
    
                table = schema.tables.find(t=>t.table_name === this.table) ;        
                if(!table){
                    this.innerHTML = `<span style="color: red">Can't find table ${this.schema}.${this.table}` ;
                    return;
                }

                column = table.columns.find(t=>t.column_name === this.column) ;
                if(!column){
                    this.innerHTML = `<span style="color: red">Can't find column ${this.schema}.${this.table}.${this.column}` ;
                    return;
                }

                type = await DbValue.computeType({column}) ;
            }
            this._fieldType = type;
            this._schema = schema ;
            this._column = column ;
            this._table = table ;
    
            
            const elValue = await DbValue.extension.generateValueElement({type, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE, dbApi: this.dbApi }) ;
            this.elValue = elValue ;
            this.innerHTML = "" ;
            await DbValue.extension.appendElements({label, type, schema, table, column, el: this, elValue: elValue, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE, dbApi: this.dbApi}) ;
    
            for(let postProcess of DbValue.extension.postProcesses){
                await postProcess({label, type, schema, table, column, el: this, elValue, defaultExtension: DEFAULT_VALUE_EXTENSION_VALUE, dbApi: this.dbApi}) ;
            }
    
            this._initDone = true;
    
            this.value = this._value ;

        }
        static get observedAttributes() {
            return [
                "db-app", "db-schema", "db-table", "db-column", 
                "db-type", "value"
            ];
        }
        
        attributeChangedCallback(name, oldValue, newValue) {
            switch (name) {
                case "db-app":
                case "db-schema":
                case "db-table": 
                case "db-column": 
                case "db-type": 
                    if(oldValue !== newValue){
                        //console.log("attr changed", oldValue, newValue) ;
                        if(this._connected){
                            this.init();
                        }
                    }
                break;
                case "value":
                this.value = this.getAttribute("value");
                break;
    
            }
        }
    }
    customElements.define("db-value", DbValue);
    // @ts-ignore
    window.DbValue = DbValue ;
}
