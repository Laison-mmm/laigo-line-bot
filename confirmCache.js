const cache = {};

function saveCache(userId, data) {
  cache[userId] = data;
}

function getCache(userId) {
  return cache[userId];
}

function clearCache(userId) {
  delete cache[userId];
}

module.exports = { saveCache, getCache, clearCache };
