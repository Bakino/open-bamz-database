import type { BaseCssChangeKeys, CssVariable } from './agStack/core/baseEnvironment';
import { BaseEnvironment } from './agStack/core/baseEnvironment';
import type { Theme } from './agStack/theming/theme';
import type { ThemeImpl } from './agStack/theming/themeImpl';
import type { NamedBean } from './context/bean';
import type { BeanCollection } from './context/context';
import type { AgEventTypeParams } from './events';
import type { GridOptionsWithDefaults } from './gridOptionsDefault';
import type { GridOptionsService } from './gridOptionsService';
import type { AgGridCommon } from './interfaces/iCommon';
import type { Module } from './interfaces/iModule';
export declare function _addAdditionalCss(cssMap: Map<string, string[]>, modules: Module[]): void;
export declare class Environment extends BaseEnvironment<BeanCollection, GridOptionsWithDefaults, AgEventTypeParams, AgGridCommon<any, any>, GridOptionsService, CssChangeKeys> implements NamedBean {
    protected initVariables(): void;
    getPinnedRowBorderWidth(): number;
    getRowBorderWidth(): number;
    getDefaultRowHeight(): number;
    getDefaultHeaderHeight(): number;
    getDefaultCellHorizontalPadding(): number;
    private getCellPaddingLeft;
    getCellPadding(): number;
    getDefaultColumnMinWidth(): number;
    refreshRowHeightVariable(): number;
    protected fireStylesChangedEvent(change: keyof CssChangeKeys): void;
    private refreshRowBorderWidthVariable;
    protected postProcessThemeChange(newGridTheme: ThemeImpl | undefined, themeGridOption?: Theme | 'legacy'): void;
    protected getAdditionalCss(): Map<string, string[]>;
    protected getDefaultTheme(): Theme;
    protected varError(variable: CssVariable<CssChangeKeys>): void;
    protected themeError(theme: Theme | 'legacy'): void;
    protected shadowRootError(): void;
}
interface CssChangeKeys extends BaseCssChangeKeys {
    headerHeightChanged: true;
    rowHeightChanged: true;
    rowBorderWidthChanged: true;
    pinnedRowBorderWidthChanged: true;
    cellHorizontalPaddingChanged: true;
    indentationLevelChanged: true;
    rowGroupIndentSizeChanged: true;
}
export {};
