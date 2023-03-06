import { FullPage } from "./step04-load-blocks";
import { api, logger } from "../../config";
import { TableBlockObjectResponse, TableRowBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { step06Cache } from "./step06-cache";
import { fmtTable } from "../../utils/fmt";

async function loadTable(key: string, block: TableBlockObjectResponse) {
    const res = await api.blocks.children.list({ block_id: block.id });
    const rows = res.results.map((row: TableRowBlockObjectResponse) => row.table_row);
    
    return {
        key,
        table: block.table,
        rows,
    };
}

export type Table = Awaited<ReturnType<typeof loadTable>>;

export async function step05LoadTables(page: FullPage) {
    logger.info("cache page", { step: 5, id: page.id, blocks: page.blocks.length });
    
    const wg: Array<Promise<Table>> = [];
    for (const key in page.blocks) {
        const block: string | TableBlockObjectResponse | Table = page.blocks[key];
        
        if (typeof block != "string") {
            wg.push(loadTable(key, block as TableBlockObjectResponse));
        }
    }
    
    const tables = await Promise.all(wg);
    tables.map(table => page.blocks[table.key] = fmtTable(table));
    
    await step06Cache(page);
}
