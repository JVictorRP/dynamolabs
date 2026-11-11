import type { Copy } from "./types";

/**
 * English (American). Approved by João Victor on 2026-11-11 (`status: "final"`): the language is published in production.
 * Set it back to "provisional" to take the language off the air again (it then only exists in `next dev` and in the e2e build).
 */
export const en: Copy = {
  status: "final",
  meta: {
    title: "Dynamo | Digital marketing with AI and automation",
    description: "Digital marketing agency with AI and automation: paid traffic, creative, websites and systems, with the quality and momentum of artificial intelligence.",
  },
  skip: "Skip to content",
  langLabel: "Language",
  aria: { mainNav: "Main", footerNav: "Footer", home: "Dynamo, home" },
  nav: {
    links: [
      { href: "#chatbot", label: "Chatbot" },
      { href: "#contato", label: "Contact" },
    ],
    cta: { href: "#contato", label: "Talk to us" },
  },
  hero: {
    eyebrow: "MARKETING WITH AI AND AUTOMATION",
    support: "the agency that thinks fast",
    title: "YOUR BRAND\nIN MOTION",
    keyword: "MOTION",
    cue: "SCROLL TO EXPLORE",
    deco: ["AUTOMATION, NON-STOP", "CREATIVE AT SCALE"],
  },
  s2: {
    eyebrow: "TRAFFIC, CREATIVE AND SYSTEMS",
    title: "AI DOES\nTHE HEAVY\nLIFTING",
    keyword: "HEAVY",
    body: "Human strategy, execution accelerated by artificial intelligence.",
    deco: ["DATA, NOT GUESSWORK"],
  },
  chat: {
    eyebrow: "AI-POWERED CUSTOMER SERVICE",
    title: "ANSWERS IN\nSECONDS, DAY\nAND NIGHT",
    body: "Your customer writes at 10 PM. The assistant replies, qualifies and books, with no queue and no wait.",
    watermark: "24H",
    assistant: { name: "Dynamo Assistant", status: "online now" },
    messages: [
      { from: "user", at: 0.28, time: "10:14 PM", text: "Hi! Do you have an opening on Thursday?" },
      { from: "bot", at: 0.4, time: "10:14 PM", text: "Hi there! This is Dynamo's assistant. We have Thursday at 10 AM and 3 PM. Which do you prefer?" },
      { from: "user", at: 0.54, time: "10:15 PM", text: "3 PM, please." },
      { from: "bot", at: 0.66, time: "10:15 PM", text: "Booked! Thursday, 3 PM. I'll send the confirmation right here." },
      { from: "user", at: 0.8, time: "10:16 PM", text: "Perfect, thanks!" },
    ],
    cards: [
      { label: "NEW LEAD", detail: "Customer, 10:14 PM", at: 0.28 },
      { label: "BOOKED", detail: "Thursday, 3 PM", at: 0.66 },
    ],
  },
  video2: {
    eyebrow: "THE MESSAGE ARRIVED",
    title: "YOUR NEXT\nCLIENT HAS\nARRIVED",
    keyword: "ARRIVED",
    support: "Whoever replies first, wins. Dynamo puts your reply online in seconds.",
    cta: "TALK TO DYNAMO",
  },
  footer: {
    phrase: "LET'S\nTALK?",
    line: "DYNAMO LABS · MARKETING WITH AI AND AUTOMATION",
    nav: [
      { href: "#chatbot", label: "Chatbot" },
      { href: "#top", label: "Home" },
    ],
    legal: [
      { href: "/en/privacy", label: "Privacy policy" },
      { href: "/en/terms", label: "Terms of use" },
    ],
  },
  contact: {
    name: "Name",
    email: "Email",
    phone: "WhatsApp or phone (optional)",
    message: "How can we help? (optional)",
    submit: "Send",
    sending: "Sending…",
    sent: "We got your message. We'll reply soon.",
    whatsapp: "WhatsApp",
    noscript: "To send your message here, enable JavaScript in your browser",
    noscriptOr: "or reach us on",
    errors: {
      name: "Please enter your name.",
      email: "Check the email address.",
      invalid: "Check your details and try again.",
      rate: "Too many attempts. Please wait a few minutes.",
      network: "We couldn't send it right now. Try again in a moment.",
      alternative: "If you prefer, reach us on",
    },
  },
};
