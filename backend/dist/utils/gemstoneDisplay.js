"use strict";
/**
 * Centralized Gemstone Display Name Mapping
 *
 * This utility provides consistent display names for gemstones across the application.
 * Internal keys (e.g., "cz") remain unchanged in database and logic.
 * Display transformation happens only at render time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGemstoneDisplayName = exports.GEMSTONE_DISPLAY_NAMES = void 0;
exports.GEMSTONE_DISPLAY_NAMES = {
    ruby: 'Ruby (Manik)',
    diamond: 'Diamond (Heera)',
    pearl: 'Pearl (Moti)',
    black_beeds: 'Black Beeds',
    yellow_sapphire: 'Yellow Sapphire (Pukhraj)',
    blue_sapphire: 'Blue Sapphire (Neelam)',
    emerald: 'Emerald (Panna)',
    red_coral: 'Red Coral (Moonga)',
    cats_eye: 'Cat\'s Eye (Lehsunia)',
    hessonite: 'Hessonite (Gomed)',
    opal: 'Opal',
    garnet: 'Garnet',
    aquamarine: 'Aquamarine',
    topaz: 'Topaz',
    navratan: 'Navratan',
    mother_of_pearl: 'Mother of Pearl',
    moissanite: 'Moissanite',
    cz: 'CZ Cubic Zirconia',
};
/**
 * Get display name for a gemstone
 * @param key - Internal gemstone key (e.g., "cz", "diamond", "ruby")
 * @returns Display-friendly name (e.g., "CZ Cubic Zirconia", "Diamond (Heera)")
 */
const getGemstoneDisplayName = (key) => {
    if (!key)
        return '';
    // Normalize: lowercase and replace spaces with underscores
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
    // Check exact match in mapping
    if (exports.GEMSTONE_DISPLAY_NAMES[normalizedKey]) {
        return exports.GEMSTONE_DISPLAY_NAMES[normalizedKey];
    }
    // Special case for CZ variations
    if (normalizedKey.includes('cubic') && normalizedKey.includes('zirconia')) {
        return exports.GEMSTONE_DISPLAY_NAMES['cz'];
    }
    if (normalizedKey === 'cz' || normalizedKey === 'c_z') {
        return exports.GEMSTONE_DISPLAY_NAMES['cz'];
    }
    // Fallback: Convert to Start Case (e.g., "blue_sapphire" -> "Blue Sapphire")
    return key
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};
exports.getGemstoneDisplayName = getGemstoneDisplayName;
//# sourceMappingURL=gemstoneDisplay.js.map