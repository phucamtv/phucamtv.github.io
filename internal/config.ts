import { Client } from "@notionhq/client";
import { Logger, ILogObj } from "tslog";

export const config = {
    auth: process.env.NOTION_TOKEN,
    db: {
        author: "687255b4186a4ad3a3a37af130421c23",
        clip: "106750c5ff1b48349240c2e2dba4b62d",
    },
};

export const api = new Client({ auth: config.auth, fetch: fetch });
export const baseDir = __dirname + "/../";
export const logger: Logger<ILogObj> = new Logger();
