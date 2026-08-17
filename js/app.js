const state = {
  brands: [],
  listings: [],
  view: "brands",
  selectedBrand: null,
  selectedModel: null,
  filters: {
    search: "",
    brand: "",
    category: "",
    minPrice: "",
    maxPrice: "",
    sort: "price-asc",
  },
};

const COLORS = [
  "White", "Black", "Silver", "Gray", "Blue", "Red",
  "Green", "Brown", "Beige", "Orange", "Yellow", "Gold",
];

const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "Dual-Clutch"];
const FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Electric", "Plug-in Hybrid"];
const TRIMS = ["Base", "Sport", "Premium", "Limited", "Platinum", "Touring"];

const CATEGORY_ICONS = {
  Sedan: "🚗",
  SUV: "🚙",
  Truck: "🛻",
  Sports: "🏎️",
  Electric: "⚡",
  Hybrid: "🔋",
  Hatchback: "🚘",
  Van: "🚐",
  Wagon: "🚐",
  Coupe: "🏁",
  Convertible: "🌤️",
};

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

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMileage(value) {
  return new Intl.NumberFormat("en-US").format(value) + " mi";
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

function generateListings(brands) {
  const listings = [];

  brands.forEach((brand) => {
    brand.models.forEach((model) => {
      const seed = hashCode(`${brand.id}-${model.id}`);
      const count = 1 + (seed % 3);
      const [min, max] = getBasePrice(model.category);

      for (let i = 0; i < count; i += 1) {
        const itemSeed = seed + i * 997;
        const year = 2018 + (itemSeed % 8);
        const price = min + (itemSeed % (max - min));
        const mileage = 5000 + (itemSeed % 95000);
        const listingId = `${brand.id}-${model.id}-${i}`;

        listings.push({
          id: listingId,
          brandId: brand.id,
          brandName: brand.name,
          modelId: model.id,
          modelName: model.name,
          category: model.category,
          year,
          price,
          mileage,
          color: pick(COLORS, itemSeed),
          transmission: pick(TRANSMISSIONS, itemSeed >> 2),
          fuel: model.category === "Electric"
            ? "Electric"
            : model.category === "Hybrid"
              ? "Hybrid"
              : pick(FUEL_TYPES, itemSeed >> 3),
          trim: pick(TRIMS, itemSeed >> 4),
          country: brand.country,
        });
      }
    });
  });

  return listings;
}

function getCategories() {
  const set = new Set();
  state.brands.forEach((brand) => {
    brand.models.forEach((model) => set.add(model.category));
  });
  return [...set].sort();
}

function getFilteredBrands() {
  const { search, brand, category } = state.filters;
  const q = search.trim().toLowerCase();

  return state.brands.filter((item) => {
    if (brand && item.id !== brand) return false;
    if (category && !item.models.some((m) => m.category === category)) return false;
    if (!q) return true;

    const inBrand = item.name.toLowerCase().includes(q);
    const inModels = item.models.some((m) => m.name.toLowerCase().includes(q));
    return inBrand || inModels;
  });
}

function getFilteredModels() {
  if (!state.selectedBrand) return [];
  const { search, category } = state.filters;
  const q = search.trim().toLowerCase();

  return state.selectedBrand.models.filter((model) => {
    if (category && model.category !== category) return false;
    if (!q) return true;
    return (
      model.name.toLowerCase().includes(q) ||
      state.selectedBrand.name.toLowerCase().includes(q)
    );
  });
}

function getFilteredListings() {
  const { search, brand, category, minPrice, maxPrice, sort } = state.filters;
  const q = search.trim().toLowerCase();
  let results = [...state.listings];

  if (state.selectedBrand) {
    results = results.filter((l) => l.brandId === state.selectedBrand.id);
  }
  if (state.selectedModel) {
    results = results.filter(
      (l) => l.modelId === state.selectedModel.id && l.brandId === state.selectedBrand.id
    );
  }
  if (brand) results = results.filter((l) => l.brandId === brand);
  if (category) results = results.filter((l) => l.category === category);
  if (minPrice) results = results.filter((l) => l.price >= Number(minPrice));
  if (maxPrice) results = results.filter((l) => l.price <= Number(maxPrice));

  if (q) {
    results = results.filter((l) => {
      const haystack = [
        l.brandName,
        l.modelName,
        l.category,
        l.color,
        l.trim,
        String(l.year),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }

  switch (sort) {
    case "price-desc":
      results.sort((a, b) => b.price - a.price);
      break;
    case "year-desc":
      results.sort((a, b) => b.year - a.year);
      break;
    case "mileage-asc":
      results.sort((a, b) => a.mileage - b.mileage);
      break;
    default:
      results.sort((a, b) => a.price - b.price);
  }

  return results;
}

function setView(view) {
  state.view = view;
  render();
}

function selectBrand(brandId) {
  state.selectedBrand = state.brands.find((b) => b.id === brandId) || null;
  state.selectedModel = null;
  state.view = "models";
  render();
}

function selectModel(modelId) {
  if (!state.selectedBrand) return;
  state.selectedModel = state.selectedBrand.models.find((m) => m.id === modelId) || null;
  state.view = "listings";
  render();
}

function goHome() {
  state.selectedBrand = null;
  state.selectedModel = null;
  state.view = "brands";
  render();
}

function goToBrands() {
  state.selectedModel = null;
  state.view = state.selectedBrand ? "models" : "brands";
  render();
}

function openListingModal(listingId) {
  const listing = state.listings.find((l) => l.id === listingId);
  if (!listing) return;

  document.getElementById("modal-title").textContent =
    `${listing.year} ${listing.brandName} ${listing.modelName}`;
  document.getElementById("modal-body").innerHTML = `
    <p style="color: var(--muted); margin-bottom: 0.5rem;">
      ${listing.trim} trim · ${listing.color} · ${listing.country}
    </p>
    <div class="price" style="font-size: 1.5rem; margin-bottom: 1rem;">${formatPrice(listing.price)}</div>
    <div class="detail-grid">
      <div class="detail-item"><span>Year</span><strong>${listing.year}</strong></div>
      <div class="detail-item"><span>Mileage</span><strong>${formatMileage(listing.mileage)}</strong></div>
      <div class="detail-item"><span>Category</span><strong>${listing.category}</strong></div>
      <div class="detail-item"><span>Transmission</span><strong>${listing.transmission}</strong></div>
      <div class="detail-item"><span>Fuel Type</span><strong>${listing.fuel}</strong></div>
      <div class="detail-item"><span>Listing ID</span><strong>${listing.id}</strong></div>
    </div>
    <div style="margin-top: 1.25rem; display: flex; gap: 0.75rem;">
      <button class="btn btn-primary" onclick="alert('Contact request sent for ${listing.brandName} ${listing.modelName}!')">Contact Dealer</button>
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;

  document.getElementById("listing-modal").classList.add("open");
}

function closeModal() {
  document.getElementById("listing-modal").classList.remove("open");
}

function renderStats() {
  const brandCount = state.brands.length;
  const modelCount = state.brands.reduce((sum, b) => sum + b.models.length, 0);
  document.getElementById("stat-brands").textContent = brandCount;
  document.getElementById("stat-models").textContent = modelCount;
  document.getElementById("stat-listings").textContent = state.listings.length;
}

function renderBreadcrumb() {
  const el = document.getElementById("breadcrumb");
  const parts = [`<button type="button" onclick="goHome()">All Brands</button>`];

  if (state.selectedBrand) {
    parts.push("<span>/</span>");
    parts.push(
      `<button type="button" onclick="goToBrands()">${state.selectedBrand.name}</button>`
    );
  }
  if (state.selectedModel) {
    parts.push("<span>/</span>");
    parts.push(`<span>${state.selectedModel.name}</span>`);
  }

  el.innerHTML = parts.join("");
}

function renderBrands() {
  const container = document.getElementById("brands-grid");
  const brands = getFilteredBrands();

  if (!brands.length) {
    container.innerHTML = `<div class="empty-state">No brands match your search.</div>`;
    return;
  }

  container.innerHTML = brands.map((brand) => `
    <article class="brand-card" onclick="selectBrand('${brand.id}')">
      <div class="initial">${brand.name.charAt(0)}</div>
      <h3>${brand.name}</h3>
      <p>${brand.models.length} models · ${brand.country}</p>
    </article>
  `).join("");
}

function renderModels() {
  const container = document.getElementById("models-grid");
  const models = getFilteredModels();

  if (!models.length) {
    container.innerHTML = `<div class="empty-state">No models found for this brand.</div>`;
    return;
  }

  container.innerHTML = models.map((model) => {
    const count = state.listings.filter(
      (l) => l.brandId === state.selectedBrand.id && l.modelId === model.id
    ).length;
    const icon = CATEGORY_ICONS[model.category] || "🚗";

    return `
      <article class="model-card" onclick="selectModel('${model.id}')">
        <span class="category">${model.category}</span>
        <h3>${icon} ${model.name}</h3>
        <p>${count} listing${count === 1 ? "" : "s"} available</p>
      </article>
    `;
  }).join("");
}

function renderListings() {
  const container = document.getElementById("listings-grid");
  const listings = getFilteredListings();

  if (!listings.length) {
    container.innerHTML = `<div class="empty-state">No listings match your filters.</div>`;
    return;
  }

  container.innerHTML = listings.map((listing) => {
    const icon = CATEGORY_ICONS[listing.category] || "🚗";
    return `
      <article class="listing-card" onclick="openListingModal('${listing.id}')">
        <div class="listing-image">${icon}</div>
        <div class="listing-body">
          <h3>${listing.year} ${listing.brandName} ${listing.modelName}</h3>
          <p style="color: var(--muted); font-size: 0.88rem;">${listing.trim} · ${listing.color}</p>
          <div class="listing-meta">
            <span class="tag">${formatMileage(listing.mileage)}</span>
            <span class="tag">${listing.transmission}</span>
            <span class="tag">${listing.fuel}</span>
          </div>
          <div class="price-row">
            <span class="price">${formatPrice(listing.price)}</span>
            <button class="btn btn-secondary btn-sm" type="button">View Details</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderSectionTitles() {
  const brandsSection = document.getElementById("brands-section");
  const modelsSection = document.getElementById("models-section");
  const listingsSection = document.getElementById("listings-section");

  brandsSection.classList.toggle("hidden", state.view !== "brands");
  modelsSection.classList.toggle("hidden", state.view !== "models");
  listingsSection.classList.toggle("hidden", state.view !== "listings");

  if (state.view === "brands") {
    document.getElementById("section-heading").textContent = "Browse by Brand";
    document.getElementById("section-subheading").textContent =
      `${getFilteredBrands().length} brands available`;
  } else if (state.view === "models") {
    document.getElementById("models-heading").textContent =
      `${state.selectedBrand.name} Models`;
    document.getElementById("models-subheading").textContent =
      `${getFilteredModels().length} models · ${state.selectedBrand.country}`;
  } else {
    const title = state.selectedModel
      ? `${state.selectedBrand.name} ${state.selectedModel.name}`
      : "All Listings";
    document.getElementById("listings-heading").textContent = title;
    document.getElementById("listings-subheading").textContent =
      `${getFilteredListings().length} vehicles found`;
  }
}

function populateBrandFilter() {
  const select = document.getElementById("filter-brand");
  const current = state.filters.brand;
  select.innerHTML = `<option value="">All Brands</option>` +
    state.brands.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
  select.value = current;
}

function populateCategoryFilter() {
  const select = document.getElementById("filter-category");
  const current = state.filters.category;
  select.innerHTML = `<option value="">All Categories</option>` +
    getCategories().map((c) => `<option value="${c}">${c}</option>`).join("");
  select.value = current;
}

function bindFilters() {
  document.getElementById("search-input").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    render();
  });

  document.getElementById("filter-brand").addEventListener("change", (e) => {
    state.filters.brand = e.target.value;
    if (e.target.value && state.view === "brands") {
      selectBrand(e.target.value);
      return;
    }
    render();
  });

  document.getElementById("filter-category").addEventListener("change", (e) => {
    state.filters.category = e.target.value;
    render();
  });

  document.getElementById("filter-min-price").addEventListener("input", (e) => {
    state.filters.minPrice = e.target.value;
    render();
  });

  document.getElementById("filter-max-price").addEventListener("input", (e) => {
    state.filters.maxPrice = e.target.value;
    render();
  });

  document.getElementById("filter-sort").addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    render();
  });

  document.getElementById("view-listings-btn").addEventListener("click", () => {
    state.selectedModel = null;
    state.view = "listings";
    render();
  });

  document.getElementById("modal-overlay-close").addEventListener("click", closeModal);
  document.getElementById("listing-modal").addEventListener("click", (e) => {
    if (e.target.id === "listing-modal") closeModal();
  });
}

function render() {
  renderStats();
  renderBreadcrumb();
  renderSectionTitles();
  renderBrands();
  renderModels();
  renderListings();
}

async function init() {
  try {
    const response = await fetch("/data/brands.json");
    const data = await response.json();
    state.brands = data.brands.sort((a, b) => a.name.localeCompare(b.name));
    state.listings = generateListings(state.brands);

    populateBrandFilter();
    populateCategoryFilter();
    bindFilters();
    render();
  } catch (error) {
    document.body.innerHTML =
      `<div class="empty-state" style="margin: 4rem auto; width: min(600px, 90%);">
        Failed to load vehicle data. Please refresh the page.
      </div>`;
    console.error(error);
  }
}

init();
