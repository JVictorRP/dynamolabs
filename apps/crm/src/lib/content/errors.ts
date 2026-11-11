/** Erro de arquivo, com mensagem pronta para a tela e um código para o HTTP. */
export class FileError extends Error {
  constructor(
    public code: "tipo" | "tamanho" | "chave" | "vazio" | "regra",
    message: string,
  ) {
    super(message);
  }
}
