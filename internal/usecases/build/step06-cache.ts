import * as fs from "fs";
import { FullPage } from "./step04-load-blocks";
import { baseDir, logger } from "../../config";

// ---
// author: Mục Sư Đặng Thanh Phong
// ---
//
// https://www.youtube.com/watch?v=cAf7kavInnc

export async function step06Cache(page: FullPage) {
    const dir = baseDir + "resources/pages";
    const out: Array<string> = [];
    
    logger.info("render content", { step: 6, dir });
    
    out.push("---");
    out.push(`title: '${page.title.replaceAll("'", "\\'")}'`);
    out.push(`author: [ ${page.authors.map(item => "'" + item.name + "'").join(", ")} ]`);
    
    // author:
    //   name: "Mục Sư Quách Trọng Toàn"
    //   email: "loihangsongsda@gmail.com"
    //   phone: "(408) -287-2286"
    //   website: <a href="https://loihangsong.us/">loihangsong.us</a>
    //   facebook: loihangsongsda
    
    if (page.date) {
        out.push(`date: ${page.date.start}`);
    }
    
    if (page.tags) {
        out.push("tags: [" + page.tags.map(tag => `"${tag}"`).join(", ") + "]");
    }
    
    if (page.permalink.length) {
        out.push(`permalink: ${page.permalink}`);
    }
    
    out.push("---\n");
    out.push(...page.blocks);
    
    fs.writeFileSync(
        `${dir}/${page.id}.md`,
        out.join("\n").replaceAll("\n\n\n", "\n\n"),
    );
}
