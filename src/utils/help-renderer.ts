import type { Renderers } from 'cleye';

/**
 * Flag categories for grouped help display
 */
const FLAG_GROUPS: Record<string, string[]> = {
    'Message Options': ['locale', 'generate', 'type', 'prompt', 'include-body'],
    Behavior: ['all', 'confirm', 'auto-select', 'edit', 'clipboard', 'dry-run', 'output'],
    'VCS Selection': ['git', 'yadm', 'jj', 'jj-auto-new'],
    'Hook Integration': ['hook-mode', 'pre-commit', 'watch-commit'],
    Formatting: ['disable-lowercase', 'exclude'],
    Debug: ['verbose'],
};

/**
 * cleye internal types for help rendering (not exported by cleye)
 */
interface FlagCellData {
    name: string;
    flag?: unknown;
}

interface FlagCell {
    type: string;
    data: FlagCellData;
}

interface TableBodyData {
    tableData: unknown[][];
    tableOptions?: unknown;
    tableBreakpoints?: unknown;
}

interface SectionBody {
    type: string;
    data: TableBodyData;
}

interface SectionData {
    title: string;
    body?: SectionBody;
}

interface HelpNode {
    type: string;
    data?: SectionData;
}

/**
 * Type guard for flag cell structure
 */
const isFlagCell = (cell: unknown): cell is FlagCell => {
    if (!cell || typeof cell !== 'object') {
        return false;
    }
    const candidate = cell as FlagCell;
    return candidate.data?.name !== undefined && typeof candidate.data.name === 'string';
};

/**
 * Extract flag name from table cell
 */
const extractFlagName = (cell: unknown): string | null => {
    if (isFlagCell(cell)) {
        return cell.data.name;
    }
    return null;
};

/**
 * Find which group a flag belongs to
 */
const findFlagGroup = (flagName: string): string | null => {
    for (const [group, flags] of Object.entries(FLAG_GROUPS)) {
        if (flags.includes(flagName)) {
            return group;
        }
    }
    return null;
};

/**
 * Check if a node is a flags section
 */
const isFlagsSection = (node: HelpNode): boolean => {
    return node.type === 'section' && node.data?.title === 'Flags:';
};

/**
 * Check if node has valid table data
 */
const hasTableData = (node: HelpNode): node is HelpNode & { data: { body: SectionBody } } => {
    return node.data?.body?.data?.tableData !== undefined;
};

/**
 * Parse table data to extract flag information by group
 */
const parseTableData = (tableData: unknown[][]): Map<string, unknown[][]> => {
    const groupedFlags = new Map<string, unknown[][]>();

    // Initialize groups
    for (const group of Object.keys(FLAG_GROUPS)) {
        groupedFlags.set(group, []);
    }
    groupedFlags.set('Other', []);

    if (!Array.isArray(tableData)) {
        return groupedFlags;
    }

    for (const row of tableData) {
        if (!Array.isArray(row)) {
            continue;
        }

        const flagName = extractFlagName(row[0]);
        const group = flagName ? findFlagGroup(flagName) || 'Other' : 'Other';
        groupedFlags.get(group)?.push(row);
    }

    return groupedFlags;
};

/**
 * Create a section node for a flag group
 */
const createGroupSection = (
    groupName: string,
    flags: unknown[][],
    tableOptions: unknown,
    tableBreakpoints: unknown,
    isFirst: boolean
): HelpNode => ({
    type: 'section',
    data: {
        title: isFirst ? `Flags - ${groupName}:` : `  ${groupName}:`,
        body: {
            type: 'table',
            data: { tableData: flags, tableOptions, tableBreakpoints },
        },
    },
});

/**
 * Custom help renderer that groups flags by category
 */
export const renderGroupedHelp = (nodes: HelpNode[], renderers: Renderers): string => {
    const processedNodes: HelpNode[] = [];

    for (const node of nodes) {
        // Pass through non-flag sections
        if (!isFlagsSection(node) || !hasTableData(node)) {
            processedNodes.push(node);
            continue;
        }

        const { tableData, tableOptions, tableBreakpoints } = node.data.body.data;
        const groupedFlags = parseTableData(tableData);

        // Add grouped sections
        const nonEmptyGroups = [...groupedFlags.entries()].filter(([, flags]) => flags.length > 0);

        nonEmptyGroups.forEach(([groupName, flags], index) => {
            processedNodes.push(createGroupSection(groupName, flags, tableOptions, tableBreakpoints, index === 0));
        });
    }

    return renderers.render(processedNodes);
};
