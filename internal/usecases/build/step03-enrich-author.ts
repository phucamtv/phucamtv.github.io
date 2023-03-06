import { Page } from "./step02-format-page";
import { api, logger } from "../../config";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { FieldEmail, FieldFiles, FieldRichText, FieldSelect, FieldTitle } from "../../utils/fields";
import { step04LoadBlocks } from "./step04-load-blocks";

async function loadAuthor(authorId: string) {
    const node = await api.pages.retrieve({ page_id: authorId }) as PageObjectResponse;
    const avatar: FieldFiles = node.properties["Avatar"] as FieldFiles;
    const title: FieldTitle = node.properties["Name"] as FieldTitle;
    const phoneNumber: FieldRichText = node.properties["Phone Number"] as FieldRichText;
    const email: FieldEmail = node.properties["Email"] as FieldEmail;
    const country: FieldSelect = node.properties["Country"] as FieldSelect;
    
    return {
        id: node.id,
        name: title.title[0].plain_text,
        avatar: avatar.files.length > 0 ? avatar.files[0] : null,
        phoneNumber: phoneNumber.rich_text.length > 0 ? phoneNumber.rich_text[0] : null,
        email: email.email,
        country: country.select ? country.select.name : null,
    };
}

type AwaitAuthor = ReturnType<typeof loadAuthor>;
type Author = Awaited<AwaitAuthor>;
export type PageWithAuthor = Omit<Page, "authors"> & { authors: Array<Author> }

export async function step03EnrichAuthor(page: Page) {
    const awaitAuthors: Array<Promise<Author>> = [];
    
    // load authors
    for (const i in page.authors) {
        logger.info("loading author", { pageId: page.id, authorId: page.authors[i], step: 3 });
        
        const authorId = page.authors[i];
        const author = loadAuthor(authorId);
        awaitAuthors.push(author);
    }
    
    // wait
    const authors = await Promise.all(awaitAuthors);
    
    // run next step
    await step04LoadBlocks({ ...page, authors });
}
