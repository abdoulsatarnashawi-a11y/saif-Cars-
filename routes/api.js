import { Router } from "express";
import { getDb } from "../db/database.js";
import { authRequired, authOptional } from "../middleware/auth.js";

const router = Router();

function mapListing(row) {
  return {
    id: row.id,
    brandId: row.brand_id,
    brandName: row.brand_name,
    modelId: row.model_id,
    modelName: row.model_name,
    category: row.category,
    country: row.country,
    year: row.year,
    price: row.price,
    mileage: row.mileage,
    color: row.color,
    transmission: row.transmission,
    fuel: row.fuel,
    trim: row.trim,
    imageUrl: row.image_url,
    description: row.description,
  };
}

router.get("/stats", (_req, res) => {
  const db = getDb();
  res.json({
    brands: db.prepare("SELECT COUNT(*) AS count FROM brands").get().count,
    models: db.prepare("SELECT COUNT(*) AS count FROM models").get().count,
    listings: db.prepare("SELECT COUNT(*) AS count FROM listings").get().count,
  });
});

router.get("/brands", (_req, res) => {
  const db = getDb();
  const brands = db.prepare(`
    SELECT b.id, b.name, b.country, b.logo_url AS logoUrl,
           COUNT(DISTINCT m.id) AS modelCount
    FROM brands b
    LEFT JOIN models m ON m.brand_id = b.id
    GROUP BY b.id
    ORDER BY b.name
  `).all();

  const models = db.prepare("SELECT id, brand_id AS brandId, name, category FROM models").all();
  const modelsByBrand = {};
  for (const model of models) {
    if (!modelsByBrand[model.brandId]) modelsByBrand[model.brandId] = [];
    modelsByBrand[model.brandId].push({
      id: model.id,
      name: model.name,
      category: model.category,
    });
  }

  res.json({
    brands: brands.map((b) => ({
      id: b.id,
      name: b.name,
      country: b.country,
      logoUrl: b.logoUrl,
      models: modelsByBrand[b.id] || [],
    })),
  });
});

router.get("/categories", (_req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT category FROM models ORDER BY category").all();
  res.json({ categories: rows.map((r) => r.category) });
});

router.get("/listings", authOptional, (req, res) => {
  const db = getDb();
  const {
    brand,
    model,
    category,
    search = "",
    minPrice,
    maxPrice,
    sort = "price-asc",
  } = req.query;

  let sql = `
    SELECT l.*, b.name AS brand_name, b.country, m.name AS model_name, m.category
    FROM listings l
    JOIN brands b ON b.id = l.brand_id
    JOIN models m ON m.brand_id = l.brand_id AND m.id = l.model_id
    WHERE 1=1
  `;
  const params = [];

  if (brand) {
    sql += " AND l.brand_id = ?";
    params.push(brand);
  }
  if (model) {
    sql += " AND l.model_id = ?";
    params.push(model);
  }
  if (category) {
    sql += " AND m.category = ?";
    params.push(category);
  }
  if (minPrice) {
    sql += " AND l.price >= ?";
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    sql += " AND l.price <= ?";
    params.push(Number(maxPrice));
  }
  if (search.trim()) {
    sql += ` AND (
      b.name LIKE ? OR m.name LIKE ? OR l.color LIKE ? OR
      l.trim LIKE ? OR CAST(l.year AS TEXT) LIKE ?
    )`;
    const q = `%${search.trim()}%`;
    params.push(q, q, q, q, q);
  }

  switch (sort) {
    case "price-desc":
      sql += " ORDER BY l.price DESC";
      break;
    case "year-desc":
      sql += " ORDER BY l.year DESC";
      break;
    case "mileage-asc":
      sql += " ORDER BY l.mileage ASC";
      break;
    default:
      sql += " ORDER BY l.price ASC";
  }

  const rows = db.prepare(sql).all(...params);
  let favorites = new Set();

  if (req.user) {
    const favRows = db.prepare("SELECT listing_id FROM favorites WHERE user_id = ?").all(req.user.id);
    favorites = new Set(favRows.map((f) => f.listing_id));
  }

  res.json({
    listings: rows.map((row) => ({
      ...mapListing(row),
      isFavorite: favorites.has(row.id),
    })),
  });
});

router.get("/listings/:id", authOptional, (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT l.*, b.name AS brand_name, b.country, m.name AS model_name, m.category
    FROM listings l
    JOIN brands b ON b.id = l.brand_id
    JOIN models m ON m.brand_id = l.brand_id AND m.id = l.model_id
    WHERE l.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: "Listing not found" });

  let isFavorite = false;
  if (req.user) {
    const fav = db.prepare(
      "SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ?"
    ).get(req.user.id, req.params.id);
    isFavorite = Boolean(fav);
  }

  res.json({ listing: { ...mapListing(row), isFavorite } });
});

router.post("/listings/:id/favorite", authRequired, (req, res) => {
  const db = getDb();
  const listing = db.prepare("SELECT id FROM listings WHERE id = ?").get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  db.prepare(
    "INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)"
  ).run(req.user.id, req.params.id);

  res.json({ success: true, message: "Added to favorites" });
});

router.delete("/listings/:id/favorite", authRequired, (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM favorites WHERE user_id = ? AND listing_id = ?").run(
    req.user.id,
    req.params.id
  );
  res.json({ success: true, message: "Removed from favorites" });
});

router.get("/favorites", authRequired, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT l.*, b.name AS brand_name, b.country, m.name AS model_name, m.category
    FROM favorites f
    JOIN listings l ON l.id = f.listing_id
    JOIN brands b ON b.id = l.brand_id
    JOIN models m ON m.brand_id = l.brand_id AND m.id = l.model_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);

  res.json({
    listings: rows.map((row) => ({ ...mapListing(row), isFavorite: true })),
  });
});

router.post("/listings/:id/inquire", authRequired, (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const db = getDb();
  const listing = db.prepare("SELECT id FROM listings WHERE id = ?").get(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  db.prepare(
    "INSERT INTO inquiries (user_id, listing_id, message) VALUES (?, ?, ?)"
  ).run(req.user.id, req.params.id, message.trim());

  res.status(201).json({ success: true, message: "Inquiry sent successfully" });
});

export default router;
