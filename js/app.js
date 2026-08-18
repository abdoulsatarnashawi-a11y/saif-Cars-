const state = {
  brands: [],
  listings: [],
  categories: [],
  user: null,
  token: localStorage.getItem("saif_token"),
  view: "brands",
  favoritesMode: false,
  selectedBrand: null,
  selectedModel: null,
  activeListing: null,
  authMode: "login",
  filters: {
    search: "",
    brand: "",
    category: "",
    minPrice: "",
    maxPrice: "",
    sort: "price-asc",
  },
};

const CATEGORY_ICONS = {
  Sedan: "🚗", SUV: "🚙", Truck: "🛻", Sports: "🏎️", Electric: "⚡",
  Hybrid: "🔋", Hatchback: "🚘", Van: "🚐", Wagon: "🚐", Coupe: "🏁", Convertible: "🌤️",
};

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

function formatMileage(value) {
  return new Intl.NumberFormat("en-US").format(value) + " mi";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  if (token) {
    localStorage.setItem("saif_token", token);
  } else {
    localStorage.removeItem("saif_token");
  }
  renderAuthUI();
}

function renderAuthUI() {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const greeting = document.getElementById("user-greeting");
  const favNav = document.getElementById("nav-favorites");

  if (state.user) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    greeting.textContent = `Hi, ${state.user.name.split(" ")[0]}`;
    greeting.classList.remove("hidden");
    favNav.classList.remove("hidden");
  } else {
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    greeting.classList.add("hidden");
    favNav.classList.add("hidden");
  }
}

function openAuthModal(mode = "login") {
  state.authMode = mode;
  document.getElementById("auth-modal-title").textContent = mode === "login" ? "Sign In" : "Create Account";
  document.getElementById("tab-login").classList.toggle("active", mode === "login");
  document.getElementById("tab-register").classList.toggle("active", mode === "register");
  document.getElementById("name-field").classList.toggle("hidden", mode === "login");
  document.getElementById("auth-error").classList.add("hidden");
  document.getElementById("auth-form").reset();
  document.getElementById("auth-modal").classList.add("open");
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.remove("open");
}

async function loadStats() {
  const stats = await api("/api/stats");
  document.getElementById("stat-brands").textContent = stats.brands;
  document.getElementById("stat-models").textContent = stats.models;
  document.getElementById("stat-listings").textContent = stats.listings;
}

async function loadBrands() {
  const data = await api("/api/brands");
  state.brands = data.brands;
}

async function loadCategories() {
  const data = await api("/api/categories");
  state.categories = data.categories;
}

async function loadListings() {
  const params = new URLSearchParams();
  const { search, brand, category, minPrice, maxPrice, sort } = state.filters;

  if (state.selectedBrand) params.set("brand", state.selectedBrand.id);
  if (state.selectedModel) params.set("model", state.selectedModel.id);
  if (brand) params.set("brand", brand);
  if (category) params.set("category", category);
  if (minPrice) params.set("minPrice", minPrice);
  if (maxPrice) params.set("maxPrice", maxPrice);
  if (search.trim()) params.set("search", search.trim());
  params.set("sort", sort);

  const data = await api(`/api/listings?${params.toString()}`);
  state.listings = data.listings;
}

async function loadFavorites() {
  const data = await api("/api/favorites");
  state.listings = data.listings;
}

function getFilteredBrands() {
  const { search, brand, category } = state.filters;
  const q = search.trim().toLowerCase();

  return state.brands.filter((item) => {
    if (brand && item.id !== brand) return false;
    if (category && !item.models.some((m) => m.category === category)) return false;
    if (!q) return true;
    return item.name.toLowerCase().includes(q) ||
      item.models.some((m) => m.name.toLowerCase().includes(q));
  });
}

