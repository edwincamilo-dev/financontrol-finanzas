const { defineConfig } = require('cypress');

// FinanControl es una API (no tiene interfaz web), por eso las pruebas E2E usan cy.request().
// Antes de ejecutarlas hay que levantar el servidor y MySQL:  npm start
module.exports = defineConfig({
    e2e: {
        baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
        specPattern: 'cypress/e2e/**/*.cy.js',
        supportFile: false,
        video: false,
        screenshotOnRunFailure: false
    }
});
