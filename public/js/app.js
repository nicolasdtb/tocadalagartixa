const telas = {
  login: document.getElementById('tela-login'),
  primeiroAcesso: document.getElementById('tela-primeiro-acesso'),
  trocarSenha: document.getElementById('tela-trocar-senha'),
  appShell: document.getElementById('app-shell'),
};

let usuarioAtual = null;

// Escapa texto vindo de usuários antes de inserir em HTML (evita injeção de código).
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- OVERLAY DE TELA CHEIA (padrão reutilizável de criação/edição) ----------
function abrirOverlay(titulo, htmlCorpo) {
  fecharOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'overlay-ativo';
  overlay.className = 'overlay-tela';
  overlay.innerHTML = `
    <div class="overlay-conteudo">
      <div class="overlay-cabecalho">
        <h3>${titulo}</h3>
        <button class="overlay-fechar" aria-label="Fechar" type="button">&times;</button>
      </div>
      <div class="overlay-corpo">${htmlCorpo}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharOverlay(); });
  overlay.querySelector('.overlay-fechar').addEventListener('click', fecharOverlay);
  document.body.appendChild(overlay);
  return overlay;
}
function fecharOverlay() {
  const el = document.getElementById('overlay-ativo');
  if (el) el.remove();
}

// ---------- BOTÃO FIXO DE AÇÃO PRINCIPAL (rodapé) ----------
function mostrarBotaoFixoRodape(texto, aoClicar) {
  let btn = document.getElementById('botao-fixo-rodape');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'botao-fixo-rodape';
    btn.className = 'botao-fixo-rodape';
    btn.type = 'button';
    document.body.appendChild(btn);
  }
  btn.textContent = texto;
  btn.onclick = aoClicar;
  btn.classList.remove('oculto');
}
function esconderBotaoFixoRodape() {
  const btn = document.getElementById('botao-fixo-rodape');
  if (btn) btn.classList.add('oculto');
}

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
async function fazerLogout() {
  await api.post('/auth/logout');
  usuarioAtual = null;
  location.reload();
}

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
  botao.addEventListener('click', () => {
    if (botao.dataset.view === 'sair') {
      fazerLogout();
    } else {
      navegarPara(botao.dataset.view);
    }
  });
});

function navegarPara(view) {
  esconderBotaoFixoRodape();
  atualizarNotificacoes();
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
    const ehSocio = usuarioAtual.perfil_id === 1;
    const agora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hojeStr = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
    const mesRef = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}`;
    const primeiroNome = (usuarioAtual.nome || '').split(' ')[0];

    const vazio = (t) => `<p class="card-item-meta">${esc(t)}</p>`;
    const dia = (d) => String(d).slice(0, 10);
    const fmtData = (d) => new Date(dia(d) + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const barra = (pct) => `<div class="barra-progresso"><div class="barra-progresso-preenchida" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;

    // Definição dos cards: cada um carrega o próprio conteúdo de forma independente.
    const definicoes = [
      {
        id: 'agendamentos', titulo: 'Próximos agendamentos', destino: 'agenda', visivel: () => true,
        carregar: async () => {
          const todos = await api.get('/agendamentos');
          const meus = ehSocio ? todos : todos.filter((a) => String(a.usuario_id) === String(usuarioAtual.id));
          const proximos = meus
            .filter((a) => dia(a.data) >= hojeStr)
            .sort((a, b) => (dia(a.data) + a.horario).localeCompare(dia(b.data) + b.horario))
            .slice(0, 5);
          if (!proximos.length) return vazio('Nenhum agendamento pela frente.');
          return proximos.map((a) => `
            <div class="inicio-item"><strong>${esc(fmtData(a.data))} · ${esc(a.horario.slice(0, 5))}</strong><span>${esc(a.responsavel)}</span></div>
          `).join('');
        },
      },
      {
        id: 'meta', titulo: 'Minha meta', destino: 'metas', visivel: () => !ehSocio,
        carregar: async () => {
          const m = await api.get('/metas/individual');
          const pct = m.nivel_maximo_atingido ? 100 : (m.acumulado_mes / Number(m.proximo_nivel.repasse_minimo)) * 100;
          return `
            <p class="inicio-valor">R$ ${Number(m.acumulado_mes).toFixed(2)}</p>
            ${barra(pct)}
            <p class="card-item-meta" style="margin-top:10px;">${m.nivel_maximo_atingido
              ? 'Nível máximo atingido'
              : `Faltam R$ ${Number(m.falta_para_proximo).toFixed(2)} para o Nível ${m.proximo_nivel.nivel}`}</p>
          `;
        },
      },
      {
        id: 'ranking', titulo: 'Ranking do mês', destino: null, visivel: () => true,
        carregar: async () => {
          const r = await api.get('/inicio/ranking');
          if (!r.length) return vazio('Nenhum residente ativo.');
          return r.filter((l, i) => i < 5 || l.voce).map((l) => `
            <div class="ranking-linha ${l.voce ? 'voce' : ''}">
              <span class="ranking-pos ${l.posicao && l.posicao <= 3 ? 'p' + l.posicao : ''}">${l.posicao ?? '–'}</span>
              <span class="ranking-nome">${esc(l.nome)}${l.voce ? ' (você)' : ''}</span>
            </div>
          `).join('');
        },
      },
      {
        id: 'estoque', titulo: 'Estoque', destino: 'estoque', visivel: () => true,
        carregar: async () => {
          const mats = (await api.get('/estoque/materiais')).filter((m) => m.status);
          const proximos = [...mats]
            .sort((a, b) => (Number(a.quantidade) - Number(a.minimo)) - (Number(b.quantidade) - Number(b.minimo)))
            .slice(0, 5);
          if (!proximos.length) return vazio('Nenhum material cadastrado.');
          const iconeAlerta = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" style="color:var(--cor-vermelho); flex-shrink:0;"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17h.01"/></svg>';
          return proximos.map((m) => `
            <div class="inicio-item">
              <strong style="display:flex; align-items:center; gap:6px;">${m.estoque_baixo ? iconeAlerta : ''}${esc(m.nome)}</strong>
              <span>${Number(m.quantidade)} ${esc(m.unidade)}</span>
            </div>
          `).join('');
        },
      },
      {
        id: 'melhorias', titulo: 'Melhoria atual', destino: 'melhorias', visivel: () => true,
        carregar: async () => {
          const a = await api.get('/melhorias/atual');
          if (!a.melhoria_atual) return vazio(a.mensagem || 'Nenhuma melhoria em andamento.');
          return `
            <p class="inicio-destaque">${esc(a.melhoria_atual)}</p>
            ${barra(a.progresso_percentual)}
            <p class="card-item-meta" style="margin-top:10px;">R$ ${Number(a.valor_acumulado).toFixed(2)} de R$ ${Number(a.valor_alvo).toFixed(2)}
              ${a.estado === 'meta_atingida' ? '<span class="badge badge-verde">meta atingida</span>' : ''}</p>
          `;
        },
      },
      {
        id: 'comunicado', titulo: 'Último comunicado', destino: 'comunicados', visivel: () => true,
        carregar: async () => {
          const lista = await api.get('/comunicados');
          if (!lista.length) return vazio('Nenhum comunicado publicado.');
          const c = lista[0];
          let selo = '';
          if (c.obrigatorio) {
            selo = ehSocio
              ? '<span class="badge badge-escarlate">Obrigatório</span>'
              : (c.confirmado_pelo_usuario
                ? '<span class="badge badge-verde">Confirmado</span>'
                : '<span class="badge badge-escarlate">Pendente de confirmação</span>');
          }
          return `
            <p class="inicio-destaque texto-clamp-1">${esc(c.titulo)}</p>
            <p class="card-item-texto texto-clamp-4" style="margin:6px 0 10px;">${esc(c.conteudo)}</p>
            ${selo}
          `;
        },
      },
      {
        id: 'financeiro', titulo: 'Financeiro do mês', destino: 'financeiro', visivel: () => ehSocio,
        carregar: async () => {
          const p = await api.get(`/financeiro/fechamento/${mesRef}/preview`);
          return `
            <p class="inicio-valor">R$ ${p.E.toFixed(2)}</p>
            <p class="card-item-meta" style="margin-bottom:10px;">entradas no mês</p>
            <div class="inicio-item"><span>Destinado a Melhorias</span><strong>R$ ${p.I.toFixed(2)}</strong></div>
            <div class="inicio-item"><span>Marketing</span><strong>R$ ${p.K.toFixed(2)}</strong></div>
          `;
        },
      },
    ];

    const disponiveis = definicoes.filter((d) => d.visivel());
    const idsDisponiveis = disponiveis.map((d) => d.id);
    const chavePrefs = `toca_inicio_prefs_${usuarioAtual.id}`;
    const conteudos = {};
    let modoEdicao = false;
    let arrastandoId = null;

    function carregarPrefs() {
      try { return JSON.parse(localStorage.getItem(chavePrefs)) || {}; } catch (e) { return {}; }
    }
    function salvarPrefs(p) {
      try { localStorage.setItem(chavePrefs, JSON.stringify(p)); } catch (e) { /* sem armazenamento: só não persiste */ }
    }
    let prefs = carregarPrefs();

    // Ordem salva + cards novos (que ainda não estavam nas preferências) no final.
    function ordemCompleta() {
      const salva = (prefs.ordem || []).filter((id) => idsDisponiveis.includes(id));
      return [...salva, ...idsDisponiveis.filter((id) => !salva.includes(id))];
    }
    function idsOcultos() {
      return (prefs.ocultos || []).filter((id) => idsDisponiveis.includes(id));
    }
    function persistir(ordem, ocultos) {
      prefs = { ordem, ocultos };
      salvarPrefs(prefs);
    }

    const chevronCima = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 15l6-6 6 6"/></svg>';
    const chevronBaixo = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>';

    container.innerHTML = `
      <div class="inicio-topo">
        <h2>Olá${primeiroNome ? ', ' + esc(primeiroNome) : ''}</h2>
        <div class="inicio-acoes">
          <button type="button" class="link-acao oculto" id="inicio-restaurar">Restaurar padrão</button>
          <button type="button" class="link-acao" id="inicio-personalizar">Personalizar</button>
        </div>
      </div>
      <div id="inicio-grid" class="inicio-grid"></div>
      <div id="inicio-ocultos" class="inicio-ocultos oculto"></div>
    `;

    const grid = document.getElementById('inicio-grid');

    function renderGrid() {
      const ocultos = idsOcultos();
      const visiveis = ordemCompleta().filter((id) => !ocultos.includes(id));

      grid.innerHTML = visiveis.map((id, i) => {
        const def = disponiveis.find((d) => d.id === id);
        const corpo = id in conteudos ? conteudos[id] : '<p class="card-item-meta">Carregando...</p>';
        return `
          <section class="inicio-card ${modoEdicao ? 'editando' : ''}" data-card="${id}" ${modoEdicao ? 'draggable="true"' : ''}>
            ${modoEdicao ? `
              <div class="inicio-controles">
                <button type="button" class="link-acao" data-mover="cima" data-id="${id}" ${i === 0 ? 'disabled' : ''} aria-label="Mover para cima">${chevronCima}</button>
                <button type="button" class="link-acao" data-mover="baixo" data-id="${id}" ${i === visiveis.length - 1 ? 'disabled' : ''} aria-label="Mover para baixo">${chevronBaixo}</button>
                <button type="button" class="link-acao link-acao-erro" data-ocultar="${id}">Ocultar</button>
              </div>` : ''}
            <div class="inicio-card-topo">
              <h3>${def.titulo}</h3>
              ${def.destino && !modoEdicao ? `<button type="button" class="link-acao" data-ir="${def.destino}">Abrir</button>` : ''}
            </div>
            <div class="inicio-card-corpo">${corpo}</div>
          </section>
        `;
      }).join('') || '<p class="card-item-meta">Todos os cards estão ocultos. Use "Personalizar" para mostrá-los de novo.</p>';

      const areaOcultos = document.getElementById('inicio-ocultos');
      areaOcultos.classList.toggle('oculto', !(modoEdicao && ocultos.length));
      areaOcultos.innerHTML = ocultos.length ? `
        <p class="card-item-meta" style="margin:0 0 10px;">Cards ocultos</p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${ocultos.map((id) => `<button type="button" class="link-acao" data-mostrar="${id}">+ ${disponiveis.find((d) => d.id === id).titulo}</button>`).join('')}
        </div>` : '';

      document.getElementById('inicio-personalizar').textContent = modoEdicao ? 'Concluir' : 'Personalizar';
      document.getElementById('inicio-restaurar').classList.toggle('oculto', !modoEdicao);
    }

    function mover(id, sentido) {
      const ordem = ordemCompleta();
      const ocultos = idsOcultos();
      const i = ordem.indexOf(id);
      let j = i + (sentido === 'cima' ? -1 : 1);
      while (j >= 0 && j < ordem.length && ocultos.includes(ordem[j])) j += (sentido === 'cima' ? -1 : 1);
      if (j < 0 || j >= ordem.length) return;
      [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      persistir(ordem, ocultos);
      renderGrid();
    }

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.ir) navegarPara(btn.dataset.ir);
      else if (btn.dataset.mover) mover(btn.dataset.id, btn.dataset.mover);
      else if (btn.dataset.ocultar) {
        persistir(ordemCompleta(), [...idsOcultos(), btn.dataset.ocultar]);
        renderGrid();
      }
    });

    document.getElementById('inicio-ocultos').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mostrar]');
      if (!btn) return;
      persistir(ordemCompleta(), idsOcultos().filter((id) => id !== btn.dataset.mostrar));
      renderGrid();
    });

    // Arrastar e soltar (desktop). No celular, as setas do modo "Personalizar" fazem o mesmo.
    grid.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.inicio-card');
      if (!card || !modoEdicao) return;
      arrastandoId = card.dataset.card;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', arrastandoId);
      card.classList.add('arrastando');
    });
    grid.addEventListener('dragend', (e) => {
      arrastandoId = null;
      const card = e.target.closest('.inicio-card');
      if (card) card.classList.remove('arrastando');
    });
    grid.addEventListener('dragover', (e) => { if (arrastandoId) e.preventDefault(); });
    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      const alvo = e.target.closest('.inicio-card');
      if (!alvo || !arrastandoId || alvo.dataset.card === arrastandoId) return;
      const ordem = ordemCompleta().filter((id) => id !== arrastandoId);
      ordem.splice(ordem.indexOf(alvo.dataset.card), 0, arrastandoId);
      persistir(ordem, idsOcultos());
      arrastandoId = null;
      renderGrid();
    });

    document.getElementById('inicio-personalizar').addEventListener('click', () => {
      modoEdicao = !modoEdicao;
      renderGrid();
    });
    document.getElementById('inicio-restaurar').addEventListener('click', () => {
      prefs = {};
      try { localStorage.removeItem(chavePrefs); } catch (e) { /* ignora */ }
      renderGrid();
    });

    renderGrid();

    // Cada card busca seus dados sozinho: falha em um não afeta os outros.
    disponiveis.forEach((def) => {
      def.carregar()
        .then((html) => { conteudos[def.id] = html; })
        .catch(() => { conteudos[def.id] = '<p class="card-item-meta">Não foi possível carregar.</p>'; })
        .then(() => {
          const el = document.querySelector(`[data-card="${def.id}"] .inicio-card-corpo`);
          if (el) el.innerHTML = conteudos[def.id];
        });
    });
  },

  async agenda(container) {
    container.innerHTML = '<h2>Agenda</h2><p>Carregando...</p>';
    const ehSocio = usuarioAtual.perfil_id === 1;

    let residentes = [];
    if (ehSocio) {
      try {
        const usuarios = await api.get('/usuarios');
        residentes = usuarios.filter((u) => u.perfil_id === 2 && u.status);
      } catch (e) { /* segue sem lista se falhar */ }
    }

    let agendamentos = [];
    try {
      agendamentos = await api.get('/agendamentos');
    } catch (e) {
      container.innerHTML = '<h2>Agenda</h2><div class="mensagem-erro visivel">Erro ao carregar agendamentos</div>';
      return;
    }

    const hoje = new Date();
    let mesAtual = hoje.getMonth();
    let anoAtual = hoje.getFullYear();

    container.innerHTML = `
      <h2>Agenda</h2>
      <div class="calendario-cabecalho-mes">
        <button type="button" id="cal-mes-anterior" aria-label="Mês anterior">&#8249;</button>
        <h3 id="cal-mes-label"></h3>
        <button type="button" id="cal-mes-proximo" aria-label="Próximo mês">&#8250;</button>
      </div>
      <div class="calendario-dias-semana">
        <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
      </div>
      <div class="calendario-grid" id="calendario-grid"></div>
    `;

    function agendamentosDoDia(dataStr) {
      return agendamentos.filter((a) => String(a.data).slice(0, 10) === dataStr)
        .sort((a, b) => a.horario.localeCompare(b.horario));
    }

    function renderCalendario() {
      const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      document.getElementById('cal-mes-label').textContent = `${nomesMes[mesAtual]} de ${anoAtual}`;

      const primeiroDiaSemana = new Date(anoAtual, mesAtual, 1).getDay();
      const totalDias = new Date(anoAtual, mesAtual + 1, 0).getDate();
      const hojeStr = new Date().toISOString().slice(0, 10);

      let html = '';
      for (let i = 0; i < primeiroDiaSemana; i++) {
        html += '<div class="calendario-dia vazio"></div>';
      }
      for (let dia = 1; dia <= totalDias; dia++) {
        const dataStr = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const qtd = agendamentosDoDia(dataStr).length;
        html += `
          <button type="button" class="calendario-dia ${dataStr === hojeStr ? 'hoje' : ''}" data-data="${dataStr}">
            <span>${dia}</span>
            ${qtd > 0 ? `<span class="ponto"></span>` : ''}
          </button>
        `;
      }

      const grid = document.getElementById('calendario-grid');
      grid.innerHTML = html;
      grid.querySelectorAll('.calendario-dia:not(.vazio)').forEach((el) => {
        el.addEventListener('click', () => abrirDia(el.dataset.data));
      });
    }

    function abrirDia(dataStr) {
      const doDia = agendamentosDoDia(dataStr);
      const dataFmt = new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

      const html = `
        <div id="lista-dia-agendamentos" class="lista-cards" style="margin-bottom:16px;"></div>
        <button type="button" class="botao" id="botao-novo-agendamento-dia">+ Novo agendamento neste dia</button>
      `;
      abrirOverlay(dataFmt, html);

      function renderListaDia() {
        const alvo = document.getElementById('lista-dia-agendamentos');
        if (doDia.length === 0) {
          alvo.innerHTML = '<p style="color:var(--cor-texto-fraco);">Nenhum agendamento neste dia.</p>';
          return;
        }
        alvo.innerHTML = doDia.map((ag) => {
          const podeEditar = ehSocio || Number(ag.usuario_id) === Number(usuarioAtual.id);
          return `
            <div class="card-item">
              <div class="card-item-topo"><h3>${ag.responsavel}</h3></div>
              <p class="card-item-meta">${ag.horario.slice(0,5)} · R$ ${Number(ag.valor).toFixed(2)} · repasse R$ ${Number(ag.repasse).toFixed(2)} (${Number(ag.percentual)}%)</p>
              ${podeEditar ? `
                <div class="card-item-acoes">
                  <button class="link-acao" data-acao="editar" data-id="${ag.id}">Editar</button>
                  <button class="link-acao link-acao-erro" data-acao="excluir" data-id="${ag.id}">Excluir</button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

        alvo.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const ag = agendamentos.find((a) => String(a.id) === String(btn.dataset.id));
            abrirFormularioAgendamento({ dataPreenchida: dataStr, agendamento: ag });
          });
        });
        alvo.querySelectorAll('[data-acao="excluir"]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!confirm('Excluir este agendamento?')) return;
            try {
              await api.delete(`/agendamentos/${btn.dataset.id}`);
              agendamentos = agendamentos.filter((a) => String(a.id) !== String(btn.dataset.id));
              fecharOverlay();
              renderCalendario();
            } catch (err) {
              alert(err.dados?.erro || 'Erro ao excluir');
            }
          });
        });
      }
      renderListaDia();

      document.getElementById('botao-novo-agendamento-dia').addEventListener('click', () => {
        abrirFormularioAgendamento({ dataPreenchida: dataStr });
      });
    }

    function abrirFormularioAgendamento({ dataPreenchida, agendamento } = {}) {
      const opcoesResidentes = residentes
        .map((r) => `<option value="${r.id}" ${agendamento && String(agendamento.usuario_id) === String(r.id) ? 'selected' : ''}>${r.nome}</option>`)
        .join('');

      const corpo = `
        <div id="erro-agendamento-overlay" class="mensagem-erro"></div>
        <form id="form-agendamento-overlay">
          ${ehSocio ? `
            <div class="campo">
              <label for="ag2-usuario">Residente</label>
              <select id="ag2-usuario" required>
                <option value="">Selecione...</option>
                ${opcoesResidentes}
              </select>
            </div>` : ''}
          <div class="linha-campos">
            <div class="campo"><label for="ag2-data">Data</label><input type="date" id="ag2-data" value="${agendamento ? String(agendamento.data).slice(0,10) : (dataPreenchida || '')}" required></div>
            <div class="campo"><label for="ag2-horario">Horário</label><input type="time" id="ag2-horario" value="${agendamento ? agendamento.horario.slice(0,5) : ''}" required></div>
          </div>
          <div class="linha-campos">
            <div class="campo"><label for="ag2-duracao">Duração aprox. (min)</label><input type="number" id="ag2-duracao" min="1" value="${agendamento?.duracao || ''}"></div>
            <div class="campo"><label for="ag2-valor">Valor da tattoo (R$)</label><input type="number" id="ag2-valor" min="100" step="0.01" value="${agendamento?.valor || ''}" required></div>
          </div>
          <button type="submit" class="botao">${agendamento ? 'Salvar alterações' : 'Criar agendamento'}</button>
        </form>
      `;
      abrirOverlay(agendamento ? 'Editar agendamento' : 'Novo agendamento', corpo);

      document.getElementById('form-agendamento-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-agendamento-overlay');
        erroEl.classList.remove('visivel');

        const corpoReq = {
          data: document.getElementById('ag2-data').value,
          horario: document.getElementById('ag2-horario').value,
          duracao: document.getElementById('ag2-duracao').value || undefined,
          valor: Number(document.getElementById('ag2-valor').value),
        };
        if (ehSocio) corpoReq.usuario_id = document.getElementById('ag2-usuario').value;

        try {
          if (agendamento) {
            const atualizado = await api.put(`/agendamentos/${agendamento.id}`, corpoReq);
            agendamentos = agendamentos.map((a) => String(a.id) === String(agendamento.id) ? { ...a, ...atualizado, responsavel: a.responsavel } : a);
          } else {
            const criado = await api.post('/agendamentos', corpoReq);
            const nomeResponsavel = ehSocio
              ? (residentes.find((r) => String(r.id) === String(corpoReq.usuario_id))?.nome || '')
              : usuarioAtual.nome;
            agendamentos.push({ ...criado, responsavel: nomeResponsavel });
          }
          fecharOverlay();
          renderCalendario();
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao salvar agendamento';
          erroEl.classList.add('visivel');
        }
      });
    }

    document.getElementById('cal-mes-anterior').addEventListener('click', () => {
      mesAtual--;
      if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
      renderCalendario();
    });
    document.getElementById('cal-mes-proximo').addEventListener('click', () => {
      mesAtual++;
      if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
      renderCalendario();
    });

    renderCalendario();
    mostrarBotaoFixoRodape('+ Novo agendamento', () => abrirFormularioAgendamento());
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
      <h2>Minha Meta</h2>
      <div class="painel-form" style="max-width:480px; position:relative;">
        <button class="botao-info-canto" id="botao-ver-niveis" title="Ver todos os níveis" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 1.8-2.5 3.5"/><circle cx="12" cy="16.7" r="0.6" fill="currentColor"/></svg>
        </button>
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
    `;

    document.getElementById('botao-ver-niveis').addEventListener('click', async () => {
      const niveis = await api.get('/metas/niveis');
      const html = `
        <table class="tabela">
          <thead><tr><th>Nível</th><th>Repasse mínimo</th><th>Benefício</th></tr></thead>
          <tbody>
            ${niveis.map((n) => `<tr><td>${n.nivel}</td><td>R$ ${Number(n.repasse_minimo).toFixed(2)}</td><td>R$ ${Number(n.valor).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      `;
      abrirOverlay('Todos os níveis', html);
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
      const badgeStatus = { 1: 'badge-escarlate', 2: 'badge-roxo', 3: 'badge-verde' };

      container.innerHTML = `
        <h2>Benefícios</h2>
        <div id="lista-beneficios" class="lista-compacta"></div>
      `;

      function renderResumo() {
        const alvo = document.getElementById('lista-beneficios');
        const brl = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
        alvo.innerHTML = resumo.map((r) => `
          <div class="card-item ben-linha">
            <span class="ben-nome">${r.nome ? esc(r.nome) : '<em class="ben-sem-nome">Aguardando primeiro acesso</em>'}</span>
            <span class="ben-repasse"><small>Repasse</small>${brl(r.repasse_acumulado)}</span>
            <span class="ben-valor"><small>Benefício</small>${r.valor_beneficio ? brl(r.valor_beneficio) : '—'}</span>
            <span class="ben-status">${r.status_id ? `<span class="badge ${badgeStatus[r.status_id]}">${nomesStatus[r.status_id]}</span>` : '<span class="lanc-data">Sem solicitação</span>'}</span>
            <span class="ben-acao">${r.status_id === 1 ? `<button class="link-acao" data-acao="aprovar" data-id="${r.beneficio_id}">Aprovar</button>` : ''}
              ${r.status_id === 2 ? `<button class="link-acao" data-acao="pagar" data-id="${r.beneficio_id}">Marcar como pago</button>` : ''}</span>
          </div>
        `).join('') || '<p style="color:var(--cor-texto-fraco);">Nenhum residente ativo.</p>';

        alvo.querySelectorAll('[data-acao="aprovar"], [data-acao="pagar"]').forEach((btn) => {
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
      }

      renderResumo();
      return;
    }

    // Visão do residente
    let categorias = [];
    try {
      categorias = await api.get('/beneficios/categorias');
    } catch (e) {}

    container.innerHTML = `
      <h2>Benefícios</h2>
      <div id="msg-beneficio-residente"></div>
      <p style="color:var(--cor-texto-fraco);">Use o botão abaixo para solicitar o benefício do mês (só é possível uma solicitação por mês).</p>
    `;

    function abrirFormularioSolicitar() {
      const corpo = `
        <div id="erro-beneficio-overlay" class="mensagem-erro"></div>
        <form id="form-beneficio-overlay">
          <div class="campo">
            <label for="ben2-categoria">Categoria</label>
            <select id="ben2-categoria" required>
              <option value="">Selecione...</option>
              ${categorias.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="botao">Solicitar benefício do mês</button>
        </form>
      `;
      abrirOverlay('Solicitar benefício', corpo);

      document.getElementById('form-beneficio-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-beneficio-overlay');
        erroEl.classList.remove('visivel');
        try {
          const resultado = await api.post('/beneficios/solicitar', { categoria_id: document.getElementById('ben2-categoria').value });
          fecharOverlay();
          document.getElementById('msg-beneficio-residente').innerHTML = `<p class="mensagem-sucesso">Benefício solicitado: R$ ${Number(resultado.valor).toFixed(2)}. Aguarde aprovação do sócio.</p>`;
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao solicitar benefício';
          erroEl.classList.add('visivel');
        }
      });
    }

    mostrarBotaoFixoRodape('+ Solicitar benefício', abrirFormularioSolicitar);
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

    container.innerHTML = `
      <h2>Estoque ${ehSocio ? '<button class="link-acao" id="botao-novo-material" style="font-size:14px;">+ cadastrar material</button>' : ''}</h2>
      <div id="lista-materiais" class="lista-cards"></div>
    `;

    function renderMateriais() {
      const alvo = document.getElementById('lista-materiais');
      alvo.innerHTML = materiais.map((m) => `
        <div class="card-item ${m.estoque_baixo ? 'card-destaque' : ''}">
          <div class="card-item-topo">
            <h3>${m.nome}</h3>
            ${m.estoque_baixo ? '<span class="badge badge-escarlate">Estoque baixo</span>' : ''}
            ${!m.status ? '<span class="badge" style="background:rgba(255,255,255,0.08); border:1px solid var(--cor-borda); color:var(--cor-texto-fraco);">Inativo</span>' : ''}
          </div>
          <p class="card-item-meta">${Number(m.quantidade)} ${m.unidade} em estoque · mínimo ${Number(m.minimo)}</p>
          ${ehSocio ? `
            <div class="card-item-acoes">
              <button class="link-acao" data-acao="status" data-id="${m.id}" data-status="${!m.status}">${m.status ? 'Desativar' : 'Ativar'}</button>
            </div>
          ` : ''}
        </div>
      `).join('') || '<p style="color:var(--cor-texto-fraco);">Nenhum material cadastrado.</p>';

      alvo.querySelectorAll('[data-acao="status"]').forEach((btn) => {
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

    function abrirFormularioMaterial() {
      const corpo = `
        <div id="erro-material-overlay" class="mensagem-erro"></div>
        <form id="form-material-overlay">
          <div class="campo"><label for="mat-nome">Nome</label><input type="text" id="mat-nome" required></div>
          <div class="linha-campos">
            <div class="campo"><label for="mat-unidade">Unidade</label><input type="text" id="mat-unidade" placeholder="unidade, caixa, litro..." required></div>
            <div class="campo"><label for="mat-minimo">Qtd. mínima de alerta</label><input type="number" id="mat-minimo" min="0" step="0.01"></div>
          </div>
          <button type="submit" class="botao">Cadastrar</button>
        </form>
      `;
      abrirOverlay('Cadastrar material', corpo);

      document.getElementById('form-material-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-material-overlay');
        erroEl.classList.remove('visivel');
        try {
          const criado = await api.post('/estoque/materiais', {
            nome: document.getElementById('mat-nome').value.trim(),
            unidade: document.getElementById('mat-unidade').value.trim(),
            minimo: document.getElementById('mat-minimo').value || 0,
          });
          materiais.push(criado);
          fecharOverlay();
          renderMateriais();
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao cadastrar';
          erroEl.classList.add('visivel');
        }
      });
    }

    function abrirFormularioMovimentacao() {
      const opcoesMateriais = materiais
        .map((m) => `<option value="${m.id}">${m.nome} (${Number(m.quantidade)} ${m.unidade})</option>`)
        .join('');

      const corpo = `
        <div id="erro-mov-overlay" class="mensagem-erro"></div>
        <form id="form-mov-overlay">
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
      `;
      abrirOverlay('Nova movimentação', corpo);

      document.getElementById('form-mov-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-mov-overlay');
        erroEl.classList.remove('visivel');
        try {
          await api.post('/estoque/movimentacoes', {
            material_id: document.getElementById('mov-material').value,
            tipo_id: Number(document.getElementById('mov-tipo').value),
            quantidade: Number(document.getElementById('mov-quantidade').value),
            observacao: document.getElementById('mov-obs').value || undefined,
          });
          fecharOverlay();
          views.estoque(container);
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao registrar movimentação';
          erroEl.classList.add('visivel');
        }
      });
    }

    if (ehSocio) {
      document.getElementById('botao-novo-material').addEventListener('click', abrirFormularioMaterial);
    }

    renderMateriais();
    mostrarBotaoFixoRodape('+ Nova movimentação', abrirFormularioMovimentacao);
  },


  async financeiro(container) {
    if (usuarioAtual.perfil_id !== 1) {
      container.innerHTML = '<h2>Financeiro</h2><p>Acesso restrito aos sócios.</p>';
      return;
    }

    const hoje = new Date();
    let mesIdx = hoje.getMonth();
    let ano = hoje.getFullYear();
    const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const CATS = [
      { id: 1, nome: 'Operacional', cor: 'var(--cor-acento)', icone: '<path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>' },
      { id: 2, nome: 'Materiais', cor: 'var(--cor-texto-fraco)', icone: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>' },
      { id: 3, nome: 'Benefícios', cor: 'var(--cor-acento)', icone: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M15.5 14.2c2.3.4 4 2.2 4 4.8"/>' },
      { id: 4, nome: 'Marketing', cor: 'var(--cor-vermelho)', icone: '<path d="M3 11a9 9 0 0118 0v6a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3"/><path d="M9 19a2 2 0 004 0"/>' },
      { id: 5, nome: 'Melhorias', cor: 'var(--cor-sucesso)', icone: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>' },
    ];
    const chavesBanco = { 1: 'operacional', 2: 'materiais', 3: 'beneficios', 4: 'marketing', 5: 'melhorias' };
    const nomesTipoLancamento = { 1: 'Entrada', 2: 'Gasto', 3: 'Ajuste' };
    const badgeTipoLancamento = { 1: 'badge-verde', 2: 'badge-escarlate', 3: 'badge-roxo' };

    function mesRef() { return `${ano}-${String(mesIdx + 1).padStart(2, '0')}`; }
    function pct(parte, total) { return total > 0 ? Math.min(100, (parte / total) * 100) : 0; }

    container.innerHTML = `
      <div class="fin-cabecalho">
        <h2 style="margin:0;">Financeiro</h2>
        <div class="fin-acoes-mes">
          <button type="button" class="botao-pill" id="fin-botao-fechar">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>
            Fechar mês
          </button>
          <button type="button" class="botao-pill botao-pill-secundario" id="fin-botao-reabrir">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 017.8-1.3"/></svg>
            Reabrir mês
          </button>
        </div>
      </div>

      <div class="calendario-cabecalho-mes" style="max-width:340px;">
        <button type="button" id="fin-mes-anterior" aria-label="Mês anterior">&#8249;</button>
        <h3 id="fin-mes-label"></h3>
        <button type="button" id="fin-mes-proximo" aria-label="Próximo mês">&#8250;</button>
      </div>

      <div class="mensagem-info" style="margin:14px 0 20px; max-width:640px;">O fechamento do mês consolida os valores e define o saldo final de cada categoria.</div>

      <div id="fin-faturamento" class="inicio-card fin-faturamento-card" style="margin-bottom:24px; max-width:100%;"><p class="card-item-meta">Carregando...</p></div>

      <h3>Situação financeira</h3>
      <div id="fin-categorias" class="lista-cards" style="margin-bottom:24px;"></div>

      <h3>Lançamentos do mês</h3>
      <div id="fin-lancamentos" class="lista-compacta"></div>
    `;

    async function carregarTudo() {
      document.getElementById('fin-mes-label').textContent = `${nomesMes[mesIdx]} de ${ano}`;
      const elFat = document.getElementById('fin-faturamento');
      const elCats = document.getElementById('fin-categorias');
      const elLanc = document.getElementById('fin-lancamentos');
      elFat.innerHTML = '<p class="card-item-meta">Carregando...</p>';
      elCats.innerHTML = '';
      elLanc.innerHTML = '';

      let preview;
      try {
        preview = await api.get(`/financeiro/fechamento/${mesRef()}/preview`);
      } catch (err) {
        elFat.innerHTML = `<div class="mensagem-erro visivel">${err.dados?.erro || 'Erro ao calcular resumo'}</div>`;
        return;
      }

      const destinacoes = { 1: preview.O, 2: preview.M, 3: preview.B, 4: preview.K, 5: preview.I };

      elFat.innerHTML = `
        <div class="fin-faturamento-linha">
          <div class="fin-faturamento-valor">
            <p class="card-item-meta" style="margin:0;">Faturamento do mês</p>
            <p class="inicio-valor">R$ ${preview.E.toFixed(2)}</p>
            <p style="color:var(--cor-sucesso); font-size:13px; display:flex; align-items:center; gap:6px; margin:0;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 19V5M6 11l6-6 6 6"/></svg>
              Entradas no período
            </p>
          </div>
          <div class="fin-faturamento-distribuicao">
            <p class="card-item-meta" style="margin:0 0 10px;">Distribuição do faturamento</p>
            ${CATS.map((c) => `
              <div class="fin-dist-linha">
                <span class="fin-dist-dot" style="background:${c.cor};"></span>
                <span class="fin-dist-nome">${c.nome}</span>
                <span class="fin-dist-valor">R$ ${destinacoes[c.id].toFixed(2)}</span>
                <span class="fin-dist-pct">${pct(destinacoes[c.id], preview.E).toFixed(0)}%</span>
                <div class="fin-dist-barra"><div class="fin-dist-barra-preenchida" style="width:${pct(destinacoes[c.id], preview.E)}%; background:${c.cor};"></div></div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      let saldos = [];
      try {
        saldos = await api.get(`/financeiro/saldos/${mesRef()}`);
      } catch (e) { /* mês ainda não fechado — segue sem saldos */ }

      let lancamentos = [];
      try {
        lancamentos = await api.get(`/financeiro/lancamentos/${mesRef()}`);
      } catch (e) { /* segue sem lançamentos se falhar */ }

      // Antes do fechamento não existe saldo gravado — calcula o gasto ao vivo
      // a partir dos lançamentos do mês, pra refletir cada registro na hora.
      const gastoAoVivo = {};
      lancamentos.forEach((l) => {
        if (l.tipo_id === 2 && l.categoria) {
          const cat = CATS.find((c) => chavesBanco[c.id] === l.categoria);
          if (cat) gastoAoVivo[cat.id] = (gastoAoVivo[cat.id] || 0) + Number(l.valor);
        }
      });

      elCats.innerHTML = CATS.map((c) => {
        const s = saldos.find((x) => x.nome === chavesBanco[c.id]) || null;
        const destinado = s ? Number(s.destinacao) : destinacoes[c.id];
        const gasto = s ? Number(s.gastos) : (gastoAoVivo[c.id] || 0);
        const disponivel = s ? Number(s.saldo_final) : destinado - gasto;
        return `
          <div class="card-item">
            <div class="card-item-topo">
              <h3 style="display:flex; align-items:center; gap:8px;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${c.cor}" stroke-width="1.8">${c.icone}</svg>
                ${c.nome}
              </h3>
            </div>
            <p class="card-item-meta">Destinado: R$ ${destinado.toFixed(2)} · Gasto: R$ ${gasto.toFixed(2)}</p>
            <p style="margin:6px 0 8px; font-weight:600;">Disponível: R$ ${disponivel.toFixed(2)}</p>
            <div class="barra-progresso"><div class="barra-progresso-preenchida" style="width:${pct(gasto, destinado)}%; background:${c.cor};"></div></div>
            ${!s ? '<p class="card-item-meta" style="margin-top:6px;">Mês ainda não fechado — valores estimados</p>' : ''}
          </div>
        `;
      }).join('');

      elLanc.innerHTML = lancamentos.map((l) => {
        const catExibicao = CATS.find((c) => chavesBanco[c.id] === l.categoria)?.nome || l.categoria || 'Entrada geral';
        return `
        <div class="card-item lanc-linha">
          <span class="badge lanc-tipo ${badgeTipoLancamento[l.tipo_id]}">${nomesTipoLancamento[l.tipo_id]}</span>
          <span class="lanc-cat">${esc(catExibicao)}</span>
          <span class="lanc-desc">${esc(l.descricao || '—')}${l.itens ? ' <button type="button" class="lanc-itens-btn">Ver itens</button>' : ''}</span>
          ${l.itens ? `<div class="lanc-itens-corpo oculto"><strong>Materiais:</strong> ${esc(l.itens)}</div>` : ''}
          <span class="lanc-data">${new Date(l.created_at).toLocaleDateString('pt-BR')}</span>
          <span class="lanc-valor" style="color:${l.tipo_id === 1 ? 'var(--cor-sucesso)' : 'var(--cor-vermelho)'};">${l.tipo_id === 1 ? '+' : '-'} R$ ${Number(l.valor).toFixed(2).replace('.', ',')}</span>
        </div>
      `;
      }).join('') || '<p class="card-item-meta">Nenhum lançamento neste mês.</p>';
    }

    document.getElementById('fin-lancamentos').addEventListener('click', (e) => {
      const btn = e.target.closest('.lanc-itens-btn');
      if (!btn) return;
      const corpo = btn.closest('.lanc-linha').querySelector('.lanc-itens-corpo');
      const aberto = !corpo.classList.toggle('oculto');
      btn.textContent = aberto ? 'Ocultar itens' : 'Ver itens';
    });

    function categoriasParaTipo(tipo) {
      if (tipo === 'orcamento') return [1, 2];
      return [1, 2, 3, 4, 5];
    }

    function abrirFormularioLancamento() {
      const corpo = `
        <div id="erro-lancamento-overlay" class="mensagem-erro"></div>
        <form id="form-lancamento-overlay">
          <div class="campo">
            <label for="fl-tipo">O que deseja registrar?</label>
            <select id="fl-tipo" required>
              <option value="entrada">Entrada de caixa</option>
              <option value="orcamento">Orçamento (Operacional/Materiais)</option>
              <option value="gasto">Gasto em categoria</option>
            </select>
          </div>
          <div class="campo" id="fl-categoria-wrapper">
            <label for="fl-categoria">Categoria</label>
            <select id="fl-categoria"></select>
          </div>
          <div class="campo"><label for="fl-valor">Valor (R$)</label><input type="number" id="fl-valor" min="0.01" step="0.01" required></div>
          <div class="campo" id="fl-desc-wrapper"><label for="fl-desc">Descrição (opcional)</label><input type="text" id="fl-desc"></div>
          <div class="campo oculto" id="fl-itens-wrapper"><label for="fl-itens">Materiais / itens (opcional)</label><textarea id="fl-itens" rows="3" placeholder="Ex.: 2x agulha 5RL, 1x tinta preta 30ml..."></textarea></div>
          <button type="submit" class="botao">Registrar</button>
        </form>
      `;
      abrirOverlay(`Novo lançamento — ${nomesMes[mesIdx]}/${ano}`, corpo);

      function atualizarCategorias() {
        const tipo = document.getElementById('fl-tipo').value;
        const wrapper = document.getElementById('fl-categoria-wrapper');
        if (tipo === 'entrada') {
          wrapper.classList.add('oculto');
        } else {
          wrapper.classList.remove('oculto');
          const sel = document.getElementById('fl-categoria');
          sel.innerHTML = categoriasParaTipo(tipo).map((id) => `<option value="${id}">${CATS.find((c) => c.id === id).nome}</option>`).join('');
        }
        document.getElementById('fl-desc-wrapper').classList.toggle('oculto', tipo === 'orcamento');
        atualizarItens();
      }
      function atualizarItens() {
        const tipo = document.getElementById('fl-tipo').value;
        const cat = Number(document.getElementById('fl-categoria')?.value);
        document.getElementById('fl-itens-wrapper').classList.toggle('oculto', !(tipo === 'gasto' && cat === 2));
      }
      atualizarCategorias();
      document.getElementById('fl-tipo').addEventListener('change', atualizarCategorias);
      document.getElementById('fl-categoria').addEventListener('change', atualizarItens);

      document.getElementById('form-lancamento-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-lancamento-overlay');
        erroEl.classList.remove('visivel');
        const tipo = document.getElementById('fl-tipo').value;
        const valor = Number(document.getElementById('fl-valor').value);
        const descricao = document.getElementById('fl-desc').value || undefined;
        const categoria_id = Number(document.getElementById('fl-categoria')?.value);
        const itens = (tipo === 'gasto' && categoria_id === 2) ? (document.getElementById('fl-itens').value.trim() || undefined) : undefined;

        try {
          if (tipo === 'entrada') {
            await api.post('/financeiro/entradas', { mes: mesRef(), valor, descricao });
          } else if (tipo === 'orcamento') {
            await api.post('/financeiro/orcamentos', { categoria_id, mes: mesRef(), valor });
          } else {
            await api.post('/financeiro/gastos', { categoria_id, mes: mesRef(), valor, descricao, itens });
          }
          fecharOverlay();
          carregarTudo();
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao registrar';
          erroEl.classList.add('visivel');
        }
      });
    }

    document.getElementById('fin-mes-anterior').addEventListener('click', () => {
      mesIdx--; if (mesIdx < 0) { mesIdx = 11; ano--; }
      carregarTudo();
    });
    document.getElementById('fin-mes-proximo').addEventListener('click', () => {
      mesIdx++; if (mesIdx > 11) { mesIdx = 0; ano++; }
      carregarTudo();
    });

    document.getElementById('fin-botao-fechar').addEventListener('click', async () => {
      if (!confirm(`Fechar o mês ${nomesMes[mesIdx]}/${ano}? Isso consolida os valores e trava novas edições sem reabertura.`)) return;
      try {
        await api.post(`/financeiro/fechamento/${mesRef()}/fechar`);
        carregarTudo();
      } catch (err) {
        alert(err.dados?.erro || 'Erro ao fechar mês');
      }
    });

    document.getElementById('fin-botao-reabrir').addEventListener('click', () => {
      const corpo = `
        <div id="erro-reabrir-overlay" class="mensagem-erro"></div>
        <form id="form-reabrir-overlay">
          <div class="campo"><label for="reab-motivo">Motivo da reabertura</label><input type="text" id="reab-motivo" required></div>
          <button type="submit" class="botao">Reabrir mês</button>
        </form>
      `;
      abrirOverlay(`Reabrir ${nomesMes[mesIdx]}/${ano}`, corpo);
      document.getElementById('form-reabrir-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-reabrir-overlay');
        erroEl.classList.remove('visivel');
        try {
          await api.post(`/financeiro/fechamento/${mesRef()}/reabrir`, { motivo: document.getElementById('reab-motivo').value.trim() });
          fecharOverlay();
          carregarTudo();
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao reabrir mês';
          erroEl.classList.add('visivel');
        }
      });
    });

    carregarTudo();
    mostrarBotaoFixoRodape('+ Novo lançamento', abrirFormularioLancamento);
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
            ${atual.estado === 'meta_atingida' ? '<span class="badge badge-verde" style="margin-left:8px;">meta atingida</span>' : ''}
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
    const badgeEstado = { em_progresso: '', meta_atingida: 'badge-verde', finalizada: 'badge-roxo' };

    container.innerHTML = `
      <h2>Melhorias</h2>
      <div id="lista-melhorias" class="lista-cards"></div>
    `;

    function renderFila() {
      const alvo = document.getElementById('lista-melhorias');
      alvo.innerHTML = [...fila].sort((a, b) => a.prioridade - b.prioridade).map((m) => `
        <div class="card-item">
          <div class="card-item-topo">
            <h3>${m.prioridade}º · ${m.nome}</h3>
            <span class="badge ${badgeEstado[m.estado]}" ${!badgeEstado[m.estado] ? 'style="background:rgba(255,255,255,0.08); border:1px solid var(--cor-borda); color:var(--cor-texto-fraco);"' : ''}>${nomesEstado[m.estado]}</span>
          </div>
          <p class="card-item-meta">Valor-alvo: R$ ${Number(m.valor_alvo).toFixed(2)}</p>
          <div class="card-item-acoes">
            ${m.estado !== 'finalizada' ? `<button class="link-acao" data-acao="editar" data-id="${m.id}">Editar</button>` : ''}
            ${m.estado !== 'finalizada' ? `<button class="link-acao" data-acao="finalizar" data-id="${m.id}">Finalizar</button>` : ''}
            ${m.estado === 'em_progresso' ? `<button class="link-acao link-acao-erro" data-acao="excluir" data-id="${m.id}">Excluir</button>` : ''}
          </div>
        </div>
      `).join('') || '<p style="color:var(--cor-texto-fraco);">Fila vazia.</p>';

      alvo.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
        btn.addEventListener('click', () => abrirFormularioMelhoria({ modo: 'editar', melhoria: fila.find((m) => String(m.id) === String(btn.dataset.id)) }));
      });
      alvo.querySelectorAll('[data-acao="finalizar"]').forEach((btn) => {
        btn.addEventListener('click', () => abrirFormularioFinalizar(btn.dataset.id));
      });
      alvo.querySelectorAll('[data-acao="excluir"]').forEach((btn) => {
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

    function abrirFormularioMelhoria({ modo, melhoria } = { modo: 'criar' }) {
      const corpo = `
        <div id="erro-melhoria-overlay" class="mensagem-erro"></div>
        <form id="form-melhoria-overlay">
          ${modo === 'criar' ? `<div class="campo"><label for="mel2-nome">Nome</label><input type="text" id="mel2-nome" required></div>` : ''}
          <div class="linha-campos">
            <div class="campo"><label for="mel2-valor">Valor-alvo (R$)</label><input type="number" id="mel2-valor" min="1" step="0.01" value="${melhoria?.valor_alvo || ''}" required></div>
            <div class="campo"><label for="mel2-prioridade">Prioridade</label><input type="number" id="mel2-prioridade" min="1" value="${melhoria?.prioridade || ''}" required></div>
          </div>
          <button type="submit" class="botao">${modo === 'criar' ? 'Adicionar' : 'Salvar alterações'}</button>
        </form>
      `;
      abrirOverlay(modo === 'criar' ? 'Adicionar à fila' : 'Editar melhoria', corpo);

      document.getElementById('form-melhoria-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-melhoria-overlay');
        erroEl.classList.remove('visivel');
        try {
          if (modo === 'criar') {
            const criada = await api.post('/melhorias', {
              nome: document.getElementById('mel2-nome').value.trim(),
              valor_alvo: Number(document.getElementById('mel2-valor').value),
              prioridade: Number(document.getElementById('mel2-prioridade').value),
            });
            fila.push({ ...criada, estado: 'em_progresso' });
          } else {
            await api.patch(`/melhorias/${melhoria.id}/valor-alvo`, { valor_alvo: Number(document.getElementById('mel2-valor').value) });
            await api.patch(`/melhorias/${melhoria.id}/prioridade`, { prioridade: Number(document.getElementById('mel2-prioridade').value) });
            fila = await api.get('/melhorias');
          }
          fecharOverlay();
          renderFila();
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao salvar';
          erroEl.classList.add('visivel');
        }
      });
    }

    function abrirFormularioFinalizar(id) {
      const corpo = `
        <div id="erro-finalizar-overlay" class="mensagem-erro"></div>
        <form id="form-finalizar-overlay">
          <div class="campo"><label for="fin2-valor">Valor efetivamente gasto (R$)</label><input type="number" id="fin2-valor" min="0.01" step="0.01" required></div>
          <div class="campo"><label for="fin2-mes">Mês de competência do gasto</label><input type="month" id="fin2-mes" value="${new Date().toISOString().slice(0,7)}" required></div>
          <button type="submit" class="botao">Finalizar melhoria</button>
        </form>
      `;
      abrirOverlay('Finalizar melhoria', corpo);

      document.getElementById('form-finalizar-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-finalizar-overlay');
        erroEl.classList.remove('visivel');
        try {
          await api.post(`/melhorias/${id}/finalizar`, {
            valor_gasto: Number(document.getElementById('fin2-valor').value),
            mes: document.getElementById('fin2-mes').value,
          });
          fecharOverlay();
          alert('Melhoria finalizada. Lembre-se de fechar/reabrir o mês no Financeiro para o saldo refletir o gasto.');
          fila = await api.get('/melhorias');
          renderFila();
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao finalizar';
          erroEl.classList.add('visivel');
        }
      });
    }

    renderFila();
    mostrarBotaoFixoRodape('+ Adicionar melhoria', () => abrirFormularioMelhoria({ modo: 'criar' }));
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
      <div id="lista-comunicados" class="lista-cards"></div>
    `;

    function renderLista() {
      const alvo = document.getElementById('lista-comunicados');
      if (lista.length === 0) {
        alvo.innerHTML = '<p style="color:var(--cor-texto-fraco);">Nenhum comunicado no momento.</p>';
        return;
      }
      alvo.innerHTML = lista.map((c) => `
        <div class="card-item ${c.obrigatorio ? 'card-destaque' : ''}">
          <div class="card-item-topo">
            <h3>${c.titulo}</h3>
            ${c.obrigatorio ? '<span class="badge badge-escarlate">Obrigatório</span>' : ''}
          </div>
          <p class="card-item-texto">${c.conteudo}</p>
          <p class="card-item-meta">
            v${c.versao_atual} · ${new Date(c.publicado_em).toLocaleDateString('pt-BR')}
            ${c.motivo_nome ? `· Motivo: ${c.motivo_nome}${c.motivo_texto ? ` (${c.motivo_texto})` : ''}` : ''}
          </p>
          <div class="card-item-acoes">
            ${!ehSocio ? (
              c.confirmado_pelo_usuario
                ? '<span class="badge badge-verde">Leitura confirmada</span>'
                : `<button class="botao" data-acao="confirmar" data-id="${c.id}" style="width:auto;">Confirmar leitura</button>`
            ) : `
              <button class="link-acao" data-acao="editar" data-id="${c.id}" data-versao="${c.versao_atual}">Editar</button>
              <button class="link-acao" data-acao="historico" data-id="${c.id}">Histórico</button>
              ${c.obrigatorio ? `<button class="link-acao" data-acao="confirmacoes" data-id="${c.id}">Ver confirmações</button>` : ''}
              <button class="link-acao link-acao-erro" data-acao="excluir" data-id="${c.id}">Excluir</button>
            `}
          </div>
        </div>
      `).join('');

      alvo.querySelectorAll('[data-acao="confirmar"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await api.post(`/comunicados/${btn.dataset.id}/confirmar`);
            views.comunicados(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao confirmar');
          }
        });
      });

      alvo.querySelectorAll('[data-acao="excluir"]').forEach((btn) => {
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

      alvo.querySelectorAll('[data-acao="historico"]').forEach((btn) => {
        btn.addEventListener('click', () => abrirHistorico(btn.dataset.id));
      });

      alvo.querySelectorAll('[data-acao="confirmacoes"]').forEach((btn) => {
        btn.addEventListener('click', () => abrirConfirmacoes(btn.dataset.id));
      });

      alvo.querySelectorAll('[data-acao="editar"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const comunicado = lista.find((c) => String(c.id) === String(btn.dataset.id));
          abrirFormularioComunicado({ modo: 'editar', comunicado, versaoBase: btn.dataset.versao });
        });
      });
    }

    async function abrirHistorico(id) {
      let versoes;
      try {
        versoes = await api.get(`/comunicados/${id}/versoes`);
      } catch (err) {
        return alert(err.dados?.erro || 'Erro ao carregar histórico');
      }
      const html = versoes.map((v) => `
        <div style="border-bottom:1px solid var(--cor-borda); padding:10px 0;">
          <p class="card-item-meta">
            v${v.versao} · ${new Date(v.publicado_em).toLocaleString('pt-BR')}
            ${v.motivo_nome ? `· Motivo: ${v.motivo_nome}${v.motivo_texto ? ` (${v.motivo_texto})` : ''}` : '· versão inicial'}
          </p>
          <p style="white-space:pre-wrap; margin:6px 0 0;">${v.conteudo}</p>
        </div>
      `).join('');
      abrirOverlay('Histórico de versões', html);
    }

    async function abrirConfirmacoes(id) {
      let residentes;
      try {
        residentes = await api.get(`/comunicados/${id}/confirmacoes`);
      } catch (err) {
        return alert(err.dados?.erro || 'Erro ao carregar confirmações');
      }
      const html = residentes.map((r) => `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--cor-borda); padding:10px 0;">
          <span>${r.nome || r.login}</span>
          ${r.confirmou
            ? '<span class="badge badge-verde">Confirmado</span>'
            : '<span class="badge badge-escarlate">Pendente</span>'}
        </div>
      `).join('') || '<p style="color:var(--cor-texto-fraco);">Nenhum residente ativo.</p>';
      abrirOverlay('Confirmações de leitura', html);
    }

    async function abrirFormularioComunicado({ modo, comunicado, versaoBase }) {
      let motivos = [];
      if (modo === 'editar') {
        try { motivos = await api.get('/comunicados/motivos'); } catch (e) { /* segue sem categorias se falhar */ }
      }

      const corpo = `
        <div id="erro-form-comunicado" class="mensagem-erro"></div>
        <form id="form-comunicado-overlay">
          <div class="campo">
            <label for="fc-titulo">Título</label>
            <input type="text" id="fc-titulo" value="${modo === 'editar' ? comunicado.titulo : ''}" ${modo === 'editar' ? 'disabled' : ''} required>
          </div>
          <div class="campo">
            <label for="fc-conteudo">Conteúdo</label>
            <textarea id="fc-conteudo" rows="6" required style="width:100%; background:var(--cor-fundo-input); border:1px solid var(--cor-borda); border-radius:var(--raio-pequeno); color:var(--cor-texto); padding:12px 14px; font-family:var(--fonte-corpo); font-size:15px;">${modo === 'editar' ? comunicado.conteudo : ''}</textarea>
          </div>
          ${modo === 'criar' ? `
            <label class="campo-checkbox"><input type="checkbox" id="fc-obrigatorio"> Obrigatório (exige confirmação de leitura)</label>
          ` : `
            <div class="campo">
              <label for="fc-motivo">Motivo da edição</label>
              <select id="fc-motivo" required>
                <option value="">Selecione...</option>
                ${motivos.map((m) => `<option value="${m.id}">${m.nome}</option>`).join('')}
              </select>
            </div>
            <div class="campo"><label for="fc-motivo-texto">Comentário adicional (opcional)</label><input type="text" id="fc-motivo-texto"></div>
            <button type="button" class="link-acao" id="fc-nova-categoria" style="margin-bottom:16px;">+ nova categoria de motivo</button>
          `}
          <button type="submit" class="botao">${modo === 'criar' ? 'Publicar' : 'Salvar edição'}</button>
        </form>
      `;

      abrirOverlay(modo === 'criar' ? 'Novo comunicado' : 'Editar comunicado', corpo);

      if (modo === 'editar') {
        document.getElementById('fc-nova-categoria').addEventListener('click', async () => {
          const nome = prompt('Nome da nova categoria de motivo:');
          if (!nome || !nome.trim()) return;
          try {
            const nova = await api.post('/comunicados/motivos', { nome: nome.trim() });
            const sel = document.getElementById('fc-motivo');
            const opt = document.createElement('option');
            opt.value = nova.id;
            opt.textContent = nova.nome;
            sel.appendChild(opt);
            sel.value = nova.id;
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao cadastrar categoria');
          }
        });
      }

      document.getElementById('form-comunicado-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-form-comunicado');
        erroEl.classList.remove('visivel');
        try {
          if (modo === 'criar') {
            await api.post('/comunicados', {
              titulo: document.getElementById('fc-titulo').value.trim(),
              conteudo: document.getElementById('fc-conteudo').value.trim(),
              obrigatorio: document.getElementById('fc-obrigatorio').checked,
            });
          } else {
            const resultado = await api.put(`/comunicados/${comunicado.id}`, {
              conteudo: document.getElementById('fc-conteudo').value.trim(),
              versao_base: versaoBase,
              motivo_categoria_id: document.getElementById('fc-motivo').value,
              motivo_texto: document.getElementById('fc-motivo-texto').value || undefined,
            });
            if (resultado.aviso) alert(resultado.aviso);
          }
          fecharOverlay();
          views.comunicados(container);
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao salvar';
          erroEl.classList.add('visivel');
        }
      });
    }

    renderLista();

    if (ehSocio) {
      mostrarBotaoFixoRodape('+ Novo comunicado', () => abrirFormularioComunicado({ modo: 'criar' }));
    }
  },

  async usuarios(container) {
    if (usuarioAtual.perfil_id !== 1) {
      container.innerHTML = '<h2>Usuários</h2><p>Acesso restrito aos sócios.</p>';
      return;
    }

    container.innerHTML = '<h2>Usuários</h2><p>Carregando...</p>';
    let lista = [];
    try {
      lista = await api.get('/usuarios');
    } catch (e) {
      container.innerHTML = '<h2>Usuários</h2><div class="mensagem-erro visivel">Erro ao carregar</div>';
      return;
    }

    container.innerHTML = `
      <h2>Usuários</h2>
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
        <input type="text" id="usuarios-busca" placeholder="Buscar por nome ou login..." style="flex:1; min-width:200px; padding:11px 14px; background:var(--cor-fundo-input); border:1px solid var(--cor-borda); border-radius:var(--raio-pequeno); color:var(--cor-texto); font-size:14px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--cor-texto-fraco); white-space:nowrap;">
          <input type="checkbox" id="usuarios-mostrar-inativos" style="width:auto;"> Mostrar inativos
        </label>
      </div>
      <div id="lista-usuarios" class="lista-cards"></div>
    `;

    function renderUsuarios() {
      const termo = document.getElementById('usuarios-busca').value.trim().toLowerCase();
      const mostrarInativos = document.getElementById('usuarios-mostrar-inativos').checked;
      const filtrada = lista.filter((u) => {
        if (!mostrarInativos && !u.status) return false;
        if (!termo) return true;
        return (u.nome || '').toLowerCase().includes(termo) || u.login.toLowerCase().includes(termo);
      });

      const alvo = document.getElementById('lista-usuarios');
      alvo.innerHTML = filtrada.map((u) => `
        <div class="card-item">
          <div class="card-item-topo">
            <h3>${u.nome || '(cadastro pendente)'}</h3>
            <span class="badge ${u.perfil_id === 1 ? 'badge-roxo' : ''}" ${u.perfil_id !== 1 ? 'style="background:rgba(255,255,255,0.08); border:1px solid var(--cor-borda); color:var(--cor-texto-fraco);"' : ''}>${u.perfil_id === 1 ? 'Sócio' : 'Residente'}</span>
          </div>
          <p class="card-item-meta">
            login: ${u.login} · ${u.status ? '<span class="badge badge-verde" style="padding:1px 8px;">Ativo</span>' : '<span class="badge badge-escarlate" style="padding:1px 8px;">Inativo</span>'}
          </p>
          <div class="card-item-acoes">
            ${String(u.id) === String(usuarioAtual.id)
              ? '<span class="card-item-meta">(você)</span>'
              : `<button class="link-acao" data-acao="status" data-id="${u.id}" data-status="${!u.status}">${u.status ? 'Desativar' : 'Ativar'}</button>`}
            <button class="link-acao" data-acao="perfil" data-id="${u.id}" data-perfil="${u.perfil_id === 1 ? 2 : 1}">Tornar ${u.perfil_id === 1 ? 'Residente' : 'Sócio'}</button>
            <button class="link-acao" data-acao="redefinir" data-id="${u.id}">Redefinir senha</button>
          </div>
        </div>
      `).join('') || '<p style="color:var(--cor-texto-fraco);">Nenhum usuário.</p>';

      alvo.querySelectorAll('[data-acao="status"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await api.patch(`/usuarios/${btn.dataset.id}/status`, { status: btn.dataset.status === 'true' });
            views.usuarios(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao alterar status');
          }
        });
      });

      alvo.querySelectorAll('[data-acao="perfil"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Confirma a troca de perfil?')) return;
          try {
            await api.patch(`/usuarios/${btn.dataset.id}/perfil`, { perfil_id: Number(btn.dataset.perfil) });
            views.usuarios(container);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao alterar perfil');
          }
        });
      });

      alvo.querySelectorAll('[data-acao="redefinir"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Gerar nova senha provisória para este usuário?')) return;
          try {
            const resultado = await api.post(`/usuarios/${btn.dataset.id}/redefinir-senha`);
            alert(`Nova senha provisória: ${resultado.nova_senha_provisoria}\n\nAnote e repasse ao usuário — ela só aparece aqui uma vez.`);
          } catch (err) {
            alert(err.dados?.erro || 'Erro ao redefinir senha');
          }
        });
      });
    }

    function abrirFormularioUsuario() {
      const corpo = `
        <div id="erro-usuario-overlay" class="mensagem-erro"></div>
        <div id="sucesso-usuario-overlay" class="mensagem-sucesso oculto"></div>
        <form id="form-usuario-overlay">
          <div class="campo">
            <label for="us-perfil">Perfil</label>
            <select id="us-perfil"><option value="2">Residente</option><option value="1">Sócio</option></select>
          </div>
          <p style="color:var(--cor-texto-fraco); font-size:13px;">
            Nome, e-mail, telefone e CPF são preenchidos pelo próprio usuário no primeiro acesso.
          </p>
          <button type="submit" class="botao">Criar usuário</button>
        </form>
      `;
      abrirOverlay('Novo usuário', corpo);

      document.getElementById('form-usuario-overlay').addEventListener('submit', async (e) => {
        e.preventDefault();
        const erroEl = document.getElementById('erro-usuario-overlay');
        erroEl.classList.remove('visivel');
        try {
          const resultado = await api.post('/usuarios', {
            perfil_id: Number(document.getElementById('us-perfil').value),
          });
          fecharOverlay();
          alert(`Usuário criado!\nLogin: ${resultado.credenciais_iniciais.login}\nSenha provisória: ${resultado.credenciais_iniciais.senha}\n\nAnote agora, não aparece de novo.`);
          lista = await api.get('/usuarios');
          renderUsuarios();
        } catch (err) {
          erroEl.textContent = err.dados?.erro || 'Erro ao criar usuário';
          erroEl.classList.add('visivel');
        }
      });
    }

    renderUsuarios();
    document.getElementById('usuarios-busca').addEventListener('input', renderUsuarios);
    document.getElementById('usuarios-mostrar-inativos').addEventListener('change', renderUsuarios);
    mostrarBotaoFixoRodape('+ Novo usuário', abrirFormularioUsuario);
  },

  async perfil(container) {
    container.innerHTML = '<h2>Meu Perfil</h2><p>Carregando...</p>';
    let dados;
    try {
      dados = await api.get('/usuarios/me');
    } catch (e) {
      container.innerHTML = '<h2>Meu Perfil</h2><div class="mensagem-erro visivel">Erro ao carregar</div>';
      return;
    }

    let fotoNova = null; // foto escolhida nesta edição, ainda não salva
    let editando = false;

    function avatarHtml(foto) {
      if (foto) return `<img src="${foto}" class="perfil-avatar-img" alt="Foto de perfil">`;
      const inicial = (dados.nome || dados.login || '?').trim().charAt(0).toUpperCase();
      return `<div class="perfil-avatar-vazio">${esc(inicial)}</div>`;
    }

    function render() {
      const dis = editando ? '' : 'disabled';
      container.innerHTML = `
        <h2>Meu Perfil</h2>
        <div class="painel-form" style="max-width:420px;">
          <div class="perfil-avatar-area">
            <div class="perfil-avatar">${avatarHtml(fotoNova || dados.foto)}</div>
            ${editando ? `<label class="link-acao" style="cursor:pointer;">Trocar foto<input type="file" id="pf-foto-input" accept="image/*" class="oculto"></label>` : ''}
          </div>
          <p class="card-item-meta">Login: <strong style="color:var(--cor-texto);">${esc(dados.login)}</strong></p>
          <div id="erro-perfil" class="mensagem-erro"></div>
          <form id="form-perfil">
            <div class="campo"><label for="pf-nome">Nome completo</label><input type="text" id="pf-nome" value="${esc(dados.nome || '')}" ${dis} required></div>
            <div class="campo"><label for="pf-email">E-mail</label><input type="email" id="pf-email" value="${esc(dados.email || '')}" ${dis} required></div>
            <div class="campo"><label for="pf-telefone">Telefone (só números)</label><input type="text" id="pf-telefone" value="${esc(dados.telefone || '')}" ${dis} required></div>
            <div class="campo"><label for="pf-cpf">CPF (só números)</label><input type="text" id="pf-cpf" value="${esc(dados.cpf || '')}" ${dis} required></div>
            ${editando
              ? `<button type="submit" class="botao">Salvar alterações</button>
                 <button type="button" class="botao botao-secundario" id="botao-cancelar-perfil" style="margin-top:8px;">Cancelar</button>`
              : `<button type="button" class="botao" id="botao-editar-perfil">Editar perfil</button>`}
          </form>
        </div>

        <div class="painel-form" style="max-width:420px; margin-top:20px;">
          <h3 style="margin-top:0;">Senha</h3>
          <p class="card-item-meta">Para trocar sua senha, peça a redefinição a um sócio.</p>
        </div>

        <button type="button" class="botao" id="botao-sair-perfil" style="max-width:420px; width:100%; margin-top:20px; background:var(--cor-vermelho);">Sair da conta</button>
      `;

      if (editando) {
        document.getElementById('pf-foto-input').addEventListener('change', (e) => {
          const arquivo = e.target.files[0];
          if (!arquivo) return;
          if (arquivo.size > 1300000) {
            alert('Imagem muito grande. Escolha uma foto de até ~1,3 MB.');
            return;
          }
          const leitor = new FileReader();
          leitor.onload = () => {
            fotoNova = leitor.result;
            document.querySelector('.perfil-avatar').innerHTML = avatarHtml(fotoNova);
          };
          leitor.readAsDataURL(arquivo);
        });

        document.getElementById('botao-cancelar-perfil').addEventListener('click', () => {
          editando = false;
          fotoNova = null;
          render();
        });

        document.getElementById('form-perfil').addEventListener('submit', async (e) => {
          e.preventDefault();
          const erroEl = document.getElementById('erro-perfil');
          erroEl.classList.remove('visivel');
          try {
            const corpo = {
              nome: document.getElementById('pf-nome').value.trim(),
              email: document.getElementById('pf-email').value.trim(),
              telefone: document.getElementById('pf-telefone').value.trim(),
              cpf: document.getElementById('pf-cpf').value.trim(),
            };
            if (fotoNova) corpo.foto = fotoNova;
            const atualizado = await api.put('/usuarios/me', corpo);
            dados = { ...dados, ...atualizado };
            usuarioAtual.nome = dados.nome;
            document.getElementById('usuario-logado-nome').textContent = usuarioAtual.nome;
            editando = false;
            fotoNova = null;
            render();
          } catch (err) {
            erroEl.textContent = err.dados?.erro || 'Erro ao salvar';
            erroEl.classList.add('visivel');
          }
        });
      } else {
        document.getElementById('botao-editar-perfil').addEventListener('click', () => {
          editando = true;
          render();
        });
      }

      document.getElementById('botao-sair-perfil').addEventListener('click', () => {
        if (confirm('Deseja realmente sair da conta?')) fazerLogout();
      });
    }

    render();
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

// Registro do Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.error('Falha ao registrar service worker:', err);
    });
  });
}


