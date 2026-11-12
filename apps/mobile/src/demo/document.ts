import * as DocumentPicker from 'expo-document-picker';

/** Documento escolhido no aparelho. `file` existe na web; no celular, o envio usa `uri`. */
export interface PickedDocument {
  name: string;
  uri: string;
  mimeType?: string;
  file?: Blob;
}

export async function pickDocument(): Promise<PickedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.oasis.opendocument.text',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { name: asset.name, uri: asset.uri, mimeType: asset.mimeType, file: asset.file } : null;
}

/** Só o nome: as telas de demonstração não enviam o arquivo. */
export async function pickDemoDocument(): Promise<string | null> {
  return (await pickDocument())?.name ?? null;
}
