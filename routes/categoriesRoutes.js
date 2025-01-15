const express = require('express');
const router = express.Router();
const {
    getAllCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    suggestCategories, 
} = require('../controllers/categoriesController');

// Haal alle categorieën op
router.get('/', getAllCategories);

// Voeg een categorie toe
router.post('/', addCategory);

// Update een categorie
router.put('/:id', updateCategory);

// Verwijder een categorie
router.delete('/:id', deleteCategory);

// Haal suggesties voor categorieën
router.get('/suggest', suggestCategories);

module.exports = router;