function getFilteredModels() {
  if (!state.selectedBrand) return [];
  const { search, category } = state.filters;
  const q = search.trim().toLowerCase();

  return state.selectedBrand.models.filter((model) => {
    if (category && model.category !== category) return false;
    if (!q) return true;
    return model.name.toLowerCase().includes(q) ||
      state.selectedBrand.name.toLowerCase().includes(q);
  });
}

function goHome() {
  state.selectedBrand = null;
  state.selectedModel = null;
  state.favoritesMode = false;
  state.view = "brands";
  refresh();
}

function goToBrands() {
  state.selectedModel = null;
  state.favoritesMode = false;
  state.view = state.selectedBrand ? "models" : "brands";
  refresh();
}

function selectBrand(brandId) {
  state.selectedBrand = state.brands.find((b) => b.id === brandId) || null;
  state.selectedModel = null;
  state.favoritesMode = false;
  state.view = "models";
  refresh();
}

function selectModel(modelId) {
  if (!state.selectedBrand) return;
  state.selectedModel = state.selectedBrand.models.find((m) => m.id === modelId) || null;
  state.favoritesMode = false;
  state.view = "listings";
  refresh();
}

function viewAllListings() {
  state.selectedBrand = null;
  state.selectedModel = null;
  state.favoritesMode = false;
  state.view = "listings";
  refresh();
}

function runSearch() {
  const input = document.getElementById("search-input");
  state.filters.search = input.value;
  if (state.filters.search.trim()) {
    state.selectedBrand = null;
    state.selectedModel = null;
    state.favoritesMode = false;
    state.view = "listings";
  }
  refresh();
}

function viewFavorites() {
  if (!state.user) {
    openAuthModal("login");
    return;
  }
  state.favoritesMode = true;
  state.view = "listings";
  refresh();
}

async function openListingModal(listingId) {
  try {
    const data = await api(`/api/listings/${listingId}`);
    state.activeListing = data.listing;
    const listing = data.listing;

    document.getElementById("modal-title").textContent =
      `${listing.year} ${listing.brandName} ${listing.modelName}`;

    document.getElementById("modal-body").innerHTML = `
      <img class="modal-image" src="${listing.imageUrl}" alt="${listing.brandName} ${listing.modelName}">
      <p class="modal-subtitle">${listing.trim} trim · ${listing.color} · ${listing.country}</p>
      <div class="price modal-price">${formatPrice(listing.price)}</div>
      <p style="color: var(--muted); margin-bottom: 1rem;">${listing.description}</p>
      <div class="detail-grid">
        <div class="detail-item"><span>Year</span><strong>${listing.year}</strong></div>
        <div class="detail-item"><span>Mileage</span><strong>${formatMileage(listing.mileage)}</strong></div>
        <div class="detail-item"><span>Category</span><strong>${listing.category}</strong></div>
        <div class="detail-item"><span>Transmission</span><strong>${listing.transmission}</strong></div>
        <div class="detail-item"><span>Fuel Type</span><strong>${listing.fuel}</strong></div>
        <div class="detail-item"><span>Listing ID</span><strong>${listing.id}</strong></div>
      </div>
      <textarea id="inquiry-message" class="inquiry-input" placeholder="Write your message to the dealer..." rows="3"></textarea>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" onclick="sendInquiry()">Contact Dealer</button>
        <button class="btn btn-secondary" type="button" onclick="toggleFavorite()">
          ${listing.isFavorite ? "♥ Saved" : "♡ Save"}
        </button>
        <button class="btn btn-secondary" type="button" onclick="closeModal()">Close</button>
      </div>
    `;

    document.getElementById("listing-modal").classList.add("open");
  } catch (error) {
    alert(error.message);
  }
}

function closeModal() {
  document.getElementById("listing-modal").classList.remove("open");
  state.activeListing = null;
}

