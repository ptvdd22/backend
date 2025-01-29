const pool = require('../db');

// Voeg een regel toe
exports.addRule = async (req, res) => {
    const { tegenrekeninghouder, tegenrekeningnummer, categoryId, labelId, person } = req.body;

    if (!tegenrekeninghouder || !categoryId) {
        return res.status(400).json({ error: '❌ Tegenrekeninghouder en categorie zijn verplicht.' });
    }

    try {
        await pool.query(
            `INSERT INTO rules (tegenrekeningnummer, tegenrekeninghouder, category_id, label_id, person)
            VALUES ($1, $2, $3, $4, $5)`,
           [tegenrekeningnummer || null, tegenrekeninghouder, categoryId, labelId || null, person || null]
       );

        res.status(201).json({ message: '✅ Regel succesvol toegevoegd!' });
    } catch (err) {
        console.error('❌ Fout bij toevoegen van regel:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij toevoegen van regel' });
    }
};

// Haal alle regels op
exports.getRules = async (req, res) => {
    try {
        const result = await pool.query(`
           SELECT 
                r.id, 
                r.tegenrekeningnummer, 
                r.tegenrekeninghouder, 
                COALESCE(c.naam, '') AS categorie, 
                COALESCE(l.naam, '') AS label,
                r.person
            FROM rules r
            LEFT JOIN categories c ON r.category_id = c.id
            LEFT JOIN labels l ON r.label_id = l.id
        `);

        res.status(200).json(result.rows || []);
    } catch (err) {
        console.error('❌ Fout bij ophalen van regels:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen regels' });
    }
};

// Verwijder een regel
exports.deleteRule = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM rules WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '❌ Regel niet gevonden' });
        }

        res.status(200).json({ message: '✅ Regel succesvol verwijderd!' });
    } catch (err) {
        console.error('❌ Fout bij verwijderen van regel:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij verwijderen van regel' });
    }
};

// Update een regel
exports.updateRule = async (req, res) => {
    const { id } = req.params;
    const { tegenrekeningnummer, tegenrekeninghouder, categorie, label, person } = req.body;

    // Alleen rekeninghouder is verplicht
    if (!tegenrekeninghouder || tegenrekeninghouder.trim() === '') {
        return res.status(400).json({ error: '❌ Tegenrekeninghouder is verplicht.' });
    }

    try {
        const categoryResult = categorie
            ? await pool.query('SELECT id FROM categories WHERE naam = $1', [categorie])
            : { rows: [{ id: null }] };
        const categoryId = categoryResult.rows[0]?.id;

        const labelResult = label
            ? await pool.query('SELECT id FROM labels WHERE naam = $1', [label])
            : { rows: [{ id: null }] };
        const labelId = labelResult.rows[0]?.id;

        const result = await pool.query(
            `UPDATE rules 
             SET tegenrekeningnummer = $1, tegenrekeninghouder = $2, category_id = $3, label_id = $4, person = $5 
             WHERE id = $6`,
            [tegenrekeningnummer || null, tegenrekeninghouder, categoryId, labelId, person || null, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '❌ Regel niet gevonden.' });
        }

        res.status(200).json({ message: '✅ Regel succesvol bijgewerkt.' });
    } catch (err) {
        console.error('❌ Fout bij bijwerken van regel:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij bijwerken van regel.' });
    }
};