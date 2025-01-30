const pool = require('../db');

// Query voor categorieën en uitgaven per maand

exports.getCategoryExpenses = async (req, res) => {
  try {
      const query = `
                WITH monthly_totals AS (
                -- Bereken het totaalbedrag per maand per categorie
                SELECT 
                    c.naam AS category,
                    date_trunc('month', t.transactiedatum) AS month,
                    SUM(CASE
                        WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                        WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                        WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                        WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                        ELSE 0
                    END) AS total
                FROM 
                    categories c
                LEFT JOIN 
                    transactions t 
                ON 
                    c.id = t.category_id
                WHERE 
                    t.transactiedatum < date_trunc('month', CURRENT_DATE) -- Alleen maanden vóór de huidige maand
                GROUP BY 
                    c.naam, date_trunc('month', t.transactiedatum)
            ),
            category_summaries AS (
                -- Sommeer de maandelijkse totalen per categorie en tel het aantal maanden
                SELECT 
                    category,
                    SUM(total) AS total_sum,
                    COUNT(DISTINCT month) AS total_months
                FROM 
                    monthly_totals
                GROUP BY 
                    category
            ),
            previous_month_totals AS (
                -- Bereken de totalen van de vorige maand per categorie
                SELECT 
                    c.naam AS category,
                    SUM(CASE
                        WHEN date_trunc('month', t.transactiedatum) = date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
                        THEN CASE
                            WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                            WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                            WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                            WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                            ELSE 0
                        END
                        ELSE 0
                    END) AS previous_month_total
                FROM 
                    categories c
                LEFT JOIN 
                    transactions t 
                ON 
                    c.id = t.category_id
                GROUP BY 
                    c.naam
            ),
            current_month_totals AS (
                -- Bereken de totalen van de huidige maand per categorie
                SELECT 
                    c.naam AS category,
                    SUM(CASE
                        WHEN date_trunc('month', t.transactiedatum) = date_trunc('month', CURRENT_DATE)
                        THEN CASE
                            WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                            WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                            WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                            WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                            ELSE 0
                        END
                        ELSE 0
                    END) AS current_month_total
                FROM 
                    categories c
                LEFT JOIN 
                    transactions t 
                ON 
                    c.id = t.category_id
                GROUP BY 
                    c.naam
            )
            -- Combineer alles: huidige maand, vorige maand, gemiddelde per maand
            SELECT 
                cs.category,
                COALESCE(cm.current_month_total, 0)::NUMERIC(10, 2) AS current_month_total,
                COALESCE(pm.previous_month_total, 0)::NUMERIC(10, 2) AS previous_month_total,
                ROUND(cs.total_sum::NUMERIC / NULLIF(cs.total_months, 0), 2) AS average_per_month
            FROM 
                category_summaries cs
            LEFT JOIN 
                previous_month_totals pm
            ON 
                cs.category = pm.category
            LEFT JOIN 
                current_month_totals cm
            ON 
                cs.category = cm.category
            ORDER BY 
                cs.category;

      `;

      const { rows } = await pool.query(query);
      res.status(200).json(rows);
  } catch (err) {
      console.error('❌ Fout bij ophalen categorie-uitgaven:', err.message);
      res.status(500).json({ error: 'Serverfout bij ophalen categorie-uitgaven.' });
  }
};

// Alle categorie-uitgaven waarvan het rekeningnummer eindigt op '11'

exports.getExpensesEndingIn11 = async (req, res) => {
  try {
    const query = `
    WITH monthly_totals AS (
    -- Bereken het totaalbedrag per maand per categorie
    SELECT 
        c.naam AS category,
        date_trunc('month', t.transactiedatum) AS month,
        SUM(
            CASE
                WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                ELSE 0
            END
        ) AS total
    FROM transactions t
    INNER JOIN categories c ON t.category_id = c.id
    WHERE t.rekeningnummer = 'NL38KNAB0726642711'
    GROUP BY c.naam, date_trunc('month', t.transactiedatum)
),
previous_month_totals AS (
    -- Totalen per categorie voor vorige maand
    SELECT category, SUM(total) AS previous_month_total
    FROM monthly_totals
    WHERE month = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
    GROUP BY category
),
current_month_totals AS (
    -- Totalen per categorie voor huidige maand
    SELECT category, SUM(total) AS current_month_total
    FROM monthly_totals
    WHERE month = date_trunc('month', CURRENT_DATE)
    GROUP BY category
),
category_summaries AS (
    -- Gemiddelde zonder de huidige maand
    SELECT category, SUM(total) AS total_sum, COUNT(DISTINCT month) AS total_months
    FROM monthly_totals
    WHERE month < date_trunc('month', CURRENT_DATE)
    GROUP BY category
)
-- Eindselectie: alle totalen per categorie
SELECT 
    COALESCE(cs.category, pm.category, cm.category) AS category,
    COALESCE(cm.current_month_total, 0)::NUMERIC(10, 2) AS current_month_total,
    COALESCE(pm.previous_month_total, 0)::NUMERIC(10, 2) AS previous_month_total,
    ROUND(
        COALESCE(cs.total_sum, 0) / NULLIF(cs.total_months, 0), 
        2
    ) AS average_per_month  
FROM category_summaries cs
LEFT JOIN previous_month_totals pm ON cs.category = pm.category
LEFT JOIN current_month_totals cm ON cs.category = cm.category
ORDER BY category;


    `;
        
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Alle categorie-uitgaven waarvan het rekeningnummer eindigt op '90'

exports.getExpensesEndingIn90 = async (req, res) => {
  try {
    const query = `
  WITH monthly_totals AS (
    -- Bereken het totaalbedrag per maand per categorie
    SELECT 
        c.naam AS category,
        date_trunc('month', t.transactiedatum) AS month,
        SUM(
            CASE
                WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                ELSE 0
            END
        ) AS total
    FROM transactions t
    INNER JOIN categories c ON t.category_id = c.id
    WHERE t.rekeningnummer = 'NL33KNAB0740197290'
    GROUP BY c.naam, date_trunc('month', t.transactiedatum)
),
previous_month_totals AS (
    -- Totalen per categorie voor vorige maand
    SELECT category, SUM(total) AS previous_month_total
    FROM monthly_totals
    WHERE month = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
    GROUP BY category
),
current_month_totals AS (
    -- Totalen per categorie voor huidige maand
    SELECT category, SUM(total) AS current_month_total
    FROM monthly_totals
    WHERE month = date_trunc('month', CURRENT_DATE)
    GROUP BY category
),
category_summaries AS (
    -- Gemiddelde zonder de huidige maand
    SELECT category, SUM(total) AS total_sum, COUNT(DISTINCT month) AS total_months
    FROM monthly_totals
    WHERE month < date_trunc('month', CURRENT_DATE)
    GROUP BY category
)
-- Eindselectie: alle totalen per categorie
SELECT 
    COALESCE(cs.category, pm.category, cm.category) AS category,
    COALESCE(cm.current_month_total, 0)::NUMERIC(10, 2) AS current_month_total,
    COALESCE(pm.previous_month_total, 0)::NUMERIC(10, 2) AS previous_month_total,
    ROUND(
        COALESCE(cs.total_sum, 0) / NULLIF(cs.total_months, 0), 
        2
    ) AS average_per_month  
FROM category_summaries cs
LEFT JOIN previous_month_totals pm ON cs.category = pm.category
LEFT JOIN current_month_totals cm ON cs.category = cm.category
ORDER BY category;



    `;
    
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
