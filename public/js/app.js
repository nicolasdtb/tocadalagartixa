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
