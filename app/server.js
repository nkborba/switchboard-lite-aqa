const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'testerAdmin',
  password: process.env.PGPASSWORD || 'tester',
  database: process.env.PGDATABASE || 'switchboard',
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Camada de "display" (cache em memória) --------------------------------
// O cache guarda o que a tela serve. O Postgres é a fonte da verdade.
// O bug de stale cache nasce se o publish NÃO limpar isto.
let displayCache = null;

function invalidateDisplayCache() {
  displayCache = null;
}

// Busca o menu publicado mais recente (última linha de menu_history) + itens.
async function loadCurrentMenuFromDb() {
  const historyResult = await pool.query(
    'SELECT id, menu_name, version, published_by, published_at ' +
    'FROM menu_history ORDER BY published_at DESC, id DESC LIMIT 1'
  );
  if (historyResult.rows.length === 0) {
    return null;
  }
  const history = historyResult.rows[0];
  const itemsResult = await pool.query(
    'SELECT item_name, price, available FROM menu_items ' +
    'WHERE menu_history_id = $1 ORDER BY id',
    [history.id]
  );
  return {
    name: history.menu_name,
    version: history.version,
    publishedBy: history.published_by,
    items: itemsResult.rows.map((r) => ({
      name: r.item_name,
      price: Number(r.price),
      available: r.available,
    })),
  };
}

// ---- POST /api/publish -----------------------------------------------------
app.post('/api/publish', async (req, res) => {
  const { name, items, publishedBy } = req.body || {};

  // validação
  if (!name || typeof name !== 'string' || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid menu: "name" (string) and non-empty "items" array are required' });
  }

  try {
    // próxima versão para este menu_name
    const versionResult = await pool.query(
      'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM menu_history WHERE menu_name = $1',
      [name]
    );
    const version = versionResult.rows[0].next_version;

    // grava o registro de publicação (histórico/auditoria)
    const historyResult = await pool.query(
      'INSERT INTO menu_history (menu_name, version, published_by) VALUES ($1, $2, $3) RETURNING id, published_at',
      [name, version, publishedBy || 'admin']
    );
    const menuHistoryId = historyResult.rows[0].id;

    // grava os itens vinculados a essa versão
    for (const item of items) {
      await pool.query(
        'INSERT INTO menu_items (menu_history_id, item_name, price, available) VALUES ($1, $2, $3, $4)',
        [menuHistoryId, item.name, item.price, item.available !== false]
      );
    }

    // INVALIDAÇÃO DO CACHE — passo separado e visível de propósito.
    // (É esta linha que o teste de stale cache "esquece" no exercício red-first.)
    invalidateDisplayCache();

    return res.status(200).json({ status: 'published', name, version });
  } catch (err) {
    console.error('publish error:', err);
    return res.status(500).json({ error: 'Internal error while publishing menu' });
  }
});

// ---- GET /api/store-display ------------------------------------------------
app.get('/api/store-display', async (req, res) => {
  try {
    if (displayCache === null) {
      displayCache = await loadCurrentMenuFromDb();
    }
    if (displayCache === null) {
      return res.status(404).json({ error: 'No menu published yet' });
    }
    return res.status(200).json(displayCache);
  } catch (err) {
    console.error('store-display error:', err);
    return res.status(500).json({ error: 'Internal error while loading display' });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Switchboard running on http://localhost:${PORT}`));
}

module.exports = app;