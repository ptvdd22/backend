const pool = require('../db');

// Haal alle labels op
exports.getAllLabels = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, naam FROM labels ORDER BY naam ASC');
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen van labels:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen labels' });
    }
};

// Voeg een label toe
exports.addLabel = async (req, res) => {
    const { naam } = req.body;

    // Validatie: naam is verplicht
    if (!naam || naam.trim() === '') {
        return res.status(400).json({ error: '❌ De naam van het label is verplicht.' });
    }

    try {
        // Controleer of het label al bestaat
        const existingLabel = await pool.query('SELECT * FROM labels WHERE naam = $1', [naam]);
        if (existingLabel.rowCount > 0) {
            return res.status(409).json({ error: '❌ Label met deze naam bestaat al.' });
        }

        // Voeg het label toe
        const result = await pool.query(
            'INSERT INTO labels (naam) VALUES ($1) RETURNING *',
            [naam]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('❌ Fout bij toevoegen van label:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij toevoegen van label.' });
    }
};

// Wijzig een label
exports.updateLabel = async (req, res) => {
    const { id } = req.params;
    const { naam } = req.body;

    if (!naam) {
        return res.status(400).json({ error: '❌ Naam van het label is vereist' });
    }

    try {
        const result = await pool.query(
            'UPDATE labels SET naam = $1 WHERE id = $2',
            [naam, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '❌ Label niet gevonden' });
        }

        res.status(200).json({ message: '✅ Label succesvol bijgewerkt' });
    } catch (err) {
        console.error('❌ Fout bij bijwerken label:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij bijwerken label' });
    }
};

// Verwijder een label
exports.deleteLabel = async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('UPDATE transactions SET label_id = NULL WHERE label_id = $1', [id]);
        const result = await pool.query('DELETE FROM labels WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '❌ Label niet gevonden' });
        }

        res.status(200).json({ message: '✅ Label succesvol verwijderd' });
    } catch (err) {
        console.error('❌ Fout bij verwijderen label:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij verwijderen label' });
    }
};

// Haal unieke labels op uit transacties
exports.getDistinctLabels = async (req, res) => {
    try {
        const query = 'SELECT DISTINCT label FROM transactions WHERE label IS NOT NULL';
        const { rows } = await pool.query(query);
        const labels = rows.map((row) => row.label);
        res.status(200).json(labels);
    } catch (err) {
        console.error('❌ Fout bij ophalen labels:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen labels' });
    }
};

// Zoek suggesties voor labels
exports.suggestLabels = async (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: '❌ Query-parameter is vereist voor suggesties.' });
    }

    try {
        const result = await pool.query(
            `SELECT id, naam FROM labels WHERE naam ILIKE $1 LIMIT 10`,
            [`%${query}%`]
        );

        console.log('📊 Label suggesties:', result.rows);

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen van label-suggesties:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen label-suggesties' });
    }
};
