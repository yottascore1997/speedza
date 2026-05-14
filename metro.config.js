const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Prefer Node crawling on Windows (Watchman + OneDrive can yield incomplete file maps).
config.resolver.useWatchman = false;

module.exports = config;
