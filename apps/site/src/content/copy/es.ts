import type { Copy } from "./types";

/**
 * Español (latinoamericano neutro, trato de "tú"). Aprobado por João Victor el 2026-11-11 (`status: "final"`):
 * el idioma queda fuera de los builds de producción (solo existe en `next dev` y en el build de pruebas e2e).
 */
export const es: Copy = {
  status: "final",
  meta: {
    title: "Dynamo | Marketing digital con IA y automatización",
    description: "Agencia de marketing digital con IA y automatización: tráfico pago, creatividad, sitio web y sistemas, con la calidad y el dinamismo de la inteligencia artificial.",
  },
  skip: "Saltar al contenido",
  langLabel: "Idioma",
  aria: { mainNav: "Principal", footerNav: "Pie de página", home: "Dynamo, inicio" },
  nav: {
    links: [
      { href: "#chatbot", label: "Chatbot" },
      { href: "#contato", label: "Contacto" },
    ],
    cta: { href: "#contato", label: "Hablemos" },
  },
  hero: {
    eyebrow: "MARKETING CON IA Y AUTOMATIZACIÓN",
    support: "la agencia que piensa rápido",
    title: "TU MARCA\nEN MOVIMIENTO",
    keyword: "MOVIMIENTO",
    cue: "DESLIZA PARA EXPLORAR",
    deco: ["AUTOMATIZACIÓN SIN PAUSA", "CREATIVIDAD A ESCALA"],
  },
  s2: {
    eyebrow: "TRÁFICO, CREATIVIDAD Y SISTEMAS",
    title: "LA IA HACE\nEL TRABAJO\nPESADO",
    keyword: "PESADO",
    body: "Estrategia humana, ejecución acelerada por inteligencia artificial.",
    deco: ["DATOS, NO CORAZONADAS"],
  },
  chat: {
    eyebrow: "ATENCIÓN CON IA",
    title: "RESPUESTA EN\nSEGUNDOS, DÍA\nY NOCHE",
    body: "Tu cliente escribe a las 22 h. El asistente responde, califica y agenda, sin fila y sin espera.",
    watermark: "24H",
    assistant: { name: "Asistente Dynamo", status: "en línea ahora" },
    messages: [
      { from: "user", at: 0.28, time: "22:14", text: "¡Hola! ¿Tienen horario el jueves?" },
      { from: "bot", at: 0.4, time: "22:14", text: "¡Hola! ¿Cómo estás? Soy el asistente de Dynamo. Tenemos el jueves a las 10 h y a las 15 h. ¿Cuál prefieres?" },
      { from: "user", at: 0.54, time: "22:15", text: "A las 15 h, por favor." },
      { from: "bot", at: 0.66, time: "22:15", text: "¡Agendado! Jueves, a las 15 h. Te envío la confirmación por aquí." },
      { from: "user", at: 0.8, time: "22:16", text: "¡Perfecto, gracias!" },
    ],
    cards: [
      { label: "NUEVO LEAD", detail: "Cliente, 22:14", at: 0.28 },
      { label: "AGENDADO", detail: "Jueves, 15 h", at: 0.66 },
    ],
  },
  video2: {
    eyebrow: "EL MENSAJE LLEGÓ",
    title: "TU PRÓXIMO\nCLIENTE YA\nLLEGÓ",
    keyword: "LLEGÓ",
    support: "Quien responde primero, cierra. Dynamo pone la respuesta en el aire en segundos.",
    cta: "HABLA CON DYNAMO",
  },
  footer: {
    phrase: "¿VAMOS\nA HABLAR?",
    line: "DYNAMO LABS · MARKETING CON IA Y AUTOMATIZACIÓN",
    nav: [
      { href: "#chatbot", label: "Chatbot" },
      { href: "#top", label: "Inicio" },
    ],
    legal: [
      { href: "/es/privacidad", label: "Política de privacidad" },
      { href: "/es/terminos", label: "Términos de uso" },
    ],
  },
  contact: {
    name: "Nombre",
    email: "Correo electrónico",
    phone: "WhatsApp o teléfono (opcional)",
    message: "¿Cómo podemos ayudarte? (opcional)",
    submit: "Enviar",
    sending: "Enviando…",
    sent: "Recibimos tu mensaje. Te respondemos pronto.",
    whatsapp: "WhatsApp",
    noscript: "Para enviar el mensaje por aquí, activa JavaScript en tu navegador",
    noscriptOr: "o escríbenos por",
    errors: {
      name: "Escribe tu nombre.",
      email: "Revisa el correo escrito.",
      invalid: "Revisa los datos e inténtalo de nuevo.",
      rate: "Demasiados intentos. Espera unos minutos.",
      network: "No pudimos enviarlo ahora. Inténtalo de nuevo en unos instantes.",
      alternative: "Si prefieres, escríbenos por",
    },
  },
};
