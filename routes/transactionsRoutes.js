const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multerConfig');
const {
    getAllTransactions,
    getUncategorizedTransactions,
    getTransactionsWithoutLabel,
    updateTransaction,
    importTransactions,
    getCategories,
    splitTransaction,
    getLabels
} = require('../controllers/transactionsController');

// Haal alle transacties op
router.get('/', getAllTransactions);

// Haal transacties zonder categorie op
router.get('/uncategorized', getUncategorizedTransactions);

// Haal transacties zonder label op
router.get('/no-label', getTransactionsWithoutLabel);

// Update een transactie
router.put('/:id', updateTransaction);

// Importeer transacties vanuit CSV
router.post('/import', upload.single('file'), importTransactions);

// routes voor categorieën en labels
router.get('/categories', getCategories);
router.get('/labels', getLabels);

// Split transactie
router.post('/split', splitTransaction);

module.exports = router;