// Defined only by the local `vite dev` server (see vite.config.ts); undefined in every build.
declare const __PORTFOLIO_VITE_DEV_SERVER__: boolean | undefined;

// Defined at build time by vite.config.ts (portfolio-build-info plugin); undefined under Vitest.
declare const __PORTFOLIO_VERSION__: string | undefined;
declare const __PORTFOLIO_BUILD_COMMIT__: string | null | undefined;
