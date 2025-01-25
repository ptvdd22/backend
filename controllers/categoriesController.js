const pool = require('../db'); // Zorg ervoor dat je databaseconfiguratie goed is aangesloten

// Haal alle categorieën op
exports.getAllCategories = async (req, res) => {
    try {
        // Haal ook de 'type' kolom op
        const { rows } = await pool.query('SELECT id, naam, icon, type FROM categories ORDER BY naam ASC');
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen van categorieën:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen categorieën' });
    }
};

// Voeg een categorie toe
exports.addCategory = async (req, res) => {
    const { naam, icon, type } = req.body;
    try {
        await pool.query('INSERT INTO categories (naam, icon, type) VALUES ($1, $2, $3)', [naam, icon, type]);
        res.status(201).json({ message: '✅ Categorie toegevoegd' });
    } catch (err) {
        console.error('❌ Fout bij toevoegen van categorie:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij toevoegen categorie' });
    }
};

// API: Wijzig een categorie
exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { naam, icon, type } = req.body;

    if (!naam) {
        return res.status(400).json({ error: '❌ Naam van de categorie is vereist' });
    }

    try {
        const result = await pool.query(
            'UPDATE categories SET naam = $1, icon = $2, type = $3 WHERE id = $4',
            [naam, icon, type, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '❌ Categorie niet gevonden' });
        }

        res.status(200).json({ message: '✅ Categorie succesvol bijgewerkt' });
    } catch (err) {
        console.error('❌ Fout bij bijwerken categorie:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij bijwerken categorie' });
    }
};

// Verwijder een categorie
exports.deleteCategory = async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('UPDATE transactions SET category_id = NULL WHERE category_id = $1', [id]);
        const result = await pool.query('DELETE FROM categories WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '❌ Categorie niet gevonden' });
        }

        res.status(200).json({ message: '✅ Categorie succesvol verwijderd' });
    } catch (err) {
        console.error('❌ Fout bij verwijderen categorie:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij verwijderen categorie' });
    }
};

// ✅ Haal categorie-suggesties op
exports.suggestCategories = async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: '❌ Query-parameter is vereist voor suggesties.' });
    }

    try {
        const result = await pool.query(
            `SELECT id, naam FROM categories WHERE naam ILIKE $1 LIMIT 10`,
            [`%${query}%`]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen van categorie-suggesties:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen categorie-suggesties.' });
    }
};
