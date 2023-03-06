import { PageWithAuthor } from "./step03-enrich-author";
import { api, logger } from "../../config";
import { step05LoadTables } from "./step05-load-tables";
import { BlockObjectResponse, TableBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { fmtCallout, fmtCode, fmtHeader, fmtParagraph, fmtQuote, fmtRichTextItems, fmtVideo } from "../../utils/fmt";

export type Block = string | TableBlockObjectResponse | BlockObjectResponse;
export type FullPage = PageWithAuthor & { blocks: Array<any> };

export async function step04LoadBlocks(page: PageWithAuthor) {
    const blocks: Array<Block> = [];
    let cursor: string = undefined;
    let more: boolean = true;
    const limit = 100;
    const format = true;
    
    while (more) {
        logger.info("loading blocks", { pageId: page.id, cursor, limit, step: 4 });
        
        const res = await api.blocks.children.list({ block_id: page.id, page_size: limit, start_cursor: cursor });
        
        blocks.push(
            ...res.results.map(
                (block: BlockObjectResponse) => {
                    if (!format) {
                        return block;
                    }
                    
                    switch (block.type) {
                        case "paragraph":
                            return "\n" + fmtParagraph(block.paragraph) + "\n";
                        
                        case "quote":
                            return fmtQuote(block.quote) + "\n";
                        
                        case "bulleted_list_item":
                            return fmtRichTextItems(block.bulleted_list_item.rich_text, false).join("\n");
                        
                        case "numbered_list_item":
                            return fmtRichTextItems(block.numbered_list_item.rich_text, true).join("\n");
                        
                        case "table":
                            return block as TableBlockObjectResponse;
                        
                        case "divider":
                            return "---" + "\n";
                        
                        case "heading_1":
                            return fmtHeader(block.heading_1.rich_text, "# ") + "\n";
                        
                        case "heading_2":
                            return fmtHeader(block.heading_2.rich_text, "## ") + "\n";
                        
                        case "heading_3":
                            return fmtHeader(block.heading_3.rich_text, "### ") + "\n";
                        
                        case "video":
                            return fmtVideo(block) + "\n";
                        
                        case "code":
                            return fmtCode(block) + "\n";
                        
                        case "callout":
                            return fmtCallout(block) + "\n";
                        
                        default:
                            logger.error("unsupported block type", { type: block.type, block });
                            
                            throw new Error("unsupported block type: " + block.type);
                    }
                }),
        );
        more = res.has_more;
        cursor = res.next_cursor;
    }
    
    await step05LoadTables({ ...page, blocks });
}
