const api = {
  async request(metodo, caminho, corpo) {
    const opcoes = {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (corpo !== undefined) {
      opcoes.body = JSON.stringify(corpo);
    }
    const resposta = await fetch('/api' + caminho, opcoes);
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      if (resposta.status === 428 && dados.tipo === 'comunicado_pendente' && typeof window.onComunicadoPendente === 'function') {
        window.onComunicadoPendente(dados);
      }
      const erro = new Error(dados.erro || 'Erro na requisição');
      erro.status = resposta.status;
      erro.dados = dados;
      throw erro;
    }
    return dados;
  },
  get(caminho) { return this.request('GET', caminho); },
  post(caminho, corpo) { return this.request('POST', caminho, corpo); },
  put(caminho, corpo) { return this.request('PUT', caminho, corpo); },
  patch(caminho, corpo) { return this.request('PATCH', caminho, corpo); },
  delete(caminho) { return this.request('DELETE', caminho); },
};
