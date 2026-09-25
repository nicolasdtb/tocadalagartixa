const telas = {
  login: document.getElementById('tela-login'),
  primeiroAcesso: document.getElementById('tela-primeiro-acesso'),
  trocarSenha: document.getElementById('tela-trocar-senha'),
  appShell: document.getElementById('app-shell'),
};

let usuarioAtual = null;

function mostrarTela(nome) {
  Object.values(telas).forEach((el) => el.classList.remove('ativo'));
  Object.values(telas).forEach((el) => {
    if (el.id !== 'app-shell') el.classList.add('oculto');
  });
  telas.appShell.classList.remove('ativo');

  if (nome === 'appShell') {
    telas.appShell.classList.add('ativo');
  } else {
    telas[nome].classList.remove('oculto');
  }
}

function mostrarErro(elementoId, mensagem) {
  const el = document.getElementById(elementoId);
  el.textContent = mensagem;
  el.classList.add('visivel');
}

function limparErro(elementoId) {
  const el = document.getElementById(elementoId);
  el.classList.remove('visivel');
  el.textContent = '';
}

// ---------- LOGIN ----------
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  limparErro('erro-login');
  const login = document.getElementById('login-usuario').value.trim();
  const senha = document.getElementById('login-senha').value;

  try {
    const dados = await api.post('/auth/login', { login, senha });
    usuarioAtual = dados;
    roteamentoPosLogin();
  } catch (err) {
    mostrarErro('erro-login', err.dados?.erro || 'Não foi possível entrar');
  }
});

function roteamentoPosLogin() {
  if (usuarioAtual.primeiro_acesso === false) {
    mostrarTela('primeiroAcesso');
  } else if (usuarioAtual.senha_provisoria === true) {
    mostrarTela('trocarSenha');
  } else {
    iniciarDashboard();
  }
}

// ---------- PRIMEIRO ACESSO ----------
document.getElementById('form-primeiro-acesso').addEventListener('submit', async (e) => {
  e.preventDefault();
  limparErro('erro-primeiro-acesso');

  const corpo = {
    nome: document.getElementById('pa-nome').value.trim(),
    email: document.getElementById('pa-email').value.trim(),
    telefone: document.getElementById('pa-telefone').value.trim(),
    cpf: document.getElementById('pa-cpf').value.trim(),
    novo_login: document.getElementById('pa-novo-login').value.trim(),
    nova_senha: document.getElementById('pa-nova-senha').value,
  };

  try {
    await api.post('/primeiro-acesso', corpo);
    usuarioAtual.primeiro_acesso = true;
    iniciarDashboard();
  } catch (err) {
    mostrarErro('erro-primeiro-acesso', err.dados?.erro || 'Erro ao concluir cadastro');
  }
});

// ---------- TROCA DE SENHA OBRIGATÓRIA ----------
document.getElementById('form-trocar-senha').addEventListener('submit', async (e) => {
  e.preventDefault();
  limparErro('erro-trocar-senha');
  const nova_senha = document.getElementById('ts-nova-senha').value;

  try {
    await api.post('/usuarios/trocar-senha', { nova_senha });
    usuarioAtual.senha_provisoria = false;
    iniciarDashboard();
  } catch (err) {
    mostrarErro('erro-trocar-senha', err.dados?.erro || 'Erro ao trocar senha');
  }
});

// ---------- LOGOUT ----------
document.getElementById('botao-logout').addEventListener('click', async () => {
  await api.post('/auth/logout');
  usuarioAtual = null;
  location.reload();
});

// ---------- DASHBOARD ----------
function iniciarDashboard() {
  document.getElementById('usuario-logado-nome').textContent = usuarioAtual.nome;

  const ehSocio = usuarioAtual.perfil_id === 1;
  document.querySelectorAll('.apenas-socio').forEach((el) => {
    el.classList.toggle('oculto', !ehSocio);
  });

  mostrarTela('appShell');
  navegarPara('inicio');

  // Verificação leve pra já disparar o bloqueio de comunicado obrigatório
  // assim que o dashboard carrega, sem esperar o usuário clicar em outra aba.
  if (!ehSocio) {
    api.get('/metas/niveis').catch(() => {});
  }
}

document.querySelectorAll('.nav-item').forEach((botao) => {
  botao.addEventListener('click', () => navegarPara(botao.dataset.view));
});

function navegarPara(view) {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('ativo', b.dataset.view === view);
  });
  const container = document.getElementById('conteudo-principal');
  if (typeof views[view] === 'function') {
    views[view](container);
  } else {
    container.innerHTML = '<h2>Em construção</h2>';
  }
}

// Se qualquer chamada à API indicar comunicado obrigatório pendente,
// força a navegação para a aba de Comunicados até o usuário confirmar.
let avisoComunicadoMostrado = false;
window.onComunicadoPendente = (dados) => {
  if (!avisoComunicadoMostrado) {
    avisoComunicadoMostrado = true;
    alert(dados.erro);
    setTimeout(() => { avisoComunicadoMostrado = false; }, 1000);
  }
  navegarPara('comunicados');
};

