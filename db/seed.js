import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { getDb } from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const CAR_IMAGES = {
  Sedan: [
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&h=600&fit=crop",
  ],
  SUV: [
    "https://images.unsplash.com/photo-1519641471654-76ce0107a936?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&h=600&fit=crop",
  ],
  Truck: [
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1583121274602-3e2820c0882a?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=800&h=600&fit=crop",
  ],
  Sports: [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&h=600&fit=crop",
  ],
  Electric: [
    "https://images.unsplash.com/photo-1593941707882-a5bba14938bc?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1619767886555-efebf597b428?w=800&h=600&fit=crop",
  ],
  Hybrid: [
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1621007947382-bef3d5975a3c?w=800&h=600&fit=crop",
  ],
  Hatchback: [
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800&h=600&fit=crop",
  ],
  Van: [
    "https://images.unsplash.com/photo-1621007947382-bef3d5975a3c?w=800&h=600&fit=crop",
  ],
  Wagon: [
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&h=600&fit=crop",
  ],
  Coupe: [
    "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&h=600&fit=crop",
  ],
  Convertible: [
    "https://images.unsplash.com/photo-1553440569-bcc63803af85?w=800&h=600&fit=crop",
  ],
  default: [
    "https://images.unsplash.com/photo-148529157115f-773bc3e55a55?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop",
  ],
};

const COLORS = ["White", "Black", "Silver", "Gray", "Blue", "Red", "Green", "Brown", "Beige"];
const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "Dual-Clutch"];
const FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Electric", "Plug-in Hybrid"];
const TRIMS = ["Base", "Sport", "Premium", "Limited", "Platinum", "Touring"];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function getBasePrice(category) {
  const ranges = {
    Sedan: [18000, 45000],
    SUV: [25000, 75000],
    Truck: [28000, 80000],
    Sports: [35000, 250000],
    Electric: [32000, 120000],
    Hybrid: [24000, 55000],
    Hatchback: [16000, 32000],
    Van: [30000, 65000],
    Wagon: [28000, 60000],
    Coupe: [30000, 90000],
    Convertible: [35000, 110000],
  };
  return ranges[category] || [20000, 50000];
}

function getImageUrl(category, seed) {
  const pool = CAR_IMAGES[category] || CAR_IMAGES.default;
  return pick(pool, seed);
}

function seedDatabase() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS c FROM brands").get().c;
  if (count > 0) {
    console.log("Database already seeded.");
    return;
  }

  const brandsData = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "brands.json"), "utf8")
  );

  const insertBrand = db.prepare(
    "INSERT INTO brands (id, name, country, logo_url) VALUES (?, ?, ?, ?)"
  );
  const insertModel = db.prepare(
    "INSERT INTO models (id, brand_id, name, category) VALUES (?, ?, ?, ?)"
  );
  const insertListing = db.prepare(`
    INSERT INTO listings (
      id, brand_id, model_id, year, price, mileage, color,
      transmission, fuel, trim, image_url, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedAll = db.transaction(() => {
    for (const brand of brandsData.brands) {
      const logoSeed = hashCode(brand.id);
      const logoUrl = getImageUrl("Sedan", logoSeed);
      insertBrand.run(brand.id, brand.name, brand.country, logoUrl);

      for (const model of brand.models) {
        insertModel.run(model.id, brand.id, model.name, model.category);

        const seed = hashCode(`${brand.id}-${model.id}`);
        const listingCount = 1 + (seed % 3);
        const [min, max] = getBasePrice(model.category);

        for (let i = 0; i < listingCount; i += 1) {
          const itemSeed = seed + i * 997;
          const year = 2018 + (itemSeed % 8);
          const price = min + (itemSeed % (max - min));
          const mileage = 5000 + (itemSeed % 95000);
          const listingId = `${brand.id}-${model.id}-${i}`;
          const fuel = model.category === "Electric"
            ? "Electric"
            : model.category === "Hybrid"
              ? "Hybrid"
              : pick(FUEL_TYPES, itemSeed >> 3);

          insertListing.run(
            listingId,
            brand.id,
            model.id,
            year,
            price,
            mileage,
            pick(COLORS, itemSeed),
            pick(TRANSMISSIONS, itemSeed >> 2),
            fuel,
            pick(TRIMS, itemSeed >> 4),
            getImageUrl(model.category, itemSeed),
            `Well-maintained ${year} ${brand.name} ${model.name} in excellent condition.`
          );
        }
      }
    }

    const demoHash = bcrypt.hashSync("demo1234", 10);
    db.prepare(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
    ).run("Demo User", "demo@saifcars.com", demoHash);
  });

  seedAll();

  const stats = {
    brands: db.prepare("SELECT COUNT(*) AS c FROM brands").get().c,
    models: db.prepare("SELECT COUNT(*) AS c FROM models").get().c,
    listings: db.prepare("SELECT COUNT(*) AS c FROM listings").get().c,
  };

  console.log("Database seeded:", stats);
}

seedDatabase();
