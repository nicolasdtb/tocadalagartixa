-- Campo próprio para descrever materiais/itens de um gasto (separado da descrição)
ALTER TABLE tocadalagartixa.lancamentos_financeiros ADD COLUMN IF NOT EXISTS itens text;
