import {
    BlockObjectResponse,
    PageObjectResponse,
    TableRowBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

function never() {
    throw new Error;
}

function returnTitle() {
    const prop = ({} as PageObjectResponse).properties["key"];
    
    if (prop.type == "title") {
        return prop;
    }
    
    never();
}

function returnFiles() {
    const prop = ({} as PageObjectResponse).properties["key"];
    
    if (prop.type == "files") {
        return prop;
    }
    
    never();
}

function returnRichText() {
    const prop = ({} as PageObjectResponse).properties["key"];
    
    if (prop.type == "rich_text") {
        return prop;
    }
    
    never();
}

function returnEmail() {
    const prop = ({} as PageObjectResponse).properties["key"];
    
    if (prop.type == "email") {
        return prop;
    }
    
    never();
}


function returnSelect() {
    const prop = ({} as PageObjectResponse).properties["key"];
    
    if (prop.type == "select") {
        return prop;
    }
    
    never();
}

function returnParagraph() {
    const obj = ({} as BlockObjectResponse);
    
    if (obj.type == "paragraph") {
        return obj.paragraph;
    }
    
    never();
}

function returnQuote() {
    const obj = ({} as BlockObjectResponse);
    
    if (obj.type == "quote") {
        return obj.quote;
    }
    
    never();
}

// {
//         "id": "%3D%3DRx",
//         "type": "files",
//         "files": [{
//             "name": "msTung.jpg",
//             "type": "file",
//             "file": {
//                 "url": "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/68d8c974-4e8e-4289-a9d0-b0bad24906d7/msTung.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAT73L2G45EIPT3X45%2F20230306%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20230306T003512Z&X-Amz-Expires=3600&X-Amz-Signature=fc4ff66a096ea9d53cdf16a8426183917effe8e607d9c2eebfb3e7f511974e52&X-Amz-SignedHeaders=host&x-id=GetObject",
//                 "expiry_time": "2023-03-06T01:35:12.782Z",
//             },
//         }],
//     }
export type FieldFiles = ReturnType<typeof returnFiles>;

// {
//         "id": "title",
//         "type": "title",
//         "title": [{
//             "type": "text",
//             "text": { "content": "Mục Sư Dương Quốc Tùng", "link": null },
//             "annotations": {
//                 "bold": false,
//                 "italic": false,
//                 "strikethrough": false,
//                 "underline": false,
//                 "code": false,
//                 "color": "default",
//             },
//             "plain_text": "Mục Sư Dương Quốc Tùng",
//             "href": null,
//         }],
//     }
export type FieldTitle = ReturnType<typeof returnTitle>;

// { "id": "I%7B%5Ev", "type": "rich_text", "rich_text": [] }
export type FieldRichText = ReturnType<typeof returnRichText>;

// { "id": "%7BYpj", "type": "email", "email": null }
export type FieldEmail = ReturnType<typeof returnEmail>;

// { "id": "YkmF", "type": "select", "select": { "id": "yK]B", "name": "Hoa Kỳ", "color": "purple" } }
export type FieldSelect = ReturnType<typeof returnSelect>;
export type FieldParagraph = ReturnType<typeof returnParagraph>;
export type FieldQuote = ReturnType<typeof returnQuote>;
