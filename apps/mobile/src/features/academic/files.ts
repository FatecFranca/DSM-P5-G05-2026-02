import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { AcademicFile } from '@/services/academic';

function appendPickedFile(form: FormData, asset: DocumentPicker.DocumentPickerAsset, defaultMime: string) {
  if (Platform.OS === 'web' && asset.file) {
    form.append('arquivo', asset.file, asset.name);
    return;
  }
  const file = new File(asset.uri);
  // Expo serializes native multipart files through bytes(); retain the picker filename.
  form.append('arquivo', {
    name: asset.name,
    type: asset.mimeType ?? defaultMime,
    bytes: () => file.bytes(),
  } as unknown as Blob);
}

export async function chooseFile(): Promise<FormData | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.text'], copyToCacheDirectory: Platform.OS !== 'android', multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > 10 * 1024 * 1024) throw new Error('O arquivo deve ter até 10 MB.');
  const form = new FormData();
  appendPickedFile(form, asset, 'application/octet-stream');
  return form;
}

export async function chooseMlWorkbook(): Promise<FormData | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    copyToCacheDirectory: Platform.OS !== 'android',
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset.name.toLowerCase().endsWith('.xlsx')) throw new Error('Selecione uma planilha .xlsx.');
  if ((asset.size ?? 0) > 1024 * 1024) throw new Error('A planilha deve ter até 1 MB.');
  const form = new FormData();
  appendPickedFile(form, asset, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return form;
}

export async function saveFile(file: AcademicFile, bytes: ArrayBuffer) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = file.nome; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('Não há aplicativo disponível para abrir este arquivo.');
  const local = new File(Paths.cache, `${file.id}-${file.nome.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  try {
    local.write(new Uint8Array(bytes));
    await Sharing.shareAsync(local.uri, { mimeType: file.mime, dialogTitle: file.nome });
  } finally { if (local.exists) local.delete(); }
}

export async function saveWorkbookTemplate(file: AcademicFile, bytes: ArrayBuffer): Promise<boolean> {
  if (Platform.OS !== 'android') {
    await saveFile(file, bytes);
    return true;
  }

  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancelled by the user')) return false;
    throw error;
  }
  const target = directory.createFile(file.nome, file.mime);
  try {
    await target.write(new Uint8Array(bytes));
  } catch (error) {
    try { if (target.exists) target.delete(); } catch { /* Preserve the write error. */ }
    throw error;
  }
  return true;
}
