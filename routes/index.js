module.exports = (app) => {
    const routes = [
        { path: '/api/labels', module: './labelsRoutes' },
        { path: '/api/categories', module: './categoriesRoutes' },
        { path: '/api/rules', module: './rulesRoutes' },
        { path: '/api/transactions', module: './transactionsRoutes' },
       

    ];

    routes.forEach(route => {
        try {
            const routeModule = require(route.module);
            console.log(`🔍 Route geladen: ${route.path}`, typeof routeModule);

            if (routeModule && typeof routeModule === 'function') {
                app.use(route.path, routeModule);
                console.log(`✅ Route correct gekoppeld: ${route.path}`);
            } else {
                console.error(`❌ Fout: Module ${route.module} retourneert geen functie.`);
            }
        } catch (err) {
            console.error(`❌ Fout bij laden van module ${route.module}:`, err.message);
        }
    });
};