async function sendInquiry() {
  if (!state.user) {
    closeModal();
    openAuthModal("login");
    return;
  }

  const message = document.getElementById("inquiry-message")?.value?.trim();
  if (!message) {
    alert("Please write a message first.");
    return;
  }

  try {
    await api(`/api/listings/${state.activeListing.id}/inquire`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    alert("Your inquiry was sent successfully!");
    closeModal();
  } catch (error) {
    alert(error.message);
  }
}

async function toggleFavorite() {
  if (!state.user) {
    closeModal();
    openAuthModal("login");
    return;
  }

  const listing = state.activeListing;
  try {
    if (listing.isFavorite) {
      await api(`/api/listings/${listing.id}/favorite`, { method: "DELETE" });
      listing.isFavorite = false;
    } else {
      await api(`/api/listings/${listing.id}/favorite`, { method: "POST" });
      listing.isFavorite = true;
    }
    await refresh();
    openListingModal(listing.id);
  } catch (error) {
    alert(error.message);
  }
}

function renderBreadcrumb() {
  const el = document.getElementById("breadcrumb");
  const parts = [`<button type="button" onclick="goHome()">All Brands</button>`];

  if (state.favoritesMode) {
    parts.push("<span>/</span><span>Favorites</span>");
  } else {
    if (state.selectedBrand) {
      parts.push("<span>/</span>");
      parts.push(`<button type="button" onclick="goToBrands()">${state.selectedBrand.name}</button>`);
    }
    if (state.selectedModel) {
      parts.push("<span>/</span>");
      parts.push(`<span>${state.selectedModel.name}</span>`);
    }
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
      <img class="brand-logo" src="${brand.logoUrl}" alt="${brand.name}" loading="lazy">
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
    const icon = CATEGORY_ICONS[model.category] || "🚗";
    return `
      <article class="model-card" onclick="selectModel('${model.id}')">
        <span class="category">${model.category}</span>
        <h3>${icon} ${model.name}</h3>
        <p>View available listings</p>
      </article>
    `;
  }).join("");
}

