module.exports = (err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    res.status(500).json({ error: '❌ Interne Serverfout' });
};
