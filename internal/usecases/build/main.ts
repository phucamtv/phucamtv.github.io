import { step01QueryDatabase } from "./step01-query";

async function main() {
    await step01QueryDatabase();
    
    //          -> render page
    //              -> render video
    //              -> render text
    //              -> more cases
    
    // store author pictures, if not available locally.
    // fetch blocks
    // TODO: store page icons
    // filter(value => value != null),
}

main().catch(err => console.log);
