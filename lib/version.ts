// Versão da aplicação: vem do package.json, injetada no build pelo next.config.js.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

export const APP_VERSION_LABEL = APP_VERSION ? `v${APP_VERSION}` : "";