function renderListings() {
  const container = document.getElementById("listings-grid");

  if (!state.listings.length) {
    container.innerHTML = `<div class="empty-state">No listings match your filters.</div>`;
    return;
  }

  container.innerHTML = state.listings.map((listing) => `
    <article class="listing-card" onclick="openListingModal('${listing.id}')">
      <img class="listing-image" src="${listing.imageUrl}" alt="${listing.brandName} ${listing.modelName}" loading="lazy">
      <div class="listing-body">
        <h3>${listing.year} ${listing.brandName} ${listing.modelName}</h3>
        <p class="listing-subtitle">${listing.trim} · ${listing.color}</p>
        <div class="listing-meta">
          <span class="tag">${formatMileage(listing.mileage)}</span>
          <span class="tag">${listing.transmission}</span>
          <span class="tag">${listing.fuel}</span>
          ${listing.isFavorite ? '<span class="tag tag-fav">♥ Saved</span>' : ""}
        </div>
        <div class="price-row">
          <span class="price">${formatPrice(listing.price)}</span>
          <button class="btn btn-secondary btn-sm" type="button">View Details</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderSectionTitles() {
  document.getElementById("brands-section").classList.toggle("hidden", state.view !== "brands");
  document.getElementById("models-section").classList.toggle("hidden", state.view !== "models");
  document.getElementById("listings-section").classList.toggle("hidden", state.view !== "listings");

  if (state.view === "brands") {
    document.getElementById("section-heading").textContent = "Browse by Brand";
    document.getElementById("section-subheading").textContent =
      `${getFilteredBrands().length} brands available`;
  } else if (state.view === "models") {
    document.getElementById("models-heading").textContent = `${state.selectedBrand.name} Models`;
    document.getElementById("models-subheading").textContent =
      `${getFilteredModels().length} models · ${state.selectedBrand.country}`;
  } else if (state.favoritesMode) {
    document.getElementById("listings-heading").textContent = "My Favorites";
    document.getElementById("listings-subheading").textContent =
      `${state.listings.length} saved vehicles`;
  } else {
    const title = state.selectedModel
      ? `${state.selectedBrand.name} ${state.selectedModel.name}`
      : "All Listings";
    document.getElementById("listings-heading").textContent = title;
    document.getElementById("listings-subheading").textContent =
      `${state.listings.length} vehicles found`;
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
    state.categories.map((c) => `<option value="${c}">${c}</option>`).join("");
  select.value = current;
}

async function refresh() {
  if (state.view === "listings") {
    if (state.favoritesMode) {
      await loadFavorites();
    } else {
      await loadListings();
    }
  }
  render();
}

function render() {
  renderBreadcrumb();
  renderSectionTitles();
  renderBrands();
  renderModels();
  renderListings();
}

function bindEvents() {
  const rerender = () => refresh();

  document.getElementById("search-input").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    if (state.view === "listings") refresh();
    else render();
  });

  document.getElementById("search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  });

  document.getElementById("search-btn").addEventListener("click", runSearch);

  document.getElementById("filter-brand").addEventListener("change", (e) => {
    state.filters.brand = e.target.value;
    if (e.target.value && state.view === "brands") {
      selectBrand(e.target.value);
      return;
    }
    refresh();
  });

  ["filter-category", "filter-min-price", "filter-max-price", "filter-sort"].forEach((id) => {
    document.getElementById(id).addEventListener("change", (e) => {
      const key = id.replace("filter-", "").replace("-price", "Price");
      const map = {
        category: "category",
        minPrice: "minPrice",
        maxPrice: "maxPrice",
        sort: "sort",
      };
      state.filters[map[key] || key] = e.target.value;
      refresh();
    });
  });

  document.getElementById("filter-min-price").addEventListener("input", (e) => {
    state.filters.minPrice = e.target.value;
    refresh();
  });
  document.getElementById("filter-max-price").addEventListener("input", (e) => {
    state.filters.maxPrice = e.target.value;
    refresh();
  });

  document.getElementById("view-listings-btn").addEventListener("click", viewAllListings);
  document.getElementById("login-btn").addEventListener("click", () => openAuthModal("login"));
  document.getElementById("logout-btn").addEventListener("click", () => {
    setAuth(null, null);
    if (state.favoritesMode) goHome();
    else refresh();
  });

  document.getElementById("tab-login").addEventListener("click", () => openAuthModal("login"));
  document.getElementById("tab-register").addEventListener("click", () => openAuthModal("register"));

  document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("auth-error");
    errorEl.classList.add("hidden");

    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const name = document.getElementById("auth-name").value;

    try {
      const endpoint = state.authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = state.authMode === "login"
        ? { email, password }
        : { name, email, password };

      const data = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
      setAuth(data.token, data.user);
      closeAuthModal();
      refresh();
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    }
  });

  document.getElementById("modal-overlay-close").addEventListener("click", closeModal);
  document.getElementById("listing-modal").addEventListener("click", (e) => {
    if (e.target.id === "listing-modal") closeModal();
  });
  document.getElementById("auth-modal-close").addEventListener("click", closeAuthModal);
  document.getElementById("auth-modal").addEventListener("click", (e) => {
    if (e.target.id === "auth-modal") closeAuthModal();
  });
}

async function init() {
  try {
    bindEvents();
    await Promise.all([loadStats(), loadBrands(), loadCategories()]);

    if (state.token) {
      try {
        const data = await api("/api/auth/me");
        state.user = data.user;
      } catch {
        setAuth(null, null);
      }
    }

    populateBrandFilter();
    populateCategoryFilter();
    renderAuthUI();
    render();
  } catch (error) {
    document.body.innerHTML =
      `<div class="empty-state" style="margin: 4rem auto; width: min(600px, 90%);">
        Failed to load application. Please refresh the page.
      </div>`;
    console.error(error);
  }
}

init();
