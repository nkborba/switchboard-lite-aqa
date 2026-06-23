CREATE TABLE IF NOT EXISTS menu_history (
  id SERIAL PRIMARY KEY,
  menu_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  published_by TEXT NOT NULL,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  menu_history_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  available BOOLEAN DEFAULT TRUE,

  CONSTRAINT fk_menu_history
    FOREIGN KEY (menu_history_id)
    REFERENCES menu_history(id)
    ON DELETE CASCADE
);