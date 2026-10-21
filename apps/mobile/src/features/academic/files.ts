import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { AcademicFile } from '@/services/academic';

export async function chooseFile(): Promise<FormData | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.text'], copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if ((asset.size ?? 0) > 10 * 1024 * 1024) throw new Error('O arquivo deve ter até 10 MB.');
  const form = new FormData();
  if (Platform.OS === 'web' && asset.file) form.append('arquivo', asset.file, asset.name);
  else form.append('arquivo', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob);
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