// ---------- Notificações (sino fixo no canto superior direito) ----------
let notificacoesAtuais = [];

function criarSinoNotificacoes() {
  if (document.getElementById('sino-notif')) return;
  const btn = document.createElement('button');
  btn.id = 'sino-notif';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Notificações');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 20a2 2 0 01-3.4 0"/></svg><span id="sino-notif-contador" class="oculto"></span>';
  btn.addEventListener('click', abrirNotificacoes);
  const shell = document.getElementById('app-shell');
  shell.insertAdjacentElement('afterend', btn);
}

async function atualizarNotificacoes() {
  const shell = document.getElementById('app-shell');
  if (!shell || !shell.classList.contains('ativo')) return;
  criarSinoNotificacoes();
  try {
    notificacoesAtuais = await api.get('/notificacoes');
  } catch (e) {
    return;
  }
  const cont = document.getElementById('sino-notif-contador');
  cont.textContent = notificacoesAtuais.length;
  cont.classList.toggle('oculto', notificacoesAtuais.length === 0);
}

function abrirNotificacoes() {
  const corpo = notificacoesAtuais.length
    ? `<div class="notif-lista">${notificacoesAtuais.map((n) => `
        <button type="button" class="notif-item notif-${n.tipo}" data-destino="${esc(n.destino)}">
          <strong>${esc(n.titulo)}</strong>
          <span>${esc(n.texto)}</span>
        </button>`).join('')}</div>`
    : '<p class="card-item-meta">Nenhuma notificação no momento. Tudo em dia!</p>';
  abrirOverlay('Notificações', corpo);
  document.querySelectorAll('.notif-item').forEach((el) => {
    el.addEventListener('click', () => { fecharOverlay(); navegarPara(el.dataset.destino); });
  });
}

setInterval(atualizarNotificacoes, 60000);
