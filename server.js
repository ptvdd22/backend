// 📌 Basisconfiguratie en afhankelijkheden
const express = require('express');
require('dotenv').config();
require('express-async-errors'); // Asynchrone foutafhandeling
const configureMiddleware = require('./middlewares/globalMiddleware');
const errorHandler = require('./middlewares/errorHandler');
const loadRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// 🔍 Debugging: Controleer configureMiddleware
console.log('configureMiddleware:', configureMiddleware);

// 📌 Middleware instellen
configureMiddleware(app);

// 📌 Routes koppelen
loadRoutes(app);

// ✅ Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: '✅ Server is actief en gezond!' });
});

// 📌 Globale foutafhandelaar
app.use(errorHandler);

// 🚀 Start de server
app.listen(PORT, () => {
    console.log(`🚀 Server draait op poort ${PORT}`);
});

module.exports = loadRoutes;