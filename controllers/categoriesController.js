const pool = require('../db'); // Zorg ervoor dat je databaseconfiguratie goed is aangesloten

// Haal alle categorieën op
exports.getAllCategories = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, naam, icon FROM categories ORDER BY naam ASC');
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen van categorieën:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen categorieën' });
    }
};


// Voeg een categorie toe
exports.addCategory = async (req, res) => {
    const { naam, icon } = req.body;
    try {
        await pool.query('INSERT INTO categories (naam, icon) VALUES ($1, $2)', [naam, icon]);
        res.status(201).json({ message: '✅ Categorie toegevoegd' });
    } catch (err) {
        console.error('❌ Fout bij toevoegen van categorie:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij toevoegen categorie' });
    }
};


// API: Wijzig een categorie
exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { naam, icon } = req.body;

    if (!naam) {
        return res.status(400).json({ error: '❌ Naam van de categorie is vereist' });
    }

    try {
        const result = await pool.query(
            'UPDATE categories SET naam = $1, icon = $2 WHERE id = $3',
            [naam, icon, id]
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

// ✅ Query voor categorieën en uitgaven per maand
exports.getCategoryExpenses = async (req, res) => {
    try {
        const query = `
            SELECT 
                c.naam AS category,
                COALESCE(SUM(CASE 
                    WHEN DATE_PART('month', t.transactiedatum) = DATE_PART('month', CURRENT_DATE) 
                    THEN t.bedrag ELSE 0 END), 0)::NUMERIC AS current_month,
                COALESCE(SUM(CASE 
                    WHEN DATE_PART('month', t.transactiedatum) = DATE_PART('month', CURRENT_DATE) - 1 
                    THEN t.bedrag ELSE 0 END), 0)::NUMERIC AS previous_month,
                COALESCE(SUM(t.bedrag) / NULLIF(EXTRACT(YEAR FROM AGE(MIN(t.transactiedatum))) * 12 
                    + EXTRACT(MONTH FROM AGE(MIN(t.transactiedatum))), 0), 0)::NUMERIC AS average_per_month
            FROM categories c
            LEFT JOIN transactions t ON c.id = t.category_id
            GROUP BY c.naam
            ORDER BY c.naam;

        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen categorie-uitgaven:', err.message);
        res.status(500).json({ error: 'Serverfout bij ophalen categorie-uitgaven.' });
    }
};
