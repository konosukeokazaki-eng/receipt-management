import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface OcrResult {
  receiptDate: string | null; // YYYY-MM-DD
  storeName: string | null;
  amount: number | null;
  hasInvoice: boolean;
  invoiceNumber: string | null;
}

export async function analyzeReceiptImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<OcrResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `この領収書・レシート画像から以下の情報をJSON形式で抽出してください。
抽出する情報：
- receipt_date: 領収書の日付（YYYY-MM-DD形式、不明な場合はnull）
- store_name: 店名・発行者名（不明な場合はnull）
- amount: 合計金額（税込、数値のみ、不明な場合はnull）
- has_invoice: インボイス登録番号（T+13桁の数字）が記載されているか（true/false）
- invoice_number: インボイス登録番号（記載されている場合のみ、ない場合はnull）

必ずJSON形式のみで返答してください。説明文は不要です。
例：{"receipt_date":"2025-03-10","store_name":"東京タクシー","amount":1500,"has_invoice":true,"invoice_number":"T1234567890123"}`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
    prompt,
  ]);

  const text = result.response.text();

  // JSONを抽出（コードブロック等を除去）
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("OCR結果のJSON解析に失敗しました");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    receiptDate: parsed.receipt_date || null,
    storeName: parsed.store_name || null,
    amount: typeof parsed.amount === "number" ? parsed.amount : null,
    hasInvoice: Boolean(parsed.has_invoice),
    invoiceNumber: parsed.invoice_number || null,
  };
}
