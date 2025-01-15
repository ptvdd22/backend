const express = require('express');
const router = express.Router();
const {
    addRule,
    applyRules,
    getRules,
    deleteRule,
    updateRule
} = require('../controllers/rulesController');

// Voeg een regel toe
router.post('/', addRule);

// Pas regels toe op transacties
router.post('/apply', applyRules);

// Haal alle regels op
router.get('/', getRules);

// Verwijder een regel
router.delete('/:id', deleteRule);

// Update een regel
router.put('/:id', updateRule);

// Toepassen regels op import
router.post('/apply', applyRules);

module.exports = router;
