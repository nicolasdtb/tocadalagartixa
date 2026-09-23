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
