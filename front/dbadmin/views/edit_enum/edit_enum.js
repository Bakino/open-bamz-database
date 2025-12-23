/* Javascript */

view.loader = async ()=>{
    let column = view.route.params.column ;
    if(!column.enumOptions){
        column.enumOptions = {
            type: "select",
            values: []
        }
    }
    return {column}
}

view.validate = ()=>{
    if(bootstrap.validateForm(/** @type HTMLFormElement */(view.querySelector("form")))){
        view.closePopup(view.data.column.enumOptions) ;
    } 
}

view.removeLine = (entry)=>{
    view.data.column.enumOptions.values.splice(view.data.column.enumOptions.values.indexOf(entry), 1) ;
}