import { SALON_NAME } from "@/lib/constants";
import { draftMarkers, personalise } from "@/lib/emailTemplate";

// Shared by the compose screen (preview, counter) and the server (queueing).

export const DEFAULT_SMS = `Hi {name}, this is a TEST text from ${SALON_NAME}, please ignore it. We are moving! Our new address will be: [NEW ADDRESS]. Reply STOP and we won't text you again.`;

export const smsDraftMarkers = (body: string) => draftMarkers("", body);

export const renderSms = (body: string, fullName: string) => personalise(body, fullName).replace(/\s+/g, " ").trim();

// Plain GSM-7 text is 160 characters per text (153 when it needs several
// parts); anything outside it (curly quotes, emoji, most accents) switches
// the whole message to 70 (67 per part). More parts = more cost and more to go
// wrong, so the composer shows this.
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€";

export function smsLength(text: string) {
  const unicode = [...text].some((ch) => !GSM7.includes(ch));
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const chars = [...text].length;
  const parts = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  return { chars, parts, unicode };
}
