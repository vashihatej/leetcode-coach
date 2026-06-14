export function readEditorCode(monaco) {
  if (!monaco || !monaco.editor) return null;
  const models = monaco.editor.getModels();
  if (!models || models.length === 0) return null;
  const codeModel =
    models.find((m) => m.getLanguageId() !== "plaintext") || models[0];
  if (!codeModel) return null;
  return { code: codeModel.getValue(), language: codeModel.getLanguageId() };
}
