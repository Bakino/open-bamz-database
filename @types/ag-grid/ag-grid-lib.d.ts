import * as AgGrid from "./ag-grid/main";

export const agGrid: typeof AgGrid;
export const agGridBamzComponents: any;
declare global {
  class AgColumnElement extends HTMLElement {
    html: string;
    constructor();
  }

  class AgMobileRender extends HTMLElement {
    html: string;
    constructor();
    get height(): number;
    set height(h: number);
  }

  class AgDefaultColumnElement extends HTMLElement {
    html: string;
    constructor();
  }

  class AgGridElement extends HTMLElement {
    static defaultOptions: any;
    grid: any;
    _mobileDisplay?: boolean;
    _rowData?: any;
    constructor();
    connectedCallback(): void;
    init(): Promise<void>;
    get mobileDisplay(): boolean;
    set mobileDisplay(val: boolean);
    get rowData(): any;
    set rowData(data: any);
    getGrid(): Promise<any>;

    addEventListener<TEventType extends AgGrid.AgPublicEventType>(eventType: TEventType, listener: AgGrid.AgEventListener<AgGrid.TextDataTypeDefinition, any, TEventType>): void;
    
    removeEventListener(name: string, callback: any): void;
    updateOption(attrName: string): void;
    static get observedAttributes(): string[];
    attributeChangedCallback(name: string, oldValue?: any, newValue?: any): void;
  }


  interface HTMLElementTagNameMap {
    'ag-column': AgColumnElement;
    'ag-mobile-render': AgMobileRender;
    'ag-default-column': AgDefaultColumnElement;
    'ag-grid': AgGridElement;
  }
}

