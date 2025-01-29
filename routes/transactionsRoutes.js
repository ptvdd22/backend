const express = require('express');
const router = express.Router();
const {
    getAllTransactions,
    updateTransaction,
    getCategories,
    splitTransaction,
    getLabels
} = require('../controllers/transactionsController');

// Haal alle transacties op
router.get('/', getAllTransactions);

// Update een transactie
router.put('/:id', updateTransaction);

// routes voor categorieën en labels
router.get('/categories', getCategories);
router.get('/labels', getLabels);

// Split transactie
router.post('/split', splitTransaction);

module.exports = router;