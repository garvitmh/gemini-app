
export const GEMSTONE_DISPLAY_NAMES: Record<string, string> = {
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

// Start Case helper (e.g. "blue_sapphire" -> "Blue Sapphire")
const toStartCase = (str: string) => {
    return str
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export const getGemstoneDisplayName = (key: string): string => {
    if (!key) return '';
    const normalizedKey = key.toLowerCase();
    
    // Check exact match in mapping
    if (GEMSTONE_DISPLAY_NAMES[normalizedKey]) {
        return GEMSTONE_DISPLAY_NAMES[normalizedKey];
    }

    // Special case for 'cz' if it comes in slightly different forms
    if (normalizedKey === 'cubic zirconia' || normalizedKey === 'cz cubic zirconia') {
        return GEMSTONE_DISPLAY_NAMES['cz'];
    }

    // Fallback to start case
    return toStartCase(key);
};
