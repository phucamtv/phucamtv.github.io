import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { api, config, logger } from "../../config";
import { step02_FormatPage } from "./step02-format-page";

type DBOptions = Parameters<typeof api.databases.query>[0];

const getDBOptions = (cursor: string): DBOptions => ({
    database_id: config.db.clip,
    filter: {
        or: [
            {
                property: "title",
                title: { is_not_empty: true },
            },
        ],
    },
    sorts: [],
    page_size: 3,
    start_cursor: cursor,
} as DBOptions);

export async function step01QueryDatabase() {
    let cursor: string = undefined;
    let more: boolean = true;
    
    while (more) {
        logger.info("query database", { step: 1, cursor });
        
        const res = await api.databases.query(getDBOptions(cursor));
        
        for (const i in res.results) {
            await step02_FormatPage(res.results[i] as PageObjectResponse);
        }
        
        more = res.has_more;
        cursor = res.next_cursor;
        
        // logger.info("[ DEBUG ]", { step: 1, results: res.results });
        // break; // DEBUG
    }
}
