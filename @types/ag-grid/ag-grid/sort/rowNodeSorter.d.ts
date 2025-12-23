import type { NamedBean } from '../context/bean';
import { BeanStub } from '../context/beanStub';
import type { RowNode } from '../entities/rowNode';
import type { SortOption } from '../interfaces/iSortOption';
export interface SortedRowNode {
    currentPos: number;
    rowNode: RowNode;
}
export declare class RowNodeSorter extends BeanStub implements NamedBean {
    beanName: "rowNodeSorter";
    private isAccentedSort;
    private primaryColumnsSortGroups;
    private firstLeaf;
    postConstruct(): void;
    doFullSort(rowNodes: RowNode[], sortOptions: SortOption[]): RowNode[];
    compareRowNodes(sortOptions: SortOption[], sortedNodeA: SortedRowNode, sortedNodeB: SortedRowNode): number;
    /**
     * if user defines a comparator as a function then use that.
     * if user defines a dictionary of comparators, then use the one matching the sort type.
     * if no comparator provided, or no matching comparator found in dictionary, then return undefined.
     *
     * grid checks later if undefined is returned here and falls back to a default comparator corresponding to sort type on the coldef.
     * @private
     */
    private getComparator;
    private getComparatorFromColDef;
    private getValue;
    private getGroupDataValue;
}
