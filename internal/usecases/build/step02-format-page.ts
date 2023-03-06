import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { step03EnrichAuthor } from "./step03-enrich-author";
import { logger } from "../../config";

export type Page = {
    id: string,
    title: string,
    tags: Array<string>,
    authors: Array<string>,
    date: any,
    permalink: Array<string>,
    // embedded: {
    //     object: PageObjectResponse
    // }
}

export async function step02_FormatPage(node: PageObjectResponse) {
    const page: Page = {
        id: node.id,
        title: node.properties.Name["title"][0].plain_text,
        tags: node.properties.Tags["multi_select"].map(node => node.name),
        authors: node.properties.Author["relation"].map(node => node.id),
        date: !node.properties.Date["date"] ? null : node.properties.Date["date"],
        permalink: !node.properties.Permalink["rich_text"] ? null : node.properties.Permalink["rich_text"][0]["plain_text"],
    };
    
    while (true) {
        try {
            logger.info("Format page", { step: 2, pageId: page.id });
            
            await step03EnrichAuthor(page);
            break;
        } catch (err) {
            logger.error("failed to step03EnrichAuthor", { err });
            
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
