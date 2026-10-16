const { query } = require('../config/db');

exports.getAll = async (includeInactive = false) => {
  const { rows } = await query(
    `SELECT *, (unit_price - unit_cost) AS unit_margin FROM products
     ${includeInactive ? '' : 'WHERE active'} ORDER BY name`);
  return rows;
};

exports.getById = async (id) =>
  (await query('SELECT *, (unit_price - unit_cost) AS unit_margin FROM products WHERE id = $1', [id])).rows[0];

exports.create = async ({ name, unit, unit_cost, unit_price }) => {
  const { rows: [row] } = await query(
    `INSERT INTO products (name, unit, unit_cost, unit_price)
     VALUES ($1, COALESCE($2,'pc'), $3, $4) RETURNING *`,
    [name, unit ?? null, unit_cost, unit_price]);
  return row;
};

exports.update = async (id, { name, unit, unit_cost, unit_price, active }) => {
  const { rows: [row] } = await query(
    `UPDATE products SET name = COALESCE($2,name), unit = COALESCE($3,unit),
            unit_cost = COALESCE($4,unit_cost), unit_price = COALESCE($5,unit_price),
            active = COALESCE($6,active) WHERE id = $1 RETURNING *`,
    [id, name ?? null, unit ?? null, unit_cost ?? null, unit_price ?? null, active ?? null]);
  return row;
};

// Soft delete: old invoices still reference the product
exports.deactivate = async (id) =>
  (await query('UPDATE products SET active = FALSE WHERE id = $1', [id])).rowCount > 0;
