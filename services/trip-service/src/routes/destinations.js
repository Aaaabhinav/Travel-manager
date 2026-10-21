const express = require('express');
const logger = require('../logger');

const router = express.Router();

// ── GET /destinations?query=&category=&country= ──────────────────────────────
router.get('/destinations', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { query, category, country, best_season, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM destinations WHERE 1=1';
    const params = [];
    let idx = 1;

    if (query) {
      sql += ` AND (LOWER(name) LIKE $${idx} OR LOWER(description) LIKE $${idx} OR LOWER(country) LIKE $${idx})`;
      params.push(`%${query.toLowerCase()}%`);
      idx++;
    }
    if (category) {
      sql += ` AND category = $${idx}`;
      params.push(category);
      idx++;
    }
    if (country) {
      sql += ` AND LOWER(country) = LOWER($${idx})`;
      params.push(country);
      idx++;
    }
    if (best_season) {
      sql += ` AND best_season = $${idx}`;
      params.push(best_season);
      idx++;
    }

    sql += ` ORDER BY name LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) FROM destinations WHERE 1=1';
    const countParams = [];
    let cIdx = 1;
    if (query) {
      countSql += ` AND (LOWER(name) LIKE $${cIdx} OR LOWER(description) LIKE $${cIdx} OR LOWER(country) LIKE $${cIdx})`;
      countParams.push(`%${query.toLowerCase()}%`);
      cIdx++;
    }
    if (category) {
      countSql += ` AND category = $${cIdx}`;
      countParams.push(category);
      cIdx++;
    }
    if (country) {
      countSql += ` AND LOWER(country) = LOWER($${cIdx})`;
      countParams.push(country);
      cIdx++;
    }
    if (best_season) {
      countSql += ` AND best_season = $${cIdx}`;
      countParams.push(best_season);
      cIdx++;
    }

    const countResult = await db.query(countSql, countParams);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /destinations/:id ────────────────────────────────────────────────────
router.get('/destinations/:id', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM destinations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 404, error: 'Not Found', message: 'Destination not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
