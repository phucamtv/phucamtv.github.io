// @ts-ignore
import {
    CalloutBlockObjectResponse,
    CodeBlockObjectResponse,
    RichTextItemResponse,
    VideoBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { FieldParagraph, FieldQuote } from "./fields";
import { Table } from "../usecases/build/step05-load-tables";

export function fmtTable(e: Table) {
    const out: Array<string> = [];
    
    for (const i in e.rows) {
        const row = e.rows[i];
        
        if (i == "0") {
            if (e.table.has_row_header) {
                const line: Array<string> = [];
                for (let w = 0; w < e.table.table_width; w++) {
                    line.push("-------");
                }
                
                out.push("| " + line.join(" | ") + " |");
            }
        }
        
        const rowOut = row.cells.map(cell => fmtRichTextItems(cell, null).join("\n"));
        
        out.push("| " + rowOut.join(" | ") + " |");
    }
    
    return out.join("\n");
}

export function fmtVideo(e: VideoBlockObjectResponse) {
    if (e.video.type == "external") {
        return e.video.external.url;
    }
    
    return JSON.stringify(e);
}

export function fmtCode(e: CodeBlockObjectResponse) {
    const code = e.code.rich_text.map(item => item.plain_text).join("\n");
    
    return "```\n" + code + "\n```";
}

export function fmtCallout(e: CalloutBlockObjectResponse) {
    const out = [];
    
    out.push("{% callout %}");
    out.push(fmtRichTextItems(e.callout.rich_text, null).join("\n\t"));
    out.push("{% endcallout %}");
    
    return out.join("\n");
}

export function fmtHeader(e: RichTextItemResponse[], prefix: string) {
    return e
        .map((item, i) => prefix + fmtRichTextItem(item, i, null))
        .join("\n");
}

export function fmtParagraph(p: FieldParagraph) {
    return p.rich_text
        .map((item, i) => fmtRichTextItem(item, i, null))
        .join(" ");
}

export function fmtQuote(e: FieldQuote) {
    return e
        .rich_text
        .map((item, i) => "> " + fmtRichTextItem(item, i, null))
        .join("\n");
}

export function fmtRichTextItem(item: RichTextItemResponse, i: number, numberList = false): string {
    const starting = (numberList === null) ? "" : (numberList ? (i + 1).toString() + ". " : "- ");
    let prefix = "";
    let suffix = "";
    
    if (item.annotations.code) {
        prefix += "`";
        suffix += "`";
    }
    
    if (item.annotations.bold) {
        prefix = suffix = "**";
    }
    
    if (item.annotations.italic) {
        prefix += "*";
        suffix += "*";
    }
    
    if (item.annotations.strikethrough) {
        prefix += "~~";
        suffix += "~~";
    }
    
    if (item.annotations.underline) {
        prefix += "<u>";
        suffix += "</u>";
    }
    
    return starting + prefix + fmtText(item.plain_text) + suffix;
}

function fmtText(text: string) {
    // TODO: Move this to config
    return text.replace("Jesus", "Giê-xu");
}

export function fmtRichTextItems(items: Array<RichTextItemResponse>, numberList = false): Array<string> {
    return items.map((item, i) => fmtRichTextItem(item, i, numberList));
}
