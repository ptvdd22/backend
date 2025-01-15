const express = require('express');
const cors = require('cors');

module.exports = (app) => {
    // JSON en URL-encoded middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // CORS Middleware
    app.use(cors({
        origin: process.env.CORS_ORIGIN?.split(',') || [
            'http://localhost:3000',
            'https://frontend-cr3f35qt0-martijn-s-projects.vercel.app',
            'https://hfin.vercel.app'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type'],
    }));
};
