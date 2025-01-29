const express = require('express');
const router = express.Router();
const {
    addRule,
    getRules,
    deleteRule,
    updateRule,
} = require('../controllers/rulesController');

// Voeg een regel toe
router.post('/', addRule);

// Haal alle regels op
router.get('/', getRules);

// Verwijder een regel
router.delete('/:id', deleteRule);

// Update een regel
router.put('/:id', updateRule);

module.exports = router;
