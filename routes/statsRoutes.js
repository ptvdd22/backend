const express = require('express');
const router = express.Router();
const {
    getCategoryExpenses,
    getExpensesEndingIn11,
    getExpensesEndingIn90
    
} = require('../controllers/statsController');

// Route om uitgaven per categorie op te halen
router.get('/expenses', getCategoryExpenses);

// Voorbeeld: als je GET /api/stats/rekening-11 aanroept, haal je data op van rekening 11
router.get('/rekening-11', getExpensesEndingIn11);

// Voorbeeld: als je GET /api/stats/rekening-11 aanroept, haal je data op van rekening 90
router.get('/rekening-90', getExpensesEndingIn90);

module.exports = router;
