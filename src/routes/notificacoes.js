const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Notificações calculadas na hora a partir do estado atual do sistema (nada é gravado).
// Cada item some sozinho quando a situação que o gerou é resolvida.
router.get('/', requireAuth, async (req, res) => {
  const usuario = req.session.usuario;
  const ehSocio = usuario.perfil_id === 1;
  const mes = new Date().toISOString().slice(0, 7) + '-01';
  const itens = [];

  try {
    // Estoque baixo (todos)
    const estoque = await pool.query(
      `SELECT COUNT(*)::int AS n FROM tocadalagartixa.materiais WHERE status = true AND quantidade <= minimo`
    );
    if (estoque.rows[0].n > 0) {
      const n = estoque.rows[0].n;
      itens.push({
        id: 'estoque', tipo: 'alerta', destino: 'estoque',
        titulo: 'Estoque baixo',
        texto: n === 1 ? '1 material atingiu o mínimo.' : `${n} materiais atingiram o mínimo.`,
      });
    }

    // Meta coletiva atingida (todos)
    const melhoria = await pool.query(
      `SELECT nome FROM tocadalagartixa.melhorias WHERE estado_id = 2 ORDER BY prioridade LIMIT 1`
    );
    if (melhoria.rows.length) {
      itens.push({
        id: 'melhoria', tipo: 'sucesso', destino: 'melhorias',
        titulo: 'Meta coletiva atingida',
        texto: `A melhoria "${melhoria.rows[0].nome}" já tem o valor necessário.`,
      });
    }

    if (ehSocio) {
      // Solicitações de benefício pendentes / aprovadas aguardando pagamento
      const ben = await pool.query(
        `SELECT status_id, COUNT(*)::int AS n FROM tocadalagartixa.beneficios_mensais
         WHERE mes_competencia = $1 AND status_id IN (1, 2) GROUP BY status_id`,
        [mes]
      );
      const porStatus = Object.fromEntries(ben.rows.map((r) => [r.status_id, r.n]));
      if (porStatus[1]) {
        itens.push({
          id: 'ben-pendentes', tipo: 'alerta', destino: 'beneficios',
          titulo: 'Benefícios para aprovar',
          texto: porStatus[1] === 1 ? '1 solicitação aguardando aprovação.' : `${porStatus[1]} solicitações aguardando aprovação.`,
        });
      }
      if (porStatus[2]) {
        itens.push({
          id: 'ben-aprovados', tipo: 'info', destino: 'beneficios',
          titulo: 'Benefícios para pagar',
          texto: porStatus[2] === 1 ? '1 benefício aprovado aguardando pagamento.' : `${porStatus[2]} benefícios aprovados aguardando pagamento.`,
        });
      }
    } else {
      // Situação do benefício do próprio residente neste mês
      const meu = await pool.query(
        `SELECT status_id FROM tocadalagartixa.beneficios_mensais WHERE usuario_id = $1 AND mes_competencia = $2`,
        [usuario.id, mes]
      );
      const st = meu.rows[0]?.status_id;
      if (st === 2) {
        itens.push({ id: 'meu-ben', tipo: 'sucesso', destino: 'beneficios', titulo: 'Benefício aprovado', texto: 'Seu benefício do mês foi aprovado. Aguarde o pagamento.' });
      } else if (st === 3) {
        itens.push({ id: 'meu-ben', tipo: 'sucesso', destino: 'beneficios', titulo: 'Benefício pago', texto: 'Seu benefício do mês foi pago.' });
      }
    }

    res.json(itens);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar notificações' });
  }
});

module.exports = router;
