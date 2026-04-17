/**
 * Centralized Gemstone Display Name Mapping
 *
 * This utility provides consistent display names for gemstones across the application.
 * Internal keys (e.g., "cz") remain unchanged in database and logic.
 * Display transformation happens only at render time.
 */
export declare const GEMSTONE_DISPLAY_NAMES: Record<string, string>;
/**
 * Get display name for a gemstone
 * @param key - Internal gemstone key (e.g., "cz", "diamond", "ruby")
 * @returns Display-friendly name (e.g., "CZ Cubic Zirconia", "Diamond (Heera)")
 */
export declare const getGemstoneDisplayName: (key: string) => string;
//# sourceMappingURL=gemstoneDisplay.d.ts.map