/**
 * Utility functions for handling paths across different environments
 */

/**
 * Determines if the app is running in a development environment
 */
export const isDevelopmentEnvironment = (): boolean => {
    // Check both the hostname and Vite's MODE environment variable
    return (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') &&
        import.meta.env.MODE === 'development';
};

/**
 * Determines if the app is running in a production preview mode (production build on localhost)
 */
export const isProductionPreview = (): boolean => {
    return (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') &&
        import.meta.env.MODE === 'production';
};

/**
 * Gets the correct base path depending on the environment
 * Uses Vite's import.meta.env.BASE_URL which is automatically set based on the vite.config.ts
 */
export const getBasePath = (): string => {
    // import.meta.env.BASE_URL is correctly set by Vite based on the 'base' configuration
    // It will be '/' in development and '/escparty/' in production
    return import.meta.env.BASE_URL;
};

/**
 * Creates a correct asset path that works in both development and production
 * @param path The path to the asset relative to the public folder
 */
export const getAssetPath = (path: string): string => {
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const basePath = getBasePath();

    // Handle the case where basePath already has a trailing slash
    const baseWithCorrectSlash = basePath.endsWith('/') ? basePath : `${basePath}/`;

    return `${baseWithCorrectSlash}${cleanPath}`;
};