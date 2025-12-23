import * as AgGrid from "./ag-grid/main";

declare global {
    const agGrid: typeof AgGrid;
    const agGridBamzComponents: any;
}