// Registro de views — cada módulo será preenchido nas próximas etapas
const views = {
  inicio(container) {
    container.innerHTML = `<h2>Bem-vindo(a), ${usuarioAtual.nome}</h2><p>Use o menu ao lado para navegar pelos módulos.</p>`;
  },

  async agenda(container) {
    container.innerHTML = '<h2>Agenda</h2><p>Carregando...</p>';
    const ehSocio = usuarioAtual.perfil_id === 1;

    let residentes = [];
    if (ehSocio) {
      try {
        const usuarios = await api.get('/usuarios');
        residentes = usuarios.filter((u) => u.perfil_id === 2 && u.status);
      } catch (e) { /* segue sem lista de residentes se falhar */ }
    }

    let agendamentos = [];
    try {
      agendamentos = await api.get('/agendamentos');
    } catch (e) {
      container.innerHTML = `<h2>Agenda</h2><div class="mensagem-erro visivel">Erro ao carregar agendamentos</div>`;
      return;
    }

    const opcoesResidentes = residentes
      .map((r) => `<option value="${r.id}">${r.nome}</option>`)
      .join('');

    container.innerHTML = `
      <h2>Agenda</h2>
      <div class="painel-form" id="painel-form-agendamento">
        <h3 id="titulo-form-agendamento">Novo agendamento</h3>
        <div id="erro-agendamento" class="mensagem-erro"></div>
        <form id="form-agendamento">
          <input type="hidden" id="ag-id">
          ${ehSocio ? `
            <div class="campo">
              <label for="ag-usuario">Residente</label>
              <select id="ag-usuario" required>
                <option value="">Selecione...</option>
                ${opcoesResidentes}
              </select>
            </div>` : ''}
          <div class="linha-campos">
            <div class="campo">
              <label for="ag-data">Data</label>
              <input type="date" id="ag-data" required>
            </div>
            <div class="campo">
              <label for="ag-horario">Horário</label>
              <input type="time" id="ag-horario" required>
            </div>
          </div>
          <div class="linha-campos">
            <div class="campo">
              <label for="ag-duracao">Duração aprox. (min)</label>
              <input type="number" id="ag-duracao" min="1">
            </div>
            <div class="campo">
              <label for="ag-valor">Valor da tattoo (R$)</label>
              <input type="number" id="ag-valor" min="100" step="0.01" required>
            </div>
          </div>
          <button type="submit" class="botao">Salvar agendamento</button>
          <button type="button" class="botao botao-secundario oculto" id="botao-cancelar-edicao">Cancelar edição</button>
        </form>
      </div>

      <h3 style="margin-top:32px;">Próximos agendamentos</h3>
      <div class="tabela-wrapper">
        <table class="tabela">
          <thead>
            <tr><th>Responsável</th><th>Data</th><th>Horário</th><th>Valor</th><th>Repasse</th><th></th></tr>
          </thead>
          <tbody id="corpo-tabela-agendamentos"></tbody>
        </table>
      </div>
    `;

    function renderTabela() {
      const corpo = document.getElementById('corpo-tabela-agendamentos');
      const ordenados = [...agendamentos].sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
      corpo.innerHTML = ordenados.map((ag) => {
        const podeEditar = ehSocio || Number(ag.usuario_id) === Number(usuarioAtual.id);
        const dataFmt = new Date(ag.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        return `
          <tr>
            <td>${ag.responsavel}</td>
            <td>${dataFmt}</td>
            <td>${ag.horario.slice(0, 5)}</td>
            <td>R$ ${Number(ag.valor).toFixed(2)}</td>
            <td>R$ ${Number(ag.repasse).toFixed(2)} (${Number(ag.percentual)}%)</td>
            <td>
              ${podeEditar ? `
                <button class="link-acao" data-acao="editar" data-id="${ag.id}">Editar</button>
                <button class="link-acao link-acao-erro" data-acao="excluir" data-id="${ag.id}">Excluir</button>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="6">Nenhum agendamento ainda.</td></tr>';

      corpo.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
        btn.addEventListener('click', () => preencherEdicao(btn.dataset.id));
      });
      corpo.querySelectorAll('[data-acao="excluir"]').forEach((btn) => {
        btn.addEventListener('click', () => excluirAgendamento(btn.dataset.id));
      });
    }

    function preencherEdicao(id) {
      const ag = agendamentos.find((a) => String(a.id) === String(id));
      if (!ag) return;
      document.getElementById('titulo-form-agendamento').textContent = 'Editar agendamento';
      document.getElementById('ag-id').value = ag.id;
      document.getElementById('ag-data').value = String(ag.data).slice(0, 10);
      document.getElementById('ag-horario').value = ag.horario.slice(0, 5);
      document.getElementById('ag-duracao').value = ag.duracao || '';
      document.getElementById('ag-valor').value = ag.valor;
      if (ehSocio) document.getElementById('ag-usuario').value = ag.usuario_id;
      document.getElementById('botao-cancelar-edicao').classList.remove('oculto');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('botao-cancelar-edicao').addEventListener('click', () => {
      document.getElementById('form-agendamento').reset();
      document.getElementById('ag-id').value = '';
      document.getElementById('titulo-form-agendamento').textContent = 'Novo agendamento';
      document.getElementById('botao-cancelar-edicao').classList.add('oculto');
    });

    async function excluirAgendamento(id) {
      if (!confirm('Excluir este agendamento?')) return;
      try {
        await api.delete(`/agendamentos/${id}`);
        agendamentos = agendamentos.filter((a) => String(a.id) !== String(id));
        renderTabela();
      } catch (err) {
        alert(err.dados?.erro || 'Erro ao excluir');
      }
    }

    document.getElementById('form-agendamento').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = document.getElementById('erro-agendamento');
      erroEl.classList.remove('visivel');

      const id = document.getElementById('ag-id').value;
      const corpo = {
        data: document.getElementById('ag-data').value,
        horario: document.getElementById('ag-horario').value,
        duracao: document.getElementById('ag-duracao').value || undefined,
        valor: Number(document.getElementById('ag-valor').value),
      };
      if (ehSocio) corpo.usuario_id = document.getElementById('ag-usuario').value;

      try {
        if (id) {
          const atualizado = await api.put(`/agendamentos/${id}`, corpo);
          agendamentos = agendamentos.map((a) => String(a.id) === String(id) ? { ...a, ...atualizado, responsavel: a.responsavel } : a);
        } else {
          const criado = await api.post('/agendamentos', corpo);
          const nomeResponsavel = ehSocio
            ? (residentes.find((r) => String(r.id) === String(corpo.usuario_id))?.nome || '')
            : usuarioAtual.nome;
          agendamentos.push({ ...criado, responsavel: nomeResponsavel });
        }
        document.getElementById('form-agendamento').reset();
        document.getElementById('ag-id').value = '';
        document.getElementById('titulo-form-agendamento').textContent = 'Novo agendamento';
        document.getElementById('botao-cancelar-edicao').classList.add('oculto');
        renderTabela();
      } catch (err) {
        erroEl.textContent = err.dados?.erro || 'Erro ao salvar agendamento';
        erroEl.classList.add('visivel');
      }
    });

    renderTabela();
  },

  async metas(container) {
    container.innerHTML = '<h2>Minha Meta</h2><p>Carregando...</p>';
    let meta;
    try {
      meta = await api.get('/metas/individual');
    } catch (e) {
      container.innerHTML = '<h2>Minha Meta</h2><div class="mensagem-erro visivel">Erro ao carregar</div>';
      return;
    }

    const progresso = meta.nivel_maximo_atingido
      ? 100
      : Math.min(100, (meta.acumulado_mes / Number(meta.proximo_nivel.repasse_minimo)) * 100);

    container.innerHTML = `
      <h2>Minha Meta <button class="link-acao" id="botao-ver-niveis" title="Ver todos os níveis">?</button></h2>
      <div class="painel-form" style="max-width:480px;">
        <p style="color:var(--cor-texto-fraco); margin-top:0;">Repasse acumulado este mês</p>
        <p style="font-size:32px; font-family: var(--fonte-titulo); margin:0 0 16px;">R$ ${Number(meta.acumulado_mes).toFixed(2)}</p>

        <div class="barra-progresso"><div class="barra-progresso-preenchida" style="width:${progresso}%"></div></div>

        ${meta.nivel_maximo_atingido ? `
          <p class="mensagem-sucesso" style="margin-top:16px;">Nível máximo atingido! Benefício: R$ ${Number(meta.nivel_atual.valor).toFixed(2)}</p>
        ` : `
          <p style="margin-top:16px; color:var(--cor-texto-fraco);">
            ${meta.nivel_atual ? `Nível atual: <strong style="color:var(--cor-texto);">Nível ${meta.nivel_atual.nivel}</strong> (R$ ${Number(meta.nivel_atual.valor).toFixed(2)})<br>` : ''}
            Faltam <strong style="color:var(--cor-texto);">R$ ${Number(meta.falta_para_proximo).toFixed(2)}</strong> para o Nível ${meta.proximo_nivel.nivel} (R$ ${Number(meta.proximo_nivel.valor).toFixed(2)})
          </p>
        `}
      </div>

      <div id="modal-niveis" class="modal oculto">
        <div class="modal-conteudo">
          <h3>Todos os níveis</h3>
          <table class="tabela">
            <thead><tr><th>Nível</th><th>Repasse mínimo</th><th>Benefício</th></tr></thead>
            <tbody id="corpo-niveis"></tbody>
          </table>
          <button class="botao botao-secundario" id="botao-fechar-niveis">Fechar</button>
        </div>
      </div>
    `;

    document.getElementById('botao-ver-niveis').addEventListener('click', async () => {
      const niveis = await api.get('/metas/niveis');
      document.getElementById('corpo-niveis').innerHTML = niveis.map((n) => `
        <tr><td>${n.nivel}</td><td>R$ ${Number(n.repasse_minimo).toFixed(2)}</td><td>R$ ${Number(n.valor).toFixed(2)}</td></tr>
      `).join('');
      document.getElementById('modal-niveis').classList.remove('oculto');
    });
    document.getElementById('botao-fechar-niveis').addEventListener('click', () => {
      document.getElementById('modal-niveis').classList.add('oculto');
    });
  },

  async beneficios(container) {
    container.innerHTML = '<h2>Benefícios</h2><p>Carregando...</p>';
    const ehSocio = usuarioAtual.perfil_id === 1;

    if (ehSocio) {
      let resumo = [];
      try {
        resumo = await api.get('/beneficios/resumo');
      } catch (e) {
        container.innerHTML = '<h2>Benefícios</h2><div class="mensagem-erro visivel">Erro ao carregar</div>';
        return;
      }
      const nomesStatus = { 1: 'Pendente', 2: 'Aprovado', 3: 'Pago' };
      container.innerHTML = `
        <h2>Benefícios</h2>
        <div class="tabela-wrapper">
          <table class="tabela">
            <thead><tr><th>Residente</th><th>Repasse acumulado</th><th>Benefício</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${resumo.map((r) => `
                <tr>
                  <td>${r.nome}</td>
                  <td>R$ ${Number(r.repasse_acumulado).toFixed(2)}</td>
                  <td>${r.valor_beneficio ? 'R$ ' + Number(r.valor_beneficio).toFixed(2) : '—'}</td>
                  <td>${r.status_id ? nomesStatus[r.status_id] : '—'}</td>
                  <td>
                    ${r.status_id === 1 ? `<button class="link-acao" data-acao="aprovar" data-id="${r.beneficio_id}">Aprovar</button>` : ''}
                    ${r.status_id === 2 ? `<button class="link-acao" data-acao="pagar" data-id="${r.beneficio_id}">Marcar como pago</button>` : ''}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="5">Nenhum benefício este mês.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
      // Nota: as ações usam o id do benefício, não do usuário.
      container.querySelectorAll('[data-acao="aprovar"], [data-acao="pagar"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const statusAlvo = btn.dataset.acao === 'aprovar' ? 2 : 3;
          try {
            await api.patch(`/beneficios/${btn.dataset.id}/status`, { status_id: statusAlvo });
            views.beneficios(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao atualizar benefício');
          }
        });
      });
      return;
    }

    // Visão do residente
    let categorias = [];
    try {
      categorias = await api.get('/beneficios/categorias');
    } catch (e) {}

    container.innerHTML = `
      <h2>Benefícios</h2>
      <div class="painel-form" style="max-width:420px;">
        <p style="color:var(--cor-texto-fraco); margin-top:0;">Escolha a categoria do seu benefício deste mês. Só é possível uma solicitação por mês.</p>
        <div id="erro-beneficio" class="mensagem-erro"></div>
        <div id="sucesso-beneficio" class="mensagem-sucesso oculto"></div>
        <form id="form-beneficio">
          <div class="campo">
            <label for="beneficio-categoria">Categoria</label>
            <select id="beneficio-categoria" required>
              <option value="">Selecione...</option>
              ${categorias.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="botao">Solicitar benefício do mês</button>
        </form>
      </div>
    `;

    document.getElementById('form-beneficio').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = document.getElementById('erro-beneficio');
      const sucessoEl = document.getElementById('sucesso-beneficio');
      erroEl.classList.remove('visivel');
      sucessoEl.classList.add('oculto');

      const categoria_id = document.getElementById('beneficio-categoria').value;
      try {
        const resultado = await api.post('/beneficios/solicitar', { categoria_id });
        sucessoEl.textContent = `Benefício solicitado: R$ ${Number(resultado.valor).toFixed(2)}. Aguarde aprovação do sócio.`;
        sucessoEl.classList.remove('oculto');
        document.getElementById('form-beneficio').reset();
      } catch (err) {
        erroEl.textContent = err.dados?.erro || 'Erro ao solicitar benefício';
        erroEl.classList.add('visivel');
      }
    });
  },

  async estoque(container) {
    container.innerHTML = '<h2>Estoque</h2><p>Carregando...</p>';
    const ehSocio = usuarioAtual.perfil_id === 1;

    let materiais = [];
    try {
      materiais = await api.get('/estoque/materiais');
    } catch (e) {
      container.innerHTML = '<h2>Estoque</h2><div class="mensagem-erro visivel">Erro ao carregar</div>';
      return;
    }

    const opcoesMateriais = materiais
      .map((m) => `<option value="${m.id}">${m.nome} (${Number(m.quantidade)} ${m.unidade})</option>`)
      .join('');

    container.innerHTML = `
      <h2>Estoque</h2>

      ${ehSocio ? `
        <div class="painel-form" style="max-width:420px; margin-bottom:24px;">
          <h3>Cadastrar material</h3>
          <div id="erro-material" class="mensagem-erro"></div>
          <form id="form-material">
            <div class="campo"><label for="mat-nome">Nome</label><input type="text" id="mat-nome" required></div>
            <div class="linha-campos">
              <div class="campo"><label for="mat-unidade">Unidade</label><input type="text" id="mat-unidade" placeholder="unidade, caixa, litro..." required></div>
              <div class="campo"><label for="mat-minimo">Qtd. mínima de alerta</label><input type="number" id="mat-minimo" min="0" step="0.01"></div>
            </div>
            <button type="submit" class="botao">Cadastrar</button>
          </form>
        </div>
      ` : ''}

      <div class="painel-form" style="max-width:420px; margin-bottom:24px;">
        <h3>Registrar movimentação</h3>
        <div id="erro-mov" class="mensagem-erro"></div>
        <form id="form-movimentacao">
          <div class="campo">
            <label for="mov-material">Material</label>
            <select id="mov-material" required><option value="">Selecione...</option>${opcoesMateriais}</select>
          </div>
          <div class="linha-campos">
            <div class="campo">
              <label for="mov-tipo">Tipo</label>
              <select id="mov-tipo" required>
                ${ehSocio ? '<option value="1">Entrada</option>' : ''}
                <option value="2">Saída</option>
              </select>
            </div>
            <div class="campo"><label for="mov-quantidade">Quantidade</label><input type="number" id="mov-quantidade" min="0.01" step="0.01" required></div>
          </div>
          <div class="campo"><label for="mov-obs">Observação (opcional)</label><input type="text" id="mov-obs"></div>
          <button type="submit" class="botao">Registrar</button>
        </form>
      </div>

      <h3>Materiais</h3>
      <div class="tabela-wrapper">
        <table class="tabela">
          <thead><tr><th>Nome</th><th>Unidade</th><th>Quantidade</th><th>Mínimo</th><th>Status</th>${ehSocio ? '<th></th>' : ''}</tr></thead>
          <tbody id="corpo-materiais"></tbody>
        </table>
      </div>
    `;

    function renderMateriais() {
      document.getElementById('corpo-materiais').innerHTML = materiais.map((m) => `
        <tr>
          <td>${m.nome} ${m.estoque_baixo ? '<span class="badge-alerta">baixo</span>' : ''}</td>
          <td>${m.unidade}</td>
          <td>${Number(m.quantidade)}</td>
          <td>${Number(m.minimo)}</td>
          <td>${m.status ? 'Ativo' : 'Inativo'}</td>
          ${ehSocio ? `<td><button class="link-acao" data-acao="status" data-id="${m.id}" data-status="${!m.status}">${m.status ? 'Desativar' : 'Ativar'}</button></td>` : ''}
        </tr>
      `).join('') || `<tr><td colspan="${ehSocio ? 6 : 5}">Nenhum material cadastrado.</td></tr>`;

      document.querySelectorAll('[data-acao="status"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await api.patch(`/estoque/materiais/${btn.dataset.id}/status`, { status: btn.dataset.status === 'true' });
            views.estoque(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao alterar status');
          }
        });
      });
    }

    if (ehSocio) {
      document.getElementById('form-material').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-material');
        erroEl.classList.remove('visivel');
        try {
          const criado = await api.post('/estoque/materiais', {
            nome: document.getElementById('mat-nome').value.trim(),
            unidade: document.getElementById('mat-unidade').value.trim(),
            minimo: document.getElementById('mat-minimo').value || 0,
          });
          materiais.push(criado);
          views.estoque(container);
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao cadastrar';
          erroEl.classList.add('visivel');
        }
      });
    }

    document.getElementById('form-movimentacao').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = document.getElementById('erro-mov');
      erroEl.classList.remove('visivel');
      try {
        await api.post('/estoque/movimentacoes', {
          material_id: document.getElementById('mov-material').value,
          tipo_id: Number(document.getElementById('mov-tipo').value),
          quantidade: Number(document.getElementById('mov-quantidade').value),
          observacao: document.getElementById('mov-obs').value || undefined,
        });
        views.estoque(container);
      } catch (err) {
        erroEl.textContent = err.dados?.erro || 'Erro ao registrar movimentação';
        erroEl.classList.add('visivel');
      }
    });

    renderMateriais();
  },

  async financeiro(container) {
    if (usuarioAtual.perfil_id !== 1) {
      container.innerHTML = '<h2>Financeiro</h2><p>Acesso restrito aos sócios.</p>';
      return;
    }

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    container.innerHTML = `
      <h2>Financeiro</h2>
      <div class="campo" style="max-width:200px;">
        <label for="fin-mes">Mês de referência</label>
        <input type="month" id="fin-mes" value="${mesAtual}">
      </div>

      <div class="linha-campos" style="align-items:flex-start;">
        <div class="painel-form" style="flex:1;">
          <h3>Nova entrada</h3>
          <div id="erro-entrada" class="mensagem-erro"></div>
          <form id="form-entrada">
            <div class="campo"><label for="ent-valor">Valor (R$)</label><input type="number" id="ent-valor" min="0.01" step="0.01" required></div>
            <div class="campo"><label for="ent-desc">Descrição (opcional)</label><input type="text" id="ent-desc"></div>
            <button type="submit" class="botao">Registrar entrada</button>
          </form>
        </div>

        <div class="painel-form" style="flex:1;">
          <h3>Orçamento do mês</h3>
          <div id="erro-orcamento" class="mensagem-erro"></div>
          <form id="form-orcamento">
            <div class="campo">
              <label for="orc-categoria">Categoria</label>
              <select id="orc-categoria" required>
                <option value="1">Operacional</option>
                <option value="2">Materiais</option>
              </select>
            </div>
            <div class="campo"><label for="orc-valor">Valor (R$)</label><input type="number" id="orc-valor" min="0" step="0.01" required></div>
            <button type="submit" class="botao">Definir orçamento</button>
          </form>
        </div>
      </div>

      <div class="painel-form" style="max-width:520px; margin-top:20px;">
        <h3>Lançar gasto</h3>
        <div id="erro-gasto" class="mensagem-erro"></div>
        <form id="form-gasto">
          <div class="linha-campos">
            <div class="campo">
              <label for="gasto-categoria">Categoria</label>
              <select id="gasto-categoria" required>
                <option value="1">Operacional</option>
                <option value="2">Materiais</option>
                <option value="3">Benefícios</option>
                <option value="4">Marketing</option>
                <option value="5">Melhorias</option>
              </select>
            </div>
            <div class="campo"><label for="gasto-valor">Valor (R$)</label><input type="number" id="gasto-valor" min="0.01" step="0.01" required></div>
          </div>
          <div class="campo"><label for="gasto-desc">Descrição</label><input type="text" id="gasto-desc"></div>
          <button type="submit" class="botao">Registrar gasto</button>
        </form>
      </div>

      <div class="painel-form" style="max-width:640px; margin-top:20px;">
        <h3>Fechamento do mês</h3>
        <div id="area-preview"></div>
        <button class="botao botao-secundario" id="botao-preview">Ver preview do fechamento</button>
        <button class="botao" id="botao-fechar">Fechar mês</button>
        <div class="campo" style="margin-top:12px;">
          <label for="fin-motivo-reabrir">Motivo (para reabrir mês fechado)</label>
          <input type="text" id="fin-motivo-reabrir" placeholder="Ex: ajuste de lançamento">
        </div>
        <button class="botao botao-secundario" id="botao-reabrir">Reabrir mês</button>
        <div id="msg-fechamento" style="margin-top:12px;"></div>
      </div>

      <h3 style="margin-top:24px;">Saldos do mês</h3>
      <div class="tabela-wrapper">
        <table class="tabela">
          <thead><tr><th>Categoria</th><th>Saldo inicial</th><th>Destinação</th><th>Gastos</th><th>Saldo final</th></tr></thead>
          <tbody id="corpo-saldos"><tr><td colspan="5">Clique em "Ver saldos" para carregar.</td></tr></tbody>
        </table>
      </div>
      <button class="botao botao-secundario" id="botao-ver-saldos">Ver saldos</button>

      <h3 style="margin-top:24px;">Lançamentos do mês</h3>
      <div class="tabela-wrapper">
        <table class="tabela">
          <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th>Descrição</th><th>Usuário</th></tr></thead>
          <tbody id="corpo-lancamentos"><tr><td colspan="6">Clique em "Ver lançamentos" para carregar.</td></tr></tbody>
        </table>
      </div>
      <button class="botao botao-secundario" id="botao-ver-lancamentos">Ver lançamentos</button>
    `;

    function mesSelecionado() {
      return document.getElementById('fin-mes').value;
    }

    document.getElementById('form-entrada').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = document.getElementById('erro-entrada');
      erroEl.classList.remove('visivel');
      try {
        await api.post('/financeiro/entradas', {
          mes: mesSelecionado(),
          valor: Number(document.getElementById('ent-valor').value),
          descricao: document.getElementById('ent-desc').value || undefined,
        });
        document.getElementById('form-entrada').reset();
        alert('Entrada registrada.');
      } catch (err) {
        erroEl.textContent = err.dados?.erro || 'Erro ao registrar entrada';
        erroEl.classList.add('visivel');
      }
    });

    document.getElementById('form-orcamento').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = document.getElementById('erro-orcamento');
      erroEl.classList.remove('visivel');
      try {
        await api.post('/financeiro/orcamentos', {
          categoria_id: Number(document.getElementById('orc-categoria').value),
          mes: mesSelecionado(),
          valor: Number(document.getElementById('orc-valor').value),
        });
        document.getElementById('form-orcamento').reset();
        alert('Orçamento definido.');
      } catch (err) {
        erroEl.textContent = err.dados?.erro || 'Erro ao definir orçamento';
        erroEl.classList.add('visivel');
      }
    });

    document.getElementById('form-gasto').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = document.getElementById('erro-gasto');
      erroEl.classList.remove('visivel');
      try {
        await api.post('/financeiro/gastos', {
          categoria_id: Number(document.getElementById('gasto-categoria').value),
          mes: mesSelecionado(),
          valor: Number(document.getElementById('gasto-valor').value),
          descricao: document.getElementById('gasto-desc').value || undefined,
        });
        document.getElementById('form-gasto').reset();
        alert('Gasto registrado.');
      } catch (err) {
        erroEl.textContent = err.dados?.erro || 'Erro ao registrar gasto';
        erroEl.classList.add('visivel');
      }
    });

    document.getElementById('botao-preview').addEventListener('click', async () => {
      try {
        const p = await api.get(`/financeiro/fechamento/${mesSelecionado()}/preview`);
        document.getElementById('area-preview').innerHTML = `
          <p style="font-size:13px; color:var(--cor-texto-fraco);">
            E: R$ ${p.E.toFixed(2)} · O: R$ ${p.O.toFixed(2)} · M: R$ ${p.M.toFixed(2)} ·
            B: R$ ${p.B.toFixed(2)} · K: R$ ${p.K.toFixed(2)} · I (Melhorias): R$ ${p.I.toFixed(2)}
          </p>`;
      } catch (err) {
        alert(err.dados?.erro || 'Erro ao gerar preview');
      }
    });

    document.getElementById('botao-fechar').addEventListener('click', async () => {
      if (!confirm(`Fechar o mês ${mesSelecionado()}?`)) return;
      try {
        await api.post(`/financeiro/fechamento/${mesSelecionado()}/fechar`);
        document.getElementById('msg-fechamento').innerHTML = '<p class="mensagem-sucesso">Mês fechado com sucesso.</p>';
      } catch (err) {
        document.getElementById('msg-fechamento').innerHTML = `<div class="mensagem-erro visivel">${err.dados?.erro || 'Erro ao fechar mês'}</div>`;
      }
    });

    document.getElementById('botao-reabrir').addEventListener('click', async () => {
      const motivo = document.getElementById('fin-motivo-reabrir').value.trim();
      if (!motivo) return alert('Informe o motivo da reabertura.');
      try {
        await api.post(`/financeiro/fechamento/${mesSelecionado()}/reabrir`, { motivo });
        document.getElementById('msg-fechamento').innerHTML = '<p class="mensagem-sucesso">Mês reaberto.</p>';
      } catch (err) {
        document.getElementById('msg-fechamento').innerHTML = `<div class="mensagem-erro visivel">${err.dados?.erro || 'Erro ao reabrir mês'}</div>`;
      }
    });

    document.getElementById('botao-ver-saldos').addEventListener('click', async () => {
      try {
        const saldos = await api.get(`/financeiro/saldos/${mesSelecionado()}`);
        document.getElementById('corpo-saldos').innerHTML = saldos.map((s) => `
          <tr>
            <td>${s.nome}</td>
            <td>R$ ${Number(s.saldo_inicial).toFixed(2)}</td>
            <td>R$ ${Number(s.destinacao).toFixed(2)}</td>
            <td>R$ ${Number(s.gastos).toFixed(2)}</td>
            <td>R$ ${Number(s.saldo_final).toFixed(2)}</td>
          </tr>
        `).join('') || '<tr><td colspan="5">Mês ainda não fechado.</td></tr>';
      } catch (err) {
        alert(err.dados?.erro || 'Erro ao carregar saldos');
      }
    });

    document.getElementById('botao-ver-lancamentos').addEventListener('click', async () => {
      try {
        const lancamentos = await api.get(`/financeiro/lancamentos/${mesSelecionado()}`);
        const nomesTipo = { 1: 'Entrada', 2: 'Gasto', 3: 'Ajuste' };
        document.getElementById('corpo-lancamentos').innerHTML = lancamentos.map((l) => `
          <tr>
            <td>${new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
            <td>${nomesTipo[l.tipo_id]}</td>
            <td>${l.categoria || '—'}</td>
            <td>R$ ${Number(l.valor).toFixed(2)}</td>
            <td>${l.descricao || '—'}</td>
            <td>${l.usuario_nome}</td>
          </tr>
        `).join('') || '<tr><td colspan="6">Nenhum lançamento neste mês.</td></tr>';
      } catch (err) {
        alert(err.dados?.erro || 'Erro ao carregar lançamentos');
      }
    });
  },

  async melhorias(container) {
    container.innerHTML = '<h2>Melhorias</h2><p>Carregando...</p>';
    const ehSocio = usuarioAtual.perfil_id === 1;

    if (!ehSocio) {
      let atual;
      try {
        atual = await api.get('/melhorias/atual');
      } catch (e) {
        container.innerHTML = '<h2>Melhorias</h2><div class="mensagem-erro visivel">Erro ao carregar</div>';
        return;
      }

      if (!atual.melhoria_atual) {
        container.innerHTML = `
          <h2>Melhorias</h2>
          <p>${atual.mensagem}</p>
          ${atual.ultima_melhoria_adquirida ? `<p style="color:var(--cor-texto-fraco);">Última adquirida: ${atual.ultima_melhoria_adquirida.nome}</p>` : ''}
        `;
        return;
      }

      container.innerHTML = `
        <h2>Melhorias</h2>
        <div class="painel-form" style="max-width:480px;">
          <p style="color:var(--cor-texto-fraco); margin-top:0;">Melhoria atual</p>
          <p style="font-size:24px; font-family: var(--fonte-titulo); margin:0 0 16px;">${atual.melhoria_atual}</p>
          <div class="barra-progresso"><div class="barra-progresso-preenchida" style="width:${Math.min(100, atual.progresso_percentual)}%"></div></div>
          <p style="margin-top:12px; color:var(--cor-texto-fraco);">
            R$ ${Number(atual.valor_acumulado).toFixed(2)} de R$ ${Number(atual.valor_alvo).toFixed(2)}
            ${atual.estado === 'meta_atingida' ? '<span class="mensagem-sucesso" style="display:inline; padding:2px 6px; margin-left:8px;">meta atingida</span>' : ''}
          </p>
          ${atual.ultima_melhoria_adquirida ? `<p style="margin-top:16px; font-size:13px; color:var(--cor-texto-fraco);">Última adquirida: ${atual.ultima_melhoria_adquirida.nome}</p>` : ''}
        </div>
      `;
      return;
    }

    // Visão do sócio: fila completa
    let fila = [];
    try {
      fila = await api.get('/melhorias');
    } catch (e) {
      container.innerHTML = '<h2>Melhorias</h2><div class="mensagem-erro visivel">Erro ao carregar</div>';
      return;
    }

    const nomesEstado = { em_progresso: 'Em progresso', meta_atingida: 'Meta atingida', finalizada: 'Finalizada' };

    container.innerHTML = `
      <h2>Melhorias</h2>
      <div class="painel-form" style="max-width:420px; margin-bottom:24px;">
        <h3>Adicionar à fila</h3>
        <div id="erro-melhoria" class="mensagem-erro"></div>
        <form id="form-melhoria">
          <div class="campo"><label for="mel-nome">Nome</label><input type="text" id="mel-nome" required></div>
          <div class="linha-campos">
            <div class="campo"><label for="mel-valor">Valor-alvo (R$)</label><input type="number" id="mel-valor" min="1" step="0.01" required></div>
            <div class="campo"><label for="mel-prioridade">Prioridade</label><input type="number" id="mel-prioridade" min="1" required></div>
          </div>
          <button type="submit" class="botao">Adicionar</button>
        </form>
      </div>

      <h3>Fila</h3>
      <div class="tabela-wrapper">
        <table class="tabela">
          <thead><tr><th>Prioridade</th><th>Nome</th><th>Valor-alvo</th><th>Estado</th><th></th></tr></thead>
          <tbody id="corpo-melhorias"></tbody>
        </table>
      </div>
    `;

    function renderFila() {
      document.getElementById('corpo-melhorias').innerHTML = fila
        .sort((a, b) => a.prioridade - b.prioridade)
        .map((m) => `
          <tr>
            <td><input type="number" class="input-prioridade" data-id="${m.id}" value="${m.prioridade}" style="width:60px;"></td>
            <td>${m.nome}</td>
            <td><input type="number" class="input-valor-alvo" data-id="${m.id}" value="${m.valor_alvo}" step="0.01" style="width:100px;"></td>
            <td>${nomesEstado[m.estado]}</td>
            <td>
              ${m.estado !== 'finalizada' ? `<button class="link-acao" data-acao="finalizar" data-id="${m.id}">Finalizar</button>` : ''}
              ${m.estado === 'em_progresso' ? `<button class="link-acao link-acao-erro" data-acao="excluir" data-id="${m.id}">Excluir</button>` : ''}
            </td>
          </tr>
        `).join('') || '<tr><td colspan="5">Fila vazia.</td></tr>';

      document.querySelectorAll('.input-prioridade').forEach((input) => {
        input.addEventListener('change', async () => {
          try {
            await api.patch(`/melhorias/${input.dataset.id}/prioridade`, { prioridade: Number(input.value) });
            views.melhorias(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao alterar prioridade');
          }
        });
      });

      document.querySelectorAll('.input-valor-alvo').forEach((input) => {
        input.addEventListener('change', async () => {
          try {
            await api.patch(`/melhorias/${input.dataset.id}/valor-alvo`, { valor_alvo: Number(input.value) });
            views.melhorias(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao alterar valor-alvo');
          }
        });
      });

      document.querySelectorAll('[data-acao="finalizar"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const valor_gasto = prompt('Valor efetivamente gasto (R$):');
          if (!valor_gasto) return;
          const mes = prompt('Mês de competência do gasto (AAAA-MM):', new Date().toISOString().slice(0, 7));
          if (!mes) return;
          try {
            await api.post(`/melhorias/${btn.dataset.id}/finalizar`, { valor_gasto: Number(valor_gasto), mes });
            alert('Melhoria finalizada. Lembre-se de fechar/reabrir o mês no Financeiro para o saldo refletir o gasto.');
            views.melhorias(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao finalizar melhoria');
          }
        });
      });

      document.querySelectorAll('[data-acao="excluir"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Remover este item da fila?')) return;
          try {
            await api.delete(`/melhorias/${btn.dataset.id}`);
            fila = fila.filter((m) => String(m.id) !== String(btn.dataset.id));
            renderFila();
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao excluir');
          }
        });
      });
    }

    document.getElementById('form-melhoria').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = document.getElementById('erro-melhoria');
      erroEl.classList.remove('visivel');
      try {
        const criada = await api.post('/melhorias', {
          nome: document.getElementById('mel-nome').value.trim(),
          valor_alvo: Number(document.getElementById('mel-valor').value),
          prioridade: Number(document.getElementById('mel-prioridade').value),
        });
        fila.push({ ...criada, estado: 'em_progresso' });
        document.getElementById('form-melhoria').reset();
        renderFila();
      } catch (err) {
        erroEl.textContent = err.dados?.erro || 'Erro ao adicionar melhoria';
        erroEl.classList.add('visivel');
      }
    });

    renderFila();
  },

  async comunicados(container) {
    container.innerHTML = '<h2>Comunicados</h2><p>Carregando...</p>';
    const ehSocio = usuarioAtual.perfil_id === 1;

    let lista = [];
    try {
      lista = await api.get('/comunicados');
    } catch (e) {
      container.innerHTML = '<h2>Comunicados</h2><div class="mensagem-erro visivel">Erro ao carregar</div>';
      return;
    }

    container.innerHTML = `
      <h2>Comunicados</h2>

      ${ehSocio ? `
        <div class="painel-form" style="max-width:520px; margin-bottom:24px;">
          <h3>Novo comunicado</h3>
          <div id="erro-comunicado" class="mensagem-erro"></div>
          <form id="form-comunicado">
            <div class="campo"><label for="com-titulo">Título</label><input type="text" id="com-titulo" required></div>
            <div class="campo"><label for="com-conteudo">Conteúdo</label><textarea id="com-conteudo" rows="4" required style="width:100%; background:var(--cor-fundo); border:1px solid var(--cor-borda); color:var(--cor-texto); padding:10px; font-family:var(--fonte-corpo);"></textarea></div>
            <label style="font-size:13px; color:var(--cor-texto-fraco); display:flex; align-items:center; gap:6px; margin-bottom:12px;">
              <input type="checkbox" id="com-obrigatorio"> Obrigatório (exige confirmação de leitura)
            </label>
            <button type="submit" class="botao">Publicar</button>
          </form>
          <button class="link-acao" id="botao-novo-motivo" style="margin-top:8px;">+ cadastrar nova categoria de motivo de edição</button>
        </div>
      ` : ''}

      <div id="lista-comunicados"></div>

      <div id="modal-historico-versoes" class="modal oculto">
        <div class="modal-conteudo" style="max-width:560px; max-height:80vh; overflow-y:auto;">
          <h3>Histórico de versões</h3>
          <div id="corpo-historico-versoes"></div>
          <button class="botao botao-secundario" id="botao-fechar-historico">Fechar</button>
        </div>
      </div>
    `;

    function renderLista() {
      const container2 = document.getElementById('lista-comunicados');
      if (lista.length === 0) {
        container2.innerHTML = '<p style="color:var(--cor-texto-fraco);">Nenhum comunicado no momento.</p>';
        return;
      }
      container2.innerHTML = lista.map((c) => `
        <div class="painel-form" style="max-width:640px; margin-bottom:16px;">
          <h3>${c.titulo} ${c.obrigatorio ? '<span class="badge-alerta" style="background:rgba(124,58,237,0.15); border-color:var(--cor-acento); color:#d8c4ff;">obrigatório</span>' : ''}</h3>
          <p style="white-space:pre-wrap;">${c.conteudo}</p>
          <p style="font-size:12px; color:var(--cor-texto-fraco);">
            v${c.versao_atual} · publicado em ${new Date(c.publicado_em).toLocaleString('pt-BR')}
            ${c.motivo_nome ? `· motivo: ${c.motivo_nome}${c.motivo_texto ? ` (${c.motivo_texto})` : ''}` : ''}
          </p>
          ${!ehSocio ? (
            c.confirmado_pelo_usuario
              ? '<p class="mensagem-sucesso" style="display:inline-block;">Leitura confirmada</p>'
              : `<button class="botao botao-secundario" data-acao="confirmar" data-id="${c.id}" style="width:auto;">Confirmar leitura</button>`
          ) : `
            <div style="margin-top:12px; display:flex; gap:8px;">
              <button class="link-acao" data-acao="editar" data-id="${c.id}" data-versao="${c.versao_atual}">Editar</button>
              <button class="link-acao" data-acao="historico" data-id="${c.id}">Ver histórico de versões</button>
              <button class="link-acao link-acao-erro" data-acao="excluir" data-id="${c.id}">Excluir</button>
            </div>
          `}
        </div>
      `).join('');

      container2.querySelectorAll('[data-acao="confirmar"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await api.post(`/comunicados/${btn.dataset.id}/confirmar`);
            views.comunicados(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao confirmar');
          }
        });
      });

      container2.querySelectorAll('[data-acao="historico"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            const versoes = await api.get(`/comunicados/${btn.dataset.id}/versoes`);
            const html = versoes.map((v) => `
              <div style="border-bottom:1px solid var(--cor-borda); padding:10px 0;">
                <p style="margin:0; font-size:13px; color:var(--cor-texto-fraco);">
                  v${v.versao} · ${new Date(v.publicado_em).toLocaleString('pt-BR')}
                  ${v.motivo_nome ? `· Motivo: ${v.motivo_nome}${v.motivo_texto ? ` (${v.motivo_texto})` : ''}` : ' · versão inicial'}
                </p>
                <p style="margin:4px 0 0; white-space:pre-wrap;">${v.conteudo}</p>
              </div>
            `).join('');
            document.getElementById('corpo-historico-versoes').innerHTML = html;
            document.getElementById('modal-historico-versoes').classList.remove('oculto');
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao carregar histórico');
          }
        });
      });

      container2.querySelectorAll('[data-acao="excluir"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este comunicado?')) return;
          try {
            await api.delete(`/comunicados/${btn.dataset.id}`);
            lista = lista.filter((c) => String(c.id) !== String(btn.dataset.id));
            renderLista();
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao excluir');
          }
        });
      });

      container2.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const comunicado = lista.find((c) => String(c.id) === String(btn.dataset.id));
          const novoConteudo = prompt('Novo conteúdo:', comunicado.conteudo);
          if (novoConteudo === null || novoConteudo.trim() === '') return;

          let motivos = [];
          try {
            motivos = await api.get('/comunicados/motivos');
          } catch (e) { /* segue sem categorias se falhar */ }

          const listaMotivos = motivos.map((m, i) => `${i + 1}. ${m.nome}`).join('\n');
          const escolha = prompt(`Motivo da edição — escolha o número:\n${listaMotivos}`);
          const motivoEscolhido = motivos[Number(escolha) - 1];
          if (!motivoEscolhido) return alert('Motivo inválido.');

          const motivoTexto = prompt('Comentário adicional sobre a edição (opcional):') || undefined;

          try {
            const resultado = await api.put(`/comunicados/${btn.dataset.id}`, {
              conteudo: novoConteudo,
              versao_base: btn.dataset.versao,
              motivo_categoria_id: motivoEscolhido.id,
              motivo_texto: motivoTexto,
            });
            if (resultado.aviso) alert(resultado.aviso);
            views.comunicados(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao editar');
          }
        });
      });
    }

    if (ehSocio) {
      document.getElementById('form-comunicado').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-comunicado');
        erroEl.classList.remove('visivel');
        try {
          await api.post('/comunicados', {
            titulo: document.getElementById('com-titulo').value.trim(),
            conteudo: document.getElementById('com-conteudo').value.trim(),
            obrigatorio: document.getElementById('com-obrigatorio').checked,
          });
          views.comunicados(container);
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao publicar';
          erroEl.classList.add('visivel');
        }
      });

      document.getElementById('botao-novo-motivo').addEventListener('click', async () => {
        const nome = prompt('Nome da nova categoria de motivo:');
        if (!nome || !nome.trim()) return;
        try {
          await api.post('/comunicados/motivos', { nome: nome.trim() });
          alert('Categoria cadastrada.');
        } catch (err) {
          alert(err.dados?.erro || 'Erro ao cadastrar categoria');
        }
      });
    }

    renderLista();

    document.getElementById('botao-fechar-historico').addEventListener('click', () => {
      document.getElementById('modal-historico-versoes').classList.add('oculto');
    });
  },
};

// ---------- VERIFICAÇÃO DE SESSÃO EXISTENTE AO CARREGAR A PÁGINA ----------
(async function verificarSessao() {
  try {
    const dados = await api.get('/auth/me');
    usuarioAtual = dados;
    roteamentoPosLogin();
  } catch (err) {
    mostrarTela('login');
  }
})();
