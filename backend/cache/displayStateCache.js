/**
 * Display State Cache Manager
 * Manages caching of the display-state endpoint response to reduce database queries
 */

const displayStateCache = {
  data: null,
  timestamp: 0,
  TTL_MS: 3000, // Cache for 3 seconds
};

function getDisplayStateCache() {
  const age = Date.now() - displayStateCache.timestamp;
  if (displayStateCache.data && age < displayStateCache.TTL_MS) {
    console.log(`[Cache] Serving display-state from cache (age: ${age}ms)`);
    return displayStateCache.data;
  }
  return null;
}

function setDisplayStateCache(data) {
  displayStateCache.data = data;
  displayStateCache.timestamp = Date.now();
  console.log("[Cache] Display state cached");
}

function invalidateDisplayStateCache() {
  console.log("[Cache] Display state cache invalidated");
  displayStateCache.data = null;
  displayStateCache.timestamp = 0;
}

module.exports = {
  getDisplayStateCache,
  setDisplayStateCache,
  invalidateDisplayStateCache,
};
