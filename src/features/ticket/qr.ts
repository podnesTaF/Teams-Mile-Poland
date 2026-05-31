import QRCode from "qrcode";

export async function generateTicketQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
    color: { dark: "#101010", light: "#ffffff" },
  });
}
