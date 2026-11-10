import type { Legal } from "./types";

/** English: faithful translation of the approved Portuguese text. Provisional until the João Victor approves it. */
export const en: Legal = {
  status: "provisional",
  back: "Back to home",
  provisionalNotice: "Provisional text: this page will be replaced by the approved version before the site is published.",
  privacy: {
    title: "Privacy policy",
    metaTitle: "Privacy policy · Dynamo",
    paragraphs: [
      "Dynamo processes the data you send through the contact form (name, email, phone and message) only to respond to your request.",
      "You may request the deletion of your data at any time by writing to the site's contact email.",
    ],
  },
  terms: {
    title: "Terms of use",
    metaTitle: "Terms of use · Dynamo",
    paragraphs: [
      "This site presents the services of Dynamo, a digital marketing agency using artificial intelligence and automation.",
      "The content is for information only and may be updated without prior notice.",
    ],
  },
};
