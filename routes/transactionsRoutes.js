const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multerConfig');
const {
    getAllTransactions,
    updateTransaction,
    importTransactions,
    getCategories,
    splitTransaction,
    getLabels,
    getUncategorizedTransactions
} = require('../controllers/transactionsController');

// Haal alle transacties op
router.get('/', getAllTransactions);

// Update een transactie
router.put('/:id', updateTransaction);

// Importeer transacties vanuit CSV
router.post('/import', upload.single('file'), importTransactions);

// routes voor categorieën en labels
router.get('/categories', getCategories);
router.get('/labels', getLabels);

// Split transactie
router.post('/split', splitTransaction);

router.get('/uncategorized', getUncategorizedTransactions);


module.exports = router;