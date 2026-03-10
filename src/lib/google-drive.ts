import { google } from "googleapis";

function getDriveClient() {
  const keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  const key = JSON.parse(keyString);

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

/**
 * フォルダが存在しない場合は作成し、フォルダIDを返す
 */
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  folderName: string,
  parentFolderId: string
): Promise<string> {
  // 既存フォルダを検索
  const searchRes = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
    fields: "files(id, name)",
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    return searchRes.data.files[0].id!;
  }

  // フォルダを作成
  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  });

  return createRes.data.id!;
}

export interface UploadFileOptions {
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  companyName: string;
  fiscalYear: string;
  settlementMonth: string; // YYYY-MM
  driveParentFolderId: string;
}

export interface UploadFileResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
}

/**
 * Google Drive にファイルをアップロードする
 * フォルダ構成: {親フォルダ}/{会社名}/{会計年度}/{精算月YYYY-MM}/
 */
export async function uploadReceiptToDrive(
  options: UploadFileOptions
): Promise<UploadFileResult> {
  const drive = getDriveClient();

  const { Readable } = await import("stream");

  // フォルダ階層を作成
  const companyFolderId = await getOrCreateFolder(
    drive,
    options.companyName,
    options.driveParentFolderId
  );
  const yearFolderId = await getOrCreateFolder(
    drive,
    options.fiscalYear,
    companyFolderId
  );
  const monthFolderId = await getOrCreateFolder(
    drive,
    options.settlementMonth,
    yearFolderId
  );

  // ファイルをアップロード
  const stream = new Readable();
  stream.push(options.fileBuffer);
  stream.push(null);

  const uploadRes = await drive.files.create({
    requestBody: {
      name: options.fileName,
      parents: [monthFolderId],
    },
    media: {
      mimeType: options.mimeType,
      body: stream,
    },
    fields: "id, name, webViewLink",
  });

  return {
    fileId: uploadRes.data.id!,
    fileName: uploadRes.data.name!,
    webViewLink: uploadRes.data.webViewLink || "",
  };
}

/**
 * ファイルを削除する
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

/**
 * ファイルのサムネイル用URLを取得する
 */
export function getDriveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}
