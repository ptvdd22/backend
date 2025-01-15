const express = require('express');
const router = express.Router();
const {
    getAllLabels,
    addLabel,
    updateLabel,
    deleteLabel,
    getDistinctLabels,
    suggestLabels
} = require('../controllers/labelsController');

// Haal alle labels op
router.get('/', getAllLabels);

// Voeg een label toe
router.post('/', addLabel);

// Wijzig een label
router.put('/:id', updateLabel);

// Verwijder een label
router.delete('/:id', deleteLabel);

// Haal unieke labels op uit transacties
router.get('/distinct', getDistinctLabels);

// Zoek suggesties voor labels
router.get('/suggest', suggestLabels);

module.exports = router;
